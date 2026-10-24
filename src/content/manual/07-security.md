---
title: "安全与审批模型"
chapter: "7"
order: 7
slug: "security"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

## 7.1 工具档位

| 档位 | 含义 |
|---|---|
| `allow` | 直接放行（**兜底档**） |
| `ask` | 每次执行前挂起，等人批准 |
| `deny` | 不可用 |

判定顺序：**`deny` → `ask` → 兜底 `allow`**。

## 7.2 谁能用什么（分层工具表）

| 层 | 作用 | 跨 agent |
|---|---|---|
| 外层 `policy/permissions.yaml` 的 `deny` | 全局禁令 | 谁都别想用，子 agent 无法放松 |
| 外层 `policy/permissions.yaml` 的 `ask` | 需要点头 | 所有 agent 都一样 |
| 内层 agent 的 `disabled_tools` | 收窄某一个 agent | 只影响它自己 |
| `tools:` 段的启用 | 工具**存不存在** | 不开 = 工具根本不存在 |

★ 两层是**分层保存，永不合并** —— 合并就丢掉了「谁在外层」，而那是子 agent
不能越权加回被禁工具的唯一保证。

## 7.3 启用的内置工具

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

## 7.4 审批的几个边界情况

- **拒绝最好给理由** —— 理由会回灌给模型，它据此改路；没有理由的拒绝对模型等于凭空断路。
  ★ 但这**不是硬约束**：服务端允许空理由，界面也不拦（留空照样能拒）。
- **多个审批一起答** —— 逐个答的话，答完第一个其余会带着新 id 重新中断。
- **重启后审批会丢** —— 启动巡检会发现「有 checkpoint 但没有 pending 审批」的会话，
  日志里会报 `ownerless`，那些会话**无法恢复**，需要重新提问。
