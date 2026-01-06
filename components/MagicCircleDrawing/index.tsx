/**
 * input: drawingMode state, customMagicCircles from App.tsx
 * output: Drawing overlay UI with 3D canvas, tools, layers
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
import { DrawingRenderer } from './DrawingRenderer';

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
    const rendererRef = useRef<DrawingRenderer | null>(null);

    // 撤销/重做栈
    const [undoStack, setUndoStack] = useState<MagicCircleStroke[]>([]);
    const [redoStack, setRedoStack] = useState<MagicCircleStroke[]>([]);

    // 当前图层
    const currentLayer = currentCircle?.layers.find(l => l.id === currentLayerId) || null;

    // 初始化 Three.js 渲染器
    useEffect(() => {
        if (isActive && canvasRef.current && !rendererRef.current) {
            rendererRef.current = new DrawingRenderer(canvasRef.current);
        }

        return () => {
            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current = null;
            }
        };
    }, [isActive]);

    // 更新辅助线
    useEffect(() => {
        if (rendererRef.current && currentLayer) {
            rendererRef.current.updateGuides(
                currentLayer.symmetryMode,
                currentLayer.symmetryDivisions
            );
        }
    }, [currentLayer?.symmetryMode, currentLayer?.symmetryDivisions]);

    // 重绘所有笔画
    useEffect(() => {
        if (rendererRef.current && currentLayer) {
            rendererRef.current.clearStrokes();
            currentLayer.strokes.forEach(stroke => {
                rendererRef.current!.addStroke(
                    stroke,
                    currentLayer.symmetryMode,
                    currentLayer.symmetryDivisions
                );
            });
        }
    }, [currentLayer?.strokes, currentLayer?.symmetryMode, currentLayer?.symmetryDivisions]);

    // 处理指针按下
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!currentCircle || !currentLayer || currentLayer.locked) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / rect.width;
        const y = 1 - (e.clientY - rect.top) / rect.height; // 翻转 Y 轴以匹配 Three.js 坐标系
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
        if (!isDrawing || !currentStrokeRef.current || !currentLayer) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / rect.width;
        const y = 1 - (e.clientY - rect.top) / rect.height; // 翻转 Y 轴
        const pressure = e.pressure || 0.5;

        currentStrokeRef.current.points.push({
            x, y, pressure, timestamp: Date.now()
        });

        // 更新 3D 预览
        if (rendererRef.current) {
            rendererRef.current.updateCurrentStroke(
                currentStrokeRef.current,
                currentLayer.symmetryMode,
                currentLayer.symmetryDivisions
            );
        }
    }, [isDrawing, currentLayer]);

    // 处理指针抬起
    const handlePointerUp = useCallback(() => {
        if (!isDrawing || !currentStrokeRef.current || !currentCircle || !currentLayerId || !currentLayer) return;

        const stroke = currentStrokeRef.current;

        // 清除当前绘制中的笔画预览
        if (rendererRef.current) {
            rendererRef.current.updateCurrentStroke(null, 'none', 8);
        }

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
    }, [isDrawing, currentCircle, currentLayerId, currentLayer, customMagicCircles, onUpdateCircles]);

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
        setUndoStack([]);
        setRedoStack([]);
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
        setUndoStack([]);
        setRedoStack([]);
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

    // 保存法阵 (生成缩略图)
    const handleSaveCircle = useCallback(() => {
        if (!currentCircle || !rendererRef.current) return;

        const thumbnail = rendererRef.current.generateThumbnail();

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                thumbnail,
                updatedAt: Date.now()
            };
        });

        onUpdateCircles(updatedCircles);
    }, [currentCircle, customMagicCircles, onUpdateCircles]);

    // 初始化：如果没有选中的法阵，创建一个新的
    useEffect(() => {
        if (isActive && !currentCircleId && customMagicCircles.length === 0) {
            handleNewCircle();
        } else if (isActive && customMagicCircles.length > 0 && !currentCircleId) {
            onSelectCircle(customMagicCircles[0].id);
            setCurrentLayerId(customMagicCircles[0].layers[0]?.id || null);
        }
    }, [isActive, currentCircleId, customMagicCircles.length]);

    // 切换法阵时重置
    useEffect(() => {
        if (currentCircle) {
            setCurrentLayerId(currentCircle.layers[0]?.id || null);
            setUndoStack([]);
            setRedoStack([]);
        }
    }, [currentCircleId]);

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

                {/* 保存按钮 */}
                <button
                    onClick={handleSaveCircle}
                    style={{
                        width: '100%',
                        padding: '8px 0',
                        marginBottom: 8,
                        background: 'rgba(100, 200, 100, 0.2)',
                        border: '1px solid rgba(100, 200, 100, 0.5)',
                        borderRadius: 6,
                        color: '#8f8',
                        fontSize: 11,
                        cursor: 'pointer'
                    }}
                >
                    💾 保存法阵
                </button>

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

            {/* 中央 3D 画布 */}
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
                    background: 'rgba(10, 10, 20, 0.9)',
                    border: '2px solid rgba(255, 170, 0, 0.5)',
                    borderRadius: 8,
                    pointerEvents: 'auto',
                    cursor: 'crosshair',
                    touchAction: 'none',
                    overflow: 'hidden'
                }}
            />

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
                {/* 法阵选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#888' }}>法阵:</span>
                    <button
                        onClick={handleNewCircle}
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
                    {customMagicCircles.map(circle => (
                        <button
                            key={circle.id}
                            onClick={() => {
                                onSelectCircle(circle.id);
                                setCurrentLayerId(circle.layers[0]?.id || null);
                            }}
                            style={{
                                padding: '4px 8px',
                                background: currentCircleId === circle.id ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${currentCircleId === circle.id ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 4,
                                color: currentCircleId === circle.id ? '#ffaa00' : '#aaa',
                                fontSize: 10,
                                cursor: 'pointer'
                            }}
                        >
                            {circle.name}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <div style={{ width: 1, background: 'rgba(100, 100, 120, 0.5)' }} />

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
