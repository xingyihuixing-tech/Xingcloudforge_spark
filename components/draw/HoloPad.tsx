/**
 * HoloPad - 2D 绘图画布组件
 * 
 * input: DrawSettings 状态、setSettings 回调
 * output: 渲染 2D 画布，显示真实的墨迹效果和对称预览
 * pos: 绘图系统的用户交互核心
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { DrawSettings, Symmetry2DMode, BrushType } from '../../types';
import { apply2DSymmetry, Point2D } from './SymmetryEngine';
import { renderBrushEffect } from './Ink2DRenderer';
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
}

const HoloPad: React.FC<HoloPadProps> = ({ settings, setSettings }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Point2D[]>([]);
    const lastPointRef = useRef<Point2D | null>(null);
    const animationFrameRef = useRef<number>(0);
    const timeRef = useRef<number>(0);

    // 画布尺寸
    const canvasSize = useMemo(() => Math.min(500, window.innerHeight * 0.6), []);

    // 坐标转换：PointerEvent -> 归一化坐标 (-1 到 1)
    const getNormalizedCoords = useCallback((e: React.PointerEvent): Point2D => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;

        return { x, y, pressure };
    }, []);

    // 归一化坐标 -> 画布像素坐标
    const toCanvasCoords = useCallback((p: Point2D, canvas: HTMLCanvasElement): Point2D => {
        return {
            x: (p.x + 1) / 2 * canvas.width,
            y: (p.y + 1) / 2 * canvas.height,
            pressure: p.pressure
        };
    }, []);

    // 绘制对称辅助线
    const drawSymmetryGuides = useCallback((ctx: CanvasRenderingContext2D) => {
        if (!settings.showSymmetryGuides) return;

        const { width, height } = ctx.canvas;
        const centerX = width / 2 * (1 + settings.symmetry.centerOffset.x);
        const centerY = height / 2 * (1 + settings.symmetry.centerOffset.y);

        ctx.save();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
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

        // 中心点
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 180, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }, [settings.showSymmetryGuides, settings.symmetry]);

    // 渲染单条笔触（应用对称 + 使用墨迹效果）
    const renderStrokeWithSymmetry = useCallback((
        ctx: CanvasRenderingContext2D,
        points: Point2D[],
        brushType: BrushType,
        color: string,
        size: number,
        opacity: number,
        symmetry: typeof settings.symmetry,
        time: number
    ) => {
        if (points.length < 1) return;

        // 获取所有对称点组
        const numSymmetries = apply2DSymmetry(points[0], symmetry).length;

        for (let symIdx = 0; symIdx < numSymmetries; symIdx++) {
            const symmetricPoints: Point2D[] = [];

            for (const p of points) {
                const allSymmetric = apply2DSymmetry(p, symmetry);
                if (allSymmetric[symIdx]) {
                    // 转换为画布坐标
                    symmetricPoints.push(toCanvasCoords(allSymmetric[symIdx], ctx.canvas));
                }
            }

            if (symmetricPoints.length > 0) {
                // 非主笔触降低透明度
                const alphaMultiplier = symIdx === 0 ? 1 : 0.7;
                renderBrushEffect(
                    ctx,
                    symmetricPoints,
                    brushType,
                    color,
                    size,
                    opacity * alphaMultiplier,
                    time
                );
            }
        }
    }, [toCanvasCoords]);

    // 主渲染函数
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 清空
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 背景
        ctx.fillStyle = `rgba(10, 15, 30, ${settings.padOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 对称辅助线
        drawSymmetryGuides(ctx);

        const time = timeRef.current;

        // 渲染已保存的笔触
        const activeDrawing = getActiveDrawing(settings);
        if (activeDrawing) {
            for (const layer of activeDrawing.layers) {
                if (!layer.visible) continue;

                for (const stroke of layer.strokes) {
                    // 还原点数据
                    const points: Point2D[] = [];
                    const numPoints = stroke.points.length / 4;
                    for (let i = 0; i < numPoints; i++) {
                        points.push({
                            x: stroke.points[i * 4],
                            y: stroke.points[i * 4 + 1],
                            pressure: stroke.points[i * 4 + 2]
                        });
                    }

                    renderStrokeWithSymmetry(
                        ctx,
                        points,
                        layer.brushType,
                        layer.color,
                        settings.brush.size,
                        settings.brush.opacity,
                        stroke.symmetrySnapshot,
                        time
                    );
                }
            }
        }

        // 渲染当前正在绘制的笔触
        if (currentStroke.length > 0) {
            renderStrokeWithSymmetry(
                ctx,
                currentStroke,
                settings.brush.type,
                settings.brush.color,
                settings.brush.size,
                settings.brush.opacity,
                settings.symmetry,
                time
            );
        }
    }, [settings, currentStroke, drawSymmetryGuides, renderStrokeWithSymmetry]);

    // 动画循环
    useEffect(() => {
        if (!settings.enabled) return;

        let running = true;

        const animate = () => {
            if (!running) return;
            timeRef.current = performance.now() / 1000;
            redrawCanvas();
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            running = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [settings.enabled, redrawCanvas]);

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
        const lastPoint = lastPointRef.current;

        // 距离阈值
        if (lastPoint) {
            const dx = point.x - lastPoint.x;
            const dy = point.y - lastPoint.y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.005) return;
        }

        setCurrentStroke(prev => [...prev, point]);
        lastPointRef.current = point;
    }, [isDrawing, getNormalizedCoords]);

    // 结束绘制
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setIsDrawing(false);

        if (currentStroke.length < 2) {
            setCurrentStroke([]);
            return;
        }

        // 保存笔触
        const strokeData = new Float32Array(currentStroke.length * 4);
        currentStroke.forEach((p, i) => {
            strokeData[i * 4] = p.x;
            strokeData[i * 4 + 1] = p.y;
            strokeData[i * 4 + 2] = p.pressure;
            strokeData[i * 4 + 3] = 0;
        });

        setSettings(prev => {
            const drawing = getActiveDrawing(prev);
            const layer = getActiveLayer(prev);
            if (!drawing || !layer) return prev;

            const stroke = createStroke(strokeData, prev.symmetry);
            return addStroke(prev, drawing.id, layer.id, stroke);
        });

        setCurrentStroke([]);
    }, [isDrawing, currentStroke, setSettings]);

    if (!settings.enabled) return null;

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

            {/* 状态栏 */}
            <div style={{
                position: 'absolute',
                bottom: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.85)',
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
                <span style={{ opacity: 0.5 }}>|</span>
                <span>
                    <i className="fas fa-expand-arrows-alt" style={{ marginRight: 4 }} />
                    {settings.symmetry.mode2D}
                    {(settings.symmetry.mode2D === Symmetry2DMode.Radial ||
                        settings.symmetry.mode2D === Symmetry2DMode.Kaleidoscope) &&
                        ` (${settings.symmetry.radialSegments})`}
                </span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ color: settings.brush.color }}>●</span>
            </div>
        </div>
    );
};

export default HoloPad;
