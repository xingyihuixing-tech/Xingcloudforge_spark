# MagicCircleDrawing 组件架构

一旦本文件夹有所变化，请更新我。

## 文件结构

| 文件 | 功能 |
|------|------|
| `index.tsx` | 主入口组件，管理状态和UI面板 |
| `DrawingRenderer.ts` | Three.js 3D渲染器，正交相机画布 |
| `_README.md` | 本文件 |

## 组件关系

```
App.tsx
  └── MagicCircleDrawing/index.tsx
        ├── DrawingRenderer (Three.js 渲染)
        │     ├── 正交相机 XY 平面
        │     ├── 中心点十字线
        │     ├── 对称轴虚线
        │     ├── 粒子笔画 (THREE.Points)
        │     └── 线环笔画 (THREE.Line)
        └── UI 面板
              ├── 左侧画笔工具面板
              └── 底部控制面板 (对称/图层/撤销)
```

## 数据流

1. 用户绘制 → 生成 StrokePoint[]
2. StrokePoint[] → DrawingRenderer 创建 3D 对象
3. 保存 → 生成 thumbnail → 更新 customMagicCircles
4. Cloud sync → 持久化到云端
