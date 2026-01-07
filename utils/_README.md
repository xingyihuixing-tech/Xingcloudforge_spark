# utils/ 目录说明

一旦我所属的文件夹有所变化，请更新我。

## 定位

- input: 各组件（NebulaScene/PlanetScene/MagicCircleDrawing）传入的 settings、数据与运行时状态
- output: 可复用的工具函数（渲染辅助、绘图系统、存储、配置归一化等）
- pos: 非 UI 的核心能力层，承载“参数 -> 渲染/几何/数据处理”的公共逻辑

## 文件列表

- drawingSystem.ts
  - 地位: 自定义法阵绘图系统工具集
  - 功能: 创建绘图用 Three.js 场景；将笔画渲染为粒子/丝环 mesh；粒子笔按弧长密度生成并支持压感模式（无/书法/亮度，密度范围100-800）；丝环画笔支持压感模式（无/书法/亮度，书法/亮度为分段生效）

- normalizePlanetSettings.ts
  - 地位: 星球 settings 归一化
  - 功能: 兼容旧数据并补齐默认值，保证渲染侧读取稳定

- shapeTextureAtlas.ts
  - 地位: 形状贴图/纹理图集工具
  - 功能: 提供形状纹理相关的生成与缓存能力

- storage.ts
  - 地位: 本地存储工具
  - 功能: localStorage 相关封装

- materialStyle.ts
  - 地位: 材质样式工具
  - 功能: 主题/材质相关的样式辅助

- ai/
  - 目录说明: 见 `utils/ai/_README.md`
