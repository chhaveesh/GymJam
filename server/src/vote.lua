-- vote.lua — cast or change a single member's vote on a track, atomically.
--
-- Redis runs each script single-threaded and atomically, so the read-modify-write
-- on the tally CANNOT interleave with another vote. This is how we get
-- "race-condition handling on concurrent updates" for free: no locks, no CAS retries.
--
-- KEYS[1] = tally key            "gym:{g}:track:{t}:tally"   (int = upvotes - downvotes)
-- KEYS[2] = member-vote key      "gym:{g}:track:{t}:m:{mem}" ("up" | "down" | absent)
-- KEYS[3] = idempotency key      "idem:{client-supplied-uuid}"
-- KEYS[4] = dirty set key        "dirty:tallies"
-- ARGV[1] = direction            "up" | "down" | "clear"
-- ARGV[2] = idempotency TTL seconds
-- ARGV[3] = dirty member         "{g}:{t}"  (added to the flush set)
--
-- Returns: { newTally, deduped }   deduped = 1 if this exact request was already applied

-- 1. Idempotency: if we've already processed this exact client action, do nothing.
if redis.call("EXISTS", KEYS[3]) == 1 then
  return { tonumber(redis.call("GET", KEYS[1]) or "0"), 1 }
end
redis.call("SET", KEYS[3], "1", "EX", tonumber(ARGV[2]))

-- 2. Reverse this member's previous contribution (enforces 1 active vote per member).
local prev = redis.call("GET", KEYS[2])
local delta = 0
if prev == "up"   then delta = delta - 1 end
if prev == "down" then delta = delta + 1 end

-- 3. Apply the new contribution.
local dir = ARGV[1]
if dir == "up" then
  delta = delta + 1
  redis.call("SET", KEYS[2], "up")
elseif dir == "down" then
  delta = delta - 1
  redis.call("SET", KEYS[2], "down")
elseif dir == "clear" then
  redis.call("DEL", KEYS[2])
end

-- 4. One atomic increment + mark dirty for the async Mongo flush.
local tally = redis.call("INCRBY", KEYS[1], delta)
redis.call("SADD", KEYS[4], ARGV[3])
return { tally, 0 }
