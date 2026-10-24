---
title: "知识库"
chapter: "6"
order: 6
slug: "knowledge-base"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

知识库让你的私有语料（设计文档、规范、笔记）能被 agent 检索并引用。

## 6.1 开启

1. 在 `.heron/kb/config.yaml` 里配 `corpus`（相对项目根）与 `model`（可选）。
2. 建索引：

```bash
heron kb index          # 全量索引（几百个文件是十分钟量级）
heron kb status         # 看索引现状，不需要向量化服务在跑
heron kb search "怎么配审批"   # 手动搜一把
```

`heron kb index` 是**独立的子命令**，不会起服务进程 —— 全量索引时端口不会被占着。

## 6.2 agent 怎么用

配好之后，agent 会拿到两个工具：

| 工具 | 作用 | 默认档位 |
|---|---|---|
| `kb_search` | 检索语料，返回文档与出处 | 放行（只读） |
| `kb_index` | 把语料写进索引 | **需要审批**（写操作） |

没配 `corpus` 就**一个工具都不挂** —— 挂一个永远召回不到东西的 `kb_search` 比不挂更糟。

## 6.3 换模型

换了 embedding 模型，旧向量还在库里 —— 跨模型检索给出的是**看起来正常的错结果**。
所以 `heron kb index` 会在建索引前做身份比对，发现不匹配直接报错，让你重建。
