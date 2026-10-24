/**
 * 站内链接自检：遍历 dist 里所有页面，校验每一个 href/src。
 *
 *  - 相对/绝对路径要能落到某个实际文件；
 *  - 带 #fragment 的要能在目标页面找到对应 id；
 *  - fragment 按浏览器规则先 percent-decode 再比对（中文锚点在源码里常写成编码形式）。
 */

const fs = require('node:fs');
const path = require('node:path');

const dist = 'dist';
const pages = [];

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) pages.push(p);
  }
})(dist);

const ids = new Map();
for (const p of pages) {
  ids.set(
    p,
    new Set([...fs.readFileSync(p, 'utf8').matchAll(/id="([^"]+)"/g)].map((m) => m[1])),
  );
}

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

let broken = 0;
let checked = 0;
const report = [];

for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  const from = path.relative(dist, p);

  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    checked++;

    const [rawPath, frag] = url.split('#');

    if (!rawPath) {
      if (frag && !ids.get(p).has(decode(frag))) {
        report.push(`锚点不存在  ${from}  →  #${frag}`);
        broken++;
      }
      continue;
    }

    const target = rawPath.startsWith('/')
      ? path.join(dist, rawPath)
      : path.join(path.dirname(p), rawPath);
    const candidates = [target, `${target}.html`, path.join(target, 'index.html')];
    const found = candidates.find((c) => fs.existsSync(c));

    if (!found) {
      report.push(`页面不存在  ${from}  →  ${url}`);
      broken++;
      continue;
    }

    if (frag) {
      const idFile = found.endsWith('.html')
        ? found
        : candidates.find((c) => fs.existsSync(c) && c.endsWith('index.html'));
      const targetIds = ids.get(idFile) ?? new Set();
      if (!targetIds.has(decode(frag))) {
        report.push(`锚点不存在  ${from}  →  ${url}`);
        broken++;
      }
    }
  }
}

report.slice(0, 25).forEach((r) => console.log(r));
if (report.length > 25) console.log(`… 其余 ${report.length - 25} 条`);
console.log(`\n页面 ${pages.length} 个 · 检查引用 ${checked} 条 · 问题 ${broken} 条`);
process.exit(broken ? 1 : 0);
