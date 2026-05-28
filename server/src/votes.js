import { randomUUID } from "node:crypto";
import { redis, keys } from "./redis.js";
import { getDb } from "./mongo.js";

const IDEM_TTL = Number(process.env.IDEM_TTL || 86400); // 24h
const FLUSH_MS = Number(process.env.FLUSH_MS || 500);

/**
 * Cast or change a member's vote. Returns { tally, deduped }.
 *
 * idemKey is a client-generated UUID per user *action*. A network retry of the
 * same action reuses the key (→ counted once); a genuine vote change is a new
 * action with a new key (→ processed). This is the idempotency guarantee.
 *
 * The Lua script also re-scores this track in the gym's ranked queue, so the
 * order the floor plays from updates atomically with the tally.
 */
export async function castVote({ gymId, trackId, memberId, direction, idemKey }) {
  if (!["up", "down", "clear"].includes(direction)) {
    throw new Error(`invalid direction: ${direction}`);
  }
  // A missing key must mean "a unique action", never a shared "idem:undefined"
  // bucket that would silently dedupe every keyless vote into one.
  idemKey = idemKey || randomUUID();
  const [tally, deduped] = await redis.castVote(
    keys.tally(gymId, trackId),
    keys.member(gymId, trackId, memberId),
    keys.idem(idemKey),
    keys.dirty(),
    keys.queue(gymId),
    direction,
    String(IDEM_TTL),
    `${gymId}:${trackId}`, // dirty member
    trackId                // queue member
  );

  await publishState(gymId); // live reorder for everyone in the room
  return { tally, deduped: Boolean(deduped) };
}

export async function getTally(gymId, trackId) {
  return Number((await redis.get(keys.tally(gymId, trackId))) || 0);
}

/**
 * Add a track to a gym's queue. Idempotent on videoId: adding the same song
 * twice keeps its existing votes (ZADD NX won't reset the score). The first
 * track added with nothing playing becomes the floor's "now playing".
 */
export async function addTrack({ gymId, videoId, title, addedBy }) {
  const trackId = videoId; // trackId IS the YouTube id, so votes & adds line up
  const meta = JSON.stringify({
    videoId,
    title: title || videoId,
    addedBy: addedBy || "anon",
    addedAt: Date.now(),
  });
  await redis.hset(keys.meta(gymId), trackId, meta);
  await redis.zadd(keys.queue(gymId), "NX", 0, trackId);
  await redis.set(keys.now(gymId), trackId, "NX"); // only if nothing playing yet
  await publishState(gymId);
  return getState(gymId);
}

/**
 * The floor finished a track. Drop it from the queue and promote the next
 * highest-voted song to "now playing". Guarded so a stale/duplicate "ended"
 * event from one screen can't skip a song that's actually still playing.
 */
export async function advance({ gymId, finishedId }) {
  const current = await redis.get(keys.now(gymId));
  if (finishedId && current && finishedId !== current) {
    return getState(gymId); // stale event — ignore, don't skip the live song
  }
  const toRemove = finishedId || current;
  if (toRemove) await removeTrack(gymId, toRemove);

  const [nextId] = await redis.zrevrange(keys.queue(gymId), 0, 0);
  if (nextId) await redis.set(keys.now(gymId), nextId);
  else await redis.del(keys.now(gymId));

  await publishState(gymId);
  return getState(gymId);
}

/** Remove a track entirely: queue entry, metadata, tally, and per-member votes. */
async function removeTrack(gymId, trackId) {
  await redis.zrem(keys.queue(gymId), trackId);
  await redis.hdel(keys.meta(gymId), trackId);
  await redis.del(keys.tally(gymId, trackId));
  // Clear this track's per-member vote keys so a future re-add starts clean.
  const pattern = `gym:${gymId}:track:${trackId}:m:*`;
  const stream = redis.scanStream({ match: pattern, count: 200 });
  for await (const batch of stream) {
    if (batch.length) await redis.unlink(...batch);
  }
}

/** Full room snapshot: what's playing + the queue ordered by votes (desc). */
export async function getState(gymId) {
  const [nowId, flat, metaAll] = await Promise.all([
    redis.get(keys.now(gymId)),
    redis.zrevrange(keys.queue(gymId), 0, -1, "WITHSCORES"),
    redis.hgetall(keys.meta(gymId)),
  ]);

  const queue = [];
  for (let i = 0; i < flat.length; i += 2) {
    const trackId = flat[i];
    const raw = metaAll[trackId];
    if (!raw) continue; // skip orphans (e.g. tracks never registered via addTrack)
    const m = JSON.parse(raw);
    queue.push({ trackId, ...m, tally: Number(flat[i + 1]) });
  }

  const nowPlaying =
    nowId && metaAll[nowId] ? { trackId: nowId, ...JSON.parse(metaAll[nowId]) } : null;

  return { gymId, nowPlaying, queue };
}

/** Broadcast the full snapshot to the gym's room via Redis pub/sub. */
export async function publishState(gymId) {
  const state = await getState(gymId);
  await redis.publish(keys.channel(gymId), JSON.stringify({ type: "state", ...state }));
}

/**
 * Durability trade-off (documented in docs/consistency.md):
 * Votes are authoritative in Redis and flushed to Mongo every FLUSH_MS. A crash
 * between flushes loses up to FLUSH_MS of writes — acceptable for vote tallies,
 * and it keeps Mongo off the hot path under burst load.
 */
export function startFlushWorker() {
  const timer = setInterval(async () => {
    try {
      const dirty = await redis.spop(keys.dirty(), 500);
      if (!dirty.length) return;

      const ops = [];
      for (const gt of dirty) {
        const [gymId, trackId] = gt.split(":");
        const tally = await getTally(gymId, trackId);
        ops.push({
          updateOne: {
            filter: { gymId, trackId },
            update: { $set: { gymId, trackId, tally, updatedAt: new Date() } },
            upsert: true,
          },
        });
      }
      if (ops.length) await getDb().collection("tallies").bulkWrite(ops, { ordered: false });
    } catch (err) {
      console.error("[flush] error", err);
    }
  }, FLUSH_MS);
  return () => clearInterval(timer);
}
