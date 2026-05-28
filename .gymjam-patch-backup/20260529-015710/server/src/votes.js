import { randomUUID } from "node:crypto";
import { redis, keys } from "./redis.js";
import { getDb } from "./mongo.js";
import { getActiveUsers, countActiveUsers } from "./presence.js";
import { fetchTitle, seedVideoIds } from "./youtube.js";

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
 * Add a track to a gym's queue (no broadcast — used by addTrack and autofill).
 * Idempotent on videoId: adding the same song twice keeps its existing votes
 * (ZADD NX won't reset the score). The first track added with nothing playing
 * becomes the floor's "now playing" and starts the shared clock.
 */
async function addTrackRaw({ gymId, videoId, title, addedBy }) {
  const trackId = videoId; // trackId IS the YouTube id, so votes & adds line up
  const meta = JSON.stringify({
    videoId,
    title: title || videoId,
    addedBy: addedBy || "anon",
    addedAt: Date.now(),
  });
  await redis.hset(keys.meta(gymId), trackId, meta);
  await redis.zadd(keys.queue(gymId), "NX", 0, trackId);
  const became = await redis.set(keys.now(gymId), trackId, "NX"); // only if nothing playing yet
  if (became) await redis.set(keys.startedAt(gymId), String(Date.now()));
  return trackId;
}

export async function addTrack(args) {
  await addTrackRaw(args);
  await publishState(args.gymId);
  return getState(args.gymId);
}

/**
 * The floor finished a track. Drop it from the queue and promote the next
 * highest-voted song to "now playing". Guarded so a stale/duplicate "ended"
 * event from one screen can't skip a song that's actually still playing — and,
 * now that EVERY screen plays, so N simultaneous "ended" reports promote the
 * next song exactly once (a short Redis lock per finished track).
 */
export async function advance({ gymId, finishedId }) {
  const current = await redis.get(keys.now(gymId));
  if (finishedId && current && finishedId !== current) {
    return getState(gymId); // stale event — ignore, don't skip the live song
  }
  const toRemove = finishedId || current;
  if (toRemove) {
    // First "ended" report wins the lock and performs the promotion; the rest
    // (from other screens) see the lock held and bail out as no-ops.
    const won = await redis.set(keys.advLock(gymId, toRemove), "1", "NX", "EX", 5);
    if (!won) return getState(gymId);
    await removeTrack(gymId, toRemove);
  }

  const [nextId] = await redis.zrevrange(keys.queue(gymId), 0, 0);
  if (nextId) {
    await redis.set(keys.now(gymId), nextId);
    await redis.set(keys.startedAt(gymId), String(Date.now())); // restart the shared clock
  } else {
    await redis.del(keys.now(gymId));
    await redis.del(keys.startedAt(gymId));
  }

  await publishState(gymId);
  return getState(gymId);
}

/** Remove a track entirely: queue entry, metadata, tally, skip set, and per-member votes. */
async function removeTrack(gymId, trackId) {
  await redis.zrem(keys.queue(gymId), trackId);
  await redis.hdel(keys.meta(gymId), trackId);
  await redis.del(keys.tally(gymId, trackId));
  await redis.del(keys.skip(gymId, trackId)); // skip votes don't carry to the next song
  // Clear this track's per-member vote keys so a future re-add starts clean.
  const pattern = `gym:${gymId}:track:${trackId}:m:*`;
  const stream = redis.scanStream({ match: pattern, count: 200 });
  for await (const batch of stream) {
    if (batch.length) await redis.unlink(...batch);
  }
}

/** Skip threshold: strictly more than half the active room. */
function skipThreshold(active) {
  return Math.floor(active / 2) + 1;
}

/**
 * Vote to skip the current track (toggle). When skip votes reach
 * floor(active/2)+1 — i.e. strictly more than half the room — the song is
 * skipped (advance to the next). Idempotent per action via idemKey.
 */
export async function voteSkip({ gymId, memberId, idemKey }) {
  const current = await redis.get(keys.now(gymId));
  if (!current) return { skipped: false, votes: 0, needed: 0, active: 0, current: null };

  // Idempotency: a retried request must not flip the toggle twice.
  idemKey = idemKey || randomUUID();
  const fresh = await redis.set(keys.idem(idemKey), "1", "NX", "EX", String(IDEM_TTL));

  const skipKey = keys.skip(gymId, current);
  if (fresh) {
    const isMember = await redis.sismember(skipKey, memberId);
    if (isMember) await redis.srem(skipKey, memberId);
    else await redis.sadd(skipKey, memberId);
    await redis.expire(skipKey, 3600);
  }

  const votes = await redis.scard(skipKey);
  const active = await countActiveUsers(gymId);
  const needed = skipThreshold(active);

  if (votes >= needed) {
    await advance({ gymId, finishedId: current }); // skip = advance the current song
    return { skipped: true, votes, needed, active, current };
  }
  await publishState(gymId); // broadcast the updated skip count to everyone
  return { skipped: false, votes, needed, active, current };
}

/**
 * Re-check the skip threshold for the current song. Called when the room size
 * changes (someone leaves), since a smaller room lowers the bar and may tip an
 * already-cast set of skip votes over the line. Returns true if it skipped.
 */
export async function maybeSkip(gymId) {
  const current = await redis.get(keys.now(gymId));
  if (!current) return false;
  const votes = await redis.scard(keys.skip(gymId, current));
  if (votes === 0) return false;
  const active = await countActiveUsers(gymId);
  if (votes >= skipThreshold(active)) {
    await advance({ gymId, finishedId: current });
    return true;
  }
  return false;
}

/**
 * Keep a gym from sitting empty: top the queue up to `target` tracks from the
 * seed pool (Step 3). A short lock stops concurrent connects from double-seeding.
 * In Step 4 the recommender becomes the source of these picks.
 */
export async function autofill({ gymId, target = Number(process.env.SEED_TARGET || 10) }) {
  const size = await redis.zcard(keys.queue(gymId));
  if (size >= target) return getState(gymId);

  const lock = await redis.set(keys.seedLock(gymId), "1", "NX", "EX", 30);
  if (!lock) return getState(gymId);
  try {
    const need = target - (await redis.zcard(keys.queue(gymId)));
    if (need <= 0) return getState(gymId);

    const existing = new Set(Object.keys(await redis.hgetall(keys.meta(gymId))));
    const pool = seedVideoIds().filter((id) => !existing.has(id));
    // Fisher–Yates shuffle so different gyms don't all start identically.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, need);
    if (!picks.length) return getState(gymId);

    // Resolve titles in parallel (oEmbed, no API key); add sequentially; broadcast once.
    const titled = await Promise.all(
      picks.map(async (id) => ({ id, title: (await fetchTitle(id)) || id }))
    );
    for (const { id, title } of titled) {
      await addTrackRaw({ gymId, videoId: id, title, addedBy: "GymJam" });
    }
    await publishState(gymId);
  } finally {
    await redis.del(keys.seedLock(gymId));
  }
  return getState(gymId);
}

/** Full room snapshot: what's playing + the queue ordered by votes (desc) + who's here. */
export async function getState(gymId) {
  const [nowId, flat, metaAll, activeUsers, startedAtRaw] = await Promise.all([
    redis.get(keys.now(gymId)),
    redis.zrevrange(keys.queue(gymId), 0, -1, "WITHSCORES"),
    redis.hgetall(keys.meta(gymId)),
    getActiveUsers(gymId),
    redis.get(keys.startedAt(gymId)),
  ]);

  const queue = [];
  for (let i = 0; i < flat.length; i += 2) {
    const trackId = flat[i];
    const raw = metaAll[trackId];
    if (!raw) continue; // skip orphans (e.g. tracks never registered via addTrack)
    const m = JSON.parse(raw);
    queue.push({ trackId, ...m, tally: Number(flat[i + 1]) });
  }

  const startedAt = startedAtRaw ? Number(startedAtRaw) : null;
  let nowPlaying =
    nowId && metaAll[nowId]
      ? { trackId: nowId, ...JSON.parse(metaAll[nowId]), startedAt }
      : null;

  // Vote-to-skip progress for the current song (Step 2).
  if (nowPlaying) {
    const skipVotes = await redis.scard(keys.skip(gymId, nowId));
    nowPlaying.skipVotes = skipVotes;
    nowPlaying.skipNeeded = Math.floor(activeUsers.length / 2) + 1;
  }

  // serverNow lets every client align to ONE clock: position = (serverNow - startedAt).
  return { gymId, nowPlaying, queue, activeUsers, serverNow: Date.now() };
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
