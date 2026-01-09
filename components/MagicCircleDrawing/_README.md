# MagicCircleDrawing 文件夹架构

> 一旦我所属的文件夹有所变化，请更新我。

## 文件列表

| 文件名 | 地位 | 功能 |
|--------|------|------|
| `index.tsx` | 主入口 | DrawingCanvasOverlay 组件，提供 3D 绘图画布覆盖层，包含画笔工具面板、对称控制、图层管理、撤销重做；粒子画笔支持按弧长密度生成与压感模式（无/书法/亮度，密度范围100-800）；丝环画笔支持压感模式（无/书法/亮度，书法/亮度为分段生效）；光剑画笔支持发光笔迹绘制 |

## 依赖关系

- 依赖 `../../utils/drawingSystem.ts` 提供的绘图核心功能
- 依赖 `../../types.ts` 中的 CustomMagicCircle、MagicCircleStroke 等类型
- 接收来自 App.tsx 的 customMagicCircles 状态和 renderer 实例

## 导出

- `DrawingCanvasOverlay` - 主绘图覆盖层组件
- `default` - 同上
