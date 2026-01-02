# XingForge AI Utilities

一旦我所属的文件夹有所变化，请更新我。

## 文件清单

| 文件 | 功能 | 状态 |
|------|------|------|
| `modelConfig.ts` | 模型常量与路由逻辑 (唯一真理源) | ✅ 灵感模式使用 |
| `refineTemplates.ts` | 灵感模式润色模板 | ✅ 灵感模式使用 |
| `schemaBuilder.ts` | 11种效果类型 Schema 生成 | ⚠️ 暂保留 |
| `promptBuilder.ts` | System Prompt 构建 | ⚠️ 暂保留 |
| `configMerger.ts` | AI输出→PlanetSettings 转换 | ⚠️ 暂保留 |
| `validator.ts` | JSON提取/校验/AutoFix | ⚠️ 暂保留 |
| `moduleRules.ts` | 模块依赖/互斥规则定义 | ⚠️ 暂保留 |
| `styleExamples.ts` | 风格锚点示例 | ⚠️ 暂保留 |
| `kbBuilder.ts` | KB 组装器 | ⚠️ 暂保留 |
| `configValidator.ts` | 配置验证+归一化 | ⚠️ 暂保留 |
| `patchApplier.ts` | Patch→PlanetSettings 适配器 | ⚠️ 暂保留 |
| `serverDefaults.ts` | 服务端默认值 (No-Browser) | ⚠️ 暂保留 |

> ⚠️ 标记"暂保留"的文件原为创造模式使用，创造模式已移除（2026-01-02），这些文件当前未被引用，后续可清理。

## 路由规则

- **Jimiai**: Claude系列, Gemini 3 Pro (非image)
- **Xuai**: Gemini Image系列, Gemini Thinking
