/**
 * input: customMagicCircles data, drawing mode state from App.tsx, particle/silk/lightsaber brush pressureMode
 * output: 3D drawing canvas with orthographic camera, particle/silk/lightsaber stroke rendering
 * pos: Drawing system utilities for PlanetScene integration
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 * 2026-01-08: 新增光剑(lightsaber)画笔类型，包含lightsaberVertexShader/lightsaberFragmentShader、createLightsaberStrokeMesh函数、AdditiveBlending混合模式
 * 2026-01-16: 统一粒子画笔与粒子环效果：移除0.05大小系数、随机范围改为1~3、应用brightness参数、光晕采用pow模型、uGlowIntensity默认3
 * 2026-01-27: 修复网格画笔在星芒/漩涡对称模式下的问题：将独立的起点/终点变换改为使用applySymmetryToPath进行路径级别变换，确保线段两端在同一对称轨道上
 */


import * as THREE from 'three';
import {
    CustomMagicCircle,
    MagicCircleLayer,
    MagicCircleStroke,
    StrokePoint,
    DrawingBrushType,
    SymmetryMode,
    SymmetryParams,
    ParticleRingSettings,
    SilkRingSettings,
    LightsaberSettings
} from '../types';

// ==================== 常量 ====================

const CANVAS_SIZE = 1; // 归一化画布尺寸 (-0.5 to 0.5)
const DEFAULT_SYMMETRY_DIVISIONS = 8;
const DEFAULT_COLOR = '#ffaa00';

// ==================== 笔迹平滑函数 ====================

/**
 * 使用CatmullRomCurve3对笔迹点进行平滑处理
 * @param points 原始采样点
 * @param smoothness 平滑度 (0=不平滑保持原样, 1-3=越来越平滑的曲线)
 * @param minPoints 至少需要的点数才进行平滑
 * @returns 平滑后的点数组
 */
