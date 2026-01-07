/**
 * input: customMagicCircles data, drawing mode state from App.tsx, particle/silk brush pressureMode
 * output: 3D drawing canvas with orthographic camera, particle/silk ring stroke rendering (particle stroke uses arc-length density + pressure mapping)
 * pos: Drawing system utilities for PlanetScene integration
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import * as THREE from 'three';
import {
    CustomMagicCircle,
    MagicCircleLayer,
    MagicCircleStroke,
    StrokePoint,
    DrawingBrushType,
    SymmetryMode,
    ParticleRingSettings,
    SilkRingSettings
} from '../types';

// ==================== 常量 ====================

const CANVAS_SIZE = 1; // 归一化画布尺寸 (-0.5 to 0.5)
const DEFAULT_SYMMETRY_DIVISIONS = 8;
const DEFAULT_COLOR = '#ffaa00';

// ==================== 绘图系统状态接口 ====================

export interface DrawingSystemState {
    isDrawing: boolean;
    currentStrokePoints: StrokePoint[];
    currentLayerId: string | null;
    currentBrushType: DrawingBrushType;
    currentColor: string;
    symmetryMode: SymmetryMode;
    symmetryDivisions: number;
    undoStack: MagicCircleStroke[];
    redoStack: MagicCircleStroke[];
}

// ==================== 绘图系统引用 ====================

export interface DrawingSystemRefs {
    camera: THREE.PerspectiveCamera | null;
    scene: THREE.Scene | null;
    canvasGroup: THREE.Group | null;
    strokesGroup: THREE.Group | null;
    symmetryAxesGroup: THREE.Group | null;
    centerPoint: THREE.Mesh | null;
    border: THREE.LineLoop | null;
    currentStrokeMesh: THREE.Object3D | null;  // Points, Group, or Line
}

// ==================== 初始化绘图场景 ====================

export function createDrawingScene(): {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    canvasGroup: THREE.Group;
    strokesGroup: THREE.Group;
    symmetryAxesGroup: THREE.Group;
    centerPoint: THREE.Mesh;
    border: THREE.LineLoop;
} {
    // 创建独立场景
    const scene = new THREE.Scene();
    scene.background = null; // 透明背景

    // 创建透视相机
    // 计算相机距离：使画布区域（宽度1）正好填满视口
    // tan(fov/2) = (canvasSize/2) / distance => distance = 0.5 / tan(37.5°) ≈ 0.65
    const fov = 75;
    const aspect = 1; // 正方形画布
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    const distance = 0.5 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    // 画布主 Group
    const canvasGroup = new THREE.Group();
    scene.add(canvasGroup);

    // 笔画 Group
    const strokesGroup = new THREE.Group();
    canvasGroup.add(strokesGroup);

    // 对称轴 Group
    const symmetryAxesGroup = new THREE.Group();
    canvasGroup.add(symmetryAxesGroup);

    // 中心点
    const centerGeometry = new THREE.CircleGeometry(0.015, 32);
    const centerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
        depthTest: false
    });
    const centerPoint = new THREE.Mesh(centerGeometry, centerMaterial);
    centerPoint.position.set(0, 0, 0.001);
    centerPoint.renderOrder = 100;
    canvasGroup.add(centerPoint);

    // 画布边框
    const borderPoints = [
        new THREE.Vector3(-0.5, -0.5, 0),
        new THREE.Vector3(0.5, -0.5, 0),
        new THREE.Vector3(0.5, 0.5, 0),
        new THREE.Vector3(-0.5, 0.5, 0)
    ];
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMaterial = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.5,
        depthTest: false
    });
    const border = new THREE.LineLoop(borderGeometry, borderMaterial);
    border.renderOrder = 99;
    canvasGroup.add(border);

    return {
        scene,
        camera,
        canvasGroup,
        strokesGroup,
        symmetryAxesGroup,
        centerPoint,
        border
    };
}

// ==================== 创建对称轴虚线 ====================

export function createSymmetryAxes(divisions: number, mode: SymmetryMode): THREE.Group {
    const group = new THREE.Group();

    if (mode === 'none' || divisions < 2) {
        return group;
    }

    const lineMaterial = new THREE.LineDashedMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        dashSize: 0.02,
        gapSize: 0.015,
        depthTest: false
    });

    for (let i = 0; i < divisions; i++) {
        const angle = (Math.PI * 2 / divisions) * i;
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial.clone());
        line.computeLineDistances(); // 虚线必需
        line.renderOrder = 98;
        group.add(line);
    }

    return group;
}

// ==================== 更新对称轴 ====================

export function updateSymmetryAxes(
    axesGroup: THREE.Group,
    divisions: number,
    mode: SymmetryMode
): void {
    // 清除旧的
    while (axesGroup.children.length > 0) {
        const child = axesGroup.children[0];
        axesGroup.remove(child);
        if (child instanceof THREE.Line) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
                child.material.dispose();
            }
        }
    }

    // 创建新的
    const newAxes = createSymmetryAxes(divisions, mode);
    newAxes.children.forEach(child => {
        axesGroup.add(child.clone());
    });
}

// ==================== 应用对称变换 ====================

export function applySymmetryTransform(
    point: { x: number; y: number },
    mode: SymmetryMode,
    divisions: number
): { x: number; y: number }[] {
    if (mode === 'none') {
        return [point];
    }

    const results: { x: number; y: number }[] = [];
    const angleStep = (Math.PI * 2) / divisions;

    // 转换为相对中心的坐标 (画布中心是 0,0，点坐标已是 -0.5 到 0.5)
    const dx = point.x;
    const dy = point.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const baseAngle = Math.atan2(dy, dx);

    for (let i = 0; i < divisions; i++) {
        const angle = baseAngle + angleStep * i;
        results.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });

        // 万花筒模式：每份内部镜像
        if (mode === 'kaleidoscope') {
            const mirroredAngle = angleStep * (i + 0.5) * 2 - angle;
            results.push({
                x: radius * Math.cos(mirroredAngle),
                y: radius * Math.sin(mirroredAngle)
            });
        }
    }

    return results;
}

// ==================== 屏幕坐标转画布坐标 ====================

export function screenToCanvas(
    screenX: number,
    screenY: number,
    canvasRect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
    // 归一化到 0-1
    const normalizedX = (screenX - canvasRect.left) / canvasRect.width;
    const normalizedY = (screenY - canvasRect.top) / canvasRect.height;

    // 转换到 -0.5 到 0.5 (画布坐标系)
    return {
        x: normalizedX - 0.5,
        y: 0.5 - normalizedY // Y 轴翻转
    };
}

// ==================== 创建粒子画笔笔画 (复用粒子环着色器) ====================

export function createParticleStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: Partial<ParticleRingSettings>,
    symmetryMode: SymmetryMode,
    symmetryDivisions: number,
    magicCircleSettings?: {
        opacity?: number;
        hueShift?: number;
        brightness?: number;
        pulseEnabled?: boolean;
        pulseSpeed?: number;
        pulseIntensity?: number;
        // 染色功能参数
        baseHue?: number;
        baseSaturation?: number;
        saturationBoost?: number;
        colorMode?: number;  // 0=none, 4=single, 1=twoColor, 2=threeColor, 3=procedural
        color1?: THREE.Vector3;
        color2?: THREE.Vector3;
        color3?: THREE.Vector3;
        colorMidPos?: number;
        proceduralIntensity?: number;
        // 粒子大小缩放因子
        particleSizeScale?: number;
    }
): THREE.Points {
    // 沿路径均匀插值生成粒子（参考粒子环实现）
    const particlePositions: number[] = [];
    const particleSizes: number[] = [];
    const particleColors: number[] = [];
    const particleAlphas: number[] = [];
    const particleRadialDists: number[] = [];

    // 从设置中获取参数
    const particleSize = settings.particleSize ?? 2;
    const particleDensity = settings.particleDensity ?? 30;
    const strokeThickness = settings.bandwidth ?? 15;
    const spatialThickness = settings.spatialThickness ?? false;
    const zThickness = settings.zThickness ?? strokeThickness;
    const pressureMode = settings.pressureMode ?? 'calligraphy';
    const colorObj = new THREE.Color(color);

    // Step 1: 计算路径累积长度数组
    const segmentLengths: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
        segmentLengths.push(totalLength);
    }

    if (totalLength < 0.001) {
        // 路径太短，直接返回空几何体
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
        geometry.setAttribute('alpha', new THREE.Float32BufferAttribute([], 1));
        geometry.setAttribute('aRadialDist', new THREE.Float32BufferAttribute([], 1));
        return new THREE.Points(geometry);
    }

    // Step 2: 计算粒子总数 = 密度 × 路径长度
    const canvasDensityScale = 25;
    const symmetryCopies = symmetryMode === 'none' ? 1 : (symmetryMode === 'kaleidoscope' ? symmetryDivisions * 2 : symmetryDivisions);
    const maxTotalParticles = 60000;
    const maxSpawnPerSample = pressureMode === 'brightness' ? 3 : 2;
    const maxParticlesPerBaseSample = Math.max(1, Math.floor(maxTotalParticles / Math.max(1, symmetryCopies * maxSpawnPerSample)));

    const particleCountTarget = Math.max(1, Math.floor(particleDensity * totalLength * canvasDensityScale));
    const particleCount = Math.max(1, Math.min(particleCountTarget, maxParticlesPerBaseSample));

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const pressureCurve = (p: number) => {
        const x = clamp01(p);
        return pressureMode === 'brightness' ? Math.sqrt(x) : x * x;
    };

    // Step 3: 沿路径均匀插值生成粒子位置
    for (let i = 0; i < particleCount; i++) {
        const targetDist = ((i + Math.random()) / particleCount) * totalLength;

        // 二分查找找到目标距离所在的线段
        let segIndex = 0;
        for (let j = 1; j < segmentLengths.length; j++) {
            if (segmentLengths[j] >= targetDist) {
                segIndex = j - 1;
                break;
            }
            segIndex = j - 1;
        }

        // 在线段内插值
        const segStart = segmentLengths[segIndex];
        const segEnd = segmentLengths[segIndex + 1] || totalLength;
        const segLen = segEnd - segStart;
        const t = segLen > 0.0001 ? (targetDist - segStart) / segLen : 0;

        const p0 = points[segIndex];
        const p1 = points[Math.min(segIndex + 1, points.length - 1)];

        // 插值位置
        const baseX = p0.x + (p1.x - p0.x) * t;
        const baseY = p0.y + (p1.y - p0.y) * t;
        const pressure = p0.pressure + (p1.pressure - p0.pressure) * t;
        const pe = pressureCurve(pressure);

        // 转换到画布坐标系并应用对称变换
        const symmetricPoints = applySymmetryTransform(
            { x: baseX - 0.5, y: 0.5 - baseY },
            symmetryMode,
            symmetryDivisions
        );

        for (const sp of symmetricPoints) {
            const jitterBase = strokeThickness * 0.002;
            const jitterScale = pressureMode === 'brightness'
                ? (0.35 + 0.15 * pe)
                : (0.25 + 0.95 * pe);

            const spawnExtraMax = pressureMode === 'brightness' ? 2 : 1;
            const spawnCount = 1 + Math.floor(pe * spawnExtraMax);

            for (let s = 0; s < spawnCount; s++) {
                if (particleSizes.length >= maxTotalParticles) break;

                const jitter = jitterBase * jitterScale;
                const jx = (Math.random() - 0.5) * jitter;
                const jy = (Math.random() - 0.5) * jitter;
                const jz = spatialThickness ? (Math.random() - 0.5) * zThickness * 0.002 : 0;

                const px = sp.x + jx;
                const py = sp.y + jy;
                particlePositions.push(px, py, jz);

                // 径向距离用于渐变
                const radialDist = Math.sqrt(px * px + py * py) * 2;
                particleRadialDists.push(Math.min(1, radialDist));

                // 粒子大小 = 基础大小 × 压感 × 随机变化
                const sizeVariation = 0.7 + Math.random() * 0.6;
                const sizePressureScale = pressureMode === 'brightness'
                    ? (0.85 + 0.45 * pe)
                    : (0.55 + 0.95 * pe);
                particleSizes.push(particleSize * sizePressureScale * sizeVariation * 0.05);

                const colorMult = pressureMode === 'brightness' ? (0.7 + 1.2 * pe) : (0.95 + 0.25 * pe);
                particleColors.push(colorObj.r * colorMult, colorObj.g * colorMult, colorObj.b * colorMult);

                const alphaPressure = pressureMode === 'brightness'
                    ? (0.2 + 0.8 * pe)
                    : (0.55 + 0.45 * pe);
                particleAlphas.push(alphaPressure * (0.75 + Math.random() * 0.25));
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(particleSizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(particleColors, 3));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(particleAlphas, 1));
    geometry.setAttribute('aRadialDist', new THREE.Float32BufferAttribute(particleRadialDists, 1));

    // 粒子着色器 - 匹配 PlanetScene 粒子环效果
    const mcSettings = magicCircleSettings || {};
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uGlowIntensity: { value: settings.brightness ?? 2.0 },
            uEmissive: { value: 1.5 },
            uCoreBrightness: { value: 2.0 },
            uPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
            uPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
            uPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 },
            // 法阵级别参数
            uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
            uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
            uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
            // 染色功能参数
            uBaseHue: { value: mcSettings.baseHue ?? 200 },
            uBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
            uSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
            uColorMode: { value: mcSettings.colorMode ?? 0 },
            uColor1: { value: mcSettings.color1 ?? new THREE.Vector3(1, 1, 1) },
            uColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
            uColor3: { value: mcSettings.color3 ?? new THREE.Vector3(1, 1, 1) },
            uColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
            uProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 },
            // 粒子大小缩放因子（画布0.002，场景1.5）
            uParticleSizeScale: { value: mcSettings.particleSizeScale ?? 1.0 }
        },
        vertexShader: `
precision highp float;

attribute float size;
attribute float alpha;
attribute vec3 color;
attribute float aRadialDist;

varying vec3 vColor;
varying float vAlpha;
varying float vSize;
varying float vRadialDist;

uniform float uTime;
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;
uniform float uParticleSizeScale;

void main() {
  vColor = color;
  vAlpha = alpha;
  vSize = size;
  vRadialDist = aRadialDist;
  
  // 脉冲效果
  float pulse = 1.0;
  if (uPulseEnabled > 0.5) {
    pulse = 1.0 + sin(uTime * uPulseSpeed + position.x * 10.0 + position.y * 10.0) * uPulseIntensity;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * pulse * uParticleSizeScale * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
        `,
        fragmentShader: `
precision highp float;

uniform float uGlowIntensity;
uniform float uEmissive;
uniform float uCoreBrightness;
uniform float uTime;
uniform float uMCOpacity;
uniform float uMCHueShift;
uniform float uMCBrightness;
// 染色功能uniforms
uniform float uBaseHue;
uniform float uBaseSaturation;
uniform float uSaturationBoost;
uniform float uColorMode;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uColorMidPos;
uniform float uProceduralIntensity;

varying vec3 vColor;
varying float vAlpha;
varying float vRadialDist;

// HSL转RGB
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
    float hk = h;
    vec3 t = vec3(hk + 1.0/3.0, hk, hk - 1.0/3.0);
    t = fract(t);
    for (int i = 0; i < 3; i++) {
      float tc = t[i];
      if (tc < 1.0/6.0) rgb[i] = p + (q - p) * 6.0 * tc;
      else if (tc < 0.5) rgb[i] = q;
      else if (tc < 2.0/3.0) rgb[i] = p + (q - p) * (2.0/3.0 - tc) * 6.0;
      else rgb[i] = p;
    }
  }
  return rgb;
}

// RGB转HSL
vec3 rgb2hsl(vec3 rgb) {
  float maxC = max(max(rgb.r, rgb.g), rgb.b);
  float minC = min(min(rgb.r, rgb.g), rgb.b);
  float l = (maxC + minC) / 2.0;
  float h = 0.0;
  float s = 0.0;
  if (maxC != minC) {
    float d = maxC - minC;
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    if (maxC == rgb.r) h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0);
    else if (maxC == rgb.g) h = (rgb.b - rgb.r) / d + 2.0;
    else h = (rgb.r - rgb.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

// 获取染色后的颜色
vec3 getDyeColor(vec3 baseColor, float t) {
  int mode = int(uColorMode);
  if (mode == 0) {
    // none - 使用原始笔画颜色
    return baseColor;
  } else if (mode == 4) {
    // single - 单色模式：使用baseHue和baseSaturation
    vec3 hsl = rgb2hsl(baseColor);
    hsl.x = uBaseHue / 360.0;
    hsl.y = uBaseSaturation;
    return hsl2rgb(hsl);
  } else if (mode == 1) {
    // twoColor - 双色渐变
    return mix(uColor1, uColor2, t);
  } else if (mode == 2) {
    // threeColor - 三色渐变
    if (t < uColorMidPos) {
      return mix(uColor1, uColor2, t / uColorMidPos);
    } else {
      return mix(uColor2, uColor3, (t - uColorMidPos) / (1.0 - uColorMidPos));
    }
  } else if (mode == 3) {
    // procedural - 混色
    float noise = sin(t * uProceduralIntensity * 10.0 + uTime) * 0.5 + 0.5;
    vec3 c1 = mix(uColor1, uColor2, t);
    vec3 c2 = mix(uColor2, uColor3, t);
    return mix(c1, c2, noise);
  }
  return baseColor;
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;
  
  // 核心亮度 (中心更亮)
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  
  // 光晕衰减 (软边缘)
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  glow = pow(glow, 1.0 / uGlowIntensity);
  
  // 外层光晕 (更柔和的边缘)
  float outerGlow = 1.0 - smoothstep(0.3, 0.5, dist);
  outerGlow = pow(outerGlow, 0.5);
  
  // 合成亮度
  float brightness = core * uCoreBrightness + glow * uEmissive + outerGlow * 0.5;
  
  // 应用染色功能
  vec3 dyedColor = getDyeColor(vColor, vRadialDist);
  
  // 应用饱和度增强
  vec3 hsl = rgb2hsl(dyedColor);
  hsl.y = clamp(hsl.y * uSaturationBoost, 0.0, 1.0);
  dyedColor = hsl2rgb(hsl);
  
  // 最终颜色 - 应用发光
  vec3 finalColor = dyedColor * brightness;
  
  // 应用法阵级别色相偏移
  if (uMCHueShift > 0.001 || uMCHueShift < -0.001) {
    vec3 hslFinal = rgb2hsl(finalColor);
    hslFinal.x = fract(hslFinal.x + uMCHueShift);
    finalColor = hsl2rgb(hslFinal);
  }
  
  // 应用法阵级别亮度
  finalColor *= uMCBrightness;
  
  // Alpha - 应用法阵级别透明度
  float alpha = glow * vAlpha * uMCOpacity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Points(geometry, material);
    mesh.renderOrder = 50;
    return mesh;
}

// ==================== 丝环着色器 (复制自 PlanetScene.tsx) ====================

const silkRingVertexShader = `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const silkRingFragmentShader = `
precision highp float;

uniform float uTime;
uniform float uFlowSpeed;
uniform float uStrandDensity;
uniform float uSparkleEnabled;
uniform float uSparkleThreshold;
uniform float uFresnelPower;
uniform float uOpacity;
uniform float uEmissive;
uniform float uBloomBoost;

uniform float uColorMode;
uniform vec3 uBaseColor;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uColorMidPos;
uniform float uProceduralIntensity;

// 法阵级别参数
uniform float uMCOpacity;
uniform float uMCHueShift;
uniform float uMCBrightness;
uniform float uMCPulseEnabled;
uniform float uMCPulseSpeed;
uniform float uMCPulseIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

vec3 getColor(float t) {
  int mode = int(uColorMode);
  if (mode == 0) {
    return uBaseColor;
  } else if (mode == 1) {
    return mix(uColor1, uColor2, t);
  } else if (mode == 2) {
    if (t < uColorMidPos) {
      return mix(uColor1, uColor2, t / uColorMidPos);
    } else {
      return mix(uColor2, uColor3, (t - uColorMidPos) / (1.0 - uColorMidPos));
    }
  } else {
    float noise = sin(t * uProceduralIntensity * 10.0 + uTime) * 0.5 + 0.5;
    vec3 c1 = mix(uColor1, uColor2, t);
    vec3 c2 = mix(uColor2, uColor3, t);
    return mix(c1, c2, noise);
  }
}

void main() {
  float xRepeat = 20.0;
  float flowOffset = uTime * uFlowSpeed * 2.0;
  float x = vUv.x * xRepeat + flowOffset;
  float y = vUv.y;

  // 1. 丝线纹理
  float strands = sin(y * uStrandDensity + x * 0.5) * 0.5 + 0.5;
  strands = pow(strands, 4.0);

  // 2. 能量脉冲
  float energy = sin(x) * 0.5 + 0.5;
  energy *= sin(x * 0.3 + 2.0) * 0.5 + 0.5;

  // 3. 闪点效果
  float sparkle = 0.0;
  if (uSparkleEnabled > 0.5) {
    sparkle = step(uSparkleThreshold, fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233))) * 43758.5453));
  }

  float brightness = strands * (energy * 1.5 + sparkle);

  // 4. 菲涅尔边缘
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), uFresnelPower);
  brightness *= fresnel;

  float colorT = fract(vUv.x + sin(uTime * 0.5) * 0.1);
  vec3 baseColor = getColor(colorT);
  
  vec3 finalColor = baseColor * (1.0 + brightness * uEmissive);
  finalColor *= (1.0 + uBloomBoost * brightness * 0.5);
  
  // 应用法阵级别脉冲
  if (uMCPulseEnabled > 0.5) {
    float pulse = 1.0 + sin(uTime * uMCPulseSpeed) * uMCPulseIntensity;
    finalColor *= pulse;
  }
  
  // 应用法阵级别色相偏移 (简化处理)
  if (uMCHueShift > 0.001 || uMCHueShift < -0.001) {
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    vec3 shifted = vec3(
      finalColor.r * cos(uMCHueShift * 6.283) - finalColor.g * sin(uMCHueShift * 6.283),
      finalColor.r * sin(uMCHueShift * 6.283) + finalColor.g * cos(uMCHueShift * 6.283),
      finalColor.b
    );
    finalColor = mix(finalColor, shifted, 0.7);
  }
  
  // 应用法阵级别亮度
  finalColor *= uMCBrightness;
  
  // 应用法阵级别透明度
  float alpha = brightness * uOpacity * uMCOpacity;
  alpha = smoothstep(0.05, 0.8, alpha);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== 创建线环画笔笔画 (复用丝环着色器) ====================

export function createLineStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: Partial<SilkRingSettings>,
    symmetryMode: SymmetryMode,
    symmetryDivisions: number,
    magicCircleSettings?: {
        opacity?: number;
        hueShift?: number;
        brightness?: number;
        pulseEnabled?: boolean;
        pulseSpeed?: number;
        pulseIntensity?: number;
        // 染色功能参数
        baseHue?: number;
        baseSaturation?: number;
        saturationBoost?: number;
        colorMode?: number;
        color1?: THREE.Vector3;
        color2?: THREE.Vector3;
        color3?: THREE.Vector3;
        colorMidPos?: number;
        proceduralIntensity?: number;
    }
): THREE.Group {
    const group = new THREE.Group();

    if (points.length < 2) return group;

    const colorObj = new THREE.Color(color);
    const pressureMode = settings.pressureMode ?? 'none';
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const pressureCurve = (p: number) => {
        const x = clamp01(p);
        return pressureMode === 'brightness' ? Math.sqrt(x) : x * x;
    };

    const baseLineWidth = (settings.thickness || 0.02) * 0.3;
    const mcSettings = magicCircleSettings || {};

    // 为每个对称副本创建线条
    type PathPoint = { x: number; y: number; pressure: number };
    const allPaths: PathPoint[][] = [];

    // 生成路径点
    const basePath: PathPoint[] = points.map(p => ({
        x: p.x - 0.5,
        y: 0.5 - p.y,
        pressure: clamp01(p.pressure ?? 0.5)
    }));

    if (symmetryMode === 'none') {
        allPaths.push(basePath.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })));
    } else {
        // 对整条路径应用对称
        for (let i = 0; i < symmetryDivisions; i++) {
            const angle = (Math.PI * 2 / symmetryDivisions) * i;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const transformedPath: PathPoint[] = basePath.map(p => {
                const x = p.x * cos - p.y * sin;
                const y = p.x * sin + p.y * cos;
                return { x, y, pressure: p.pressure };
            });
            allPaths.push(transformedPath);

            // 万花筒镜像
            if (symmetryMode === 'kaleidoscope') {
                const mirroredPath = transformedPath.map(v => ({ x: -v.x, y: v.y, pressure: v.pressure }));
                allPaths.push(mirroredPath);
            }
        }
    }

    // 为每条路径创建线条 - 使用真正的丝环着色器
    for (const path of allPaths) {
        if (path.length < 2) continue;

        if (pressureMode === 'none') {
            const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p.x, p.y, 0)));
            const tubeGeometry = new THREE.TubeGeometry(curve, Math.max(16, path.length * 3), baseLineWidth, 8, false);

            const material = new THREE.ShaderMaterial({
                vertexShader: silkRingVertexShader,
                fragmentShader: silkRingFragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    uFlowSpeed: { value: settings.flowSpeed ?? 1.0 },
                    uStrandDensity: { value: settings.strandDensity ?? 30.0 },
                    uSparkleEnabled: { value: settings.sparkleEnabled ? 1.0 : 0.0 },
                    uSparkleThreshold: { value: settings.sparkleThreshold ?? 0.95 },
                    uFresnelPower: { value: settings.fresnelPower ?? 2.0 },
                    uOpacity: { value: settings.opacity ?? 0.85 },
                    uEmissive: { value: settings.emissive ?? 1.5 },
                    uBloomBoost: { value: 0.3 },
                    // 染色模式 - 使用法阵级别参数
                    uColorMode: { value: mcSettings.colorMode ?? 0 },
                    uBaseColor: { value: new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColor1: { value: mcSettings.color1 ?? new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
                    uColor3: { value: mcSettings.color3 ?? new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
                    uProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 },
                    // 染色功能参数
                    uBaseHue: { value: mcSettings.baseHue ?? 200 },
                    uBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
                    uSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
                    // 法阵级别参数
                    uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
                    uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
                    uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
                    uMCPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
                    uMCPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
                    uMCPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 }
                },
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(tubeGeometry, material);
            mesh.renderOrder = 51;
            group.add(mesh);
            continue;
        }

        const cumulative: number[] = [0];
        let totalLen = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
            cumulative.push(totalLen);
        }
        if (totalLen < 0.0005) continue;

        const maxSegmentsTotal = 240;
        const maxSegmentsPerPath = Math.max(1, Math.floor(maxSegmentsTotal / Math.max(1, allPaths.length)));
        const targetSpacing = 0.02;
        const segCountByLen = Math.max(1, Math.floor(totalLen / targetSpacing));
        const segCount = Math.min(maxSegmentsPerPath, segCountByLen);

        const sampleAt = (dist: number): PathPoint => {
            const d = Math.max(0, Math.min(totalLen, dist));
            let segIndex = 0;
            for (let i = 1; i < cumulative.length; i++) {
                if (cumulative[i] >= d) {
                    segIndex = i - 1;
                    break;
                }
                segIndex = i - 1;
            }
            const d0 = cumulative[segIndex];
            const d1 = cumulative[segIndex + 1] ?? totalLen;
            const segLen = Math.max(1e-6, d1 - d0);
            const t = (d - d0) / segLen;
            const p0 = path[segIndex];
            const p1 = path[Math.min(segIndex + 1, path.length - 1)];
            return {
                x: p0.x + (p1.x - p0.x) * t,
                y: p0.y + (p1.y - p0.y) * t,
                pressure: p0.pressure + (p1.pressure - p0.pressure) * t
            };
        };

        const baseOpacity = settings.opacity ?? 0.85;
        const baseEmissive = settings.emissive ?? 1.5;

        for (let i = 0; i < segCount; i++) {
            const a = sampleAt((i / segCount) * totalLen);
            const b = sampleAt(((i + 1) / segCount) * totalLen);
            const midPressure = clamp01((a.pressure + b.pressure) * 0.5);
            const peSeg = pressureCurve(midPressure);

            const radiusScale = pressureMode === 'calligraphy' ? (0.65 + 1.35 * peSeg) : 1.0;
            const radius = baseLineWidth * radiusScale;

            const curve = new THREE.LineCurve3(
                new THREE.Vector3(a.x, a.y, 0),
                new THREE.Vector3(b.x, b.y, 0)
            );
            const tubeGeometry = new THREE.TubeGeometry(curve, 2, radius, 6, false);

            const opacityScale = pressureMode === 'brightness' ? (0.55 + 0.45 * peSeg) : 1.0;
            const emissiveScale = pressureMode === 'brightness'
                ? (0.7 + 1.2 * peSeg)
                : (pressureMode === 'calligraphy' ? (0.9 + 0.25 * peSeg) : 1.0);

            const material = new THREE.ShaderMaterial({
                vertexShader: silkRingVertexShader,
                fragmentShader: silkRingFragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    uFlowSpeed: { value: settings.flowSpeed ?? 1.0 },
                    uStrandDensity: { value: settings.strandDensity ?? 30.0 },
                    uSparkleEnabled: { value: settings.sparkleEnabled ? 1.0 : 0.0 },
                    uSparkleThreshold: { value: settings.sparkleThreshold ?? 0.95 },
                    uFresnelPower: { value: settings.fresnelPower ?? 2.0 },
                    uOpacity: { value: baseOpacity * opacityScale },
                    uEmissive: { value: baseEmissive * emissiveScale },
                    uBloomBoost: { value: 0.3 },
                    // 染色模式 - 使用法阵级别参数
                    uColorMode: { value: mcSettings.colorMode ?? 0 },
                    uBaseColor: { value: new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColor1: { value: mcSettings.color1 ?? new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
                    uColor3: { value: mcSettings.color3 ?? new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b) },
                    uColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
                    uProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 },
                    // 染色功能参数
                    uBaseHue: { value: mcSettings.baseHue ?? 200 },
                    uBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
                    uSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
                    // 法阵级别参数
                    uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
                    uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
                    uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
                    uMCPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
                    uMCPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
                    uMCPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 }
                },
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(tubeGeometry, material);
            mesh.renderOrder = 51;
            group.add(mesh);
        }
    }

    return group;
}

// ==================== 清理绘图资源 ====================

export function disposeDrawingResources(refs: DrawingSystemRefs): void {
    if (refs.strokesGroup) {
        refs.strokesGroup.traverse(obj => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
                obj.geometry?.dispose();
                if (obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                } else if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                }
            }
        });
        refs.strokesGroup.clear();
    }

    if (refs.symmetryAxesGroup) {
        refs.symmetryAxesGroup.traverse(obj => {
            if (obj instanceof THREE.Line) {
                obj.geometry?.dispose();
                if (obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                }
            }
        });
        refs.symmetryAxesGroup.clear();
    }

    if (refs.centerPoint) {
        refs.centerPoint.geometry?.dispose();
        if (refs.centerPoint.material instanceof THREE.Material) {
            refs.centerPoint.material.dispose();
        }
    }

    if (refs.border) {
        refs.border.geometry?.dispose();
        if (refs.border.material instanceof THREE.Material) {
            refs.border.material.dispose();
        }
    }
}

// ==================== 渲染笔画到 Group ====================

export function renderStrokesToGroup(
    strokesGroup: THREE.Group,
    layer: MagicCircleLayer | null
): void {
    // 清除旧笔画
    while (strokesGroup.children.length > 0) {
        const child = strokesGroup.children[0];
        strokesGroup.remove(child);
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
            child.geometry?.dispose();
            if (child.material instanceof THREE.Material) {
                child.material.dispose();
            }
        }
        if (child instanceof THREE.Group) {
            child.traverse(obj => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry?.dispose();
                    if (obj.material instanceof THREE.Material) {
                        obj.material.dispose();
                    }
                }
            });
        }
    }

    if (!layer) return;

    // 渲染每条笔画
    for (const stroke of layer.strokes) {
        if (stroke.points.length < 2) continue;

        let strokeMesh: THREE.Points | THREE.Group;

        if (stroke.brushType === 'particle') {
            strokeMesh = createParticleStrokeMesh(
                stroke.points,
                stroke.color,
                stroke.particleRingSettings || {},
                layer.symmetryMode,
                layer.symmetryDivisions
            );
        } else {
            strokeMesh = createLineStrokeMesh(
                stroke.points,
                stroke.color,
                stroke.silkRingSettings || {},
                layer.symmetryMode,
                layer.symmetryDivisions
            );
        }

        strokesGroup.add(strokeMesh);
    }
}

// ==================== 创建新法阵实例 ====================

export function createNewCircle(name: string = '新建法阵'): CustomMagicCircle {
    return {
        id: `circle_${Date.now()}`,
        name,
        enabled: true,  // 默认在场景中显示
        createdAt: Date.now(),
        updatedAt: Date.now(),
        layers: [createNewLayer()]
    };
}

// ==================== 创建新图层 ====================

export function createNewLayer(name: string = '图层1'): MagicCircleLayer {
    return {
        id: `layer_${Date.now()}`,
        name,
        visible: true,
        locked: false,
        opacity: 1.0,
        symmetryMode: 'radial',
        symmetryDivisions: 8,
        strokes: []
    };
}

// ==================== 辅助函数：解析十六进制颜色 ====================

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
    const color = new THREE.Color(hex);
    return { r: color.r, g: color.g, b: color.b };
}
