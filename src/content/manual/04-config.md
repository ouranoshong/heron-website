---
title: "配置手册"
chapter: "4"
order: 4
slug: "config"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

## 4.1 目录布局

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

## 4.2 两级分层与优先级

```
内置默认 → ~/.heron/（用户级）→ <项目根>/.heron/（项目级）→ 环境变量
```

**同名文件整体替换**，不是逐字段合并。所以项目级放一个 `policy/permissions.yaml`，
用户级那份就完全不生效（而不是逐项合并）。

## 4.3 什么改动会立即生效

| 目录 | 热更新 | 说明 |
|---|---|---|
| `llm/` `agents/` `policy/` `kb/` | ✅ | 下一轮就用新配置 |
| `server/` | ❌ | 它配的是进程自身，改了要重启 |

改坏配置**不会让进程死**：沿用上一份并记一条日志。

## 4.4 三种「配了没用」

| 形态 | 表现 | 处理 |
|---|---|---|
| 键名拼错 | 启动报错，带行号 | 硬错误，改对为止 |
| 认识但本版不兑现 | 启动日志 `config notice: ...` | 记进 deferred，启动时逐条打印 |
| 认识但缺运行期前提（如 `${ENV}` 没设） | 启动日志提醒，**不影响启动** | 请求该端点时才 401 |

**降级必须出声** —— 启动日志里的 `config notice:` 就是它的唯一线索。

## 4.5 `server/config.yaml`

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

### 外部工具（默认全关）

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

## 4.6 `llm/<provider>.yaml`

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

## 4.7 `agents/<id>.md`

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

## 4.8 `policy/permissions.yaml`

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

## 4.9 `policy/limits.yaml`

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

## 4.10 `skills/<name>/SKILL.md`

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

## 4.11 `kb/config.yaml`

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

## 4.12 环境变量

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
