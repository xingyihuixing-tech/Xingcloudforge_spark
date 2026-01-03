/**
 * HoloPad - 2D 绘图画布组件
 * 
 * input: DrawSettings 状态、setSettings 回调
 * output: 渲染 2D 画布、捕获用户输入、显示对称辅助线
 * pos: 绘图系统的用户交互入口
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawSettings, SymmetrySettings, Symmetry2DMode, BrushType } from '../../types';
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
    onStrokeComplete?: (strokeData: Float32Array) => void;
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

const HoloPad: React.FC<HoloPadProps> = ({ settings, setSettings, onStrokeComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Point2D[]>([]);
    const lastPointRef = useRef<Point2D | null>(null);

    // 画布尺寸
    const [size, setSize] = useState({ width: 600, height: 600 });

    // 初始化画布尺寸
    useEffect(() => {
        const handleResize = () => {
            const minDim = Math.min(window.innerWidth * 0.5, window.innerHeight * 0.7, 800);
            setSize({ width: minDim, height: minDim });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    // 绘制对称辅助线
    const drawSymmetryGuides = useCallback((ctx: CanvasRenderingContext2D) => {
        if (!settings.showSymmetryGuides) return;

        const { width, height } = ctx.canvas;
        const centerX = width / 2 + settings.symmetry.centerOffset.x * width / 2;
        const centerY = height / 2 + settings.symmetry.centerOffset.y * height / 2;

        ctx.save();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        const { mode2D, radialSegments, mirrorAxisAngle } = settings.symmetry;

        switch (mode2D) {
            case Symmetry2DMode.MirrorX:
                // 垂直线
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, height);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorY:
                // 水平线
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorQuad:
                // 垂直+水平线
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, height);
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorDiagonal:
                // 对角线
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(width, height);
                ctx.stroke();
                break;

            case Symmetry2DMode.MirrorFreeAngle:
                // 自由角度轴
                const angle = mirrorAxisAngle * Math.PI / 180;
                const len = Math.max(width, height);
                ctx.beginPath();
                ctx.moveTo(centerX - Math.cos(angle) * len, centerY - Math.sin(angle) * len);
                ctx.lineTo(centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
                ctx.stroke();
                break;

            case Symmetry2DMode.Radial:
            case Symmetry2DMode.Kaleidoscope:
                // 径向分割线
                for (let i = 0; i < radialSegments; i++) {
                    const a = (i / radialSegments) * Math.PI * 2;
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
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }, [settings.showSymmetryGuides, settings.symmetry]);

    // 绘制当前笔触预览
    const drawStrokePreview = useCallback((ctx: CanvasRenderingContext2D, points: Point2D[]) => {
        if (points.length < 2) return;

        const { width, height } = ctx.canvas;
        const brushColor = settings.brush.color || BRUSH_COLORS[settings.brush.type];

        // 应用对称获取所有点
        const allSymmetricPoints: Point2D[][] = points.map(p =>
            apply2DSymmetry(p, settings.symmetry)
        );

        // 为每个对称实例绘制线条
        const numSymmetries = allSymmetricPoints[0]?.length || 1;

        for (let symIdx = 0; symIdx < numSymmetries; symIdx++) {
            ctx.beginPath();
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = settings.brush.size * 0.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = settings.brush.opacity * (symIdx === 0 ? 1 : 0.6);

            for (let i = 0; i < points.length; i++) {
                const symmetricPoint = allSymmetricPoints[i][symIdx];
                const canvasX = (symmetricPoint.x + 1) / 2 * width;
                const canvasY = (symmetricPoint.y + 1) / 2 * height;

                if (i === 0) {
                    ctx.moveTo(canvasX, canvasY);
                } else {
                    ctx.lineTo(canvasX, canvasY);
                }
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }, [settings.brush, settings.symmetry]);

    // 清除预览画布
    const clearPreview = useCallback(() => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    // 重绘预览
    const redrawPreview = useCallback(() => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSymmetryGuides(ctx);

        if (currentStroke.length > 0) {
            drawStrokePreview(ctx, currentStroke);
        }
    }, [drawSymmetryGuides, drawStrokePreview, currentStroke]);

    // 监听设置变化，重绘辅助线
    useEffect(() => {
        redrawPreview();
    }, [redrawPreview, settings.symmetry, settings.showSymmetryGuides]);

    // 开始绘制
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!settings.enabled) return;

        e.preventDefault();
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
        if (!isDrawing) {
            // 显示幽灵光标
            if (settings.ghostCursorEnabled && settings.enabled) {
                // TODO: 绘制幽灵光标
            }
            return;
        }

        const point = getNormalizedCoords(e);

        // 距离阈值检查
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
            const dx = point.x - lastPoint.x;
            const dy = point.y - lastPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.005) return; // 太近则跳过
        }

        setCurrentStroke(prev => [...prev, point]);
        lastPointRef.current = point;

        // 更新预览
        requestAnimationFrame(redrawPreview);
    }, [isDrawing, getNormalizedCoords, settings.ghostCursorEnabled, settings.enabled, redrawPreview]);

    // 结束绘制
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setIsDrawing(false);

        if (currentStroke.length < 2) {
            setCurrentStroke([]);
            clearPreview();
            return;
        }

        // 将笔触数据转换为 Float32Array
        const strokeData = new Float32Array(currentStroke.length * 4);
        currentStroke.forEach((p, i) => {
            strokeData[i * 4] = p.x;
            strokeData[i * 4 + 1] = p.y;
            strokeData[i * 4 + 2] = p.pressure;
            strokeData[i * 4 + 3] = Date.now() % 10000; // 时间戳
        });

        // 保存笔触到当前图层
        setSettings(prev => {
            const drawing = getActiveDrawing(prev);
            const layer = getActiveLayer(prev);
            if (!drawing || !layer) return prev;

            const stroke = createStroke(strokeData, prev.symmetry);
            return addStroke(prev, drawing.id, layer.id, stroke);
        });

        // 回调
        onStrokeComplete?.(strokeData);

        // 清除当前笔触
        setCurrentStroke([]);

        // 将预览合并到主画布（简化版：直接清除预览）
        clearPreview();
        redrawPreview();
    }, [isDrawing, currentStroke, setSettings, onStrokeComplete, clearPreview, redrawPreview]);

    // 样式
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        display: settings.enabled ? 'block' : 'none',
        pointerEvents: settings.enabled ? 'auto' : 'none'
    };

    const canvasStyle: React.CSSProperties = {
        width: size.width,
        height: size.height,
        borderRadius: '16px',
        background: `rgba(10, 15, 30, ${settings.padOpacity})`,
        border: '2px solid rgba(100, 200, 255, 0.3)',
        boxShadow: '0 0 40px rgba(100, 200, 255, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)',
        cursor: 'crosshair'
    };

    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: size.width,
        height: size.height,
        pointerEvents: 'none',
        borderRadius: '16px'
    };

    return (
        <div style={containerStyle}>
            {/* 主画布（用于持久化笔触） */}
            <canvas
                ref={canvasRef}
                width={size.width * 2}
                height={size.height * 2}
                style={{ ...canvasStyle, position: 'absolute' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />

            {/* 预览画布（用于当前笔触和辅助线） */}
            <canvas
                ref={previewCanvasRef}
                width={size.width * 2}
                height={size.height * 2}
                style={{ ...canvasStyle, ...overlayStyle }}
            />

            {/* 工具栏 */}
            <div style={{
                position: 'absolute',
                bottom: -50,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '8px 16px',
                borderRadius: '20px'
            }}>
                <span style={{ color: '#88ccff', fontSize: '12px' }}>
                    笔刷: {settings.brush.type} |
                    对称: {settings.symmetry.mode2D}
                    {settings.symmetry.mode2D === Symmetry2DMode.Radial && ` (${settings.symmetry.radialSegments})`}
                </span>
            </div>
        </div>
    );
};

export default HoloPad;
