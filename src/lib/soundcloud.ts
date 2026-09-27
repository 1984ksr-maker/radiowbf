// Reads the RadioWBF SoundCloud account at build time through its public RSS feed,
// so every new track you upload to SoundCloud appears in the archive on the next rebuild.
// No key needed. Only tracks appear in the feed (playlists do not), and only tracks
// with "Include in RSS feed" switched on in their SoundCloud settings (on by default).
import site from '../data/site.json';
import type { ArchiveItem } from './mixcloud';

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};

let cached: Promise<ArchiveItem[]> | null = null;

/** Read once per build and reuse. */
export function getSoundCloudShows(): Promise<ArchiveItem[]> {
  cached ??= loadSoundCloud();
  return cached;
}

async function loadSoundCloud(max = 300): Promise<ArchiveItem[]> {
  const id = String((site as any).soundcloudUserId || '').trim();
  if (!id) return [];
  // SC_FEED_URL lets a developer test with another feed.
  const url = process.env.SC_FEED_URL || `https://feeds.soundcloud.com/users/soundcloud:users:${id}/sounds.rss`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[soundcloud] feed answered ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const out: ArchiveItem[] = items.slice(0, max).map((it) => {
      const link = tag(it, 'link');
      const title = tag(it, 'title');
      const image = it.match(/<itunes:image[^>]*href="([^"]+)"/)?.[1]?.replace('-large.', '-t500x500.');
      const text = tag(it, 'description').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
      const slug = (link.split('/').filter(Boolean).pop() || title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      return {
        id: `sc:${link}`,
        title,
        date: new Date(tag(it, 'pubDate') || Date.now()),
        categories: [],
        image,
        imageAlt: `Artwork for ${title}`,
        // Every upload gets its own page on the website.
        href: `/shows/sc/${slug}`,
        external: false,
        source: 'SoundCloud',
        original: link,
        slug,
        text,
        play: { kind: 'soundcloud' as const, url: link },
        excerpt: text ? text.slice(0, 180) : undefined,
      };
    });
    console.log(`[soundcloud] loaded ${out.length} tracks`);
    return out;
  } catch (err) {
    console.warn('[soundcloud] could not load the feed:', (err as Error)?.message);
    return [];
  }
}
