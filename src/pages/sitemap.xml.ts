// The list of all pages for search engines (Google, Bing, DuckDuckGo).
// It updates itself with every rebuild, so new shows and SoundCloud uploads are included.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSoundCloudShows } from '../lib/soundcloud';

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.toString() || 'https://radiowbf.de/').replace(/\/$/, '');
  const pages = ['/', '/listen/', '/shows/', '/schedule/', '/about/', '/chat/', '/support/', '/impressum/', '/datenschutz/'];
  const shows = (await getCollection('shows')).map((s) => ({ loc: `/shows/${s.id}/`, date: s.data.date }));
  const sc = (await getSoundCloudShows()).map((s) => ({ loc: `/shows/sc/${s.slug}/`, date: s.date }));
  const urls = [
    ...pages.map((p) => `<url><loc>${base}${p}</loc></url>`),
    ...[...shows, ...sc].map((u) => `<url><loc>${base}${u.loc}</loc><lastmod>${u.date.toISOString().slice(0, 10)}</lastmod></url>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
