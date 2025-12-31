/**
 * XingForge AI - README
 * 
 * 一旦我所属的文件夹有所变化，请更新我。
 */

# AI 工具模块

## 文件清单

| 文件 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `modelConfig.ts` | 模型常量 & 路由逻辑 | modelId | proxy config |
| `refineTemplates.ts` | 灵感模式润色模板 | 用户描述 | 润色后提示词 |
| `schemaBuilder.ts` | 动态 Schema 生成 | ScopeSelection | JSON Schema |
| `promptBuilder.ts` | System Prompt 构建 | mode + selection | 完整 Prompt |

## 依赖关系

```
promptBuilder.ts
  └─> schemaBuilder.ts
        └─> types.ts (类型引用)

modelConfig.ts (独立)
refineTemplates.ts (独立)
```

## 使用流程

1. 用户选择模式 (灵感/创造/修改)
2. 用户勾选范围 → `schemaBuilder.buildSchemaFromSelection()`
3. 构建 Prompt → `promptBuilder.buildSystemPrompt()`
4. 选择模型 → `modelConfig.getProxyConfig()`
5. 发送请求 → `api/ai/chat.ts`
