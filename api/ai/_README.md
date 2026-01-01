# XingForge AI API 目录

一旦我所属的文件夹有所变化，请更新我。

## 文件清单

| 文件 | 功能 |
|------|------|
| `chat.ts` | 对话 API (多模态支持) |
| `image.ts` | 生图 API (参考图支持) |
| `refine.ts` | 润色 API (多模态分析) |
| `name.ts` | 命名 API (图片视觉分析) |
| `create.ts` | **创造模式 API** (AI 生成星球配置) |

## 路由规则 (内联在各 API 中)

| 代理 | 模型 |
|------|------|
| Jimiai | Claude 系列, GPT 系列, Gemini Chat |
| Xuai | `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`, `gemini-3-pro-preview-thinking`, `gemini-3-pro-image-preview-flatfee` |

## 调用流程

```
灵感模式:
用户输入 → [可选] /refine → 润色结果 → /image → 生成图片 → /name → AI命名

创造模式:
用户选择模块+描述 → /create → AI生成配置 → 验证+归一化 → 返回 patch
```

