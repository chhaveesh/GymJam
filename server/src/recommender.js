// recommender.js — thin client to the implicit-ALS recommender (Step 4).
//
// Where the model lives: a SageMaker endpoint exposed via either
//   (a) a direct HTTPS URL on a public/VPC endpoint, OR
//   (b) AWS SigV4-signed invocations (handled by an upstream proxy or sidecar).
// For local dev / docker-compose, you point RECOMMENDER_URL at the ml/ Flask
// container, which speaks the same /invocations contract.
//
// Contract (POST /invocations, JSON):
//   request : { gym_id, candidates: ["<videoId>", ...], n: 10 }
//   response: { recs: [{ video_id, score }, ...] }   // sorted desc by score
//
// Failures are NEVER allowed to break the room. Every public function:
//   - times out fast (1.5s)
//   - returns [] when the recommender is unreachable
//   - trips a circuit breaker after 3 consecutive failures (60s cool-down)
// The vote tally remains the source of truth; rec scores only break ties.

import { redis, keys } from "./redis.js";

const URL = process.env.RECOMMENDER_URL || "";
const TIMEOUT_MS = Number(process.env.RECOMMENDER_TIMEOUT_MS || 1500);
const CACHE_TTL_MS = Number(process.env.RECOMMENDER_CACHE_TTL_MS || 30_000);
const CB_FAIL_THRESHOLD = 3;
const CB_COOLDOWN_MS = 60_000;

let cbFailures = 0;
let cbOpenUntil = 0;

export function recommenderEnabled() {
  return Boolean(URL);
}

function tripBreaker() {
  cbFailures += 1;
  if (cbFailures >= CB_FAIL_THRESHOLD) {
    cbOpenUntil = Date.now() + CB_COOLDOWN_MS;
  }
}
function resetBreaker() { cbFailures = 0; cbOpenUntil = 0; }
function breakerOpen() { return Date.now() < cbOpenUntil; }

async function postInvocations(body) {
  const res = await fetch(URL.replace(/\/+$/, "") + "/invocations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`recommender ${res.status}`);
  return res.json();
}

/**
 * Score a set of candidates for a gym. Returns a Map<trackId, score>.
 * Empty Map when the recommender is disabled / broken / times out.
 */
export async function scoreCandidates({ gymId, candidates }) {
  if (!recommenderEnabled() || !candidates?.length || breakerOpen()) return new Map();
  try {
    const data = await postInvocations({ gym_id: gymId, candidates, n: candidates.length });
    resetBreaker();
    const out = new Map();
    for (const r of data.recs || []) out.set(r.video_id, Number(r.score) || 0);
    return out;
  } catch (_err) {
    tripBreaker();
    return new Map();
  }
}

/**
 * Top-N recommendations for a gym. The endpoint decides the candidate universe
 * when `candidates` is omitted (it knows the catalog from training).
 * Cached per-gym in Redis to keep the endpoint cool under bursty WS connects.
 */
export async function recommend({ gymId, n = 10, candidates }) {
  if (!recommenderEnabled() || breakerOpen()) return [];

  // Cache hit?
  if (!candidates) {
    try {
      const at = Number((await redis.get(keys.recCacheAt(gymId))) || 0);
      if (at && Date.now() - at < CACHE_TTL_MS) {
        const cached = await redis.hgetall(keys.recCache(gymId));
        const recs = Object.entries(cached)
          .map(([video_id, score]) => ({ video_id, score: Number(score) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, n);
        if (recs.length) return recs;
      }
    } catch { /* cache miss, fall through */ }
  }

  try {
    const data = await postInvocations({ gym_id: gymId, candidates: candidates || null, n });
    resetBreaker();
    const recs = (data.recs || []).slice(0, n);

    if (!candidates && recs.length) {
      // Cache only the catalog-wide call (the bounded one); skip ad-hoc rescoring.
      try {
        const flat = recs.flatMap((r) => [r.video_id, String(r.score)]);
        await redis.del(keys.recCache(gymId));
        if (flat.length) await redis.hset(keys.recCache(gymId), ...flat);
        await redis.set(keys.recCacheAt(gymId), String(Date.now()));
        await redis.expire(keys.recCache(gymId), Math.ceil(CACHE_TTL_MS / 1000) * 4);
        await redis.expire(keys.recCacheAt(gymId), Math.ceil(CACHE_TTL_MS / 1000) * 4);
      } catch { /* cache write best-effort */ }
    }
    return recs;
  } catch (_err) {
    tripBreaker();
    return [];
  }
}

// Test seam: lets the smoke test reset state without restarting the process.
export function __resetForTests() { cbFailures = 0; cbOpenUntil = 0; }
