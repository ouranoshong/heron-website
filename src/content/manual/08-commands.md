---
title: "命令速查"
chapter: "8"
order: 8
slug: "commands"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

## 8.1 heron 子命令

```bash
heron                       # 启动服务（默认 :8080）
heron init [flags]          # 在当前目录建最小可运行的项目级配置
heron kb index [files...]   # 建知识库索引
heron kb search <query>     # 手动检索
heron kb status [--json]    # 看索引现状
```

## 8.2 make 目标

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

## 8.3 常用环境变量

```bash
LISTEN_ADDR=":9090"                  # 换端口
HERON_CONFIG_DIR=~/.heron            # 指定用户级配置目录
PROJECT_ROOT=/path/to/project        # 指定项目根
DATA_DIR=/path/to/state              # 指定运行数据目录
FRONTEND_MODE=dir STATIC_DIR=web/dist # 开发时用磁盘目录而不是嵌入资源
```
