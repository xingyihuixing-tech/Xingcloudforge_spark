/**
 * input: App.tsx 传入的星球 settings + nebulaSettings + 手势/图像等数据；依赖 shaders 与三维后处理
 * output: 渲染 Planet 场景；互通模式（Interop）下接管星云实例渲染与相关 uniforms 同步
 * pos: 互通模式渲染的权威入口，负责“星球 + 星云叠加”整体画面与特效即时生效
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  PlanetSceneSettings,
  PlanetSettings,
  HandData,
  PlanetFillMode,
  GradientColor,
  TiltSettings,
  OrbitAxisSettings,
  RotationAxisSettings,
  PlanetCoreSettings,
  SolidCoreSettings,
  OrbitingFireflySettings,
  WanderingFireflyGroupSettings,
  EnergyBodySettings,
  PolyhedronType,
  SurfaceFlameSettings,
  FlameJetSettings,
  SpiralFlameSettings,
  AppSettings,
  NebulaInstance,
  ParticleShape,
  GlowMode,
  NebulaBlendMode,
  DrawSettings,
  DrawMode
} from '../types';
import OldNebulaScene from '../OldNebulaScene';
import { InkManager } from './InkManager';
import { ProcessedData } from '../services/imageProcessing';
import { createDefaultEnergyBody } from '../constants';
import { nebulaCanvasVertexShader, nebulaCanvasFragmentShader } from '../shaders/nebulaCanvasShaders';
import { createShapeTextureAtlas } from '../utils/shapeTextureAtlas';
import { getTiltAngles, getRotationAxis, getOrbitAxisVector, DEFAULT_TILT_SETTINGS } from '../constants';
import {
  Graph,
  LightPacket,
  PathSystemConfig,
  buildGraphFromEdgesGeometry,
  createLightPackets,
  updateLightPackets,
  getEdgeLightData,
  getDwellingVertices
} from '../services/lightFlowPath';

// ==================== 撣賊� ====================
const TRAIL_LENGTH = 50; // 憓𧼮�頧刻蕨�踹漲隞亥繮敺埈凒餈噼敞����?

// Bloom layer 摰帋�嚗�鍂鈭𡡞�㗇𥋘�?Bloom嚗?
const BLOOM_LAYER = 1;  // Layer 1 �其���閬�𡠺蝡?Bloom ��笆鞊?
const ENTIRE_SCENE = 0; // Layer 0 �舫�霈文�

// ==================== GLSL ���脣膥 ====================

const planetVertexShader = `
precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform vec3 uRotationAxis;
uniform float uBreathing;
uniform float uBreathingSpeed;
uniform float uFlicker;
uniform float uFlickerSpeed;

// 鈭支�
uniform float uHandActive;
// 頞�鰵�毺��穃��?
uniform float uExplosion;           // ���撘箏漲 (0-1)
uniform float uExplosionExpansion;  // �刻�頝萘氖
uniform float uExplosionTurbulence; // 皝齿�撘箏漲
uniform float uExplosionRotation;   // �贝蓮閫鍦漲
uniform float uExplosionSizeBoost;  // 蝎鍦��曉之
// 暺烐������㺭
uniform float uBlackHole;           // 暺烐�撘箏漲 (0-1)
uniform float uBlackHoleCompression;// Z頧游�蝻?
uniform float uBlackHoleSpinSpeed;  // �贝蓮�笔漲
uniform float uBlackHoleTargetRadius;// �嗥憬�𠰴�
uniform float uBlackHolePull;       // �詨�撘箏漲

attribute vec3 aColor;
attribute float aSize;
attribute float aId;

varying vec3 vColor;
varying float vAlpha;
varying float vId;

// 蝞��𣇉��芸ㄟ�賣㺭
float hash(float n) { return fract(sin(n) * 43758.5453123); }

// �贝蓮�拚猐
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

// Z頧湔�頧祈��拙遆�?
mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s,  c, 0.0,
        0.0, 0.0, 1.0
    );
}

// Simplex �芸ㄟ颲�𨭌�賣㺭
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
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
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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

void main() {
  vColor = aColor;
  vId = aId;
  vAlpha = 1.0;
  
  vec3 pos = position;
  float extraSize = 0.0;
  
  // �芾蓮
  if (abs(uRotationSpeed) > 0.001) {
    float angle = uTime * uRotationSpeed;
    mat3 rot = rotationMatrix(uRotationAxis, angle);
    pos = rot * pos;
  }
  
  // �澆𢙺���
  if (uBreathing > 0.0) {
    float breathe = 1.0 + uBreathing * sin(uTime * uBreathingSpeed);
    pos *= breathe;
  }
  
  // 頞�鰵�毺��烐��?
  if (uExplosion > 0.001) {
    float noiseVal = snoise(pos * 0.015 + uTime * 0.1);
    float maxExpansion = uExplosionExpansion * uExplosion;
    float speedVar = smoothstep(-0.5, 1.0, noiseVal);
    vec3 dir = normalize(pos);
    pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
    vec3 turb = vec3(
      snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
      snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
      snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
    );
    pos += turb * uExplosionTurbulence * uExplosion;
    pos = rotateZ(uExplosion * uExplosionRotation) * pos;
    extraSize += uExplosion * uExplosionSizeBoost;
  }

  // 暺烐����
  if (uBlackHole > 0.001) {
    pos.z *= mix(1.0, uBlackHoleCompression, uBlackHole);
    float r = length(pos.xy);
    float spin = (uBlackHoleSpinSpeed / (r + 10.0)) * uTime * uBlackHole;
    pos = rotateZ(spin) * pos;
    float targetR = uBlackHoleTargetRadius + r * 0.2;
    float pull = uBlackHole * uBlackHolePull;
    if (r > 1.0) {
      float newR = mix(r, targetR, pull);
      pos.xy = normalize(pos.xy) * newR;
    }
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // 蝎鍦�憭批�霈∠�
  float baseSize = aSize + extraSize;
  gl_PointSize = baseSize * (300.0 / -mvPosition.z);
  
  // �芰����
  if (uFlicker > 0.0) {
    float flicker = 0.8 + 0.2 * sin(uTime * uFlickerSpeed + aId * 10.0);
    gl_PointSize *= mix(1.0, flicker, uFlicker);
  }
}
`;

const planetFragmentShader = `
precision highp float;

uniform float uGlowIntensity;
uniform float uSaturation;
uniform float uTime;
uniform float uTrailAlpha; // �硋偏撅��𤩺�摨衣頂�?

// �芰㩞�����㺭
uniform float uWanderingLightning;
uniform float uWanderingLightningSpeed;
uniform float uWanderingLightningDensity;
uniform float uLightningBreakdown;
uniform float uLightningBreakdownFreq;
uniform float uLightningBranches;

varying vec3 vColor;
varying float vAlpha;
varying float vId;

// 蝞��訫�撣�遆�?
float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  
  if (dist > 0.5) discard;
  
  // �𥪜��㗇�
  float alpha = smoothstep(0.5, 0.0, dist);
  alpha = pow(alpha, 1.0 / uGlowIntensity);
  
  // 擖勗�摨西��?
  vec3 color = vColor;
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, uSaturation);
  
  // 皜貉粥�芰㩞���
  if (uWanderingLightning > 0.01) {
    float t = uTime * uWanderingLightningSpeed;
    float particlePhase = vId * 0.1 + t;
    
    // �芰㩞�匧�
    float pulse = sin(particlePhase * uWanderingLightningDensity) * 0.5 + 0.5;
    pulse = pow(pulse, 4.0); // �游��鞟��匧�
    
    if (pulse > 0.7) {
      float intensity = (pulse - 0.7) / 0.3 * uWanderingLightning;
      vec3 electricColor = vec3(0.5, 0.8, 1.0); // �菔��?
      color = mix(color, electricColor, intensity);
      alpha = max(alpha, intensity);
    }
  }
  
  // �芰㩞�餌忽���
  if (uLightningBreakdown > 0.01) {
    float breakdownCycle = uTime * uLightningBreakdownFreq;
    float cyclePhase = fract(breakdownCycle);
    
    if (cyclePhase < 0.3) {
      float breakdownIntensity = 1.0 - cyclePhase / 0.3;
      breakdownIntensity = pow(breakdownIntensity, 2.0);
      
      // �𤩺㦤�㗇𥋘鋡怠稬銝剔�蝎鍦�
      float strikeChance = hash(floor(breakdownCycle) * 100.0 + vId);
      if (strikeChance < 0.02 * (1.0 + uLightningBranches)) {
        float intensity = breakdownIntensity * uLightningBreakdown;
        color = mix(color, vec3(1.0, 1.0, 1.0), intensity);
        alpha = max(alpha, intensity);
      }
    }
  }
  
  gl_FragColor = vec4(color, alpha * vAlpha * uTrailAlpha);
}
`;

// ==================== 摰硺��詨����脣膥 ====================

const solidCoreVertexShader = `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  // �砍𧑐�鞉� - �其�皜𣂼�霈∠�
  vLocalPosition = position;
  
  // 銝𣇉��鞉� - �其��芸ㄟ��甅
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  
  // 閫�㦛蝛粹𡢿�鞉� - �其��脫�撠磰恣蝞?
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz; // 閫�㦛蝛粹𡢿銝哨�隞舘”�Ｘ��𤑳㮾�箇��煾�
  
  // 瘜閧瑪�刻��曄征�?- 銝?vViewPosition �鞉�蝟餌�銝�
  vNormal = normalize(normalMatrix * normal);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const solidCoreFragmentShader = `
precision highp float;

uniform float uTime;
uniform float uRadius;
uniform float uScale;
uniform float uSpeed;
uniform float uContrast;
uniform float uBandMix;
uniform float uRidgeMix;
uniform float uGridMix;
// �𥪜痔鋆��蝟餌�
uniform float uCrackEnabled;
uniform float uCrackScale;
uniform float uCrackThreshold;
uniform float uCrackFeather;
uniform float uCrackWarp;
uniform float uCrackWarpScale;
uniform float uCrackFlowSpeed;
uniform vec3 uCrackColor1;
uniform vec3 uCrackColor2;
uniform float uCrackEmission;
uniform float uEmissiveStrength;
// 憭𡁻��惩�
uniform float uMultiFreqEnabled;
uniform float uWarpIntensity;
uniform float uWarpScale;
uniform float uDetailBalance;
// 瘜閧瑪�啣𢆡 + 擃睃�
uniform float uBumpEnabled;
uniform float uBumpStrength;
uniform float uSpecularStrength;
uniform vec3 uSpecularColor;
uniform float uRoughness;
// 摰𡁜��匧��?
uniform float uLightEnabled;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uLightAmbient;
// �剔�颲㗇�
uniform float uHotspotEnabled;
uniform float uHotspotCount;
uniform float uHotspotSize;
uniform float uHotspotPulseSpeed;
uniform vec3 uHotspotColor;
uniform float uHotspotEmission;
uniform float uOpacity;
uniform float uBrightness;

// 銵券𢒰憸𡏭𠧧蝟餌�嚗�𣈲����矋�
uniform float uSurfaceColorMode;    // 0=�閗𠧧, 1=�諹𠧧, 2=銝㕑𠧧, 3=瘛瑁𠧧
uniform vec3 uSurfaceBaseColor;     // �箇�憸𡏭𠧧
uniform vec3 uSurfaceColor1;        // 皜𣂼��?
uniform vec3 uSurfaceColor2;        // 皜𣂼��?
uniform vec3 uSurfaceColor3;        // 皜𣂼��?嚗���脫芋撘𧶏�
uniform float uSurfaceColorMidPos;  // 銝剝𡢿�脖�蝵?
uniform float uSurfaceColorMidWidth;// 銝剝𡢿�脣捐摨佗��圈�餉�嚗?
uniform float uSurfaceColorMidWidth2;// 銝剝𡢿�脣捐摨?嚗�唂�餉�嚗𡁶滲�脣蒂嚗?
uniform float uSurfaceGradientDir;  // 皜𣂼��孵�
uniform vec3 uSurfaceCustomDir;     // �芸�銋㗇䲮�?
uniform float uSurfaceSpiralDensity;// �箸�撖�漲
uniform float uSurfaceProceduralInt;// 瘛瑁𠧧撘箏漲

// �㗇�憸𡏭𠧧蝟餌�嚗�𣈲����矋�
uniform float uGlowColorMode;
uniform vec3 uGlowBaseColor;
uniform vec3 uGlowColor1;
uniform vec3 uGlowColor2;
uniform vec3 uGlowColor3;
uniform float uGlowColorMidPos;
uniform float uGlowColorMidWidth;   // �㗇�銝剝𡢿�脣捐摨佗��圈�餉�嚗?
uniform float uGlowColorMidWidth2;  // �㗇�蝥航𠧧撣血捐摨佗��折�餉�嚗?
uniform float uGlowGradientDir;
uniform vec3 uGlowCustomDir;
uniform float uGlowSpiralDensity;
uniform float uGlowProceduralInt;

// �㗇���㺭
uniform float uGlowLength;
uniform float uGlowStrength;
uniform float uGlowBloomBoost;

varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vNormal;
varying vec3 vViewPosition;

// RGB 頧?HSL
vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) / 2.0;
  float h = 0.0;
  float s = 0.0;
  if (maxC != minC) {
    float d = maxC - minC;
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == c.r) {
      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  vec3 rgb;
  if (s == 0.0) {
    rgb = vec3(l);
  } else {
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    rgb.r = hue2rgb(p, q, h + 1.0/3.0);
    rgb.g = hue2rgb(p, q, h);
    rgb.b = hue2rgb(p, q, h - 1.0/3.0);
  }
  return rgb;
}

// Simplex Noise 3D - �詨��芸ㄟ�賣㺭
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  
  vec3 i  = floor(v + dot(v, C.yyy));
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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// �羓瑪�芸ㄟ (Ridged Noise) - �其�鈭抒�蝏��諹�韐舐�鋆��蝵𤑳�
// �朞��𣇉�撖孵�澆僎�滩蓮嚗���芸ㄟ��妟鈭文�蝥輯蓮銝箸�鈭桃��羓瑪
float ridgedNoise(vec3 p) {
  // �𣇉�撖孵�潔漣�蠘�蝥選�1.0 - abs 雿輸妟鈭文�憭��鈭?
  return 1.0 - abs(snoise(p));
}

// 憭𡁜��羓瑪 FBM (Fractal Brownian Motion)
// �惩�憭帋葵撠箏漲���蝥踹臁憯堆�鈭抒��芰�����嗵�蝏?
float ridgedFBM(vec3 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  // 3撅���𩤃�雿𡡞�憭扯��?+ 銝剝���𣈲 + 擃㗛�蝏��
  for (int i = 0; i < 3; i++) {
    // 瘥誩��惩�頧餃凝�園𡢿�讐宏嚗䔶漣����冽�
    vec3 samplePos = p * frequency + vec3(0.0, time * 0.1 * float(i + 1), 0.0);
    float ridge = ridgedNoise(samplePos);
    // �羓瑪�潛�撟單䲮�臭誑霈抵��蹱凒蝏?
    value += ridge * ridge * amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// ��酞�脣遆�?- �典臁憯啣�蝘駁��瑕�����梶聦閫���?
vec3 domainWarp(vec3 p, float warpScale, float warpIntensity) {
  vec3 offset = vec3(
    snoise(p * warpScale),
    snoise(p * warpScale + vec3(100.0, 0.0, 0.0)),
    snoise(p * warpScale + vec3(0.0, 100.0, 0.0))
  ) * warpIntensity;
  return p + offset;
}

// 憭𡁻� FBM �芸ㄟ - 憭折�敶Ｘ�?+ 銝剝�蝏𤘪� + 擃㗛�蝏��
float multiFreqNoise(vec3 p, float detailBalance) {
  float low = snoise(p * 0.5);           // 憭折�/�踹�
  float mid = snoise(p * 2.0);           // 銝剝�蝏𤘪�
  float hi = snoise(p * 6.0);            // 擃㗛�蝏��
  // ������嚗帋�憸穃�銝餃紡嚗屸�憸𤑳���眏 detailBalance �批�
  float lowWeight = 0.5;
  float midWeight = 0.35;
  float hiWeight = 0.15 * detailBalance;
  return (low * lowWeight + mid * midWeight + hi * hiWeight) / (lowWeight + midWeight + hiWeight);
}

// 隞𤾸臁憯啗恣蝞埈�蝥踵贋�剁�隡芸篅�豢�撠��
vec3 computeBumpNormal(vec3 p, vec3 normal, float strength) {
  float eps = 0.02;
  float h0 = snoise(p);
  float hx = snoise(p + vec3(eps, 0.0, 0.0));
  float hy = snoise(p + vec3(0.0, eps, 0.0));
  float hz = snoise(p + vec3(0.0, 0.0, eps));
  
  // 霈∠�璇臬漲
  vec3 gradient = vec3(hx - h0, hy - h0, hz - h0) / eps;
  
  // �啣𢆡瘜閧瑪
  vec3 bumpedNormal = normalize(normal - gradient * strength);
  return bumpedNormal;
}

// �剔�颲㗇� - �箔��芸ㄟ����粹�鈭桃�
float computeHotspots(vec3 p, float count, float size, float time, float pulseSpeed) {
  float hotspot = 0.0;
  
  // 撠���亦�敶雴��硋���𢒰銝?
  vec3 pNorm = normalize(p);
  
  // 雿輻鍂銝滚��讐宏���憭帋葵�剔�
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= count) break;
    
    // 瘥譍葵�剔��匧𤐄摰𡁶�蝘滚�雿滨蔭嚗�＆靽嘥銁��𢒰銝𠺪�
    float phi = (i + 0.5) * 2.39996; // 暺��閫鍦�撣?
    float theta = acos(1.0 - 2.0 * (i + 0.5) / max(count, 1.0));
    vec3 hotspotCenter = vec3(
      sin(theta) * cos(phi),
      cos(theta),
      sin(theta) * sin(phi)
    );
    
    // 雿輻鍂��𢒰頝萘氖嚗��蝘荔�霈∠��訾撮摨?
    float similarity = dot(pNorm, hotspotCenter);
    
    // �匧��函𤫇
    float pulse = 0.6 + 0.4 * sin(time * pulseSpeed + i * 2.0);
    
    // 頧航器�剔�嚗窃ize �批��剔�憭批�嚗?.1~0.5 撖孵� cos ���潘�
    float threshold = 1.0 - size * 2.0; // size=0.15 -> threshold=0.7
    float spot = smoothstep(threshold, threshold + 0.2, similarity) * pulse;
    hotspot = max(hotspot, spot);
  }
  
  return hotspot;
}

void main() {
  // ����𤥁�蝥蹂�瘜閧瑪 (蝏煺��刻��曄征�?
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);
  
  // === 敶雴��㚚��瑕��?===
  // 撠��������銝��硋� [-1, 1]嚗䔶蝙蝥寧�銝𡒊�雿枏之撠讛圾�?
  vec3 normalizedPos = vWorldPosition / uRadius;
  
  // --- 1. [蝥寧�撖�漲] & [瘚�𢆡�笔漲] ---
  // uScale �湔𦻖�批�蝥寧�撖�漲嚗��銝��硋�銝滚���閬?0.05 蝟餅㺭嚗?
  float realScale = uScale;
  
  // �園𡢿銋䀝誑�笔漲�惩銁 Y 頧湛�鈭抒�瘚�𢆡�?(蝐颱撮�芾蓮�𣇉�撖寞�)
  vec3 noisePos = normalizedPos * realScale + vec3(0.0, uTime * uSpeed, 0.0);
  
  // --- 1.5 [憭𡁻��惩�] (Multi-Frequency FBM) ---
  // 摨𠉛鍂�典���酞�莎�憒���舐鍂嚗?
  if (uMultiFreqEnabled > 0.5) {
    noisePos = domainWarp(noisePos, uWarpScale, uWarpIntensity);
  }
  
  // �箇��芸ㄟ嚗�虾�匧�憸穃��𩤃�
  float n;
  if (uMultiFreqEnabled > 0.5) {
    n = multiFreqNoise(noisePos, uDetailBalance);
  } else {
    n = snoise(noisePos); // �箇��芸ㄟ�潘���凒 [-1, 1]
  }
  
  // --- 2. [瘞娍��僕�財 (Gas Distortion) ---
  // �拍鍂甇�憐瘜Ｗ抅鈭?Y 頧湧�摨虫漣��辺蝥對�瘛瑕��芸ㄟ n 鈭抒�皝齿�
  float bands = sin(normalizedPos.y * realScale * 2.0 + n * 2.0);
  // uBandMix �批��∠犒撘箏漲: 0=蝥臬臁憯? 1=蝥舀辺蝥?
  float noiseVal = mix(n, bands, uBandMix);
  
  // --- 3. [�嗡��𣂼�] (Crystal Ridging) ---
  // 撟單�璅∪�: 撠?[-1,1] �惩��?[0,1]
  float smoothVal = noiseVal * 0.5 + 0.5;
  // �𣂼�璅∪�: �𣇉�撖孵�?abs([-1,1]) -> [0,1] (撠�郭撜唳��䭾�撠㚚�撅梯�)
  float ridgeVal = abs(noiseVal);
  // uRidgeMix �批��𣂼漲: 0=鈭煾㦛, 1=�唳榊
  float pattern = mix(smoothVal, ridgeVal, uRidgeMix);
  
  // --- 4. [蝵烐聢瘛瑕�] (Grid Overlay) ---
  if (uGridMix > 0.01) {
    float density = realScale * 0.5;
    // 雿輻鍂 step 鈭抒��芣� 10% 摰賢漲��′颲寧�蝥?(0.9 ���?
    float gx = step(0.9, fract(normalizedPos.x * density));
    float gy = step(0.9, fract(normalizedPos.y * density));
    // �𡝗�憭批�澆��删�蝥祉瑪
    float grid = max(gx, gy);
    pattern = mix(pattern, grid, uGridMix);
  }
  
  // --- 4.5 [�𥪜痔鋆��蝟餌�] (Ridged Noise + Domain Warp) ---
  // �祉�霈∠�鋆���桃蔗�屸��莎��𡒊賒�惩�
  float crackMask = 0.0;
  vec3 crackColor = vec3(0.0);
  
  if (uCrackEnabled > 0.5) {
    // 摨𠉛鍂��酞�脫��渲��蹱�
    vec3 warpedPos = domainWarp(normalizedPos, uCrackWarpScale, uCrackWarp);
    
    // �惩��園𡢿瘚�𢆡
    float flowTime = uTime * uCrackFlowSpeed;
    vec3 crackPos = warpedPos * uCrackScale;
    
    // 霈∠��羓瑪 FBM �芸ㄟ
    float ridgeValue = ridgedFBM(crackPos, flowTime);
    
    // ���?+ 蝢賢�嚗𡁜�餈䂿賒�潸蓮銝箇�蝥輸�蝵?
    // ridgeValue 擃条��唳䲮�航��辷��羓瑪嚗?
    float lowEdge = uCrackThreshold - uCrackFeather;
    float highEdge = uCrackThreshold + uCrackFeather;
    crackMask = smoothstep(lowEdge, highEdge, ridgeValue);
    
    // 鋆������䁅𠧧嚗𡁏覔�?ridgeValue 撘箏漲隞?color1 餈�腹�?color2
    float colorT = clamp((ridgeValue - lowEdge) / (highEdge - lowEdge + 0.001), 0.0, 1.0);
    crackColor = mix(uCrackColor2, uCrackColor1, colorT);
  }
  
  // --- 5. [�賡�撖寞�] (Energy Contrast) ---
  // �喲睸甇仿炊嚗𡁻�朞�撟��蝞埈�撘��擧�撌株�嚗���?撗拇�"���撗拐�鈭格�
  // 敹�◆ clamp �?0-1 �脫迫韐�㺭撟��蝞烾�霂?
  pattern = pow(clamp(pattern, 0.0, 1.0), uContrast);
  
  // --- 6. 霈∠�皜𣂼���㺭 t ---
  // 敶雴��𡝗𧋦�啣���鍂鈭擧��䁅恣蝞?
  vec3 normLocal = vLocalPosition / uRadius;
  float radialT = length(normLocal); // 敺�� 0-1
  
  // 霈∠���𢒰閫鍦漲�其��箸�
  float theta = atan(normLocal.z, normLocal.x); // -PI to PI
  float phi = acos(clamp(normLocal.y, -1.0, 1.0)); // 0 to PI
  float angularT = (theta + 3.14159) / (2.0 * 3.14159); // 0-1
  
  // �寞旿皜𣂼��孵�霈∠� t
  float surfaceGradientT = radialT;
  if (uSurfaceGradientDir < 0.5) { // radial
    surfaceGradientT = radialT;
  } else if (uSurfaceGradientDir < 1.5) { // linearX
    surfaceGradientT = (normLocal.x + 1.0) * 0.5;
  } else if (uSurfaceGradientDir < 2.5) { // linearY
    surfaceGradientT = (normLocal.y + 1.0) * 0.5;
  } else if (uSurfaceGradientDir < 3.5) { // linearZ
    surfaceGradientT = (normLocal.z + 1.0) * 0.5;
  } else if (uSurfaceGradientDir < 4.5) { // custom
    vec3 normDir = normalize(uSurfaceCustomDir);
    surfaceGradientT = (dot(normLocal, normDir) + 1.0) * 0.5;
  } else { // spiral
    surfaceGradientT = fract(angularT * uSurfaceSpiralDensity + radialT * 2.0);
  }
  surfaceGradientT = clamp(surfaceGradientT, 0.0, 1.0);
  
  // --- 7. 霈∠�銵券𢒰憸𡏭𠧧 ---
  vec3 baseGradientColor = uSurfaceBaseColor;
  if (uSurfaceColorMode > 0.5 && uSurfaceColorMode < 1.5) { // �諹𠧧皜𣂼�
    baseGradientColor = mix(uSurfaceColor1, uSurfaceColor2, surfaceGradientT);
  } else if (uSurfaceColorMode > 1.5 && uSurfaceColorMode < 2.5) { // 銝㕑𠧧皜𣂼�
    float blendWeight = min(uSurfaceColorMidWidth, 1.0);
    float rangeExpand = max(uSurfaceColorMidWidth - 1.0, 0.0) * 0.2;
    float bandHalf = uSurfaceColorMidWidth2 * 0.5;
    float midStart = max(0.01, uSurfaceColorMidPos - rangeExpand - bandHalf);
    float midEnd = min(0.99, uSurfaceColorMidPos + rangeExpand + bandHalf);
    
    vec3 threeColorResult;
    if (surfaceGradientT < midStart) {
      threeColorResult = mix(uSurfaceColor1, uSurfaceColor2, surfaceGradientT / midStart);
    } else if (surfaceGradientT > midEnd) {
      threeColorResult = mix(uSurfaceColor2, uSurfaceColor3, (surfaceGradientT - midEnd) / (1.0 - midEnd));
    } else {
      threeColorResult = uSurfaceColor2;
    }
    vec3 twoColorResult = mix(uSurfaceColor1, uSurfaceColor3, surfaceGradientT);
    baseGradientColor = mix(twoColorResult, threeColorResult, blendWeight);
  } else if (uSurfaceColorMode > 2.5) { // 瘛瑁𠧧嚗��摨誩��脩㮾�讐宏嚗?
    // 雿輻鍂��迤�?HSL �脩㮾�贝蓮嚗���惩臁憯啣��硋�撘箸��?
    vec3 hsl = rgb2hsl(uSurfaceBaseColor);
    
    // �箇�皜𣂼� + �芸ㄟ�啣𢆡
    float noiseVal = snoise(normLocal * 3.0 + uTime * 0.1) * 0.5 + 0.5;
    float combinedT = surfaceGradientT * 0.7 + noiseVal * 0.3;
    
    // 撘箏漲1.0�嗅��湔�頧砌���𠧧�?360簞)
    float hueShift = combinedT * uSurfaceProceduralInt;
    hsl.x = fract(hsl.x + hueShift);
    
    // 頧餃凝靚�㟲擖勗�摨血�鈭桀漲嚗���惩��𡝗�
    hsl.y = clamp(hsl.y * (0.9 + noiseVal * 0.2), 0.0, 1.0);
    hsl.z = clamp(hsl.z * (0.95 + noiseVal * 0.1), 0.0, 1.0);
    
    baseGradientColor = hsl2rgb(hsl);
  }
  
  // 霈∠��𡑒𠧧��𧋦�其�蝥寧�瘛瑕�
  vec3 darkColor = baseGradientColor * 0.2;
  vec3 surfaceColor = mix(darkColor, baseGradientColor, pattern);
  
  // --- 7.5 [蝥寧��芸��处 (Emissive Pattern) ---
  // 霈拚�鈭桀躹�笔��箄�餈?1.0 ���嚗諹圻�?Bloom
  if (uEmissiveStrength > 0.01) {
    // pattern �潮���躹���鈭桅�嚗匧��㰘䌊�穃�
    float emissiveMask = pow(pattern, 0.5); // 蝔滚凝�拙之鈭桅���凒
    surfaceColor += baseGradientColor * emissiveMask * uEmissiveStrength;
  }
  
  // --- 7.55 [鋆���惩�] (Crack Overlay) ---
  // 鋆���祉�鈭𤾸抅蝖�蝥寧�嚗䔶誑�䭾��惩�
  if (uCrackEnabled > 0.5 && crackMask > 0.01) {
    // 鋆��憸𡏭𠧧�惩��啗”�?
    vec3 crackContribution = crackColor * crackMask;
    surfaceColor = mix(surfaceColor, crackColor, crackMask * 0.8);
    // 鋆���祉��穃�嚗�圻�?Bloom嚗?
    surfaceColor += crackContribution * uCrackEmission;
  }
  
  // --- 7.6 [摰𡁜��厩�] (Directional Light) ---
  // ����厩�霈∠��������蝥選��航�鋡急贋�剁�
  vec3 shadingNormal = normal;
  
  // 瘜閧瑪�啣𢆡
  if (uBumpEnabled > 0.5) {
    shadingNormal = computeBumpNormal(noisePos, normal, uBumpStrength);
  }
  
  if (uLightEnabled > 0.5) {
    vec3 lightDir = normalize(uLightDirection);
    // 霈∠�瞍怠�撠��Lambert嚗劐蝙�冽贋�冽�蝥?
    float diffuse = max(dot(shadingNormal, -lightDir), 0.0);
    // 瘛瑕��臬��匧�瞍怠�撠?
    float lightFactor = uLightAmbient + diffuse * (1.0 - uLightAmbient);
    // 摨𠉛鍂�厩�憸𡏭𠧧��撩摨?
    vec3 litColor = surfaceColor * lightFactor;
    // �惩��㗇�憸𡏭𠧧��蔣�?
    litColor += uLightColor * diffuse * uLightIntensity * 0.3;
    surfaceColor = litColor;
    
    // --- 7.65 [擃睃�霈∠�] (Specular Highlight) ---
    if (uBumpEnabled > 0.5 && uSpecularStrength > 0.01) {
      // Blinn-Phong 擃睃�
      vec3 halfVec = normalize(-lightDir + viewDir);
      float specAngle = max(dot(shadingNormal, halfVec), 0.0);
      float spec = pow(specAngle, uRoughness);
      surfaceColor += uSpecularColor * spec * uSpecularStrength * diffuse;
    }
  }
  
  // --- 7.7 [�剔�颲㗇�] (Hotspots) ---
  if (uHotspotEnabled > 0.5) {
    float hotspot = computeHotspots(normalizedPos, uHotspotCount, uHotspotSize, uTime, uHotspotPulseSpeed);
    // �剔��惩��穃�
    surfaceColor += uHotspotColor * hotspot * uHotspotEmission;
  }
  
  // --- 8. [颲寧��穃�] (Fresnel Glow) ---
  float fresnel = 1.0 - clamp(dot(viewDir, normal), 0.0, 1.0);
  float glowExponent = 10.0 / max(uGlowLength, 0.1);
  float glowFactor = pow(fresnel, glowExponent);
  
  // 霈∠��㗇�皜𣂼���㺭
  float glowGradientT = radialT;
  if (uGlowGradientDir < 0.5) { glowGradientT = radialT; }
  else if (uGlowGradientDir < 1.5) { glowGradientT = (normLocal.x + 1.0) * 0.5; }
  else if (uGlowGradientDir < 2.5) { glowGradientT = (normLocal.y + 1.0) * 0.5; }
  else if (uGlowGradientDir < 3.5) { glowGradientT = (normLocal.z + 1.0) * 0.5; }
  else if (uGlowGradientDir < 4.5) { glowGradientT = (dot(normLocal, normalize(uGlowCustomDir)) + 1.0) * 0.5; }
  else { glowGradientT = fract(angularT * uGlowSpiralDensity + radialT * 2.0); }
  glowGradientT = clamp(glowGradientT, 0.0, 1.0);
  
  // 霈∠��㗇�憸𡏭𠧧
  vec3 glowColor = uGlowBaseColor;
  if (uGlowColorMode > 0.5 && uGlowColorMode < 1.5) {
    glowColor = mix(uGlowColor1, uGlowColor2, glowGradientT);
  } else if (uGlowColorMode > 1.5 && uGlowColorMode < 2.5) { // 銝㕑𠧧皜𣂼�
    float blendWeight = min(uGlowColorMidWidth, 1.0);
    float rangeExpand = max(uGlowColorMidWidth - 1.0, 0.0) * 0.2;
    float bandHalf = uGlowColorMidWidth2 * 0.5;
    float midStart = max(0.01, uGlowColorMidPos - rangeExpand - bandHalf);
    float midEnd = min(0.99, uGlowColorMidPos + rangeExpand + bandHalf);
    
    vec3 threeColorGlow;
    if (glowGradientT < midStart) {
      threeColorGlow = mix(uGlowColor1, uGlowColor2, glowGradientT / midStart);
    } else if (glowGradientT > midEnd) {
      threeColorGlow = mix(uGlowColor2, uGlowColor3, (glowGradientT - midEnd) / (1.0 - midEnd));
    } else {
      threeColorGlow = uGlowColor2;
    }
    vec3 twoColorGlow = mix(uGlowColor1, uGlowColor3, glowGradientT);
    glowColor = mix(twoColorGlow, threeColorGlow, blendWeight);
  } else if (uGlowColorMode > 2.5) {
    float hueShift = glowGradientT * uGlowProceduralInt * 0.3;
    glowColor = uGlowBaseColor;
    glowColor.r = mix(glowColor.r, glowColor.g, hueShift);
    glowColor.g = mix(glowColor.g, glowColor.b, hueShift);
  }
  
  // �惩��㗇�
  surfaceColor += glowColor * glowFactor * uGlowStrength;
  
  // --- 9. [Bloom 憓𧼮撩] ---
  if (uGlowBloomBoost > 0.01) {
    float bloomPeak = glowFactor * glowFactor * 2.0;
    surfaceColor += glowColor * bloomPeak * uGlowStrength * uGlowBloomBoost;
  }
  
  // --- 10. [鈭桀漲靚�㟲] ---
  surfaceColor *= uBrightness;
  
  gl_FragColor = vec4(surfaceColor, uOpacity);
}
`;

// ==================== 銵券𢒰�怎����脣膥 ====================

const surfaceFlameVertexShader = `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocalPosition;
varying vec2 vUv;

void main() {
  vLocalPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const surfaceFlameFragmentShader = `
precision highp float;

uniform float uTime;
uniform float uRadius;
uniform float uThickness;

// �怠𣪧��㺭
uniform float uFlameScale;
uniform float uDensity;

// 韐冽���㺭
uniform float uFlowSpeed;
uniform float uTurbulence;
uniform float uNoiseType; // 0=simplex, 1=voronoi
uniform float uFractalLayers;

// 閫����㺭
uniform float uOpacity;
uniform float uEmissive;
uniform float uBloomBoost;

// �函𤫇��㺭
uniform float uDirection; // 0=up, 1=outward, 2=spiral
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;

// 憸𡏭𠧧蝟餌�
uniform float uColorMode;
uniform vec3 uBaseColor;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uColorMidPos;
uniform float uColorMidWidth;
uniform float uGradientDir;
uniform vec3 uCustomDir;
uniform float uSpiralDensity;
uniform float uProceduralIntensity;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocalPosition;
varying vec2 vUv;

// Simplex 3D �芸ㄟ
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
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
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

// Voronoi �芸ㄟ
float voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float minDist = 1.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 point = vec3(
          fract(sin(dot(i + neighbor, vec3(127.1, 311.7, 74.7))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(269.5, 183.3, 246.1))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(419.2, 371.9, 168.2))) * 43758.5453)
        );
        vec3 diff = neighbor + point - f;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
  }
  return minDist;
}

// FBM ��耦�芸ㄟ
float fbm(vec3 p, int layers) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float totalAmplitude = 0.0;
  
  for (int i = 0; i < 5; i++) {
    if (i >= layers) break;
    
    float n;
    if (uNoiseType < 0.5) {
      n = snoise(p * frequency);
    } else {
      n = 1.0 - voronoi(p * frequency) * 2.0;
    }
    
    value += n * amplitude;
    totalAmplitude += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value / totalAmplitude;
}

void main() {
  vec3 normalizedPos = normalize(vLocalPosition);
  
  // 霈∠��怎���甅�鞉� - �𡁜漲敶勗���甅撠箏漲嚗���惩�甈⊥�
  float thicknessScale = 1.0 + uThickness * 3.0;
  vec3 flamePos = normalizedPos * uFlameScale * thicknessScale;
  
  // �寞旿�孵�瘛餃��函𤫇�讐宏
  float flowTime = uTime * uFlowSpeed;
  if (uDirection < 0.5) {
    // �睲��磰�
    flamePos.y -= flowTime;
  } else {
    // �箸�銝𠰴�
    float angle = flowTime * 2.0;
    float c = cos(angle);
    float s = sin(angle);
    flamePos.xz = mat2(c, -s, s, c) * flamePos.xz;
    flamePos.y -= flowTime * 0.5;
  }
  
  // 瘛餃�皝齿��啣𢆡
  vec3 turbulenceOffset = vec3(
    snoise(flamePos * 2.0 + uTime * 0.3),
    snoise(flamePos * 2.0 + 100.0 + uTime * 0.3),
    snoise(flamePos * 2.0 + 200.0 + uTime * 0.3)
  ) * uTurbulence * 0.5;
  flamePos += turbulenceOffset;
  
  // 霈∠���耦�怎��芸ㄟ
  int layers = int(uFractalLayers);
  float flameNoise = fbm(flamePos, layers);
  
  // 頧祆揢銝箇��啣耦�?[0, 1]
  float flameMask = (flameNoise + 1.0) * 0.5;
  
  // 摨𠉛鍂撖�漲�批�
  flameMask = smoothstep(1.0 - uDensity, 1.0, flameMask);
  
  // �寞旿瘜閧瑪�孵�憓𧼮撩�睲�����?
  if (uDirection < 0.5) {
    float upFactor = dot(normalizedPos, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    flameMask *= 0.5 + upFactor * 0.5;
  }
  
  // �匧𢆡���
  float pulse = 1.0;
  if (uPulseEnabled > 0.5) {
    pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159) * uPulseIntensity;
  }
  flameMask *= pulse;
  
  // 霈∠�憸𡏭𠧧皜𣂼���㺭 - 雿輻鍂�怎��芸ㄟ�潔�銝箔蜓閬���睃�蝝?
  float heightFactor = normalizedPos.y * 0.5 + 0.5;  // 0-1嚗���典�憿園�
  float gradientT = mix(flameMask, heightFactor, 0.4);  // 瘛瑕��芸ㄟ�屸�摨?
  gradientT = clamp(gradientT, 0.0, 1.0);
  
  // 霈∠��怎�憸𡏭𠧧
  vec3 flameColor = uBaseColor;
  if (uColorMode > 0.5 && uColorMode < 1.5) {
    // �諹𠧧皜𣂼�
    flameColor = mix(uColor1, uColor2, gradientT);
  } else if (uColorMode > 1.5 && uColorMode < 2.5) {
    // 銝㕑𠧧皜𣂼�
    if (gradientT < uColorMidPos) {
      flameColor = mix(uColor1, uColor2, gradientT / uColorMidPos);
    } else {
      flameColor = mix(uColor2, uColor3, (gradientT - uColorMidPos) / (1.0 - uColorMidPos));
    }
  } else if (uColorMode > 2.5) {
    // 蝔见��𡝗毽�?
    float hueShift = snoise(flamePos * uProceduralIntensity + uTime * 0.2) * 0.5 + 0.5;
    flameColor = mix(uColor1, uColor2, hueShift);
    flameColor = mix(flameColor, uColor3, sin(hueShift * 3.14159) * 0.5);
  }
  
  // 摨𠉛鍂�怎��桃蔗
  vec3 finalColor = flameColor * flameMask;
  
  // 瘛餃��芸��?
  finalColor *= (1.0 + uEmissive * flameMask);
  
  // Bloom 憓𧼮撩
  finalColor *= (1.0 + uBloomBoost * flameMask * 0.5);
  
  // �𤩺�摨?- �箔��怎��桃蔗���摨?
  float thicknessAlpha = 0.5 + uThickness * 1.5;  // �𡁜漲敶勗��港��𤩺�摨?
  float alpha = flameMask * uOpacity * thicknessAlpha;
  
  // �脫�撠娍��頣�颲寧��港漁嚗��摨血蔣�滩器蝻睃撩摨?
  float fresnel = 1.0 - abs(dot(normalize(vNormal), normalize(vWorldPosition)));
  float fresnelStrength = 0.3 + uThickness * 0.7;  // �𡁜漲頞𠰴之嚗諹蟮瘨�����頞𠰴撩
  alpha *= (1.0 - fresnelStrength + fresnel * fresnelStrength);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== �瑕��急����脣膥 ====================
const flameJetVertexShader = `
precision highp float;

attribute float aProgress;      // 蝎鍦��笔𦶢餈𥕦漲 0-1
attribute float aRandom;        // �𤩺㦤�?
attribute vec3 aJetDirection;   // �瑕��孵�
attribute float aJetIndex;      // ��撅𧼮𪃾撠�藁蝝Ｗ�

uniform float uTime;
uniform float uJetSpeed;
uniform float uHeight;
uniform float uWidth;
uniform float uSpread;
uniform float uTurbulence;
uniform float uLifespan;
uniform float uParticleSize;
uniform float uBurstPhase;      // ����訾� 0-1

varying float vProgress;
varying float vRandom;
varying float vAlpha;

// �芸ㄟ�賣㺭
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
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

void main() {
  vProgress = aProgress;
  vRandom = aRandom;
  
  // 霈∠�敶枏�蝎鍦�����賡𧫴畾?
  float time = uTime * uJetSpeed;
  float life = mod(aProgress + time / uLifespan + aRandom * 0.5, 1.0);
  
  // 摨𠉛鍂����訾�
  float burstFade = uBurstPhase;
  
  // 瘝踹𪃾撠�䲮�𤑳宏�?
  float height = life * uHeight;
  
  // �拇袇
  float spreadAngle = uSpread * 3.14159 / 180.0;
  float spreadAmount = life * spreadAngle;
  
  // 皝齿��啣𢆡
  vec3 turbOffset = vec3(
    snoise(vec3(position.x * 2.0 + time, position.y * 2.0, aRandom * 10.0)),
    snoise(vec3(position.y * 2.0, position.z * 2.0 + time, aRandom * 20.0)),
    snoise(vec3(position.z * 2.0, position.x * 2.0, time + aRandom * 30.0))
  ) * uTurbulence * life * 20.0;
  
  // 霈∠���蝏��蝵?
  vec3 jetDir = normalize(aJetDirection);
  vec3 sideDir = normalize(cross(jetDir, vec3(0.0, 1.0, 0.1)));
  vec3 upDir = normalize(cross(sideDir, jetDir));
  
  vec3 offset = jetDir * height;
  offset += sideDir * sin(aRandom * 6.28) * spreadAmount * uWidth * 50.0;
  offset += upDir * cos(aRandom * 6.28) * spreadAmount * uWidth * 50.0;
  offset += turbOffset;
  
  vec3 newPos = position + offset;
  
  // �𤩺�摨佗�撘�憪𧢲楚�伐�蝏𤘪�瘛∪枂
  float fadeIn = smoothstep(0.0, 0.1, life);
  float fadeOut = 1.0 - smoothstep(0.7, 1.0, life);
  vAlpha = fadeIn * fadeOut * burstFade;
  
  // 蝎鍦�憭批��讛�蝳餉※�?
  float sizeFade = 1.0 - life * 0.5;
  
  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uParticleSize * sizeFade * (300.0 / -mvPosition.z);
}
`;

const flameJetFragmentShader = `
precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;
uniform float uEmissive;
uniform int uColorMode;

varying float vProgress;
varying float vRandom;
varying float vAlpha;

void main() {
  // ��耦蝎鍦�
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  if (dist > 0.5) discard;
  
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  // 憸𡏭𠧧皜𣂼�嚗𡁏覔�桃��質�摨?
  vec3 color;
  float t = vProgress + vRandom * 0.2;
  t = clamp(t, 0.0, 1.0);
  
  if (uColorMode == 2) {
    // 銝㕑𠧧皜𣂼�
    if (t < 0.5) {
      color = mix(uColor1, uColor2, t * 2.0);
    } else {
      color = mix(uColor2, uColor3, (t - 0.5) * 2.0);
    }
  } else {
    // �諹𠧧皜𣂼�
    color = mix(uColor1, uColor2, t);
  }
  
  // �穃����
  color *= uEmissive;
  
  gl_FragColor = vec4(color, alpha * vAlpha * uOpacity);
}
`;

// ==================== �箸��怎����脣膥 ====================
const spiralFlameVertexShader = `
precision highp float;

attribute float aAngle;         // �嘥�閫鍦漲
attribute float aHeight;        // �嘥�擃睃漲雿滨蔭
attribute float aRandom;        // �𤩺㦤�?

uniform float uTime;
uniform float uBaseRadius;
uniform float uStartRadius;
uniform float uEndRadius;
uniform float uSpiralHeight;
uniform float uPitch;
uniform float uRotationSpeed;
uniform float uRiseSpeed;
uniform int uSpiralCount;
uniform int uDirection;         // 0=cw, 1=ccw, 2=both
uniform float uThickness;
uniform float uParticleSize;

uniform int uGradientDirection;  // 0=radial, 1=linearX, 2=linearY, 3=linearZ, 4=spiral

varying float vProgress;
varying float vRandom;
varying float vAlpha;
varying vec3 vPosition;

void main() {
  vRandom = aRandom;
  
  // 霈∠��園𡢿撽勗𢆡��𢆡�?
  float time = uTime;
  float dir = uDirection == 1 ? -1.0 : 1.0;
  if (uDirection == 2) {
    dir = mod(aAngle, 6.28) > 3.14 ? 1.0 : -1.0;
  }
  
  // �箸�銝𠰴��函𤫇
  float heightOffset = mod(aHeight + time * uRiseSpeed, 1.0);
  float rotOffset = time * uRotationSpeed * dir;
  
  // 霈∠��箸�雿滨蔭
  float angle = aAngle + rotOffset + heightOffset * uPitch * 6.28;
  float radiusT = heightOffset;
  float radius = mix(uStartRadius, uEndRadius, radiusT) * uBaseRadius;
  
  // 瘛餃��𡁜漲�睃�
  float thickOffset = (aRandom - 0.5) * uThickness * uBaseRadius;
  radius += thickOffset;
  
  // 霈∠� 3D 雿滨蔭
  float x = cos(angle) * radius;
  float z = sin(angle) * radius;
  float y = (heightOffset - 0.5) * uSpiralHeight;
  
  vec3 newPos = vec3(x, y, z);
  vPosition = newPos;
  
  // �𤩺�摨?
  float fadeIn = smoothstep(0.0, 0.1, heightOffset);
  float fadeOut = 1.0 - smoothstep(0.8, 1.0, heightOffset);
  vAlpha = fadeIn * fadeOut;
  
  // �寞旿皜𣂼��孵�霈∠�vProgress
  float maxRadius = max(uStartRadius, uEndRadius) * uBaseRadius;
  if (uGradientDirection == 0) {
    // 敺��嚗帋�銝剖��啗器蝻?
    vProgress = length(vec2(x, z)) / maxRadius;
  } else if (uGradientDirection == 1) {
    // X頧?
    vProgress = (x / maxRadius + 1.0) * 0.5;
  } else if (uGradientDirection == 2) {
    // Y頧湛�擃睃漲嚗?
    vProgress = heightOffset;
  } else if (uGradientDirection == 3) {
    // Z頧?
    vProgress = (z / maxRadius + 1.0) * 0.5;
  } else {
    // �箸�嚗�窒閫鍦漲嚗?
    vProgress = fract(angle / 6.28);
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uParticleSize * (300.0 / -mvPosition.z);
}
`;

const spiralFlameFragmentShader = `
precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;
uniform float uEmissive;
uniform int uColorMode;

varying float vProgress;
varying float vRandom;
varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  if (dist > 0.5) discard;
  
  float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
  
  // 憸𡏭𠧧皜𣂼�
  vec3 color;
  float t = vProgress + vRandom * 0.1;
  t = clamp(t, 0.0, 1.0);
  
  if (uColorMode == 2) {
    if (t < 0.5) {
      color = mix(uColor1, uColor2, t * 2.0);
    } else {
      color = mix(uColor2, uColor3, (t - 0.5) * 2.0);
    }
  } else {
    color = mix(uColor1, uColor2, t);
  }
  
  color *= uEmissive;
  
  gl_FragColor = vec4(color, alpha * vAlpha * uOpacity);
}
`;

// ==================== �砍��冽����𨅯遆�啣� ====================
// 餈嗘��賣㺭�刻��讐蔗�峕�敶梁頂蝏煺葉憭滨鍂

const commonEnergyEffectsGLSL = `
// HSV 頧?RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// 隡芷��箏遆�?
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// �芸ㄟ�賣㺭
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ��耦�芸ㄟ
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// �匧�瘜?- 隞𦒘葉敹��憭𡝗��?
float pulseWave(float dist, float time, float speed, float width, float count) {
  float result = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= count) break;
    float offset = float(i) / count;
    float phase = fract(dist - time * speed + offset);
    float pulse = smoothstep(0.0, width * 0.5, phase) 
                * (1.0 - smoothstep(width * 0.5, width, phase));
    result += pulse;
  }
  return result / max(count, 1.0);
}

// ����?
float concentricRings(float dist, float time, float speed, int count) {
  float result = 0.0;
  float fCount = float(count);
  for (int i = 0; i < 10; i++) {
    if (i >= count) break;
    float ringPos = float(i) / fCount;
    float animated = fract(ringPos + time * speed * 0.2);
    float ringDist = abs(dist - animated);
    float ring = 1.0 - smoothstep(0.0, 0.06, ringDist);
    result += ring;
  }
  return min(result, 1.0);
}

// �賡�瘚�𢆡�箸�
float energySpiral(float angle, float dist, float time, float density) {
  float spiral = sin((angle + dist * density - time * 0.8) * 4.0) * 0.5 + 0.5;
  return spiral;
}

// 蝏���匧����嚗�掩隡?Voronoi嚗?
float cellPulse(float seedVal, float time, float speed, float intensity) {
  return 1.0 + sin(time * speed + seedVal * 6.28) * intensity * 0.5;
}

// �脫�撠磰器蝻睃��?
float fresnelGlow(float dist, float falloff) {
  return pow(1.0 - dist, falloff);
}

// 憸𡏭𠧧皜𣂼�嚗���?銝㕑𠧧嚗?
vec3 gradientColor(float t, vec3 color1, vec3 color2, vec3 color3, int mode, float midPos) {
  if (mode == 1) {
    // �諹𠧧皜𣂼�
    return mix(color1, color2, t);
  } else if (mode == 2) {
    // 銝㕑𠧧皜𣂼�
    if (t < midPos) {
      return mix(color1, color2, t / midPos);
    } else {
      return mix(color2, color3, (t - midPos) / (1.0 - midPos));
    }
  }
  return color1;
}

// �芰����
float flicker(float time, float dist, float speed, float intensity) {
  return 1.0 + sin(time * speed + dist * 10.0) * intensity;
}
`;

// ==================== 畾见蔣蝟餌����脣膥 ====================

// 畾见蔣蝥寧�撅�▲�寧��脣膥
const afterimageTextureVertexShader = `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// 畾见蔣蝥寧�撅��畾萇��脣膥 - 瘚�𢆡�怎����
const afterimageTextureFragmentShader = `
precision highp float;

uniform float uTime;
uniform float uCoreRadius;
uniform float uPlaneSize;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;
uniform float uFlowSpeed;
uniform float uNoiseScale;
uniform float uStretchFactor;

// �∠犒�����㺭
uniform float uStripeIntensity;
uniform float uStripeCount;
uniform float uDirectionalStretch;
uniform float uEdgeSharpness;
uniform float uDistortion;

// 蝥寧�璅∪� (0=flow, 1=energy)
uniform float uTextureMode;

// �賡�蝵拙��?
uniform float uEnergyFlameScale;
uniform float uEnergyDensity;
uniform float uEnergyFlowSpeed;
uniform float uEnergyTurbulence;
uniform float uEnergyNoiseType;  // 0=simplex, 1=voronoi
uniform float uEnergyFractalLayers;
uniform float uEnergyDirection;  // 0=up, 1=spiral
uniform float uEnergyPulseEnabled;
uniform float uEnergyPulseSpeed;
uniform float uEnergyPulseIntensity;

// �箏���㺭
uniform float uStartAngle;
uniform float uAngleSpan;
uniform float uSideLength;
uniform float uSideAngle;
uniform float uSideLineType;
uniform float uCurveBend;
uniform float uCurveStrength;

varying vec2 vUv;

// �芸ㄟ�賣㺭
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

// ��耦�芸ㄟ 2D
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ===== 3D �芸ㄟ�賣㺭嚗�鍂鈭舘��讐蔗璅∪�嚗?====
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3D(vec3 v) {
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
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

// Voronoi 3D
float voronoi3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float minDist = 1.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 point = vec3(
          fract(sin(dot(i + neighbor, vec3(127.1, 311.7, 74.7))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(269.5, 183.3, 246.1))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(419.2, 371.9, 168.2))) * 43758.5453)
        );
        vec3 diff = neighbor + point - f;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
  }
  return minDist;
}

// 3D FBM
float fbm3D(vec3 p, int layers) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float totalAmplitude = 0.0;
  
  for (int i = 0; i < 5; i++) {
    if (i >= layers) break;
    float n;
    if (uEnergyNoiseType < 0.5) {
      n = snoise3D(p * frequency);
    } else {
      n = 1.0 - voronoi3D(p * frequency) * 2.0;
    }
    value += n * amplitude;
    totalAmplitude += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / totalAmplitude;
}

void main() {
  vec2 centered = vUv - 0.5;
  float dist = length(centered) * 2.0;
  float pixelAngle = atan(centered.y, centered.x);
  
  // ���颲寧��𠰴�
  float innerRadius = uCoreRadius / (uPlaneSize * 0.5);
  float outerRadius = innerRadius * uSideLength;
  outerRadius = min(outerRadius, 0.98);
  
  // �詨笆頝萘氖 (0 = ��器蝻? 1 = 憭𤥁器蝻?
  float relDist = (dist - innerRadius) / max(outerRadius - innerRadius, 0.001);
  relDist = clamp(relDist, 0.0, 1.0);
  
  // 頝萘氖�桃蔗
  float distMask = smoothstep(innerRadius * 0.9, innerRadius * 1.1, dist)
                 * (1.0 - smoothstep(outerRadius * 0.85, outerRadius, dist));
  
  // 閫鍦漲颲寧�霈∠�
  // �烐袇閫鍦漲嚗𡁶瑪�扳�撘𩤃��讛�蝳餃��㰘�摨西楊摨佗��渡瑪颲寧�嚗?
  float angleOffset = relDist * uSideAngle;
  
  // �脩瑪撘舀𤩅嚗帋��冽𤩅蝥踵芋撘譍����嚗諹悟颲寧��其葉�游摩�?
  float curveOffset = 0.0;
  if (uSideLineType > 0.5) {
    // �𤤿�蝥踹�摮琜��其葉�湔�憭改�銝斤垢銝?
    float curveFactor = relDist * (1.0 - relDist) * 4.0;
    curveOffset = curveFactor * uCurveBend * uCurveStrength * 0.5;
  }
  
  // �烐袇閫鍦漲�峕𤩅蝥踹摩�脫糓�祉�����?
  float effectiveStartAngle = uStartAngle - angleOffset - curveOffset;
  float effectiveEndAngle = uStartAngle + uAngleSpan + angleOffset + curveOffset;
  float effectiveSpan = effectiveEndAngle - effectiveStartAngle;
  
  // 閫鍦漲�桃蔗
  float normAngle = pixelAngle < 0.0 ? pixelAngle + 6.28318 : pixelAngle;
  float normStart = mod(effectiveStartAngle, 6.28318);
  float angleFromStart = normAngle - normStart;
  if (angleFromStart < 0.0) angleFromStart += 6.28318;
  
  float angleMask = 0.0;
  if (angleFromStart <= effectiveSpan && effectiveSpan > 0.0) {
    float feather = 0.15;
    float sideMask1 = smoothstep(0.0, feather, angleFromStart);
    float sideMask2 = smoothstep(0.0, feather, effectiveSpan - angleFromStart);
    angleMask = sideMask1 * sideMask2;
  }
  
  float mask = distMask * angleMask;
  if (mask < 0.01) discard;
  
  float pattern = 0.0;
  float sparkle = 0.0;
  
  // ===== 蝥寧�璅∪���𣈲 =====
  if (uTextureMode < 0.5) {
    // ===== 瘚�𢆡蝥寧�璅∪� =====
    // 撠����蓮�Ｖ蛹�����征�湛�撟嗆�隡?
    float stretchedDist = relDist * uStretchFactor;
    vec2 flowCoord = vec2(pixelAngle * 2.0, stretchedDist * 3.0);
    
    // 摰𡁜��劐撓嚗𡁜�蝻抵�摨行䲮�𡢅��劐撓敺��
    vec2 stretchedFlowCoord = vec2(flowCoord.x / uDirectionalStretch, flowCoord.y);
    
    // 瘛餃��園𡢿瘚�𢆡
    flowCoord.y -= uTime * uFlowSpeed;
    stretchedFlowCoord.y -= uTime * uFlowSpeed;
    
    // 憭𡁜��芸ㄟ嚗���㗇��頣�
    float n1 = fbm(flowCoord * uNoiseScale);
    float n2 = fbm(flowCoord * uNoiseScale * 2.0 + vec2(5.2, 1.3) - uTime * uFlowSpeed * 0.5);
    float n3 = fbm(flowCoord * uNoiseScale * 0.5 + vec2(2.8, 4.1) - uTime * uFlowSpeed * 1.5);
    
    // 蝏���芸ㄟ嚗���㗇��頣�
    float basePattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    
    // ===== �劐��∠犒���嚗���穃��?+ Ridge �賢�嚗?====
    float stripePattern = 0.0;
    if (uStripeIntensity > 0.01) {
      // 閫鍦�敶雴��?(0-1)
      float angleT = (pixelAngle - uStartAngle) / max(uAngleSpan, 0.01);
      angleT = mod(angleT, 1.0);
      
      // 瘚���鞉�嚗𡁜��穃之撟��隡?+ 閫鍦�憸𤑳�
      vec2 flowUV = vec2(
        relDist * uDirectionalStretch,    // 敺���劐撓嚗�漣�笔��穃��改�
        angleT * uStripeCount             // 閫鍦�憸𤑳�嚗�綉�嗆辺蝥寞㺭�𧶏�
      );
      
      // 瘛餃��園𡢿瘚�𢆡
      flowUV.x -= uTime * uFlowSpeed * 0.3;
      
      // Advected Noise嚗𡁶鍂雿𡡞��芸ㄟ�剜𤩅��甅�鞉�
      float warpNoise1 = fbm(flowUV * 0.4 + uTime * uFlowSpeed * 0.2);
      float warpNoise2 = fbm(flowUV * 0.3 + vec2(5.2, 3.1) + uTime * uFlowSpeed * 0.15);
      vec2 warpOffset = vec2(warpNoise1, warpNoise2 * 0.5) * uDistortion * 2.0;
      
      // ���撘��批臁憯圈��?
      float n = fbm((flowUV + warpOffset) * uNoiseScale);
      
      // Ridge �賣㺭嚗𡁜��芸ㄟ頧砌蛹�𣂼⏚�羓瑪
      float sharpExp = uEdgeSharpness * 15.0 + 1.0;
      
      // 憭𡁶㮾雿?Ridge �惩�
      float ridge1 = pow(1.0 - abs(2.0 * fract(n * 1.0) - 1.0), sharpExp);
      float ridge2 = pow(1.0 - abs(2.0 * fract(n * 1.7 + 0.33) - 1.0), sharpExp * 0.8);
      float ridge3 = pow(1.0 - abs(2.0 * fract(n * 2.3 + 0.67) - 1.0), sharpExp * 0.6);
      
      stripePattern = ridge1 * 0.5 + ridge2 * 0.3 + ridge3 * 0.2;
      
      // ��憫憓硺漁
      float innerBright = 1.0 + pow(1.0 - relDist, 2.0) * 0.6;
      
      // 憭𡝗窒銵啣�
      float outerFade = 1.0 - smoothstep(0.6, 1.0, relDist);
      
      // 瘛餃��芸ㄟ�擧��睃�
      float variation = 0.6 + warpNoise1 * 0.4;
      
      stripePattern *= innerBright * outerFade * variation;
    }
    
    // 瘛瑕��������峕辺蝥寞��?
    pattern = mix(basePattern, stripePattern, uStripeIntensity);
    
    // �厰鵭��� - 瘝踹��烐�隡貊犒�?
    float stretch = 1.0 - relDist * 0.6;
    pattern *= stretch;
    
    // 鈭桀漲�讛�蝳餉※�?
    float brightness = 1.0 - relDist * 0.7;
    pattern *= brightness;
    
    // 鈭桃�
    sparkle = pow(n2, 4.0) * 2.0;
    
  } else {
    // ===== �賡�蝵拇芋撘?=====
    // ��𢒰�惩�嚗𡁜� 2D 撟喲𢒰�鞉��惩��啁��?
    float r = dist;  // 敶雴��𤥁�蝳?
    float theta = pixelAngle;
    float phi = r * 3.14159;  // 隞𦒘葉敹��憭𡝗�撠����𢒰蝥砍漲
    
    // ��𢒰�鞉�
    vec3 spherePos = vec3(
      sin(phi) * cos(theta),
      sin(phi) * sin(theta),
      cos(phi)
    );
    
    // �怎���甅�鞉�
    vec3 flamePos = spherePos * uEnergyFlameScale;
    
    // �寞旿�孵�瘛餃��函𤫇�讐宏
    float flowTime = uTime * uEnergyFlowSpeed;
    if (uEnergyDirection < 0.5) {
      // �睲�瘚�𢆡
      flamePos.y -= flowTime;
    } else {
      // �箸�銝𠰴�
      float angle = flowTime * 2.0;
      float c = cos(angle);
      float s = sin(angle);
      flamePos.xz = mat2(c, -s, s, c) * flamePos.xz;
      flamePos.y -= flowTime * 0.5;
    }
    
    // 瘛餃�皝齿��啣𢆡
    vec3 turbulenceOffset = vec3(
      snoise3D(flamePos * 2.0 + uTime * 0.3),
      snoise3D(flamePos * 2.0 + 100.0 + uTime * 0.3),
      snoise3D(flamePos * 2.0 + 200.0 + uTime * 0.3)
    ) * uEnergyTurbulence * 0.5;
    flamePos += turbulenceOffset;
    
    // 霈∠���耦�怎��芸ㄟ
    int layers = int(uEnergyFractalLayers);
    float flameNoise = fbm3D(flamePos, layers);
    
    // 頧祆揢銝箇��啣耦�?[0, 1]
    float flameMask = (flameNoise + 1.0) * 0.5;
    
    // 摨𠉛鍂撖�漲�批�
    flameMask = pow(flameMask, 2.0 - uEnergyDensity * 1.5);
    
    // �匧����
    if (uEnergyPulseEnabled > 0.5) {
      float pulse = sin(uTime * uEnergyPulseSpeed * 3.14159) * 0.5 + 0.5;
      flameMask *= 1.0 + pulse * uEnergyPulseIntensity;
    }
    
    pattern = flameMask;
    
    // ��憫憓硺漁
    float innerBright = 1.0 + pow(1.0 - relDist, 2.0) * 0.5;
    
    // 憭𡝗窒銵啣�
    float outerFade = 1.0 - smoothstep(0.7, 1.0, relDist);
    
    pattern *= innerBright * outerFade;
    
    // 鈭桃�
    sparkle = pow(max(flameNoise, 0.0), 4.0) * 1.5;
  }
  
  // ===== 憸𡏭𠧧皜𣂼�嚗���剁�=====
  vec3 color;
  float colorPattern = pattern;
  
  // 擃㗛�摨行𧒄雿輻鍂�湧䐓����脫�撠��隞���函犒��芋撘𧶏�
  if (uTextureMode < 0.5 && uStripeIntensity > 0.01 && uEdgeSharpness > 0.3) {
    colorPattern = pow(pattern, mix(1.0, 0.5, uEdgeSharpness));
  }
  
  if (colorPattern < 0.33) {
    color = mix(uColor1, uColor2, colorPattern * 3.0);
  } else if (colorPattern < 0.66) {
    color = mix(uColor2, uColor3, (colorPattern - 0.33) * 3.0);
  } else {
    color = uColor3 + sparkle * vec3(1.0);
  }
  
  // 颲寧��穃�嚗�蝙�冽��脣�銝剝𡢿�脩�瘛瑕�嚗?
  float edgeGlow = pow(1.0 - relDist, 2.0) * 0.3;
  color += edgeGlow * mix(uColor1, uColor2, 0.5);
  
  // ��蝏���?
  float alpha = mask * uOpacity * (0.3 + pattern * 0.7);
  
  gl_FragColor = vec4(color, alpha);
}
`;

// 畾见蔣蝎鍦����脣膥
const afterimageParticleVertexShader = `
precision highp float;

attribute float aProgress;      // 蝎鍦��笔𦶢餈𥕦漲 0-1
attribute float aRandom;        // �𤩺㦤�?
attribute float aAngle;         // �箇��烐袇閫鍦漲嚗?-1嚗𣬚㮾撖嫣��箏�閫鍦漲頝典漲嚗?

uniform float uTime;
uniform float uSpeed;
uniform float uSpeedRandomness;
uniform float uLifespan;
uniform float uSize;
uniform int uSizeDecay;         // 0=none, 1=linear, 2=exponential
uniform float uCoreRadius;      // �詨��𠰴�

// �箏���㺭
uniform float uStartAngle;
uniform float uAngleSpan;
uniform float uSideLength;
uniform float uSideAngle;       // 靘扯器�烐袇閫鍦漲嚗�憫摨佗�
uniform float uSideLineType;    // 0=�渡瑪, 1=�脩瑪
uniform float uCurveBend;       // �脩瑪撘舀𤩅�孵�: -1=��摩, 1=憭硋摩
uniform float uCurveStrength;   // �脩瑪撘箏漲 0-1

varying float vAlpha;
varying float vProgress;

void main() {
  // 霈∠��笔𦶢�嗆挾
  float speed = uSpeed * (1.0 + (aRandom - 0.5) * uSpeedRandomness * 2.0);
  float life = mod(aProgress + uTime * speed / uLifespan, 1.0);
  vProgress = life;
  
  // 蝎鍦�隞擧瓲敹�器蝻睃�憪页��穃��烐袇
  float startDist = uCoreRadius;
  float maxDist = uCoreRadius * uSideLength;
  float dist = startDist + life * (maxDist - startDist);
  
  // aAngle (0-1) 銵函內蝎鍦��典躹�蠘�摨西楊摨血����蝵?
  // posFromCenter: -1 (撌西器�? �?+1 (�唾器�?嚗? 銝箔葉敹?
  float posFromCenter = (aAngle - 0.5) * 2.0;
  
  // �箇�閫鍦漲 = �箏�銝剖�閫鍦漲 + 蝎鍦��典躹�笔����蝘?
  float centerAngle = uStartAngle + uAngleSpan * 0.5;
  float baseOffset = posFromCenter * uAngleSpan * 0.5;
  
  // �烐袇閫鍦漲���嚗𡁻�頝萘氖憓𧼮�嚗諹器蝻条�摮𣂼�憭𡝗��?
  float divergeOffset = posFromCenter * life * uSideAngle;
  
  // �脩瑪撘舀𤩅���嚗𡁜銁銝剝𡢿頝萘氖��撘?
  float curveOffset = 0.0;
  if (uSideLineType > 0.5) {
    float curveFactor = life * (1.0 - life) * 4.0;
    curveOffset = posFromCenter * curveFactor * uCurveBend * uCurveStrength * 0.5;
  }
  
  // ��蝏��摨?
  float finalAngle = centerAngle + baseOffset + divergeOffset + curveOffset;
  
  // 霈∠�銝𣇉��鞉�雿滨蔭嚗�銁XY撟喲𢒰銝𠺪�
  vec3 newPos = vec3(cos(finalAngle) * dist, sin(finalAngle) * dist, 0.0);
  
  // �𤩺�摨西恣蝞?
  float fadeIn = smoothstep(0.0, 0.15, life);
  float fadeOut = 1.0 - smoothstep(0.6, 1.0, life);
  vAlpha = fadeIn * fadeOut;
  
  // 蝎鍦�憭批�
  float sizeFade = 1.0;
  if (uSizeDecay == 1) {
    sizeFade = 1.0 - life * 0.7;
  } else if (uSizeDecay == 2) {
    sizeFade = exp(-life * 2.0);
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uSize * sizeFade * (300.0 / -mvPosition.z);
}
`;

const afterimageParticleFragmentShader = `
precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform int uColorMode;         // 0=single, 1=gradient

varying float vAlpha;
varying float vProgress;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  if (dist > 0.5) discard;
  
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  vec3 color;
  if (uColorMode == 1) {
    color = mix(uColor1, uColor2, vProgress);
  } else {
    color = uColor1;
  }
  
  gl_FragColor = vec4(color, alpha * vAlpha);
}
`;

// ==================== 憭硋ㄢ�㗇����脣膥 ====================
// �其��函�雿枏��游�撱箇�甇��憭𡝗��㗇����

const glowShellVertexShader = `
precision highp float;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;

void main() {
  vLocalPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const glowShellFragmentShader = `
precision highp float;

// �㗇�憸𡏭𠧧蝟餌�嚗�𣈲����矋�
uniform float uGlowColorMode;
uniform vec3 uGlowBaseColor;
uniform vec3 uGlowColor1;
uniform vec3 uGlowColor2;
uniform vec3 uGlowColor3;
uniform float uGlowColorMidPos;
uniform float uGlowColorMidWidth;
uniform float uGlowColorMidWidth2;
uniform float uGlowGradientDir;
uniform vec3 uGlowCustomDir;
uniform float uGlowSpiralDensity;
uniform float uGlowProceduralInt;
uniform float uRadius;

uniform float uGlowStrength;
uniform float uGlowFalloff;
uniform float uGlowInward;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;

void main() {
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);
  
  // 霈∠�皜𣂼���㺭
  vec3 normLocal = vLocalPosition / uRadius;
  float radialT = length(normLocal);
  float theta = atan(normLocal.z, normLocal.x);
  float angularT = (theta + 3.14159) / (2.0 * 3.14159);
  
  float gradientT = radialT;
  if (uGlowGradientDir < 0.5) { gradientT = radialT; }
  else if (uGlowGradientDir < 1.5) { gradientT = (normLocal.x + 1.0) * 0.5; }
  else if (uGlowGradientDir < 2.5) { gradientT = (normLocal.y + 1.0) * 0.5; }
  else if (uGlowGradientDir < 3.5) { gradientT = (normLocal.z + 1.0) * 0.5; }
  else if (uGlowGradientDir < 4.5) { gradientT = (dot(normLocal, normalize(uGlowCustomDir)) + 1.0) * 0.5; }
  else { gradientT = fract(angularT * uGlowSpiralDensity + radialT * 2.0); }
  gradientT = clamp(gradientT, 0.0, 1.0);
  
  // 霈∠��㗇�憸𡏭𠧧
  vec3 glowColor = uGlowBaseColor;
  if (uGlowColorMode > 0.5 && uGlowColorMode < 1.5) {
    glowColor = mix(uGlowColor1, uGlowColor2, gradientT);
  } else if (uGlowColorMode > 1.5 && uGlowColorMode < 2.5) { // 銝㕑𠧧皜𣂼�
    float blendWeight = min(uGlowColorMidWidth, 1.0);
    float rangeExpand = max(uGlowColorMidWidth - 1.0, 0.0) * 0.2;
    float bandHalf = uGlowColorMidWidth2 * 0.5;
    float midStart = max(0.01, uGlowColorMidPos - rangeExpand - bandHalf);
    float midEnd = min(0.99, uGlowColorMidPos + rangeExpand + bandHalf);
    
    vec3 threeColorGlow;
    if (gradientT < midStart) {
      threeColorGlow = mix(uGlowColor1, uGlowColor2, gradientT / midStart);
    } else if (gradientT > midEnd) {
      threeColorGlow = mix(uGlowColor2, uGlowColor3, (gradientT - midEnd) / (1.0 - midEnd));
    } else {
      threeColorGlow = uGlowColor2;
    }
    vec3 twoColorGlow = mix(uGlowColor1, uGlowColor3, gradientT);
    glowColor = mix(twoColorGlow, threeColorGlow, blendWeight);
  } else if (uGlowColorMode > 2.5) {
    float hueShift = gradientT * uGlowProceduralInt * 0.3;
    glowColor = uGlowBaseColor;
    glowColor.r = mix(glowColor.r, glowColor.g, hueShift);
    glowColor.g = mix(glowColor.g, glowColor.b, hueShift);
  }
  
  // 霈∠��箇�颲寧��惩�
  float dotProduct = abs(dot(viewDir, normal));
  float edgeFactor = mix(1.0 - dotProduct, dotProduct, uGlowInward);
  float glow = pow(edgeFactor, uGlowFalloff);
  float alpha = glow * uGlowStrength;
  vec3 color = glowColor * (1.0 + glow * 0.5);
  
  gl_FragColor = vec4(color, alpha);
}
`;

// 餈䂿賒�臬蒂���脣膥嚗�䌊頧砍銁 JavaScript 銝剝�朞� rotateOnAxis 摰䂿緵嚗?
const ringVertexShader = `
precision highp float;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vLocalPosition;

void main() {
  vUv = uv;
  vPosition = position;
  vLocalPosition = position;  // �砍𧑐�鞉��其�憸𡏭𠧧霈∠�
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ringFragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform vec3 uGradientColor1;   // 韏瑕��?
uniform vec3 uGradientColor2;   // 蝏𤘪��莎��諹𠧧嚗㗇�銝剝𡢿�莎�銝㕑𠧧嚗?
uniform vec3 uGradientColor3;   // 蝏𤘪��莎�銝㕑𠧧嚗?
uniform int uColorMode;         // 0=�閗𠧧, 1=�諹𠧧, 2=銝㕑𠧧, 3=瘛瑁𠧧
uniform int uGradientDirection; // 0=radial, 1=linearX, 2=linearY, 3=linearZ, 4=linearCustom, 5=spiral
uniform vec3 uGradientCustomDir;
uniform float uColorMidPosition;
uniform float uColorMidWidth;   // 銝剝𡢿�脣捐摨佗��圈�餉�嚗?
uniform float uColorMidWidth2;  // 蝥航𠧧撣血捐摨佗��折�餉�嚗?
uniform float uBlendStrength;   // 皜𣂼�餈�腹撘箏漲 0-1嚗?=蝖祈器���嚗?=撟單�餈�腹嚗?
uniform float uSpiralDensity;
uniform int uSpiralAxis;        // 0=x, 1=y, 2=z
uniform float uProceduralIntensity;
uniform int uProceduralAxis;    // 0=x, 1=y, 2=z, 3=radial, 4=custom
uniform vec3 uProceduralCustomAxis;
uniform float uOpacity;
uniform int uOpacityGradient;   // 0=none, 1=fadeIn, 2=fadeOut, 3=fadeBoth
uniform float uOpacityGradientStrength;
uniform float uTime;
uniform float uRingRadius;      // �臬蒂撟喳��𠰴�嚗𣬚鍂鈭𤾸�銝��?

// 瞍拇間��� uniforms
uniform int uVortexEnabled;
uniform int uVortexArmCount;
uniform float uVortexTwist;
uniform float uVortexRotationSpeed;
uniform int uVortexRadialDir;   // 0=static, 1=inward, 2=outward
uniform float uVortexRadialSpeed;
uniform float uVortexHardness;
uniform vec3 uVortexColors[7];
uniform int uVortexColorCount;

// �暸���� uniforms嚗�����𤩺��桃蔗嚗?
uniform int uVisibilityEnabled;
uniform float uVisibilityMinOpacity;  // ��雿𡡞�𤩺�摨?
uniform float uVisibilityArmCount;    // �贝��圈�
uniform float uVisibilityTwist;       // �剜𤩅蝔见漲
uniform float uVisibilityHardness;    // 蝖祈器蝔见漲
uniform float uVisibilityRotSpeed;    // �贝蓮�笔漲
uniform int uVisibilityRadialDir;     // 敺��瘚�𢆡�孵� 0=none, 1=inward, 2=outward
uniform float uVisibilityRadialSpeed; // 敺��瘚�𢆡�笔漲

// �劐���� uniforms
uniform int uStreakEnabled;
uniform float uStreakFlowSpeed;
uniform float uStreakStripeCount;
uniform float uStreakRadialStretch;
uniform float uStreakSharpness;
uniform float uStreakDistortion;
uniform float uStreakNoiseScale;
uniform float uStreakDirection;  // 1=cw, -1=ccw
uniform float uStreakBrightness;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vLocalPosition;

#define PI 3.14159265359

// ===== �劐�����芸ㄟ�賣㺭 =====
float streakHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float streakNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = streakHash(i);
  float b = streakHash(i + vec2(1.0, 0.0));
  float c = streakHash(i + vec2(0.0, 1.0));
  float d = streakHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float streakFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * streakNoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// �冽��批臁憯圈��瘀�雿輻鍂��𪂹�鞉�摰䂿緵�删�餈墧𦻖嚗?
float streakPeriodicNoise(vec2 uv, float period) {
  // 撠���穃���蓮�Ｖ蛹��𪂹銝羓��對�摰䂿緵�冽��?
  float angle = uv.y * 2.0 * PI / period;
  // 雿輻鍂3D�芸ㄟ嚗𣬚鍂��𪂹�鞉��蹂誨閫鍦��鞉�
  vec2 circlePos = vec2(cos(angle), sin(angle)) * period * 0.5;
  // 蝏��敺������典��?
  vec3 samplePos = vec3(uv.x, circlePos);
  // �?D�芸ㄟ�����甅璅⊥�3D���
  float n1 = streakNoise(vec2(samplePos.x, samplePos.y));
  float n2 = streakNoise(vec2(samplePos.x + 100.0, samplePos.z));
  return mix(n1, n2, 0.5);
}

// �冽��?FBM
float streakPeriodicFbm(vec2 uv, float period) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * streakPeriodicNoise(uv * frequency, period * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// 霈∠��訫��劐����嚗���啣���𧋦嚗?
float calculateStreakLayer(vec2 uv, float time, float stripeCount, float radialStretch, float sharpness, float flowSpeedMult, float phase, float distortion, float noiseScale) {
  // 閫鍦��鞉�嚗帋�隞交辺蝥寞㺭�譍漣�笔𪂹�?
  float angularT = uv.y * stripeCount;
  
  // 敺���鞉�嚗𡁜之撟��隡訾漣�笔��穃��?
  float radialT = uv.x * radialStretch;
  
  // 瘚�� UV + �訾��讐宏
  vec2 streakUV = vec2(radialT, angularT + phase);
  
  // 瘛餃��園𡢿瘚�𢆡嚗�窒��瑪�孵�嚗㚁�銝滚�撅���屸�笔漲
  float timeOffset = time * uStreakFlowSpeed * uStreakDirection * flowSpeedMult;
  streakUV.y += timeOffset;
  
  // Advected Noise �剜𤩅嚗�蝙�典𪂹���批臁憯堆�
  float warp1 = streakPeriodicFbm(streakUV * 0.4 + vec2(time * 0.2 * flowSpeedMult, phase), stripeCount * 0.4);
  float warp2 = streakPeriodicFbm(streakUV * 0.3 + vec2(5.2 + phase, 3.1), stripeCount * 0.3);
  vec2 warpOffset = vec2(warp1, warp2 * 0.5) * distortion;
  
  // ��甅�芸ㄟ嚗�蝙�典𪂹���批臁憯堆�
  float n = streakPeriodicFbm((streakUV + warpOffset) * noiseScale, stripeCount * noiseScale);
  
  // Ridge �賣㺭嚗𡁜��芸ㄟ頧砌蛹�𣂼⏚�羓瑪
  float sharpExp = sharpness * 15.0 + 1.0;
  float ridge1 = pow(1.0 - abs(2.0 * fract(n) - 1.0), sharpExp);
  float ridge2 = pow(1.0 - abs(2.0 * fract(n * 1.7 + 0.33) - 1.0), sharpExp * 0.8);
  float ridge3 = pow(1.0 - abs(2.0 * fract(n * 2.3 + 0.67) - 1.0), sharpExp * 0.6);
  
  return ridge1 * 0.5 + ridge2 * 0.3 + ridge3 * 0.2;
}

// 霈∠�憭𡁻��惩��劐����
vec4 calculateStreak(vec2 uv, float time) {
  float radialT = uv.x;  // 0=��器蝻? 1=憭𤥁器蝻?
  
  // ===== 銝厰��惩� =====
  // 雿𡡞�撅��憭批偕摨行��堒蒂嚗�����
  float lowFreq = calculateStreakLayer(
    uv, time,
    uStreakStripeCount * 0.4,      // �∠犒�圈��誩�
    uStreakRadialStretch * 0.5,    // 敺���劐撓�誩�
    uStreakSharpness * 0.5,        // �湔��?
    0.5,                           // �ａ����?
    0.0,                           // �訾�
    uStreakDistortion * 1.2,       // �剜𤩅蝔滚撩
    uStreakNoiseScale * 0.6        // �芸ㄟ蝻拇𦆮
  );
  
  // 銝剝�撅��銝餅辺蝥孵蒂嚗�迤撣賊�笔漲嚗?
  float midFreq = calculateStreakLayer(
    uv, time,
    uStreakStripeCount,            // �冽�霈曄蔭��辺蝥寞㺭�?
    uStreakRadialStretch,          // �冽�霈曄蔭����烐�隡?
    uStreakSharpness,              // �冽�霈曄蔭���摨?
    1.0,                           // 甇�虜�笔漲
    0.33,                          // �訾��坔�
    uStreakDistortion,             // �冽�霈曄蔭��酞�?
    uStreakNoiseScale              // �冽�霈曄蔭��臁憯啁憬�?
  );
  
  // 擃㗛�撅��蝏��蝥寧�嚗�翰���
  float highFreq = calculateStreakLayer(
    uv, time,
    uStreakStripeCount * 2.5,      // �∠犒�圈�憓𧼮�
    uStreakRadialStretch * 1.5,    // 敺���劐撓憓𧼮�
    uStreakSharpness * 1.3,        // �湧��?
    1.5,                           // 敹恍����?
    0.67,                          // �訾��坔�
    uStreakDistortion * 0.8,       // �剜𤩅�誩摹
    uStreakNoiseScale * 1.5        // �芸ㄟ蝻拇𦆮憓𧼮�
  );
  
  // ===== 憭𡁻�瘛瑕� =====
  // 雿𡡞�靚��銝剝�撘箏漲 + 擃㗛��惩�蝏��
  float streak = max(lowFreq * 0.5, midFreq) * 0.7 + highFreq * 0.3;
  
  // ===== 雿梶妖�笔�撘?=====
  // ��器蝻䀹��伐�璅⊥��匧郎瘛勗漲嚗?
  float innerFade = smoothstep(0.0, 0.25, radialT);
  
  // 憭𤥁器蝻䀹楚�?
  float outerFade = 1.0 - smoothstep(0.75, 1.0, radialT);
  
  // 憭𤥁器蝻睃��?
  float outerGlow = pow(radialT, 3.0) * 0.4;
  
  // ��器蝻䀝漁蝥?
  float innerRim = exp(-radialT * 6.0) * 0.25;
  
  // 摨𠉛鍂雿梶妖�桃蔗
  float volumeMask = innerFade * outerFade;
  streak *= volumeMask;
  
  // 瘛餃�颲寧��穃�
  streak += outerGlow * (0.3 + midFreq * 0.4);
  streak += innerRim * (0.5 + lowFreq * 0.3);
  
  // 摨𠉛鍂鈭桀漲
  streak *= uStreakBrightness;
  
  // 鈭桃����嚗�抅鈭𡡞�憸穃�嚗?
  float sparkle = pow(highFreq, 3.0) * 1.2;
  
  // 餈𥪜�撘箏漲�䔶漁�?
  return vec4(streak, sparkle, midFreq, 1.0);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// 霈∠�瞍拇間憸𡏭𠧧
vec3 calculateVortexColor(float radialT, float angularT) {
  // 1. ��遣�箸�閫鍦漲
  float angle = angularT * 2.0 * PI;
  float spiralAngle = angle + radialT * uVortexTwist;
  
  // 2. 瘛餃��園𡢿�函𤫇 - �贝蓮
  spiralAngle += uTime * uVortexRotationSpeed;
  
  // 3. 敺���嗥憬/�拇袇�函𤫇
  float animatedRadialT = radialT;
  if (uVortexRadialDir == 1) {
    // �穃��嗥憬
    animatedRadialT = fract(radialT + uTime * uVortexRadialSpeed);
  } else if (uVortexRadialDir == 2) {
    // �穃��拇袇
    animatedRadialT = fract(radialT - uTime * uVortexRadialSpeed);
  }
  
  // 4. ����贝��暹�嚗?-1�舫蝙瘜ｇ�
  float armCount = float(uVortexArmCount);
  float pattern = spiralAngle * armCount / (2.0 * PI);
  pattern = fract(pattern);
  
  // 5. 摨𠉛鍂蝖祈器蝔见漲
  float smoothPattern;
  if (uVortexHardness > 0.99) {
    // 摰��蝖祈器
    smoothPattern = step(0.5, pattern);
  } else {
    // �𥪜�颲寧�
    float edge = 0.5 * (1.0 - uVortexHardness);
    smoothPattern = smoothstep(0.0, edge, pattern) * (1.0 - smoothstep(1.0 - edge, 1.0, pattern));
  }
  
  // 6. 憸𡏭𠧧瘛瑕�嚗���脣儐�荔�
  float colorCount = float(uVortexColorCount);
  float colorPos = pattern * colorCount;
  int colorIndex = int(floor(colorPos));
  float localT = fract(colorPos);
  
  // 撟單�憸𡏭𠧧餈�腹
  vec3 vortexColor;
  if (colorIndex >= uVortexColorCount - 1) {
    vortexColor = mix(uVortexColors[uVortexColorCount - 1], uVortexColors[0], localT);
  } else {
    // �见𢆡蝝Ｗ�嚗𠃑LSL ES 銝齿𣈲��𢆡��㺭蝏�揣撘𤏪�
    vec3 c1, c2;
    if (colorIndex == 0) { c1 = uVortexColors[0]; c2 = uVortexColors[1]; }
    else if (colorIndex == 1) { c1 = uVortexColors[1]; c2 = uVortexColors[2]; }
    else if (colorIndex == 2) { c1 = uVortexColors[2]; c2 = uVortexColors[3]; }
    else if (colorIndex == 3) { c1 = uVortexColors[3]; c2 = uVortexColors[4]; }
    else if (colorIndex == 4) { c1 = uVortexColors[4]; c2 = uVortexColors[5]; }
    else { c1 = uVortexColors[5]; c2 = uVortexColors[6]; }
    vortexColor = mix(c1, c2, localT);
  }
  
  return vortexColor;
}

void main() {
  // vUv.x �臬��睲�蝵?(0=��器蝻? 1=憭𤥁器蝻?
  // vUv.y �舐㴓�睲�蝵?(0-1 銝��?
  float radialT = vUv.x;
  float angularT = vUv.y;
  
  // 霈∠�皜𣂼���㺭 t嚗�覔�格��䀹䲮�𡢅�
  float gradientT = radialT; // 暺䁅恕敺��
  
  if (uGradientDirection == 0) {
    // 敺��嚗帋����憭?
    gradientT = radialT;
  } else if (uGradientDirection == 1) {
    // X頧渡瑪�改��函㴓撟喲𢒰���
    gradientT = (vLocalPosition.x / uRingRadius + 1.0) * 0.5;
  } else if (uGradientDirection == 2) {
    // Y頧渡瑪�改��函㴓撟喲𢒰���
    gradientT = (vLocalPosition.y / uRingRadius + 1.0) * 0.5;
  } else if (uGradientDirection == 3) {
    // Z頧渡瑪�?
    gradientT = (vLocalPosition.z / uRingRadius + 1.0) * 0.5;
  } else if (uGradientDirection == 4) {
    // �芸�銋㗇䲮�?
    vec3 normDir = normalize(uGradientCustomDir);
    gradientT = (dot(vLocalPosition, normDir) / uRingRadius + 1.0) * 0.5;
  } else if (uGradientDirection == 5) {
    // �箸�嚗𡁏窒�臬�
    gradientT = fract(angularT * uSpiralDensity);
  }
  
  gradientT = clamp(gradientT, 0.0, 1.0);
  
  // 霈∠��箇�憸𡏭𠧧
  vec3 color = uColor;
  
  // 皜𣂼�餈�腹撘箏漲憭��嚗𡁜� gradientT 餈𥡝��䂿瑪�扳�撠?
  // blendStrength = 0 �塚�餈�腹�𧼮虜�∪陪嚗��撅���橘�
  // blendStrength = 1 �塚�靽脲�蝥踵�批像皛𤏸�皜?
  float blendedT = gradientT;
  if (uBlendStrength < 0.99 && (uColorMode == 1 || uColorMode == 2)) {
    // 雿輻鍂 smoothstep ��器蝻睃捐摨行䔉�批�餈�腹�𣂼⏚摨?
    float edgeWidth = max(uBlendStrength * 0.5, 0.001);
    // 撖嫣��諹𠧧嚗帋誑 0.5 銝箏��𣬚�
    // 撖嫣�銝㕑𠧧嚗𡁻�閬�舅銝芾�皜∠�
    if (uColorMode == 1) {
      blendedT = smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, gradientT);
    }
  }
  
  if (uColorMode == 1) {
    // �諹𠧧皜𣂼�
    color = mix(uGradientColor1, uGradientColor2, blendedT);
  } else if (uColorMode == 2) {
    // 銝㕑𠧧皜𣂼�
    float blendWeight = min(uColorMidWidth, 1.0);
    float rangeExpand = max(uColorMidWidth - 1.0, 0.0) * 0.2;
    float bandHalf = uColorMidWidth2 * 0.5;
    float midStart = max(0.01, uColorMidPosition - rangeExpand - bandHalf);
    float midEnd = min(0.99, uColorMidPosition + rangeExpand + bandHalf);
    
    // 皜𣂼�餈�腹撘箏漲摨𠉛鍂鈭𦒘��脫��条�銝支葵餈�腹颲寧�
    float edgeWidth = max(uBlendStrength * 0.3, 0.001);
    
    vec3 threeColorResult;
    if (gradientT < midStart) {
      float t = gradientT / midStart;
      // �刻�皜∪躹�笔��券��?
      float sharpenedT = smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, t);
      sharpenedT = mix(sharpenedT, t, uBlendStrength); // 瘛瑕��笔��屸��硋�?
      threeColorResult = mix(uGradientColor1, uGradientColor2, sharpenedT);
    } else if (gradientT > midEnd) {
      float t = (gradientT - midEnd) / (1.0 - midEnd);
      float sharpenedT = smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, t);
      sharpenedT = mix(sharpenedT, t, uBlendStrength);
      threeColorResult = mix(uGradientColor2, uGradientColor3, sharpenedT);
    } else {
      threeColorResult = uGradientColor2;
    }
    vec3 twoColorResult = mix(uGradientColor1, uGradientColor3, gradientT);
    color = mix(twoColorResult, threeColorResult, blendWeight);
  } else if (uColorMode == 3) {
    // 瘛瑁𠧧璅∪�嚗𡁜抅鈭𦒘�蝵桃��脩㮾�讐宏
    // �寞旿瘛瑁𠧧頧游�霈∠�gradientT
    float proceduralT = gradientT;
    if (uProceduralAxis == 0) {
      // X頧?
      proceduralT = (vLocalPosition.x / uRingRadius + 1.0) * 0.5;
    } else if (uProceduralAxis == 1) {
      // Y頧?
      proceduralT = (vLocalPosition.y / uRingRadius + 1.0) * 0.5;
    } else if (uProceduralAxis == 2) {
      // Z頧?
      proceduralT = (vLocalPosition.z / uRingRadius + 1.0) * 0.5;
    } else if (uProceduralAxis == 3) {
      // 敺��
      proceduralT = radialT;
    } else if (uProceduralAxis == 4) {
      // �芸�銋㕑蓬�?
      vec3 normAxis = normalize(uProceduralCustomAxis);
      proceduralT = (dot(vLocalPosition, normAxis) / uRingRadius + 1.0) * 0.5;
    }
    vec3 hsv = rgb2hsv(uColor);
    float hueOffset = proceduralT * uProceduralIntensity * 0.3;
    hsv.x = fract(hsv.x + hueOffset);
    color = hsv2rgb(hsv);
  }
  
  // 瞍拇間����惩�
  if (uVortexEnabled == 1) {
    vec3 vortexColor = calculateVortexColor(radialT, angularT);
    color = vortexColor; // 瞍拇間憸𡏭𠧧摰��閬���箇�憸𡏭𠧧
  }
  
  // �劐�����惩�嚗��瞍拇間鈭埝棅嚗峕�銝苷����
  if (uStreakEnabled == 1) {
    vec4 streakData = calculateStreak(vUv, uTime);
    float streakIntensity = streakData.x;
    float sparkle = streakData.y;
    
    // �寞旿撘箏漲瘛瑕�憸𡏭𠧧嚗���函鍂Color1嚗䔶漁�函鍂Color2/Color3嚗?
    vec3 streakColor;
    if (streakIntensity < 0.33) {
      streakColor = mix(uGradientColor1, uGradientColor2, streakIntensity * 3.0);
    } else if (streakIntensity < 0.66) {
      streakColor = mix(uGradientColor2, uGradientColor3, (streakIntensity - 0.33) * 3.0);
    } else {
      streakColor = uGradientColor3 + sparkle * vec3(1.0);
    }
    
    // �劐����摰��閬���箇�憸𡏭𠧧
    color = streakColor * streakIntensity;
  }
  
  float alpha = uOpacity;
  
  // �𤩺�摨行��?- �箔�敺��雿滨蔭
  float opacityFactor = 1.0;
  if (uOpacityGradient == 1) { // fadeIn: 隞𤾸��啣�皜𣂼�嚗��靘折�𤩺�嚗?
    opacityFactor = pow(radialT, 0.3 + 0.7 * uOpacityGradientStrength);
  } else if (uOpacityGradient == 2) { // fadeOut: 隞𤾸��啣�皜𣂼枂嚗��靘折�𤩺�嚗?
    opacityFactor = pow(1.0 - radialT, 0.3 + 0.7 * uOpacityGradientStrength);
  } else if (uOpacityGradient == 3) { // fadeBoth: 銝斤垢皜𣂼�嚗�葉�港��𤩺�嚗?
    float edge = 0.5 * uOpacityGradientStrength;
    if (radialT < edge) {
      opacityFactor = radialT / edge;
    } else if (radialT > 1.0 - edge) {
      opacityFactor = (1.0 - radialT) / edge;
    }
  }
  alpha *= opacityFactor;
  
  // 瘛餃�銝�鈭𤤿犒����?
  float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
  alpha *= 0.9 + 0.1 * noise;
  
  // �暸����嚗�����𤩺��桃蔗嚗?
  if (uVisibilityEnabled == 1) {
    // ��遣�箸�閫鍦漲
    float angle = angularT * 2.0 * PI;
    float spiralAngle = angle + radialT * uVisibilityTwist;
    
    // 瘛餃��園𡢿�函𤫇 - �贝蓮
    spiralAngle += uTime * uVisibilityRotSpeed;
    
    // 敺���嗥憬/�拇袇�函𤫇
    float animatedRadialT = radialT;
    if (uVisibilityRadialDir == 1) {
      // �穃��嗥憬
      animatedRadialT = fract(radialT + uTime * uVisibilityRadialSpeed);
    } else if (uVisibilityRadialDir == 2) {
      // �穃��拇袇
      animatedRadialT = fract(radialT - uTime * uVisibilityRadialSpeed);
    }
    
    // ����贝��暹�嚗?-1�舫蝙瘜ｇ�
    float armCount = uVisibilityArmCount;
    float pattern = spiralAngle * armCount / (2.0 * PI);
    pattern = fract(pattern);
    
    // 摨𠉛鍂蝖祈器蝔见漲
    float smoothPattern;
    if (uVisibilityHardness > 0.99) {
      // 摰��蝖祈器
      smoothPattern = step(0.5, pattern);
    } else {
      // �𥪜�颲寧�
      float edge = 0.5 * (1.0 - uVisibilityHardness);
      smoothPattern = smoothstep(0.0, edge, pattern) * (1.0 - smoothstep(1.0 - edge, 1.0, pattern));
    }
    
    // 摨𠉛鍂�𤩺�摨阡�蝵?
    alpha *= mix(1.0, uVisibilityMinOpacity, smoothPattern);
  }
  
  gl_FragColor = vec4(color, alpha);
}
`;

// 瘚�𨫡�硋偏���脣膥
const trailVertexShader = `
precision highp float;

attribute float aAlpha;
attribute float aWidth;

varying float vAlpha;

void main() {
  vAlpha = aAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aWidth * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const trailFragmentShader = `
precision highp float;

uniform vec3 uColor;

varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;
  
  float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
  gl_FragColor = vec4(uColor, alpha);
}
`;

// ==================== �峕艶�冽艶�曄��脣膥 ====================

const backgroundVertexShader = `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const backgroundFragmentShader = `
precision highp float;

uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uSaturation;

varying vec2 vUv;

// RGB 頧?HSL
vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) / 2.0;
  
  if (maxC == minC) {
    return vec3(0.0, 0.0, l);
  }
  
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  
  if (maxC == c.r) {
    h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  } else if (maxC == c.g) {
    h = (c.b - c.r) / d + 2.0;
  } else {
    h = (c.r - c.g) / d + 4.0;
  }
  h /= 6.0;
  
  return vec3(h, s, l);
}

// HSL 頧?RGB
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  
  if (s == 0.0) {
    return vec3(l);
  }
  
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  
  // 摨𠉛鍂擖勗�摨西��?
  vec3 hsl = rgb2hsl(texColor.rgb);
  hsl.y = clamp(hsl.y * uSaturation, 0.0, 1.0);
  vec3 adjustedColor = hsl2rgb(hsl);
  
  // 摨𠉛鍂鈭桀漲
  vec3 finalColor = adjustedColor * uBrightness;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ==================== 瘜閖猐蝟餌� ====================

const magicCircleVertexShader = `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const magicCircleFragmentShader = `
precision highp float;

uniform sampler2D uTexture;
uniform float uOpacity;
uniform float uHueShift;      // �脩㮾�讐宏 0-360
uniform float uSaturationBoost; // 擖勗�摨血�撘?
uniform float uBrightness;    // 鈭桀漲
uniform float uPulse;         // �匧��?0-1
uniform float uHasTexture;    // �臬炏�㕑斐�?

// 皜𣂼��脣��?
uniform int uColorMode;       // 0=�閗𠧧, 1=�諹𠧧, 2=銝㕑𠧧, 3=瘛瑁𠧧
uniform float uBaseHue;       // �箇��脩㮾嚗���脫芋撘𧶏�
uniform float uBaseSaturation;// �箇�擖勗�摨佗��閗𠧧璅∪�嚗?
uniform vec3 uColor1;         // 憸𡏭𠧧1
uniform vec3 uColor2;         // 憸𡏭𠧧2
uniform vec3 uColor3;         // 憸𡏭𠧧3嚗���脫��条鍂嚗?
uniform float uColorMidPos;   // 銝剝𡢿�脖�蝵殷�銝㕑𠧧皜𣂼��剁�
uniform float uColorMidWidth; // 銝剝𡢿�脣捐摨佗��圈�餉�嚗𡁏遬�㛖�摨?��凒�拙�嚗?
uniform float uColorMidWidth2;// 銝剝𡢿�脣捐摨?嚗�唂�餉�嚗𡁶滲�脣蒂摰賢漲嚗?
uniform int uGradientDir;     // 皜𣂼��孵�: 0=敺��, 1=X頧? 2=Y頧? 3=�箸�
uniform float uSpiralDensity; // �箸�撖�漲
uniform float uProceduralIntensity; // 瘛瑁𠧧撘箏漲

varying vec2 vUv;

// RGB 頧?HSL
vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) / 2.0;
  
  if (maxC == minC) {
    return vec3(0.0, 0.0, l);
  }
  
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  
  if (maxC == c.r) {
    h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  } else if (maxC == c.g) {
    h = (c.b - c.r) / d + 2.0;
  } else {
    h = (c.r - c.g) / d + 4.0;
  }
  h /= 6.0;
  
  return vec3(h, s, l);
}

// HSL 頧?RGB
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  
  if (s == 0.0) {
    return vec3(l);
  }
  
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

// 霈∠�皜𣂼��惩�
float getGradientFactor() {
  vec2 centered = vUv - 0.5;
  
  if (uGradientDir == 0) {
    // 敺��嚗帋�銝剖��啗器蝻?
    return length(centered) * 2.0;
  } else if (uGradientDir == 1) {
    // X頧渡瑪�?
    return vUv.x;
  } else if (uGradientDir == 2) {
    // Y頧渡瑪�?
    return vUv.y;
  } else if (uGradientDir == 3) {
    // �箸�
    float angle = atan(centered.y, centered.x);
    float dist = length(centered);
    return fract((angle / 6.28318 + dist * uSpiralDensity) * 0.5 + 0.5);
  }
  return 0.0;
}

// 霈∠�皜𣂼�憸𡏭𠧧
vec3 getGradientColor(float t) {
  if (uColorMode == 1) {
    // �諹𠧧皜𣂼�
    return mix(uColor1, uColor2, t);
  } else if (uColorMode == 2) {
    // 銝㕑𠧧皜𣂼�嚗𡁜��嗆𣈲��舅蝘滚捐摨阡�餉�
    // midWidth: �圈�餉�嚗?-1�批��曇�蝔见漲嚗?1�拙���凒嚗?
    // midWidth2: �折�餉�嚗�滲�脣蒂摰賢漲嚗?
    float blendWeight = min(uColorMidWidth, 1.0);
    float rangeExpand = max(uColorMidWidth - 1.0, 0.0) * 0.2;
    
    // 霈∠�銝剝𡢿�脰��湛�蝏枏�銝斤�摰賢漲嚗?
    float bandHalf = uColorMidWidth2 * 0.5;
    float midStart = max(0.01, uColorMidPos - rangeExpand - bandHalf);
    float midEnd = min(0.99, uColorMidPos + rangeExpand + bandHalf);
    
    vec3 threeColorResult;
    if (t < midStart) {
      threeColorResult = mix(uColor1, uColor2, t / midStart);
    } else if (t > midEnd) {
      threeColorResult = mix(uColor2, uColor3, (t - midEnd) / (1.0 - midEnd));
    } else {
      threeColorResult = uColor2;
    }
    vec3 twoColorResult = mix(uColor1, uColor3, t);
    return mix(twoColorResult, threeColorResult, blendWeight);
  } else if (uColorMode == 3) {
    // 瘛瑁𠧧嚗��摨誩�嚗?
    vec2 centered = vUv - 0.5;
    float noise = sin(centered.x * 10.0 * uProceduralIntensity) * cos(centered.y * 10.0 * uProceduralIntensity);
    return mix(uColor1, uColor2, (noise + 1.0) * 0.5);
  }
  return vec3(1.0);
}

void main() {
  // 憒��瘝⊥�韐游㦛嚗𣬚凒�乩腺撘?
  if (uHasTexture < 0.5) {
    discard;
  }
  
  vec4 texColor = texture2D(uTexture, vUv);
  
  // 霈∠�鈭桀漲雿靝蛹�𤩺�摨血抅蝖�嚗���脰��航䌊�券�𤩺�嚗?
  float brightness = max(texColor.r, max(texColor.g, texColor.b));
  
  // �瑕�韐游㦛�?HSL
  vec3 hsl = rgb2hsl(texColor.rgb);
  vec3 shiftedColor;
  
  if (uColorMode == 0) {
    // �栞𠧧蝳�鍂嚗𡁜��刻𠧧�詨�蝘鳴�靽萘�韐游㦛鈭桀漲
    hsl.x = fract(hsl.x + uHueShift / 360.0);
    shiftedColor = hsl2rgb(hsl);
  } else if (uColorMode == 4) {
    // �閗𠧧�栞𠧧璅∪�嚗帋蝙�?baseHue/baseSaturation嚗䔶��躰斐�曆漁摨?
    vec3 singleHsl = vec3(uBaseHue / 360.0, uBaseSaturation, hsl.z);
    shiftedColor = hsl2rgb(singleHsl);
  } else {
    // 皜𣂼��栞𠧧璅∪�嚗���?銝㕑𠧧/瘛瑁𠧧嚗㚁�摨𠉛鍂皜𣂼��?
    float gradientT = getGradientFactor();
    vec3 gradientColor = getGradientColor(clamp(gradientT, 0.0, 1.0));
    shiftedColor = texColor.rgb * gradientColor;
  }
  
  // 摨𠉛鍂擖勗�摨血�撘?
  vec3 boostedColor = shiftedColor;
  if (uSaturationBoost != 1.0) {
    vec3 boostedHsl = rgb2hsl(shiftedColor);
    boostedHsl.y = clamp(boostedHsl.y * uSaturationBoost, 0.0, 1.0);
    boostedColor = hsl2rgb(boostedHsl);
  }
  
  // 摨𠉛鍂鈭桀漲�諹��?
  float pulseMultiplier = 1.0 + uPulse * 0.5;
  vec3 finalColor = boostedColor * uBrightness * pulseMultiplier;
  
  // 霈∠���蝏��𤩺�摨?
  float alpha = brightness * uOpacity;
  
  // 銝Ｗ��牐��𤩺����蝝?
  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== �賡�雿梶頂蝏?====================

// �賡�雿栞器蝻条��脣膥嚗�蝙�?Line2 �硋抅蝖�蝥踵辺嚗?
const energyBodyEdgeVertexShader = `
precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform vec3 uRotationAxis;
uniform float uBreathing;
uniform float uBreathingSpeed;
uniform float uNoiseAmplitude;
uniform float uNoiseFrequency;
uniform float uNoiseSpeed;
uniform float uSpherize;
uniform float uRadius;

attribute float edgeProgress;
attribute float edgeIndex;  // 颲寧揣撘𤏪��其�憭𡁜���恣蝞?

varying float vEdgeProgress;
varying vec3 vWorldPos;
varying vec3 vOriginalDir;  // �笔��孵�嚗�圾�血臁憯堆�
varying float vEdgeIndex;

// �贝蓮�拚猐
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

// 蝞��硋臁憯?
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  // 靽嘥��笔��蓥��孵�嚗�鍂鈭舘圾�血臁憯堆�
  vOriginalDir = normalize(position);
  vEdgeIndex = edgeIndex;
  
  // �澆𢙺���
  float breathScale = 1.0 + sin(uTime * uBreathingSpeed) * uBreathing;
  
  // �芸ㄟ�啣𢆡
  vec3 noiseOffset = vec3(0.0);
  if (uNoiseAmplitude > 0.0) {
    float n = hash(position + uTime * uNoiseSpeed) * 2.0 - 1.0;
    noiseOffset = normalize(position) * n * uNoiseAmplitude * uRadius;
  }
  
  // 摨𠉛鍂�䀹揢
  vec3 pos = position + noiseOffset;
  
  // ���憭��
  if (uSpherize > 0.0) {
    vec3 spherePos = normalize(pos) * uRadius;
    pos = mix(pos, spherePos, uSpherize);
  }
  
  pos *= breathScale;
  
  // �贝蓮
  float angle = uTime * uRotationSpeed;
  mat3 rotMat = rotationMatrix(uRotationAxis, angle);
  pos = rotMat * pos;
  
  vEdgeProgress = edgeProgress;
  vWorldPos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const energyBodyEdgeFragmentShader = `
precision highp float;

uniform vec3 uEdgeColor;
uniform vec3 uGradientEndColor;
uniform float uGradientEnabled;
uniform float uGlowIntensity;
uniform float uGlobalOpacity;
uniform float uTime;
uniform float uBlendMode;    // 0=additive, 1=normal

// �𡁶瑪
uniform float uDashEnabled;
uniform float uDashRatio;
uniform float uDashDensity;
uniform float uDashPhase;

// �㗇� - 憭𡁜��舀�
uniform float uLightFlowEnabled;
uniform vec3 uLightFlowColor;
uniform float uLightFlowLength;
uniform float uLightFlowIntensity;
uniform float uLightFlowCount;       // �匧��圈�
uniform float uLightFlowPhaseMode;   // 0=sync, 1=spread
uniform float uLightFlowBasePhase;   // �箇��訾�
uniform float uLightFlowPulseEnabled;
uniform float uLightFlowPulseSpeed;
uniform float uUsePathSystem;        // 1=雿輻鍂頝臬�蝟餌��唳旿
uniform vec2 uLightPackets[10];      // �匧��唳旿: x=edgeIndex, y=progress

// 颲孵鐤�豢��?
uniform float uEdgeBreathEnabled;
uniform float uEdgeBreathSpeed;
uniform float uEdgeBreathGlowAmp;
uniform float uEdgeBreathAlphaAmp;
uniform float uEdgeBreathNoiseMix;
uniform float uEdgeBreathNoiseScale;
uniform float uEdgeBreathNoiseSpeed;
uniform float uEdgeBreathNoiseFollow; // 0=�箏�(雿輻鍂�笔��鞉�), 1=頝罸��澆𢙺

varying float vEdgeProgress;
varying vec3 vWorldPos;
varying vec3 vOriginalDir;  // �笔��孵�嚗�圾�血臁憯堆�
varying float vEdgeIndex;

// Simplex 3D Noise (蝞��𣇉�)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
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
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

void main() {
  // �箇�憸𡏭𠧧嚗�▲�孵�颲嫣葉�寞��矋�
  float gradientT = abs(vEdgeProgress - 0.5) * 2.0; // 0=銝剔�, 1=憿嗥�
  vec3 baseColor = mix(uGradientEndColor, uEdgeColor, gradientT * uGradientEnabled + (1.0 - uGradientEnabled));
  
  // 颲孵鐤�豢��?
  float breathingMod = 1.0;
  float alphaMod = 1.0;
  if (uEdgeBreathEnabled > 0.5) {
    // �箇��澆𢙺嚗�迤撘行郭嚗?
    float breathPhase = sin(uTime * uEdgeBreathSpeed) * 0.5 + 0.5;
    // �芸ㄟ��甅�鞉�嚗帋蝙�典�憪𧢲䲮�烐�銝𣇉��鞉�
    vec3 noiseCoord = mix(vOriginalDir, vWorldPos, uEdgeBreathNoiseFollow);
    float noise = snoise(noiseCoord * uEdgeBreathNoiseScale + uTime * uEdgeBreathNoiseSpeed) * 0.5 + 0.5;
    // 瘛瑕��澆𢙺��臁憯?
    float combined = mix(breathPhase, noise, uEdgeBreathNoiseMix);
    // 摨𠉛鍂�啣��匧��𤩺�摨佗�撣阡湶�塚�
    breathingMod = clamp(1.0 + combined * uEdgeBreathGlowAmp, 0.5, 3.0);
    alphaMod = clamp(1.0 - combined * uEdgeBreathAlphaAmp, 0.2, 1.0);
  }
  
  // �𡁶瑪���
  float dashAlpha = 1.0;
  if (uDashEnabled > 0.5) {
    float dashPos = fract(vEdgeProgress * uDashDensity + uDashPhase);
    dashAlpha = step(dashPos, uDashRatio);
    if (dashAlpha < 0.5) discard;
  }
  
  // �㗇���� - �舀�憭𡁜��?
  float flowGlow = 0.0;
  if (uLightFlowEnabled > 0.5) {
    int packetCount = int(uLightFlowCount);
    
    if (uUsePathSystem > 0.5) {
      // 頝臬�蝟餌�璅∪�嚗帋蝙�函�摰𧼮���㺭�?
      for (int i = 0; i < 10; i++) {
        if (i >= packetCount) break;
        
        vec2 packet = uLightPackets[i];
        float packetEdge = packet.x;
        float packetProgress = packet.y;
        
        // 璉��亙���糓�血銁敶枏�颲嫣�
        if (abs(packetEdge - vEdgeIndex) < 0.5) {
          float flowDist = abs(vEdgeProgress - packetProgress);
          flowDist = min(flowDist, 1.0 - flowDist);
          float packetGlow = smoothstep(uLightFlowLength, 0.0, flowDist);
          
          // �匧����
          if (uLightFlowPulseEnabled > 0.5) {
            float pulse = 0.7 + 0.3 * sin(uTime * uLightFlowPulseSpeed + float(i) * 1.5);
            packetGlow *= pulse;
          }
          
          flowGlow += packetGlow;
        }
      }
    } else {
      // 隡删�璅∪�嚗𡁜抅鈭𡒊㮾雿滨�蝞��訫𢆡�?
      for (int i = 0; i < 10; i++) {
        if (i >= packetCount) break;
        
        // 霈∠�瘥譍葵�匧���㮾雿?
        float packetPhase;
        if (uLightFlowPhaseMode < 0.5) {
          // �𣬚㮾璅∪�嚗𡁏��匧����鈭怎㮾雿?
          packetPhase = uLightFlowBasePhase;
        } else {
          // �嗵㮾璅∪�嚗𡁜���������
          packetPhase = uLightFlowBasePhase + float(i) / float(packetCount);
        }
        
        float flowDist = abs(vEdgeProgress - fract(packetPhase));
        flowDist = min(flowDist, 1.0 - flowDist);
        float packetGlow = smoothstep(uLightFlowLength, 0.0, flowDist);
        
        // �匧����
        if (uLightFlowPulseEnabled > 0.5) {
          float pulse = 0.7 + 0.3 * sin(uTime * uLightFlowPulseSpeed + float(i) * 1.5);
          packetGlow *= pulse;
        }
        
        flowGlow += packetGlow;
      }
    }
    flowGlow *= uLightFlowIntensity;
  }
  
  // ��蝏���?
  vec3 finalColor = baseColor * uGlowIntensity * breathingMod + uLightFlowColor * flowGlow;
  float alpha;
  
  // 瘛瑕�璅∪��毺䰻
  if (uBlendMode < 0.5) {
    // Additive 璅∪�嚗𡁶鍂 alphaMod 蝻拇𦆮憸𡏭𠧧撘箏漲
    finalColor *= alphaMod;
    alpha = uGlobalOpacity;
  } else {
    // Normal 璅∪�嚗𡁶鍂 alphaMod 蝻拇𦆮�𤩺�摨?
    alpha = uGlobalOpacity * alphaMod;
  }
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// �賡�雿㯄▲�孵��寧��脣膥
const energyBodyVertexPointShader = `
precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform vec3 uRotationAxis;
uniform float uBreathing;
uniform float uBreathingSpeed;
uniform float uPointSize;
uniform float uSpherize;
uniform float uRadius;

// �𣈯��匧�
uniform float uDwellEnabled;
uniform float uDwellThreshold;
uniform float uDwellPulseIntensity;
uniform float uDwellPulseSpeed;

attribute float vertexDegree;  // 憿嗥�摨行㺭

varying float vDwellPulse;  // 隡𣳇�鍦��㰘��脣撩摨衣����

// �贝蓮�拚猐
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

void main() {
  // �澆𢙺���
  float breathScale = 1.0 + sin(uTime * uBreathingSpeed) * uBreathing;
  
  vec3 pos = position;
  
  // ���憭��
  if (uSpherize > 0.0) {
    vec3 spherePos = normalize(pos) * uRadius;
    pos = mix(pos, spherePos, uSpherize);
  }
  
  pos *= breathScale;
  
  // �贝蓮
  float angle = uTime * uRotationSpeed;
  mat3 rotMat = rotationMatrix(uRotationAxis, angle);
  pos = rotMat * pos;
  
  // 霈∠��𣈯��匧�嚗��摨行㺭憿嗥��芰�嚗?
  vDwellPulse = 0.0;
  if (uDwellEnabled > 0.5 && vertexDegree >= uDwellThreshold) {
    // �箔�憿嗥�摨行㺭����莎�摨行㺭頞𢠃��匧�頞𠰴撩
    float degreeBoost = (vertexDegree - uDwellThreshold + 1.0) * 0.3;
    float pulse = sin(uTime * uDwellPulseSpeed + vertexDegree * 0.7) * 0.5 + 0.5;
    vDwellPulse = pulse * uDwellPulseIntensity * degreeBoost;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  
  // �𣈯�憿嗥�撠箏站�曉之
  float sizeMultiplier = 1.0 + vDwellPulse * 0.5;
  gl_PointSize = uPointSize * sizeMultiplier * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const energyBodyVertexPointFragmentShader = `
precision highp float;

uniform vec3 uVertexColor;
uniform float uGlowIntensity;
uniform float uGlobalOpacity;
uniform int uVertexShape; // 0=circle, 1=diamond, 2=star

varying float vDwellPulse;  // �𣈯��匧�撘箏漲

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  
  float alpha = 0.0;
  
  if (uVertexShape == 0) {
    // Circle
    alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  } else if (uVertexShape == 1) {
    // Diamond
    float d = abs(uv.x) + abs(uv.y);
    alpha = 1.0 - smoothstep(0.3, 0.5, d);
  } else {
    // Star
    float angle = atan(uv.y, uv.x);
    float star = 0.3 + 0.2 * cos(angle * 4.0);
    alpha = 1.0 - smoothstep(star * 0.8, star, dist);
  }
  
  if (alpha < 0.01) discard;
  
  // 摨𠉛鍂�𣈯��匧��圈��脣��𤩺�摨?
  float pulseBoost = 1.0 + vDwellPulse;
  vec3 finalColor = uVertexColor * uGlowIntensity * pulseBoost;
  float finalAlpha = alpha * uGlobalOpacity * min(pulseBoost, 1.5);
  
  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// �賡�雿栞�憯喟��脣膥
const energyBodyShellVertexShader = `
precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform vec3 uRotationAxis;
uniform float uBreathing;
uniform float uBreathingSpeed;
uniform float uSpherize;
uniform float uRadius;

varying vec3 vNormal;
varying vec3 vViewPosition;

// �贝蓮�拚猐
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

void main() {
  float breathScale = 1.0 + sin(uTime * uBreathingSpeed) * uBreathing;
  
  vec3 pos = position;
  vec3 norm = normal;
  
  // ���憭��
  if (uSpherize > 0.0) {
    vec3 spherePos = normalize(pos) * uRadius;
    pos = mix(pos, spherePos, uSpherize);
    norm = mix(norm, normalize(pos), uSpherize);
  }
  
  pos *= breathScale;
  
  // �贝蓮
  float angle = uTime * uRotationSpeed;
  mat3 rotMat = rotationMatrix(uRotationAxis, angle);
  pos = rotMat * pos;
  norm = rotMat * norm;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalMatrix * norm;
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const energyBodyShellFragmentShader = `
precision highp float;

uniform vec3 uShellColor;
uniform float uOpacity;
uniform float uFresnelPower;
uniform float uFresnelIntensity;
uniform float uGlobalOpacity;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);
  
  // �脫�撠娍��頣�颲寧��港漁
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), uFresnelPower);
  fresnel *= uFresnelIntensity;
  
  vec3 finalColor = uShellColor * (1.0 + fresnel);
  float alpha = uOpacity * (0.2 + fresnel * 0.8) * uGlobalOpacity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== �擧�������脣膥 ====================

// �脣榆������脣膥
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.01 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;
    
    void main() {
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);
      
      // �脣榆�讐宏�誯�頝萘氖銝剖�憓𧼮�
      vec2 offset = dir * uIntensity * dist;
      
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

// �𡑒�������脣膥
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.5 },
    uRadius: { value: 0.8 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uRadius;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      vec2 center = vec2(0.5);
      float dist = distance(vUv, center);
      
      // �𡑒�皜𣂼�
      float vignette = smoothstep(uRadius, uRadius - 0.3, dist);
      vignette = mix(1.0 - uIntensity, 1.0, vignette);
      
      gl_FragColor = vec4(color.rgb * vignette, color.a);
    }
  `
};

// ==================== ��𢒰 Voronoi ���脣膥 ====================

const sphericalVoronoiVertexShader = `
precision highp float;

uniform float uTime;
uniform float uRotationSpeed;
uniform vec3 uRotationAxis;

varying vec3 vPosition;      // �蓥��孵��煾�嚗�鍂鈭?Voronoi 霈∠�嚗?
varying vec3 vWorldPosition; // 銝𣇉��鞉�嚗�鍂鈭舘蟮瘨��嚗?
varying vec3 vNormal;

// �贝蓮�拚猐
mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

void main() {
  float angle = uTime * uRotationSpeed;
  mat3 rotMat = rotationMatrix(uRotationAxis, angle);
  
  vec3 pos = rotMat * position;
  vPosition = normalize(pos);    // �蓥��煾��其� Voronoi
  vWorldPosition = pos;          // 摰鮋��鞉��其��脫�撠?
  vNormal = rotMat * normal;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const sphericalVoronoiFragmentShader = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float uTime;
uniform vec3 uSeeds[64];
uniform int uSeedCount;
uniform vec3 uLineColor;
uniform float uLineWidth;      // �啣銁�臬�蝝惩�雿?
uniform float uLineGlow;
uniform float uFillOpacity;
uniform float uBaseHue;
uniform float uHueSpread;
uniform int uColorMode;     // 0=gradient, 1=random, 2=uniform
uniform float uCellPulse;
uniform float uCellPulseSpeed;
uniform float uGlobalOpacity;

varying vec3 vPosition;      // �蓥��孵��煾�
varying vec3 vWorldPosition; // 銝𣇉��鞉�
varying vec3 vNormal;

// 隡芷��箏遆�?
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

// HSV 頧?RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 pos = normalize(vPosition);
  
  float minDist = 999.0;
  float secondDist = 999.0;
  int nearestSeed = 0;
  
  // �暹�餈穃�甈∟����摮鞟�嚗���吔�雿輻鍂�寧妖隞�𤜯 acos嚗峕凒敹恬�
  for (int i = 0; i < 64; i++) {
    if (i >= uSeedCount) break;
    // 雿輻鍂 1 - dot 雿靝蛹頝萘氖摨阡�嚗屸��?acos
    float d = 1.0 - dot(pos, uSeeds[i]);
    if (d < minDist) {
      secondDist = minDist;
      minDist = d;
      nearestSeed = i;
    } else if (d < secondDist) {
      secondDist = d;
    }
  }
  
  // 颲寧�璉�瘚?- 雿輻鍂撅誩�蝛粹𡢿撖潭㺭摰䂿緵�鍦��讐�摰賢漲
  float edgeDist = secondDist - minDist;
  
  // 霈∠�撅誩�蝛粹𡢿撖潭㺭
  float edgeDistDx = dFdx(edgeDist);
  float edgeDistDy = dFdy(edgeDist);
  float edgeDistGrad = sqrt(edgeDistDx * edgeDistDx + edgeDistDy * edgeDistDy);
  
  // 撠�器�諹�蝳餉蓮�Ｖ蛹�讐��蓥�
  float edgeDistPixels = edgeDist / max(edgeDistGrad, 0.0001);
  
  // 雿輻鍂�讐��蓥���瑪摰?
  float halfWidth = uLineWidth * 0.5;
  float edge = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, edgeDistPixels);
  
  // �訫�憸𡏭𠧧
  vec3 cellColor;
  float seedIndex = float(nearestSeed);
  if (uColorMode == 0) {
    // 皜𣂼�璅∪�
    float hue = uBaseHue / 360.0 + seedIndex / float(uSeedCount) * uHueSpread;
    cellColor = hsv2rgb(vec3(fract(hue), 0.7, 0.9));
  } else if (uColorMode == 1) {
    // �𤩺㦤璅∪�
    float hue = hash(seedIndex * 12.9898);
    cellColor = hsv2rgb(vec3(hue, 0.6 + hash(seedIndex * 7.233) * 0.3, 0.8 + hash(seedIndex * 3.14) * 0.2));
  } else {
    // 蝏煺�璅∪�
    cellColor = hsv2rgb(vec3(uBaseHue / 360.0, 0.7, 0.9));
  }
  
  // �訫��匧�
  if (uCellPulse > 0.0) {
    float pulse = sin(uTime * uCellPulseSpeed + seedIndex * 0.5) * 0.5 + 0.5;
    cellColor *= 1.0 + pulse * uCellPulse * 0.3;
  }
  
  // �脫�撠娍��𨅯�撘箄器蝻?
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.0);
  
  // 瘛瑕�颲寧���‵�?
  vec3 lineColorFinal = uLineColor * (1.0 + fresnel * uLineGlow);
  vec3 finalColor = mix(cellColor * uFillOpacity, lineColorFinal, edge);
  float alpha = mix(uFillOpacity, 1.0, edge) * uGlobalOpacity;
  
  // 颲寧��穃�
  if (edge > 0.1) {
    finalColor += lineColorFinal * edge * uLineGlow * 0.5;
  }
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== 瘚�𨫡蝟餌� ====================

// 瘚�𨫡憭湧����脣膥嚗𠄎prite 憌擧聢嚗��蝏�𢒰�𤑳㮾�綽�
// �餃��曉之 4 �㵪�銝箏��訫��蠘��𣂷�頞喳���辣隡貊征�?
const CANVAS_SCALE = 4.0;

const fireflyHeadVertexShader = `
precision highp float;

uniform float uSize;
uniform float uTime;
uniform float uPulse;
uniform float uPulseSpeed;
uniform float uVelocityStretch;  // �笔漲�劐撓撘箏漲
uniform vec3 uVelocity;          // �笔漲�煾�嚗���曄征�湛�

varying float vPulse;
varying vec2 vStretchDir;        // �劐撓�孵�

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float pulse = 1.0 + uPulse * 0.3 * sin(uTime * uPulseSpeed);
  vPulse = pulse;
  
  // 霈∠��笔漲�典�撟閧征�渡��訫蔣�孵�
  vec3 viewVel = mat3(modelViewMatrix) * uVelocity;
  float speed = length(viewVel.xy);
  vStretchDir = speed > 0.001 ? normalize(viewVel.xy) : vec2(0.0, 1.0);
  
  // 笔漲劐撓嚗𡁏覔桅笔漲憓𧼮之寧撠箏站
  float stretchFactor = 1.0 + uVelocityStretch * min(speed * 2.0, 1.5);
  
  // 餃曉之 4 㵪銝箏訫蠘坔枂蝛粹𡢿
  float rawSize = uSize * pulse * stretchFactor * (300.0 / -mvPosition.z) * 4.0;
  // 限制最大点大小，避免超出 GPU 支持范围 (提升上限至 512.0)
  gl_PointSize = min(rawSize, 512.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fireflyHeadFragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uHeadStyle;           // 0=plain, 1=flare, 2=spark, 3=texture, 4-15=星云粒子形状
uniform float uFlareIntensity;    // 星芒强度 0-2
uniform float uFlareSeed;         // 随机种子
uniform float uFlareLeaves;       // 星芒叶片数 4-8
uniform float uFlareWidth;        // 星芒宽度 0.1-1
uniform float uChromaticAberration; // 色散强度 0-1
uniform float uVelocityStretch;   // 速度拉伸强度
uniform float uNoiseAmount;       // 噪声量 0-1
uniform float uGlowIntensity;     // 光晕强度 0-2
uniform float uTime;
uniform sampler2D uTexture;       // 贴图纹理
uniform float uUseTexture;        // 是否使用贴图 (0 或 1)
uniform float uColorMode;         // 颜色模式: 0=solid, 1=texture, 2=tint
uniform sampler2D uShapeTexture;  // 星云粒子形状纹理图集

varying float vPulse;
varying vec2 vStretchDir;

// 辅助函数
const float CONTENT_SCALE = 4.0;
const float CANVAS_EDGE = 2.0;
const float PI = 3.14159265359;

vec2 rotate2D(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// 伪随机
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

// N叶星芒形状
float nLeafFlare(vec2 uv, float n, float width, float intensity) {
  float angle = atan(uv.y, uv.x);
  float dist = length(uv);
  float r = cos(angle * n) * 0.5 + 0.5;
  r = pow(r, 1.0 / width); // 锐化
  float flare = r * (0.1 / (dist + 0.001)) * intensity;
  return flare * smoothstep(CANVAS_EDGE, 0.0, dist); // 边缘淡出
}

void main() {
  int style = int(uHeadStyle + 0.5);

  // 坐标中心化
  vec2 uv = (gl_PointCoord - 0.5) * CONTENT_SCALE;
  
  // 速度拉伸效果
  if (uVelocityStretch > 0.01) {
    float stretchAmount = 1.0 + uVelocityStretch * 0.5;
    vec2 perpDir = vec2(-vStretchDir.y, vStretchDir.x);
    float alongStretch = dot(uv, vStretchDir);
    float perpStretch = dot(uv, perpDir);
    uv = vStretchDir * alongStretch / stretchAmount + perpDir * perpStretch * stretchAmount;
  }
  
  float dist = length(uv);
  
  // 噪声
  float noiseVal = 1.0;
  if (uNoiseAmount > 0.01) {
    noiseVal = 1.0 + (noise(uv * 3.0 + uTime * 0.5) - 0.5) * uNoiseAmount * 0.5;
  }
  
  float alpha = 0.0;
  vec3 finalColor = uColor;
  
  // ========== 样式 0: plain (圆点) ==========
  if (style == 0) {
    float core = 1.0 - smoothstep(0.2, 0.6, dist);
    float brightCore = exp(-dist * dist * 25.0) * 1.2;
    core = max(core, brightCore) * noiseVal;
    
    // 光晕
    float glow = 0.0;
    if (uGlowIntensity > 0.01) {
      float glowEdge = 0.8 + uGlowIntensity * 0.4;
      glow = (1.0 - smoothstep(0.2, glowEdge, dist)) * uGlowIntensity * 0.5;
    }
    
    alpha = core + glow;
  }
  
  // ========== 样式 1: flare (星芒) ==========
  else if (style == 1) {
    float flare = nLeafFlare(uv, uFlareLeaves, uFlareWidth, uFlareIntensity);
    float core = exp(-dist * dist * 10.0) * 2.0; // 核心亮度
    
    // 随机旋转
    if (uFlareSeed > 0.0) {
      // 可以在这里加随机旋转，当前略过
    }
    
    // 色散效果
    if (uChromaticAberration > 0.01) {
      float r = nLeafFlare(uv * (1.0 - uChromaticAberration * 0.05), uFlareLeaves, uFlareWidth, uFlareIntensity);
      float b = nLeafFlare(uv * (1.0 + uChromaticAberration * 0.05), uFlareLeaves, uFlareWidth, uFlareIntensity);
      finalColor = vec3(r * uColor.r, flare * uColor.g, b * uColor.b);
      alpha = max(r, max(flare, b)) * noiseVal + core;
    } else {
      alpha = (flare + core) * noiseVal;
    }
    
    // 随时间脉动
    alpha *= (0.8 + 0.2 * sin(uTime * 3.0));
  }
  
  // ========== 样式 2: spark (火花) ==========
  else if (style == 2) {
    // 尖锐的十字星或火花
    float d = length(uv);
    float spark = 0.05 / (abs(uv.x * uv.y) + 0.001); // 双曲线形十字
    spark = min(spark, 2.0); // 限制最大亮度
    
    float hardCore = 1.0 - smoothstep(0.1, 0.3, d);
    float edgeFade = 1.0 - smoothstep(CANVAS_EDGE - 0.3, CANVAS_EDGE, dist);
    spark *= edgeFade;
    
    // 闪烁
    float flicker = 0.8 + 0.2 * sin(uTime * 10.0 + uFlareSeed * 100.0);
    spark *= flicker;
    
    alpha = hardCore + spark * noiseVal;
    
    // 颜色增强
    finalColor = uColor * 1.3 + vec3(0.4, 0.25, 0.0) * spark;
  }
  
  // ========== 样式 3: texture (贴图) ==========
  else if (style == 3) {
    // 检查是否有贴图
    if (uUseTexture > 0.5) {
      // 使用 gl_PointCoord，中心化到 [-0.5, 0.5] 范围
      vec2 texUV = gl_PointCoord - 0.5;
      
      // 根据速度方向旋转贴图坐标
      // 目标：贴图的"下方"(默认 +Y 方向) 应指向速度反方向 (拖尾方向)
      // vStretchDir 是速度方向，我们需要旋转使得 (0, -1) 对齐到 -vStretchDir
      if (uVelocityStretch > 0.01 && length(vStretchDir) > 0.01) {
        // 计算旋转角度：从默认向上 (0,1) 到速度方向
        float targetAngle = atan(vStretchDir.x, vStretchDir.y);
        texUV = rotate2D(texUV, -targetAngle);
      }
      
      // 转回 [0, 1] 范围
      texUV = texUV + 0.5;
      
      // 采样贴图
      vec4 texColor = texture2D(uTexture, texUV);
      
      // 提取亮度
      float texBrightness = max(texColor.r, max(texColor.g, texColor.b));
      
      // Alpha
      float texAlpha = texColor.a > 0.01 ? texColor.a : 1.0;
      alpha = texBrightness * texAlpha * noiseVal * 1.5;
      
      // 颜色混合根据 colorMode
      // 0=solid: 纯色（忽略贴图颜色）
      // 1=texture: 贴图原色
      // 2=tint: 贴图颜色 × 配置颜色
      if (uColorMode < 0.5) {
        // solid: 纯色
        finalColor = uColor * (0.8 + texBrightness * 0.5);
      } else if (uColorMode < 1.5) {
        // texture: 使用贴图原色
        finalColor = texColor.rgb * 1.2;
      } else {
        // tint: 贴图颜色 × 配置颜色（旧行为）
        finalColor = texColor.rgb * uColor * 1.5;
      }
    } else {
      // 无贴图退化为光点
      float core = 1.0 - smoothstep(0.2, 0.6, dist);
      float brightCore = exp(-dist * dist * 25.0) * 1.2;
      alpha = max(core, brightCore) * noiseVal;
    }
    
    // 加额外光晕效果
    if (uGlowIntensity > 0.01) {
      float glow = exp(-dist * dist * 2.0) * uGlowIntensity * 0.3;
      alpha += glow;
    }
  }
  
  // ========== 样式 4-15: 星云粒子形状（使用纹理图集）==========
  else if (style >= 4 && style <= 15) {
    // 纹理图集布局: 4列 x 4行 = 16种形状
    // 形状索引: 0=Circle, 1=Star, 2=Snowflake ...
    // uHeadStyle 4 -> 1 (Star)
    int texIdx = style - 3; 
    
    float col = mod(float(texIdx), 4.0);
    float row = floor(float(texIdx) / 4.0);
    
    // 计算在图集中的UV坐标
    vec2 atlasUV = vec2(
      (col + gl_PointCoord.x) / 4.0,
      (row + gl_PointCoord.y) / 4.0
    );
    
    // 从纹理采样
    vec4 texColor = texture2D(uShapeTexture, atlasUV);
    alpha = texColor.a * noiseVal;
    
    // 如果alpha太低则使用软边缘衰减
    if (alpha < 0.3) {
      alpha *= smoothstep(0.0, 0.3, alpha);
    }
    
    // 添加光晕效果
    if (uGlowIntensity > 0.01) {
      float glow = exp(-dist * dist * 2.0) * uGlowIntensity * 0.5;
      alpha = max(alpha, glow);
    }
    
    finalColor = uColor;
  }
  
  // ===== 边缘裁剪 =====
  if (style < 3 && dist > CANVAS_EDGE && alpha < 0.01) discard;
  if (style >= 4 && style <= 15 && alpha < 0.01) discard;
  
  // HDR 增强
  float brightness = 1.0 + alpha * 0.8;
  
  alpha = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(finalColor * brightness, alpha);
}
`;

const fireflyTailVertexShader = `
precision highp float;

attribute float aTaper;

uniform float uSize;
uniform float uBrightness;

varying float vTaper;

void main() {
  vTaper = aTaper;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  
  // �孵之撠誯� taper 銵啣�
  gl_PointSize = uSize * uBrightness * aTaper * (300.0 / -mvPosition.z) * 4.0;
  gl_PointSize = min(gl_PointSize, 32.0);  // 摨𠉛鍂蝖砌辣�𣂼�
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fireflyTailFragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uOpacity;

varying float vTaper;

void main() {
  // 撠?gl_PointCoord 頧祆揢銝箔葉敹���?
  vec2 uv = gl_PointCoord - 0.5;  // [-0.5, 0.5]
  float dist = length(uv) * 2.0;  // 頧祆揢�?[0, 1]
  
  // �𥪜����敶Ｙ�摮琜�颲寧�摰���𤩺�
  float alpha = smoothstep(1.0, 0.3, dist);  // 颲寧�撟單��𤩺�
  alpha *= exp(-dist * dist * 1.5);  // 銝剖�擃䀹鱻憓𧼮撩
  alpha *= vTaper * uOpacity;
  
  // 頧餃凝��葉敹���?
  float glow = exp(-dist * dist * 3.0) * 0.4;
  
  vec3 finalColor = uColor * (1.0 + glow);
  
  // 銝交聢鋆��颲寧�嚗屸��齿迤�孵耦
  if (dist > 1.0) discard;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// 瘜閖猐餈鞱��嗆㺭�格𦻖�?
interface MagicCircleRuntimeData {
  id: string;
  mesh: THREE.Mesh;
  settings: import('../types').MagicCircleSettings;
}

// 瘚�𨫡餈鞱��嗆㺭�格𦻖�?
interface FireflyRuntimeData {
  id: string;
  type: 'orbiting' | 'wandering';
  group: THREE.Group;
  headMesh: THREE.Points;
  tailMesh: THREE.Points | null;
  history: THREE.Vector3[];
  // 皜貉粥瘚�𨫡銝梶鍂
  direction?: THREE.Vector3;
  position?: THREE.Vector3;
}

// �賡�雿栞�銵峕𧒄�唳旿�亙藁
interface EnergyBodyRuntimeData {
  id: string;
  group: THREE.Group;
  edgesMesh: THREE.LineSegments | null;
  verticesMesh: THREE.Points | null;
  shellMesh: THREE.Mesh | null;
  voronoiMesh: THREE.Mesh | null;       // ��𢒰 Voronoi 蝵烐聢
  voronoiSeeds: THREE.Vector3[];        // Voronoi 蝘滚��?
  vertexDegrees: Float32Array;          // 瘥譍葵憿嗥���漲�堆��其��𣈯��匧�嚗?
  graph: Graph | null;                  // 颲寥��亙㦛嚗�鍂鈭舘楝敺�頂蝏��
  lightPackets: LightPacket[];          // �匧��嗆�?
  edgeLightData: Float32Array | null;   // 瘥𤩺辺颲寧��匧��唳旿嚗��蝏嗵��脣膥嚗?
  settings: EnergyBodySettings;
}

// ���瘚�𨫡憭湧�蝥寧�嚗㇃anvas 蝏睃�嚗?
let fireflyTextureCache: THREE.Texture | null = null;
function getFireflyTexture(): THREE.Texture {
  if (fireflyTextureCache) return fireflyTextureCache;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 敺��皜𣂼�
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  fireflyTextureCache = new THREE.CanvasTexture(canvas);
  return fireflyTextureCache;
}

// ==================== 颲�𨭌�賣㺭 ====================

// 暺��瘥𥪯�撣賊�
const PHI = (1 + Math.sqrt(5)) / 2;  // �?1.618
const INV_PHI = 1 / PHI;              // �?0.618
const PHI_SQ = PHI * PHI;             // �?2.618

// ===== �芸�蝡𧢲䲮雿?(Cuboctahedron) - 12憿嗥� =====
// ����鞉�嚗?簣1, 簣1, 0), (簣1, 0, 簣1), (0, 簣1, 簣1) ����?
const CUBOCTAHEDRON_VERTICES = [
  1, 1, 0, 1, -1, 0, -1, 1, 0, -1, -1, 0,
  1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0, -1,
  0, 1, 1, 0, 1, -1, 0, -1, 1, 0, -1, -1
];
const CUBOCTAHEDRON_INDICES = [
  // 8銝芯�閫鍦耦嚗��蝡𧢲䲮雿梶�8銝芷▲�孵笆摨䈑�
  0, 4, 8, 0, 9, 5, 1, 5, 11, 1, 10, 4,
  2, 8, 6, 2, 7, 9, 3, 6, 10, 3, 11, 7,
  // 6銝芣迤�孵耦嚗��蝡𧢲䲮雿梶�6銝芷𢒰銝剖�嚗? ���銝㕑�敶?
  0, 8, 2, 0, 2, 9, 1, 11, 3, 1, 3, 10,
  4, 10, 6, 4, 6, 8, 5, 9, 7, 5, 7, 11,
  0, 5, 1, 0, 1, 4, 2, 6, 3, 2, 3, 7
];

// ===== �芾��偦𢒰雿?(Truncated Tetrahedron) - 12憿嗥�嚗?銝㕑�+4�剛器 =====
// ����鞉�嚗𡁏��?(簣3, 簣1, 簣1) ����鍦�嚗�����蝘舐泵�瑚��湛�
// 憿嗥�撣��嚗𡁏�銝芸��偦𢒰雿㯄▲�孵�敶Ｘ�銝�銝芯�閫鍦耦
const TRUNCATED_TETRAHEDRON_VERTICES = [
  // 銝㕑�敶? (�罸▲�?++�孵�): 憿嗥� 0,1,2
  3, 1, 1, 1, 3, 1, 1, 1, 3,
  // 銝㕑�敶? (�罸▲�?--�孵�): 憿嗥� 3,4,5
  3, -1, -1, 1, -3, -1, 1, -1, -3,
  // 銝㕑�敶? (�罸▲�?+-�孵�): 憿嗥� 6,7,8
  -3, 1, -1, -1, 3, -1, -1, 1, -3,
  // 銝㕑�敶? (�罸▲�?-+�孵�): 憿嗥� 9,10,11
  -3, -1, 1, -1, -3, 1, -1, -1, 3
];
// 蝝Ｗ�嚗?銝㕑� + 4�剛器(瘥譍葵4銝㕑�) = 4 + 16 = 20銝㕑� = 60蝝Ｗ�
// 颲寥鵭 = 2�?嚗��蝏���賊��𤥁楊蝏�㮾�鳴�
// 颲寡��亙�蝟鳴�0-3, 1-7, 2-11, 3-0, 4-10, 5-8, 6-9, 7-1, 8-5, 9-6, 10-4, 11-2
const TRUNCATED_TETRAHEDRON_INDICES = [
  // 4銝芯�閫鍦耦嚗��蝥踵�憭吔���𧒄���
  0, 1, 2,     // 銝㕑�敶?: 瘜閧瑪�?+,+,+)
  3, 5, 4,     // 銝㕑�敶?: 瘜閧瑪�?+,-,-)嚗䔶耨甇��摨?
  6, 7, 8,     // 銝㕑�敶?: 瘜閧瑪�?-,+,-)
  9, 10, 11,   // 銝㕑�敶?: 瘜閧瑪�?-,-,+)
  // 4銝芸�颲孵耦嚗���偦𢒰雿梶�4銝芷𢒰嚗峕�銝芣�敶Ｖ�閫鍦�=4銝㕑�嚗?
  // �剛器敶∕ (銝㕑�敶?,1,2�曹澈): 憿嗥� 0,1,7,8,5,3 �㕑器�屸◇摨?
  0, 1, 7, 0, 7, 8, 0, 8, 5, 0, 5, 3,
  // �剛器敶﹨ (銝㕑�敶?,1,3�曹澈): 憿嗥� 0,3,4,10,11,2 �㕑器�屸◇摨?
  0, 3, 4, 0, 4, 10, 0, 10, 11, 0, 11, 2,
  // �剛器敶＄ (銝㕑�敶?,2,3�曹澈): 憿嗥� 1,2,11,9,6,7 �㕑器�屸◇摨?
  1, 2, 11, 1, 11, 9, 1, 9, 6, 1, 6, 7,
  // �剛器敶￥ (銝㕑�敶?,2,3�曹澈): 憿嗥� 4,5,8,6,9,10 �㕑器�屸◇摨?
  4, 5, 8, 4, 8, 6, 4, 6, 9, 4, 9, 10
];

// ===== �芾��恍𢒰雿?(Truncated Octahedron) - 24憿嗥�嚗?甇�䲮+8�剛器 =====
// ����鞉�嚗𡁏��?(0, 簣1, 簣2) ����梹�颲寥鵭 = �?
// 憿嗥�蝝Ｗ�嚗𡁏��鞉�璅∪����
const TRUNCATED_OCTAHEDRON_VERTICES = [
  // 0-3: (0, 簣1, 簣2)
  0, 1, 2, 0, 1, -2, 0, -1, 2, 0, -1, -2,
  // 4-7: (0, 簣2, 簣1)
  0, 2, 1, 0, 2, -1, 0, -2, 1, 0, -2, -1,
  // 8-11: (簣1, 0, 簣2)
  1, 0, 2, 1, 0, -2, -1, 0, 2, -1, 0, -2,
  // 12-15: (簣1, 簣2, 0)
  1, 2, 0, 1, -2, 0, -1, 2, 0, -1, -2, 0,
  // 16-19: (簣2, 0, 簣1)
  2, 0, 1, 2, 0, -1, -2, 0, 1, -2, 0, -1,
  // 20-23: (簣2, 簣1, 0)
  2, 1, 0, 2, -1, 0, -2, 1, 0, -2, -1, 0
];
// 蝝Ｗ�嚗?甇�䲮(2銝㕑��6=12) + 8�剛器(4銝㕑��8=32) = 44銝㕑� = 132蝝Ｗ�
// �剛器敶Ｘ��笔��Ｖ��Ｘ�蝥踵䲮�穃�蝏��(x+y+z=3), (x+y-z=3), (x-y+z=3), (x-y-z=3) 蝑?
const TRUNCATED_OCTAHEDRON_INDICES = [
  // 6銝芣迤�孵耦嚗���恍𢒰雿梶�6銝芷▲�孵�嚗峕�銝?銝㕑�嚗��鈭怠笆閫垍瑪嚗峕�蝥踵�憭吔�
  // +x 甇�䲮敶?(x=2): 憿嗥�16,17,20,21 颲寧�16->21->17->20 撖寡�蝥?0-21
  16, 21, 20, 21, 17, 20,
  // -x 甇�䲮敶?(x=-2): 憿嗥�18,19,22,23 颲寧�18->22->19->23 撖寡�蝥?2-23
  18, 22, 23, 22, 19, 23,
  // +y 甇�䲮敶?(y=2): 憿嗥�4,5,12,14 颲寧�4->12->5->14 撖寡�蝥?2-14
  4, 14, 12, 14, 5, 12,
  // -y 甇�䲮敶?(y=-2): 憿嗥�6,7,13,15 颲寧�6->15->7->13 撖寡�蝥?3-15
  6, 13, 15, 13, 7, 15,
  // +z 甇�䲮敶?(z=2): 憿嗥�0,2,8,10 颲寧�0->10->2->8 撖寡�蝥?-10
  0, 10, 8, 10, 2, 8,
  // -z 甇�䲮敶?(z=-2): 憿嗥�1,3,9,11 颲寧�1->9->3->11 撖寡�蝥?-11
  1, 9, 11, 9, 3, 11,
  // 8銝芸�颲孵耦嚗���恍𢒰雿梶�8銝芷𢒰嚗峕�銝?銝㕑�嚗?
  // �剛器敶? (+++): x+y+z=3 -> 0,4,8,12,16,20 憿箏�: 0->4->12->20->16->8
  0, 4, 12, 0, 12, 20, 0, 20, 16, 0, 16, 8,
  // �剛器敶? (++-): x+y-z=3 -> 1,5,9,12,17,20 憿箏�: 1->5->12->20->17->9
  1, 5, 12, 1, 12, 20, 1, 20, 17, 1, 17, 9,
  // �剛器敶? (+-+): x-y+z=3 -> 2,6,8,13,16,21 憿箏�: 2->8->16->21->13->6
  2, 8, 16, 2, 16, 21, 2, 21, 13, 2, 13, 6,
  // �剛器敶? (+--): x-y-z=3 -> 3,7,9,13,17,21 憿箏�: 3->9->17->21->13->7
  3, 9, 17, 3, 17, 21, 3, 21, 13, 3, 13, 7,
  // �剛器敶? (-++): -x+y+z=3 -> 0,4,10,14,18,22 憿箏�: 0->10->18->22->14->4
  0, 10, 18, 0, 18, 22, 0, 22, 14, 0, 14, 4,
  // �剛器敶? (-+-): -x+y-z=3 -> 1,5,11,14,19,22 憿箏�: 1->11->19->22->14->5
  1, 11, 19, 1, 19, 22, 1, 22, 14, 1, 14, 5,
  // �剛器敶? (--+): -x-y+z=3 -> 2,6,10,15,18,23 憿箏�: 2->10->18->23->15->6
  2, 10, 18, 2, 18, 23, 2, 23, 15, 2, 15, 6,
  // �剛器敶? (---): -x-y-z=3 -> 3,7,11,15,19,23 憿箏�: 3->11->19->23->15->7
  3, 11, 19, 3, 19, 23, 3, 23, 15, 3, 15, 7
];

// ===== �芾�蝡𧢲䲮雿?(Truncated Cube) - 24憿嗥�嚗?銝㕑�敶?6�怨器敶?=====
// ����鞉�嚗𡁏��?(簣徆, 簣1, 簣1) ����梹�徆 = �? - 1 �?0.414
const XI = Math.SQRT2 - 1;
// 憿嗥��匧𤐄摰𡁻◇摨𤩺��梹�靘蹂��见�蝝Ｗ�嚗?
const TRUNCATED_CUBE_VERTICES = [
  // 0-7: (簣徆, 簣1, 簣1) - 8銝?
  XI, 1, 1, XI, 1, -1, XI, -1, 1, XI, -1, -1,
  -XI, 1, 1, -XI, 1, -1, -XI, -1, 1, -XI, -1, -1,
  // 8-15: (簣1, 簣徆, 簣1) - 8銝?
  1, XI, 1, 1, XI, -1, 1, -XI, 1, 1, -XI, -1,
  -1, XI, 1, -1, XI, -1, -1, -XI, 1, -1, -XI, -1,
  // 16-23: (簣1, 簣1, 簣徆) - 8銝?
  1, 1, XI, 1, 1, -XI, 1, -1, XI, 1, -1, -XI,
  -1, 1, XI, -1, 1, -XI, -1, -1, XI, -1, -1, -XI
];
// �见�摰峕㟲蝝Ｗ�嚗?銝㕑� + 6�怨器嚗���怨器=6銝㕑�嚗? 8 + 36 = 44銝㕑� = 132蝝Ｗ�
// 憿嗥�蝝Ｗ����?
// 0-7: (簣徆,簣1,簣1): 0(+,+,+) 1(+,+,-) 2(+,-,+) 3(+,-,-) 4(-,+,+) 5(-,+,-) 6(-,-,+) 7(-,-,-)
// 8-15: (簣1,簣徆,簣1): 8(+,+,+) 9(+,+,-) 10(+,-,+) 11(+,-,-) 12(-,+,+) 13(-,+,-) 14(-,-,+) 15(-,-,-)
// 16-23: (簣1,簣1,簣徆): 16(+,+,+) 17(+,+,-) 18(+,-,+) 19(+,-,-) 20(-,+,+) 21(-,+,-) 22(-,-,+) 23(-,-,-)
const TRUNCATED_CUBE_INDICES = [
  // 8銝芯�閫鍦耦嚗���嫣�8憿嗥�憭�⏛閫𡜐�瘜閧瑪�嘥�嚗屸��𧒄���摨𧶏�
  0, 8, 16,    // +++ 憿嗥�
  4, 20, 12,   // -++ 憿嗥�
  2, 10, 18,   // +-+ 憿嗥�
  6, 22, 14,   // --+ 憿嗥�
  1, 9, 17,    // ++- 憿嗥�
  5, 21, 13,   // -+- 憿嗥�
  3, 19, 11,   // +-- 憿嗥�
  7, 15, 23,   // --- 憿嗥�
  // 6銝芸�颲孵耦嚗���嫣�6�ｇ�瘥譍葵��耦銝㕑��?6銝㕑�嚗峕�蝥踵�憭吔�
  // +x �?(x=1): 憿嗥� 8,9,10,11,16,17,18,19 憿箏�: 16->17->9->11->19->18->10->8
  16, 17, 9, 16, 9, 11, 16, 11, 19, 16, 19, 18, 16, 18, 10, 16, 10, 8,
  // -x �?(x=-1): 憿嗥� 12,13,14,15,20,21,22,23 憿箏�: 20->12->14->22->23->15->13->21
  20, 12, 14, 20, 14, 22, 20, 22, 23, 20, 23, 15, 20, 15, 13, 20, 13, 21,
  // +y �?(y=1): 憿嗥� 0,1,4,5,16,17,20,21 憿箏�: 0->16->17->1->5->21->20->4
  0, 16, 17, 0, 17, 1, 0, 1, 5, 0, 5, 21, 0, 21, 20, 0, 20, 4,
  // -y �?(y=-1): 憿嗥� 2,3,6,7,18,19,22,23 憿箏�: 2->6->22->23->7->3->19->18
  2, 6, 22, 2, 22, 23, 2, 23, 7, 2, 7, 3, 2, 3, 19, 2, 19, 18,
  // +z �?(z=1): 憿嗥� 0,2,4,6,8,10,12,14 憿箏�: 0->4->12->14->6->2->10->8
  0, 4, 12, 0, 12, 14, 0, 14, 6, 0, 6, 2, 0, 2, 10, 0, 10, 8,
  // -z �?(z=-1): 憿嗥� 1,3,5,7,9,11,13,15 憿箏�: 1->9->11->3->7->15->13->5
  1, 9, 11, 1, 11, 3, 1, 3, 7, 1, 7, 15, 1, 15, 13, 1, 13, 5
];

// ===== �芾�鈭���Ｖ� (Truncated Icosahedron/頞喟�) =====
// 60憿嗥�32�?12鈭磰器+20�剛器)����渡揣撘閗�鈭𤾸��?
// 敶枏�雿輻鍂 IcosahedronGeometry(radius, 1) 餈睲撮嚗?0�Ｙ��碶���𢒰雿橒�
// TODO: 憒��蝎曄＆頞喟��𤘪�嚗屸�憭㚚�撌亙����摰峕㟲116銝㕑�蝝Ｗ�銵?

// ===== �芾�����Ｖ� (Truncated Dodecahedron) =====
// 60憿嗥�32�?20銝㕑�+12��器)嚗䔶蝙�?DodecahedronGeometry(radius, 1) 餈睲撮

// ===== �芸�鈭���Ｖ� (Icosidodecahedron) =====
// 30憿嗥�32�?20銝㕑�+12鈭磰器)嚗䔶蝙�?IcosahedronGeometry(radius, 1) 餈睲撮
// TODO: 憒��蝎曄＆摰䂿緵嚗屸�摰峕㟲�?0憿嗥�+168銝㕑�蝝Ｗ�銵?

// �𥕦遣憭𡁻𢒰雿枏�雿蓥�
// 瘜冽�嚗𡁏⏛閫?�芸�憭𡁻𢒰雿枏撩�?detail=0 隞乩���像�Ｘ��𡢅��踹� EdgesGeometry �𣂼��箏��其�閫垍瑪
function createPolyhedronGeometry(type: PolyhedronType, radius: number, subdivisionLevel: number): THREE.BufferGeometry {
  // �斗鱏�臬炏銝箸⏛閫?�芸�蝐餃�
  const isTruncatedType = type.startsWith('truncated') || type === 'cuboctahedron' || type === 'icosidodecahedron';
  // 撖寞⏛閫垍掩�见撩�?detail=0
  const effectiveDetail = isTruncatedType ? 0 : subdivisionLevel;

  switch (type) {
    // ===== �𤩺��曄�雿橒��舀�蝏��嚗?====
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(radius, subdivisionLevel);
    case 'cube':
      // BoxGeometry: 颲寥鵭 = radius * 2 / �? 雿踹��亦��𠰴� = radius
      const boxSize = radius * 2 / Math.sqrt(3);
      return new THREE.BoxGeometry(boxSize, boxSize, boxSize, 1 + subdivisionLevel, 1 + subdivisionLevel, 1 + subdivisionLevel);
    case 'octahedron':
      return new THREE.OctahedronGeometry(radius, subdivisionLevel);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(radius, subdivisionLevel);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(radius, subdivisionLevel);

    // ===== �芾�/�芸�憭𡁻𢒰雿?=====
    case 'truncatedTetrahedron':
      // 蝎曄＆摰䂿緵嚗?2憿嗥�嚗?銝㕑�+4�剛器
      return new THREE.PolyhedronGeometry(TRUNCATED_TETRAHEDRON_VERTICES, TRUNCATED_TETRAHEDRON_INDICES, radius, effectiveDetail);
    case 'truncatedOctahedron':
      // 蝎曄＆摰䂿緵嚗?4憿嗥�嚗?甇�䲮+8�剛器
      return new THREE.PolyhedronGeometry(TRUNCATED_OCTAHEDRON_VERTICES, TRUNCATED_OCTAHEDRON_INDICES, radius, effectiveDetail);
    case 'truncatedCube':
      // 蝎曄＆摰䂿緵嚗?4憿嗥�嚗?銝㕑�+6�怨器
      return new THREE.PolyhedronGeometry(TRUNCATED_CUBE_VERTICES, TRUNCATED_CUBE_INDICES, radius, effectiveDetail);
    case 'truncatedDodecahedron':
      // 60憿嗥�餈��憭齿�嚗𣬚鍂蝏������Ｖ�餈睲撮嚗��閫厩㮾隡潔��𤘪�銝滨移蝖殷�
      return new THREE.DodecahedronGeometry(radius, 1);
    case 'truncatedIcosahedron':
      // 60憿嗥�餈��憭齿�嚗𣬚鍂蝏��鈭���Ｖ�餈睲撮嚗��閫㗇𦻖餈𤏸雲����𤘪�銝滨移蝖殷�
      return new THREE.IcosahedronGeometry(radius, 1);
    case 'cuboctahedron':
      // 蝎曄＆摰䂿緵嚗?2憿嗥�嚗?銝㕑�+6甇�䲮
      return new THREE.PolyhedronGeometry(CUBOCTAHEDRON_VERTICES, CUBOCTAHEDRON_INDICES, radius, effectiveDetail);
    case 'icosidodecahedron':
      // 30憿嗥�颲������函������𢒰雿栞�隡潘�閫���訾撮嚗?
      // TODO: �𣂷�蝎曄＆摰䂿緵��閬���渡�30憿嗥�+32�Ｙ揣撘?
      return new THREE.IcosahedronGeometry(radius, 1);

    default:
      return new THREE.IcosahedronGeometry(radius, subdivisionLevel);
  }
}

// 隞𤾸�雿蓥��𣂼��臭�憿嗥�嚗�蝙�函征�游�撣屸��滨移摨阡䔮憸矋�
function extractUniqueVertices(geometry: THREE.BufferGeometry): Float32Array {
  const positions = geometry.attributes.position.array as Float32Array;
  const uniqueVertices = new Map<string, number[]>();

  // 雿輻鍂�湧�蝎曉漲嚗?雿滚��堆�撟嗅抅鈭𡡞��𡝗聢摮鞾��齿筑�寡秤撌?
  const quantize = (v: number) => Math.round(v * 100000) / 100000; // 0.00001 蝎曉漲

  for (let i = 0; i < positions.length; i += 3) {
    const x = quantize(positions[i]);
    const y = quantize(positions[i + 1]);
    const z = quantize(positions[i + 2]);
    const key = `${x},${y},${z}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, [positions[i], positions[i + 1], positions[i + 2]]);
    }
  }

  return new Float32Array([...uniqueVertices.values()].flat());
}

// �����𢒰銝羓� Fibonacci �箸���甅�?
function generateFibonacciSpherePoints(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // 暺��閫?

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y: 1 to -1
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;

    points.push(new THREE.Vector3(
      Math.cos(theta) * radius,
      y,
      Math.sin(theta) * radius
    ));
  }

  return points;
}

// �����𢒰�𤩺㦤��甅�?
function generateRandomSpherePoints(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    // �����𢒰��甅
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    points.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ));
  }

  return points;
}

// 霈∠�憿嗥�摨行㺭嚗���亦�颲寞㺭嚗?
function computeVertexDegrees(edgesGeometry: THREE.EdgesGeometry): Map<string, number> {
  const positions = edgesGeometry.attributes.position.array;
  const degreeMap = new Map<string, number>();

  // 撠�▲�孵���蓮銝箏�蝚虫葡雿靝蛹 key
  const toKey = (x: number, y: number, z: number) =>
    `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

  // �滚����㕑器嚗𣬚�霈⊥�銝芷▲�寧�摨行㺭
  for (let i = 0; i < positions.length; i += 6) {
    const key1 = toKey(positions[i], positions[i + 1], positions[i + 2]);
    const key2 = toKey(positions[i + 3], positions[i + 4], positions[i + 5]);

    degreeMap.set(key1, (degreeMap.get(key1) || 0) + 1);
    degreeMap.set(key2, (degreeMap.get(key2) || 0) + 1);
  }

  return degreeMap;
}

// �𥕦遣�賡�雿?mesh
function createEnergyBodyMesh(config: EnergyBodySettings): {
  group: THREE.Group;
  edgesMesh: THREE.LineSegments | null;
  verticesMesh: THREE.Points | null;
  shellMesh: THREE.Mesh | null;
  voronoiMesh: THREE.Mesh | null;
  voronoiSeeds: THREE.Vector3[];
  vertexDegrees: Float32Array;
  graph: Graph | null;
  lightPackets: LightPacket[];
  edgeLightData: Float32Array | null;
} {
  const group = new THREE.Group();
  group.name = `energyBody_${config.id}`;
  group.userData = { energyBodyId: config.id };

  // 深度合并：使用 createDefaultEnergyBody 的完整默认值 + 用户配置覆盖
  const defaults = createDefaultEnergyBody(config.id, config.name);
  const mergedConfig: EnergyBodySettings = {
    ...defaults,
    ...config,
    edgeEffect: { ...defaults.edgeEffect, ...(config.edgeEffect || {}) },
    vertexEffect: { ...defaults.vertexEffect, ...(config.vertexEffect || {}) },
    shellEffect: { ...defaults.shellEffect, ...(config.shellEffect || {}) },
    organicAnimation: { ...defaults.organicAnimation, ...(config.organicAnimation || {}) },
    lightFlow: { ...defaults.lightFlow, ...(config.lightFlow || {}) },
    edgeBreathing: { ...defaults.edgeBreathing, ...(config.edgeBreathing || {}) },
    sphericalVoronoi: { ...defaults.sphericalVoronoi, ...(config.sphericalVoronoi || {}) },
    postEffects: { ...defaults.postEffects, ...(config.postEffects || {}) },
    tilt: { ...defaults.tilt, ...(config.tilt || {}) },
    rotationAxis: { ...defaults.rotationAxis, ...(config.rotationAxis || {}) }
  };

  // 使用合并后的配置
  const { edgeEffect, vertexEffect, shellEffect, organicAnimation } = mergedConfig;

  // 撠���譍�瘛餃��?Bloom layer嚗�鍂鈭𡡞�㗇𥋘�?Bloom嚗?
  group.layers.enable(BLOOM_LAYER);

  // 创建基础几何体
  const baseGeometry = createPolyhedronGeometry(mergedConfig.polyhedronType, mergedConfig.radius, mergedConfig.subdivisionLevel);

  let edgesMesh: THREE.LineSegments | null = null;
  let verticesMesh: THREE.Points | null = null;
  let shellMesh: THREE.Mesh | null = null;

  const rotAxis = getRotationAxis(mergedConfig.rotationAxis);

  // 閫��憸𡏭𠧧
  const parseColor = (hex: string) => {
    const c = hex.replace('#', '');
    return new THREE.Vector3(
      parseInt(c.substring(0, 2), 16) / 255,
      parseInt(c.substring(2, 4), 16) / 255,
      parseInt(c.substring(4, 6), 16) / 255
    );
  };

  // === 蝥踵�璅∪� ===
  if (config.renderMode === 'wireframe' || config.renderMode === 'both') {
    // �𥕦遣颲寧��牐�雿橒����?簞�游末�啗�皛文��Ｖ�閫垍����颲對�
    const edgesGeometry = new THREE.EdgesGeometry(baseGeometry, 5);

    // 銝箸�銝芷▲�寞溶�?edgeProgress 撅墧�?
    const edgePositions = edgesGeometry.attributes.position.array;
    const vertexCount = edgePositions.length / 3;
    const edgeCount = vertexCount / 2;  // 瘥𤩺辺颲寞�2銝芷▲�?
    const edgeProgressArray = new Float32Array(vertexCount);
    for (let i = 0; i < edgeProgressArray.length; i += 2) {
      edgeProgressArray[i] = 0;     // 韏瑞�
      edgeProgressArray[i + 1] = 1; // 蝏��
    }
    edgesGeometry.setAttribute('edgeProgress', new THREE.BufferAttribute(edgeProgressArray, 1));

    // 颲寧揣撘訫��改��其�憭𡁜���恣蝞梹�
    const edgeIndexArray = new Float32Array(vertexCount);
    for (let i = 0; i < edgeCount; i++) {
      edgeIndexArray[i * 2] = i;
      edgeIndexArray[i * 2 + 1] = i;
    }
    edgesGeometry.setAttribute('edgeIndex', new THREE.BufferAttribute(edgeIndexArray, 1));

    // 颲寧��鞱捶
    const edgeMaterial = new THREE.ShaderMaterial({
      vertexShader: energyBodyEdgeVertexShader,
      fragmentShader: energyBodyEdgeFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRotationSpeed: { value: config.rotationSpeed },
        uRotationAxis: { value: new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z) },
        uBreathing: { value: organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0 },
        uBreathingSpeed: { value: organicAnimation.breathingSpeed },
        uNoiseAmplitude: { value: organicAnimation.noiseEnabled ? organicAnimation.noiseAmplitude : 0 },
        uNoiseFrequency: { value: organicAnimation.noiseFrequency },
        uNoiseSpeed: { value: organicAnimation.noiseSpeed },
        uSpherize: { value: config.spherize },
        uRadius: { value: config.radius },
        uEdgeColor: { value: parseColor(edgeEffect.color) },
        uGradientEndColor: { value: parseColor(edgeEffect.gradientEndColor) },
        uGradientEnabled: { value: edgeEffect.gradientEnabled ? 1.0 : 0.0 },
        uGlowIntensity: { value: edgeEffect.glowIntensity },
        uGlobalOpacity: { value: config.globalOpacity },
        uBlendMode: { value: config.blendMode === 'additive' ? 0.0 : 1.0 },
        uDashEnabled: { value: edgeEffect.dashPattern.enabled ? 1.0 : 0.0 },
        uDashRatio: { value: edgeEffect.dashPattern.dashRatio },
        uDashDensity: { value: edgeEffect.dashPattern.dashDensity ?? 10 },
        uDashPhase: { value: 0 },
        // �㗇� - 憭𡁜��舀�
        uLightFlowEnabled: { value: config.lightFlow.enabled ? 1.0 : 0.0 },
        uLightFlowColor: { value: parseColor(config.lightFlow.color) },
        uLightFlowBasePhase: { value: 0 },
        uLightFlowLength: { value: config.lightFlow.length },
        uLightFlowIntensity: { value: config.lightFlow.intensity },
        uLightFlowCount: { value: config.lightFlow.count ?? 1 },
        uLightFlowPhaseMode: { value: config.lightFlow.phaseMode === 'sync' ? 0.0 : 1.0 },
        uLightFlowPulseEnabled: { value: config.lightFlow.pulseEnabled ? 1.0 : 0.0 },
        uLightFlowPulseSpeed: { value: config.lightFlow.pulseSpeed ?? 2.0 },
        // 頝臬�蝟餌�
        uUsePathSystem: { value: 0.0 },  // �嘥��𡝗𧒄銝滢蝙�剁�餈鞱��嗆覔�桀���𠶖��凒�?
        uLightPackets: { value: new Array(10).fill(null).map(() => new THREE.Vector2(-1, 0)) },
        // 颲孵鐤�豢��?
        uEdgeBreathEnabled: { value: config.edgeBreathing?.enabled ? 1.0 : 0.0 },
        uEdgeBreathSpeed: { value: config.edgeBreathing?.speed ?? 0.5 },
        uEdgeBreathGlowAmp: { value: config.edgeBreathing?.glowAmplitude ?? 0.4 },
        uEdgeBreathAlphaAmp: { value: config.edgeBreathing?.alphaAmplitude ?? 0.15 },
        uEdgeBreathNoiseMix: { value: config.edgeBreathing?.noiseMix ?? 0.3 },
        uEdgeBreathNoiseScale: { value: config.edgeBreathing?.noiseScale ?? 2.0 },
        uEdgeBreathNoiseSpeed: { value: config.edgeBreathing?.noiseSpeed ?? 0.3 },
        uEdgeBreathNoiseFollow: { value: 0.0 }  // 暺䁅恕雿輻鍂�笔��鞉�嚗��頝罸��澆𢙺嚗?
      },
      transparent: true,
      blending: config.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });

    edgesMesh = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    edgesMesh.renderOrder = 26; // �賡�雿栞器蝻矋��仿�鈭擧瓲敹?
    group.add(edgesMesh);

    // 憿嗥��厩�
    if (vertexEffect.enabled && vertexEffect.shape !== 'none') {
      const uniqueVertices = extractUniqueVertices(baseGeometry);
      const vertexGeometry = new THREE.BufferGeometry();
      vertexGeometry.setAttribute('position', new THREE.BufferAttribute(uniqueVertices, 3));

      const shapeMap: { [key: string]: number } = { 'circle': 0, 'diamond': 1, 'star': 2 };

      const vertexMaterial = new THREE.ShaderMaterial({
        vertexShader: energyBodyVertexPointShader,
        fragmentShader: energyBodyVertexPointFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uRotationSpeed: { value: config.rotationSpeed },
          uRotationAxis: { value: new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z) },
          uBreathing: { value: organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0 },
          uBreathingSpeed: { value: organicAnimation.breathingSpeed },
          uPointSize: { value: vertexEffect.size },
          uSpherize: { value: config.spherize },
          uRadius: { value: config.radius },
          uVertexColor: { value: parseColor(vertexEffect.color) },
          uGlowIntensity: { value: vertexEffect.glowIntensity },
          uGlobalOpacity: { value: config.globalOpacity },
          uVertexShape: { value: shapeMap[vertexEffect.shape] || 0 },
          // �𣈯��匧�
          uDwellEnabled: { value: config.lightFlow?.dwellEnabled ? 1.0 : 0.0 },
          uDwellThreshold: { value: config.lightFlow?.dwellThreshold ?? 4 },
          uDwellPulseIntensity: { value: config.lightFlow?.dwellPulseIntensity ?? 1.0 },
          uDwellPulseSpeed: { value: 3.0 }
        },
        transparent: true,
        blending: config.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false
      });

      verticesMesh = new THREE.Points(vertexGeometry, vertexMaterial);
      verticesMesh.renderOrder = 27; // �賡�雿㯄▲�?
      group.add(verticesMesh);
    }
  }

  // === ��ㄢ璅∪� ===
  if (config.renderMode === 'shell' || config.renderMode === 'both') {
    const shellGeometry = baseGeometry.clone();
    shellGeometry.computeVertexNormals();

    const shellMaterial = new THREE.ShaderMaterial({
      vertexShader: energyBodyShellVertexShader,
      fragmentShader: energyBodyShellFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRotationSpeed: { value: config.rotationSpeed },
        uRotationAxis: { value: new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z) },
        uBreathing: { value: organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0 },
        uBreathingSpeed: { value: organicAnimation.breathingSpeed },
        uSpherize: { value: config.spherize },
        uRadius: { value: config.radius },
        uShellColor: { value: parseColor(shellEffect.color) },
        uOpacity: { value: shellEffect.opacity },
        uFresnelPower: { value: shellEffect.fresnelPower },
        uFresnelIntensity: { value: shellEffect.fresnelIntensity },
        uGlobalOpacity: { value: config.globalOpacity }
      },
      transparent: true,
      blending: config.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      side: shellEffect.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });

    shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    shellMesh.renderOrder = 25; // �賡�雿栞�憯喉��冽瓲敹���?
    group.add(shellMesh);
  }

  // === ��𢒰 Voronoi ===
  let voronoiMesh: THREE.Mesh | null = null;
  let voronoiSeeds: THREE.Vector3[] = [];

  const voronoiConfig = config.sphericalVoronoi;
  if (voronoiConfig?.enabled) {
    // ���蝘滚��?
    const seedCount = Math.min(voronoiConfig.cellCount, 64);
    voronoiSeeds = voronoiConfig.seedDistribution === 'fibonacci'
      ? generateFibonacciSpherePoints(seedCount)
      : generateRandomSpherePoints(seedCount);

    // �芷���蝏��蝥批�嚗𡁶�摮鞉㺭頞𠰴�嚗𣬚���漣�怨�雿𠬍��扯�隡睃�嚗?
    // detail=5 蝥?2562 �? detail=4 蝥?642 �? detail=3 蝥?162 �?
    const adaptiveDetail = Math.max(3, 5 - Math.floor(seedCount / 20));
    // Voronoi �𠰴��亙之鈭𤾸抅蝖��𠰴�嚗屸��滢��嗡�撅?z-fighting
    const voronoiGeometry = new THREE.IcosahedronGeometry(config.radius * 1.01, adaptiveDetail);
    voronoiGeometry.computeVertexNormals();

    // 撠��摮鞟�隡𣳇�垍����脣膥嚗��閬��銝��吔�
    const seedArray = voronoiSeeds.map(s => s.clone().normalize());

    const colorModeMap: { [key: string]: number } = { 'gradient': 0, 'random': 1, 'uniform': 2 };

    const voronoiMaterial = new THREE.ShaderMaterial({
      vertexShader: sphericalVoronoiVertexShader,
      fragmentShader: sphericalVoronoiFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRotationSpeed: { value: config.rotationSpeed },
        uRotationAxis: { value: new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z) },
        uSeeds: { value: seedArray },
        uSeedCount: { value: seedCount },
        uLineColor: { value: parseColor(voronoiConfig.lineColor) },
        uLineWidth: { value: voronoiConfig.lineWidth },
        uLineGlow: { value: voronoiConfig.lineGlow },
        uFillOpacity: { value: voronoiConfig.fillEnabled ? voronoiConfig.fillOpacity : 0 },
        uBaseHue: { value: voronoiConfig.baseHue },
        uHueSpread: { value: voronoiConfig.hueSpread },
        uColorMode: { value: colorModeMap[voronoiConfig.colorMode] || 0 },
        uCellPulse: { value: voronoiConfig.cellPulse ? 1.0 : 0.0 },
        uCellPulseSpeed: { value: voronoiConfig.cellPulseSpeed },
        uGlobalOpacity: { value: config.globalOpacity }
      },
      transparent: true,
      blending: config.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      depthTest: false,  // �喲𡡒瘛勗漲瘚贝�嚗𣬚＆靽?Voronoi �餅糓�航�
      side: THREE.DoubleSide  // �屸𢒰皜脫�嚗𣬚＆靽苷���葵閫鍦漲�質��见�
    });

    voronoiMesh = new THREE.Mesh(voronoiGeometry, voronoiMaterial);
    voronoiMesh.renderOrder = 30; // Voronoi 皜脫��冽��漤𢒰
    group.add(voronoiMesh);
  }

  // 摨𠉛鍂�暹�
  const tiltAngles = getTiltAngles(config.tilt);
  group.rotation.set(tiltAngles.x, tiltAngles.y, tiltAngles.z);

  // 霈∠�憿嗥�摨行㺭嚗�鍂鈭𡡞▲�孵��㰘��莎�
  let vertexDegrees = new Float32Array(0);
  if (verticesMesh) {
    const positions = verticesMesh.geometry.attributes.position.array;
    const vertexCount = positions.length / 3;
    vertexDegrees = new Float32Array(vertexCount);

    // 憒���㕑器蝻睃�雿蓥�嚗䔶�銝剛恣蝞堒漲�?
    if (edgesMesh) {
      const edgesGeometry = edgesMesh.geometry as THREE.EdgesGeometry;
      const degreeMap = computeVertexDegrees(edgesGeometry);
      const toKey = (x: number, y: number, z: number) =>
        `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

      for (let i = 0; i < vertexCount; i++) {
        const key = toKey(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        vertexDegrees[i] = degreeMap.get(key) || 3; // 暺䁅恕摨行㺭銝?3
      }

      // 撠�漲�唬�銝箏��扳溶�惩�憿嗥��牐�雿?
      verticesMesh.geometry.setAttribute('vertexDegree', new THREE.BufferAttribute(vertexDegrees, 1));
    }
  }

  // ��遣�曄�����其�頝臬�蝟餌�嚗?
  let graph: Graph | null = null;
  let lightPackets: LightPacket[] = [];
  let edgeLightData: Float32Array | null = null;

  if (edgesMesh && config.lightFlow?.enabled) {
    const edgesGeometry = edgesMesh.geometry as THREE.BufferGeometry;
    graph = buildGraphFromEdgesGeometry(edgesGeometry);

    // �𥕦遣頝臬�蝟餌��滨蔭
    const pathConfig: PathSystemConfig = {
      pathMode: config.lightFlow.pathMode || 'euler',
      eulerMode: (config.lightFlow.eulerMode as any) || 'autoAugment',
      phaseMode: config.lightFlow.phaseMode || 'spread',
      count: config.lightFlow.count || 3,
      speed: config.lightFlow.speed || 1.0,
      noBacktrack: config.lightFlow.noBacktrack ?? true,
      coverageWeight: config.lightFlow.coverageWeight ?? 1.0,
      angleWeight: config.lightFlow.angleWeight ?? 0.5,
      dwellEnabled: config.lightFlow.dwellEnabled || false,
      dwellThreshold: config.lightFlow.dwellThreshold || 4,
      dwellDuration: config.lightFlow.dwellDuration || 0.3,
      dwellCooldown: config.lightFlow.dwellCooldown ?? 1.0,
      dwellPulseIntensity: config.lightFlow.dwellPulseIntensity || 2.0,
      minPacketSpacing: config.lightFlow.minPacketSpacing ?? 0.1
    };

    // �𥕦遣�匧�
    lightPackets = createLightPackets(graph, pathConfig);

    // �嘥��𤥁器�匧��唳旿
    edgeLightData = new Float32Array(graph.edges.length * 4);
    edgeLightData.fill(-1);
  }

  return { group, edgesMesh, verticesMesh, shellMesh, voronoiMesh, voronoiSeeds, vertexDegrees, graph, lightPackets, edgeLightData };
}

// �𥕦遣璊剖��臬�雿蓥�嚗�𣈲��氖敹��嚗?
function createEllipticalRingGeometry(innerRadius: number, outerRadius: number, eccentricity: number, segments: number = 64): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 璊剖���㺭嚗惨 = �輯蓬, b = �剛蓬
  // eccentricity = sqrt(1 - b簡/a簡), ��隞?b = a * sqrt(1 - e簡)
  const e = Math.min(eccentricity, 0.99); // �𣂼���憭抒氖敹��
  const bFactor = Math.sqrt(1 - e * e); // �剛蓬/�輯蓬瘥𥪯�

  const radialSegments = 16; // �臬蒂�𡁜漲�孵����畾菜㺭嚗���牐誑�舀��𤩺�摨行��矋�

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let j = 0; j <= radialSegments; j++) {
      const t = j / radialSegments;
      const radius = innerRadius + (outerRadius - innerRadius) * t;

      // 璊剖��吔�x�孵�靽脲�嚗𡶶�孵�銋䀝誑bFactor
      const x = radius * cos;
      const y = radius * sin * bFactor;

      positions.push(x, y, 0);
      uvs.push(t, i / segments);
    }
  }

  // ���蝝Ｗ�
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (radialSegments + 1) + j;
      const d = c + 1;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Fibonacci ��𢒰������
function fibonacciSphere(samples: number, radius: number, fillPercent: number = 0): Float32Array {
  const positions: number[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // 暺��閫?

  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;

    // �寞旿憛怠��曉�瘥磰��游�敺?
    let r = radius;
    if (fillPercent > 0) {
      // 皜𣂼�/摰𧼮�璅∪�嚗𡁶�摮𣂼�撣�銁銝滚��𠰴�
      const minR = radius * (1 - fillPercent / 100);
      // 雿輻鍂蝡𧢲䲮�孵��唬�蝘臬������ (r �?�暿andom)
      // 餈蹱甅�������函�撖�漲銝��?
      const t = Math.cbrt(Math.random()); // 0~1 ����寞覔���
      r = minR + t * (radius - minR);
    }

    const x = Math.cos(theta) * radiusAtY * r;
    const z = Math.sin(theta) * radiusAtY * r;
    const posY = y * r;

    positions.push(x, posY, z);
  }

  return new Float32Array(positions);
}

// HSL 頧?RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

// ���餈𥕦�憸𡏭𠧧頧?RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
    : [1, 1, 1];
}

// ���璊剖��舐�摮?
function generateRingParticles(
  radius: number,
  eccentricity: number,
  density: number,
  bandwidth: number,
  thickness: number
): Float32Array {
  // 霈∠�璊剖��券鵭餈睲撮�?
  const b = radius * Math.sqrt(1 - eccentricity * eccentricity);
  const perimeter = Math.PI * (3 * (radius + b) - Math.sqrt((3 * radius + b) * (radius + 3 * b)));

  // 蝎鍦��?= 撖�漲 * �券鵭
  const count = Math.floor(density * perimeter);
  const positions: number[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;

    // 璊剖���㺭�寧�
    const x = radius * Math.cos(angle);
    const y = b * Math.sin(angle);

    // 瘛餃�摰賢漲���摨血�蝘?
    const offsetX = (Math.random() - 0.5) * bandwidth;
    const offsetY = (Math.random() - 0.5) * bandwidth;
    const offsetZ = (Math.random() - 0.5) * thickness;

    positions.push(x + offsetX, offsetZ, y + offsetY);
  }

  return new Float32Array(positions);
}

// ==================== 摰硺��詨��𥕦遣�賣㺭 ====================

// 霈∠�摰硺��詨�憸𡏭𠧧 (CPU 蝡? - 雿輻鍂 THREE.Color 蝖桐�憸𡏭𠧧蝛粹𡢿甇�＆
function calculateSolidCoreColors(settings: SolidCoreSettings): { baseColor: THREE.Vector3, accentColor: THREE.Vector3 } {
  // 銝箸唂�唳旿�𣂷�暺䁅恕�潔��?
  const hue = settings.hue ?? 0.02;
  const sat = Math.min(settings.saturation ?? 1.0, 1.0); // clamp �?0-1 �其� setHSL
  const lightness = settings.lightness ?? 0.5;

  const baseColor = new THREE.Color();
  const accentColor = new THREE.Color();

  // �箔��冽����摨西挽蝵株恣蝞烾��?
  // lightness = 0 �?蝥舫�
  // lightness = 0.5 �?甇�虜憸𡏭𠧧
  // lightness = 1 �?�亥��質𠧧

  // baseColor 憪讠�瘥?accentColor �梹��其�蝥寧��烾�嚗?
  const baseLightness = lightness * 0.15; // baseColor �𡝗�摨衣� 15%
  const accentLightness = lightness; // accentColor 雿輻鍂�冽�霈曉����摨?

  baseColor.setHSL(hue, sat, baseLightness);
  accentColor.setHSL((hue + 0.05) % 1.0, sat, accentLightness);

  return {
    baseColor: new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b),
    accentColor: new THREE.Vector3(accentColor.r, accentColor.g, accentColor.b)
  };
}

// 霈∠��㗇�憸𡏭𠧧嚗�� HSL 頧祆揢銝?RGB嚗? �澆捆�抒�
function calculateGlowColor(settings: SolidCoreSettings): THREE.Vector3 {
  const glowHue = settings.glowHue ?? 0.5;
  const glowSat = settings.glowSaturation ?? 1.0;
  const color = new THREE.Color();
  color.setHSL(glowHue, glowSat, 0.6);
  return new THREE.Vector3(color.r, color.g, color.b);
}

// 撠?hex 憸𡏭𠧧頧祆揢銝?THREE.Vector3
function hexToVec3(hex: string): THREE.Vector3 {
  const color = new THREE.Color(hex);
  return new THREE.Vector3(color.r, color.g, color.b);
}

// �瑕�皜𣂼��孵�蝝Ｗ�
function getGradientDirIndex(dir: string): number {
  const dirMap: Record<string, number> = {
    'radial': 0, 'linearX': 1, 'linearY': 2, 'linearZ': 3, 'linearCustom': 4, 'spiral': 5
  };
  return dirMap[dir] ?? 0;
}

// �瑕�憸𡏭𠧧璅∪�蝝Ｗ�
function getColorModeIndex(mode: string): number {
  const modeMap: Record<string, number> = {
    'none': 0, 'twoColor': 1, 'threeColor': 2, 'procedural': 3
  };
  return modeMap[mode] ?? 0;
}

// �𥕦遣摰硺��詨� Mesh嚗���急瓲敹��雿枏�憭硋ㄢ�㗇�撅��
function createSolidCoreMesh(settings: SolidCoreSettings, isMobile: boolean): THREE.Group {
  // �牐�雿梶移摨? PC 128x128, 蝘餃𢆡蝡?64x64
  const segments = isMobile ? 64 : 128;
  const shellSegments = isMobile ? 32 : 64; // 憭硋ㄢ蝎曉漲�臭誑雿𦒘�鈭?

  // 銝箸唂�唳旿�𣂷�暺䁅恕�潔��?
  const radius = settings.radius ?? 100;
  const scale = settings.scale ?? 3.0;
  const speed = settings.speed ?? 0.5;
  const contrast = settings.contrast ?? 3.0;
  const bandMix = settings.bandMix ?? 0;
  const ridgeMix = settings.ridgeMix ?? 0;
  const gridMix = settings.gridMix ?? 0;
  // 鋆��蝟餌�
  const crackEnabled = settings.crackEnabled ?? false;
  const crackScale = settings.crackScale ?? 4.0;
  const crackThreshold = settings.crackThreshold ?? 0.3;
  const crackFeather = settings.crackFeather ?? 0.1;
  const crackWarp = settings.crackWarp ?? 0.5;
  const crackWarpScale = settings.crackWarpScale ?? 1.5;
  const crackFlowSpeed = settings.crackFlowSpeed ?? 0.2;
  const crackColor1 = settings.crackColor1 ?? '#ffffff';
  const crackColor2 = settings.crackColor2 ?? '#ffaa00';
  const crackEmission = settings.crackEmission ?? 2.0;
  const emissiveStrength = settings.emissiveStrength ?? 0;
  // 憭𡁻��惩�
  const multiFreqEnabled = settings.multiFreqEnabled ?? false;
  const warpIntensity = settings.warpIntensity ?? 0.5;
  const warpScale = settings.warpScale ?? 1.0;
  const detailBalance = settings.detailBalance ?? 0.3;
  // 瘜閧瑪�啣𢆡
  const bumpEnabled = settings.bumpEnabled ?? false;
  const bumpStrength = settings.bumpStrength ?? 0.3;
  const specularStrength = settings.specularStrength ?? 1.0;
  const specularColor = settings.specularColor ?? '#ffffff';
  const roughness = settings.roughness ?? 32;
  // 摰𡁜��?
  const lightEnabled = settings.lightEnabled ?? false;
  const lightDirection = settings.lightDirection ?? { x: -1, y: -1, z: 1 };
  const lightColor = settings.lightColor ?? '#ffffff';
  const lightIntensity = settings.lightIntensity ?? 1.0;
  const lightAmbient = settings.lightAmbient ?? 0.2;
  // �剔�颲㗇�
  const hotspotEnabled = settings.hotspotEnabled ?? false;
  const hotspotCount = settings.hotspotCount ?? 4;
  const hotspotSize = settings.hotspotSize ?? 0.15;
  const hotspotPulseSpeed = settings.hotspotPulseSpeed ?? 1.0;
  const hotspotColor = settings.hotspotColor ?? '#ffff00';
  const hotspotEmission = settings.hotspotEmission ?? 3.0;
  const opacity = settings.opacity ?? 1.0;
  const brightness = settings.brightness ?? 1.0;
  // �啣��訫��?
  const glowLength = settings.glowLength ?? 2.0;
  const glowStrength = settings.glowStrength ?? 1.0;
  const glowRadius = settings.glowRadius ?? 0.2;
  const glowFalloff = settings.glowFalloff ?? 2.0;
  const glowInward = settings.glowInward ?? false;
  const glowBloomBoost = settings.glowBloomBoost ?? 1.0;

  // 憭��銵券𢒰憸𡏭𠧧嚗��摰寞唂����啁�嚗?
  const surfaceColor = settings.surfaceColor ?? {
    mode: 'none' as const,
    baseColor: '#ff4400',
    colors: ['#ff4400', '#ffffff'],
    colorMidPosition: 0.5,
    direction: 'radial' as const,
    directionCustom: { x: 0, y: 1, z: 0 },
    spiralDensity: 3,
    proceduralIntensity: 1.0
  };

  // 憭���㗇�憸𡏭𠧧嚗��摰寞唂����啁�嚗?
  const glowColorSettings = settings.glowColor ?? {
    mode: 'none' as const,
    baseColor: '#ff6600',
    colors: ['#ff6600', '#ffffff'],
    colorMidPosition: 0.5,
    direction: 'radial' as const,
    directionCustom: { x: 0, y: 1, z: 0 },
    spiralDensity: 3,
    proceduralIntensity: 1.0
  };

  // === 1. �詨���� ===
  const coreGeometry = new THREE.SphereGeometry(radius, segments, segments);
  const coreMaterial = new THREE.ShaderMaterial({
    vertexShader: solidCoreVertexShader,
    fragmentShader: solidCoreFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uScale: { value: scale },
      uSpeed: { value: speed },
      uContrast: { value: contrast },
      uBandMix: { value: bandMix },
      uRidgeMix: { value: ridgeMix },
      uGridMix: { value: gridMix },
      // 鋆��蝟餌�
      uCrackEnabled: { value: crackEnabled ? 1.0 : 0.0 },
      uCrackScale: { value: crackScale },
      uCrackThreshold: { value: crackThreshold },
      uCrackFeather: { value: crackFeather },
      uCrackWarp: { value: crackWarp },
      uCrackWarpScale: { value: crackWarpScale },
      uCrackFlowSpeed: { value: crackFlowSpeed },
      uCrackColor1: { value: hexToVec3(crackColor1) },
      uCrackColor2: { value: hexToVec3(crackColor2) },
      uCrackEmission: { value: crackEmission },
      uEmissiveStrength: { value: emissiveStrength },
      // 憭𡁻��惩�
      uMultiFreqEnabled: { value: multiFreqEnabled ? 1.0 : 0.0 },
      uWarpIntensity: { value: warpIntensity },
      uWarpScale: { value: warpScale },
      uDetailBalance: { value: detailBalance },
      // 瘜閧瑪�啣𢆡
      uBumpEnabled: { value: bumpEnabled ? 1.0 : 0.0 },
      uBumpStrength: { value: bumpStrength },
      uSpecularStrength: { value: specularStrength },
      uSpecularColor: { value: hexToVec3(specularColor) },
      uRoughness: { value: roughness },
      // 摰𡁜��?
      uLightEnabled: { value: lightEnabled ? 1.0 : 0.0 },
      uLightDirection: { value: new THREE.Vector3(lightDirection.x, lightDirection.y, lightDirection.z) },
      uLightColor: { value: hexToVec3(lightColor) },
      uLightIntensity: { value: lightIntensity },
      uLightAmbient: { value: lightAmbient },
      // �剔�颲㗇�
      uHotspotEnabled: { value: hotspotEnabled ? 1.0 : 0.0 },
      uHotspotCount: { value: hotspotCount },
      uHotspotSize: { value: hotspotSize },
      uHotspotPulseSpeed: { value: hotspotPulseSpeed },
      uHotspotColor: { value: hexToVec3(hotspotColor) },
      uHotspotEmission: { value: hotspotEmission },
      uOpacity: { value: opacity },
      uBrightness: { value: brightness },
      // 銵券𢒰憸𡏭𠧧蝟餌�
      uSurfaceColorMode: { value: getColorModeIndex(surfaceColor.mode) },
      uSurfaceBaseColor: { value: hexToVec3(surfaceColor.baseColor) },
      uSurfaceColor1: { value: hexToVec3(surfaceColor.colors[0] || surfaceColor.baseColor) },
      uSurfaceColor2: { value: hexToVec3(surfaceColor.colors[1] || '#ffffff') },
      uSurfaceColor3: { value: hexToVec3(surfaceColor.colors[2] || '#ffffff') },
      uSurfaceColorMidPos: { value: surfaceColor.colorMidPosition },
      uSurfaceColorMidWidth: { value: surfaceColor.colorMidWidth ?? 1 },
      uSurfaceColorMidWidth2: { value: surfaceColor.colorMidWidth2 ?? 0 },
      uSurfaceGradientDir: { value: getGradientDirIndex(surfaceColor.direction) },
      uSurfaceCustomDir: { value: new THREE.Vector3(surfaceColor.directionCustom.x, surfaceColor.directionCustom.y, surfaceColor.directionCustom.z) },
      uSurfaceSpiralDensity: { value: surfaceColor.spiralDensity },
      uSurfaceProceduralInt: { value: surfaceColor.proceduralIntensity },
      // �㗇�憸𡏭𠧧蝟餌�
      uGlowColorMode: { value: getColorModeIndex(glowColorSettings.mode) },
      uGlowBaseColor: { value: hexToVec3(glowColorSettings.baseColor) },
      uGlowColor1: { value: hexToVec3(glowColorSettings.colors[0] || glowColorSettings.baseColor) },
      uGlowColor2: { value: hexToVec3(glowColorSettings.colors[1] || '#ffffff') },
      uGlowColor3: { value: hexToVec3(glowColorSettings.colors[2] || '#ffffff') },
      uGlowColorMidPos: { value: glowColorSettings.colorMidPosition },
      uGlowColorMidWidth: { value: glowColorSettings.colorMidWidth ?? 1 },
      uGlowColorMidWidth2: { value: glowColorSettings.colorMidWidth2 ?? 0 },
      uGlowGradientDir: { value: getGradientDirIndex(glowColorSettings.direction) },
      uGlowCustomDir: { value: new THREE.Vector3(glowColorSettings.directionCustom.x, glowColorSettings.directionCustom.y, glowColorSettings.directionCustom.z) },
      uGlowSpiralDensity: { value: glowColorSettings.spiralDensity },
      uGlowProceduralInt: { value: glowColorSettings.proceduralIntensity },
      // �㗇���㺭
      uGlowLength: { value: glowLength },
      uGlowStrength: { value: glowStrength },
      uGlowBloomBoost: { value: glowBloomBoost }
    },
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false  // 甇�𢒰銝滚�瘛勗漲嚗諹悟����拐��航�
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  coreMesh.name = 'solidCore';
  coreMesh.renderOrder = 10;  // 甇�𢒰皜脫�憿箏�

  // === 1.5 �屸𢒰瘛勗漲憸��撅���芸�瘛勗漲銝滚�憸𡏭𠧧嚗?===
  // 餈嗘�撅�鍂鈭擧迤蝖桅��⊥瓲敹���寧��拐�
  const depthGeometry = new THREE.SphereGeometry(radius, segments, segments);
  const depthMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,  // 銝滚�憸𡏭𠧧
    side: THREE.BackSide,  // �芣葡�栞��?
    depthWrite: true  // �坔�瘛勗漲
  });
  const depthMesh = new THREE.Mesh(depthGeometry, depthMaterial);
  depthMesh.name = 'solidCoreDepth';
  depthMesh.renderOrder = 5;  // ���甇�𢒰皜脫�

  // === 2. 憭硋ㄢ�㗇�撅��敶?glowStrength > 0 �嗅�撱綽� ===
  const group = new THREE.Group();
  group.add(depthMesh);  // ��溶�䭾楛摨阡��坔�
  group.add(coreMesh);   // �齿溶�䭾迤�Ｗ�

  if (glowStrength > 0 && glowRadius > 0) {
    // 憭硋ㄢ�𠰴�嚗𡁶眏 glowRadius �批�嚗?-1 撖孵� 0-100% 憸嘥�擃睃漲嚗?
    const shellScale = 1.0 + glowRadius;
    const shellRadius = radius * shellScale;

    const shellGeometry = new THREE.SphereGeometry(shellRadius, shellSegments, shellSegments);
    const shellMaterial = new THREE.ShaderMaterial({
      vertexShader: glowShellVertexShader,
      fragmentShader: glowShellFragmentShader,
      uniforms: {
        // �㗇�憸𡏭𠧧蝟餌�
        uGlowColorMode: { value: getColorModeIndex(glowColorSettings.mode) },
        uGlowBaseColor: { value: hexToVec3(glowColorSettings.baseColor) },
        uGlowColor1: { value: hexToVec3(glowColorSettings.colors[0] || glowColorSettings.baseColor) },
        uGlowColor2: { value: hexToVec3(glowColorSettings.colors[1] || '#ffffff') },
        uGlowColor3: { value: hexToVec3(glowColorSettings.colors[2] || '#ffffff') },
        uGlowColorMidPos: { value: glowColorSettings.colorMidPosition },
        uGlowColorMidWidth: { value: glowColorSettings.colorMidWidth ?? 1 },
        uGlowColorMidWidth2: { value: glowColorSettings.colorMidWidth2 ?? 0 },
        uGlowGradientDir: { value: getGradientDirIndex(glowColorSettings.direction) },
        uGlowCustomDir: { value: new THREE.Vector3(glowColorSettings.directionCustom.x, glowColorSettings.directionCustom.y, glowColorSettings.directionCustom.z) },
        uGlowSpiralDensity: { value: glowColorSettings.spiralDensity },
        uGlowProceduralInt: { value: glowColorSettings.proceduralIntensity },
        uRadius: { value: shellRadius },
        // �㗇���㺭
        uGlowStrength: { value: glowStrength },
        uGlowFalloff: { value: glowFalloff },
        uGlowInward: { value: glowInward ? 1.0 : 0.0 }
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    shellMesh.name = 'glowShell';
    shellMesh.renderOrder = 15;  // �冽迤�Ｘ瓲敹���擧葡�?
    group.add(shellMesh);
  }

  return group;
}

// ==================== 銵券𢒰�怎� Mesh ====================

function createSurfaceFlameMesh(settings: SurfaceFlameSettings, isMobile: boolean): THREE.Mesh {
  const segments = isMobile ? 48 : 96;

  const {
    radius = 105,
    thickness = 0.15,
    color,
    flameScale = 1.0,
    density = 0.8,
    flowSpeed = 1.0,
    turbulence = 0.8,
    noiseType = 'simplex',
    fractalLayers = 3,
    opacity = 0.9,
    emissive = 2.0,
    bloomBoost = 1.5,
    direction = 'up',
    pulseEnabled = true,
    pulseSpeed = 1.0,
    pulseIntensity = 0.3
  } = settings;

  // �怎�憸𡏭𠧧
  const fc = color || {
    mode: 'twoColor',
    baseColor: '#ff6600',
    colors: ['#ff6600', '#ffff00'],
    colorMidPosition: 0.5,
    colorMidWidth: 1,
    direction: 'radial',
    directionCustom: { x: 0, y: 1, z: 0 },
    spiralDensity: 3,
    proceduralIntensity: 1.0
  };

  // 憸𡏭𠧧璅∪�蝝Ｗ�
  const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;

  // �孵�蝝Ｗ�
  const directionIndex = direction === 'up' ? 0 : direction === 'outward' ? 1 : 2;

  // �芸ㄟ蝐餃�蝝Ｗ�
  const noiseTypeIndex = noiseType === 'simplex' ? 0 : noiseType === 'voronoi' ? 1 : 0;

  // �𥕦遣�亙之鈭擧瓲敹�����
  const flameRadius = radius * (1 + thickness);
  const geometry = new THREE.IcosahedronGeometry(flameRadius, isMobile ? 4 : 5);

  const material = new THREE.ShaderMaterial({
    vertexShader: surfaceFlameVertexShader,
    fragmentShader: surfaceFlameFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uThickness: { value: thickness },
      uFlameScale: { value: flameScale },
      uDensity: { value: density },
      uFlowSpeed: { value: flowSpeed },
      uTurbulence: { value: turbulence },
      uNoiseType: { value: noiseTypeIndex },
      uFractalLayers: { value: fractalLayers },
      uOpacity: { value: opacity },
      uEmissive: { value: emissive },
      uBloomBoost: { value: bloomBoost },
      uDirection: { value: directionIndex },
      uPulseEnabled: { value: pulseEnabled ? 1.0 : 0.0 },
      uPulseSpeed: { value: pulseSpeed },
      uPulseIntensity: { value: pulseIntensity },
      // 憸𡏭𠧧蝟餌�
      uColorMode: { value: colorModeIndex },
      uBaseColor: { value: hexToVec3(fc.baseColor) },
      uColor1: { value: hexToVec3(fc.colors?.[0] || fc.baseColor) },
      uColor2: { value: hexToVec3(fc.colors?.[1] || '#ffff00') },
      uColor3: { value: hexToVec3(fc.colors?.[2] || '#ffffff') },
      uColorMidPos: { value: fc.colorMidPosition ?? 0.5 },
      uColorMidWidth: { value: fc.colorMidWidth ?? 1 },
      uGradientDir: { value: 0 },
      uCustomDir: { value: new THREE.Vector3(0, 1, 0) },
      uSpiralDensity: { value: fc.spiralDensity ?? 3 },
      uProceduralIntensity: { value: fc.proceduralIntensity ?? 1.0 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `surfaceFlame_${settings.id}`;
  mesh.renderOrder = 20;

  return mesh;
}

// ==================== �瑕��急� Points ====================

function createFlameJetPoints(settings: FlameJetSettings, isMobile: boolean): THREE.Points {
  const count = isMobile ? Math.floor(settings.particleCount * 0.5) : settings.particleCount;

  // ����瑕��嫣�蝵?
  const getJetOrigins = () => {
    const origins: THREE.Vector3[] = [];
    const directions: THREE.Vector3[] = [];
    const r = settings.baseRadius;

    switch (settings.sourceType) {
      case 'pole':
        origins.push(new THREE.Vector3(0, r, 0));
        directions.push(new THREE.Vector3(0, 1, 0));
        break;
      case 'equator':
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          origins.push(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
          directions.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
        }
        break;
      case 'hotspots':
        for (let i = 0; i < settings.hotspotCount; i++) {
          const phi = Math.acos(2 * Math.random() - 1);
          const theta = Math.random() * Math.PI * 2;
          const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          );
          origins.push(dir.clone().multiplyScalar(r));
          directions.push(dir);
        }
        break;
      case 'surface':
      default:
        for (let i = 0; i < settings.hotspotCount; i++) {
          const phi = Math.acos(2 * ((i + 0.5) / settings.hotspotCount) - 1);
          const theta = (i * 2.399963) % (Math.PI * 2);
          const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          );
          origins.push(dir.clone().multiplyScalar(r));
          directions.push(dir);
        }
    }
    return { origins, directions };
  };

  const { origins, directions } = getJetOrigins();
  const jetCount = origins.length;
  const particlesPerJet = Math.floor(count / jetCount);

  const positions = new Float32Array(count * 3);
  const progresses = new Float32Array(count);
  const randoms = new Float32Array(count);
  const jetDirections = new Float32Array(count * 3);
  const jetIndices = new Float32Array(count);

  let idx = 0;
  for (let j = 0; j < jetCount; j++) {
    const origin = origins[j];
    const dir = directions[j];
    for (let i = 0; i < particlesPerJet && idx < count; i++) {
      positions[idx * 3] = origin.x;
      positions[idx * 3 + 1] = origin.y;
      positions[idx * 3 + 2] = origin.z;
      progresses[idx] = i / particlesPerJet;
      randoms[idx] = Math.random();
      jetDirections[idx * 3] = dir.x;
      jetDirections[idx * 3 + 1] = dir.y;
      jetDirections[idx * 3 + 2] = dir.z;
      jetIndices[idx] = j;
      idx++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progresses, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute('aJetDirection', new THREE.BufferAttribute(jetDirections, 3));
  geometry.setAttribute('aJetIndex', new THREE.BufferAttribute(jetIndices, 1));

  const fc = settings.color;
  const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;

  const material = new THREE.ShaderMaterial({
    vertexShader: flameJetVertexShader,
    fragmentShader: flameJetFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uJetSpeed: { value: settings.jetSpeed },
      uHeight: { value: settings.height * settings.baseRadius },
      uWidth: { value: settings.width },
      uSpread: { value: settings.spread },
      uTurbulence: { value: settings.turbulence },
      uLifespan: { value: settings.lifespan },
      uParticleSize: { value: settings.particleSize },
      uBurstPhase: { value: 1.0 },
      uColor1: { value: hexToVec3(fc.colors?.[0] || fc.baseColor) },
      uColor2: { value: hexToVec3(fc.colors?.[1] || '#ffff00') },
      uColor3: { value: hexToVec3(fc.colors?.[2] || '#ff0000') },
      uOpacity: { value: settings.opacity },
      uEmissive: { value: settings.emissive },
      uColorMode: { value: colorModeIndex }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  points.name = `flameJet_${settings.id}`;
  points.renderOrder = 21;

  return points;
}

// ==================== �箸��怎� Points ====================

function createSpiralFlamePoints(settings: SpiralFlameSettings, isMobile: boolean): THREE.Points {
  const count = isMobile ? Math.floor(settings.particleCount * 0.5) : settings.particleCount;

  const positions = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const heights = new Float32Array(count);
  const randoms = new Float32Array(count);

  const spiralCount = settings.spiralCount;
  const particlesPerSpiral = Math.floor(count / spiralCount);

  let idx = 0;
  for (let s = 0; s < spiralCount; s++) {
    const spiralOffset = (s / spiralCount) * Math.PI * 2;
    for (let i = 0; i < particlesPerSpiral && idx < count; i++) {
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      angles[idx] = spiralOffset + (i / particlesPerSpiral) * settings.pitch * Math.PI * 2;
      heights[idx] = i / particlesPerSpiral;
      randoms[idx] = Math.random();
      idx++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const fc = settings.color;
  const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;
  const dirIndex = settings.direction === 'cw' ? 0 : settings.direction === 'ccw' ? 1 : 2;

  const material = new THREE.ShaderMaterial({
    vertexShader: spiralFlameVertexShader,
    fragmentShader: spiralFlameFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBaseRadius: { value: settings.baseRadius },
      uStartRadius: { value: settings.startRadius },
      uEndRadius: { value: settings.endRadius },
      uSpiralHeight: { value: settings.height },
      uPitch: { value: settings.pitch },
      uRotationSpeed: { value: settings.rotationSpeed },
      uRiseSpeed: { value: settings.riseSpeed },
      uSpiralCount: { value: settings.spiralCount },
      uDirection: { value: dirIndex },
      uThickness: { value: settings.thickness },
      uParticleSize: { value: settings.particleSize ?? 4.0 },
      uColor1: { value: hexToVec3(fc.colors?.[0] || fc.baseColor) },
      uColor2: { value: hexToVec3(fc.colors?.[1] || '#ffff00') },
      uColor3: { value: hexToVec3(fc.colors?.[2] || '#ff0000') },
      uOpacity: { value: settings.opacity },
      uEmissive: { value: settings.emissive },
      uColorMode: { value: colorModeIndex },
      uGradientDirection: { value: ['radial', 'linearX', 'linearY', 'linearZ', 'spiral'].indexOf(fc.direction || 'linearY') }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  points.name = `spiralFlame_${settings.id}`;
  points.renderOrder = 22;

  return points;
}

// ==================== 畾见蔣蝟餌��𥕦遣�賣㺭 ====================

interface AfterimageGroup {
  textureLayer: THREE.Mesh | null;
  particleLayer: THREE.Points | null;
  billboard: THREE.Group;
}

function createAfterimageSystem(
  system: import('../types').AfterimageSystemSettings,
  coreRadius: number,
  isMobile: boolean
): AfterimageGroup {
  const billboard = new THREE.Group();
  billboard.name = 'afterimageSystem';

  // �瑕��箏��滨蔭
  const zone = system.zones[0] || {
    id: 'default',
    name: '暺䁅恕',
    enabled: true,
    startAngle: 45,
    angleSpan: 90,
    sideLineType: 'straight' as const,
    sideLineLength: 2.0,
    sideLineAngle: 90,
    curveBendDirection: 'outward' as const,
    curveBendStrength: 0.5
  };

  const particles = system.particles;
  const texture = system.texture;

  // 閫��靘扯器蝐餃��峕𤩅蝥踵䲮�?
  const sideLineType = zone.sideLineType === 'curve' ? 1.0 : 0.0;
  const curveBend = zone.curveBendDirection === 'inward' ? -1.0 : 1.0;

  // ===== �𥕦遣蝥寧�撅��瘚�𢆡�怎����嚗?====
  let textureLayer: THREE.Mesh | null = null;
  {
    const planeSize = coreRadius * zone.sideLineLength * 3;
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);

    const textureMaterial = new THREE.ShaderMaterial({
      vertexShader: afterimageTextureVertexShader,
      fragmentShader: afterimageTextureFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uCoreRadius: { value: coreRadius },
        uPlaneSize: { value: planeSize },
        uColor1: { value: hexToVec3(texture.colors?.[0] || '#ff00ff') },
        uColor2: { value: hexToVec3(texture.colors?.[1] || '#ff66ff') },
        uColor3: { value: hexToVec3(texture.colors?.[2] || '#ffffff') },
        uOpacity: { value: texture.opacity ?? 0.8 },
        uFlowSpeed: { value: texture.flowSpeed ?? 0.5 },
        uNoiseScale: { value: texture.noiseScale ?? 1.0 },
        uStretchFactor: { value: texture.stretchFactor ?? 2.0 },
        // �∠犒�����㺭
        uStripeIntensity: { value: texture.stripeIntensity ?? 0 },
        uStripeCount: { value: texture.stripeCount ?? 8 },
        uDirectionalStretch: { value: texture.directionalStretch ?? 1 },
        uEdgeSharpness: { value: texture.edgeSharpness ?? 0 },
        uDistortion: { value: texture.distortion ?? 0 },
        // 蝥寧�璅∪�
        uTextureMode: { value: texture.textureMode === 'energy' ? 1.0 : 0.0 },
        // �賡�蝵拙��?
        uEnergyFlameScale: { value: texture.energyFlameScale ?? 2.0 },
        uEnergyDensity: { value: texture.energyDensity ?? 0.5 },
        uEnergyFlowSpeed: { value: texture.energyFlowSpeed ?? 0.5 },
        uEnergyTurbulence: { value: texture.energyTurbulence ?? 0.5 },
        uEnergyNoiseType: { value: texture.energyNoiseType === 'voronoi' ? 1.0 : 0.0 },
        uEnergyFractalLayers: { value: texture.energyFractalLayers ?? 3 },
        uEnergyDirection: { value: texture.energyDirection === 'spiral' ? 1.0 : 0.0 },
        uEnergyPulseEnabled: { value: texture.energyPulseEnabled ? 1.0 : 0.0 },
        uEnergyPulseSpeed: { value: texture.energyPulseSpeed ?? 1.0 },
        uEnergyPulseIntensity: { value: texture.energyPulseIntensity ?? 0.3 },
        // �箏���㺭
        uStartAngle: { value: THREE.MathUtils.degToRad(zone.startAngle) },
        uAngleSpan: { value: THREE.MathUtils.degToRad(zone.angleSpan) },
        uSideLength: { value: zone.sideLineLength },
        uSideAngle: { value: THREE.MathUtils.degToRad((zone.sideLineAngle || 90) - 90) },
        uSideLineType: { value: sideLineType },
        uCurveBend: { value: curveBend },
        uCurveStrength: { value: zone.curveBendStrength || 0.5 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    textureLayer = new THREE.Mesh(planeGeometry, textureMaterial);
    textureLayer.name = 'afterimageTexture';
    textureLayer.renderOrder = 15;
    textureLayer.visible = system.enabled && (texture.enabled ?? false);
    billboard.add(textureLayer);
  }

  // �𥕦遣蝎鍦�撅?
  let particleLayer: THREE.Points | null = null;
  {
    const particleCount = isMobile ? Math.floor(100 * 2) : Math.floor(100 * 5);  // �箏��圈�

    const positions = new Float32Array(particleCount * 3);
    const progresses = new Float32Array(particleCount);
    const randoms = new Float32Array(particleCount);
    const angles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // 蝎鍦��嘥�雿滨蔭�典��對����脣膥銝凋��冽��恣蝞𦯀�蝵殷�
      // aAngle �?0-1 ��㮾撖孵�潘��典躹�蠘�摨西楊摨血����蝵殷�
      const relativeAngle = Math.random();  // 0-1

      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      progresses[i] = Math.random();
      randoms[i] = Math.random();
      angles[i] = relativeAngle;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aProgress', new THREE.BufferAttribute(progresses, 1));
    particleGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    particleGeometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));

    const sizeDecayIndex = particles.sizeDecay === 'none' ? 0 : particles.sizeDecay === 'linear' ? 1 : 2;
    const colorModeIndex = particles.colorMode === 'single' ? 0 : 1;

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: afterimageParticleVertexShader,
      fragmentShader: afterimageParticleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uCoreRadius: { value: coreRadius },
        uSpeed: { value: particles.speed },
        uSpeedRandomness: { value: particles.speedRandomness },
        uLifespan: { value: particles.lifespan },
        uSize: { value: particles.size },
        uSizeDecay: { value: sizeDecayIndex },
        // �箏���㺭
        uStartAngle: { value: THREE.MathUtils.degToRad(zone.startAngle) },
        uAngleSpan: { value: THREE.MathUtils.degToRad(zone.angleSpan) },
        uSideLength: { value: zone.sideLineLength },
        uSideAngle: { value: THREE.MathUtils.degToRad((zone.sideLineAngle || 90) - 90) },
        uSideLineType: { value: sideLineType },
        uCurveBend: { value: curveBend },
        uCurveStrength: { value: zone.curveBendStrength || 0.5 },
        // 蝎鍦�憸𡏭𠧧
        uColor1: { value: hexToVec3(particles.colors[0] || '#ff4400') },
        uColor2: { value: hexToVec3(particles.colors[1] || '#ffff00') },
        uColorMode: { value: colorModeIndex }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    particleLayer = new THREE.Points(particleGeometry, particleMaterial);
    particleLayer.name = 'afterimageParticles';
    particleLayer.renderOrder = 16;
    // �嘥��航��扳覔�?particles.enabled 霈曄蔭
    particleLayer.visible = system.enabled && particles.enabled;
    billboard.add(particleLayer);
  }

  return { textureLayer, particleLayer, billboard };
}

// ==================== �豢㦤靽⊥�蝐餃� ====================

export interface CameraInfo {
  position: { x: number; y: number; z: number };
  distance: number;
  polarAngle: number;  // ���嚗���渲�摨佗�
  azimuthAngle: number; // �嫣�閫𡜐�瘞游像閫鍦漲嚗?
}

// ==================== 蝏�辣 Props ====================

interface PlanetSceneProps {
  settings: PlanetSceneSettings;
  handData: React.MutableRefObject<HandData>;
  onCameraChange?: (info: CameraInfo) => void;
  resetCameraRef?: React.MutableRefObject<(() => void) | null>;
  overlayMode?: boolean;
  // 鈭㘾�𡁏芋撘譍����鈭烐㺭�?
  nebulaData?: ProcessedData | null;
  nebulaSettings?: AppSettings;
  nebulaInstancesData?: Map<string, ProcessedData>;
  sidebarOpen?: boolean;  // 侧边栏是否展开
  drawSettings?: DrawSettings;  // 绘图模式设置
}

// �嘥��豢㦤霈曄蔭
const INITIAL_CAMERA = {
  position: { x: 0, y: 0, z: 500 },
  target: { x: 0, y: 0, z: 0 }
};

// ==================== 銝餌�隞?====================

const PlanetScene: React.FC<PlanetSceneProps> = ({ settings, handData, onCameraChange, resetCameraRef, overlayMode = false, nebulaData, nebulaSettings, nebulaInstancesData, sidebarOpen = false, drawSettings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());

  // 摮睃����㗇���� mesh 撘閧鍂
  const planetMeshesRef = useRef<Map<string, {
    core: THREE.Group;  // ��鉄蝎鍦��詨����雿𤘪瓲敹?
    flames: THREE.Group; // �怎�蝟餌�
    rings: THREE.Group;
    radiation: THREE.Group;
    fireflies: THREE.Group;
    magicCircles: THREE.Group;        // 瘜閖猐蝏?
    energyBodies: THREE.Group;        // �賡�雿梶�
    emitters: any[]; // 摮睃��穃��冽㺭�?
    fireflyData: FireflyRuntimeData[]; // 瘚�𨫡餈鞱��嗆㺭�?
    magicCircleData: MagicCircleRuntimeData[]; // 瘜閖猐餈鞱��嗆㺭�?
    energyBodyData: EnergyBodyRuntimeData[]; // �賡�雿栞�銵峕𧒄�唳旿
  }>>(new Map());

  // �𤾸��?passes
  const afterimagePassRef = useRef<AfterimagePass | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const chromaticPassRef = useRef<ShaderPass | null>(null);
  const vignettePassRef = useRef<ShaderPass | null>(null);

  // 韐游㦛蝻枏�
  const textureCache = useRef<Map<string, THREE.Texture>>(new Map());

  // �峕艶���
  const backgroundSphereRef = useRef<THREE.Mesh | null>(null);
  const backgroundTextureRef = useRef<THREE.Texture | null>(null);

  // �煺�蝎鍦�蝟餌�嚗���𡁏芋撘𧶏�
  const nebulaPointsRef = useRef<THREE.Points | null>(null);
  const nebulaMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const nebulaPointsOutsideRef = useRef<THREE.Points | null>(null);
  const nebulaMaterialOutsideRef = useRef<THREE.ShaderMaterial | null>(null);

  // 憭𡁏�鈭穃�靘讠�蝎鍦�蝟餌�嚗���𡁏芋撘𧶏�
  const nebulaInstancePointsRef = useRef<Map<string, THREE.Points>>(new Map());
  const nebulaInstanceMaterialsRef = useRef<Map<string, THREE.ShaderMaterial>>(new Map());
  const nebulaInstancePointsOutsideRef = useRef<Map<string, THREE.Points>>(new Map());
  const nebulaInstanceMaterialsOutsideRef = useRef<Map<string, THREE.ShaderMaterial>>(new Map());

  // 互通模式遮罩：用于限定“重叠区域”
  const overlayStencilMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // 形状纹理图集缓存
  const shapeTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const getShapeTexture = () => {
    if (!shapeTextureRef.current) {
      shapeTextureRef.current = createShapeTextureAtlas();
    }
    return shapeTextureRef.current;
  };

  // �箸艶�嘥��硋��鞉�敹?
  const [sceneReady, setSceneReady] = useState(false);

  // Ink Manager for symmetry drawing
  const inkManagerRef = useRef<InkManager | null>(null);

  // ===== 銝𠰴���� Refs =====
  // ���冽��剁�撣衣�摰墧�撠橘�
  const starRainRef = useRef<{
    headPoints: THREE.Points;
    tailPoints: THREE.Points;
    positions: Float32Array;
    velocities: Float32Array;
    ages: Float32Array;
    maxAges: Float32Array;
    sizes: Float32Array;
    histories: THREE.Vector3[][];  // 瘥譍葵蝎鍦�����脖�蝵?
    maxCount: number;
    trailLength: number;
  } | null>(null);

  // 雿梶妖��㦛
  const volumeFogRef = useRef<THREE.Group | null>(null);

  // �厩��舐狩
  const lightOrbsRef = useRef<{
    group: THREE.Group;
    orbs: Array<{
      mesh: THREE.Mesh;
      age: number;
      maxAge: number;
      speed: number;
      drift: { x: number; z: number };
      burstTriggered: boolean;
    }>;
    lastSpawnTime: number;
  } | null>(null);

  // ===== �见飵鈭支���� Refs =====
  // �蠘劓蝏睃㦛頧刻蕨
  const drawingTrailRef = useRef<{
    points: THREE.Points;
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
    ages: Float32Array;
    activeCount: number;
    maxCount: number;
    lastDrawPos: THREE.Vector3;
    isDrawing: boolean;
  } | null>(null);

  // �抵捶��𠧧���
  const slashEffectRef = useRef<{
    active: boolean;
    startTime: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    direction: THREE.Vector3;
    healProgress: number;
  } | null>(null);

  // �嘥��硋㦤�?
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // �𥕦遣�箸艶
    const scene = new THREE.Scene();
    // �箸艶�峕艶�箏�銝粹��莎�銝滩��𦶥I銝駁��睃�嚗�虾�朞��冽艶�曇��航挽蝵株��吔�
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // �𥕦遣�豢㦤
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(0, 0, 500);
    cameraRef.current = camera;

    // 璉�瘚讠宏�刻挽憭?
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // �𥕦遣皜脫��?- 蝘餃𢆡蝡臭蝙�冽凒靽嘥�霈曄蔭
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile, // 蝘餃𢆡蝡舐��冽��舫蝙
      alpha: true,
      stencil: true,
      powerPreference: isMobile ? 'default' : 'high-performance'
    });
    renderer.setSize(width, height);
    // 蝘餃𢆡蝡舫��嗅�蝝䭾�
    const maxPixelRatio = isMobile ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    // Tone Mapping - 互通模式使用与NebulaScene相同的设置
    if (overlayMode) {
      renderer.toneMapping = THREE.ReinhardToneMapping;
      renderer.setClearColor(0x000000, 0); // 透明背景
    } else {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    renderer.autoClearStencil = true;

    // �𥕦遣�峕艶���嚗�鍂鈭𤾸��臬㦛嚗?
    const bgGeometry = new THREE.SphereGeometry(5000, 64, 32);
    const bgMaterial = new THREE.ShaderMaterial({
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      uniforms: {
        uTexture: { value: null },
        uBrightness: { value: 1.0 },
        uSaturation: { value: 1.0 }
      },
      side: THREE.BackSide,  // 隞𤾸��函�
      fog: false,
      depthWrite: false
    });
    const bgSphere = new THREE.Mesh(bgGeometry, bgMaterial);
    bgSphere.renderOrder = -1000; // ����葡�?
    bgSphere.visible = false; // �嘥��鞱�
    scene.add(bgSphere);
    backgroundSphereRef.current = bgSphere;

    // Ink Manager Initialization
    // Initialize InkManager after scene and renderer are ready
    if (!inkManagerRef.current && renderer.domElement) {
      inkManagerRef.current = new InkManager(scene, camera, renderer.domElement);
    }

    // �𥕦遣�批��?
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    // 蝘餃𢆡蝡臬鍳�刻圻�?
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controlsRef.current = controls;

    // �𥕦遣�𤾸��?- 蝘餃𢆡蝡舫�雿𤾸�颲函�
    const postProcessScale = isMobile ? 0.5 : 1.0;
    const ppWidth = Math.floor(width * postProcessScale);
    const ppHeight = Math.floor(height * postProcessScale);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom - 互通模式使用与NebulaScene相同的设置
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(ppWidth, ppHeight),
      isMobile ? Math.min(settings.bloomStrength, 1.0) : settings.bloomStrength,
      0.4,
      0.85
    );
    // 互通模式下使用与NebulaScene一致的Bloom参数
    if (overlayMode) {
      bloomPass.threshold = 0;
      bloomPass.radius = isMobile ? 0.3 : 0.5;
    }
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    // Afterimage (�硋偏) - 蝘餃𢆡蝡舐��?
    const afterimagePass = new AfterimagePass(
      (settings.trailEnabled && !isMobile) ? settings.trailLength : 0
    );
    if (!isMobile) {
      composer.addPass(afterimagePass);
    }
    afterimagePassRef.current = afterimagePass;

    // �脣榆���
    const chromaticPass = new ShaderPass(ChromaticAberrationShader);
    chromaticPass.enabled = false; // 暺䁅恕蝳�鍂嚗𣬚眏霈曄蔭�批�
    composer.addPass(chromaticPass);
    chromaticPassRef.current = chromaticPass;

    // �𡑒����
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.enabled = false; // 暺䁅恕蝳�鍂嚗𣬚眏霈曄蔭�批�
    composer.addPass(vignettePass);
    vignettePassRef.current = vignettePass;

    composerRef.current = composer;

    // ===== �嘥��碶�����?=====
    // 1. ���冽��剁�撣衣�摰墧�撠橘�蝐颱撮瘚�𨫡嚗?
    const starRainMaxCount = 1500; // 憭湧�蝎鍦��圈�
    const starRainTrailLen = 60;   // 瘥譍葵蝎鍦����撠暸鵭摨佗��𧼮虜撖��嚗?

    // 憭湧�蝎鍦��唳旿
    const starRainPositions = new Float32Array(starRainMaxCount * 3);
    const starRainVelocities = new Float32Array(starRainMaxCount);
    const starRainAges = new Float32Array(starRainMaxCount);
    const starRainMaxAges = new Float32Array(starRainMaxCount);
    const starRainSizes = new Float32Array(starRainMaxCount);
    const starRainHistories: THREE.Vector3[][] = [];

    for (let i = 0; i < starRainMaxCount; i++) {
      // �𤩺㦤�嘥�雿滨蔭
      const x = (Math.random() - 0.5) * 300;
      const y = Math.random() * 300 - 50;
      const z = (Math.random() - 0.5) * 300;
      starRainPositions[i * 3] = x;
      starRainPositions[i * 3 + 1] = y;
      starRainPositions[i * 3 + 2] = z;
      starRainSizes[i] = 0.5 + Math.random() * 1.0;
      starRainVelocities[i] = 0.5 + Math.random() * 1.0;
      starRainAges[i] = Math.random() * 5;
      starRainMaxAges[i] = 3 + Math.random() * 4;
      // �嘥��硋��脖�蝵?
      const history: THREE.Vector3[] = [];
      for (let j = 0; j < starRainTrailLen; j++) {
        history.push(new THREE.Vector3(x, y, z));
      }
      starRainHistories.push(history);
    }

    // 憭湧�蝎鍦��牐�雿枏��鞱捶
    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute('position', new THREE.BufferAttribute(starRainPositions, 3));
    headGeometry.setAttribute('size', new THREE.BufferAttribute(starRainSizes, 1));

    const headMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x88ccff) },
        uBrightness: { value: 1.5 },
        uSizeScale: { value: 3.0 },
        uHeadStyle: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        uniform float uSizeScale;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uSizeScale * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uBrightness;
        uniform float uHeadStyle;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float shape = 1.0 - d * 2.0;
          if (uHeadStyle > 0.5) {
            float angle = atan(uv.y, uv.x);
            float star = 0.5 + 0.5 * cos(angle * 4.0);
            shape = (1.0 - d * 1.5) * (0.5 + 0.5 * star);
          }
          gl_FragColor = vec4(uColor * uBrightness, shape);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const headPoints = new THREE.Points(headGeometry, headMaterial);
    headPoints.visible = false;
    headPoints.renderOrder = 101;
    scene.add(headPoints);

    // �硋偏蝎鍦��牐�雿枏��鞱捶嚗���㗇�撠曄��其�銝芸�雿蓥�銝哨�
    const tailTotalCount = starRainMaxCount * starRainTrailLen;
    const tailPositions = new Float32Array(tailTotalCount * 3);
    const tailTapers = new Float32Array(tailTotalCount);

    // �嘥��𡝗�撠?
    for (let i = 0; i < starRainMaxCount; i++) {
      for (let j = 0; j < starRainTrailLen; j++) {
        const idx = i * starRainTrailLen + j;
        tailPositions[idx * 3] = starRainPositions[i * 3];
        tailPositions[idx * 3 + 1] = starRainPositions[i * 3 + 1];
        tailPositions[idx * 3 + 2] = starRainPositions[i * 3 + 2];
        tailTapers[idx] = Math.pow(1 - j / (starRainTrailLen - 1), 1.5);
      }
    }

    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
    tailGeometry.setAttribute('aTaper', new THREE.BufferAttribute(tailTapers, 1));

    const tailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x88ccff) },
        uBrightness: { value: 1.0 },
        uSizeScale: { value: 2.0 }
      },
      vertexShader: `
        attribute float aTaper;
        varying float vTaper;
        uniform float uSizeScale;
        void main() {
          vTaper = aTaper;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aTaper * uSizeScale * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uBrightness;
        varying float vTaper;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = (1.0 - d * 2.0) * vTaper;
          gl_FragColor = vec4(uColor * uBrightness, alpha * 0.6);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const tailPoints = new THREE.Points(tailGeometry, tailMaterial);
    tailPoints.visible = false;
    tailPoints.renderOrder = 100;
    scene.add(tailPoints);

    starRainRef.current = {
      headPoints,
      tailPoints,
      positions: starRainPositions,
      velocities: starRainVelocities,
      ages: starRainAges,
      maxAges: starRainMaxAges,
      sizes: starRainSizes,
      histories: starRainHistories,
      maxCount: starRainMaxCount,
      trailLength: starRainTrailLen
    };

    // 2. 雿梶妖��㦛嚗�㺿餈𤤿�嚗?D�芸ㄟ��䲮�烐�扳袇撠�����滩※�𧶏�
    const volumeFogGroup = new THREE.Group();
    volumeFogGroup.visible = false;
    const fogLayerCount = 9;
    const fogMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.12 },
        uColor: { value: new THREE.Color(0x4488cc) },
        uLayerIndex: { value: 0 },
        uNoiseOffset: { value: 0 },
        uNoiseScale: { value: 1.0 },
        uInnerRadius: { value: 50 },
        uOuterRadius: { value: 180 },
        uPhaseG: { value: 2.5 },
        uCurlAmp: { value: 0.08 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vRadius;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          // 雿輻鍂銝𣇉��鞉�霈∠��𠰴�嚗諹��瑞憬�曉����雿蓥��賣迤蝖桀極雿?
          vRadius = length(worldPosition.xy);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uColor;
        uniform float uLayerIndex;
        uniform float uNoiseOffset;
        uniform float uNoiseScale;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        uniform float uPhaseG;
        uniform float uCurlAmp;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vRadius;
        
        // �寡���臁憯啣遆�?
        float hash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yxz + 19.19);
          return fract((p.x + p.y) * p.z);
        }
        
        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float n = mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
          return n;
        }
        
        // 3D FBM
        float fbm3D(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          vec3 shift = vec3(100.0);
          for (int i = 0; i < 4; i++) {
            v += a * noise3D(p);
            p = p * 2.0 + shift;
            a *= 0.5;
          }
          return v;
        }
        
        // Curl�芸ㄟ蝞��𣇉�
        vec2 curlNoise(vec3 p) {
          float eps = 0.01;
          float n1 = noise3D(p + vec3(eps, 0.0, 0.0));
          float n2 = noise3D(p - vec3(eps, 0.0, 0.0));
          float n3 = noise3D(p + vec3(0.0, eps, 0.0));
          float n4 = noise3D(p - vec3(0.0, eps, 0.0));
          return vec2(n3 - n4, n1 - n2) / (2.0 * eps);
        }
        
        void main() {
          // 3D��甅�鞉�
          vec3 samplePos = vec3(
            vWorldPos.x * 0.01 * uNoiseScale,
            vWorldPos.z * 0.01 * uNoiseScale,
            uLayerIndex * 0.3 + uNoiseOffset
          );
          
          // Curl敶Ｗ�
          vec2 curl = curlNoise(samplePos * 2.0 + uTime * 0.05) * uCurlAmp;
          samplePos.xy += curl;
          
          // 3D FBM�芸ㄟ
          float n = fbm3D(samplePos * 3.0 + uTime * 0.08);
          
          // 敺��銵啣�嚗�蝙�函㮾撖孵�潘�隞𦒘葉敹��憭𡝗楚�綽�颲寧�30%�箏�皜𣂼�嚗?
          float radialFade = 1.0 - smoothstep(uOuterRadius * 0.7, uOuterRadius, vRadius);
          
          // 蝘駁膄擃睃漲銵啣��𣂼�嚗諹悟��㦛�其�銝芸像�ａ��賣迤撣豢遬蝷?
          float heightFade = 1.0;
          
          // �孵��扳袇撠��HG�詨遆�啗�隡潘�
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3)); // 銝餃��孵�
          float phase = pow(max(dot(viewDir, lightDir), 0.0), uPhaseG);
          float scatter = 0.6 + 0.4 * phase;
          
          // �嘥臁�硋𢆡�堒蒂�?
          float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          float ditherMix = 0.98 + 0.02 * dither;
          
          // ��蝏��𤩺�摨?
          float alpha = uOpacity * n * radialFade * heightFade * scatter * ditherMix;
          alpha = clamp(alpha, 0.0, 0.3);
          
          // 憸𡏭𠧧�誯�摨血凝靚���滢�鈭桀漲�踹�閫血�bloom
          vec3 color = uColor * (0.4 + 0.1 * phase);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });

    // �凋葵撟喲𢒰����橘�XZ��Y��Z + 銝劐葵45摨行��?
    const planes = [
      { axis: 'xz', rotX: -Math.PI / 2, rotY: 0 },                    // 瘞游像�°Z
      { axis: 'xy', rotX: 0, rotY: 0 },                                // �滚��°Y
      { axis: 'yz', rotX: 0, rotY: Math.PI / 2 },                      // 撌血𢰧�兙Z
      { axis: 'xz45', rotX: -Math.PI / 4, rotY: 0 },                   // XZ撟喲𢒰45摨血�暹�
      { axis: 'xy45', rotX: 0, rotY: Math.PI / 4 },                    // XY撟喲𢒰45摨血�暹�
      { axis: 'yz45', rotX: Math.PI / 4, rotY: Math.PI / 2 }           // YZ撟喲𢒰45摨血�暹�
    ];

    for (const plane of planes) {
      for (let i = 0; i < fogLayerCount; i++) {
        const fogGeometry = new THREE.CircleGeometry(1, 64); // 雿輻鍂��耦嚗峕����敺?
        const fogMesh = new THREE.Mesh(fogGeometry, fogMaterial.clone());
        fogMesh.rotation.x = plane.rotX;
        fogMesh.rotation.y = plane.rotY;

        // �寞旿撟喲𢒰�孵�霈曄蔭雿滨蔭�讐宏
        const offset = i * 18 - 40;
        if (plane.axis === 'xz') {
          fogMesh.position.y = offset;
        } else if (plane.axis === 'xy') {
          fogMesh.position.z = offset;
        } else if (plane.axis === 'yz') {
          fogMesh.position.x = offset;
        } else if (plane.axis === 'xz45') {
          fogMesh.position.y = offset * 0.7;
          fogMesh.position.z = offset * 0.7;
        } else if (plane.axis === 'xy45') {
          fogMesh.position.z = offset * 0.7;
          fogMesh.position.x = offset * 0.7;
        } else if (plane.axis === 'yz45') {
          fogMesh.position.x = offset * 0.7;
          fogMesh.position.y = offset * 0.7;
        }

        fogMesh.userData.layerIndex = i;
        fogMesh.userData.planeAxis = plane.axis;

        // 瘥誩��祉���㺭
        const mat = fogMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uLayerIndex.value = i;
        mat.uniforms.uNoiseOffset.value = i * 0.5 + Math.random() * 0.3;
        mat.uniforms.uNoiseScale.value = 1.0 + i * 0.1;
        // 憭硋��𤩺�摨行凒雿?
        mat.uniforms.uOpacity.value = 0.12 - i * 0.01;
        volumeFogGroup.add(fogMesh);
      }
    }
    scene.add(volumeFogGroup);
    volumeFogRef.current = volumeFogGroup;

    // 3. �厩��舐狩
    const lightOrbsGroup = new THREE.Group();
    lightOrbsGroup.visible = false;
    scene.add(lightOrbsGroup);
    lightOrbsRef.current = {
      group: lightOrbsGroup,
      orbs: [],
      lastSpawnTime: 0
    };

    // 4. �蠘劓蝏睃㦛頧刻蕨蝎鍦�蝟餌�
    const drawingTrailMaxCount = 2000;
    const drawingTrailPositions = new Float32Array(drawingTrailMaxCount * 3);
    const drawingTrailColors = new Float32Array(drawingTrailMaxCount * 3);
    const drawingTrailSizes = new Float32Array(drawingTrailMaxCount);
    const drawingTrailAges = new Float32Array(drawingTrailMaxCount);

    const drawingTrailGeometry = new THREE.BufferGeometry();
    drawingTrailGeometry.setAttribute('position', new THREE.BufferAttribute(drawingTrailPositions, 3));
    drawingTrailGeometry.setAttribute('color', new THREE.BufferAttribute(drawingTrailColors, 3));
    drawingTrailGeometry.setAttribute('size', new THREE.BufferAttribute(drawingTrailSizes, 1));
    drawingTrailGeometry.setAttribute('age', new THREE.BufferAttribute(drawingTrailAges, 1)); // 瘛餃� age 撅墧�?

    const drawingTrailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float age;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vAge;
        uniform float uTime;
        
        void main() {
          vColor = color;
          vAge = age;
          
          // 蝎鍦��𤩺𧒄�湔��?
          vec3 pos = position;
          
          // 瘛餃�瘚�𢆡���Curl Noise璅⊥�嚗?
          float flowSpeed = 20.0;
          float flowScale = 0.05;
          float noise = sin(pos.x * flowScale + uTime * 2.0) * cos(pos.z * flowScale + uTime) * sin(pos.y * flowScale);
          
          pos.x += noise * 10.0 * (1.0 - age); // 頞𦠜鰵���摮鞉��刻�撘?
          pos.y += sin(uTime * 3.0 + age * 10.0) * 5.0;
          
          vAlpha = smoothstep(0.0, 0.2, age) * smoothstep(1.0, 0.6, age);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z) * (0.5 + 0.5 * sin(uTime * 5.0 + age * 20.0));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vAge;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          // �詨��㗇�
          float glow = exp(-dist * dist * 10.0);
          
          // 颲寧��㗇�
          float halo = smoothstep(0.5, 0.2, dist) * 0.5;
          
          // 憸𡏭𠧧憓𧼮撩 (�笔��芰�)
          vec3 finalColor = vColor + vec3(0.5) * glow;
          
          gl_FragColor = vec4(finalColor, (glow + halo) * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const drawingTrailPoints = new THREE.Points(drawingTrailGeometry, drawingTrailMaterial);
    drawingTrailPoints.visible = false;
    scene.add(drawingTrailPoints);

    drawingTrailRef.current = {
      points: drawingTrailPoints,
      positions: drawingTrailPositions,
      colors: drawingTrailColors,
      sizes: drawingTrailSizes,
      ages: drawingTrailAges,
      activeCount: 0,
      maxCount: drawingTrailMaxCount,
      lastDrawPos: new THREE.Vector3(),
      isDrawing: false
    };

    // 5. �抵捶��𠧧����嘥��?
    slashEffectRef.current = {
      active: false,
      startTime: 0,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      healProgress: 1
    };

    // �滚�撘?
    const handleResize = () => {
      if (!container || !camera || !renderer || !composer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ��扇�箸艶�嘥��硋��?
    setSceneReady(true);

    // 皜��
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (composerRef.current) {
        const composerAny = composerRef.current as any;
        if (Array.isArray(composerAny.passes)) {
          composerAny.passes.forEach((p: any) => {
            if (typeof p?.dispose === 'function') p.dispose();
          });
        }
        if (typeof composerAny.dispose === 'function') {
          composerAny.dispose();
        } else {
          if (composerAny.renderTarget1?.dispose) composerAny.renderTarget1.dispose();
          if (composerAny.renderTarget2?.dispose) composerAny.renderTarget2.dispose();
        }
        composerRef.current = null;
      }
      bloomPassRef.current = null;
      afterimagePassRef.current = null;
      chromaticPassRef.current = null;
      vignettePassRef.current = null;

      if (textureCache.current) {
        textureCache.current.forEach((tex) => {
          try {
            tex.dispose();
          } catch {
          }
        });
        textureCache.current.clear();
      }

      if (backgroundTextureRef.current) {
        backgroundTextureRef.current.dispose();
        backgroundTextureRef.current = null;
      }

      if (shapeTextureRef.current) {
        shapeTextureRef.current.dispose();
        shapeTextureRef.current = null;
      }

      const disposedGeometries = new Set<any>();
      const disposedMaterials = new Set<any>();
      const disposedTextures = new Set<any>();

      const disposeTexture = (t: any) => {
        if (!t || disposedTextures.has(t) || typeof t.dispose !== 'function') return;
        disposedTextures.add(t);
        t.dispose();
      };

      const disposeMaterial = (m: any) => {
        if (!m || disposedMaterials.has(m) || typeof m.dispose !== 'function') return;
        disposedMaterials.add(m);
        try {
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) {
              disposeTexture(v);
            }
          }
        } catch {
        }
        m.dispose();
      };

      scene.traverse((obj: any) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function' && !disposedGeometries.has(obj.geometry)) {
          disposedGeometries.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(disposeMaterial);
          } else {
            disposeMaterial(obj.material);
          }
        }
      });

      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;

      starRainRef.current = null;
      volumeFogRef.current = null;
      lightOrbsRef.current = null;
      drawingTrailRef.current = null;
      slashEffectRef.current = null;
      backgroundSphereRef.current = null;

      nebulaPointsRef.current = null;
      nebulaMaterialRef.current = null;
      nebulaPointsOutsideRef.current = null;
      nebulaMaterialOutsideRef.current = null;
      nebulaInstancePointsRef.current.clear();
      nebulaInstanceMaterialsRef.current.clear();
      nebulaInstancePointsOutsideRef.current.clear();
      nebulaInstanceMaterialsOutsideRef.current.clear();

      overlayStencilMeshesRef.current.forEach((mesh) => {
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      });
      overlayStencilMeshesRef.current.clear();

      renderer.dispose();
      rendererRef.current = null;
      if (renderer.domElement && renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      setSceneReady(false);
    };
  }, []);

  // 雿輻鍂 ref 摮睃� settings嚗屸��滚𢆡�餃儐�舫�撱?
  // 瘜冽�嚗𡁶凒�亙銁皜脫��嗅�甇交凒�郢ef嚗𣬚＆靽嘥𢆡�餃儐�舀�餅糓�質粉�硋����啣�?
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // �见飵���撟單�餈�腹�?
  const smoothedValuesRef = useRef({
    explosion: 0,
    blackHole: 0,
    handActive: 0
  });

  // �嗆眾蝏睃㦛頧刻蕨蝟餌�
  const trailRef = useRef<THREE.Vector3[]>([]);
  const lastTrailTimeRef = useRef(0);

  // ����毺��牐�雿梶㮾�喳��啁� hash key嚗��鈭𥕦��啣��㚚�閬��撱箏�雿蓥�嚗?
  // ����牐�雿枏��袁ey
  const generateGeometryKey = (planets: typeof settings.planets, soloCoreId: string | null | undefined) => {
    // ��鉄�典��批���㺭
    const globalKey = `solo:${soloCoreId || 'none'}`;

    const planetsKey = planets.map(p => {
      // �毺��箇�靽⊥�
      const planetBaseKey = `id:${p.id}:enabled:${p.enabled}`;

      // �詨�蝐餃�嚗�蛹�扳㺭�格�靘偦�霈文�潔��歹�
      const coreSystem = p.coreSystem;
      const coreTypeKey = `type:${coreSystem?.coreType || 'particle'}`;

      // 摰硺��詨���㺭嚗��摰硺�嚗?
      const solidCores = coreSystem?.solidCores || (coreSystem?.solidCore ? [coreSystem.solidCore] : []);
      const solidCoreKey = `solidEnabled:${coreSystem?.solidCoresEnabled ?? true}|` + solidCores.map(sc =>
        `${sc.id}:${sc.enabled}:${sc.radius ?? 100}:${sc.hue ?? 0}:${sc.saturation ?? 1}:${sc.lightness ?? 0.5}:${sc.scale ?? 3}:${sc.speed ?? 0.5}:${sc.contrast ?? 3}:${sc.bandMix ?? 0}:${sc.ridgeMix ?? 0}:${sc.gridMix ?? 0}:${sc.opacity ?? 1}:${sc.brightness ?? 1}:${sc.glowHue ?? 0.5}:${sc.glowSaturation ?? 1}:${sc.glowLength ?? 2}:${sc.glowStrength ?? 1}:${sc.glowRadius ?? 0.2}:${sc.glowFalloff ?? 2}:${sc.glowInward ?? false}:${sc.glowBloomBoost ?? 1}`
      ).join('|');

      // 蝎鍦��詨���㺭 - �舀�憭𡁏瓲敹����鉄�典�撘��?
      const cores = coreSystem?.cores || [];
      const coresKey = `enabled:${coreSystem?.coresEnabled ?? true}|` + cores.map(c => {
        const g = c.gradientColor;
        const gradKey = g?.enabled ?
          `${g.mode}:${g.colors?.join(',')}:${g.colorMidPosition}:${g.colorMidWidth ?? 1}:${g.colorMidWidth2 ?? 0}:${g.direction}:${g.directionCustom?.x},${g.directionCustom?.y},${g.directionCustom?.z}:${g.spiralDensity}:${g.spiralAxis}:${g.proceduralAxis}:${g.proceduralCustomAxis?.x},${g.proceduralCustomAxis?.y},${g.proceduralCustomAxis?.z}:${g.proceduralIntensity}` :
          '';
        return `${c.id}:${c.enabled}:${c.fillMode}:${c.fillPercent}:${c.density}:${c.baseRadius}:${c.baseHue}:${c.baseSaturation ?? 1}:${c.gradientColor?.enabled}:${gradKey}:${c.brightness}:${c.particleSize}:${c.trailLength ?? 0}`;
      }).join('|');
      // �臬��?- 雿輻鍂蝏嘥笆�𠰴�摮埈挾, brightness, particleSize嚗���怠�撅�撘��喳�摰峕㟲憸𡏭𠧧璅∪�
      const ringsKey = `pr:${p.rings.particleRingsEnabled}|` + p.rings.particleRings.map(r => {
        const g = r.gradientColor;
        const gKey = g?.enabled ? `${g.mode}:${g.colors?.join(',')}:${g.colorMidPosition}:${g.colorMidWidth ?? 1}:${g.colorMidWidth2 ?? 0}:${g.direction}:${g.directionCustom?.x},${g.directionCustom?.y},${g.directionCustom?.z}:${g.spiralDensity}:${g.proceduralIntensity}` : '';
        const v = r.vortex;
        const vKey = v?.enabled ? `${v.armCount}:${v.twist}:${v.hardness}:${v.colors?.join(',')}` : '';
        return `${r.id}:${r.enabled}:${r.eccentricity}:${r.absoluteRadius}:${r.particleDensity}:${r.bandwidth}:${r.thickness}:${r.color}:${r.brightness}:${r.particleSize}:${r.tilt?.axis}:${r.tilt?.angle}:${r.trailLength ?? 0}:${r.rotationSpeed}:${r.orbitAxis?.axis}:${r.orbitAxis?.angle}:${g?.enabled}:${gKey}:${v?.enabled}:${vKey}`;
      }).join('|') + `/cr:${p.rings.continuousRingsEnabled}|` + p.rings.continuousRings.map(r => {
        const g = r.gradientColor;
        const gKey = g?.enabled ? `${g.mode}:${g.colors?.join(',')}:${g.colorMidPosition}:${g.colorMidWidth ?? 1}:${g.colorMidWidth2 ?? 0}:${g.direction}:${g.directionCustom?.x},${g.directionCustom?.y},${g.directionCustom?.z}:${g.spiralDensity}:${g.proceduralIntensity}` : '';
        const v = r.vortex;
        const vKey = v?.enabled ? `${v.armCount}:${v.twist}:${v.rotationSpeed}:${v.radialDirection}:${v.radialSpeed}:${v.hardness}:${v.colors?.join(',')}` : '';
        return `${r.id}:${r.enabled}:${r.eccentricity}:${r.absoluteInnerRadius}:${r.absoluteOuterRadius}:${r.color}:${r.opacity}:${r.opacityGradient}:${r.opacityGradientStrength ?? 0.5}:${r.brightness}:${r.tilt?.axis}:${r.tilt?.angle}:${r.rotationSpeed}:${r.orbitAxis?.axis}:${r.orbitAxis?.angle}:${g?.enabled}:${gKey}:${v?.enabled}:${vKey}`;
      }).join('|');
      // 颲𣂼���㺭 - �舀�憭帋葵嚗���怠�撅�撘��?
      // 瘜冽�嚗𡁶�摮𣂼𪃾撠���冽����堆�emissionRangeMin/Max, fadeOutStrength蝑㚁��典𢆡�餃儐�臭葉摰墧𧒄霂餃�嚗䔶���閬�𦆮�?geometryKey
      const radKey = `orb:${p.radiation.orbitingEnabled}|` + p.radiation.orbitings.map(o =>
        `${o.id}:${o.enabled}:${o.particleDensity}:${o.orbitRadius}:${o.thickness}:${o.color}:${o.brightness}:${o.particleSize}:${o.baseSpeed}:${o.mainDirection?.x},${o.mainDirection?.y},${o.mainDirection?.z}:${o.fadeStrength}`
      ).join('|') + `/emit:${p.radiation.emitterEnabled}|` + p.radiation.emitters.map(e =>
        `${e.id}:${e.enabled}`
      ).join('|');
      // 瘚�𨫡��㺭 - 雿輻鍂蝏嘥笆�𠰴�摮埈挾, brightness嚗���怠�撅�撘��?
      const fireflyKey = `orb:${p.fireflies.orbitingEnabled}|` + p.fireflies.orbitingFireflies.map(f =>
        `${f.id}:${f.enabled}:${f.size}:${f.absoluteOrbitRadius}:${f.color}:${f.trailEnabled}:${f.trailLength}:${f.brightness}`
      ).join('|') + `/wander:${p.fireflies.wanderingEnabled}|` + p.fireflies.wanderingGroups.map(g =>
        `${g.id}:${g.enabled}:${g.count}:${g.size}:${g.color}:${g.brightness}`
      ).join('|');
      // 瘜閖猐��㺭
      const magicCircleKey = `mc:${p.magicCircles?.enabled ?? false}|` + (p.magicCircles?.circles || []).map(c =>
        `${c.id}:${c.enabled}:${c.texture}:${c.radius}`
      ).join('|');
      // �賡�雿枏��?- �芸��急��𤑳㮾�喳��堆��牐�雿梶����嚗峕甅撘誯�朞� uniforms �峕郊
      // �𤘪���㺭嚗䮝olyhedronType, radius, subdivisionLevel, spherize, renderMode
      // 憿嗥�撘��?敶Ｙ𠶖���憯喳��喋��oronoi �滨蔭隡𡁜蔣�?mesh �𥕦遣
      // �瑕���㺭嚗Ếolor, opacity, glowIntensity 蝑㚁�銝滚銁甇文�嚗屸�朞� uniforms �冽��凒�?
      const energyBodyKey = `eb:${p.energyBodySystem?.enabled ?? false}|` + (p.energyBodySystem?.energyBodies || []).map(e =>
        `${e.id}:${e.enabled}:${e.polyhedronType}:${e.radius}:${e.subdivisionLevel}:${e.spherize}:${e.renderMode}:` +
        `vertex:${e.vertexEffect?.enabled}:${e.vertexEffect?.shape}:` +
        `shell:${e.shellEffect?.enabled}:` +
        `voronoi:${e.sphericalVoronoi?.enabled}:${e.sphericalVoronoi?.cellCount}:${e.sphericalVoronoi?.seedDistribution}:` +
        `lightflow:${e.lightFlow?.enabled}:${e.lightFlow?.pathMode}:${e.lightFlow?.count}`  // �㗇��舐鍂�嗆��蔣�滚㦛��遣
      ).join('|');
      // �怎�蝟餌���㺭 - ��閬��撱箏�雿蓥�����?
      const flameSystem = p.flameSystem;
      const flameKey = `flame:${flameSystem?.enabled ?? false}|` +
        `surface:` + (flameSystem?.surfaceFlames || []).map(f => `${f.id}:${f.enabled}:${f.radius}`).join(',') + '|' +
        `jet:` + (flameSystem?.flameJets || []).map(j => `${j.id}:${j.enabled}:${j.particleCount}:${j.sourceType}:${j.hotspotCount}`).join(',') + '|' +
        `spiral:` + (flameSystem?.spiralFlames || []).map(s => `${s.id}:${s.enabled}:${s.particleCount}:${s.spiralCount}`).join(',');
      // 畾见蔣蝟餌���㺭 - �舐鍂�嗆����箏��滨蔭�睃���閬��撱?
      const afterimageSystem = p.afterimageSystem;
      const afterimageKey = `afterimage:${afterimageSystem?.enabled ?? false}|` +
        `texture:${afterimageSystem?.texture?.enabled ?? false}|` +
        `particles:${afterimageSystem?.particles?.enabled ?? false}|` +
        `zones:` + (afterimageSystem?.zones || []).map(z =>
          `${z.id}:${z.enabled}:${z.startAngle}:${z.angleSpan}:${z.sideLineLength}:${z.sideLineAngle}:${z.sideLineType}:${z.curveBendDirection}:${z.curveBendStrength}:${z.outerBoundaryShape}`
        ).join(',');
      return `${planetBaseKey}#${coreTypeKey}#${solidCoreKey}#${coresKey}#${ringsKey}#${radKey}#${fireflyKey}#${magicCircleKey}#${energyBodyKey}#${flameKey}#${afterimageKey}`;
    }).join(',');

    return `${globalKey}@${planetsKey}`;
  };

  const geometryKey = generateGeometryKey(settings.planets, settings.soloCoreId);
  const lastGeometryKeyRef = useRef<string>('');

  // �寞旿霈曄蔭�𥕦遣/�湔鰵�毺�
  useEffect(() => {
    if (!sceneRef.current || !sceneReady) return;

    const scene = sceneRef.current;
    // �湔𦻖雿輻鍂 settings 蝖桐��瑕����啣�潘���𡠺 soloCoreId嚗?
    const currentSettings = settings;

    // 璉�瘚见�雿蓥���㺭�睃�
    const needsRebuild = geometryKey !== lastGeometryKeyRef.current;

    // ��閬��撱箸𧒄
    if (needsRebuild || planetMeshesRef.current.size === 0) {
      lastGeometryKeyRef.current = geometryKey;

      // 皜�膄�唳��毺�
      planetMeshesRef.current.forEach((meshes) => {
        // �𦠜𦆮韏�� - 蝏煺�雿輻鍂�鍦��滚�蝖桐����匧�憟堒笆鞊⊿�鋡恍��?
        const disposeAndClearGroup = (group: THREE.Object3D) => {
          // �������曇�皞?
          group.traverse((obj: any) => {
            if (obj.geometry) {
              obj.geometry.dispose();
              obj.geometry = null;
            }
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m: THREE.Material) => m.dispose());
              } else {
                obj.material.dispose();
              }
              obj.material = null;
            }
          });
          // �鍦�蝘駁膄���匧�撖寡情
          while (group.children.length > 0) {
            const child = group.children[0];
            if (child.children && child.children.length > 0) {
              disposeAndClearGroup(child);
            }
            group.remove(child);
          }
        };

        // ����曉�皜�征嚗��隞𤾸㦤�舐宏�?
        disposeAndClearGroup(meshes.core);
        disposeAndClearGroup(meshes.flames);
        disposeAndClearGroup(meshes.rings);
        disposeAndClearGroup(meshes.radiation);
        disposeAndClearGroup(meshes.fireflies);
        disposeAndClearGroup(meshes.magicCircles);
        disposeAndClearGroup(meshes.energyBodies);

        scene.remove(meshes.core);
        scene.remove(meshes.flames);
        scene.remove(meshes.rings);
        scene.remove(meshes.radiation);
        scene.remove(meshes.fireflies);
        scene.remove(meshes.magicCircles);
        scene.remove(meshes.energyBodies);
      });
      planetMeshesRef.current.clear();

      // �𥕦遣�唳��?
      currentSettings.planets.forEach(planet => {
        if (!planet.enabled) return;

        const meshes = createPlanetMeshes(planet, currentSettings);
        planetMeshesRef.current.set(planet.id, meshes);

        // 霈曄蔭雿滨蔭
        const pos = planet.position;
        meshes.core.position.set(pos.x, pos.y, pos.z);
        meshes.flames.position.set(pos.x, pos.y, pos.z);
        meshes.rings.position.set(pos.x, pos.y, pos.z);
        meshes.radiation.position.set(pos.x, pos.y, pos.z);
        meshes.fireflies.position.set(pos.x, pos.y, pos.z);
        meshes.magicCircles.position.set(pos.x, pos.y, pos.z);
        meshes.energyBodies.position.set(pos.x, pos.y, pos.z);

        // 霈曄蔭蝻拇𦆮
        meshes.core.scale.setScalar(planet.scale);
        meshes.flames.scale.setScalar(planet.scale);
        meshes.rings.scale.setScalar(planet.scale);
        meshes.radiation.scale.setScalar(planet.scale);
        meshes.fireflies.scale.setScalar(planet.scale);
        meshes.magicCircles.scale.setScalar(planet.scale);
        meshes.energyBodies.scale.setScalar(planet.scale);

        scene.add(meshes.core);
        scene.add(meshes.flames);
        scene.add(meshes.rings);
        scene.add(meshes.radiation);
        scene.add(meshes.fireflies);
        scene.add(meshes.magicCircles);
        scene.add(meshes.energyBodies);
      });
    } else {
      // �芣凒�唬�蝵桀�蝻拇𦆮嚗��鈭𥕢���閬��撱箏�雿蓥�嚗?
      currentSettings.planets.forEach(planet => {
        const meshes = planetMeshesRef.current.get(planet.id);
        if (meshes) {
          const pos = planet.position;
          meshes.core.position.set(pos.x, pos.y, pos.z);
          meshes.flames.position.set(pos.x, pos.y, pos.z);
          meshes.rings.position.set(pos.x, pos.y, pos.z);
          meshes.radiation.position.set(pos.x, pos.y, pos.z);
          meshes.fireflies.position.set(pos.x, pos.y, pos.z);
          meshes.magicCircles.position.set(pos.x, pos.y, pos.z);
          meshes.energyBodies.position.set(pos.x, pos.y, pos.z);

          meshes.core.scale.setScalar(planet.scale);
          meshes.flames.scale.setScalar(planet.scale);
          meshes.rings.scale.setScalar(planet.scale);
          meshes.radiation.scale.setScalar(planet.scale);
          meshes.fireflies.scale.setScalar(planet.scale);
          meshes.magicCircles.scale.setScalar(planet.scale);
          meshes.energyBodies.scale.setScalar(planet.scale);
        }
      });
    }
  }, [geometryKey, settings, sceneReady]);

  // 更新后处理参数
  useEffect(() => {
    // 检测移动设备
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (bloomPassRef.current) {
      // 互通模式下使用独立的overlayBloomStrength控制Bloom
      if (overlayMode && nebulaSettings) {
        const overlayBloom = nebulaSettings.overlayBloomStrength ?? 1.0;
        bloomPassRef.current.strength = isMobile ? Math.min(overlayBloom, 1.0) : overlayBloom;
        bloomPassRef.current.threshold = 0;
        bloomPassRef.current.radius = isMobile ? 0.3 : 0.5;
      } else {
        bloomPassRef.current.strength = isMobile ? Math.min(settings.bloomStrength, 1.0) : settings.bloomStrength;
      }
    }
    if (afterimagePassRef.current) {
      // 互通模式下使用星云的拖尾设置
      if (overlayMode && nebulaSettings) {
        afterimagePassRef.current.uniforms['damp'].value = nebulaSettings.trailEnabled ? (0.9 + nebulaSettings.trailLength * 0.08) : 0;
      } else {
        afterimagePassRef.current.uniforms['damp'].value = settings.trailEnabled ? settings.trailLength : 0;
      }
    }
  }, [settings.bloomStrength, settings.trailEnabled, settings.trailLength, overlayMode, nebulaSettings?.overlayBloomStrength, nebulaSettings?.trailEnabled, nebulaSettings?.trailLength]);

  // 侧边栏展开时调整相机目标点，使场景内容在左侧可见区域居中
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current || !containerRef.current) return;

    const controls = controlsRef.current;
    const container = containerRef.current;

    // 控制面板宽度为320px，计算偏移量
    const sidebarWidth = 320;

    // 计算需要偏移的世界坐标距离
    const camera = cameraRef.current;
    const distance = camera.position.distanceTo(controls.target);
    const fovRad = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
    const pixelToWorld = visibleHeight / container.clientHeight;

    // 偏移量：侧边栏宽度的一半对应的世界坐标，乘以1.2使其更靠左
    const offsetX = sidebarOpen ? (sidebarWidth / 2) * pixelToWorld * 1.2 : 0;

    // 相机目标点向右偏移，使场景内容在屏幕上向左显示
    controls.target.x = offsetX;

  }, [sidebarOpen]);

  // Handle OrbitControls state based on Draw Mode
  useEffect(() => {
    if (controlsRef.current) {
      // If drawing is enabled, disable camera controls to allow painting
      controlsRef.current.enabled = !drawSettings?.enabled;
    }
  }, [drawSettings?.enabled]);

  // 湔鰵峕艶霈曄蔭
  useEffect(() => {
    const bgSphere = backgroundSphereRef.current;
    if (!bgSphere) return;

    const bgSettings = settings.background;
    const mat = bgSphere.material as THREE.ShaderMaterial;

    // �惩�璅∪�銝见�蝏�蝙�券�𤩺��峕艶
    // 互通模式下也支持背景球体，只需确保scene.background为null
    if (overlayMode) {
      if (sceneRef.current) {
        sceneRef.current.background = null;
      }
      // 继续处理背景球体的显示逻辑，不直接return
    }

    if (!bgSettings?.enabled) {
      // 蝳�鍂�峕艶�嗆遬蝷箇滲暺?
      bgSphere.visible = false;
      if (sceneRef.current) {
        sceneRef.current.background = new THREE.Color(0x000000);
      }
      return;
    }

    // �舐鍂�峕艶
    bgSphere.visible = true;
    if (sceneRef.current) {
      sceneRef.current.background = null; // 皜�膄蝥航𠧧�峕艶
    }

    // �湔鰵�贝蓮
    bgSphere.rotation.y = (bgSettings.rotation || 0) * Math.PI / 180;

    // �湔鰵 uniforms
    mat.uniforms.uBrightness.value = bgSettings.brightness ?? 1.0;
    mat.uniforms.uSaturation.value = bgSettings.saturation ?? 1.0;

    // �㰘蝸�𡝗凒�啗斐�?
    const currentUrl = mat.userData?.panoramaUrl;

    if (bgSettings.panoramaUrl && bgSettings.panoramaUrl !== currentUrl) {
      // ��閬��頧賣鰵韐游㦛
      const loader = new THREE.TextureLoader();
      loader.load(
        bgSettings.panoramaUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          // 撖嫣��冽艶�曄�雿橒�雿輻鍂暺䁅恕 UV �惩��喳虾
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;

          mat.uniforms.uTexture.value = texture;
          mat.needsUpdate = true;
          mat.userData = { panoramaUrl: bgSettings.panoramaUrl };

          // �𦠜𦆮�扯斐�?
          if (backgroundTextureRef.current) {
            backgroundTextureRef.current.dispose();
          }
          backgroundTextureRef.current = texture;

          console.log('Panorama loaded successfully:', bgSettings.panoramaUrl);
        },
        undefined,
        (error) => {
          console.error('Failed to load panorama:', bgSettings.panoramaUrl, error);
        }
      );
    }
  }, [settings.background?.enabled, settings.background?.panoramaUrl, settings.background?.brightness, settings.background?.saturation, settings.background?.rotation, overlayMode]);

  // �函𤫇敺芰㴓 - �芸銁��蝸�嗅�撱箔�甈?
  useEffect(() => {
    let lastFrameTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // 撣抒��𣂼�
      const deltaTime = currentTime - lastFrameTime;
      if (deltaTime < frameInterval) return;
      lastFrameTime = currentTime - (deltaTime % frameInterval);

      const time = clockRef.current.getElapsedTime();
      const currentSettings = settingsRef.current;

      // �湔鰵�批��?
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // �湔鰵�煺�蝎鍦�蝟餌�嚗���𡁏芋撘𧶏�
      if (nebulaMaterialRef.current) {
        nebulaMaterialRef.current.uniforms.uTime.value = time;
        // �峕郊�见飵����唳�鈭𡢅��典��Ｚ恣蝞堒�撟單��澆��湔鰵嚗?
      }
      if (nebulaMaterialOutsideRef.current) {
        nebulaMaterialOutsideRef.current.uniforms.uTime.value = time;
      }

      // �湔鰵憭𡁏�鈭穃�靘讠�uniforms嚗���𡁏芋撘𧶏�
      nebulaInstanceMaterialsRef.current.forEach((mat) => {
        mat.uniforms.uTime.value = time;
      });
      nebulaInstanceMaterialsOutsideRef.current.forEach((mat) => {
        mat.uniforms.uTime.value = time;
      });

      // === 霈∠��祈蓮雿滨蔭 ===
      // 雿輻鍂 Map 摮睃�瘥譍葵�毺���恣蝞堒�雿滨蔭嚗�����曉��祈蓮嚗?
      const computedPositions = new Map<string, THREE.Vector3>();

      // �鍦�霈∠��毺�雿滨蔭嚗����曎撘誩�頧穿�
      const computePlanetPosition = (planetId: string): THREE.Vector3 => {
        // 憒��撌脰恣蝞𡑒�嚗𣬚凒�亥��?
        if (computedPositions.has(planetId)) {
          return computedPositions.get(planetId)!;
        }

        const planet = currentSettings.planets.find(p => p.id === planetId);
        if (!planet) {
          const pos = new THREE.Vector3(0, 0, 0);
          computedPositions.set(planetId, pos);
          return pos;
        }

        // �箇�雿滨蔭
        const basePos = new THREE.Vector3(planet.position.x, planet.position.y, planet.position.z);

        // 璉��交糓�行��祈蓮�滨蔭
        const orbit = planet.orbit;
        if (!orbit?.enabled) {
          computedPositions.set(planetId, basePos);
          return basePos;
        }

        // �瑕��祈蓮銝剖�嚗�𤌍�������箇�雿滨蔭�硋��對�
        let centerPos = new THREE.Vector3(0, 0, 0);
        if (orbit.targetPlanetId) {
          const targetPlanet = currentSettings.planets.find(p => p.id === orbit.targetPlanetId);
          if (targetPlanet) {
            // 雿輻鍂�格��毺���抅蝖�雿滨蔭雿靝蛹�祈蓮銝剖�
            centerPos = new THREE.Vector3(targetPlanet.position.x, targetPlanet.position.y, targetPlanet.position.z);
            // 憒���格��毺�銋笔銁�祈蓮嚗��雿輻鍂�嗉恣蝞堒����蝵?
            if (targetPlanet.orbit?.enabled) {
              centerPos = computePlanetPosition(orbit.targetPlanetId);
            }
          }
        }

        // 霈∠��祈蓮�𠰴�嚗帋蝙�典��齿�����格�銝剖����憪贝�蝳?
        const dx = basePos.x - centerPos.x;
        const dy = basePos.y - centerPos.y;
        const dz = basePos.z - centerPos.z;
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 憒��頝萘氖銝?嚗䔶蝙�券�霈文�敺?
        const orbitRadius = distanceToCenter > 1 ? distanceToCenter : orbit.orbitRadius;

        // 霈∠�璊剖�頧券�雿滨蔭
        const angle = (time * orbit.orbitSpeed + THREE.MathUtils.degToRad(orbit.initialPhase));
        const e = orbit.eccentricity; // 蝳餃��?
        const a = orbitRadius;  // �𢠃鵭頧湛�雿輻鍂霈∠����蝳鳴�
        const b = a * Math.sqrt(1 - e * e); // �羓�頧?

        // 璊剖���㺭�寧�
        let x = a * Math.cos(angle);
        let z = b * Math.sin(angle);
        let y = 0;

        // 摨𠉛鍂頧券��暹�
        if (orbit.tilt) {
          const tiltAngles = getTiltAngles(orbit.tilt);

          // �𥕦遣�贝蓮�拚猐撟嗅��?
          const rotMatrix = new THREE.Matrix4();
          rotMatrix.makeRotationFromEuler(new THREE.Euler(
            THREE.MathUtils.degToRad(tiltAngles.x),
            THREE.MathUtils.degToRad(tiltAngles.y),
            THREE.MathUtils.degToRad(tiltAngles.z),
            'XYZ'
          ));

          const orbitPos = new THREE.Vector3(x, y, z);
          orbitPos.applyMatrix4(rotMatrix);
          x = orbitPos.x;
          y = orbitPos.y;
          z = orbitPos.z;
        }

        // ��蝏��蝵?= 銝剖�雿滨蔭 + 頧券�雿滨蔭
        const finalPos = new THREE.Vector3(
          centerPos.x + x,
          centerPos.y + y,
          centerPos.z + z
        );

        computedPositions.set(planetId, finalPos);
        return finalPos;
      };

      // 霈∠�撟嗆凒�唳��㗇����蝵?
      currentSettings.planets.forEach(planet => {
        if (!planet.enabled) return;
        const meshes = planetMeshesRef.current.get(planet.id);
        if (!meshes) return;

        const pos = computePlanetPosition(planet.id);
        meshes.core.position.copy(pos);
        meshes.flames.position.copy(pos);
        meshes.rings.position.copy(pos);
        meshes.radiation.position.copy(pos);
        meshes.magicCircles.position.copy(pos);
        meshes.energyBodies.position.copy(pos);
        // 瘜冽�嚗餎ireflies 雿輻鍂銝𣇉��鞉�蝟鳴�銝漤�閬�宏�函�雿滨蔭
      });

      // �湔鰵瘥譍葵�毺��?uniforms

      // === �见飵�嗆��㦤嚗���餅�鈭烐芋撘𧶏��芣�暺烐��𣬚��賂� ===
      const hand = handData.current;

      // 摰匧�璉��伐��见飵�唳旿�臬炏�㗇�
      const isHandDataValid = hand && hand.isActive;

      // �见飵�嗆��ế摰𡄯��芣�暺烐��諹��唳����銝斤����嚗?
      let targetExplosion = 0;
      let targetBlackHole = 0;
      let targetHandActive = isHandDataValid ? 1 : 0;

      if (isHandDataValid) {
        if (hand.isClosed) {
          // �⊥箲 -> 暺烐�璅∪�
          targetBlackHole = 1.0;
          targetExplosion = 0;
        } else {
          // 撘惩��𧢲� -> 頞�鰵�毺��𡢅�撘箏漲�?openness �批�嚗?
          targetBlackHole = 0;
          targetExplosion = hand.openness;
        }
      }

      // �扯�撟單�餈�腹 (Lerp) - 雿輻鍂�航�����Ｗ��笔漲
      const explosionRecoverySpeed = currentSettings.explosionRecoverySpeed ?? 0.15;
      const blackHoleRecoverySpeed = currentSettings.blackHoleRecoverySpeed ?? 0.15;
      const lerpFactorUp = 0.08;   // �臬𢆡�嗥��餃側蝟餅㺭嚗���ｇ��渲䌊�塚�

      // 頞�鰵�毺��穃像皛?
      if (targetExplosion > smoothedValuesRef.current.explosion) {
        smoothedValuesRef.current.explosion += (targetExplosion - smoothedValuesRef.current.explosion) * lerpFactorUp;
      } else {
        smoothedValuesRef.current.explosion += (targetExplosion - smoothedValuesRef.current.explosion) * explosionRecoverySpeed;
      }

      // 暺烐����撟單�
      if (targetBlackHole > smoothedValuesRef.current.blackHole) {
        smoothedValuesRef.current.blackHole += (targetBlackHole - smoothedValuesRef.current.blackHole) * lerpFactorUp;
      } else {
        smoothedValuesRef.current.blackHole += (targetBlackHole - smoothedValuesRef.current.blackHole) * blackHoleRecoverySpeed;
      }

      // �见飵瞈�瘣餌𠶖��像皛?
      const handActiveFactor = targetHandActive > smoothedValuesRef.current.handActive ? lerpFactorUp : 0.2;
      smoothedValuesRef.current.handActive += (targetHandActive - smoothedValuesRef.current.handActive) * handActiveFactor;

      // �踹�敺桀�瘚桃��唳��?
      if (Math.abs(smoothedValuesRef.current.explosion) < 0.005) smoothedValuesRef.current.explosion = 0;
      if (Math.abs(smoothedValuesRef.current.blackHole) < 0.005) smoothedValuesRef.current.blackHole = 0;
      if (Math.abs(smoothedValuesRef.current.handActive) < 0.01) smoothedValuesRef.current.handActive = 0;

      // 霈∠��见飵雿滨蔭嚗���煺�蝎鍦�雿輻鍂嚗?
      let handPos = new THREE.Vector3();
      if (isHandDataValid && cameraRef.current) {
        const camera = cameraRef.current;
        const vector = new THREE.Vector3(hand.x, hand.y, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        handPos = camera.position.clone().add(dir.multiplyScalar(distance));
      }

      // �峕郊�见飵����唳�鈭𤑳�摮琜�鈭㘾�𡁏芋撘𧶏�
      if (nebulaMaterialRef.current) {
        nebulaMaterialRef.current.uniforms.uExplosion.value = smoothedValuesRef.current.explosion;
        nebulaMaterialRef.current.uniforms.uBlackHole.value = smoothedValuesRef.current.blackHole;
        nebulaMaterialRef.current.uniforms.uHandActive.value = smoothedValuesRef.current.handActive;
        nebulaMaterialRef.current.uniforms.uHandPos.value.copy(handPos);
      }

      planetMeshesRef.current.forEach((meshes, planetId) => {
        const planet = currentSettings.planets.find(p => p.id === planetId);
        if (!planet) return;

        // �湔鰵�詨�嚗���怎�摮鞉瓲敹��摰硺��詨�嚗?
        const allCoreGroup = meshes.core as THREE.Group;

        // === 摰硺��詨��湔鰵嚗��摰硺�嚗?==
        const solidCoresGroup = allCoreGroup.getObjectByName('solidCores') as THREE.Group | undefined;
        const solidCores = planet.coreSystem?.solidCores || (planet.coreSystem?.solidCore ? [planet.coreSystem.solidCore] : []);
        const solidCoresEnabled = planet.coreSystem?.solidCoresEnabled !== false;

        if (solidCoresGroup) {
          solidCoresGroup.children.forEach(child => {
            const solidCoreId = child.userData?.solidCoreId;
            const solidCore = solidCores.find(sc => sc.id === solidCoreId);

            // 计算是否显示（考虑Solo模式）
            let visible = false;
            if (solidCoresEnabled && solidCore) {
              if (currentSettings.soloSolidCoreId) {
                // Solo模式：仅显示指定的实体核心
                visible = solidCore.id === currentSettings.soloSolidCoreId;
              } else {
                // 非Solo模式：按各核心自身enabled
                visible = solidCore.enabled ?? false;
              }
            }
            child.visible = visible;

            if (visible && solidCore) {
              const coreMesh = child.getObjectByName('solidCore') as THREE.Mesh | undefined;
              const shellMesh = child.getObjectByName('glowShell') as THREE.Mesh | undefined;

              if (coreMesh && coreMesh.material) {
                const material = coreMesh.material as THREE.ShaderMaterial;
                if (material.uniforms) {
                  // �湔鰵�園𡢿
                  material.uniforms.uTime.value = time;

                  // �冽��凒�唳��?uniform ��㺭嚗�蛹�扳㺭�格�靘偦�霈文�潔��歹�
                  material.uniforms.uRadius.value = solidCore.radius ?? 100;
                  material.uniforms.uScale.value = solidCore.scale ?? 3.0;
                  material.uniforms.uSpeed.value = solidCore.speed ?? 0.5;
                  material.uniforms.uContrast.value = solidCore.contrast ?? 3.0;
                  material.uniforms.uBandMix.value = solidCore.bandMix ?? 0;
                  material.uniforms.uRidgeMix.value = solidCore.ridgeMix ?? 0;
                  material.uniforms.uGridMix.value = solidCore.gridMix ?? 0;
                  // 鋆��蝟餌�
                  material.uniforms.uCrackEnabled.value = solidCore.crackEnabled ? 1.0 : 0.0;
                  material.uniforms.uCrackScale.value = solidCore.crackScale ?? 4.0;
                  material.uniforms.uCrackThreshold.value = solidCore.crackThreshold ?? 0.3;
                  material.uniforms.uCrackFeather.value = solidCore.crackFeather ?? 0.1;
                  material.uniforms.uCrackWarp.value = solidCore.crackWarp ?? 0.5;
                  material.uniforms.uCrackWarpScale.value = solidCore.crackWarpScale ?? 1.5;
                  material.uniforms.uCrackFlowSpeed.value = solidCore.crackFlowSpeed ?? 0.2;
                  material.uniforms.uCrackColor1.value.copy(hexToVec3(solidCore.crackColor1 ?? '#ffffff'));
                  material.uniforms.uCrackColor2.value.copy(hexToVec3(solidCore.crackColor2 ?? '#ffaa00'));
                  material.uniforms.uCrackEmission.value = solidCore.crackEmission ?? 2.0;
                  material.uniforms.uEmissiveStrength.value = solidCore.emissiveStrength ?? 0;
                  // 憭𡁻��惩�
                  material.uniforms.uMultiFreqEnabled.value = solidCore.multiFreqEnabled ? 1.0 : 0.0;
                  material.uniforms.uWarpIntensity.value = solidCore.warpIntensity ?? 0.5;
                  material.uniforms.uWarpScale.value = solidCore.warpScale ?? 1.0;
                  material.uniforms.uDetailBalance.value = solidCore.detailBalance ?? 0.3;
                  // 瘜閧瑪�啣𢆡
                  material.uniforms.uBumpEnabled.value = solidCore.bumpEnabled ? 1.0 : 0.0;
                  material.uniforms.uBumpStrength.value = solidCore.bumpStrength ?? 0.3;
                  material.uniforms.uSpecularStrength.value = solidCore.specularStrength ?? 1.0;
                  material.uniforms.uSpecularColor.value.copy(hexToVec3(solidCore.specularColor ?? '#ffffff'));
                  material.uniforms.uRoughness.value = solidCore.roughness ?? 32;
                  // 摰𡁜��?
                  material.uniforms.uLightEnabled.value = solidCore.lightEnabled ? 1.0 : 0.0;
                  const ld = solidCore.lightDirection ?? { x: -1, y: -1, z: 1 };
                  material.uniforms.uLightDirection.value.set(ld.x, ld.y, ld.z);
                  material.uniforms.uLightColor.value.copy(hexToVec3(solidCore.lightColor ?? '#ffffff'));
                  material.uniforms.uLightIntensity.value = solidCore.lightIntensity ?? 1.0;
                  material.uniforms.uLightAmbient.value = solidCore.lightAmbient ?? 0.2;
                  // �剔�颲㗇�
                  material.uniforms.uHotspotEnabled.value = solidCore.hotspotEnabled ? 1.0 : 0.0;
                  material.uniforms.uHotspotCount.value = solidCore.hotspotCount ?? 4;
                  material.uniforms.uHotspotSize.value = solidCore.hotspotSize ?? 0.15;
                  material.uniforms.uHotspotPulseSpeed.value = solidCore.hotspotPulseSpeed ?? 1.0;
                  material.uniforms.uHotspotColor.value.copy(hexToVec3(solidCore.hotspotColor ?? '#ffff00'));
                  material.uniforms.uHotspotEmission.value = solidCore.hotspotEmission ?? 3.0;
                  material.uniforms.uOpacity.value = solidCore.opacity ?? 1.0;
                  material.uniforms.uBrightness.value = solidCore.brightness ?? 1.0;

                  // �冽��凒�啗”�ａ��脩頂蝏?
                  const sc = solidCore.surfaceColor || { mode: 'none', baseColor: '#ff4400', colors: ['#ff4400', '#ffffff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 };
                  material.uniforms.uSurfaceColorMode.value = getColorModeIndex(sc.mode);
                  material.uniforms.uSurfaceBaseColor.value.copy(hexToVec3(sc.baseColor));
                  material.uniforms.uSurfaceColor1.value.copy(hexToVec3(sc.colors?.[0] || sc.baseColor));
                  material.uniforms.uSurfaceColor2.value.copy(hexToVec3(sc.colors?.[1] || '#ffffff'));
                  material.uniforms.uSurfaceColor3.value.copy(hexToVec3(sc.colors?.[2] || '#ffffff'));
                  material.uniforms.uSurfaceColorMidPos.value = sc.colorMidPosition ?? 0.5;
                  material.uniforms.uSurfaceColorMidWidth.value = sc.colorMidWidth ?? 1;
                  material.uniforms.uSurfaceColorMidWidth2.value = sc.colorMidWidth2 ?? 0;
                  material.uniforms.uSurfaceGradientDir.value = getGradientDirIndex(sc.direction);
                  material.uniforms.uSurfaceCustomDir.value.set(sc.directionCustom?.x ?? 0, sc.directionCustom?.y ?? 1, sc.directionCustom?.z ?? 0);
                  material.uniforms.uSurfaceSpiralDensity.value = sc.spiralDensity ?? 3;
                  material.uniforms.uSurfaceProceduralInt.value = sc.proceduralIntensity ?? 1.0;

                  // �冽��凒�啣��閖��脩頂蝏?
                  const gc = solidCore.glowColor || { mode: 'none', baseColor: '#ff6600', colors: ['#ff6600', '#ffffff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 };
                  material.uniforms.uGlowColorMode.value = getColorModeIndex(gc.mode);
                  material.uniforms.uGlowBaseColor.value.copy(hexToVec3(gc.baseColor));
                  material.uniforms.uGlowColor1.value.copy(hexToVec3(gc.colors?.[0] || gc.baseColor));
                  material.uniforms.uGlowColor2.value.copy(hexToVec3(gc.colors?.[1] || '#ffffff'));
                  material.uniforms.uGlowColor3.value.copy(hexToVec3(gc.colors?.[2] || '#ffffff'));
                  material.uniforms.uGlowColorMidPos.value = gc.colorMidPosition ?? 0.5;
                  material.uniforms.uGlowColorMidWidth.value = gc.colorMidWidth ?? 1;
                  material.uniforms.uGlowColorMidWidth2.value = gc.colorMidWidth2 ?? 0;
                  material.uniforms.uGlowGradientDir.value = getGradientDirIndex(gc.direction);
                  material.uniforms.uGlowCustomDir.value.set(gc.directionCustom?.x ?? 0, gc.directionCustom?.y ?? 1, gc.directionCustom?.z ?? 0);
                  material.uniforms.uGlowSpiralDensity.value = gc.spiralDensity ?? 3;
                  material.uniforms.uGlowProceduralInt.value = gc.proceduralIntensity ?? 1.0;

                  // �冽��凒�啣��訫��?
                  material.uniforms.uGlowLength.value = solidCore.glowLength ?? 2.0;
                  material.uniforms.uGlowStrength.value = solidCore.glowStrength ?? 1.0;
                  material.uniforms.uGlowBloomBoost.value = solidCore.glowBloomBoost ?? 1.0;

                  // �湔鰵憭硋ㄢ撅?uniforms
                  if (shellMesh && shellMesh.material) {
                    const shellMaterial = shellMesh.material as THREE.ShaderMaterial;
                    if (shellMaterial.uniforms) {
                      shellMaterial.uniforms.uGlowColorMode.value = getColorModeIndex(gc.mode);
                      shellMaterial.uniforms.uGlowBaseColor.value.copy(hexToVec3(gc.baseColor));
                      shellMaterial.uniforms.uGlowColor1.value.copy(hexToVec3(gc.colors?.[0] || gc.baseColor));
                      shellMaterial.uniforms.uGlowColor2.value.copy(hexToVec3(gc.colors?.[1] || '#ffffff'));
                      shellMaterial.uniforms.uGlowColor3.value.copy(hexToVec3(gc.colors?.[2] || '#ffffff'));
                      shellMaterial.uniforms.uGlowColorMidPos.value = gc.colorMidPosition ?? 0.5;
                      shellMaterial.uniforms.uGlowColorMidWidth.value = gc.colorMidWidth ?? 1;
                      shellMaterial.uniforms.uGlowColorMidWidth2.value = gc.colorMidWidth2 ?? 0;
                      shellMaterial.uniforms.uGlowGradientDir.value = getGradientDirIndex(gc.direction);
                      shellMaterial.uniforms.uGlowStrength.value = solidCore.glowStrength ?? 1.0;
                      shellMaterial.uniforms.uGlowFalloff.value = solidCore.glowFalloff ?? 2.0;
                      shellMaterial.uniforms.uGlowInward.value = (solidCore.glowInward ?? false) ? 1.0 : 0.0;
                    }
                  }
                }
              }

              // 摰硺��詨��芾蓮
              const rotSpeed = solidCore.rotationSpeed ?? 0;
              if (rotSpeed !== 0) {
                const rotAxis = solidCore.rotationAxis ?? { preset: 'y', customX: 0, customY: 1, customZ: 0 };
                const axisX = rotAxis.customX ?? 0;
                const axisY = rotAxis.customY ?? 1;
                const axisZ = rotAxis.customZ ?? 0;
                const axis = new THREE.Vector3(axisX, axisY, axisZ).normalize();
                const deltaRotation = rotSpeed * deltaTime;
                child.rotateOnAxis(axis, deltaRotation);
              }
            }
          });
        }

        // === 蝎鍦��詨��湔鰵 ===
        const particleCoresGroup = allCoreGroup.getObjectByName('particleCores') as THREE.Group | undefined;
        const cores = planet.coreSystem?.cores || [];
        const coresEnabled = planet.coreSystem?.coresEnabled !== false;

        if (particleCoresGroup) {
          // �滚�瘥譍葵�詨�蝏���朞� coreId �寥��滨蔭
          particleCoresGroup.children.forEach((coreChild) => {
            const coreId = coreChild.userData?.coreId;
            const coreConfig = cores.find(c => c.id === coreId);

            // 霈∠��臬炏摨磰砲�曄內甇斗瓲敹?
            let shouldShow = false;
            if (coresEnabled && coreConfig) {
              if (currentSettings.soloCoreId) {
                // Solo 璅∪�嚗𡁜蘨�曄內�����瓲敹?
                shouldShow = coreConfig.id === currentSettings.soloCoreId;
              } else {
                // 甇�虜璅∪�嚗𡁏遬蝷箏鍳�函��詨�
                shouldShow = coreConfig.enabled;
              }
            }

            // 霈曄蔭�航��?
            coreChild.visible = shouldShow;

            // �芣凒�啣虾閫���詨�
            if (!shouldShow || !coreConfig) return;

            const rotAxis = getRotationAxis(coreConfig.rotationAxis);

            // �湔鰵�鞱捶��遆�?
            const updateMaterial = (points: THREE.Points) => {
              const material = points.material as THREE.ShaderMaterial;
              if (!material.uniforms) return;

              material.uniforms.uTime.value = time;
              material.uniforms.uRotationSpeed.value = coreConfig.rotationSpeed;
              material.uniforms.uRotationAxis.value.set(rotAxis.x, rotAxis.y, rotAxis.z);

              // �冽����?
              material.uniforms.uBreathing.value = currentSettings.breathingEnabled ? currentSettings.breathingIntensity : 0;
              material.uniforms.uBreathingSpeed.value = currentSettings.breathingSpeed;
              material.uniforms.uFlicker.value = currentSettings.flickerEnabled ? currentSettings.flickerIntensity : 0;
              material.uniforms.uFlickerSpeed.value = currentSettings.flickerSpeed;

              // 鈭支�
              // 雿輻鍂撟單�憭���𡒊��?
              const smoothed = smoothedValuesRef.current;
              material.uniforms.uHandActive.value = smoothed.handActive;

              // 颲�𨭌�賣㺭嚗𡁜�撅誩�敶雴��硋���蓮�Ｖ蛹銝𣇉��鞉� (Z=0撟喲𢒰)
              const getProjectedPos = (hx: number, hy: number, hz: number) => {
                if (!cameraRef.current) return new THREE.Vector3(hx * 400, hy * 300, hz * 200);
                const vector = new THREE.Vector3(hx, hy, 0.5);
                vector.unproject(cameraRef.current);
                const dir = vector.sub(cameraRef.current.position).normalize();
                const distance = -cameraRef.current.position.z / dir.z;
                return cameraRef.current.position.clone().add(dir.multiplyScalar(distance));
              };

              // 摨𠉛鍂撟單��𡒊��见飵撘箏漲
              material.uniforms.uExplosion.value = smoothed.explosion;
              material.uniforms.uBlackHole.value = smoothed.blackHole;

              // 頞�鰵�毺��穃��?
              material.uniforms.uExplosionExpansion.value = currentSettings.explosionExpansion ?? 300;
              material.uniforms.uExplosionTurbulence.value = currentSettings.explosionTurbulence ?? 80;
              material.uniforms.uExplosionRotation.value = currentSettings.explosionRotation ?? 0.4;
              material.uniforms.uExplosionSizeBoost.value = currentSettings.explosionSizeBoost ?? 8;

              // 暺烐������㺭
              material.uniforms.uBlackHoleCompression.value = currentSettings.blackHoleCompression ?? 0.05;
              material.uniforms.uBlackHoleSpinSpeed.value = currentSettings.blackHoleSpinSpeed ?? 400;
              material.uniforms.uBlackHoleTargetRadius.value = currentSettings.blackHoleTargetRadius ?? 30;
              material.uniforms.uBlackHolePull.value = currentSettings.blackHolePull ?? 0.95;

              // �芰㩞���
              material.uniforms.uWanderingLightning.value = currentSettings.wanderingLightningEnabled ? currentSettings.wanderingLightningIntensity : 0;
              material.uniforms.uWanderingLightningSpeed.value = currentSettings.wanderingLightningSpeed;
              material.uniforms.uWanderingLightningDensity.value = currentSettings.wanderingLightningDensity;
              material.uniforms.uLightningBreakdown.value = currentSettings.lightningBreakdownEnabled ? currentSettings.lightningBreakdownIntensity : 0;
              material.uniforms.uLightningBreakdownFreq.value = currentSettings.lightningBreakdownFrequency;
              material.uniforms.uLightningBranches.value = currentSettings.lightningBreakdownBranches;
            };

            // 憭��撋��蝏𤘪�嚗𡁏瓲敹�虾�賣糓 Group嚗�蒂�硋偏撅���𣇉凒�交糓 Points
            if (coreChild instanceof THREE.Group) {
              // �啁����Group ��鉄憭帋葵 Points嚗�蜓撅?+ �硋偏撅��
              coreChild.children.forEach(subChild => {
                if (subChild instanceof THREE.Points) {
                  updateMaterial(subChild);
                }
              });
            } else if (coreChild instanceof THREE.Points) {
              // �抒�����湔𦻖�?Points
              updateMaterial(coreChild);
            }
          });
        }

        // === �怎�蝟餌��湔鰵 ===
        const flamesGroup = meshes.flames as THREE.Group | undefined;
        const surfaceFlamesGroup = flamesGroup?.getObjectByName('surfaceFlames') as THREE.Group | undefined;
        const surfaceFlames = planet.flameSystem?.surfaceFlames || [];
        const flamesEnabled = planet.flameSystem?.enabled !== false;
        const surfaceFlamesEnabled = planet.flameSystem?.surfaceFlamesEnabled !== false;
        const energyBodySystemEnabled = planet.energyBodySystem?.enabled !== false;

        // �賡�蝵拙�鈭舘��譍�蝟餌�
        if (surfaceFlamesGroup) {
          surfaceFlamesGroup.children.forEach(child => {
            const flameId = child.userData?.flameId;
            const flame = surfaceFlames.find(f => f.id === flameId);

            const visible = energyBodySystemEnabled && surfaceFlamesEnabled && (flame?.enabled ?? false);
            child.visible = visible;

            if (visible && flame && child instanceof THREE.Mesh) {
              const material = child.material as THREE.ShaderMaterial;
              if (material.uniforms) {
                // �湔鰵�園𡢿
                material.uniforms.uTime.value = time;

                // �冽��凒�啣��?
                material.uniforms.uRadius.value = flame.radius ?? 105;
                material.uniforms.uThickness.value = flame.thickness ?? 0.15;
                material.uniforms.uFlameScale.value = flame.flameScale ?? 1.0;
                material.uniforms.uDensity.value = flame.density ?? 0.8;
                material.uniforms.uFlowSpeed.value = flame.flowSpeed ?? 1.0;
                material.uniforms.uTurbulence.value = flame.turbulence ?? 0.8;
                material.uniforms.uNoiseType.value = flame.noiseType === 'voronoi' ? 1 : 0;
                material.uniforms.uFractalLayers.value = flame.fractalLayers ?? 3;
                material.uniforms.uOpacity.value = flame.opacity ?? 0.9;
                material.uniforms.uEmissive.value = flame.emissive ?? 2.0;
                material.uniforms.uBloomBoost.value = flame.bloomBoost ?? 1.5;
                material.uniforms.uDirection.value = flame.direction === 'up' ? 0 : flame.direction === 'outward' ? 1 : 2;
                material.uniforms.uPulseEnabled.value = flame.pulseEnabled ? 1.0 : 0.0;
                material.uniforms.uPulseSpeed.value = flame.pulseSpeed ?? 1.0;
                material.uniforms.uPulseIntensity.value = flame.pulseIntensity ?? 0.3;

                // �湔鰵憸𡏭𠧧
                const fc = flame.color || { mode: 'twoColor' as const, baseColor: '#ff6600', colors: ['#ff6600', '#ffff00'], colorMidPosition: 0.5, colorMidWidth: 1, direction: 'radial' as const, directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 };
                const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;
                material.uniforms.uColorMode.value = colorModeIndex;
                material.uniforms.uBaseColor.value.copy(hexToVec3(fc.baseColor));
                material.uniforms.uColor1.value.copy(hexToVec3(fc.colors?.[0] || fc.baseColor));
                material.uniforms.uColor2.value.copy(hexToVec3(fc.colors?.[1] || '#ffff00'));
                material.uniforms.uColor3.value.copy(hexToVec3(fc.colors?.[2] || '#ffffff'));
                material.uniforms.uColorMidPos.value = fc.colorMidPosition ?? 0.5;
                material.uniforms.uProceduralIntensity.value = fc.proceduralIntensity ?? 1.0;
              }
            }
          });
        }

        // 畾见蔣�湔鰵嚗�𡠺蝡钅▲蝥扳芋�梹�
        const flameJetsGroup = flamesGroup?.getObjectByName('flameJets') as THREE.Group | undefined;
        const flameJets = planet.flameSystem?.flameJets || [];
        const flameJetsEnabled = planet.flameSystem?.flameJetsEnabled !== false;
        if (flameJetsGroup) {
          flameJetsGroup.children.forEach(child => {
            const jetId = child.userData?.flameId;
            const jet = flameJets.find(j => j.id === jetId);
            // 计算是否显示（考虑Solo模式）
            let visible = false;
            if (flameJetsEnabled && jet) {
              if (currentSettings.soloFlameJetId) {
                // Solo模式：仅显示指定的粒子喷射
                visible = jet.id === currentSettings.soloFlameJetId;
              } else {
                // 非Solo模式：按各喷射自身enabled
                visible = jet.enabled ?? false;
              }
            }
            child.visible = visible;

            if (visible && jet && child instanceof THREE.Points) {
              const material = child.material as THREE.ShaderMaterial;
              if (material.uniforms) {
                material.uniforms.uTime.value = time;
                material.uniforms.uJetSpeed.value = jet.jetSpeed ?? 1.0;
                material.uniforms.uHeight.value = (jet.height ?? 2.0) * (jet.baseRadius ?? 100);
                material.uniforms.uWidth.value = jet.width ?? 0.3;
                material.uniforms.uSpread.value = jet.spread ?? 15;
                material.uniforms.uTurbulence.value = jet.turbulence ?? 0.5;
                material.uniforms.uLifespan.value = jet.lifespan ?? 2.0;
                material.uniforms.uParticleSize.value = jet.particleSize ?? 5;
                material.uniforms.uOpacity.value = jet.opacity ?? 0.9;
                material.uniforms.uEmissive.value = jet.emissive ?? 2.5;

                // ���璅∪�
                if (jet.burstMode === 'burst') {
                  const cycle = jet.burstInterval + jet.burstDuration;
                  const phase = (time % cycle) / cycle;
                  const burstPhase = phase < (jet.burstDuration / cycle) ? 1.0 : 0.0;
                  material.uniforms.uBurstPhase.value = burstPhase;
                } else {
                  material.uniforms.uBurstPhase.value = 1.0;
                }

                // �湔鰵憸𡏭𠧧
                const fc = jet.color || { mode: 'twoColor', baseColor: '#ff4400', colors: ['#ff4400', '#ffff00'] };
                const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;
                material.uniforms.uColorMode.value = colorModeIndex;
                material.uniforms.uColor1.value.copy(hexToVec3(fc.colors?.[0] || fc.baseColor || '#ff4400'));
                material.uniforms.uColor2.value.copy(hexToVec3(fc.colors?.[1] || '#ffff00'));
                material.uniforms.uColor3.value.copy(hexToVec3(fc.colors?.[2] || '#ff0000'));
              }
            }
          });
        }

        // �箸��怎��湔鰵嚗��鈭𤾸��舐頂蝏��
        const spiralFlamesGroup = flamesGroup?.getObjectByName('spiralFlames') as THREE.Group | undefined;
        const spiralFlamesData = planet.flameSystem?.spiralFlames || [];
        const spiralFlamesEnabled = planet.flameSystem?.spiralFlamesEnabled !== false;
        const ringsSystemEnabled = planet.rings.enabled !== false;
        if (spiralFlamesGroup) {
          spiralFlamesGroup.children.forEach(child => {
            const spiralId = child.userData?.flameId;
            const spiral = spiralFlamesData.find(s => s.id === spiralId);
            // 计算是否显示（考虑Solo模式）
            let visible = false;
            if (ringsSystemEnabled && spiralFlamesEnabled && spiral) {
              if (currentSettings.soloSpiralFlameId) {
                // Solo模式：仅显示指定的螺旋环
                visible = spiral.id === currentSettings.soloSpiralFlameId;
              } else {
                // 非Solo模式：按各螺旋环自身enabled
                visible = spiral.enabled ?? false;
              }
            }
            child.visible = visible;

            if (visible && spiral && child instanceof THREE.Points) {
              const material = child.material as THREE.ShaderMaterial;
              if (material.uniforms) {
                material.uniforms.uTime.value = time;
                material.uniforms.uBaseRadius.value = spiral.baseRadius ?? 100;
                material.uniforms.uStartRadius.value = spiral.startRadius ?? 1.1;
                material.uniforms.uEndRadius.value = spiral.endRadius ?? 1.5;
                material.uniforms.uSpiralHeight.value = spiral.height ?? 200;
                material.uniforms.uPitch.value = spiral.pitch ?? 0.5;
                material.uniforms.uRotationSpeed.value = spiral.rotationSpeed ?? 1.0;
                material.uniforms.uRiseSpeed.value = spiral.riseSpeed ?? 0.5;
                material.uniforms.uThickness.value = spiral.thickness ?? 0.1;
                material.uniforms.uParticleSize.value = spiral.particleSize ?? 4.0;
                material.uniforms.uOpacity.value = spiral.opacity ?? 0.85;
                material.uniforms.uEmissive.value = spiral.emissive ?? 2.0;

                const dirIndex = spiral.direction === 'cw' ? 0 : spiral.direction === 'ccw' ? 1 : 2;
                material.uniforms.uDirection.value = dirIndex;

                // �湔鰵憸𡏭𠧧
                const fc = spiral.color || { mode: 'twoColor', baseColor: '#ff6600', colors: ['#ff6600', '#ffff00'] };
                const colorModeIndex = fc.mode === 'none' ? 0 : fc.mode === 'twoColor' ? 1 : fc.mode === 'threeColor' ? 2 : 3;
                material.uniforms.uColorMode.value = colorModeIndex;
                material.uniforms.uColor1.value.copy(hexToVec3(fc.colors?.[0] || fc.baseColor || '#ff6600'));
                material.uniforms.uColor2.value.copy(hexToVec3(fc.colors?.[1] || '#ffff00'));
                material.uniforms.uColor3.value.copy(hexToVec3(fc.colors?.[2] || '#ff0000'));
                material.uniforms.uGradientDirection.value = ['radial', 'linearX', 'linearY', 'linearZ', 'spiral'].indexOf(fc.direction || 'linearY');
              }
            }
          });
        }

        // === 畾见蔣蝟餌��湔鰵 ===
        try {
          const afterimageBillboard = flamesGroup?.children.find(c => c.userData?.type === 'afterimage') as THREE.Group | undefined;
          const currentCamera = cameraRef.current;
          if (afterimageBillboard && currentCamera) {
            // 畾见蔣撟喲𢒰憪讠�撟唾�鈭𤾸�撟𤏪�雿輻鍂�豢㦤�贝蓮嚗諹�屸� lookAt嚗?
            afterimageBillboard.quaternion.copy(currentCamera.quaternion);

            const afterimageSettings = planet.afterimageSystem;
            const systemEnabled = afterimageSettings?.enabled ?? false;
            const textureEnabled = systemEnabled && (afterimageSettings?.texture?.enabled ?? false);
            const particlesEnabled = systemEnabled && (afterimageSettings?.particles?.enabled ?? false);

            // �瑕� zone
            const defaultZone = {
              startAngle: 45, angleSpan: 90, sideLineLength: 2.0,
              sideLineAngle: 90, sideLineType: 'straight' as const,
              curveBendDirection: 'outward' as const, curveBendStrength: 0.5
            };
            const zones = afterimageSettings?.zones || [];
            const zone = zones.find(z => z.enabled) || zones[0] || defaultZone;

            // �滚����匧�撖寡情
            for (const child of afterimageBillboard.children) {
              // ===== �湔鰵蝥寧�撅?=====
              if (child.name === 'afterimageTexture' && child instanceof THREE.Mesh) {
                child.visible = textureEnabled;
                const material = child.material as THREE.ShaderMaterial;
                if (material && material.uniforms) {
                  // �湔鰵�園𡢿嚗�𢆡�餃��殷�嚗?
                  material.uniforms.uTime.value = time;

                  // �湔鰵蝥寧���㺭
                  const tex = afterimageSettings?.texture;
                  if (tex) {
                    material.uniforms.uOpacity.value = tex.opacity ?? 0.8;
                    material.uniforms.uFlowSpeed.value = tex.flowSpeed ?? 0.5;
                    material.uniforms.uNoiseScale.value = tex.noiseScale ?? 1.0;
                    material.uniforms.uStretchFactor.value = tex.stretchFactor ?? 2.0;
                    // �∠犒�����㺭
                    material.uniforms.uStripeIntensity.value = tex.stripeIntensity ?? 0;
                    material.uniforms.uStripeCount.value = tex.stripeCount ?? 8;
                    material.uniforms.uDirectionalStretch.value = tex.directionalStretch ?? 1;
                    material.uniforms.uEdgeSharpness.value = tex.edgeSharpness ?? 0;
                    material.uniforms.uDistortion.value = tex.distortion ?? 0;
                    if (tex.colors) {
                      material.uniforms.uColor1.value.copy(hexToVec3(tex.colors[0] || '#ff00ff'));
                      material.uniforms.uColor2.value.copy(hexToVec3(tex.colors[1] || '#ff66ff'));
                      material.uniforms.uColor3.value.copy(hexToVec3(tex.colors[2] || '#ffffff'));
                    }
                    // 蝥寧�璅∪�
                    material.uniforms.uTextureMode.value = tex.textureMode === 'energy' ? 1.0 : 0.0;
                    // �賡�蝵拙��?
                    material.uniforms.uEnergyFlameScale.value = tex.energyFlameScale ?? 2.0;
                    material.uniforms.uEnergyDensity.value = tex.energyDensity ?? 0.5;
                    material.uniforms.uEnergyFlowSpeed.value = tex.energyFlowSpeed ?? 0.5;
                    material.uniforms.uEnergyTurbulence.value = tex.energyTurbulence ?? 0.5;
                    material.uniforms.uEnergyNoiseType.value = tex.energyNoiseType === 'voronoi' ? 1.0 : 0.0;
                    material.uniforms.uEnergyFractalLayers.value = tex.energyFractalLayers ?? 3;
                    material.uniforms.uEnergyDirection.value = tex.energyDirection === 'spiral' ? 1.0 : 0.0;
                    material.uniforms.uEnergyPulseEnabled.value = tex.energyPulseEnabled ? 1.0 : 0.0;
                    material.uniforms.uEnergyPulseSpeed.value = tex.energyPulseSpeed ?? 1.0;
                    material.uniforms.uEnergyPulseIntensity.value = tex.energyPulseIntensity ?? 0.3;
                  }

                  // �湔鰵�箏���㺭
                  material.uniforms.uStartAngle.value = THREE.MathUtils.degToRad(zone.startAngle);
                  material.uniforms.uAngleSpan.value = THREE.MathUtils.degToRad(zone.angleSpan);
                  material.uniforms.uSideLength.value = zone.sideLineLength;
                  material.uniforms.uSideAngle.value = THREE.MathUtils.degToRad((zone.sideLineAngle || 90) - 90);
                  material.uniforms.uSideLineType.value = zone.sideLineType === 'curve' ? 1.0 : 0.0;
                  material.uniforms.uCurveBend.value = zone.curveBendDirection === 'inward' ? -1.0 : 1.0;
                  material.uniforms.uCurveStrength.value = zone.curveBendStrength || 0.5;
                }
              }

              // ===== �湔鰵蝎鍦�撅?=====
              if (child.name === 'afterimageParticles' && child instanceof THREE.Points) {
                child.visible = particlesEnabled;
                const material = child.material as THREE.ShaderMaterial;
                if (material && material.uniforms) {
                  // �湔鰵�園𡢿嚗�𢆡�餃��殷�嚗?
                  material.uniforms.uTime.value = time;

                  // �湔鰵蝎鍦���㺭
                  const particles = afterimageSettings?.particles;
                  if (particles) {
                    material.uniforms.uSpeed.value = particles.speed ?? 2.0;
                    material.uniforms.uSpeedRandomness.value = particles.speedRandomness ?? 0.2;
                    material.uniforms.uLifespan.value = particles.lifespan ?? 2.0;
                    material.uniforms.uSize.value = particles.size ?? 8;
                    if (particles.colors) {
                      material.uniforms.uColor1.value.copy(hexToVec3(particles.colors[0] || '#ff4400'));
                      material.uniforms.uColor2.value.copy(hexToVec3(particles.colors[1] || '#ffff00'));
                    }
                  }

                  // �湔鰵�箏���㺭
                  material.uniforms.uStartAngle.value = THREE.MathUtils.degToRad(zone.startAngle);
                  material.uniforms.uAngleSpan.value = THREE.MathUtils.degToRad(zone.angleSpan);
                  material.uniforms.uSideLength.value = zone.sideLineLength;
                  material.uniforms.uSideAngle.value = THREE.MathUtils.degToRad((zone.sideLineAngle || 90) - 90);
                  material.uniforms.uSideLineType.value = zone.sideLineType === 'curve' ? 1.0 : 0.0;
                  material.uniforms.uCurveBend.value = zone.curveBendDirection === 'inward' ? -1.0 : 1.0;
                  material.uniforms.uCurveStrength.value = zone.curveBendStrength || 0.5;
                }
              }
            }

            // �港��航��?
            afterimageBillboard.visible = systemEnabled;
          }
        } catch (e) {
          console.error('畾见蔣�湔鰵�躰秤:', e);
        }

        // �瑕��箇��𠰴��其��𡒊賒霈∠�
        const firstCore = planet.coreSystem?.cores?.[0];

        // �湔鰵�臬蒂�𣬚�摮鞟㴓
        meshes.rings.children.forEach((child) => {
          const userData = child.userData;

          if (userData.type === 'particle') {
            // 蝎鍦��荔�Group ��鉄銝餃��峕�撠曉�嚗?
            const ring = planet.rings.particleRings.find(r => r.id === userData.ringId);
            if (ring && child instanceof THREE.Group) {
              // Solo �航��改�憒���?soloId嚗�蘨�曄內 solo ���銝?
              const soloId = planet.rings.particleRingsSoloId;
              const visible = (planet.rings.enabled !== false) && planet.rings.particleRingsEnabled && ring.enabled && (!soloId || soloId === ring.id);
              child.visible = visible;
              if (!visible) return;

              // �湔鰵���匧�撅�� uniforms
              const smoothed = smoothedValuesRef.current;
              child.children.forEach(subChild => {
                if (subChild instanceof THREE.Points) {
                  const material = subChild.material as THREE.ShaderMaterial;
                  if (material.uniforms) {
                    material.uniforms.uTime.value = time;

                    // �见飵��� uniform �湔鰵嚗���殷�蝖桐��见飵�喲𡡒�嗅��塚�
                    material.uniforms.uExplosion.value = smoothed.explosion;
                    material.uniforms.uBlackHole.value = smoothed.blackHole;
                    material.uniforms.uHandActive.value = smoothed.handActive;
                    material.uniforms.uTwoHandsActive.value = hand.twoHandsActive ? 1 : 0;

                    // �嗆眾頧刻蕨 uniform �湔鰵
                    if (material.uniforms.uTrail && material.uniforms.uTrailLength) {
                      const trail = trailRef.current;
                      material.uniforms.uTrailLength.value = trail.length;
                      for (let j = 0; j < 50; j++) {
                        if (j < trail.length) {
                          material.uniforms.uTrail.value[j].copy(trail[j]);
                        } else {
                          material.uniforms.uTrail.value[j].set(0, 0, 0);
                        }
                      }
                    }
                  }
                }
              });
              // �芾蓮嚗𡁶�撅��?Y 頧湔�頧穿�XZ 撟喲𢒰����煾��?Y 頧湛�
              const rotSpeed = userData.rotationSpeed ?? ring.rotationSpeed ?? 0.3;
              child.rotateOnAxis(new THREE.Vector3(0, 1, 0), rotSpeed * 0.01);
              // �祈蓮嚗𡁶��祈蓮頧湔�頧?
              const orbitAxis = ring.orbitAxis ? getOrbitAxisVector(ring.orbitAxis) : { x: 0, y: 1, z: 0 };
              child.rotateOnWorldAxis(new THREE.Vector3(orbitAxis.x, orbitAxis.y, orbitAxis.z), ring.orbitSpeed * 0.01);
            }
          } else if (userData.type === 'continuous') {
            // �臬蒂嚗㇈esh嚗?
            const ring = planet.rings.continuousRings.find(r => r.id === userData.ringId);
            if (ring && child instanceof THREE.Mesh) {
              // Solo �航��改�憒���?soloId嚗�蘨�曄內 solo ���銝?
              const soloId = planet.rings.continuousRingsSoloId;
              const visible = (planet.rings.enabled !== false) && planet.rings.continuousRingsEnabled && ring.enabled && (!soloId || soloId === ring.id);
              child.visible = visible;
              if (!visible) return;

              const material = child.material as THREE.ShaderMaterial;
              if (material.uniforms) {
                material.uniforms.uTime.value = time;
                // �冽��凒�圈��脫��条㮾�?uniforms
                const gc = ring.gradientColor;
                if (material.uniforms.uColorMidPosition !== undefined) {
                  material.uniforms.uColorMidPosition.value = gc?.colorMidPosition ?? 0.5;
                  material.uniforms.uColorMidWidth.value = gc?.colorMidWidth ?? 1;
                  material.uniforms.uColorMidWidth2.value = gc?.colorMidWidth2 ?? 0;
                  material.uniforms.uBlendStrength.value = gc?.blendStrength ?? 1.0;
                  material.uniforms.uSpiralDensity.value = gc?.spiralDensity ?? 2;
                  material.uniforms.uProceduralIntensity.value = gc?.proceduralIntensity ?? 1.0;
                  material.uniforms.uProceduralAxis.value = ['x', 'y', 'z', 'radial', 'custom'].indexOf(gc?.proceduralAxis || 'y');
                  material.uniforms.uProceduralCustomAxis.value.set(gc?.proceduralCustomAxis?.x ?? 0, gc?.proceduralCustomAxis?.y ?? 1, gc?.proceduralCustomAxis?.z ?? 0);

                  // �冽��凒�唳��㗛��莎��劐������閬��
                  const brightness = ring.brightness || 1.0;
                  // �閗𠧧璅∪��塚�銝劐葵憸𡏭𠧧�賭蝙�典抅蝖��莎�鈭抒�鈭桀漲皜𣂼�嚗?
                  const useGradient = gc?.enabled && gc?.mode !== 'none';
                  let c1, c2, c3;
                  if (useGradient && gc?.colors?.length >= 1) {
                    c1 = hexToRgb(gc.colors[0] || ring.color);
                    c2 = hexToRgb(gc.colors[1] || gc.colors[0] || ring.color);
                    c3 = hexToRgb(gc.colors[2] || gc.colors[1] || gc.colors[0] || ring.color);
                  } else {
                    // �閗𠧧璅∪�嚗帋蝙�典抅蝖��脩�銝滚�鈭桀漲�睃�
                    const baseColor = hexToRgb(ring.color);
                    c1 = [baseColor[0] * 0.6, baseColor[1] * 0.6, baseColor[2] * 0.6]; // �烾�
                    c2 = baseColor; // 銝剝𡢿
                    c3 = [Math.min(1, baseColor[0] * 1.4), Math.min(1, baseColor[1] * 1.4), Math.min(1, baseColor[2] * 1.4)]; // 鈭桅�
                  }
                  material.uniforms.uGradientColor1.value.set(c1[0] * brightness, c1[1] * brightness, c1[2] * brightness);
                  material.uniforms.uGradientColor2.value.set(c2[0] * brightness, c2[1] * brightness, c2[2] * brightness);
                  material.uniforms.uGradientColor3.value.set(c3[0] * brightness, c3[1] * brightness, c3[2] * brightness);
                  // �湔鰵�箇�憸𡏭𠧧
                  const [r, g, b] = hexToRgb(ring.color);
                  material.uniforms.uColor.value.set(r * brightness, g * brightness, b * brightness);
                }
                // �冽��凒�唳遬�鞉��?uniforms嚗�����𤩺��桃蔗嚗?
                if (material.uniforms.uVisibilityEnabled !== undefined) {
                  const visEffect = ring.visibilityEffect;
                  material.uniforms.uVisibilityEnabled.value = visEffect?.enabled ? 1 : 0;
                  material.uniforms.uVisibilityMinOpacity.value = visEffect?.minOpacity ?? 0.2;
                  material.uniforms.uVisibilityArmCount.value = visEffect?.armCount ?? 4;
                  material.uniforms.uVisibilityTwist.value = visEffect?.twist ?? 5;
                  material.uniforms.uVisibilityHardness.value = visEffect?.hardness ?? 0.5;
                  material.uniforms.uVisibilityRotSpeed.value = visEffect?.rotationSpeed ?? 0.5;
                  material.uniforms.uVisibilityRadialDir.value = visEffect?.radialDirection === 'inward' ? 1 : visEffect?.radialDirection === 'outward' ? 2 : 0;
                  material.uniforms.uVisibilityRadialSpeed.value = visEffect?.radialSpeed ?? 0.3;
                }
                // �冽��凒�唳�銝脲��?uniforms
                if (material.uniforms.uStreakEnabled !== undefined) {
                  const streak = ring.streakMode;
                  material.uniforms.uStreakEnabled.value = streak?.enabled ? 1 : 0;
                  material.uniforms.uStreakFlowSpeed.value = streak?.flowSpeed ?? 0.5;
                  material.uniforms.uStreakStripeCount.value = streak?.stripeCount ?? 12;
                  material.uniforms.uStreakRadialStretch.value = streak?.radialStretch ?? 8;
                  material.uniforms.uStreakSharpness.value = streak?.edgeSharpness ?? 0.3;
                  material.uniforms.uStreakDistortion.value = streak?.distortion ?? 0.5;
                  material.uniforms.uStreakNoiseScale.value = streak?.noiseScale ?? 1.0;
                  material.uniforms.uStreakDirection.value = streak?.flowDirection === 'ccw' ? -1.0 : 1.0;
                  material.uniforms.uStreakBrightness.value = streak?.brightness ?? 1.5;
                }
              }
              // �芾蓮嚗𡁶�撅��?Z 頧湔�頧穿��臬蒂�笔��𥕦遣�?XY 撟喲𢒰嚗峕��煾��?Z 頧湛�
              const rotSpeed = userData.rotationSpeed ?? ring.rotationSpeed ?? 0.1;
              child.rotateOnAxis(new THREE.Vector3(0, 0, 1), rotSpeed * 0.01);
              // �祈蓮嚗𡁶��祈蓮頧湔�頧?
              const orbitAxis = ring.orbitAxis ? getOrbitAxisVector(ring.orbitAxis) : { x: 0, y: 1, z: 0 };
              child.rotateOnWorldAxis(new THREE.Vector3(orbitAxis.x, orbitAxis.y, orbitAxis.z), ring.orbitSpeed * 0.01);
            }
          }
        });

        // �湔鰵蝎鍦��舐��贝蓮
        const radiationSysEnabled = planet.radiation.enabled !== false;
        const orbitingEnabled = planet.radiation.orbitingEnabled;
        meshes.radiation.children.forEach((child) => {
          const userData = child.userData;
          if (userData.type === 'orbiting' && child instanceof THREE.Points) {
            // 璉��亙虾閫��?
            const orbiting = planet.radiation.orbitings.find(o => o.id === userData.orbitingId);
            // 计算是否显示（考虑Solo模式）
            let visible = false;
            if (radiationSysEnabled && orbitingEnabled && orbiting) {
              if (currentSettings.soloOrbitingFireflyId) {
                // Solo模式：仅显示指定的粒子环绕
                visible = orbiting.id === currentSettings.soloOrbitingFireflyId;
              } else {
                // 非Solo模式：按各环绕自身enabled
                visible = orbiting.enabled ?? false;
              }
            }
            child.visible = visible;
            if (!visible) return;

            const dir = userData.mainDirection || { x: 0, y: 1, z: 0 };
            const speed = userData.baseSpeed || 0.5;
            // 蝏閙�摰朞蓬�贝蓮
            child.rotateOnWorldAxis(new THREE.Vector3(dir.x, dir.y, dir.z).normalize(), speed * 0.01);
          }
        });

        // �湔鰵蝎鍦��穃��?
        if (meshes.emitters && meshes.emitters.length > 0) {
          // �瑕��箇��𠰴�嚗䔶����摰硺��詨��瑕�嚗�炏�嗘�蝎鍦��詨��瑕�
          const solidCore = planet.coreSystem?.solidCore;
          const baseRadius = solidCore?.enabled ? (solidCore.radius || 100) : (firstCore?.baseRadius || 100);
          const radiationSystemEnabled = planet.radiation.enabled !== false;
          const emitterEnabled = planet.radiation.emitterEnabled;

          meshes.emitters.forEach((emitter) => {
            // �朞� ID �寥��曉�撖孵���挽蝵?
            const emitterId = emitter.mesh.userData?.emitterId;
            const emitterSettings = planet.radiation.emitters.find(e => e.id === emitterId);
            if (radiationSystemEnabled && emitterEnabled && emitterSettings && emitterSettings.enabled) {
              updateParticleEmitter(emitter, emitterSettings, baseRadius, deltaTime / 1000, time);
            } else {
              // 憒��霈曄蔭銝滚��冽�鋡怎��剁��鞱� mesh
              emitter.mesh.visible = false;
            }
          });
        }

        // �湔鰵瘚�𨫡
        if (meshes.fireflyData && meshes.fireflyData.length > 0) {
          const planetPos = meshes.core.position.clone();
          const solidCore = planet.coreSystem?.solidCore;
          const baseRadius = solidCore?.enabled ? (solidCore.radius || 100) : (firstCore?.baseRadius || 100);
          const fireflySystemEnabled = planet.fireflies.enabled !== false;

          meshes.fireflyData.forEach((fireflyData: FireflyRuntimeData) => {
            try {
              const userData = fireflyData.group.userData;

              if (userData.type === 'orbiting') {
                // 隞舘挽蝵桐葉�冽��粉�硋��?
                const settings = planet.fireflies.orbitingFireflies.find(f => f.id === userData.fireflyId);
                const orbitingEnabled = planet.fireflies.orbitingEnabled;
                // 计算是否显示（考虑Solo模式）
                if (!fireflySystemEnabled || !orbitingEnabled || !settings) {
                  fireflyData.group.visible = false;
                  return;
                }
                // Solo模式检查
                let visible = false;
                if (currentSettings.soloOrbitingFireflyId) {
                  // Solo模式：仅显示指定的旋转流萤
                  visible = settings.id === currentSettings.soloOrbitingFireflyId;
                } else {
                  // 非Solo模式：按各流萤自身enabled
                  visible = settings.enabled ?? false;
                }
                if (!visible) {
                  fireflyData.group.visible = false;
                  return;
                }
                fireflyData.group.visible = true;

                let radius = settings.absoluteOrbitRadius;
                const speed = settings.orbitSpeed;
                const phase = settings.initialPhase || 0;
                const orbitAxisSettings = settings.orbitAxis;
                const fireflySize = settings.size || 8;
                // �硋偏摰賢漲��閬��憭湧�閫��憭批��寥�
                // 憭湧� gl_PointSize = size * 300 / z嚗�銁�詨�頝萘氖 z=500 �嗥漲銝?size*0.6 �讐�
                // 雿�偏�其蝙�其���������閬�凒憭抒��潭��賢銁閫��銝𠰴龪�?
                const trailWidth = fireflySize * 1.5;
                const trailLength = settings.trailLength || 50;
                const billboardOrbit = settings.billboardOrbit || false;

                // 頧券��𠰴�瘜Ｗ𢆡���
                const radiusWave = settings.radiusWave;
                if (radiusWave?.enabled) {
                  // 雿輻鍂瘚�𨫡 ID ����𤩺㦤�訾�嚗���𨅯鍳�券��箇㮾雿㵪�
                  const wavePhase = radiusWave.randomPhase
                    ? (parseInt(settings.id.replace(/\D/g, '') || '0') * 1.618) % (Math.PI * 2)
                    : 0;
                  const t = time * radiusWave.frequency + wavePhase;

                  let waveValue: number;
                  if (radiusWave.waveType === 'triangle') {
                    // 銝㕑�瘜ｇ��𣂼⏚��𣈲朣輻𠶖瘜Ｗ𢆡
                    // �砍�嚗? * |fract(t / (2�)) - 0.5| * 2 - 1嚗諹��?-1 �?1
                    const normalizedT = (t / (Math.PI * 2)) % 1;
                    waveValue = 4 * Math.abs(normalizedT - 0.5) - 1;
                  } else {
                    // 甇�憐瘜ｇ�暺䁅恕嚗?
                    waveValue = Math.sin(t);
                  }

                  radius += waveValue * radiusWave.amplitude;
                }

                // 霈∠�敶枏�閫鍦漲
                const angle = THREE.MathUtils.degToRad(phase) + time * speed;

                // 霈∠�頧券�撟喲𢒰銝羓�雿滨蔭
                const localPos = new THREE.Vector3(
                  radius * Math.cos(angle),
                  0,
                  radius * Math.sin(angle)
                );

                // 摨𠉛鍂頧券��贝蓮
                if (billboardOrbit && cameraRef.current) {
                  // �讛器璅∪�嚗朞膘�枏像�Ｗ�蝏���港�"�豢㦤�唳���葉敹?���蝥?
                  // 餈蹱甅�冽�隞𦒘遙雿閗�摨衣�嚗峕��日��典�撟訫像�Ｖ��𡁜��刻��?
                  const cameraPos = cameraRef.current.position.clone();
                  const viewDir = new THREE.Vector3().subVectors(planetPos, cameraPos).normalize();

                  // 頧券�瘜閧瑪 = 閫�瑪�孵�嚗���豢㦤����毺�銝剖�嚗?
                  const orbitNormal = viewDir;

                  // 霈∠�隞?Y 頧湛�暺䁅恕頧券�瘜閧瑪嚗匧�閫�瑪�孵����頧?
                  const defaultAxis = new THREE.Vector3(0, 1, 0);
                  const axisQuaternion = new THREE.Quaternion();
                  axisQuaternion.setFromUnitVectors(defaultAxis, orbitNormal);
                  localPos.applyQuaternion(axisQuaternion);
                } else {
                  // �桅�𡁏芋撘𧶏�雿輻鍂�箏��祈蓮頧?
                  const axisVec = getOrbitAxisVector(orbitAxisSettings);
                  const axisQuaternion = new THREE.Quaternion();
                  const defaultAxis = new THREE.Vector3(0, 1, 0);
                  const targetAxis = new THREE.Vector3(axisVec.x, axisVec.y, axisVec.z).normalize();
                  axisQuaternion.setFromUnitVectors(defaultAxis, targetAxis);
                  localPos.applyQuaternion(axisQuaternion);
                }

                // 銝𣇉��鞉�雿滨蔭
                const worldPos = localPos.clone().add(planetPos);

                // �湔鰵憭湧�雿滨蔭嚗�凒�乩耨�寥▲�對�
                const headPositions = fireflyData.headMesh.geometry.attributes.position.array as Float32Array;
                headPositions[0] = worldPos.x;
                headPositions[1] = worldPos.y;
                headPositions[2] = worldPos.z;
                fireflyData.headMesh.geometry.attributes.position.needsUpdate = true;

                // 霈∠��笔漲�煾�嚗�鍂鈭𡡞�笔漲�劐撓嚗?
                const velocity = new THREE.Vector3(
                  -radius * Math.sin(angle) * speed,
                  0,
                  radius * Math.cos(angle) * speed
                );

                // �湔鰵憭湧� uniforms嚗�𢆡��粉�𤥁挽蝵殷�
                const headMat = fireflyData.headMesh.material as THREE.ShaderMaterial;
                if (headMat.uniforms) {
                  // 头部样式映射：plain=0, flare=1, spark=2, texture=3, 星云粒子形状=4-15
                  const headStyleMap: Record<string, number> = {
                    plain: 0, flare: 1, spark: 2, texture: 3,
                    star: 4, snowflake: 5, heart: 6, crescent: 7, crossglow: 8,
                    sakura: 9, sun: 10, sun2: 11, plum: 12, lily: 13, lotus: 14, prism: 15
                  };

                  headMat.uniforms.uTime.value = time;
                  headMat.uniforms.uSize.value = (settings.size || 8) * (settings.brightness || 1);
                  headMat.uniforms.uHeadStyle.value = headStyleMap[settings.headStyle] ?? 1;
                  headMat.uniforms.uFlareIntensity.value = settings.flareIntensity ?? 1.0;
                  headMat.uniforms.uFlareLeaves.value = settings.flareLeaves ?? 4;
                  headMat.uniforms.uFlareWidth.value = settings.flareWidth ?? 0.5;
                  headMat.uniforms.uChromaticAberration.value = settings.chromaticAberration ?? 0.3;
                  headMat.uniforms.uVelocityStretch.value = settings.velocityStretch ?? 0.0;
                  headMat.uniforms.uVelocity.value.copy(velocity);
                  headMat.uniforms.uNoiseAmount.value = settings.noiseAmount ?? 0.2;
                  headMat.uniforms.uGlowIntensity.value = settings.glowIntensity ?? 0.5;
                  headMat.uniforms.uPulseSpeed.value = settings.pulseSpeed ?? 1;
                  const [r, g, b] = hexToRgb(settings.color);
                  const br = settings.brightness || 1;
                  headMat.uniforms.uColor.value.set(r * br, g * br, b * br);

                  // �冽��凒�啗斐�?
                  if (settings.headStyle === 'texture' && settings.headTexture) {
                    let texture = textureCache.current.get(settings.headTexture);
                    if (!texture) {
                      const loader = new THREE.TextureLoader();
                      texture = loader.load(settings.headTexture);
                      textureCache.current.set(settings.headTexture, texture);
                    }
                    headMat.uniforms.uTexture.value = texture;
                    headMat.uniforms.uUseTexture.value = 1.0;
                  } else {
                    headMat.uniforms.uUseTexture.value = 0.0;
                  }
                }

                // �湔鰵��蟮雿滨蔭嚗�鍂鈭擧�撠橘�
                fireflyData.history.unshift(worldPos.clone());
                while (fireflyData.history.length > trailLength) {
                  fireflyData.history.pop();
                }

                // �湔鰵撠暸�
                if (fireflyData.tailMesh && settings.trailEnabled) {
                  fireflyData.tailMesh.visible = true;
                  // �湔鰵撠暸�憸𡏭𠧧���𤩺�摨血�憭批�
                  const tailMat = fireflyData.tailMesh.material as THREE.ShaderMaterial;
                  if (tailMat.uniforms) {
                    const [r, g, b] = hexToRgb(settings.color);
                    const br = settings.brightness || 1;
                    tailMat.uniforms.uColor.value.set(r * br, g * br, b * br);
                    tailMat.uniforms.uOpacity.value = settings.trailOpacity ?? 0.8;
                    tailMat.uniforms.uSize.value = settings.size || 8;
                    tailMat.uniforms.uBrightness.value = br;
                  }
                  // �湔鰵�硋偏雿滨蔭
                  updateFireflyTail(fireflyData.tailMesh, fireflyData.history);

                  // �冽��凒�?taper嚗���?taperPower �孵�嚗?
                  const tapers = fireflyData.tailMesh.geometry.attributes.aTaper.array as Float32Array;
                  const trailLen = tapers.length;
                  for (let i = 0; i < trailLen; i++) {
                    const t = i / Math.max(trailLen - 1, 1);
                    tapers[i] = Math.pow(1 - t, settings.trailTaperPower ?? 1.0);
                  }
                  fireflyData.tailMesh.geometry.attributes.aTaper.needsUpdate = true;
                } else if (fireflyData.tailMesh) {
                  fireflyData.tailMesh.visible = false;
                }

              } else if (userData.type === 'wandering') {
                // 隞舘挽蝵桐葉�冽��粉�硋��?
                const settings = planet.fireflies.wanderingGroups.find(g => g.id === userData.groupId);
                const wanderingEnabled = planet.fireflies.wanderingEnabled;
                if (!fireflySystemEnabled || !wanderingEnabled || !settings || !settings.enabled) {
                  fireflyData.group.visible = false;
                  return;
                }
                fireflyData.group.visible = true;

                const innerR = settings.innerRadius * baseRadius;
                const outerR = settings.outerRadius * baseRadius;
                const moveSpeed = settings.speed * deltaTime * 0.05;
                const turnFreq = settings.turnFrequency;

                // �湔鰵雿滨蔭
                if (fireflyData.position && fireflyData.direction) {
                  // �𤩺㦤頧砍�
                  if (Math.random() < turnFreq * deltaTime * 0.02) {
                    const randomAngle = (Math.random() - 0.5) * Math.PI * 0.3;
                    const rotAxis = new THREE.Vector3(
                      Math.random() - 0.5,
                      Math.random() - 0.5,
                      Math.random() - 0.5
                    ).normalize();
                    fireflyData.direction.applyAxisAngle(rotAxis, randomAngle);
                    fireflyData.direction.normalize();
                  }

                  // 蝘餃𢆡
                  fireflyData.position.addScaledVector(fireflyData.direction, moveSpeed);

                  // 颲寧�璉�瘚页��詨笆鈭擧���葉敹��
                  const distFromCenter = fireflyData.position.length();
                  if (distFromCenter < innerR) {
                    const normal = fireflyData.position.clone().normalize();
                    fireflyData.position.copy(normal.multiplyScalar(innerR + 5));
                    fireflyData.direction.reflect(normal).normalize();
                  } else if (distFromCenter > outerR) {
                    const normal = fireflyData.position.clone().normalize();
                    fireflyData.position.copy(normal.multiplyScalar(outerR - 5));
                    fireflyData.direction.reflect(normal).normalize();
                  }

                  // 銝𣇉��鞉�雿滨蔭
                  const worldPos = fireflyData.position.clone().add(planetPos);

                  // �湔鰵憭湧�雿滨蔭
                  const headPositions = fireflyData.headMesh.geometry.attributes.position.array as Float32Array;
                  headPositions[0] = worldPos.x;
                  headPositions[1] = worldPos.y;
                  headPositions[2] = worldPos.z;
                  fireflyData.headMesh.geometry.attributes.position.needsUpdate = true;

                  // 霈∠��笔漲�煾�嚗�鍂鈭𡡞�笔漲�劐撓嚗?
                  const velocity = fireflyData.direction.clone().multiplyScalar(moveSpeed * 20);

                  // �湔鰵憭湧� uniforms
                  const headMat = fireflyData.headMesh.material as THREE.ShaderMaterial;
                  if (headMat.uniforms) {
                    // 头部样式映射：plain=0, flare=1, spark=2, texture=3, 星云粒子形状=4-15
                    const headStyleMap: Record<string, number> = {
                      plain: 0, flare: 1, spark: 2, texture: 3,
                      star: 4, snowflake: 5, heart: 6, crescent: 7, crossglow: 8,
                      sakura: 9, sun: 10, sun2: 11, plum: 12, lily: 13, lotus: 14, prism: 15
                    };

                    headMat.uniforms.uTime.value = time;
                    headMat.uniforms.uSize.value = (settings.size || 5) * (settings.brightness || 1);
                    headMat.uniforms.uHeadStyle.value = headStyleMap[settings.headStyle] ?? 1;
                    headMat.uniforms.uFlareIntensity.value = settings.flareIntensity ?? 1.0;
                    headMat.uniforms.uFlareLeaves.value = settings.flareLeaves ?? 4;
                    headMat.uniforms.uFlareWidth.value = settings.flareWidth ?? 0.5;
                    headMat.uniforms.uChromaticAberration.value = settings.chromaticAberration ?? 0.3;
                    headMat.uniforms.uVelocityStretch.value = settings.velocityStretch ?? 0.5;
                    headMat.uniforms.uVelocity.value.copy(velocity);
                    headMat.uniforms.uNoiseAmount.value = settings.noiseAmount ?? 0.2;
                    headMat.uniforms.uGlowIntensity.value = settings.glowIntensity ?? 0.5;
                    headMat.uniforms.uPulseSpeed.value = settings.pulseSpeed ?? 1.5;
                    const [r, g, b] = hexToRgb(settings.color);
                    const br = settings.brightness || 1;
                    headMat.uniforms.uColor.value.set(r * br, g * br, b * br);

                    // �冽��凒�啗斐�?
                    if (settings.headStyle === 'texture' && settings.headTexture) {
                      let texture = textureCache.current.get(settings.headTexture);
                      if (!texture) {
                        const loader = new THREE.TextureLoader();
                        texture = loader.load(settings.headTexture);
                        textureCache.current.set(settings.headTexture, texture);
                      }
                      headMat.uniforms.uTexture.value = texture;
                      headMat.uniforms.uUseTexture.value = 1.0;
                    } else {
                      headMat.uniforms.uUseTexture.value = 0.0;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Firefly update error:', e);
            }
          });
        }

        // �湔鰵瘜閖猐
        if (meshes.magicCircleData && meshes.magicCircleData.length > 0) {
          const magicCirclesEnabled = planet.magicCircles?.enabled ?? false;
          const soloId = planet.magicCircles?.soloId;
          meshes.magicCircleData.forEach(circleData => {
            // 隞舘挽蝵桐葉�瑕����圈�蝵?
            const settings = planet.magicCircles?.circles.find(c => c.id === circleData.id);
            // �典�撘��單��蓥葵瘜閖猐�喲𡡒�園��?
            if (!magicCirclesEnabled || !settings || !settings.enabled) {
              circleData.mesh.visible = false;
              return;
            }

            // Solo 璅∪�嚗𡁜蘨�曄內���瘜閖猐
            if (soloId && circleData.id !== soloId) {
              circleData.mesh.visible = false;
              return;
            }

            circleData.mesh.visible = true;

            // 瘜閖猐雿滨蔭嚗𡁜蘨��霈曄蔭�詨笆鈭𡒊��?Y �讐宏嚗��撌脩�頝罸��毺�雿滨蔭鈭��
            circleData.mesh.position.set(0, settings.yOffset, 0);

            // �湔鰵�暹�閫鍦漲
            const tiltAngles = getTiltAngles(settings.tilt ?? DEFAULT_TILT_SETTINGS);
            const baseRotX = -Math.PI / 2 + THREE.MathUtils.degToRad(tiltAngles.x);
            const baseRotY = THREE.MathUtils.degToRad(tiltAngles.y);
            const baseRotZ = THREE.MathUtils.degToRad(tiltAngles.z);

            // 摮睃�蝝舐妖��䌊頧祈�摨血� userData
            if (circleData.mesh.userData.selfRotation === undefined) {
              circleData.mesh.userData.selfRotation = 0;
            }
            circleData.mesh.userData.selfRotation += settings.rotationSpeed * 0.016;

            // 摨𠉛鍂�暹� + �芾蓮
            circleData.mesh.rotation.x = baseRotX;
            circleData.mesh.rotation.y = baseRotY;
            circleData.mesh.rotation.z = baseRotZ + circleData.mesh.userData.selfRotation;

            // �湔鰵�𠰴�嚗�憬�橘�- 蝏�歇蝏誩��其��毺�蝻拇𦆮嚗諹���蘨��閬���菔䌊頨怎�蝻拇𦆮
            const baseScale = settings.radius / 150;  // 150 �舫�霈文�敺?
            let currentScale = baseScale;

            // 蝻拇𦆮�澆𢙺���
            if (settings.breathEnabled) {
              const breathCycle = Math.sin(time * settings.breathSpeed * 2);
              currentScale *= 1 + breathCycle * settings.breathIntensity;
            }

            circleData.mesh.scale.setScalar(currentScale);

            // �湔鰵�鞱捶 uniforms
            const material = circleData.mesh.material as THREE.ShaderMaterial;
            if (material.uniforms) {
              material.uniforms.uOpacity.value = settings.opacity;
              material.uniforms.uHueShift.value = settings.hueShift;
              material.uniforms.uSaturationBoost.value = settings.saturationBoost ?? 1.0;
              material.uniforms.uBrightness.value = settings.brightness;

              // �匧��穃����
              let pulse = 0;
              if (settings.pulseEnabled) {
                pulse = (Math.sin(time * settings.pulseSpeed * 3) * 0.5 + 0.5) * settings.pulseIntensity;
              }
              material.uniforms.uPulse.value = pulse;

              // �湔鰵�閗𠧧璅∪���㺭
              material.uniforms.uBaseHue.value = settings.baseHue ?? 200;
              material.uniforms.uBaseSaturation.value = settings.baseSaturation ?? 1.0;

              // �湔鰵皜𣂼��脣��?
              const gc = settings.gradientColor;
              if (gc) {
                const colorModeMap: { [key: string]: number } = { 'none': 0, 'single': 4, 'twoColor': 1, 'threeColor': 2, 'procedural': 3 };
                const directionMap: { [key: string]: number } = { 'radial': 0, 'linearX': 1, 'linearY': 2, 'spiral': 3 };
                material.uniforms.uColorMode.value = gc.enabled ? (colorModeMap[gc.mode] || 0) : 0;
                material.uniforms.uGradientDir.value = directionMap[gc.direction || 'radial'] || 0;
                material.uniforms.uColorMidPos.value = gc.colorMidPosition ?? 0.5;
                material.uniforms.uColorMidWidth.value = gc.colorMidWidth ?? 1;
                material.uniforms.uColorMidWidth2.value = gc.colorMidWidth2 ?? 0;
                material.uniforms.uSpiralDensity.value = gc.spiralDensity ?? 2;
                material.uniforms.uProceduralIntensity.value = gc.proceduralIntensity ?? 1;

                // �湔鰵憸𡏭𠧧
                const parseColor = (hex: string) => {
                  const c = hex.replace('#', '');
                  return new THREE.Vector3(
                    parseInt(c.substring(0, 2), 16) / 255,
                    parseInt(c.substring(2, 4), 16) / 255,
                    parseInt(c.substring(4, 6), 16) / 255
                  );
                };
                if (gc.colors?.[0]) material.uniforms.uColor1.value = parseColor(gc.colors[0]);
                if (gc.colors?.[1]) material.uniforms.uColor2.value = parseColor(gc.colors[1]);
                if (gc.colors?.[2]) material.uniforms.uColor3.value = parseColor(gc.colors[2]);
              }

              // �冽��凒�啗斐�?
              if (settings.texture && settings.texture !== circleData.settings.texture) {
                let texture = textureCache.current.get(settings.texture);
                if (!texture) {
                  const loader = new THREE.TextureLoader();
                  texture = loader.load(settings.texture);
                  textureCache.current.set(settings.texture, texture);
                }
                material.uniforms.uTexture.value = texture;
                material.uniforms.uHasTexture.value = texture ? 1.0 : 0.0;
                circleData.settings = settings;
              }
            }
          });
        }

        // �湔鰵�賡�雿?
        if (meshes.energyBodyData && meshes.energyBodyData.length > 0) {
          // 憸𡏭𠧧閫��颲�𨭌�賣㺭
          const parseColor = (hex: string) => {
            const c = hex.replace('#', '');
            return new THREE.Vector3(
              parseInt(c.substring(0, 2), 16) / 255,
              parseInt(c.substring(2, 4), 16) / 255,
              parseInt(c.substring(4, 6), 16) / 255
            );
          };

          meshes.energyBodyData.forEach(ebData => {
            // 获取用户配置的能量体
            const rawEb = planet.energyBodySystem?.energyBodies?.find(e => e.id === ebData.id);
            if (!rawEb) {
              ebData.group.visible = false;
              return;
            }

            // 深度合并：使用 createDefaultEnergyBody 的完整默认值 + 用户配置覆盖
            const defaults = createDefaultEnergyBody(rawEb.id, rawEb.name);
            const eb: EnergyBodySettings = {
              ...defaults,
              ...rawEb,
              edgeEffect: { ...defaults.edgeEffect, ...(rawEb.edgeEffect || {}) },
              vertexEffect: { ...defaults.vertexEffect, ...(rawEb.vertexEffect || {}) },
              shellEffect: { ...defaults.shellEffect, ...(rawEb.shellEffect || {}) },
              organicAnimation: { ...defaults.organicAnimation, ...(rawEb.organicAnimation || {}) },
              lightFlow: { ...defaults.lightFlow, ...(rawEb.lightFlow || {}) },
              edgeBreathing: { ...defaults.edgeBreathing, ...(rawEb.edgeBreathing || {}) },
              sphericalVoronoi: { ...defaults.sphericalVoronoi, ...(rawEb.sphericalVoronoi || {}) },
              postEffects: { ...defaults.postEffects, ...(rawEb.postEffects || {}) },
              tilt: { ...defaults.tilt, ...(rawEb.tilt || {}) },
              rotationAxis: { ...defaults.rotationAxis, ...(rawEb.rotationAxis || {}) }
            };

            // Solo 模式检查
            const soloId = planet.energyBodySystem?.soloId;
            const coreEnabled = planet.energyBodySystem?.coreEnabled !== false;
            const visible = eb.enabled && planet.energyBodySystem?.enabled && coreEnabled && (!soloId || soloId === eb.id);
            if (!visible) {
              ebData.group.visible = false;
              return;
            }

            ebData.group.visible = true;

            const rotAxis = getRotationAxis(eb.rotationAxis);
            const { edgeEffect, vertexEffect, shellEffect, organicAnimation, lightFlow, edgeBreathing } = eb;

            // ========== �湔鰵�匧��嗆���頝臬�蝟餌�嚗?==========
            if (ebData.graph && ebData.lightPackets.length > 0 && lightFlow.enabled) {
              const pathConfig: PathSystemConfig = {
                pathMode: lightFlow.pathMode || 'euler',
                eulerMode: (lightFlow.eulerMode as any) || 'autoAugment',
                phaseMode: lightFlow.phaseMode || 'spread',
                count: lightFlow.count || 3,
                speed: lightFlow.speed || 1.0,
                noBacktrack: lightFlow.noBacktrack ?? true,
                coverageWeight: lightFlow.coverageWeight ?? 1.0,
                angleWeight: lightFlow.angleWeight ?? 0.5,
                dwellEnabled: lightFlow.dwellEnabled || false,
                dwellThreshold: lightFlow.dwellThreshold || 4,
                dwellDuration: lightFlow.dwellDuration || 0.3,
                dwellCooldown: lightFlow.dwellCooldown ?? 1.0,
                dwellPulseIntensity: lightFlow.dwellPulseIntensity || 2.0,
                minPacketSpacing: lightFlow.minPacketSpacing ?? 0.1
              };

              // �湔鰵�匧�
              updateLightPackets(ebData.lightPackets, ebData.graph, pathConfig, deltaTime * 0.001);

              // �湔鰵颲孵���㺭�?
              ebData.edgeLightData = getEdgeLightData(ebData.lightPackets, ebData.graph.edges.length);
            }

            // ========== 颲寧��鞱捶 uniforms �券��峕郊 ==========
            if (ebData.edgesMesh) {
              const mat = ebData.edgesMesh.material as THREE.ShaderMaterial;
              if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uRotationSpeed.value = eb.rotationSpeed;
                mat.uniforms.uRotationAxis.value.set(rotAxis.x, rotAxis.y, rotAxis.z);
                mat.uniforms.uBreathing.value = organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0;
                mat.uniforms.uBreathingSpeed.value = organicAnimation.breathingSpeed;
                mat.uniforms.uNoiseAmplitude.value = organicAnimation.noiseEnabled ? organicAnimation.noiseAmplitude : 0;
                mat.uniforms.uNoiseFrequency.value = organicAnimation.noiseFrequency;
                mat.uniforms.uNoiseSpeed.value = organicAnimation.noiseSpeed;
                mat.uniforms.uSpherize.value = eb.spherize;
                mat.uniforms.uRadius.value = eb.radius;
                mat.uniforms.uEdgeColor.value.copy(parseColor(edgeEffect.color));
                mat.uniforms.uGradientEndColor.value.copy(parseColor(edgeEffect.gradientEndColor));
                mat.uniforms.uGradientEnabled.value = edgeEffect.gradientEnabled ? 1.0 : 0.0;
                mat.uniforms.uGlowIntensity.value = edgeEffect.glowIntensity;
                mat.uniforms.uGlobalOpacity.value = eb.globalOpacity;
                mat.uniforms.uDashEnabled.value = edgeEffect.dashPattern.enabled ? 1.0 : 0.0;
                mat.uniforms.uDashRatio.value = edgeEffect.dashPattern.dashRatio;
                mat.uniforms.uDashDensity.value = edgeEffect.dashPattern.dashDensity ?? 10;
                mat.uniforms.uDashPhase.value = time * edgeEffect.dashPattern.flowSpeed;
                // �㗇� - 憭𡁜��舀�
                mat.uniforms.uLightFlowEnabled.value = lightFlow.enabled ? 1.0 : 0.0;
                mat.uniforms.uLightFlowColor.value.copy(parseColor(lightFlow.color));
                mat.uniforms.uLightFlowBasePhase.value = (time * lightFlow.speed) % 1.0;
                mat.uniforms.uLightFlowLength.value = lightFlow.length;
                mat.uniforms.uLightFlowIntensity.value = lightFlow.intensity;
                mat.uniforms.uLightFlowCount.value = lightFlow.count ?? 1;
                mat.uniforms.uLightFlowPhaseMode.value = lightFlow.phaseMode === 'sync' ? 0.0 : 1.0;
                mat.uniforms.uLightFlowPulseEnabled.value = lightFlow.pulseEnabled ? 1.0 : 0.0;
                mat.uniforms.uLightFlowPulseSpeed.value = lightFlow.pulseSpeed ?? 2.0;
                mat.uniforms.uBlendMode.value = eb.blendMode === 'additive' ? 0.0 : 1.0;

                // 頝臬�蝟餌��唳旿�湔鰵
                if (ebData.lightPackets.length > 0 && mat.uniforms.uLightPackets && lightFlow.pathMode !== 'edge') {
                  // 雿輻鍂頝臬�蝟餌�璅∪�
                  mat.uniforms.uUsePathSystem.value = 1.0;
                  const packets = mat.uniforms.uLightPackets.value as THREE.Vector2[];
                  for (let pi = 0; pi < 10; pi++) {
                    if (pi < ebData.lightPackets.length) {
                      const lp = ebData.lightPackets[pi];
                      packets[pi].set(lp.currentEdge, lp.edgeProgress);
                    } else {
                      packets[pi].set(-1, 0);
                    }
                  }
                } else {
                  // 雿輻鍂隡删�璅∪�嚗Ềdge 璅∪��𡝗��匧��唳旿�嗅���嚗?
                  mat.uniforms.uUsePathSystem.value = 0.0;
                }

                // 颲孵鐤�豢��?
                const edgeBreathing = eb.edgeBreathing;
                if (mat.uniforms.uEdgeBreathEnabled) {
                  mat.uniforms.uEdgeBreathEnabled.value = edgeBreathing?.enabled ? 1.0 : 0.0;
                  mat.uniforms.uEdgeBreathSpeed.value = edgeBreathing?.speed ?? 0.5;
                  mat.uniforms.uEdgeBreathGlowAmp.value = edgeBreathing?.glowAmplitude ?? 0.4;
                  mat.uniforms.uEdgeBreathAlphaAmp.value = edgeBreathing?.alphaAmplitude ?? 0.15;
                  mat.uniforms.uEdgeBreathNoiseMix.value = edgeBreathing?.noiseMix ?? 0.3;
                  mat.uniforms.uEdgeBreathNoiseScale.value = edgeBreathing?.noiseScale ?? 2.0;
                  mat.uniforms.uEdgeBreathNoiseSpeed.value = edgeBreathing?.noiseSpeed ?? 0.3;
                  // �芸ㄟ頝罸�撘��喉��桀��箏�銝箔�頝罸�嚗?
                  mat.uniforms.uEdgeBreathNoiseFollow.value = 0.0;
                }
              }
            }

            // ========== 憿嗥��鞱捶 uniforms �券��峕郊 ==========
            if (ebData.verticesMesh) {
              const mat = ebData.verticesMesh.material as THREE.ShaderMaterial;
              if (mat.uniforms) {
                const shapeMap: { [key: string]: number } = { 'circle': 0, 'diamond': 1, 'star': 2 };
                mat.uniforms.uTime.value = time;
                mat.uniforms.uRotationSpeed.value = eb.rotationSpeed;
                mat.uniforms.uRotationAxis.value.set(rotAxis.x, rotAxis.y, rotAxis.z);
                mat.uniforms.uBreathing.value = organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0;
                mat.uniforms.uBreathingSpeed.value = organicAnimation.breathingSpeed;
                mat.uniforms.uPointSize.value = vertexEffect.size;
                mat.uniforms.uSpherize.value = eb.spherize;
                mat.uniforms.uRadius.value = eb.radius;
                mat.uniforms.uVertexColor.value.copy(parseColor(vertexEffect.color));
                mat.uniforms.uGlowIntensity.value = vertexEffect.glowIntensity;
                mat.uniforms.uGlobalOpacity.value = eb.globalOpacity;
                mat.uniforms.uVertexShape.value = shapeMap[vertexEffect.shape] || 0;
                // �𣈯��匧�
                if (mat.uniforms.uDwellEnabled) {
                  mat.uniforms.uDwellEnabled.value = lightFlow.dwellEnabled ? 1.0 : 0.0;
                  mat.uniforms.uDwellThreshold.value = lightFlow.dwellThreshold ?? 4;
                  mat.uniforms.uDwellPulseIntensity.value = lightFlow.dwellPulseIntensity ?? 1.0;
                }
              }
            }

            // ========== ��ㄢ�鞱捶 uniforms �券��峕郊 ==========
            if (ebData.shellMesh) {
              const mat = ebData.shellMesh.material as THREE.ShaderMaterial;
              if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uRotationSpeed.value = eb.rotationSpeed;
                mat.uniforms.uRotationAxis.value.set(rotAxis.x, rotAxis.y, rotAxis.z);
                mat.uniforms.uBreathing.value = organicAnimation.breathingEnabled ? organicAnimation.breathingIntensity : 0;
                mat.uniforms.uBreathingSpeed.value = organicAnimation.breathingSpeed;
                mat.uniforms.uSpherize.value = eb.spherize;
                mat.uniforms.uRadius.value = eb.radius;
                mat.uniforms.uShellColor.value.copy(parseColor(shellEffect.color));
                mat.uniforms.uOpacity.value = shellEffect.opacity;
                mat.uniforms.uFresnelPower.value = shellEffect.fresnelPower;
                mat.uniforms.uFresnelIntensity.value = shellEffect.fresnelIntensity;
                mat.uniforms.uGlobalOpacity.value = eb.globalOpacity;
              }
              // �湔鰵�屸𢒰皜脫�
              mat.side = shellEffect.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
            }

            // ========== Voronoi �鞱捶 uniforms �券��峕郊 ==========
            if (ebData.voronoiMesh) {
              const mat = ebData.voronoiMesh.material as THREE.ShaderMaterial;
              const voronoi = eb.sphericalVoronoi;
              if (mat.uniforms && voronoi) {
                mat.uniforms.uTime.value = time;
                mat.uniforms.uRotationSpeed.value = eb.rotationSpeed;
                mat.uniforms.uRotationAxis.value.set(rotAxis.x, rotAxis.y, rotAxis.z);
                mat.uniforms.uLineColor.value.copy(parseColor(voronoi.lineColor));
                mat.uniforms.uLineWidth.value = voronoi.lineWidth;
                mat.uniforms.uLineGlow.value = voronoi.lineGlow;
                mat.uniforms.uFillOpacity.value = voronoi.fillEnabled ? voronoi.fillOpacity : 0;
                mat.uniforms.uBaseHue.value = voronoi.baseHue;
                mat.uniforms.uHueSpread.value = voronoi.hueSpread;
                const colorModeMap: { [key: string]: number } = { 'gradient': 0, 'random': 1, 'uniform': 2 };
                mat.uniforms.uColorMode.value = colorModeMap[voronoi.colorMode] || 0;
                mat.uniforms.uCellPulse.value = voronoi.cellPulse ? 1.0 : 0.0;
                mat.uniforms.uCellPulseSpeed.value = voronoi.cellPulseSpeed;
                mat.uniforms.uGlobalOpacity.value = eb.globalOpacity;

                // 蝘滚��孵𢆡�?- 雿輻鍂�渲䌊�嗥��芸ㄟ撽勗𢆡
                if (voronoi.animateSeeds && ebData.voronoiSeeds.length > 0) {
                  const seeds = ebData.voronoiSeeds;
                  const noiseScale = voronoi.seedNoiseScale || 1.0;
                  const speed = voronoi.seedSpeed || 0.2;
                  const amplitude = 0.15 * noiseScale;

                  // 隡?3D �芸ㄟ�賣㺭嚗���𣇉� Simplex-like嚗?
                  const noise3D = (x: number, y: number, z: number) => {
                    const p = x * 12.9898 + y * 78.233 + z * 37.719;
                    return Math.sin(p) * 43758.5453 % 1;
                  };

                  const animatedSeeds = seeds.map((seed, i) => {
                    // 瘥譍葵蝘滚�雿輻鍂銝滚���臁憯圈��瑚�蝵?
                    const seedHash = i * 0.618033988749895; // 暺��瘥𥪯�
                    const t = time * speed;

                    // 憭𡁻���臁憯啣��𩤃�璅⊥��渲䌊�嗥�頧刻蕨
                    const nx = noise3D(seedHash + t * 0.3, seedHash * 1.5 + t * 0.2, i * 0.1) * 2 - 1;
                    const ny = noise3D(seedHash + 100 + t * 0.25, seedHash * 1.3 + t * 0.35, i * 0.2 + 50) * 2 - 1;
                    const nz = noise3D(seedHash + 200 + t * 0.28, seedHash * 1.7 + t * 0.22, i * 0.15 + 100) * 2 - 1;

                    // 雿𡡞�靚��
                    const lowFreq = Math.sin(t * 0.1 + i * 0.5) * 0.3 + 0.7;

                    const offset = new THREE.Vector3(
                      nx * amplitude * lowFreq,
                      ny * amplitude * lowFreq,
                      nz * amplitude * lowFreq
                    );

                    // �典�雿滨��Ｖ��訫蔣撟嗅�銝��?
                    return seed.clone().add(offset).normalize();
                  });
                  mat.uniforms.uSeeds.value = animatedSeeds;
                }
              }

              // �批��航��?
              ebData.voronoiMesh.visible = voronoi?.enabled ?? false;
            }

            // �湔鰵�暹�閫鍦漲
            const tiltAngles = getTiltAngles(eb.tilt);
            ebData.group.rotation.set(tiltAngles.x, tiltAngles.y, tiltAngles.z);
          });
        }
      });

      // �湔鰵�擧����嚗�覔�株��譍�霈曄蔭嚗?
      if (chromaticPassRef.current || vignettePassRef.current) {
        let chromaticEnabled = false;
        let chromaticIntensity = 0;
        let vignetteEnabled = false;
        let vignetteIntensity = 0;
        let vignetteRadius = 0.8;

        // �滚����㗇�����賡�雿橒��𡝗�憭批�?
        currentSettings.planets?.forEach(planet => {
          planet.energyBodySystem?.energyBodies?.forEach(eb => {
            if (eb.enabled && eb.postEffects) {
              if (eb.postEffects.chromaticAberrationEnabled) {
                chromaticEnabled = true;
                chromaticIntensity = Math.max(chromaticIntensity, eb.postEffects.chromaticAberrationIntensity || 0.01);
              }
              if (eb.postEffects.vignetteEnabled) {
                vignetteEnabled = true;
                vignetteIntensity = Math.max(vignetteIntensity, eb.postEffects.vignetteIntensity || 0.5);
                vignetteRadius = eb.postEffects.vignetteRadius || 0.8;
              }
            }
          });
        });

        if (chromaticPassRef.current) {
          chromaticPassRef.current.enabled = chromaticEnabled;
          if (chromaticEnabled) {
            chromaticPassRef.current.uniforms.uIntensity.value = chromaticIntensity;
          }
        }
        if (vignettePassRef.current) {
          vignettePassRef.current.enabled = vignetteEnabled;
          if (vignetteEnabled) {
            vignettePassRef.current.uniforms.uIntensity.value = vignetteIntensity;
            vignettePassRef.current.uniforms.uRadius.value = vignetteRadius;
          }
        }
      }

      // �峕艶���嚗𡁜蘨�匧��豢㦤頝萘氖頞��摰匧��𠰴��嗆�頝罸�嚗䔶��蹱迤撣貉��游����撌格�
      if (backgroundSphereRef.current && cameraRef.current) {
        const bgRadius = 5000;
        const safeRadius = bgRadius * 0.8; // 摰匧��𠰴� = ����𠰴��?80%
        const camDist = cameraRef.current.position.length();

        if (camDist > safeRadius) {
          // 頞�枂摰匧���凒�塚�霈抵��航��讐㮾�綽�雿����銁摰匧��𠰴����
          const dir = cameraRef.current.position.clone().normalize();
          backgroundSphereRef.current.position.copy(dir.multiplyScalar(camDist - safeRadius));
        } else {
          // 甇�虜��凒����峕艶�箏��典��對�靽萘�閫�榆�?
          backgroundSphereRef.current.position.set(0, 0, 0);
        }
      }

      // ===== �湔鰵銝𠰴���� =====
      const dt = deltaTime / 1000;

      // 1. ���冽��冽凒�堆�撣衣�摰墧�撠橘�
      if (starRainRef.current) {
        const sr = starRainRef.current;
        const srEnabled = currentSettings.starRainEnabled ?? false;
        sr.headPoints.visible = srEnabled;
        const trailLengthParam = currentSettings.starRainTrailLength || 0;
        sr.tailPoints.visible = srEnabled && trailLengthParam > 0;

        if (srEnabled) {
          const particleCount = Math.min(currentSettings.starRainCount || 300, sr.maxCount);
          const speed = currentSettings.starRainSpeed || 1.0;
          const speedVar = currentSettings.starRainSpeedVariation || 0.5;
          const height = currentSettings.starRainHeight || 300;
          const spread = currentSettings.starRainSpread || 150;
          const size = currentSettings.starRainSize || 3;
          const brightness = currentSettings.starRainBrightness || 1.5;
          const reverse = currentSettings.starRainReverse || false;
          const colorHex = currentSettings.starRainColor || '#88ccff';
          const headStyle = currentSettings.starRainHeadStyle || 'plain';

          const headPosAttr = sr.headPoints.geometry.attributes.position as THREE.BufferAttribute;
          const headSizeAttr = sr.headPoints.geometry.attributes.size as THREE.BufferAttribute;
          const tailPosAttr = sr.tailPoints.geometry.attributes.position as THREE.BufferAttribute;
          const tailTaperAttr = sr.tailPoints.geometry.attributes.aTaper as THREE.BufferAttribute;
          const tailPositions = tailPosAttr.array as Float32Array;
          const tailTapers = tailTaperAttr.array as Float32Array;

          // �湔鰵瘥譍葵蝎鍦�
          for (let i = 0; i < sr.maxCount; i++) {
            if (i < particleCount) {
              sr.ages[i] += dt;

              // �滨�璉�瘚?
              const outOfBounds = reverse
                ? sr.positions[i * 3 + 1] < -50
                : sr.positions[i * 3 + 1] > height;

              if (sr.ages[i] > sr.maxAges[i] || outOfBounds) {
                const newX = (Math.random() - 0.5) * spread * 2;
                const newY = reverse ? height - Math.random() * 30 : -50 + Math.random() * 30;
                const newZ = (Math.random() - 0.5) * spread * 2;
                sr.positions[i * 3] = newX;
                sr.positions[i * 3 + 1] = newY;
                sr.positions[i * 3 + 2] = newZ;
                sr.ages[i] = 0;
                sr.maxAges[i] = 3 + Math.random() * 4;
                sr.velocities[i] = (1 - speedVar * 0.5 + Math.random() * speedVar) * speed;
                sr.sizes[i] = 0.5 + Math.random() * 1.0;
                // �滨蔭��蟮雿滨蔭
                for (let j = 0; j < sr.trailLength; j++) {
                  sr.histories[i][j].set(newX, newY, newZ);
                }
              }

              // �湔鰵雿滨蔭
              const direction = reverse ? -1 : 1;
              sr.positions[i * 3 + 1] += sr.velocities[i] * 50 * dt * direction;
              sr.positions[i * 3] += Math.sin(time * 2 + i) * 0.1;
              sr.positions[i * 3 + 2] += Math.cos(time * 2 + i * 1.3) * 0.1;

              // �湔鰵��蟮雿滨蔭嚗�宏�券��梹�
              const history = sr.histories[i];
              for (let j = sr.trailLength - 1; j > 0; j--) {
                history[j].copy(history[j - 1]);
              }
              history[0].set(sr.positions[i * 3], sr.positions[i * 3 + 1], sr.positions[i * 3 + 2]);

              // �湔鰵�硋偏蝎鍦�雿滨蔭
              for (let j = 0; j < sr.trailLength; j++) {
                const idx = i * sr.trailLength + j;
                tailPositions[idx * 3] = history[j].x;
                tailPositions[idx * 3 + 1] = history[j].y;
                tailPositions[idx * 3 + 2] = history[j].z;
                // �寞旿trailLengthParam靚�㟲taper嚗��撠暸鵭摨血��唳綉�嗅虾閫���湛�
                const t = j / (sr.trailLength - 1);
                const visibleRatio = Math.min(trailLengthParam, 1);
                tailTapers[idx] = t < visibleRatio ? Math.pow(1 - t / visibleRatio, 1.5) * trailLengthParam : 0;
              }
            } else {
              sr.positions[i * 3 + 1] = -10000;
              for (let j = 0; j < sr.trailLength; j++) {
                const idx = i * sr.trailLength + j;
                tailPositions[idx * 3 + 1] = -10000;
              }
            }
          }

          headPosAttr.set(sr.positions);
          headPosAttr.needsUpdate = true;
          headSizeAttr.set(sr.sizes);
          headSizeAttr.needsUpdate = true;
          tailPosAttr.needsUpdate = true;
          tailTaperAttr.needsUpdate = true;

          // �湔鰵憭湧��鞱捶
          const headMat = sr.headPoints.material as THREE.ShaderMaterial;
          headMat.uniforms.uBrightness.value = brightness;
          headMat.uniforms.uSizeScale.value = size;
          headMat.uniforms.uHeadStyle.value = headStyle === 'star' ? 1 : 0;
          const color = new THREE.Color(colorHex);
          headMat.uniforms.uColor.value = color;

          // �湔鰵�硋偏�鞱捶
          const tailMat = sr.tailPoints.material as THREE.ShaderMaterial;
          tailMat.uniforms.uBrightness.value = brightness * 0.8;
          tailMat.uniforms.uSizeScale.value = size * 0.8;
          tailMat.uniforms.uColor.value = color;
        }
      }

      // 2. 雿梶妖��㦛�湔鰵
      if (volumeFogRef.current) {
        const vf = volumeFogRef.current;
        const vfEnabled = currentSettings.volumeFogEnabled ?? false;
        vf.visible = vfEnabled;

        if (vfEnabled) {
          const fogSpeed = currentSettings.volumeFogSpeed || 0.3;
          const fogOpacity = currentSettings.volumeFogOpacity || 0.12;
          const fogHeight = currentSettings.volumeFogHeight || 120;
          const fogInner = currentSettings.volumeFogInnerRadius || 50;
          const fogOuter = currentSettings.volumeFogOuterRadius || 180;
          const fogLayers = currentSettings.volumeFogLayers || 5;
          const colorHex = currentSettings.volumeFogColor || '#4488cc';
          const fogColor = new THREE.Color(colorHex);

          vf.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              const layerIndex = child.userData.layerIndex || 0;
              const planeAxis = child.userData.planeAxis || 'xz';
              const mat = child.material as THREE.ShaderMaterial;
              mat.uniforms.uTime.value = time * fogSpeed + layerIndex * 0.5;
              mat.uniforms.uOpacity.value = fogOpacity * (1 - layerIndex / fogLayers * 0.3);
              mat.uniforms.uColor.value = fogColor;
              mat.uniforms.uInnerRadius.value = fogInner;
              mat.uniforms.uOuterRadius.value = fogOuter;

              // �朞�scale靚�㟲摰鮋�憭批�嚗��雿蓥��臬�雿滚之撠𧶏�
              child.scale.setScalar(fogOuter);

              // �寞旿撟喲𢒰�孵�霈曄蔭雿滨蔭��𢆡�?
              const baseOffset = (layerIndex / fogLayers) * fogHeight - fogHeight * 0.3;
              const floatOffset = Math.sin(time * fogSpeed * 0.5 + layerIndex * 0.7) * 15;

              const animOffset = baseOffset + floatOffset;
              const rotZ = time * fogSpeed * 0.05 + layerIndex * 0.15;
              if (planeAxis === 'xz') {
                child.position.y = animOffset;
              } else if (planeAxis === 'xy') {
                child.position.z = animOffset;
              } else if (planeAxis === 'yz') {
                child.position.x = animOffset;
              } else if (planeAxis === 'xz45') {
                child.position.y = animOffset * 0.7;
                child.position.z = animOffset * 0.7;
              } else if (planeAxis === 'xy45') {
                child.position.z = animOffset * 0.7;
                child.position.x = animOffset * 0.7;
              } else if (planeAxis === 'yz45') {
                child.position.x = animOffset * 0.7;
                child.position.y = animOffset * 0.7;
              }
              child.rotation.z = rotZ;

              // �批��航�撅�㺭
              child.visible = layerIndex < fogLayers;
            }
          });
        }
      }

      // 3. �厩��舐狩�湔鰵嚗�㺿餈𤤿�嚗朞蔓�㗇���鐤�貉��脯��url餈𣂼𢆡����脫��矋�
      if (lightOrbsRef.current) {
        const lo = lightOrbsRef.current;
        const loEnabled = currentSettings.lightOrbsEnabled;
        lo.group.visible = loEnabled;

        if (loEnabled) {
          const maxCount = currentSettings.lightOrbsMaxCount || 5;
          const spawnRate = currentSettings.lightOrbsSpawnRate || 2.5;
          const orbSize = currentSettings.lightOrbsSize || 12;
          const orbGrowth = currentSettings.lightOrbsGrowth || 2.0;
          const orbSpeed = currentSettings.lightOrbsSpeed || 0.6;
          const orbHeight = currentSettings.lightOrbsHeight || 250;
          const orbGlow = currentSettings.lightOrbsGlow || 2.5;
          const orbBurst = currentSettings.lightOrbsBurst !== false;
          const colorHex = currentSettings.lightOrbsColor || '#aaddff';
          const orbColor = new THREE.Color(colorHex);

          // ����啁�蝚潘�雿輻鍂頧臬��笌haderMaterial嚗?
          if (lo.orbs.length < maxCount && time - lo.lastSpawnTime > spawnRate) {
            // �Ｗ��豢㦤���颲孵耦
            const geometry = new THREE.PlaneGeometry(orbSize * 2, orbSize * 2);
            const material = new THREE.ShaderMaterial({
              uniforms: {
                uColor: { value: orbColor },
                uGlow: { value: orbGlow },
                uPulse: { value: 1.0 },
                uProgress: { value: 0.0 },
                uTime: { value: time },
                uSeed: { value: Math.random() * 100 }
              },
              vertexShader: `
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                uniform vec3 uColor;
                uniform float uGlow;
                uniform float uPulse;
                uniform float uProgress;
                uniform float uTime;
                uniform float uSeed;
                varying vec2 vUv;
                
                void main() {
                  vec2 center = vUv - 0.5;
                  float dist = length(center);
                  
                  // 頧臬����憭𡁜�擃䀹鱻�惩�嚗?
                  float core = exp(-dist * dist * 20.0) * 1.2;
                  float glow = exp(-dist * dist * 5.0) * 0.6;
                  float halo = exp(-dist * dist * 1.5) * 0.3;
                  float intensity = (core + glow + halo) * uGlow * uPulse;
                  
                  // 頧餃凝�脣榆嚗�器蝻睃��吔�
                  vec3 color = uColor;
                  color.r += halo * 0.2;
                  color.g += glow * 0.1;
                  
                  // �誯�摨行��矋��瑕��吔�
                  float warmth = uProgress * 0.3;
                  color.r += warmth;
                  color.b -= warmth * 0.5;
                  
                  // �𤩺�摨阡�餈𥕦漲銵啣�
                  float alpha = intensity * (1.0 - uProgress * 0.6);
                  
                  // 颲寧��𥪜�
                  alpha *= smoothstep(0.5, 0.3, dist);
                  
                  gl_FragColor = vec4(color * intensity, alpha);
                }
              `,
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthTest: true,
              depthWrite: false,
              side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            const startX = (Math.random() - 0.5) * 100;
            const startZ = (Math.random() - 0.5) * 100;
            mesh.position.set(startX, -30, startZ);
            mesh.userData.seed = Math.random() * 100;
            mesh.userData.startX = startX;
            mesh.userData.startZ = startZ;

            lo.group.add(mesh);
            lo.orbs.push({
              mesh,
              age: 0,
              maxAge: orbHeight / (orbSpeed * 50),
              speed: orbSpeed * (0.8 + Math.random() * 0.4),
              drift: { x: (Math.random() - 0.5) * 0.8, z: (Math.random() - 0.5) * 0.8 },
              burstTriggered: false
            });
            lo.lastSpawnTime = time;
          }

          // �湔鰵�唳��舐狩
          for (let i = lo.orbs.length - 1; i >= 0; i--) {
            const orb = lo.orbs[i];
            orb.age += dt;
            const progress = orb.age / orb.maxAge;

            // �Ｗ��豢㦤
            if (cameraRef.current) {
              orb.mesh.lookAt(cameraRef.current.position);
            }

            // Curl�芸ㄟ餈𣂼𢆡嚗�凝�讠�銝𠰴�嚗?
            const seed = orb.mesh.userData.seed || 0;
            const curlX = Math.sin(time * 1.5 + seed) * Math.cos(time * 0.8 + seed * 0.5) * 0.3;
            const curlZ = Math.cos(time * 1.2 + seed * 0.7) * Math.sin(time * 0.6 + seed) * 0.3;

            orb.mesh.position.y += orb.speed * 50 * dt;
            orb.mesh.position.x += (orb.drift.x + curlX) * dt * 30;
            orb.mesh.position.z += (orb.drift.z + curlZ) * dt * 30;

            // �刻�
            const scale = 1 + progress * (orbGrowth - 1);
            orb.mesh.scale.setScalar(scale);

            // �澆𢙺�匧�
            const pulse = 1.0 + Math.sin(time * 3.0 + seed) * 0.25;

            // �湔鰵ShaderMaterial uniforms
            const mat = orb.mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
              mat.uniforms.uColor.value = orbColor;
              mat.uniforms.uGlow.value = orbGlow;
              mat.uniforms.uPulse.value = pulse;
              mat.uniforms.uProgress.value = progress;
              mat.uniforms.uTime.value = time;
            }

            // ��袇�𣇉宏�?
            if (progress >= 1) {
              lo.group.remove(orb.mesh);
              orb.mesh.geometry.dispose();
              (orb.mesh.material as THREE.Material).dispose();
              lo.orbs.splice(i, 1);
            }
          }
        }
      }

      // 4. �蠘劓蝏睃㦛�湔鰵
      if (drawingTrailRef.current && cameraRef.current) {
        const trail = drawingTrailRef.current;
        const hand = handData.current;
        const leftHand = hand.leftHand;
        const rightHand = hand.rightHand;

        // 璉�瘚钅���撓�箸��選�隡睃�雿輻鍂�單�嚗��甈∪椰�页�
        const activeHand = rightHand?.isIndexPointing ? rightHand :
          leftHand?.isIndexPointing ? leftHand : null;

        if (activeHand) {
          trail.points.visible = true;

          // 霈∠�3D蝛粹𡢿銝剔����雿滨蔭
          const camera = cameraRef.current;
          const fingerPos = new THREE.Vector3(activeHand.x, activeHand.y, 0.5);
          fingerPos.unproject(camera);
          const dir = fingerPos.sub(camera.position).normalize();
          const distance = 500; // �箏�頝萘氖
          const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));

          // 璉�瘚𧢲糓�阡�閬�溶�䭾鰵蝎鍦�
          const distFromLast = worldPos.distanceTo(trail.lastDrawPos);
          const minDist = 5; // ��撠誯𡢿頝?

          if (!trail.isDrawing || distFromLast > minDist) {
            // 瘛餃��啁�摮?
            if (trail.activeCount < trail.maxCount) {
              const idx = trail.activeCount;
              trail.positions[idx * 3] = worldPos.x;
              trail.positions[idx * 3 + 1] = worldPos.y;
              trail.positions[idx * 3 + 2] = worldPos.z;
              // �嗆眾�脣蔗
              const hue = (time * 0.1 + idx * 0.01) % 1;
              const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
              trail.colors[idx * 3] = color.r;
              trail.colors[idx * 3 + 1] = color.g;
              trail.colors[idx * 3 + 2] = color.b;
              trail.sizes[idx] = 8 + Math.random() * 4;
              trail.ages[idx] = 0;
              trail.activeCount++;
            }
            trail.lastDrawPos.copy(worldPos);
            trail.isDrawing = true;
          }
        } else {
          trail.isDrawing = false;
        }

        // �湔鰵���㕑膘餈寧�摮琜�瘨�袇���嚗?
        const fadeTime = 2.0; // 2蝘埝��?
        let aliveCount = 0;
        for (let i = 0; i < trail.activeCount; i++) {
          trail.ages[i] += dt;
          const age = trail.ages[i];

          if (age < fadeTime) {
            // 蝎鍦�餈䀹暑��嚗峕凒�啣之撠𧶏�皜𣂼�嚗?
            const lifeRatio = 1 - age / fadeTime;
            trail.sizes[i] = (8 + Math.random() * 4) * lifeRatio;

            // 憒����閬��蝻拇㺭蝏��蝘餃𢆡蝎鍦�
            if (aliveCount !== i) {
              trail.positions[aliveCount * 3] = trail.positions[i * 3];
              trail.positions[aliveCount * 3 + 1] = trail.positions[i * 3 + 1];
              trail.positions[aliveCount * 3 + 2] = trail.positions[i * 3 + 2];
              trail.colors[aliveCount * 3] = trail.colors[i * 3];
              trail.colors[aliveCount * 3 + 1] = trail.colors[i * 3 + 1];
              trail.colors[aliveCount * 3 + 2] = trail.colors[i * 3 + 2];
              trail.sizes[aliveCount] = trail.sizes[i];
              trail.ages[aliveCount] = trail.ages[i];
            }
            aliveCount++;
          }
        }
        trail.activeCount = aliveCount;

        // �湔鰵�牐�雿?
        const posAttr = trail.points.geometry.attributes.position as THREE.BufferAttribute;
        const colorAttr = trail.points.geometry.attributes.color as THREE.BufferAttribute;
        const sizeAttr = trail.points.geometry.attributes.size as THREE.BufferAttribute;
        const ageAttr = trail.points.geometry.attributes.age as THREE.BufferAttribute;

        if (ageAttr) {
          ageAttr.needsUpdate = true;
          // �峕郊age�唳旿
          for (let i = 0; i < trail.activeCount; i++) {
            // 憒����閬��蝻拇㺭蝏��撌脩��其��Ｗ儐�臭葉憭��鈭��蝵桀�憸𡏭𠧧嚗諹���蘨��閬�＆靽?age 撅墧�扯◤甇�＆霈曄蔭
            // 瘜冽�嚗𡁶眏鈭𦒘��Ｗ儐�臬歇蝏誩�����讠憬嚗諹��?ageAttr �?array 摨磰砲撌脩�鋡急迤蝖格凒�唬�
            // 憒��銝𢠃𢒰��儐�舀迤蝖格凒�唬� trail.ages �啁�嚗屸�銋����蘨��閬��霈?needsUpdate
          }
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        // �鞱�瘝⊥�蝎鍦��?
        trail.points.visible = trail.activeCount > 0 || activeHand !== null;

        // �湔鰵 uniform uTime
        (trail.points.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      }

      // 4.5 �嗆眾頧刻蕨霈啣�嚗�鍂鈭𡒊�摮𣂼𢙺����頣�
      if (cameraRef.current) {
        const hand = handData.current;
        const leftHand = hand.leftHand;
        const rightHand = hand.rightHand;

        // 摰匧�璉��伐�蝖桐��见飵�唳旿�㗇�
        const isHandValid = hand && (hand.isActive || leftHand || rightHand);

        // 璉�瘚钅���撓�箸��?
        const activeHand = isHandValid && (rightHand?.isIndexPointing ? rightHand :
          leftHand?.isIndexPointing ? leftHand : null);

        if (activeHand) {
          const now = performance.now();
          const interval = 50; // 瘥?0ms霈啣�銝�銝芰�

          if (now - lastTrailTimeRef.current > interval) {
            lastTrailTimeRef.current = now;

            // 霈∠�銝𣇉��鞉�
            const camera = cameraRef.current;
            const fingerPos = new THREE.Vector3(activeHand.x, activeHand.y, 0.5);
            fingerPos.unproject(camera);
            const dir = fingerPos.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));

            // 瘛餃��啗膘餈寞㺭蝏��靽脲���憭?0銝芰�嚗?
            trailRef.current.push(worldPos.clone());
            if (trailRef.current.length > 50) {
              trailRef.current.shift();
            }
          }
        } else {
          // �𧢲�蝳餃��嗅翰����方膘餈?
          if (trailRef.current.length > 0) {
            // 憒���见飵�唳旿摰���䭾�嚗𣬚��單�蝛?
            if (!isHandValid) {
              trailRef.current = [];
            } else {
              // �血��鞉�皜�膄嚗��撣抒宏�文�銝芰��惩翰皜�膄嚗?
              const now = performance.now();
              if (now - lastTrailTimeRef.current > 30) {
                lastTrailTimeRef.current = now;
                // 瘥𤩺活蝘駁膄3銝芰��惩翰皜�膄�笔漲
                for (let i = 0; i < 3 && trailRef.current.length > 0; i++) {
                  trailRef.current.shift();
                }
              }
            }
          }
        }
      }

      // 5. �抵捶��𠧧����湔鰵
      if (slashEffectRef.current && cameraRef.current) {
        const slash = slashEffectRef.current;
        const slashCamera = cameraRef.current;
        const hand = handData.current;
        const leftHand = hand.leftHand;
        const rightHand = hand.rightHand;

        // 璉�瘚见��嗆��踹�敹恍�毺宏�?
        const activeHand = rightHand?.isKnifeHand ? rightHand :
          leftHand?.isKnifeHand ? leftHand : null;

        if (activeHand) {
          const speed = Math.sqrt(activeHand.velocity.x ** 2 + activeHand.velocity.y ** 2);
          const speedThreshold = 5.0; // �鞾�閫血����潘��踹�霂航圻

          if (speed > speedThreshold && !slash.active) {
            // 撘�憪𧢲鰵����?
            slash.active = true;
            slash.startTime = time;
            // 霈∠�撅誩��惩�雿滨蔭
            const vector = new THREE.Vector3(activeHand.x, activeHand.y, 0.5);
            vector.unproject(slashCamera);
            const dir = vector.sub(slashCamera.position).normalize();
            const distance = -slashCamera.position.z / dir.z; // �訫��?Z=0 撟喲𢒰
            const worldPos = slashCamera.position.clone().add(dir.multiplyScalar(distance));

            slash.startPos.copy(worldPos);
            // slash.startPos.set(activeHand.x * 400, activeHand.y * 300, 0); // �批���恣蝞埈䲮撘?

            // 霈∠���𠧧�孵�嚗��銝��吔�
            const velDir = new THREE.Vector3(activeHand.velocity.x, activeHand.velocity.y, 0).normalize();
            slash.direction.copy(velDir);

            // 憸�挽蝏𤘪��對��寞旿�笔漲憸��嚗?
            slash.endPos.copy(slash.startPos).add(velDir.multiplyScalar(300));

            slash.healProgress = 0;
          }

          if (slash.active && time - slash.startTime < 0.5) {
            // �典��脣����蝏剜凒�啁��毺�嚗諹��𤩺��?
            const vector = new THREE.Vector3(activeHand.x, activeHand.y, 0.5);
            vector.unproject(slashCamera);
            const dir = vector.sub(slashCamera.position).normalize();
            const distance = -slashCamera.position.z / dir.z;
            const worldPos = slashCamera.position.clone().add(dir.multiplyScalar(distance));
            slash.endPos.copy(worldPos);
          }
        }

        // ���餈��嚗?蝘𡜐�
        if (slash.active) {
          const healTime = 3.0;
          slash.healProgress = Math.min(1, (time - slash.startTime) / healTime);

          if (slash.healProgress >= 1) {
            slash.active = false;
          }
        }
      }

      // Ink Manager Update
      if (inkManagerRef.current) {
        // Wire drawSettings to InkManager
        if (drawSettings) {
          inkManagerRef.current.setSettings(drawSettings);

          // Find and set planet mesh for raycasting
          const activeInstance = drawSettings.instances?.find(i => i.id === drawSettings.activeInstanceId);
          const targetPlanetId = activeInstance?.bindPlanetId || planetSettings.planets[0]?.id;
          const targetPlanetData = targetPlanetId ? planetMeshesRef.current.get(targetPlanetId) : null;

          if (targetPlanetData?.core) {
            inkManagerRef.current.setPlanet(targetPlanetData.core);
          } else {
            // Fallback
            const firstPlanetData = Array.from(planetMeshesRef.current.values())[0];
            if (firstPlanetData?.core) {
              inkManagerRef.current.setPlanet(firstPlanetData.core);
            }
          }
        }

        inkManagerRef.current.update(time);
      }

      // 渲染
      if (composerRef.current) {
        composerRef.current.render();
      }

      // �湔鰵�豢㦤靽⊥�嚗��撣批�靚��甈∩�憭芷�蝜���𣂼�銝箸�10撣找�甈∴�
      if (onCameraChangeRef.current && cameraRef.current && controlsRef.current && Math.floor(time * 60) % 10 === 0) {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const distance = camera.position.distanceTo(controls.target);

        onCameraChangeRef.current({
          position: {
            x: Math.round(camera.position.x),
            y: Math.round(camera.position.y),
            z: Math.round(camera.position.z)
          },
          distance: Math.round(distance),
          polarAngle: Math.round(controls.getPolarAngle() * 180 / Math.PI),
          azimuthAngle: Math.round(controls.getAzimuthalAngle() * 180 / Math.PI)
        });
      }
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [handData]); // 优化：仅依赖 handData

  // Toggle OrbitControls based on drawing mode
  useEffect(() => {
    if (controlsRef.current) {
      // Disable controls when drawing is enabled to prevent camera movement intervention
      controlsRef.current.enabled = !drawSettings?.enabled;
    }
  }, [drawSettings?.enabled]);

  // 摮睃噼?ref嚗滚𢆡餃儐臭韏吔
  const onCameraChangeRef = useRef(onCameraChange);
  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  // 霈曄蔭�滨蔭�豢㦤�賣㺭
  useEffect(() => {
    if (resetCameraRef) {
      resetCameraRef.current = () => {
        if (!cameraRef.current || !controlsRef.current) return;

        const camera = cameraRef.current;
        const controls = controlsRef.current;

        // �格�雿滨蔭
        const targetPos = new THREE.Vector3(
          INITIAL_CAMERA.position.x,
          INITIAL_CAMERA.position.y,
          INITIAL_CAMERA.position.z
        );
        const targetTarget = new THREE.Vector3(
          INITIAL_CAMERA.target.x,
          INITIAL_CAMERA.target.y,
          INITIAL_CAMERA.target.z
        );

        // 撟單�餈�腹�函𤫇
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const duration = 800; // 瘥怎�
        const startTime = Date.now();

        const animateReset = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // 蝻枏𢆡�賣㺭 (easeOutCubic)
          const eased = 1 - Math.pow(1 - progress, 3);

          camera.position.lerpVectors(startPos, targetPos, eased);
          controls.target.lerpVectors(startTarget, targetTarget, eased);
          controls.update();

          if (progress < 1) {
            requestAnimationFrame(animateReset);
          }
        };

        animateReset();
      };
    }

    return () => {
      if (resetCameraRef) {
        resetCameraRef.current = null;
      }
    };
  }, [resetCameraRef]);

  // ==================== 煺蝎鍦蝟餌嚗𡁏芋撘𧶏 ====================
  useEffect(() => {
    // 检查是否有启用的星云实例 - 如果有，不渲染主星云（避免双重渲染）
    const hasEnabledInstances = (nebulaSettings?.nebulaInstances || []).some(n => n.enabled);

    if (!sceneRef.current || !sceneReady || !nebulaData || !nebulaSettings || !overlayMode || hasEnabledInstances) {
      // 清理已有的主星云（无论是因为关闭互通模式还是因为有实例）
      if (nebulaPointsRef.current && sceneRef.current) {
        sceneRef.current.remove(nebulaPointsRef.current);
        nebulaPointsRef.current.geometry.dispose();
        if (nebulaMaterialRef.current) {
          nebulaMaterialRef.current.dispose();
        }
        nebulaPointsRef.current = null;
        nebulaMaterialRef.current = null;
      }
      return;
    }

    // 皜���抒��煺�蝎鍦�
    if (nebulaPointsRef.current) {
      sceneRef.current.remove(nebulaPointsRef.current);
      nebulaPointsRef.current.geometry.dispose();
      if (nebulaMaterialRef.current) {
        nebulaMaterialRef.current.dispose();
      }
    }

    // �𥕦遣�煺��牐�雿?
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(nebulaData.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(nebulaData.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(nebulaData.sizes, 1));

    // 瘛餃�蝎鍦�ID
    const particleIds = new Float32Array(nebulaData.count);
    for (let i = 0; i < nebulaData.count; i++) {
      particleIds[i] = i;
    }
    geometry.setAttribute('aParticleId', new THREE.BufferAttribute(particleIds, 1));

    // 瘛餃�tile蝝Ｗ�嚗�鍂鈭𤾸�雿閙�撠�𣄽�伐�
    const tileIndices = new Float32Array(nebulaData.count * 2);
    for (let i = 0; i < nebulaData.count; i++) {
      tileIndices[i * 2] = 0;
      tileIndices[i * 2 + 1] = 0;
    }
    geometry.setAttribute('aTileIndex', new THREE.BufferAttribute(tileIndices, 2));

    geometry.center();

    // �𥕦遣�煺��鞱捶
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: nebulaSettings.baseSize * 4.0 },
        uHandPos: { value: new THREE.Vector3() },
        uHandActive: { value: 0.0 },
        uInteractionRadius: { value: nebulaSettings.interactionRadius },
        uInteractionStrength: { value: nebulaSettings.interactionStrength },
        uReturnSpeed: { value: nebulaSettings.returnSpeed },
        uExplosion: { value: 0.0 },
        uBlackHole: { value: 0.0 },
        // ��������㺭
        uExplosionExpansion: { value: nebulaSettings.nebulaExplosionExpansion ?? 300 },
        uExplosionTurbulence: { value: nebulaSettings.nebulaExplosionTurbulence ?? 80 },
        uExplosionRotation: { value: nebulaSettings.nebulaExplosionRotation ?? 0.4 },
        uExplosionSizeBoost: { value: nebulaSettings.nebulaExplosionSizeBoost ?? 8 },
        // 暺烐������㺭
        uBlackHoleCompression: { value: nebulaSettings.nebulaBlackHoleCompression ?? 0.05 },
        uBlackHoleSpinSpeed: { value: nebulaSettings.nebulaBlackHoleSpinSpeed ?? 400 },
        uBlackHoleTargetRadius: { value: nebulaSettings.nebulaBlackHoleTargetRadius ?? 30 },
        uBlackHolePull: { value: nebulaSettings.nebulaBlackHolePull ?? 0.95 },
        uColor: { value: new THREE.Color(0xffffff) },
        uShape: { value: 0.0 },
        uShapeTexture: { value: null },
        uSaturation: { value: nebulaSettings.colorSaturation },
        uTurbulence: { value: nebulaSettings.particleTurbulence },
        uTurbulenceSpeed: { value: nebulaSettings.turbulenceSpeed },
        uTurbulenceScale: { value: nebulaSettings.turbulenceScale },
        uGlowMode: { value: 1.0 },
        uGlowIntensity: { value: nebulaSettings.glowIntensity },
        uBreathing: { value: nebulaSettings.breathingEnabled ? nebulaSettings.breathingIntensity : 0.0 },
        uBreathingSpeed: { value: nebulaSettings.breathingSpeed },
        uRipple: { value: nebulaSettings.rippleEnabled ? nebulaSettings.rippleIntensity : 0.0 },
        uRippleSpeed: { value: nebulaSettings.rippleSpeed },
        uAccretion: { value: nebulaSettings.accretionEnabled ? nebulaSettings.accretionIntensity : 0.0 },
        uAccretionSpeed: { value: nebulaSettings.accretionSpeed },
        uAccretionRadii: {
          value: new THREE.Vector3(
            nebulaSettings.accretionLayers?.[0]?.radiusMax ?? 100,
            nebulaSettings.accretionLayers?.[1]?.radiusMax ?? 200,
            nebulaSettings.accretionLayers?.[2]?.radiusMax ?? 400
          )
        },
        uAccretionDirs: {
          value: new THREE.Vector3(
            nebulaSettings.accretionLayers?.[0]?.enabled ? (nebulaSettings.accretionLayers?.[0]?.direction ?? 1) : 1,
            nebulaSettings.accretionLayers?.[1]?.enabled ? (nebulaSettings.accretionLayers?.[1]?.direction ?? -1) : -1,
            nebulaSettings.accretionLayers?.[2]?.enabled ? (nebulaSettings.accretionLayers?.[2]?.direction ?? 1) : 1
          )
        },
        uAccretionSpeeds: {
          value: new THREE.Vector3(
            nebulaSettings.accretionLayers?.[0]?.enabled ? (nebulaSettings.accretionLayers?.[0]?.speedMultiplier ?? 2) : 2,
            nebulaSettings.accretionLayers?.[1]?.enabled ? (nebulaSettings.accretionLayers?.[1]?.speedMultiplier ?? 1) : 1,
            nebulaSettings.accretionLayers?.[2]?.enabled ? (nebulaSettings.accretionLayers?.[2]?.speedMultiplier ?? 0.5) : 0.5
          )
        },
        uAccretionLayerCount: { value: (nebulaSettings.accretionLayers || []).filter(l => l.enabled).length },
        // 海浪效果
        uWaveEnabled: { value: nebulaSettings.waveEnabled ? 1.0 : 0.0 },
        uWaveIntensity: { value: nebulaSettings.waveIntensity ?? 0 },
        uWaveSpeed: { value: nebulaSettings.waveSpeed ?? 1 },
        uWaveSteepness: { value: nebulaSettings.waveSteepness ?? 0.5 },
        uWaveLayers: { value: nebulaSettings.waveLayers ?? 2 },
        uWaveDirection: { value: (nebulaSettings.waveDirection ?? 0) * Math.PI / 180 },
        uWaveDepthFade: { value: nebulaSettings.waveDepthFade ?? 0.5 },
        uWaveFoam: { value: nebulaSettings.waveFoam ? 1.0 : 0.0 },
        uGeometryMapping: { value: 0 },
        uMappingStrength: { value: 0 },
        uMappingRadius: { value: 200 },
        uImageSize: { value: new THREE.Vector2(nebulaData.canvasWidth || 800, nebulaData.canvasHeight || 600) },
        uMappingTileX: { value: 1 },
        uMappingTileY: { value: 1 },
        uMappingEdgeFade: { value: 0.1 },
        // 荧光闪烁
        uFlickerEnabled: { value: nebulaSettings.flickerEnabled ? 1 : 0 },
        uFlickerIntensity: { value: nebulaSettings.flickerIntensity ?? 0.5 },
        uFlickerSpeed: { value: nebulaSettings.flickerSpeed ?? 3 },
        uBrightness: { value: nebulaSettings.brightness * (nebulaSettings.overlayBrightness ?? 0.5) },
        uOpacity: { value: nebulaSettings.opacity },
        // 互通模式颜色补偿
        uOverlayMode: { value: nebulaSettings.overlayColorCompensation ?? 1.0 },
        // 游走闪电
        uWanderingLightning: { value: nebulaSettings.wanderingLightningEnabled ? nebulaSettings.wanderingLightningIntensity : 0 },
        uWanderingLightningSpeed: { value: nebulaSettings.wanderingLightningSpeed ?? 1 },
        uWanderingLightningDensity: { value: nebulaSettings.wanderingLightningDensity ?? 3 },
        uWanderingLightningWidth: { value: nebulaSettings.wanderingLightningWidth ?? 0.02 },
        // 闪电击穿
        uLightningBreakdown: { value: nebulaSettings.lightningBreakdownEnabled ? nebulaSettings.lightningBreakdownIntensity : 0 },
        uLightningBreakdownFreq: { value: nebulaSettings.lightningBreakdownFrequency ?? 0.5 },
        uLightningBranches: { value: nebulaSettings.lightningBreakdownBranches ?? 2 },
      },
      vertexShader: nebulaCanvasVertexShader,
      fragmentShader: nebulaCanvasFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: (nebulaSettings.overlayBlendMode ?? NebulaBlendMode.Additive) === NebulaBlendMode.Additive
        ? THREE.AdditiveBlending
        : THREE.NormalBlending
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 100; // 在星球之后渲染，确保混合模式正确工作
    sceneRef.current.add(points);
    nebulaPointsRef.current = points;
    nebulaMaterialRef.current = material;

  }, [nebulaData, overlayMode, sceneReady, nebulaSettings?.nebulaInstances]);

  // �湔鰵�煺�uniforms
  useEffect(() => {
    if (!nebulaMaterialRef.current || !nebulaSettings) return;

    const material = nebulaMaterialRef.current;
    material.uniforms.uSize.value = nebulaSettings.baseSize * 4.0;
    material.uniforms.uSaturation.value = nebulaSettings.colorSaturation;
    material.uniforms.uTurbulence.value = nebulaSettings.particleTurbulence;
    material.uniforms.uTurbulenceSpeed.value = nebulaSettings.turbulenceSpeed;
    material.uniforms.uTurbulenceScale.value = nebulaSettings.turbulenceScale;
    material.uniforms.uGlowIntensity.value = nebulaSettings.glowIntensity;
    material.uniforms.uBreathing.value = nebulaSettings.breathingEnabled ? nebulaSettings.breathingIntensity : 0.0;
    material.uniforms.uBreathingSpeed.value = nebulaSettings.breathingSpeed;
    material.uniforms.uRipple.value = nebulaSettings.rippleEnabled ? nebulaSettings.rippleIntensity : 0.0;
    material.uniforms.uRippleSpeed.value = nebulaSettings.rippleSpeed;
    material.uniforms.uAccretion.value = nebulaSettings.accretionEnabled ? nebulaSettings.accretionIntensity : 0.0;
    material.uniforms.uAccretionSpeed.value = nebulaSettings.accretionSpeed;
    material.uniforms.uAccretionRadii.value.set(
      nebulaSettings.accretionLayers?.[0]?.radiusMax ?? 100,
      nebulaSettings.accretionLayers?.[1]?.radiusMax ?? 200,
      nebulaSettings.accretionLayers?.[2]?.radiusMax ?? 400
    );
    material.uniforms.uAccretionDirs.value.set(
      nebulaSettings.accretionLayers?.[0]?.enabled ? (nebulaSettings.accretionLayers?.[0]?.direction ?? 1) : 1,
      nebulaSettings.accretionLayers?.[1]?.enabled ? (nebulaSettings.accretionLayers?.[1]?.direction ?? -1) : -1,
      nebulaSettings.accretionLayers?.[2]?.enabled ? (nebulaSettings.accretionLayers?.[2]?.direction ?? 1) : 1
    );
    material.uniforms.uAccretionSpeeds.value.set(
      nebulaSettings.accretionLayers?.[0]?.enabled ? (nebulaSettings.accretionLayers?.[0]?.speedMultiplier ?? 2) : 2,
      nebulaSettings.accretionLayers?.[1]?.enabled ? (nebulaSettings.accretionLayers?.[1]?.speedMultiplier ?? 1) : 1,
      nebulaSettings.accretionLayers?.[2]?.enabled ? (nebulaSettings.accretionLayers?.[2]?.speedMultiplier ?? 0.5) : 0.5
    );
    material.uniforms.uAccretionLayerCount.value = (nebulaSettings.accretionLayers || []).filter(l => l.enabled).length;
    material.uniforms.uBrightness.value = nebulaSettings.brightness * (nebulaSettings.overlayBrightness ?? 0.5);
    material.uniforms.uOpacity.value = nebulaSettings.opacity;
    material.uniforms.uOverlayMode.value = nebulaSettings.overlayColorCompensation ?? 1.0;
    // 更新混合模式
    material.blending = (nebulaSettings.overlayBlendMode ?? NebulaBlendMode.Additive) === NebulaBlendMode.Additive
      ? THREE.AdditiveBlending
      : THREE.NormalBlending;
    material.depthTest = false;
    material.depthWrite = false;
    material.uniforms.uFlickerEnabled.value = nebulaSettings.flickerEnabled ? 1.0 : 0.0;
    material.uniforms.uFlickerIntensity.value = nebulaSettings.flickerIntensity;
    material.uniforms.uFlickerSpeed.value = nebulaSettings.flickerSpeed;
    // 更新海浪效果
    material.uniforms.uWaveEnabled.value = nebulaSettings.waveEnabled ? 1.0 : 0.0;
    material.uniforms.uWaveIntensity.value = nebulaSettings.waveIntensity ?? 0;
    material.uniforms.uWaveSpeed.value = nebulaSettings.waveSpeed ?? 1;
    material.uniforms.uWaveSteepness.value = nebulaSettings.waveSteepness ?? 0.5;
    material.uniforms.uWaveLayers.value = nebulaSettings.waveLayers ?? 2;
    material.uniforms.uWaveDirection.value = (nebulaSettings.waveDirection ?? 0) * Math.PI / 180;
    material.uniforms.uWaveDepthFade.value = nebulaSettings.waveDepthFade ?? 0.5;
    material.uniforms.uWaveFoam.value = nebulaSettings.waveFoam ? 1.0 : 0.0;
    // 更新游走闪电
    material.uniforms.uWanderingLightning.value = nebulaSettings.wanderingLightningEnabled ? nebulaSettings.wanderingLightningIntensity : 0;
    material.uniforms.uWanderingLightningSpeed.value = nebulaSettings.wanderingLightningSpeed ?? 1;
    material.uniforms.uWanderingLightningDensity.value = nebulaSettings.wanderingLightningDensity ?? 3;
    material.uniforms.uWanderingLightningWidth.value = nebulaSettings.wanderingLightningWidth ?? 0.02;
    // 更新闪电击穿
    material.uniforms.uLightningBreakdown.value = nebulaSettings.lightningBreakdownEnabled ? nebulaSettings.lightningBreakdownIntensity : 0;
    material.uniforms.uLightningBreakdownFreq.value = nebulaSettings.lightningBreakdownFrequency ?? 0.5;
    material.uniforms.uLightningBranches.value = nebulaSettings.lightningBreakdownBranches ?? 2;
    // 爆炸效果参数
    material.uniforms.uExplosionExpansion.value = nebulaSettings.nebulaExplosionExpansion ?? 300;
    material.uniforms.uExplosionTurbulence.value = nebulaSettings.nebulaExplosionTurbulence ?? 80;
    material.uniforms.uExplosionRotation.value = nebulaSettings.nebulaExplosionRotation ?? 0.4;
    material.uniforms.uExplosionSizeBoost.value = nebulaSettings.nebulaExplosionSizeBoost ?? 8;
    // 黑洞效果参数
    material.uniforms.uBlackHoleCompression.value = nebulaSettings.nebulaBlackHoleCompression ?? 0.05;
    material.uniforms.uBlackHoleSpinSpeed.value = nebulaSettings.nebulaBlackHoleSpinSpeed ?? 400;
    material.uniforms.uBlackHoleTargetRadius.value = nebulaSettings.nebulaBlackHoleTargetRadius ?? 30;
    material.uniforms.uBlackHolePull.value = nebulaSettings.nebulaBlackHolePull ?? 0.95;
    // 标记材质需要更新
    material.needsUpdate = true;
  }, [nebulaSettings?.baseSize, nebulaSettings?.colorSaturation, nebulaSettings?.particleTurbulence, nebulaSettings?.turbulenceSpeed, nebulaSettings?.turbulenceScale, nebulaSettings?.glowIntensity, nebulaSettings?.breathingEnabled, nebulaSettings?.breathingIntensity, nebulaSettings?.breathingSpeed, nebulaSettings?.rippleEnabled, nebulaSettings?.rippleIntensity, nebulaSettings?.rippleSpeed, nebulaSettings?.accretionEnabled, nebulaSettings?.accretionIntensity, nebulaSettings?.accretionSpeed, nebulaSettings?.brightness, nebulaSettings?.overlayBrightness, nebulaSettings?.overlayBlendMode, nebulaSettings?.overlayBloomStrength, nebulaSettings?.overlayColorCompensation, nebulaSettings?.opacity, nebulaSettings?.flickerEnabled, nebulaSettings?.flickerIntensity, nebulaSettings?.flickerSpeed, nebulaSettings?.waveEnabled, nebulaSettings?.waveIntensity, nebulaSettings?.waveSpeed, nebulaSettings?.waveSteepness, nebulaSettings?.waveLayers, nebulaSettings?.waveDirection, nebulaSettings?.waveDepthFade, nebulaSettings?.waveFoam, nebulaSettings?.wanderingLightningEnabled, nebulaSettings?.wanderingLightningIntensity, nebulaSettings?.wanderingLightningSpeed, nebulaSettings?.wanderingLightningDensity, nebulaSettings?.wanderingLightningWidth, nebulaSettings?.lightningBreakdownEnabled, nebulaSettings?.lightningBreakdownIntensity, nebulaSettings?.lightningBreakdownFrequency, nebulaSettings?.lightningBreakdownBranches, nebulaSettings?.nebulaExplosionExpansion, nebulaSettings?.nebulaExplosionTurbulence, nebulaSettings?.nebulaExplosionRotation, nebulaSettings?.nebulaExplosionSizeBoost, nebulaSettings?.nebulaBlackHoleCompression, nebulaSettings?.nebulaBlackHoleSpinSpeed, nebulaSettings?.nebulaBlackHoleTargetRadius, nebulaSettings?.nebulaBlackHolePull]);

  // ==================== 憭𡁏�鈭穃�靘𧢲葡�橒�鈭㘾�𡁏芋撘𧶏� ====================
  useEffect(() => {
    // 如果不是互通模式或没有数据，清理已有的星云实例
    if (!sceneRef.current || !sceneReady || !overlayMode || !nebulaInstancesData || !nebulaSettings?.nebulaInstances) {
      if (sceneRef.current) {
        const scene = sceneRef.current;
        const currentPoints = nebulaInstancePointsRef.current;
        const currentMaterials = nebulaInstanceMaterialsRef.current;

        // 清理所有星云实例
        currentPoints.forEach((points, id) => {
          scene.remove(points);
          points.geometry.dispose();
        });
        currentPoints.clear();

        currentMaterials.forEach((mat) => {
          mat.dispose();
        });
        currentMaterials.clear();
      }
      return;
    }

    const scene = sceneRef.current;
    const currentPoints = nebulaInstancePointsRef.current;
    const currentMaterials = nebulaInstanceMaterialsRef.current;
    const enabledInstances = nebulaSettings.nebulaInstances.filter(n => n.enabled);
    const enabledIds = new Set(enabledInstances.map(n => n.id));

    // 皜��撌脣��斗�蝳�鍂���靘?
    currentPoints.forEach((points, id) => {
      if (!enabledIds.has(id)) {
        scene.remove(points);
        points.geometry.dispose();
        currentPoints.delete(id);
        const mat = currentMaterials.get(id);
        if (mat) {
          mat.dispose();
          currentMaterials.delete(id);
        }
      }
    });

    // 銝箸�銝芸鍳�函�摰硺��𥕦遣/�湔鰵蝎鍦�蝟餌�
    enabledInstances.forEach(instance => {
      const instanceData = nebulaInstancesData.get(instance.id);
      if (!instanceData) return;

      // 如果实例已存在，检查粒子数据是否变化
      if (currentPoints.has(instance.id)) {
        const existingPoints = currentPoints.get(instance.id)!;
        const existingGeometry = existingPoints.geometry as THREE.BufferGeometry;
        const existingPositions = existingGeometry.getAttribute('position');
        const existingCount = existingPositions?.count || 0;

        // 计算预期的总粒子数（考虑拼接）
        const tileX = instance.mappingTileX || 1;
        const tileY = instance.mappingTileY || 1;
        const expectedCount = instanceData.count * tileX * tileY;

        // 检查粒子数据是否变化：数量变化（包括拼接变化）或位置数据变化
        let dataChanged = existingCount !== expectedCount;
        if (!dataChanged && existingPositions && instanceData.positions.length > 0) {
          // 比较前几个位置值来检测数据是否变化
          const posArray = existingPositions.array as Float32Array;
          dataChanged = posArray[0] !== instanceData.positions[0] ||
            posArray[1] !== instanceData.positions[1] ||
            posArray[2] !== instanceData.positions[2];
        }

        // 如果粒子数据变化，需要重建geometry
        if (dataChanged) {
          // 删除旧的实例
          scene.remove(existingPoints);
          existingGeometry.dispose();
          currentPoints.delete(instance.id);
          const oldMat = currentMaterials.get(instance.id);
          if (oldMat) {
            oldMat.dispose();
            currentMaterials.delete(instance.id);
          }
          // 不return，继续执行下面的创建逻辑
        } else {
          // 粒子数量没变，只更新位置、缩放和uniform参数
          existingPoints.position.set(instance.position.x, instance.position.y, instance.position.z);
          existingPoints.scale.setScalar(instance.scale);

          // 更新材质的uniform参数
          const material = currentMaterials.get(instance.id);
          if (material) {
            // 计算形状值
            const shapeMap: Record<ParticleShape, number> = {
              [ParticleShape.Circle]: 0, [ParticleShape.Star]: 1, [ParticleShape.Snowflake]: 2,
              [ParticleShape.Heart]: 3, [ParticleShape.Crescent]: 4, [ParticleShape.CrossGlow]: 5,
              [ParticleShape.Sakura]: 6, [ParticleShape.Sun]: 7, [ParticleShape.Sun2]: 8,
              [ParticleShape.Plum]: 9, [ParticleShape.Lily]: 10, [ParticleShape.Lotus]: 11,
              [ParticleShape.Prism]: 12
            };
            const shapeVal = shapeMap[nebulaSettings.particleShape] ?? 0;

            // 计算光晕模式值
            const glowModeMap: Record<GlowMode, number> = {
              [GlowMode.None]: 0, [GlowMode.Soft]: 1, [GlowMode.Sharp]: 2, [GlowMode.Aura]: 3
            };
            const glowModeVal = glowModeMap[nebulaSettings.glowMode] ?? 1;

            const inst = instance as Partial<NebulaInstance>;

            material.uniforms.uSize.value = instance.baseSize * 4.0;
            material.uniforms.uSaturation.value = inst.colorSaturation ?? nebulaSettings.colorSaturation;
            material.uniforms.uTurbulence.value = inst.particleTurbulence ?? nebulaSettings.particleTurbulence;
            material.uniforms.uTurbulenceSpeed.value = inst.turbulenceSpeed ?? nebulaSettings.turbulenceSpeed;
            material.uniforms.uTurbulenceScale.value = inst.turbulenceScale ?? nebulaSettings.turbulenceScale;
            material.uniforms.uBreathing.value = (inst.breathingEnabled ?? nebulaSettings.breathingEnabled)
              ? (inst.breathingIntensity ?? nebulaSettings.breathingIntensity)
              : 0.0;
            material.uniforms.uBreathingSpeed.value = inst.breathingSpeed ?? nebulaSettings.breathingSpeed;
            material.uniforms.uRipple.value = (inst.rippleEnabled ?? nebulaSettings.rippleEnabled)
              ? (inst.rippleIntensity ?? nebulaSettings.rippleIntensity)
              : 0.0;
            material.uniforms.uRippleSpeed.value = inst.rippleSpeed ?? nebulaSettings.rippleSpeed;
            material.uniforms.uAccretion.value = (inst.accretionEnabled ?? nebulaSettings.accretionEnabled)
              ? (inst.accretionIntensity ?? nebulaSettings.accretionIntensity)
              : 0.0;
            material.uniforms.uAccretionSpeed.value = inst.accretionSpeed ?? nebulaSettings.accretionSpeed;
            {
              const accLayers = inst.accretionLayers ?? nebulaSettings.accretionLayers;
              const acc0 = accLayers?.[0];
              const acc1 = accLayers?.[1];
              const acc2 = accLayers?.[2];
              const accCount = (accLayers || []).filter(l => l.enabled).length;

              material.uniforms.uAccretionRadii.value.set(acc0?.radiusMax ?? 100, acc1?.radiusMax ?? 200, acc2?.radiusMax ?? 400);
              material.uniforms.uAccretionDirs.value.set(
                acc0?.enabled ? (acc0?.direction ?? 1) : 1,
                acc1?.enabled ? (acc1?.direction ?? -1) : -1,
                acc2?.enabled ? (acc2?.direction ?? 1) : 1
              );
              material.uniforms.uAccretionSpeeds.value.set(
                acc0?.enabled ? (acc0?.speedMultiplier ?? 2) : 2,
                acc1?.enabled ? (acc1?.speedMultiplier ?? 1) : 1,
                acc2?.enabled ? (acc2?.speedMultiplier ?? 0.5) : 0.5
              );
              material.uniforms.uAccretionLayerCount.value = accCount;
            }
            material.uniforms.uFlickerEnabled.value = (inst.flickerEnabled ?? nebulaSettings.flickerEnabled) ? 1 : 0;
            material.uniforms.uFlickerIntensity.value = inst.flickerIntensity ?? nebulaSettings.flickerIntensity;
            material.uniforms.uFlickerSpeed.value = inst.flickerSpeed ?? nebulaSettings.flickerSpeed;
            material.uniforms.uBrightness.value = (inst.brightness ?? (nebulaSettings.brightness ?? 1.0)) * (nebulaSettings.overlayBrightness ?? 0.5);
            material.uniforms.uOpacity.value = inst.opacity ?? (nebulaSettings.opacity ?? 1.0);
            material.uniforms.uOverlayMode.value = nebulaSettings.overlayColorCompensation ?? 1.0;

            // 实例级效果（严格 1B：效果绑定到实例；实例缺省则 fallback 到全局）
            material.uniforms.uWaveEnabled.value = ((instance as any).waveEnabled ?? nebulaSettings.waveEnabled) ? 1.0 : 0.0;
            material.uniforms.uWaveIntensity.value = (instance as any).waveIntensity ?? nebulaSettings.waveIntensity ?? 0;
            material.uniforms.uWaveSpeed.value = (instance as any).waveSpeed ?? nebulaSettings.waveSpeed ?? 1;
            material.uniforms.uWaveSteepness.value = (instance as any).waveSteepness ?? nebulaSettings.waveSteepness ?? 0.5;
            material.uniforms.uWaveLayers.value = (instance as any).waveLayers ?? nebulaSettings.waveLayers ?? 2;
            material.uniforms.uWaveDirection.value = (((instance as any).waveDirection ?? nebulaSettings.waveDirection ?? 0) * Math.PI) / 180;
            material.uniforms.uWaveDepthFade.value = (instance as any).waveDepthFade ?? nebulaSettings.waveDepthFade ?? 0.5;
            material.uniforms.uWaveFoam.value = ((instance as any).waveFoam ?? nebulaSettings.waveFoam) ? 1.0 : 0.0;

            material.uniforms.uWanderingLightning.value = ((instance as any).wanderingLightningEnabled ?? nebulaSettings.wanderingLightningEnabled)
              ? ((instance as any).wanderingLightningIntensity ?? nebulaSettings.wanderingLightningIntensity)
              : 0;
            material.uniforms.uWanderingLightningSpeed.value = (instance as any).wanderingLightningSpeed ?? nebulaSettings.wanderingLightningSpeed ?? 1;
            material.uniforms.uWanderingLightningDensity.value = (instance as any).wanderingLightningDensity ?? nebulaSettings.wanderingLightningDensity ?? 3;
            material.uniforms.uWanderingLightningWidth.value = (instance as any).wanderingLightningWidth ?? nebulaSettings.wanderingLightningWidth ?? 0.02;

            material.uniforms.uLightningBreakdown.value = ((instance as any).lightningBreakdownEnabled ?? nebulaSettings.lightningBreakdownEnabled)
              ? ((instance as any).lightningBreakdownIntensity ?? nebulaSettings.lightningBreakdownIntensity)
              : 0;
            material.uniforms.uLightningBreakdownFreq.value = (instance as any).lightningBreakdownFrequency ?? nebulaSettings.lightningBreakdownFrequency ?? 0.5;
            material.uniforms.uLightningBranches.value = (instance as any).lightningBreakdownBranches ?? nebulaSettings.lightningBreakdownBranches ?? 2;

            // 爆炸/黑洞参数也需要同步（否则运行中调整会要求重建）
            material.uniforms.uExplosionExpansion.value = nebulaSettings.nebulaExplosionExpansion ?? 300;
            material.uniforms.uExplosionTurbulence.value = nebulaSettings.nebulaExplosionTurbulence ?? 80;
            material.uniforms.uExplosionRotation.value = nebulaSettings.nebulaExplosionRotation ?? 0.4;
            material.uniforms.uExplosionSizeBoost.value = nebulaSettings.nebulaExplosionSizeBoost ?? 8;
            material.uniforms.uBlackHoleCompression.value = nebulaSettings.nebulaBlackHoleCompression ?? 0.05;
            material.uniforms.uBlackHoleSpinSpeed.value = nebulaSettings.nebulaBlackHoleSpinSpeed ?? 400;
            material.uniforms.uBlackHoleTargetRadius.value = nebulaSettings.nebulaBlackHoleTargetRadius ?? 30;
            material.uniforms.uBlackHolePull.value = nebulaSettings.nebulaBlackHolePull ?? 0.95;
            // 更新混合模式
            material.blending = (nebulaSettings.overlayBlendMode ?? NebulaBlendMode.Additive) === NebulaBlendMode.Additive
              ? THREE.AdditiveBlending
              : THREE.NormalBlending;
            material.depthTest = false;
            material.depthWrite = false;
            // 形状和光晕参数
            material.uniforms.uShape.value = shapeVal;
            material.uniforms.uShapeTexture.value = getShapeTexture();
            material.uniforms.uGlowMode.value = glowModeVal;
            // 几何映射参数
            material.uniforms.uGeometryMapping.value = instance.geometryMapping === 'sphere' ? 1 : instance.geometryMapping === 'cylinder' ? 2 : 0;
            material.uniforms.uMappingStrength.value = instance.mappingStrength || 0;
            material.uniforms.uMappingRadius.value = instance.mappingRadius || 200;
            material.uniforms.uMappingTileX.value = instance.mappingTileX || 1;
            material.uniforms.uMappingTileY.value = instance.mappingTileY || 1;
            material.uniforms.uMappingEdgeFade.value = instance.mappingEdgeFade ?? 0.1;
            // 全局参数
            material.uniforms.uInteractionRadius.value = nebulaSettings.interactionRadius;
            material.uniforms.uInteractionStrength.value = nebulaSettings.interactionStrength;
            material.uniforms.uReturnSpeed.value = nebulaSettings.returnSpeed;
            material.uniforms.uGlowIntensity.value = nebulaSettings.glowIntensity;
            // 标记材质需要更新
            material.needsUpdate = true;
          }
          return;
        }
      }

      // 创建新的粒子系统（新实例或粒子数据变化后重建）
      // 几何映射拼接：根据 tileX 和 tileY 复制粒子
      const tileX = instance.mappingTileX || 1;
      const tileY = instance.mappingTileY || 1;
      const accLayers = instance.accretionLayers ?? nebulaSettings.accretionLayers;
      const acc0 = accLayers?.[0];
      const acc1 = accLayers?.[1];
      const acc2 = accLayers?.[2];
      const accCount = (accLayers || []).filter(l => l.enabled).length;
      const tileCount = tileX * tileY;
      const baseCount = instanceData.count;
      const totalCount = baseCount * tileCount;

      // 创建扩展后的数组
      const positions = new Float32Array(totalCount * 3);
      const colors = new Float32Array(totalCount * 3);
      const sizes = new Float32Array(totalCount);
      const particleIds = new Float32Array(totalCount);
      const tileIndices = new Float32Array(totalCount * 2);

      // 为每个拼接区域复制粒子数据
      for (let ty = 0; ty < tileY; ty++) {
        for (let tx = 0; tx < tileX; tx++) {
          const tileIdx = ty * tileX + tx;
          const offset = tileIdx * baseCount;

          for (let i = 0; i < baseCount; i++) {
            const srcIdx = i;
            const dstIdx = offset + i;

            // 复制位置
            positions[dstIdx * 3] = instanceData.positions[srcIdx * 3];
            positions[dstIdx * 3 + 1] = instanceData.positions[srcIdx * 3 + 1];
            positions[dstIdx * 3 + 2] = instanceData.positions[srcIdx * 3 + 2];

            // 复制颜色
            colors[dstIdx * 3] = instanceData.colors[srcIdx * 3];
            colors[dstIdx * 3 + 1] = instanceData.colors[srcIdx * 3 + 1];
            colors[dstIdx * 3 + 2] = instanceData.colors[srcIdx * 3 + 2];

            // 复制大小
            sizes[dstIdx] = instanceData.sizes[srcIdx];

            // 设置粒子ID
            particleIds[dstIdx] = srcIdx;

            // 设置拼接索引
            tileIndices[dstIdx * 2] = tx;
            tileIndices[dstIdx * 2 + 1] = ty;
          }
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('aParticleId', new THREE.BufferAttribute(particleIds, 1));
      geometry.setAttribute('aTileIndex', new THREE.BufferAttribute(tileIndices, 2));
      geometry.center();

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: instance.baseSize * 4.0 },
          uHandPos: { value: new THREE.Vector3() },
          uHandActive: { value: 0.0 },
          uInteractionRadius: { value: nebulaSettings.interactionRadius },
          uInteractionStrength: { value: nebulaSettings.interactionStrength },
          uReturnSpeed: { value: nebulaSettings.returnSpeed },
          uExplosion: { value: 0.0 },
          uBlackHole: { value: 0.0 },
          uExplosionExpansion: { value: nebulaSettings.nebulaExplosionExpansion ?? 300 },
          uExplosionTurbulence: { value: nebulaSettings.nebulaExplosionTurbulence ?? 80 },
          uExplosionRotation: { value: nebulaSettings.nebulaExplosionRotation ?? 0.4 },
          uExplosionSizeBoost: { value: nebulaSettings.nebulaExplosionSizeBoost ?? 8 },
          uBlackHoleCompression: { value: nebulaSettings.nebulaBlackHoleCompression ?? 0.05 },
          uBlackHoleSpinSpeed: { value: nebulaSettings.nebulaBlackHoleSpinSpeed ?? 400 },
          uBlackHoleTargetRadius: { value: nebulaSettings.nebulaBlackHoleTargetRadius ?? 30 },
          uBlackHolePull: { value: nebulaSettings.nebulaBlackHolePull ?? 0.95 },
          uColor: { value: new THREE.Color(0xffffff) },
          uShape: { value: ({ [ParticleShape.Circle]: 0, [ParticleShape.Star]: 1, [ParticleShape.Snowflake]: 2, [ParticleShape.Heart]: 3, [ParticleShape.Crescent]: 4, [ParticleShape.CrossGlow]: 5, [ParticleShape.Sakura]: 6, [ParticleShape.Sun]: 7, [ParticleShape.Sun2]: 8, [ParticleShape.Plum]: 9, [ParticleShape.Lily]: 10, [ParticleShape.Lotus]: 11, [ParticleShape.Prism]: 12 } as Record<ParticleShape, number>)[nebulaSettings.particleShape] ?? 0 },
          uShapeTexture: { value: getShapeTexture() },
          uWanderingLightning: { value: ((instance as any).wanderingLightningEnabled ?? nebulaSettings.wanderingLightningEnabled) ? ((instance as any).wanderingLightningIntensity ?? nebulaSettings.wanderingLightningIntensity) : 0 },
          uWanderingLightningSpeed: { value: (instance as any).wanderingLightningSpeed ?? nebulaSettings.wanderingLightningSpeed ?? 1 },
          uWanderingLightningDensity: { value: (instance as any).wanderingLightningDensity ?? nebulaSettings.wanderingLightningDensity ?? 3 },
          uWanderingLightningWidth: { value: (instance as any).wanderingLightningWidth ?? nebulaSettings.wanderingLightningWidth ?? 0.02 },
          uLightningBreakdown: { value: ((instance as any).lightningBreakdownEnabled ?? nebulaSettings.lightningBreakdownEnabled) ? ((instance as any).lightningBreakdownIntensity ?? nebulaSettings.lightningBreakdownIntensity) : 0 },
          uLightningBreakdownFreq: { value: (instance as any).lightningBreakdownFrequency ?? nebulaSettings.lightningBreakdownFrequency ?? 0.5 },
          uLightningBranches: { value: (instance as any).lightningBreakdownBranches ?? nebulaSettings.lightningBreakdownBranches ?? 2 },
          uSaturation: { value: instance.colorSaturation ?? 1.2 },
          uTurbulence: { value: instance.particleTurbulence },
          uTurbulenceSpeed: { value: instance.turbulenceSpeed },
          uTurbulenceScale: { value: instance.turbulenceScale },
          uGlowMode: { value: ({ [GlowMode.None]: 0, [GlowMode.Soft]: 1, [GlowMode.Sharp]: 2, [GlowMode.Aura]: 3 } as Record<GlowMode, number>)[nebulaSettings.glowMode] ?? 1 },
          uGlowIntensity: { value: nebulaSettings.glowIntensity },
          uBreathing: { value: instance.breathingEnabled ? instance.breathingIntensity : 0.0 },
          uBreathingSpeed: { value: instance.breathingSpeed },
          uRipple: { value: instance.rippleEnabled ? instance.rippleIntensity : 0.0 },
          uRippleSpeed: { value: instance.rippleSpeed },
          uAccretion: { value: instance.accretionEnabled ? instance.accretionIntensity : 0.0 },
          uAccretionSpeed: { value: instance.accretionSpeed },
          uAccretionRadii: { value: new THREE.Vector3(acc0?.radiusMax ?? 100, acc1?.radiusMax ?? 200, acc2?.radiusMax ?? 400) },
          uAccretionDirs: { value: new THREE.Vector3(acc0?.enabled ? (acc0?.direction ?? 1) : 1, acc1?.enabled ? (acc1?.direction ?? -1) : -1, acc2?.enabled ? (acc2?.direction ?? 1) : 1) },
          uAccretionSpeeds: { value: new THREE.Vector3(acc0?.enabled ? (acc0?.speedMultiplier ?? 2) : 2, acc1?.enabled ? (acc1?.speedMultiplier ?? 1) : 1, acc2?.enabled ? (acc2?.speedMultiplier ?? 0.5) : 0.5) },
          uAccretionLayerCount: { value: accCount },
          uWaveEnabled: { value: ((instance as any).waveEnabled ?? nebulaSettings.waveEnabled) ? 1.0 : 0.0 },
          uWaveIntensity: { value: (instance as any).waveIntensity ?? nebulaSettings.waveIntensity ?? 0 },
          uWaveSpeed: { value: (instance as any).waveSpeed ?? nebulaSettings.waveSpeed ?? 1 },
          uWaveSteepness: { value: (instance as any).waveSteepness ?? nebulaSettings.waveSteepness ?? 0.5 },
          uWaveLayers: { value: (instance as any).waveLayers ?? nebulaSettings.waveLayers ?? 2 },
          uWaveDirection: { value: (((instance as any).waveDirection ?? nebulaSettings.waveDirection ?? 0) * Math.PI) / 180 },
          uWaveDepthFade: { value: (instance as any).waveDepthFade ?? nebulaSettings.waveDepthFade ?? 0.5 },
          uWaveFoam: { value: ((instance as any).waveFoam ?? nebulaSettings.waveFoam) ? 1.0 : 0.0 },
          uGeometryMapping: { value: instance.geometryMapping === 'sphere' ? 1 : instance.geometryMapping === 'cylinder' ? 2 : 0 },
          uMappingStrength: { value: instance.mappingStrength || 0 },
          uMappingRadius: { value: instance.mappingRadius || 200 },
          uImageSize: { value: new THREE.Vector2(instanceData.canvasWidth || 800, instanceData.canvasHeight || 600) },
          uMappingTileX: { value: instance.mappingTileX || 1 },
          uMappingTileY: { value: instance.mappingTileY || 1 },
          uMappingEdgeFade: { value: instance.mappingEdgeFade ?? 0.1 },
          uFlickerEnabled: { value: instance.flickerEnabled ? 1 : 0 },
          uFlickerIntensity: { value: instance.flickerIntensity },
          uFlickerSpeed: { value: instance.flickerSpeed },
          uBrightness: { value: instance.brightness * (nebulaSettings.overlayBrightness ?? 0.5) },
          uOpacity: { value: instance.opacity },
          uOverlayMode: { value: nebulaSettings.overlayColorCompensation ?? 1.0 }, // 互通模式颜色补偿
        },
        vertexShader: nebulaCanvasVertexShader,
        fragmentShader: nebulaCanvasFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: (nebulaSettings.overlayBlendMode ?? NebulaBlendMode.Additive) === NebulaBlendMode.Additive
          ? THREE.AdditiveBlending
          : THREE.NormalBlending
      });

      const points = new THREE.Points(geometry, material);
      points.position.set(instance.position.x, instance.position.y, instance.position.z);
      points.scale.setScalar(instance.scale);
      points.renderOrder = 100; // 在星球之后渲染，确保混合模式正确工作

      scene.add(points);
      currentPoints.set(instance.id, points);
      currentMaterials.set(instance.id, material);
    });

  }, [nebulaInstancesData, nebulaSettings?.nebulaInstances, nebulaSettings?.particleShape, nebulaSettings?.glowMode, nebulaSettings?.glowIntensity, nebulaSettings?.overlayBlendMode, nebulaSettings?.overlayBrightness, nebulaSettings?.overlayColorCompensation, overlayMode, sceneReady]);

  // �𥕦遣�毺�����厩��?
  function createPlanetMeshes(planet: PlanetSettings, sceneSettings: PlanetSceneSettings) {
    // 璉�瘚讠宏�刻挽憭?
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // �瑕��箇��𠰴�嚗�覔�格瓲敹�掩�页�- 銝箸唂�唳旿�𣂷�暺䁅恕�潔��?
    const coreSystem = planet.coreSystem;
    const cores = coreSystem?.cores || [];
    const solidCores = coreSystem?.solidCores || (coreSystem?.solidCore ? [coreSystem.solidCore] : []);
    let baseRadius: number;
    let coreObject: THREE.Group;

    // �𥕦遣�餅瓲敹��嚗���怎�摮鞉瓲敹��摰硺��詨�嚗?
    const allCoreGroup = new THREE.Group();
    allCoreGroup.name = 'allCores';

    // === 摰硺��詨�嚗��摰硺�嚗?==
    const solidCoresEnabled = coreSystem?.solidCoresEnabled !== false;
    if (solidCores.length > 0) {
      const solidCoreGroup = new THREE.Group();
      solidCoreGroup.name = 'solidCores';

      solidCores.forEach(sc => {
        const visible = solidCoresEnabled && sc.enabled;
        const mesh = createSolidCoreMesh(sc, isMobile);
        mesh.name = `solidCore_${sc.id}`;
        mesh.userData = { solidCoreId: sc.id };
        mesh.visible = visible;
        solidCoreGroup.add(mesh);
      });

      allCoreGroup.add(solidCoreGroup);
    }

    // 霈∠��箇��𠰴�嚗�����蝚砌�銝芸鍳�函�蝎鍦��詨�嚗?
    const firstEnabledCore = cores.find(c => c.enabled);
    const firstEnabledSolidCore = solidCores.find(c => c.enabled);
    baseRadius = firstEnabledCore?.baseRadius || firstEnabledSolidCore?.radius || cores[0]?.baseRadius || 100;

    // === 蝎鍦��詨�嚗�𣈲����詨��惩� + Solo璅∪�嚗?==
    {
      const coreGroup = new THREE.Group();
      const coresEnabled = coreSystem?.coresEnabled !== false;

      // �𥕦遣���㗇瓲敹�� mesh嚗��朞� visible �批��曄內嚗?
      cores.forEach(coreConfig => {
        const coreGeometry = createCoreGeometry(coreConfig);

        // 霈∠��嘥��航��?
        let initialVisible = false;
        if (coresEnabled) {
          if (sceneSettings.soloCoreId) {
            initialVisible = coreConfig.id === sceneSettings.soloCoreId;
          } else {
            initialVisible = coreConfig.enabled;
          }
        }

        // �𥕦遣�詨�蝏����鉄銝餃��峕�撠曉�嚗?
        const singleCoreGroup = new THREE.Group();
        singleCoreGroup.name = `core_${coreConfig.id}`;
        singleCoreGroup.userData = { coreId: coreConfig.id };

        // �硋偏撅�㺭�𧶏��寞旿 trailLength 霈∠�嚗?=�䭾�撠橘�
        const trailLength = coreConfig.trailLength || 0;
        // 憓𧼮�撅�㺭撖�漲嚗魩railLength * 30嚗峕�憭?0撅���𣂷��渲�蝏剔��硋偏���
        const trailLayers = trailLength > 0 ? Math.min(Math.floor(trailLength * 30) + 1, 50) : 0;

        // �𥕦遣�硋偏撅����葡�橒��其蜓撅���ｇ�
        if (trailLayers > 0 && Math.abs(coreConfig.rotationSpeed) > 0.01) {
          const rotAxis = getRotationAxis(coreConfig.rotationAxis);
          const rotAxisVec = new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z).normalize();

          for (let i = trailLayers; i >= 1; i--) {
            // �𤩺�摨佗�隞𤾸��啣��鍦�
            const alpha = (1 - i / (trailLayers + 1)) * 0.6;
            // �贝蓮�讐宏嚗𡁜�撠讛�摨阡𡢿�䈑�0.008撘批漲�?.46摨佗�嚗峕�靘𥟇凒蝏��餈䂿賒���撠?
            const angleOffset = -i * 0.008 * Math.sign(coreConfig.rotationSpeed);

            const trailMaterial = createCoreMaterial(coreConfig, sceneSettings, alpha);
            const trailPoints = new THREE.Points(coreGeometry.clone(), trailMaterial);

            // 憸��摨𠉛鍂�贝蓮�讐宏
            const rotMatrix = new THREE.Matrix4().makeRotationAxis(rotAxisVec, angleOffset);
            trailPoints.applyMatrix4(rotMatrix);
            trailPoints.userData = { isTrail: true, trailIndex: i };

            singleCoreGroup.add(trailPoints);
          }
        }

        // 銝餃�嚗���擧葡�橒��冽�銝𢠃𢒰嚗?
        const coreMaterial = createCoreMaterial(coreConfig, sceneSettings, 1.0);
        const corePoints = new THREE.Points(coreGeometry, coreMaterial);
        corePoints.userData = { isMain: true };
        singleCoreGroup.add(corePoints);

        // 霈曄蔭�嘥��航��?
        singleCoreGroup.visible = initialVisible;

        coreGroup.add(singleCoreGroup);
      });

      coreGroup.name = 'particleCores';
      allCoreGroup.add(coreGroup);
    }

    coreObject = allCoreGroup;

    // === �怎�蝟餌� ===
    const flamesGroup = new THREE.Group();
    flamesGroup.name = 'flames';

    // 銵券𢒰�怎� - 憪讠��𥕦遣蝏�誑靘踵凒�圈�餉��賣迤撣詨極雿?
    const surfaceFlames = planet.flameSystem?.surfaceFlames || [];
    const flamesEnabled = planet.flameSystem?.enabled !== false;
    const surfaceFlamesGroup = new THREE.Group();
    surfaceFlamesGroup.name = 'surfaceFlames';

    surfaceFlames.forEach(flame => {
      const visible = flamesEnabled && flame.enabled;
      const mesh = createSurfaceFlameMesh(flame, isMobile);
      mesh.userData = { flameId: flame.id, flameType: 'surface' };
      mesh.visible = visible;
      surfaceFlamesGroup.add(mesh);
    });

    flamesGroup.add(surfaceFlamesGroup);

    // �瑕��急� - 憪讠��𥕦遣蝏?
    const flameJets = planet.flameSystem?.flameJets || [];
    const flameJetsGroup = new THREE.Group();
    flameJetsGroup.name = 'flameJets';

    flameJets.forEach(jet => {
      const visible = flamesEnabled && jet.enabled;
      const points = createFlameJetPoints(jet, isMobile);
      points.userData = { flameId: jet.id, flameType: 'jet' };
      points.visible = visible;
      flameJetsGroup.add(points);
    });

    flamesGroup.add(flameJetsGroup);

    // �箸��怎� - 憪讠��𥕦遣蝏?
    const spiralFlames = planet.flameSystem?.spiralFlames || [];
    const spiralFlamesGroup = new THREE.Group();
    spiralFlamesGroup.name = 'spiralFlames';

    spiralFlames.forEach(spiral => {
      const visible = flamesEnabled && spiral.enabled;
      const points = createSpiralFlamePoints(spiral, isMobile);
      points.userData = { flameId: spiral.id, flameType: 'spiral' };
      points.visible = visible;
      spiralFlamesGroup.add(points);
    });

    flamesGroup.add(spiralFlamesGroup);

    // === 畾见蔣蝟餌�嚗�鰵���===
    try {
      const afterimageSystem = planet.afterimageSystem || { enabled: false, zones: [], particles: { enabled: false, speed: 2, speedRandomness: 0.2, density: 100, size: 8, sizeDecay: 'linear' as const, lifespan: 2, fadeOutCurve: 'quadratic' as const, colorMode: 'gradient' as const, colors: ['#ff4400', '#ffff00'] }, texture: { enabled: false, pulseEnabled: false, pulseSpeed: 1, pulseWidth: 0.3, rippleEnabled: false, rippleCount: 3, rippleSpeed: 0.5, opacity: 0.5, color: '#ff6600' }, outsideClearSpeed: 3 };

      // �瑕�蝏穃��詨����敺?
      let boundCoreRadius = baseRadius;
      const bindId = afterimageSystem.bindToCoreId;
      if (bindId) {
        // �交𪄳蝎鍦��詨�
        const boundParticleCore = cores.find(c => c.id === bindId);
        if (boundParticleCore) {
          boundCoreRadius = boundParticleCore.baseRadius;
        } else {
          // �交𪄳摰硺��詨�
          const boundSolidCore = solidCores.find(c => c.id === bindId);
          if (boundSolidCore) {
            boundCoreRadius = boundSolidCore.radius;
          }
        }
      }

      const afterimageGroup = createAfterimageSystem(afterimageSystem, boundCoreRadius, isMobile);
      afterimageGroup.billboard.userData = { type: 'afterimage', bindToCoreId: bindId };
      flamesGroup.add(afterimageGroup.billboard);
    } catch (e) {
      console.error('畾见蔣蝟餌��𥕦遣憭梯揖:', e);
    }

    // === �厩㴓 ===
    const rings = new THREE.Group();

    // 蝎鍦��?- 隞�銁�典�撘��喳鍳�冽𧒄�曄內
    planet.rings.particleRings.forEach(ring => {
      if (!planet.rings.particleRingsEnabled || !ring.enabled) return;

      const ringGeom = createParticleRingGeometry(ring, baseRadius);

      // 蝎鍦��舐�嚗���思蜓撅���航����撠曉�嚗?
      const ringGroup = new THREE.Group();
      ringGroup.userData = { ringId: ring.id, type: 'particle', rotationSpeed: ring.rotationSpeed ?? 0.3 };

      // �硋偏撅��trailLength > 0 �嗅鍳�剁�
      const trailLayers = (ring.trailLength ?? 0) > 0 ? Math.ceil(ring.trailLength * 5) : 0;
      for (let i = trailLayers; i > 0; i--) {
        const trailAlpha = 1 - (i / (trailLayers + 1));
        const trailOffset = i * 0.02 * (ring.rotationSpeed ?? 0.3);

        const trailMat = new THREE.ShaderMaterial({
          vertexShader: planetVertexShader,
          fragmentShader: planetFragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uRotationSpeed: { value: 0 }, // �芾蓮�?JavaScript 銝剝�朞� rotateOnAxis 摰䂿緵
            uRotationAxis: { value: new THREE.Vector3(0, 1, 0) },
            uBreathing: { value: 0 },
            uBreathingSpeed: { value: 0.5 },
            uFlicker: { value: 0 },
            uFlickerSpeed: { value: 2 },
            uHandActive: { value: 0 },
            uTwoHandsActive: { value: 0 },
            // 頞�鰵�毺��穃��?
            uExplosion: { value: 0 },
            uExplosionExpansion: { value: 300 },
            uExplosionTurbulence: { value: 80 },
            uExplosionRotation: { value: 0.4 },
            uExplosionSizeBoost: { value: 8 },
            // 暺烐������㺭
            uBlackHole: { value: 0 },
            uBlackHoleCompression: { value: 0.05 },
            uBlackHoleSpinSpeed: { value: 400 },
            uBlackHoleTargetRadius: { value: 30 },
            uBlackHolePull: { value: 0.95 },
            uGlowIntensity: { value: 3 },
            uSaturation: { value: 1.2 },
            uTrailAlpha: { value: trailAlpha * 0.5 },
            uTrailOffset: { value: trailOffset },
            uWanderingLightning: { value: 0 },
            uWanderingLightningSpeed: { value: 0 },
            uWanderingLightningDensity: { value: 0 },
            uLightningBreakdown: { value: 0 },
            uLightningBreakdownFreq: { value: 0 },
            uLightningBranches: { value: 0 },
            uTrail: { value: Array(50).fill(null).map(() => new THREE.Vector3()) },
            uTrailLength: { value: 0 }
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });

        const trailPoints = new THREE.Points(ringGeom.clone(), trailMat);
        trailPoints.userData = { isTrail: true, trailIndex: i };
        ringGroup.add(trailPoints);
      }

      // 銝餃�
      const ringMat = new THREE.ShaderMaterial({
        vertexShader: planetVertexShader,
        fragmentShader: planetFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uRotationSpeed: { value: 0 }, // �芾蓮�?JavaScript 銝剝�朞� rotateOnAxis 摰䂿緵
          uRotationAxis: { value: new THREE.Vector3(0, 1, 0) },
          uBreathing: { value: 0 },
          uBreathingSpeed: { value: 0.5 },
          uFlicker: { value: 0 },
          uFlickerSpeed: { value: 2 },
          uHandActive: { value: 0 },
          uTwoHandsActive: { value: 0 },
          // 頞�鰵�毺��穃��?
          uExplosion: { value: 0 },
          uExplosionExpansion: { value: 300 },
          uExplosionTurbulence: { value: 80 },
          uExplosionRotation: { value: 0.4 },
          uExplosionSizeBoost: { value: 8 },
          // 暺烐������㺭
          uBlackHole: { value: 0 },
          uBlackHoleCompression: { value: 0.05 },
          uBlackHoleSpinSpeed: { value: 400 },
          uBlackHoleTargetRadius: { value: 30 },
          uBlackHolePull: { value: 0.95 },
          uGlowIntensity: { value: 3 },
          uSaturation: { value: 1.2 },
          uTrailAlpha: { value: 1.0 },
          uWanderingLightning: { value: 0 },
          uWanderingLightningSpeed: { value: 0 },
          uWanderingLightningDensity: { value: 0 },
          uLightningBreakdown: { value: 0 },
          uLightningBreakdownFreq: { value: 0 },
          uLightningBranches: { value: 0 },
          uTrail: { value: Array(50).fill(null).map(() => new THREE.Vector3()) },
          uTrailLength: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const ringPoints = new THREE.Points(ringGeom, ringMat);
      ringPoints.renderOrder = 20;  // �典�雿𤘪瓲敹���擧葡�?
      ringGroup.add(ringPoints);

      // 摨𠉛鍂�暹� - 雿輻鍂�啁�TiltSettings
      const tiltAngles = getTiltAngles(ring.tilt);
      ringGroup.rotation.x = THREE.MathUtils.degToRad(tiltAngles.x);
      ringGroup.rotation.y = THREE.MathUtils.degToRad(tiltAngles.y);
      ringGroup.rotation.z = THREE.MathUtils.degToRad(tiltAngles.z);

      rings.add(ringGroup);
    });

    // 餈䂿賒�臬蒂 - 隞�銁�典�撘��喳鍳�冽𧒄�曄內
    planet.rings.continuousRings.forEach(ring => {
      if (!planet.rings.continuousRingsEnabled || !ring.enabled) return;

      // 雿輻鍂蝏嘥笆�𠰴�
      const innerR = ring.absoluteInnerRadius;
      const outerR = ring.absoluteOuterRadius;
      const avgRadius = (innerR + outerR) / 2;
      const eccentricity = ring.eccentricity || 0;

      // �𥕦遣璊剖��臬�雿蓥�嚗�𣈲��氖敹��嚗?
      const ringGeom = createEllipticalRingGeometry(innerR, outerR, eccentricity, 64);
      const [r, g, b] = hexToRgb(ring.color);

      // 憸𡏭𠧧璅∪�憭��
      const gc = ring.gradientColor;
      const colorMode = gc?.enabled ? (['none', 'twoColor', 'threeColor', 'procedural'].indexOf(gc.mode || 'twoColor')) : 0;
      // �閗𠧧璅∪��塚�雿輻鍂�箇��脩�鈭桀漲皜𣂼�
      const useGradient = gc?.enabled && gc?.mode !== 'none';
      let color1, color2, color3;
      if (useGradient && gc?.colors?.length >= 1) {
        color1 = hexToRgb(gc.colors[0] || ring.color);
        color2 = hexToRgb(gc.colors[1] || gc.colors[0] || ring.color);
        color3 = hexToRgb(gc.colors[2] || gc.colors[1] || gc.colors[0] || ring.color);
      } else {
        // �閗𠧧璅∪�嚗帋蝙�典抅蝖��脩�銝滚�鈭桀漲�睃�
        const baseColor = hexToRgb(ring.color);
        color1 = [baseColor[0] * 0.6, baseColor[1] * 0.6, baseColor[2] * 0.6]; // �烾�
        color2 = baseColor; // 銝剝𡢿
        color3 = [Math.min(1, baseColor[0] * 1.4), Math.min(1, baseColor[1] * 1.4), Math.min(1, baseColor[2] * 1.4)]; // 鈭桅�
      }

      // 皜𣂼��孵�
      const directionMap: Record<string, number> = { 'radial': 0, 'linearX': 1, 'linearY': 2, 'linearZ': 3, 'linearCustom': 4, 'spiral': 5 };
      const gradientDirection = directionMap[gc?.direction || 'radial'] || 0;
      const customDir = gc?.directionCustom || { x: 1, y: 0, z: 0 };

      // 瞍拇間霈曄蔭
      const vortex = ring.vortex;
      const vortexColors = (vortex?.colors || ['#ff6b6b', '#4ecdc4']).map(c => {
        const [vr, vg, vb] = hexToRgb(c);
        return new THREE.Vector3(vr, vg, vb);
      });
      // 憛怠��?銝芷��?
      while (vortexColors.length < 7) {
        vortexColors.push(vortexColors[vortexColors.length - 1] || new THREE.Vector3(1, 1, 1));
      }
      const radialDirMap: Record<string, number> = { 'static': 0, 'inward': 1, 'outward': 2 };

      const brightness = ring.brightness || 1.0;
      const ringMat = new THREE.ShaderMaterial({
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        uniforms: {
          uColor: { value: new THREE.Vector3(r * brightness, g * brightness, b * brightness) },
          uGradientColor1: { value: new THREE.Vector3(color1[0] * brightness, color1[1] * brightness, color1[2] * brightness) },
          uGradientColor2: { value: new THREE.Vector3(color2[0] * brightness, color2[1] * brightness, color2[2] * brightness) },
          uGradientColor3: { value: new THREE.Vector3(color3[0] * brightness, color3[1] * brightness, color3[2] * brightness) },
          uColorMode: { value: colorMode },
          uGradientDirection: { value: gradientDirection },
          uGradientCustomDir: { value: new THREE.Vector3(customDir.x, customDir.y, customDir.z) },
          uColorMidPosition: { value: gc?.colorMidPosition ?? 0.5 },
          uColorMidWidth: { value: gc?.colorMidWidth ?? 1 },
          uColorMidWidth2: { value: gc?.colorMidWidth2 ?? 0 },
          uBlendStrength: { value: gc?.blendStrength ?? 1.0 },
          uSpiralDensity: { value: gc?.spiralDensity ?? 2 },
          uSpiralAxis: { value: ['x', 'y', 'z'].indexOf(gc?.spiralAxis || 'y') },
          uProceduralIntensity: { value: gc?.proceduralIntensity ?? 1.0 },
          uProceduralAxis: { value: ['x', 'y', 'z', 'radial', 'custom'].indexOf(gc?.proceduralAxis || 'y') },
          uProceduralCustomAxis: { value: new THREE.Vector3(gc?.proceduralCustomAxis?.x ?? 0, gc?.proceduralCustomAxis?.y ?? 1, gc?.proceduralCustomAxis?.z ?? 0) },
          uOpacity: { value: ring.opacity },
          uOpacityGradient: { value: ['none', 'fadeIn', 'fadeOut', 'fadeBoth'].indexOf(ring.opacityGradient) },
          uOpacityGradientStrength: { value: ring.opacityGradientStrength ?? 0.5 },
          uTime: { value: 0 },
          uRingRadius: { value: avgRadius },
          // 瞍拇間��� uniforms
          uVortexEnabled: { value: vortex?.enabled ? 1 : 0 },
          uVortexArmCount: { value: vortex?.armCount ?? 4 },
          uVortexTwist: { value: vortex?.twist ?? 2 },
          uVortexRotationSpeed: { value: vortex?.rotationSpeed ?? 0.5 },
          uVortexRadialDir: { value: radialDirMap[vortex?.radialDirection || 'static'] ?? 0 },
          uVortexRadialSpeed: { value: vortex?.radialSpeed ?? 0.3 },
          uVortexHardness: { value: vortex?.hardness ?? 0.5 },
          uVortexColors: { value: vortexColors },
          uVortexColorCount: { value: vortex?.colors?.length ?? 2 },
          // �暸���� uniforms嚗�����𤩺��桃蔗嚗?
          uVisibilityEnabled: { value: ring.visibilityEffect?.enabled ? 1 : 0 },
          uVisibilityMinOpacity: { value: ring.visibilityEffect?.minOpacity ?? 0.2 },
          uVisibilityArmCount: { value: ring.visibilityEffect?.armCount ?? 4 },
          uVisibilityTwist: { value: ring.visibilityEffect?.twist ?? 5 },
          uVisibilityHardness: { value: ring.visibilityEffect?.hardness ?? 0.5 },
          uVisibilityRotSpeed: { value: ring.visibilityEffect?.rotationSpeed ?? 0.5 },
          uVisibilityRadialDir: { value: ring.visibilityEffect?.radialDirection === 'inward' ? 1 : ring.visibilityEffect?.radialDirection === 'outward' ? 2 : 0 },
          uVisibilityRadialSpeed: { value: ring.visibilityEffect?.radialSpeed ?? 0.3 },
          // �劐���� uniforms
          uStreakEnabled: { value: ring.streakMode?.enabled ? 1 : 0 },
          uStreakFlowSpeed: { value: ring.streakMode?.flowSpeed ?? 0.5 },
          uStreakStripeCount: { value: ring.streakMode?.stripeCount ?? 12 },
          uStreakRadialStretch: { value: ring.streakMode?.radialStretch ?? 8 },
          uStreakSharpness: { value: ring.streakMode?.edgeSharpness ?? 0.3 },
          uStreakDistortion: { value: ring.streakMode?.distortion ?? 0.5 },
          uStreakNoiseScale: { value: ring.streakMode?.noiseScale ?? 1.0 },
          uStreakDirection: { value: ring.streakMode?.flowDirection === 'ccw' ? -1.0 : 1.0 },
          uStreakBrightness: { value: ring.streakMode?.brightness ?? 1.5 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.userData = { ringId: ring.id, type: 'continuous', rotationSpeed: ring.rotationSpeed ?? 0.1 };
      ringMesh.renderOrder = 20;  // �典�雿𤘪瓲敹���擧葡�?

      // 摨𠉛鍂�暹� - 雿輻鍂�啁�TiltSettings
      const tiltAngles = getTiltAngles(ring.tilt);
      ringMesh.rotation.x = THREE.MathUtils.degToRad(tiltAngles.x + 90); // 雿輻㴓撣行偌撟?
      ringMesh.rotation.y = THREE.MathUtils.degToRad(tiltAngles.y);
      ringMesh.rotation.z = THREE.MathUtils.degToRad(tiltAngles.z);

      rings.add(ringMesh);
    });

    // === 颲𣂼�蝟餌� ===
    const radiation = new THREE.Group();
    const emitters: any[] = [];

    // 蝎鍦��舐� - 隞�銁蝟餌�蝥批�摮鞉芋�堒��喲��舐鍂�嗅��?
    // �瑕�蝚砌�銝芸鍳�函�蝎鍦��詨��滨蔭�其��舐�蝎鍦��鞱捶
    const orbitingCoreRef = firstEnabledCore || cores[0];
    const radiationSystemEnabled = planet.radiation.enabled !== false;

    if (radiationSystemEnabled && planet.radiation.orbitingEnabled && orbitingCoreRef) {
      planet.radiation.orbitings.forEach(orbiting => {
        if (!orbiting.enabled) return;
        const orbitingGeom = createOrbitingParticlesGeometry(orbiting, baseRadius);
        const orbitingMat = createCoreMaterial(orbitingCoreRef, sceneSettings);
        const orbitingPoints = new THREE.Points(orbitingGeom, orbitingMat);
        orbitingPoints.renderOrder = 8;  // �刻��Ｘ楛摨虫��𠬍�甇�𢒰�詨�銋见�
        // 摮睃� userData �其��函𤫇敺芰㴓
        orbitingPoints.userData = {
          type: 'orbiting',
          orbitingId: orbiting.id,
          baseSpeed: orbiting.baseSpeed || 0.5,
          mainDirection: orbiting.mainDirection || { x: 0, y: 1, z: 0 }
        };
        radiation.add(orbitingPoints);
      });
    }

    // 蝎鍦��瑕� - 隞�銁蝟餌�蝥批�摮鞉芋�堒��喲��舐鍂�嗅��?
    if (radiationSystemEnabled && planet.radiation.emitterEnabled) {
      planet.radiation.emitters.forEach(emitterSettings => {
        if (!emitterSettings.enabled) return;
        const emitterData = createParticleEmitter(baseRadius);
        emitterData.mesh.renderOrder = 8;  // �刻��Ｘ楛摨虫��𠬍�甇�𢒰�詨�銋见�
        // 摮睃� emitter ID �其��函𤫇敺芰㴓銝剖龪�?
        emitterData.mesh.userData = { emitterId: emitterSettings.id };
        radiation.add(emitterData.mesh);
        emitters.push(emitterData);
      });
    }

    // === 瘚�𨫡 ===
    const fireflies = new THREE.Group();
    const fireflyDataList: FireflyRuntimeData[] = [];
    const fireflySystemEnabled = planet.fireflies.enabled !== false;

    // �贝蓮瘚�𨫡 - 隞�銁蝟餌�蝥批�摮鞉芋�堒��喲��舐鍂�嗅��?
    if (fireflySystemEnabled && planet.fireflies.orbitingEnabled) {
      planet.fireflies.orbitingFireflies.forEach(firefly => {
        if (!firefly.enabled) return;
        const fireflyData = createOrbitingFirefly(firefly, baseRadius);
        fireflies.add(fireflyData.group);
        fireflyDataList.push(fireflyData);
      });
    }

    // 皜貉粥瘚�𨫡 - 隞�銁蝟餌�蝥批�摮鞉芋�堒��喲��舐鍂�嗅��?
    if (fireflySystemEnabled && planet.fireflies.wanderingEnabled) {
      planet.fireflies.wanderingGroups.forEach(groupSettings => {
        if (!groupSettings.enabled) return;
        const wanderingFireflies = createWanderingFireflyGroup(groupSettings, baseRadius);
        wanderingFireflies.forEach(fireflyData => {
          fireflies.add(fireflyData.group);
          fireflyDataList.push(fireflyData);
        });
      });
    }

    // === 瘜閖猐 ===
    const magicCircles = new THREE.Group();
    const magicCircleDataList: MagicCircleRuntimeData[] = [];

    // 隞�銁�典�撘��喳鍳�冽𧒄憭��
    if (planet.magicCircles?.enabled) {
      planet.magicCircles.circles.forEach(circleSettings => {
        if (!circleSettings.enabled) return;
        const circleData = createMagicCircle(circleSettings);
        magicCircles.add(circleData.mesh);
        magicCircleDataList.push(circleData);
      });
    }

    // === �賡�雿?===
    const energyBodies = new THREE.Group();
    const energyBodyDataList: EnergyBodyRuntimeData[] = [];

    // �𥕦遣�賡��?- �餅糓�𥕦遣 mesh嚗屸�朞� visible �批��曄內
    const ebCoreEnabled = planet.energyBodySystem?.coreEnabled !== false;
    const ebSystemEnabled = planet.energyBodySystem?.enabled ?? false;
    planet.energyBodySystem?.energyBodies?.forEach(ebSettings => {
      const ebData = createEnergyBodyMesh(ebSettings);
      // �寞旿蝟餌��嗆���摰硺��嗆��挽蝵桀�憪见虾閫��?
      const initialVisible = ebSystemEnabled && ebCoreEnabled && ebSettings.enabled;
      ebData.group.visible = initialVisible;
      energyBodies.add(ebData.group);
      energyBodyDataList.push({
        id: ebSettings.id,
        group: ebData.group,
        edgesMesh: ebData.edgesMesh,
        verticesMesh: ebData.verticesMesh,
        shellMesh: ebData.shellMesh,
        voronoiMesh: ebData.voronoiMesh,
        voronoiSeeds: ebData.voronoiSeeds,
        vertexDegrees: ebData.vertexDegrees,
        graph: ebData.graph,
        lightPackets: ebData.lightPackets,
        edgeLightData: ebData.edgeLightData,
        settings: ebSettings
      });
    });

    return { core: coreObject, flames: flamesGroup, rings, radiation, fireflies, magicCircles, energyBodies, emitters, fireflyData: fireflyDataList, magicCircleData: magicCircleDataList, energyBodyData: energyBodyDataList };
  }

  // �𥕦遣�詨��牐�雿?
  function createCoreGeometry(core: PlanetCoreSettings | undefined): THREE.BufferGeometry {
    if (!core) {
      // 餈𥪜�蝛箏�雿蓥�
      return new THREE.BufferGeometry();
    }
    const radius = core.baseRadius;

    // �寞旿撖�漲霈∠�蝎鍦��堆��𣂼���憭扳㺭�譍誑靽肽��扯�
    const surfaceArea = 4 * Math.PI * radius * radius;
    const rawCount = Math.floor(surfaceArea * core.density * 0.01);
    const particleCount = Math.min(rawCount, 10000); // ��憭?10000 蝎鍦�

    let fillPercent = 0;
    if (core.fillMode === PlanetFillMode.Gradient) {
      fillPercent = core.fillPercent;
    } else if (core.fillMode === PlanetFillMode.Solid) {
      fillPercent = 100;
    }

    const positions = fibonacciSphere(particleCount, radius, fillPercent);

    // 憸𡏭𠧧
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const ids = new Float32Array(particleCount);
    const radialDists = new Float32Array(particleCount);

    // 鈭桀漲蝟餅㺭
    const brightness = core.brightness || 1.0;
    // 憭批�蝟餅㺭
    const sizeScale = core.particleSize || 1.0;

    // 皜𣂼��滨蔭
    const grad = core.gradientColor;
    const baseSat = core.baseSaturation ?? 1.0;

    for (let i = 0; i < particleCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const dist = Math.sqrt(x * x + y * y + z * z) / radius;

      radialDists[i] = dist;

      let r: number, g: number, b: number;

      // �寞旿皜𣂼�璅∪�霈∠�憸𡏭𠧧
      if (grad.enabled && grad.mode !== 'none') {
        // 霈∠�皜𣂼��惩� t (0-1)
        let t = 0;

        if (grad.mode === 'procedural') {
          // 瘛瑁𠧧皜𣂼�嚗��摨誩�嚗㚁��箇��脩㮾 + �鞉� � 撘箏漲
          let axisValue = 0;
          const intensity = grad.proceduralIntensity ?? 1.0;

          if (grad.proceduralAxis === 'x') {
            axisValue = x / radius; // -1 to 1
          } else if (grad.proceduralAxis === 'y') {
            axisValue = y / radius;
          } else if (grad.proceduralAxis === 'z') {
            axisValue = z / radius;
          } else if (grad.proceduralAxis === 'radial') {
            // 敺��嚗帋�銝剖��啗器蝻?
            const dist = Math.sqrt(x * x + y * y + z * z);
            axisValue = (dist / radius) * 2 - 1; // 0 to 1 �惩��?-1 to 1
          } else {
            // �芸�銋㕑蓬�?
            const axis = grad.proceduralCustomAxis || { x: 0, y: 1, z: 0 };
            const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z) || 1;
            axisValue = (x * axis.x + y * axis.y + z * axis.z) / (radius * len);
          }

          // 霈∠��脩㮾嚗𡁜抅蝖��脩㮾 + (�鞉��?� 撘箏漲)
          // axisValue ��凒 -1 �?1嚗峕�撠���脩㮾�讐宏
          const hueOffset = axisValue * intensity * 180; // 撘箏漲1�塚�隞?180�?80摨?
          let hue = (core.baseHue + hueOffset) % 360;
          if (hue < 0) hue += 360;

          [r, g, b] = hslToRgb(hue, baseSat, 0.6);
        } else {
          // �諹𠧧/銝㕑𠧧皜𣂼�嚗朞恣蝞埈��睃�摮?
          const direction = grad.direction || 'radial';

          if (direction === 'radial') {
            // 敺��皜𣂼�嚗帋�銝剖��穃�
            t = dist;
          } else if (direction === 'linearX') {
            t = (x / radius + 1) / 2; // 0-1
          } else if (direction === 'linearY') {
            t = (y / radius + 1) / 2;
          } else if (direction === 'linearZ') {
            t = (z / radius + 1) / 2;
          } else if (direction === 'linearCustom') {
            // �芸�銋㗇䲮�穃��?
            const dir = grad.directionCustom || { x: 1, y: 0, z: 0 };
            const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
            const dotProduct = (x * dir.x + y * dir.y + z * dir.z) / (radius * len);
            t = (dotProduct + 1) / 2; // 0-1
          } else if (direction === 'spiral') {
            // �箸�皜𣂼�
            const spiralAxis = grad.spiralAxis || 'y';
            const density = grad.spiralDensity || 2;
            let angle = 0;
            let axisPos = 0;

            if (spiralAxis === 'y') {
              angle = Math.atan2(z, x);
              axisPos = (y / radius + 1) / 2;
            } else if (spiralAxis === 'x') {
              angle = Math.atan2(z, y);
              axisPos = (x / radius + 1) / 2;
            } else {
              angle = Math.atan2(y, x);
              axisPos = (z / radius + 1) / 2;
            }

            // �箸�嚗朞�摨?+ 頧游�雿滨蔭 � ��㺭
            t = ((angle / (2 * Math.PI) + 0.5) + axisPos * density) % 1;
          }

          // 憸𡏭𠧧�鍦�?
          if (grad.mode === 'twoColor' && grad.colors.length >= 2) {
            const [r1, g1, b1] = hexToRgb(grad.colors[0]);
            const [r2, g2, b2] = hexToRgb(grad.colors[1]);
            r = r1 + (r2 - r1) * t;
            g = g1 + (g2 - g1) * t;
            b = b1 + (b2 - b1) * t;
          } else if (grad.mode === 'threeColor' && grad.colors.length >= 3) {
            const midPos = grad.colorMidPosition ?? 0.5;
            const midWidth = grad.colorMidWidth ?? 1;
            const midWidth2 = grad.colorMidWidth2 ?? 0;
            const [r1, g1, b1] = hexToRgb(grad.colors[0]);
            const [r2, g2, b2] = hexToRgb(grad.colors[1]);
            const [r3, g3, b3] = hexToRgb(grad.colors[2]);

            // 霈∠�瘛瑕�����諹��湔�撅?
            const blendWeight = Math.min(midWidth, 1);
            const rangeExpand = Math.max(midWidth - 1, 0) * 0.2;
            const bandHalf = midWidth2 * 0.5;
            const midStart = Math.max(0.01, midPos - rangeExpand - bandHalf);
            const midEnd = Math.min(0.99, midPos + rangeExpand + bandHalf);

            // 霈∠�銝㕑𠧧皜𣂼�蝏𤘪�
            let tr, tg, tb;
            if (t < midStart) {
              const t1 = t / midStart;
              tr = r1 + (r2 - r1) * t1;
              tg = g1 + (g2 - g1) * t1;
              tb = b1 + (b2 - b1) * t1;
            } else if (t > midEnd) {
              const t2 = (t - midEnd) / (1 - midEnd);
              tr = r2 + (r3 - r2) * t2;
              tg = g2 + (g3 - g2) * t2;
              tb = b2 + (b3 - b2) * t2;
            } else {
              tr = r2; tg = g2; tb = b2;
            }

            // 霈∠��諹𠧧皜𣂼�蝏𤘪�
            const dr = r1 + (r3 - r1) * t;
            const dg = g1 + (g3 - g1) * t;
            const db = b1 + (b3 - b1) * t;

            // �寞旿 blendWeight 瘛瑕�
            r = dr + (tr - dr) * blendWeight;
            g = dg + (tg - dg) * blendWeight;
            b = db + (tb - db) * blendWeight;
          } else {
            // �鮋���啣��?
            [r, g, b] = hslToRgb(core.baseHue, baseSat, 0.6);
          }
        }
      } else {
        // �閗𠧧璅∪�嚗帋蝙�典抅蝖��脩㮾 + 擖勗�摨?
        [r, g, b] = hslToRgb(core.baseHue, baseSat, 0.6);
      }

      // 摨𠉛鍂鈭桀漲
      colors[i * 3] = r * brightness;
      colors[i * 3 + 1] = g * brightness;
      colors[i * 3 + 2] = b * brightness;

      sizes[i] = (2 + Math.random() * 3) * sizeScale;
      ids[i] = i;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geometry.setAttribute('aRadialDist', new THREE.BufferAttribute(radialDists, 1));

    return geometry;
  }

  // �𥕦遣�詨��鞱捶
  function createCoreMaterial(core: PlanetCoreSettings | undefined, sceneSettings: PlanetSceneSettings, trailAlpha: number = 1.0): THREE.ShaderMaterial {
    const rotSpeed = core?.rotationSpeed || 0.3;
    const rotAxis = core ? getRotationAxis(core.rotationAxis) : { x: 0, y: 1, z: 0 };

    return new THREE.ShaderMaterial({
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRotationSpeed: { value: rotSpeed },
        uRotationAxis: { value: new THREE.Vector3(rotAxis.x, rotAxis.y, rotAxis.z) },
        uBreathing: { value: sceneSettings.breathingEnabled ? sceneSettings.breathingIntensity : 0 },
        uBreathingSpeed: { value: sceneSettings.breathingSpeed },
        uFlicker: { value: sceneSettings.flickerEnabled ? sceneSettings.flickerIntensity : 0 },
        uFlickerSpeed: { value: sceneSettings.flickerSpeed },
        uHandActive: { value: 0 },
        // 頞�鰵�毺��穃��?
        uExplosion: { value: 0 },
        uExplosionExpansion: { value: sceneSettings.explosionExpansion ?? 300 },
        uExplosionTurbulence: { value: sceneSettings.explosionTurbulence ?? 80 },
        uExplosionRotation: { value: sceneSettings.explosionRotation ?? 0.4 },
        uExplosionSizeBoost: { value: sceneSettings.explosionSizeBoost ?? 8 },
        // 暺烐������㺭
        uBlackHole: { value: 0 },
        uBlackHoleCompression: { value: sceneSettings.blackHoleCompression ?? 0.05 },
        uBlackHoleSpinSpeed: { value: sceneSettings.blackHoleSpinSpeed ?? 400 },
        uBlackHoleTargetRadius: { value: sceneSettings.blackHoleTargetRadius ?? 30 },
        uBlackHolePull: { value: sceneSettings.blackHolePull ?? 0.95 },
        uGlowIntensity: { value: 3 },
        uSaturation: { value: 1.2 },
        uTrailAlpha: { value: trailAlpha }, // �硋偏�𤩺�摨?
        // �芰㩞���
        uWanderingLightning: { value: sceneSettings.wanderingLightningEnabled ? sceneSettings.wanderingLightningIntensity : 0 },
        uWanderingLightningSpeed: { value: sceneSettings.wanderingLightningSpeed },
        uWanderingLightningDensity: { value: sceneSettings.wanderingLightningDensity },
        uLightningBreakdown: { value: sceneSettings.lightningBreakdownEnabled ? sceneSettings.lightningBreakdownIntensity : 0 },
        uLightningBreakdownFreq: { value: sceneSettings.lightningBreakdownFrequency },
        uLightningBranches: { value: sceneSettings.lightningBreakdownBranches },
        uTrail: { value: Array(50).fill(null).map(() => new THREE.Vector3()) },
        uTrailLength: { value: 0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  // �𥕦遣蝎鍦��臬�雿蓥� - 雿輻鍂蝏嘥笆�𠰴�嚗峕𣈲����脫芋撘?
  function createParticleRingGeometry(ring: any, baseRadius: number): THREE.BufferGeometry {
    // 雿輻鍂蝏嘥笆�𠰴�嚗䔶��滢�韏𡝗瓲敹��敺?
    const radius = ring.absoluteRadius;
    const positions = generateRingParticles(
      radius,
      ring.eccentricity,
      ring.particleDensity,
      ring.bandwidth,
      ring.thickness
    );

    const count = positions.length / 3;
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const ids = new Float32Array(count);
    const radialDists = new Float32Array(count);  // 敺��敶雴��𤥁�蝳?

    const [baseR, baseG, baseB] = hexToRgb(ring.color);
    const brightness = ring.brightness || 1.0;
    const sizeScale = ring.particleSize || 1.0;

    // 憸𡏭𠧧璅∪�憭��
    const gc = ring.gradientColor;
    const colorMode = gc?.enabled ? gc.mode : 'none';
    const gradColors = gc?.colors || [ring.color, '#4ecdc4', '#ffd93d'];
    const color1 = hexToRgb(gradColors[0] || ring.color);
    const color2 = hexToRgb(gradColors[1] || '#4ecdc4');
    const color3 = hexToRgb(gradColors[2] || '#ffd93d');
    const direction = gc?.direction || 'radial';
    const customDir = gc?.directionCustom || { x: 1, y: 0, z: 0 };
    const midPos = gc?.colorMidPosition ?? 0.5;
    const midWidth = gc?.colorMidWidth ?? 1;
    const midWidth2 = gc?.colorMidWidth2 ?? 0;
    const spiralDensity = gc?.spiralDensity ?? 2;
    const proceduralIntensity = gc?.proceduralIntensity ?? 1.0;

    // HSV 頧?RGB 颲�𨭌�賣㺭
    const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        case 5: return [v, p, q];
        default: return [v, v, v];
      }
    };

    // RGB 頧?HSV
    const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let h = 0, s = max === 0 ? 0 : d / max, v = max;
      if (max !== min) {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h, s, v];
    };

    // �舐����颲寧�嚗�鍂鈭𤾸��烐��矋�
    const bandwidth = ring.bandwidth || 20;
    const innerRadius = radius - bandwidth / 2;
    const outerRadius = radius + bandwidth / 2;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1]; // z in world (thickness)
      const z = positions[i * 3 + 2]; // y in ellipse

      // 霈∠�敺��敶雴��𤥁�蝳鳴�靘𥕢�蝥踵��靝蝙�剁�
      const dist = Math.sqrt(x * x + z * z);
      radialDists[i] = Math.max(0, Math.min(1, (dist - innerRadius) / bandwidth));

      // 霈∠�皜𣂼���㺭 t
      let gradientT = 0.5;

      if (direction === 'radial') {
        // 敺��嚗𡁜抅鈭𡒊�摮𣂼銁�臬捐摨西��游����蝵殷���器蝻睃�憭𤥁器蝻矋�
        const dist = Math.sqrt(x * x + z * z);
        gradientT = (dist - innerRadius) / bandwidth;
      } else if (direction === 'linearX') {
        gradientT = (x / radius + 1) * 0.5;
      } else if (direction === 'linearY') {
        gradientT = (y / radius + 1) * 0.5; // �𡁜漲�孵�
      } else if (direction === 'linearZ') {
        gradientT = (z / radius + 1) * 0.5;
      } else if (direction === 'linearCustom') {
        const len = Math.sqrt(customDir.x ** 2 + customDir.y ** 2 + customDir.z ** 2) || 1;
        const normX = customDir.x / len, normY = customDir.y / len, normZ = customDir.z / len;
        gradientT = ((x * normX + y * normY + z * normZ) / radius + 1) * 0.5;
      } else if (direction === 'spiral') {
        const angle = Math.atan2(z, x);
        gradientT = ((angle / (Math.PI * 2) + 0.5) * spiralDensity) % 1;
      }

      gradientT = Math.max(0, Math.min(1, gradientT));

      // 霈∠���蝏���?
      let finalR = baseR, finalG = baseG, finalB = baseB;

      if (colorMode === 'twoColor') {
        finalR = color1[0] + (color2[0] - color1[0]) * gradientT;
        finalG = color1[1] + (color2[1] - color1[1]) * gradientT;
        finalB = color1[2] + (color2[2] - color1[2]) * gradientT;
      } else if (colorMode === 'threeColor') {
        // 霈∠�瘛瑕�����諹��湔�撅?
        const blendWeight = Math.min(midWidth, 1);
        const rangeExpand = Math.max(midWidth - 1, 0) * 0.2;
        const bandHalf = midWidth2 * 0.5;
        const midStart = Math.max(0.01, midPos - rangeExpand - bandHalf);
        const midEnd = Math.min(0.99, midPos + rangeExpand + bandHalf);

        // 霈∠�銝㕑𠧧皜𣂼�蝏𤘪�
        let tr, tg, tb;
        if (gradientT < midStart) {
          const t = gradientT / midStart;
          tr = color1[0] + (color2[0] - color1[0]) * t;
          tg = color1[1] + (color2[1] - color1[1]) * t;
          tb = color1[2] + (color2[2] - color1[2]) * t;
        } else if (gradientT > midEnd) {
          const t = (gradientT - midEnd) / (1 - midEnd);
          tr = color2[0] + (color3[0] - color2[0]) * t;
          tg = color2[1] + (color3[1] - color2[1]) * t;
          tb = color2[2] + (color3[2] - color2[2]) * t;
        } else {
          tr = color2[0]; tg = color2[1]; tb = color2[2];
        }
        // 霈∠��諹𠧧皜𣂼�蝏𤘪�
        const dr = color1[0] + (color3[0] - color1[0]) * gradientT;
        const dg = color1[1] + (color3[1] - color1[1]) * gradientT;
        const db = color1[2] + (color3[2] - color1[2]) * gradientT;
        // �寞旿 blendWeight 瘛瑕�
        finalR = dr + (tr - dr) * blendWeight;
        finalG = dg + (tg - dg) * blendWeight;
        finalB = db + (tb - db) * blendWeight;
      } else if (colorMode === 'procedural') {
        const [h, s, v] = rgbToHsv(baseR, baseG, baseB);
        const newH = (h + gradientT * proceduralIntensity * 0.3) % 1;
        [finalR, finalG, finalB] = hsvToRgb(newH, s, v);
      }

      // 瞍拇間���
      const vortex = ring.vortex;
      if (vortex?.enabled) {
        const vortexColors = (vortex.colors || ['#ff6b6b', '#4ecdc4']).map(c => hexToRgb(c));
        const armCount = vortex.armCount || 4;
        const twist = vortex.twist || 2;
        const hardness = vortex.hardness || 0.5;

        // 霈∠�敺��雿滨蔭
        const dist = Math.sqrt(x * x + z * z);
        const radialT = (dist - innerRadius) / bandwidth;

        // 霈∠�閫鍦漲�諹卽�贝�摨?
        const angle = Math.atan2(z, x);
        const spiralAngle = angle + radialT * twist;

        // ����贝��暹�
        let pattern = (spiralAngle * armCount / (Math.PI * 2)) % 1;
        if (pattern < 0) pattern += 1;

        // 摨𠉛鍂蝖祈器蝔见漲
        if (hardness < 0.99) {
          const edge = 0.5 * (1 - hardness);
          pattern = pattern < edge ? pattern / edge :
            pattern > 1 - edge ? (1 - pattern) / edge : 1;
          pattern = Math.max(0, Math.min(1, pattern));
        }

        // 憭朞𠧧敺芰㴓
        const colorCount = vortexColors.length;
        const colorPos = pattern * colorCount;
        const colorIndex = Math.floor(colorPos) % colorCount;
        const nextIndex = (colorIndex + 1) % colorCount;
        const localT = colorPos - Math.floor(colorPos);

        const c1 = vortexColors[colorIndex];
        const c2 = vortexColors[nextIndex];
        finalR = c1[0] + (c2[0] - c1[0]) * localT;
        finalG = c1[1] + (c2[1] - c1[1]) * localT;
        finalB = c1[2] + (c2[2] - c1[2]) * localT;
      }

      colors[i * 3] = finalR * brightness;
      colors[i * 3 + 1] = finalG * brightness;
      colors[i * 3 + 2] = finalB * brightness;
      sizes[i] = (1 + Math.random() * 2) * sizeScale;
      ids[i] = i;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geometry.setAttribute('aRadialDist', new THREE.BufferAttribute(radialDists, 1));

    return geometry;
  }

  // �𥕦遣�舐�蝎鍦��牐�雿?
  function createOrbitingParticlesGeometry(orbiting: any, baseRadius: number): THREE.BufferGeometry {
    const innerR = orbiting.orbitRadius * baseRadius;
    const outerR = innerR + orbiting.thickness;

    // �箔�撖�漲�𣬚�憯喃�蝘航恣蝞㛖�摮鞉㺭�?
    const density = orbiting.particleDensity || 1;
    const shellVolume = (4 / 3) * Math.PI * (Math.pow(outerR, 3) - Math.pow(innerR, 3));
    const particleCount = Math.min(Math.max(Math.floor(shellVolume * density * 0.001), 100), 20000);

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const ids = new Float32Array(particleCount);
    const radialDists = new Float32Array(particleCount);  // 敺��敶雴��𤥁�蝳?

    const [r, g, b] = hexToRgb(orbiting.color);
    // 鈭桀漲蝟餅㺭
    const brightness = orbiting.brightness || 1.0;
    // 憭批�蝟餅㺭
    const sizeScale = orbiting.particleSize || 1.0;
    // 頝萘氖瘛∪枂霈曄蔭
    const fadeStrength = orbiting.fadeStrength || 0;

    for (let i = 0; i < particleCount; i++) {
      // ��𢒰�𤩺㦤���
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = innerR + Math.random() * (outerR - innerR);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // 敶雴��𤥁�蝳?(0=��器蝻? 1=憭𤥁器蝻?
      const normalizedDist = (radius - innerR) / (outerR - innerR);
      radialDists[i] = normalizedDist;  // �坔�敺��頝萘氖靘𥕢�蝥踵��靝蝙�?

      // 頝萘氖瘛∪枂嚗朞�蝳餉�餈頣�鈭桀漲頞𠹺�
      let fadeFactor = 1.0;
      if (fadeStrength > 0) {
        // 頝萘氖頞𠰴之瘛∪枂頞𠰴�嚗靕adeStrength �批�瘛∪枂撘箏漲
        fadeFactor = 1.0 - normalizedDist * fadeStrength;
        fadeFactor = Math.max(0.1, fadeFactor); // ��雿𦒘��?0%鈭桀漲
      }

      colors[i * 3] = r * brightness * fadeFactor;
      colors[i * 3 + 1] = g * brightness * fadeFactor;
      colors[i * 3 + 2] = b * brightness * fadeFactor;

      sizes[i] = (1 + Math.random() * 2) * sizeScale;
      ids[i] = i;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geometry.setAttribute('aRadialDist', new THREE.BufferAttribute(radialDists, 1));

    return geometry;
  }

  // �𥕦遣瘜閖猐
  function createMagicCircle(settings: import('../types').MagicCircleSettings): MagicCircleRuntimeData {
    // �𥕦遣��耦�牐�雿?
    const geometry = new THREE.CircleGeometry(settings.radius, 64);

    // �㰘蝸韐游㦛
    let texture: THREE.Texture | null = null;
    if (settings.texture) {
      texture = textureCache.current.get(settings.texture) || null;
      if (!texture) {
        const loader = new THREE.TextureLoader();
        texture = loader.load(settings.texture, (tex) => {
          textureCache.current.set(settings.texture, tex);
        });
        textureCache.current.set(settings.texture, texture);
      }
    }

    // 閫��憸𡏭𠧧璅∪�
    const gc = settings.gradientColor;
    const colorModeMap: { [key: string]: number } = { 'none': 0, 'twoColor': 1, 'threeColor': 2, 'procedural': 3, 'single': 4 };
    const colorMode = gc?.enabled ? (colorModeMap[gc.mode] ?? 0) : 0;
    const directionMap: { [key: string]: number } = { 'radial': 0, 'linearX': 1, 'linearY': 2, 'spiral': 3 };
    const gradientDir = directionMap[gc?.direction || 'radial'] || 0;

    // 閫��憸𡏭𠧧
    const parseColor = (hex: string) => {
      const c = hex.replace('#', '');
      return new THREE.Vector3(
        parseInt(c.substring(0, 2), 16) / 255,
        parseInt(c.substring(2, 4), 16) / 255,
        parseInt(c.substring(4, 6), 16) / 255
      );
    };
    const color1 = parseColor(gc?.colors?.[0] || '#ff6b6b');
    const color2 = parseColor(gc?.colors?.[1] || '#4ecdc4');
    const color3 = parseColor(gc?.colors?.[2] || '#ffd93d');

    // �𥕦遣�鞱捶
    const material = new THREE.ShaderMaterial({
      vertexShader: magicCircleVertexShader,
      fragmentShader: magicCircleFragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uHasTexture: { value: texture ? 1.0 : 0.0 },
        uOpacity: { value: settings.opacity },
        uHueShift: { value: settings.hueShift },
        uSaturationBoost: { value: settings.saturationBoost ?? 1.0 },
        uBrightness: { value: settings.brightness },
        uPulse: { value: 0 },
        // 皜𣂼��脣��?
        uColorMode: { value: colorMode },
        uBaseHue: { value: settings.baseHue ?? 200 },
        uBaseSaturation: { value: settings.baseSaturation ?? 1.0 },
        uColor1: { value: color1 },
        uColor2: { value: color2 },
        uColor3: { value: color3 },
        uColorMidPos: { value: gc?.colorMidPosition ?? 0.5 },
        uColorMidWidth: { value: gc?.colorMidWidth ?? 1 },
        uColorMidWidth2: { value: gc?.colorMidWidth2 ?? 0 },
        uGradientDir: { value: gradientDir },
        uSpiralDensity: { value: gc?.spiralDensity ?? 2 },
        uProceduralIntensity: { value: gc?.proceduralIntensity ?? 1 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide  // �屸𢒰�航�
    });

    const mesh = new THREE.Mesh(geometry, material);

    // 撟唾犖�?XZ 撟喲𢒰嚗��蝥踵��?Y 頧湛�+ 摨𠉛鍂�暹�
    const tiltAngles = getTiltAngles(settings.tilt ?? DEFAULT_TILT_SETTINGS);
    mesh.rotation.x = -Math.PI / 2 + THREE.MathUtils.degToRad(tiltAngles.x);
    mesh.rotation.y = THREE.MathUtils.degToRad(tiltAngles.y);
    mesh.rotation.z = THREE.MathUtils.degToRad(tiltAngles.z);

    // 霈曄蔭 Y 頧游�蝘?
    mesh.position.y = settings.yOffset;

    // 皜脫�憿箏�嚗𡁜銁蝎鍦��詨����雿𤘪瓲敹���?
    mesh.renderOrder = 50;

    // 摮睃�霈曄蔭�其��函𤫇
    mesh.userData = { circleId: settings.id };

    return { id: settings.id, mesh, settings };
  }

  // �𥕦遣�贝蓮瘚�𨫡嚗�鰵��𧋦 - 銝𣇉��鞉�蝟鳴�
  function createOrbitingFirefly(firefly: OrbitingFireflySettings, baseRadius: number): FireflyRuntimeData {
    const group = new THREE.Group(); // 隞��銝箏捆�剁�position 靽脲� (0,0,0)
    const [r, g, b] = hexToRgb(firefly.color);
    const brightness = firefly.brightness || 1.0;
    const radius = firefly.absoluteOrbitRadius;
    const trailLen = firefly.trailLength || 50;

    // 憭湧� - 雿輻鍂銝𣇉��鞉�
    const headGeom = new THREE.BufferGeometry();
    headGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([radius, 0, 0]), 3));

    // 銝箸�銝芣��斤��鞾��箇�摮?
    const flareSeed = Math.random();

    // 头部样式映射：plain=0, flare=1, spark=2, texture=3, 星云粒子形状=4-15
    const headStyleMap: Record<string, number> = {
      plain: 0, flare: 1, spark: 2, texture: 3,
      star: 4, snowflake: 5, heart: 6, crescent: 7, crossglow: 8,
      sakura: 9, sun: 10, sun2: 11, plum: 12, lily: 13, lotus: 14, prism: 15,
      crater: 11, eye: 10 // Map crater to sun2, eye to sun for fallback
    };
    const headStyleInt = headStyleMap[firefly.headStyle] ?? 1;

    // �㰘蝸韐游㦛嚗���𣈯�閬��
    let texture: THREE.Texture | null = null;
    if (firefly.headStyle === 'texture' && firefly.headTexture) {
      texture = textureCache.current.get(firefly.headTexture) || null;
      if (!texture) {
        const loader = new THREE.TextureLoader();
        texture = loader.load(firefly.headTexture, (tex) => {
          textureCache.current.set(firefly.headTexture, tex);
        });
        textureCache.current.set(firefly.headTexture, texture);
      }
    }

    const headMat = new THREE.ShaderMaterial({
      vertexShader: fireflyHeadVertexShader,
      fragmentShader: fireflyHeadFragmentShader,
      uniforms: {
        uSize: { value: (firefly.size || 8) * brightness },
        uColor: { value: new THREE.Vector3(r * brightness, g * brightness, b * brightness) },
        uHeadStyle: { value: headStyleInt },
        uFlareIntensity: { value: firefly.flareIntensity ?? 1.0 },
        uFlareSeed: { value: flareSeed },
        uFlareLeaves: { value: firefly.flareLeaves ?? 4 },
        uFlareWidth: { value: firefly.flareWidth ?? 0.5 },
        uChromaticAberration: { value: firefly.chromaticAberration ?? 0.3 },
        uVelocityStretch: { value: firefly.velocityStretch ?? 0.0 },
        uVelocity: { value: new THREE.Vector3(0, 0, 0) },
        uNoiseAmount: { value: firefly.noiseAmount ?? 0.2 },
        uGlowIntensity: { value: firefly.glowIntensity ?? 0.5 },
        uTime: { value: 0 },
        uPulse: { value: 1.0 },
        uPulseSpeed: { value: firefly.pulseSpeed ?? 1.0 },
        uTexture: { value: texture },
        uUseTexture: { value: texture ? 1.0 : 0.0 },
        uShapeTexture: { value: getShapeTexture() },
        uColorMode: { value: firefly.colorMode === 'texture' ? 1.0 : firefly.colorMode === 'tint' ? 2.0 : 0.0 }
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    const headMesh = new THREE.Points(headGeom, headMat);
    headMesh.renderOrder = 100; // 蝖桐��典�雿𤘪瓲敹���擧葡�?
    group.add(headMesh);

    // 霈∠�頧券��贝蓮嚗�鍂鈭𤾸�憪见��硋偏雿滨蔭嚗?
    const orbitAxis = firefly.orbitAxis || { axis: 'y', angle: 0, isCustom: false };
    const axisVec = getOrbitAxisVector(orbitAxis);
    const axisQuaternion = new THREE.Quaternion();
    const defaultAxis = new THREE.Vector3(0, 1, 0);
    const targetAxis = new THREE.Vector3(axisVec.x, axisVec.y, axisVec.z).normalize();
    axisQuaternion.setFromUnitVectors(defaultAxis, targetAxis);

    // 撠暸� - 蝎鍦��硋偏嚗��蝎曄�嚗峕�扯��游末銝磰䌊�嗅龪�滚仍�剁�
    let tailMesh: THREE.Points | null = null;
    if (firefly.trailEnabled) {
      const positions = new Float32Array(trailLen * 3);
      const tapers = new Float32Array(trailLen);

      // �嘥��碶�蝵殷�瘝輯膘�枏��𤾸�����踹����厩��典��對�
      for (let i = 0; i < trailLen; i++) {
        const backAngle = -i * 0.05;
        const pos = new THREE.Vector3(
          radius * Math.cos(backAngle),
          0,
          radius * Math.sin(backAngle)
        );
        pos.applyQuaternion(axisQuaternion);  // 摨𠉛鍂頧券��贝蓮
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
      }

      // �嘥��?taper嚗��憭游�撠曇※�𧶏�
      for (let i = 0; i < trailLen; i++) {
        const t = i / Math.max(trailLen - 1, 1);
        tapers[i] = Math.pow(1 - t, firefly.trailTaperPower ?? 1.0);
      }

      const tailGeom = new THREE.BufferGeometry();
      tailGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      tailGeom.setAttribute('aTaper', new THREE.BufferAttribute(tapers, 1));

      const tailMat = new THREE.ShaderMaterial({
        vertexShader: fireflyTailVertexShader,
        fragmentShader: fireflyTailFragmentShader,
        uniforms: {
          uColor: { value: new THREE.Vector3(r * brightness, g * brightness, b * brightness) },
          uOpacity: { value: firefly.trailOpacity ?? 0.8 },
          uSize: { value: firefly.size || 8 },
          uBrightness: { value: brightness }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      tailMesh = new THREE.Points(tailGeom, tailMat);
      tailMesh.renderOrder = 99; // 撠暸��典仍�其��㵪�雿���冽瓲敹���?
      group.add(tailMesh);
    }

    // �嘥��硋��脖�蝵?- 瘝輯膘�枏����憭滨鍂銝𢠃𢒰��膘�𤘪�頧穿�
    const history: THREE.Vector3[] = [];
    for (let i = 0; i < trailLen; i++) {
      // 瘝輯膘�枏��𤾸��?
      const backAngle = -i * 0.05; // 瘥譍葵�孵��𤾸�蝘?
      const pos = new THREE.Vector3(
        radius * Math.cos(backAngle),
        0,
        radius * Math.sin(backAngle)
      );
      pos.applyQuaternion(axisQuaternion);
      history.push(pos);
    }

    // 摮睃� ID �其��交𪄳霈曄蔭
    group.userData = { type: 'orbiting', fireflyId: firefly.id };

    return {
      id: firefly.id,
      type: 'orbiting',
      group,
      headMesh,
      tailMesh,
      history
    };
  }

  // �𥕦遣皜貉粥瘚�𨫡蝏��銝𣇉��鞉�蝟鳴��䭾�撠橘�
  function createWanderingFireflyGroup(groupSettings: WanderingFireflyGroupSettings, baseRadius: number): FireflyRuntimeData[] {
    const fireflies: FireflyRuntimeData[] = [];
    const [r, g, b] = hexToRgb(groupSettings.color);
    const brightness = groupSettings.brightness || 1.0;

    for (let i = 0; i < groupSettings.count; i++) {
      const group = new THREE.Group();

      // �𤩺㦤�嘥�雿滨蔭嚗��憯喳�嚗?
      const innerR = groupSettings.innerRadius * baseRadius;
      const outerR = groupSettings.outerRadius * baseRadius;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = innerR + Math.random() * (outerR - innerR);
      const initialPos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // �𤩺㦤�嘥��孵�
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      // 憭湧� - 雿輻鍂銝𣇉��鞉�
      const headGeom = new THREE.BufferGeometry();
      headGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([initialPos.x, initialPos.y, initialPos.z]), 3));

      // 銝箸�銝芣��斤��鞾��箇�摮?
      const flareSeed = Math.random();

      // 头部样式映射：plain=0, flare=1, spark=2, texture=3, 星云粒子形状=4-15
      const headStyleMap: Record<string, number> = {
        plain: 0, flare: 1, spark: 2, texture: 3,
        star: 4, snowflake: 5, heart: 6, crescent: 7, crossglow: 8,
        sakura: 9, sun: 10, sun2: 11, plum: 12, lily: 13, lotus: 14, prism: 15,
        crater: 11, eye: 10 // Map crater to sun2, eye to sun for fallback
      };
      const headStyleInt = headStyleMap[groupSettings.headStyle] ?? 1;

      // �㰘蝸韐游㦛嚗���𣈯�閬��
      let texture: THREE.Texture | null = null;
      if (groupSettings.headStyle === 'texture' && groupSettings.headTexture) {
        texture = textureCache.current.get(groupSettings.headTexture) || null;
        if (!texture) {
          const loader = new THREE.TextureLoader();
          texture = loader.load(groupSettings.headTexture, (tex) => {
            textureCache.current.set(groupSettings.headTexture, tex);
          });
          textureCache.current.set(groupSettings.headTexture, texture);
        }
      }

      const headMat = new THREE.ShaderMaterial({
        vertexShader: fireflyHeadVertexShader,
        fragmentShader: fireflyHeadFragmentShader,
        uniforms: {
          uSize: { value: (groupSettings.size || 5) * brightness },
          uColor: { value: new THREE.Vector3(r * brightness, g * brightness, b * brightness) },
          uHeadStyle: { value: headStyleInt },
          uFlareIntensity: { value: groupSettings.flareIntensity ?? 1.0 },
          uFlareSeed: { value: flareSeed },
          uFlareLeaves: { value: groupSettings.flareLeaves ?? 4 },
          uFlareWidth: { value: groupSettings.flareWidth ?? 0.5 },
          uChromaticAberration: { value: groupSettings.chromaticAberration ?? 0.3 },
          uVelocityStretch: { value: groupSettings.velocityStretch ?? 0.5 },
          uVelocity: { value: direction.clone() },
          uNoiseAmount: { value: groupSettings.noiseAmount ?? 0.2 },
          uGlowIntensity: { value: groupSettings.glowIntensity ?? 0.5 },
          uTime: { value: 0 },
          uPulse: { value: 1.0 },
          uPulseSpeed: { value: groupSettings.pulseSpeed ?? 1.5 },
          uTexture: { value: texture },
          uUseTexture: { value: texture ? 1.0 : 0.0 },
          uShapeTexture: { value: getShapeTexture() },
          uColorMode: { value: groupSettings.colorMode === 'texture' ? 1.0 : groupSettings.colorMode === 'tint' ? 2.0 : 0.0 }
        },
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false
      });

      const headMesh = new THREE.Points(headGeom, headMat);
      headMesh.renderOrder = 100; // 蝖桐��典�雿𤘪瓲敹���擧葡�?
      group.add(headMesh);

      // 摮睃� ID �其��交𪄳霈曄蔭
      group.userData = { type: 'wandering', groupId: groupSettings.id, index: i };

      fireflies.push({
        id: `${groupSettings.id}-${i}`,
        type: 'wandering',
        group,
        headMesh,
        tailMesh: null,
        history: [],
        direction,
        position: initialPos
      });
    }

    return fireflies;
  }

  // �湔鰵瘚�𨫡撠暸�蝎鍦�雿滨蔭
  function updateFireflyTail(
    tailMesh: THREE.Points,
    history: THREE.Vector3[]
  ) {
    try {
      if (!tailMesh || history.length === 0) return;

      const positions = tailMesh.geometry.attributes.position.array as Float32Array;
      const count = Math.min(history.length, positions.length / 3);

      // �湔𦻖憭滚���蟮雿滨蔭�啁�摮?
      for (let i = 0; i < count; i++) {
        const pos = history[i];
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
      }

      tailMesh.geometry.attributes.position.needsUpdate = true;
    } catch (e) {
      // 敹賜裦�躰秤嚗屸俈甇Ｗ𢆡�餃儐�臭葉�?
      console.warn('updateFireflyTail error:', e);
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        background: 'black',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'  // 隡睃�閫行綉嚗屸��漤鵭�匧辣餈?
      }}
    />
  );
};

// ==================== 蝎鍦��穃��函頂蝏?====================

interface ParticleEmitterData {
  mesh: THREE.Points;
  particles: {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number; // 0-1, 1=�啁�, 0=甇颱滿
    size: number;
    color: THREE.Color;
    active: boolean;
  }[];
  geometry: THREE.BufferGeometry;
  lastEmitTime: number;
}

function createParticleEmitter(baseRadius: number): ParticleEmitterData {
  const maxParticles = 2000;
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(maxParticles * 3);
  const colors = new Float32Array(maxParticles * 3);
  const sizes = new Float32Array(maxParticles);
  const alphas = new Float32Array(maxParticles);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const mesh = new THREE.Points(geometry, material);

  // �嘥��𣇉�摮鞉�
  const particles = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      size: 0,
      color: new THREE.Color(),
      active: false
    });
  }

  return {
    mesh,
    particles,
    geometry,
    lastEmitTime: 0
  };
}

function updateParticleEmitter(emitter: ParticleEmitterData, settings: any, baseRadius: number, deltaTime: number, time: number) {
  if (!settings.enabled) {
    emitter.mesh.visible = false;
    return;
  }
  emitter.mesh.visible = true;

  const { birthRate, lifeSpan, initialSpeed, drag, particleSize, emissionRangeMin, emissionRangeMax, color, fadeOut, fadeOutStrength, brightness } = settings;

  // �穃��啁�摮?
  const emitCount = Math.floor(birthRate * deltaTime);
  const particles = emitter.particles;
  let emitted = 0;

  const [r, g, b] = hexToRgb(color);
  const sizeScale = particleSize || 1.0;
  const brightnessScale = brightness || 1.0;
  const maxDistance = baseRadius * (emissionRangeMax || 3); // 瘨�袇颲寧�嚗屸�霈?3R
  const fadeStrength = fadeOutStrength ?? (fadeOut ? 1 : 0); // �澆捆�扳㺭�?

  for (let i = 0; i < particles.length && emitted < emitCount; i++) {
    if (!particles[i].active) {
      const p = particles[i];
      p.active = true;
      p.life = 1.0;
      p.size = (1 + Math.random() * 2) * sizeScale;
      p.color.setRGB(r * brightnessScale, g * brightnessScale, b * brightnessScale);

      // �𤩺㦤�穃�雿滨蔭
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = baseRadius * emissionRangeMin;

      p.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // �笔漲�孵�嚗𡁏窒敺���穃�
      const dir = p.position.clone().normalize();
      p.velocity.copy(dir).multiplyScalar(initialSpeed);

      emitted++;
    }
  }

  // �湔鰵蝎鍦��嗆�?
  const positions = emitter.geometry.attributes.position.array as Float32Array;
  const colors = emitter.geometry.attributes.aColor.array as Float32Array;
  const sizes = emitter.geometry.attributes.aSize.array as Float32Array;
  const alphas = emitter.geometry.attributes.aAlpha.array as Float32Array;

  let activeCount = 0;

  const minDistance = baseRadius * (emissionRangeMin || 1); // �穃�韏瑞�

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.active) {
      // �湔鰵�笔𦶢�冽�
      p.life -= deltaTime / lifeSpan;

      // ��凒�唬�蝵?
      p.position.addScaledVector(p.velocity, deltaTime);
      p.velocity.multiplyScalar(Math.pow(drag, deltaTime * 60)); // �餃�

      // �嗅�璉��交糓�西�餈����器�峕��笔𦶢蝏𤘪�
      const distFromCenter = p.position.length();
      if (p.life <= 0 || distFromCenter > maxDistance) {
        p.active = false;
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        alphas[i] = 0;
        continue;
      }

      // �湔鰵Buffer
      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;

      colors[i * 3] = p.color.r;
      colors[i * 3 + 1] = p.color.g;
      colors[i * 3 + 2] = p.color.b;

      sizes[i] = p.size;

      // 瘛∪枂嚗𡁜抅鈭舘�蝳鳴�隞𤾸�撠�絲�孵�瘨�袇颲寧����銝��𤥁�蝳鳴�
      if (fadeStrength > 0 && maxDistance > minDistance) {
        // 敶雴��𤥁�蝳鳴�0 = �穃�韏瑞�嚗? = 瘨�袇颲寧�
        const normalizedDist = (distFromCenter - minDistance) / (maxDistance - minDistance);
        const clampedDist = Math.max(0, Math.min(1, normalizedDist));
        // 撘箏漲頞𢠃�嚗峕楚�箄�敹恬�alpha = (1 - dist)^strength
        alphas[i] = Math.pow(1 - clampedDist, fadeStrength);
      } else {
        alphas[i] = 1.0;
      }

      activeCount++;
    } else {
      alphas[i] = 0;
    }
  }

  emitter.geometry.attributes.position.needsUpdate = true;
  emitter.geometry.attributes.aColor.needsUpdate = true;
  emitter.geometry.attributes.aSize.needsUpdate = true;
  emitter.geometry.attributes.aAlpha.needsUpdate = true;
}

export default PlanetScene;
