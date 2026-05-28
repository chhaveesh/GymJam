import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { connectMongo } from "./mongo.js";
import { subscriber, keys } from "./redis.js";
import {
  castVote, getTally, startFlushWorker,
  addTrack, advance, getState,
} from "./votes.js";
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
  if (!rooms.has(gymId)) rooms.set(gymId, new Set());
  rooms.get(gymId).add(ws);
  // Send a snapshot immediately so a fresh client renders without waiting for an event.
  getState(gymId).then((s) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "state", ...s }));
  }).catch(() => {});
  ws.on("close", () => rooms.get(gymId)?.delete(ws));
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
await connectMongo();
server.listen(PORT, () => console.log(`GymJam API on :${PORT}`));

process.on("SIGTERM", () => { stop(); server.close(); });
