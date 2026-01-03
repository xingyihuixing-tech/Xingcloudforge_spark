# components/draw - 绘图系统 (Dimension Crafter) V2

> 一旦我所属的文件夹有所变化，请更新我。

## 模块概述
这是全新重构的绘图系统，支持多种墨迹样式和 2D/3D 对称模式。

## 文件清单

| 文件名 | 地位 | 功能 |
|--------|------|------|
| `SymmetryEngine.ts` | 核心引擎 | 对称计算引擎，包含完整的 2D/3D 对称变换算法 |
| `DrawingManager.ts` | 核心管理 | 管理 Drawing/Layer/Stroke 状态，提供 CRUD 操作 |
| `HoloPad.tsx` | UI 组件 | 2D 画布，捕获用户输入，实时渲染墨迹效果 |
| `Ink2DRenderer.ts` | 渲染器 | 6种笔刷在 Canvas 2D 上的可视化效果 |
| `InkShaders.ts` | 着色器 | 6种墨迹类型的 GLSL 顶点/片段着色器（3D） |
| `InkRenderer.ts` | 渲染器 | 将笔触数据转换为 Three.js 粒子系统（3D） |
| `_README.md` | 文档 | 目录结构说明（本文件） |

## 渲染策略
- **2D 渲染（主要）**：`Ink2DRenderer.ts` 直接在 HoloPad 的 Canvas 上渲染可见效果
- **3D 渲染（可选）**：`InkRenderer.ts` + `InkShaders.ts` 用于 PlanetScene 中的粒子效果

## 依赖关系
- `../../types.ts` - 类型定义
- `../../constants.ts` - 默认值和工厂函数
- `three` - 3D 数学和渲染库
