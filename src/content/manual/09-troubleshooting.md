---
title: "故障排查"
chapter: "9"
order: 9
slug: "troubleshooting"
kind: "manual-chapter"
sourceFile: "user-manual.md"
---

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

## 看日志

启动日志是最快的诊断入口：

```
[main] config loaded: version=...        配置代际
[main] config notice: ...                 ← 「配了没用」在这里
[main] agent pool: gen=3 entries=4 hits=12 misses=2
[main] inspection: clean=2 pending=1 orphan=0 ownerless=0 skipped=0
[main] hot reload enabled, watching: ...
```

★ `config notice:` 那一行**必须真的打印** —— 它是「配了但没生效」的唯一可见线索。
