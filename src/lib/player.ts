// The one audio engine for the whole site.
// It lives inside the persistent player bar, so sound keeps going while people browse.
//
// Any element on any page can control it:
//   <button data-live="ch1">            plays a live channel (toggles)
//   <button data-embed="soundcloud" data-url="..." data-title="...">   plays an archive show
//   <button data-embed="mixcloud"   data-url="..." data-title="...">

import site from '../data/site.json';
import { channels, liveChannel, type Channel } from './live';

type Mode = 'idle' | 'live' | 'embed';

export interface NowPlaying {
  show?: string;
  track?: string;
  nextShow?: string;
  nextStarts?: string;
  live: boolean;
}

interface State {
  mode: Mode;
  channel: Channel;
  loading: boolean;
  embedTitle?: string;
  embedUrl?: string;
  now?: NowPlaying;
}

const state: State = { mode: 'idle', channel: liveChannel, loading: false };
// The input that is on air right now. Starts as the ticked one and follows partner broadcasts.
let onAirId = liveChannel.id;
const byId = (id: string) => channels.find((c) => c.id === id) ?? liveChannel;
export const getOnAir = () => byId(onAirId);
const audio = new Audio();
audio.preload = 'none';

// Keeping the sound alive: reconnect when a stream drops or goes silent,
// and fall back to the home input (Airtime) if a partner stream keeps failing.
let retries = 0;
let lastTime = 0;
let stuckSince = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  document.dispatchEvent(new CustomEvent('wbf:state', { detail: { ...state } }));
  syncButtons();
}

export function getState() {
  return { ...state };
}

function stopLive() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

function clearEmbed() {
  const box = document.getElementById('player-embed');
  if (box) box.innerHTML = '';
  document.getElementById('wbf-player')?.classList.remove('has-embed');
  state.embedTitle = undefined;
  state.embedUrl = undefined;
}

export function playLive(id?: string) {
  const ch = channels.find((c) => c.id === id) ?? state.channel;
  if (state.mode === 'live' && ch.id === state.channel.id) {
    stop();
    return;
  }
  startStream(ch);
}

function startStream(ch: Channel, isRetry = false) {
  if (!isRetry) retries = 0;
  clearTimeout(retryTimer);
  lastTime = 0;
  stuckSince = Date.now();
  clearEmbed();
  state.channel = ch;
  state.mode = 'live';
  state.loading = true;
  // A fresh query string makes the browser join the stream now, not replay a buffer.
  audio.src = `${ch.stream}${ch.stream.includes('?') ? '&' : '?'}t=${Date.now()}`;
  audio.play().catch((err) => {
    // The browser blocked playing (needs a click): stop quietly. Anything else: try again.
    if (err?.name === 'NotAllowedError') {
      state.mode = 'idle';
      state.loading = false;
      emit();
    } else {
      recover();
    }
  });
  setMediaSession();
  emit();
}

export function stop() {
  clearTimeout(retryTimer);
  retries = 0;
  stopLive();
  clearEmbed();
  state.mode = 'idle';
  state.channel = getOnAir();
  state.loading = false;
  emit();
}

