/**
 * InkShaders - 墨迹着色器
 * 
 * input: 笔触数据、笔刷参数
 * output: GLSL 着色器代码，复用星球模式渲染效果
 * pos: 绘图系统渲染核心
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import { BrushType } from '../../types';

// ==================== 通用工具函数 ====================

export const commonUtils = `
// 噪声函数
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (分形布朗运动)
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for(int i = 0; i < 6; i++) {
    if(i >= octaves) break;
    value += amplitude * noise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  
  return value;
}

// Ridged Noise (裂纹效果)
float ridgedNoise(vec2 p) {
  return 1.0 - abs(noise(p) * 2.0 - 1.0);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

// ==================== 星尘笔着色器 ====================

export const stardustVertexShader = `
uniform float uTime;
uniform float uSize;
uniform float uDensity;
uniform float uScatter;
uniform float uGlowIntensity;
uniform float uTwinkleSpeed;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying float vGlow;
varying float vTwinkle;

${commonUtils}

void main() {
  vColor = aColor;
  
  // 基于索引的随机偏移
  float randX = hash(vec2(aPointIndex, 0.0)) - 0.5;
  float randY = hash(vec2(aPointIndex, 1.0)) - 0.5;
  float randZ = hash(vec2(aPointIndex, 2.0)) - 0.5;
  
  vec3 scattered = position + vec3(randX, randY, randZ) * uScatter * aPressure;
  
  // 闪烁效果
  float twinkle = sin(uTime * uTwinkleSpeed + aPointIndex * 6.28) * 0.5 + 0.5;
  vTwinkle = twinkle;
  vGlow = uGlowIntensity * (0.8 + twinkle * 0.4);
  
  // 粒子大小（受压感影响）
  float size = uSize * aPressure * (0.5 + hash(vec2(aPointIndex, 3.0)) * 0.5);
  
  vec4 mvPosition = modelViewMatrix * vec4(scattered, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const stardustFragmentShader = `
uniform float uOpacity;
uniform float uTime;

varying vec3 vColor;
varying float vGlow;
varying float vTwinkle;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  // 柔和的圆形粒子
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  
  // 发光效果
  float glow = exp(-dist * 4.0) * vGlow;
  
  // 闪烁调制
  alpha *= 0.7 + vTwinkle * 0.3;
  
  vec3 finalColor = vColor + vec3(glow * 0.3);
  
  gl_FragColor = vec4(finalColor, alpha * uOpacity);
}
`;

// ==================== 气云笔着色器 ====================

export const gasCloudVertexShader = `
uniform float uTime;
uniform float uSize;
uniform float uNoiseScale;
uniform float uFlowSpeed;
uniform float uSoftness;
uniform float uTurbulence;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying vec2 vUv;
varying float vPressure;
varying float vIndex;

void main() {
  vColor = aColor;
  vPressure = aPressure;
  vIndex = aPointIndex;
  vUv = position.xy;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * aPressure * uSoftness * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const gasCloudFragmentShader = `
uniform float uOpacity;
uniform float uTime;
uniform float uNoiseScale;
uniform float uFlowSpeed;
uniform float uTurbulence;

varying vec3 vColor;
varying vec2 vUv;
varying float vPressure;
varying float vIndex;

${commonUtils}

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  // 流动噪声
  vec2 flowOffset = vec2(uTime * uFlowSpeed, 0.0);
  float noiseVal = fbm((vUv + flowOffset + center * 2.0) * uNoiseScale, 4);
  
  // 湍流效果
  noiseVal += uTurbulence * noise((vUv + flowOffset) * uNoiseScale * 3.0);
  
  // 柔和边缘
  float softEdge = 1.0 - smoothstep(0.0, 0.5, dist);
  float alpha = softEdge * noiseVal * vPressure;
  
  // 颜色变化
  vec3 cloudColor = vColor * (0.8 + noiseVal * 0.4);
  
  gl_FragColor = vec4(cloudColor, alpha * uOpacity);
}
`;

// ==================== 能量束笔着色器 ====================

export const energyBeamVertexShader = `
uniform float uTime;
uniform float uCoreWidth;
uniform float uGlowRadius;
uniform float uGlowIntensity;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying float vPressure;
varying float vIndex;

void main() {
  vColor = aColor;
  vPressure = aPressure;
  vIndex = aPointIndex;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uGlowRadius * aPressure * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const energyBeamFragmentShader = `
uniform float uOpacity;
uniform float uTime;
uniform float uCoreWidth;
uniform float uGlowIntensity;
uniform int uElectricArc;
uniform float uArcFrequency;

varying vec3 vColor;
varying float vPressure;
varying float vIndex;

${commonUtils}

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  // 核心线条
  float core = 1.0 - smoothstep(0.0, uCoreWidth * 0.5, dist);
  
  // 外层辉光
  float glow = exp(-dist * 6.0 / uGlowIntensity) * uGlowIntensity;
  
  // 电弧效果
  float arc = 0.0;
  if (uElectricArc == 1) {
    float arcNoise = noise(vec2(vIndex * 0.1, uTime * uArcFrequency));
    arc = step(0.7, arcNoise) * exp(-dist * 3.0) * 0.5;
  }
  
  float alpha = core + glow + arc;
  
  // 核心更亮
  vec3 coreColor = vColor + vec3(0.3, 0.3, 0.5) * core;
  
  gl_FragColor = vec4(coreColor, alpha * uOpacity * vPressure);
}
`;

// ==================== 螺旋环笔着色器 ====================

export const spiralRingVertexShader = `
uniform float uTime;
uniform float uSpiralDensity;
uniform float uPitch;
uniform float uThickness;
uniform float uRotationSpeed;
uniform float uRiseSpeed;
uniform float uEmissive;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying float vEmissive;
varying float vPressure;

${commonUtils}

void main() {
  vColor = aColor;
  vPressure = aPressure;
  vEmissive = uEmissive;
  
  // 螺旋动画
  float t = aPointIndex * 0.01;
  float angle = t * uSpiralDensity * 6.28 + uTime * uRotationSpeed;
  float rise = t * uPitch + uTime * uRiseSpeed;
  
  vec3 spiralPos = position;
  spiralPos.x += cos(angle) * uThickness * 0.01;
  spiralPos.z += sin(angle) * uThickness * 0.01;
  spiralPos.y += rise * 0.1;
  
  vec4 mvPosition = modelViewMatrix * vec4(spiralPos, 1.0);
  gl_PointSize = uThickness * aPressure * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const spiralRingFragmentShader = `
uniform float uOpacity;
uniform float uTime;

varying vec3 vColor;
varying float vEmissive;
varying float vPressure;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  
  // 自发光
  vec3 emissiveColor = vColor * (1.0 + vEmissive * 0.5);
  float glow = exp(-dist * 4.0) * vEmissive;
  
  gl_FragColor = vec4(emissiveColor + vec3(glow * 0.2), alpha * uOpacity * vPressure);
}
`;

// ==================== 流萤笔着色器 ====================

export const fireflyVertexShader = `
uniform float uTime;
uniform float uHeadSize;
uniform float uHeadBrightness;
uniform float uPulseSpeed;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying float vBrightness;
varying float vPressure;

void main() {
  vColor = aColor;
  vPressure = aPressure;
  
  // 脉冲效果
  float pulse = sin(uTime * uPulseSpeed + aPointIndex) * 0.3 + 0.7;
  vBrightness = uHeadBrightness * pulse;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uHeadSize * aPressure * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const fireflyFragmentShader = `
uniform float uOpacity;
uniform float uTime;
uniform int uHeadStyle; // 0: plain, 1: flare, 2: spark
uniform int uFlareLeaves;

varying vec3 vColor;
varying float vBrightness;
varying float vPressure;

${commonUtils}

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float angle = atan(center.y, center.x);
  
  float alpha = 0.0;
  
  if (uHeadStyle == 0) {
    // Plain - 简单圆形
    alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  } else if (uHeadStyle == 1) {
    // Flare - 星芒效果
    float flare = cos(angle * float(uFlareLeaves)) * 0.5 + 0.5;
    alpha = (1.0 - smoothstep(0.0, 0.3 + flare * 0.2, dist));
  } else {
    // Spark - 火花效果
    float spark = noise(vec2(angle * 3.0, uTime)) * 0.3;
    alpha = 1.0 - smoothstep(0.0, 0.4 + spark, dist);
  }
  
  // 核心发光
  float glow = exp(-dist * 6.0) * vBrightness;
  
  vec3 finalColor = vColor * (1.0 + glow);
  
  gl_FragColor = vec4(finalColor, alpha * uOpacity * vPressure);
}
`;

// ==================== 裂痕笔着色器 ====================

export const fractureVertexShader = `
uniform float uTime;
uniform float uCrackScale;

attribute float aPointIndex;
attribute float aPressure;
attribute vec3 aColor;

varying vec3 vColor;
varying float vPressure;
varying vec2 vUv;
varying float vIndex;

void main() {
  vColor = aColor;
  vPressure = aPressure;
  vUv = position.xy * uCrackScale;
  vIndex = aPointIndex;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 20.0 * aPressure * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const fractureFragmentShader = `
uniform float uOpacity;
uniform float uTime;
uniform float uCrackScale;
uniform float uCrackThreshold;
uniform float uCrackFeather;
uniform float uCrackWarp;
uniform float uFlowSpeed;
uniform float uEmission;

varying vec3 vColor;
varying float vPressure;
varying vec2 vUv;
varying float vIndex;

${commonUtils}

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  
  // 流动偏移
  vec2 flowOffset = vec2(uTime * uFlowSpeed, 0.0);
  
  // 域扭曲
  vec2 warpedUv = vUv + flowOffset;
  warpedUv += vec2(noise(vUv * 3.0), noise(vUv * 3.0 + 100.0)) * uCrackWarp;
  
  // Ridged noise 生成裂纹
  float crack = ridgedNoise(warpedUv * uCrackScale);
  crack = smoothstep(uCrackThreshold - uCrackFeather, uCrackThreshold + uCrackFeather, crack);
  
  // 边缘衰减
  float edgeFade = 1.0 - smoothstep(0.0, 0.5, dist);
  float alpha = crack * edgeFade * vPressure;
  
  // 自发光
  vec3 crackColor = vColor * (1.0 + crack * uEmission);
  
  gl_FragColor = vec4(crackColor, alpha * uOpacity);
}
`;

// ==================== 着色器索引 ====================

export interface ShaderPair {
    vertex: string;
    fragment: string;
}

export const INK_SHADERS: Record<BrushType, ShaderPair> = {
    [BrushType.Stardust]: {
        vertex: stardustVertexShader,
        fragment: stardustFragmentShader
    },
    [BrushType.GasCloud]: {
        vertex: gasCloudVertexShader,
        fragment: gasCloudFragmentShader
    },
    [BrushType.EnergyBeam]: {
        vertex: energyBeamVertexShader,
        fragment: energyBeamFragmentShader
    },
    [BrushType.SpiralRing]: {
        vertex: spiralRingVertexShader,
        fragment: spiralRingFragmentShader
    },
    [BrushType.Firefly]: {
        vertex: fireflyVertexShader,
        fragment: fireflyFragmentShader
    },
    [BrushType.Fracture]: {
        vertex: fractureVertexShader,
        fragment: fractureFragmentShader
    }
};

export default INK_SHADERS;
