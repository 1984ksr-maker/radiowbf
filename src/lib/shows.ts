import { getCollection } from 'astro:content';
import { getMixcloudShows, type ArchiveItem } from './mixcloud';
import { getSoundCloudShows } from './soundcloud';

export const CATEGORIES = ['DJ Sets', 'Talk Shows', 'Open Call'];

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}

export function dotDate(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return p.replaceAll('-', '.');
}

export async function getLocalShows(): Promise<ArchiveItem[]> {
  const shows = await getCollection('shows');
  return shows.map((s) => {
    const d = s.data;
    const play = d.mixcloud
      ? { kind: 'mixcloud' as const, url: d.mixcloud }
      : d.soundcloud
        ? { kind: 'soundcloud' as const, url: d.soundcloud }
        : undefined;
    const excerpt = (s.body ?? '').replace(/[*_#>\[\]]/g, '').split(/\n\s*\n/)[0]?.slice(0, 180);
    return {
      id: s.id,
      title: d.title,
      date: d.date,
      categories: d.categories,
      image: d.image,
      imageAlt: d.imageAlt,
      href: `/shows/${s.id}`,
      external: false,
      play,
      excerpt,
      featured: d.featured,
    };
  });
}

const norm = (u?: string) => (u || '').replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

// Built once per build, then reused by every page.
let archive: Promise<ArchiveItem[]> | null = null;

/**
 * Everything in one list, newest first: your own show posts, plus every upload
 * on Mixcloud and SoundCloud. If a show post uses the same link as an upload,
 * the post wins, so a show never appears twice.
 */
export function getArchive(): Promise<ArchiveItem[]> {
  archive ??= (async () => {
    const [local, mc, sc] = await Promise.all([getLocalShows(), getMixcloudShows(), getSoundCloudShows()]);
    const linked = new Set(local.map((l) => norm(l.play?.url)).filter(Boolean));
    const merged = [...local, ...[...mc, ...sc].filter((m) => !linked.has(norm(m.href)))];
    return merged.sort((a, b) => b.date.getTime() - a.date.getTime());
  })();
  return archive;
}
