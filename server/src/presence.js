// presence.js — who's currently "on the floor" of a gym, tracked in Redis.
//
// Why Redis (not in-memory): the README's whole horizontal-scale story is "any
// API task can serve any client, no sticky sessions". Presence has to live in
// the shared store too, or two tasks would each see only their own sockets.
//
//   gym:{g}:presence  ZSET  member = memberId, score = lastSeen (ms)
//   gym:{g}:names     HASH  field  = memberId, value = display name
//
// A client is "active" if its lastSeen is within PRESENCE_TTL_MS. The browser
// sends a heartbeat every ~10s over the same WebSocket; anyone who goes quiet
// for longer than the TTL is pruned and the room is told.

import { redis, keys } from "./redis.js";

const TTL_MS = Number(process.env.PRESENCE_TTL_MS || 30000); // offline after 30s of silence

/**
 * Record a heartbeat / join. Returns true if this is a *new* member (so the
 * caller knows the active set changed and should re-broadcast). A name is only
 * passed on the initial "hello"; later heartbeats omit it.
 */
export async function heartbeat(gymId, memberId, name) {
  if (!memberId) return false;
  const added = await redis.zadd(keys.presence(gymId), Date.now(), memberId); // 1 = newly added
  if (name) await redis.hset(keys.names(gymId), memberId, String(name).slice(0, 40));
  return added === 1;
}

/** Explicit leave (socket closed). */
export async function leave(gymId, memberId) {
  if (!memberId) return;
  await redis.zrem(keys.presence(gymId), memberId);
  await redis.hdel(keys.names(gymId), memberId);
}

/** Drop anyone who hasn't been seen within the TTL. Returns how many were removed. */
export async function prune(gymId) {
  const cutoff = Date.now() - TTL_MS;
  const stale = await redis.zrangebyscore(keys.presence(gymId), 0, cutoff);
  if (!stale.length) return 0;
  await redis.zrem(keys.presence(gymId), ...stale);
  await redis.hdel(keys.names(gymId), ...stale);
  return stale.length;
}

/** The active members right now: [{ memberId, name }], freshest last. */
export async function getActiveUsers(gymId) {
  await prune(gymId);
  const cutoff = Date.now() - TTL_MS;
  const ids = await redis.zrangebyscore(keys.presence(gymId), cutoff, "+inf");
  if (!ids.length) return [];
  const names = await redis.hgetall(keys.names(gymId));
  return ids.map((id) => ({ memberId: id, name: names[id] || "anon" }));
}

/** Fast count of active members (used by the vote-to-skip threshold later). */
export async function countActiveUsers(gymId) {
  await prune(gymId);
  const cutoff = Date.now() - TTL_MS;
  return redis.zcount(keys.presence(gymId), cutoff, "+inf");
}

/**
 * Background sweeper: every interval, prune every gym that has a presence set
 * and re-broadcast the ones that changed, so timed-out users disappear from the
 * panel even if nobody votes. publishFn(gymId) is votes.js's publishState.
 */
export function startPresenceSweeper(publishFn, intervalMs = 10000) {
  const timer = setInterval(async () => {
    try {
      const stream = redis.scanStream({ match: "gym:*:presence", count: 100 });
      for await (const batch of stream) {
        for (const key of batch) {
          const gymId = key.slice("gym:".length, key.length - ":presence".length);
          const removed = await prune(gymId);
          if (removed > 0) await publishFn(gymId);
        }
      }
    } catch (err) {
      console.error("[presence sweep] error", err);
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
