/**
 * input: drawingModeActive, customMagicCircles from App.tsx, renderer from PlanetScene
 * output: Drawing overlay UI with 3D canvas, brush tools, symmetry controls, layer panel
 * pos: Main React component for custom magic circle drawing system
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
} from '../../types';
import {
    createDrawingScene,
    updateSymmetryAxes,
    screenToCanvas,
    createParticleStrokeMesh,
    createLineStrokeMesh,
    renderStrokesToGroup,
    createNewCircle,
    createNewLayer,
    disposeDrawingResources,
    DrawingSystemRefs,
    applySymmetryTransform
} from '../../utils/drawingSystem';

// ==================== 默认画笔设置 ====================

const defaultParticleSettings: Partial<ParticleRingSettings> = {
    particleDensity: 3,      // 粒子密度 0.5-10
    brightness: 2.0,         // 亮度 0.5-4
    particleSize: 2,         // 粒子大小 0.5-5
    bandwidth: 15            // 笔触粗细 (映射到散布) 1-50
};

const defaultSilkSettings: Partial<SilkRingSettings> = {
    thickness: 0.02,         // 线环粗细 0.005-0.08
    opacity: 0.9,            // 透明度
    emissive: 2.0,           // 发光强度 0.5-4
    fresnelPower: 2.0,       // 菲涅尔边缘 0.5-5
    sparkleEnabled: false,   // 闪点开关
    sparkleThreshold: 0.95,  // 闪点阈值 0.8-0.99
    flowSpeed: 1.0,          // 流动速度 0-3
    strandDensity: 30        // 丝线密度
};

// ==================== Props 接口 ====================

interface DrawingCanvasOverlayProps {
    isActive: boolean;
    customMagicCircles: CustomMagicCircle[];
    onUpdateCircles: (circles: CustomMagicCircle[]) => void;
    onClose: () => void;
    currentCircleId: string | null;
    onSelectCircle: (id: string | null) => void;
}

// ==================== 主组件 ====================

export const DrawingCanvasOverlay: React.FC<DrawingCanvasOverlayProps> = ({
    isActive,
    customMagicCircles,
    onUpdateCircles,
    onClose,
    currentCircleId,
    onSelectCircle
}) => {
    // 绘图系统引用
    const refsRef = useRef<DrawingSystemRefs>({
        camera: null,
        scene: null,
        canvasGroup: null,
        strokesGroup: null,
        symmetryAxesGroup: null,
        centerPoint: null,
        border: null,
        currentStrokeMesh: null
    });

    // 画布 DOM 引用
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>(0);

    // 当前编辑的法阵和图层
    const currentCircle = useMemo(() =>
        customMagicCircles.find(c => c.id === currentCircleId) || null,
        [customMagicCircles, currentCircleId]
    );

    const [currentLayerId, setCurrentLayerId] = useState<string | null>(
        currentCircle?.layers[0]?.id || null
    );

    const currentLayer = useMemo(() =>
        currentCircle?.layers.find(l => l.id === currentLayerId) || null,
        [currentCircle, currentLayerId]
    );

    // 画笔状态
    const [brushType, setBrushType] = useState<DrawingBrushType>('particle');
    const [particleSettings, setParticleSettings] = useState<Partial<ParticleRingSettings>>(defaultParticleSettings);
    const [silkSettings, setSilkSettings] = useState<Partial<SilkRingSettings>>(defaultSilkSettings);
    const [brushColor, setBrushColor] = useState('#ffaa00');

    // 对称设置 (从当前图层读取)
    const symmetryMode = currentLayer?.symmetryMode || 'radial';
    const symmetryDivisions = currentLayer?.symmetryDivisions || 8;

    // 绘制状态
    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeRef = useRef<StrokePoint[]>([]);

    // 撤销/重做栈
    const [undoStack, setUndoStack] = useState<MagicCircleStroke[]>([]);
    const [redoStack, setRedoStack] = useState<MagicCircleStroke[]>([]);

    // 初始化绘图场景
    useEffect(() => {
        if (!isActive) return;

        const { scene, camera, canvasGroup, strokesGroup, symmetryAxesGroup, centerPoint, border } = createDrawingScene();

        refsRef.current = {
            camera,
            scene,
            canvasGroup,
            strokesGroup,
            symmetryAxesGroup,
            centerPoint,
            border,
            currentStrokeMesh: null
        };

        // 初始化对称轴
        updateSymmetryAxes(symmetryAxesGroup, symmetryDivisions, symmetryMode);

        return () => {
            disposeDrawingResources(refsRef.current);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isActive]);

    // 当对称设置改变时更新对称轴
    useEffect(() => {
        if (refsRef.current.symmetryAxesGroup) {
            updateSymmetryAxes(refsRef.current.symmetryAxesGroup, symmetryDivisions, symmetryMode);
        }
    }, [symmetryDivisions, symmetryMode]);

    // 当图层改变时重新渲染笔画
    useEffect(() => {
        if (refsRef.current.strokesGroup) {
            renderStrokesToGroup(refsRef.current.strokesGroup, currentLayer);
        }
    }, [currentLayer]);

    // 渲染器和画布
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

    // 渲染循环
    useEffect(() => {
        if (!isActive) return;

        const container = canvasContainerRef.current;
        if (!container) return;

        // 创建画布元素
        if (!canvasElementRef.current) {
            const canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            container.appendChild(canvas);
            canvasElementRef.current = canvas;
        }

        // 创建渲染器
        if (!rendererRef.current) {
            rendererRef.current = new THREE.WebGLRenderer({
                canvas: canvasElementRef.current,
                alpha: true,
                antialias: true
            });
            rendererRef.current.setClearColor(0x000000, 0);
        }

        const renderer = rendererRef.current;
        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            const refs = refsRef.current;
            if (!refs.scene || !refs.camera) return;

            // 渲染绘图场景
            renderer.render(refs.scene, refs.camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isActive]);

    // 初始化：如果没有选中的法阵，创建一个新的
    useEffect(() => {
        if (isActive && customMagicCircles.length === 0) {
            const newCircle = createNewCircle();
            onUpdateCircles([newCircle]);
            onSelectCircle(newCircle.id);
            setCurrentLayerId(newCircle.layers[0].id);
        } else if (isActive && !currentCircleId && customMagicCircles.length > 0) {
            onSelectCircle(customMagicCircles[0].id);
            setCurrentLayerId(customMagicCircles[0].layers[0]?.id || null);
        }
    }, [isActive, customMagicCircles.length, currentCircleId]);

    // 处理指针按下
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!currentCircle || !currentLayer || currentLayer.locked) return;

        const container = canvasContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const canvasSize = Math.min(rect.width, rect.height) * 0.8;
        const offsetX = (rect.width - canvasSize) / 2;
        const offsetY = (rect.height - canvasSize) / 2;

        const canvasRect = {
            left: rect.left + offsetX,
            top: rect.top + offsetY,
            width: canvasSize,
            height: canvasSize
        };

        const pos = screenToCanvas(e.clientX, e.clientY, canvasRect);

        // 检查是否在画布范围内
        if (Math.abs(pos.x) > 0.5 || Math.abs(pos.y) > 0.5) return;

        setIsDrawing(true);
        currentStrokeRef.current = [{
            x: pos.x + 0.5, // 转回 0-1
            y: 0.5 - pos.y, // 转回 0-1
            pressure: e.pressure || 0.5,
            timestamp: Date.now()
        }];

        // 捕获指针
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [currentCircle, currentLayer]);

    // 处理指针移动
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        const container = canvasContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const canvasSize = Math.min(rect.width, rect.height) * 0.8;
        const offsetX = (rect.width - canvasSize) / 2;
        const offsetY = (rect.height - canvasSize) / 2;

        const canvasRect = {
            left: rect.left + offsetX,
            top: rect.top + offsetY,
            width: canvasSize,
            height: canvasSize
        };

        const pos = screenToCanvas(e.clientX, e.clientY, canvasRect);

        currentStrokeRef.current.push({
            x: Math.max(0, Math.min(1, pos.x + 0.5)),
            y: Math.max(0, Math.min(1, 0.5 - pos.y)),
            pressure: e.pressure || 0.5,
            timestamp: Date.now()
        });

        // 实时预览当前笔画
        updateCurrentStrokePreview();
    }, [isDrawing, brushType, brushColor, symmetryMode, symmetryDivisions]);

    // 更新当前笔画预览
    const updateCurrentStrokePreview = useCallback(() => {
        const refs = refsRef.current;
        if (!refs.strokesGroup) return;

        // 移除旧的预览
        if (refs.currentStrokeMesh) {
            refs.strokesGroup.remove(refs.currentStrokeMesh);
            if (refs.currentStrokeMesh instanceof THREE.Points || refs.currentStrokeMesh instanceof THREE.Mesh) {
                refs.currentStrokeMesh.geometry?.dispose();
                if (refs.currentStrokeMesh.material instanceof THREE.Material) {
                    refs.currentStrokeMesh.material.dispose();
                }
            }
            if (refs.currentStrokeMesh instanceof THREE.Group) {
                refs.currentStrokeMesh.traverse((obj: THREE.Object3D) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (obj.material instanceof THREE.Material) {
                            obj.material.dispose();
                        }
                    }
                });
            }
        }

        if (currentStrokeRef.current.length < 2) return;

        // 创建新预览
        if (brushType === 'particle') {
            refs.currentStrokeMesh = createParticleStrokeMesh(
                currentStrokeRef.current,
                brushColor,
                particleSettings,
                symmetryMode,
                symmetryDivisions
            );
        } else {
            refs.currentStrokeMesh = createLineStrokeMesh(
                currentStrokeRef.current,
                brushColor,
                silkSettings,
                symmetryMode,
                symmetryDivisions
            );
        }

        refs.strokesGroup.add(refs.currentStrokeMesh);
    }, [brushType, brushColor, particleSettings, silkSettings, symmetryMode, symmetryDivisions]);

    // 处理指针抬起
    const handlePointerUp = useCallback(() => {
        if (!isDrawing || !currentCircle || !currentLayerId) return;

        const points = currentStrokeRef.current;

        // 只有当有足够采样点时才添加笔画
        if (points.length > 1) {
            const newStroke: MagicCircleStroke = {
                id: `stroke_${Date.now()}`,
                brushType,
                particleRingSettings: brushType === 'particle' ? { ...particleSettings } : undefined,
                silkRingSettings: brushType === 'lineRing' ? { ...silkSettings } : undefined,
                color: brushColor,
                points: [...points]
            };

            const updatedCircles = customMagicCircles.map(c => {
                if (c.id !== currentCircle.id) return c;
                return {
                    ...c,
                    updatedAt: Date.now(),
                    layers: c.layers.map(l => {
                        if (l.id !== currentLayerId) return l;
                        return {
                            ...l,
                            strokes: [...l.strokes, newStroke]
                        };
                    })
                };
            });

            onUpdateCircles(updatedCircles);
            setUndoStack(prev => [...prev, newStroke]);
            setRedoStack([]);
        }

        setIsDrawing(false);
        currentStrokeRef.current = [];

        // 移除预览
        const refs = refsRef.current;
        if (refs.currentStrokeMesh && refs.strokesGroup) {
            refs.strokesGroup.remove(refs.currentStrokeMesh);
            refs.currentStrokeMesh = null;
        }
    }, [isDrawing, currentCircle, currentLayerId, brushType, particleSettings, silkSettings, brushColor, customMagicCircles, onUpdateCircles]);

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

    if (!isActive) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1000,
                pointerEvents: 'none'
            }}
        >
            {/* 左侧画笔工具面板 */}
            <div
                style={{
                    position: 'absolute',
                    left: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 200,
                    background: 'rgba(20, 20, 30, 0.95)',
                    borderRadius: 12,
                    padding: 16,
                    pointerEvents: 'auto',
                    border: '1px solid rgba(255, 170, 0, 0.3)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <div style={{ color: '#ffaa00', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                    🎨 画笔工具
                </div>

                {/* 画笔类型 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {(['particle', 'lineRing'] as DrawingBrushType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setBrushType(type)}
                            style={{
                                flex: 1,
                                padding: '8px 0',
                                background: brushType === type ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${brushType === type ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 6,
                                color: brushType === type ? '#ffaa00' : '#aaa',
                                fontSize: 12,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {type === 'particle' ? '⚡ 粒子' : '○ 丝环'}
                        </button>
                    ))}
                </div>

                {/* 画笔参数 */}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
                    {brushType === 'particle' ? (
                        <>
                            {/* 粒子大小 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>粒子大小</span>
                                    <span style={{ color: '#ffaa00' }}>{(particleSettings.particleSize || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={5}
                                    step={0.1}
                                    value={particleSettings.particleSize || 2}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, particleSize: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 粒子密度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>粒子密度</span>
                                    <span style={{ color: '#ffaa00' }}>{(particleSettings.particleDensity || 3).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={10}
                                    step={0.5}
                                    value={particleSettings.particleDensity || 3}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, particleDensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 亮度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>亮度</span>
                                    <span style={{ color: '#ffaa00' }}>{(particleSettings.brightness || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={4}
                                    step={0.1}
                                    value={particleSettings.brightness || 2}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 笔触粗细 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>笔触粗细</span>
                                    <span style={{ color: '#ffaa00' }}>{particleSettings.bandwidth || 15}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={50}
                                    step={1}
                                    value={particleSettings.bandwidth || 15}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, bandwidth: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* 线环粗细 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>线环粗细</span>
                                    <span style={{ color: '#00ffff' }}>{((silkSettings.thickness || 0.02) * 1000).toFixed(0)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={5}
                                    max={80}
                                    step={1}
                                    value={(silkSettings.thickness || 0.02) * 1000}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, thickness: Number(e.target.value) / 1000 }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 发光强度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>发光强度</span>
                                    <span style={{ color: '#00ffff' }}>{(silkSettings.emissive || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={4}
                                    step={0.1}
                                    value={silkSettings.emissive || 2}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, emissive: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 菲涅尔边缘 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>菲涅尔边缘</span>
                                    <span style={{ color: '#00ffff' }}>{(silkSettings.fresnelPower || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={5}
                                    step={0.1}
                                    value={silkSettings.fresnelPower || 2}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, fresnelPower: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 闪点效果 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <span>闪点效果</span>
                                    <input
                                        type="checkbox"
                                        checked={silkSettings.sparkleEnabled || false}
                                        onChange={(e) => setSilkSettings(prev => ({ ...prev, sparkleEnabled: e.target.checked }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </div>
                                {silkSettings.sparkleEnabled && (
                                    <input
                                        type="range"
                                        min={80}
                                        max={99}
                                        step={1}
                                        value={(silkSettings.sparkleThreshold || 0.95) * 100}
                                        onChange={(e) => setSilkSettings(prev => ({ ...prev, sparkleThreshold: Number(e.target.value) / 100 }))}
                                        style={{ width: '100%' }}
                                    />
                                )}
                            </div>
                            {/* 流动速度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>流动速度</span>
                                    <span style={{ color: '#00ffff' }}>{(silkSettings.flowSpeed || 1).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={3}
                                    step={0.1}
                                    value={silkSettings.flowSpeed || 1}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, flowSpeed: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* 颜色选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: '#888' }}>颜色</span>
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        style={{ width: 40, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    />
                    <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{brushColor}</span>
                </div>

                {/* 退出按钮 */}
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px 0',
                        background: 'rgba(255, 80, 80, 0.2)',
                        border: '1px solid rgba(255, 80, 80, 0.5)',
                        borderRadius: 8,
                        color: '#ff8080',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    ✕ 退出绘图
                </button>
            </div>

            {/* 中央画布区域 */}
            <div
                ref={canvasContainerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(65vh, 65vw)',
                    height: 'min(65vh, 65vw)',
                    pointerEvents: 'auto',
                    cursor: 'crosshair',
                    touchAction: 'none'
                }}
            />

            {/* 底部控制面板 */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 24,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 16,
                    background: 'rgba(20, 20, 30, 0.95)',
                    borderRadius: 12,
                    padding: 14,
                    pointerEvents: 'auto',
                    border: '1px solid rgba(255, 170, 0, 0.3)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                {/* 对称模式 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#888' }}>对称:</span>
                    {(['none', 'radial', 'kaleidoscope'] as SymmetryMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => handleUpdateSymmetry(mode, symmetryDivisions)}
                            style={{
                                padding: '5px 10px',
                                background: symmetryMode === mode ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${symmetryMode === mode ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 5,
                                color: symmetryMode === mode ? '#ffaa00' : '#aaa',
                                fontSize: 11,
                                cursor: 'pointer'
                            }}
                        >
                            {mode === 'none' ? '无' : mode === 'radial' ? '径向' : '万花筒'}
                        </button>
                    ))}
                    {symmetryMode !== 'none' && (
                        <input
                            type="number"
                            min={3}
                            max={36}
                            value={symmetryDivisions}
                            onChange={(e) => handleUpdateSymmetry(symmetryMode, Number(e.target.value))}
                            style={{
                                width: 45,
                                padding: '5px',
                                background: 'rgba(50, 50, 60, 0.8)',
                                border: '1px solid rgba(100, 100, 120, 0.5)',
                                borderRadius: 5,
                                color: '#fff',
                                fontSize: 11,
                                textAlign: 'center'
                            }}
                        />
                    )}
                </div>

                {/* 分隔线 */}
                <div style={{ width: 1, background: 'rgba(100, 100, 120, 0.5)' }} />

                {/* 图层 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#888' }}>图层:</span>
                    <button
                        onClick={handleNewLayer}
                        style={{
                            padding: '5px 10px',
                            background: 'rgba(100, 200, 100, 0.2)',
                            border: '1px solid rgba(100, 200, 100, 0.5)',
                            borderRadius: 5,
                            color: '#8f8',
                            fontSize: 11,
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
                                padding: '5px 10px',
                                background: currentLayerId === layer.id ? 'rgba(255, 170, 0, 0.3)' : 'rgba(50, 50, 60, 0.8)',
                                border: `1px solid ${currentLayerId === layer.id ? '#ffaa00' : 'rgba(100, 100, 120, 0.5)'}`,
                                borderRadius: 5,
                                color: currentLayerId === layer.id ? '#ffaa00' : '#aaa',
                                fontSize: 11,
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
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        style={{
                            padding: '5px 12px',
                            background: 'rgba(50, 50, 60, 0.8)',
                            border: '1px solid rgba(100, 100, 120, 0.5)',
                            borderRadius: 5,
                            color: undoStack.length > 0 ? '#fff' : '#555',
                            fontSize: 11,
                            cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ↩️ 撤销
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        style={{
                            padding: '5px 12px',
                            background: 'rgba(50, 50, 60, 0.8)',
                            border: '1px solid rgba(100, 100, 120, 0.5)',
                            borderRadius: 5,
                            color: redoStack.length > 0 ? '#fff' : '#555',
                            fontSize: 11,
                            cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        ↪️ 重做
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrawingCanvasOverlay;
