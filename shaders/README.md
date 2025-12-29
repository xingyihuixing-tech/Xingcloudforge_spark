# shaders/ 目录说明

一旦我所属的文件夹有所变化，请更新我。

## 定位

- input: 来自组件层传入的 uniforms（AppSettings / NebulaInstance 等驱动）
- output: GLSL 字符串（vertex/fragment shader）供 Three.js ShaderMaterial 使用
- pos: 星云视觉效果的权威实现（颜色补偿、闪烁、海浪、闪电、爆炸/黑洞等）

## 文件列表

- nebulaShaders.ts
  - 地位: 星云粒子系统主 shader（NebulaScene/PlanetScene 共享）
  - 功能: 定义星云点云的 vertex/fragment shader（包含互通模式颜色补偿 uOverlayMode 等）

- nebulaCanvasShaders.ts
  - 地位: Canvas 版星云 shader（用于通过 Canvas 纹理/实例渲染链路）
  - 功能: 与 NebulaScene shader 保持一致的视觉逻辑，提供互通模式颜色补偿与特效 uniforms
