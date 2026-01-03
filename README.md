<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Nebula / Planet 可视化（Interop Mode 调试分支）

本项目是一个基于 React + Three.js 的可视化应用：

- **星云模式（NebulaScene）**：从图片生成粒子点云，并叠加多种动态特效。
- **星球模式（PlanetScene）**：渲染星球系统；在 **互通模式（Interop Mode）** 下接管星云实例的渲染与 uniforms 同步。
- **控制面板（ControlPanel）**：统一编辑全局 settings 与星云实例参数。

## 本地运行

**前置条件**：Node.js

1. 安装依赖：
   `npm install`
2. 启动开发：
   `npm run dev`

## 目录结构（权威入口）

- `App.tsx`
  - 地位：应用根组件，负责状态管理/模式切换/参数流。
- `types.ts`
  - 地位：全局类型定义的权威来源（`AppSettings` / `NebulaInstance` 等）。
- `constants.ts`
  - 地位：全局默认值与预设来源（`DEFAULT_SETTINGS` / `DEFAULT_NEBULA_INSTANCE`）。
- `components/`
  - 目录说明：见 `components/README.md`
- `shaders/`
  - 目录说明：见 `shaders/README.md`

## 关键设计：互通模式与实例级特效（方案 A）

为解决互通模式下特效需要切换模式才生效、以及效果作用域不一致的问题，本分支落实了以下策略：

### 1) 互通模式颜色补偿（Overlay Color Compensation）

- shader uniform：`uOverlayMode` 从布尔开关升级为 `0..1` 的强度。
- 全局参数：`AppSettings.overlayColorCompensation`（默认 `1.0`）。

### 2) 实例级特效参数（保存到单个实例）

核心原则（方案 A）：

- 渲染层对每个实例：**优先读取 `NebulaInstance` 的实例字段**；
- 若实例缺少字段（兼容旧数据），才 fallback 到全局 `AppSettings` 默认值。

当前已实例化的特效字段包括：

- `flickerEnabled / flickerIntensity / flickerSpeed`
- `waveEnabled / waveIntensity / waveSpeed / waveSteepness / waveLayers / waveDirection / waveDepthFade / waveFoam`
- `wanderingLightningEnabled / wanderingLightningIntensity / wanderingLightningSpeed / wanderingLightningDensity / wanderingLightningWidth`
- `lightningBreakdownEnabled / lightningBreakdownIntensity / lightningBreakdownFrequency / lightningBreakdownBranches`

控制面板行为：

- 上述特效在 UI 中 **必须选中实例才允许编辑**，以保证“所有效果保存到单个实例”。

