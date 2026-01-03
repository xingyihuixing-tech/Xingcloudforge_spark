/**
 * Ink2DRenderer - 2D 墨迹渲染器
 * 
 * input: 笔触数据、笔刷设置
 * output: 在 Canvas 2D 上渲染各种墨迹效果
 * pos: 直接在 HoloPad 画布上渲染可见的墨迹效果
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import { BrushType, BrushSettings } from '../../types';
import { Point2D } from './SymmetryEngine';

// 随机数生成器（带种子）
function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

// ==================== 星尘笔效果 ====================
export function renderStardust(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 1) return;

    const random = seededRandom(12345);

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const pressure = p.pressure || 0.5;

        // 每个点生成多个粒子
        const particleCount = Math.floor(3 + pressure * 5);
        const scatter = size * 1.5;

        for (let j = 0; j < particleCount; j++) {
            const offsetX = (random() - 0.5) * scatter;
            const offsetY = (random() - 0.5) * scatter;
            const particleSize = (1 + random() * 2) * pressure * (size / 10);

            // 闪烁效果
            const twinkle = Math.sin(time * 3 + i * 0.5 + j * 1.2) * 0.3 + 0.7;

            ctx.save();
            ctx.globalAlpha = opacity * twinkle * (0.5 + pressure * 0.5);

            // 发光效果
            ctx.shadowColor = color;
            ctx.shadowBlur = particleSize * 3;

            ctx.beginPath();
            ctx.arc(p.x + offsetX, p.y + offsetY, particleSize, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.restore();
        }
    }
}

// ==================== 气云笔效果 ====================
export function renderGasCloud(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 1) return;

    const random = seededRandom(54321);

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const pressure = p.pressure || 0.5;
        const cloudSize = size * (1 + pressure) * 2;

        // 多层云雾效果
        for (let layer = 0; layer < 3; layer++) {
            const layerOffset = layer * 5;
            const flowOffset = Math.sin(time * 0.5 + i * 0.3) * 10;

            ctx.save();
            ctx.globalAlpha = opacity * 0.3 * (1 - layer * 0.2);

            // 创建径向渐变模拟云雾
            const gradient = ctx.createRadialGradient(
                p.x + flowOffset, p.y + layerOffset,
                0,
                p.x + flowOffset, p.y + layerOffset,
                cloudSize
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(p.x + flowOffset, p.y + layerOffset, cloudSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.restore();
        }
    }
}

// ==================== 能量束笔效果 ====================
export function renderEnergyBeam(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 2) return;

    // 发光的核心线
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 外层辉光
    ctx.lineWidth = size * 0.8;
    ctx.globalAlpha = opacity * 0.3;
    ctx.shadowBlur = size * 4;
    ctx.stroke();

    // 电弧效果
    const random = seededRandom(Math.floor(time * 5));
    ctx.lineWidth = 1;
    ctx.globalAlpha = opacity * 0.5;

    for (let i = 1; i < points.length; i += 3) {
        if (random() > 0.7) {
            const p = points[i];
            const arcLength = size * (1 + random() * 2);
            const angle = random() * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(
                p.x + Math.cos(angle) * arcLength,
                p.y + Math.sin(angle) * arcLength
            );
            ctx.stroke();
        }
    }

    ctx.restore();
}

// ==================== 螺旋环笔效果 ====================
export function renderSpiralRing(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 2) return;

    const spiralDensity = 5;
    const rotationSpeed = time * 2;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const pressure = p.pressure || 0.5;
        const t = i / points.length;

        // 双螺旋
        for (let helix = 0; helix < 2; helix++) {
            const angle = t * Math.PI * 2 * spiralDensity + rotationSpeed + helix * Math.PI;
            const radius = size * 0.5 * pressure;
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius * 0.3; // 压缩成椭圆

            ctx.save();
            ctx.globalAlpha = opacity * (0.5 + pressure * 0.5);
            ctx.shadowColor = color;
            ctx.shadowBlur = size * 0.5;

            ctx.beginPath();
            ctx.arc(p.x + offsetX, p.y + offsetY, size * 0.15 * pressure, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.restore();
        }
    }

    // 连接线
    ctx.save();
    ctx.globalAlpha = opacity * 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

// ==================== 流萤笔效果 ====================
export function renderFirefly(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 1) return;

    // 头部光点
    const lastPoint = points[points.length - 1];
    const pulse = Math.sin(time * 5) * 0.3 + 0.7;

    ctx.save();
    ctx.globalAlpha = opacity * pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 3;

    // 星芒效果
    const flareCount = 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < flareCount; i++) {
        const angle = (i / flareCount) * Math.PI * 2 + time * 2;
        const len = size * 1.5 * pulse;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(
            lastPoint.x + Math.cos(angle) * len,
            lastPoint.y + Math.sin(angle) * len
        );
        ctx.stroke();
    }

    // 核心光点
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.arc(lastPoint.x, lastPoint.y, size * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();

    // 拖尾效果
    if (points.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';

        for (let i = 0; i < points.length - 1; i++) {
            const t = i / (points.length - 1);
            ctx.globalAlpha = opacity * t * 0.5;
            ctx.strokeStyle = color;
            ctx.lineWidth = size * 0.3 * t;
            ctx.shadowColor = color;
            ctx.shadowBlur = size * t;

            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[i + 1].x, points[i + 1].y);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// ==================== 裂痕笔效果 ====================
export function renderFracture(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    if (points.length < 2) return;

    const random = seededRandom(99999);

    // 主裂纹线
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.4;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = size;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        // 添加随机抖动模拟裂纹
        const jitterX = (random() - 0.5) * size * 0.3;
        const jitterY = (random() - 0.5) * size * 0.3;
        ctx.lineTo(points[i].x + jitterX, points[i].y + jitterY);
    }
    ctx.stroke();

    // 分叉裂纹
    ctx.lineWidth = size * 0.2;
    ctx.globalAlpha = opacity * 0.6;

    for (let i = 2; i < points.length; i += 4) {
        if (random() > 0.5) {
            const p = points[i];
            const branchLen = size * (1 + random() * 2);
            const angle = random() * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);

            // 锯齿状分叉
            let bx = p.x, by = p.y;
            for (let j = 0; j < 3; j++) {
                bx += Math.cos(angle + (random() - 0.5) * 0.5) * branchLen / 3;
                by += Math.sin(angle + (random() - 0.5) * 0.5) * branchLen / 3;
                ctx.lineTo(bx, by);
            }
            ctx.stroke();
        }
    }

    ctx.restore();
}

// ==================== 统一渲染入口 ====================
export function renderBrushEffect(
    ctx: CanvasRenderingContext2D,
    points: Point2D[],
    brushType: BrushType,
    color: string,
    size: number,
    opacity: number,
    time: number
): void {
    switch (brushType) {
        case BrushType.Stardust:
            renderStardust(ctx, points, color, size, opacity, time);
            break;
        case BrushType.GasCloud:
            renderGasCloud(ctx, points, color, size, opacity, time);
            break;
        case BrushType.EnergyBeam:
            renderEnergyBeam(ctx, points, color, size, opacity, time);
            break;
        case BrushType.SpiralRing:
            renderSpiralRing(ctx, points, color, size, opacity, time);
            break;
        case BrushType.Firefly:
            renderFirefly(ctx, points, color, size, opacity, time);
            break;
        case BrushType.Fracture:
            renderFracture(ctx, points, color, size, opacity, time);
            break;
        default:
            // 默认简单线条
            if (points.length >= 2) {
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.strokeStyle = color;
                ctx.lineWidth = size * 0.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
                ctx.restore();
            }
    }
}

export default {
    renderStardust,
    renderGasCloud,
    renderEnergyBeam,
    renderSpiralRing,
    renderFirefly,
    renderFracture,
    renderBrushEffect
};
