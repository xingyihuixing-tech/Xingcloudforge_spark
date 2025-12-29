import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { AppSettings, HandData, ParticleShape, LineStyle, LineColorMode, LineRenderMode, GlowMode, LineGradientMode } from '../types';
import { ProcessedData } from '../services/imageProcessing';
import { computeLines, LineData } from '../services/lineComputation';

// --- SHADERS ---

// 连线顶点着色器 - 与粒子使用相同的位置变换逻辑
const lineVertexShader = `
uniform float uTime;
uniform vec3 uHandPos;
uniform float uHandActive;
uniform float uInteractionRadius;
uniform float uInteractionStrength;
uniform float uExplosion;
uniform float uBlackHole;
uniform float uTurbulence;
uniform float uTurbulenceSpeed;
uniform float uTurbulenceScale;
// 高级动态效果 uniform（与粒子着色器保持一致）
uniform float uBreathing;        // 呼吸效果强度
uniform float uBreathingSpeed;   // 呼吸速度
uniform float uRipple;           // 涟漪效果强度
uniform float uRippleSpeed;      // 涟漪速度
uniform float uAccretion;        // 吸积盘旋转强度
uniform float uAccretionSpeed;   // 吸积盘基础旋转速度
// 多层吸积盘配置 (最多3层)
uniform vec3 uAccretionRadii;       // 各层外边界半径
uniform vec3 uAccretionDirs;        // 各层旋转方向 (1或-1)
uniform vec3 uAccretionSpeeds;      // 各层速度倍数
uniform float uAccretionLayerCount; // 启用的层数

attribute vec3 aColor;
attribute float aLinePosition;  // 0.0 = 起点, 1.0 = 终点
varying vec3 vColor;
varying vec3 vWorldPos;
varying float vLinePosition;    // 传递给片段着色器

// Simplex noise (与粒子着色器相同)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { 
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

mat3 rotateZ(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

void main() {
  vColor = aColor;
  vLinePosition = aLinePosition;
  vec3 pos = position;
  
  // 1. Base Depth Enhancement (与粒子相同)
  pos.z *= 1.5;

  // 2. Ambient Floating + 粒子微动
  if (uBlackHole < 0.1 && uExplosion < 0.1) {
    float drift = snoise(vec3(pos.xy * 0.005, uTime * 0.1));
    pos.z += drift * 20.0;
    
    if (uTurbulence > 0.001) {
      float noiseScale = 0.01 * uTurbulenceScale;
      float timeScale = uTime * uTurbulenceSpeed;
      vec3 noisePos = pos * noiseScale + vec3(timeScale);
      vec3 turbOffset = vec3(
        snoise(noisePos + vec3(0.0, 100.0, 0.0)),
        snoise(noisePos + vec3(100.0, 0.0, 0.0)),
        snoise(noisePos + vec3(0.0, 0.0, 100.0))
      );
      pos += turbOffset * uTurbulence * 30.0;
    }
    
    // 呼吸效果 - 与粒子着色器同步
    if (uBreathing > 0.001) {
      float breathPhase = sin(uTime * uBreathingSpeed * 2.0);
      float breathScale = 1.0 + breathPhase * uBreathing;
      pos.xy *= breathScale;
    }
    
    // 涟漪效果 - 与粒子着色器同步
    if (uRipple > 0.001) {
      float distFromCenter = length(pos.xy);
      float rippleWave = sin(distFromCenter * 0.02 - uTime * uRippleSpeed * 3.0);
      pos.z += rippleWave * uRipple;
    }
    
    // 吸积盘旋转效果 - 与粒子着色器同步（多层配置版）
    if (uAccretion > 0.001) {
      float distFromCenter = length(pos.xy);
      // 根据距离确定所在层，获取该层的方向和速度
      float layerDir = 1.0;
      float layerSpeed = 1.0;
      
      if (uAccretionLayerCount >= 1.0) {
          if (distFromCenter < uAccretionRadii.x) {
              layerDir = uAccretionDirs.x;
              layerSpeed = uAccretionSpeeds.x;
          } else if (uAccretionLayerCount >= 2.0 && distFromCenter < uAccretionRadii.y) {
              layerDir = uAccretionDirs.y;
              layerSpeed = uAccretionSpeeds.y;
          } else if (uAccretionLayerCount >= 3.0) {
              layerDir = uAccretionDirs.z;
              layerSpeed = uAccretionSpeeds.z;
          } else {
              layerDir = uAccretionLayerCount >= 2.0 ? uAccretionDirs.y : uAccretionDirs.x;
              layerSpeed = uAccretionLayerCount >= 2.0 ? uAccretionSpeeds.y : uAccretionSpeeds.x;
          }
      }
      
      // 近快远慢的基础旋转
      float baseRotSpeed = (300.0 / (distFromCenter + 50.0)) * uAccretionSpeed;
      float angle = baseRotSpeed * layerSpeed * uTime * uAccretion * layerDir;
      
      float c = cos(angle);
      float s = sin(angle);
      vec2 rotated = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      pos.xy = rotated;
    }
  }

  // 爆炸效果
  if (uExplosion > 0.001) {
    float noiseVal = snoise(pos * 0.015 + uTime * 0.1);
    float maxExpansion = 300.0 * uExplosion;
    float speedVar = smoothstep(-0.5, 1.0, noiseVal);
    vec3 dir = normalize(pos);
    pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
    vec3 turb = vec3(
      snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
      snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
      snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
    );
    pos += turb * 80.0 * uExplosion;
    pos = rotateZ(uExplosion * 0.4) * pos;
  }
  
  // 黑洞效果
  if (uBlackHole > 0.001) {
    pos.z *= mix(1.0, 0.05, uBlackHole);
    float r = length(pos.xy);
    float spin = (400.0 / (r + 10.0)) * uTime * 1.0 * uBlackHole;
    pos = rotateZ(spin) * pos;
    float targetR = 30.0 + r * 0.2;
    float pull = uBlackHole * 0.95;
    if (r > 1.0) {
      float newR = mix(r, targetR, pull);
      pos.xy = normalize(pos.xy) * newR;
    }
    // 连线不参与喷流效果，只做基础压缩
  }

  // 手势交互
  if (uHandActive > 0.5 && uBlackHole < 0.1 && uExplosion < 0.1) {
    vec3 toHand = pos - uHandPos;
    float dist = length(toHand);
    if (dist < uInteractionRadius) {
      vec3 dir = normalize(toHand);
      float force = (1.0 - dist / uInteractionRadius);
      force = pow(force, 2.0) * uInteractionStrength;
      pos += dir * force;
    }
  }

  vWorldPos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const lineFragmentShader = `
uniform vec3 uLineColor;
uniform float uUseCustomColor;
uniform float uOpacity;
uniform float uDashed;
uniform float uDashScale;
uniform float uColorMode;  // 0=inherit, 1=gradient(fixed), 2=custom, 3=gradient(particle)
uniform vec3 uGradientStart;
uniform vec3 uGradientEnd;
uniform float uGradientIntensity;

varying vec3 vColor;
varying vec3 vWorldPos;
varying float vLinePosition;  // 0.0 = 起点, 1.0 = 终点

void main() {
  // 虚线效果
  if (uDashed > 0.5) {
    float dashPattern = fract((vWorldPos.x + vWorldPos.y + vWorldPos.z) * uDashScale);
    if (dashPattern > 0.5) discard;
  }
  
  vec3 finalColor = vColor;
  
  if (uColorMode > 2.5) {
    // Gradient mode (particle) - 基于两端粒子颜色渐变
    // vColor 已经是当前端点的颜色，通过 vLinePosition 插值
    // 由于两端颜色分别设置在顶点上，这里直接使用 vColor
    // 渐变效果通过硬件插值自动实现
    finalColor = vColor;
  } else if (uColorMode > 1.5) {
    // Custom color mode
    finalColor = uLineColor;
  } else if (uColorMode > 0.5) {
    // Gradient mode (fixed) - 基于位置的固定渐变
    float gradientFactor = fract((vWorldPos.x + vWorldPos.y) * 0.005);
    vec3 gradientColor = mix(uGradientStart, uGradientEnd, gradientFactor);
    // 混合继承色和渐变色
    finalColor = mix(vColor, gradientColor, uGradientIntensity);
  }
  // else: Inherit mode - use vColor directly
  
  gl_FragColor = vec4(finalColor, uOpacity);
}
`;

const vertexShader = `
uniform float uTime;
uniform float uSize;
uniform vec3 uHandPos;
uniform float uHandActive; // 0.0 or 1.0
uniform float uInteractionRadius;
uniform float uInteractionStrength;
uniform float uReturnSpeed;
uniform float uExplosion; // 0.0 to 1.0 (Explode Out)
uniform float uBlackHole; // 0.0 to 1.0 (Implode In)
uniform float uTurbulence; // 粒子扰动强度
uniform float uTurbulenceSpeed; // 扰动速度
uniform float uTurbulenceScale; // 扰动尺度

// 高级动态效果
uniform float uBreathing;        // 呼吸效果强度
uniform float uBreathingSpeed;   // 呼吸速度
uniform float uRipple;           // 涟漪效果强度
uniform float uRippleSpeed;      // 涟漪速度
uniform float uAccretion;        // 吸积盘旋转强度
uniform float uAccretionSpeed;   // 吸积盘基础旋转速度
// 多层吸积盘配置 (最多3层)
uniform vec3 uAccretionRadii;       // 各层外边界半径
uniform vec3 uAccretionDirs;        // 各层旋转方向 (1或-1)
uniform vec3 uAccretionSpeeds;      // 各层速度倍数
uniform float uAccretionLayerCount; // 启用的层数

