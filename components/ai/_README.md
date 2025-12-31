/**
 * XingForge AI - AI Components README
 * 
 * 一旦我所属的文件夹有所变化，请更新我。
 */

# AI 组件模块

## 文件清单

| 文件 | 功能 |
|------|------|
| `ScopeSelector.tsx` | 范围选择器 (11种效果, 多实例, 字段约束) |
| `PlanetSelector.tsx` | 星球选择器 (修改模式) |
| `AIAssistantPanel.tsx` → 主入口 (位于 `components/` 根目录) |

## 依赖关系

```
AIAssistantPanel.tsx (主入口)
  ├─> ScopeSelector.tsx
  ├─> PlanetSelector.tsx
  └─> utils/ai/*.ts (工具函数)
```
