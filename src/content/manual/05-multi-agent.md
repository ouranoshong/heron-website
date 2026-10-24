---
title: "多 agent 与委派"
chapter: "5"
order: 5
slug: "multi-agent"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

## 5.1 怎么声明

在 `agents/main.md` 的 frontmatter 里写 `subagents: [researcher, coder]`。

**子 agent 与其它 agent 是同一种东西** —— 差别只是文件名。它们各自：

- 拥有自己的 `model:`、`disabled_tools:`、提示词；
- 被**逐个装配**自己的审批与工具过滤中间件（不能指望父 agent 传播）；
- 在 `max_depth` 允许范围内递归展开。

## 5.2 深度上限

`server/config.yaml` 的 `agent.max_depth`：入口 agent 是**第 0 层**，深度 d 的 agent
允许再生子 agent 当且仅当 `d < max_depth`。

- `max_depth: 1` = 只有入口 agent 能委派（默认）；
- `max_depth: 2` = 入口的子 agent 还能再往下委派。

声明的拓扑超出上限时**启动期报错**，不会被静默截断。

## 5.3 并行委派

**互不依赖**的任务可以一条消息里发多个 task 调用，让它们同时跑：

- 「A 模块和 B 模块各自实现一下」→ 两个 `coder` 并行；
- 「先查 A 的实现，再查 B 的实现」→ 两个 `researcher` 并行（都只读，不互相踩）；
- 「改完之后审一遍」→ **串行**，`reviewer` 必须等 `coder` 改完。

★ 并行只对**互不依赖**的任务成立。前一步的输出是后一步的输入时，并行只会拿到
一堆基于旧世界的结论。

★ 多个子 agent 同时要人批准时，会**同时**弹出几张审批卡，子 agent 发的那些会标出
**是谁**要的（「Requested by coder」）—— 把它们**一起**答掉。

## 5.4 出厂样例的四个角色

| 角色 | 干什么 | 能写文件吗 |
|---|---|---|
| `main` | 编排：分派、汇总 | 否 |
| `researcher` | 只读检索：定位实现、追调用链 | 否 |
| `coder` | 按结论改文件、跑测试 | **能** |
| `reviewer` | 读改动、挑问题 | 否 |

「谁能写」靠**两层**控制，缺一不可：外层 `policy/permissions.yaml` 的 `deny`（谁都别想用）
＋ 内层各 agent 自己的 `disabled_tools`（只影响这一个）。
