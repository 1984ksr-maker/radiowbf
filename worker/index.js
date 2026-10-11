// A tiny helper that runs on Cloudflare next to the website.
// The page asks /api/onair every minute, and /api/calendar for the schedule. This helper asks the partner stations
// whether someone is broadcasting right now and answers with the live inputs.
// Everything else is served straight from the finished website (dist).
import site from '../src/data/site.json';
import { calendarWeek } from './calendar.js';

// Same order and codes (ch1, ch2, ...) as the website uses.
const channels = site.channels
  .filter((c) => c.show !== false && c.stream)
  .map((c, i) => ({ id: `ch${i + 1}`, name: c.name || `Channel ${i + 1}`, stream: c.stream, statusUrl: (c.statusUrl || '').trim(), autoLive: !!c.autoLive, onAir: !!c.onAir }));
const home = (channels.find((c) => c.onAir) || channels[0])?.id;

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

// Does the stream really send sound? Reads the first bytes, gives up after 5 seconds.
async function soundFlows(url) {
  try {
    const res = await fetch(url, { headers: { 'icy-metadata': '1' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok || !res.body) return false;
    const reader = res.body.getReader();
    let got = 0;
    const until = Date.now() + 5000;
    while (got < 8000 && Date.now() < until) {
      const part = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ done: true, timeout: true }), until - Date.now()))]);
      if (part.done) break;
      got += part.value?.length || 0;
    }
    reader.cancel().catch(() => {});
    return got >= 8000;
  } catch {
    return false;
  }
}

