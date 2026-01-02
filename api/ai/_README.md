# XingForge AI API 目录

一旦我所属的文件夹有所变化，请更新我。

## 文件清单

| 文件 | 功能 |
|------|------|
| `chat.ts` | 对话 API (多模态支持) |
| `image.ts` | 生图 API (参考图支持) |
| `refine.ts` | 润色 API (多模态分析) |
| `name.ts` | 命名 API (图片视觉分析) |

## 路由规则 (双 Key 路由)

| 模型组 | 环境变量 | 模型 |
|--------|----------|------|
| Claude | `JIMIAI_API_KEY_CLAUDE` | opus, sonnet, sonnet-thinking, haiku |
| Gemini Chat | `JIMIAI_API_KEY_GEMINI` | gemini-3-flash-preview, gemini-3-pro-preview |
| Xuai (生图) | `IMAGE_API_KEY` | gemini-3-pro-image-preview 等 |

## 环境变量

| 变量名 | 用途 |
|--------|------|
| `CHAT_PROXY_BASE_URL` | Jimiai 代理地址 |
| `JIMIAI_API_KEY_CLAUDE` | Claude 系列 Key |
| `JIMIAI_API_KEY_GEMINI` | Gemini Chat Key |
| `IMAGE_PROXY_BASE_URL` | Xuai 代理地址 |
| `IMAGE_API_KEY` | Xuai 生图 Key |

## 调用流程

```
灵感模式:
用户输入 → [可选] /refine → 润色结果 → /image → 生成图片 → /name → AI命名
```
