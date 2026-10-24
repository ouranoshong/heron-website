/**
 * 从用户手册生成站内内容。
 *
 * 默认源是仓库内的 docs/user-manual.md（随仓库一起提交，保证克隆下来就能构建）。
 * 想用 heron 仓库里的最新版，跑一次：
 *   HERON_MANUAL=../heron/docs/user-manual.md npm run build
 * astro build / dev 前自动跑一遍（见 package.json 的 prebuild）。
 *
 * 站内只呈现「使用说明」：用户手册原文按章拆页。
 * 手册里指向其它设计分册的链接（architecture.md 等）会降级为纯文本 ——
 * 那些是设计细节，本站不展示，也不留死链。
 *
 * 产出：src/content/manual/<NN>-<slug>.md
 */

import fs from 'node:fs';
import path from 'node:path';

const SITE_ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = process.env.HERON_MANUAL ?? path.join(SITE_ROOT, 'docs/user-manual.md');
const OUT_DIR = path.join(SITE_ROOT, 'src/content/manual');

/** 章节号 → URL slug。顺序即侧边目录的顺序。 */
const CHAPTERS = [
  { no: '1', slug: 'what-is-heron' },
  { no: '2', slug: 'quickstart' },
  { no: '3', slug: 'interface' },
  { no: '4', slug: 'config' },
  { no: '5', slug: 'multi-agent' },
  { no: '6', slug: 'knowledge-base' },
  { no: '7', slug: 'security' },
  { no: '8', slug: 'commands' },
  { no: '9', slug: 'troubleshooting' },
  { no: '10', slug: 'http-api' },
];
const SLUG_BY_NO = new Map(CHAPTERS.map((c) => [c.no, c.slug]));

/** 上游文档自己写错的页内锚点（标题改过、目录没同步），构建期修正。 */
const STALE_ANCHORS = {
  'agent-design.md': {
    '#163-c-文件结构每个文件回答一个问题': '#c-文件结构每个文件回答一个问题',
  },
  'agent-design-v2.md': {
    '#8-落地记录待回填': '#8-落地记录2026-10-21',
  },
};

if (!fs.existsSync(SOURCE)) {
  // 源文件不在（比如只克隆了本站仓库，heron 仓库不在旁边）——
  // 如果已有生成好的内容就继续用，别让构建挂掉。
  const hasGenerated = fs.existsSync(OUT_DIR) && fs.readdirSync(OUT_DIR).some((f) => f.endsWith('.md'));
  if (hasGenerated) {
    console.warn(`[build-content] 找不到源文件 ${SOURCE}，沿用仓库内已有的生成内容。`);
    process.exit(0);
  }
  console.error(`[build-content] 找不到源文件：${SOURCE}`);
  console.error('[build-content] 请确认仓库内的 docs/user-manual.md 存在，或用 HERON_MANUAL 指定手册路径。');
  process.exit(1);
}

const text = fs.readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

/** 拆章：收集每个「## N. 」标题的起止行。 */
const starts = [];
lines.forEach((line, i) => {
  const m = /^##\s+(\d+)\.\s+(.+?)\s*$/.exec(line);
  if (m) starts.push({ index: i, no: m[1], title: m[2] });
});

if (starts.length === 0) {
  console.error('[build-content] 没有找到「## N.」章节标题，源文件格式可能变了');
  process.exit(1);
}

/**
 * 降级链接：
 *  - 指向其它设计分册的（architecture.md 等）→ 纯文本，本站不展示设计细节；
 *  - 指向源码文件的（../config/load.go）→ 纯文本；
 *  - 页内锚点 → 保留，必要时按 STALE_ANCHORS 修正；
 *  - 代码块里的内容一律不动（里面常有 Go 签名被误匹配）。
 */
function rewriteLinks(body, docFile) {
  const out = [];
  let inFence = false;

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    out.push(
      line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, target) => {
        if (/^(https?:|mailto:)/.test(target)) return whole;

        // 页内锚点
        if (target.startsWith('#')) {
          const fixes = STALE_ANCHORS[docFile];
          return fixes?.[target] ? `](${fixes[target]})` : whole;
        }

        // 其它分册 / 源码文件：降级为纯文本
        return label;
      }),
    );
  }

  return out.join('\n');
}

/** 标题层级上移一级：章标题在页面里是 h1，章内小节就应该是 h2。 */
function shiftHeadingDepth(text) {
  return text.replace(/^(#{3,})\s+/gm, (_, hashes) => `${hashes.slice(1)} `);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const written = [];

for (let i = 0; i < starts.length; i++) {
  const start = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1].index : lines.length;
  const slug = SLUG_BY_NO.get(start.no);
  if (!slug) continue;

  let body = lines.slice(start.index + 1, end).join('\n');
  body = body.replace(/\n-{3,}\s*$/, '').replace(/^\s*-{3,}\s*\n/, '');
  body = rewriteLinks(body, 'user-manual.md');
  body = shiftHeadingDepth(body).trim();

  const file = path.join(OUT_DIR, `${String(i + 1).padStart(2, '0')}-${slug}.md`);
  fs.writeFileSync(
    file,
    [
      '---',
      `title: ${JSON.stringify(start.title)}`,
      `chapter: ${JSON.stringify(start.no)}`,
      `order: ${i + 1}`,
      `slug: ${JSON.stringify(slug)}`,
      'kind: "manual-chapter"',
      `sourceFile: ${JSON.stringify(path.basename(SOURCE))}`,
      '---',
      '',
      body,
      '',
    ].join('\n'),
    'utf8',
  );
  written.push({ file: path.basename(file), title: start.title });
}

console.log(`[build-content] 源文件 ${path.relative(SITE_ROOT, SOURCE)} → 拆出 ${written.length} 章`);
written.forEach((w) => console.log(`  ${w.file.padEnd(26)} ${w.title}`));
