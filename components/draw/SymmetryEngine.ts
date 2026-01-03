/**
 * SymmetryEngine - 对称计算引擎
 * 
 * input: 2D 笔触点坐标、对称设置
 * output: 应用对称变换后的点集合
 * pos: 绘图系统核心模块，负责 2D 和 3D 对称变换计算
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import * as THREE from 'three';
import { Symmetry2DMode, Symmetry3DMode, SymmetrySettings } from '../../types';

// 2D 点类型
export interface Point2D {
    x: number;
    y: number;
    pressure: number;
}

// 3D 点类型
export interface Point3D {
    x: number;
    y: number;
    z: number;
    pressure: number;
}

// ==================== 2D 对称变换 ====================

/**
 * 自由角度镜像变换
 * 给定对称轴角度 θ，围绕该轴进行镜像
 */
export function mirrorPointByAngle(p: Point2D, axisAngle: number, center: { x: number; y: number }): Point2D {
    const theta = axisAngle * Math.PI / 180;
    const cos2 = Math.cos(2 * theta);
    const sin2 = Math.sin(2 * theta);

    // 平移到中心
    const dx = p.x - center.x;
    const dy = p.y - center.y;

    // 镜像变换矩阵: [cos(2θ), sin(2θ); sin(2θ), -cos(2θ)]
    const mx = dx * cos2 + dy * sin2;
    const my = dx * sin2 - dy * cos2;

    return {
        x: mx + center.x,
        y: my + center.y,
        pressure: p.pressure
    };
}

/**
 * 径向旋转复制
 * 将点绕中心旋转 N 等分
 */
export function radialPoints(p: Point2D, segments: number, center: { x: number; y: number }): Point2D[] {
    const points: Point2D[] = [];
    const angleStep = (2 * Math.PI) / segments;

    for (let i = 0; i < segments; i++) {
        const angle = i * angleStep;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const dx = p.x - center.x;
        const dy = p.y - center.y;

        points.push({
            x: dx * cos - dy * sin + center.x,
            y: dx * sin + dy * cos + center.y,
            pressure: p.pressure
        });
    }

    return points;
}

/**
 * 万花筒效果
 * 旋转复制 + 每隔一个扇区进行内部镜像
 */
export function kaleidoscopePoints(p: Point2D, segments: number, center: { x: number; y: number }): Point2D[] {
    const points: Point2D[] = [];
    const sectorAngle = (2 * Math.PI) / segments;

    for (let i = 0; i < segments; i++) {
        const angle = i * sectorAngle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        let dx = p.x - center.x;
        let dy = p.y - center.y;

        // 奇数扇区：先做轴对称（围绕扇区中线）
        if (i % 2 === 1) {
            // 镜像变换：围绕扇区中线
            const midAngle = (i + 0.5) * sectorAngle;
            const cos2m = Math.cos(2 * midAngle);
            const sin2m = Math.sin(2 * midAngle);
            const mx = dx * cos2m + dy * sin2m;
            const my = dx * sin2m - dy * cos2m;
            dx = mx;
            dy = my;
        }

        // 应用旋转
        points.push({
            x: dx * cos - dy * sin + center.x,
            y: dx * sin + dy * cos + center.y,
            pressure: p.pressure
        });
    }

    return points;
}

/**
 * 应用 2D 对称
 */
export function apply2DSymmetry(
    point: Point2D,
    settings: SymmetrySettings
): Point2D[] {
    const center = settings.centerOffset;

    switch (settings.mode2D) {
        case Symmetry2DMode.None:
            return [point];

        case Symmetry2DMode.MirrorX:
            return [
                point,
                { x: -point.x + 2 * center.x, y: point.y, pressure: point.pressure }
            ];

        case Symmetry2DMode.MirrorY:
            return [
                point,
                { x: point.x, y: -point.y + 2 * center.y, pressure: point.pressure }
            ];

        case Symmetry2DMode.MirrorQuad:
            return [
                point,
                { x: -point.x + 2 * center.x, y: point.y, pressure: point.pressure },
                { x: point.x, y: -point.y + 2 * center.y, pressure: point.pressure },
                { x: -point.x + 2 * center.x, y: -point.y + 2 * center.y, pressure: point.pressure }
            ];

        case Symmetry2DMode.MirrorDiagonal:
            return [
                point,
                { x: point.y - center.y + center.x, y: point.x - center.x + center.y, pressure: point.pressure }
            ];

        case Symmetry2DMode.MirrorFreeAngle:
            return [
                point,
                mirrorPointByAngle(point, settings.mirrorAxisAngle, center)
            ];

        case Symmetry2DMode.Radial:
            return radialPoints(point, settings.radialSegments, center);

        case Symmetry2DMode.Kaleidoscope:
            return kaleidoscopePoints(point, settings.radialSegments, center);

        default:
            return [point];
    }
}

