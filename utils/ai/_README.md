# XingForge AI Utilities

一旦我所属的文件夹有所变化，请更新我。

## 文件清单

| 文件 | 功能 |
|------|------|
| `modelConfig.ts` | 模型常量与路由逻辑 (唯一真理源) |
| `schemaBuilder.ts` | 11种效果类型 Schema 生成 |
| `promptBuilder.ts` | System Prompt 构建 |
| `refineTemplates.ts` | 灵感模式润色模板 |
| `configMerger.ts` | AI输出→PlanetSettings 转换 (旧) |
| `validator.ts` | JSON提取/校验/AutoFix (旧) |
| **`moduleRules.ts`** | 模块依赖/互斥规则定义 (**新**) |
| **`styleExamples.ts`** | 风格锚点示例 (**新**) |
| **`kbBuilder.ts`** | KB 组装器 (**新**) |
| **`configValidator.ts`** | 配置验证+归一化 (**新**) |
| **`patchApplier.ts`** | Patch→PlanetSettings 适配器 (**新**) |

## 数据流 (创造模式 v2)

```
用户选择模块 + 描述
        ↓
kbBuilder.buildKnowledgeSnippet() → System Prompt
        ↓
api/ai/create.ts → Claude API
        ↓
configValidator.validateAndNormalize() → normalizedPatch + warnings
        ↓
patchApplier.applyEffectPatchToPlanet() → PlanetSettings
```

## 路由规则

- **Jimiai**: Claude系列, Gemini 3 Pro (非image)
- **Xuai**: Gemini Image系列, Gemini Thinking

