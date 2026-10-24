# heron 用户手册

> 面向**使用者**：怎么装、怎么配、怎么用。
> 内部设计与取舍不在这里 —— 需要时看 [architecture.md](architecture.md) 与各分册。
> 本手册描述的行为以仓库当前代码为准；示例文件均来自仓库里的 `.heron-example/` 与 `initcfg/templates/`。

---

## 目录

1. [heron 是什么](#1-heron-是什么)
2. [五分钟快速上手](#2-五分钟快速上手)
3. [界面使用](#3-界面使用)
4. [配置手册](#4-配置手册)
5. [多 agent 与委派](#5-多-agent-与委派)
6. [知识库](#6-知识库)
7. [安全与审批模型](#7-安全与审批模型)
8. [命令速查](#8-命令速查)
9. [故障排查](#9-故障排查)
10. [附录：HTTP 接口](#10-附录http-接口)

---

## 1. heron 是什么

heron 是一个**跑在本地、配置是文件的多 Agent 运行时**。一组 agent 跑在你自己机器上，
各带模型、提示词与工具边界，共用一套审批闸门；你在浏览器里跟它对话，
它能读你的项目代码、改文件、跑命令；需要你点头的动作会停下来等你批。

> 「配置是文件」而不是「配置进版本库」：配置**可以** review、**可以**提交进
> 版本库，但那不是前提 —— 全放本地、只你自己看，同样跑得好好的。真正关键的是
> 它是**可读的文件**：权限边界写在 `policy/permissions.yaml` 里，而不是藏在
> 某个黑盒设置面板后面。

核心能力：

| 能力 | 说明 |
|---|---|
| 多轮持久会话 | 每个会话一条常驻运行线，随时接着聊；历史落盘，关掉浏览器再打开还在 |
| 抢占 | Agent 回答途中你又发一条，旧的一轮在安全点让位给新的 |
| 中止 | 立刻停掉当前这一轮 |
| 人工审批（HITL） | 写文件、执行命令等动作在执行前挂起，你批准后从 checkpoint 恢复 |
| 多 agent 委派 | 一个主 agent 把活分给子 agent（只读检索 / 改代码 / 审阅），可并行 |
| 知识库 | 把自己的语料建成索引，agent 用 `kb_search` 检索并给出来源 |
| 配置热更新 | 改 `llm/` `agents/` `policy/` 保存即生效，不用重启 |
| 图形化配置编辑器 | 界面里直接编辑配置文件，写入前自动校验 |
| 斜杠命令与技能 | `/review`、`/explain`、`/fix` 等开箱可用；技能可自建 |

命名来自苍鹭（heron）：长久静立、瞬间精准出手 —— 对应「持久等待 + 抢占接管」。

---

## 2. 五分钟快速上手

### 2.1 前置

| 需要 | 版本 | 备注 |
|---|---|---|
| Go | 1.27.1+ | 只改 Go 代码时可以只跑后端构建 |
| bun | 1.3+ | 构建前端要用 |
| 一个 OpenAI 兼容端点 | —— | DeepSeek、Kimi、通义、vLLM、Ollama 等都行，只要兼容 `/chat/completions` |

### 2.2 构建与安装

```bash
cd heron
make build          # 先构建前端到 web/dist，再把它嵌进 Go 二进制
make install        # 装到 ~/.local/bin（装完任意目录都能用 heron）
```

产物是 `bin/heron` —— **单文件**（约 42 MB），界面已经嵌在里面，运行时**没有额外依赖要一起装**。

| 目标 | 命令 |
|---|---|
| 装到用户目录（默认，无需 root） | `make install` → `~/.local/bin/heron` |
| 装到系统目录 | `make install PREFIX=/usr/local/bin` |
| 卸载 | `make uninstall`（同一个 `PREFIX`） |

手动安装也一样 —— 把 `bin/heron` 拷到 PATH 里任意目录即可：

```bash
install -m 0755 bin/heron ~/.local/bin/heron
export PATH="$HOME/.local/bin:$PATH"   # 写进 ~/.bashrc 持久化
```

> 只改 Go 代码、想快点看到效果：`make build-go`（复用已有的 `web/dist`）。
>
> ★ **构建顺序不能反**：`web/dist` 是编译期 `go:embed` 进去的。先 `go build` 会**静默**
> 产出一个没有界面的二进制 —— 界面那部分在编译时就定下来了，后面再构建前端也补不回来。

跨平台构建（界面是 embed 进去的，交叉编译不受影响）：

```bash
GOOS=darwin  GOARCH=arm64 make build   # macOS Apple Silicon
GOOS=windows GOARCH=amd64 make build   # Windows
```

打包给别的机器用：

```bash
make release            # 六个平台全出，压缩包 + 校验和进 dist/
make release-one PLATFORM=darwin/arm64   # 只出一个平台
```

产物长这样：

```
dist/heron_<version>_<os>_<arch>.tar.gz   （Windows 是 .zip）
dist/checksums.txt
```

★ **发布构建是全静态的**（`CGO_ENABLED=0`）—— 一个文件扔到任何机器上都能跑，
不挑 glibc 版本。压缩包里是一个**目录**而不是裸文件，解压后目录名自解释。

下载后先验一下：

```bash
sha256sum -c checksums.txt       # 或 shasum -a 256 -c checksums.txt（macOS）
```

★ Windows 版有个已知边界：知识库索引的**跨进程锁**在 Windows 上没有在真机验证过
（开发机是 Linux）。第一次用 `heron kb index` 时留意一下并发行为 ——
详见 [developer-manual.md §2.2.2](developer-manual.md)。其余功能不受影响。

### 2.3 装完还差一步：配置

★ **二进制本身不足以启动**。空环境下直接跑会得到：

```
heron: agents/main.md does not exist or could not be parsed
```

—— 至少要有一个 agent 定义。两条路：

| 方式 | 放哪 | 什么时候用 |
|---|---|---|
| **用户级**（推荐装一次到处用） | `~/.heron/` | 你的默认 agent、默认端点、默认策略 |
| **项目级** | `<项目>/.heron/` | 这个项目特有的 agent 与策略（**覆盖**用户级同名文件） |

用户级配置一次配好，之后**在任何目录**跑 `heron` 都能用；项目级只是叠加在上面。
具体见下一节。

### 2.4 生成配置

在**你的项目目录**里执行（不是 heron 仓库里）：

```bash
heron init
```

它会在当前目录建出 `.heron/`，并只补**继承链上确实缺**的东西：

```
created .heron/agents/main.md
created .heron/agents/task.md
created .heron/llm/deepseek.yaml
created .heron/policy/permissions.yaml

config written to /your/project/.heron
the api key is read from the environment at request time: export DEEPSEEK_API_KEY=...
```

> ★ 注意最后一行写的是 **配置目录**（`.../.heron`），不是项目根 —— 实际落盘的
> 就是那四个 `.heron/` 下的文件。
>
> ★ 出厂是**两个** agent：`main` 只做决策与委派（自己不写文件），
> `task` 按任务单执行。两者是**一套** —— `main` 的 `subagents: [task]`
> 引用 `task`，少一个就是启动期硬错误，所以 `heron init` 总是两个一起写。

★ 想让它**装一次到处能用**，把同样的内容放到用户级：

```bash
heron init --dir ~          # → ~/.heron/{agents,llm,policy}
```

★ `--dir` 指的是**项目根**，heron 会在它下面建 `.heron/`。
写 `--dir ~/.heron` 会得到 `~/.heron/.heron/`（多一层），这是错的。

（`heron init` 只补继承链上缺的，同名文件整体替换 —— 它**不会**覆盖你已有的用户级配置。）

常用参数：

| 参数 | 作用 |
|---|---|
| `--model <provider>/<model>` | 指定模型，如 `--model deepseek/deepseek-flash` |
| `--provider <id>` | 厂商模板（默认 `deepseek`；也有 `openai`，其它 id 走通用模板，需同时给 `--model` 与 `--base-url`） |
| `--base-url <url>` | 自建/其它端点（通用模板必填 —— 不猜端点，猜错了拿到的是 404） |
| `--env <NAME>` | 密钥放在哪个环境变量（默认按厂商推断，如 `OPENAI_API_KEY`） |
| `--no-policy` | 不写 `policy/permissions.yaml` |
| `--dry-run` | 只报告将要写什么，不落盘 |
| `--force` | 覆盖已存在的同名文件 |
| `--json` | 机器可读输出 |

> ★ **同名文件是整体替换语义**。`heron init` 绝不会覆盖你 `~/.heron/` 里的同名文件 ——
> 它宁可继承，也不悄悄换掉你用户级的端点和密钥。

想要**带子 agent 与思考档位**的完整样例，用仓库里的出厂样例：

```bash
cp -r /path/to/heron/.heron-example/{agents,llm,policy,server,skills} /your/project/.heron/
```

### 2.5 设置密钥

密钥**只从环境变量读**，不写进文件（文件里只放引用）：

```bash
export DEEPSEEK_API_KEY=sk-...
```

> ★ 出厂默认的端点是 **deepseek**，所以环境变量名是 `DEEPSEEK_API_KEY`。
> 用了别的 provider 就换对应那个（`--env` 也能在 `heron init` 时直接指定）。

也可以写成 `@file:/path/to/key`。**不要把密钥直接写进 yaml** —— 那个文件通常要进版本库。

> 密钥没设**不会**阻塞启动，只在启动日志里记一条提醒。等到真正请求那个端点时才返回 401。

### 2.6 启动

```bash
heron              # 装过的话；没装就是 ./bin/heron
```

> ★ **在哪个目录启动，决定了「用哪份配置、agent 在哪个目录干活」**。
> heron 从当前目录向上找 `.heron/`，找不到就用用户级的 `~/.heron/`。
>
> - 配好了 `~/.heron/` → **在任何目录**跑都用同一套默认 agent，
>   但 agent 干活的目录是**当前目录**；
> - 要让 agent 在某个具体项目里干活，就在那个项目里启动它 ——
>   文件工具（`ls` / `read_file` / `write_file` / `execute`）走的是**进程 cwd**，
>   `PROJECT_ROOT` 改不动它。

看到这行就说明起来了：

```
[main] config loaded: version=3f2a1b9c8d0e
[main] frontend: embedded from web/dist
```

浏览器打开 **http://localhost:8080**。

### 2.7 试一句

在左侧点 **New thread**，输入框里问一句，比如「列出这个仓库的顶层目录」。

三件事应该同时发生：

1. 状态点变成 **Running**（蓝色脉动）；
2. 消息逐条流式出现（工具调用会展开成可折叠的卡片）；
3. 结束后状态点回到 **Idle**。

---

## 3. 界面使用

### 3.1 布局

```
┌──────────────┬────────────────────────────────────┐
│  New thread  │  heron  ●                          │  ← 状态点
│              ├────────────────────────────────────┤
│ 会话 1       │                                    │
│ 会话 2  ◀    │        消息流                      │
│ 会话 3       │                                    │
│              ├────────────────────────────────────┤
│              │  [输入框]        📎       ↑ 发送    │
│ ──────────── │  agent: main · deepseek/deepseek-flash · …   │
│  Settings ⌘, │                                    │
└──────────────┴────────────────────────────────────┘
```

- **状态点**：`Idle`（灰）/ `Running`（蓝，脉动）/ `Waiting for approval`（黄）/ `Failed`（红）。
- **输入框下方**是当前会话的 agent、模型与思考档位，鼠标悬停可看完整信息。

### 3.2 会话

| 操作 | 怎么做的 |
|---|---|
| 新建 | 侧栏 **New thread** 或 `/new` |
| 切换 | 点侧栏条目 |
| 改名 | 条目右侧 **⋯**（鼠标悬停出现）→ **Rename** |
| 删除 | 条目右侧 **⋯** → **Delete** |
| 中止当前轮 | 输入框里的停止按钮或 `/stop` |

会话历史存在 `.heron/state/sessions/<id>/`，重启后仍在。

> 有审批待处理的那条会话，标题右边会有一颗**黄点** —— 即使你没开着那个会话，
> 也一眼能看出「有个审批在等你」。

### 3.3 发送与流式输出

正常输入、Enter 发送、Shift+Enter 换行。

- **工具调用**显示为可展开的卡片：工具名 + 参数摘要 + 结果。
- **代码块**带语法高亮。
- 输出过程中可以**再发一条**：旧的一轮会在安全点停下，让位给新的（抢占）。

### 3.4 审批卡（HITL）

当 agent 要调用被标记为 `ask` 的工具时，轮次会**停住**，输入框被一张审批卡取代：

```
┌────────────────────────────────────────────┐
│ ⚠ Approval required                        │
│   The agent is paused until you respond.   │
│                                            │
│   write_file                               │
│   Requested by coder                       │
│   /your/project/internal/config.go         │
│                                            │
│   [ Approve ]  [ Reject ]                  │
└────────────────────────────────────────────┘
```

- **Approve** —— 放行，agent 从 checkpoint 继续跑。
- **Reject** —— 写不写**理由**都行，但**建议写**：理由会回灌给模型，它据此改路；
  空理由对模型等于凭空断路（服务端不强制，界面也不拦你留空）。

> **Requested by xxx** 只在**子 agent** 发起时出现。根 agent（就是当前会话自己）
> 的审批不标 —— 那正是「当前会话」，标了只是占地方。

★ **多个审批同时出现时，一次把它们全部答掉**。只答一张，其余会带着新 id 重新中断。

### 3.5 附件

输入框的 📎 按钮或 `/attach` 可以给会话加文件。文件进该会话的独立工作区
`.heron/state/sessions/<id>/workspace/`，agent 通过路径访问。

### 3.6 斜杠命令

在输入框输入 `/` 会弹出命令列表。

| 命令 | 类型 | 作用 |
|---|---|---|
| `/new` | 动作 | 新建会话 |
| `/stop` | 动作 | 中止当前轮 |
| `/attach` | 动作 | 附件 |
| `/settings` | 动作 | 打开配置编辑器 |
| `/agents [名字]` | 动作 | 切换当前会话的 agent |
| `/skill <名字> [任务]` | 提示词 | 用某个技能完成这项任务 |
| `/review [路径]` | 提示词 | 审阅当前改动或指定路径 |
| `/test [路径]` | 提示词 | 跑相关测试并汇总失败 |
| `/explain <路径或符号>` | 提示词 | 解释一段代码怎么工作 |
| `/fix <问题>` | 提示词 | 定位根因并做最小修复 |

「动作」类命令由前端直接执行；「提示词」类命令是**模板**，展开成一段给模型的话再发出去。

> 以 `/` 开头的**绝对路径**（如 `/home/me/a.go`）不会被当成命令，会原样发出。

### 3.7 用 `@` 引用文件

在输入框输入 `@` 会弹出项目文件列表，选中后把路径插进消息里：

```
看看 @internal/config.go 这个文件为什么不加载
```

它只是**插一段路径文本**，不做别的事 —— 文件不会被自动读进上下文，agent 自己决定要不要读。

### 3.8 切换 agent

- 欢迎页：输入框里用 `/agents` 或点 agent 选择器，**下次新建**的会话用它。
- 已有会话：`/agents` 会把**当前会话的根 agent**换掉。

> 每个声明了的 agent 都能当会话的 agent —— 没有「主 agent」那套推导。
> 会话选了谁，就以谁为第 0 层展开它自己的 `subagents:`。

### 3.9 技能（skills）

技能是放在 `.heron/skills/<名字>/SKILL.md` 的一组指令，用 `/skill <名字> <任务>` 调用：

```markdown
---
name: refactor
description: 重构既有代码
---

保持行为不变的最小改动重构。
```

- 只写 `/skill`（不带名字）会打开**技能选择器**，选一个会回填成 `/skill <名字> `，
  你再补一句任务 —— 选中**不会**直接发送。
- 名字写错（比如 `/skill refactor` 但没有这个技能）也会打开选择器并用它过滤，
  而不是报「命令不存在」。
- 技能实际由**模型自己**的 `skill` 工具执行，服务端展开命令时只是把
  「用这个技能做这件事」的话转达给模型。

`description` 决定模型会不会主动选它 —— 写清楚「什么时候该用我」。
技能只扫**一级子目录**，嵌套更深的会被忽略。

### 3.10 设置（配置编辑器）

侧栏底部的 **Settings**，或快捷键 **⌘, / Ctrl+,**。

它操作的是「**某一级的一个文件**」，不是合并后的配置 —— 这样才不会把
`${OPENAI_API_KEY}` 展开成明文写回仓库。

| 能做 | 不能做 |
|---|---|
| 增删改 `llm/` `agents/` `policy/` `kb/` 下的配置文件 | 编辑 `server/`（只读 + 标注「需重启」） |
| 保存前试合并校验，明文密钥一律拒绝 | 编辑 `skills/`（目录结构，不在编辑器范围） |

两个要知道的细节：

- **被项目级遮蔽**：如果你改的是用户级文件，而项目级有同名文件，界面会**提前**提示
  「此文件被项目级覆盖，保存不生效」，并给出跳转入口 —— 因为同名文件是整体替换。
- **保存不等于生效**：保存只做校验 + 原子写，**生效由热更新 watcher 负责**。
  `server/` 下的改动永远需要重启。

---

## 4. 配置手册

### 4.1 目录布局

```
<项目根>/.heron/            ~/.heron/
├─ agents/main.md           ├─ llm/<provider>.yaml
├─ llm/<provider>.yaml      ├─ server/config.yaml
├─ server/config.yaml       ├─ policy/permissions.yaml
├─ policy/permissions.yaml  ├─ policy/limits.yaml
├─ policy/limits.yaml       └─ skills/<name>/SKILL.md
├─ skills/<name>/SKILL.md
├─ kb/config.yaml
├─ state/          ← 运行数据（会话、checkpoint），不要提交
└─ .gitignore
```

**两个「根」要分清**：

| 概念 | 值 | 用来干什么 |
|---|---|---|
| 项目根 `ProjectRoot` | `<root>`（`.heron/` 外面那层） | 知识库语料/索引的路径基准、`static_dir` 的解析基准、告诉模型「项目在哪」 |
| 配置目录 `ProjectDir` | `<root>/.heron` | 读配置、放 `state/` |

相对路径**不是**按当前工作目录解析，但基准分两种：

| 字段 | 相对路径的基准 | 写 `web/dist` 指 |
|---|---|---|
| `server.static_dir` | **项目根** | `<root>/web/dist` |
| `server.data_dir` | **配置目录** | `<root>/.heron/web/dist` |

`static_dir` 指项目根，是因为前端资源与 agent 的工作目录同层；`data_dir` 指
配置目录，是因为 `state/` 历来与配置同根（`.gitignore` 一处生效）。绝对路径两者都原样使用。

**项目根怎么找**：先看 `PROJECT_ROOT` 环境变量；没有就从**当前目录**开始，
向上找第一个含 `.heron/` 的祖先目录（那个目录就是项目根）；再没有就用当前目录。
所以 `cd cmd/server && heron` 仍然命中项目配置。

> ★ 别把 `HERON_CONFIG_DIR` 和项目根搞混：**它管的是用户级那一层**
> （`~/.heron/`），不参与项目根探测。`PROJECT_ROOT` 才是覆盖项目根的那个。
>
> ★ `PROJECT_ROOT` 环境变量的作用范围比想象中小，它**只**覆盖两处用法：
> 知识库语料/索引的路径解析，以及注入给模型的上下文里写的「项目根」。
> 它**不**覆盖：读哪份 `.heron/`（按进程 cwd 上溯）、`static_dir` 相对路径的基准
> （那用的是配置服务自己算的项目根）、以及文件工具（`ls` / `read_file` /
> `write_file` …）的工作目录 —— 那些永远相对**进程 cwd**。

### 4.2 两级分层与优先级

```
内置默认 → ~/.heron/（用户级）→ <项目根>/.heron/（项目级）→ 环境变量
```

**同名文件整体替换**，不是逐字段合并。所以项目级放一个 `policy/permissions.yaml`，
用户级那份就完全不生效（而不是逐项合并）。

### 4.3 什么改动会立即生效

| 目录 | 热更新 | 说明 |
|---|---|---|
| `llm/` `agents/` `policy/` `kb/` | ✅ | 下一轮就用新配置 |
| `server/` | ❌ | 它配的是进程自身，改了要重启 |

改坏配置**不会让进程死**：沿用上一份并记一条日志。

### 4.4 三种「配了没用」

| 形态 | 表现 | 处理 |
|---|---|---|
| 键名拼错 | 启动报错，带行号 | 硬错误，改对为止 |
| 认识但本版不兑现 | 启动日志 `config notice: ...` | 记进 deferred，启动时逐条打印 |
| 认识但缺运行期前提（如 `${ENV}` 没设） | 启动日志提醒，**不影响启动** | 请求该端点时才 401 |

**降级必须出声** —— 启动日志里的 `config notice:` 就是它的唯一线索。

### 4.5 `server/config.yaml`

进程自身的配置，**改了要重启**。

```yaml
listen_addr: ":8080"        # 必须加引号
static_dir: web/dist        # 相对项目根；空 = 关闭前端（dir 模式的服务目录）
data_dir: state             # 相对配置目录；空串等同 state
frontend_mode: embed        # embed（发布形态）| dir（开发时指向磁盘目录）
start_timeout: 60s          # 一轮从提交到进入运行态的上限
retry:
  max_retries: 5            # 模型调用失败后的重试次数
agent:
  max_depth: 1              # 嵌套深度上限，入口 agent 是第 0 层
watch:
  enabled: true             # 没写 = 开；显式 false = 关
  debounce: 200ms           # 热更新轮询间隔
```

★ **时长必须带单位**：`timeout: 5m`。写 `timeout: 300` 会被拒绝
（否则 `300` 会被当成 300 纳秒）。`start_timeout` / `debounce` 写错会退回默认值并记一条
deferred，`timeout` 写错则直接报错带行号。

#### 外部工具（默认全关）

`tools:` 段控制三类「连到外面去」的能力。**写了哪段就开哪个**，没有 `enabled` 字段：

```yaml
tools:
  http:                     # request_get / request_post / request_put / request_delete
    methods: [get]          # 默认只有 get；post/put/delete 要显式点名
    headers: {}
    timeout: 30s
  web_search:
    provider: duckduckgo    # duckduckgo（零配置）| searxng（自建）
    max_results: 10
    timeout: 60s
    region: ""              # 空 = 全球
  wikipedia:
    top_k: 3
    language: zh
    timeout: 15s
    base_url: ""            # 空 = 官方 API
```

这些工具的输出会**原样进模型上下文**，所以有额外约束：

- 只连**公网**（不能访问 `127.0.0.1` 或云元数据地址）；
- 输出有 20000 字节上限（防止一个 10MB 页面撑爆这一轮）；
- 写方法（POST/PUT/DELETE）必须显式点名。

启用它们**不需要**再去 `policy/permissions.yaml` 里点一遍名 —— 写下这段本身就是启用声明。

### 4.6 `llm/<provider>.yaml`

一个厂商一个文件。文件名就是 provider id。

```yaml
type: openai_compat
base_url: https://api.openai.com/v1
api_key: ${OPENAI_API_KEY}      # 或 @file:/path/to/key
timeout: 5m                     # 必须带单位

hint_keys: ["reasoning_effort"] # 仅用于请求被拒时给出准确提示
extra:                          # 厂商级方言，所有模型共享
  stream: true

models:
  - id: gpt-4o
    context_window: 128000

  - id: o3
    context_window: 200000
    reasoning:                   # 档位词汇表：档位名 → 这个端点怎么发
      off:  {}
      low:  { reasoning_effort: low }
      high: { reasoning_effort: high }
    reasoning_default: low       # agent 没写 reasoning 时用它
    timeout: 30m                 # 覆盖 provider 级 timeout
```

要点：

- **`api_key` 写引用，不写密钥本体**。`${ENV}` 未设不阻塞启动，只提醒；`@file:` 路径写错则启动期报错。
- **`model` 引用必须写成 `<provider>/<model>`**：`provider` 是 `llm/` 下的文件名（不含 `.yaml`），
  `model` 是该文件 `models[]` 里声明的 `id`。解析不到会在启动期报错，**不会静默退化到别的模型**。
- **思考档位由端点定义**。同一个 `high` 在不同端点发的字段可能完全不同 —— 这正是
  词汇表存在的理由。agent 写了一个该模型没有的档位时**不拦启动**，那个档位被
  **静默忽略**（请求时不带任何思考字段）—— 服务端**不会**在启动日志里说这件事；
  只有设置编辑器的校验（`POST /v2/settings/validate`）会当场报「这个档位不是
  该模型的档位」。`GET /v2/agents/:agentId` 的 `reasoningAvailable` 会告诉你
  这个模型到底有哪些档位。

> ★ 出厂默认是 **deepseek**（`heron init` 不带参数就选它），而它的模板**声明了
> 档位表**（`off` / `low` / `high` / `max`）—— 所以出厂 agent 写的
> `reasoning: high` 是**真生效**的。
>
> ★ 但 **openai 那份模板没有档位表**：显式 `--provider openai` 时，
> agent 写的 `reasoning: high` 就是**空转**的（`reasoningAvailable` 会是
> 空数组）。要用思考档位，挑一个声明了它的 provider，或自己在
> `models[].reasoning` 里补上。

### 4.7 `agents/<id>.md`

**frontmatter 是配置，正文是提示词**。文件名就是 agent id。

```markdown
---
description: 管理角色
model: openai/gpt-4o
max_iterations: 30
reasoning: high            # 档位名，取自 models[].reasoning 的键
disabled_tools: [execute, write_file, edit_file]
subagents: [researcher, coder, reviewer]
---

你在一个 Go 仓库里工作。

- 先读再写，改动尽量小。
- 能跑测试就跑。
```

| 字段 | 作用 |
|---|---|
| `description` | 给人和模型看的说明；模型据此判断要不要委派给它 |
| `model` | `<provider>/<model>`，必须能解析 |
| `max_iterations` | 单轮内工具调用次数上限 |
| `temperature` / `max_tokens` | 这一档调用用的采样参数（不写 = 用端点默认） |
| `reasoning` | 思考档位名（取自端点的 `models[].reasoning` 键） |
| `disabled_tools` | 只影响**这一个** agent |
| `subagents` | 它的下属 agent 列表 |

frontmatter 的三种输入：

| 输入 | 行为 |
|---|---|
| `---` … `---` + 正文 | 正常：字段从 frontmatter 读，正文全部作为指令 |
| 没有 frontmatter 的纯 `.md` | 不报错（可能是纯提示词草稿），但随后会因缺 `model` 报错 |
| 有 `---` 开头但缺结束分隔符 | **错误**：无法判断正文从哪开始 |

### 4.8 `policy/permissions.yaml`

审批决策。**只有 `ask` 和 `deny` 两列**：

```yaml
ask:   [write_file, edit_file, execute, kb_index]
deny:  []
```

| 列 | 跨层级语义 | 为什么 |
|---|---|---|
| `ask` | **整体替换** | 它是偏好，不是安全边界 |
| `deny` | **取并集** | 它是安全边界 —— 项目级不能靠一个同名文件把它放松掉 |

★ **未点名的工具一律放行**（兜底 `allow`）。所以新增一个工具后它默认可直接用；
想让它每次都要人点头，加进 `ask`；想让它完全不能用，加进 `deny`。

★ **外层 `deny` 优先于 agent 自己的 `disabled_tools`** —— 这是子 agent **无法放松**的唯一保证。
要收窄**某一个** agent 的能力，用它自己的 `disabled_tools`，别动全局策略。

### 4.9 `policy/limits.yaml`

数量上的上限，与 `permissions.yaml` **正交**（一个管「要不要点头」，一个管「最多能做多少」）：

```yaml
agent:
  max_depth: 0        # 0 = 不设限，沿用 server/config.yaml 的全局值
retry:
  max_retries: 0
```

★ **只能收紧，不能放宽**。这里的值与 `server/config.yaml` 里的同名值取**更严的**那个，
用户级与项目级之间也是取更严的。放宽请改 `server/config.yaml`（需重启）；
收紧则**立即生效**（`policy/` 进热更新）。

声明一个比全局基线更宽松的值是**空操作** —— 启动时会在 deferred 里告诉你「这个值没生效」。

### 4.10 `skills/<name>/SKILL.md`

```markdown
---
name: refactor
description: 重构既有代码     # 决定模型选不选它
context: inline               # inline | fork | fork_with_context
agent: main                   # fork 模式从哪取 agent
model: fast                   # fork 模式用哪个模型
---

保持行为不变的最小改动重构。
```

只扫**一级子目录**：`skills/<name>/SKILL.md` 有效，更深的会被忽略。

### 4.11 `kb/config.yaml`

```yaml
corpus: docs                # 相对项目根；**拒绝绝对路径**；空 = 关闭知识库
index: docs                 # 索引名 → .heron/state/kb/<index>/
model: local/embed          # 指向 kind: embedding 的模型；空 = 纯词法检索
query_instruction: "Instruct: 检索 heron 的设计文档\nQuery: "
batch_size: 10
max_batch_chars: 1200
top_k: 8                    # 返回几篇**文档**
```

- `corpus` 为空 = 知识库关闭，`kb_search` / `kb_index` 这两个工具**根本不存在**。
- `model` 指向的模型必须在 `llm/*.yaml` 里声明 `kind: embedding` —— 指错会在建索引前报错，
  而不是拿 chat 端点去调 `/embeddings` 得到 404。

### 4.12 环境变量

| 变量 | 覆盖什么 |
|---|---|
| `HERON_CONFIG_DIR` | 用户级配置基目录 |
| `LISTEN_ADDR` | `server.listen_addr` |
| `DATA_DIR` | `server.data_dir` |
| `PROJECT_ROOT` | 项目根探测结果 |
| `STATIC_DIR` | `server.static_dir` |
| `FRONTEND_MODE` | `embed` \| `dir` |
| `EINO_EXT_SKILLS_DIR` | skills 目录 |

★ **`llm/*.yaml` 与 `agents/*.md` 里的字段没有环境变量覆盖** —— 这是刻意的：
模型档案决定花谁的钱、存不存数据，必须能被 review 和提交。

---

## 5. 多 agent 与委派

### 5.1 怎么声明

在 `agents/main.md` 的 frontmatter 里写 `subagents: [researcher, coder]`。

**子 agent 与其它 agent 是同一种东西** —— 差别只是文件名。它们各自：

- 拥有自己的 `model:`、`disabled_tools:`、提示词；
- 被**逐个装配**自己的审批与工具过滤中间件（不能指望父 agent 传播）；
- 在 `max_depth` 允许范围内递归展开。

### 5.2 深度上限

`server/config.yaml` 的 `agent.max_depth`：入口 agent 是**第 0 层**，深度 d 的 agent
允许再生子 agent 当且仅当 `d < max_depth`。

- `max_depth: 1` = 只有入口 agent 能委派（默认）；
- `max_depth: 2` = 入口的子 agent 还能再往下委派。

声明的拓扑超出上限时**启动期报错**，不会被静默截断。

### 5.3 并行委派

**互不依赖**的任务可以一条消息里发多个 task 调用，让它们同时跑：

- 「A 模块和 B 模块各自实现一下」→ 两个 `coder` 并行；
- 「先查 A 的实现，再查 B 的实现」→ 两个 `researcher` 并行（都只读，不互相踩）；
- 「改完之后审一遍」→ **串行**，`reviewer` 必须等 `coder` 改完。

★ 并行只对**互不依赖**的任务成立。前一步的输出是后一步的输入时，并行只会拿到
一堆基于旧世界的结论。

★ 多个子 agent 同时要人批准时，会**同时**弹出几张审批卡，子 agent 发的那些会标出
**是谁**要的（「Requested by coder」）—— 把它们**一起**答掉。

### 5.4 出厂样例的四个角色

| 角色 | 干什么 | 能写文件吗 |
|---|---|---|
| `main` | 编排：分派、汇总 | 否 |
| `researcher` | 只读检索：定位实现、追调用链 | 否 |
| `coder` | 按结论改文件、跑测试 | **能** |
| `reviewer` | 读改动、挑问题 | 否 |

「谁能写」靠**两层**控制，缺一不可：外层 `policy/permissions.yaml` 的 `deny`（谁都别想用）
＋ 内层各 agent 自己的 `disabled_tools`（只影响这一个）。

---

## 6. 知识库

知识库让你的私有语料（设计文档、规范、笔记）能被 agent 检索并引用。

### 6.1 开启

1. 在 `.heron/kb/config.yaml` 里配 `corpus`（相对项目根）与 `model`（可选）。
2. 建索引：

```bash
heron kb index          # 全量索引（几百个文件是十分钟量级）
heron kb status         # 看索引现状，不需要向量化服务在跑
heron kb search "怎么配审批"   # 手动搜一把
```

`heron kb index` 是**独立的子命令**，不会起服务进程 —— 全量索引时端口不会被占着。

### 6.2 agent 怎么用

配好之后，agent 会拿到两个工具：

| 工具 | 作用 | 默认档位 |
|---|---|---|
| `kb_search` | 检索语料，返回文档与出处 | 放行（只读） |
| `kb_index` | 把语料写进索引 | **需要审批**（写操作） |

没配 `corpus` 就**一个工具都不挂** —— 挂一个永远召回不到东西的 `kb_search` 比不挂更糟。

### 6.3 换模型

换了 embedding 模型，旧向量还在库里 —— 跨模型检索给出的是**看起来正常的错结果**。
所以 `heron kb index` 会在建索引前做身份比对，发现不匹配直接报错，让你重建。

---

## 7. 安全与审批模型

### 7.1 工具档位

| 档位 | 含义 |
|---|---|
| `allow` | 直接放行（**兜底档**） |
| `ask` | 每次执行前挂起，等人批准 |
| `deny` | 不可用 |

判定顺序：**`deny` → `ask` → 兜底 `allow`**。

### 7.2 谁能用什么（分层工具表）

| 层 | 作用 | 跨 agent |
|---|---|---|
| 外层 `policy/permissions.yaml` 的 `deny` | 全局禁令 | 谁都别想用，子 agent 无法放松 |
| 外层 `policy/permissions.yaml` 的 `ask` | 需要点头 | 所有 agent 都一样 |
| 内层 agent 的 `disabled_tools` | 收窄某一个 agent | 只影响它自己 |
| `tools:` 段的启用 | 工具**存不存在** | 不开 = 工具根本不存在 |

★ 两层是**分层保存，永不合并** —— 合并就丢掉了「谁在外层」，而那是子 agent
不能越权加回被禁工具的唯一保证。

### 7.3 启用的内置工具

| 工具 | 干什么 |
|---|---|
| `ls` / `read_file` / `glob` / `grep` | 读项目文件（默认放行） |
| `write_file` / `edit_file` | 改文件（默认**要审批**） |
| `execute` | 执行命令（默认**要审批**） |
| `task` | 委派给子 agent（DeepAgent 提供） |
| `write_todos` | 任务清单（DeepAgent 提供） |
| `skill` | 调用技能（默认放行） |
| `kb_search` / `kb_index` | 知识库（需配 `kb.corpus`） |
| `request_get` / `request_post` / `request_put` / `request_delete` | HTTP（需配 `tools.http`） |
| `duckduckgo_search` | 网络搜索（需配 `tools.web_search`） |
| `wikipedia_search` | 维基检索（需配 `tools.wikipedia`） |

想知道某个 agent **实际**拿到了哪些工具、每个是什么档位，看自省接口
（`GET /v2/agents/:agentId` 的 `effectiveTools`）—— 那里给的是**装配后的真实结论**
（档位、原因、运行期观测到的工具名），不是配置原文。

### 7.4 审批的几个边界情况

- **拒绝最好给理由** —— 理由会回灌给模型，它据此改路；没有理由的拒绝对模型等于凭空断路。
  ★ 但这**不是硬约束**：服务端允许空理由，界面也不拦（留空照样能拒）。
- **多个审批一起答** —— 逐个答的话，答完第一个其余会带着新 id 重新中断。
- **重启后审批会丢** —— 启动巡检会发现「有 checkpoint 但没有 pending 审批」的会话，
  日志里会报 `ownerless`，那些会话**无法恢复**，需要重新提问。

---

## 8. 命令速查

### 8.1 heron 子命令

```bash
heron                       # 启动服务（默认 :8080）
heron init [flags]          # 在当前目录建最小可运行的项目级配置
heron kb index [files...]   # 建知识库索引
heron kb search <query>     # 手动检索
heron kb status [--json]    # 看索引现状
```

### 8.2 make 目标

| 命令 | 作用 |
|---|---|
| `make build` | 前端 + 后端完整构建，产出 `bin/heron` |
| `make build-go` | 只构建后端 |
| `make install` | 装到 `~/.local/bin`（`PREFIX=...` 可改），装完任意目录可用 `heron` |
| `make uninstall` | 从 `PREFIX` 移除 |
| `make run` | 运行二进制 |
| `make web` | 只构建前端到 `web/dist` |
| `make dev` | Go 自动重建重启（air） |
| `make web-dev` | 启动 Vite dev server（:5173，代理到 :8080） |
| `make test` | Go 全量测试 |
| `make lint` | go vet + oxlint + tsc |
| `make check` | lint + test，提交前跑这个 |
| `make test-e2e` | 浏览器 E2E（自带假后端） |
| `make smoke` | 真后端联调冒烟 |
| `make kb-index` / `make kb-status` | 知识库索引 |

### 8.3 常用环境变量

```bash
LISTEN_ADDR=":9090"                  # 换端口
HERON_CONFIG_DIR=~/.heron            # 指定用户级配置目录
PROJECT_ROOT=/path/to/project        # 指定项目根
DATA_DIR=/path/to/state              # 指定运行数据目录
FRONTEND_MODE=dir STATIC_DIR=web/dist # 开发时用磁盘目录而不是嵌入资源
```

---

## 9. 故障排查

| 症状 | 多半是 | 怎么办 |
|---|---|---|
| 启动报「模型解析不了」 | `model:` 没写 `<provider>/` 前缀，或 model id 不在该 provider 的 `models[]` 里 | 照启动报错改（这是硬错误，不是提醒） |
| 启动报未知字段、带你行号 | 键名拼错（`max_retry` vs `max_retries`） | 照报错改 |
| 请求返回 401 | `api_key` 的 `${ENV}` 没设 | `export` 那个环境变量 |
| 改了配置没生效 | 改的是 `server/`（需重启），或文件被项目级同名文件遮蔽 | 看启动日志的 `config notice:`；用设置界面看遮蔽提示 |
| 改了 `llm/` `agents/` `policy/` 没生效 | 热更新轮询还没到（默认 debounce 200ms） | 等一拍；确认 `watch.enabled` 没被关掉 |
| 页面是空的 / 404 | 没构建前端，或 `static_dir` 指向了错目录 | `make build`；检查 `static_dir` 是相对**项目根** |
| 界面还是旧的 | `frontend_mode: dir` 且 `static_dir` 指向了旧目录 | 指向 `web/dist`，或改回 `embed` |
| 审批卡不出现 | 那个工具本来就是 `allow`（未点名即放行） | 把它加进 `policy/permissions.yaml` 的 `ask` |
| 模型不调 `write_file` | 该 agent 的 `disabled_tools` 里禁了它 | 去掉那个名字 |
| 子 agent 没被委派 | `max_depth` 不够，或拓扑声明超限（启动期就报错了） | 调 `agent.max_depth`，或改拓扑 |
| 知识库检索结果莫名其妙 | 换了 embedding 模型但没重建索引 | `heron kb index` 重建 |
| 端口被占 | 上一次进程没退干净 | `pkill -x heron`（按进程名杀，别用 `-f` 匹配完整命令行） |

### 看日志

启动日志是最快的诊断入口：

```
[main] config loaded: version=...        配置代际
[main] config notice: ...                 ← 「配了没用」在这里
[main] agent pool: gen=3 entries=4 hits=12 misses=2
[main] inspection: clean=2 pending=1 orphan=0 ownerless=0 skipped=0
[main] hot reload enabled, watching: ...
```

★ `config notice:` 那一行**必须真的打印** —— 它是「配了但没生效」的唯一可见线索。

---

## 10. 附录：HTTP 接口

只想拿脚本驱动的话，这些接口可以直接用（`/v2` 是当前前端用的命名空间）。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/v2/health` | 健康检查 |
| GET | `/v2/runtime` | 运行时状态 |
| POST | `/v2/sessions` | 新建会话（可指定 agent） |
| GET | `/v2/sessions` | 会话列表 |
| GET | `/v2/sessions/:id` | 会话详情 |
| PATCH | `/v2/sessions/:id` | 改标题（body：`{"title": "..."}`） |
| PATCH | `/v2/sessions/:id/agent` | 换根 agent（body：`{"agentId": "..."}`；会话忙时返回 409） |
| DELETE | `/v2/sessions/:id` | 删除会话 |
| GET | `/v2/sessions/:id/messages` | 消息历史 |
| POST | `/v2/sessions/:id/abort` | 中止当前轮 |
| POST | `/v2/sessions/:id/files` | 上传附件 |
| GET | `/v2/sessions/:id/files` | 附件列表 |
| GET | `/v2/project/files` | 项目文件树 |
| GET | `/v2/commands` | 斜杠命令清单 |
| GET | `/v2/skills` | 技能清单 |
| GET | `/v2/agents` | agent 清单与生效工具 |
| GET | `/v2/agents/:agentId` | 单个 agent 详情 |
| GET | `/v2/config` | 合并后的配置（只读） |
| GET | `/v2/settings` | 配置编辑器清单 |
| GET | `/v2/settings/item` | 读一个配置文件 |
| POST | `/v2/settings/item` | 写一个配置文件 |
| PUT | `/v2/settings/item` | 同 POST（同一处理器的别名） |
| DELETE | `/v2/settings/item` | 删一个配置文件 |
| POST | `/v2/settings/validate` | 写入前校验 |
| POST | `/v2/run` | 跑一轮（流式返回） |

老的无前缀接口（`/sessions`、`/sessions/:id/chat` 等）已于 2026-10-23 随 M3 下线，
`/v2` 是现在**唯一**的接口命名空间。

---

**相关文档**：[developer-manual.md](developer-manual.md)（想改 heron 本身看这份）· [architecture.md](architecture.md) · [config-design.md](config-design.md) ·
[api-v2-design.md](api-v2-design.md) · [frontend-design.md](frontend-design.md) ·
[agent-design.md](agent-design.md) · [multi-agent-design.md](multi-agent-design.md) ·
[kb-design.md](kb-design.md) · [init-design.md](init-design.md)
