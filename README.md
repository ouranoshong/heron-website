# heron-website

[heron](https://github.com/) 的**介绍与使用说明站点**。Astro 静态站，零运行时依赖。

heron 是一个**跑在本地、配置是文件的多 Agent 运行时**：一组 agent 各带模型、提示词与工具边界，
共用一套审批闸门；需要你点头的动作会停下来等你批。

站点只做两件事：

| 区块 | 路径 | 内容 |
|---|---|---|
| **介绍** | `/` | heron 是什么、能做什么、一轮对话怎么走、怎么跑起来 |
| **使用说明** | `/manual/*` | 用户手册全文，按 10 章拆页，配侧边目录 |

站内**不展示设计细节**（内部架构、依赖约束、设计分册）。内容全部来自 heron 仓库的
`docs/user-manual.md`，不在本站手工维护：构建时由 `scripts/build-content.mjs` 从仓库原文
重新生成，仓库改了重新构建即可同步。

- 视觉：配色与排版参考 [Orrery 主题](https://github.com/formgong/orrery-astro-theme)（MIT）的视觉语言 ——
  **navy 黑底 + 单一青柠强调色 + 大字号浅色字 + 大留白**。

  | 项 | 值 |
  |---|---|
  | 底色 | `#040319`（navy 黑） |
  | 正文 / 标题 | `#EEEEEE` |
  | 次要文字 | `#949494`（6.71:1，过 AA） |
  | 强调色 | `#DCFD35`（青柠，唯一强调色，17.58:1） |
  | 字体 | Questrial（拉丁与数字）+ 系统黑体（中文回落），OFL 许可 |
  | 字号 | Hero 72px / 章节标题 46px / 导语 22px / 正文 16px |
  | 圆角 | 卡片与按钮 12px，面板 24px |

  其它参考到的细节：页头那条**从内容左边缘延伸到屏幕右边缘**的分隔线、句子里用强调色标出关键词、
  卡片 hover 时描边转为强调色。强调色之外只在"拒绝"分支用一次红色（`--danger`）。

  对比度实测：正文 6.71:1、标题 17.53:1、强调色文字与按钮 17.58:1、最次要标签 5.91:1 —— 全部过 AA。

### 标识

`public/brand/` 下三版标识，设计是**科技与自然的结合**：

| 文件 | 用途 |
|---|---|
| `heron-mark.svg` | 主标识，深底场景用（页头、页脚） |
| `heron-mark-mono.svg` | 单色版（`currentColor`），单色印刷或继承文字颜色 |
| `heron-icon.svg` | 徽章版：深底圆角方块 + 标识，用于 favicon / 应用图标 / PWA |

`favicon.svg` 用的是**徽章版** —— 浏览器标签页的明暗主题、以及浅色页面上的图标，
都需要深底才读得出青柠色。`apple-touch-icon.png` 与 `og.png` 同步重生成。

图形语言：

- **自然** —— 苍鹭的侧影：长喙、S 形颈、静立的身姿
- **科技** —— 颈部一道负空间的电路通道（带焊盘与分支）、头顶一根直角走线的天线、
  以及末端那枚分离的**数据点**（既是信号，也是苍鹭出手的瞬间）

配色与站点一致：主体青柠 `#dcfd35`，天线的数据点用青 `#8fe3ff` 点缀。
在 120 / 40 / 20px 三档下都核对过 —— 20px 时电路细节会融掉，但剪影与天线仍成立。

> 图形用 SVG `mask` 挖负空间。**别删 `<mask>` 上的 `width`/`height`** ——
> 缺了它们 mask 区域是 0×0，什么都渲染不出来（这个坑踩过一次）。

## 命令

```bash
npm install
npm run dev        # 生成内容 + 开发服务器
npm run build      # 生成内容 + 构建，产出到 dist/
npm run preview    # 预览构建结果
npm run check      # 站内链接自检（页面 + 锚点）
npm run deploy     # 构建 + 部署到 Cloudflare Pages
```

## 部署

已部署到 **Cloudflare Pages**：<https://heron.bytebits.top>（备用地址 <https://heron-website-381.pages.dev>）

- 项目名 `heron-website`，生产分支 `main`，配置见 `wrangler.jsonc`
- 构建产物是纯静态文件，用 `build.format: 'file'` 输出（`manual.html` / `manual/quickstart.html`），
  直接对应 `/manual` 与 `/manual/quickstart`，不会多一次尾斜杠跳转，canonical 也与实际地址一致
- 部署前用 `SITE_URL` 注入真实域名，canonical 与 og:image 才是绝对地址：

```bash
SITE_URL=https://heron.bytebits.top npm run deploy
```

- 重新部署后如果换域名，记得带上新的 `SITE_URL` 重建一次
- 自定义域名 `heron.bytebits.top` 已在 Pages 项目里挂好（status: active）；DNS 记录由 Pages 侧管理
- 构建用 `build.format: 'file'`（`manual.html` / `manual/security.html`），对外就是 `/manual` 与 `/manual/security`，
  不多一次尾斜杠跳转；canonical 同理要自己把 `.html` / `index.html` 归一化掉
- 登录凭据在 `~/.config/.wrangler/config/default.toml`（本机，不入库；`.gitignore` 已排除 `.wrangler/` 与 `.dev.vars`）

`npm run build` 会先跑 `prebuild` → `scripts/build-content.mjs`。

## 内容管线

手册原文随仓库一起放在 `docs/user-manual.md`，`scripts/build-content.mjs` 从它读取：

1. 按「## N. 标题」切成 10 个文件 → `src/content/manual/`
2. 丢掉原文的「## 目录」——站内由侧边目录代替
3. 标题层级上移一级：章内小节变成 `h2`（页面语义是 `h1` 章标题 + `h2` 小节）
4. 手册里指向其它设计分册（`architecture.md` 等）和源码文件（`../config/load.go`）的链接
   **降级为纯文本** —— 那些是设计细节，本站不展示，也不留死链

`src/content/manual/` 是生成物，不要手工编辑。

**手册更新了怎么同步**：把 heron 仓库里的最新版复制过来再构建 ——

```bash
cp ../heron/docs/user-manual.md docs/user-manual.md
SITE_URL=https://heron.bytebits.top npm run deploy
```

或者不动仓库里的副本，直接临时指向 heron 仓库构建一次（适合本地验证，不适合发布）：

```bash
HERON_MANUAL=../heron/docs/user-manual.md npm run build
```

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 首页：定位、终端演示、九项核心能力、**五条硬规则**、**架构示意简图**、可交互的 HITL 审批卡、出厂两个 agent、五分钟上手、使用教程入口 |
| `/manual` | 用户手册索引：十章卡片，每张列出该章小节并可直达锚点 |
| `/manual/<章节>` | 章节正文：原文全文 + 侧边目录（章 + 本章小节，滚动跟随高亮）+ 上下章导航 |

站点页面上不出现任何仓库路径 —— 读者看到的是内容本身，不是它从哪个文件来的。

章节 slug：`what-is-heron` / `quickstart` / `interface` / `config` / `multi-agent` / `knowledge-base` / `security` / `commands` / `troubleshooting` / `http-api`

## 两个可交互点

- 首页审批卡：Approve 走「从 checkpoint 恢复」，Reject 必须写理由（理由会回灌给模型），空理由不会通过
- 顶部导航：窄屏下折叠为汉堡菜单；正文页侧边栏随滚动高亮当前小节

## 技术要点

### 动效

动效手法参考 [Orrery 主题](https://github.com/formgong/orrery-astro-theme)（MIT）的做法：
**滚动联动交给浏览器，JS 只负责一次性触发入场，不用动画库。**

- `src/styles/effects.css` —— 全部动效
  - 页面转场：原生 `@view-transition { navigation: auto }`，无客户端路由
  - 入场关键帧：`flip`（卡片从平躺翻起）/ `rise`（向上抹出）/ `tilt` / `fade`
  - 滚动联动：`animation-timeline: view(0px)` + `animation-range`，正文块随滚动遮罩揭示
- `src/scripts/enter.ts` —— 入场触发器：元素露出 15% 时加 `.is-in`，动画播一次
- `src/scripts/scene.ts` —— 首屏背景的轨道线稿（canvas，无依赖；DPR 上限 2，出视口/切标签页停手，减弱动效只画一帧）

守住的三条：

1. **每个元素的默认态就是最终态** —— 没 JS、开了减弱动效、手机窄屏（<751px）的访问者，
   看到的是完整成品，不会缺内容；
2. 滚动联动全部包在 `@supports (animation-timeline: view())` 里；
3. 动画用长写属性 —— 简写 + `animation-timeline` 会被压缩器合成成 Chrome 拒绝的声明。

### 内容与样式

- Markdown 走 Astro v7 默认的 **Sätteri** 处理器（`@astrojs/markdown-satteri`），只挂了一个 hast 插件
  `scripts/wrap-tables.mjs`：把表格包进 `div.table-scroll`，配合 `contain: inline-size` 让宽表在窄屏下
  横向滚动而不把整页撑宽。注意 v7 的 remark/rehype 插件通道需要另装 `@astrojs/markdown-remark`，这里没走那条路。
- `astro.config.mjs` 里的 `site` 读 `SITE_URL` 环境变量，默认留空（相对路径）。部署时
  `SITE_URL=https://你的域名 npm run build`，og:image 才会是绝对地址