// ==================== 3D 对称变换 ====================

// 正多面体面心向量（归一化）
const POLYHEDRON_FACES = {
    // 四面体 - 4个面
    tetrahedral: [
        new THREE.Vector3(1, 1, 1).normalize(),
        new THREE.Vector3(1, -1, -1).normalize(),
        new THREE.Vector3(-1, 1, -1).normalize(),
        new THREE.Vector3(-1, -1, 1).normalize()
    ],
    // 立方体/八面体 - 6个面（立方体）/ 8个面（八面体）
    cubic: [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ],
    octahedral: [
        new THREE.Vector3(1, 1, 1).normalize(),
        new THREE.Vector3(1, 1, -1).normalize(),
        new THREE.Vector3(1, -1, 1).normalize(),
        new THREE.Vector3(1, -1, -1).normalize(),
        new THREE.Vector3(-1, 1, 1).normalize(),
        new THREE.Vector3(-1, 1, -1).normalize(),
        new THREE.Vector3(-1, -1, 1).normalize(),
        new THREE.Vector3(-1, -1, -1).normalize()
    ],
    // 十二面体 - 12个五边形面
    dodecahedral: (() => {
        const phi = (1 + Math.sqrt(5)) / 2; // 黄金比例
        const faces: THREE.Vector3[] = [];
        // 使用十二面体的12个面心
        const coords = [
            [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
            [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
            [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
        ];
        coords.forEach(c => faces.push(new THREE.Vector3(c[0], c[1], c[2]).normalize()));
        return faces;
    })(),
    // 二十面体 - 20个三角形面
    icosahedral: (() => {
        const phi = (1 + Math.sqrt(5)) / 2;
        const faces: THREE.Vector3[] = [];
        // 二十面体20个面心近似位置
        const a = 1 / (phi * phi);
        for (let i = 0; i < 20; i++) {
            const theta = (i / 20) * 2 * Math.PI;
            const y = (i % 5 - 2) / 2;
            faces.push(new THREE.Vector3(
                Math.cos(theta + i * 0.5) * Math.sqrt(1 - y * y),
                y,
                Math.sin(theta + i * 0.5) * Math.sqrt(1 - y * y)
            ).normalize());
        }
        return faces;
    })()
};

/**
 * 行星自转对称（经度复制）
 * 将 2D 点映射到球面，然后沿经度复制
 */
export function planetSpinPoints(p: Point2D, segments: number): Point3D[] {
    const points: Point3D[] = [];
    const angleStep = (2 * Math.PI) / segments;

    // 将 2D 坐标 (x, y) 映射到球面
    // x -> 经度 θ, y -> 纬度 φ
    const theta = p.x * Math.PI; // -π to π
    const phi = (p.y + 1) * Math.PI / 2; // 0 to π

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let i = 0; i < segments; i++) {
        const offsetTheta = theta + i * angleStep;

        points.push({
            x: sinPhi * Math.cos(offsetTheta),
            y: cosPhi,
            z: sinPhi * Math.sin(offsetTheta),
            pressure: p.pressure
        });
    }

    return points;
}

/**
 * 对极对称（南北半球镜像）
 */
export function antipodalPoints(p: Point2D): Point3D[] {
    const theta = p.x * Math.PI;
    const phi = (p.y + 1) * Math.PI / 2;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const point: Point3D = {
        x: sinPhi * Math.cos(theta),
        y: cosPhi,
        z: sinPhi * Math.sin(theta),
        pressure: p.pressure
    };

    // 对极点
    const antipodal: Point3D = {
        x: -point.x,
        y: -point.y,
        z: -point.z,
        pressure: p.pressure
    };

    return [point, antipodal];
}

/**
 * 八分空间对称
 */
export function octantPoints(p: Point2D): Point3D[] {
    const theta = p.x * Math.PI;
    const phi = (p.y + 1) * Math.PI / 2;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const x = sinPhi * Math.cos(theta);
    const y = cosPhi;
    const z = sinPhi * Math.sin(theta);

    // 生成8个镜像点
    const signs = [
        [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
        [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
    ];

    return signs.map(([sx, sy, sz]) => ({
        x: x * sx,
        y: y * sy,
        z: z * sz,
        pressure: p.pressure
    }));
}

/**
 * 涡旋生长
 */
export function vortexPoints(
    p: Point2D,
    segments: number,
    twist: number,
    heightOffset: number,
    scaleDecay: number
): Point3D[] {
    const points: Point3D[] = [];
    const theta = p.x * Math.PI;
    const r = Math.abs(p.y);

    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const offsetAngle = theta + t * twist * Math.PI / 180;
        const scale = 1 - t * scaleDecay;
        const height = t * heightOffset;

        points.push({
            x: r * Math.cos(offsetAngle) * scale,
            y: height,
            z: r * Math.sin(offsetAngle) * scale,
            pressure: p.pressure * scale
        });
    }

    return points;
}

/**
 * 正多面体对称
 */
export function polyhedronPoints(
    p: Point2D,
    type: 'tetrahedral' | 'cubic' | 'octahedral' | 'dodecahedral' | 'icosahedral',
    mirror: boolean
): Point3D[] {
    const faces = POLYHEDRON_FACES[type];
    const points: Point3D[] = [];

    // 基准点（投影到第一个面）
    const baseNormal = new THREE.Vector3(0, 1, 0);
    const basePoint = new THREE.Vector3(p.x * 0.5, 0, p.y * 0.5);

    for (const faceNormal of faces) {
        // 计算从基准面到目标面的旋转
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(baseNormal, faceNormal);

        const rotatedPoint = basePoint.clone().applyQuaternion(quaternion);

        points.push({
            x: rotatedPoint.x,
            y: rotatedPoint.y,
            z: rotatedPoint.z,
            pressure: p.pressure
        });

        // 如果启用面内镜像，添加镜像点
        if (mirror) {
            // 简化：沿面的某一轴镜像
            const mirroredPoint = basePoint.clone();
            mirroredPoint.x = -mirroredPoint.x;
            mirroredPoint.applyQuaternion(quaternion);

            points.push({
                x: mirroredPoint.x,
                y: mirroredPoint.y,
                z: mirroredPoint.z,
                pressure: p.pressure
            });
        }
    }

    return points;
}

/**
 * 应用 3D 对称
 */
export function apply3DSymmetry(
    point: Point2D,
    settings: SymmetrySettings
): Point3D[] {
    switch (settings.mode3D) {
        case Symmetry3DMode.None:
            // 不应用 3D 对称，返回简单的 2D -> 3D 映射
            return [{
                x: point.x,
                y: 0,
                z: point.y,
                pressure: point.pressure
            }];

        case Symmetry3DMode.PlanetSpin:
            return planetSpinPoints(point, settings.spinSegments);

        case Symmetry3DMode.Antipodal:
            return antipodalPoints(point);

        case Symmetry3DMode.Octant:
            return octantPoints(point);

        case Symmetry3DMode.Vortex:
            return vortexPoints(
                point,
                settings.spinSegments,
                settings.vortexTwist,
                settings.vortexHeightOffset,
                settings.vortexScaleDecay
            );

        case Symmetry3DMode.Tetrahedral:
            return polyhedronPoints(point, 'tetrahedral', settings.polyhedronMirror);

        case Symmetry3DMode.Cubic:
            return polyhedronPoints(point, 'cubic', settings.polyhedronMirror);

        case Symmetry3DMode.Octahedral:
            return polyhedronPoints(point, 'octahedral', settings.polyhedronMirror);

        case Symmetry3DMode.Dodecahedral:
            return polyhedronPoints(point, 'dodecahedral', settings.polyhedronMirror);

        case Symmetry3DMode.Icosahedral:
            return polyhedronPoints(point, 'icosahedral', settings.polyhedronMirror);

        default:
            return [{
                x: point.x,
                y: 0,
                z: point.y,
                pressure: point.pressure
            }];
    }
}

// ==================== 组合应用 ====================

/**
 * 完整对称应用管线
 * 1. 先应用 2D 对称
 * 2. 再对每个 2D 点应用 3D 对称
 */
export function applySymmetry(
    point: Point2D,
    settings: SymmetrySettings
): Point3D[] {
    // 1. 应用 2D 对称
    const points2D = apply2DSymmetry(point, settings);

    // 2. 如果没有 3D 对称，直接返回 2D 点的简单 3D 映射
    if (settings.mode3D === Symmetry3DMode.None) {
        return points2D.map(p => ({
            x: p.x,
            y: 0,
            z: p.y,
            pressure: p.pressure
        }));
    }

    // 3. 对每个 2D 点应用 3D 对称
    const result: Point3D[] = [];
    for (const p2d of points2D) {
        const points3D = apply3DSymmetry(p2d, settings);
        result.push(...points3D);
    }

    return result;
}

export default {
    apply2DSymmetry,
    apply3DSymmetry,
    applySymmetry,
    mirrorPointByAngle,
    radialPoints,
    kaleidoscopePoints,
    planetSpinPoints,
    antipodalPoints,
    octantPoints,
    vortexPoints,
    polyhedronPoints
};