export function smoothStrokePoints(
    points: StrokePoint[],
    smoothness: number = 0.5,
    minPoints: number = 4
): StrokePoint[] {
    // 点数太少或平滑度为0时不进行平滑
    if (points.length < minPoints || smoothness <= 0) {
        return points;
    }

    // 创建3D曲线（z用于存储压力值的索引）
    const curve3DPoints = points.map((p, i) => new THREE.Vector3(p.x, p.y, i));

    // 将smoothness映射到CatmullRom张力参数：
    // smoothness=0 → tension=0.5（不平滑，贴近原始点）
    // smoothness=3 → tension=0（最平滑，圆润曲线）
    const tension = Math.max(0, 0.5 - (smoothness / 6));

    // 使用CatmullRom样条曲线，张力越小曲线越圆润
    const curve = new THREE.CatmullRomCurve3(curve3DPoints, false, 'catmullrom', tension);

    // 输出点数：保证足够密集以呈现平滑曲线
    // 基础点数 + 额外插值点数（根据路径长度）
    const baseOutputCount = Math.max(points.length, 20);
    const extraPoints = Math.floor(smoothness * points.length);
    const outputPointCount = baseOutputCount + extraPoints;

    const smoothedPoints: StrokePoint[] = [];

    for (let i = 0; i < outputPointCount; i++) {
        const t = i / (outputPointCount - 1);
        const point = curve.getPoint(t);

        // 从z坐标插值压力值
        const originalIndex = Math.min(point.z, points.length - 1);
        const lowerIndex = Math.floor(originalIndex);
        const upperIndex = Math.min(lowerIndex + 1, points.length - 1);
        const indexFrac = originalIndex - lowerIndex;

        const pressure = points[lowerIndex].pressure * (1 - indexFrac) +
            points[upperIndex].pressure * indexFrac;

        smoothedPoints.push({
            x: point.x,
            y: point.y,
            pressure: pressure,
            timestamp: Date.now()
        });
    }

    return smoothedPoints;
}

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
    // border已移除，改用CSS渐变边框
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

    // 中心点 - 漩涡式流动渐变色
    const centerGeometry = new THREE.CircleGeometry(0.008, 32);
    const centerMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;
            
            void main() {
                vec2 center = vUv - 0.5;
                float angle = atan(center.y, center.x) + uTime * 2.0;
                float dist = length(center);
                
                // 漩涡渐变色 (蓝-粉-青)
                vec3 color1 = vec3(0.44, 0.69, 1.0);   // #71b0ff
                vec3 color2 = vec3(1.0, 0.71, 0.76);  // #FFB6C1
                vec3 color3 = vec3(0.17, 0.96, 0.65); // #2bf6a5
                
                float t = fract(angle / 6.28318 + dist * 3.0);
                vec3 color;
                if (t < 0.33) {
                    color = mix(color1, color2, t * 3.0);
                } else if (t < 0.66) {
                    color = mix(color2, color3, (t - 0.33) * 3.0);
                } else {
                    color = mix(color3, color1, (t - 0.66) * 3.0);
                }
                
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist * 2.0);
                gl_FragColor = vec4(color, alpha * 0.9);
            }
        `,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide
    });
    const centerPoint = new THREE.Mesh(centerGeometry, centerMaterial);
    centerPoint.position.set(0, 0, 0.001);
    centerPoint.renderOrder = 100;
    canvasGroup.add(centerPoint);

    // 边框已改用CSS渐变边框实现，此处不再创建Three.js边框

    return {
        scene,
        camera,
        canvasGroup,
        strokesGroup,
        symmetryAxesGroup,
        centerPoint
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
    divisions: number,
    params?: SymmetryParams
): { x: number; y: number; z?: number }[] {
    if (mode === 'none') {
        return [point];
    }

    const results: { x: number; y: number; z?: number }[] = [];
    const angleStep = (Math.PI * 2) / divisions;

    // 转换为相对中心的坐标 (画布中心是 0,0，点坐标已是 -0.5 到 0.5)
    const dx = point.x;
    const dy = point.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const baseAngle = Math.atan2(dy, dx);

    if (mode === 'radial') {
        // 径向对称：简单旋转复制
        const phaseOffset = ((params?.radialPhaseOffset ?? 0) / 180) * Math.PI;
        const scaleVariation = params?.radialScaleVariation ?? 0;
        for (let i = 0; i < divisions; i++) {
            const angle = baseAngle + angleStep * i + phaseOffset;
            const scale = 1.0 + ((i % 2 === 0) ? scaleVariation : -scaleVariation);
            const scaledRadius = radius * scale;
            results.push({
                x: scaledRadius * Math.cos(angle),
                y: scaledRadius * Math.sin(angle)
            });
        }
    } else if (mode === 'kaleidoscope') {
        // 万花筒模式：旋转+镜像
        const mirrorAngle = ((params?.kaleidoscopeMirrorAngle ?? 0) / 180) * Math.PI;
        for (let i = 0; i < divisions; i++) {
            const angle = baseAngle + angleStep * i;
            results.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
            // 每份内部镜像（基于镜像轴角度）
            const mirroredAngle = 2 * (angleStep * i + mirrorAngle) - angle;
            results.push({
                x: radius * Math.cos(mirroredAngle),
                y: radius * Math.sin(mirroredAngle)
            });
        }
    } else if (mode === 'starburst') {
        // 星芒模式：奇偶分割缩放 + 分形
        const innerScale = params?.starburstInnerScale ?? 1.0;
        const outerScale = params?.starburstOuterScale ?? 1.0;
        const phaseOffset = ((params?.starburstPhaseOffset ?? 0) / 180) * Math.PI;
        const fractalLevels = params?.starburstFractalLevels ?? 1;
        const fractalScale = params?.starburstFractalScale ?? 0.5;
        const fractalAngle = ((params?.starburstFractalAngle ?? 0) / 180) * Math.PI;

        // 递归生成分形点
        function generateFractalPoints(
            cx: number, cy: number,
            baseRadius: number,
            level: number,
            parentAngle: number
        ) {
            for (let i = 0; i < divisions; i++) {
                const angle = parentAngle + angleStep * i + phaseOffset;
                const scale = (i % 2 === 0) ? outerScale : innerScale;
                const scaledRadius = baseRadius * scale;

                const px = cx + scaledRadius * Math.cos(angle);
                const py = cy + scaledRadius * Math.sin(angle);

                results.push({ x: px, y: py });

                // 递归生成子层（仅在外延点上生成）
                if (level < fractalLevels && (i % 2 === 0)) {
                    const childRadius = scaledRadius * fractalScale;
                    generateFractalPoints(px, py, childRadius, level + 1, angle + fractalAngle);
                }
            }
        }

        generateFractalPoints(0, 0, radius, 1, baseAngle);
    } else if (mode === 'vortex') {
        // 漩涡模式：随半径旋转扭曲
        const twistFactor = params?.vortexTwistFactor ?? 0;
        const twistDecay = params?.vortexTwistDecay ?? 3.0;
        const direction = params?.vortexDirection ?? 1;
        const centerOffset = params?.vortexCenterOffset ?? 0;
        for (let i = 0; i < divisions; i++) {
            const angleOffset = angleStep * i;
            const adjustedRadius = Math.max(0.001, radius - centerOffset);
            const twistAngle = direction * twistFactor * Math.max(0, 1.0 - adjustedRadius * twistDecay);
            const angle = baseAngle + angleOffset + twistAngle;
            results.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
    } else if (mode === 'sphere') {
        // 球面模式：2D映射到3D球体表面
        const R = params?.sphereRadius ?? 0.5;
        const latScale = params?.sphereLatScale ?? 1.0;
        const lonScale = params?.sphereLonScale ?? 1.0;

        // 经纬度映射（带缩放）
        const lat = dy * Math.PI * latScale;
        const lon = dx * Math.PI * 2 * lonScale;

        // 球坐标转笛卡尔坐标
        const bx = R * Math.cos(lat) * Math.sin(lon);
        const by = R * Math.sin(lat);
        const bz = R * Math.cos(lat) * Math.cos(lon);

        for (let i = 0; i < divisions; i++) {
            const rotAngle = angleStep * i;
            const cos = Math.cos(rotAngle);
            const sin = Math.sin(rotAngle);
            results.push({
                x: bx * cos + bz * sin,
                y: by,
                z: -bx * sin + bz * cos
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
    },
    symmetryParams?: SymmetryParams
): THREE.Points {
    // 应用笔迹平滑
    const smoothness = settings.smoothness ?? 0.5;
    const smoothedPoints = smoothStrokePoints(points, smoothness);

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

    // Step 1: 计算路径累积长度数组（使用平滑后的点）
    const segmentLengths: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < smoothedPoints.length; i++) {
        const dx = smoothedPoints[i].x - smoothedPoints[i - 1].x;
        const dy = smoothedPoints[i].y - smoothedPoints[i - 1].y;
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

    // Step 2: 计算粒子总数 = 密度 × 路径长度（不设上限，让密度完全生效）
    const canvasDensityScale = 80;
    const particleCountTarget = Math.max(1, Math.floor(particleDensity * totalLength * canvasDensityScale));
    const particleCount = particleCountTarget;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const pressureCurve = (p: number) => {
        const x = clamp01(p);
        if (pressureMode === 'none') return 1;
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

        const p0 = smoothedPoints[segIndex];
        const p1 = smoothedPoints[Math.min(segIndex + 1, smoothedPoints.length - 1)];

        // 插值位置
        const baseX = p0.x + (p1.x - p0.x) * t;
        const baseY = p0.y + (p1.y - p0.y) * t;
        const pressure = p0.pressure + (p1.pressure - p0.pressure) * t;
        const pe = pressureCurve(pressure);

        // 转换到画布坐标系并应用对称变换
        const symmetricPoints = applySymmetryTransform(
            { x: baseX - 0.5, y: 0.5 - baseY },
            symmetryMode,
            symmetryDivisions,
            symmetryParams
        );

        for (const sp of symmetricPoints) {
            const jitterBase = strokeThickness * 0.002;
            const jitterScale = pressureMode === 'none'
                ? 0.55
                : (pressureMode === 'brightness'
                    ? (0.35 + 0.15 * pe)
                    : (0.15 + 1.85 * pe));  // 书法压感：大幅放大粗细变化 (0→0.15, 1→2.0)

            const spawnExtraMax = pressureMode === 'brightness' ? 2 : (pressureMode === 'calligraphy' ? 1 : 0);
            const spawnCount = 1 + Math.floor(pe * spawnExtraMax);

            for (let s = 0; s < spawnCount; s++) {

                const jitter = jitterBase * jitterScale;
                const jx = (Math.random() - 0.5) * jitter;
                const jy = (Math.random() - 0.5) * jitter;
                const jz = spatialThickness ? (Math.random() - 0.5) * zThickness * 0.002 : 0;
                // 使用对称变换返回的z坐标（棱镜等3D模式）
                const symmetryZ = sp.z ?? 0;

                const px = sp.x + jx;
                const py = sp.y + jy;
                particlePositions.push(px, py, jz + symmetryZ);

                // 径向距离用于渐变
                const radialDist = Math.sqrt(px * px + py * py) * 2;
                particleRadialDists.push(Math.min(1, radialDist));

                // 粒子大小 = 基础大小 × 压感 × 随机变化 (与粒子环一致: 1~3随机)
                const sizeVariation = 1 + Math.random() * 2;  // 1~3 与粒子环一致
                const sizePressureScale = pressureMode === 'none'
                    ? 1.0
                    : (pressureMode === 'brightness'
                        ? (0.7 + 0.6 * pe)   // 亮度压感: 0.7~1.3倍
                        : (0.3 + 1.4 * pe)); // 书法压感: 0.3~1.7倍
                particleSizes.push(particleSize * sizePressureScale * sizeVariation);

                // 颜色 = 基色 × 压感调制 × brightness参数 (与粒子环一致)
                const brightnessParam = settings.brightness ?? 1.0;
                const colorMult = pressureMode === 'none'
                    ? 1.0
                    : (pressureMode === 'brightness' ? (0.7 + 1.2 * pe) : (0.95 + 0.25 * pe));
                particleColors.push(
                    colorObj.r * colorMult * brightnessParam,
                    colorObj.g * colorMult * brightnessParam,
                    colorObj.b * colorMult * brightnessParam
                );

                const alphaPressure = pressureMode === 'none'
                    ? 0.85
                    : (pressureMode === 'brightness'
                        ? (0.2 + 0.8 * pe)
                        : (0.55 + 0.45 * pe));
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
            uGlowIntensity: { value: settings.brightness ?? 3.0 },  // 与粒子环一致，默认3
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
  
  // 统一使用粒子环的光晕模型: smoothstep + pow
  float baseAlpha = smoothstep(0.5, 0.0, dist);
  float glowAlpha = pow(baseAlpha, 1.0 / uGlowIntensity);
  
  // 应用染色功能
  vec3 dyedColor = getDyeColor(vColor, vRadialDist);
  
  // 应用饱和度增强
  vec3 hsl = rgb2hsl(dyedColor);
  hsl.y = clamp(hsl.y * uSaturationBoost, 0.0, 1.0);
  dyedColor = hsl2rgb(hsl);
  
  // 最终颜色 - 应用发光 (与粒子环一致)
  vec3 finalColor = dyedColor * (1.0 + glowAlpha * 0.5);
  
  // 应用法阵级别色相偏移
  if (uMCHueShift > 0.001 || uMCHueShift < -0.001) {
    vec3 hslFinal = rgb2hsl(finalColor);
    hslFinal.x = fract(hslFinal.x + uMCHueShift);
    finalColor = hsl2rgb(hslFinal);
  }
  
  // 应用法阵级别亮度
  finalColor *= uMCBrightness;
  
  // Alpha - 结合光晕、压感alpha和法阵透明度
  float alpha = glowAlpha * vAlpha * uMCOpacity;
  
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

// ==================== 丝环着色器 (与光环系统线环保持一致的波动逻辑) ====================

const silkRingVertexShader = `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;
uniform float uFlowSpeed;
uniform float uWaveType;          // 0=off, 1=sine, 2=triangle
uniform float uWobbleFrequency;
uniform float uWobbleAmplitude;

