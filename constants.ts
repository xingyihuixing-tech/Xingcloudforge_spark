/**
 * input: types.ts 导出的类型/枚举 + 生成的纹理配置 json
 * output: 导出各类默认配置（DEFAULT_SETTINGS / DEFAULT_NEBULA_INSTANCE 等）与预设常量
 * pos: 全局默认值与预设的权威来源，影响初始状态与旧数据补全（localStorage merge）
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

// 从自动生成的 JSON 文件导入贴图配置（通过 npm run generate 生成）
import magicTexturesData from './src/generated/magic-textures.json';

import {
  AppSettings,
  DepthMode,
  ParticleShape,
  ColorFilterSettings,
  ColorFilterPreset,
  LineSettings,
  LineMode,
  LineStyle,
  LineColorMode,
  LineRenderMode,
  LineGradientMode,
  GlowMode,
  NebulaBlendMode,
  AccretionLayer,
  ColorTintSettings,
  NebulaInstance,
  // 星球模块类型
  PlanetSceneSettings,
  PlanetSettings,
  PlanetFillMode,
  GradientColor,
  RingOpacityGradient,
  ParticleRingSettings,
  ContinuousRingSettings,
  OrbitingFireflySettings,
  WanderingFireflyGroupSettings,
  TiltAxis,
  TiltSettings,
  OrbitAxisSettings,
  RotationAxisPreset,
  RotationAxisSettings,
  CoreSystemSettings,
  PlanetCoreSettings,
  ParticleEmitterSettings,
  OrbitingParticlesSettings,
  SolidCoreSettings,
  SolidCoreColorSettings,
  SolidCorePresetType,
  CoreType,
  OrbitSettings,
  MagicCircleSettings,
  EnergyBodySettings,
  // 火焰系统
  FlameColorSettings,
  SurfaceFlameSettings,
  FlameJetSettings,
  SpiralFlameSettings,
  FlameSystemSettings,
  // 残影系统
  AfterimageZoneSettings,
  AfterimageParticleSettings,
  AfterimageTextureSettings,
  AfterimageSystemSettings,
  // 绘图系统 V2
  BrushType,
  BrushSettings,
  Symmetry2DMode,
  Symmetry3DMode,
  SymmetrySettings,
  ProjectionMode,
  DrawingLayer,
  Drawing,
  DrawSettings
} from './types';

// 颜色过滤预设配置
export const COLOR_FILTER_PRESETS: Record<ColorFilterPreset, Partial<ColorFilterSettings>> = {
  none: {
    enabled: false,
    filters: [],
    invertMode: false,
  },
  excludeGreen: {
    enabled: true,
    filters: [{ id: '1', hueStart: 80, hueEnd: 160, enabled: true }],
    invertMode: false,
  },
  excludeBlue: {
    enabled: true,
    filters: [{ id: '1', hueStart: 180, hueEnd: 260, enabled: true }],
    invertMode: false,
  },
  warmOnly: {
    enabled: true,
    filters: [
      { id: '1', hueStart: 0, hueEnd: 60, enabled: true },
      { id: '2', hueStart: 300, hueEnd: 360, enabled: true }
    ],
    invertMode: true, // 只保留这些颜色
  },
  coolOnly: {
    enabled: true,
    filters: [{ id: '1', hueStart: 180, hueEnd: 300, enabled: true }],
    invertMode: true,
  },
  excludeSkin: {
    enabled: true,
    filters: [{ id: '1', hueStart: 0, hueEnd: 50, enabled: true }],
    invertMode: false,
  },
  redOnly: {
    enabled: true,
    filters: [
      { id: '1', hueStart: 345, hueEnd: 360, enabled: true },
      { id: '2', hueStart: 0, hueEnd: 15, enabled: true }
    ],
    invertMode: true,
  },
  excludeGray: {
    enabled: true,
    filters: [],
    invertMode: false,
    saturationMin: 0.15, // 排除低饱和度
  },
  highContrast: {
    enabled: true,
    filters: [],
    invertMode: false,
    saturationMin: 0.3,
  },
};

// 颜色过滤预设标签
export const COLOR_FILTER_PRESET_LABELS: Record<ColorFilterPreset, string> = {
  none: '无过滤',
  excludeGreen: '排除绿色',
  excludeBlue: '排除蓝色',
  warmOnly: '只保留暖色',
  coolOnly: '只保留冷色',
  excludeSkin: '排除肤色',
  redOnly: '只保留红色',
  excludeGray: '排除灰色',
  highContrast: '高对比度',
};

// 默认颜色过滤设置
export const DEFAULT_COLOR_FILTER: ColorFilterSettings = {
  enabled: false,
  filters: [],
  invertMode: false,
  saturationMin: 0,
  saturationMax: 1,
};

// 默认连线设置
export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: false,
  renderMode: LineRenderMode.Dynamic,
  mode: LineMode.Distance,
  distanceRanges: [
    { id: '1', min: 0, max: 50, enabled: true }
  ],
  maxDistance: 50, // 保留兼容
  kNeighbors: 3,
  colorThreshold: 0.2,
  // 结构感知约束
  colorConstraintEnabled: false,  // 默认关闭颜色约束
  colorTolerance: 0.3,            // 颜色容差 30%
  maxConnectionsPerParticle: 0,   // 0=不限制
  zDepthWeight: 1.0,              // 正常 Z 轴权重
  // 外观
  lineWidth: 2,
  lineStyle: LineStyle.Solid,
  lineColorMode: LineColorMode.Inherit,
  customColor: '#ffffff',
  opacity: 0.6,
  fadeWithDistance: true,
  // 渐变色设置
  gradientColorStart: '#ff0080',
  gradientColorEnd: '#00ffff',
  gradientIntensity: 0.5,
  gradientMode: LineGradientMode.ParticleColor, // 默认使用粒子颜色渐变
  // 粒子大小过滤
  sizeFilterEnabled: false,
  minSizeAbsolute: 0.1,
  minSizeRelative: 0.2,
  minSizePercentile: 0,        // 默认不启用百分位过滤
  maxLines: 50000,
  sampleRatio: 0.5,
};

// Detect device performance tier
export const detectPerformanceTier = (): 'low' | 'medium' | 'high' => {
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 2;

  // Check device memory (if available)
  const memory = (navigator as any).deviceMemory || 4; // GB

  // Check if WebGL2 is supported with good performance
  let gpuTier: 'low' | 'medium' | 'high' = 'medium';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        // Detect low-end GPUs
        if (renderer.includes('intel') && !renderer.includes('iris')) {
          gpuTier = 'low';
        } else if (renderer.includes('nvidia') || renderer.includes('amd') || renderer.includes('radeon') || renderer.includes('iris')) {
          gpuTier = 'high';
        }
      }
    }
  } catch (e) {
    // WebGL not available
    gpuTier = 'low';
  }

  // Combine factors
  if (isMobile || cores <= 2 || memory <= 2 || gpuTier === 'low') {
    return 'low';
  } else if (cores >= 8 && memory >= 8 && gpuTier === 'high') {
    return 'high';
  }
  return 'medium';
};

// Performance-based particle limits
export const PERFORMANCE_PRESETS = {
  low: {
    maxParticles: 250000,
    density: 8,
    bloomStrength: 0.8,
  },
  medium: {
    maxParticles: 400000,
    density: 4,
    bloomStrength: 1.5,
  },
  high: {
    maxParticles: 400000,
    density: 1,
    bloomStrength: 2.0,
  },
};

// 默认星云实例
export const DEFAULT_NEBULA_INSTANCE: NebulaInstance = {
  id: '',
  name: '星云 1',
  enabled: true,
  imageUrl: '',
  imageDataUrl: '',
  position: { x: 0, y: 0, z: 0 },
  scale: 1.0,
  // 粒子生成参数
  density: 8,
  threshold: 30,
  brightness: 1.0,
  opacity: 1.0,
  baseSize: 5,
  colorSaturation: 1.2,
  // 轮廓优先采样
  edgeSamplingEnabled: false,
  edgeSensitivity: 0.3,
  edgeDensityBoost: 2,
  fillDensity: 0.5,
  pureOutlineMode: false,
  // 3D深度映射
  depthMode: DepthMode.Brightness,
  depthRange: 200,
  depthInvert: false,
  noiseStrength: 50,
  waveFrequency: 0.02,
  waveAmplitude: 1.0,
  fbmOctaves: 4,
  stereoSeparation: 30,
  // 几何映射
  geometryMapping: 'none',
  mappingStrength: 0.5,
  mappingRadius: 200,
  mappingTileX: 1,
  mappingTileY: 1,
  mappingEdgeFade: 0.1,
  // 粒子动态效果
  particleTurbulence: 0,
  turbulenceSpeed: 0.5,
  turbulenceScale: 0.005,
  // 动态效果
  breathingEnabled: false,
  breathingSpeed: 0.5,
  breathingIntensity: 0.15,
  rippleEnabled: false,
  rippleSpeed: 0.5,
  rippleIntensity: 20,
  accretionEnabled: false,
  accretionSpeed: 0.3,
  accretionIntensity: 0.5,
  accretionLayers: [
    { id: '1', enabled: true, radiusMax: 100, direction: 1, speedMultiplier: 2.0 },
    { id: '2', enabled: true, radiusMax: 200, direction: -1, speedMultiplier: 1.0 },
    { id: '3', enabled: false, radiusMax: 400, direction: 1, speedMultiplier: 0.5 },
  ],
  flickerEnabled: false,
  flickerIntensity: 0.5,
  flickerSpeed: 3,

  // 真实海浪效果（实例级）
  waveEnabled: false,
  waveIntensity: 30,
  waveSpeed: 1.0,
  waveSteepness: 0.5,
  waveLayers: 3,
  waveDirection: 45,
  waveDepthFade: 0.5,
  waveFoam: true,

  // 游走闪电效果（实例级）
  wanderingLightningEnabled: false,
  wanderingLightningIntensity: 0.5,
  wanderingLightningSpeed: 1.0,
  wanderingLightningDensity: 3,
  wanderingLightningWidth: 5,

  // 闪电击穿效果（实例级）
  lightningBreakdownEnabled: false,
  lightningBreakdownIntensity: 0.7,
  lightningBreakdownFrequency: 0.5,
  lightningBreakdownBranches: 2,

  dataVersion: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  density: 8,
  threshold: 30,
  maxParticles: 400000,
  baseSize: 5,
  brightness: 0.5, // 亮度 0.1-3
  opacity: 1.0, // 透明度 0.1-1

  // 多星云实例
  nebulaInstances: [],
  selectedNebulaId: null,

  // Edge-priority sampling
  edgeSamplingEnabled: false,
  edgeSensitivity: 0.3,
  edgeDensityBoost: 3,
  fillDensity: 0.2,
  pureOutlineMode: false,
  edgeCropPercent: 0,
  circularCrop: false,

  // 粒子动态效果
  particleTurbulence: 0,
  turbulenceSpeed: 0.5,
  turbulenceScale: 0.5,

  // Color Filter
  colorFilter: DEFAULT_COLOR_FILTER,

  // Color Tint (染色效果)
  colorTint: {
    enabled: false,
    colorCount: 3,
    mappings: [],
    globalStrength: 1.0,
  } as ColorTintSettings,

  depthMode: DepthMode.Brightness,
  depthRange: 10,
  depthInvert: false,
  noiseStrength: 40,

  // New depth mode parameters
  waveFrequency: 0.02,
  waveAmplitude: 1.0,
  fbmOctaves: 4,
  stereoSeparation: 20,

  // Visuals
  bloomStrength: 0.2,
  particleShape: ParticleShape.Circle,
  colorSaturation: 1.2,

  // 光晕效果（固定使用柔和模式）
  glowMode: GlowMode.Soft,
  glowIntensity: 1.0,

  // 高级动态效果
  breathingEnabled: false,
  breathingSpeed: 0.5,
  breathingIntensity: 0.15,

  rippleEnabled: false,
  rippleSpeed: 0.5,
  rippleIntensity: 20,

  accretionEnabled: false,
  accretionSpeed: 0.3,
  accretionIntensity: 0.5,
  accretionLayers: [
    { id: '1', enabled: true, radiusMax: 100, direction: 1, speedMultiplier: 2.0 },
    { id: '2', enabled: true, radiusMax: 200, direction: -1, speedMultiplier: 1.0 },
    { id: '3', enabled: false, radiusMax: 400, direction: 1, speedMultiplier: 0.5 },
  ] as AccretionLayer[],

  // 拖尾残影
  trailEnabled: false,
  trailLength: 0.3,
  trailDecay: 0.5,

  // 荧光闪烁
  flickerEnabled: false,
  flickerIntensity: 0.3,
  flickerSpeed: 2.0,

  // 真实海浪效果（Gerstner波）
  waveEnabled: false,
  waveIntensity: 30,
  waveSpeed: 1.0,
  waveSteepness: 0.5,
  waveLayers: 3,
  waveDirection: 45,
  waveDepthFade: 0.5,
  waveFoam: true,

  // 几何映射
  geometryMapping: 'none' as const,
  mappingStrength: 0,
  mappingRadius: 200,
  mappingTileX: 1,
  mappingTileY: 1,
  mappingEdgeFade: 0.1,

  // 游走闪电效果
  wanderingLightningEnabled: false,
  wanderingLightningIntensity: 0.5,
  wanderingLightningSpeed: 1.0,
  wanderingLightningDensity: 3,
  wanderingLightningWidth: 5,

  // 闪电击穿效果
  lightningBreakdownEnabled: false,
  lightningBreakdownIntensity: 0.7,
  lightningBreakdownFrequency: 0.5,
  lightningBreakdownBranches: 2,

  // Physics
  interactionRadius: 150,
  interactionStrength: 80,
  interactionType: 'repulse',
  damping: 0.9,
  returnSpeed: 1.5,

  // 星云爆炸效果参数
  nebulaExplosionExpansion: 300,
  nebulaExplosionTurbulence: 80,
  nebulaExplosionRotation: 0.4,
  nebulaExplosionSizeBoost: 8,

  // 星云黑洞效果参数
  nebulaBlackHoleCompression: 0.05,
  nebulaBlackHoleSpinSpeed: 400,
  nebulaBlackHoleTargetRadius: 30,
  nebulaBlackHolePull: 0.95,

  // 互通模式星云设置
  overlayBlendMode: NebulaBlendMode.Additive,
  overlayBrightness: 0.5,
  overlayBloomStrength: 1.0,
  overlayColorCompensation: 1.0,

  // Lines
  lineSettings: DEFAULT_LINE_SETTINGS,

  // Camera
  autoRotate: true,
  autoRotateSpeed: 0.3,

  // Background settings (required for global background support)
  background: {
    enabled: false,
    panoramaUrl: '',
    brightness: 1.0,
    saturation: 1.0,
    rotation: 0
  },
};

// Get settings adjusted for device performance
export const getPerformanceAdjustedSettings = (): AppSettings => {
  const tier = detectPerformanceTier();
  const preset = PERFORMANCE_PRESETS[tier];

  console.log(`Performance tier detected: ${tier}`);

  return {
    ...DEFAULT_SETTINGS,
    maxParticles: preset.maxParticles,
    density: preset.density,
    bloomStrength: preset.bloomStrength,
  };
};

export const SAMPLE_IMAGES = [
  { name: "猎户座星云", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/600px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg" },
  { name: "创生之柱", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/600px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg" }
];

// ==================== 星球模块默认配置 ====================

// 倾斜角度预设
export const TILT_ANGLE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '0°' },
  { value: 30, label: '30°' },
  { value: 45, label: '45°' },
  { value: 60, label: '60°' },
];

// 轴选项
export const AXIS_OPTIONS: Array<{ value: TiltAxis; label: string }> = [
  { value: 'x', label: 'X轴' },
  { value: 'y', label: 'Y轴' },
  { value: 'z', label: 'Z轴' },
];

// 默认倾斜设置
export const DEFAULT_TILT_SETTINGS: TiltSettings = {
  axis: 'x',
  angle: 0,
  isCustom: true,
  customX: 0,
  customY: 1,
  customZ: 0
};

// 默认公转轴设置
export const DEFAULT_ORBIT_AXIS_SETTINGS: OrbitAxisSettings = {
  axis: 'y',
  angle: 0,
  isCustom: false
};

// 获取倾斜角度（返回绕指定轴的旋转角度，支持新版法向量模式）
export const getTiltAngles = (tilt: TiltSettings): { x: number; y: number; z: number } => {
  // 优先使用新版customX/Y/Z法向量模式
  if (tilt.isCustom && tilt.customX !== undefined) {
    const nx = tilt.customX ?? 0;
    const ny = tilt.customY ?? 1;
    const nz = tilt.customZ ?? 0;

    // 归一化法向量
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 0.001) return { x: 0, y: 0, z: 0 };
    const ux = nx / len;
    const uy = ny / len;
    const uz = nz / len;

    // 从法向量计算欧拉角（使环面朝向该法向量）
    // 默认环面法向量是Y轴(0,1,0)，需要旋转到(ux,uy,uz)
    // 使用简化的欧拉角计算
    const rotX = Math.atan2(-uz, uy) * (180 / Math.PI);
    const rotZ = Math.atan2(ux, Math.sqrt(uy * uy + uz * uz)) * (180 / Math.PI);

    return { x: rotX, y: 0, z: rotZ };
  }

  // 旧版兼容：使用 axis + angle 模式
  const angle = tilt.angle;
  switch (tilt.axis) {
    case 'x': return { x: angle, y: 0, z: 0 };
    case 'y': return { x: 0, y: angle, z: 0 };
    case 'z': return { x: 0, y: 0, z: angle };
    default: return { x: 0, y: 0, z: 0 };
  }
};

// 获取公转轴向量
export const getOrbitAxisVector = (orbitAxis: OrbitAxisSettings): { x: number; y: number; z: number } => {
  // 优先使用自定义XYZ值（新版模式）
  if (orbitAxis.isCustom && orbitAxis.customX !== undefined) {
    const x = orbitAxis.customX ?? 0;
    const y = orbitAxis.customY ?? 1;
    const z = orbitAxis.customZ ?? 0;
    // 归一化向量
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 0.001) {
      return { x: x / len, y: y / len, z: z / len };
    }
    return { x: 0, y: 1, z: 0 }; // 默认Y轴
  }

  // 旧版兼容：使用 axis + angle 模式
  const angle = orbitAxis.angle * Math.PI / 180; // 转换为弧度
  // 基础轴向量
  let baseX = 0, baseY = 0, baseZ = 0;
  switch (orbitAxis.axis) {
    case 'x': baseX = 1; break;
    case 'y': baseY = 1; break;
    case 'z': baseZ = 1; break;
  }

  // 如果角度为0，直接返回基础轴
  if (orbitAxis.angle === 0) {
    return { x: baseX, y: baseY, z: baseZ };
  }

  // 对轴进行倾斜（绕垂直于该轴的方向旋转）
  // 简化处理：绕另一个轴旋转
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  switch (orbitAxis.axis) {
    case 'x': // X轴倾斜，绕Z轴旋转
      return { x: cos, y: sin, z: 0 };
    case 'y': // Y轴倾斜，绕X轴旋转
      return { x: 0, y: cos, z: sin };
    case 'z': // Z轴倾斜，绕Y轴旋转
      return { x: sin, y: 0, z: cos };
    default:
      return { x: 0, y: 1, z: 0 };
  }
};

// 自转轴预设值
export const ROTATION_AXIS_PRESETS: Record<string, { x: number; y: number; z: number }> = {
  y: { x: 0, y: 1, z: 0 },       // Y轴（默认竖直）
  x: { x: 1, y: 0, z: 0 },       // X轴
  z: { x: 0, y: 0, z: 1 },       // Z轴
  tiltY45: { x: 0.707, y: 0.707, z: 0 },  // Y轴倾斜45度
  tiltX45: { x: 0.707, y: 0, z: 0.707 },  // X轴倾斜45度
};

// 默认自转轴设置
export const DEFAULT_ROTATION_AXIS_SETTINGS: RotationAxisSettings = {
  preset: 'y',
  customX: 0,
  customY: 1,
  customZ: 0
};

// 获取自转轴（根据预设或自定义，自动归一化）
export const getRotationAxis = (axis: RotationAxisSettings | undefined | null): { x: number; y: number; z: number } => {
  // 安全处理：如果 axis 为 undefined/null，返回默认 Y 轴
  if (!axis) {
    return { x: 0, y: 1, z: 0 };
  }

  let x: number, y: number, z: number;

  // 安全处理：检查 preset 是否存在，默认为 'y'
  const presetValue = axis.preset ?? 'y';

  if (presetValue === 'custom') {
    x = axis.customX ?? 0;
    y = axis.customY ?? 1;
    z = axis.customZ ?? 0;
  } else {
    const preset = ROTATION_AXIS_PRESETS[presetValue] || { x: 0, y: 1, z: 0 };
    x = preset.x;
    y = preset.y;
    z = preset.z;
  }

  // 归一化向量
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len > 0.001) {
    return { x: x / len, y: y / len, z: z / len };
  }
  return { x: 0, y: 1, z: 0 }; // 默认Y轴
};

// 默认渐变色配置
export const DEFAULT_GRADIENT_COLOR: GradientColor = {
  enabled: false,
  mode: 'none',

  // 双色/三色渐变
  colors: ['#ff6b6b', '#4ecdc4', '#ffd93d'],
  colorMidPosition: 0.5,
  colorMidWidth: 0,        // 中间色宽度，0 表示无额外宽度
  blendStrength: 1.0,      // 渐变过渡强度（0=硬边分层，1=平滑过渡）
  direction: 'radial',
  directionCustom: { x: 1, y: 0, z: 0 },

  // 螺旋渐变
  spiralDensity: 2,
  spiralAxis: 'y',

  // 混色渐变（程序化）
  proceduralAxis: 'y',
  proceduralCustomAxis: { x: 0, y: 1, z: 0 },
  proceduralIntensity: 1.0,

  // 兼容旧版
  angle: 0,
  type: 'radial'
};

// 默认粒子环配置
export const createDefaultParticleRing = (id: string, name: string = '粒子环'): ParticleRingSettings => ({
  id,
  name,
  enabled: true,
  eccentricity: 0,
  absoluteRadius: 150,
  particleDensity: 1,
  bandwidth: 10,
  thickness: 5,
  orbitSpeed: 0.5,
  rotationSpeed: 0.3,
  tilt: { ...DEFAULT_TILT_SETTINGS },
  orbitAxis: { ...DEFAULT_ORBIT_AXIS_SETTINGS },
  phaseOffset: 0,
  color: '#ffffff',
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  trailEnabled: false,
  trailLength: 0.3,
  brightness: 1.0,
  particleSize: 1.0,
  silkEffect: {
    enabled: false,
    thicknessVariation: 0.5,
    dashPattern: 0.3,
    noiseStrength: 0.3,
    noiseFrequency: 1.0,
    ringCount: 5,        // 细环数量
    ringSharpness: 0.7   // 环边缘锐度
  }
});

// 默认连续环带配置
export const createDefaultContinuousRing = (id: string, name: string = '环带'): ContinuousRingSettings => ({
  id,
  name,
  enabled: true,
  eccentricity: 0,
  absoluteInnerRadius: 130,
  absoluteOuterRadius: 180,
  tilt: { axis: 'x', angle: 30, isCustom: false },
  orbitAxis: { ...DEFAULT_ORBIT_AXIS_SETTINGS },
  orbitSpeed: 0.2,
  rotationSpeed: 0.1,
  color: '#88ccff',
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  opacity: 0.6,
  opacityGradient: RingOpacityGradient.FadeBoth,
  brightness: 1.0,
  visibilityEffect: {
    enabled: true,
    zones: [{ startAngle: 0, endAngle: 180 }],
    fadeAngle: 15,
    dynamicRotation: false,
    rotationSpeed: 0.5,
    minOpacity: 0,
    armCount: 1,
    twist: 0,
    hardness: 0,
    radialDirection: 'none',
    radialSpeed: 0
  },
  streakMode: {
    enabled: false,
    flowSpeed: 0.5,
    stripeCount: 12,
    radialStretch: 8,
    edgeSharpness: 0.3,
    distortion: 0.5,
    noiseScale: 1.0,
    flowDirection: 'cw',
    brightness: 1.5
  }
});

// ==================== 能量体配置 ====================

// 默认能量体配置
export const createDefaultEnergyBody = (id: string, name: string = '能量体'): EnergyBodySettings => ({
  id,
  name,
  enabled: true,

  // 几何
  polyhedronType: 'icosahedron',
  subdivisionLevel: 0,
  radius: 120,
  spherize: 0,

  // 渲染模式
  renderMode: 'wireframe',

  // 边缘效果
  edgeEffect: {
    width: 1.5,
    glowIntensity: 1.0,
    softEdgeFalloff: 0.8,
    color: '#ffd700',
    gradientEnabled: true,
    gradientEndColor: '#ffffff',
    dashPattern: {
      enabled: false,
      dashRatio: 0.6,
      dashDensity: 10,
      flowSpeed: 1.0
    }
  },

  // 顶点效果
  vertexEffect: {
    enabled: true,
    size: 6,
    shape: 'circle',
    color: '#ffd700',
    glowIntensity: 1.5
  },

  // 薄壳效果
  shellEffect: {
    enabled: false,
    opacity: 0.15,
    fresnelPower: 2.0,
    fresnelIntensity: 1.0,
    color: '#ffd700',
    doubleSided: false
  },

  // 变换
  rotationSpeed: 0.2,
  rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
  tilt: { ...DEFAULT_TILT_SETTINGS },

  // 有机化动画
  organicAnimation: {
    breathingEnabled: false,
    breathingSpeed: 1.0,
    breathingIntensity: 0.05,
    noiseEnabled: false,
    noiseAmplitude: 0.02,
    noiseFrequency: 1.0,
    noiseSpeed: 0.5
  },

  // 光流巡游效果
  lightFlow: {
    enabled: false,
    color: '#ffffff',
    speed: 1.0,
    length: 0.15,
    intensity: 2.0,
    count: 3,
    // 巡游增强
    pathMode: 'euler' as const,
    eulerMode: 'autoAugment' as const,
    phaseMode: 'spread' as const,
    trailEnabled: true,
    trailLength: 0.3,
    pulseEnabled: false,
    pulseSpeed: 2.0,
    // 随机游走参数
    noBacktrack: true,
    coverageWeight: 1.0,
    angleWeight: 0.5,
    // 顶点停靠
    dwellEnabled: false,
    dwellThreshold: 4,
    dwellDuration: 0.3,
    dwellCooldown: 1.0,
    dwellPulseIntensity: 2.0,
    // 拥堵避免
    minPacketSpacing: 0.1
  },

  // 边呼吸效果
  edgeBreathing: {
    enabled: false,
    speed: 0.5,
    widthAmplitude: 0.2,
    glowAmplitude: 0.4,
    alphaAmplitude: 0.15,
    noiseMix: 0.3,
    noiseScale: 2.0,
    noiseSpeed: 0.3
  },

  // 球面Voronoi
  sphericalVoronoi: {
    enabled: false,
    cellCount: 12,
    seedDistribution: 'fibonacci' as const,
    lineWidth: 2.0,
    lineColor: '#00ffff',
    lineGlow: 1.0,
    fillEnabled: false,
    fillOpacity: 0.2,
    colorMode: 'gradient' as const,
    baseHue: 180,
    hueSpread: 0.3,
    animateSeeds: false,
    seedSpeed: 0.2,
    seedNoiseScale: 1.0,
    cellPulse: false,
    cellPulseSpeed: 1.0
  },

  // 后期效果
  postEffects: {
    bloomEnabled: true,
    bloomThreshold: 0.3,
    bloomIntensity: 1.0,
    bloomRadius: 0.5,
    // 色差
    chromaticAberrationEnabled: false,
    chromaticAberrationIntensity: 0.01,
    // 暗角
    vignetteEnabled: false,
    vignetteIntensity: 0.5,
    vignetteRadius: 0.8
  },

  // 混合
  blendMode: 'additive',
  globalOpacity: 1.0
});

// 默认旋转流萤配置
export const createDefaultOrbitingFirefly = (id: string, name: string = '旋转流萤'): OrbitingFireflySettings => ({
  id,
  name,
  enabled: true,
  // 轨道
  absoluteOrbitRadius: 200,
  orbitSpeed: 0.5,
  orbitAxis: { axis: 'y', angle: 0, isCustom: false },
  initialPhase: 0,
  billboardOrbit: false,
  // 外观
  size: 8,
  color: '#ffff88',
  brightness: 1.5,
  headStyle: 'flare',
  headTexture: '',
  // 星芒参数
  flareIntensity: 1.0,
  flareLeaves: 4,
  flareWidth: 0.5,
  chromaticAberration: 0.3,
  // 动态效果
  velocityStretch: 0.0,
  noiseAmount: 0.2,
  // 通用
  glowIntensity: 0.5,
  pulseSpeed: 1.0,
  // 拖尾
  trailEnabled: true,
  trailLength: 50,
  trailTaperPower: 1.0,
  trailOpacity: 0.8,
  // 轨道半径波动
  radiusWave: {
    enabled: false,
    amplitude: 20,    // 波动幅度（像素单位）
    frequency: 0.5,
    randomPhase: true,
    waveType: 'sine' as const  // 波形类型：正弦/三角
  }
});

// 默认游走流萤组配置
export const createDefaultWanderingGroup = (id: string, name: string = '游走流萤组'): WanderingFireflyGroupSettings => ({
  id,
  name,
  enabled: true,
  count: 10,
  // 游走边界
  innerRadius: 1.5,
  outerRadius: 4,
  // 运动
  speed: 0.5,
  turnFrequency: 0.3,
  // 外观
  size: 5,
  color: '#88ff88',
  brightness: 1.0,
  headStyle: 'flare',
  headTexture: '',
  // 星芒参数
  flareIntensity: 1.0,
  flareLeaves: 4,
  flareWidth: 0.5,
  chromaticAberration: 0.3,
  // 动态效果
  velocityStretch: 0.5,
  noiseAmount: 0.2,
  // 通用
  glowIntensity: 0.5,
  pulseSpeed: 1.5,
  // 拖尾
  trailTaperPower: 1.0,
  trailOpacity: 0.8
});

// ==================== 法阵配置 ====================

// 法阵贴图分类配置
export type MagicTextureCategory = 'cute' | 'magic_circle' | 'star' | 'rings' | 'myth';

export const MAGIC_TEXTURE_CATEGORIES: { key: MagicTextureCategory; label: string; icon: string }[] = [
  { key: 'cute', label: '萌物', icon: '🐱' },
  { key: 'magic_circle', label: '法阵', icon: '🔮' },
  { key: 'star', label: '星空', icon: '⭐' },
  { key: 'rings', label: '光环', icon: '💫' },
  { key: 'myth', label: '神兽', icon: '🐉' },
];

// 各分类的贴图列表（从自动生成的 JSON 读取）
export const MAGIC_CIRCLE_TEXTURES_BY_CATEGORY: Record<MagicTextureCategory, { value: string; label: string }[]> =
  magicTexturesData.textures as Record<MagicTextureCategory, { value: string; label: string }[]>;

// 所有贴图的扁平列表（用于兼容旧代码）
export const MAGIC_CIRCLE_TEXTURES = Object.values(MAGIC_CIRCLE_TEXTURES_BY_CATEGORY).flat();

/*
 * 贴图列表通过 npm run generate 自动从 public/magic 目录扫描生成
 * 添加/删除图片后，重新启动 npm run dev 即可自动更新
 */

