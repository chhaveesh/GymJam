import Redis from "ioredis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// One connection for commands, a second dedicated to pub/sub (Redis requires
// subscribers to be on a connection that isn't issuing normal commands).
export const redis = new Redis(REDIS_URL);
export const subscriber = new Redis(REDIS_URL);

// Register the Lua script as a custom command. ioredis SCRIPT LOADs it once and
// uses EVALSHA after that, so the script body isn't shipped on every call.
// numberOfKeys is now 5: tally, member, idem, dirty, queue.
redis.defineCommand("castVote", {
  numberOfKeys: 5,
  lua: readFileSync(join(__dirname, "vote.lua"), "utf8"),
});

export const keys = {
  tally:  (g, t)      => `gym:${g}:track:${t}:tally`,
  member: (g, t, m)   => `gym:${g}:track:${t}:m:${m}`,
  idem:   (id)        => `idem:${id}`,
  dirty:  ()          => `dirty:tallies`,
  channel:(g)         => `gym:${g}`,
  // --- jukebox additions ---
  queue:  (g)         => `gym:${g}:queue`,   // zset: member=trackId, score=tally
  meta:   (g)         => `gym:${g}:meta`,    // hash: field=trackId -> JSON {videoId,title,addedBy,addedAt}
  now:    (g)         => `gym:${g}:now`,     // string: trackId currently playing on the floor
  // --- presence additions (Step 1) ---
  presence:(g)        => `gym:${g}:presence`,// zset: member=memberId, score=lastSeen(ms)
  names:   (g)        => `gym:${g}:names`,    // hash: field=memberId -> display name
  // --- synced playback additions (Step 1.5) ---
  startedAt:(g)       => `gym:${g}:startedAt`,// string: ms epoch when the current track started (server clock)
  advLock: (g, t)     => `gym:${g}:adv:${t}`, // short-lived lock so N "ended" reports promote the next song once
  // --- vote-to-skip + auto-queue (Steps 2 & 3) ---
  skip:    (g, t)     => `gym:${g}:skip:${t}`,// set: memberIds who voted to skip the current track t
  seedLock:(g)        => `gym:${g}:seeding`,  // lock so concurrent auto-fills don't double-seed a gym
};
