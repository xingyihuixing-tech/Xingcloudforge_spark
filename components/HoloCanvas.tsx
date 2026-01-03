import React, { useRef, useEffect, useState } from 'react';
import { DrawSettings, BrushSettings, SymmetrySettings, SymmetryMode, Point2D } from '../types';

interface HoloCanvasProps {
    settings: DrawSettings;
    onStrokeComplete: (points: Float32Array) => void; // Callback to send stroke data to 3D manager
}

// Internal type for 2D Point
interface DrawingPoint {
    x: number; // 0-1 (Normalized)
    y: number; // 0-1 (Normalized)
    pressure: number;
    time: number;
}

const HoloCanvas: React.FC<HoloCanvasProps> = ({ settings, onStrokeComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Stroke Buffer
    const strokePointsRef = useRef<DrawingPoint[]>([]);

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = width;
                canvasRef.current.height = height;
                // Redraw symmetry lines?
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Drawing Logic
    const startStroke = (e: React.PointerEvent) => {
        if (!containerRef.current) return;
        setIsDrawing(true);
        containerRef.current.setPointerCapture(e.pointerId);

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

        // Convert Stroke to Float32Array for transmission
        // Format: [x, y, pressure, time, ...] 
        const points = strokePointsRef.current;
        const data = new Float32Array(points.length * 4);
        for (let i = 0; i < points.length; i++) {
            data[i * 4 + 0] = points[i].x;
            data[i * 4 + 1] = points[i].y;
            data[i * 4 + 2] = points[i].pressure;
            data[i * 4 + 3] = points[i].time;
        }

        onStrokeComplete(data);
        strokePointsRef.current = [];

        // Clear Canvas for next stroke (or keep it? Usually persist until "Clear" or pass to 3D and clear 2D)
        // For "Projection", we want the ink to "transfer" to 3D. 
        // So we clear the 2D canvas after a short delay or immediately?
        // Procreate style: You see ink on canvas. 
        // For Dimension Crafter: You draw on 2D, but the result appears in 3D. 
        // To avoid double-vision, we might want to fade out the 2D stroke or keep it very subtle.
        // Let's keep it visible for "Ink" feel, but clear it on endStroke to "Project" it?
        // Let's clear it for now to signify "Transfer".
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    };

    const getNormalizedPoint = (e: React.PointerEvent): DrawingPoint => {
        if (!containerRef.current) return { x: 0, y: 0, pressure: 0.5, time: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
            pressure: e.pressure || 0.5,
            time: Date.now()
        };
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
        const symmetryPoints = applySymmetry(current, settings.symmetry);

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
            const prevSym = applySymmetry(prevRaw, settings.symmetry);

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
    const applySymmetry = (p: DrawingPoint, sym: SymmetrySettings): DrawingPoint[] => {
        const center = { x: 0.5, y: 0.5 };
        const points: DrawingPoint[] = [];

        // Base point
        points.push(p);

        if (sym.mode === SymmetryMode.Mirror) {
            const relX = p.x - center.x;
            const relY = p.y - center.y;

            if (sym.mirrorAxis === 'x' || sym.mirrorAxis === 'quad') {
                points.push({ ...p, x: center.x - relX }); // Mirror X
            }
            if (sym.mirrorAxis === 'y' || sym.mirrorAxis === 'quad') {
                points.push({ ...p, y: center.y - relY }); // Mirror Y
            }
            if (sym.mirrorAxis === 'quad') {
                points.push({ ...p, x: center.x - relX, y: center.y - relY }); // Mirror Both
            }
        }
        else if (sym.mode === SymmetryMode.Radial || sym.mode === SymmetryMode.Spiral) {
            const segments = Math.max(2, sym.segments);
            const relX = p.x - center.x;
            const relY = p.y - center.y;

            // Convert to Polar
            const radius = Math.sqrt(relX * relX + relY * relY);
            const angle = Math.atan2(relY, relX);

            const step = (Math.PI * 2) / segments;

            // We already have the first point (i=0). We need i=1 to segments-1
            // Wait, logic above pushed p (original). 
            // Radial usually implies the original is just one sector.
            // Let's clear and regenerate all to be safe and ordered.
            points.length = 0;

            for (let i = 0; i < segments; i++) {
                let theta = angle + step * i;

                // Spiral Twist (Visual only for 2D, real twisting happens in 3D projection)
                if (sym.mode === SymmetryMode.Spiral) {
                    // twist based on radius? 
                    // For 2D visual, maybe keep it simple radial to avoid confusion?
                    // Or applying twist:
                    // theta += radius * sym.twist; 
                }

                const newX = center.x + radius * Math.cos(theta);
                const newY = center.y + radius * Math.sin(theta);

                points.push({ ...p, x: newX, y: newY });

                // Radial Reflection (Mandala)
                if (sym.radialReflection) {
                    // Mirror within sector? 
                    // Simplest is mirroring angle relative to sector center?
                    // Or just -theta?
                    // Let's skip complex mandala for this iteration.
                }
            }
        }

        return points;
    };


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
            {/* Visual Frame/Guide */}
            <div className="absolute inset-0 border-2 border-white/20 rounded-lg bg-black/10 backdrop-blur-sm pointer-events-none">
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
