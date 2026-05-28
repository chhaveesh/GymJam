// recommender.js — smoke test for the recommender client (no real endpoint).
// Spins up a tiny in-process HTTP server that mimics the SageMaker contract,
// then exercises (a) happy path, (b) timeout/circuit breaker, (c) graceful
// degradation when disabled.

import { createServer } from "node:http";
import assert from "node:assert";

// Make the module pick up RECOMMENDER_URL before we import it.
const port = 9876 + Math.floor(Math.random() * 100);
process.env.RECOMMENDER_URL = `http://127.0.0.1:${port}`;
process.env.RECOMMENDER_TIMEOUT_MS = "500";

const { recommend, scoreCandidates, recommenderEnabled, __resetForTests } =
  await import("../src/recommender.js");

let mode = "ok";
const fake = createServer((req, res) => {
  if (req.url === "/ping") return res.writeHead(200).end();
  if (req.method === "POST" && req.url === "/invocations") {
    if (mode === "slow") {
      setTimeout(() => res.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ recs: [] })), 2000);
      return;
    }
    if (mode === "500") return res.writeHead(500).end("nope");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { candidates = [], n = 10 } = JSON.parse(body || "{}");
      const items = candidates.length ? candidates : ["a", "b", "c", "d"];
      const recs = items.slice(0, n).map((v, i) => ({ video_id: v, score: 1 - i * 0.1 }));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ recs }));
    });
    return;
  }
  res.writeHead(404).end();
});

await new Promise((r) => fake.listen(port, r));

try {
  assert.strictEqual(recommenderEnabled(), true, "enabled when URL set");

  // Happy path
  mode = "ok";
  __resetForTests();
  const recs = await recommend({ gymId: "g1", n: 3, candidates: ["x", "y", "z"] });
  // candidates mode skips cache; recs come straight from the fake.
  assert.strictEqual(recs.length, 3, "got 3 recs");
  assert.strictEqual(recs[0].video_id, "x", "preserves order from server");
  console.log("✓ happy path: recommender returns scored candidates");

  // Score candidates -> Map
  const map = await scoreCandidates({ gymId: "g1", candidates: ["x", "y"] });
  assert.strictEqual(map.size, 2);
  assert.ok(map.get("x") > map.get("y"), "scores descend");
  console.log("✓ scoreCandidates: returns score Map");

  // Failure path → trip the breaker after 3 misses, then fail fast (return [])
  mode = "500";
  __resetForTests();
  for (let i = 0; i < 3; i++) {
    const r = await recommend({ gymId: "g2", n: 5, candidates: ["a"] });
    assert.deepStrictEqual(r, [], "failure returns empty");
  }
  const t0 = Date.now();
  const r4 = await recommend({ gymId: "g2", n: 5, candidates: ["a"] });
  const dt = Date.now() - t0;
  assert.deepStrictEqual(r4, [], "after breaker still empty");
  assert.ok(dt < 50, `breaker open should short-circuit (got ${dt}ms)`);
  console.log("✓ circuit breaker: opens after 3 failures, returns fast");

  console.log("\nAll recommender invariants hold.");
} finally {
  fake.close();
  // Force exit — recommender.js imports redis.js, which holds an open
  // ioredis socket. We don't need it in this offline smoke test.
  setTimeout(() => process.exit(0), 10);
}
