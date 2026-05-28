import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { connectMongo } from "./mongo.js";
import { subscriber, keys } from "./redis.js";
import { castVote, getTally, startFlushWorker } from "./votes.js";

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json());

// --- Health check (ALB target-group probe hits this) ---------------------------
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// --- Static voting page (served same-origin, so no CORS) ------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, "../public")));

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