// 真实海浪效果（Gerstner波）
uniform float uWaveEnabled;         // 启用海浪
uniform float uWaveIntensity;       // 海浪振幅
uniform float uWaveSpeed;           // 海浪速度
uniform float uWaveSteepness;       // 波浪陡度 0-1
uniform float uWaveLayers;          // 波浪层数 1-4
uniform float uWaveDirection;       // 主波方向角度（弧度）
uniform float uWaveDepthFade;       // 深度衰减
uniform float uWaveFoam;            // 波峰泡沫

// 几何映射
uniform float uGeometryMapping;     // 0=none, 1=sphere, 2=cylinder
uniform float uMappingStrength;     // 映射强度 0-1
uniform float uMappingRadius;       // 球体/圆柱半径
uniform vec2 uImageSize;            // 原始图像尺寸（用于UV计算）
uniform float uMappingTileX;        // 水平拼接数 1-8
uniform float uMappingTileY;        // 垂直拼接数 1-4

attribute float aSize;
attribute vec3 aColor;
attribute float aParticleId;  // 粒子ID用于碎片形状和闪烁

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;     // 传递给片段着色器
varying vec2 vVelocity;        // 速度向量（用于拖尾，基于动态效果计算）
varying float vWaveFoam;       // 波峰泡沫强度
varying float vWaveHeight;     // 海浪高度（用于颜色渐变）
varying vec3 vWorldPos;        // 世界坐标（用于闪电效果）

