import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 用户手册：按章拆分，来自 heron 仓库的 docs/user-manual.md。
 * 内容由 scripts/build-content.mjs 在构建时生成，不在本站手工维护。
 */
const manual = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/manual' }),
  schema: z.object({
    title: z.string(),
    chapter: z.string(),
    order: z.number(),
    slug: z.string(),
    kind: z.string(),
    sourceFile: z.string(),
  }),
});

export const collections = { manual };
