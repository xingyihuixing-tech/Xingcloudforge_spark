/**
 * input: DrawSettings（包含 drawings/layers/strokes + symmetry2D/3D + brush）
 * output: 中央 2D 工作台画布（采样指针输入并写入 strokes；同时进行 2D 预览绘制）
 * pos: 绘图 Workbench 的输入层（不直接操作 3D 场景；由 InkManager 负责渲染）
 * update: 一旦我被更新，请同步更新 components/README.md
 */

import React, { useRef, useEffect, useState } from 'react';
import {
    BrushType,
    DrawPoint2D,
    DrawSettings,
    DrawStroke,
    Drawing,
    DrawingLayer,
    RadialReflectionMode,
    Symmetry2DMode
} from '../types';

interface HoloCanvasProps {
    settings: DrawSettings;
    setSettings: React.Dispatch<React.SetStateAction<DrawSettings>>;
}

// Internal type for 2D Point
interface DrawingPoint {
    x: number; // 0-1 (Normalized)
    y: number; // 0-1 (Normalized)
    pressure: number;
    time: number;
    tiltX?: number;
    tiltY?: number;
}

const HoloCanvas: React.FC<HoloCanvasProps> = ({ settings, setSettings }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Stroke Buffer
    const strokePointsRef = useRef<DrawingPoint[]>([]);

    const stabilizerRef = useRef<{ x: number; y: number } | null>(null);

    const activeIdsRef = useRef<{ drawingId: string | null; layerId: string | null }>({
        drawingId: null,
        layerId: null
    });

    useEffect(() => {
        const activeDrawing = settings.drawings?.find(d => d.id === settings.activeDrawingId) || null;
        const activeLayer = activeDrawing?.layers.find(l => l.id === activeDrawing.activeLayerId) || null;
        activeIdsRef.current = {
            drawingId: activeDrawing?.id || null,
            layerId: activeLayer?.id || null
        };
    }, [settings.drawings, settings.activeDrawingId]);

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = width;
                canvasRef.current.height = height;
                redrawAll();
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 当 drawings 变化时重绘（保证切换作品/图层后画布可见）
    useEffect(() => {
        redrawAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.drawings, settings.activeDrawingId]);

    // Drawing Logic
    const startStroke = (e: React.PointerEvent) => {
        if (!containerRef.current) return;

        // Auto-create Drawing and Layer if needed
        const drawings = settings.drawings || [];
        let activeDrawing = drawings.find(d => d.id === settings.activeDrawingId);

        let drawingId = activeDrawing?.id || null;
        let layerId = activeDrawing?.activeLayerId || null;

        if (!activeDrawing) {
            const newDrawing: Drawing = {
                id: 'drawing-' + Date.now(),
                name: '自动绘图',
                visible: true,
                layers: [],
                activeLayerId: null
            };

            const newLayer: DrawingLayer = {
                id: 'layer-' + Date.now(),
                name: '图层 1',
                visible: true,
                tilt: { x: 0, y: 0, z: 0 },
                scale: 1,
                altitude: 0,
                rotationSpeed: 0,
                opacity: 1,
                blending: 'additive',
                brushType: settings.brush?.type || BrushType.Stardust,
                color: settings.brush?.color || '#ffffff',
                strokes: []
            };

            newDrawing.layers = [newLayer];
            newDrawing.activeLayerId = newLayer.id;

            drawingId = newDrawing.id;
            layerId = newLayer.id;

            setSettings(prev => ({
                ...prev,
                drawings: [newDrawing],
                activeDrawingId: newDrawing.id
            }));
        } else {
            const layerExists = !!(activeDrawing.activeLayerId && activeDrawing.layers.find(l => l.id === activeDrawing.activeLayerId));
            if (!layerExists) {
                const newLayer: DrawingLayer = {
                    id: 'layer-' + Date.now(),
                    name: `图层 ${activeDrawing.layers.length + 1}`,
                    visible: true,
                    tilt: { x: 0, y: 0, z: 0 },
                    scale: 1,
                    altitude: 0,
                    rotationSpeed: 0,
                    opacity: 1,
                    blending: 'additive',
                    brushType: settings.brush?.type || BrushType.Stardust,
                    color: settings.brush?.color || '#ffffff',
                    strokes: []
                };

                drawingId = activeDrawing.id;
                layerId = newLayer.id;

                setSettings(prev => ({
                    ...prev,
                    drawings: (prev.drawings || []).map(d => {
                        if (d.id === activeDrawing!.id) {
                            return {
                                ...d,
                                layers: [...d.layers, newLayer],
                                activeLayerId: newLayer.id
                            };
                        }
                        return d;
                    })
                }));
            }
        }

        activeIdsRef.current = { drawingId, layerId };

        setIsDrawing(true);
        containerRef.current.setPointerCapture(e.pointerId);

        stabilizerRef.current = null;

        const point = getNormalizedPoint(e);
        strokePointsRef.current = [point];

        // Initial Draw
        renderStroke(point, true); // true = start
    };

    const moveStroke = (e: React.PointerEvent) => {
        if (!isDrawing || !containerRef.current) return;

        const point = getNormalizedPoint(e);
        strokePointsRef.current.push(point);

        // Render Segment
        renderStroke(point, false);
    };

    const endStroke = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (containerRef.current) containerRef.current.releasePointerCapture(e.pointerId);

        const ids = activeIdsRef.current;
        if (!ids.drawingId || !ids.layerId) {
            strokePointsRef.current = [];

            redrawAll();
            return;
        }

        const points = strokePointsRef.current;
        const pointList: DrawPoint2D[] = points.map(p => ({
            u: p.x,
            v: p.y,
            pressure: p.pressure,
            t: p.time,
            tiltX: p.tiltX,
            tiltY: p.tiltY
        }));

        const stroke: DrawStroke = {
            id: 'stroke-' + Date.now(),
            points: pointList,
            brush: { ...settings.brush },
            symmetry2D: { ...settings.symmetry2D },
            symmetry3D: { ...settings.symmetry3D },
            canvasSize: settings.canvasSize,
            createdAt: Date.now()
        };

        setSettings(prev => ({
            ...prev,
            drawings: (prev.drawings || []).map(d => {
                if (d.id !== ids.drawingId) return d;
                return {
                    ...d,
                    layers: d.layers.map(l => {
                        if (l.id !== ids.layerId) return l;
                        return { ...l, strokes: [...(l.strokes || []), stroke] };
                    })
                };
            })
        }));

        strokePointsRef.current = [];

        redrawAll();

        // DO NOT clear the 2D canvas - persist strokes for visibility
        // User wants to see what they drew!
    };

    const getNormalizedPoint = (e: React.PointerEvent): DrawingPoint => {
        if (!containerRef.current) return { x: 0, y: 0, pressure: 0.5, time: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const raw = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
            pressure: e.pressure || 0.5,
            time: Date.now(),
            tiltX: (e as any).tiltX,
            tiltY: (e as any).tiltY
        };

        const s = Math.max(0, Math.min(1, settings.brush?.stabilization ?? 0));
        if (s <= 0) return raw;

        // 简单指数平滑：s 越大越“稳”
        const alpha = 1 - s * 0.85;
        const prev = stabilizerRef.current;
        if (!prev) {
            stabilizerRef.current = { x: raw.x, y: raw.y };
            return raw;
        }

        const nx = prev.x + (raw.x - prev.x) * alpha;
        const ny = prev.y + (raw.y - prev.y) * alpha;
        stabilizerRef.current = { x: nx, y: ny };
        return { ...raw, x: nx, y: ny };
    };

    const clearCanvas = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const redrawAll = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        clearCanvas();

        const activeDrawing = settings.drawings?.find(d => d.id === settings.activeDrawingId);
        if (!activeDrawing) return;

        const { width, height } = canvasRef.current;

        // 逐层重绘（只绘制 visible 的 layer）
        (activeDrawing.layers || []).forEach(layer => {
            if (layer.visible === false) return;
            (layer.strokes || []).forEach(stroke => {
                const pts = stroke.points || [];
                if (pts.length === 0) return;

                // 以 stroke 的 brush/symmetry2D 快照为准
                const brush = stroke.brush;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = layer.color || brush.color;

                for (let i = 1; i < pts.length; i++) {
                    const p0: DrawingPoint = {
                        x: pts[i - 1].u,
                        y: pts[i - 1].v,
                        pressure: pts[i - 1].pressure,
                        time: pts[i - 1].t,
                        tiltX: pts[i - 1].tiltX,
                        tiltY: pts[i - 1].tiltY
                    };
                    const p1: DrawingPoint = {
                        x: pts[i].u,
                        y: pts[i].v,
                        pressure: pts[i].pressure,
                        time: pts[i].t,
                        tiltX: pts[i].tiltX,
                        tiltY: pts[i].tiltY
                    };

                    const baseSize = brush.size || 5;
                    const size0 = brush.pressureInfluence.size ? baseSize * (p0.pressure || 1) : baseSize;
                    const op0 = brush.pressureInfluence.opacity ? (brush.opacity * (p0.pressure || 1)) : brush.opacity;
                    ctx.lineWidth = size0;
                    ctx.globalAlpha = op0;

                    const sym0 = applySymmetryWithSnapshot(p0, stroke.symmetry2D);
                    const sym1 = applySymmetryWithSnapshot(p1, stroke.symmetry2D);
                    const n = Math.min(sym0.length, sym1.length);
                    for (let k = 0; k < n; k++) {
                        ctx.beginPath();
                        ctx.moveTo(sym0[k].x * width, sym0[k].y * height);
                        ctx.lineTo(sym1[k].x * width, sym1[k].y * height);
                        ctx.stroke();
                    }
                }
            });
        });

        ctx.globalAlpha = 1;
    };

    // Render Logic (2D Visualization)
    const renderStroke = (current: DrawingPoint, isStart: boolean) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        const { width, height } = canvasRef.current;
        const brush = settings.brush;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = brush.color;

        // Basic Size/Opacity
        const baseSize = brush.size || 5;
        const pressure = current.pressure;
        const size = brush.pressureInfluence.size ? baseSize * pressure : baseSize;
        const opacity = brush.pressureInfluence.opacity ? (brush.opacity * pressure) : brush.opacity;

        ctx.lineWidth = size;
        ctx.globalAlpha = opacity;

        // Symmetry Rendering Loop
        const symmetryPoints = applySymmetry(current);

        // We need 'previous' points for all symmetry instances to draw lines.
        // But 'strokePointsRef' stores raw input. 
        // For simple realtime visual, we just draw from Prev-Transformed to Curr-Transformed?
        // Or simpler: Draw line from previous input to current input, but apply transform to Context? 
        // No, we need explicit coordinates for symmetry.

        if (isStart) {
            symmetryPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x * width, p.y * height, size / 2, 0, Math.PI * 2);
                ctx.fill();
            });
        } else {
            const prevRaw = strokePointsRef.current[strokePointsRef.current.length - 2];
            const prevSym = applySymmetry(prevRaw);

            for (let i = 0; i < symmetryPoints.length; i++) {
                const p1 = prevSym[i]; // Corresponding previous point
                const p2 = symmetryPoints[i];

                ctx.beginPath();
                ctx.moveTo(p1.x * width, p1.y * height);
                ctx.lineTo(p2.x * width, p2.y * height);
                ctx.stroke();
            }
        }
    };

    // Symmetry math
    const applySymmetryWithSnapshot = (p: DrawingPoint, sym: DrawSettings['symmetry2D']): DrawingPoint[] => {
        const center = { x: 0.5, y: 0.5 };

        const relX = p.x - center.x;
        const relY = p.y - center.y;

        // Default
        if (sym.mode === Symmetry2DMode.None) {
            return [p];
        }

        // Mirror with free axis angle
        if (sym.mode === Symmetry2DMode.Mirror) {
            const angle = (sym.mirrorAxisAngle || 0) * Math.PI / 180;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            // Rotate so axis aligns with X, mirror Y, rotate back
            const x1 = relX * cosA + relY * sinA;
            const y1 = -relX * sinA + relY * cosA;
            const y1m = -y1;
            const xr = x1 * cosA - y1m * sinA;
            const yr = x1 * sinA + y1m * cosA;
            return [p, { ...p, x: center.x + xr, y: center.y + yr }];
        }

        // Radial & Kaleidoscope
        const segments = Math.max(2, sym.segments || 2);
        const step = (Math.PI * 2) / segments;
        const radius = Math.sqrt(relX * relX + relY * relY);
        const baseAngle = Math.atan2(relY, relX) + (sym.rotationOffset || 0) * Math.PI / 180;

        const pts: DrawingPoint[] = [];

        if (sym.radialReflectionMode === RadialReflectionMode.Kaleidoscope) {
            const local = ((baseAngle % step) + step) % step;
            for (let i = 0; i < segments; i++) {
                const a = i * step + (i % 2 === 0 ? local : step - local);
                pts.push({ ...p, x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
            }
            return pts;
        }

        for (let i = 0; i < segments; i++) {
            const a = baseAngle + step * i;
            pts.push({ ...p, x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });

            if (sym.radialReflectionMode === RadialReflectionMode.Mirror) {
                const sectorCenter = step * i + step * 0.5;
                const aMirror = 2 * sectorCenter - a;
                pts.push({ ...p, x: center.x + radius * Math.cos(aMirror), y: center.y + radius * Math.sin(aMirror) });
            }
        }

        return pts;
    };

    const applySymmetry = (p: DrawingPoint): DrawingPoint[] => applySymmetryWithSnapshot(p, settings.symmetry2D);


    if (!settings.enabled) return null;

    return (
        <div
            ref={containerRef}
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                w-[800px] h-[800px] pointer-events-auto cursor-crosshair
                transition-opacity duration-300
                ${settings.hideCanvasWhilePainting && isDrawing ? 'opacity-20' : 'opacity-100'}
            `}
            style={{
                opacity: settings.canvasOpacity,
                zIndex: 50 // Above 3D Canvas (usually 0 or 1)
            }}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
        >
            {/* Visual Frame/Guide - Higher opacity for visibility */}
            <div className="absolute inset-0 border-2 border-white/30 rounded-lg bg-black/30 backdrop-blur-sm pointer-events-none">
                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/10"></div>
                <div className="absolute left-1/2 top-0 h-full w-px bg-white/10"></div>
            </div>

            <canvas
                ref={canvasRef}
                className="w-full h-full block"
            />
        </div>
    );
};

export default HoloCanvas;