async function check(ch) {
  try {
    const res = await fetch(ch.statusUrl, {
      headers: { accept: 'application/json, audio/*', 'icy-metadata': '1' },
      signal: AbortSignal.timeout(5000),
    });
    const type = res.headers.get('content-type') || '';
    // The live check address can also be the stream itself.
    // A real broadcast (from BUTT or similar) sends its station details along
    // (icy-name, icy-br). An empty filler stream answers with sound but without them.
    if (type.startsWith('audio/') || type.includes('mpegurl') || type.includes('ogg')) {
      const real = res.headers.has('icy-name') || res.headers.has('icy-br') || res.headers.has('ice-audio-info');
      res.body?.cancel();
      return res.ok && real && (await soundFlows(ch.stream));
    }
    if (!res.ok) return false;
    // The status page says live: only believe it if the stream really sends sound.
    return isLive(await res.json()) && (await soundFlows(ch.stream));
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
  // The channel list goes along, so the community chat player can follow the live button too.
  const list = channels.map(({ id, name, stream, autoLive }) => ({ id, name, stream, autoLive }));
  const res = new Response(JSON.stringify({ live, home, channels: list, checked: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// The community chat, served from radiowbf.de so its play button can use the main player.
// The chat page itself still lives on Netlify; we fetch it, drop Google Fonts
// (the site promises no Google) and add a small script for the play button.
const CHAT_VERSION = 4; // raise this number after changing the chat script below
const CHAT_SOURCE = 'https://radiowbf-chat.netlify.app/';
const CHAT_FONT = `<style>@font-face{font-family:'Space Grotesk';font-weight:300 700;font-display:swap;src:url(/_astro/space-grotesk-latin-wght-normal.BhU9QXUp.woff2) format('woff2')}</style>`;
const CHAT_SCRIPT = `<script>
(function () {
  var old = document.getElementById('playBtn'); if (!old) return;
  var btn = old.cloneNode(true); old.parentNode.replaceChild(btn, old);
  var dot = document.getElementById('dot'), statusEl = document.getElementById('status');
  var playerEl = document.getElementById('player'), vol = document.getElementById('vol');
  function show(on, loading, label) {
    btn.innerHTML = on ? '&#10074;&#10074;' : '&#9654;';
    dot.className = on ? 'dot dot--live' : 'dot';
    playerEl.classList.toggle('playing', !!on);
    statusEl.textContent = loading ? 'connecting\u2026' : on ? 'live \u00b7 ' + (label || 'on air') : 'click play to listen';
  }
  /* Inside radiowbf.de: use the main player, so both buttons always play the same channel.
     The main player may start a moment after this chat, so we look for it again on every click. */
  function getHost() { try { if (window.parent !== window && window.parent.wbf) return window.parent; } catch (e) {} return null; }
  var bound = null;
  function sync() { if (!bound) return; var s = bound.wbf.getState(); show(s.mode === 'live', s.mode === 'live' && s.loading, s.channel.name); }
  function bind() {
    var h = getHost();
    if (!h) return null;
    if (bound !== h) { bound = h; if (vol) vol.style.display = 'none'; h.document.addEventListener('wbf:state', sync); sync(); }
    return h;
  }
  bind(); setTimeout(bind, 1500); setTimeout(bind, 5000);
  /* Opened on its own: play whatever is on air and follow partner broadcasts. */
  var audio = null, cur = null, info = null, pending = null, playing = false, tries = 0, last = 0, stuck = 0, timer = null;
  function load() { return fetch('/api/onair', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { info = d; return d; }).catch(function () { return info; }); }
  function homeCh() { return info && info.channels && (info.channels.filter(function (c) { return c.id === info.home; })[0] || info.channels[0]); }
  function pick(d) {
    if (!d || !d.channels) return null;
    var live = d.live || [];
    return d.channels.filter(function (c) { return c.autoLive && live.indexOf(c.id) >= 0; })[0] || homeCh();
  }
  function start(c) {
    clearTimeout(timer);
    cur = c; last = 0; stuck = 0;
    drop();
    audio = new Audio(); audio.volume = parseFloat(vol.value);
    playing = true; show(true, true, c.name);
    audio.onplaying = function () { show(true, false, c.name); };
    var mine = audio;
    audio.onerror = function () { if (audio === mine) retry(); };
    audio.src = c.stream + (c.stream.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    audio.play().catch(function (e) { if (e && e.name === 'NotAllowedError') stop(); else retry(); });
  }
  function retry() {
    if (!playing) return;
    tries++;
    var h = homeCh();
    if (tries > 3 && h && cur.id !== h.id) { tries = 0; start(h); return; }
    if (tries > 6) { stop(); statusEl.textContent = 'stream offline \u2014 try again'; return; }
    timer = setTimeout(function () { if (playing) start(cur); }, 1500 * Math.min(tries, 3));
  }
  function drop() { if (!audio) return; audio.onerror = null; audio.onplaying = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
  function stop() { playing = false; clearTimeout(timer); drop(); show(false); }
  btn.addEventListener('click', function () {
    var host = bind();
    if (host) {
      if (playing) stop();
      var st = host.wbf.getState();
      if (st.mode === 'live') host.wbf.stop(); else host.wbf.playLive(host.wbf.getOnAir().id);
      setTimeout(sync, 50);
      return;
    }
    if (playing) { stop(); return; }
    tries = 0; show(true, true);
    load().then(function (d) { start(pick(d) || { id: 'ch1', name: 'Channel 1', stream: 'https://onelradio.out.airtime.pro/onelradio_a' }); });
  });
  vol.addEventListener('input', function () { if (audio) audio.volume = parseFloat(vol.value); });
  setInterval(function () {
    if (!playing) return;
    load().then(function (d) {
      var c = pick(d);
      if (!c || c.id === cur.id) { pending = null; return; }
      if (pending === c.id) { pending = null; tries = 0; start(c); } else pending = c.id;
    });
  }, 60000);
  setInterval(function () {
    if (!playing || !audio) return;
    if (audio.currentTime > last + 0.2) { last = audio.currentTime; stuck = 0; if (last > 30) tries = 0; return; }
    stuck += 3;
    if (stuck >= 12) { stuck = 0; retry(); }
  }, 3000);
})();
</script>`;

async function chat(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/chat?v=' + CHAT_VERSION, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const src = await fetch(CHAT_SOURCE, { signal: AbortSignal.timeout(8000) });
  if (!src.ok) return Response.redirect(CHAT_SOURCE, 302);
  const page = new HTMLRewriter()
    .on('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]', { element(el) { el.remove(); } })
    .on('head', { element(el) { el.append(CHAT_FONT, { html: true }); } })
    .on('body', { element(el) { el.append(CHAT_SCRIPT, { html: true }); } })
    .transform(src);
  const html = await page.text();
  const res = new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// The public calendar link from Station settings, read every 5 minutes at most.
async function calendar(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/calendar', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let body = { none: true };
  let status = 200;
  try {
    const week = await calendarWeek((site.calendar || '').trim());
    if (week) body = week;
  } catch (err) {
    body = { error: String(err?.message || err) };
    status = 502;
  }
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
  if (status === 200) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/onair') return onAir(request, ctx);
    if (url.pathname === '/api/calendar') return calendar(request, ctx);
    if (url.pathname === '/api/chat' || url.pathname === '/api/chat/') return chat(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
