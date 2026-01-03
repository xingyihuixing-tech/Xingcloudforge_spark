/**
 * HoloPad - 2D 绘图画布组件
 * 
 * input: DrawSettings 状态、setSettings 回调
 * output: 渲染 2D 画布、捕获用户输入、显示对称辅助线、持久化笔触
 * pos: 绘图系统的用户交互入口
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { DrawSettings, Symmetry2DMode, BrushType } from '../../types';
import { apply2DSymmetry, Point2D } from './SymmetryEngine';
import {
    ensureActiveDrawingAndLayer,
    createStroke,
    addStroke,
    getActiveDrawing,
    getActiveLayer
} from './DrawingManager';

interface HoloPadProps {
    settings: DrawSettings;
    setSettings: React.Dispatch<React.SetStateAction<DrawSettings>>;
    containerRef?: React.RefObject<HTMLDivElement>; // 用于获取3D场景容器位置
}

// 笔刷颜色映射
const BRUSH_COLORS: Record<BrushType, string> = {
    [BrushType.Stardust]: '#88ccff',
    [BrushType.GasCloud]: '#aaddff',
    [BrushType.EnergyBeam]: '#ffcc00',
    [BrushType.SpiralRing]: '#ff88cc',
    [BrushType.Firefly]: '#88ff88',
    [BrushType.Fracture]: '#ff6644'
};

const HoloPad: React.FC<HoloPadProps> = ({ settings, setSettings, containerRef }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Point2D[]>([]);
    const lastPointRef = useRef<Point2D | null>(null);
    const animationFrameRef = useRef<number>(0);

    // 画布尺寸 - 正方形，适应场景
    const canvasSize = useMemo(() => {
        return Math.min(500, window.innerHeight * 0.6);
    }, []);

    // 获取归一化坐标（-1 到 1）
    const getNormalizedCoords = useCallback((e: React.PointerEvent): Point2D => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;

        return { x, y, pressure };
    }, []);

    // 画布坐标转换（归一化 -> 画布像素）
    const toCanvasCoords = useCallback((p: Point2D, canvas: HTMLCanvasElement) => {
        return {
            x: (p.x + 1) / 2 * canvas.width,
            y: (p.y + 1) / 2 * canvas.height
        };
    }, []);

    // 绘制对称辅助线
    const drawSymmetryGuides = useCallback((ctx: CanvasRenderingContext2D) => {
        if (!settings.showSymmetryGuides) return;

        const { width, height } = ctx.canvas;
        // 中心偏移：centerOffset 是归一化坐标 (-1 到 1)
        const centerX = width / 2 * (1 + settings.symmetry.centerOffset.x);
        const centerY = height / 2 * (1 + settings.symmetry.centerOffset.y);

        ctx.save();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);

        const { mode2D, radialSegments, mirrorAxisAngle } = settings.symmetry;

        switch (mode2D) {
            case Symmetry2DMode.MirrorX:
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, height);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorY:
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorQuad:
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, height);
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorDiagonal:
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(width, height);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorFreeAngle:
                const angle = (mirrorAxisAngle - 90) * Math.PI / 180;
                const len = Math.max(width, height);
                ctx.beginPath();
                ctx.moveTo(centerX - Math.cos(angle) * len, centerY - Math.sin(angle) * len);
                ctx.lineTo(centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
                ctx.stroke();
                break;

            case Symmetry2DMode.Radial:
            case Symmetry2DMode.Kaleidoscope:
                for (let i = 0; i < radialSegments; i++) {
                    const a = (i / radialSegments) * Math.PI * 2 - Math.PI / 2;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(centerX + Math.cos(a) * width, centerY + Math.sin(a) * height);
                    ctx.stroke();
                }
                break;
        }

        // 绘制中心点
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 180, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 180, 100, 0.3)';
        ctx.fill();

        ctx.restore();
    }, [settings.showSymmetryGuides, settings.symmetry]);

    // 绘制单个笔触的对称预览
    const drawStrokeWithSymmetry = useCallback((
        ctx: CanvasRenderingContext2D,
        points: Point2D[],
        color: string,
        lineWidth: number,
        opacity: number
    ) => {
        if (points.length < 2) return;

        // 应用对称获取所有点集
        const allSymmetricStrokes: Point2D[][] = [];
        const numSymmetries = apply2DSymmetry(points[0], settings.symmetry).length;

        // 为每个对称索引创建一条完整的线
        for (let symIdx = 0; symIdx < numSymmetries; symIdx++) {
            const symmetricLine: Point2D[] = [];
            for (const p of points) {
                const symmetricPoints = apply2DSymmetry(p, settings.symmetry);
                if (symmetricPoints[symIdx]) {
                    symmetricLine.push(symmetricPoints[symIdx]);
                }
            }
            allSymmetricStrokes.push(symmetricLine);
        }

        // 绘制每条对称线
        allSymmetricStrokes.forEach((stroke, idx) => {
            if (stroke.length < 2) return;

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = opacity * (idx === 0 ? 1 : 0.7);

            const first = toCanvasCoords(stroke[0], ctx.canvas);
            ctx.moveTo(first.x, first.y);

            for (let i = 1; i < stroke.length; i++) {
                const pt = toCanvasCoords(stroke[i], ctx.canvas);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        });

        ctx.globalAlpha = 1;
    }, [settings.symmetry, toCanvasCoords]);

    // 重绘整个画布（包括已保存的笔触和当前笔触）
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制对称辅助线
        drawSymmetryGuides(ctx);

        // 获取当前激活的绘图和图层
        const activeDrawing = getActiveDrawing(settings);
        if (activeDrawing) {
            // 绘制所有可见图层的已保存笔触
            for (const layer of activeDrawing.layers) {
                if (!layer.visible) continue;

                const layerColor = layer.color || settings.brush.color;

                for (const stroke of layer.strokes) {
                    // 从 Float32Array 还原点数据
                    const points: Point2D[] = [];
                    const numPoints = stroke.points.length / 4;
                    for (let i = 0; i < numPoints; i++) {
                        points.push({
                            x: stroke.points[i * 4],
                            y: stroke.points[i * 4 + 1],
                            pressure: stroke.points[i * 4 + 2]
                        });
                    }

                    // 使用笔触创建时的对称设置绘制
                    const savedSymmetry = stroke.symmetrySnapshot;
                    const originalSymmetry = settings.symmetry;

                    // 临时应用保存的对称设置
                    const tempSettings = { ...settings, symmetry: savedSymmetry };

                    // 计算对称点并绘制
                    const numSymmetries = apply2DSymmetry(points[0], savedSymmetry).length;
                    for (let symIdx = 0; symIdx < numSymmetries; symIdx++) {
                        const symmetricLine: Point2D[] = [];
                        for (const p of points) {
                            const symmetricPoints = apply2DSymmetry(p, savedSymmetry);
                            if (symmetricPoints[symIdx]) {
                                symmetricLine.push(symmetricPoints[symIdx]);
                            }
                        }

                        if (symmetricLine.length >= 2) {
                            ctx.beginPath();
                            ctx.strokeStyle = layerColor;
                            ctx.lineWidth = settings.brush.size * 0.5;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.globalAlpha = settings.brush.opacity * (symIdx === 0 ? 1 : 0.7);

                            const first = toCanvasCoords(symmetricLine[0], canvas);
                            ctx.moveTo(first.x, first.y);
                            for (let i = 1; i < symmetricLine.length; i++) {
                                const pt = toCanvasCoords(symmetricLine[i], canvas);
                                ctx.lineTo(pt.x, pt.y);
                            }
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        // 绘制当前正在绘制的笔触
        if (currentStroke.length > 0) {
            const brushColor = settings.brush.color || BRUSH_COLORS[settings.brush.type];
            drawStrokeWithSymmetry(
                ctx,
                currentStroke,
                brushColor,
                settings.brush.size * 0.5,
                settings.brush.opacity
            );
        }

        ctx.globalAlpha = 1;
    }, [settings, currentStroke, drawSymmetryGuides, drawStrokeWithSymmetry, toCanvasCoords]);

    // 监听设置变化，重绘画布
    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // 开始绘制
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!settings.enabled) return;

        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        // 确保有激活的绘图和图层
        setSettings(prev => ensureActiveDrawingAndLayer(prev));

        const point = getNormalizedCoords(e);
        setIsDrawing(true);
        setCurrentStroke([point]);
        lastPointRef.current = point;
    }, [settings.enabled, getNormalizedCoords, setSettings]);

    // 绘制中
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        const point = getNormalizedCoords(e);

        // 距离阈值检查
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
            const dx = point.x - lastPoint.x;
            const dy = point.y - lastPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.008) return; // 太近则跳过
        }

        setCurrentStroke(prev => [...prev, point]);
        lastPointRef.current = point;

        // 使用 requestAnimationFrame 节流重绘
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(redrawCanvas);
    }, [isDrawing, getNormalizedCoords, redrawCanvas]);

    // 结束绘制
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setIsDrawing(false);

        if (currentStroke.length < 2) {
            setCurrentStroke([]);
            return;
        }

        // 将笔触数据转换为 Float32Array
        const strokeData = new Float32Array(currentStroke.length * 4);
        currentStroke.forEach((p, i) => {
            strokeData[i * 4] = p.x;
            strokeData[i * 4 + 1] = p.y;
            strokeData[i * 4 + 2] = p.pressure;
            strokeData[i * 4 + 3] = 0; // 保留位
        });

        // 保存笔触到当前图层
        setSettings(prev => {
            const drawing = getActiveDrawing(prev);
            const layer = getActiveLayer(prev);
            if (!drawing || !layer) return prev;

            const stroke = createStroke(strokeData, prev.symmetry);
            return addStroke(prev, drawing.id, layer.id, stroke);
        });

        // 清除当前笔触，触发重绘
        setCurrentStroke([]);
    }, [isDrawing, currentStroke, setSettings]);

    // 如果绘图模式未启用，不渲染
    if (!settings.enabled) {
        return null;
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
                pointerEvents: 'auto'
            }}
        >
            <canvas
                ref={canvasRef}
                width={canvasSize * 2}
                height={canvasSize * 2}
                style={{
                    width: canvasSize,
                    height: canvasSize,
                    borderRadius: '16px',
                    background: `rgba(10, 15, 30, ${settings.padOpacity})`,
                    border: '2px solid rgba(100, 200, 255, 0.3)',
                    boxShadow: '0 0 40px rgba(100, 200, 255, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)',
                    cursor: 'crosshair',
                    touchAction: 'none'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* 底部状态栏 */}
            <div style={{
                position: 'absolute',
                bottom: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '11px',
                color: '#88ccff',
                whiteSpace: 'nowrap'
            }}>
                <span>
                    <i className="fas fa-paint-brush" style={{ marginRight: 4 }} />
                    {settings.brush.type}
                </span>
                <span>|</span>
                <span>
                    <i className="fas fa-expand-arrows-alt" style={{ marginRight: 4 }} />
                    {settings.symmetry.mode2D}
                    {(settings.symmetry.mode2D === Symmetry2DMode.Radial ||
                        settings.symmetry.mode2D === Symmetry2DMode.Kaleidoscope) &&
                        ` (${settings.symmetry.radialSegments})`}
                </span>
                <span>|</span>
                <span>
                    {getActiveDrawing(settings)?.name || '无'} / {getActiveLayer(settings)?.name || '无'}
                </span>
            </div>
        </div>
    );
};

export default HoloPad;
