// Reads a public calendar link (.ics) and returns this week and next week
// in the same shape as Airtime's week-info, so the schedule can show both.
// Works with Nextcloud, Disroot, Framagenda, Google, Apple and most others.

const TZ = 'Europe/Berlin';
const KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Offset in ms between a time zone and UTC at a moment.
function offset(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}
// Wall clock time in a zone (given as UTC fields) to a real moment.
function fromZone(wall, tz) {
  let t = wall - offset(wall, tz);
  t = wall - offset(t, tz);
  return t;
}
// Real moment to "YYYY-MM-DD HH:MM:SS" in Berlin, like Airtime.
function berlin(ms) {
  return new Date(ms + offset(ms, TZ)).toISOString().slice(0, 19).replace('T', ' ');
}

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}
function unescape(s) {
  return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

// Returns { wall, tz, allDay } where wall is the wall clock time as a UTC number.
function parseTime(line) {
  const [head, value] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()];
  const tzid = /TZID=([^;:]+)/.exec(head)?.[1];
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const allDay = !m[4];
  const tz = m[7] ? 'UTC' : tzid || TZ;
  return { wall, tz, allDay };
}
const toMoment = (t) => (t.tz === 'UTC' ? t.wall : fromZone(t.wall, t.tz));

function events(ics) {
  const out = [];
  for (const block of unfold(ics).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const lines = body.split(/\r?\n/);
    const get = (k) => lines.find((l) => l.startsWith(k + ':') || l.startsWith(k + ';'));
    const s = get('DTSTART') && parseTime(get('DTSTART'));
    if (!s) continue;
    if (/^STATUS:CANCELLED/m.test(body)) continue;
    const e = get('DTEND') && parseTime(get('DTEND'));
    const dur = get('DURATION')?.split(':')[1];
    let length = e ? e.wall - s.wall : s.allDay ? 864e5 : 36e5;
    if (!e && dur) {
      const d = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(dur);
      if (d) length = ((+d[1] || 0) * 7 * 864e5) + ((+d[2] || 0) * 864e5) + ((+d[3] || 0) * 36e5) + ((+d[4] || 0) * 6e4);
    }
    const summary = unescape((get('SUMMARY') || 'SUMMARY:').replace(/^SUMMARY[^:]*:/, ''));
    const rrule = get('RRULE')?.split(':')[1];
    const exdates = lines.filter((l) => l.startsWith('EXDATE')).flatMap((l) => {
      const head = l.slice(0, l.indexOf(':'));
      return l.slice(l.indexOf(':') + 1).split(',').map((v) => parseTime(`${head}:${v}`)?.wall).filter(Boolean);
    });
    const recurrenceId = get('RECURRENCE-ID') && parseTime(get('RECURRENCE-ID'));
    out.push({ uid: get('UID')?.split(':').slice(1).join(':'), s, length, summary, rrule, exdates, recurrenceId });
  }
  return out;
}

const DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

// All start times (wall clock) of one event between from and to (wall clock numbers).
function occurrences(ev, from, to) {
  const start = ev.s.wall;
  if (!ev.rrule) return start < to && start + ev.length > from ? [start] : [];
  const r = Object.fromEntries(ev.rrule.split(';').map((p) => p.split('=')));
  const freq = r.FREQ;
  const interval = +(r.INTERVAL || 1);
  const until = r.UNTIL ? parseTime(`X:${r.UNTIL}`)?.wall ?? Infinity : Infinity;
  const count = r.COUNT ? +r.COUNT : Infinity;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((d) => DAYS[d.slice(-2)]) : null;
  const out = [];
  let n = 0;
  const push = (t) => {
    if (t < start || t > until || n >= count) return false;
    n++;
    if (t < to && t + ev.length > from && !ev.exdates.includes(t)) out.push(t);
    return true;
  };
  const day = 864e5;
  for (let i = 0; i < 3000; i++) {
    let base;
    if (freq === 'DAILY') base = start + i * interval * day;
    else if (freq === 'WEEKLY') base = start + i * interval * 7 * day;
    else if (freq === 'MONTHLY') { const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + i * interval); base = d.getTime(); }
    else if (freq === 'YEARLY') { const d = new Date(start); d.setUTCFullYear(d.getUTCFullYear() + i * interval); base = d.getTime(); }
    else break;
    if (base > to + 7 * day || base > until || n >= count) break;
    if (freq === 'WEEKLY' && byday) {
      // The week of base, starting on Monday.
      const wd = (new Date(base).getUTCDay() + 6) % 7;
      const monday = base - wd * day;
      for (const bd of byday.map((d) => (d + 6) % 7).sort()) push(monday + bd * day);
    } else push(base);
  }
  return out;
}

export async function calendarWeek(url) {
  if (!url) return null;
  const res = await fetch(url.replace(/^webcal:/i, 'https:'), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`calendar answered ${res.status}`);
  const all = events(await res.text());

  // This week's Monday 00:00 in Berlin, like Airtime's week-info.
  const nowWall = Date.now() + offset(Date.now(), TZ);
  const todayWall = nowWall - (nowWall % 864e5);
  const mondayWall = todayWall - ((new Date(todayWall).getUTCDay() + 6) % 7) * 864e5;
  const from = fromZone(mondayWall, TZ);
  const to = fromZone(mondayWall + 14 * 864e5, TZ);

  // Moved or changed single dates of a repeating event replace the regular one.
  const moved = new Map();
  for (const ev of all) if (ev.recurrenceId && ev.uid) moved.set(`${ev.uid}|${toMoment(ev.recurrenceId)}`, true);

  const week = Object.fromEntries([...KEYS, ...KEYS.map((k) => `next${k}`)].map((k) => [k, []]));
  for (const ev of all) {
    // Expand in the event's own wall clock, then turn each start into a real moment.
    const pad = 2 * 864e5;
    const fromWall = from + offset(from, ev.s.tz === 'UTC' ? 'UTC' : ev.s.tz) - pad;
    const toWall = to + offset(to, ev.s.tz === 'UTC' ? 'UTC' : ev.s.tz) + pad;
    for (const w of occurrences(ev, fromWall, toWall)) {
      const startMs = ev.s.allDay ? fromZone(w, TZ) : ev.s.tz === 'UTC' ? w : fromZone(w, ev.s.tz);
      if (!ev.recurrenceId && ev.rrule && ev.uid && moved.has(`${ev.uid}|${startMs}`)) continue;
      const endMs = ev.s.allDay ? fromZone(w + ev.length, TZ) : startMs + ev.length;
      if (startMs >= to || endMs <= from) continue;
      const starts = berlin(startMs);
      const idx = Math.floor((Date.parse(starts.slice(0, 10) + 'T00:00:00Z') - mondayWall) / 864e5);
      if (idx < 0 || idx > 13) continue;
      const key = (idx > 6 ? 'next' : '') + KEYS[idx % 7];
      week[key].push({ name: ev.summary, starts, ends: berlin(endMs), source: 'calendar', allDay: ev.s.allDay });
    }
  }
  for (const k of Object.keys(week)) week[k].sort((a, b) => a.starts.localeCompare(b.starts));
  return week;
}
