/**
 * input: drawingModeActive, customMagicCircles from App.tsx, particle/silk brush pressureMode（粒子：无/书法/亮度；丝环：无/书法/亮度）
 * output: Drawing overlay UI with 3D canvas, brush tools (arc-length density + pressure mode；粒子密度范围100-800), symmetry controls, layer panel
 * pos: Main React component for custom magic circle drawing system
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
import { DrawingControlPanel } from './DrawingControlPanel';
import { UndoIcon, RedoIcon, BrushIcon } from './Icons';

// ==================== 默认画笔设置 ====================

const defaultParticleSettings: Partial<ParticleRingSettings> = {
    particleDensity: 300,      // 粒子密度 0.5-10
    brightness: 2.0,         // 亮度 0.5-4
    particleSize: 2,         // 粒子大小 0.5-5
    bandwidth: 15,           // 笔触粗细 (映射到散布) 1-50
    pressureMode: 'calligraphy'
};

const defaultSilkSettings: Partial<SilkRingSettings> = {
    thickness: 0.02,         // 线环粗细 0.005-0.08
    opacity: 0.9,            // 透明度
    emissive: 2.0,           // 发光强度 0.5-4
    fresnelPower: 2.0,       // 菲涅尔边缘 0.5-5
    sparkleEnabled: false,   // 闪点开关
    sparkleThreshold: 0.95,  // 闪点阈值 0.8-0.99
    flowSpeed: 1.0,          // 流动速度 0-3
    strandDensity: 30,       // 丝线密度
    pressureMode: 'none'
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

    // 图层 solo 模式（仅显示当前图层）
    const [soloLayerId, setSoloLayerId] = useState<string | null>(null);

    // Edit/Preview 模式切换
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const orbitControlsRef = useRef<OrbitControls | null>(null);

    // 相机默认位置（用于重置视角）
    const defaultCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 1));

    // 初始化绘图场景、画布、渲染器和渲染循环（统一在一个 useEffect 中）
    useEffect(() => {
        if (!isActive) return;

        const container = canvasContainerRef.current;
        if (!container) return;

        // 1. 创建场景
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

        // 保存相机默认位置（用于重置视角）
        defaultCameraPosition.current = camera.position.clone();

        // 初始化对称轴
        updateSymmetryAxes(symmetryAxesGroup, symmetryDivisions, symmetryMode);

        // 2. 创建画布元素
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        container.appendChild(canvas);
        canvasElementRef.current = canvas;

        // 3. 创建渲染器
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });
        renderer.setClearColor(0x000000, 0);
        rendererRef.current = renderer;

        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. 渲染循环
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            const refs = refsRef.current;
            if (!refs.scene || !refs.camera) return;

            // 更新 OrbitControls（如果存在）
            if (orbitControlsRef.current) {
                orbitControlsRef.current.update();
            }

            renderer.render(refs.scene, refs.camera);
        };

        animate();

        // 清理函数
        return () => {
            cancelAnimationFrame(animationFrameRef.current);
            disposeDrawingResources(refsRef.current);

            // 销毁渲染器
            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current = null;
            }
            // 移除画布 DOM 元素
            if (canvasElementRef.current && container) {
                try {
                    container.removeChild(canvasElementRef.current);
                } catch (e) { /* 忽略 */ }
                canvasElementRef.current = null;
            }
        };
    }, [isActive]);

    // 当对称设置改变时更新对称轴
    useEffect(() => {
        if (refsRef.current.symmetryAxesGroup) {
            updateSymmetryAxes(refsRef.current.symmetryAxesGroup, symmetryDivisions, symmetryMode);
        }
    }, [symmetryDivisions, symmetryMode]);

    // Edit/Preview 模式切换处理
    useEffect(() => {
        const refs = refsRef.current;
        const renderer = rendererRef.current;
        const canvas = canvasElementRef.current;

        if (!refs.camera || !renderer || !canvas) return;

        if (viewMode === 'preview') {
            // 创建 OrbitControls
            const controls = new OrbitControls(refs.camera, canvas);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.enableZoom = true;
            controls.enablePan = false;
            controls.minDistance = 0.3;
            controls.maxDistance = 3;
            orbitControlsRef.current = controls;

            // 启用画布指针事件
            canvas.style.pointerEvents = 'auto';

            // 隐藏辅助元素（边框、中心点、对称轴）
            if (refs.centerPoint) refs.centerPoint.visible = false;
            if (refs.border) refs.border.visible = false;
            if (refs.symmetryAxesGroup) refs.symmetryAxesGroup.visible = false;
        } else {
            // 销毁 OrbitControls
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dispose();
                orbitControlsRef.current = null;
            }

            // 禁用画布指针事件
            canvas.style.pointerEvents = 'none';

            // 重置相机位置和角度
            refs.camera.position.copy(defaultCameraPosition.current);
            refs.camera.lookAt(0, 0, 0);
            refs.camera.up.set(0, 1, 0);

            // 显示辅助元素
            if (refs.centerPoint) refs.centerPoint.visible = true;
            if (refs.border) refs.border.visible = true;
            if (refs.symmetryAxesGroup) refs.symmetryAxesGroup.visible = true;
        }

        return () => {
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dispose();
                orbitControlsRef.current = null;
            }
        };
    }, [viewMode]);

    // 当图层或内容改变时，重新渲染所有可见图层的笔画
    // 添加 isActive 依赖确保场景初始化后能触发渲染
    useEffect(() => {
        if (!isActive || !refsRef.current.strokesGroup || !currentCircle) return;

        // 清空笔画组
        const strokesGroup = refsRef.current.strokesGroup;
        while (strokesGroup.children.length > 0) {
            const child = strokesGroup.children[0];
            if (child instanceof THREE.Points || child instanceof THREE.Mesh || child instanceof THREE.Group) {
                child.traverse((obj: THREE.Object3D) => {
                    if (obj instanceof THREE.Points || obj instanceof THREE.Mesh) {
                        obj.geometry?.dispose();
                        if (obj.material instanceof THREE.Material) {
                            obj.material.dispose();
                        } else if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        }
                    }
                });
            }
            strokesGroup.remove(child);
        }

        // 渲染所有可见图层 (或 solo 图层)
        const layersToRender = soloLayerId
            ? currentCircle.layers.filter(l => l.id === soloLayerId)
            : currentCircle.layers.filter(l => l.visible !== false);

        for (const layer of layersToRender) {
            for (const stroke of layer.strokes) {
                let mesh: THREE.Object3D;
                // Edit模式：画布参数（粒子缩小，无脉冲）
                // Preview模式：场景参数（粒子正常大小，启用脉冲/发光）
                const mcSettings = viewMode === 'preview' ? {
                    opacity: 1.0,
                    hueShift: 0,
                    brightness: 1.5,  // 场景亮度增强
                    pulseEnabled: true,  // 启用脉冲
                    pulseSpeed: 1.0,
                    pulseIntensity: 0.3,
                    particleSizeScale: 1.5  // 场景粒子大小
                } : {
                    opacity: 1.0,
                    hueShift: 0,
                    brightness: 1.0,
                    pulseEnabled: false,
                    pulseSpeed: 1.0,
                    pulseIntensity: 0.3,
                    particleSizeScale: 0.002  // 画布粒子缩小
                };
                if (stroke.brushType === 'particle') {
                    mesh = createParticleStrokeMesh(
                        stroke.points,
                        stroke.color,
                        stroke.particleRingSettings || {},
                        layer.symmetryMode,
                        layer.symmetryDivisions,
                        mcSettings
                    );
                } else {
                    mesh = createLineStrokeMesh(
                        stroke.points,
                        stroke.color,
                        stroke.silkRingSettings || {},
                        layer.symmetryMode,
                        layer.symmetryDivisions,
                        mcSettings
                    );
                }
                strokesGroup.add(mesh);
            }
        }
    }, [isActive, currentCircle, soloLayerId, viewMode]);

    // 渲染器和画布 ref（创建在第一个 useEffect 中）
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

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
        // Preview模式下禁止绘制
        if (viewMode === 'preview') return;
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
    }, [viewMode, currentCircle, currentLayer]);

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
        const previewMcSettings = { particleSizeScale: 0.002 };  // 画布粒子缩放
        if (brushType === 'particle') {
            refs.currentStrokeMesh = createParticleStrokeMesh(
                currentStrokeRef.current,
                brushColor,
                particleSettings,
                symmetryMode,
                symmetryDivisions,
                previewMcSettings
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

    // 删除图层
    const handleDeleteLayer = useCallback((layerId: string) => {
        if (!currentCircle || currentCircle.layers.length <= 1) return; // 至少保留一个图层

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.filter(l => l.id !== layerId)
            };
        });

        onUpdateCircles(updatedCircles);

        // 如果删除的是当前图层，切换到第一个
        if (currentLayerId === layerId) {
            const remaining = currentCircle.layers.filter(l => l.id !== layerId);
            setCurrentLayerId(remaining[0]?.id || null);
        }
        // 如果删除的是 solo 图层，退出 solo 模式
        if (soloLayerId === layerId) {
            setSoloLayerId(null);
        }
    }, [currentCircle, currentLayerId, soloLayerId, customMagicCircles, onUpdateCircles]);

    // 切换图层可见性
    const handleToggleVisibility = useCallback((layerId: string) => {
        if (!currentCircle) return;

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.map(l => {
                    if (l.id !== layerId) return l;
                    return { ...l, visible: l.visible === false ? true : false };
                })
            };
        });

        onUpdateCircles(updatedCircles);
    }, [currentCircle, customMagicCircles, onUpdateCircles]);

    // 切换 solo 模式
    const handleToggleSolo = useCallback((layerId: string) => {
        setSoloLayerId(prev => prev === layerId ? null : layerId);
    }, []);

    // 创建新法阵
    const handleCreateCircle = useCallback(() => {
        const circleCount = customMagicCircles.length;
        const newCircle = createNewCircle(`法阵${circleCount + 1}`);
        onUpdateCircles([...customMagicCircles, newCircle]);
        onSelectCircle(newCircle.id);
        setCurrentLayerId(newCircle.layers[0]?.id || null);
    }, [customMagicCircles, onUpdateCircles, onSelectCircle]);

    // 删除法阵
    const handleDeleteCircle = useCallback((circleId: string) => {
        if (customMagicCircles.length <= 1) return; // 至少保留一个法阵
        const updatedCircles = customMagicCircles.filter(c => c.id !== circleId);
        onUpdateCircles(updatedCircles);
        if (currentCircleId === circleId) {
            onSelectCircle(updatedCircles[0]?.id || null);
            setCurrentLayerId(updatedCircles[0]?.layers[0]?.id || null);
        }
    }, [customMagicCircles, currentCircleId, onUpdateCircles, onSelectCircle]);

    // 重命名法阵
    const handleRenameCircle = useCallback((circleId: string, newName: string) => {
        const updatedCircles = customMagicCircles.map(c =>
            c.id === circleId ? { ...c, name: newName, updatedAt: Date.now() } : c
        );
        onUpdateCircles(updatedCircles);
    }, [customMagicCircles, onUpdateCircles]);

    // 切换法阵显示/隐藏
    const handleToggleCircleEnabled = useCallback((circleId: string, enabled: boolean) => {
        const updatedCircles = customMagicCircles.map(c =>
            c.id === circleId ? { ...c, enabled, updatedAt: Date.now() } : c
        );
        onUpdateCircles(updatedCircles);
    }, [customMagicCircles, onUpdateCircles]);

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
                    top: 20,
                    bottom: 20,
                    width: 200,
                    background: 'linear-gradient(135deg, rgba(15,15,20,0.9) 0%, rgba(20,20,30,0.9) 100%)',
                    borderRadius: 12,
                    padding: 16,
                    pointerEvents: 'auto',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div style={{ color: 'var(--ui-primary)', fontSize: 13, marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BrushIcon size={16} style={{ color: 'var(--ui-primary)' }} />
                    <span>画笔工具</span>
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
                                background: brushType === type ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                border: brushType === type ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 6,
                                color: brushType === type ? 'var(--ui-primary)' : 'rgba(255,255,255,0.6)',
                                fontSize: 12,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {type === 'particle' ? '粒子' : '丝环'}
                        </button>
                    ))}
                </div>

                {/* 画笔参数 */}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
                    {brushType === 'particle' ? (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>压感模式</span>
                                    <span style={{ color: 'var(--ui-primary)' }}>
                                        {particleSettings.pressureMode === 'brightness' ? '亮度' : particleSettings.pressureMode === 'calligraphy' ? '书法' : '无'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setParticleSettings(prev => ({ ...prev, pressureMode: 'none' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (particleSettings.pressureMode ?? 'calligraphy') === 'none' ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'none' ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'none' ? 'var(--ui-primary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        无
                                    </button>
                                    <button
                                        onClick={() => setParticleSettings(prev => ({ ...prev, pressureMode: 'calligraphy' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (particleSettings.pressureMode ?? 'calligraphy') === 'calligraphy' ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'calligraphy' ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'calligraphy' ? 'var(--ui-primary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        书法
                                    </button>
                                    <button
                                        onClick={() => setParticleSettings(prev => ({ ...prev, pressureMode: 'brightness' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (particleSettings.pressureMode ?? 'calligraphy') === 'brightness' ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'brightness' ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'brightness' ? 'var(--ui-primary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        亮度
                                    </button>
                                </div>
                            </div>

                            {/* 粒子大小 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>粒子大小</span>
                                    <span style={{ color: 'var(--ui-primary)' }}>{(particleSettings.particleSize || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={50}
                                    max={300}
                                    step={10}
                                    value={particleSettings.particleSize || 2}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, particleSize: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 粒子密度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>粒子密度</span>
                                    <span style={{ color: 'var(--ui-primary)' }}>{(particleSettings.particleDensity ?? defaultParticleSettings.particleDensity ?? 300).toFixed(0)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={100}
                                    max={800}
                                    step={10}
                                    value={particleSettings.particleDensity ?? defaultParticleSettings.particleDensity ?? 300}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, particleDensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 亮度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>亮度</span>
                                    <span style={{ color: 'var(--ui-primary)' }}>{(particleSettings.brightness || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    step={0.5}
                                    value={particleSettings.brightness || 2}
                                    onChange={(e) => setParticleSettings(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 笔触粗细 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                    <span>笔触粗细</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--ui-primary)' }}>{particleSettings.bandwidth || 15}</span>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={particleSettings.spatialThickness || false}
                                                onChange={(e) => setParticleSettings(prev => ({
                                                    ...prev,
                                                    spatialThickness: e.target.checked,
                                                    zThickness: e.target.checked ? (prev.zThickness ?? prev.bandwidth ?? 15) : prev.zThickness
                                                }))}
                                                style={{ marginRight: 4, cursor: 'pointer' }}
                                            />
                                            空间粗细
                                        </label>
                                    </div>
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
                            {/* Z方向范围（仅空间粗细开启时显示） */}
                            {particleSettings.spatialThickness && (
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                        <span>Z方向范围</span>
                                        <span style={{ color: 'var(--ui-primary)' }}>{particleSettings.zThickness ?? particleSettings.bandwidth ?? 15}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={50}
                                        step={1}
                                        value={particleSettings.zThickness ?? particleSettings.bandwidth ?? 15}
                                        onChange={(e) => setParticleSettings(prev => ({ ...prev, zThickness: Number(e.target.value) }))}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>压感模式</span>
                                    <span style={{ color: 'var(--ui-secondary)' }}>
                                        {silkSettings.pressureMode === 'calligraphy' ? '书法' : silkSettings.pressureMode === 'brightness' ? '亮度' : '无'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setSilkSettings(prev => ({ ...prev, pressureMode: 'none' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (silkSettings.pressureMode ?? 'none') === 'none' ? 'rgba(var(--ui-secondary-rgb, 0,255,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (silkSettings.pressureMode ?? 'none') === 'none' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (silkSettings.pressureMode ?? 'none') === 'none' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        无
                                    </button>
                                    <button
                                        onClick={() => setSilkSettings(prev => ({ ...prev, pressureMode: 'calligraphy' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (silkSettings.pressureMode ?? 'none') === 'calligraphy' ? 'rgba(var(--ui-secondary-rgb, 0,255,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (silkSettings.pressureMode ?? 'none') === 'calligraphy' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (silkSettings.pressureMode ?? 'none') === 'calligraphy' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        书法
                                    </button>
                                    <button
                                        onClick={() => setSilkSettings(prev => ({ ...prev, pressureMode: 'brightness' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: (silkSettings.pressureMode ?? 'none') === 'brightness' ? 'rgba(var(--ui-secondary-rgb, 0,255,255), 0.15)' : 'rgba(50, 50, 60, 0.6)',
                                            border: (silkSettings.pressureMode ?? 'none') === 'brightness' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            color: (silkSettings.pressureMode ?? 'none') === 'brightness' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        亮度
                                    </button>
                                </div>
                            </div>

                            {/* 线环粗细 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>线环粗细</span>
                                    <span style={{ color: 'var(--ui-secondary)' }}>{((silkSettings.thickness || 0.02) * 1000).toFixed(0)}</span>
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
                                    <span style={{ color: 'var(--ui-secondary)' }}>{(silkSettings.emissive || 2).toFixed(1)}</span>
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
                                    <span style={{ color: 'var(--ui-secondary)' }}>{(silkSettings.fresnelPower || 2).toFixed(1)}</span>
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

            {/* 画布左上角：Edit/Preview 模式切换按钮 */}
            <div
                style={{
                    position: 'absolute',
                    // 画布左边缘 = 50% - min(32.5vh, 32.5vw)，按钮在边框之上
                    left: 'calc(50% - min(32.5vh, 32.5vw))',
                    top: 'calc(50% - min(32.5vh, 32.5vw) - 36px)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 4,
                    pointerEvents: 'auto'
                }}
            >
                <button
                    onClick={() => setViewMode('edit')}
                    style={{
                        padding: '6px 12px',
                        background: viewMode === 'edit' ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.2)' : 'rgba(50, 50, 60, 0.6)',
                        border: viewMode === 'edit' ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px 0 0 6px',
                        color: viewMode === 'edit' ? 'var(--ui-primary)' : 'rgba(255,255,255,0.5)',
                        fontSize: 12,
                        fontWeight: viewMode === 'edit' ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Edit
                </button>
                <button
                    onClick={() => setViewMode('preview')}
                    style={{
                        padding: '6px 12px',
                        background: viewMode === 'preview' ? 'rgba(var(--ui-primary-rgb, 113,176,255), 0.2)' : 'rgba(50, 50, 60, 0.6)',
                        border: viewMode === 'preview' ? '1px solid var(--ui-primary)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '0 6px 6px 0',
                        color: viewMode === 'preview' ? 'var(--ui-primary)' : 'rgba(255,255,255,0.5)',
                        fontSize: 12,
                        fontWeight: viewMode === 'preview' ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Preview
                </button>
            </div>

            {/* 画布内右上角：撤销/重做 */}
            <div
                style={{
                    position: 'absolute',
                    // 画布右边缘 = 50% + min(32.5vh, 32.5vw)，按钮在画布内部距离边缘12px
                    left: 'calc(50% + min(32.5vh, 32.5vw) - 72px)',
                    top: 'calc(50% - min(32.5vh, 32.5vw) + 12px)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 6,
                    pointerEvents: 'auto'
                }}
            >
                <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: undoStack.length > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(50,50,60,0.2)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s'
                    }}
                    title="撤销"
                >
                    <UndoIcon size={14} style={{ color: undoStack.length > 0 ? 'rgba(255,255,255,0.7)' : '#444' }} />
                </button>
                <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: redoStack.length > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(50,50,60,0.2)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s'
                    }}
                    title="重做"
                >
                    <RedoIcon size={14} style={{ color: redoStack.length > 0 ? 'rgba(255,255,255,0.7)' : '#444' }} />
                </button>
            </div>

            {/* 右侧控制面板 - 法阵列表、对称设置、图层管理 */}
            <DrawingControlPanel
                customMagicCircles={customMagicCircles}
                currentCircleId={currentCircleId}
                onSelectCircle={(id) => {
                    onSelectCircle(id);
                    const circle = customMagicCircles.find(c => c.id === id);
                    setCurrentLayerId(circle?.layers[0]?.id || null);
                }}
                onToggleCircleEnabled={handleToggleCircleEnabled}
                onCreateCircle={handleCreateCircle}
                onDeleteCircle={handleDeleteCircle}
                onRenameCircle={handleRenameCircle}
                currentLayerId={currentLayerId}
                onSelectLayer={setCurrentLayerId}
                onToggleLayerVisibility={handleToggleVisibility}
                soloLayerId={soloLayerId}
                onToggleLayerSolo={handleToggleSolo}
                onDeleteLayer={handleDeleteLayer}
                onCreateLayer={handleNewLayer}
                symmetryMode={symmetryMode}
                symmetryDivisions={symmetryDivisions}
                onUpdateSymmetry={handleUpdateSymmetry}
                onClose={onClose}
            />
        </div>
    );
};

export default DrawingCanvasOverlay;
