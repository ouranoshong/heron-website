---
title: "五分钟快速上手"
chapter: "2"
order: 2
slug: "quickstart"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

## 2.1 前置

| 需要 | 版本 | 备注 |
|---|---|---|
| Go | 1.27.1+ | 只改 Go 代码时可以只跑后端构建 |
| bun | 1.3+ | 构建前端要用 |
| 一个 OpenAI 兼容端点 | —— | DeepSeek、Kimi、通义、vLLM、Ollama 等都行，只要兼容 `/chat/completions` |

## 2.2 构建与安装

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
详见 developer-manual.md §2.2.2。其余功能不受影响。

## 2.3 装完还差一步：配置

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

## 2.4 生成配置

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

## 2.5 设置密钥

密钥**只从环境变量读**，不写进文件（文件里只放引用）：

```bash
export DEEPSEEK_API_KEY=sk-...
```

> ★ 出厂默认的端点是 **deepseek**，所以环境变量名是 `DEEPSEEK_API_KEY`。
> 用了别的 provider 就换对应那个（`--env` 也能在 `heron init` 时直接指定）。

也可以写成 `@file:/path/to/key`。**不要把密钥直接写进 yaml** —— 那个文件通常要进版本库。

> 密钥没设**不会**阻塞启动，只在启动日志里记一条提醒。等到真正请求那个端点时才返回 401。

## 2.6 启动

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

## 2.7 试一句

在左侧点 **New thread**，输入框里问一句，比如「列出这个仓库的顶层目录」。

三件事应该同时发生：

1. 状态点变成 **Running**（蓝色脉动）；
2. 消息逐条流式出现（工具调用会展开成可折叠的卡片）；
3. 结束后状态点回到 **Idle**。
