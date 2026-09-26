// @ts-check
import { defineConfig } from 'astro/config';

// Change "site" once you know the final address.
export default defineConfig({
  site: 'https://radiowbf.de',
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true },
});