// 计算波形值 (仅支持正弦波/三角波/无)
float computeWave(float phase) {
  if (uWaveType < 0.5) {
    return 0.0;  // off
  } else if (uWaveType < 1.5) {
    // 正弦波 - 平滑波动
    return sin(phase);
  } else {
    // 三角波 - 锯齿折返
    float t = mod(phase, 6.28318);
    return abs(t / 3.14159 - 1.0) * 2.0 - 1.0;
  }
}

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // 基础位置
  vec3 pos = position;
  
  // 计算相位 (沿UV的x方向，对应笔画路径方向)
  // 与光环系统一致：phase = 位置因子 * 频率 + 时间 * 流速
  float phase = vUv.x * uWobbleFrequency * 6.28318 + uTime * uFlowSpeed;
  
  // 波动变形 (沿法线方向，与光环系统一致)
  if (uWaveType > 0.5) {
    float wave = computeWave(phase) * uWobbleAmplitude * 0.01; // 缩放到画布坐标系
    pos += normal * wave;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
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

  float brightness = strands * (energy * 0.8 + sparkle);

  // 4. 菲涅尔边缘
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), uFresnelPower);
  brightness *= fresnel;

  float colorT = fract(vUv.x + sin(uTime * 0.5) * 0.1);
  vec3 baseColor = getColor(colorT);
  
  vec3 finalColor = baseColor * (1.0 + brightness * uEmissive * 0.6);
  finalColor *= (1.0 + uBloomBoost * brightness * 0.25);
  
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

// ==================== 光剑着色器 ====================

const lightsaberVertexShader = `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  vec3 pos = position;
  
  // 脉冲呼吸效果 (微幅缩放)
  if (uPulseEnabled > 0.5) {
    float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159) * uPulseIntensity * 0.3;
    pos *= pulse;
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const lightsaberFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uCoreColor;      // 核心颜色
uniform vec3 uGlowColor;      // 光晕颜色
uniform float uCoreWidth;     // 核心宽度 (0-1)
uniform float uGlowIntensity; // 光晕强度
uniform float uGlowFalloff;   // 光晕衰减
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;

// 法阵级别参数
uniform float uMCOpacity;
uniform float uMCHueShift;
uniform float uMCBrightness;
uniform float uMCPulseEnabled;
uniform float uMCPulseSpeed;
uniform float uMCPulseIntensity;

// 染色功能参数
uniform float uMCBaseHue;          // 基础色相 0-360
uniform float uMCBaseSaturation;   // 基础饱和度 0-1
uniform float uMCSaturationBoost;  // 饱和度增强 -1 to 1
uniform float uMCColorMode;        // 0=none, 4=single, 1=twoColor, 2=threeColor, 3=procedural
uniform vec3 uMCColor1;
uniform vec3 uMCColor2;
uniform vec3 uMCColor3;
uniform float uMCColorMidPos;
uniform float uMCProceduralIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

// HSL转RGB辅助函数
vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
}

// RGB转HSL
vec3 rgb2hsl(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float l = (maxC + minC) / 2.0;
    float s = 0.0;
    float h = 0.0;
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

void main() {
  // 计算到管道中心的距离 (vUv.y: 0=边缘, 0.5=顶部, 1=另一边缘)
  float distFromCenter = abs(vUv.y - 0.5) * 2.0; // 0=中心, 1=边缘
  
  // 核心区域 (硬边白光)
  float coreAlpha = 1.0 - smoothstep(uCoreWidth * 0.5, uCoreWidth * 0.5 + 0.08, distFromCenter);
  
  // 光晕区域 (渐变发光)
  float glowAlpha = pow(1.0 - distFromCenter, uGlowFalloff) * uGlowIntensity;
  
  // 笔画级别脉冲效果
  float pulse = 1.0;
  if (uPulseEnabled > 0.5) {
    pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159) * uPulseIntensity;
  }
  
  // 沿路径的流动感 (细微)
  float flow = 1.0 + sin(vUv.x * 15.0 + uTime * 3.0) * 0.08;
  
  // 混合核心和光晕
  vec3 coreContrib = uCoreColor * coreAlpha * 1.5; // 核心更亮
  vec3 glowContrib = uGlowColor * glowAlpha * (1.0 - coreAlpha * 0.5);
  
  vec3 finalColor = (coreContrib + glowContrib) * pulse * flow;
  
  // 应用法阵级别脉冲
  if (uMCPulseEnabled > 0.5) {
    float mcPulse = 1.0 + sin(uTime * uMCPulseSpeed) * uMCPulseIntensity;
    finalColor *= mcPulse;
  }
  
  // 应用染色功能
  if (uMCColorMode > 0.5) {
    float t = vUv.x; // 沿路径的位置
    vec3 tintColor = finalColor;
    
    if (uMCColorMode > 3.5) {
      // 单色模式：使用baseHue和baseSaturation
      vec3 hsl = rgb2hsl(finalColor);
      hsl.x = uMCBaseHue / 360.0;
      hsl.y = uMCBaseSaturation;
      tintColor = hsl2rgb(hsl);
    } else if (uMCColorMode > 0.5 && uMCColorMode < 1.5) {
      // 双色模式
      tintColor = mix(uMCColor1, uMCColor2, t);
    } else if (uMCColorMode > 1.5 && uMCColorMode < 2.5) {
      // 三色模式
      if (t < uMCColorMidPos) {
        tintColor = mix(uMCColor1, uMCColor2, t / uMCColorMidPos);
      } else {
        tintColor = mix(uMCColor2, uMCColor3, (t - uMCColorMidPos) / (1.0 - uMCColorMidPos));
      }
    } else if (uMCColorMode > 2.5 && uMCColorMode < 3.5) {
      // 程序色模式
      float hue = mod(t + uTime * 0.1, 1.0);
      tintColor = hsl2rgb(vec3(hue, 0.8, 0.6)) * uMCProceduralIntensity;
    }
    
    // 将染色应用到光晕部分，核心保持原色
    float tintMix = (1.0 - coreAlpha) * 0.8;
    finalColor = mix(finalColor, tintColor * length(finalColor), tintMix);
  }
  
  // 应用法阵级别色相偏移
  if (abs(uMCHueShift) > 0.001) {
    vec3 hsl = rgb2hsl(finalColor);
    hsl.x = mod(hsl.x + uMCHueShift, 1.0);
    finalColor = hsl2rgb(hsl);
  }
  
  // 应用饱和度调整（乘法因子，与粒子画笔一致）
  if (uMCSaturationBoost > 0.001 || uMCSaturationBoost < 1.999) {
    vec3 hsl = rgb2hsl(finalColor);
    hsl.y = clamp(hsl.y * uMCSaturationBoost, 0.0, 1.0);
    finalColor = hsl2rgb(hsl);
  }
  
  // 应用法阵级别亮度
  finalColor *= uMCBrightness;
  
  float alpha = max(coreAlpha, glowAlpha * 0.85) * uMCOpacity;
  alpha = smoothstep(0.02, 0.9, alpha);

  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== 网格画笔着色器 ====================

const webBrushVertexShader = `
precision highp float;

