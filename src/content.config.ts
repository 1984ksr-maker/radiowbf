import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const shows = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/shows' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.string()).default([]),
    curator: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    soundcloud: z.string().optional(),
    mixcloud: z.string().optional(),
    link: z.string().optional(),
    linkLabel: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    intro: z.string().optional(),
    images: z.array(z.string()).default([]),
  }),
});

export const collections = { shows, pages };
