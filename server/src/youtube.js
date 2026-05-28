// youtube.js — turn whatever a member pastes into a clean {videoId, title}.
//
// Two zero-cost paths and one optional one:
//   - parseVideoId: accepts a full URL, a youtu.be/shorts/embed link, or a bare ID.
//   - fetchTitle:   YouTube oEmbed — public, no API key, no quota. Gives us the title.
//   - search:       YouTube Data API v3 — ONLY if YOUTUBE_API_KEY is set (has quota).
//
// So "anyone with a YouTube link can add a song" works with zero configuration;
// type-to-search is an optional upgrade gated on an API key.

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseVideoId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (ID_RE.test(s)) return s; // already a bare 11-char id

  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return ID_RE.test(id) ? id : null;
  }
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;
    // /shorts/<id>, /embed/<id>, /live/<id>
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export async function fetchTitle(videoId) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null; // unlisted/private/removed, or oEmbed unreachable
  }
}

export async function search(q, max = 8) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null; // signal "search disabled"
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", String(max));
  url.searchParams.set("q", q);
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`youtube search ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((it) => ({
    videoId: it.id.videoId,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
    thumb: it.snippet.thumbnails?.default?.url || null,
  }));
}

export const searchEnabled = () => Boolean(process.env.YOUTUBE_API_KEY);

// --- Seed pool for auto-queue (Step 3) -----------------------------------------
// Used to keep a fresh gym from being empty: we top the queue up to ~10 tracks
// from this pool. Override with SEED_VIDEO_IDS="id1,id2,..." (comma-separated).
// In Step 4 the ML recommender becomes the source; this stays as the fallback.
const DEFAULT_SEED_IDS = [
  "dQw4w9WgXcQ", // Rick Astley — Never Gonna Give You Up
  "OPf0YbXqDm0", // Mark Ronson ft. Bruno Mars — Uptown Funk
  "kJQP7kiw5Fk", // Luis Fonsi — Despacito
  "9bZkp7q19f0", // PSY — Gangnam Style
  "JGwWNGJdvx8", // Ed Sheeran — Shape of You
  "RgKAFK5djSk", // Wiz Khalifa — See You Again
  "CevxZvSJLk8", // Katy Perry — Roar
  "hT_nvWreIhg", // OneRepublic — Counting Stars
  "09R8_2nJtjg", // Maroon 5 — Sugar
  "60ItHLz5WEA", // Alan Walker — Faded
  "7wtfhZwyrcc", // Imagine Dragons — Believer
  "YQHsXMglC9A", // Adele — Hello
  "pRpeEdMmmQ0", // Shakira — Waka Waka
  "fLexgOxsZu0", // Imagine Dragons — Thunder
  "2Vv-BfVoq4g", // Ed Sheeran — Perfect
];

export function seedVideoIds() {
  const raw = process.env.SEED_VIDEO_IDS;
  if (raw) {
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length) return ids;
  }
  return DEFAULT_SEED_IDS;
}
