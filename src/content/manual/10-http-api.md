---
title: "附录：HTTP 接口"
chapter: "10"
order: 10
slug: "http-api"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

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

**相关文档**：developer-manual.md（想改 heron 本身看这份）· architecture.md · config-design.md ·
api-v2-design.md · frontend-design.md ·
agent-design.md · multi-agent-design.md ·
kb-design.md · init-design.md
