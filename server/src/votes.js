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
 */
export async function castVote({ gymId, trackId, memberId, direction, idemKey }) {
  if (!["up", "down", "clear"].includes(direction)) {
    throw new Error(`invalid direction: ${direction}`);
  }
  const [tally, deduped] = await redis.castVote(
    keys.tally(gymId, trackId),
    keys.member(gymId, trackId, memberId),
    keys.idem(idemKey),
    keys.dirty(),
    direction,
    String(IDEM_TTL),
    `${gymId}:${trackId}`
  );

  // Broadcast the new tally to everyone in the gym's room (WS fan-out via pub/sub).
  await redis.publish(
    keys.channel(gymId),
    JSON.stringify({ type: "tally", trackId, tally })
  );
  return { tally, deduped: Boolean(deduped) };
}

export async function getTally(gymId, trackId) {
  return Number((await redis.get(keys.tally(gymId, trackId))) || 0);
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
      // SPOP atomically removes members, so concurrently-added keys aren't lost.
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