// 创建默认法阵配置
export const createDefaultMagicCircle = (id: string, name: string = '1'): MagicCircleSettings => ({
  id,
  name,
  enabled: true,
  texture: '/magic/cute/circle01.png',
  yOffset: 0,
  radius: 150,
  rotationSpeed: 0.5,
  opacity: 0.8,
  hueShift: 0,
  baseHue: 200,
  baseSaturation: 1.0,
  saturationBoost: 1.0,
  brightness: 1.0,
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  tilt: { ...DEFAULT_TILT_SETTINGS },
  // 脉冲发光
  pulseEnabled: false,
  pulseSpeed: 1.0,
  pulseIntensity: 0.3,
  // 缩放呼吸
  breathEnabled: false,
  breathSpeed: 0.5,
  breathIntensity: 0.1
});

// 默认核心配置
export const createDefaultCore = (id: string, name: string = '核心'): PlanetCoreSettings => ({
  id,
  name,
  enabled: true,
  fillMode: PlanetFillMode.Shell,
  fillPercent: 0,
  density: 1.5,
  baseRadius: 100,
  baseHue: 200,
  baseSaturation: 1.0,
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  rotationSpeed: 0.3,
  rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
  trailLength: 0,
  brightness: 1.0,
  particleSize: 1.0
});

