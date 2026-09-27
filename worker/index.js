// A tiny helper that runs on Cloudflare next to the website.
// The page asks /api/onair every minute. This helper asks the partner stations
// whether someone is broadcasting right now and answers with the live inputs.
// Everything else is served straight from the finished website (dist).
import site from '../src/data/site.json';

// Same order and codes (ch1, ch2, ...) as the website uses.
const channels = site.channels
  .filter((c) => c.show !== false && c.stream)
  .map((c, i) => ({ id: `ch${i + 1}`, statusUrl: (c.statusUrl || '').trim(), autoLive: !!c.autoLive }));

// Understands the status pages of the usual radio servers.
function isLive(data) {
  if (!data || typeof data !== 'object') return false;
  // Subversive Radio style: [{ hasBroadcaster: true }]
  const list = Array.isArray(data) ? data : [data];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    if (d.hasBroadcaster === true) return true;
    // AzuraCast (reboot.fm and many others)
    if (d.live && d.live.is_live === true) return true;
    if (d.is_online === true && d.station) return true;
    // Icecast status-json.xsl: a source is connected
    if (d.icestats && d.icestats.source) return true;
    // Anything else that simply says it is live
    if (d.is_live === true || d.isLive === true && d.hasBroadcaster === undefined) return true;
  }
  return false;
}

async function check(ch) {
  try {
    const res = await fetch(ch.statusUrl, {
      headers: { accept: 'application/json, audio/*', 'icy-metadata': '1' },
      signal: AbortSignal.timeout(5000),
    });
    const type = res.headers.get('content-type') || '';
    // The live check address can also be the stream itself:
    // if it answers with sound, someone is broadcasting.
    if (type.startsWith('audio/') || type.includes('mpegurl') || type.includes('ogg')) {
      res.body?.cancel();
      return res.ok;
    }
    if (!res.ok) return false;
    return isLive(await res.json());
  } catch {
    return false;
  }
}

async function onAir(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/onair', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const watched = channels.filter((c) => c.autoLive && c.statusUrl);
  const results = await Promise.all(watched.map(check));
  const live = watched.filter((_, i) => results[i]).map((c) => c.id);
  const res = new Response(JSON.stringify({ live, checked: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/onair') return onAir(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
