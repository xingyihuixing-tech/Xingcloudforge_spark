/**
 * input: drawingMode state, customMagicCircles from App.tsx
 * output: Drawing overlay UI with canvas, tools, layers
 * pos: Main entry for custom magic circle drawing system
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    CustomMagicCircle,
    MagicCircleLayer,
    MagicCircleStroke,
    StrokePoint,
    DrawingBrushType,
    ParticleBrushSettings,
    LineRingBrushSettings,
    SymmetryMode
} from '../../types';

// 默认画笔设置
const defaultParticleBrush: ParticleBrushSettings = {
    baseSize: 15,
    baseDensity: 0.5,
    glowIntensity: 1.0,
    shape: 'circle',
    pulseEnabled: false,
    pulseSpeed: 1.0
};

const defaultLineRingBrush: LineRingBrushSettings = {
    baseWidth: 3,
    glowIntensity: 1.0,
    dashEnabled: false,
    dashRatio: 0.5,
    flowSpeed: 1.0
};

// 创建新图层
function createNewLayer(name: string = '图层1'): MagicCircleLayer {
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

// 创建新法阵
function createNewCircle(name: string = '新建法阵'): CustomMagicCircle {
    return {
        id: `circle_${Date.now()}`,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        layers: [createNewLayer()]
    };
}

interface MagicCircleDrawingProps {
    isActive: boolean;
    customMagicCircles: CustomMagicCircle[];
    onUpdateCircles: (circles: CustomMagicCircle[]) => void;
    onClose: () => void;
    currentCircleId: string | null;
    onSelectCircle: (id: string | null) => void;
}

export const MagicCircleDrawing: React.FC<MagicCircleDrawingProps> = ({
    isActive,
    customMagicCircles,
    onUpdateCircles,
    onClose,
    currentCircleId,
    onSelectCircle
}) => {
    // 当前编辑的法阵
    const currentCircle = customMagicCircles.find(c => c.id === currentCircleId) || null;

    // 当前图层ID
    const [currentLayerId, setCurrentLayerId] = useState<string | null>(
        currentCircle?.layers[0]?.id || null
    );

    // 画笔状态
    const [brushType, setBrushType] = useState<DrawingBrushType>('particle');
    const [particleSettings, setParticleSettings] = useState<ParticleBrushSettings>(defaultParticleBrush);
    const [lineRingSettings, setLineRingSettings] = useState<LineRingBrushSettings>(defaultLineRingBrush);
    const [brushColor, setBrushColor] = useState('#ffaa00');

    // 绘制状态
    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<MagicCircleStroke | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // 用于强制刷新实时预览的计数器
    const [, forceUpdate] = useState(0);

    // 撤销/重做栈
    const [undoStack, setUndoStack] = useState<MagicCircleStroke[]>([]);
    const [redoStack, setRedoStack] = useState<MagicCircleStroke[]>([]);

    // 当前图层
    const currentLayer = currentCircle?.layers.find(l => l.id === currentLayerId) || null;

    // 应用对称变换
    const applySymmetry = useCallback((
        point: StrokePoint,
        mode: SymmetryMode,
        divisions: number
    ): StrokePoint[] => {
        if (mode === 'none') return [point];

        const results: StrokePoint[] = [];
        const angleStep = (Math.PI * 2) / divisions;

        // 转换为相对中心的坐标
        const dx = point.x - 0.5;
        const dy = point.y - 0.5;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const baseAngle = Math.atan2(dy, dx);

        for (let i = 0; i < divisions; i++) {
            const angle = baseAngle + angleStep * i;
            results.push({
                ...point,
                x: 0.5 + radius * Math.cos(angle),
                y: 0.5 + radius * Math.sin(angle)
            });

            // 万花筒模式：每份内部镜像
            if (mode === 'kaleidoscope') {
                const mirroredAngle = angleStep * (i + 0.5) * 2 - angle;
                results.push({
                    ...point,
                    x: 0.5 + radius * Math.cos(mirroredAngle),
                    y: 0.5 + radius * Math.sin(mirroredAngle)
                });
            }
        }

        return results;
    }, []);

    // 处理指针按下
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!currentCircle || !currentLayer || currentLayer.locked) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const pressure = e.pressure || 0.5;

        setIsDrawing(true);

        const newStroke: MagicCircleStroke = {
            id: `stroke_${Date.now()}`,
            brushType,
            brushSettings: brushType === 'particle' ? { ...particleSettings } : { ...lineRingSettings },
            color: brushColor,
            points: [{ x, y, pressure, timestamp: Date.now() }]
        };

        currentStrokeRef.current = newStroke;
    }, [currentCircle, currentLayer, brushType, particleSettings, lineRingSettings, brushColor]);

    // 处理指针移动
    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDrawing || !currentStrokeRef.current) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const pressure = e.pressure || 0.5;

        currentStrokeRef.current.points.push({
            x, y, pressure, timestamp: Date.now()
        });

        // 强制刷新以显示实时笔画
        forceUpdate(n => n + 1);
    }, [isDrawing]);

    // 处理指针抬起
    const handlePointerUp = useCallback(() => {
        if (!isDrawing || !currentStrokeRef.current || !currentCircle || !currentLayerId) return;

        const stroke = currentStrokeRef.current;

        // 只有当有采样点时才添加笔画
        if (stroke.points.length > 1) {
            const updatedCircles = customMagicCircles.map(c => {
                if (c.id !== currentCircle.id) return c;
                return {
                    ...c,
                    updatedAt: Date.now(),
                    layers: c.layers.map(l => {
                        if (l.id !== currentLayerId) return l;
                        return {
                            ...l,
                            strokes: [...l.strokes, stroke]
                        };
                    })
                };
            });

            onUpdateCircles(updatedCircles);
            setUndoStack(prev => [...prev, stroke]);
            setRedoStack([]);
        }

        setIsDrawing(false);
        currentStrokeRef.current = null;
    }, [isDrawing, currentCircle, currentLayerId, customMagicCircles, onUpdateCircles]);

    // 撤销
    const handleUndo = useCallback(() => {
        if (!currentCircle || !currentLayerId || undoStack.length === 0) return;

        const lastStroke = undoStack[undoStack.length - 1];

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.map(l => {
                    if (l.id !== currentLayerId) return l;
                    return {
                        ...l,
                        strokes: l.strokes.filter(s => s.id !== lastStroke.id)
                    };
                })
            };
        });

        onUpdateCircles(updatedCircles);
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, lastStroke]);
    }, [currentCircle, currentLayerId, undoStack, customMagicCircles, onUpdateCircles]);

    // 重做
    const handleRedo = useCallback(() => {
        if (!currentCircle || !currentLayerId || redoStack.length === 0) return;

        const strokeToRedo = redoStack[redoStack.length - 1];

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.map(l => {
                    if (l.id !== currentLayerId) return l;
                    return {
                        ...l,
                        strokes: [...l.strokes, strokeToRedo]
                    };
                })
            };
        });

        onUpdateCircles(updatedCircles);
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, strokeToRedo]);
    }, [currentCircle, currentLayerId, redoStack, customMagicCircles, onUpdateCircles]);

    // 新建法阵
    const handleNewCircle = useCallback(() => {
        const newCircle = createNewCircle();
        onUpdateCircles([...customMagicCircles, newCircle]);
        onSelectCircle(newCircle.id);
        setCurrentLayerId(newCircle.layers[0].id);
    }, [customMagicCircles, onUpdateCircles, onSelectCircle]);

    // 新建图层
    const handleNewLayer = useCallback(() => {
        if (!currentCircle) return;

        const layerCount = currentCircle.layers.length;
        const newLayer = createNewLayer(`图层${layerCount + 1}`);

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: [...c.layers, newLayer]
            };
        });

        onUpdateCircles(updatedCircles);
        setCurrentLayerId(newLayer.id);
    }, [currentCircle, customMagicCircles, onUpdateCircles]);

    // 更新图层对称模式
    const handleUpdateSymmetry = useCallback((mode: SymmetryMode, divisions: number) => {
        if (!currentCircle || !currentLayerId) return;

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.map(l => {
                    if (l.id !== currentLayerId) return l;
                    return { ...l, symmetryMode: mode, symmetryDivisions: divisions };
                })
            };
        });

        onUpdateCircles(updatedCircles);
    }, [currentCircle, currentLayerId, customMagicCircles, onUpdateCircles]);

    // 初始化：如果没有选中的法阵，创建一个新的
    useEffect(() => {
        if (isActive && !currentCircleId && customMagicCircles.length === 0) {
            handleNewCircle();
        } else if (isActive && customMagicCircles.length > 0 && !currentCircleId) {
            onSelectCircle(customMagicCircles[0].id);
            setCurrentLayerId(customMagicCircles[0].layers[0]?.id || null);
        }
    }, [isActive, currentCircleId, customMagicCircles.length]);

    if (!isActive) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                zIndex: 100
            }}
        >
            {/* 左侧画笔工具面板 */}
            <div
                style={{
                    position: 'absolute',
                    left: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 180,
                    background: 'rgba(20, 20, 30, 0.95)',
                    borderRadius: 12,
                    padding: 12,
                    pointerEvents: 'auto',
                    border: '1px solid rgba(255, 170, 0, 0.3)'
                }}
            >
                <div style={{ color: '#ffaa00', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                    画笔工具
                </div>

                {/* 画笔类型 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {(['particle', 'lineRing'] as DrawingBrushType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setBrushType(type)}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                background: brushType === type ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${brushType === type ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 6,
                                color: brushType === type ? '#ffaa00' : '#aaa',
                                fontSize: 11,
                                cursor: 'pointer'
                            }}
                        >
                            {type === 'particle' ? '⚡粒子' : '○线环'}
                        </button>
                    ))}
                </div>

                {/* 画笔参数 */}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                    {brushType === 'particle' ? (
                        <>
                            <div style={{ marginBottom: 6 }}>
                                <span>粗细</span>
                                <input
                                    type="range"
                                    min={5}
                                    max={50}
                                    value={particleSettings.baseSize}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, baseSize: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                <span>密度</span>
                                <input
                                    type="range"
                                    min={0.1}
                                    max={1.0}
                                    step={0.1}
                                    value={particleSettings.baseDensity}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, baseDensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                <span>发光</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={particleSettings.glowIntensity}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, glowIntensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: 6 }}>
                                <span>线宽</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    value={lineRingSettings.baseWidth}
                                    onChange={(e) => setLineRingSettings(prev => ({ ...prev, baseWidth: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: 6 }}>
                                <span>发光</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={lineRingSettings.glowIntensity}
                                    onChange={(e) => setLineRingSettings(prev => ({ ...prev, glowIntensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* 颜色选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: '#888' }}>颜色</span>
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        style={{ width: 32, height: 24, border: 'none', cursor: 'pointer' }}
                    />
                </div>

                {/* 退出按钮 */}
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '8px 0',
                        background: 'rgba(255, 80, 80, 0.2)',
                        border: '1px solid rgba(255, 80, 80, 0.5)',
                        borderRadius: 6,
                        color: '#ff8080',
                        fontSize: 11,
                        cursor: 'pointer'
                    }}
                >
                    退出绘图
                </button>
            </div>

            {/* 中央画布 */}
            <div
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(60vh, 60vw)',
                    height: 'min(60vh, 60vw)',
                    background: 'rgba(10, 10, 20, 0.8)',
                    border: '2px solid rgba(255, 170, 0, 0.5)',
                    borderRadius: 8,
                    pointerEvents: 'auto',
                    cursor: 'crosshair',
                    touchAction: 'none'
                }}
            >
                {/* SVG 预览层 - pointer-events:none 让事件穿透到画布 */}
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    {/* 已完成的笔画 */}
                    {currentLayer?.strokes.map(stroke => {
                        // 应用对称变换
                        const allPoints: StrokePoint[][] = [];
                        if (currentLayer.symmetryMode === 'none') {
                            allPoints.push(stroke.points);
                        } else {
                            // 为每个对称副本生成点列表
                            const divisions = currentLayer.symmetryDivisions;
                            for (let i = 0; i < divisions; i++) {
                                const angle = (Math.PI * 2 / divisions) * i;
                                const transformedPoints = stroke.points.map(p => {
                                    const dx = p.x - 0.5;
                                    const dy = p.y - 0.5;
                                    const cos = Math.cos(angle);
                                    const sin = Math.sin(angle);
                                    return {
                                        ...p,
                                        x: 0.5 + dx * cos - dy * sin,
                                        y: 0.5 + dx * sin + dy * cos
                                    };
                                });
                                allPoints.push(transformedPoints);

                                // 万花筒镜像
                                if (currentLayer.symmetryMode === 'kaleidoscope') {
                                    const mirroredPoints = transformedPoints.map(p => ({
                                        ...p,
                                        x: 1 - p.x
                                    }));
                                    allPoints.push(mirroredPoints);
                                }
                            }
                        }

                        return allPoints.map((points, idx) => (
                            <polyline
                                key={`${stroke.id}_${idx}`}
                                points={points.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={stroke.brushType === 'particle'
                                    ? (stroke.brushSettings as ParticleBrushSettings).baseSize / 5
                                    : (stroke.brushSettings as LineRingBrushSettings).baseWidth
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.8}
                            />
                        ));
                    })}

                    {/* 正在绘制的笔画 */}
                    {isDrawing && currentStrokeRef.current && currentLayer && (() => {
                        const stroke = currentStrokeRef.current;
                        const divisions = currentLayer.symmetryDivisions;
                        const lines: JSX.Element[] = [];

                        for (let i = 0; i < (currentLayer.symmetryMode === 'none' ? 1 : divisions); i++) {
                            const angle = (Math.PI * 2 / divisions) * i;
                            const transformedPoints = stroke.points.map(p => {
                                if (currentLayer.symmetryMode === 'none') return p;
                                const dx = p.x - 0.5;
                                const dy = p.y - 0.5;
                                const cos = Math.cos(angle);
                                const sin = Math.sin(angle);
                                return {
                                    ...p,
                                    x: 0.5 + dx * cos - dy * sin,
                                    y: 0.5 + dx * sin + dy * cos
                                };
                            });

                            lines.push(
                                <polyline
                                    key={`drawing_${i}`}
                                    points={transformedPoints.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                                    fill="none"
                                    stroke={brushColor}
                                    strokeWidth={brushType === 'particle' ? particleSettings.baseSize / 5 : lineRingSettings.baseWidth}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity={0.8}
                                />
                            );
                        }

                        return lines;
                    })()}
                </svg>
            </div>

            {/* 底部控制面板 */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 20,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 12,
                    background: 'rgba(20, 20, 30, 0.95)',
                    borderRadius: 12,
                    padding: 12,
                    pointerEvents: 'auto',
                    border: '1px solid rgba(255, 170, 0, 0.3)'
                }}
            >
                {/* 对称模式 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#888' }}>对称:</span>
                    {(['none', 'radial', 'kaleidoscope'] as SymmetryMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => handleUpdateSymmetry(mode, currentLayer?.symmetryDivisions || 8)}
                            style={{
                                padding: '4px 8px',
                                background: currentLayer?.symmetryMode === mode ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${currentLayer?.symmetryMode === mode ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 4,
                                color: currentLayer?.symmetryMode === mode ? '#ffaa00' : '#aaa',
                                fontSize: 10,
                                cursor: 'pointer'
                            }}
                        >
                            {mode === 'none' ? '无' : mode === 'radial' ? '径向' : '万花筒'}
                        </button>
                    ))}
                    {currentLayer?.symmetryMode !== 'none' && (
                        <input
                            type="number"
                            min={3}
                            max={36}
                            value={currentLayer?.symmetryDivisions || 8}
                            onChange={(e) => handleUpdateSymmetry(
                                currentLayer?.symmetryMode || 'radial',
                                Number(e.target.value)
                            )}
                            style={{
                                width: 40,
                                padding: '4px',
                                background: 'rgba(50, 50, 60, 0.8)',
                                border: '1px solid rgba(100, 100, 120, 0.5)',
                                borderRadius: 4,
                                color: '#fff',
                                fontSize: 10
                            }}
                        />
                    )}
                </div>

                {/* 分隔线 */}
                <div style={{ width: 1, background: 'rgba(100, 100, 120, 0.5)' }} />

                {/* 图层 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#888' }}>图层:</span>
                    <button
                        onClick={handleNewLayer}
                        style={{
                            padding: '4px 8px',
                            background: 'rgba(100, 200, 100, 0.2)',
                            border: '1px solid rgba(100, 200, 100, 0.5)',
                            borderRadius: 4,
                            color: '#8f8',
                            fontSize: 10,
                            cursor: 'pointer'
                        }}
                    >
                        [+]
                    </button>
                    {currentCircle?.layers.map(layer => (
                        <button
                            key={layer.id}
                            onClick={() => setCurrentLayerId(layer.id)}
                            style={{
                                padding: '4px 8px',
                                background: currentLayerId === layer.id ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${currentLayerId === layer.id ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 4,
                                color: currentLayerId === layer.id ? '#ffaa00' : '#aaa',
                                fontSize: 10,
                                cursor: 'pointer'
                            }}
                        >
                            {layer.visible ? '👁️' : '🙈'} {layer.name}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <div style={{ width: 1, background: 'rgba(100, 100, 120, 0.5)' }} />

                {/* 撤销/重做 */}
                <div style={{ display: 'flex', gap: 4 }}>
                    <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        style={{
                            padding: '4px 8px',
                            background: 'rgba(50, 50, 60, 0.8)',
                            border: '1px solid rgba(100, 100, 120, 0.5)',
                            borderRadius: 4,
                            color: undoStack.length > 0 ? '#fff' : '#555',
                            fontSize: 10,
                            cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ↩️
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        style={{
                            padding: '4px 8px',
                            background: 'rgba(50, 50, 60, 0.8)',
                            border: '1px solid rgba(100, 100, 120, 0.5)',
                            borderRadius: 4,
                            color: redoStack.length > 0 ? '#fff' : '#555',
                            fontSize: 10,
                            cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ↪️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MagicCircleDrawing;
