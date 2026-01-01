/**
 * XingForge AI - Server Side Defaults
 * 
 * input: (none)
 * output: Pure default object creators
 * pos: 用于服务端 (API) 的默认对象生成，避免 constants.ts 中的浏览器依赖
 * update: 如果 constants.ts 中的默认结构改变，需要同步更新这里
 */

import {
    PlanetCoreSettings,
    CoreType,
    PlanetFillMode,
    EnergyBodySettings,
    ParticleRingSettings,
    ContinuousRingSettings,
    RingOpacityGradient,
    OrbitingParticlesSettings,
    ParticleEmitterSettings,
    OrbitingFireflySettings,
    WanderingFireflyGroupSettings,
    TiltSettings,
    OrbitAxisSettings,
    GradientColor,
    RotationAxisSettings,
    VertexShape,
    FireflyHeadStyle
} from '../../types';

// ==================== 基础默认值 ====================

const DEFAULT_TILT_SETTINGS: TiltSettings = {
    axis: 'x',
    angle: 0,
    isCustom: true,
    customX: 0,
    customY: 1,
    customZ: 0
};

const DEFAULT_ORBIT_AXIS_SETTINGS: OrbitAxisSettings = {
    axis: 'y',
    angle: 0,
    isCustom: false
};

const DEFAULT_GRADIENT_COLOR: GradientColor = {
    enabled: false,
    mode: 'twoColor', // 默认值
    colors: ['#ffffff', '#0000ff'],
    colorMidPosition: 0.5,
    colorMidWidth: 1,
    colorMidWidth2: 0,
    blendStrength: 1,
    direction: 'radial',
    directionCustom: { x: 0, y: 1, z: 0 },
    spiralDensity: 3,
    spiralAxis: 'y',
    proceduralAxis: 'radial',
    proceduralCustomAxis: { x: 0, y: 1, z: 0 },
    proceduralIntensity: 1.0,
    // 兼容字段
    angle: 0,
    type: 'linear'
};

const DEFAULT_ROTATION_AXIS_SETTINGS: RotationAxisSettings = {
    preset: 'y',
    customX: 0,
    customY: 1,
    customZ: 0
};

// ==================== 核心模块 ====================

export const createDefaultCore = (id: string, name: string = '核心'): PlanetCoreSettings => ({
    id,
    name,
    enabled: true,
    fillMode: 'shell' as PlanetFillMode,
    fillPercent: 20,
    density: 1.0,
    baseRadius: 100,
    baseHue: 200,
    baseSaturation: 0.8,
    gradientColor: { ...DEFAULT_GRADIENT_COLOR },
    rotationSpeed: 0.5,
    rotationAxis: { ...DEFAULT_ROTATION_AXIS_SETTINGS },
    trailLength: 0.1,
    brightness: 1.0,
    particleSize: 1.5
});

// ==================== 能量体 ====================
// 从 constants.ts 导入完整的 createDefaultEnergyBody，确保字段同步
// 注意：直接导入可能导致循环依赖，所以这里需要重新导出
export { createDefaultEnergyBody } from '../../constants';

// ==================== 星环系统 ====================

export const createDefaultParticleRing = (id: string, name: string = '粒子环'): ParticleRingSettings => ({
    id,
    name,
    enabled: true,
    // count 字段不存在，使用 particleDensity 控制数量
    particleDensity: 5.0,
    absoluteRadius: 150, // 修正 radius -> absoluteRadius
    bandwidth: 20,       // 修正 width -> bandwidth
    thickness: 5,
    orbitSpeed: 0.5,
    rotationSpeed: 0.3,
    tilt: { ...DEFAULT_TILT_SETTINGS },
    orbitAxis: { ...DEFAULT_ORBIT_AXIS_SETTINGS },
    phaseOffset: 0,
    eccentricity: 0,
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
        ringCount: 5,
        ringSharpness: 0.7
    }
});

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

// ==================== 辐射系统 ====================

export const createDefaultOrbiting = (id: string, name: string = '粒子环绕'): OrbitingParticlesSettings => ({
    id,
    name,
    enabled: true,
    particleDensity: 2.0, // 替代 count
    orbitRadius: 2.0,     // 修正 radius -> orbitRadius (相对于R的倍数)
    thickness: 10,
    baseSpeed: 1.0,       // 修正 orbitSpeed -> baseSpeed
    particleSize: 3,
    color: '#00ff00',
    gradientColor: { ...DEFAULT_GRADIENT_COLOR },
    fadeWithDistance: true,
    fadeStrength: 0.5,
    mainDirection: { x: 0, y: 1, z: 0 },
    turbulence: 0.5,
    turbulenceScale: 1.0
});

export const createDefaultEmitter = (id: string, name: string = '粒子喷射'): ParticleEmitterSettings => ({
    id,
    name,
    enabled: true,
    birthRate: 50,       // 修正 rate -> birthRate
    initialSpeed: 50,    // 修正 speed -> initialSpeed
    lifeSpan: 3,         // 修正 lifespan -> lifeSpan
    emissionRangeMin: 1.0,
    emissionRangeMax: 2.0,
    color: '#ff0000',
    gradientColor: { ...DEFAULT_GRADIENT_COLOR },
    drag: 0.05,
    fadeOutStrength: 0.5,
    particleSize: 2
});

// ==================== 流萤系统 ====================

export const createDefaultOrbitingFirefly = (id: string, name: string = '旋转流萤'): OrbitingFireflySettings => ({
    id,
    name,
    enabled: true,
    // count 字段不存在于单体定义
    absoluteOrbitRadius: 180,
    orbitSpeed: 0.5,
    orbitAxis: { ...DEFAULT_ORBIT_AXIS_SETTINGS },
    initialPhase: 0,
    billboardOrbit: true,
    size: 4,
    color: '#ffff00',
    brightness: 2.0,
    headStyle: 'flare' as FireflyHeadStyle,
    headTexture: '',
    flareIntensity: 1.0,
    flareLeaves: 4,
    flareWidth: 0.5,
    chromaticAberration: 0,
    velocityStretch: 0,
    noiseAmount: 0,
    glowIntensity: 1.0,
    pulseSpeed: 1.0,
    trailEnabled: true,
    trailLength: 20,
    trailTaperPower: 1,
    trailOpacity: 0.5
});

export const createDefaultWanderingGroup = (id: string, name: string = '飞舞流萤'): WanderingFireflyGroupSettings => ({
    id,
    name,
    enabled: true,
    count: 30,
    innerRadius: 1.2,
    outerRadius: 3.0,
    speed: 1.0,
    turnFrequency: 0.2,
    size: 3.0,
    color: '#00ffff',
    brightness: 2.0,
    headStyle: 'flare' as FireflyHeadStyle,
    headTexture: '',
    flareIntensity: 1.0,
    flareLeaves: 4,
    flareWidth: 0.5,
    chromaticAberration: 0,
    velocityStretch: 0,
    noiseAmount: 0,
    glowIntensity: 1.0,
    pulseSpeed: 1.0,
    trailTaperPower: 1,
    trailOpacity: 0.5
});
