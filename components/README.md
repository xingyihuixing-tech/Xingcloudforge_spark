# components/ 目录说明

一旦我所属的文件夹有所变化，请更新我。

## 定位

- input: 来自 App.tsx 的 settings / 数据 / 回调
- output: 渲染与交互组件（星云/星球/手势/控制面板）
- pos: UI 与渲染的核心目录之一，承载“参数编辑 -> 状态更新 -> uniforms 同步”的关键链路

## 文件列表

- ControlPanel.tsx
  - 地位: 参数编辑 UI（星云/星球/互通模式等）
  - 功能: 修改 settings、管理星云实例、预设/导入导出

- NebulaScene.tsx
  - 地位: 星云模式渲染核心
  - 功能: 渲染主星云与多实例星云；同步 shader uniforms；实现特效（闪烁/海浪/闪电等）

- PlanetScene.tsx
  - 地位: 星球与互通模式渲染核心
  - 功能: 渲染星球场景；互通模式下接管星云实例渲染并同步 uniforms

- GestureHandler.tsx
  - 地位: 输入/手势采集与转发
  - 功能: 将手势/交互数据传递给上层状态与渲染组件
