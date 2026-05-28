import assert from "node:assert";
import { redis, keys } from "../src/redis.js";
import { addTrack, castVote, advance, getState } from "../src/votes.js";

const G = "test-gym-" + Math.random().toString(36).slice(2, 7);
const A = "aaaaaaaaaaa", B = "bbbbbbbbbbb"; // fake 11-char ids
const v = (t, m, dir, key) => castVote({ gymId: G, trackId: t, memberId: m, direction: dir, idemKey: key });

// 1. Add two songs. First add becomes "now playing".
await addTrack({ gymId: G, videoId: A, title: "Song A", addedBy: "tom" });
await addTrack({ gymId: G, videoId: B, title: "Song B", addedBy: "kim" });
let s = await getState(G);
assert.equal(s.nowPlaying.trackId, A, "first added should be now-playing");
assert.equal(s.queue.length, 2, "two tracks queued");
console.log("✓ add two tracks; first added is now-playing");

// 2. Vote: B gets +3 (distinct members), A gets +1 -> B must rank above A.
await Promise.all([v(B,"m1","up"), v(B,"m2","up"), v(B,"m3","up"), v(A,"m1","up")]);
s = await getState(G);
assert.deepEqual(s.queue.map(t => t.trackId), [B, A], "queue ranks by votes desc");
assert.equal(s.queue.find(t=>t.trackId===B).tally, 3);
assert.equal(s.queue.find(t=>t.trackId===A).tally, 1);
console.log("✓ queue reorders by tally (B=3 ahead of A=1)");

// 3. Idempotency: same action key fired 5x -> counted once.
const k = "idemtest-" + Math.random().toString(36).slice(2);
const before = (await getState(G)).queue.find(t=>t.trackId===A).tally;
await Promise.all(Array.from({length:5}, () => v(A,"m9","up",k)));
const after = (await getState(G)).queue.find(t=>t.trackId===A).tally;
assert.equal(after, before + 1, "retries must count once");
console.log("✓ idempotent: 5 retries of one action counted once");

// 4. Stale-advance guard: advancing a track that isn't playing is a no-op.
s = await advance({ gymId: G, finishedId: "not-playing-id" });
assert.equal(s.nowPlaying.trackId, A, "stale advance must not skip the live song");
console.log("✓ stale 'ended' event ignored (no song skipped)");

// 5. Real advance: A finishes -> removed, next top (B) promoted to now-playing.
s = await advance({ gymId: G, finishedId: A });
assert.equal(s.nowPlaying.trackId, B, "after A ends, B (top) plays");
assert.deepEqual(s.queue.map(t=>t.trackId), [B], "A removed from queue");
assert.equal(await redis.get(keys.tally(G, A)), null, "A's tally cleared");
console.log("✓ on song end: finished track removed, next top promoted");

// 6. Last song ends -> nothing playing, empty queue.
s = await advance({ gymId: G, finishedId: B });
assert.equal(s.nowPlaying, null);
assert.equal(s.queue.length, 0);
console.log("✓ last song ends: floor idle, queue empty");

console.log("\nAll jukebox invariants hold.");
await redis.quit();
import { subscriber } from "../src/redis.js";
await subscriber.quit();
process.exit(0);
