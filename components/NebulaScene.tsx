/**
 * input: App.tsx 传入的 settings/handData/data/nebulaInstancesData 等
 * output: 渲染星云主场景与多实例星云（含后处理、交互、特效 uniforms 同步）
 * pos: 星云模式的核心渲染组件；互通模式下星云渲染主要由 PlanetScene 接管
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { AppSettings, HandData, ParticleShape, LineStyle, LineColorMode, LineRenderMode, GlowMode, LineGradientMode, NebulaInstance } from '../types';
import { ProcessedData } from '../services/imageProcessing';
import { computeLines, LineData } from '../services/lineComputation';
import { nebulaVertexShader, nebulaFragmentShader } from '../shaders/nebulaShaders';

// --- Canvas形状纹理生成 ---
// 使用Canvas API绘制形状，生成纹理图集
function createShapeTextureAtlas(): THREE.CanvasTexture {
  const size = 256; // 每个形状的尺寸
  const cols = 4;   // 4列
  const rows = 4;   // 4行 = 16种形状（当前13种）
  const canvas = document.createElement('canvas');
  canvas.width = size * cols;
  canvas.height = size * rows;
  const mainCtx = canvas.getContext('2d')!;

  // 清空画布
  mainCtx.clearRect(0, 0, canvas.width, canvas.height);

  // 辅助函数：绘制五角星
  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };

  // 形状绘制函数（接收ctx参数）
  const shapes: Array<(ctx: CanvasRenderingContext2D, cx: number, cy: number) => void> = [
    // 0: Circle (圆形)
    (ctx, cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.fill();
    },
    // 1: Star (五角星)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      drawStar(ctx, cx, cy, 5, 60, 24);
      ctx.fill();
    },
    // 2: Snowflake (钻石冰星) - 缩小尺寸确保圆点显示
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.0, 1.0); // 不缩放，确保55像素的圆点在范围内
      ctx.fillStyle = "white";
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 30);
        ctx.lineTo(0, 50);
        ctx.lineTo(-10, 30);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 55, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    // 3: Heart (爱心)
    (ctx, cx, cy) => {
      const scale = 3.5;
      ctx.save();
      ctx.translate(cx, cy - 15);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-10, -10, -20, 5, 0, 20);
      ctx.bezierCurveTo(20, 5, 10, -10, 0, 0);
      ctx.fill();
      ctx.restore();
    },
    // 4: Crescent (月牙) - 调整使其更饱满
    (ctx, cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx + 45, cy - 15, 70, 0, Math.PI * 2); // 减小剪切圆，使月牙更饱满
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    },
    // 5: CrossGlow (十字光芒)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2, 2);
      ctx.fillStyle = "white";
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(0, -50);
        ctx.lineTo(3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(0, -30);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    // 6: Sakura (樱花) - 缩小尺寸确保完整显示
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.2, 1.2); // 进一步缩小
      ctx.fillStyle = "white";
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(20, -30, 0, -48);
        ctx.quadraticCurveTo(-20, -30, 0, -8);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    // 7: Sun (太阳) - 中心圆+尖锐三角形光芒（有间距）
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";

      // 绘制6个尖锐的三角形光芒
      const rays = 6;
      const circleRadius = 30; // 中心圆半径
      const rayStartRadius = 42; // 光芒起始位置（与圆保持距离）
      const rayEndRadius = 65; // 光芒尖端（缩小避免截断）
      const rayWidth = Math.PI / 8; // 加宽光芒

      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 - Math.PI / 2; // 从顶部开始
        ctx.beginPath();
        // 光芒底部左点
        ctx.moveTo(
          cx + Math.cos(angle - rayWidth) * rayStartRadius,
          cy + Math.sin(angle - rayWidth) * rayStartRadius
        );
        // 光芒尖端
        ctx.lineTo(
          cx + Math.cos(angle) * rayEndRadius,
          cy + Math.sin(angle) * rayEndRadius
        );
        // 光芒底部右点
        ctx.lineTo(
          cx + Math.cos(angle + rayWidth) * rayStartRadius,
          cy + Math.sin(angle + rayWidth) * rayStartRadius
        );
        ctx.closePath();
        ctx.fill();
      }

      // 绘制中心圆
      ctx.beginPath();
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
      ctx.fill();
    },
    // 8: Sun2 (太阳2) - 三条边都是圆弧的光芒，底边波浪占满圆周
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";

      const rays = 8; // 8个光芒
      const circleRadius = 28; // 中心圆半径
      const rayEndRadius = 70; // 光芒尖端
      const rayHalfAngle = Math.PI / rays; // 每个光芒占的半角度（45°/2 = 22.5°）

      // 绘制光芒（三条边都是圆弧）
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 - Math.PI / 2; // 从顶部开始

        // 光芒底部左右点（在圆周上，平均分布）
        const leftAngle = angle - rayHalfAngle;
        const rightAngle = angle + rayHalfAngle;

        const leftX = cx + Math.cos(leftAngle) * circleRadius;
        const leftY = cy + Math.sin(leftAngle) * circleRadius;
        const rightX = cx + Math.cos(rightAngle) * circleRadius;
        const rightY = cy + Math.sin(rightAngle) * circleRadius;

        // 光芒尖端
        const tipX = cx + Math.cos(angle) * rayEndRadius;
        const tipY = cy + Math.sin(angle) * rayEndRadius;

        // 侧边控制点（向内凹的圆弧）
        const sideCtrlRadius = (circleRadius + rayEndRadius) * 0.45;
        const leftCtrlAngle = angle - rayHalfAngle * 0.65;
        const rightCtrlAngle = angle + rayHalfAngle * 0.65;
        const leftCtrlX = cx + Math.cos(leftCtrlAngle) * sideCtrlRadius;
        const leftCtrlY = cy + Math.sin(leftCtrlAngle) * sideCtrlRadius;
        const rightCtrlX = cx + Math.cos(rightCtrlAngle) * sideCtrlRadius;
        const rightCtrlY = cy + Math.sin(rightCtrlAngle) * sideCtrlRadius;

        // 底边控制点（向外凸的圆弧，形成波浪）
        const bottomCtrlRadius = circleRadius + 12; // 波浪向外凸出的距离
        const bottomCtrlX = cx + Math.cos(angle) * bottomCtrlRadius;
        const bottomCtrlY = cy + Math.sin(angle) * bottomCtrlRadius;

        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        // 左侧边（向外凸的圆弧）
        ctx.quadraticCurveTo(leftCtrlX, leftCtrlY, tipX, tipY);
        // 右侧边（向外凸的圆弧）
        ctx.quadraticCurveTo(rightCtrlX, rightCtrlY, rightX, rightY);
        // 底边（向外凸的圆弧，形成波浪）
        ctx.quadraticCurveTo(bottomCtrlX, bottomCtrlY, leftX, leftY);
        ctx.fill();
      }

      // 绘制中心圆
      ctx.beginPath();
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
      ctx.fill();
    },
    // 9: Plum (梅花) - 5个圆形花瓣 + 花蕊
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const r = 60; // 半径缩小确保完整显示

      // 1. 绘制5个圆形花瓣
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.arc(0, -r * 0.55, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. 绘制花蕊 (使用擦除模式)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'white';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 8);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 0.4);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
    // 10: Lily (百合) - 6瓣修长花瓣 + 中线和斑点
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const r = 60; // 半径缩小确保完整显示

      ctx.save();
      ctx.translate(cx, cy);

      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 6);

        // 1. 绘制修长的花瓣
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.4, -r * 0.4, 0, -r);
        ctx.quadraticCurveTo(-r * 0.4, -r * 0.4, 0, 0);
        ctx.fill();

        // 2. 细节刻画 (擦除模式)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // 中线
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.7);
        ctx.stroke();

        // 斑点
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.1, -r * 0.4, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.1, -r * 0.4, r * 0.04, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.restore();
      }
      ctx.restore();
    },
    // 11: Lotus (莲花) - 8瓣宽大花瓣
    (ctx, cx, cy) => {
      const r = 60; // 半径缩小确保完整显示

      // 使用径向渐变模拟花瓣质感
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grad.addColorStop(0, "rgba(255,255,255, 1)");
      grad.addColorStop(1, "rgba(255,255,255, 0.5)");
      ctx.fillStyle = grad;

      ctx.save();
      ctx.translate(cx, cy);

      const count = 8; // 8瓣
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / count);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // 二次贝塞尔曲线绘制宽大的花瓣
        ctx.quadraticCurveTo(r * 0.6, -r * 0.4, 0, -r);
        ctx.quadraticCurveTo(-r * 0.6, -r * 0.4, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    // 12: Prism (棱镜晶体)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 1.5;

      const scale = 1.1;

      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15 * scale, 30 * scale);
        ctx.lineTo(0, 55 * scale);
        ctx.lineTo(-15 * scale, 30 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 10 * scale);
        ctx.lineTo(0, 45 * scale);
        ctx.moveTo(-5 * scale, 30 * scale);
        ctx.lineTo(5 * scale, 30 * scale);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();
    },
  ];

  // 逐个绘制每个形状到图集（使用离屏canvas确保隔离）
  shapes.forEach((drawFn, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    // 为每个形状创建独立的离屏canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.clearRect(0, 0, size, size);
    offCtx.fillStyle = "white";

    // 在离屏canvas中心绘制形状
    drawFn(offCtx, size / 2, size / 2);

    // 将离屏canvas复制到主canvas
    mainCtx.drawImage(offscreen, col * size, row * size);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;  // 禁用Y轴翻转，保持Canvas坐标系
  texture.magFilter = THREE.NearestFilter;  // 放大时使用最近点采样，边缘更硬
  texture.minFilter = THREE.LinearFilter;   // 缩小时线性采样
  texture.generateMipmaps = false;          // 禁用 mipmap，避免边界混色
  texture.needsUpdate = true;
  return texture;
}

// --- SHADERS ---

// 连线顶点着色器 - 与粒子使用相同的位置变换逻辑
const lineVertexShader = `
precision highp float;

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
precision highp float;

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
precision highp float;

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

// 爆炸效果参数
uniform float uExplosionExpansion;    // 膨胀距离
uniform float uExplosionTurbulence;   // 湍流强度
uniform float uExplosionRotation;     // 旋转角度
uniform float uExplosionSizeBoost;    // 粒子放大

// 黑洞效果参数
uniform float uBlackHoleCompression;  // Z轴压缩
uniform float uBlackHoleSpinSpeed;    // 旋转速度
uniform float uBlackHoleTargetRadius; // 收缩半径
uniform float uBlackHolePull;         // 吸引强度
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
uniform float uMappingEdgeFade;     // 边缘淡化强度 0-0.5

attribute float aSize;
attribute vec3 aColor;
attribute float aParticleId;  // 粒子ID用于碎片形状和闪烁
attribute vec2 aTileIndex;    // 拼接区域索引 (x, y)

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;     // 传递给片段着色器
varying float vEdgeFade;       // 边缘淡化系数
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
      
      // === 海浪效果（Gerstner波） ===
      if (uWaveEnabled > 0.5) {
          float totalWaveZ = 0.0;
          float totalWaveHeight = 0.0;
          
          // 多层波浪叠加
          for (float layer = 0.0; layer < 4.0; layer++) {
              if (layer >= uWaveLayers) break;
              
              // 每层波浪有不同的频率和方向偏移
              float layerScale = 1.0 / (layer + 1.0);
              float layerFreq = 0.01 * (layer + 1.0);
              float dirOffset = layer * 0.5;  // 每层方向偏移
              
              // 应用主波方向
              float dirAngle = uWaveDirection + dirOffset;
              float dirX = cos(dirAngle);
              float dirY = sin(dirAngle);
              
              // 计算波浪相位
              float wavePhase = (pos.x * dirX + pos.y * dirY) * layerFreq - uTime * uWaveSpeed * (1.0 + layer * 0.3);
              
              // Gerstner波：使用陡度参数
              float steepness = uWaveSteepness * layerScale;
              float waveHeight = sin(wavePhase);
              float waveZ = waveHeight * uWaveIntensity * layerScale;
              
              // 陡度影响水平位移（Gerstner特性）
              if (steepness > 0.01) {
                  pos.x += cos(wavePhase) * steepness * uWaveIntensity * layerScale * dirX * 0.1;
                  pos.y += cos(wavePhase) * steepness * uWaveIntensity * layerScale * dirY * 0.1;
              }
              
              totalWaveZ += waveZ;
              totalWaveHeight += waveHeight * layerScale;
          }
          
          // 深度衰减：根据原始z位置衰减波浪效果
          float depthFactor = 1.0 - uWaveDepthFade * clamp((position.z + 100.0) / 200.0, 0.0, 1.0);
          pos.z += totalWaveZ * depthFactor;
          
          // 传递归一化高度
          vWaveHeight = totalWaveHeight / uWaveLayers;
          
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
      
      // Radial Expansion - 使用可控参数
      float maxExpansion = uExplosionExpansion * uExplosion; 
      
      // Non-linear speed: distinct layers
      float speedVar = smoothstep(-0.5, 1.0, noiseVal); 
      vec3 dir = normalize(pos);
      
      // Expansion logic
      pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
      
      // Turbulence - 使用可控参数
      vec3 turb = vec3(
          snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
          snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
          snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
      );
      
      pos += turb * uExplosionTurbulence * uExplosion;
      
      // Galaxy Rotation - 使用可控参数
      pos = rotateZ(uExplosion * uExplosionRotation) * pos;
      
      // Size Boost - 使用可控参数
      extraSize += uExplosion * uExplosionSizeBoost; 
  }
  
  // --- BLACK HOLE: QUASAR / JETS ---
  if (uBlackHole > 0.001) {
      // 1. Flatten to Accretion Disk - 使用可控参数
      pos.z *= mix(1.0, uBlackHoleCompression, uBlackHole);
      
      // 2. Vortex Spin - 使用可控参数
      float r = length(pos.xy);
      float spin = (uBlackHoleSpinSpeed / (r + 10.0)) * uTime * 1.0 * uBlackHole;
      pos = rotateZ(spin) * pos;
      
      // 3. Gravitational Compression - 使用可控参数
      float targetR = uBlackHoleTargetRadius + r * 0.2; 
      float pull = uBlackHole * uBlackHolePull; 
      
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
    
    // 拼接逻辑：使用CPU复制的粒子，每组粒子映射到不同的拼接区域
    // aTileIndex.x = 水平拼接索引 (0 到 tileX-1)
    // aTileIndex.y = 垂直拼接索引 (0 到 tileY-1)
    vec3 mappedPos = pos;
    float PI = 3.14159265;
    
    // 获取当前粒子的拼接区域索引
    float tileIndexX = aTileIndex.x;
    float tileIndexY = aTileIndex.y;
    
    if (uGeometryMapping > 0.5 && uGeometryMapping < 1.5) {
      // 球形映射
      // 每个副本占据 360°/N 的经度范围和 180°/M 的纬度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float phi = tileIndexX * sectorAngle + u * sectorAngle;  // 经度
      
      float latitudeRange = PI / uMappingTileY;
      float theta = -PI * 0.5 + tileIndexY * latitudeRange + v * latitudeRange;  // 纬度
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(theta) * cos(phi);
      mappedPos.y = R * sin(theta);
      mappedPos.z = R * cos(theta) * sin(phi);
      
      // 保留动态效果偏移
      mappedPos += normalize(mappedPos) * (pos.z - position.z) * 0.1;
      
    } else if (uGeometryMapping > 1.5) {
      // 圆柱映射
      // 每个副本占据 360°/N 的角度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float alpha = tileIndexX * sectorAngle + u * sectorAngle;
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(alpha);
      mappedPos.z = R * sin(alpha);
      
      // 垂直方向：每个副本占据圆柱高度的 1/M
      float totalHeight = uImageSize.y;
      float heightPerTile = totalHeight / uMappingTileY;
      mappedPos.y = -totalHeight * 0.5 + tileIndexY * heightPerTile + v * heightPerTile;
      
      // 保留动态效果偏移（径向方向）
      vec2 radialDir = normalize(vec2(mappedPos.x, mappedPos.z));
      mappedPos.x += radialDir.x * (pos.z - position.z) * 0.1;
      mappedPos.z += radialDir.y * (pos.z - position.z) * 0.1;
    }
    
    // 根据映射强度混合
    pos = mix(originalPos, mappedPos, uMappingStrength);
    
    // 计算边缘淡化系数（只在有拼接时生效）
    if (uMappingTileX > 1.0 || uMappingTileY > 1.0) {
      float fadeRange = uMappingEdgeFade;
      float fadeU = smoothstep(0.0, fadeRange, u) * smoothstep(1.0, 1.0 - fadeRange, u);
      float fadeV = smoothstep(0.0, fadeRange, v) * smoothstep(1.0, 1.0 - fadeRange, v);
      vEdgeFade = fadeU * fadeV;
    } else {
      vEdgeFade = 1.0;
    }
  } else {
    vEdgeFade = 1.0;
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
  gl_PointSize = clamp(gl_PointSize, 0.01, 100.0);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uShape; // 0=circle, 1=star, 2=snowflake, 3=heart, 4=crescent, 5=crossglow, 6=sakura, 7=sun, 8=sun2, 9=plum, 10=lily, 11=lotus, 12=prism
uniform float uSaturation;
uniform sampler2D uShapeTexture; // Canvas绘制的形状纹理图集
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
uniform float uBrightness;  // 亮度调整
uniform float uOpacity;     // 透明度调整
uniform float uOverlayMode; // 互通模式颜色补偿

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;   // 粒子ID（用于碎片形状和闪烁）
varying float vEdgeFade;     // 边缘淡化系数
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
  
  int shapeIdx = int(uShape + 0.5);
  shapeIdx = clamp(shapeIdx, 0, 12);
  
  // 圆形粒子使用程序化渲染（硬边缘）
  if (shapeIdx == 0) {
    // Circle - 程序化硬边缘
    if (dist > 0.5) discard;
    alpha = computeGlow(dist, uGlowMode, uGlowIntensity);
  } else {
    // 其他形状使用Canvas纹理图集采样
    // 纹理图集布局: 4列 x 4行 = 16种形状（当前13种）
    // 形状索引: 0=Circle, 1=Star, 2=Snowflake, 3=Heart, 4=Crescent, 5=CrossGlow, 6=Sakura, 7=Sun, 8=Sun2, 9=Plum, 10=Lily, 11=Lotus, 12=Prism
    float col = mod(float(shapeIdx), 4.0);
    float row = floor(float(shapeIdx) / 4.0);
    
    // 计算在图集中的UV坐标
    // flipY=false 时，UV(0,0) 对应 Canvas 左上角，Y轴向下
    vec2 atlasUV = vec2(
      (col + gl_PointCoord.x) / 4.0,
      (row + gl_PointCoord.y) / 4.0
    );
    
    // 从纹理采样
    vec4 texColor = texture2D(uShapeTexture, atlasUV);
    alpha = texColor.a;
    
    // 如果alpha太低则丢弃（硬边缘）
    if (alpha < 0.5) discard;
    
    // 应用光晕效果（dist 需要归一化到 0~1 范围）
    alpha *= computeGlow(dist * 2.0, uGlowMode, uGlowIntensity);
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

  // Saturation
  vec3 color = finalColor;
  if (uSaturation != 1.0) {
     vec3 hsv = rgb2hsv(color);
     hsv.y *= uSaturation;
     color = hsv2rgb(hsv);
  }
  
  // 应用亮度和透明度
  color *= uBrightness;
  float finalAlpha = min(alpha * uOpacity * vEdgeFade, 1.0);
  
  // 互通模式颜色补偿：提升颜色饱和度和亮度以抵消透明混合导致的颜色变淡
  float overlay = clamp(uOverlayMode, 0.0, 1.0);
  if (overlay > 0.001) {
    color *= mix(1.0, 2.5, overlay); // 亮度补偿（按强度渐进）
    // 增加饱和度补偿（按强度渐进）
    float grayComp = dot(color, vec3(0.299, 0.587, 0.114));
    float satBoost = mix(1.0, 1.2, overlay);
    color = mix(vec3(grayComp), color, satBoost);
  }
  
  gl_FragColor = vec4(color, finalAlpha);
}
`;

interface NebulaSceneProps {
  data: ProcessedData | null;
  settings: AppSettings;
  handData: React.MutableRefObject<HandData>;
  overlayMode?: boolean;
  colorPickMode?: boolean;
  onColorPick?: (color: { h: number; s: number; l: number }) => void;
  nebulaInstancesData?: Map<string, ProcessedData>;
  nebulaPreviewMode?: boolean;  // 预览模式：隐藏星云列表，只显示主场景星云
  sidebarOpen?: boolean;        // 侧边栏是否展开，用于调整场景偏移
}

// ==================== 背景渲染着色器 ====================
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

// RGB 转 HSL
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

// HSL 转 RGB
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
  
  // 应用饱和度
  vec3 hsl = rgb2hsl(texColor.rgb);
  hsl.y = clamp(hsl.y * uSaturation, 0.0, 1.0);
  vec3 adjustedColor = hsl2rgb(hsl);
  
  // 应用亮度
  gl_FragColor = vec4(adjustedColor * uBrightness, texColor.a);
}
`;

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

const NebulaScene: React.FC<NebulaSceneProps> = ({ data, settings, handData, colorPickMode, onColorPick, overlayMode = false, nebulaInstancesData, nebulaPreviewMode = false, sidebarOpen = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const afterimagePassRef = useRef<AfterimagePass | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const usePostProcessingRef = useRef(true);
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const lineMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const lineDataRef = useRef<LineData | null>(null);

  // 多星云实例的粒子系统
  const nebulaInstancePointsRef = useRef<Map<string, THREE.Points>>(new Map());
  const nebulaInstanceMaterialsRef = useRef<Map<string, THREE.ShaderMaterial>>(new Map());

  // 背景球体
  const backgroundMeshRef = useRef<THREE.Mesh | null>(null);
  const backgroundTextureRef = useRef<THREE.Texture | null>(null);

  // 缓存形状纹理图集，避免重复创建（使用懒初始化函数避免渲染期间副作用）
  const shapeTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const getShapeTexture = () => {
    if (!shapeTextureRef.current) {
      shapeTextureRef.current = createShapeTextureAtlas();
    }
    return shapeTextureRef.current;
  };

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
      console.log('Picked color RGB:', Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count), 'HSL:', hsl);
      onColorPick(hsl);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing canvas (important for React StrictMode)
    containerRef.current.innerHTML = '';

    disposedRef.current = false;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // 叠加模式下使用透明背景，否则使用深色背景
    if (overlayMode) {
      scene.background = null;
    } else {
      scene.background = new THREE.Color(0x050505);
    }
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    sceneRef.current = scene;
    setSceneReady(true);

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 4000);
    camera.position.set(0, 0, 800);
    cameraRef.current = camera;

    // 检测移动设备和iOS
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    // 检测是否为iPad（包括iPadOS 13+伪装成Mac的情况）
    const isIPad = /iPad/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // 所有平台启用后处理（Bloom强度设为0时效果等同于禁用）
    const skipPostProcessing = false;
    usePostProcessingRef.current = true;

    // 移动设备使用更保守的设置
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile, // 非移动设备启用抗锯齿
      powerPreference: isMobile ? "default" : "high-performance",
      // 叠加模式或iOS需要alpha通道
      alpha: overlayMode || isIOS || isIPad,
      // iOS需要更保守的设置
      preserveDrawingBuffer: isIOS || isIPad,
      failIfMajorPerformanceCaveat: false
    });
    // 叠加模式下设置透明背景
    if (overlayMode) {
      renderer.setClearColor(0x000000, 0);
    }

    // 限制移动设备的像素比以避免GPU内存不足
    const maxPixelRatio = isMobile ? 1.0 : window.devicePixelRatio; // iOS进一步降低像素比
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(width, height);
    // iOS上不使用ToneMapping以避免潜在问题
    if (!skipPostProcessing) {
      renderer.toneMapping = THREE.ReinhardToneMapping;
    }
    // 设置颜色空间与PlanetScene对齐，让Bloom效果更明显
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // WebGL context lost/restored 处理
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost. Attempting to recover...');
      // 不再自动刷新页面，让React处理组件的重新挂载
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
    controls.maxDistance = 5000;            // 最大缩放距离
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
      // trailLength 0-1 映射到 damp 0.9-0.98（更明显的拖尾效果）
      const initialDamp = settings.trailEnabled ? (0.9 + settings.trailLength * 0.08) : 0;
      const afterimagePass = new AfterimagePass(initialDamp);
      afterimagePassRef.current = afterimagePass;

      const composer = new EffectComposer(renderer);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);
      composer.addPass(afterimagePass);
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
      if (disposedRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);

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

      // 更新多星云实例的uniforms
      nebulaInstanceMaterialsRef.current.forEach((mat) => {
        mat.uniforms.uTime.value = time;
        mat.uniforms.uExplosion.value = currentExplosionRef.current;
        mat.uniforms.uBlackHole.value = currentBlackHoleRef.current;
        mat.uniforms.uHandPos.value.copy(handPos);
        mat.uniforms.uHandActive.value = handActive;
      });

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
      disposedRef.current = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (afterimagePassRef.current) {
        afterimagePassRef.current = null;
      }
      if (bloomPassRef.current) {
        bloomPassRef.current = null;
      }
      if (composerRef.current) {
        const composerAny = composerRef.current as any;
        if (typeof composerAny.dispose === 'function') {
          composerAny.dispose();
        } else {
          if (composerAny.renderTarget1?.dispose) composerAny.renderTarget1.dispose();
          if (composerAny.renderTarget2?.dispose) composerAny.renderTarget2.dispose();
        }
        composerRef.current = null;
      }

      if (linesRef.current) {
        scene.remove(linesRef.current);
        linesRef.current.geometry.dispose();
        linesRef.current = null;
      }
      if (lineMaterialRef.current) {
        lineMaterialRef.current.dispose();
        lineMaterialRef.current = null;
      }

      nebulaInstancePointsRef.current.forEach((p) => {
        scene.remove(p);
        p.geometry.dispose();
      });
      nebulaInstancePointsRef.current.clear();
      nebulaInstanceMaterialsRef.current.forEach((m) => m.dispose());
      nebulaInstanceMaterialsRef.current.clear();

      if (pointsRef.current) {
        scene.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        pointsRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
      if (shapeTextureRef.current) {
        shapeTextureRef.current.dispose();
        shapeTextureRef.current = null;
      }

      renderer.dispose();
      rendererRef.current = null;
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  // 监听 overlayMode 变化，动态更新背景透明度
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;

    if (overlayMode) {
      sceneRef.current.background = null;
      rendererRef.current.setClearColor(0x000000, 0);
    } else {
      // 读取当前深色主题背景色
      const style = getComputedStyle(document.documentElement);
      const bgVar = style.getPropertyValue('--bg').trim();
      const bgColor = bgVar ? new THREE.Color(bgVar) : new THREE.Color(0x000000);
      sceneRef.current.background = bgColor;
      rendererRef.current.setClearColor(bgColor, 1);
    }
  }, [overlayMode]);

  // 背景处理 - 星云模式不渲染自己的全景背景，背景功能由 PlanetScene 负责
  // NebulaScene 只处理 scene.background 颜色/透明度
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // 清理任何可能存在的背景球体（从旧版本遗留）
    if (backgroundMeshRef.current) {
      scene.remove(backgroundMeshRef.current);
      backgroundMeshRef.current.geometry.dispose();
      (backgroundMeshRef.current.material as THREE.Material).dispose();
      backgroundMeshRef.current = null;
    }
    if (backgroundTextureRef.current) {
      backgroundTextureRef.current.dispose();
      backgroundTextureRef.current = null;
    }

    // 互通模式：背景透明，由底层 PlanetScene 显示背景
    // 纯星云模式：显示默认深色背景
    if (overlayMode) {
      scene.background = null;
    } else {
      const style = getComputedStyle(document.documentElement);
      const bgVar = style.getPropertyValue('--bg').trim();
      scene.background = bgVar ? new THREE.Color(bgVar) : new THREE.Color(0x050505);
    }
  }, [overlayMode]);


  useEffect(() => {
    if (!data || !sceneRef.current) return;

    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
    }

    // 几何映射拼接：复制粒子数据以实现真正的拼接效果
    const tileX = settings.mappingTileX || 1;
    const tileY = settings.mappingTileY || 1;
    const tileCount = tileX * tileY;
    const totalCount = data.count * tileCount;

    let positions: Float32Array;
    let colors: Float32Array;
    let sizes: Float32Array;
    let particleIds: Float32Array;
    let tileIndices: Float32Array;

    if (tileCount > 1 && settings.geometryMapping !== 'none') {
      // 需要复制粒子数据
      positions = new Float32Array(totalCount * 3);
      colors = new Float32Array(totalCount * 3);
      sizes = new Float32Array(totalCount);
      particleIds = new Float32Array(totalCount);
      tileIndices = new Float32Array(totalCount * 2); // x和y的tile索引

      for (let ty = 0; ty < tileY; ty++) {
        for (let tx = 0; tx < tileX; tx++) {
          const tileIdx = ty * tileX + tx;
          const offset = tileIdx * data.count;

          for (let i = 0; i < data.count; i++) {
            const srcIdx = i;
            const dstIdx = offset + i;

            // 复制位置
            positions[dstIdx * 3] = data.positions[srcIdx * 3];
            positions[dstIdx * 3 + 1] = data.positions[srcIdx * 3 + 1];
            positions[dstIdx * 3 + 2] = data.positions[srcIdx * 3 + 2];

            // 复制颜色
            colors[dstIdx * 3] = data.colors[srcIdx * 3];
            colors[dstIdx * 3 + 1] = data.colors[srcIdx * 3 + 1];
            colors[dstIdx * 3 + 2] = data.colors[srcIdx * 3 + 2];

            // 复制大小
            sizes[dstIdx] = data.sizes[srcIdx];

            // 粒子ID
            particleIds[dstIdx] = srcIdx;

            // tile索引
            tileIndices[dstIdx * 2] = tx;
            tileIndices[dstIdx * 2 + 1] = ty;
          }
        }
      }
    } else {
      // 不需要复制
      positions = data.positions;
      colors = data.colors;
      sizes = data.sizes;
      particleIds = new Float32Array(data.count);
      tileIndices = new Float32Array(data.count * 2);
      for (let i = 0; i < data.count; i++) {
        particleIds[i] = i;
        tileIndices[i * 2] = 0;
        tileIndices[i * 2 + 1] = 0;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aParticleId', new THREE.BufferAttribute(particleIds, 1));
    geometry.setAttribute('aTileIndex', new THREE.BufferAttribute(tileIndices, 2));

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
      [ParticleShape.Star]: 1.0,
      [ParticleShape.Snowflake]: 2.0,
      [ParticleShape.Heart]: 3.0,
      [ParticleShape.Crescent]: 4.0,
      [ParticleShape.CrossGlow]: 5.0,
      [ParticleShape.Sakura]: 6.0,
      [ParticleShape.Sun]: 7.0,
      [ParticleShape.Sun2]: 8.0,
      [ParticleShape.Plum]: 9.0,
      [ParticleShape.Lily]: 10.0,
      [ParticleShape.Lotus]: 11.0,
      [ParticleShape.Prism]: 12.0,
    };
    const shapeVal = shapeMap[settings.particleShape] || 0.0;

    // 计算光晕模式值
    const glowModeMap: Record<GlowMode, number> = {
      [GlowMode.None]: 0.0,
      [GlowMode.Soft]: 1.0,
      [GlowMode.Sharp]: 2.0,
      [GlowMode.Aura]: 3.0,
    };
    const glowModeVal = glowModeMap[settings.glowMode] ?? 0.0;

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
        // 爆炸效果参数
        uExplosionExpansion: { value: settings.nebulaExplosionExpansion ?? 300 },
        uExplosionTurbulence: { value: settings.nebulaExplosionTurbulence ?? 80 },
        uExplosionRotation: { value: settings.nebulaExplosionRotation ?? 0.4 },
        uExplosionSizeBoost: { value: settings.nebulaExplosionSizeBoost ?? 8 },
        // 黑洞效果参数
        uBlackHoleCompression: { value: settings.nebulaBlackHoleCompression ?? 0.05 },
        uBlackHoleSpinSpeed: { value: settings.nebulaBlackHoleSpinSpeed ?? 400 },
        uBlackHoleTargetRadius: { value: settings.nebulaBlackHoleTargetRadius ?? 30 },
        uBlackHolePull: { value: settings.nebulaBlackHolePull ?? 0.95 },
        uColor: { value: new THREE.Color(0xffffff) },
        uShape: { value: shapeVal },
        uShapeTexture: { value: getShapeTexture() },
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
        uAccretionRadii: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.radiusMax || 100,
            settings.accretionLayers[1]?.radiusMax || 200,
            settings.accretionLayers[2]?.radiusMax || 400
          )
        },
        uAccretionDirs: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
            settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
            settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
          )
        },
        uAccretionSpeeds: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
            settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
            settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
          )
        },
        uAccretionLayerCount: { value: settings.accretionLayers.filter(l => l.enabled).length },
        // 荧光闪烁
        uFlickerEnabled: { value: settings.flickerEnabled ? 1.0 : 0.0 },
        uFlickerIntensity: { value: settings.flickerIntensity },
        uFlickerSpeed: { value: settings.flickerSpeed },
        uBrightness: { value: settings.brightness ?? 1.0 },
        uOpacity: { value: settings.opacity ?? 1.0 },
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
        uImageSize: {
          value: new THREE.Vector2(
            data.canvasWidth || 800,
            data.canvasHeight || 600
          )
        },
        uMappingTileX: { value: settings.mappingTileX },
        uMappingTileY: { value: settings.mappingTileY },
        uMappingEdgeFade: { value: settings.mappingEdgeFade ?? 0.1 },
        // 闪电效果
        uWanderingLightning: { value: settings.wanderingLightningEnabled ? settings.wanderingLightningIntensity : 0.0 },
        uWanderingLightningSpeed: { value: settings.wanderingLightningSpeed },
        uWanderingLightningDensity: { value: settings.wanderingLightningDensity },
        uWanderingLightningWidth: { value: settings.wanderingLightningWidth },
        uLightningBreakdown: { value: settings.lightningBreakdownEnabled ? settings.lightningBreakdownIntensity : 0.0 },
        uLightningBreakdownFreq: { value: settings.lightningBreakdownFrequency },
        uLightningBranches: { value: settings.lightningBreakdownBranches },
        uOverlayMode: { value: overlayMode ? 1.0 : 0.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    // 主场景星云默认隐藏，只在预览模式下显示
    points.visible = nebulaPreviewMode;
    sceneRef.current.add(points);
    pointsRef.current = points;
    materialRef.current = material;

  }, [data, settings.mappingTileX, settings.mappingTileY, settings.geometryMapping]);

  // 主场景星云只在预览模式下显示
  useEffect(() => {
    if (!pointsRef.current) return;
    pointsRef.current.visible = nebulaPreviewMode;
  }, [nebulaPreviewMode]);

  // ==================== 多星云实例渲染 ====================
  useEffect(() => {
    if (!sceneRef.current || !sceneReady || !nebulaInstancesData || !settings.nebulaInstances) return;

    const scene = sceneRef.current;
    const currentPoints = nebulaInstancePointsRef.current;
    const currentMaterials = nebulaInstanceMaterialsRef.current;
    const enabledInstances = settings.nebulaInstances.filter(n => n.enabled);
    const enabledIds = new Set(enabledInstances.map(n => n.id));

    // 计算形状值
    const shapeMap: Record<ParticleShape, number> = {
      [ParticleShape.Circle]: 0.0,
      [ParticleShape.Star]: 1.0,
      [ParticleShape.Snowflake]: 2.0,
      [ParticleShape.Heart]: 3.0,
      [ParticleShape.Crescent]: 4.0,
      [ParticleShape.CrossGlow]: 5.0,
      [ParticleShape.Sakura]: 6.0,
      [ParticleShape.Sun]: 7.0,
      [ParticleShape.Sun2]: 8.0,
      [ParticleShape.Plum]: 9.0,
      [ParticleShape.Lily]: 10.0,
      [ParticleShape.Lotus]: 11.0,
      [ParticleShape.Prism]: 12.0,
    };
    const shapeVal = shapeMap[settings.particleShape] || 0.0;

    // 计算光晕模式值
    const glowModeMap: Record<GlowMode, number> = {
      [GlowMode.None]: 0.0,
      [GlowMode.Soft]: 1.0,
      [GlowMode.Sharp]: 2.0,
      [GlowMode.Aura]: 3.0,
    };
    const glowModeVal = glowModeMap[settings.glowMode] ?? 0.0;

    // 预览模式：隐藏所有星云实例（只显示主场景星云）
    if (nebulaPreviewMode) {
      currentPoints.forEach((points) => {
        points.visible = false;
      });
      return;
    }

    // 清理已删除或禁用的实例（先清理，再设置可见性）
    // 清理已删除或禁用的实例（先清理，再设置可见性）
    currentPoints.forEach((points, id) => {
      if (!enabledIds.has(id)) {
        scene.remove(points);
        points.geometry.dispose();
        const mat = currentMaterials.get(id);
        if (mat) {
          mat.dispose();
          currentMaterials.delete(id);
        }
        currentPoints.delete(id);
      }
    });

    enabledInstances.forEach((instance) => {
      const instanceData = nebulaInstancesData.get(instance.id);
      if (!instanceData) return;

      const tileX = instance.mappingTileX || 1;
      const tileY = instance.mappingTileY || 1;

      const inst = instance as Partial<NebulaInstance>;

      const waveEnabled = inst.waveEnabled ?? settings.waveEnabled;
      const waveIntensity = inst.waveIntensity ?? settings.waveIntensity;
      const waveSpeed = inst.waveSpeed ?? settings.waveSpeed;
      const waveSteepness = inst.waveSteepness ?? settings.waveSteepness;
      const waveLayers = inst.waveLayers ?? settings.waveLayers;
      const waveDirection = inst.waveDirection ?? settings.waveDirection;
      const waveDepthFade = inst.waveDepthFade ?? settings.waveDepthFade;
      const waveFoam = inst.waveFoam ?? settings.waveFoam;

      const wanderingLightningEnabled = inst.wanderingLightningEnabled ?? settings.wanderingLightningEnabled;
      const wanderingLightningIntensity = inst.wanderingLightningIntensity ?? settings.wanderingLightningIntensity;
      const wanderingLightningSpeed = inst.wanderingLightningSpeed ?? settings.wanderingLightningSpeed;
      const wanderingLightningDensity = inst.wanderingLightningDensity ?? settings.wanderingLightningDensity;
      const wanderingLightningWidth = inst.wanderingLightningWidth ?? settings.wanderingLightningWidth;

      const accretionLayers = inst.accretionLayers ?? settings.accretionLayers;
      const acc0 = accretionLayers?.[0];
      const acc1 = accretionLayers?.[1];
      const acc2 = accretionLayers?.[2];
      const accretionLayerCount = (accretionLayers || []).filter(l => l.enabled).length;

      const lightningBreakdownEnabled = inst.lightningBreakdownEnabled ?? settings.lightningBreakdownEnabled;
      const lightningBreakdownIntensity = inst.lightningBreakdownIntensity ?? settings.lightningBreakdownIntensity;
      const lightningBreakdownFrequency = inst.lightningBreakdownFrequency ?? settings.lightningBreakdownFrequency;
      const lightningBreakdownBranches = inst.lightningBreakdownBranches ?? settings.lightningBreakdownBranches;

      if (currentPoints.has(instance.id)) {
        const points = currentPoints.get(instance.id)!;
        points.position.set(instance.position.x, instance.position.y, instance.position.z);
        points.scale.setScalar(instance.scale);

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
              const dstIdx = offset + i;

              positions[dstIdx * 3] = instanceData.positions[i * 3];
              positions[dstIdx * 3 + 1] = instanceData.positions[i * 3 + 1];
              positions[dstIdx * 3 + 2] = instanceData.positions[i * 3 + 2];

              colors[dstIdx * 3] = instanceData.colors[i * 3];
              colors[dstIdx * 3 + 1] = instanceData.colors[i * 3 + 1];
              colors[dstIdx * 3 + 2] = instanceData.colors[i * 3 + 2];

              sizes[dstIdx] = instanceData.sizes[i];
              particleIds[dstIdx] = i;
              tileIndices[dstIdx * 2] = tx;
              tileIndices[dstIdx * 2 + 1] = ty;
            }
          }
        }

        // 用新的粒子数据替换几何
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        newGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        newGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        newGeometry.setAttribute('aParticleId', new THREE.BufferAttribute(particleIds, 1));
        newGeometry.setAttribute('aTileIndex', new THREE.BufferAttribute(tileIndices, 2));
        newGeometry.center();

        // 释放旧几何，替换为新几何
        points.geometry.dispose();
        points.geometry = newGeometry;

        // 更新材质的 uImageSize 和 uShape
        const material = currentMaterials.get(instance.id);
        if (material) {
          material.uniforms.uImageSize.value = new THREE.Vector2(instanceData.canvasWidth || 800, instanceData.canvasHeight || 600);
          material.uniforms.uShape.value = shapeVal;
          material.uniforms.uShapeTexture.value = getShapeTexture();
        }
        return;
      }

      // 创建新的粒子系统
      // 几何映射拼接：根据 tileX 和 tileY 复制粒子
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
          uInteractionRadius: { value: settings.interactionRadius },
          uInteractionStrength: { value: settings.interactionStrength },
          uReturnSpeed: { value: settings.returnSpeed },
          uExplosion: { value: 0.0 },
          uBlackHole: { value: 0.0 },
          uExplosionExpansion: { value: settings.nebulaExplosionExpansion ?? 300 },
          uExplosionTurbulence: { value: settings.nebulaExplosionTurbulence ?? 80 },
          uExplosionRotation: { value: settings.nebulaExplosionRotation ?? 0.4 },
          uExplosionSizeBoost: { value: settings.nebulaExplosionSizeBoost ?? 8 },
          uBlackHoleCompression: { value: settings.nebulaBlackHoleCompression ?? 0.05 },
          uBlackHoleSpinSpeed: { value: settings.nebulaBlackHoleSpinSpeed ?? 400 },
          uBlackHoleTargetRadius: { value: settings.nebulaBlackHoleTargetRadius ?? 30 },
          uBlackHolePull: { value: settings.nebulaBlackHolePull ?? 0.95 },
          uColor: { value: new THREE.Color(0xffffff) },
          uShape: { value: shapeVal },
          uShapeTexture: { value: getShapeTexture() },
          uSaturation: { value: inst.colorSaturation ?? settings.colorSaturation },
          uTurbulence: { value: inst.particleTurbulence ?? settings.particleTurbulence },
          uTurbulenceSpeed: { value: inst.turbulenceSpeed ?? settings.turbulenceSpeed },
          uTurbulenceScale: { value: inst.turbulenceScale ?? settings.turbulenceScale },
          uGlowMode: { value: glowModeVal },
          uGlowIntensity: { value: settings.glowIntensity },
          uBreathing: { value: (inst.breathingEnabled ?? settings.breathingEnabled) ? (inst.breathingIntensity ?? settings.breathingIntensity) : 0.0 },
          uBreathingSpeed: { value: inst.breathingSpeed ?? settings.breathingSpeed },
          uRipple: { value: (inst.rippleEnabled ?? settings.rippleEnabled) ? (inst.rippleIntensity ?? settings.rippleIntensity) : 0.0 },
          uRippleSpeed: { value: inst.rippleSpeed ?? settings.rippleSpeed },
          uAccretion: { value: (inst.accretionEnabled ?? settings.accretionEnabled) ? (inst.accretionIntensity ?? settings.accretionIntensity) : 0.0 },
          uAccretionSpeed: { value: inst.accretionSpeed ?? settings.accretionSpeed },
          uAccretionRadii: { value: new THREE.Vector3(acc0?.radiusMax ?? 100, acc1?.radiusMax ?? 200, acc2?.radiusMax ?? 400) },
          uAccretionDirs: { value: new THREE.Vector3(acc0?.enabled ? (acc0?.direction ?? 1) : 1, acc1?.enabled ? (acc1?.direction ?? -1) : -1, acc2?.enabled ? (acc2?.direction ?? 1) : 1) },
          uAccretionSpeeds: { value: new THREE.Vector3(acc0?.enabled ? (acc0?.speedMultiplier ?? 2) : 2, acc1?.enabled ? (acc1?.speedMultiplier ?? 1) : 1, acc2?.enabled ? (acc2?.speedMultiplier ?? 0.5) : 0.5) },
          uAccretionLayerCount: { value: accretionLayerCount },
          uWaveEnabled: { value: waveEnabled ? 1.0 : 0.0 },
          uWaveIntensity: { value: waveIntensity },
          uWaveSpeed: { value: waveSpeed },
          uWaveSteepness: { value: waveSteepness },
          uWaveLayers: { value: waveLayers },
          uWaveDirection: { value: (waveDirection * Math.PI) / 180 },
          uWaveDepthFade: { value: waveDepthFade },
          uWaveFoam: { value: waveFoam ? 1.0 : 0.0 },
          uGeometryMapping: { value: instance.geometryMapping === 'sphere' ? 1 : instance.geometryMapping === 'cylinder' ? 2 : 0 },
          uMappingStrength: { value: instance.mappingStrength || 0 },
          uMappingRadius: { value: instance.mappingRadius || 200 },
          uImageSize: { value: new THREE.Vector2(instanceData.canvasWidth || 800, instanceData.canvasHeight || 600) },
          uMappingTileX: { value: instance.mappingTileX || 1 },
          uMappingTileY: { value: instance.mappingTileY || 1 },
          uMappingEdgeFade: { value: instance.mappingEdgeFade ?? 0.1 },
          uFlickerEnabled: { value: (inst.flickerEnabled ?? settings.flickerEnabled) ? 1 : 0 },
          uFlickerIntensity: { value: inst.flickerIntensity ?? settings.flickerIntensity },
          uFlickerSpeed: { value: inst.flickerSpeed ?? settings.flickerSpeed },
          uBrightness: { value: inst.brightness ?? (settings.brightness ?? 1.0) },
          uOpacity: { value: inst.opacity ?? (settings.opacity ?? 1.0) },
          uWanderingLightning: { value: wanderingLightningEnabled ? wanderingLightningIntensity : 0.0 },
          uWanderingLightningSpeed: { value: wanderingLightningSpeed },
          uWanderingLightningDensity: { value: wanderingLightningDensity },
          uWanderingLightningWidth: { value: wanderingLightningWidth },
          uLightningBreakdown: { value: lightningBreakdownEnabled ? lightningBreakdownIntensity : 0.0 },
          uLightningBreakdownFreq: { value: lightningBreakdownFrequency },
          uLightningBranches: { value: lightningBreakdownBranches },
          uOverlayMode: { value: overlayMode ? 1.0 : 0.0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geometry, material);
      points.position.set(instance.position.x, instance.position.y, instance.position.z);
      points.scale.setScalar(instance.scale);

      scene.add(points);
      currentPoints.set(instance.id, points);
      currentMaterials.set(instance.id, material);
    });

    // 监听粒子数据、实例列表、预览模式、粒子形状和场景准备状态变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nebulaInstancesData, settings.nebulaInstances, nebulaPreviewMode, settings.particleShape, sceneReady]);

  // 单独处理星云实例的所有参数更新（确保实时响应）
  // 使用JSON.stringify来确保深层变化也能触发更新
  const nebulaInstancesJson = JSON.stringify(settings.nebulaInstances || []);

  useEffect(() => {
    if (!settings.nebulaInstances) return;
    const currentPoints = nebulaInstancePointsRef.current;
    const currentMaterials = nebulaInstanceMaterialsRef.current;

    // 计算形状值
    const shapeMap: Record<ParticleShape, number> = {
      [ParticleShape.Circle]: 0.0,
      [ParticleShape.Star]: 1.0,
      [ParticleShape.Snowflake]: 2.0,
      [ParticleShape.Heart]: 3.0,
      [ParticleShape.Crescent]: 4.0,
      [ParticleShape.CrossGlow]: 5.0,
      [ParticleShape.Sakura]: 6.0,
      [ParticleShape.Sun]: 7.0,
      [ParticleShape.Sun2]: 8.0,
      [ParticleShape.Plum]: 9.0,
      [ParticleShape.Lily]: 10.0,
      [ParticleShape.Lotus]: 11.0,
      [ParticleShape.Prism]: 12.0,
    };
    const shapeVal = shapeMap[settings.particleShape] || 0.0;

    // 计算光晕模式值
    const glowModeMap: Record<GlowMode, number> = {
      [GlowMode.None]: 0.0,
      [GlowMode.Soft]: 1.0,
      [GlowMode.Sharp]: 2.0,
      [GlowMode.Aura]: 3.0,
    };
    const glowModeVal = glowModeMap[settings.glowMode] ?? 0.0;

    settings.nebulaInstances.forEach(instance => {
      if (!instance.enabled) return;
      const points = currentPoints.get(instance.id);
      const material = currentMaterials.get(instance.id);
      const inst = instance as Partial<NebulaInstance>;

      // 更新位置和缩放
      if (points) {
        points.position.set(instance.position.x, instance.position.y, instance.position.z);
        points.scale.setScalar(instance.scale);
      }

      // 更新材质参数
      if (material) {
        material.uniforms.uSize.value = instance.baseSize * 4.0;
        material.uniforms.uBrightness.value = inst.brightness ?? (settings.brightness ?? 1.0);
        material.uniforms.uOpacity.value = inst.opacity ?? (settings.opacity ?? 1.0);
        material.uniforms.uSaturation.value = inst.colorSaturation ?? settings.colorSaturation;
        material.uniforms.uTurbulence.value = inst.particleTurbulence ?? settings.particleTurbulence;
        material.uniforms.uTurbulenceSpeed.value = inst.turbulenceSpeed ?? settings.turbulenceSpeed;
        material.uniforms.uTurbulenceScale.value = inst.turbulenceScale ?? settings.turbulenceScale;
        // 形状参数
        material.uniforms.uShape.value = shapeVal;
        material.uniforms.uShapeTexture.value = getShapeTexture();
        // 光晕参数
        material.uniforms.uGlowMode.value = glowModeVal;
        material.uniforms.uGlowIntensity.value = settings.glowIntensity;
        // 几何映射参数
        material.uniforms.uGeometryMapping.value = instance.geometryMapping === 'sphere' ? 1 : instance.geometryMapping === 'cylinder' ? 2 : 0;
        material.uniforms.uMappingStrength.value = instance.mappingStrength || 0;
        material.uniforms.uMappingRadius.value = instance.mappingRadius || 200;
        material.uniforms.uMappingTileX.value = instance.mappingTileX || 1;
        material.uniforms.uMappingTileY.value = instance.mappingTileY || 1;
        material.uniforms.uMappingEdgeFade.value = instance.mappingEdgeFade ?? 0.1;
        // 动态效果
        material.uniforms.uBreathing.value = (inst.breathingEnabled ?? settings.breathingEnabled)
          ? (inst.breathingIntensity ?? settings.breathingIntensity)
          : 0.0;
        material.uniforms.uBreathingSpeed.value = inst.breathingSpeed ?? settings.breathingSpeed;
        material.uniforms.uRipple.value = (inst.rippleEnabled ?? settings.rippleEnabled)
          ? (inst.rippleIntensity ?? settings.rippleIntensity)
          : 0.0;
        material.uniforms.uRippleSpeed.value = inst.rippleSpeed ?? settings.rippleSpeed;
        material.uniforms.uAccretion.value = (inst.accretionEnabled ?? settings.accretionEnabled)
          ? (inst.accretionIntensity ?? settings.accretionIntensity)
          : 0.0;
        material.uniforms.uAccretionSpeed.value = inst.accretionSpeed ?? settings.accretionSpeed;
        const accretionLayers = inst.accretionLayers ?? settings.accretionLayers;
        const acc0 = accretionLayers?.[0];
        const acc1 = accretionLayers?.[1];
        const acc2 = accretionLayers?.[2];
        const accretionLayerCount = (accretionLayers || []).filter(l => l.enabled).length;

        if (material.uniforms.uAccretionRadii?.value?.set) {
          material.uniforms.uAccretionRadii.value.set(acc0?.radiusMax ?? 100, acc1?.radiusMax ?? 200, acc2?.radiusMax ?? 400);
        }
        if (material.uniforms.uAccretionDirs?.value?.set) {
          material.uniforms.uAccretionDirs.value.set(
            acc0?.enabled ? (acc0?.direction ?? 1) : 1,
            acc1?.enabled ? (acc1?.direction ?? -1) : -1,
            acc2?.enabled ? (acc2?.direction ?? 1) : 1
          );
        }
        if (material.uniforms.uAccretionSpeeds?.value?.set) {
          material.uniforms.uAccretionSpeeds.value.set(
            acc0?.enabled ? (acc0?.speedMultiplier ?? 2) : 2,
            acc1?.enabled ? (acc1?.speedMultiplier ?? 1) : 1,
            acc2?.enabled ? (acc2?.speedMultiplier ?? 0.5) : 0.5
          );
        }
        if (material.uniforms.uAccretionLayerCount) {
          material.uniforms.uAccretionLayerCount.value = accretionLayerCount;
        }
        material.uniforms.uFlickerEnabled.value = (inst.flickerEnabled ?? settings.flickerEnabled) ? 1 : 0;
        material.uniforms.uFlickerIntensity.value = inst.flickerIntensity ?? settings.flickerIntensity;
        material.uniforms.uFlickerSpeed.value = inst.flickerSpeed ?? settings.flickerSpeed;

        const waveEnabled = inst.waveEnabled ?? settings.waveEnabled;
        const waveIntensity = inst.waveIntensity ?? settings.waveIntensity;
        const waveSpeed = inst.waveSpeed ?? settings.waveSpeed;
        const waveSteepness = inst.waveSteepness ?? settings.waveSteepness;
        const waveLayers = inst.waveLayers ?? settings.waveLayers;
        const waveDirection = inst.waveDirection ?? settings.waveDirection;
        const waveDepthFade = inst.waveDepthFade ?? settings.waveDepthFade;
        const waveFoam = inst.waveFoam ?? settings.waveFoam;

        material.uniforms.uWaveEnabled.value = waveEnabled ? 1.0 : 0.0;
        material.uniforms.uWaveIntensity.value = waveIntensity;
        material.uniforms.uWaveSpeed.value = waveSpeed;
        material.uniforms.uWaveSteepness.value = waveSteepness;
        material.uniforms.uWaveLayers.value = waveLayers;
        material.uniforms.uWaveDirection.value = (waveDirection * Math.PI) / 180;
        material.uniforms.uWaveDepthFade.value = waveDepthFade;
        material.uniforms.uWaveFoam.value = waveFoam ? 1.0 : 0.0;

        const wanderingLightningEnabled = inst.wanderingLightningEnabled ?? settings.wanderingLightningEnabled;
        const wanderingLightningIntensity = inst.wanderingLightningIntensity ?? settings.wanderingLightningIntensity;
        const wanderingLightningSpeed = inst.wanderingLightningSpeed ?? settings.wanderingLightningSpeed;
        const wanderingLightningDensity = inst.wanderingLightningDensity ?? settings.wanderingLightningDensity;
        const wanderingLightningWidth = inst.wanderingLightningWidth ?? settings.wanderingLightningWidth;

        material.uniforms.uWanderingLightning.value = wanderingLightningEnabled ? wanderingLightningIntensity : 0.0;
        material.uniforms.uWanderingLightningSpeed.value = wanderingLightningSpeed;
        material.uniforms.uWanderingLightningDensity.value = wanderingLightningDensity;
        material.uniforms.uWanderingLightningWidth.value = wanderingLightningWidth;

        const lightningBreakdownEnabled = inst.lightningBreakdownEnabled ?? settings.lightningBreakdownEnabled;
        const lightningBreakdownIntensity = inst.lightningBreakdownIntensity ?? settings.lightningBreakdownIntensity;
        const lightningBreakdownFrequency = inst.lightningBreakdownFrequency ?? settings.lightningBreakdownFrequency;
        const lightningBreakdownBranches = inst.lightningBreakdownBranches ?? settings.lightningBreakdownBranches;

        material.uniforms.uLightningBreakdown.value = lightningBreakdownEnabled ? lightningBreakdownIntensity : 0.0;
        material.uniforms.uLightningBreakdownFreq.value = lightningBreakdownFrequency;
        material.uniforms.uLightningBranches.value = lightningBreakdownBranches;
      }
    });
  }, [nebulaInstancesJson, settings.nebulaInstances, settings.particleShape, settings.glowMode, settings.glowIntensity,
    settings.waveEnabled, settings.waveIntensity, settings.waveSpeed, settings.waveSteepness, settings.waveLayers, settings.waveDirection, settings.waveDepthFade, settings.waveFoam,
    settings.wanderingLightningEnabled, settings.wanderingLightningIntensity, settings.wanderingLightningSpeed, settings.wanderingLightningDensity, settings.wanderingLightningWidth,
    settings.lightningBreakdownEnabled, settings.lightningBreakdownIntensity, settings.lightningBreakdownFrequency, settings.lightningBreakdownBranches]);

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
        [ParticleShape.Star]: 1.0,
        [ParticleShape.Snowflake]: 2.0,
        [ParticleShape.Heart]: 3.0,
        [ParticleShape.Crescent]: 4.0,
        [ParticleShape.CrossGlow]: 5.0,
        [ParticleShape.Sakura]: 6.0,
        [ParticleShape.Sun]: 7.0,
        [ParticleShape.Sun2]: 8.0,
        [ParticleShape.Plum]: 9.0,
        [ParticleShape.Lily]: 10.0,
        [ParticleShape.Lotus]: 11.0,
        [ParticleShape.Prism]: 12.0,
      };
      const shapeValue = shapeMap[settings.particleShape] ?? 0.0;
      materialRef.current.uniforms.uShape.value = shapeValue;
      materialRef.current.uniforms.uShapeTexture.value = getShapeTexture();

      // 更新光晕
      const glowModeMap: Record<GlowMode, number> = {
        [GlowMode.None]: 0.0,
        [GlowMode.Soft]: 1.0,
        [GlowMode.Sharp]: 2.0,
        [GlowMode.Aura]: 3.0,
      };
      materialRef.current.uniforms.uGlowMode.value = glowModeMap[settings.glowMode] ?? 0.0;
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
      materialRef.current.uniforms.uBrightness.value = settings.brightness ?? 1.0;
      materialRef.current.uniforms.uOpacity.value = settings.opacity ?? 1.0;

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
      materialRef.current.uniforms.uMappingEdgeFade.value = settings.mappingEdgeFade ?? 0.1;

      // 更新闪电效果
      materialRef.current.uniforms.uWanderingLightning.value = settings.wanderingLightningEnabled ? settings.wanderingLightningIntensity : 0.0;
      materialRef.current.uniforms.uWanderingLightningSpeed.value = settings.wanderingLightningSpeed;
      materialRef.current.uniforms.uWanderingLightningDensity.value = settings.wanderingLightningDensity;
      materialRef.current.uniforms.uWanderingLightningWidth.value = settings.wanderingLightningWidth;
      materialRef.current.uniforms.uLightningBreakdown.value = settings.lightningBreakdownEnabled ? settings.lightningBreakdownIntensity : 0.0;
      materialRef.current.uniforms.uLightningBreakdownFreq.value = settings.lightningBreakdownFrequency;
      materialRef.current.uniforms.uLightningBranches.value = settings.lightningBreakdownBranches;

      // 更新爆炸效果参数
      materialRef.current.uniforms.uExplosionExpansion.value = settings.nebulaExplosionExpansion ?? 300;
      materialRef.current.uniforms.uExplosionTurbulence.value = settings.nebulaExplosionTurbulence ?? 80;
      materialRef.current.uniforms.uExplosionRotation.value = settings.nebulaExplosionRotation ?? 0.4;
      materialRef.current.uniforms.uExplosionSizeBoost.value = settings.nebulaExplosionSizeBoost ?? 8;

      // 更新黑洞效果参数
      materialRef.current.uniforms.uBlackHoleCompression.value = settings.nebulaBlackHoleCompression ?? 0.05;
      materialRef.current.uniforms.uBlackHoleSpinSpeed.value = settings.nebulaBlackHoleSpinSpeed ?? 400;
      materialRef.current.uniforms.uBlackHoleTargetRadius.value = settings.nebulaBlackHoleTargetRadius ?? 30;
      materialRef.current.uniforms.uBlackHolePull.value = settings.nebulaBlackHolePull ?? 0.95;
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
      // damp 值：0 = 无残影，0.98 = 长拖尾
      if (settings.trailEnabled) {
        // trailLength 0-1 映射到 damp 0.9-0.98（更明显的拖尾效果）
        afterimagePassRef.current.uniforms['damp'].value = 0.9 + settings.trailLength * 0.08;
      } else {
        afterimagePassRef.current.uniforms['damp'].value = 0;
      }
    }

    if (controlsRef.current) {
      controlsRef.current.autoRotate = settings.autoRotate;
      controlsRef.current.autoRotateSpeed = settings.autoRotateSpeed;
    }
  }, [settings]);

  // 侧边栏展开时调整相机目标点，使场景内容在左侧可见区域居中
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current || !containerRef.current) return;

    const controls = controlsRef.current;
    const container = containerRef.current;

    // 控制面板宽度为320px，计算偏移量
    // 当侧边栏展开时，将相机目标点向左偏移，使内容在左侧区域居中
    const sidebarWidth = 320;

    // 计算需要偏移的世界坐标距离
    // 根据相机距离和FOV计算屏幕像素对应的世界单位
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
        uAccretionRadii: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.radiusMax || 100,
            settings.accretionLayers[1]?.radiusMax || 200,
            settings.accretionLayers[2]?.radiusMax || 400
          )
        },
        uAccretionDirs: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.direction || 1) : 1,
            settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.direction || -1) : -1,
            settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.direction || 1) : 1
          )
        },
        uAccretionSpeeds: {
          value: new THREE.Vector3(
            settings.accretionLayers[0]?.enabled ? (settings.accretionLayers[0]?.speedMultiplier || 2) : 2,
            settings.accretionLayers[1]?.enabled ? (settings.accretionLayers[1]?.speedMultiplier || 1) : 1,
            settings.accretionLayers[2]?.enabled ? (settings.accretionLayers[2]?.speedMultiplier || 0.5) : 0.5
          )
        },
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

  return <div ref={containerRef} className="w-full h-full relative" style={{ backgroundColor: overlayMode ? 'transparent' : 'var(--bg)' }} />;
};

export default NebulaScene;
