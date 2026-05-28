import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import QRCode from "qrcode";
import { connectMongo } from "./mongo.js";
import { subscriber, keys } from "./redis.js";
import {
  castVote, getTally, startFlushWorker,
  addTrack, advance, getState, publishState,
} from "./votes.js";
import { heartbeat, leave, startPresenceSweeper } from "./presence.js";
import { parseVideoId, fetchTitle, search, searchEnabled } from "./youtube.js";

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json());

// --- Health check (ALB target-group probe hits this) ---------------------------
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Tells the UI whether type-to-search is available (needs YOUTUBE_API_KEY).
app.get("/api/config", (_req, res) => res.json({ searchEnabled: searchEnabled() }));

// --- Static voting page (served same-origin, so no CORS) ------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, "../public")));

// --- Room state: now-playing + queue ordered by votes --------------------------
app.get("/api/gyms/:gymId/state", async (req, res) => {
  res.json(await getState(req.params.gymId));
});

// --- QR code so anyone on the same network can join the floor -------------------
// Encodes the floor URL using the Host the screen reached us on (the LAN IP),
// which is exactly the address other phones on the network should open.
app.get("/api/gyms/:gymId/qr.svg", async (req, res) => {
  try {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const joinUrl = `${proto}://${host}/?gym=${encodeURIComponent(req.params.gymId)}`;
    const svg = await QRCode.toString(joinUrl, {
      type: "svg", margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#0a0a0b", light: "#ffffff" },
    });
    res.type("image/svg+xml").set("Cache-Control", "no-store").send(svg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Add a song (anyone with a YouTube link or, if enabled, a search) ----------
// Body: { url | videoId, addedBy?, title? }. Title is auto-resolved via oEmbed.
app.post("/api/gyms/:gymId/tracks", async (req, res) => {
  try {
    const { gymId } = req.params;
    const { url, videoId: rawId, addedBy, title } = req.body;
    const videoId = parseVideoId(rawId || url);
    if (!videoId) return res.status(400).json({ error: "could not find a YouTube video id in that input" });

    const resolvedTitle = title || (await fetchTitle(videoId)) || videoId;
    const state = await addTrack({ gymId, videoId, title: resolvedTitle, addedBy });
    res.json(state);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Floor reports the current song ended -> promote the next top track --------
app.post("/api/gyms/:gymId/advance", async (req, res) => {
  try {
    res.json(await advance({ gymId: req.params.gymId, finishedId: req.body?.finishedId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Optional: type-to-search (only if YOUTUBE_API_KEY is set) ------------------
app.get("/api/youtube/search", async (req, res) => {
  try {
    const results = await search(String(req.query.q || ""));
    if (results === null) return res.status(501).json({ error: "search disabled — set YOUTUBE_API_KEY (paste a link instead)" });
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Cast / change a vote ------------------------------------------------------
// Header: Idempotency-Key (client UUID per action). Body: { memberId, direction }.
app.post("/api/gyms/:gymId/tracks/:trackId/vote", async (req, res) => {
  try {
    const { gymId, trackId } = req.params;
    const { memberId, direction } = req.body;
    const idemKey = req.get("Idempotency-Key") || randomUUID();
    if (!memberId) return res.status(400).json({ error: "memberId required" });

    const result = await castVote({ gymId, trackId, memberId, direction, idemKey });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/gyms/:gymId/tracks/:trackId/tally", async (req, res) => {
  const { gymId, trackId } = req.params;
  res.json({ tally: await getTally(gymId, trackId) });
});

// --- WebSocket room: any task can serve any client (stateless, pub/sub fan-out) -
const server = createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map(); // gymId -> Set<ws>

wss.on("connection", (ws, req) => {
  const gymId = new URL(req.url, "http://x").searchParams.get("gym");
  if (!gymId) return ws.close();
  ws.gymId = gymId;
  if (!rooms.has(gymId)) rooms.set(gymId, new Set());
  rooms.get(gymId).add(ws);
  // Send a snapshot immediately so a fresh client renders without waiting for an event.
  getState(gymId).then((s) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "state", ...s }));
  }).catch(() => {});

  // Presence: the client says "hello" with its name on connect, then sends a
  // periodic "heartbeat". Both refresh lastSeen; we only re-broadcast when the
  // active set actually changes (a brand-new member or a returning timed-out one).
  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "hello" || msg.type === "heartbeat") {
      if (!msg.memberId) return;
      ws.memberId = msg.memberId;
      try {
        const changed = await heartbeat(gymId, msg.memberId, msg.name);
        if (changed) await publishState(gymId);
      } catch {}
    }
  });

  ws.on("close", async () => {
    rooms.get(gymId)?.delete(ws);
    if (ws.memberId) {
      try { await leave(gymId, ws.memberId); await publishState(gymId); } catch {}
    }
  });
});

// One subscriber connection fans out Redis messages to local WS clients. Run N
// API tasks and any of them can serve any client — no sticky sessions needed.
subscriber.psubscribe("gym:*");
subscriber.on("pmessage", (_pattern, channel, message) => {
  const gymId = channel.slice("gym:".length);
  for (const ws of rooms.get(gymId) || []) {
    if (ws.readyState === ws.OPEN) ws.send(message);
  }
});

const stop = startFlushWorker();
const stopPresence = startPresenceSweeper(publishState);
await connectMongo();
server.listen(PORT, () => console.log(`GymJam API on :${PORT}`));

process.on("SIGTERM", () => { stop(); stopPresence(); server.close(); });
