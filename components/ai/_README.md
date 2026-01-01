/**
 * XingForge AI - AI Components README
 * 
 * 一旦我所属的文件夹有所变化，请更新我。
 */

# AI 组件模块

## 文件清单

| 文件 | 功能 |
|------|------|
| `CreatorModePanel.tsx` | **创造模式面板** (简化版, 阶段1) |
| `ScopeSelector.tsx` | 范围选择器 (11种效果, 多实例, 字段约束) - 旧版 |
| `PlanetSelector.tsx` | 星球选择器 (修改模式) |
| `AIAssistantPanel.tsx` → 主入口 (位于 `components/` 根目录) |

## 依赖关系

```
AIAssistantPanel.tsx (主入口)
  ├─> CreatorModePanel.tsx (创造模式)
  ├─> ScopeSelector.tsx (旧版, 保留兼容)
  ├─> PlanetSelector.tsx (修改模式)
  └─> utils/ai/*.ts (工具函数)
```

