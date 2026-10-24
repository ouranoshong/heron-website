// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { wrapTablesPlugin } from './scripts/wrap-tables.mjs';

// 纯静态站：heron 官网不需要服务端渲染。
// site 留空则用相对路径（本地预览也不会产生假域名）；部署时用 SITE_URL 注入真实域名。
export default defineConfig({
  site: process.env.SITE_URL,
  trailingSlash: 'never',
  markdown: {
    // Sätteri 是 Astro v7 的默认处理器，这里显式声明只是为了挂一个 hast 插件：
    // 把宽表格包进可横向滚动的容器。
    processor: satteri({
      hastPlugins: [wrapTablesPlugin],
    }),
  },
  build: {
    // 用 file 格式：产物是 manual.html / manual/quickstart.html，
    // 直接对应 /manual 与 /manual/quickstart，不会多一次尾斜杠跳转，
    // canonical 也和实际地址一致。
    format: 'file',
  },
});
