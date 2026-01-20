# MagicCircleDrawing 文件夹架构

> 一旦我所属的文件夹有所变化，请更新我。

## 文件列表

| 文件名 | 地位 | 功能 |
|--------|------|------|
| `index.tsx` | 主入口 | DrawingCanvasOverlay 组件，提供 3D 绘图画布覆盖层，包含画笔工具面板、对称控制、图层管理、撤销重做；支持粒子/丝环/光剑/网格四种画笔，均支持对称模式参数(symmetryParams)；图层自转使用真实 deltaTime（避免 iPad 低帧率下角度跳变） |
| `DrawingControlPanel.tsx` | 右侧面板 | 绘图模式控制面板，包含可折叠法阵列表、对称模式按钮(竖向换行布局)、分割数滑块、高级对称参数滑块(星芒/漩涡/球面/轨道环) |
| `BrushToolPanel.tsx` | 左侧面板 | 画笔工具面板，包含画笔类型选择、颜色控制、画笔参数调整、预设管理 |
| `Icons.tsx` | 图标集 | 绘图模式使用的所有 SVG 图标组件 |

## 依赖关系

- 依赖 `../../utils/drawingSystem.ts` 提供的绘图核心功能(含对称变换函数)
- 依赖 `../../types.ts` 中的 CustomMagicCircle、SymmetryMode、SymmetryParams 等类型
- 接收来自 App.tsx 的 customMagicCircles 状态和 renderer 实例

## 导出

- `DrawingCanvasOverlay` - 主绘图覆盖层组件
- `default` - 同上