// ==================== 实体核心配置 ====================

// 辅助函数：HSL 转 Hex
function hslToHex(h: number, s: number, l: number): string {
  const hue = h * 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// 创建默认颜色设置
const createDefaultSolidCoreColor = (baseColor: string): SolidCoreColorSettings => ({
  mode: 'none',
  baseColor,
  colors: [baseColor, '#ffffff'],
  colorMidPosition: 0.5,
  direction: 'radial',
  directionCustom: { x: 0, y: 1, z: 0 },
  spiralDensity: 3,
  proceduralIntensity: 1.0
});

// 实体核心预设参数
export const SOLID_CORE_PRESETS: Record<SolidCorePresetType, Omit<SolidCoreSettings, 'enabled' | 'id' | 'name'>> = {
  // 盖亚 (Gaia) - 蓝绿交织类地行星
  gaia: {
    radius: 110,
    surfaceColor: { mode: 'procedural', baseColor: '#0066aa', colors: ['#004488', '#22aa66', '#ffffff'], colorMidPosition: 0.45, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 2, proceduralIntensity: 1.5 },
    scale: 2.5,
    speed: 0.1,
    contrast: 1.2,
    bandMix: 0.5,
    ridgeMix: 1.0,
    gridMix: 0.0,
    crackEnabled: true,
    crackScale: 3.0,
    crackThreshold: 0.6,
    crackFeather: 0.1,
    crackWarp: 0.5,
    crackWarpScale: 1.5,
    crackFlowSpeed: 0.05,
    crackColor1: '#002244',
    crackColor2: '#004488',
    crackEmission: 0.5,
    emissiveStrength: 0.2,
    multiFreqEnabled: true,
    warpIntensity: 0.3,
    warpScale: 1.0,
    detailBalance: 0.6,
    bumpEnabled: true,
    bumpStrength: 0.8,
    specularStrength: 1.5,
    specularColor: '#aaddff',
    roughness: 20,
    lightEnabled: true,
    lightDirection: { x: -0.5, y: 0.5, z: 1.0 },
    lightColor: '#ffffff',
    lightIntensity: 1.2,
    lightAmbient: 0.3,
    hotspotEnabled: false,
    hotspotCount: 0,
    hotspotSize: 0.1,
    hotspotPulseSpeed: 1.0,
    hotspotColor: '#ffffff',
    hotspotEmission: 0,
    opacity: 1.0,
    brightness: 1.0,
    rotationSpeed: 0.15,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS, preset: 'tiltY45' },
    glowEnabled: true,
    glowColor: { mode: 'twoColor', baseColor: '#0088ff', colors: ['#0088ff', '#00ffaa'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    glowLength: 2.0,
    glowStrength: 1.2,
    glowRadius: 0.05,
    glowFalloff: 2.5,
    glowInward: false,
    glowBloomBoost: 1.0,
    preset: 'gaia'
  },
  // 赫菲斯托斯 (Hephaestus) - 裂隙熔岩星球
  hephaestus: {
    radius: 105,
    surfaceColor: { mode: 'twoColor', baseColor: '#220000', colors: ['#440000', '#220000'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    scale: 3.0,
    speed: 0.05,
    contrast: 1.5,
    bandMix: 0.0,
    ridgeMix: 0.8,
    gridMix: 0.0,
    crackEnabled: true,
    crackScale: 5.0,
    crackThreshold: 0.45,
    crackFeather: 0.05,
    crackWarp: 0.2,
    crackWarpScale: 2.0,
    crackFlowSpeed: 0.4,
    crackColor1: '#ffff00',
    crackColor2: '#ff4400',
    crackEmission: 3.5,
    emissiveStrength: 0.5,
    multiFreqEnabled: false,
    warpIntensity: 0.1,
    warpScale: 1.0,
    detailBalance: 0.4,
    bumpEnabled: true,
    bumpStrength: 1.0,
    specularStrength: 0.5,
    specularColor: '#ff8844',
    roughness: 60,
    lightEnabled: true,
    lightDirection: { x: 1, y: 1, z: 0.5 },
    lightColor: '#ffaa66',
    lightIntensity: 0.8,
    lightAmbient: 0.1,
    hotspotEnabled: true,
    hotspotCount: 3,
    hotspotSize: 0.12,
    hotspotPulseSpeed: 2.0,
    hotspotColor: '#ffcc00',
    hotspotEmission: 4.0,
    opacity: 1.0,
    brightness: 1.1,
    rotationSpeed: 0.05,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#ff3300'),
    glowLength: 3.0,
    glowStrength: 1.5,
    glowRadius: 0.02,
    glowFalloff: 1.5,
    glowInward: false,
    glowBloomBoost: 2.0,
    preset: 'hephaestus'
  },
  // 冰封王座 (Frozen Throne) - 纯净高反光冰蓝表面
  frozenThrone: {
    radius: 100,
    surfaceColor: { mode: 'twoColor', baseColor: '#aaddff', colors: ['#ffffff', '#88ccff'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    scale: 1.5,
    speed: 0.0,
    contrast: 0.8,
    bandMix: 0.0,
    ridgeMix: 1.2,
    gridMix: 0.0,
    crackEnabled: true,
    crackScale: 2.0,
    crackThreshold: 0.95,
    crackFeather: 0.01,
    crackWarp: 0.1,
    crackWarpScale: 1.0,
    crackFlowSpeed: 0.0,
    crackColor1: '#ffffff',
    crackColor2: '#ffffff',
    crackEmission: 1.0,
    emissiveStrength: 0.2,
    multiFreqEnabled: true,
    warpIntensity: 0.1,
    warpScale: 2.0,
    detailBalance: 0.2,
    bumpEnabled: true,
    bumpStrength: 0.4,
    specularStrength: 2.5,
    specularColor: '#ffffff',
    roughness: 5,
    lightEnabled: true,
    lightDirection: { x: -1, y: 0.5, z: 1 },
    lightColor: '#eefaff',
    lightIntensity: 1.2,
    lightAmbient: 0.4,
    hotspotEnabled: false,
    hotspotCount: 0,
    hotspotSize: 0.1,
    hotspotPulseSpeed: 1.0,
    hotspotColor: '#ffffff',
    hotspotEmission: 0,
    opacity: 0.95,
    brightness: 1.3,
    rotationSpeed: 0.02,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#ccffff'),
    glowLength: 5.0,
    glowStrength: 1.2,
    glowRadius: 0.1,
    glowFalloff: 1.5,
    glowInward: false,
    glowBloomBoost: 2.5,
    preset: 'frozenThrone'
  },
  // 气态巨擘 (Gas Giant) - 黄褐色风暴眼条纹
  gasGiant: {
    radius: 120,
    surfaceColor: { mode: 'procedural', baseColor: '#ccaa66', colors: ['#eebb77', '#aa8855', '#cc9966'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 2.0 },
    scale: 0.5,
    speed: 1.5,
    contrast: 1.1,
    bandMix: 2.0,
    ridgeMix: 0.0,
    gridMix: 0.0,
    crackEnabled: false,
    crackScale: 4.0,
    crackThreshold: 0.5,
    crackFeather: 0.1,
    crackWarp: 0.5,
    crackWarpScale: 1.5,
    crackFlowSpeed: 0.2,
    crackColor1: '#ffffff',
    crackColor2: '#000000',
    crackEmission: 0,
    emissiveStrength: 0,
    multiFreqEnabled: true,
    warpIntensity: 0.8,
    warpScale: 0.5,
    detailBalance: 0.2,
    bumpEnabled: false,
    bumpStrength: 0.1,
    specularStrength: 0.1,
    specularColor: '#ffeecc',
    roughness: 100,
    lightEnabled: true,
    lightDirection: { x: 1, y: 0, z: 1 },
    lightColor: '#ffeedd',
    lightIntensity: 1.1,
    lightAmbient: 0.4,
    hotspotEnabled: true,
    hotspotCount: 1,
    hotspotSize: 0.25,
    hotspotPulseSpeed: 0.1,
    hotspotColor: '#ddaa66',
    hotspotEmission: 0.5,
    opacity: 1.0,
    brightness: 1.0,
    rotationSpeed: 0.4,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#bbaadd'),
    glowLength: 2.0,
    glowStrength: 0.6,
    glowRadius: 0.05,
    glowFalloff: 2.0,
    glowInward: true,
    glowBloomBoost: 0,
    preset: 'gasGiant'
  },
  // 戴森球 (Dyson Sphere) - 金属网格暗黑科技
  dysonSphere: {
    radius: 115,
    surfaceColor: { mode: 'none', baseColor: '#111111', colors: ['#111111', '#222222'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    scale: 4.0,
    speed: 0.0,
    contrast: 5.0,
    bandMix: 0.0,
    ridgeMix: 0.0,
    gridMix: 2.0,
    crackEnabled: true,
    crackScale: 8.0,
    crackThreshold: 0.15,
    crackFeather: 0.01,
    crackWarp: 0.0,
    crackWarpScale: 1.0,
    crackFlowSpeed: 1.0,
    crackColor1: '#00ffff',
    crackColor2: '#0088ff',
    crackEmission: 4.0,
    emissiveStrength: 0.2,
    multiFreqEnabled: false,
    warpIntensity: 0.0,
    warpScale: 1.0,
    detailBalance: 0.0,
    bumpEnabled: true,
    bumpStrength: 0.8,
    specularStrength: 1.2,
    specularColor: '#444444',
    roughness: 25,
    lightEnabled: true,
    lightDirection: { x: 0, y: 0, z: 1 },
    lightColor: '#aabbcc',
    lightIntensity: 0.8,
    lightAmbient: 0.2,
    hotspotEnabled: false,
    hotspotCount: 0,
    hotspotSize: 0.1,
    hotspotPulseSpeed: 1.0,
    hotspotColor: '#ffffff',
    hotspotEmission: 0,
    opacity: 1.0,
    brightness: 1.2,
    rotationSpeed: 0.1,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS, preset: 'tiltX45' },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#00ccff'),
    glowLength: 1.0,
    glowStrength: 1.0,
    glowRadius: 0.02,
    glowFalloff: 5.0,
    glowInward: false,
    glowBloomBoost: 2.0,
    preset: 'dysonSphere'
  },
  // 以太幻境 (Ethereal) - 半透明粉紫晶体
  ethereal: {
    radius: 90,
    surfaceColor: { mode: 'threeColor', baseColor: '#ff88ff', colors: ['#ff88ff', '#8844ff', '#ffffff'], colorMidPosition: 0.5, direction: 'spiral', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 2, proceduralIntensity: 1.0 },
    scale: 1.0,
    speed: 0.2,
    contrast: 0.8,
    bandMix: 0.2,
    ridgeMix: 0.5,
    gridMix: 0.0,
    crackEnabled: false,
    crackScale: 4.0,
    crackThreshold: 0.3,
    crackFeather: 0.1,
    crackWarp: 0.5,
    crackWarpScale: 1.5,
    crackFlowSpeed: 0.2,
    crackColor1: '#ffffff',
    crackColor2: '#ffaa00',
    crackEmission: 0,
    emissiveStrength: 3.0,
    multiFreqEnabled: true,
    warpIntensity: 0.3,
    warpScale: 1.5,
    detailBalance: 0.6,
    bumpEnabled: false,
    bumpStrength: 0.2,
    specularStrength: 1.5,
    specularColor: '#ffddff',
    roughness: 10,
    lightEnabled: false,
    lightDirection: { x: 0, y: 0, z: 1 },
    lightColor: '#ffffff',
    lightIntensity: 1.0,
    lightAmbient: 0.4,
    hotspotEnabled: true,
    hotspotCount: 4,
    hotspotSize: 0.1,
    hotspotPulseSpeed: 2.0,
    hotspotColor: '#ffffff',
    hotspotEmission: 2.0,
    opacity: 0.6,
    brightness: 1.5,
    rotationSpeed: 0.1,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#ffaaee'),
    glowLength: 10.0,
    glowStrength: 1.5,
    glowRadius: 0.2,
    glowFalloff: 1.5,
    glowInward: true,
    glowBloomBoost: 2.0,
    preset: 'ethereal'
  },
  // 默认 Core
  custom: {
    radius: 100,
    surfaceColor: createDefaultSolidCoreColor('#00aaff'),
    scale: 3.0,
    speed: 0.5,
    contrast: 1.0,
    bandMix: 0.0,
    ridgeMix: 0.0,
    gridMix: 0.0,
    crackEnabled: false,
    crackScale: 4.0,
    crackThreshold: 0.3,
    crackFeather: 0.1,
    crackWarp: 0.5,
    crackWarpScale: 1.5,
    crackFlowSpeed: 0.2,
    crackColor1: '#ffffff',
    crackColor2: '#ffaa00',
    crackEmission: 0.0,
    emissiveStrength: 0.0,
    multiFreqEnabled: false,
    warpIntensity: 0.5,
    warpScale: 1.0,
    detailBalance: 0.3,
    bumpEnabled: false,
    bumpStrength: 0.3,
    specularStrength: 1.0,
    specularColor: '#ffffff',
    roughness: 32,
    lightEnabled: false,
    lightDirection: { x: -1, y: -1, z: 1 },
    lightColor: '#ffffff',
    lightIntensity: 1.0,
    lightAmbient: 0.2,
    hotspotEnabled: false,
    hotspotCount: 4,
    hotspotSize: 0.15,
    hotspotPulseSpeed: 1.0,
    hotspotColor: '#ffff00',
    hotspotEmission: 3.0,
    opacity: 1.0,
    brightness: 1.0,
    rotationSpeed: 0.1,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    glowEnabled: true,
    glowColor: createDefaultSolidCoreColor('#00ccff'),
    glowLength: 3.0,
    glowStrength: 1.0,
    glowRadius: 0,
    glowFalloff: 2.0,
    glowInward: false,
    glowBloomBoost: 1.0,
    preset: 'custom'
  }
};

// 默认实体核心配置
export const DEFAULT_SOLID_CORE: SolidCoreSettings = {
  id: 'default-solid-core',
  name: '实体核心 1',
  enabled: true,
  ...SOLID_CORE_PRESETS.magma
};

// 创建默认实体核心
export const createDefaultSolidCore = (id: string, name: string = '实体核心'): SolidCoreSettings => ({
  id,
  name,
  enabled: true,
  ...SOLID_CORE_PRESETS.magma
});

// ========== 火焰系统预设 ==========

// 默认火焰颜色
const createDefaultFlameColor = (baseColor: string = '#ff6600'): FlameColorSettings => ({
  mode: 'twoColor',
  baseColor,
  colors: [baseColor, '#ffff00'],
  colorMidPosition: 0.5,
  colorMidWidth: 1,
  colorMidWidth2: 0,
  direction: 'radial',
  directionCustom: { x: 0, y: 1, z: 0 },
  spiralDensity: 3,
  proceduralIntensity: 1.0
});

// 表面火焰预设
export const SURFACE_FLAME_PRESETS: Record<string, Omit<SurfaceFlameSettings, 'enabled' | 'id' | 'name'>> = {
  // AT力场 (AT Field) - 波纹防御场
  atField: {
    preset: 'atField',
    radius: 120,
    thickness: 0.05,
    color: { mode: 'twoColor', baseColor: '#ffaa00', colors: ['#ff8800', '#ffff00'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    flameScale: 2.0,
    density: 0.4,
    flowSpeed: 0.1,
    turbulence: 0.0,
    noiseType: 'voronoi',
    fractalLayers: 1,
    opacity: 0.6,
    emissive: 3.0,
    bloomBoost: 2.0,
    direction: 'up',
    pulseEnabled: true,
    pulseSpeed: 3.0,
    pulseIntensity: 0.2
  },
  // 极光护盾 (Polaris Shield) - 流动色彩
  polarisShield: {
    preset: 'polarisShield',
    radius: 110,
    thickness: 0.2,
    color: { mode: 'procedural', baseColor: '#00ffaa', colors: ['#00ffff', '#00ff66', '#aa00ff'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 2.0 },
    flameScale: 1.8,
    density: 0.6,
    flowSpeed: 0.5,
    turbulence: 0.8,
    noiseType: 'simplex',
    fractalLayers: 3,
    opacity: 0.7,
    emissive: 2.0,
    bloomBoost: 1.5,
    direction: 'up',
    pulseEnabled: true,
    pulseSpeed: 0.5,
    pulseIntensity: 0.3
  },
  // 等离子壳 (Plasma Shell) - 电弧游走
  plasmaShell: {
    preset: 'plasmaShell',
    radius: 105,
    thickness: 0.1,
    color: { mode: 'twoColor', baseColor: '#8800ff', colors: ['#cc00ff', '#ffffff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    flameScale: 4.0,
    density: 0.3,
    flowSpeed: 2.0,
    turbulence: 1.5,
    noiseType: 'perlin',
    fractalLayers: 2,
    opacity: 0.8,
    emissive: 4.0,
    bloomBoost: 3.0,
    direction: 'spiral',
    pulseEnabled: false,
    pulseSpeed: 1.0,
    pulseIntensity: 0.1
  },
  // 虚数屏障 (Imaginary Wall) - 黑色网格扫描
  imaginaryWall: {
    preset: 'imaginaryWall',
    radius: 130,
    thickness: 0.02,
    color: { mode: 'twoColor', baseColor: '#000000', colors: ['#000000', '#ffffff'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    flameScale: 10.0,
    density: 0.2,
    flowSpeed: 3.0,
    turbulence: 0.0,
    noiseType: 'simplex',
    fractalLayers: 1,
    opacity: 0.5,
    emissive: 1.0,
    bloomBoost: 0.5,
    direction: 'up',
    pulseEnabled: true,
    pulseSpeed: 5.0,
    pulseIntensity: 0.1
  },
  // 神圣庇护 (Divine Aegis) - 柔和金光呼吸
  divineAegis: {
    preset: 'divineAegis',
    radius: 115,
    thickness: 0.3,
    color: { mode: 'single', baseColor: '#ffdd88', colors: ['#ffdd88'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    flameScale: 1.0,
    density: 0.9,
    flowSpeed: 0.2,
    turbulence: 0.2,
    noiseType: 'simplex',
    fractalLayers: 4,
    opacity: 0.5,
    emissive: 1.5,
    bloomBoost: 1.2,
    direction: 'up',
    pulseEnabled: true,
    pulseSpeed: 0.5,
    pulseIntensity: 0.4
  },
  // 生物膜 (Bio Membrane) - 脉动细胞纹理
  bioMembrane: {
    preset: 'bioMembrane',
    radius: 102,
    thickness: 0.1,
    color: { mode: 'threeColor', baseColor: '#ff0066', colors: ['#440022', '#ff0066', '#ff88aa'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    flameScale: 0.6,
    density: 0.8,
    flowSpeed: 0.1,
    turbulence: 0.4,
    noiseType: 'voronoi',
    fractalLayers: 2,
    opacity: 0.9,
    emissive: 1.0,
    bloomBoost: 1.0,
    direction: 'up',
    pulseEnabled: true,
    pulseSpeed: 1.2,
    pulseIntensity: 0.15
  },
  custom: {
    preset: 'custom',
    radius: 105,
    thickness: 0.15,
    color: createDefaultFlameColor('#ff6600'),
    flameScale: 1.0,
    density: 0.7,
    flowSpeed: 1.0,
    turbulence: 0.8,
    noiseType: 'simplex',
    fractalLayers: 3,
    opacity: 0.85,
    emissive: 2.0,
    bloomBoost: 1.5,
    direction: 'up',
    pulseEnabled: false,
    pulseSpeed: 1.0,
    pulseIntensity: 0.3
  }
};

// 喷发火柱预设
export const FLAME_JET_PRESETS: Record<string, Partial<FlameJetSettings>> = {
  // 太阳风暴 (Solar Storm)
  solarStorm: {
    preset: 'solarStorm',
    sourceType: 'surface',
    hotspotCount: 5,
    baseRadius: 100,
    height: 4.0,
    width: 0.8,
    spread: 35,
    particleCount: 1500,
    particleSize: 8,
    jetSpeed: 2.5,
    lifespan: 3.0,
    turbulence: 1.2,
    color: { mode: 'threeColor', baseColor: '#ff8800', colors: ['#ffff44', '#ff8800', '#ff0000'], colorMidPosition: 0.4, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.9,
    emissive: 4.0,
    bloomBoost: 3.0,
    burstMode: 'burst',
    burstInterval: 5.0,
    burstDuration: 3.0
  },
  // 深海喷泉 (Abyssal Jet)
  abyssalJet: {
    preset: 'abyssalJet',
    sourceType: 'pole',
    hotspotCount: 1,
    baseRadius: 100,
    height: 5.0,
    width: 0.5,
    spread: 10,
    particleCount: 800,
    particleSize: 12,
    jetSpeed: 0.5,
    lifespan: 5.0,
    turbulence: 0.3,
    color: { mode: 'twoColor', baseColor: '#001133', colors: ['#004488', '#000000'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.7,
    emissive: 1.5,
    bloomBoost: 1.0,
    burstMode: 'continuous',
    burstInterval: 0,
    burstDuration: 0
  },
  // 曲率引擎 (Warp Drive)
  warpDrive: {
    preset: 'warpDrive',
    sourceType: 'equator',
    hotspotCount: 2,
    baseRadius: 100,
    height: 8.0,
    width: 0.2,
    spread: 2,
    particleCount: 2000,
    particleSize: 2,
    jetSpeed: 5.0,
    lifespan: 1.5,
    turbulence: 0.05,
    color: { mode: 'procedural', baseColor: '#ffffff', colors: ['#ff0000', '#00ff00', '#0000ff'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 5, proceduralIntensity: 2.0 },
    opacity: 1.0,
    emissive: 5.0,
    bloomBoost: 4.0,
    burstMode: 'continuous',
    burstInterval: 0,
    burstDuration: 0
  },
  // 孢子扩散 (Spore Spread)
  sporeSpread: {
    preset: 'sporeSpread',
    sourceType: 'surface',
    hotspotCount: 10,
    baseRadius: 100,
    height: 2.0,
    width: 0.6,
    spread: 60,
    particleCount: 500,
    particleSize: 4,
    jetSpeed: 0.3,
    lifespan: 4.0,
    turbulence: 1.5,
    color: { mode: 'threeColor', baseColor: '#88ff88', colors: ['#ccffcc', '#ff88aa', '#8844ff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.6,
    emissive: 2.0,
    bloomBoost: 1.5,
    burstMode: 'burst',
    burstInterval: 3.0,
    burstDuration: 1.0
  },
  // 引力漏斗 (Gravity Leak)
  gravityLeak: {
    preset: 'gravityLeak',
    sourceType: 'pole',
    hotspotCount: 1,
    baseRadius: 100,
    height: 3.0,
    width: 1.0,
    spread: 0,
    particleCount: 1000,
    particleSize: 3,
    jetSpeed: 1.0,
    lifespan: 2.5,
    turbulence: 0.8,
    color: { mode: 'twoColor', baseColor: '#440088', colors: ['#8800ff', '#000000'], colorMidPosition: 0.5, direction: 'spiral', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 4, proceduralIntensity: 1.0 },
    opacity: 0.8,
    emissive: 2.5,
    bloomBoost: 2.0,
    burstMode: 'continuous',
    burstInterval: 0,
    burstDuration: 0
  },
  // 龙息 (Dragon Breath)
  dragonBreath: {
    preset: 'dragonBreath',
    sourceType: 'hotspots',
    hotspotCount: 1,
    baseRadius: 100,
    height: 4.0,
    width: 0.5,
    spread: 25,
    particleCount: 1200,
    particleSize: 6,
    jetSpeed: 2.0,
    lifespan: 2.0,
    turbulence: 1.0,
    color: { mode: 'threeColor', baseColor: '#aa0000', colors: ['#ff0000', '#000000', '#444444'], colorMidPosition: 0.3, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.85,
    emissive: 3.0,
    bloomBoost: 1.5,
    burstMode: 'burst',
    burstInterval: 4.0,
    burstDuration: 2.0
  },
  custom: {
    preset: 'custom',
    sourceType: 'hotspots',
    hotspotCount: 4,
    baseRadius: 100,
    height: 2.0,
    width: 0.3,
    spread: 15,
    particleCount: 500,
    particleSize: 5,
    jetSpeed: 1.0,
    lifespan: 2.0,
    turbulence: 0.5,
    color: createDefaultFlameColor('#ff4400'),
    opacity: 0.9,
    emissive: 2.5,
    bloomBoost: 1.5,
    burstMode: 'continuous',
    burstInterval: 2.0,
    burstDuration: 1.0
  }
};

// 螺旋火焰预设
export const SPIRAL_FLAME_PRESETS: Record<string, Partial<SpiralFlameSettings>> = {
  // 基因螺旋 (Gene Helix) - DNA双螺旋
  geneHelix: {
    preset: 'geneHelix',
    spiralCount: 2,
    direction: 'both',
    baseRadius: 105,
    startRadius: 1.15,
    endRadius: 1.15,
    height: 380,
    pitch: 0.28,
    thickness: 0.06,
    rotationSpeed: 0.45,
    riseSpeed: 0.25,
    renderType: 'ribbon',
    particleCount: 1400,
    particleSize: 4.5,
    color: { mode: 'twoColor', baseColor: '#44ddff', colors: ['#44ddff', '#ff44aa'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.92,
    emissive: 2.2,
    bloomBoost: 1.6
  },
  // 凤凰升腾 (Phoenix Rise) - 火焰鳞片
  phoenixRise: {
    preset: 'phoenixRise',
    spiralCount: 1,
    direction: 'cw',
    baseRadius: 100,
    startRadius: 1.05,
    endRadius: 2.2,
    height: 420,
    pitch: 0.55,
    thickness: 0.22,
    rotationSpeed: 1.0,
    riseSpeed: 0.9,
    renderType: 'particles',
    particleCount: 2200,
    particleSize: 5.5,
    color: { mode: 'threeColor', baseColor: '#ffcc00', colors: ['#ffee44', '#ff5500', '#cc0000'], colorMidPosition: 0.35, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.2 },
    opacity: 1.0,
    emissive: 4.0,
    bloomBoost: 2.2
  },
  // 飓风之眼 (Hurricane Eye) - 气流旋涡
  hurricaneEye: {
    preset: 'hurricaneEye',
    spiralCount: 3,
    direction: 'ccw',
    baseRadius: 95,
    startRadius: 2.8,
    endRadius: 0.4,
    height: 180,
    pitch: 0.45,
    thickness: 0.18,
    rotationSpeed: 2.8,
    riseSpeed: 0.08,
    renderType: 'particles',
    particleCount: 2800,
    particleSize: 2.2,
    color: { mode: 'twoColor', baseColor: '#dddddd', colors: ['#ffffff', '#99aacc'], colorMidPosition: 0.5, direction: 'linearY', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.55,
    emissive: 1.2,
    bloomBoost: 0.9
  },
  // 暗影荆棘 (Shadow Thorns) - 紫色暗黑
  shadowThorns: {
    preset: 'shadowThorns',
    spiralCount: 4,
    direction: 'cw',
    baseRadius: 115,
    startRadius: 1.08,
    endRadius: 3.2,
    height: 320,
    pitch: 0.85,
    thickness: 0.025,
    rotationSpeed: 0.18,
    riseSpeed: 0.08,
    renderType: 'ribbon',
    particleCount: 1100,
    particleSize: 3.2,
    color: { mode: 'twoColor', baseColor: '#550099', colors: ['#9922ff', '#220033'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 0.82,
    emissive: 1.6,
    bloomBoost: 1.3
  },
  // 星河旋臂 (Galaxy Spiral) - 宏大银河
  galaxySpiral: {
    preset: 'galaxySpiral',
    spiralCount: 2,
    direction: 'ccw',
    baseRadius: 0,
    startRadius: 0.08,
    endRadius: 6.5,
    height: 45,
    pitch: 0.08,
    thickness: 0.55,
    rotationSpeed: 0.25,
    riseSpeed: 0.04,
    renderType: 'particles',
    particleCount: 3500,
    particleSize: 2.8,
    color: { mode: 'procedural', baseColor: '#bb55ff', colors: ['#22aaff', '#ff22ff', '#ffffee'], colorMidPosition: 0.5, direction: 'spiral', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 5, proceduralIntensity: 2.5 },
    opacity: 0.75,
    emissive: 2.8,
    bloomBoost: 2.2
  },
  // 能量钻头 (Energy Drill) - 金属高速
  energyDrill: {
    preset: 'energyDrill',
    spiralCount: 1,
    direction: 'cw',
    baseRadius: 55,
    startRadius: 0.08,
    endRadius: 4.2,
    height: 320,
    pitch: 0.12,
    thickness: 0.12,
    rotationSpeed: 4.5,
    riseSpeed: 2.2,
    renderType: 'ribbon',
    particleCount: 1600,
    particleSize: 3.2,
    color: { mode: 'single', baseColor: '#ffaa22', colors: ['#ffaa22'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 },
    opacity: 1.0,
    emissive: 4.5,
    bloomBoost: 3.0
  },
  custom: {
    preset: 'custom',
    spiralCount: 2,
    direction: 'cw',
    baseRadius: 100,
    startRadius: 1.1,
    endRadius: 1.5,
    height: 200,
    pitch: 0.5,
    thickness: 0.1,
    rotationSpeed: 1.0,
    riseSpeed: 0.5,
    renderType: 'particles',
    particleCount: 1000,
    particleSize: 4,
    color: createDefaultFlameColor('#ff6600'),
    opacity: 0.85,
    emissive: 2.0,
    bloomBoost: 1.5
  }
};

// 创建默认表面火焰
export const createDefaultSurfaceFlame = (id: string, name: string = '表面火焰'): SurfaceFlameSettings => ({
  id,
  name,
  enabled: true,
  ...SURFACE_FLAME_PRESETS.classic
});

// 创建默认喷发火柱
export const createDefaultFlameJet = (id: string, name: string = '火焰喷发'): FlameJetSettings => ({
  id,
  name,
  enabled: true,
  preset: 'default',
  sourceType: 'hotspots',
  hotspotCount: 4,
  baseRadius: 100,
  height: 2.0,
  width: 0.3,
  spread: 15,
  particleCount: 500,
  particleSize: 5,
  jetSpeed: 1.0,
  lifespan: 2.0,
  turbulence: 0.5,
  burstMode: 'continuous',
  burstInterval: 2.0,
  burstDuration: 1.0,
  color: createDefaultFlameColor('#ff4400'),
  opacity: 0.9,
  emissive: 2.5,
  bloomBoost: 1.5
});

// 创建默认螺旋火焰
export const createDefaultSpiralFlame = (id: string, name: string = '螺旋火焰'): SpiralFlameSettings => ({
  id,
  name,
  enabled: true,
  preset: 'default',
  spiralCount: 2,
  direction: 'cw',
  baseRadius: 100,
  startRadius: 1.1,
  endRadius: 1.5,
  height: 200,
  pitch: 0.5,
  thickness: 0.1,
  rotationSpeed: 1.0,
  riseSpeed: 0.5,
  renderType: 'particles',
  particleCount: 1000,
  particleSize: 4,
  color: createDefaultFlameColor('#ff6600'),
  opacity: 0.85,
  emissive: 2.0,
  bloomBoost: 1.5
});

// 默认火焰系统
export const DEFAULT_FLAME_SYSTEM: FlameSystemSettings = {
  enabled: true,
  surfaceFlames: [],
  flameJets: [],
  spiralFlames: []
};

// ==================== 残影系统默认值 ====================

// 默认残影区域
export const createDefaultAfterimageZone = (id: string, name: string = '残影区域'): AfterimageZoneSettings => ({
  id,
  name,
  enabled: true,

  // 区域定位
  startAngle: 45,
  angleSpan: 90,

  // 侧边界
  sideLineType: 'straight',
  sideLineLength: 2.0,
  sideLineAngle: 90,
  curveBendDirection: 'outward',
  curveBendStrength: 0.5,

  // 外边界
  outerBoundaryShape: 0,  // 圆弧

  // 羽化
  featherInner: 0.2,
  featherOuter: 0.3,
  featherSide: 0.2,

  // 反选
  inverted: false
});

// 默认残影粒子设置
export const DEFAULT_AFTERIMAGE_PARTICLES: AfterimageParticleSettings = {
  enabled: true,
  speed: 2.0,
  speedRandomness: 0.2,
  density: 100,
  size: 8,
  sizeDecay: 'linear',
  lifespan: 2.0,
  fadeOutCurve: 'quadratic',
  colorMode: 'gradient',
  colors: ['#ff4400', '#ffff00']
};

// 默认残影纹路设置（流动火焰效果）
export const DEFAULT_AFTERIMAGE_TEXTURE: AfterimageTextureSettings = {
  enabled: false,
  // 纹理模式
  textureMode: 'flow',
  // 流动效果
  flowSpeed: 0.5,
  noiseScale: 1.0,
  stretchFactor: 2.0,
  // 条纹效果（默认关闭）
  stripeIntensity: 0,
  stripeCount: 8,
  directionalStretch: 1,
  edgeSharpness: 0,
  distortion: 0,
  // 能量罩参数
  energyFlameScale: 2.0,
  energyDensity: 0.5,
  energyFlowSpeed: 0.5,
  energyTurbulence: 0.5,
  energyNoiseType: 'simplex',
  energyFractalLayers: 3,
  energyDirection: 'up',
  energyPulseEnabled: false,
  energyPulseSpeed: 1.0,
  energyPulseIntensity: 0.3,
  // 外观
  opacity: 0.8,
  colors: ['#ff00ff', '#ff66ff', '#ffffff']  // 粉紫渐变
};

// 默认残影系统（包含一个默认区域）
export const DEFAULT_AFTERIMAGE_SYSTEM: AfterimageSystemSettings = {
  enabled: false,
  zones: [createDefaultAfterimageZone('default_zone', '默认区域')],
  particles: { ...DEFAULT_AFTERIMAGE_PARTICLES },
  texture: { ...DEFAULT_AFTERIMAGE_TEXTURE },
  outsideClearSpeed: 3
};

// 默认粒子环绕配置
export const createDefaultOrbiting = (id: string, name: string = '粒子环绕'): OrbitingParticlesSettings => ({
  id,
  name,
  enabled: true,
  particleDensity: 1,
  orbitRadius: 1.2,
  thickness: 50,
  color: '#aaccff',
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  fadeWithDistance: true,
  fadeStrength: 0.5,
  baseSpeed: 0.5,
  mainDirection: { x: 0, y: 1, z: 0 },
  turbulence: 0.3,
  turbulenceScale: 0.5,
  brightness: 1.0,
  particleSize: 1.0
});

// 默认粒子喷射配置
export const createDefaultEmitter = (id: string, name: string = '粒子喷射'): ParticleEmitterSettings => ({
  id,
  name,
  enabled: true,
  emissionRangeMin: 1.0,
  emissionRangeMax: 3.0,
  birthRate: 100,
  lifeSpan: 2,
  initialSpeed: 50,
  drag: 0.95,
  color: '#ffaa00',
  gradientColor: { ...DEFAULT_GRADIENT_COLOR },
  fadeOutStrength: 0.5,
  particleSize: 2,
  brightness: 1.0
});

// 默认公转配置
export const DEFAULT_ORBIT_SETTINGS: OrbitSettings = {
  enabled: false,
  targetPlanetId: null,
  orbitRadius: 200,
  orbitSpeed: 0.3,
  eccentricity: 0,
  tilt: { ...DEFAULT_TILT_SETTINGS },
  initialPhase: 0
};

// 创建默认星球配置
export const createDefaultPlanet = (id: string, name: string = '新星球'): PlanetSettings => ({
  id,
  name,
  enabled: true,
  position: { x: 0, y: 0, z: 0 },
  scale: 1,
  orbit: { ...DEFAULT_ORBIT_SETTINGS },
  coreSystem: {
    coresEnabled: true,
    solidCoresEnabled: true,
    coreType: 'particle' as CoreType,
    cores: [
      { ...createDefaultCore('default-core', '默认核心'), enabled: true }
    ],
    solidCores: [
      { ...DEFAULT_SOLID_CORE }
    ]
  },
  flameSystem: { ...DEFAULT_FLAME_SYSTEM },
  afterimageSystem: { ...DEFAULT_AFTERIMAGE_SYSTEM },
  rings: {
    particleRingsEnabled: true,
    continuousRingsEnabled: true,
    particleRings: [
      { ...createDefaultParticleRing('default-particle-ring', '默认粒子环'), enabled: false }
    ],
    continuousRings: [
      { ...createDefaultContinuousRing('default-continuous-ring', '默认环带'), enabled: false }
    ]
  },
  radiation: {
    orbitingEnabled: true,
    emitterEnabled: true,
    orbitings: [
      { ...createDefaultOrbiting('default-orbiting', '默认粒子环绕'), enabled: false }
    ],
    emitters: [
      { ...createDefaultEmitter('default-emitter', '默认粒子喷射'), enabled: false }
    ]
  },
  fireflies: {
    orbitingEnabled: true,
    wanderingEnabled: true,
    orbitingFireflies: [
      { ...createDefaultOrbitingFirefly('default-orbiting-firefly', '默认旋转流萤'), enabled: false }
    ],
    wanderingGroups: [
      { ...createDefaultWanderingGroup('default-wandering-group', '默认飞舞流萤组'), enabled: false }
    ]
  },
  magicCircles: {
    enabled: true,
    circles: []
  },
  energyBodySystem: {
    enabled: true,
    energyBodies: []
  }
});

// 默认星球场景设置
export const DEFAULT_PLANET_SCENE_SETTINGS: PlanetSceneSettings = {
  enabled: false,
  planets: [],
  // 背景设置
  background: {
    enabled: false,
    panoramaUrl: '/background/starfield.jpg',  // 默认全景图（需要用户自己放置）
    brightness: 0.5,  // 默认降低亮度，避免喧宾夺主
    saturation: 1.0,  // 默认饱和度
    rotation: 0
  },
  // 视觉效果
  bloomStrength: 0.4,
  trailEnabled: false,
  trailLength: 0.3,
  // 动态效果
  breathingEnabled: false,
  breathingSpeed: 0.5,
  breathingIntensity: 0.15,
  flickerEnabled: false,
  flickerIntensity: 0.3,
  flickerSpeed: 2.0,
  wanderingLightningEnabled: false,
  wanderingLightningIntensity: 0.5,
  wanderingLightningSpeed: 1.0,
  wanderingLightningDensity: 3,
  wanderingLightningWidth: 5,
  lightningBreakdownEnabled: false,
  lightningBreakdownIntensity: 0.7,
  lightningBreakdownFrequency: 0.5,
  lightningBreakdownBranches: 2,

  // ===== 上升效果 =====
  // 璀璨星雨
  starRainEnabled: false,
  starRainCount: 300,
  starRainSize: 2,
  starRainSpeed: 1.0,
  starRainSpeedVariation: 0.5,
  starRainHeight: 300,
  starRainSpread: 150,
  starRainColor: '#88ccff',
  starRainTrailLength: 0.4,
  starRainBrightness: 1.5,
  starRainReverse: false,
  starRainHeadStyle: 'plain',

  // 体积薄雾
  volumeFogEnabled: false,
  volumeFogLayers: 5,
  volumeFogInnerRadius: 50,
  volumeFogOuterRadius: 180,
  volumeFogHeight: 120,
  volumeFogOpacity: 0.12,
  volumeFogColor: '#4488cc',
  volumeFogSpeed: 0.3,

  // 光球灯笼
  lightOrbsEnabled: false,
  lightOrbsMaxCount: 5,
  lightOrbsSpawnRate: 2.5,
  lightOrbsSize: 12,
  lightOrbsGrowth: 2.0,
  lightOrbsSpeed: 0.6,
  lightOrbsHeight: 250,
  lightOrbsColor: '#aaddff',
  lightOrbsGlow: 2.5,
  lightOrbsBurst: true,

  // 交互 - 超新星爆发
  explosionExpansion: 300,
  explosionTurbulence: 80,
  explosionRotation: 0.4,
  explosionSizeBoost: 8,
  explosionRecoverySpeed: 0.15,
  // 交互 - 黑洞效果
  blackHoleCompression: 0.05,
  blackHoleSpinSpeed: 400,
  blackHoleTargetRadius: 30,
  blackHolePull: 0.95,
  blackHoleRecoverySpeed: 0.15,
  // 相机
  cameraAutoRotate: false,
  cameraAutoRotateSpeed: 0.5
};

// 星球场景本地存储键名
export const PLANET_SCENE_STORAGE_KEY = 'nebula-viz-planet-scene';
export const PLANET_TEMPLATES_STORAGE_KEY = 'nebula-viz-planet-templates';
export const PLANET_SCENES_STORAGE_KEY = 'nebula-viz-saved-scenes';

// 星球数量上限
export const MAX_PLANETS = 5;

// 性能警告阈值（粒子数）
export const PLANET_PARTICLE_WARNING_THRESHOLD = 50000;

// ==================== 背景图配置 ====================

// 背景图列表 - 添加新图片后需要在此处添加对应条目
// 图片路径格式：/background/文件名.扩展名
export const BACKGROUND_IMAGES: { value: string; label: string }[] = [
  { value: '/background/starfield.jpg', label: '星空 1' },
  { value: '/background/starfield1.jpg', label: '星空 2' },
  { value: '/background/starfield2.jpg', label: '星空 3' },
];

// ==================== 模块预设 ====================

// 粒子核心预设 - 全新美学设计
export const PARTICLE_CORE_PRESETS = {
  // 深空靛蓝 (Deep Space Indigo) - 宁静深邃
  deepSpaceBlue: {
    fillMode: 'solid' as const,
    fillPercent: 95,
    density: 1.8,
    baseRadius: 100,
    baseHue: 230,
    baseSaturation: 0.7,
    brightness: 2.0,
    particleSize: 1.8,
    gradientColor: { enabled: true, mode: 'twoColor' as const, colors: ['#0a1628', '#4a7fff'], colorMidPosition: 0.6, colorMidWidth: 0.5, colorMidWidth2: 0, direction: 'radial' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 2, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1 },
    trailLength: 0.3
  },
  // 熔岩之心 (Molten Heart) - 炽热燃烧
  moltenLava: {
    fillMode: 'solid' as const,
    fillPercent: 92,
    density: 2.0,
    baseRadius: 90,
    baseHue: 15,
    baseSaturation: 1.0,
    brightness: 2.8,
    particleSize: 2.5,
    gradientColor: { enabled: true, mode: 'threeColor' as const, colors: ['#1a0500', '#ff4400', '#ffcc00'], colorMidPosition: 0.5, colorMidWidth: 0.7, colorMidWidth2: 0, direction: 'radial' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1.5 },
    trailLength: 0.5
  },
  // 翡翠幻境 (Emerald Dream) - 清新自然
  emeraldDream: {
    fillMode: 'solid' as const,
    fillPercent: 88,
    density: 1.5,
    baseRadius: 110,
    baseHue: 140,
    baseSaturation: 0.8,
    brightness: 1.8,
    particleSize: 2.0,
    gradientColor: { enabled: true, mode: 'procedural' as const, colors: ['#0a2810', '#00ff66', '#88ffcc'], colorMidPosition: 0.5, colorMidWidth: 0.8, colorMidWidth2: 0, direction: 'spiral' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 4, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 2.0 },
    trailLength: 0.4
  },
  // 虹彩幻影 (Prismatic Aurora) - 缤纷绚丽
  prismRainbow: {
    fillMode: 'solid' as const,
    fillPercent: 90,
    density: 1.6,
    baseRadius: 105,
    baseHue: 280,
    baseSaturation: 0.9,
    brightness: 2.2,
    particleSize: 1.6,
    gradientColor: { enabled: true, mode: 'procedural' as const, colors: ['#ff0066', '#00ffff', '#ffff00'], colorMidPosition: 0.5, colorMidWidth: 1.0, colorMidWidth2: 0, direction: 'spiral' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 6, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 3.0 },
    trailLength: 0.2
  },
  // 宇宙紫晶 (Cosmic Amethyst) - 神秘高贵
  cosmicPurple: {
    fillMode: 'solid' as const,
    fillPercent: 94,
    density: 2.2,
    baseRadius: 95,
    baseHue: 280,
    baseSaturation: 0.85,
    brightness: 2.4,
    particleSize: 2.2,
    gradientColor: { enabled: true, mode: 'twoColor' as const, colors: ['#1a0033', '#cc66ff'], colorMidPosition: 0.4, colorMidWidth: 0.6, colorMidWidth2: 0, direction: 'radial' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 2, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1.2 },
    trailLength: 0.35
  },
  // 日冕烈焰 (Solar Flare) - 耀眼辉煌
  solarFlare: {
    fillMode: 'solid' as const,
    fillPercent: 96,
    density: 1.4,
    baseRadius: 120,
    baseHue: 45,
    baseSaturation: 1.0,
    brightness: 3.5,
    particleSize: 3.0,
    gradientColor: { enabled: true, mode: 'threeColor' as const, colors: ['#ff6600', '#ffcc00', '#ffffaa'], colorMidPosition: 0.6, colorMidWidth: 0.5, colorMidWidth2: 0, direction: 'radial' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 5, spiralAxis: 'y' as const, proceduralAxis: 'radial' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1.8 },
    trailLength: 0.6
  }
};

// 粒子环预设 - 全新美学设计
export const PARTICLE_RING_PRESETS = {
  // 冰晶环带 (Crystal Ice Ring) - 清冷剔透
  iceShards: {
    eccentricity: 0,
    absoluteRadius: 200,
    particleDensity: 4.0,
    bandwidth: 30,
    thickness: 8,
    orbitSpeed: 0.15,
    rotationSpeed: 0.03,
    color: '#88ddff',
    brightness: 2.0,
    particleSize: 1.5
  },
  // 熔岩轨迹 (Molten Orbit) - 炽热流淌
  moltenTrack: {
    eccentricity: 0.15,
    absoluteRadius: 180,
    particleDensity: 3.0,
    bandwidth: 20,
    thickness: 12,
    orbitSpeed: 0.4,
    rotationSpeed: 0.08,
    color: '#ff5500',
    brightness: 2.5,
    particleSize: 2.2
  },
  // 星尘面纱 (Stardust Veil) - 柔和飘逸
  stardustVeil: {
    eccentricity: 0.05,
    absoluteRadius: 280,
    particleDensity: 1.0,
    bandwidth: 100,
    thickness: 2,
    orbitSpeed: 0.08,
    rotationSpeed: 0.01,
    color: '#ffddee',
    brightness: 1.5,
    particleSize: 1.0
  },
  // 虚空裂隙 (Void Rift) - 神秘暗紫
  voidRift: {
    eccentricity: 0.3,
    absoluteRadius: 240,
    particleDensity: 1.5,
    bandwidth: 12,
    thickness: 3,
    orbitSpeed: 0.6,
    rotationSpeed: 0.15,
    color: '#9944ff',
    brightness: 2.2,
    particleSize: 2.8
  },
  // 极光丝带 (Aurora Ribbon) - 绿青渐变
  auroraRibbon: {
    eccentricity: 0.08,
    absoluteRadius: 220,
    particleDensity: 2.5,
    bandwidth: 45,
    thickness: 5,
    orbitSpeed: 0.25,
    rotationSpeed: 0.05,
    color: '#00ffaa',
    brightness: 1.8,
    particleSize: 1.8
  },
  // 黄金光环 (Golden Halo) - 神圣辉煌
  goldenHalo: {
    eccentricity: 0,
    absoluteRadius: 260,
    particleDensity: 3.5,
    bandwidth: 15,
    thickness: 10,
    orbitSpeed: 0.2,
    rotationSpeed: 0.1,
    color: '#ffcc33',
    brightness: 3.0,
    particleSize: 2.0
  }
};

// 连续环带预设 - 全新美学设计
export const CONTINUOUS_RING_PRESETS = {
  // 水晶星链 (Crystal Starlink) - 精密轨道
  crystalStarlink: {
    eccentricity: 0,
    absoluteInnerRadius: 165,
    absoluteOuterRadius: 168,
    orbitSpeed: 0.8,
    rotationSpeed: 0.0,
    color: '#88ddff',
    opacity: 1.0,
    opacityGradient: 'none' as const,
    opacityGradientStrength: 0,
    brightness: 3.0,
    streakMode: {
      enabled: true,
      flowSpeed: 0.0,
      stripeCount: 150,
      radialStretch: 1,
      edgeSharpness: 1.0,
      distortion: 0.0,
      noiseScale: 0.0,
      flowDirection: 'cw' as const,
      brightness: 3.5
    }
  },
  // 赛博数据环 (Cyber Data Ring) - 科幻流动
  cyberDataRing: {
    eccentricity: 0,
    absoluteInnerRadius: 155,
    absoluteOuterRadius: 180,
    orbitSpeed: 0.15,
    rotationSpeed: 0.08,
    color: '#00ffcc',
    opacity: 0.7,
    opacityGradient: 'fadeBoth' as const,
    opacityGradientStrength: 0.7,
    brightness: 2.0,
    streakMode: {
      enabled: true,
      flowSpeed: 2.5,
      stripeCount: 40,
      radialStretch: 8,
      edgeSharpness: 0.9,
      distortion: 0.15,
      noiseScale: 0.3,
      flowDirection: 'cw' as const,
      brightness: 2.5
    }
  },
  // 霓虹赛道 (Neon Circuit) - 缤纷流光
  neonCircuit: {
    eccentricity: 0.08,
    absoluteInnerRadius: 145,
    absoluteOuterRadius: 210,
    orbitSpeed: 0.4,
    rotationSpeed: 0.15,
    color: '#ff44aa',
    opacity: 0.85,
    opacityGradient: 'none' as const,
    opacityGradientStrength: 0,
    brightness: 2.5,
    streakMode: {
      enabled: true,
      flowSpeed: 3.5,
      stripeCount: 16,
      radialStretch: 12,
      edgeSharpness: 0.4,
      distortion: 0.5,
      noiseScale: 0.8,
      flowDirection: 'ccw' as const,
      brightness: 3.0
    }
  },
  // 土星遗迹 (Saturn Remnant) - 古老宏伟
  saturnRemnant: {
    eccentricity: 0,
    absoluteInnerRadius: 200,
    absoluteOuterRadius: 320,
    orbitSpeed: 0.08,
    rotationSpeed: 0.03,
    color: '#ccaa88',
    opacity: 0.65,
    opacityGradient: 'fadeInner' as const,
    opacityGradientStrength: 0.6,
    brightness: 1.3,
    streakMode: {
      enabled: true,
      flowSpeed: 0.08,
      stripeCount: 280,
      radialStretch: 50,
      edgeSharpness: 0.08,
      distortion: 0.0,
      noiseScale: 2.5,
      flowDirection: 'cw' as const,
      brightness: 1.4
    }
  },
  // 量子涟漪 (Quantum Ripple) - 神秘波纹
  quantumRipple: {
    eccentricity: 0,
    absoluteInnerRadius: 175,
    absoluteOuterRadius: 260,
    orbitSpeed: 0.0,
    rotationSpeed: 0.0,
    color: '#6688ff',
    opacity: 0.45,
    opacityGradient: 'fadeOuter' as const,
    opacityGradientStrength: 0.55,
    brightness: 1.5,
    streakMode: {
      enabled: true,
      flowSpeed: 0.6,
      stripeCount: 20,
      radialStretch: 3,
      edgeSharpness: 0.0,
      distortion: 1.2,
      noiseScale: 1.2,
      flowDirection: 'cw' as const,
      brightness: 1.8
    }
  },
  // 日冕光环 (Corona Halo) - 炽热辉煌
  coronaHalo: {
    eccentricity: 0.03,
    absoluteInnerRadius: 115,
    absoluteOuterRadius: 150,
    orbitSpeed: 0.25,
    rotationSpeed: 0.12,
    color: '#ff6622',
    opacity: 0.85,
    opacityGradient: 'fadeBoth' as const,
    opacityGradientStrength: 0.35,
    brightness: 3.5,
    streakMode: {
      enabled: true,
      flowSpeed: 1.8,
      stripeCount: 50,
      radialStretch: 6,
      edgeSharpness: 0.5,
      distortion: 1.8,
      noiseScale: 1.8,
      flowDirection: 'cw' as const,
      brightness: 4.0
    }
  }
};

// 残影粒子预设
export const AFTERIMAGE_PARTICLE_PRESETS = {
  spark: {
    enabled: true,
    speed: 2.5,
    speedRandomness: 0.4,
    density: 200,
    size: 4,
    sizeDecay: 'exponential' as const,
    lifespan: 1.2,
    fadeOutCurve: 'exponential' as const,
    colorMode: 'gradient' as const,
    colors: ['#ff6600', '#ffcc00']
  },
  dust: {
    enabled: true,
    speed: 0.8,
    speedRandomness: 0.2,
    density: 80,
    size: 6,
    sizeDecay: 'linear' as const,
    lifespan: 3,
    fadeOutCurve: 'quadratic' as const,
    colorMode: 'single' as const,
    colors: ['#aaccff']
  },
  explosion: {
    enabled: true,
    speed: 4,
    speedRandomness: 0.5,
    density: 400,
    size: 3,
    sizeDecay: 'exponential' as const,
    lifespan: 0.8,
    fadeOutCurve: 'exponential' as const,
    colorMode: 'gradient' as const,
    colors: ['#ff2200', '#ff8800', '#ffff44']
  },
  softMist: {
    enabled: true,
    speed: 0.5,
    speedRandomness: 0.1,
    density: 150,
    size: 10,
    sizeDecay: 'linear' as const,
    lifespan: 4.0,
    fadeOutCurve: 'quadratic' as const,
    colorMode: 'single' as const,
    colors: ['#88ccff']
  },
  warpStars: {
    enabled: true,
    speed: 5.0,
    speedRandomness: 0.8,
    density: 50,
    size: 2,
    sizeDecay: 'none' as const,
    lifespan: 1.5,
    fadeOutCurve: 'linear' as const,
    colorMode: 'gradient' as const,
    colors: ['#ffffff', '#00ffff']
  },
  quantumFoam: {
    enabled: true,
    speed: 1.2,
    speedRandomness: 0.6,
    density: 200,
    size: 5,
    sizeDecay: 'exponential' as const,
    lifespan: 0.6,
    fadeOutCurve: 'exponential' as const,
    colorMode: 'gradient' as const,
    colors: ['#8800ff', '#ff00ff']
  }
};

// 残影纹路预设
export const AFTERIMAGE_TEXTURE_PRESETS = {
  flow: {
    enabled: true,
    textureMode: 'flow' as const,
    flowSpeed: 0.5,
    noiseScale: 1.5,
    stretchFactor: 3,
    stripeIntensity: 0.6,
    stripeCount: 10,
    directionalStretch: 8,
    edgeSharpness: 0.4,
    distortion: 0.3,
    opacity: 0.7,
    colors: ['#003366', '#0066aa', '#00aaff']
  },
  energy: {
    enabled: true,
    textureMode: 'energy' as const,
    flowSpeed: 0.3,
    noiseScale: 1,
    stretchFactor: 2,
    stripeIntensity: 0.5,
    stripeCount: 8,
    directionalStretch: 5,
    edgeSharpness: 0.3,
    distortion: 0.4,
    energyFlameScale: 2,
    energyDensity: 0.6,
    energyFlowSpeed: 0.8,
    energyTurbulence: 1,
    energyNoiseType: 'simplex' as const,
    energyFractalLayers: 3,
    energyDirection: 'up' as const,
    energyPulseEnabled: true,
    energyPulseSpeed: 1,
    energyPulseIntensity: 0.3,
    opacity: 0.8,
    colors: ['#220044', '#6600aa', '#ff00ff']
  },
  ghostly: {
    enabled: true,
    textureMode: 'flow' as const,
    flowSpeed: 0.2,
    noiseScale: 2,
    stretchFactor: 5,
    stripeIntensity: 0.3,
    stripeCount: 5,
    directionalStretch: 15,
    edgeSharpness: 0.2,
    distortion: 0.5,
    opacity: 0.4,
    colors: ['#001122', '#004466', '#00aacc']
  },
  cyberGrid: {
    enabled: true,
    textureMode: 'energy' as const,
    flowSpeed: 0.1,
    noiseScale: 0.5,
    stretchFactor: 1,
    stripeIntensity: 1.0,
    stripeCount: 20,
    directionalStretch: 1,
    edgeSharpness: 0.9,
    distortion: 0.0,
    energyFlameScale: 1,
    energyDensity: 0.8,
    energyFlowSpeed: 0.2,
    energyTurbulence: 0.0,
    energyNoiseType: 'voronoi' as const,
    energyFractalLayers: 1,
    energyDirection: 'up' as const,
    energyPulseEnabled: true,
    energyPulseSpeed: 2.0,
    energyPulseIntensity: 0.5,
    opacity: 0.6,
    colors: ['#000000', '#00aa00', '#00ff00']
  },
  plasmaRipples: {
    enabled: true,
    textureMode: 'flow' as const,
    flowSpeed: 0.8,
    noiseScale: 2.5,
    stretchFactor: 2,
    stripeIntensity: 0.2,
    stripeCount: 15,
    directionalStretch: 3,
    edgeSharpness: 0.1,
    distortion: 0.8,
    opacity: 0.7,
    colors: ['#440022', '#ff0044', '#ff88aa']
  },
  voidTendrils: {
    enabled: true,
    textureMode: 'energy' as const,
    flowSpeed: 0.4,
    noiseScale: 1.2,
    stretchFactor: 4,
    stripeIntensity: 0.4,
    stripeCount: 6,
    directionalStretch: 10,
    edgeSharpness: 0.6,
    distortion: 0.5,
    energyFlameScale: 3,
    energyDensity: 0.4,
    energyFlowSpeed: 0.6,
    energyTurbulence: 1.5,
    energyNoiseType: 'simplex' as const,
    energyFractalLayers: 4,
    energyDirection: 'spiral' as const,
    energyPulseEnabled: false,
    energyPulseSpeed: 1.0,
    energyPulseIntensity: 0.0,
    opacity: 0.5,
    colors: ['#110033', '#330066', '#8800cc']
  }
};

// 粒子环绕预设 - 全新美学设计
export const ORBITING_PARTICLES_PRESETS = {
  // 电子云层 (Electron Cloud) - 快速蓝光
  electrons: {
    particleDensity: 5.0,
    orbitRadius: 1.5,
    thickness: 100,
    color: '#66ccff',
    fadeWithDistance: true,
    fadeStrength: 0.5,
    baseSpeed: 2.0,
    mainDirection: { x: 0, y: 1, z: 0 },
    turbulence: 1.2,
    turbulenceScale: 2.0,
    brightness: 2.5,
    particleSize: 1.0
  },
  // 圣殿守卫 (Sanctuary Guard) - 金色慢旋
  sanctuary: {
    particleDensity: 1.5,
    orbitRadius: 2.2,
    thickness: 80,
    color: '#ffdd44',
    fadeWithDistance: true,
    fadeStrength: 0.7,
    baseSpeed: 0.3,
    mainDirection: { x: 0, y: 1, z: 0 },
    turbulence: 0.2,
    turbulenceScale: 0.8,
    brightness: 2.2,
    particleSize: 3.0
  },
  // 纳米虫群 (Nanite Swarm) - 绿色高密度
  naniteSwarm: {
    particleDensity: 8.0,
    orbitRadius: 1.6,
    thickness: 180,
    color: '#44ff88',
    fadeWithDistance: false,
    fadeStrength: 0.3,
    baseSpeed: 1.5,
    mainDirection: { x: 0.5, y: 1, z: 0.5 },
    turbulence: 1.8,
    turbulenceScale: 0.5,
    brightness: 1.8,
    particleSize: 0.8
  },
  // 翠绿生机 (Verdant Wisps) - 柔和自然
  verdantWisps: {
    particleDensity: 2.5,
    orbitRadius: 2.0,
    thickness: 150,
    color: '#88ff44',
    fadeWithDistance: true,
    fadeStrength: 0.4,
    baseSpeed: 0.6,
    mainDirection: { x: 0, y: 1, z: 0.3 },
    turbulence: 0.6,
    turbulenceScale: 1.2,
    brightness: 1.6,
    particleSize: 2.2
  },
  // 小行星带 (Asteroid Belt) - 岩石质感
  asteroidBelt: {
    particleDensity: 4.0,
    orbitRadius: 2.8,
    thickness: 50,
    color: '#aa8866',
    fadeWithDistance: true,
    fadeStrength: 0.6,
    baseSpeed: 0.25,
    mainDirection: { x: 0, y: 1, z: 0 },
    turbulence: 0.3,
    turbulenceScale: 1.8,
    brightness: 1.0,
    particleSize: 3.5
  },
  // 数据洪流 (Data Stream) - 青色高速
  dataStream: {
    particleDensity: 6.0,
    orbitRadius: 1.8,
    thickness: 60,
    color: '#00ffff',
    fadeWithDistance: true,
    fadeStrength: 0.4,
    baseSpeed: 3.5,
    mainDirection: { x: 1, y: 0, z: 0 },
    turbulence: 0.15,
    turbulenceScale: 0.2,
    brightness: 3.0,
    particleSize: 1.5
  }
};

// 粒子喷射预设 - 全新美学设计
export const EMITTER_PRESETS = {
  // 太阳风暴 (Solar Storm) - 橙色大爆发
  solarStorm: {
    emissionRangeMin: 1.0,
    emissionRangeMax: 5.0,
    birthRate: 1000,
    lifeSpan: 2.0,
    initialSpeed: 150,
    drag: 0.15,
    color: '#ff8800',
    fadeOutStrength: 0.4,
    particleSize: 2.8,
    brightness: 3.0
  },
  // 深渊喷泉 (Abyssal Jet) - 蓝色深海
  abyssalJet: {
    emissionRangeMin: 1.2,
    emissionRangeMax: 6.0,
    birthRate: 400,
    lifeSpan: 3.5,
    initialSpeed: 50,
    drag: 0.08,
    color: '#0066cc',
    fadeOutStrength: 0.8,
    particleSize: 2.5,
    brightness: 1.8
  },
  // 曲率引擎 (Warp Drive) - 白色高速
  warpDrive: {
    emissionRangeMin: 0.5,
    emissionRangeMax: 10.0,
    birthRate: 2000,
    lifeSpan: 0.6,
    initialSpeed: 500,
    drag: 0.0,
    color: '#ffffff',
    fadeOutStrength: 0.15,
    particleSize: 1.2,
    brightness: 5.0
  },
  // 孢子扩散 (Spore Spread) - 粉色柔和
  sporeSpread: {
    emissionRangeMin: 1.8,
    emissionRangeMax: 4.5,
    birthRate: 250,
    lifeSpan: 4.5,
    initialSpeed: 25,
    drag: 0.35,
    color: '#ff88cc',
    fadeOutStrength: 0.7,
    particleSize: 3.5,
    brightness: 1.4
  },
  // 引力漏斗 (Gravity Leak) - 紫色向内
  gravityLeak: {
    emissionRangeMin: 0.3,
    emissionRangeMax: 3.5,
    birthRate: 800,
    lifeSpan: 1.8,
    initialSpeed: -80,
    drag: 0.12,
    color: '#aa44ff',
    fadeOutStrength: 0.45,
    particleSize: 2.2,
    brightness: 2.5
  },
  // 龙息烈焰 (Dragon Breath) - 红色炽热
  dragonBreath: {
    emissionRangeMin: 1.0,
    emissionRangeMax: 7.0,
    birthRate: 1200,
    lifeSpan: 1.8,
    initialSpeed: 120,
    drag: 0.25,
    color: '#cc2200',
    fadeOutStrength: 0.55,
    particleSize: 3.2,
    brightness: 2.8
  }
};

// 旋转流萤预设 - 全新美学设计
export const ORBITING_FIREFLY_PRESETS = {
  // 月影幽灵 (Moon Shadow) - 银灰色sun2形状
  moonShadow: {
    absoluteOrbitRadius: 200,
    orbitSpeed: 0.2,
    initialPhase: 0,
    billboardOrbit: false,
    size: 35,
    color: '#889999',
    brightness: 1.8,
    headStyle: 'sun2' as const,
    flareIntensity: 0.3,
    flareLeaves: 0,
    flareWidth: 0.0,
    chromaticAberration: 0.0,
    velocityStretch: 0.0,
    noiseAmount: 0.4,
    glowIntensity: 1.2,
    pulseSpeed: 0.3,
    trailEnabled: true,
    trailLength: 80,
    trailTaperPower: 1.2,
    trailOpacity: 0.4
  },
  // 守护精灵 (Guardian Pixie) - 金色flare
  guardianPixie: {
    absoluteOrbitRadius: 160,
    orbitSpeed: 0.7,
    initialPhase: 0,
    billboardOrbit: true,
    size: 22,
    color: '#ffcc44',
    brightness: 2.8,
    headStyle: 'flare' as const,
    flareIntensity: 1.8,
    flareLeaves: 6,
    flareWidth: 0.5,
    chromaticAberration: 0.25,
    velocityStretch: 0.4,
    noiseAmount: 0.15,
    glowIntensity: 2.2,
    pulseSpeed: 1.5,
    trailEnabled: true,
    trailLength: 120,
    trailTaperPower: 1.0,
    trailOpacity: 0.65
  },
  // 猩红之眼 (Crimson Eye) - 红色sun形状
  crimsonEye: {
    absoluteOrbitRadius: 220,
    orbitSpeed: 0.15,
    initialPhase: 90,
    billboardOrbit: true,
    size: 45,
    color: '#dd2200',
    brightness: 2.2,
    headStyle: 'sun' as const,
    flareIntensity: 0.0,
    flareLeaves: 0,
    flareWidth: 0.0,
    chromaticAberration: 0.35,
    velocityStretch: 0.0,
    noiseAmount: 0.0,
    glowIntensity: 2.8,
    pulseSpeed: 3.0,
    trailEnabled: false,
    trailLength: 0,
    trailTaperPower: 1,
    trailOpacity: 0
  },
  // 冰霜新星 (Frost Nova) - 冰蓝雪花形状
  frostNova: {
    absoluteOrbitRadius: 180,
    orbitSpeed: 0.35,
    initialPhase: 45,
    billboardOrbit: true,
    size: 28,
    color: '#88ccff',
    brightness: 3.2,
    headStyle: 'snowflake' as const,
    flareIntensity: 1.2,
    flareLeaves: 6,
    flareWidth: 0.25,
    chromaticAberration: 0.15,
    velocityStretch: 0.15,
    noiseAmount: 0.25,
    glowIntensity: 1.8,
    pulseSpeed: 0.8,
    trailEnabled: true,
    trailLength: 100,
    trailTaperPower: 1.8,
    trailOpacity: 0.55
  },
  // 以太旋风 (Aether Cyclone) - 紫色旋涡
  aetherCyclone: {
    absoluteOrbitRadius: 240,
    orbitSpeed: 0.5,
    initialPhase: 180,
    billboardOrbit: false,
    size: 55,
    color: '#9955ff',
    brightness: 1.5,
    headStyle: 'prism' as const,
    flareIntensity: 0.0,
    flareLeaves: 0,
    flareWidth: 0.0,
    chromaticAberration: 0.4,
    velocityStretch: 0.7,
    noiseAmount: 0.6,
    glowIntensity: 1.8,
    pulseSpeed: 0.6,
    trailEnabled: true,
    trailLength: 180,
    trailTaperPower: 0.6,
    trailOpacity: 0.45
  },
  // 棱镜之光 (Prism Light) - 白色彩虹色散
  prismLight: {
    absoluteOrbitRadius: 200,
    orbitSpeed: 0.25,
    initialPhase: 270,
    billboardOrbit: true,
    size: 32,
    color: '#ffffff',
    brightness: 4.5,
    headStyle: 'crossglow' as const,
    flareIntensity: 2.2,
    flareLeaves: 4,
    flareWidth: 0.7,
    chromaticAberration: 1.0,
    velocityStretch: 0.0,
    noiseAmount: 0.0,
    glowIntensity: 1.2,
    pulseSpeed: 0.0,
    trailEnabled: true,
    trailLength: 60,
    trailTaperPower: 1.5,
    trailOpacity: 0.3
  }
};

// 游走流萤预设 - 全新美学设计
export const WANDERING_FIREFLY_PRESETS = {
  // 仲夏萤火 (Midsummer Glow) - 经典暖黄
  midsummer: {
    count: 60,
    innerRadius: 1.2,
    outerRadius: 6.5,
    speed: 0.35,
    turnFrequency: 0.55,
    size: 10,
    color: '#ddff44',
    brightness: 2.0,
    headStyle: 'plain' as const,
    flareIntensity: 0.0,
    flareLeaves: 0,
    flareWidth: 0.0,
    chromaticAberration: 0.0,
    velocityStretch: 0.12,
    noiseAmount: 0.25,
    glowIntensity: 1.2,
    pulseSpeed: 1.2,
    trailTaperPower: 1.4,
    trailOpacity: 0.35
  },
  // 幽蓝鬼火 (Ghost Fire) - 冷蓝幽灵
  ghostFire: {
    count: 25,
    innerRadius: 2.5,
    outerRadius: 8.5,
    speed: 0.12,
    turnFrequency: 0.25,
    size: 18,
    color: '#2266ff',
    brightness: 2.2,
    headStyle: 'flare' as const,
    flareIntensity: 0.6,
    flareLeaves: 4,
    flareWidth: 0.25,
    chromaticAberration: 0.25,
    velocityStretch: 0.0,
    noiseAmount: 0.55,
    glowIntensity: 2.5,
    pulseSpeed: 0.4,
    trailTaperPower: 2.2,
    trailOpacity: 0.55
  },
  // 绯红余烬 (Crimson Ember) - 火焰残光
  crimsonEmber: {
    count: 35,
    innerRadius: 1.8,
    outerRadius: 5.5,
    speed: 0.45,
    turnFrequency: 0.75,
    size: 7,
    color: '#ff5500',
    brightness: 2.5,
    headStyle: 'spark' as const,
    flareIntensity: 0.9,
    flareLeaves: 5,
    flareWidth: 0.12,
    chromaticAberration: 0.08,
    velocityStretch: 0.35,
    noiseAmount: 0.18,
    glowIntensity: 1.8,
    pulseSpeed: 2.5,
    trailTaperPower: 1.3,
    trailOpacity: 0.42
  },
  // 圣光微粒 (Holy Particle) - 神圣白金
  holyParticle: {
    count: 100,
    innerRadius: 0.6,
    outerRadius: 4.5,
    speed: 0.08,
    turnFrequency: 0.08,
    size: 5,
    color: '#ffffee',
    brightness: 3.0,
    headStyle: 'crossglow' as const,
    flareIntensity: 1.5,
    flareLeaves: 4,
    flareWidth: 0.4,
    chromaticAberration: 0.1,
    velocityStretch: 0.0,
    noiseAmount: 0.08,
    glowIntensity: 0.8,
    pulseSpeed: 0.6,
    trailTaperPower: 1.0,
    trailOpacity: 0.2
  },
  // 樱花飘落 (Sakura Fall) - 粉樱梦幻
  sakuraFall: {
    count: 45,
    innerRadius: 1.5,
    outerRadius: 7.0,
    speed: 0.2,
    turnFrequency: 0.4,
    size: 12,
    color: '#ffaacc',
    brightness: 1.6,
    headStyle: 'sakura' as const,
    flareIntensity: 0.0,
    flareLeaves: 0,
    flareWidth: 0.0,
    chromaticAberration: 0.05,
    velocityStretch: 0.08,
    noiseAmount: 0.3,
    glowIntensity: 0.6,
    pulseSpeed: 0.3,
    trailTaperPower: 0.8,
    trailOpacity: 0.25
  },
  // 霓虹脉冲 (Neon Pulse) - 赛博霓虹
  neonPulse: {
    count: 40,
    innerRadius: 1.0,
    outerRadius: 5.0,
    speed: 0.5,
    turnFrequency: 0.6,
    size: 8,
    color: '#00ffff',
    brightness: 3.5,
    headStyle: 'star' as const,
    flareIntensity: 1.2,
    flareLeaves: 5,
    flareWidth: 0.3,
    chromaticAberration: 0.8,
    velocityStretch: 0.25,
    noiseAmount: 0.1,
    glowIntensity: 2.0,
    pulseSpeed: 4.0,
    trailTaperPower: 1.6,
    trailOpacity: 0.5
  }
};

// 能量体预设
export const ENERGY_BODY_PRESETS = {
  // 梅塔特隆 (Metatron)
  metatron: {
    polyhedronType: 'dodecahedron' as const,
    subdivisionLevel: 0,
    radius: 120,
    spherize: 0,
    renderMode: 'wireframe' as const,
    edgeEffect: {
      width: 2.5,
      glowIntensity: 2.5,
      softEdgeFalloff: 0.2,
      color: '#ffd700',
      gradientEnabled: true,
      gradientEndColor: '#ffffff',
      dashPattern: { enabled: false, dashRatio: 0.6, dashDensity: 10, flowSpeed: 1.0 }
    },
    vertexEffect: { enabled: true, size: 8, shape: 'star' as const, color: '#ffffaa', glowIntensity: 3 },
    shellEffect: { enabled: true, opacity: 0.15, fresnelPower: 2.0, fresnelIntensity: 1.5, color: '#ffd700', doubleSided: false },
    rotationSpeed: 0.1,
    blendMode: 'additive' as const,
    globalOpacity: 1.0
  },
  // 源质核心 (Essence Core)
  essenceCore: {
    polyhedronType: 'icosahedron' as const,
    subdivisionLevel: 2,
    radius: 100,
    spherize: 0.8,
    renderMode: 'wireframe' as const,
    edgeEffect: {
      width: 1.5,
      glowIntensity: 2.0,
      softEdgeFalloff: 0.8,
      color: '#00ffff',
      gradientEnabled: true,
      gradientEndColor: '#0044ff',
      dashPattern: { enabled: true, dashRatio: 0.8, dashDensity: 5, flowSpeed: 0.5 }
    },
    vertexEffect: { enabled: false, size: 4, shape: 'circle' as const, color: '#ffffff', glowIntensity: 2.0 },
    shellEffect: { enabled: true, opacity: 0.4, fresnelPower: 1.0, fresnelIntensity: 2.5, color: '#00ffff', doubleSided: true },
    rotationSpeed: 0.15,
    blendMode: 'additive' as const,
    globalOpacity: 1.0
  },
  // 量子魔方 (Tesseract)
  tesseract: {
    polyhedronType: 'box' as const,
    subdivisionLevel: 4,
    radius: 110,
    spherize: 0.0,
    renderMode: 'wireframe' as const,
    edgeEffect: {
      width: 2.0,
      glowIntensity: 3.0,
      softEdgeFalloff: 0.1,
      color: '#00ff44',
      gradientEnabled: false,
      gradientEndColor: '#00ff44',
      dashPattern: { enabled: true, dashRatio: 0.3, dashDensity: 20, flowSpeed: 5.0 }
    },
    vertexEffect: { enabled: false, size: 0, shape: 'circle' as const, color: '#000000', glowIntensity: 0 },
    shellEffect: { enabled: true, opacity: 0.05, fresnelPower: 4.0, fresnelIntensity: 1.0, color: '#00ff44', doubleSided: true },
    rotationSpeed: 0.3,
    blendMode: 'additive' as const,
    globalOpacity: 0.9
  },
  // 虚空之心 (Void Heart)
  voidHeart: {
    polyhedronType: 'icosahedron' as const,
    subdivisionLevel: 3,
    radius: 115,
    spherize: 0.6,
    renderMode: 'wireframe' as const,
    edgeEffect: {
      width: 3.0,
      glowIntensity: 1.5,
      softEdgeFalloff: 1.0,
      color: '#440088',
      gradientEnabled: true,
      gradientEndColor: '#000000',
      dashPattern: { enabled: false, dashRatio: 0.5, dashDensity: 10, flowSpeed: 1.0 }
    },
    vertexEffect: { enabled: true, size: 6, shape: 'diamond' as const, color: '#8800ff', glowIntensity: 1.5 },
    shellEffect: { enabled: true, opacity: 0.6, fresnelPower: 0.5, fresnelIntensity: 1.0, color: '#220044', doubleSided: true },
    rotationSpeed: 0.05,
    blendMode: 'normal' as const,
    globalOpacity: 1.0
  },
  // 星晶体 (Star Crystal)
  starCrystal: {
    polyhedronType: 'octahedron' as const,
    subdivisionLevel: 0,
    radius: 90,
    spherize: 0.0,
    renderMode: 'both' as const,
    edgeEffect: {
      width: 1.0,
      glowIntensity: 4.0,
      softEdgeFalloff: 0.0,
      color: '#ffffff',
      gradientEnabled: false,
      gradientEndColor: '#ffffff',
      dashPattern: { enabled: false, dashRatio: 0.5, dashDensity: 10, flowSpeed: 1.0 }
    },
    vertexEffect: { enabled: false, size: 0, shape: 'circle' as const, color: '#000000', glowIntensity: 0 },
    shellEffect: { enabled: true, opacity: 0.8, fresnelPower: 3.0, fresnelIntensity: 3.0, color: '#eeffff', doubleSided: false },
    rotationSpeed: 0.0,
    blendMode: 'additive' as const,
    globalOpacity: 1.0
  },
  // 维度牢笼 (Dimension Cage)
  dimensionCage: {
    polyhedronType: 'truncatedDodecahedron' as const,
    subdivisionLevel: 1,
    radius: 130,
    spherize: 0.2,
    renderMode: 'wireframe' as const,
    edgeEffect: {
      width: 4.0,
      glowIntensity: 2.0,
      softEdgeFalloff: 0.5,
      color: '#ff2200',
      gradientEnabled: true,
      gradientEndColor: '#440000',
      dashPattern: { enabled: true, dashRatio: 0.9, dashDensity: 4, flowSpeed: 0.2 }
    },
    vertexEffect: { enabled: true, size: 10, shape: 'cube' as const, color: '#ff0000', glowIntensity: 2.0 },
    shellEffect: { enabled: true, opacity: 0.1, fresnelPower: 2.0, fresnelIntensity: 0.5, color: '#ff0000', doubleSided: true },
    rotationSpeed: 0.1,
    blendMode: 'additive' as const,
    globalOpacity: 1.0
  }
};

// ==================== 配色方案预设（22个系统预设） ====================
import type { ThemeColors, ColorScheme, ButtonMaterialConfig, MaterialType, GlassParams, NeonParams, CrystalParams, NeumorphismParams, HolographicParams, MaterialSettings, MaterialPreset } from './types';

export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#6366F1',
  secondary: '#A5B4FC',
  textAccent: '#818CF8',
  decoration: '#4F46E5',
  editBar: '#14B8A6'
};

export const DEFAULT_COLOR_SCHEMES: Record<string, ColorScheme> = {
  midnight: {
    name: '午夜星空',
    colors: { primary: '#6366F1', secondary: '#A5B4FC', textAccent: '#818CF8', decoration: '#4F46E5', editBar: '#14B8A6' },
    isSystem: true
  },
  auroraWarm: {
    name: '极光冷暖',
    colors: { primary: '#22D3EE', secondary: '#F59E0B', textAccent: '#A78BFA', decoration: '#60A5FA', editBar: '#22D3EE' },
    isSystem: true
  },
  cyberMagenta: {
    name: '赛博粉蓝',
    colors: { primary: '#00E5FF', secondary: '#FF8E53', textAccent: '#FF6EC7', decoration: '#9B59B6', editBar: '#00E5FF' },
    isSystem: true
  },
  deepOcean: {
    name: '深海青蓝',
    colors: { primary: '#14B8A6', secondary: '#38BDF8', textAccent: '#84CC16', decoration: '#0EA5E9', editBar: '#14B8A6' },
    isSystem: true
  },
  solarIndigo: {
    name: '金冠靛蓝',
    colors: { primary: '#F4B400', secondary: '#6366F1', textAccent: '#FF6EC7', decoration: '#7C3AED', editBar: '#F4B400' },
    isSystem: true
  },
  emeraldFlame: {
    name: '翡翠火焰',
    colors: { primary: '#34D399', secondary: '#FB923C', textAccent: '#60A5FA', decoration: '#10B981', editBar: '#34D399' },
    isSystem: true
  },
  lavaNebula: {
    name: '熔岩星云',
    colors: { primary: '#EF4444', secondary: '#F59E0B', textAccent: '#60A5FA', decoration: '#FB7185', editBar: '#EF4444' },
    isSystem: true
  },
  glacierMint: {
    name: '冰川薄荷',
    colors: { primary: '#7DE2D1', secondary: '#9BDCFD', textAccent: '#B9A5FF', decoration: '#5AD1E2', editBar: '#7DE2D1' },
    isSystem: true
  },
  sakuraNight: {
    name: '樱夜',
    colors: { primary: '#F472B6', secondary: '#F59E0B', textAccent: '#60A5FA', decoration: '#D946EF', editBar: '#F472B6' },
    isSystem: true
  },
  noirGold: {
    name: '黑金',
    colors: { primary: '#F5C857', secondary: '#86EFAC', textAccent: '#60A5FA', decoration: '#D4AF37', editBar: '#F5C857' },
    isSystem: true
  },
  vaporwave: {
    name: '蒸汽波',
    colors: { primary: '#8B5CF6', secondary: '#22D3EE', textAccent: '#FF7AB6', decoration: '#00F5D4', editBar: '#8B5CF6' },
    isSystem: true
  },
  steelCyan: {
    name: '钢青',
    colors: { primary: '#06B6D4', secondary: '#94A3B8', textAccent: '#A5B4FC', decoration: '#1E293B', editBar: '#06B6D4' },
    isSystem: true
  },
  desertAurora: {
    name: '沙漠极光',
    colors: { primary: '#F59E0B', secondary: '#22D3EE', textAccent: '#FCA5A5', decoration: '#EAB308', editBar: '#F59E0B' },
    isSystem: true
  },
  forestTemple: {
    name: '森林神殿',
    colors: { primary: '#22C55E', secondary: '#FDE68A', textAccent: '#60A5FA', decoration: '#16A34A', editBar: '#22C55E' },
    isSystem: true
  },
  stormBlue: {
    name: '风暴蓝',
    colors: { primary: '#3B82F6', secondary: '#FCD34D', textAccent: '#22D3EE', decoration: '#8B5CF6', editBar: '#3B82F6' },
    isSystem: true
  },
  cosmicPurple: {
    name: '宇宙紫',
    colors: { primary: '#A855F7', secondary: '#EC4899', textAccent: '#38BDF8', decoration: '#7C3AED', editBar: '#A855F7' },
    isSystem: true
  },
  bloodMoon: {
    name: '血月',
    colors: { primary: '#DC2626', secondary: '#F97316', textAccent: '#FDE68A', decoration: '#991B1B', editBar: '#DC2626' },
    isSystem: true
  },
  neonCity: {
    name: '霓虹都市',
    colors: { primary: '#00FF87', secondary: '#FF00E5', textAccent: '#00D4FF', decoration: '#FFE600', editBar: '#00FF87' },
    isSystem: true
  },
  autumnLeaf: {
    name: '秋叶',
    colors: { primary: '#EA580C', secondary: '#84CC16', textAccent: '#FBBF24', decoration: '#C2410C', editBar: '#EA580C' },
    isSystem: true
  },
  arcticFrost: {
    name: '极地霜',
    colors: { primary: '#67E8F9', secondary: '#E0E7FF', textAccent: '#A5F3FC', decoration: '#0891B2', editBar: '#67E8F9' },
    isSystem: true
  },
  sunsetGlow: {
    name: '落日余晖',
    colors: { primary: '#FB7185', secondary: '#FBBF24', textAccent: '#A78BFA', decoration: '#F43F5E', editBar: '#FB7185' },
    isSystem: true
  },
  bambooZen: {
    name: '竹林禅',
    colors: { primary: '#4ADE80', secondary: '#A3E635', textAccent: '#FCD34D', decoration: '#166534', editBar: '#4ADE80' },
    isSystem: true
  }
};

// ==================== 按键材质默认参数 ====================

export const DEFAULT_GLASS_PARAMS: GlassParams = {
  blur: 12,
  opacity: 0.1,
  borderOpacity: 0.15,
  tint: '#ffffff'
};

export const DEFAULT_NEON_PARAMS: NeonParams = {
  glowIntensity: 60,
  glowSpread: 20,
  borderGlow: true,
  textGlow: true,
  color: '#22d3ee'
};

export const DEFAULT_CRYSTAL_PARAMS: CrystalParams = {
  facets: 3,
  shine: 70,
  depth: 50,
  color: '#6366f1',
  highlightColor: '#a5b4fc',
  color2: '#06b6d4',
  highlightColor2: '#67e8f9'
};

export const DEFAULT_NEUMORPHISM_PARAMS: NeumorphismParams = {
  elevation: 8,
  curvature: 50,
  lightAngle: 145,
  shadowIntensity: 40,
  pressDepth: 2,
  baseColor: '#2a2a35',
  highlightColor: '#4a4a5a',
  shadowColor: '#1a1a22'
};

export const DEFAULT_HOLOGRAPHIC_PARAMS: HolographicParams = {
  colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1', '#dda0dd'],
  speed: 3,
  angle: 45,
  shimmer: false,
  noiseIntensity: 20
};

export const createDefaultMaterialConfig = (type: MaterialType = 'glass'): ButtonMaterialConfig => ({
  type,
  glass: { ...DEFAULT_GLASS_PARAMS },
  neon: { ...DEFAULT_NEON_PARAMS },
  crystal: { ...DEFAULT_CRYSTAL_PARAMS },
  neumorphism: { ...DEFAULT_NEUMORPHISM_PARAMS },
  holographic: { ...DEFAULT_HOLOGRAPHIC_PARAMS }
});

// 默认材质设置（简化版：subModuleTabs 为按模块配置）
export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = {
  modeSwitch: createDefaultMaterialConfig('crystal'),
  mainTabs: createDefaultMaterialConfig('neon'),
  mainTabColors: { basic: '#10b981', visual: '#a78bfa', interact: '#22d3ee' },
  moduleTabs: createDefaultMaterialConfig('neon'),
  moduleTabColors: {
    core: '#10b981', energyBody: '#ef4444', rings: '#a78bfa',
    afterimage: '#06b6d4', radiation: '#22c55e', fireflies: '#eab308', magicCircle: '#ec4899'
  },
  optionButtons: createDefaultMaterialConfig('neumorphism'),
  subModuleTabs: {
    core: createDefaultMaterialConfig('neon'),
    energyBody: createDefaultMaterialConfig('neon'),
    rings: createDefaultMaterialConfig('neon'),
    afterimage: createDefaultMaterialConfig('neon'),
    radiation: createDefaultMaterialConfig('neon'),
    fireflies: createDefaultMaterialConfig('neon'),
    magicCircle: createDefaultMaterialConfig('neon')
  }
};

// ==================== 内置材质预设 ====================

export const BUILT_IN_MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'default',
    name: '🎨 默认',
    data: { ...DEFAULT_MATERIAL_SETTINGS },
    isBuiltIn: true
  },
  {
    id: 'glass',
    name: '🪟 玻璃',
    data: {
      modeSwitch: createDefaultMaterialConfig('glass'),
      mainTabs: createDefaultMaterialConfig('glass'),
      mainTabColors: { basic: '#3b82f6', visual: '#8b5cf6', interact: '#06b6d4' },
      moduleTabs: createDefaultMaterialConfig('glass'),
      moduleTabColors: {
        core: '#3b82f6', energyBody: '#ef4444', rings: '#8b5cf6',
        afterimage: '#06b6d4', radiation: '#22c55e', fireflies: '#f59e0b', magicCircle: '#ec4899'
      },
      optionButtons: createDefaultMaterialConfig('glass'),
      subModuleTabs: {
        core: createDefaultMaterialConfig('glass'),
        energyBody: createDefaultMaterialConfig('glass'),
        rings: createDefaultMaterialConfig('glass'),
        afterimage: createDefaultMaterialConfig('glass'),
        radiation: createDefaultMaterialConfig('glass'),
        fireflies: createDefaultMaterialConfig('glass'),
        magicCircle: createDefaultMaterialConfig('glass')
      }
    },
    isBuiltIn: true
  },
  {
    id: 'neon',
    name: '💡 霓虹',
    data: {
      modeSwitch: createDefaultMaterialConfig('neon'),
      mainTabs: createDefaultMaterialConfig('neon'),
      mainTabColors: { basic: '#22c55e', visual: '#f472b6', interact: '#38bdf8' },
      moduleTabs: createDefaultMaterialConfig('neon'),
      moduleTabColors: {
        core: '#22c55e', energyBody: '#f43f5e', rings: '#d946ef',
        afterimage: '#0ea5e9', radiation: '#84cc16', fireflies: '#fbbf24', magicCircle: '#a855f7'
      },
      optionButtons: createDefaultMaterialConfig('neon'),
      subModuleTabs: {
        core: createDefaultMaterialConfig('neon'),
        energyBody: createDefaultMaterialConfig('neon'),
        rings: createDefaultMaterialConfig('neon'),
        afterimage: createDefaultMaterialConfig('neon'),
        radiation: createDefaultMaterialConfig('neon'),
        fireflies: createDefaultMaterialConfig('neon'),
        magicCircle: createDefaultMaterialConfig('neon')
      }
    },
    isBuiltIn: true
  },
  {
    id: 'crystal',
    name: '💎 水晶',
    data: {
      modeSwitch: createDefaultMaterialConfig('crystal'),
      mainTabs: createDefaultMaterialConfig('crystal'),
      mainTabColors: { basic: '#60a5fa', visual: '#c084fc', interact: '#2dd4bf' },
      moduleTabs: createDefaultMaterialConfig('crystal'),
      moduleTabColors: {
        core: '#60a5fa', energyBody: '#fb7185', rings: '#c084fc',
        afterimage: '#22d3ee', radiation: '#4ade80', fireflies: '#facc15', magicCircle: '#e879f9'
      },
      optionButtons: createDefaultMaterialConfig('crystal'),
      subModuleTabs: {
        core: createDefaultMaterialConfig('crystal'),
        energyBody: createDefaultMaterialConfig('crystal'),
        rings: createDefaultMaterialConfig('crystal'),
        afterimage: createDefaultMaterialConfig('crystal'),
        radiation: createDefaultMaterialConfig('crystal'),
        fireflies: createDefaultMaterialConfig('crystal'),
        magicCircle: createDefaultMaterialConfig('crystal')
      }
    },
    isBuiltIn: true
  },
  {
    id: 'holographic',
    name: '🌈 全息',
    data: {
      modeSwitch: createDefaultMaterialConfig('holographic'),
      mainTabs: createDefaultMaterialConfig('holographic'),
      mainTabColors: { basic: '#a78bfa', visual: '#f472b6', interact: '#34d399' },
      moduleTabs: createDefaultMaterialConfig('holographic'),
      moduleTabColors: {
        core: '#a78bfa', energyBody: '#fb923c', rings: '#f472b6',
        afterimage: '#22d3ee', radiation: '#4ade80', fireflies: '#fcd34d', magicCircle: '#c084fc'
      },
      optionButtons: createDefaultMaterialConfig('holographic'),
      subModuleTabs: {
        core: createDefaultMaterialConfig('holographic'),
        energyBody: createDefaultMaterialConfig('holographic'),
        rings: createDefaultMaterialConfig('holographic'),
        afterimage: createDefaultMaterialConfig('holographic'),
        radiation: createDefaultMaterialConfig('holographic'),
        fireflies: createDefaultMaterialConfig('holographic'),
        magicCircle: createDefaultMaterialConfig('holographic')
      }
    },
    isBuiltIn: true
  }
];

// 默认主题配置
export const DEFAULT_THEME_CONFIG = {
  schemes: { ...DEFAULT_COLOR_SCHEMES },
  activeSchemeId: 'midnight',
  activeColors: { ...DEFAULT_THEME_COLORS },
  consoleBg: '#000000',
  deletedSystemSchemeIds: [] as string[]
};

// ==================== 绘图系统 (Dimension Crafter) V2 默认配置 ====================

// 默认笔刷设置
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  type: BrushType.Stardust,
  size: 20,
  opacity: 0.8,
  color: '#ffffff',
  color2: '#88ccff',
  usePressure: true,
  pressureInfluence: {
    size: true,
    opacity: true,
    flow: false
  },
  // 星尘笔默认参数
  stardust: {
    density: 50,
    scatter: 15,
    twinkle: true,
    twinkleSpeed: 2,
    glowIntensity: 1.5
  },
  // 气云笔默认参数
  gasCloud: {
    noiseScale: 2,
    flowSpeed: 0.5,
    softness: 0.6,
    turbulence: 0.3
  },
  // 能量束笔默认参数
  energyBeam: {
    coreWidth: 0.3,
    glowRadius: 20,
    glowIntensity: 1.5,
    stabilization: 0.5,
    electricArc: false,
    arcFrequency: 3,
    taperEnabled: true
  },
  // 螺旋环笔默认参数
  spiralRing: {
    spiralDensity: 3,
    pitch: 0.5,
    thickness: 10,
    rotationSpeed: 0.5,
    riseSpeed: 0.3,
    direction: 'cw',
    emissive: 1.5
  },
  // 流萤笔默认参数
  firefly: {
    headStyle: 'flare',
    headSize: 8,
    headBrightness: 2,
    trailEnabled: true,
    trailLength: 50,
    trailTaper: 1.5,
    trailOpacity: 0.6,
    flareLeaves: 4,
    pulseSpeed: 1
  },
  // 裂痕笔默认参数
  fracture: {
    crackScale: 2,
    crackThreshold: 0.5,
    crackFeather: 0.15,
    crackWarp: 0.3,
    flowSpeed: 0.2,
    emission: 1
  }
};

// 默认对称设置
export const DEFAULT_SYMMETRY_SETTINGS: SymmetrySettings = {
  // 2D 设置
  mode2D: Symmetry2DMode.None,
  mirrorAxisAngle: 90,
  radialSegments: 8,
  radialReflection: false,
  centerOffset: { x: 0, y: 0 },
  // 3D 设置
  mode3D: Symmetry3DMode.None,
  spinSegments: 12,
  polyhedronMirror: false,
  vortexTwist: 30,
  vortexHeightOffset: 20,
  vortexScaleDecay: 0.1
};

// 创建默认图层
export const createDefaultDrawingLayer = (id: string, name: string = '新图层'): DrawingLayer => ({
  id,
  name,
  visible: true,
  locked: false,
  transform: {
    scale: 1,
    tilt: { x: 0, y: 0, z: 0 },
    altitude: 0,
    rotationSpeed: 0
  },
  brushType: BrushType.Stardust,
  color: '#ffffff',
  blending: 'additive',
  params: {},
  projection: ProjectionMode.Sphere,
  strokes: []
});

// 创建默认绘图实例
export const createDefaultDrawing = (id: string, name: string = '新绘图'): Drawing => ({
  id,
  name,
  visible: true,
  layers: [],
  activeLayerId: null,
  transform: {
    scale: 1,
    tilt: { x: 0, y: 0, z: 0 },
    rotationSpeed: 0
  }
});

// 默认绘图设置
export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  enabled: false,
  brush: { ...DEFAULT_BRUSH_SETTINGS },
  symmetry: { ...DEFAULT_SYMMETRY_SETTINGS },
  projection: ProjectionMode.Sphere,
  drawings: [],
  activeDrawingId: null,
  planetBindings: [],
  padOpacity: 0.8,
  showSymmetryGuides: true,
  ghostCursorEnabled: true,
  hideCanvasWhilePainting: false
};