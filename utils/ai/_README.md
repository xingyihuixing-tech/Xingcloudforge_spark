# XingForge AI Utilities

一旦我所属的文件夹有所变化，请更新我。

## 文件清单

| 文件 | 功能 |
|------|------|
| `modelConfig.ts` | 模型常量与路由逻辑 (唯一真理源) |
| `schemaBuilder.ts` | 11种效果类型 Schema 生成 |
| `promptBuilder.ts` | System Prompt 构建 |
| `refineTemplates.ts` | 灵感模式润色模板 |
| `configMerger.ts` | AI输出→PlanetSettings 转换 |
| `validator.ts` | JSON提取/校验/AutoFix |

## 数据流

```
用户输入 → promptBuilder → AI API → validator.extractJSON
                                         ↓
                                   validateAIOutput
                                         ↓
                              configMerger.convertAIOutputToPlanet
                                         ↓
                                   PlanetSettings (完整)
```

## 路由规则

- **Jimiai**: Claude系列, Gemini 3 Pro (非image)
- **Xuai**: Gemini Image系列, Gemini Thinking