attribute vec3 instanceColor;
attribute float instanceOpacity;

varying vec3 vColor;
varying float vOpacity;

uniform float uTime;
uniform float uMCPulseEnabled;
uniform float uMCPulseSpeed;
uniform float uMCPulseIntensity;

void main() {
  vColor = instanceColor;
  vOpacity = instanceOpacity;
  
  // 脉冲效果在片元着色器中通过亮度实现，而不是在顶点着色器中缩放位置
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const webBrushFragmentShader = `
precision highp float;

varying vec3 vColor;
varying float vOpacity;

uniform float uTime;
uniform float uMCOpacity;
uniform float uMCHueShift;
uniform float uMCBrightness;
uniform float uMCPulseEnabled;
uniform float uMCPulseSpeed;
uniform float uMCPulseIntensity;

// 染色功能参数
uniform float uMCBaseHue;
uniform float uMCBaseSaturation;
uniform float uMCSaturationBoost;
uniform float uMCColorMode;
uniform vec3 uMCColor1;
uniform vec3 uMCColor2;
uniform vec3 uMCColor3;
uniform float uMCColorMidPos;
uniform float uMCProceduralIntensity;

// HSL转RGB辅助函数
vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
}

// RGB转HSL
vec3 rgb2hsl(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float l = (maxC + minC) / 2.0;
    float s = 0.0;
    float h = 0.0;
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

void main() {
  vec3 finalColor = vColor;
  float alpha = vOpacity;
  
  // 脉冲亮度效果
  if (uMCPulseEnabled > 0.5) {
    float pulse = sin(uTime * uMCPulseSpeed * 3.14159) * 0.5 + 0.5;
    finalColor *= 1.0 + pulse * uMCPulseIntensity * 0.5;
    alpha *= 1.0 + pulse * uMCPulseIntensity * 0.3;
  }
  
  // 染色模式处理
  int colorMode = int(uMCColorMode);
  if (colorMode == 4) {
    // single: 使用基础色相重新染色
    vec3 hsl = rgb2hsl(finalColor);
    float newHue = uMCBaseHue / 360.0;
    float newSat = clamp(hsl.y * uMCBaseSaturation, 0.0, 1.0);
    finalColor = hsl2rgb(vec3(newHue, newSat, hsl.z));
  } else if (colorMode == 1) {
    // twoColor: 双色渐变
    float t = rgb2hsl(finalColor).z; // 使用亮度作为混合因子
    finalColor = mix(uMCColor1, uMCColor2, t);
  } else if (colorMode == 2) {
    // threeColor: 三色渐变
    float t = rgb2hsl(finalColor).z;
    if (t < uMCColorMidPos) {
      finalColor = mix(uMCColor1, uMCColor2, t / uMCColorMidPos);
    } else {
      finalColor = mix(uMCColor2, uMCColor3, (t - uMCColorMidPos) / (1.0 - uMCColorMidPos));
    }
  } else if (colorMode == 3) {
    // procedural: 程序化渐变
    float t = rgb2hsl(finalColor).z;
    float hue = mod(uMCBaseHue / 360.0 + t * uMCProceduralIntensity * 0.3, 1.0);
    finalColor = hsl2rgb(vec3(hue, 0.8, 0.6)) * uMCProceduralIntensity;
  }
  
  // 应用法阵级别色相偏移
  if (abs(uMCHueShift) > 0.001) {
    vec3 hsl = rgb2hsl(finalColor);
    hsl.x = mod(hsl.x + uMCHueShift, 1.0);
    finalColor = hsl2rgb(hsl);
  }
  
  // 应用饱和度调整
  if (uMCSaturationBoost > 0.001 && uMCSaturationBoost < 1.999) {
    vec3 hsl = rgb2hsl(finalColor);
    hsl.y = clamp(hsl.y * uMCSaturationBoost, 0.0, 1.0);
    finalColor = hsl2rgb(hsl);
  }
  
  // 应用法阵级别亮度
  finalColor *= uMCBrightness;
  
  // 应用法阵级别透明度
  alpha *= uMCOpacity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// ==================== 创建光剑画笔笔画 ====================

export function createLightsaberStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: Partial<LightsaberSettings>,
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
    },
    symmetryParams?: SymmetryParams
): THREE.Group {
    const group = new THREE.Group();
    if (points.length < 2) return group;

    // 应用笔迹平滑
    const smoothness = settings.smoothness ?? 0.5;
    const smoothedPoints = smoothStrokePoints(points, smoothness);

    const lightsaberMaterials: THREE.ShaderMaterial[] = [];
    const baseLineWidth = (settings.thickness || 0.03) * 0.5;
    const mcSettings = magicCircleSettings || {};

    // 解析颜色
    const glowColorObj = new THREE.Color(settings.glowColor || color);
    const coreColorObj = new THREE.Color(settings.coreColor || '#ffffff');

    // 压感模式
    const pressureMode = settings.pressureMode || 'none';

    // 应用对称（注意Y轴翻转，与粒子画笔一致）
    const basePath = smoothedPoints.map(p => ({ x: p.x - 0.5, y: 0.5 - p.y, pressure: p.pressure }));
    const allPaths = applySymmetryToPath(basePath, symmetryMode, symmetryDivisions, symmetryParams);

    const baseRenderOrder = 53;

    // 端点渐变参数（从settings读取）
    const taperLength = settings.taperLength ?? 0.15;

    for (let pathIndex = 0; pathIndex < allPaths.length; pathIndex++) {
        const path = allPaths[pathIndex];
        const pathRenderOrder = baseRenderOrder + pathIndex;
        if (path.length < 2) continue;

        // 计算路径总长度
        let totalLength = 0;
        const segmentLengths: number[] = [0];
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(totalLength);
        }

        // 计算每个点的半径（端点渐变）
        const getRadiusAtDistance = (dist: number): number => {
            const t = dist / totalLength;
            let radiusFactor = 1.0;

            // 起点渐变
            if (t < taperLength) {
                radiusFactor = t / taperLength;
            }
            // 终点渐变
            else if (t > 1 - taperLength) {
                radiusFactor = (1 - t) / taperLength;
            }

            // 使用平滑的二次曲线使渐变更自然
            radiusFactor = Math.pow(radiusFactor, 0.5);
            return baseLineWidth * Math.max(0.1, radiusFactor);
        };

        if (pressureMode === 'none') {
            // 使用自定义TubeGeometry实现可变半径（使用路径的z坐标支持3D对称）
            const curvePoints = path.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0));
            const curve = new THREE.CatmullRomCurve3(curvePoints);
            const tubularSegments = Math.max(16, path.length * 3);
            const radialSegments = 8;

            // 创建可变半径的管道几何体
            const frames = curve.computeFrenetFrames(tubularSegments, false);
            const vertices: number[] = [];
            const normals: number[] = [];
            const uvs: number[] = [];
            const indices: number[] = [];

            for (let i = 0; i <= tubularSegments; i++) {
                const t = i / tubularSegments;
                const P = curve.getPointAt(t);
                const N = frames.normals[i];
                const B = frames.binormals[i];

                // 计算当前位置的半径
                const currentDist = t * totalLength;
                const currentRadius = getRadiusAtDistance(currentDist);

                for (let j = 0; j <= radialSegments; j++) {
                    const v = j / radialSegments * Math.PI * 2;
                    const sin = Math.sin(v);
                    const cos = Math.cos(v);

                    const normal = new THREE.Vector3(
                        cos * N.x + sin * B.x,
                        cos * N.y + sin * B.y,
                        cos * N.z + sin * B.z
                    ).normalize();

                    vertices.push(
                        P.x + currentRadius * normal.x,
                        P.y + currentRadius * normal.y,
                        P.z + currentRadius * normal.z
                    );
                    normals.push(normal.x, normal.y, normal.z);
                    uvs.push(i / tubularSegments, j / radialSegments);
                }
            }

            // 生成索引
            for (let i = 0; i < tubularSegments; i++) {
                for (let j = 0; j < radialSegments; j++) {
                    const a = i * (radialSegments + 1) + j;
                    const b = (i + 1) * (radialSegments + 1) + j;
                    const c = (i + 1) * (radialSegments + 1) + (j + 1);
                    const d = i * (radialSegments + 1) + (j + 1);
                    indices.push(a, b, d, b, c, d);
                }
            }

            const tubeGeometry = new THREE.BufferGeometry();
            tubeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            tubeGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            tubeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            tubeGeometry.setIndex(indices);

            const material = new THREE.ShaderMaterial({
                vertexShader: lightsaberVertexShader,
                fragmentShader: lightsaberFragmentShader,
                uniforms: {
                    uTime: { value: 0 },
                    uCoreColor: { value: new THREE.Vector3(coreColorObj.r, coreColorObj.g, coreColorObj.b) },
                    uGlowColor: { value: new THREE.Vector3(glowColorObj.r, glowColorObj.g, glowColorObj.b) },
                    uCoreWidth: { value: settings.coreWidth ?? 0.4 },
                    uGlowIntensity: { value: settings.glowIntensity ?? 1.5 },
                    uGlowFalloff: { value: settings.glowFalloff ?? 2.0 },
                    uPulseEnabled: { value: settings.pulseEnabled ? 1.0 : 0.0 },
                    uPulseSpeed: { value: settings.pulseSpeed ?? 1.0 },
                    uPulseIntensity: { value: settings.pulseIntensity ?? 0.2 },
                    // 法阵级别参数
                    uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
                    uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
                    uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
                    uMCPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
                    uMCPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
                    uMCPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 },
                    // 染色功能参数
                    uMCBaseHue: { value: mcSettings.baseHue ?? 200 },
                    uMCBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
                    uMCSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
                    uMCColorMode: { value: mcSettings.colorMode ?? 0 },
                    uMCColor1: { value: mcSettings.color1 ?? new THREE.Vector3(1, 1, 1) },
                    uMCColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
                    uMCColor3: { value: mcSettings.color3 ?? new THREE.Vector3(1, 1, 1) },
                    uMCColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
                    uMCProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 }
                },
                transparent: true,
                depthTest: false,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });

            const mesh = new THREE.Mesh(tubeGeometry, material);
            mesh.renderOrder = pathRenderOrder;
            lightsaberMaterials.push(material);
            group.add(mesh);
            continue;
        }

        // 压感模式：使用连续可变半径管道（与非压感模式类似，但半径随压力变化）
        const cumulative: number[] = [0];
        let totalLen = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
            cumulative.push(totalLen);
        }
        if (totalLen < 0.0005) continue;

        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const pressureCurve = (p: number) => Math.pow(clamp01(p), 1.5);

        // 采样函数
        const sampleAt = (dist: number) => {
            let lo = 0, hi = cumulative.length - 1;
            while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cumulative[m] > dist) hi = m - 1; else lo = m; }
            const i = lo;
            if (i >= path.length - 1) return path[path.length - 1];
            const segLen = cumulative[i + 1] - cumulative[i];
            const t = segLen > 0 ? (dist - cumulative[i]) / segLen : 0;
            return {
                x: path[i].x + (path[i + 1].x - path[i].x) * t,
                y: path[i].y + (path[i + 1].y - path[i].y) * t,
                pressure: path[i].pressure + (path[i + 1].pressure - path[i].pressure) * t
            };
        };

        // 计算压感下每个位置的半径
        const getRadiusAtDistWithPressure = (dist: number): number => {
            const sample = sampleAt(dist);
            const pe = pressureCurve(sample.pressure);

            // 端点渐变
            const t = dist / totalLen;
            let taperFactor = 1.0;
            if (t < taperLength) {
                taperFactor = t / taperLength;
            } else if (t > 1 - taperLength) {
                taperFactor = (1 - t) / taperLength;
            }
            taperFactor = Math.pow(taperFactor, 0.5);

            // 压感影响
            const radiusScale = pressureMode === 'calligraphy' ? (0.3 + 1.7 * pe) : 1.0;

            return baseLineWidth * radiusScale * Math.max(0.1, taperFactor);
        };

        // 创建连续的曲线点（使用路径的z坐标支持3D对称）
        const curvePoints = path.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0));
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        const tubularSegments = Math.max(16, path.length * 3);
        const radialSegments = 8;

        // 创建可变半径的管道几何体
        const frames = curve.computeFrenetFrames(tubularSegments, false);
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= tubularSegments; i++) {
            const t = i / tubularSegments;
            const P = curve.getPointAt(t);
            const N = frames.normals[i];
            const B = frames.binormals[i];

            // 计算当前位置的半径（考虑压感和端点渐变）
            const currentDist = t * totalLen;
            const currentRadius = getRadiusAtDistWithPressure(currentDist);

            for (let j = 0; j <= radialSegments; j++) {
                const v = j / radialSegments * Math.PI * 2;
                const sin = Math.sin(v);
                const cos = Math.cos(v);

                const normal = new THREE.Vector3(
                    cos * N.x + sin * B.x,
                    cos * N.y + sin * B.y,
                    cos * N.z + sin * B.z
                ).normalize();

                vertices.push(
                    P.x + currentRadius * normal.x,
                    P.y + currentRadius * normal.y,
                    P.z + currentRadius * normal.z
                );
                normals.push(normal.x, normal.y, normal.z);
                uvs.push(i / tubularSegments, j / radialSegments);
            }
        }

        // 生成索引
        for (let i = 0; i < tubularSegments; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const a = i * (radialSegments + 1) + j;
                const b = (i + 1) * (radialSegments + 1) + j;
                const c = (i + 1) * (radialSegments + 1) + (j + 1);
                const d = i * (radialSegments + 1) + (j + 1);
                indices.push(a, b, d, b, c, d);
            }
        }

        const tubeGeometry = new THREE.BufferGeometry();
        tubeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        tubeGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        tubeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        tubeGeometry.setIndex(indices);

        // 压感亮度模式：计算平均压力用于整体亮度调整
        let avgPressure = 0;
        for (const p of path) avgPressure += p.pressure;
        avgPressure /= path.length;
        const intensityScale = pressureMode === 'brightness' ? (0.6 + 0.8 * pressureCurve(avgPressure)) : 1.0;

        const material = new THREE.ShaderMaterial({
            vertexShader: lightsaberVertexShader,
            fragmentShader: lightsaberFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uCoreColor: { value: new THREE.Vector3(coreColorObj.r, coreColorObj.g, coreColorObj.b) },
                uGlowColor: { value: new THREE.Vector3(glowColorObj.r, glowColorObj.g, glowColorObj.b) },
                uCoreWidth: { value: settings.coreWidth ?? 0.4 },
                uGlowIntensity: { value: (settings.glowIntensity ?? 1.5) * intensityScale },
                uGlowFalloff: { value: settings.glowFalloff ?? 2.0 },
                uPulseEnabled: { value: settings.pulseEnabled ? 1.0 : 0.0 },
                uPulseSpeed: { value: settings.pulseSpeed ?? 1.0 },
                uPulseIntensity: { value: settings.pulseIntensity ?? 0.2 },
                // 法阵级别参数
                uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
                uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
                uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
                uMCPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
                uMCPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
                uMCPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 },
                // 染色功能参数
                uMCBaseHue: { value: mcSettings.baseHue ?? 200 },
                uMCBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
                uMCSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
                uMCColorMode: { value: mcSettings.colorMode ?? 0 },
                uMCColor1: { value: mcSettings.color1 ?? new THREE.Vector3(1, 1, 1) },
                uMCColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
                uMCColor3: { value: mcSettings.color3 ?? new THREE.Vector3(1, 1, 1) },
                uMCColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
                uMCProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 }
            },
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });

        const mesh = new THREE.Mesh(tubeGeometry, material);
        mesh.renderOrder = pathRenderOrder;
        lightsaberMaterials.push(material);
        group.add(mesh);
    }

    // 存储材质引用用于动画更新
    (group as any).__lightsaberMaterials = lightsaberMaterials;

    return group;
}

// 对称路径生成辅助函数
function applySymmetryToPath(
    basePath: { x: number; y: number; pressure: number }[],
    symmetryMode: SymmetryMode,
    divisions: number,
    params?: SymmetryParams
): { x: number; y: number; z?: number; pressure: number }[][] {
    if (symmetryMode === 'none') return [basePath];

    const allPaths: { x: number; y: number; z?: number; pressure: number }[][] = [];

    if (symmetryMode === 'radial') {
        // 径向对称：简单旋转复制
        const phaseOffset = ((params?.radialPhaseOffset ?? 0) / 180) * Math.PI;
        const scaleVariation = params?.radialScaleVariation ?? 0;
        for (let div = 0; div < divisions; div++) {
            const angle = (div / divisions) * Math.PI * 2 + phaseOffset;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const scale = 1.0 + ((div % 2 === 0) ? scaleVariation : -scaleVariation);

            const rotatedPath = basePath.map(p => ({
                x: (p.x * cos - p.y * sin) * scale,
                y: (p.x * sin + p.y * cos) * scale,
                pressure: p.pressure
            }));
            allPaths.push(rotatedPath);
        }
    } else if (symmetryMode === 'kaleidoscope') {
        // 万花筒模式：旋转+镜像
        const mirrorAngle = ((params?.kaleidoscopeMirrorAngle ?? 0) / 180) * Math.PI;
        for (let div = 0; div < divisions; div++) {
            const angle = (div / divisions) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const rotatedPath = basePath.map(p => ({
                x: p.x * cos - p.y * sin,
                y: p.x * sin + p.y * cos,
                pressure: p.pressure
            }));
            allPaths.push(rotatedPath);

            // 镜像路径
            const cosM = Math.cos(mirrorAngle * 2);
            const sinM = Math.sin(mirrorAngle * 2);
            const mirroredPath = basePath.map(p => {
                const rx = p.x * cos - p.y * sin;
                const ry = p.x * sin + p.y * cos;
                return {
                    x: rx * cosM + ry * sinM,
                    y: rx * sinM - ry * cosM,
                    pressure: p.pressure
                };
            });
            allPaths.push(mirroredPath);
        }
    } else if (symmetryMode === 'starburst') {
        // 星芒模式：奇偶分割缩放 + 分形
        const innerScale = params?.starburstInnerScale ?? 0.5;
        const outerScale = params?.starburstOuterScale ?? 1.3;
        const phaseOffset = ((params?.starburstPhaseOffset ?? 0) / 180) * Math.PI;
        const fractalLevels = params?.starburstFractalLevels ?? 1;
        const fractalScale = params?.starburstFractalScale ?? 0.5;
        const fractalAngle = ((params?.starburstFractalAngle ?? 0) / 180) * Math.PI;
        const angleStep = (Math.PI * 2) / divisions;

        // 递归生成分形路径
        function generateFractalPaths(
            cx: number, cy: number,
            baseScale: number,
            level: number,
            parentAngle: number
        ): void {
            for (let i = 0; i < divisions; i++) {
                const angle = parentAngle + angleStep * i + phaseOffset;
                const scale = (i % 2 === 0) ? outerScale : innerScale;
                const totalScale = baseScale * scale;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                const transformedPath = basePath.map(p => ({
                    x: cx + (p.x * cosA - p.y * sinA) * totalScale,
                    y: cy + (p.x * sinA + p.y * cosA) * totalScale,
                    pressure: p.pressure
                }));
                allPaths.push(transformedPath);

                // 递归生成子层（仅在外延位置）
                if (level < fractalLevels && (i % 2 === 0)) {
                    const childCx = cx + totalScale * 0.3 * cosA; // 子层中心偏移
                    const childCy = cy + totalScale * 0.3 * sinA;
                    const childScale = totalScale * fractalScale;
                    generateFractalPaths(childCx, childCy, childScale, level + 1, angle + fractalAngle);
                }
            }
        }

        generateFractalPaths(0, 0, 1.0, 1, 0);
    } else if (symmetryMode === 'vortex') {
        // 漩涡模式：随半径旋转扭曲
        const twistFactor = params?.vortexTwistFactor ?? 2.0;
        const twistDecay = params?.vortexTwistDecay ?? 3.0;
        const direction = params?.vortexDirection ?? 1;
        const centerOffset = params?.vortexCenterOffset ?? 0;
        for (let div = 0; div < divisions; div++) {
            const angleOffset = (div / divisions) * Math.PI * 2;
            const twistedPath = basePath.map(p => {
                const radius = Math.sqrt(p.x * p.x + p.y * p.y);
                const adjustedRadius = Math.max(0.001, radius - centerOffset);
                const twistAngle = direction * twistFactor * Math.max(0, 1.0 - adjustedRadius * twistDecay);
                const angle = angleOffset + twistAngle;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                return {
                    x: p.x * cos - p.y * sin,
                    y: p.x * sin + p.y * cos,
                    pressure: p.pressure
                };
            });
            allPaths.push(twistedPath);
        }
    } else if (symmetryMode === 'sphere') {
        // 球面模式：2D映射到3D球体表面
        const R = params?.sphereRadius ?? 0.5;
        const latScale = params?.sphereLatScale ?? 1.0;
        const lonScale = params?.sphereLonScale ?? 1.0;
        for (let div = 0; div < divisions; div++) {
            const rotAngle = (div / divisions) * Math.PI * 2;
            const cos = Math.cos(rotAngle);
            const sin = Math.sin(rotAngle);
            const spherePath = basePath.map(p => {
                const lat = p.y * Math.PI * latScale;
                const lon = p.x * Math.PI * 2 * lonScale;
                const bx = R * Math.cos(lat) * Math.sin(lon);
                const by = R * Math.sin(lat);
                const bz = R * Math.cos(lat) * Math.cos(lon);
                return {
                    x: bx * cos + bz * sin,
                    y: by,
                    z: -bx * sin + bz * cos,
                    pressure: p.pressure
                };
            });
            allPaths.push(spherePath);
        }
    }

    return allPaths;
}

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
    },
    symmetryParams?: SymmetryParams
): THREE.Group {
    const group = new THREE.Group();
    // 收集所有丝环材质，用于后续更新uTime
    const silkMaterials: THREE.ShaderMaterial[] = [];

    if (points.length < 2) {
        group.userData.silkMaterials = silkMaterials;
        return group;
    }

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
    // 生成路径点
    const basePath = points.map(p => ({
        x: p.x - 0.5,
        y: 0.5 - p.y,
        pressure: clamp01(p.pressure ?? 0.5)
    }));

    // 使用统一的对称变换函数
    const symmetricPaths = applySymmetryToPath(basePath, symmetryMode, symmetryDivisions, symmetryParams);
    const allPaths = symmetricPaths.map(path => path.map(p => ({ x: p.x, y: p.y, z: p.z, pressure: p.pressure })));

    // 为每条路径创建线条 - 使用真正的丝环着色器
    // 修复闪烁：同一笔画的所有分段使用统一的renderOrder，不同路径间隔开
    const baseRenderOrder = 51;
    for (let pathIndex = 0; pathIndex < allPaths.length; pathIndex++) {
        const path = allPaths[pathIndex];
        const pathRenderOrder = baseRenderOrder + pathIndex;  // 每条路径一个renderOrder
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
                    // 波动参数 (与光环系统一致)
                    uWaveType: { value: settings.waveType === 'sine' ? 1.0 : settings.waveType === 'triangle' ? 2.0 : 0.0 },
                    uWobbleFrequency: { value: settings.wobbleFrequency ?? 10.0 },
                    uWobbleAmplitude: { value: settings.wobbleAmplitude ?? 0.5 },
                    // 视觉效果参数
                    uStrandDensity: { value: settings.strandDensity ?? 30.0 },
                    uSparkleEnabled: { value: settings.sparkleEnabled ? 1.0 : 0.0 },
                    uSparkleThreshold: { value: settings.sparkleThreshold ?? 0.95 },
                    uFresnelPower: { value: settings.fresnelPower ?? 2.0 },
                    uOpacity: { value: settings.opacity ?? 0.85 },
                    uEmissive: { value: settings.emissive ?? 0.9 },
                    uBloomBoost: { value: settings.bloomBoost ?? 0.12 },
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
                depthTest: false,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });

            const mesh = new THREE.Mesh(tubeGeometry, material);
            mesh.renderOrder = pathRenderOrder;  // 同一路径内所有分段使用相同renderOrder
            silkMaterials.push(material);  // 收集材质用于后续uTime更新
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

        type PathPoint = { x: number; y: number; z?: number; pressure: number };
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

            const radiusScale = pressureMode === 'calligraphy' ? (0.3 + 2.7 * peSeg) : 1.0;  // 书法压感：粗细变化约10倍
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
                    // 波动参数 (与光环系统一致)
                    uWaveType: { value: settings.waveType === 'sine' ? 1.0 : settings.waveType === 'triangle' ? 2.0 : 0.0 },
                    uWobbleFrequency: { value: settings.wobbleFrequency ?? 10.0 },
                    uWobbleAmplitude: { value: settings.wobbleAmplitude ?? 0.5 },
                    // 视觉效果参数
                    uStrandDensity: { value: settings.strandDensity ?? 30.0 },
                    uSparkleEnabled: { value: settings.sparkleEnabled ? 1.0 : 0.0 },
                    uSparkleThreshold: { value: settings.sparkleThreshold ?? 0.95 },
                    uFresnelPower: { value: settings.fresnelPower ?? 2.0 },
                    uOpacity: { value: baseOpacity * opacityScale },
                    uEmissive: { value: baseEmissive * emissiveScale },
                    uBloomBoost: { value: settings.bloomBoost ?? 0.12 },
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
                depthTest: false,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1
            });

            const mesh = new THREE.Mesh(tubeGeometry, material);
            mesh.renderOrder = pathRenderOrder;  // 同一路径内所有分段使用相同renderOrder
            silkMaterials.push(material);  // 收集材质用于后续uTime更新
            group.add(mesh);
        }
    }

    // 将材质列表存储到group.userData，以便在动画循环中更新uTime
    group.userData.silkMaterials = silkMaterials;

    return group;
}

// ==================== 创建网格画笔笔画 (Web/Plexus效果) ====================

export function createWebStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: {
        historyLimit?: number;
        connectionsPerFrame?: number;
        minDistance?: number;
        maxDistance?: number;
        lineOpacity?: number;
        glowIntensity?: number;
        colorMode?: 'rainbow' | 'fixed';
        rainbowSpeed?: number;
        pressureMode?: 'none' | 'opacity' | 'density';
        distanceFade?: number;
        brightness?: number;
    },
    symmetryMode: SymmetryMode,
    symmetryDivisions: number,
    historyPoints: THREE.Vector3[],
    hueRef: { value: number },
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
    },
    symmetryParams?: SymmetryParams,
    globalStartIndex: number = 0,
    startHue?: number
): THREE.Group {
    const group = new THREE.Group();

    if (points.length < 1) return group;

    // 提取设置参数
    const connectionsPerFrame = settings.connectionsPerFrame ?? 3;
    // 距离参数在设置中是 0-100 的值，需要除以 100 转换为归一化坐标(0-1)
    const minDistance = (settings.minDistance ?? 0.5) / 100;
    const maxDistance = (settings.maxDistance ?? 15) / 100;
    const lineOpacity = settings.lineOpacity ?? 0.4;
    const glowIntensity = settings.glowIntensity ?? 1.5;
    const colorMode = settings.colorMode ?? 'rainbow';
    const rainbowSpeed = settings.rainbowSpeed ?? 1;
    const pressureMode = settings.pressureMode ?? 'none';
    const historyLimit = settings.historyLimit ?? 20; // 滑动窗口大小
    const distanceFade = settings.distanceFade ?? 1.0; // 距离衰减强度
    const lineBrightness = settings.brightness ?? 1.0; // 线条亮度
    const mcOpacity = magicCircleSettings?.opacity ?? 1.0;
    const mcBrightness = magicCircleSettings?.brightness ?? 1.0;
    const mcSettings = magicCircleSettings || {};
    const webMaterials: THREE.ShaderMaterial[] = [];

    // 如果提供了 startHue，从该值开始计算色相
    if (startHue !== undefined) {
        hueRef.value = startHue;
    }

    // 将当前笔画点转换为 THREE.Vector3 并添加到历史
    const currentPoints: THREE.Vector3[] = [];
    for (const pt of points) {
        // 坐标归一化：从(0,1)转换为(-0.5, 0.5)
        const x = pt.x - 0.5;
        const y = 0.5 - pt.y; // Y轴翻转
        currentPoints.push(new THREE.Vector3(x, y, 0));
    }

    // 收集所有需要绘制的线段
    const lineSegments: { start: THREE.Vector3; end: THREE.Vector3; opacity: number; color: THREE.Color }[] = [];

    // 对每个当前点
    for (let i = 0; i < currentPoints.length; i++) {
        const currentPoint = currentPoints[i];
        const pressure = points[i].pressure;

        // 更新色相（彩虹模式）
        if (colorMode === 'rainbow') {
            hueRef.value = (hueRef.value + rainbowSpeed) % 360;
        }

        // 计算颜色
        let lineColor: THREE.Color;
        if (colorMode === 'rainbow') {
            lineColor = new THREE.Color().setHSL(hueRef.value / 360, 1, 0.6);
        } else {
            lineColor = new THREE.Color(color);
        }

        // 应用亮度
        lineColor.multiplyScalar(mcBrightness * lineBrightness * glowIntensity * 0.5);

        // 从历史点中随机选择连接目标
        const connectionCount = Math.min(connectionsPerFrame, historyPoints.length);

        for (let c = 0; c < connectionCount; c++) {
            if (historyPoints.length === 0) break;

            // 随机选择一个历史点 (使用确定性随机以防止闪烁)
            const globalIndex = globalStartIndex + i;
            const seed = globalIndex * 997 + c * 331 + historyPoints.length * 13;
            // 伪随机：sin(seed)的小数部分
            let rand = Math.sin(seed) * 10000;
            rand = rand - Math.floor(rand);

            const targetIndex = Math.floor(rand * historyPoints.length);
            const targetPoint = historyPoints[targetIndex];

            // 计算距离
            const dist = currentPoint.distanceTo(targetPoint);

            // 只在距离范围内建立连接
            if (dist >= minDistance && dist <= maxDistance) {
                // 计算透明度（压感影响）
                let opacity = lineOpacity * mcOpacity;
                if (pressureMode === 'opacity') {
                    opacity *= 0.3 + pressure * 0.7;
                }

                // 距离衰减 (使用 distanceFade 参数)
                const distFactor = 1 - (dist - minDistance) / (maxDistance - minDistance);
                opacity *= Math.pow(distFactor, distanceFade * 2);

                lineSegments.push({
                    start: currentPoint.clone(),
                    end: targetPoint.clone(),
                    opacity: opacity,
                    color: lineColor.clone()
                });
            }
        }

        // 将当前点添加到历史
        historyPoints.push(currentPoint.clone());

        // 应用滑动窗口限制
        while (historyPoints.length > historyLimit) {
            historyPoints.shift();
        }
    }

    // ========== 性能优化：批量渲染所有线段 ==========
    // 收集所有线段的顶点、颜色、透明度到单一数组
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const allOpacities: number[] = [];

    for (const seg of lineSegments) {
        // 修复：将线段作为迷你路径处理，确保起点和终点在同一对称变换轨道上
        // 这解决了星芒/漩涡模式下起点和终点被独立变换导致连线方向错乱的问题
        const miniPath = [
            { x: seg.start.x, y: seg.start.y, pressure: 1 },
            { x: seg.end.x, y: seg.end.y, pressure: 1 }
        ];

        const transformedPaths = applySymmetryToPath(miniPath, symmetryMode, symmetryDivisions, symmetryParams);

        // 为每条变换后的路径添加线段到批量数组
        for (const path of transformedPaths) {
            if (path.length < 2) continue;

            const sp = path[0];
            const ep = path[1];

            // 添加起点和终点位置
            allPositions.push(sp.x, sp.y, sp.z ?? 0);
            allPositions.push(ep.x, ep.y, ep.z ?? 0);

            // 添加颜色（两个顶点使用相同颜色）
            allColors.push(seg.color.r, seg.color.g, seg.color.b);
            allColors.push(seg.color.r, seg.color.g, seg.color.b);

            // 添加透明度
            allOpacities.push(seg.opacity);
            allOpacities.push(seg.opacity);
        }
    }


    // 如果没有线段，直接返回空组
    if (allPositions.length === 0) {
        return group;
    }

    // 创建单一批量几何体
    const batchGeometry = new THREE.BufferGeometry();
    batchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    batchGeometry.setAttribute('instanceColor', new THREE.Float32BufferAttribute(allColors, 3));
    batchGeometry.setAttribute('instanceOpacity', new THREE.Float32BufferAttribute(allOpacities, 1));

    // 创建单一材质（而不是每条线都创建一个）
    const batchMaterial = new THREE.ShaderMaterial({
        vertexShader: webBrushVertexShader,
        fragmentShader: webBrushFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
            uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360 },
            uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
            uMCPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
            uMCPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
            uMCPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 },
            // 染色功能参数
            uMCBaseHue: { value: mcSettings.baseHue ?? 200 },
            uMCBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
            uMCSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
            uMCColorMode: { value: mcSettings.colorMode ?? 0 },
            uMCColor1: { value: mcSettings.color1 ?? new THREE.Vector3(1, 1, 1) },
            uMCColor2: { value: mcSettings.color2 ?? new THREE.Vector3(1, 1, 1) },
            uMCColor3: { value: mcSettings.color3 ?? new THREE.Vector3(1, 1, 1) },
            uMCColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
            uMCProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
    });

    // 使用 LineSegments 而不是多个 Line（每对顶点形成一条线段）
    const batchLines = new THREE.LineSegments(batchGeometry, batchMaterial);
    group.add(batchLines);

    // 存储单一材质用于动画更新
    group.userData.webMaterials = [batchMaterial];

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

    // border已移除，用CSS实现
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
        } else if (stroke.brushType === 'lightsaber') {
            strokeMesh = createLightsaberStrokeMesh(
                stroke.points,
                stroke.color,
                stroke.lightsaberSettings || {},
                layer.symmetryMode,
                layer.symmetryDivisions
            );
        } else if (stroke.brushType === 'web' || (stroke.webSettings && Object.keys(stroke.webSettings).length > 0)) {
            // console.log('[DrawingSystem] Rendering Web Stroke:', stroke.id);
            strokeMesh = createWebStrokeMesh(
                stroke.points,
                stroke.color,
                stroke.webSettings || {},
                layer.symmetryMode,
                layer.symmetryDivisions,
                [], // 重建时使用新的历史记录
                { value: 0 },
                undefined,
                layer.symmetryParams,
                0, // globalStartIndex
                stroke.startHue // 使用保存的起始色相
            );
        } else {
            // Default to LineRing (Silk)
            // console.log('[DrawingSystem] Rendering Line/Silk Stroke:', stroke.id, stroke.brushType);
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
