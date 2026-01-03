/**
 * input: 全局类型定义（渲染/设置/数据结构）
 * output: 导出 TS 类型与枚举（AppSettings/NebulaInstance 等）
 * pos: 全项目类型的权威来源，影响 UI -> 状态 -> 渲染 的参数流
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

export enum DepthMode {
  Brightness = 'Brightness',
  Hue = 'Hue',
  Saturation = 'Saturation',
  Perlin = 'Perlin',
  Radial = 'Radial',
  Layered = 'Layered',
  // New modes
  Emboss = 'Emboss',           // 浮雕效果
  Stereo = 'Stereo',           // 双眼视差
  FBM = 'FBM',                 // 分形噪声
  Wave = 'Wave'                // 波浪
}

// 颜色过滤
export interface ColorFilter {
  id: string;
  hueStart: number;    // 0-360
  hueEnd: number;      // 0-360
  enabled: boolean;
}

export interface ColorFilterSettings {
  enabled: boolean;
  filters: ColorFilter[];
  invertMode: boolean;  // true = 只保留选中颜色, false = 排除选中颜色
  saturationMin: number; // 最小饱和度阈值 0-1
  saturationMax: number; // 最大饱和度阈值 0-1
}

// 颜色过滤预设
export type ColorFilterPreset =
  | 'none'
  | 'excludeGreen'      // 排除绿幕
  | 'excludeBlue'       // 排除蓝色
  | 'warmOnly'          // 只保留暖色
  | 'coolOnly'          // 只保留冷色
  | 'excludeSkin'       // 排除肤色
  | 'redOnly'           // 只保留红色
  | 'excludeGray'       // 排除灰色/白色
  | 'highContrast';     // 高对比度

// 连线系统
export enum LineMode {
  Distance = 'distance',   // 基于距离
  Color = 'color',         // 基于颜色相近
  KNN = 'knn',             // K近邻
  Delaunay = 'delaunay'    // Delaunay 三角剖分网格
}

export enum LineStyle {
  Solid = 'solid',         // 实线
  Dashed = 'dashed'        // 虚线
}

// 连线渐变色模式
export enum LineGradientMode {
  Fixed = 'fixed',           // 固定渐变（基于位置）
  ParticleColor = 'particle' // 基于两端粒子颜色渐变
}

export enum LineColorMode {
  Inherit = 'inherit',     // 继承粒子颜色
  Gradient = 'gradient',   // 渐变
  Custom = 'custom'        // 自定义颜色
}

export enum LineRenderMode {
  Dynamic = 'dynamic',     // GPU动态连线
  Static = 'static'        // CPU静态连线
}

// 连线距离区间
export interface DistanceRange {
  id: string;
  min: number;
  max: number;
  enabled: boolean;
}

export interface LineSettings {
  enabled: boolean;
  renderMode: LineRenderMode;
  mode: LineMode;

  // 距离区间（替代单一 maxDistance）
  distanceRanges: DistanceRange[];
  maxDistance: number; // 保留兼容

  // K近邻模式参数
  kNeighbors: number;

  // 颜色模式参数
  colorThreshold: number;

  // === 结构感知约束 ===
  // 颜色约束（跨模式通用）
  colorConstraintEnabled: boolean;  // 是否启用颜色约束
  colorTolerance: number;           // 颜色容差 0-1 (越小越严格)

  // 每粒子连接数限制
  maxConnectionsPerParticle: number; // 每个粒子最多连接数 (0=不限制)

  // Z轴深度权重
  zDepthWeight: number;              // Z轴在距离计算中的权重 0-2 (0=忽略Z轴, 1=正常, 2=加倍)

  // 外观
  lineWidth: number;
  lineStyle: LineStyle;
  lineColorMode: LineColorMode;
  customColor: string;
  opacity: number;
  fadeWithDistance: boolean;

  // 渐变色设置
  gradientColorStart: string;   // 渐变起始颜色
  gradientColorEnd: string;     // 渐变结束颜色
  gradientIntensity: number;    // 渐变强度 0-1 (0=纯继承, 1=纯渐变)
  gradientMode: LineGradientMode; // 渐变模式

  // 粒子大小过滤
  sizeFilterEnabled: boolean;     // 是否启用粒子大小过滤
  minSizeAbsolute: number;        // 绝对最小粒子大小 0-1
  minSizeRelative: number;        // 相对最小粒子大小（相对于最大粒子）0-1
  minSizePercentile: number;      // 百分位过滤：过滤最小的前X% 0-50

  // 性能控制
  maxLines: number;
  sampleRatio: number;  // 参与连线的粒子比例 0-1
}

export enum ParticleShape {
  Circle = 'Circle',
  Star = 'Star',
  Snowflake = 'Snowflake',
  Heart = 'Heart',           // 爱心
  Crescent = 'Crescent',     // 月牙
  CrossGlow = 'CrossGlow',   // 十字光芒
  Sakura = 'Sakura',         // 樱花
  Sun = 'Sun',               // 太阳
  Sun2 = 'Sun2',             // 太阳2（圆弧光芒）
  Plum = 'Plum',             // 梅花
  Lily = 'Lily',             // 百合
  Lotus = 'Lotus',           // 莲花
  Prism = 'Prism'            // 棱镜晶体
}

// 粒子光晕模式
export enum GlowMode {
  None = 'none',             // 无光晕
  Soft = 'soft',             // 柔和光晕（当前 smoothstep）
  Sharp = 'sharp',           // 锐利光晕（指数衰减）
  Aura = 'aura'              // 光环效果
}

// 星云混合模式（互通模式下）
export enum NebulaBlendMode {
  Additive = 'additive',     // 叠加发光
  Normal = 'normal'          // 普通混合
}

// 吸积盘层配置
export interface AccretionLayer {
  id: string;
  enabled: boolean;
  radiusMax: number;         // 该层外边界半径 (像素)
  direction: 1 | -1;         // 1=顺时针, -1=逆时针
  speedMultiplier: number;   // 速度倍数 0.1-3
}

// 染色效果 - 主色调映射
export interface ColorTintMapping {
  sourceHue: number;         // 原主色调色相 0-360
  sourceColor: string;       // 原主色调颜色 (hex)
  targetColor: string;       // 目标颜色 (hex)
  hueSpread: number;         // 色差缩放 0-2 (1=保持原差异)
  percentage: number;        // 该主色调占比 0-100
}

export interface ColorTintSettings {
  enabled: boolean;
  colorCount: number;        // 主色调数量 2-6
  mappings: ColorTintMapping[];  // 主色调映射配置
  globalStrength: number;    // 全局混合强度 0-1
}

// ==================== 星云实例类型 ====================
export interface NebulaInstance {
  id: string;
  name: string;
  enabled: boolean;
  imageUrl: string;           // 图片URL
  imageDataUrl?: string;      // 图片base64数据
  position: { x: number; y: number; z: number };
  scale: number;              // 整体缩放 0.1-5
  // 粒子生成参数
  density: number;            // 采样步长
  threshold: number;          // 亮度阈值
  brightness: number;
  opacity: number;
  baseSize: number;
  colorSaturation: number;
  // 轮廓优先采样
  edgeSamplingEnabled: boolean;
  edgeSensitivity: number;
  edgeDensityBoost: number;
  fillDensity: number;
  pureOutlineMode: boolean;
  // 3D深度映射
  depthMode: DepthMode;
  depthRange: number;
  depthInvert: boolean;
  noiseStrength: number;
  waveFrequency: number;
  waveAmplitude: number;
  fbmOctaves: number;
  stereoSeparation: number;
  // 几何映射
  geometryMapping: 'none' | 'sphere' | 'cylinder';
  mappingStrength: number;
  mappingRadius: number;
  mappingTileX: number;
  mappingTileY: number;
  mappingEdgeFade: number;      // 边缘淡化强度 0-0.5
  // 粒子动态效果
  particleTurbulence: number;
  turbulenceSpeed: number;
  turbulenceScale: number;
  // 动态效果
  breathingEnabled: boolean;
  breathingSpeed: number;
  breathingIntensity: number;
  rippleEnabled: boolean;
  rippleSpeed: number;
  rippleIntensity: number;
  accretionEnabled: boolean;
  accretionSpeed: number;
  accretionIntensity: number;
  accretionLayers: AccretionLayer[];  // 吸积盘层配置（最多3层）
  flickerEnabled: boolean;
  flickerIntensity: number;
  flickerSpeed: number;

  // 真实海浪效果（实例级）
  waveEnabled: boolean;
  waveIntensity: number;
  waveSpeed: number;
  waveSteepness: number;
  waveLayers: number;
  waveDirection: number;
  waveDepthFade: number;
  waveFoam: boolean;

  // 游走闪电效果（实例级）
  wanderingLightningEnabled: boolean;
  wanderingLightningIntensity: number;
  wanderingLightningSpeed: number;
  wanderingLightningDensity: number;
  wanderingLightningWidth: number;

  // 闪电击穿效果（实例级）
  lightningBreakdownEnabled: boolean;
  lightningBreakdownIntensity: number;
  lightningBreakdownFrequency: number;
  lightningBreakdownBranches: number;

  // 数据版本（用于检测参数变化触发重新生成）
  dataVersion?: number;
}

export interface AppSettings {
  // Particle Generation
  density: number; // 1 to 10 step
  threshold: number; // 0-255
  maxParticles: number;
  baseSize: number;
  brightness: number; // 亮度 0.1-3
  opacity: number; // 透明度 0.1-1

  // 多星云实例
  nebulaInstances: NebulaInstance[];
  selectedNebulaId: string | null;

  // Edge-priority sampling (轮廓优先采样)
  edgeSamplingEnabled: boolean;    // 启用边缘优先采样
  edgeSensitivity: number;         // 边缘检测灵敏度 0-1
  edgeDensityBoost: number;        // 边缘区域密度提升倍数
  fillDensity: number;             // 内部填充密度 0-1 (0=纯轮廓)
  pureOutlineMode: boolean;        // 纯轮廓模式（只在边缘生成粒子）

  // 边缘裁剪（忽略图像边缘噪声）
  edgeCropPercent: number;         // 边缘裁剪比例 0-20%
  circularCrop: boolean;           // 圆形裁剪模式

  // 粒子动态效果
  particleTurbulence: number;      // 粒子扰动强度 0-1
  turbulenceSpeed: number;         // 扰动速度 0-2
  turbulenceScale: number;         // 扰动尺度 0.1-2

  // Color Filter
  colorFilter: ColorFilterSettings;

  // Color Tint (染色效果)
  colorTint: ColorTintSettings;

  // Depth Mapping
  depthMode: DepthMode;
  depthRange: number;
  depthInvert: boolean;
  noiseStrength: number; // For Perlin/FBM

  // New depth mode parameters
  waveFrequency: number;    // 波浪频率
  waveAmplitude: number;    // 波浪振幅
  fbmOctaves: number;       // 分形噪声层数
  stereoSeparation: number; // 双眼视差分离度

  // Visuals
  bloomStrength: number;
  particleShape: ParticleShape;
  colorSaturation: number;

  // 光晕效果
  glowMode: GlowMode;
  glowIntensity: number;      // 光晕强度 1-20

  // 高级动态效果
  breathingEnabled: boolean;   // 呼吸效果
  breathingSpeed: number;      // 呼吸速度 0.1-2
  breathingIntensity: number;  // 呼吸强度 0-0.5

  rippleEnabled: boolean;      // 涟漪效果
  rippleSpeed: number;         // 涟漪速度 0.1-2
  rippleIntensity: number;     // 涟漪强度 0-50

  accretionEnabled: boolean;   // 吸积盘旋转效果
  accretionSpeed: number;      // 基础旋转速度 0.1-2
  accretionIntensity: number;  // 旋转强度 0-1
  accretionLayers: AccretionLayer[];  // 吸积盘层配置（最多3层）

  // 拖尾残影
  trailEnabled: boolean;       // 启用拖尾
  trailLength: number;         // 拖尾长度 0.1-1.0
  trailDecay: number;          // 拖尾衰减 0.1-1.0

  // 荧光闪烁
  flickerEnabled: boolean;     // 启用闪烁
  flickerIntensity: number;    // 闪烁强度 0-1
  flickerSpeed: number;        // 闪烁速度 0.5-5

  // 真实海浪效果（Gerstner波）
  waveEnabled: boolean;        // 启用海浪
  waveIntensity: number;       // 海浪振幅 0-100
  waveSpeed: number;           // 海浪速度 0.1-3
  waveSteepness: number;       // 波浪陡度 0-1 (0=正弦, 1=尖峰)
  waveLayers: number;          // 波浪层数 1-4
  waveDirection: number;       // 主波方向角度 0-360
  waveDepthFade: number;       // 深度衰减 0-1
  waveFoam: boolean;           // 波峰泡沫效果

  // 几何映射
  geometryMapping: 'none' | 'sphere' | 'cylinder';  // 映射模式
  mappingStrength: number;     // 映射强度 0-1 (0=平面, 1=完全映射)
  mappingRadius: number;       // 球体/圆柱半径 50-500
  mappingTileX: number;        // 水平拼接数 1-8
  mappingTileY: number;        // 垂直拼接数 1-4
  mappingEdgeFade: number;     // 边缘淡化强度 0-0.5

  // 游走闪电效果
  wanderingLightningEnabled: boolean;  // 启用游走闪电
  wanderingLightningIntensity: number; // 闪电强度 0-1
  wanderingLightningSpeed: number;     // 游走速度 0.1-3
  wanderingLightningDensity: number;   // 闪电密度 1-10
  wanderingLightningWidth: number;     // 闪电宽度 1-20

  // 闪电击穿效果
  lightningBreakdownEnabled: boolean;  // 启用闪电击穿
  lightningBreakdownIntensity: number; // 击穿强度 0-1
  lightningBreakdownFrequency: number; // 击穿频率 0.1-2
  lightningBreakdownBranches: number;  // 分支数量 0-5

  // Physics / Interaction
  interactionRadius: number;
  interactionStrength: number;
  interactionType: 'repulse' | 'attract';
  damping: number;
  returnSpeed: number;

  // 星云爆炸效果参数
  nebulaExplosionExpansion: number;     // 膨胀距离 50-800
  nebulaExplosionTurbulence: number;    // 湍流强度 0-200
  nebulaExplosionRotation: number;      // 旋转角度 0-2
  nebulaExplosionSizeBoost: number;     // 粒子放大 0-30

  // 星云黑洞效果参数
  nebulaBlackHoleCompression: number;   // Z轴压缩 0.01-0.5
  nebulaBlackHoleSpinSpeed: number;     // 旋转速度 50-1000
  nebulaBlackHoleTargetRadius: number;  // 收缩半径 5-100
  nebulaBlackHolePull: number;          // 吸引强度 0.5-1.0

  // 互通模式星云设置
  overlayBlendMode: NebulaBlendMode;    // 混合模式
  overlayBrightness: number;            // 叠加亮度 0-3
  overlayBloomStrength: number;         // 互通模式Bloom辉光强度 0-3
  overlayColorCompensation: number;     // 互通模式颜色补偿强度 0-1（绑定 shader uOverlayMode）

  // Lines
  lineSettings: LineSettings;

  // Camera
  autoRotate: boolean;
  autoRotateSpeed: number;

  // Background Settings
  background: BackgroundSettings;
}

// 单手数据
export interface SingleHandData {
  isActive: boolean;
  x: number; // Normalized -1 to 1
  y: number; // Normalized -1 to 1
  z: number; // Normalized depth
  isClosed: boolean; // Fist detection
  openness: number; // 0 = closed fist, 1 = fully open hand
  isIndexPointing: boolean; // 食指伸出（写字姿势）
  isKnifeHand: boolean; // 刀状手势
  velocity: { x: number; y: number }; // 移动速度
}

// 双手数据（兼容旧接口）
export interface HandData {
  isActive: boolean;
  x: number; // Normalized -1 to 1
  y: number; // Normalized -1 to 1
  z: number; // Normalized depth
  isPinching: boolean;
  isClosed: boolean; // Fist detection
  openness: number; // 0 = closed fist, 1 = fully open hand
  // 双手扩展
  leftHand?: SingleHandData;
  rightHand?: SingleHandData;
  twoHandsActive: boolean; // 双手都激活
  twoHandsDistance: number; // 双手之间的距离（归一化）
}

// ==================== 星球模块类型 ====================

// 渐变模式
export type GradientMode =
  | 'none'           // 单色模式（仅基础色相+饱和度）
  | 'single'         // 单色模式（支持指定颜色值）
  | 'twoColor'       // 双色渐变
  | 'threeColor'     // 三色渐变
  | 'procedural';    // 混色渐变（程序化）

// 渐变方向
export type GradientDirection =
  | 'radial'         // 径向（从中心向外）
  | 'linearX'        // X轴线性
  | 'linearY'        // Y轴线性
  | 'linearZ'        // Z轴线性
  | 'linearCustom'   // 自定义角度（XYZ分量）
  | 'spiral';        // 螺旋

// 渐变色配置
export interface GradientColor {
  enabled: boolean;
  mode: GradientMode;           // 渐变模式

  // 双色/三色渐变配置
  colors: string[];             // 2-3 colors (hex)
  colorMidPosition: number;     // 中间色位置 0-1（三色渐变时使用）
  colorMidWidth: number;        // 中间色宽度（新逻辑：0-1控制显著程度，>1扩展范围）
  colorMidWidth2?: number;      // 中间色宽度2（旧逻辑：纯色带宽度 0-0.5）
  blendStrength?: number;       // 渐变过渡强度 0-1（0=硬边分层，1=平滑过渡）
  direction: GradientDirection; // 渐变方向
  directionCustom: { x: number; y: number; z: number }; // 自定义方向向量

  // 螺旋渐变参数
  spiralDensity: number;        // 螺旋密度/圈数 0.5-10
  spiralAxis: 'x' | 'y' | 'z';  // 螺旋旋转轴

  // 混色渐变（程序化）配置
  proceduralAxis: 'x' | 'y' | 'z' | 'radial' | 'custom'; // 轴向选择
  proceduralCustomAxis: { x: number; y: number; z: number }; // 自定义轴向
  proceduralIntensity: number;  // 位置系数（渐变强度）0.1-5

  // 兼容旧版
  angle: number;     // 旧版角度字段（弃用，保留兼容）
  type: 'linear' | 'radial';  // 旧版类型字段（弃用，保留兼容）
}

// 星球核心粒子模式
export enum PlanetFillMode {
  Shell = 'shell',       // 外壳模式
  Gradient = 'gradient', // 渐变模式
  Solid = 'solid'        // 实心模式
}

// 倾斜轴类型
export type TiltAxis = 'x' | 'y' | 'z';

// 倾斜角度预设
export type TiltAngle = 0 | 30 | 45 | 60;

// 倾斜配置（支持预设和自定义XYZ法向量）
export interface TiltSettings {
  axis: TiltAxis;         // 绕哪个轴倾斜（旧版兼容）
  angle: TiltAngle | number; // 倾斜角度（旧版兼容）
  isCustom: boolean;      // 是否使用自定义值
  customX?: number;       // 自定义法向量X分量
  customY?: number;       // 自定义法向量Y分量
  customZ?: number;       // 自定义法向量Z分量
}

// 公转轴配置（支持预设和自定义XYZ）
export interface OrbitAxisSettings {
  axis: TiltAxis;         // 公转轴（旧版兼容）
  angle: TiltAngle | number; // 公转轴倾斜角度（旧版兼容）
  isCustom: boolean;      // 是否使用自定义值
  customX?: number;       // 自定义X分量
  customY?: number;       // 自定义Y分量
  customZ?: number;       // 自定义Z分量
}

// 自转轴预设类型（保留用于核心）
export type RotationAxisPreset = 'y' | 'x' | 'z' | 'tiltY45' | 'tiltX45' | 'custom';

// 自转轴配置（保留用于核心）
export interface RotationAxisSettings {
  preset: RotationAxisPreset;
  customX: number;
  customY: number;
  customZ: number;
}

// 星球核心配置（粒子核心）
export interface PlanetCoreSettings {
  id: string;
  name: string;
  enabled: boolean;
  fillMode: PlanetFillMode;
  fillPercent: number;        // 0-100, 0=外壳, 100=实心
  density: number;            // 粒子密度 0.1-10
  baseRadius: number;         // 基础半径 50-500
  baseHue: number;            // 基础色相 0-360
  baseSaturation: number;     // 基础饱和度 0-1
  gradientColor: GradientColor;
  rotationSpeed: number;      // 自转速度 -2 to 2
  rotationAxis: RotationAxisSettings;  // 自转轴预设
  trailLength: number;        // 拖尾长度 0-2, 0=关闭
  brightness?: number;        // 亮度 0.1-3
  particleSize?: number;      // 粒子大小 0.5-5
}

// 实体核心预设类型（系统预设 + 任意用户自定义 ID）
export type SolidCorePresetType = 'magma' | 'gas' | 'ice' | 'cyber' | 'custom' | string;

// 实体核心颜色模式（复用粒子核心的渐变结构，但不含漩涡）
export interface SolidCoreColorSettings {
  mode: GradientMode;           // 渐变模式：none/twoColor/threeColor/procedural
  baseColor: string;            // 基础颜色（单色模式时使用）
  colors: string[];             // 渐变颜色 2-3 colors (hex)
  colorMidPosition: number;     // 中间色位置 0-1（三色渐变时使用）
  colorMidWidth?: number;       // 中间色宽度（新逻辑）
  colorMidWidth2?: number;      // 纯色带宽度（旧逻辑）
  direction: GradientDirection; // 渐变方向
  directionCustom: { x: number; y: number; z: number }; // 自定义方向向量
  spiralDensity: number;        // 螺旋密度/圈数 0.5-10
  proceduralIntensity: number;  // 混色强度 0.1-5
}

// 实体核心配置
export interface SolidCoreSettings {
  id: string;
  name: string;
  enabled: boolean;
  radius: number;             // 球体半径 10-300
  // 表面颜色系统（支持渐变）
  surfaceColor: SolidCoreColorSettings;
  // 纹理参数
  scale: number;              // 纹理尺度 0.1-10 (归一化采样)
  speed: number;              // 流动速度 0-2
  contrast: number;           // 对比度 1-5
  bandMix: number;            // 气态条纹混合 0-2
  ridgeMix: number;           // 冰晶锐化混合 0-2
  gridMix: number;            // 赛博网格混合 0-1
  // 熔岩裂隙系统（脊线噪声）
  crackEnabled: boolean;      // 是否启用裂隙
  crackScale: number;         // 裂隙噪声尺度 1-10
  crackThreshold: number;     // 阈值 0.1-0.9（低=细线，高=粗线）
  crackFeather: number;       // 羽化/软边 0.01-0.3
  crackWarp: number;          // 域扭曲强度 0-2
  crackWarpScale: number;     // 域扭曲噪声尺度 0.5-3
  crackFlowSpeed: number;     // 沿裂隙流动速度 0-1
  crackColor1: string;        // 裂隙内侧色（白/亮）
  crackColor2: string;        // 裂隙外侧色（金/橙）
  crackEmission: number;      // 裂隙独立发光增益 0-5
  emissiveStrength: number;   // 自发光强度 0-5（让亮部发光触发Bloom）
  // 多频叠加（塑形）
  multiFreqEnabled: boolean;  // 是否启用多频叠加
  warpIntensity: number;      // 域扭曲强度 0-2
  warpScale: number;          // 域扭曲噪声尺度 0.5-3
  detailBalance: number;      // 高频细节权重 0-1
  // 法线扰动 + 高光
  bumpEnabled: boolean;       // 是否启用法线扰动
  bumpStrength: number;       // 法线扰动强度 0-1
  specularStrength: number;   // 高光强度 0-3
  specularColor: string;      // 高光颜色
  roughness: number;          // 粗糙度 4-128（高=扩散，低=锐利）
  // 定向光参数
  lightEnabled: boolean;      // 是否启用定向光
  lightDirection: { x: number; y: number; z: number }; // 光源方向
  lightColor: string;         // 光源颜色
  lightIntensity: number;     // 光照强度 0-3
  lightAmbient: number;       // 环境光强度 0-1（暗部最低亮度）
  // 热点辉斑
  hotspotEnabled: boolean;    // 是否启用热点
  hotspotCount: number;       // 热点数量 1-8
  hotspotSize: number;        // 热点大小 0.05-0.5
  hotspotPulseSpeed: number;  // 脉冲速度 0-3
  hotspotColor: string;       // 热点颜色
  hotspotEmission: number;    // 热点发光强度 0-5
  opacity: number;            // 整体透明度 0-1
  brightness: number;         // 亮度 0.5-3
  // 运动效果
  rotationSpeed: number;      // 自转速度 -2 to 2
  rotationAxis: RotationAxisSettings;  // 自转轴设置
  // 光晕系统（支持渐变）
  glowEnabled: boolean;         // 是否启用边缘光晕
  glowColor: SolidCoreColorSettings;
  glowLength: number;         // 光晕宽度 0.5-10（值越大越宽）
  glowStrength: number;       // 光晕强度 0-3
  glowRadius: number;         // 发散高度 0-1（外壳层超出球体表面的距离比例）
  glowFalloff: number;        // 边缘淡出 0.5-5（值越大边缘越锐利）
  glowInward: boolean;        // 光晕方向：false=外亮内淡，true=内亮外淡
  glowBloomBoost: number;     // Bloom外扩强度 0-3（0=关闭）
  preset: SolidCorePresetType;
  // 兼容旧版字段（将被迁移到 surfaceColor/glowColor）
  hue?: number;
  saturation?: number;
  lightness?: number;
  glowHue?: number;
  glowSaturation?: number;
}

// 保存的实体核心预设模板
export interface SavedSolidCorePreset {
  id: string;
  name: string;
  createdAt: number;
  settings: Omit<SolidCoreSettings, 'enabled'>;
}

// ========== 火焰系统 ==========

// 火焰颜色设置（复用实体核心颜色结构）
export type FlameColorSettings = SolidCoreColorSettings;

// 表面火焰设置
export interface SurfaceFlameSettings {
  id: string;
  name: string;
  enabled: boolean;
  preset: string;

  // 基础几何
  radius: number;             // 火焰层半径（相对核心）1.0-2.0
  thickness: number;          // 火焰厚度 0.05-0.5

  // 颜色系统（复用现有颜色系统）
  color: FlameColorSettings;

  // 火团参数
  flameScale: number;         // 火团尺寸 0.1-3
  density: number;            // 覆盖密度 0.3-1.0

  // 质感参数
  flowSpeed: number;          // 流动速度 0-3
  turbulence: number;         // 扰动强度 0-2
  noiseType: 'perlin' | 'simplex' | 'voronoi';
  fractalLayers: number;      // 分形层级 1-5

  // 视觉效果
  opacity: number;            // 透明度 0-1
  emissive: number;           // 发光强度 0-5
  bloomBoost: number;         // Bloom增强 0-3

  // 动画效果
  direction: 'up' | 'spiral';  // 舔舐方向
  pulseEnabled: boolean;      // 脉动开关
  pulseSpeed: number;         // 脉动速度 0-3
  pulseIntensity: number;     // 脉动幅度 0-1
}

// 喷发火柱设置
export interface FlameJetSettings {
  id: string;
  name: string;
  enabled: boolean;
  preset: string;

  // 发射源
  sourceType: 'pole' | 'equator' | 'hotspots' | 'surface';
  hotspotCount: number;       // 热点数量 1-8（hotspots模式）

  // 几何参数
  baseRadius: number;         // 基础位置半径
  height: number;             // 火柱高度 0.5-5（倍半径）
  width: number;              // 火柱宽度 0.1-1
  spread: number;             // 扩散角度 0-45°

  // 粒子参数
  particleCount: number;      // 粒子数量 100-2000
  particleSize: number;       // 粒子大小 1-20

  // 动态参数
  jetSpeed: number;           // 喷射速度 0.1-3
  lifespan: number;           // 粒子寿命 0.5-5秒
  turbulence: number;         // 湍流扰动 0-2

  // 爆发模式
  burstMode: 'continuous' | 'burst';  // 持续/间歇
  burstInterval: number;    // 爆发间隔 1-10秒
  burstDuration: number;    // 爆发持续 0.5-3秒

  // 视觉效果
  color: FlameColorSettings;
  opacity: number;
  emissive: number;
  bloomBoost: number;
}

// 螺旋火焰设置
export interface SpiralFlameSettings {
  id: string;
  name: string;
  enabled: boolean;
  preset: string;

  // 螺旋结构
  spiralCount: number;        // 螺旋条数 1-6
  direction: 'cw' | 'ccw' | 'both';  // 旋转方向

  // 几何参数
  baseRadius: number;         // 基础半径
  startRadius: number;        // 起始半径（相对基础）
  endRadius: number;          // 终止半径（相对基础）
  height: number;             // 螺旋高度
  pitch: number;              // 螺距 0.1-2
  thickness: number;          // 螺旋带厚度 0.05-0.5

  // 动态参数
  rotationSpeed: number;      // 旋转速度 0-3
  riseSpeed: number;          // 上升速度 0-2

  // 渲染类型
  renderType: 'particles' | 'ribbon' | 'volume';
  particleCount: number;      // 粒子数量（particles模式）
  particleSize: number;       // 粒子大小 1-10

  // 视觉效果
  color: FlameColorSettings;
  opacity: number;
  emissive: number;
  bloomBoost: number;
}

// 火焰系统设置
export interface FlameSystemSettings {
  enabled: boolean;
  surfaceFlamesEnabled?: boolean;  // 能量罩模块整体启用
  spiralFlamesEnabled?: boolean;   // 螺旋环模块整体启用
  flameJetsEnabled?: boolean;      // 残影模块整体启用（旧版，保留兼容）
  surfaceFlames: SurfaceFlameSettings[];
  flameJets: FlameJetSettings[];
  spiralFlames: SpiralFlameSettings[];
}

// ==================== 残影系统（新版） ====================

// 残影区域设置
export interface AfterimageZoneSettings {
  id: string;
  name: string;
  enabled: boolean;

  // 区域定位
  startAngle: number;           // 起始角度 0-360°
  angleSpan: number;            // 角度跨度 10-360°

  // 侧边界
  sideLineType: 'straight' | 'curve';  // 直线/曲线
  sideLineLength: number;              // 侧边长度（相对核心半径）0.5-5
  sideLineAngle: number;               // 与圆弧的夹角 60-120°
  // 曲线模式参数
  curveBendDirection: 'inward' | 'outward';  // 凹/凸
  curveBendStrength: number;                  // 弯曲强度 0-1

  // 外边界
  outerBoundaryShape: number;   // 0=圆弧, 0.5=混合, 1=尖角三角

  // 羽化
  featherInner: number;         // 内边缘羽化 0-1
  featherOuter: number;         // 外边缘羽化 0-1
  featherSide: number;          // 侧边羽化 0-1

  // 反选
  inverted: boolean;            // 反选模式
}

// 残影粒子设置
export interface AfterimageParticleSettings {
  enabled: boolean;

  // 发散
  speed: number;                // 发散速度 0.5-5
  speedRandomness: number;      // 速度随机性 0-0.5

  // 粒子属性
  density: number;              // 密度（每秒生成数）10-500
  size: number;                 // 粒子大小 1-20
  sizeDecay: 'none' | 'linear' | 'exponential';  // 大小衰减

  // 生命周期
  lifespan: number;             // 生命周期 0.5-5秒
  fadeOutCurve: 'linear' | 'quadratic' | 'exponential';

  // 颜色
  colorMode: 'single' | 'gradient';
  colors: string[];             // 1-3个颜色
}

// 残影纹路设置（流动火焰效果）
export interface AfterimageTextureSettings {
  enabled: boolean;

  // 纹理模式
  textureMode: 'flow' | 'energy';  // 流动纹理 或 能量罩

  // 流动效果（flow 模式）
  flowSpeed: number;            // 流动速度 0.1-2
  noiseScale: number;           // 噪声缩放 0.5-3
  stretchFactor: number;        // 拉伸因子 1-5

  // 条纹效果（flow 模式）
  stripeIntensity: number;      // 条纹强度 0-1
  stripeCount: number;          // 条纹数量 3-20
  directionalStretch: number;   // 定向拉伸 1-20
  edgeSharpness: number;        // 边缘锐度 0-1
  distortion: number;           // 扰动强度 0-1

  // 能量罩参数（energy 模式）
  energyFlameScale: number;     // 火团缩放 0.5-5
  energyDensity: number;        // 火团密度 0-1
  energyFlowSpeed: number;      // 流动速度 0.1-3
  energyTurbulence: number;     // 湍流强度 0-2
  energyNoiseType: 'simplex' | 'voronoi';  // 噪声类型
  energyFractalLayers: number;  // 分形层数 1-5
  energyDirection: 'up' | 'spiral';  // 动画方向
  energyPulseEnabled: boolean;  // 脉冲开关
  energyPulseSpeed: number;     // 脉冲速度 0.5-3
  energyPulseIntensity: number; // 脉冲强度 0-1

  // 外观
  opacity: number;              // 0-1
  colors: string[];             // 三色渐变 [暗色, 中间色, 亮色]
}

// 残影系统总设置
export interface AfterimageSystemSettings {
  enabled: boolean;
  zones: AfterimageZoneSettings[];
  particles: AfterimageParticleSettings;
  texture: AfterimageTextureSettings;

  // 绑定核心
  bindToCoreId?: string;        // 绑定到指定核心ID，空则自动选择第一个

  // 边界处理
  outsideClearSpeed: number;    // 区域外清除速度倍率 1-5
}

// 粒子环配置
export interface ParticleRingSettings {
  id: string;
  name: string;
  enabled: boolean;
  eccentricity: number;       // 离心率 0-0.9
  absoluteRadius: number;     // 轨道绝对半径 50-600
  particleDensity: number;    // 粒子密度（每单位弧长）0.1-10
  bandwidth: number;          // 环宽度 1-50
  thickness: number;          // 环厚度 0-20
  orbitSpeed: number;         // 公转速度 -2 to 2
  rotationSpeed: number;      // 自转速度 -2 to 2
  tilt: TiltSettings;         // 倾斜设置
  orbitAxis: OrbitAxisSettings; // 公转轴设置
  phaseOffset: number;        // 起始相位 0-360
  color: string;
  gradientColor: GradientColor;
  trailEnabled: boolean;
  trailLength: number;
  brightness?: number;        // 亮度 0.1-2
  particleSize?: number;      // 粒子大小 0.5-5
  vortex?: VortexSettings;    // 漩涡渐变设置
  silkEffect?: SilkEffectSettings;       // 丝绸效果（仅在特定渲染模式下有效）
}

// 丝绸效果配置
export interface SilkEffectSettings {
  enabled: boolean;
  thicknessVariation: number; // 厚度变化 0-1
  dashPattern: number;        // 虚线模式 0-1
  noiseStrength: number;      // 噪声强度 0-1
  noiseFrequency: number;     // 噪声频率 0.1-5
  ringCount: number;          // 细环数量 1-10
  ringSharpness: number;      // 环边缘锐度 0-1
}

// 连续环带透明度渐变模式
export enum RingOpacityGradient {
  None = 'none',
  FadeIn = 'fadeIn',
  FadeOut = 'fadeOut',
  FadeBoth = 'fadeBoth'
}

// 漩涡渐变设置
export interface VortexSettings {
  enabled: boolean;
  armCount: number;           // 旋臂数量 1-12
  twist: number;              // 扭曲程度 0-10
  rotationSpeed: number;      // 旋转速度 -2~2
  radialDirection: 'inward' | 'outward' | 'static';  // 收缩方向
  radialSpeed: number;        // 收缩速度 0-2
  hardness: number;           // 硬边程度 0-1
  colors: string[];           // 旋臂颜色数组 2-7
}

// 角度显隐区域
export interface VisibilityZone {
  startAngle: number;   // 起始角度 0-360
  endAngle: number;     // 结束角度 0-360
}

// 连续环带配置
export interface ContinuousRingSettings {
  id: string;
  name: string;
  enabled: boolean;
  eccentricity: number;       // 离心率 0-0.9
  absoluteInnerRadius: number; // 内半径绝对值 50-500
  absoluteOuterRadius: number; // 外半径绝对值 60-600
  tilt: TiltSettings;         // 倾斜设置
  orbitAxis: OrbitAxisSettings; // 公转轴设置
  orbitSpeed: number;         // 公转速度 -2 to 2
  rotationSpeed: number;      // 自转速度 -2 to 2
  color: string;
  gradientColor: GradientColor;
  opacity: number;            // 基础透明度 0.1-1
  opacityGradient: RingOpacityGradient;
  opacityGradientStrength?: number; // 透明度渐变强度 0-1
  brightness?: number;        // 亮度 0.5-3
  vortex?: VortexSettings;    // 漩涡渐变设置
  // 显隐效果（旋臂透明遮罩）
  visibilityEffect?: {
    enabled: boolean;           // 显隐效果开关
    minOpacity: number;         // 最低透明度 0-1
    armCount: number;           // 旋臂数量 1-12
    twist: number;              // 扭曲程度 0-20
    hardness: number;           // 硬边程度 0-1
    rotationSpeed: number;      // 旋转速度 -2~2
    radialDirection: 'none' | 'inward' | 'outward';  // 径向流动方向
    radialSpeed: number;        // 径向流动速度 0-2
    // 高级遮罩
    zones?: VisibilityZone[];   // 角度显隐区域
    fadeAngle?: number;         // 边缘羽化角度 0-45
    dynamicRotation?: boolean;  // 是否动态旋转
  };
  // 拉丝效果
  streakMode?: {
    enabled: boolean;           // 拉丝开关
    flowSpeed: number;          // 流动速度 0.1-2
    stripeCount: number;        // 条纹数量 4-30
    radialStretch: number;      // 径向拉伸 1-20
    edgeSharpness: number;      // 脊线锐度 0-1
    distortion: number;         // 扭曲强度 0-2
    noiseScale: number;         // 噪声缩放 0.5-3
    flowDirection: 'cw' | 'ccw'; // 流动方向
    brightness: number;         // 整体亮度 0.5-3
  };
}

// ==================== 能量体系统 ====================

// 多面体类型
export type PolyhedronType =
  // 柏拉图立体
  | 'tetrahedron'      // 正四面体 (4面)
  | 'cube'             // 正六面体 (6面)
  | 'octahedron'       // 正八面体 (8面)
  | 'dodecahedron'     // 正十二面体 (12面)
  | 'icosahedron'      // 正二十面体 (20面)
  // 截角多面体（阿基米德立体）
  | 'truncatedTetrahedron'   // 截角四面体
  | 'truncatedCube'          // 截角六面体
  | 'truncatedOctahedron'    // 截角八面体
  | 'truncatedDodecahedron'  // 截角十二面体
  | 'truncatedIcosahedron'   // 截角二十面体（足球形）
  | 'cuboctahedron'          // 截半立方体
  | 'icosidodecahedron';     // 截半二十面体

// 渲染模式
export type EnergyBodyRenderMode = 'wireframe' | 'shell' | 'both';

// 顶点光点形状
export type VertexShape = 'circle' | 'diamond' | 'star' | 'none';

// 虚线配置
export interface DashPatternSettings {
  enabled: boolean;
  dashRatio: number;       // 实线占比 0.1-0.9
  dashDensity: number;     // 虚线密度（每条边的虚线段数）2-20
  flowSpeed: number;       // 流动速度 -5 to 5
}

// 边缘效果配置
export interface EdgeEffectSettings {
  width: number;           // 线条粗细 0.5-5
  glowIntensity: number;   // 发光强度 0-3
  softEdgeFalloff: number; // 软边衰减 0-1
  color: string;           // 主颜色
  // 渐变（从顶点到边中点）
  gradientEnabled: boolean;
  gradientEndColor: string;
  // 虚线
  dashPattern: DashPatternSettings;
}

// 顶点效果配置
export interface VertexEffectSettings {
  enabled: boolean;
  size: number;            // 光点大小 1-20
  shape: VertexShape;
  color: string;
  glowIntensity: number;   // 发光强度 0-3
}

// 薄壳效果配置
export interface ShellEffectSettings {
  enabled: boolean;
  opacity: number;         // 基础透明度 0-1
  fresnelPower: number;    // 菲涅尔指数 0.5-5（越大边缘越亮）
  fresnelIntensity: number;// 菲涅尔强度 0-2
  color: string;
  doubleSided: boolean;    // 是否双面渲染
}

// 有机化动画配置
export interface OrganicAnimationSettings {
  // 呼吸效果
  breathingEnabled: boolean;
  breathingSpeed: number;    // 周期 0.1-5
  breathingIntensity: number;// 幅度 0-0.3
  // 噪声扰动
  noiseEnabled: boolean;
  noiseAmplitude: number;    // 扰动幅度 0-0.2
  noiseFrequency: number;    // 噪声频率 0.1-3
  noiseSpeed: number;        // 噪声演变速度 0.1-2
}

// 欧拉路径模式
export type EulerPathMode = 'strict' | 'autoAugment' | 'longestTrail';

// 光流巡游效果配置
export interface LightFlowSettings {
  enabled: boolean;
  color: string;             // 光流颜色
  speed: number;             // 流动速度 0.1-5
  length: number;            // 光包长度 0.05-0.5
  intensity: number;         // 亮度 0.5-3
  count: number;             // 同时存在的光包数量 1-10
  // 巡游增强
  pathMode: 'edge' | 'euler' | 'random';  // 路径模式：沿边/欧拉回路/随机
  eulerMode: EulerPathMode;  // 欧拉模式：严格/自动补边/最长轨迹
  phaseMode: 'sync' | 'spread';           // 同相/错相分布
  trailEnabled: boolean;     // 是否显示拖尾
  trailLength: number;       // 拖尾长度 0.1-1
  pulseEnabled: boolean;     // 脉冲闪烁
  pulseSpeed: number;        // 脉冲速度 0.5-5
  // 随机游走参数
  noBacktrack: boolean;      // 禁止立即折返
  coverageWeight: number;    // 覆盖权重 0-2（优先未访问边）
  angleWeight: number;       // 转角代价权重 0-2（优先小转角）
  // 顶点停靠
  dwellEnabled: boolean;     // 是否在高阶顶点停靠
  dwellThreshold: number;    // 停靠度数阈值 3-6
  dwellDuration: number;     // 停靠时长 0.1-1
  dwellCooldown: number;     // 停靠冷却时间 0.5-5
  dwellPulseIntensity: number; // 停靠脉冲强度 0-3
  // 拥堵避免
  minPacketSpacing: number;  // 光包最小间距 0.05-0.3
}

// 边呼吸效果配置
export interface EdgeBreathingSettings {
  enabled: boolean;
  speed: number;              // 呼吸速度 0.1-2
  widthAmplitude: number;     // 线宽振幅 0-0.5
  glowAmplitude: number;      // 发光振幅 0-0.8
  alphaAmplitude: number;     // 透明振幅 0-0.3
  noiseMix: number;           // 噪声混合比 0-1
  noiseScale: number;         // 噪声尺度 0.5-5
  noiseSpeed: number;         // 噪声演变速度 0.1-1
}

// 球面Voronoi配置
export interface SphericalVoronoiSettings {
  enabled: boolean;
  cellCount: number;         // 细胞数量 4-64
  seedDistribution: 'random' | 'fibonacci' | 'uniform';  // 种子分布模式
  lineWidth: number;         // 边线宽度 0.5-5
  lineColor: string;         // 边线颜色
  lineGlow: number;          // 边线发光 0-2
  fillEnabled: boolean;      // 是否填充细胞
  fillOpacity: number;       // 填充透明度 0-1
  colorMode: 'gradient' | 'random' | 'uniform';  // 单元着色模式
  baseHue: number;           // 基础色相 0-360
  hueSpread: number;         // 色相分散度 0-1
  animateSeeds: boolean;     // 种子点是否移动
  seedSpeed: number;         // 种子移动速度 0-1
  seedNoiseScale: number;    // 种子运动噪声尺度 0.5-3
  cellPulse: boolean;        // 单元脉冲
  cellPulseSpeed: number;    // 脉冲速度
}

// 能量体后期效果配置
export interface EnergyBodyPostEffects {
  // 泛光
  bloomEnabled: boolean;
  bloomThreshold: number;    // 亮度阈值 0-1
  bloomIntensity: number;    // 强度 0-3
  bloomRadius: number;       // 半径 0-2
  // 色差
  chromaticAberrationEnabled: boolean;
  chromaticAberrationIntensity: number;  // 强度 0-0.05
  // 暗角
  vignetteEnabled: boolean;
  vignetteIntensity: number; // 强度 0-1
  vignetteRadius: number;    // 半径 0.5-1.5
}

// 单个能量体配置
export interface EnergyBodySettings {
  id: string;
  name: string;
  enabled: boolean;

  // 几何
  polyhedronType: PolyhedronType;
  subdivisionLevel: number;  // 细分级别 0-4
  radius: number;            // 半径 50-500
  spherize: number;          // 球化程度 0-1（0=原始多面体，1=完全球化）

  // 渲染模式
  renderMode: EnergyBodyRenderMode;

  // 视觉效果
  edgeEffect: EdgeEffectSettings;
  vertexEffect: VertexEffectSettings;
  shellEffect: ShellEffectSettings;

  // 变换
  rotationSpeed: number;     // 自转速度 -2 to 2
  rotationAxis: RotationAxisSettings;
  tilt: TiltSettings;

  // 动画
  organicAnimation: OrganicAnimationSettings;
  lightFlow: LightFlowSettings;
  edgeBreathing: EdgeBreathingSettings;  // 边呼吸效果

  // 球面Voronoi
  sphericalVoronoi: SphericalVoronoiSettings;

  // 后期效果
  postEffects: EnergyBodyPostEffects;

  // 混合
  blendMode: 'additive' | 'normal';
  globalOpacity: number;     // 整体透明度 0-1
}

// 光环系统配置
export interface RingSystemSettings {
  enabled?: boolean;                  // 光环系统总开关
  particleRingsEnabled: boolean;     // 粒子环总开关
  continuousRingsEnabled: boolean;   // 环带总开关
  particleRingsSoloId?: string | null;  // 粒子环 Solo ID
  continuousRingsSoloId?: string | null; // 环带 Solo ID
  particleRings: ParticleRingSettings[];
  continuousRings: ContinuousRingSettings[];
}

// 能量体系统配置
export interface EnergyBodySystemSettings {
  enabled: boolean;                  // 能量体系统总开关
  coreEnabled?: boolean;             // 能量核子模块开关
  soloId?: string | null;            // 能量体 Solo ID
  energyBodies: EnergyBodySettings[];
}

// 粒子喷射配置
export interface ParticleEmitterSettings {
  id: string;
  name: string;
  enabled: boolean;
  emissionRangeMin: number;   // 发射起点（相对于R）
  emissionRangeMax: number;   // 消散边界（相对于R）
  birthRate: number;          // 每秒生成数 50-2000
  lifeSpan: number;           // 生命周期（秒）0.5-5
  initialSpeed: number;       // 初始速度 10-200
  drag: number;               // 速度衰减 0-0.99
  color: string;
  gradientColor: GradientColor;
  fadeOut?: boolean;          // 兼容旧数据
  fadeOutStrength: number;    // 淡出强度 0-1
  particleSize: number;       // 0.5-5
  brightness?: number;        // 亮度 0.5-3
}

// 粒子环绕配置
export interface OrbitingParticlesSettings {
  id: string;
  name: string;
  enabled: boolean;
  particleCount?: number;     // 兼容旧数据
  particleDensity: number;    // 粒子密度 0.1-5
  orbitRadius: number;        // 环绕半径（相对于R）0.1-5
  thickness: number;          // 球壳厚度 1-1000
  color: string;
  gradientColor: GradientColor;
  fadeWithDistance: boolean;
  fadeStrength: number;       // 0-1 (距离淡出强度)
  baseSpeed: number;          // 旋转速度 0.1-2
  // 多向运动参数
  mainDirection: { x: number; y: number; z: number };  // 主旋转方向
  turbulence: number;         // 随机扰动强度 0-1
  turbulenceScale: number;    // 扰动尺度 0.1-2
  brightness?: number;        // 亮度 0.1-3
  particleSize?: number;      // 粒子大小 0.5-5
}

// 辐射系统配置
export interface RadiationSystemSettings {
  enabled?: boolean;                  // 辐射系统总开关
  orbitingEnabled: boolean;          // 粒子环绕总开关
  emitterEnabled: boolean;           // 粒子喷射总开关
  emitters: ParticleEmitterSettings[];   // 粒子喷射数组
  orbitings: OrbitingParticlesSettings[]; // 粒子环绕数组
}

// 流萤头部样式
// plain=普通圆点, flare=N叶星芒, spark=尖锐火花, texture=贴图
export type FireflyHeadStyle = 'plain' | 'flare' | 'spark' | 'texture';

// 流萤颜色模式
// solid=纯色(忽略贴图颜色), texture=贴图原色, tint=贴图颜色×配置颜色
export type FireflyColorMode = 'solid' | 'texture' | 'tint';

// 旋转流萤配置
export interface OrbitingFireflySettings {
  id: string;
  name: string;
  enabled: boolean;
  // 轨道
  absoluteOrbitRadius: number; // 轨道绝对半径 50-500
  orbitSpeed: number;          // 公转速度 0.1-2
  orbitAxis: OrbitAxisSettings; // 公转轴（描边模式下无效）
  initialPhase: number;        // 初始相位 0-360
  billboardOrbit: boolean;     // 描边模式：轨道平面始终面向相机
  // 外观
  size: number;                // 头部大小 1-100
  color: string;
  brightness: number;          // 亮度 0.5-8
  headStyle: FireflyHeadStyle; // 头部样式
  headTexture: string;         // 贴图路径（texture 样式时使用）
  colorMode?: FireflyColorMode; // 颜色模式（texture 样式时使用）
  // 星芒参数（flare 样式）
  flareIntensity: number;      // 星芒强度 0-2
  flareLeaves: number;         // 星芒叶片数 4-8
  flareWidth: number;          // 星芒宽度 0.1-1
  chromaticAberration: number; // 色散强度 0-1
  // 动态效果
  velocityStretch: number;     // 速度拉伸 0-2
  noiseAmount: number;         // 噪声扰动 0-1
  // 通用
  glowIntensity: number;       // 头部光晕强度 0-2
  pulseSpeed: number;          // 脉冲速度 0-3（0=不脉冲）
  // 拖尾
  trailEnabled: boolean;
  trailLength: number;         // 历史点数 1-1000
  trailTaperPower: number;     // 粗细衰减指数 0.3-3（越大衰减越快）
  trailOpacity: number;        // 拖尾透明度 0-1
  // 轨道半径波动
  radiusWave?: {
    enabled: boolean;           // 波动开关
    amplitude: number;          // 波动幅度（像素单位）
    frequency: number;          // 波动频率 0.1-3
    randomPhase: boolean;       // 随机相位
    waveType: 'sine' | 'triangle'; // 波形类型：正弦/三角
  };
}

// 游走流萤组配置
export interface WanderingFireflyGroupSettings {
  id: string;
  name: string;
  enabled: boolean;
  count: number;               // 该组数量 1-50
  // 游走边界
  innerRadius: number;         // 内边界（R倍数）0.5-5
  outerRadius: number;         // 外边界（R倍数）1-15
  // 运动
  speed: number;               // 移动速度 0.1-2
  turnFrequency: number;       // 转向频率 0-1
  // 外观
  size: number;                // 头部大小 1-100
  color: string;
  brightness: number;          // 亮度 0.5-8
  headStyle: FireflyHeadStyle; // 头部样式
  headTexture: string;         // 贴图路径（texture 样式时使用）
  colorMode?: FireflyColorMode; // 颜色模式（texture 样式时使用）
  flareIntensity: number;      // 星芒强度 0-2
  flareLeaves: number;         // 星芒叶片数 4-8
  flareWidth: number;          // 星芒宽度 0.1-1
  chromaticAberration: number; // 色散强度 0-1
  // 动态效果
  velocityStretch: number;     // 速度拉伸 0-2
  noiseAmount: number;         // 噪声扰动 0-1
  // 通用
  glowIntensity: number;       // 头部光晕强度 0-2
  pulseSpeed: number;          // 脉冲速度 0-3
  // 拖尾
  trailTaperPower: number;     // 粗细衰减指数 0.3-3（越大衰减越快）
  trailOpacity: number;        // 拖尾透明度 0-1
}

// 流萤系统配置
export interface FireflySystemSettings {
  enabled?: boolean;                  // 流萤系统总开关
  orbitingEnabled: boolean;          // 旋转流萤总开关
  wanderingEnabled: boolean;         // 飞舞流萤总开关
  orbitingFireflies: OrbitingFireflySettings[];
  wanderingGroups: WanderingFireflyGroupSettings[];
}

// 核心类型
export type CoreType = 'particle' | 'solid';

// 核心系统配置
export interface CoreSystemSettings {
  coresEnabled: boolean;      // 粒子核心总开关
  solidCoresEnabled: boolean; // 实体核心总开关
  coreType: CoreType;         // 核心类型：粒子核心或实体核心
  cores: PlanetCoreSettings[];       // 粒子核心配置
  solidCores: SolidCoreSettings[];   // 实体核心配置（多实例）
  solidCore?: SolidCoreSettings;     // 兼容旧版单实例
}

// 公转配置
export interface OrbitSettings {
  enabled: boolean;           // 是否启用公转
  targetPlanetId: string | null; // 公转目标星球ID（null=绕原点）
  orbitRadius: number;        // 公转半径 50-1000
  orbitSpeed: number;         // 公转速度 -2 to 2
  eccentricity: number;       // 离心率 0-0.9（0=圆形，越大越椭圆）
  tilt: TiltSettings;         // 轨道倾斜
  initialPhase: number;       // 初始相位 0-360
}

// 法阵配置
export interface MagicCircleSettings {
  id: string;
  name: string;
  enabled: boolean;
  texture: string;            // 预设贴图路径
  yOffset: number;            // Y轴偏移 -500 ~ 500
  radius: number;             // 半径 10 ~ 500
  rotationSpeed: number;      // 自转速度 -5 ~ 5
  opacity: number;            // 透明度 0 ~ 1
  hueShift: number;           // 色相偏移 0 ~ 360
  baseHue: number;            // 基础色相 0 ~ 360（单色模式）
  baseSaturation: number;     // 基础饱和度 0 ~ 1（单色模式）
  saturationBoost: number;    // 饱和度增强 0 ~ 3（全局）
  brightness: number;         // 亮度 0.5 ~ 3
  gradientColor: GradientColor; // 渐变色配置（复用核心颜色模式）
  tilt?: TiltSettings;        // 倾斜设置
  // 脉冲发光
  pulseEnabled: boolean;
  pulseSpeed: number;         // 脉冲速度 0 ~ 5
  pulseIntensity: number;     // 脉冲强度 0 ~ 1
  // 缩放呼吸
  breathEnabled: boolean;
  breathSpeed: number;        // 呼吸速度 0 ~ 3
  breathIntensity: number;    // 呼吸幅度 0 ~ 0.5
}

// 法阵系统配置
export interface MagicCircleSystemSettings {
  enabled: boolean;
  circles: MagicCircleSettings[];
  soloId?: string | null;     // Solo 模式：仅显示指定法阵
}

// 单个星球完整配置
export interface PlanetSettings {
  id: string;
  name: string;
  enabled: boolean;
  position: { x: number; y: number; z: number };
  scale: number;              // 整体缩放 0.5-3
  orbit?: OrbitSettings;      // 公转配置（可选）
  coreSystem: CoreSystemSettings;  // 核心系统（支持多核心）
  flameSystem: FlameSystemSettings;  // 火焰系统（旧版残影在此）
  afterimageSystem?: AfterimageSystemSettings;  // 残影系统（新版）
  rings: RingSystemSettings;
  radiation: RadiationSystemSettings;
  fireflies: FireflySystemSettings;
  magicCircles: MagicCircleSystemSettings;  // 法阵系统
  drawSettings?: DrawSettings; // 绘制系统
  energyBodySystem: EnergyBodySystemSettings;  // 能量体系统
}

// 背景设置
export interface BackgroundSettings {
  enabled: boolean;           // 启用全景图背景
  panoramaUrl: string;        // 全景图路径
  brightness: number;         // 亮度 0-2
  saturation: number;         // 饱和度 0-5
  rotation: number;           // 旋转角度 0-360
}

// 星球场景全局设置
export interface PlanetSceneSettings {
  enabled: boolean;           // 创造模式开关
  planets: PlanetSettings[];
  // Solo 模式：仅显示指定核心（不改变 enabled 状态）
  soloCoreId?: string | null;
  soloSolidCoreId?: string | null;       // Solo实体核心
  soloSpiralFlameId?: string | null;     // Solo螺旋环
  soloOrbitingFireflyId?: string | null; // Solo粒子环绕/旋转流萤
  soloFlameJetId?: string | null;        // Solo粒子喷射
  // 背景设置
  background: BackgroundSettings;
  // 视觉效果（复用主场景）
  bloomStrength: number;
  trailEnabled: boolean;
  trailLength: number;
  // 动态效果（复用主场景）
  breathingEnabled: boolean;
  breathingSpeed: number;
  breathingIntensity: number;
  flickerEnabled: boolean;
  flickerIntensity: number;
  flickerSpeed: number;
  wanderingLightningEnabled: boolean;
  wanderingLightningIntensity: number;
  wanderingLightningSpeed: number;
  wanderingLightningDensity: number;
  wanderingLightningWidth: number;
  lightningBreakdownEnabled: boolean;
  lightningBreakdownIntensity: number;
  lightningBreakdownFrequency: number;
  lightningBreakdownBranches: number;

  // ===== 上升效果 =====
  // 璀璨星雨
  starRainEnabled: boolean;
  starRainCount: number;           // 粒子数量 (100-800)
  starRainSize: number;            // 粒子大小 (1-5)
  starRainSpeed: number;           // 上升速度 (0.5-3)
  starRainSpeedVariation: number;  // 速度差异 (0-1)
  starRainHeight: number;          // 上升高度 (100-500)
  starRainSpread: number;          // 水平扩散范围 (50-300)
  starRainColor: string;           // 颜色
  starRainTrailLength: number;     // 拖尾长度 (0-1)
  starRainBrightness: number;      // 亮度 (0.5-3)
  starRainReverse: boolean;        // 反向（下落）
  starRainHeadStyle: 'plain' | 'star'; // 头部样式

  // 体积薄雾
  volumeFogEnabled: boolean;
  volumeFogLayers: number;         // 层数 (3-7)
  volumeFogInnerRadius: number;    // 内半径 (30-100)
  volumeFogOuterRadius: number;    // 外半径 (100-300)
  volumeFogHeight: number;         // 高度范围 (50-200)
  volumeFogOpacity: number;        // 透明度 (0.05-0.3)
  volumeFogColor: string;          // 颜色
  volumeFogSpeed: number;          // 流动速度 (0.1-1)

  // 光球灯笼
  lightOrbsEnabled: boolean;
  lightOrbsMaxCount: number;       // 最大数量 (3-10)
  lightOrbsSpawnRate: number;      // 生成频率 (0.5-3秒)
  lightOrbsSize: number;           // 初始大小 (5-30)
  lightOrbsGrowth: number;         // 膨胀倍数 (1-3)
  lightOrbsSpeed: number;          // 上升速度 (0.3-1.5)
  lightOrbsHeight: number;         // 上升高度 (100-400)
  lightOrbsColor: string;          // 颜色
  lightOrbsGlow: number;           // 发光强度 (1-5)
  lightOrbsBurst: boolean;         // 是否爆散

  // 交互设置 - 超新星爆发
  explosionExpansion: number;        // 膨胀距离 50-800
  explosionTurbulence: number;       // 湍流强度 0-200
  explosionRotation: number;         // 旋转角度 0-2
  explosionSizeBoost: number;        // 粒子放大 0-30
  explosionRecoverySpeed: number;    // 恢复速度 0.01-0.5
  // 交互设置 - 黑洞效果
  blackHoleCompression: number;      // Z轴压缩 0.01-0.5
  blackHoleSpinSpeed: number;        // 旋转速度 50-1000
  blackHoleTargetRadius: number;     // 收缩半径 5-100
  blackHolePull: number;             // 吸引强度 0.5-1.0
  blackHoleRecoverySpeed: number;    // 恢复速度 0.01-0.5
  // 相机设置
  cameraAutoRotate: boolean;
  cameraAutoRotateSpeed: number;
}

// 保存的星球模板
export interface SavedPlanetTemplate {
  id: string;
  name: string;
  createdAt: number;
  planet: Omit<PlanetSettings, 'id' | 'position'>;  // 不保存id和位置
}

// 保存的星球场景
export interface SavedPlanetScene {
  id: string;
  name: string;
  createdAt: number;
  settings: PlanetSceneSettings;
}

// 应用模式
export type AppMode = 'nebula' | 'planet';

// 星云预设（包含图片和完整配置）
export interface NebulaPreset {
  id: string;
  name: string;
  createdAt: number;
  imageUrl: string;          // 图片URL或base64
  imageDataUrl?: string;     // 本地图片的base64数据
  settings: AppSettings;     // 完整配置
  isBuiltIn?: boolean;       // 是否为内置预设
}

// ==================== 按键材质系统类型 ====================

export type MaterialType = 'glass' | 'neon' | 'crystal' | 'neumorphism' | 'holographic';

export interface GlassParams {
  blur: number;
  opacity: number;
  borderOpacity: number;
  tint: string;
  tint2?: string;
}

export interface NeonParams {
  glowIntensity: number;
  glowSpread: number;
  borderGlow: boolean;
  textGlow: boolean;
  color: string;
  color2?: string;
}

export interface CrystalParams {
  facets: number;
  shine: number;
  depth: number;
  color: string;
  highlightColor: string;
  color2: string;
  highlightColor2: string;
}

export interface NeumorphismParams {
  elevation: number;
  curvature: number;
  lightAngle: number;
  shadowIntensity: number;
  pressDepth: number;
  baseColor: string;
  highlightColor: string;
  shadowColor: string;
}

export interface HolographicParams {
  colors: string[];
  colors2?: string[];
  speed: number;
  angle: number;
  shimmer: boolean;
  noiseIntensity: number;
}

export interface ButtonMaterialConfig {
  type: MaterialType;
  glass: GlassParams;
  neon: NeonParams;
  crystal: CrystalParams;
  neumorphism: NeumorphismParams;
  holographic: HolographicParams;
}

// ==================== 主题配置类型 ====================

export interface ThemeColors {
  primary: string;      // 主交互色
  secondary: string;    // 次交互色
  textAccent: string;   // 标题强调
  decoration: string;   // 装饰线条
  editBar: string;      // 编辑栏颜色
}

export interface ColorScheme {
  name: string;
  colors: ThemeColors;
  isSystem?: boolean;
}

export interface ThemeConfig {
  schemes: Record<string, ColorScheme>;
  activeSchemeId: string;
  activeColors: ThemeColors;
  consoleBg: string;  // 控制台背景色（独立于方案）
  deletedSystemSchemeIds: string[];
}

// ==================== 材质配置类型 ====================

export interface MaterialSettings {
  modeSwitch: ButtonMaterialConfig;
  mainTabs: ButtonMaterialConfig;
  mainTabColors: { basic: string; visual: string; interact: string };
  moduleTabs: ButtonMaterialConfig;
  moduleTabColors: {
    core: string; energyBody: string; rings: string;
    afterimage: string; radiation: string; fireflies: string; magicCircle: string;
  };
  optionButtons: ButtonMaterialConfig;
  subModuleTabs: Record<string, ButtonMaterialConfig>;  // 按模块分开设置
}

export interface MaterialPreset {
  id: string;
  name: string;
  data: MaterialSettings;
  isBuiltIn?: boolean;
}

// ==================== 绘图系统（Workbench / Planet Ink） ====================

export interface DrawVec3 {
  x: number;
  y: number;
  z: number;
}

// 1. 笔刷系统
export enum BrushType {
  Stardust = 'stardust',     // 星尘 (粒子)
  GasCloud = 'gasCloud',     // 气云 (体积光)
  EnergyBeam = 'energyBeam', // 能量束 (发光线条)
  Crystal = 'crystal'        // 晶体 (几何体)
}

export interface BrushSettings {
  type: BrushType;

  // Base
  size: number;           // 1-100
  opacity: number;        // 0-1
  color: string;

  // Dynamics
  usePressure: boolean;   // 压感开关
  pressureInfluence: {
    size: boolean;
    opacity: boolean;
    flow: boolean;        // 流量/密度 control
  };

  // Specific Parameters (Union type or just optional bags)
  // Stardust
  density?: number;       // 粒子密度
  scatter?: number;       // 散射范围

  // Gas
  noiseScale?: number;    // 云絮纹理大小
  flowSpeed?: number;     // 流动速度

  // Energy
  coreWidth?: number;     // 核心宽度 (0-1 relative to size)
  glowIntensity?: number; // 辉光强度
  stabilization?: number; // 防抖等级 0-1 (StreamLine)
}

// 2. 2D 对称（Procreate 风格）
export enum Symmetry2DMode {
  None = 'none',
  Mirror = 'mirror',
  Radial = 'radial'
}

export enum RadialReflectionMode {
  None = 'none',
  Mirror = 'mirror',
  Kaleidoscope = 'kaleidoscope'
}

export interface Symmetry2DSettings {
  mode: Symmetry2DMode;

  // Mirror
  mirrorAxisAngle: number; // 0..180，0=水平轴，90=垂直轴（绕画布中心）

  // Radial
  segments: number; // 2..64
  radialReflectionMode: RadialReflectionMode;
  rotationOffset: number; // 0..360
}

// 3. 3D 对称生长（在 3D Growth Space 中复制）
export enum Symmetry3DMode {
  None = 'none',
  Octant = 'octant',
  Tetrahedral = 'tetrahedral',
  Cubic = 'cubic',
  Octahedral = 'octahedral',
  Dodecahedral = 'dodecahedral',
  Icosahedral = 'icosahedral',
  Vortex = 'vortex'
}

export interface Symmetry3DSettings {
  mode: Symmetry3DMode;

  // Shared
  segments: number; // 2..64，Radial/Vortex 使用

  // Octant
  octantAxes: { x: boolean; y: boolean; z: boolean };

  // Vortex
  heightStep: number;
  scaleDecay: number;
  twistPerStep: number;

  // Depth growth (for non-surface 3D feeling)
  depthFromRadius: number; // 0..1，r 越大 z 越深
}

// 4. 数据结构（资产一致；多星球差异只在 Placement）
export interface DrawPoint2D {
  u: number; // 0..1
  v: number; // 0..1
  pressure: number;
  t: number;
  tiltX?: number;
  tiltY?: number;
}

export interface DrawStroke {
  id: string;
  points: DrawPoint2D[];
  brush: BrushSettings; // Snapshot
  symmetry2D: Symmetry2DSettings; // Snapshot
  symmetry3D: Symmetry3DSettings; // Snapshot
  canvasSize: number; // Snapshot
  createdAt: number;
}

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;

  // Transform (3D Space Layer)
  tilt: DrawVec3;       // degrees
  scale: number;
  altitude: number;     // local +Z offset
  rotationSpeed: number;

  // Visual
  opacity: number;
  blending: 'normal' | 'additive';

  // Default style for new strokes in this layer
  brushType: BrushType;
  color: string;

  strokes: DrawStroke[];
}

export interface Drawing {
  id: string;
  name: string;
  layers: DrawingLayer[];
  activeLayerId: string | null;
  visible: boolean;
}

export interface DrawingPlacement {
  id: string;
  drawingId: string;
  planetId: string;
  visible: boolean;

  scale: number;
  tilt: DrawVec3;
  offset: DrawVec3;
  followPlanetRotation: number; // 0..1
}

export interface DrawSettings {
  enabled: boolean;

  // Global tools
  brush: BrushSettings;
  symmetry2D: Symmetry2DSettings;
  symmetry3D: Symmetry3DSettings;

  // Data
  drawings: Drawing[];
  activeDrawingId: string | null;
  placements: DrawingPlacement[];

  // Workbench UI
  canvasOpacity: number;
  hideCanvasWhilePainting: boolean;
  hidePlanetWhileDrawing: boolean;
  previewPlanetId: string | null;

  // Geometry scale
  canvasSize: number; // Growth space size (world units)
}

