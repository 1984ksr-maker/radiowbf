// Reads the RadioWBF Mixcloud account at build time, so every upload
// appears in the archive on the next rebuild. Free, no key needed.
import site from '../data/site.json';

export interface ArchiveItem {
  id: string;
  title: string;
  date: Date;
  categories: string[];
  image?: string;
  imageAlt?: string;
  href: string;          // page on this site or on Mixcloud
  external: boolean;
  source?: string;       // where it comes from when external: Mixcloud or SoundCloud
  play?: { kind: 'soundcloud' | 'mixcloud'; url: string };
  excerpt?: string;
  text?: string;         // full description, for uploads that get their own page
  original?: string;     // the address on SoundCloud or Mixcloud
  slug?: string;
  featured?: boolean;
}

export async function getMixcloudShows(max = 200): Promise<ArchiveItem[]> {
  const user = (site.mixcloudUser || '').trim();
  if (!user) return [];
  const items: ArchiveItem[] = [];
  let url: string | undefined = `https://api.mixcloud.com/${encodeURIComponent(user)}/cloudcasts/?limit=100`;
  try {
    while (url && items.length < max) {
      const res: Response = await fetch(url);
      if (!res.ok) break;
      const json: any = await res.json();
      for (const c of json.data ?? []) {
        items.push({
          id: `mc:${c.key}`,
          title: c.name,
          date: new Date(c.created_time),
          categories: (c.tags ?? []).map((t: any) => t.name).slice(0, 3),
          image: c.pictures?.extra_large || c.pictures?.large,
          imageAlt: `Artwork for ${c.name}`,
          href: c.url,
          external: true,
          source: 'Mixcloud',
          play: { kind: 'mixcloud', url: c.url },
        });
      }
      url = json.paging?.next;
    }
  } catch (err) {
    console.warn('[mixcloud] could not load archive:', (err as Error)?.message);
  }
  return items;
}
