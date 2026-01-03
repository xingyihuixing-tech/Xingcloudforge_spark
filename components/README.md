# components/ 目录说明

一旦我所属的文件夹有所变化，请更新我。

## 定位

- input: 来自 App.tsx 的 settings / 数据 / 回调
- output: 渲染与交互组件（星云/星球/手势/控制面板）
- pos: UI 与渲染的核心目录之一，承载“参数编辑 -> 状态更新 -> uniforms 同步”的关键链路

## 文件列表

- ControlPanel.tsx
  - 地位: 参数编辑 UI（星云/星球/互通模式等）
  - 功能: 修改 settings、管理星云实例、预设/导入导出（不包含主题与材质设置）

- UserMenu.tsx
  - 地位: 用户菜单与设置入口
  - 功能: 显示用户信息，提供主题设置、密码修改等弹窗入口

- ThemeSettingsModal.tsx
  - 地位: 主题与材质参数设置中心
  - 功能: 管理配色方案、控制台背景、按钮材质样式（5组+5类）

- NebulaScene.tsx
  - 地位: 星云模式渲染核心
  - 功能: 渲染主星云与多实例星云；同步 shader uniforms；实现特效（闪烁/海浪/闪电等）

- PlanetScene.tsx
  - 地位: 星球与互通模式渲染核心
  - 功能: 渲染星球场景；互通模式下接管星云实例渲染并同步 uniforms

- GestureHandler.tsx
  - 地位: 输入/手势采集与转发
  - 功能: 将手势/交互数据传递给上层状态与渲染组件

- XingSparkSettings.tsx
  - 地位: AI 品牌 XingSpark 的完整设置组件
  - 功能: 管理 Logo 风格/颜色/渐变预设、对话字体、输入框光晕、用户消息气泡样式
  - 导出: XingSparkConfig, DEFAULT_XING_CONFIG, UserMsgConfig, CHAT_FONT_OPTIONS
  - 依赖: lucide-react (Palette, ChevronDown 图标)

- AIAssistantPanel.tsx
  - 地位: AI 交互面板主入口
  - 功能: 灵感模式图片生成、消息渲染、XingSpark 设置集成、模型选择
