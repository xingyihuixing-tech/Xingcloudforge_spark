/**
 * input: customMagicCircles data, drawing mode state from App.tsx
 * output: 3D drawing canvas with orthographic camera, particle/silk ring stroke rendering
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
    camera: THREE.OrthographicCamera | null;
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
    camera: THREE.OrthographicCamera;
    canvasGroup: THREE.Group;
    strokesGroup: THREE.Group;
    symmetryAxesGroup: THREE.Group;
    centerPoint: THREE.Mesh;
    border: THREE.LineLoop;
} {
    // 创建独立场景
    const scene = new THREE.Scene();
    scene.background = null; // 透明背景

    // 创建正交相机 (固定看向 XY 平面)
    const aspect = 1; // 正方形画布
    const frustumSize = 1;
    const camera = new THREE.OrthographicCamera(
        -frustumSize / 2, frustumSize / 2,
        frustumSize / 2, -frustumSize / 2,
        0.1, 10
    );
    camera.position.set(0, 0, 1);
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
    symmetryDivisions: number
): THREE.Points {
    // 沿路径采样粒子位置
    const particlePositions: number[] = [];
    const particleSizes: number[] = [];
    const particleColors: number[] = [];
    const particleAlphas: number[] = [];

    const baseSize = settings.particleDensity || 1;
    const colorObj = new THREE.Color(color);

    // 对每个采样点应用对称变换
    for (const point of points) {
        const symmetricPoints = applySymmetryTransform(
            { x: point.x - 0.5, y: 0.5 - point.y }, // 转换到画布坐标系
            symmetryMode,
            symmetryDivisions
        );

        for (const sp of symmetricPoints) {
            // 添加一些抖动
            const jitter = (settings.bandwidth || 5) * 0.001;
            const jx = (Math.random() - 0.5) * jitter;
            const jy = (Math.random() - 0.5) * jitter;

            particlePositions.push(sp.x + jx, sp.y + jy, 0);
            particleSizes.push(baseSize * (0.5 + point.pressure * 0.5) * 0.02);
            particleColors.push(colorObj.r, colorObj.g, colorObj.b);
            particleAlphas.push(0.8);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(particleSizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(particleColors, 3));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(particleAlphas, 1));

    // 简化的粒子着色器 (复用粒子环核心逻辑)
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uGlowIntensity: { value: settings.brightness || 1.5 }
        },
        vertexShader: `
      attribute float size;
      attribute float alpha;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      uniform float uGlowIntensity;
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        
        float alpha = smoothstep(0.5, 0.0, dist);
        alpha = pow(alpha, 1.0 / uGlowIntensity);
        
        gl_FragColor = vec4(vColor, alpha * vAlpha);
      }
    `,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Points(geometry, material);
    mesh.renderOrder = 50;
    return mesh;
}

// ==================== 创建线环画笔笔画 (复用丝环着色器) ====================

export function createLineStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: Partial<SilkRingSettings>,
    symmetryMode: SymmetryMode,
    symmetryDivisions: number
): THREE.Group {
    const group = new THREE.Group();

    if (points.length < 2) return group;

    const colorObj = new THREE.Color(color);
    const lineWidth = (settings.thickness || 0.05) * 0.5;

    // 为每个对称副本创建线条
    const allPaths: THREE.Vector3[][] = [];

    // 生成路径点
    const basePath: { x: number; y: number }[] = points.map(p => ({
        x: p.x - 0.5,
        y: 0.5 - p.y
    }));

    if (symmetryMode === 'none') {
        allPaths.push(basePath.map(p => new THREE.Vector3(p.x, p.y, 0)));
    } else {
        // 对整条路径应用对称
        for (let i = 0; i < symmetryDivisions; i++) {
            const angle = (Math.PI * 2 / symmetryDivisions) * i;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const transformedPath = basePath.map(p => {
                const x = p.x * cos - p.y * sin;
                const y = p.x * sin + p.y * cos;
                return new THREE.Vector3(x, y, 0);
            });
            allPaths.push(transformedPath);

            // 万花筒镜像
            if (symmetryMode === 'kaleidoscope') {
                const mirroredPath = transformedPath.map(v =>
                    new THREE.Vector3(-v.x, v.y, 0)
                );
                allPaths.push(mirroredPath);
            }
        }
    }

    // 为每条路径创建线条
    for (const path of allPaths) {
        const curve = new THREE.CatmullRomCurve3(path);
        const tubeGeometry = new THREE.TubeGeometry(curve, Math.max(8, path.length * 2), lineWidth, 8, false);

        const material = new THREE.MeshBasicMaterial({
            color: colorObj,
            transparent: true,
            opacity: settings.opacity || 0.8,
            depthTest: false,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(tubeGeometry, material);
        mesh.renderOrder = 51;
        group.add(mesh);
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