export function playEmbed(kind: string, url: string, title = '') {
  if (state.mode === 'embed' && state.embedUrl === url) return;
  stopLive();
  const box = document.getElementById('player-embed');
  if (!box) return;
  const frame = document.createElement('iframe');
  frame.title = title ? `Player: ${title}` : 'Archive player';
  frame.allow = 'autoplay; encrypted-media';
  frame.loading = 'eager';
  if (kind === 'mixcloud') {
    const path = url.replace(/^https?:\/\/(www\.)?mixcloud\.com/, '');
    frame.src = `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=1&autoplay=1&feed=${encodeURIComponent(path)}`;
    frame.height = '60';
  } else {
    frame.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=false&show_comments=false&show_reposts=false&hide_related=true&color=%23f0592f`;
    frame.height = '120';
  }
  box.innerHTML = '';
  box.appendChild(frame);
  document.getElementById('wbf-player')?.classList.add('has-embed');
  state.mode = 'embed';
  state.loading = false;
  state.embedTitle = title;
  state.embedUrl = url;
  emit();
}

audio.addEventListener('playing', () => {
  state.loading = false;
  emit();
});
audio.addEventListener('waiting', () => {
  if (state.mode === 'live') {
    state.loading = true;
    emit();
  }
});
// Something went wrong with the live sound: try the same stream again (3 times),
// then fall back to the home input, and only then give up.
function recover() {
  if (state.mode !== 'live') return;
  clearTimeout(retryTimer);
  retries += 1;
  state.loading = true;
  emit();
  if (retries <= 3) {
    retryTimer = setTimeout(() => state.mode === 'live' && startStream(state.channel, true), 1500 * retries);
    return;
  }
  if (state.channel.id !== liveChannel.id) {
    // A partner stream keeps failing: go back to the studio stream.
    onAirId = liveChannel.id;
    document.dispatchEvent(new CustomEvent('wbf:onair', { detail: liveChannel }));
    startStream(liveChannel);
    return;
  }
  stopLive();
  state.mode = 'idle';
  state.loading = false;
  emit();
  document.dispatchEvent(new CustomEvent('wbf:error', { detail: state.channel }));
}

audio.addEventListener('error', () => {
  if (state.mode !== 'live' || !audio.getAttribute('src')) return;
  recover();
});
audio.addEventListener('ended', () => recover());
audio.addEventListener('stalled', () => { if (state.mode === 'live') stuckSince ||= Date.now(); });

// Watchdog: if the sound stops moving for 12 seconds while we should be playing, reconnect.
setInterval(() => {
  if (state.mode !== 'live') return;
  const t = audio.currentTime;
  if (t > lastTime + 0.2) {
    lastTime = t;
    stuckSince = 0;
    if (t > 30) retries = 0; // playing fine for a while: forget earlier problems
    return;
  }
  if (!stuckSince) stuckSince = Date.now();
  if (Date.now() - stuckSince > 12000) {
    stuckSince = 0;
    recover();
  }
}, 3000);

// Keep every play button on the current page in sync with what is playing.
export function syncButtons() {
  document.querySelectorAll<HTMLElement>('[data-live]').forEach((el) => {
    const on = state.mode === 'live' && el.dataset.live === state.channel.id;
    el.setAttribute('aria-pressed', String(on));
    el.classList.toggle('is-playing', on);
    el.classList.toggle('is-loading', on && state.loading);
  });
  document.querySelectorAll<HTMLElement>('[data-embed]').forEach((el) => {
    const on = state.mode === 'embed' && el.dataset.url === state.embedUrl;
    el.setAttribute('aria-pressed', String(on));
    el.classList.toggle('is-playing', on);
  });
}

function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const now = state.now;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: now?.show || `${site.name} ${state.channel.name}`,
    artist: now?.track || site.fullName,
    album: 'Live from Neukölln',
    artwork: [{ src: site.logo }],
  });
  navigator.mediaSession.setActionHandler('play', () => playLive(state.channel.id));
  navigator.mediaSession.setActionHandler('pause', () => stop());
  navigator.mediaSession.setActionHandler('stop', () => stop());
}

// Airtime knows what is on Channel 1. We ask it every 30 seconds while the page is visible.
// Airtime sends some characters in coded form (&#039; for an apostrophe): turn them back.
function decodeEnt(s?: string) {
  return (s || '').replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function cleanTrack(name?: string) {
  if (!name) return '';
  return decodeEnt(name).replace(/^\s*-\s*/, '').replace(/\.(mp3|wav|flac|aac|m4a|ogg)$/i, '').replace(/_+/g, ' ').replace(/\s*\(\d+\)$/, '').trim();
}

async function pollNow() {
  if (document.hidden) return;
  try {
    const res = await fetch(`${site.airtime}/api/live-info-v2`, { cache: 'no-store' });
    const data = await res.json();
    const cur = data?.shows?.current;
    const next = data?.shows?.next?.[0];
    const track = data?.tracks?.current;
    state.now = {
      show: decodeEnt(cur?.name).trim() || undefined,
      track: cleanTrack(track?.metadata?.track_title || track?.name),
      nextShow: decodeEnt(next?.name).trim() || undefined,
      nextStarts: next?.starts,
      live: data?.station?.source_enabled === 'Master' || data?.station?.source_enabled === 'Show',
    };
    document.dispatchEvent(new CustomEvent('wbf:now', { detail: state.now }));
    if (state.mode === 'live') setMediaSession();
  } catch {
    /* offline or Airtime unreachable: the stream itself can still play */
  }
}

// Partner stations: ask /api/onair (a small helper on Cloudflare) every minute
// whether someone is broadcasting on an input marked "Switch on automatically".
// The first one live, in the order of Station settings, takes over the big Live button.
let pendingId = '';
async function pollOnAir() {
  if (document.hidden || !channels.some((c) => c.autoLive)) return;
  try {
    const res = await fetch('/api/onair', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const live: string[] = Array.isArray(data?.live) ? data.live : [];
    const pick = channels.find((c) => c.autoLive && live.includes(c.id)) ?? liveChannel;
    // Only switch when two checks in a row agree, so a short hiccup never moves the button.
    if (pick.id === onAirId) { pendingId = ''; return; }
    if (pendingId === pick.id) { pendingId = ''; setOnAir(pick); }
    else pendingId = pick.id;
  } catch {
    /* helper not reachable: keep the ticked input */
  }
}

function setOnAir(ch: Channel) {
  if (ch.id === onAirId) return;
  const before = onAirId;
  onAirId = ch.id;
  if (state.mode === 'idle') {
    state.channel = ch;
  } else if (state.mode === 'live' && state.channel.id === before) {
    // Listening to what was on air: follow the broadcast to the new input.
    startStream(ch);
  }
  document.dispatchEvent(new CustomEvent('wbf:onair', { detail: ch }));
  emit();
}

let started = false;
export function startPlayer() {
  if (started) return;
  started = true;
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-live],[data-embed],[data-stop]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.stop !== undefined) stop();
    else if (t.dataset.live) playLive(t.dataset.live);
    else if (t.dataset.embed && t.dataset.url) playEmbed(t.dataset.embed, t.dataset.url, t.dataset.title);
  });
  document.addEventListener('astro:page-load', () => {
    syncButtons();
    if (state.now) document.dispatchEvent(new CustomEvent('wbf:now', { detail: state.now }));
    document.dispatchEvent(new CustomEvent('wbf:onair', { detail: getOnAir() }));
    document.dispatchEvent(new CustomEvent('wbf:state', { detail: { ...state } }));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pollNow(); pollOnAir(); } });
  pollNow();
  pollOnAir();
  setInterval(pollNow, 30000);
  setInterval(pollOnAir, 60000);
  (window as any).wbf = { playLive, playEmbed, stop, getState, getOnAir };
}