// Simplex noise for organic movement
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// Rotation matrix
mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s,  c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {
  vColor = aColor;
  vParticleId = aParticleId;  // 传递粒子ID
  vec3 pos = position;
  float extraSize = 1.0;
  
  // 初始化速度向量（用于拖尾效果）
  vec2 velocityXY = vec2(0.0);
  
  // 初始化波峰泡沫和海浪高度
  vWaveFoam = 0.0;
  vWaveHeight = 0.0;
  
  // 计算到中心的距离（用于多种效果）
  float distFromCenter = length(pos.xy);
  vDistFromCenter = distFromCenter;
  
  // 1. Base Depth Enhancement
  pos.z *= 1.5;

  // 2. Ambient Floating + 粒子微动（Curl Noise 扰动）
  if (uBlackHole < 0.1 && uExplosion < 0.1) {
      float drift = snoise(vec3(pos.xy * 0.005, uTime * 0.1));
      pos.z += drift * 20.0;
      
      // 粒子微动效果 - 基于位置和时间的噪声扰动
      if (uTurbulence > 0.001) {
          float noiseScale = 0.01 * uTurbulenceScale;
          float timeScale = uTime * uTurbulenceSpeed;
          
          // 3D Curl noise for smooth, fluid-like motion
          vec3 noisePos = pos * noiseScale + vec3(timeScale);
          vec3 turbOffset = vec3(
              snoise(noisePos + vec3(0.0, 100.0, 0.0)),
              snoise(noisePos + vec3(100.0, 0.0, 0.0)),
              snoise(noisePos + vec3(0.0, 0.0, 100.0))
          );
          
          // 应用扰动，强度可调
          vec3 turbDisplacement = turbOffset * uTurbulence * 30.0;
          pos += turbDisplacement;
          
          // 累积速度（用于拖尾）
          velocityXY += turbDisplacement.xy * uTurbulenceSpeed;
      }
      
      // === 呼吸效果 ===
      if (uBreathing > 0.001) {
          float breathPhase = sin(uTime * uBreathingSpeed * 2.0);
          float breathScale = 1.0 + breathPhase * uBreathing;
          
          // 计算呼吸速度（缩放变化率）
          float breathVelocity = cos(uTime * uBreathingSpeed * 2.0) * uBreathingSpeed * 2.0 * uBreathing;
          velocityXY += pos.xy * breathVelocity * 0.5;
          
          pos.xy *= breathScale;
          extraSize *= 1.0 + breathPhase * uBreathing * 0.3;
      }
      
      // === 涟漪效果 ===
      if (uRipple > 0.001) {
          float ripplePhase = sin(distFromCenter * 0.02 - uTime * uRippleSpeed * 3.0);
          pos.z += ripplePhase * uRipple;
      }
      
      // === 海浪效果 ===
      if (uWaveEnabled > 0.5) {
          // 极简海浪：只在 z 方向做波动
          float wavePhase = pos.x * 0.01 + pos.y * 0.01 - uTime * uWaveSpeed;
          float waveZ = sin(wavePhase) * min(uWaveIntensity, 30.0);
          pos.z += waveZ;
          
          // 传递归一化高度
          vWaveHeight = sin(wavePhase);
          
          // 泡沫在波峰
          if (uWaveFoam > 0.5) {
              vWaveFoam = max(0.0, vWaveHeight);
          }
      }
      
      // === 吸积盘旋转效果（多层配置版） ===
      if (uAccretion > 0.001) {
          // 根据距离确定所在层，获取该层的方向和速度
          float layerDir = 1.0;
          float layerSpeed = 1.0;
          
          if (uAccretionLayerCount >= 1.0) {
              if (distFromCenter < uAccretionRadii.x) {
                  layerDir = uAccretionDirs.x;
                  layerSpeed = uAccretionSpeeds.x;
              } else if (uAccretionLayerCount >= 2.0 && distFromCenter < uAccretionRadii.y) {
                  layerDir = uAccretionDirs.y;
                  layerSpeed = uAccretionSpeeds.y;
              } else if (uAccretionLayerCount >= 3.0) {
                  layerDir = uAccretionDirs.z;
                  layerSpeed = uAccretionSpeeds.z;
              } else {
                  // 超出所有层范围，使用最后一层
                  layerDir = uAccretionLayerCount >= 2.0 ? uAccretionDirs.y : uAccretionDirs.x;
                  layerSpeed = uAccretionLayerCount >= 2.0 ? uAccretionSpeeds.y : uAccretionSpeeds.x;
              }
          }
          
          // 近快远慢的基础旋转
          float baseRotSpeed = (300.0 / (distFromCenter + 50.0)) * uAccretionSpeed;
          float angle = baseRotSpeed * layerSpeed * uTime * uAccretion * layerDir;
          
          float c = cos(angle);
          float s = sin(angle);
          vec2 rotated = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          
          // 累积旋转速度（切线方向）
          float rotSpeed = baseRotSpeed * layerSpeed * uAccretion * layerDir;
          velocityXY += vec2(-pos.y, pos.x) * rotSpeed * 0.1;
          
          pos.xy = rotated;
      }
  }

  // --- EXPLOSION: VOLUMETRIC NEBULA CLOUD ---
  if (uExplosion > 0.001) {
      // Create a dense cloud structure to fill the screen
      
      // Noise for clustering
      float noiseVal = snoise(pos * 0.015 + uTime * 0.1); 
      
      // Radial Expansion restricted to visible volume
      // Max radius ~300 ensures it doesn't fly off screen
      float maxExpansion = 300.0 * uExplosion; 
      
      // Non-linear speed: distinct layers
      // Layer mask: -1 to 1.
      float speedVar = smoothstep(-0.5, 1.0, noiseVal); 
      vec3 dir = normalize(pos);
      
      // Expansion logic:
      // Mix between keeping shape (0.4) and expanding (0.6 * variable)
      pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
      
      // Turbulence for smoke detail
      vec3 turb = vec3(
          snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
          snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
          snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
      );
      
      pos += turb * 80.0 * uExplosion;
      
      // Slow Galaxy Rotation
      pos = rotateZ(uExplosion * 0.4) * pos;
      
      // CRITICAL: Size Boost
      // As particles spread, they must get massive to simulate gas volume
      extraSize += uExplosion * 8.0; 
  }
  
  // --- BLACK HOLE: QUASAR / JETS ---
  if (uBlackHole > 0.001) {
      // 1. Flatten to Accretion Disk
      pos.z *= mix(1.0, 0.05, uBlackHole);
      
      // 2. Vortex Spin
      float r = length(pos.xy);
      // Spin faster near center
      float spin = (400.0 / (r + 10.0)) * uTime * 1.0 * uBlackHole;
      pos = rotateZ(spin) * pos;
      
      // 3. Gravitational Compression (Ring)
      float targetR = 30.0 + r * 0.2; 
      float pull = uBlackHole * 0.95; 
      
      if (r > 1.0) {
          float newR = mix(r, targetR, pull);
          pos.xy = normalize(pos.xy) * newR;
      }
      
      // 4. RELATIVISTIC JETS (Cool Factor)
      // Pick random particles to form jets
      // Use original position for stable noise
      float jetSignal = snoise(vec3(position.xy * 0.8, 42.0)); 
      
      if (jetSignal > 0.7 && r < 120.0) {
          float jetIntensity = uBlackHole;
          
          // Shoot up/down along Z
          float jetLen = 500.0 * jetIntensity;
          float side = sign(position.z);
          if (side == 0.0) side = 1.0;
          
          // Squeeze tight in XY
          pos.xy *= 0.05; 
          
          // Stretch Z
          pos.z = side * (50.0 + jetLen * abs(jetSignal)); 
          
          // Spiral the jet
          float jetTwist = pos.z * 0.05 - uTime * 5.0;
          pos.x += sin(jetTwist) * 10.0;
          pos.y += cos(jetTwist) * 10.0;
          
          // High Energy Look
          extraSize += 5.0 * jetIntensity;
          vColor = mix(vColor, vec3(0.6, 0.8, 1.0), jetIntensity); // Blue Jets
      } else {
          // Disk Glow
          float currentR = length(pos.xy);
          if (currentR < 60.0) {
              float heat = (1.0 - currentR / 60.0) * uBlackHole;
              vColor = mix(vColor, vec3(1.0, 0.9, 0.6), heat); // Gold Core
              extraSize += 3.0 * heat;
          }
      }
  }

  // --- Hand Interaction (Repulse) ---
  if (uHandActive > 0.5 && uBlackHole < 0.1 && uExplosion < 0.1) {
    vec3 toHand = pos - uHandPos;
    float dist = length(toHand);
    if (dist < uInteractionRadius) {
        vec3 dir = normalize(toHand);
        float force = (1.0 - dist / uInteractionRadius);
        force = pow(force, 2.0) * uInteractionStrength;
        pos += dir * force;
    }
  }

  // === 几何映射（球形/圆柱） ===
  if (uMappingStrength > 0.001 && uImageSize.x > 1.0 && uImageSize.y > 1.0) {
    vec3 originalPos = pos;
    
    // 计算UV坐标（基于原始position）
    // 粒子位置范围是 [-width/2, +width/2]，转换为 [0, 1]
    float u = (position.x + uImageSize.x * 0.5) / uImageSize.x;
    float v = (position.y + uImageSize.y * 0.5) / uImageSize.y;
    u = clamp(u, 0.0, 1.0);
    v = clamp(v, 0.0, 1.0);
    
    // 拼接：将图案重复 N 次
    // 每个拼接区域占据 1/N 的角度范围
    float tileIndexX = floor(u * uMappingTileX);  // 当前水平拼接索引 0~(N-1)
    float tileIndexY = floor(v * uMappingTileY);  // 当前垂直拼接索引 0~(M-1)
    float localU = fract(u * uMappingTileX);      // 拼接区域内的局部坐标 0~1
    float localV = fract(v * uMappingTileY);
    
    vec3 mappedPos = pos;
    float PI = 3.14159265;
    
    if (uGeometryMapping > 0.5 && uGeometryMapping < 1.5) {
      // 球形映射
      // 每个水平拼接区域占据 2π/N 的经度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float phi = tileIndexX * sectorAngle + localU * sectorAngle;  // 经度
      
      // 每个垂直拼接区域占据 π/M 的纬度范围
      float latitudeRange = PI / uMappingTileY;
      float theta = -PI * 0.5 + tileIndexY * latitudeRange + localV * latitudeRange;  // 纬度
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(theta) * cos(phi);
      mappedPos.y = R * sin(theta);
      mappedPos.z = R * cos(theta) * sin(phi);
      
      // 保留动态效果偏移
      mappedPos += normalize(mappedPos) * (pos.z - position.z) * 0.1;
      
    } else if (uGeometryMapping > 1.5) {
      // 圆柱映射
      // 每个水平拼接区域占据 2π/N 的角度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float alpha = tileIndexX * sectorAngle + localU * sectorAngle;
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(alpha);
      mappedPos.z = R * sin(alpha);
      
      // 垂直方向：保持原始高度比例，根据拼接数调整
      float totalHeight = uImageSize.y;
      float heightPerTile = totalHeight / uMappingTileY;
      mappedPos.y = -totalHeight * 0.5 + tileIndexY * heightPerTile + localV * heightPerTile;
      
      // 保留动态效果偏移（径向方向）
      vec2 radialDir = normalize(vec2(mappedPos.x, mappedPos.z));
      mappedPos.x += radialDir.x * (pos.z - position.z) * 0.1;
      mappedPos.z += radialDir.y * (pos.z - position.z) * 0.1;
    }
    
    // 根据映射强度混合
    pos = mix(originalPos, mappedPos, uMappingStrength);
  }

  vDepth = pos.z;
  vVelocity = velocityXY;  // 传递速度向量到片段着色器
  vWorldPos = pos;         // 传递世界坐标（用于闪电计算）
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  
  // Perspective Size Attenuation - 安全计算
  // 确保 mvPosition.z 为负值且有足够距离，防止 NaN/Inf
  float safeZ = min(mvPosition.z, -10.0);  // 至少距离相机10单位
  gl_PointSize = uSize * aSize * extraSize * (300.0 / -safeZ);
  
  // 限制点大小范围，防止极端值
  gl_PointSize = clamp(gl_PointSize, 0.1, 100.0);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
uniform vec3 uColor;
uniform float uShape; // 0=circle, 1=square, 2=star, ..., 11=fragment, 12=butterfly
uniform float uSaturation;
// 闪电效果
uniform float uWanderingLightning;      // 游走闪电强度
uniform float uWanderingLightningSpeed; // 游走速度
uniform float uWanderingLightningDensity; // 闪电密度
uniform float uWanderingLightningWidth; // 闪电宽度（未使用，保留兼容）
uniform float uLightningBreakdown;      // 闪电击穿强度
uniform float uLightningBreakdownFreq;  // 击穿频率
uniform float uLightningBranches;       // 分支数量
uniform vec2 uImageSize;                // 图像尺寸（用于闪电比例计算）
uniform float uGlowMode;     // 0=none, 1=soft, 2=sharp, 3=aura
uniform float uGlowIntensity; // 光晕强度
uniform float uTime;         // 用于闪烁和碎片形状
uniform float uFlickerEnabled;
uniform float uFlickerIntensity;
uniform float uFlickerSpeed;

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;   // 粒子ID（用于碎片形状和闪烁）
varying vec2 vVelocity;      // 粒子速度向量（用于拖尾）
varying float vWaveFoam;     // 波峰泡沫强度
varying float vWaveHeight;   // 海浪高度（用于颜色渐变）
varying vec3 vWorldPos;      // 世界坐标（用于闪电效果）

// 简化的噪声函数（用于闪电锯齿）
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// 计算光晕效果
// dist: 归一化距离 (0~1, 0=中心, 1=边缘)
// glowMode: 0=none, 1=soft, 2=sharp, 3=aura
// intensity: 光晕强度参数 (1-20)
float computeGlow(float dist, float glowMode, float intensity) {
    if (glowMode < 0.5) {
        // None - 无光晕，完全硬边缘
        // 完全不使用 intensity 参数，返回固定值
        return 1.0;
    } else if (glowMode < 1.5) {
        // Soft - 柔和光晕（smoothstep）
        // intensity 越大，渐变范围越大，效果越柔和
        float fadeStart = max(0.0, 0.5 - intensity * 0.025);  // intensity 1->0.475, 20->0.0
        return 1.0 - smoothstep(fadeStart, 0.5, dist);
    } else if (glowMode < 2.5) {
        // Sharp - 锐利光晕（指数衰减，像恒星）
        // intensity 越大，光晕越亮/扩散越大
        float strength = max(0.0, 1.0 - dist * 2.0);
        float exponent = max(0.5, 10.0 / intensity);  // intensity大 -> exponent小 -> 更亮
        return pow(strength, exponent);
    } else {
        // Aura - 光环效果
        float coreExponent = max(0.5, 8.0 / intensity);
        float core = pow(max(0.0, 1.0 - dist * 2.5), coreExponent);
        float ringWidth = 0.02 + 0.04 * (intensity / 20.0);
        float ring = smoothstep(0.3, 0.3 + ringWidth, dist) * (1.0 - smoothstep(0.4, 0.5, dist));
        return core + ring * 0.5;
    }
}

// 简单哈希函数已在上方定义（用于闪电锯齿和碎片形状）

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  float alpha = 1.0;
  
  // 形状缩放因子：特殊形状放大
  // scaleFactor > 1 表示放大坐标系，使形状显示更大
  float scaleFactor = 1.0;
  if (uShape > 1.5 && uShape < 6.5) {
    // 星形(2)、雪花(3)、爱心(4)、钻石(5)、月牙(6)
    scaleFactor = 2.5;  // 放大2.5倍
  } else if (uShape > 6.5 && uShape < 11.5) {
    // 十字光(7)、樱花(8)、太阳(9)、八面体(10)、碎片(11)
    scaleFactor = 2.5;  // 放大2.5倍
  }
  // 圆形(0)、方形(1)、蝴蝶(12) 保持原大小 scaleFactor = 1.0
  
  vec2 scaledCoord = coord / scaleFactor;  // 缩小坐标 = 放大形状
  float scaledDist = length(scaledCoord);
  
  // Shape Logic
  if (uShape < 0.5) { 
    // Circle
    if (dist > 0.5) discard;
    alpha = computeGlow(dist, uGlowMode, uGlowIntensity);
  } 
  else if (uShape < 1.5) { 
    // Square
    if (abs(coord.x) > 0.45 || abs(coord.y) > 0.45) discard;
    float edgeDist = max(abs(coord.x), abs(coord.y));
    alpha = computeGlow(edgeDist, uGlowMode, uGlowIntensity);
  } 
  else if (uShape < 2.5) { 
    // Star (5-pointed) - 放大
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float r = 0.5 * (0.55 + 0.45 * cos(5.0 * angle)); 
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 3.5) { 
    // Snowflake - 放大
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float f = abs(cos(angle * 3.0)); 
    f += 0.5 * abs(cos(angle * 12.0));
    float r = 0.5 * clamp(f, 0.3, 0.8);
    if (scaledDist > r && scaledDist > 0.2) discard; 
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 4.5) { 
    // Heart - 正向爱心 - 放大
    vec2 p = scaledCoord * 2.5;
    p.y = -p.y + 0.2;
    float heart = pow(p.x * p.x + p.y * p.y - 0.35, 3.0) - p.x * p.x * p.y * p.y * p.y;
    if (heart > 0.0) discard;
    alpha = computeGlow(scaledDist * 1.2, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 5.5) { 
    // Diamond (经典钻石形状) - 简洁的菱形+倒三角
    vec2 p = scaledCoord;
    
    // 经典钻石：上半部分八边形冠部，下半部分尖锐亭部
    float absX = abs(p.x);
    float absY = abs(p.y);
    
    bool inside = false;
    
    // 上半部分：扁平的八边形/梯形（冠部）
    if (p.y >= 0.0) {
      float topWidth = 0.25;  // 顶部宽度
      float midWidth = 0.4;   // 腰部宽度
      float height = 0.15;    // 冠部高度
      if (p.y < height) {
        float w = mix(midWidth, topWidth, p.y / height);
        inside = absX < w;
      }
    }
    // 下半部分：尖锐的倒三角（亭部）
    else {
      float midWidth = 0.4;   // 腰部宽度
      float depth = 0.35;     // 亭部深度
      if (p.y > -depth) {
        float t = -p.y / depth;
        float w = midWidth * (1.0 - t);
        inside = absX < w;
      }
    }
    
    if (!inside) discard;
    
    // 钻石闪烁效果
    float sparkle = abs(sin(atan(p.y, p.x) * 6.0)) * 0.2;
    alpha = computeGlow(scaledDist * 0.9, uGlowMode, uGlowIntensity) + sparkle;
  }
  else if (uShape < 6.5) { 
    // Crescent (月牙) - 放大
    float d1 = length(scaledCoord);
    float d2 = length(scaledCoord - vec2(0.22, 0.0));
    if (d1 > 0.45 || d2 < 0.38) discard;
    float edgeDist = (0.45 - d1) / 0.45;
    alpha = computeGlow(1.0 - edgeDist, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 7.5) { 
    // CrossGlow (十字光芒) - 放大
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.6 + 0.4 * abs(cos(2.0 * angle)));
    float curve = 0.08 * cos(4.0 * angle);
    float r = petal + curve;
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 8.5) { 
    // Sakura (樱花) - 放大
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.8 + 0.5 * cos(5.0 * angle) + 0.2 * cos(10.0 * angle));
    float notch = 0.05 * (1.0 + cos(5.0 * angle + 3.14159));
    float r = petal - notch;
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 9.5) { 
    // Sun (太阳) - 放大
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float rays = 0.35 + 0.15 * cos(12.0 * angle);
    float core = 0.25;
    if (scaledDist > rays) discard;
    // 核心区域更亮，光芒区域渐变
    if (scaledDist < core) {
      alpha = computeGlow(scaledDist / core, uGlowMode, uGlowIntensity);
    } else {
      // 光芒区域：根据距离渐变
      float rayFade = 1.0 - (scaledDist - core) / (rays - core);
      alpha = rayFade * 0.8;
    }
  }
  else if (uShape < 10.5) { 
    // Octahedron (正八面体 2D 投影)
    vec2 p = scaledCoord;
    // 八面体投影：两个对角菱形叠加
    float d1 = abs(p.x) + abs(p.y);  // 主菱形
    float d2 = abs(p.x * 0.7 + p.y * 0.7) + abs(p.x * 0.7 - p.y * 0.7);  // 45度旋转
    float d = min(d1, d2 * 1.2);
    if (d > 0.45) discard;
    // 添加内部线条效果
    float edge = smoothstep(0.35, 0.4, d) * 0.3;
    alpha = computeGlow(d / 0.45, uGlowMode, uGlowIntensity) + edge;
  }
  else if (uShape < 11.5) { 
    // Fragment (不规则碎片)
    vec2 p = scaledCoord;
    // 使用粒子ID生成随机形状
    float id = vParticleId;
    float seed = hash(id);
    
    // 随机多边形：3-6 边
    float sides = 3.0 + floor(seed * 4.0);
    float angle = atan(p.y, p.x);
    float rotation = seed * 6.28318;  // 随机旋转
    angle += rotation;
    
    // 不规则边缘
    float irregularity = 0.1 + seed * 0.15;
    float r = 0.4;
    r += irregularity * sin(sides * angle + seed * 10.0);
    r += irregularity * 0.5 * sin(sides * 2.0 * angle + seed * 20.0);
    
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else { 
    // Butterfly (蝴蝶) - 更逼真的蝴蝶形状
    vec2 p = coord;  // 使用原始坐标
    float px = abs(p.x);  // 左右对称
    float py = p.y;
    
    bool inside = false;
    
    // 上翅膀 - 大而圆润
    if (py > 0.0) {
      // 椭圆形上翅膀
      float wingX = px - 0.2;  // 翅膀中心偏移
      float wingY = py - 0.15;
      float upperWing = (wingX * wingX) / 0.09 + (wingY * wingY) / 0.04;
      if (upperWing < 1.0 && px > 0.05) inside = true;
    }
    
    // 下翅膀 - 较小，略尖
    if (py <= 0.0 && py > -0.25) {
      float wingX = px - 0.15;
      float wingY = py + 0.12;
      float lowerWing = (wingX * wingX) / 0.05 + (wingY * wingY) / 0.025;
      if (lowerWing < 1.0 && px > 0.03) inside = true;
    }
    
    // 身体 - 细长椭圆
    float bodyWidth = 0.04;
    float bodyHeight = 0.35;
    if (px < bodyWidth && py > -0.2 && py < 0.25) {
      inside = true;
    }
    
    if (!inside) discard;
    alpha = computeGlow(dist * 1.5, uGlowMode, uGlowIntensity);
  }

  // 荧光闪烁效果
  if (uFlickerEnabled > 0.5) {
    float flickerPhase = vParticleId * 6.28318 + uTime * uFlickerSpeed;
    float flicker = 0.5 + 0.5 * sin(flickerPhase);
    flicker = mix(1.0, flicker, uFlickerIntensity);
    alpha *= flicker;
  }
  
  // ============ 闪电效果（基于世界坐标） ============
  vec3 lightningColor = vColor;
  
  // 计算图形半径 R（用于相对尺寸）
  float R = max(uImageSize.x, uImageSize.y) * 0.5;
  if (R < 1.0) R = 400.0;  // 防止除零
  
  // 归一化世界坐标到 [-1, 1]
  vec2 normPos = vWorldPos.xy / R;
  
  // === 游走闪电团（Wandering Plasma Clusters） ===
  if (uWanderingLightning > 0.01) {
    float t = uTime * uWanderingLightningSpeed;
    float clusterHit = 0.0;
    
    // 3-5 个能量团
    for (float i = 0.0; i < 5.0; i++) {
      if (i >= uWanderingLightningDensity) break;
      
      // 每个能量团的随机种子
      float seed = i * 17.31 + 0.5;
      
      // 能量团中心位置（布朗运动游走）
      float cx = sin(t * 0.7 + seed * 3.0) * 0.6 + sin(t * 1.3 + seed) * 0.3;
      float cy = cos(t * 0.5 + seed * 2.0) * 0.6 + cos(t * 1.1 + seed * 1.5) * 0.3;
      vec2 clusterCenter = vec2(cx, cy);
      
      // 到能量团中心的距离
      float distToCluster = length(normPos - clusterCenter);
      
      // 能量团半径（0.15R ~ 0.25R）
      float clusterRadius = 0.15 + 0.1 * sin(seed * 5.0);
      
      // 团内效果
      if (distToCluster < clusterRadius * 1.5) {
        // 核心亮度
        float coreBrightness = smoothstep(clusterRadius, 0.0, distToCluster);
        
        // 内部电弧效果
        float angle = atan(normPos.y - cy, normPos.x - cx);
        float arcNoise = sin(angle * 8.0 + t * 5.0 + seed * 10.0) * 0.5 + 0.5;
        arcNoise *= sin(angle * 12.0 - t * 3.0 + seed * 7.0) * 0.5 + 0.5;
        
        // 闪烁
        float flicker = 0.7 + 0.3 * sin(t * 15.0 + seed * 20.0);
        
        float brightness = coreBrightness * (0.5 + arcNoise * 0.5) * flicker;
        clusterHit = max(clusterHit, brightness);
      }
    }
    
    // 团簇间电弧（当两个团靠近时）
    for (float i = 0.0; i < 4.0; i++) {
      float j = i + 1.0;
      if (j >= uWanderingLightningDensity) break;
      
      float seed1 = i * 17.31 + 0.5;
      float seed2 = j * 17.31 + 0.5;
      
      vec2 c1 = vec2(
        sin(t * 0.7 + seed1 * 3.0) * 0.6 + sin(t * 1.3 + seed1) * 0.3,
        cos(t * 0.5 + seed1 * 2.0) * 0.6 + cos(t * 1.1 + seed1 * 1.5) * 0.3
      );
      vec2 c2 = vec2(
        sin(t * 0.7 + seed2 * 3.0) * 0.6 + sin(t * 1.3 + seed2) * 0.3,
        cos(t * 0.5 + seed2 * 2.0) * 0.6 + cos(t * 1.1 + seed2 * 1.5) * 0.3
      );
      
      float interDist = length(c2 - c1);
      if (interDist < 0.8) {
        // 计算到连接线的距离
        vec2 lineDir = normalize(c2 - c1);
        float proj = dot(normPos - c1, lineDir);
        proj = clamp(proj, 0.0, interDist);
        vec2 closestPoint = c1 + lineDir * proj;
        float distToLine = length(normPos - closestPoint);
        
        // 锯齿效果
        float zigzag = sin(proj * 30.0 + t * 10.0) * 0.02;
        distToLine += zigzag;
        
        // 电弧宽度和亮度
        float arcWidth = 0.03 * (1.0 - interDist / 0.8);
        float arcBrightness = smoothstep(arcWidth * 2.0, 0.0, distToLine);
        arcBrightness *= (1.0 - interDist / 0.8);  // 越近越亮
        
        clusterHit = max(clusterHit, arcBrightness * 0.8);
      }
    }
    
    // 应用游走闪电效果
    if (clusterHit > 0.01) {
      // 颜色梯度：核心白 → 青色光晕 → 蓝色边缘
      vec3 coreColor = vec3(1.0, 1.0, 1.0);       // 白色核心
      vec3 glowColor = vec3(0.5, 1.0, 1.0);       // 青色光晕
      vec3 edgeColor = vec3(0.2, 0.4, 1.0);       // 蓝色边缘
      
      vec3 electricColor;
      if (clusterHit > 0.7) {
        electricColor = mix(glowColor, coreColor, (clusterHit - 0.7) / 0.3);
      } else if (clusterHit > 0.3) {
        electricColor = mix(edgeColor, glowColor, (clusterHit - 0.3) / 0.4);
      } else {
        electricColor = edgeColor;
      }
      
      lightningColor = mix(vColor, electricColor, clusterHit * uWanderingLightning);
      alpha = max(alpha, clusterHit * uWanderingLightning);
    }
  }
  
  // === 闪电击穿效果（贯穿整个图案） ===
  if (uLightningBreakdown > 0.01) {
    float breakdownCycle = uTime * uLightningBreakdownFreq;
    float cyclePhase = fract(breakdownCycle);
    float cycleIndex = floor(breakdownCycle);
    
    // 闪电持续时间
    if (cyclePhase < 0.4) {
      float breakdownIntensity = 1.0 - cyclePhase / 0.4;
      breakdownIntensity = pow(breakdownIntensity, 1.5);
      
      float totalStrike = 0.0;
      
      // 3-5 条主干闪电，从边缘穿心
      for (float bolt = 0.0; bolt < 5.0; bolt++) {
        if (bolt >= 3.0 + uLightningBranches * 0.5) break;
        
        float boltSeed = cycleIndex * 100.0 + bolt * 37.73;
        
        // 入射点和出射点（在边缘对角位置）
        float angle1 = hash(boltSeed) * 6.28318 + bolt * 1.2;
        float angle2 = angle1 + 3.14159 + (hash(boltSeed + 1.0) - 0.5) * 1.0;
        
        vec2 p1 = vec2(cos(angle1), sin(angle1)) * 1.2;  // 略超出边界确保穿透
        vec2 p2 = vec2(cos(angle2), sin(angle2)) * 1.2;
        
        // 主干方向
        vec2 boltDir = normalize(p2 - p1);
        float boltLength = length(p2 - p1);
        
        // 计算粒子到主干的投影
        float proj = dot(normPos - p1, boltDir);
        proj = clamp(proj, 0.0, boltLength);
        
        // 沿主干的位置比例
        float alongBolt = proj / boltLength;
        
        // 锯齿偏移（中点位移模拟）
        float zigzag = 0.0;
        float amplitude = 0.15;
        for (float octave = 0.0; octave < 4.0; octave++) {
          float freq = pow(2.0, octave);
          zigzag += sin(alongBolt * freq * 10.0 + boltSeed * (octave + 1.0) + uTime * 2.0) * amplitude / freq;
        }
        
        // 计算到锯齿路径的距离
        vec2 boltPoint = p1 + boltDir * proj;
        vec2 perpDir = vec2(-boltDir.y, boltDir.x);
        boltPoint += perpDir * zigzag;
        
        float distToBolt = length(normPos - boltPoint);
        
        // 主干宽度（核心 + 光晕）
        float coreWidth = 0.02;
        float glowWidth = 0.08;
        
        float coreBrightness = smoothstep(coreWidth, 0.0, distToBolt);
        float glowBrightness = smoothstep(glowWidth, coreWidth, distToBolt) * 0.5;
        float boltBrightness = coreBrightness + glowBrightness;
        
        // 分支
        for (float branch = 0.0; branch < 3.0; branch++) {
          if (branch >= uLightningBranches) break;
          
          float branchSeed = boltSeed + branch * 23.45;
          float branchStart = 0.2 + hash(branchSeed) * 0.6;  // 分支起点
          
          if (alongBolt > branchStart - 0.05 && alongBolt < branchStart + 0.3) {
            // 分支方向（30-45度角）
            float branchAngle = (hash(branchSeed + 1.0) - 0.5) * 0.8;  // ±0.4 rad ≈ ±23°
            vec2 branchDir = vec2(
              boltDir.x * cos(branchAngle) - boltDir.y * sin(branchAngle),
              boltDir.x * sin(branchAngle) + boltDir.y * cos(branchAngle)
            );
            
            vec2 branchOrigin = p1 + boltDir * (branchStart * boltLength) + perpDir * zigzag;
            float branchProj = dot(normPos - branchOrigin, branchDir);
            branchProj = clamp(branchProj, 0.0, 0.4);
            
            // 分支锯齿
            float branchZigzag = sin(branchProj * 20.0 + branchSeed) * 0.03;
            vec2 branchPoint = branchOrigin + branchDir * branchProj;
            branchPoint += vec2(-branchDir.y, branchDir.x) * branchZigzag;
            
            float distToBranch = length(normPos - branchPoint);
            float branchWidth = 0.015 * (1.0 - branchProj * 2.0);
            branchWidth = max(branchWidth, 0.005);
            
            float branchBrightness = smoothstep(branchWidth * 2.0, 0.0, distToBranch) * 0.7;
            boltBrightness = max(boltBrightness, branchBrightness);
          }
        }
        
        totalStrike = max(totalStrike, boltBrightness);
      }
      
      totalStrike *= breakdownIntensity;
      
      // 应用闪电击穿效果
      if (totalStrike > 0.01) {
        // 颜色梯度
        vec3 coreColor = vec3(1.0, 1.0, 1.0);
        vec3 glowColor = vec3(0.53, 1.0, 1.0);
        vec3 edgeColor = vec3(0.0, 0.0, 1.0);
        
        vec3 strikeColor;
        if (totalStrike > 0.7) {
          strikeColor = mix(glowColor, coreColor, (totalStrike - 0.7) / 0.3);
        } else if (totalStrike > 0.3) {
          strikeColor = mix(edgeColor, glowColor, (totalStrike - 0.3) / 0.4);
        } else {
          strikeColor = mix(edgeColor * 0.5, edgeColor, totalStrike / 0.3);
        }
        
        lightningColor = mix(lightningColor, strikeColor, totalStrike * uLightningBreakdown);
        alpha = max(alpha, totalStrike * uLightningBreakdown);
      }
    }
  }

  // === 海浪颜色效果 ===
  vec3 finalColor = lightningColor;
  
  // 三段式海浪颜色（基于高度）
  if (abs(vWaveHeight) > 0.001 || vWaveFoam > 0.01) {
    // 颜色定义
    vec3 deepColor = vec3(0.0, 0.08, 0.25);   // 深蓝（波谷）
    vec3 midColor = vec3(0.0, 0.45, 0.55);    // 青蓝（浪身）
    vec3 peakColor = vec3(0.7, 0.95, 1.0);    // 浅青白（波峰）
    vec3 foamColor = vec3(1.0, 1.0, 1.0);     // 纯白（泡沫）
    
    // 将高度从 [-1,1] 映射到 [0,1]
    float heightT = (vWaveHeight + 1.0) * 0.5;
    
    // 三段式颜色插值
    vec3 waveColor;
    if (heightT < 0.4) {
      // 深水区 → 中层区
      waveColor = mix(deepColor, midColor, heightT / 0.4);
    } else if (heightT < 0.7) {
      // 中层区 → 波峰区
      waveColor = mix(midColor, peakColor, (heightT - 0.4) / 0.3);
    } else {
      // 波峰区
      waveColor = peakColor;
    }
    
    // 混合原始颜色和海浪颜色（保留部分原始色调）
    float waveColorStrength = 0.6;  // 海浪颜色强度
    finalColor = mix(lightningColor, waveColor, waveColorStrength);
    
    // 泡沫效果
    if (vWaveFoam > 0.01) {
      // 高频闪烁模拟阳光反射
      float sparkle = sin(uTime * 25.0 + vParticleId * 100.0) * 0.5 + 0.5;
      sparkle *= sin(uTime * 37.0 + vParticleId * 73.0) * 0.5 + 0.5;
      float foamFlicker = 0.7 + sparkle * 0.3;  // 0.7-1.0 范围闪烁
      
      // 泡沫颜色：白色 + 闪烁
      vec3 sparklingFoam = foamColor * foamFlicker;
      
      // 根据泡沫强度混合
      float foamMix = vWaveFoam * 0.8;
      finalColor = mix(finalColor, sparklingFoam, foamMix);
      
      // 泡沫增加亮度和不透明度
      alpha = max(alpha, vWaveFoam * 0.6);
    }
  }

  gl_FragColor = vec4(finalColor, alpha);

  // Saturation
  vec3 color = gl_FragColor.rgb;
  if (uSaturation != 1.0) {
     vec3 hsv = rgb2hsv(color);
     hsv.y *= uSaturation;
     color = hsv2rgb(hsv);
  }
  
  gl_FragColor.rgb = color;
}
`;

interface NebulaSceneProps {
  data: ProcessedData | null;
  settings: AppSettings;
  handData: React.MutableRefObject<HandData>;
  colorPickMode?: boolean;
  onColorPick?: (color: { h: number; s: number; l: number }) => void;
}

// RGB 转 HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

const NebulaScene: React.FC<NebulaSceneProps> = ({ data, settings, handData, colorPickMode, onColorPick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const afterimagePassRef = useRef<AfterimagePass | null>(null);
  
  // iOS设备标记 - 用于决定是否使用后处理
  const usePostProcessingRef = useRef(true);
  
  // 连线相关
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const lineMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const lineDataRef = useRef<LineData | null>(null);

  const currentExplosionRef = useRef(0);
  const targetExplosionRef = useRef(0);
  
  const currentBlackHoleRef = useRef(0);
  const targetBlackHoleRef = useRef(0);
  
  // 取色处理 - 从渲染结果中读取像素
  const handleCanvasClick = (event: MouseEvent) => {
    if (!colorPickMode || !onColorPick || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    const canvas = rendererRef.current.domElement;
    const rect = canvas.getBoundingClientRect();
    const centerX = Math.round((event.clientX - rect.left) * window.devicePixelRatio);
    const centerY = Math.round((rect.height - (event.clientY - rect.top)) * window.devicePixelRatio);
    
    // 先渲染一帧到默认帧缓冲，然后读取
    const renderer = rendererRef.current;
    
    // 保存当前渲染目标
    const currentTarget = renderer.getRenderTarget();
    
    // 渲染到默认帧缓冲
    renderer.setRenderTarget(null);
    // 根据是否使用后处理选择渲染方式
    if (usePostProcessingRef.current && composerRef.current) {
      composerRef.current.render();
    } else {
      renderer.render(sceneRef.current, cameraRef.current);
    }
    
    // 读取 9x9 区域的像素（更大的采样区域）
    const sampleSize = 9;
    const gl = renderer.getContext();
    const pixels = new Uint8Array(sampleSize * sampleSize * 4);
    
    gl.readPixels(
      centerX - Math.floor(sampleSize / 2),
      centerY - Math.floor(sampleSize / 2),
      sampleSize, sampleSize,
      gl.RGBA, gl.UNSIGNED_BYTE,
      pixels
    );
    
    // 恢复渲染目标
    renderer.setRenderTarget(currentTarget);
    
    // 计算非黑色像素的平均颜色
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      // 忽略太暗的像素（背景）
      if (r + g + b > 30) {
        totalR += r; totalG += g; totalB += b;
        count++;
      }
    }
    
    if (count === 0) {
      // 没有有效像素，返回红色作为默认
      onColorPick({ h: 0, s: 1, l: 0.5 });
    } else {
      const hsl = rgbToHsl(
        Math.round(totalR / count),
        Math.round(totalG / count),
        Math.round(totalB / count)
      );
      console.log('Picked color RGB:', Math.round(totalR/count), Math.round(totalG/count), Math.round(totalB/count), 'HSL:', hsl);
      onColorPick(hsl);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing canvas (important for React StrictMode)
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // 初始背景色（会被主题监听器更新）
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    sceneRef.current = scene;
    
    // 监听主题变化，更新背景色
    const updateBackgroundColor = () => {
      const style = getComputedStyle(document.documentElement);
      const isLight = document.documentElement.classList.contains('theme-light');
      if (isLight) {
        // 浅色模式：读取自定义背景色
        const lightBg = style.getPropertyValue('--custom-light-bg').trim() || '#F4F1EC';
        scene.background = new THREE.Color(lightBg);
        scene.fog = new THREE.FogExp2(new THREE.Color(lightBg).getHex(), 0.0005);
      } else {
        // 深色模式：读取自定义背景色
        const darkBg = style.getPropertyValue('--custom-dark-bg').trim() || '#000000';
        scene.background = new THREE.Color(darkBg);
        scene.fog = new THREE.FogExp2(new THREE.Color(darkBg).getHex(), 0.001);
      }
    };
    
    // 初始化时执行一次
    updateBackgroundColor();
    
    // 监听主题类变化（只监听 class，不监听 style，避免主题色变化触发）
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateBackgroundColor();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    // 清理函数中断开观察者
    const disconnectObserver = () => observer.disconnect();

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 4000); 
    camera.position.set(0, 0, 800); 
    cameraRef.current = camera;

    // 检测移动设备和iOS
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    // 检测是否为iPad（包括iPadOS 13+伪装成Mac的情况）
    const isIPad = /iPad/i.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // iOS Safari 对 WebGL 后处理支持有限，在iOS上完全跳过后处理
    const skipPostProcessing = isIOS || isIPad;
    usePostProcessingRef.current = !skipPostProcessing;
    
    if (skipPostProcessing) {
      console.log('iOS/iPad detected: Disabling post-processing for better compatibility');
    }
    
    // 移动设备使用更保守的设置
    const renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile, // 非移动设备启用抗锯齿
      powerPreference: isMobile ? "default" : "high-performance",
      // iOS需要alpha通道避免一些渲染问题
      alpha: isIOS || isIPad,
      // iOS需要更保守的设置
      preserveDrawingBuffer: isIOS || isIPad,
      failIfMajorPerformanceCaveat: false
    });
    
    // 限制移动设备的像素比以避免GPU内存不足
    const maxPixelRatio = isMobile ? 1.0 : window.devicePixelRatio; // iOS进一步降低像素比
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(width, height);
    // iOS上不使用ToneMapping以避免潜在问题
    if (!skipPostProcessing) {
      renderer.toneMapping = THREE.ReinhardToneMapping;
    }
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // WebGL context lost/restored 处理
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost. Page will reload to recover...');
      // 延迟重载，给用户看到警告信息
      setTimeout(() => window.location.reload(), 1000);
    };
    
    const handleContextRestored = () => {
      console.log('WebGL context restored.');
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = settings.autoRotate;
    controls.autoRotateSpeed = settings.autoRotateSpeed;
    // 放宽视角限制，允许更自由的垂直旋转
    controls.minPolarAngle = 0.1;           // 接近顶部（留一点余量避免万向锁）
    controls.maxPolarAngle = Math.PI - 0.1; // 接近底部
    controls.minDistance = 50;              // 最小缩放距离
    controls.maxDistance = 1500;            // 最大缩放距离
    controlsRef.current = controls;

    // 只有在非iOS设备上才创建后处理管线
    if (!skipPostProcessing) {
      const renderScene = new RenderPass(scene, camera);
      
      // 移动设备降低后处理分辨率
      const postProcessScale = isMobile ? 0.5 : 1.0;
      const ppWidth = Math.floor(width * postProcessScale);
      const ppHeight = Math.floor(height * postProcessScale);
      
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(ppWidth, ppHeight), 1.5, 0.4, 0.85);
      bloomPass.threshold = 0;
      // 移动设备降低bloom强度以提高性能
      bloomPass.strength = isMobile ? Math.min(settings.bloomStrength, 1.0) : settings.bloomStrength;
      bloomPass.radius = isMobile ? 0.3 : 0.5;
      bloomPassRef.current = bloomPass;

      // 创建残影效果 (Afterimage) - 用于拖尾
      // damp 值：0.0 = 无残影，1.0 = 完全保留（不衰减）
      // trailLength 0-1 映射到 damp 0.8-0.96
      // 移动设备禁用残影以提高性能
      const initialDamp = (settings.trailEnabled && !isMobile) ? (0.8 + settings.trailLength * 0.16) : 0;
      const afterimagePass = new AfterimagePass(initialDamp);
      afterimagePassRef.current = afterimagePass;

      const composer = new EffectComposer(renderer);
      composer.addPass(renderScene);
      // 移动设备跳过残影效果
      if (!isMobile) {
        composer.addPass(afterimagePass);
      }
      composer.addPass(bloomPass);
      composerRef.current = composer;
    } else {
      // iOS设备不使用后处理，composerRef保持null
      composerRef.current = null;
      bloomPassRef.current = null;
      afterimagePassRef.current = null;
    }

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      // 只有在使用后处理时才更新composer大小
      if (composerRef.current) {
        composerRef.current.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const time = clock.getElapsedTime();
      const hand = handData.current;

      let lerpSpeed = 0.03;

      if (hand.isActive) {
          if (hand.isClosed) {
              // FIST -> Black Hole effect (粒子向手心聚拢)
              targetBlackHoleRef.current = 1.0;
              targetExplosionRef.current = 0.0;
              lerpSpeed = 0.05; 
          } else {
              // OPEN HAND -> Explosion effect, intensity based on openness (张开程度控制爆炸强度)
              targetBlackHoleRef.current = 0.0;
              // openness 0-1 maps to explosion 0-1
              targetExplosionRef.current = hand.openness;
              lerpSpeed = 0.04; 
          }
      } else {
          // NO HAND -> Restore to original
          targetBlackHoleRef.current = 0.0;
          targetExplosionRef.current = 0.0;
          lerpSpeed = 0.02;
      }

      currentExplosionRef.current += (targetExplosionRef.current - currentExplosionRef.current) * lerpSpeed;
      currentBlackHoleRef.current += (targetBlackHoleRef.current - currentBlackHoleRef.current) * lerpSpeed;

      // 计算手势位置（供粒子和连线共用）
      let handPos = new THREE.Vector3();
      let handActive = 0.0;
      
      if (hand.isActive) {
        const vector = new THREE.Vector3(hand.x, hand.y, 0.5); 
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z; 
        handPos = camera.position.clone().add(dir.multiplyScalar(distance));
        handActive = 1.0;
      }
      
      // 更新粒子材质
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time;
        materialRef.current.uniforms.uExplosion.value = currentExplosionRef.current;
        materialRef.current.uniforms.uBlackHole.value = currentBlackHoleRef.current;
        materialRef.current.uniforms.uHandPos.value.copy(handPos);
        materialRef.current.uniforms.uHandActive.value = handActive;
      }
      
      // 同步更新连线材质（使用相同的 uniform 值）
      if (lineMaterialRef.current) {
        const lineUniforms = lineMaterialRef.current.uniforms;
        lineUniforms.uTime.value = time;
        lineUniforms.uExplosion.value = currentExplosionRef.current;
        lineUniforms.uBlackHole.value = currentBlackHoleRef.current;
        lineUniforms.uHandPos.value.copy(handPos);
        lineUniforms.uHandActive.value = handActive;
      }

      if (controlsRef.current) controlsRef.current.update();
      
      // 根据设备选择渲染方式
      if (usePostProcessingRef.current && composerRef.current) {
        // 桌面端：使用后处理管线
        composerRef.current.render();
      } else {
        // iOS/iPad：直接渲染，跳过后处理
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      disconnectObserver(); // 断开主题监听
      renderer.dispose();
      scene.clear();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); 

  useEffect(() => {
    if (!data || !sceneRef.current) return;

    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
    
    // 添加粒子 ID（用于碎片形状和闪烁效果）
    const particleIds = new Float32Array(data.count);
    for (let i = 0; i < data.count; i++) {
      particleIds[i] = i;
    }
    geometry.setAttribute('aParticleId', new THREE.BufferAttribute(particleIds, 1));
    
    // 计算 bounding box 来获取 center 偏移量
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    const centerOffset = new THREE.Vector3();
    if (boundingBox) {
      boundingBox.getCenter(centerOffset);
    }
    geometry.center();
    
    // 保存 center 偏移量供连线使用
    (geometry as any).centerOffset = centerOffset;

    // 计算形状值
    const shapeMap: Record<ParticleShape, number> = {
      [ParticleShape.Circle]: 0.0,
      [ParticleShape.Square]: 1.0,
      [ParticleShape.Star]: 2.0,
      [ParticleShape.Snowflake]: 3.0,
      [ParticleShape.Heart]: 4.0,
      [ParticleShape.Diamond]: 5.0,
      [ParticleShape.Crescent]: 6.0,
      [ParticleShape.CrossGlow]: 7.0,
      [ParticleShape.Sakura]: 8.0,
      [ParticleShape.Sun]: 9.0,
      [ParticleShape.Octahedron]: 10.0,
      [ParticleShape.Fragment]: 11.0,
      [ParticleShape.Butterfly]: 12.0,
    };
    const shapeVal = shapeMap[settings.particleShape] || 0.0;
    
    // 计算光晕模式值
    const glowModeMap: Record<GlowMode, number> = {
      [GlowMode.None]: 0.0,
      [GlowMode.Soft]: 1.0,
      [GlowMode.Sharp]: 2.0,
      [GlowMode.Aura]: 3.0,
    };
    const glowModeVal = glowModeMap[settings.glowMode] || 1.0;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: settings.baseSize * 4.0 }, 
        uHandPos: { value: new THREE.Vector3() },
        uHandActive: { value: 0.0 },
        uInteractionRadius: { value: settings.interactionRadius },
        uInteractionStrength: { value: settings.interactionStrength },
        uReturnSpeed: { value: settings.returnSpeed },
        uExplosion: { value: 0.0 },
        uBlackHole: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) },
        uShape: { value: shapeVal },
        uSaturation: { value: settings.colorSaturation },
        uTurbulence: { value: settings.particleTurbulence },
        uTurbulenceSpeed: { value: settings.turbulenceSpeed },
        uTurbulenceScale: { value: settings.turbulenceScale },
        // 光晕效果
        uGlowMode: { value: glowModeVal },
        uGlowIntensity: { value: settings.glowIntensity },
        // 高级动态效果
        uBreathing: { value: settings.breathingEnabled ? settings.breathingIntensity : 0.0 },
        uBreathingSpeed: { value: settings.breathingSpeed },
        uRipple: { value: settings.rippleEnabled ? settings.rippleIntensity : 0.0 },
        uRippleSpeed: { value: settings.rippleSpeed },
        uAccretion: { value: settings.accretionEnabled ? settings.accretionIntensity : 0.0 },
        uAccretionSpeed: { value: settings.accretionSpeed },
        // 多层吸积盘配置
        uAccretionRadii: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.radiusMax || 100,
          settings.accretionLayers[1]?.radiusMax || 200,
          settings.accretionLayers[2]?.radiusMax || 400
        )},
        uAccretionDirs: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
          settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
          settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
        )},
        uAccretionSpeeds: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
          settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
          settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
        )},
        uAccretionLayerCount: { value: settings.accretionLayers.filter(l => l.enabled).length },
        // 荧光闪烁
        uFlickerEnabled: { value: settings.flickerEnabled ? 1.0 : 0.0 },
        uFlickerIntensity: { value: settings.flickerIntensity },
        uFlickerSpeed: { value: settings.flickerSpeed },
        // 真实海浪效果（Gerstner波）
        uWaveEnabled: { value: settings.waveEnabled ? 1.0 : 0.0 },
        uWaveIntensity: { value: settings.waveIntensity },
        uWaveSpeed: { value: settings.waveSpeed },
        uWaveSteepness: { value: settings.waveSteepness },
        uWaveLayers: { value: settings.waveLayers },
        uWaveDirection: { value: settings.waveDirection * Math.PI / 180 },  // 转换为弧度
        uWaveDepthFade: { value: settings.waveDepthFade },
        uWaveFoam: { value: settings.waveFoam ? 1.0 : 0.0 },
        // 几何映射
        uGeometryMapping: { value: settings.geometryMapping === 'none' ? 0.0 : settings.geometryMapping === 'sphere' ? 1.0 : 2.0 },
        uMappingStrength: { value: settings.mappingStrength },
        uMappingRadius: { value: settings.mappingRadius },
        uImageSize: { value: new THREE.Vector2(
          data.canvasWidth || 800, 
          data.canvasHeight || 600
        ) },
        uMappingTileX: { value: settings.mappingTileX },
        uMappingTileY: { value: settings.mappingTileY },
        // 闪电效果
        uWanderingLightning: { value: settings.wanderingLightningEnabled ? settings.wanderingLightningIntensity : 0.0 },
        uWanderingLightningSpeed: { value: settings.wanderingLightningSpeed },
        uWanderingLightningDensity: { value: settings.wanderingLightningDensity },
        uWanderingLightningWidth: { value: settings.wanderingLightningWidth },
        uLightningBreakdown: { value: settings.lightningBreakdownEnabled ? settings.lightningBreakdownIntensity : 0.0 },
        uLightningBreakdownFreq: { value: settings.lightningBreakdownFrequency },
        uLightningBranches: { value: settings.lightningBreakdownBranches },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    sceneRef.current.add(points);
    pointsRef.current = points;
    materialRef.current = material;

  }, [data]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSize.value = settings.baseSize * 4.0;
      materialRef.current.uniforms.uInteractionRadius.value = settings.interactionRadius;
      materialRef.current.uniforms.uInteractionStrength.value = settings.interactionStrength;
      materialRef.current.uniforms.uSaturation.value = settings.colorSaturation;
      materialRef.current.uniforms.uTurbulence.value = settings.particleTurbulence;
      materialRef.current.uniforms.uTurbulenceSpeed.value = settings.turbulenceSpeed;
      materialRef.current.uniforms.uTurbulenceScale.value = settings.turbulenceScale;
      
      // 更新形状
      const shapeMap: Record<ParticleShape, number> = {
        [ParticleShape.Circle]: 0.0,
        [ParticleShape.Square]: 1.0,
        [ParticleShape.Star]: 2.0,
        [ParticleShape.Snowflake]: 3.0,
        [ParticleShape.Heart]: 4.0,
        [ParticleShape.Diamond]: 5.0,
        [ParticleShape.Crescent]: 6.0,
        [ParticleShape.CrossGlow]: 7.0,
        [ParticleShape.Sakura]: 8.0,
        [ParticleShape.Sun]: 9.0,
        [ParticleShape.Octahedron]: 10.0,
        [ParticleShape.Fragment]: 11.0,
        [ParticleShape.Butterfly]: 12.0,
      };
      materialRef.current.uniforms.uShape.value = shapeMap[settings.particleShape] || 0.0;
      
      // 更新光晕
      const glowModeMap: Record<GlowMode, number> = {
        [GlowMode.None]: 0.0,
        [GlowMode.Soft]: 1.0,
        [GlowMode.Sharp]: 2.0,
        [GlowMode.Aura]: 3.0,
      };
      materialRef.current.uniforms.uGlowMode.value = glowModeMap[settings.glowMode] || 1.0;
      materialRef.current.uniforms.uGlowIntensity.value = settings.glowIntensity;
      
      // 更新高级动态效果
      materialRef.current.uniforms.uBreathing.value = settings.breathingEnabled ? settings.breathingIntensity : 0.0;
      materialRef.current.uniforms.uBreathingSpeed.value = settings.breathingSpeed;
      materialRef.current.uniforms.uRipple.value = settings.rippleEnabled ? settings.rippleIntensity : 0.0;
      materialRef.current.uniforms.uRippleSpeed.value = settings.rippleSpeed;
      materialRef.current.uniforms.uAccretion.value = settings.accretionEnabled ? settings.accretionIntensity : 0.0;
      materialRef.current.uniforms.uAccretionSpeed.value = settings.accretionSpeed;
      // 更新多层吸积盘配置
      materialRef.current.uniforms.uAccretionRadii.value.set(
        settings.accretionLayers[0]?.radiusMax || 100,
        settings.accretionLayers[1]?.radiusMax || 200,
        settings.accretionLayers[2]?.radiusMax || 400
      );
      materialRef.current.uniforms.uAccretionDirs.value.set(
        settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
        settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
        settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
      );
      materialRef.current.uniforms.uAccretionSpeeds.value.set(
        settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
        settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
        settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
      );
      materialRef.current.uniforms.uAccretionLayerCount.value = settings.accretionLayers.filter(l => l.enabled).length;
      
      // 更新闪烁效果
      materialRef.current.uniforms.uFlickerEnabled.value = settings.flickerEnabled ? 1.0 : 0.0;
      materialRef.current.uniforms.uFlickerIntensity.value = settings.flickerIntensity;
      materialRef.current.uniforms.uFlickerSpeed.value = settings.flickerSpeed;
      
      // 更新真实海浪效果
      materialRef.current.uniforms.uWaveEnabled.value = settings.waveEnabled ? 1.0 : 0.0;
      materialRef.current.uniforms.uWaveIntensity.value = settings.waveIntensity;
      materialRef.current.uniforms.uWaveSpeed.value = settings.waveSpeed;
      materialRef.current.uniforms.uWaveSteepness.value = settings.waveSteepness;
      materialRef.current.uniforms.uWaveLayers.value = settings.waveLayers;
      materialRef.current.uniforms.uWaveDirection.value = settings.waveDirection * Math.PI / 180;
      materialRef.current.uniforms.uWaveDepthFade.value = settings.waveDepthFade;
      materialRef.current.uniforms.uWaveFoam.value = settings.waveFoam ? 1.0 : 0.0;
      
      // 更新几何映射
      materialRef.current.uniforms.uGeometryMapping.value = settings.geometryMapping === 'none' ? 0.0 : settings.geometryMapping === 'sphere' ? 1.0 : 2.0;
      materialRef.current.uniforms.uMappingStrength.value = settings.mappingStrength;
      materialRef.current.uniforms.uMappingRadius.value = settings.mappingRadius;
      materialRef.current.uniforms.uMappingTileX.value = settings.mappingTileX;
      materialRef.current.uniforms.uMappingTileY.value = settings.mappingTileY;
      
      // 更新闪电效果
      materialRef.current.uniforms.uWanderingLightning.value = settings.wanderingLightningEnabled ? settings.wanderingLightningIntensity : 0.0;
      materialRef.current.uniforms.uWanderingLightningSpeed.value = settings.wanderingLightningSpeed;
      materialRef.current.uniforms.uWanderingLightningDensity.value = settings.wanderingLightningDensity;
      materialRef.current.uniforms.uWanderingLightningWidth.value = settings.wanderingLightningWidth;
      materialRef.current.uniforms.uLightningBreakdown.value = settings.lightningBreakdownEnabled ? settings.lightningBreakdownIntensity : 0.0;
      materialRef.current.uniforms.uLightningBreakdownFreq.value = settings.lightningBreakdownFrequency;
      materialRef.current.uniforms.uLightningBranches.value = settings.lightningBreakdownBranches;
      // 拖尾效果现在使用 AfterimagePass 后处理实现，在下方更新
    }
    
    // 同步连线材质的 uniform（与粒子着色器相同的命名）
    if (lineMaterialRef.current) {
      lineMaterialRef.current.uniforms.uInteractionRadius.value = settings.interactionRadius;
      lineMaterialRef.current.uniforms.uInteractionStrength.value = settings.interactionStrength;
      lineMaterialRef.current.uniforms.uTurbulence.value = settings.particleTurbulence;
      lineMaterialRef.current.uniforms.uTurbulenceSpeed.value = settings.turbulenceSpeed;
      lineMaterialRef.current.uniforms.uTurbulenceScale.value = settings.turbulenceScale;
      // 同步高级动态效果
      lineMaterialRef.current.uniforms.uBreathing.value = settings.breathingEnabled ? settings.breathingIntensity : 0.0;
      lineMaterialRef.current.uniforms.uBreathingSpeed.value = settings.breathingSpeed;
      lineMaterialRef.current.uniforms.uRipple.value = settings.rippleEnabled ? settings.rippleIntensity : 0.0;
      lineMaterialRef.current.uniforms.uRippleSpeed.value = settings.rippleSpeed;
      lineMaterialRef.current.uniforms.uAccretion.value = settings.accretionEnabled ? settings.accretionIntensity : 0.0;
      lineMaterialRef.current.uniforms.uAccretionSpeed.value = settings.accretionSpeed;
      // 同步多层吸积盘配置
      lineMaterialRef.current.uniforms.uAccretionRadii.value.set(
        settings.accretionLayers[0]?.radiusMax || 100,
        settings.accretionLayers[1]?.radiusMax || 200,
        settings.accretionLayers[2]?.radiusMax || 400
      );
      lineMaterialRef.current.uniforms.uAccretionDirs.value.set(
        settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
        settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
        settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
      );
      lineMaterialRef.current.uniforms.uAccretionSpeeds.value.set(
        settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
        settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
        settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
      );
      lineMaterialRef.current.uniforms.uAccretionLayerCount.value = settings.accretionLayers.filter(l => l.enabled).length;
    }

    if (bloomPassRef.current) {
        bloomPassRef.current.strength = settings.bloomStrength;
    }
    
    // 更新残影效果（拖尾）
    if (afterimagePassRef.current) {
        // trailEnabled 控制开关，trailLength 控制拖尾长度
        // damp 值：0 = 无残影，0.96 = 长拖尾
        if (settings.trailEnabled) {
            // trailLength 0-1 映射到 damp 0.8-0.96
            afterimagePassRef.current.uniforms['damp'].value = 0.8 + settings.trailLength * 0.16;
        } else {
            afterimagePassRef.current.uniforms['damp'].value = 0;
        }
    }

    if (controlsRef.current) {
      controlsRef.current.autoRotate = settings.autoRotate;
      controlsRef.current.autoRotateSpeed = settings.autoRotateSpeed;
    }
  }, [settings]);

  // 连线渲染
  useEffect(() => {
    if (!sceneRef.current || !data) return;
    
    // 移除旧的连线
    if (linesRef.current) {
      sceneRef.current.remove(linesRef.current);
      linesRef.current.geometry.dispose();
      linesRef.current = null;
    }
    
    if (!settings.lineSettings.enabled) return;
    
    // 计算连线数据
    const lineData = computeLines(data, settings.lineSettings);
    if (!lineData || lineData.count === 0) return;
    
    lineDataRef.current = lineData;
    
    // 创建连线 geometry
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineData.positions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineData.colors, 3));
    
    // 计算与粒子相同的 center 偏移量（基于原始 data.positions）
    // 这样可以确保连线和粒子使用完全相同的偏移
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < data.count; i++) {
      const x = data.positions[i * 3];
      const y = data.positions[i * 3 + 1];
      const z = data.positions[i * 3 + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    // 应用偏移到连线顶点
    const positions = lineGeometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      positions.setX(i, positions.getX(i) - centerX);
      positions.setY(i, positions.getY(i) - centerY);
      positions.setZ(i, positions.getZ(i) - centerZ);
    }
    positions.needsUpdate = true;
    
    // 为连线几何体添加颜色属性（用于着色器）
    lineGeometry.setAttribute('aColor', new THREE.BufferAttribute(lineData.colors, 3));
    
    // 添加线段位置属性（用于两端颜色渐变）
    // 每条线有2个顶点，第一个是0，第二个是1
    const linePositions = new Float32Array(lineData.count * 2);
    for (let i = 0; i < lineData.count; i++) {
      linePositions[i * 2] = 0.0;     // 起点
      linePositions[i * 2 + 1] = 1.0; // 终点
    }
    lineGeometry.setAttribute('aLinePosition', new THREE.BufferAttribute(linePositions, 1));
    
    // 解析颜色设置
    // 0=inherit, 1=gradient(fixed), 2=custom, 3=gradient(particle)
    let colorMode = 0.0;
    if (settings.lineSettings.lineColorMode === LineColorMode.Custom) {
      colorMode = 2.0;
    } else if (settings.lineSettings.lineColorMode === LineColorMode.Gradient) {
      // 根据 gradientMode 决定使用哪种渐变
      colorMode = settings.lineSettings.gradientMode === LineGradientMode.ParticleColor ? 3.0 : 1.0;
    }
    const lineColor = new THREE.Color(settings.lineSettings.customColor || '#ffffff');
    const gradientStart = new THREE.Color(settings.lineSettings.gradientColorStart || '#ff0080');
    const gradientEnd = new THREE.Color(settings.lineSettings.gradientColorEnd || '#00ffff');
    
    // 解析虚线设置
    const isDashed = settings.lineSettings.lineStyle === LineStyle.Dashed ? 1.0 : 0.0;
    
    // 创建连线着色器材质（与粒子使用相同的位置变换）
    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHandPos: { value: new THREE.Vector3() },
        uHandActive: { value: 0.0 },
        uInteractionRadius: { value: settings.interactionRadius },
        uInteractionStrength: { value: settings.interactionStrength },
        uExplosion: { value: 0.0 },
        uBlackHole: { value: 0.0 },
        uTurbulence: { value: settings.particleTurbulence },
        uTurbulenceSpeed: { value: settings.turbulenceSpeed },
        uTurbulenceScale: { value: settings.turbulenceScale },
        // 高级动态效果（与粒子着色器相同的命名）
        uBreathing: { value: settings.breathingEnabled ? settings.breathingIntensity : 0.0 },
        uBreathingSpeed: { value: settings.breathingSpeed },
        uRipple: { value: settings.rippleEnabled ? settings.rippleIntensity : 0.0 },
        uRippleSpeed: { value: settings.rippleSpeed },
        uAccretion: { value: settings.accretionEnabled ? settings.accretionIntensity : 0.0 },
        uAccretionSpeed: { value: settings.accretionSpeed },
        // 多层吸积盘配置
        uAccretionRadii: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.radiusMax || 100,
          settings.accretionLayers[1]?.radiusMax || 200,
          settings.accretionLayers[2]?.radiusMax || 400
        )},
        uAccretionDirs: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
          settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
          settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
        )},
        uAccretionSpeeds: { value: new THREE.Vector3(
          settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
          settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
          settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
        )},
        uAccretionLayerCount: { value: settings.accretionLayers.filter(l => l.enabled).length },
        // 颜色相关
        uLineColor: { value: lineColor },
        uUseCustomColor: { value: colorMode === 2.0 ? 1.0 : 0.0 },
        uOpacity: { value: settings.lineSettings.opacity },
        uColorMode: { value: colorMode },
        uGradientStart: { value: gradientStart },
        uGradientEnd: { value: gradientEnd },
        uGradientIntensity: { value: settings.lineSettings.gradientIntensity || 0.5 },
        // 虚线相关
        uDashed: { value: isDashed },
        uDashScale: { value: 0.1 }, // 虚线密度
      },
      vertexShader: lineVertexShader,
      fragmentShader: lineFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    lineMaterialRef.current = lineMaterial;
    
    // 创建连线对象
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    sceneRef.current.add(lines);
    linesRef.current = lines;
    
  }, [data, settings.lineSettings]);

  // 取色模式的点击事件监听
  useEffect(() => {
    if (!rendererRef.current) return;
    
    const canvas = rendererRef.current.domElement;
    
    if (colorPickMode) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
    
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.style.cursor = 'default';
    };
  }, [colorPickMode, onColorPick]);

  return <div ref={containerRef} className="w-full h-full relative" style={{ backgroundColor: 'var(--bg)' }} />;
};

export default NebulaScene;
