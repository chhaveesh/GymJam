// concurrency.js — proves the two CV claims under fire.
// Run the stack (docker compose up), then: node server/test/concurrency.js
import { randomUUID } from "node:crypto";
import assert from "node:assert";

const BASE = process.env.BASE || "http://localhost:3000";
const GYM = "demo-gym";
const TRACK = `t-${randomUUID().slice(0, 8)}`; // fresh track so the test is repeatable

const vote = (memberId, direction, idemKey = randomUUID()) =>
  fetch(`${BASE}/api/gyms/${GYM}/tracks/${TRACK}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
    body: JSON.stringify({ memberId, direction }),
  }).then((r) => r.json());

const tally = () =>
  fetch(`${BASE}/api/gyms/${GYM}/tracks/${TRACK}/tally`).then((r) => r.json()).then((d) => d.tally);

// 1) RACE: 50 distinct members upvote at the same instant -> tally MUST be exactly 50.
await Promise.all(Array.from({ length: 50 }, (_, i) => vote(`m${i}`, "up")));
assert.strictEqual(await tally(), 50, "concurrent upvotes lost an update");
console.log("✓ 50 concurrent upvotes -> tally is exactly 50 (no lost updates)");

// 2) RACE + switch: 20 of them switch up -> down -> tally MUST be 30 - 20 = 10.
await Promise.all(Array.from({ length: 20 }, (_, i) => vote(`m${i}`, "down")));
assert.strictEqual(await tally(), 10, "vote switch miscounted");
console.log("✓ 20 switch to down -> tally is exactly 10 (switch handled atomically)");

// 3) IDEMPOTENCY: same action key fired 10x concurrently -> counted once.
const before = await tally();
const key = randomUUID();
await Promise.all(Array.from({ length: 10 }, () => vote("retry-bot", "up", key)));
assert.strictEqual(await tally(), before + 1, "retries double-counted");
console.log("✓ 10 retries of one action -> counted once (idempotent)");

console.log("\nAll concurrency invariants hold. This is your live interview demo.");
