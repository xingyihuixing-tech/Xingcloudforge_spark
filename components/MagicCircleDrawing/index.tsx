/**
 * input: drawingModeActive, customMagicCircles from App.tsx, particle/silk/lightsaber brush pressureMode
 * output: Drawing overlay UI with 3D canvas, brush tools (particle/silk/lightsaber), symmetry controls, layer panel
 * pos: Main React component for custom magic circle drawing system
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 * 2026-01-08: 新增光剑(lightsaber)画笔类型，支持核心/光晕双色、核心宽度、光晕强度/衰减、脉冲效果、压感模式
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
    SilkRingSettings,
    LightsaberSettings,
    BrushPreset
} from '../../types';
import {
    createDrawingScene,
    updateSymmetryAxes,
    screenToCanvas,
    createParticleStrokeMesh,
    createLineStrokeMesh,
    createLightsaberStrokeMesh,
    renderStrokesToGroup,
    createNewCircle,
    createNewLayer,
    disposeDrawingResources,
    DrawingSystemRefs,
    applySymmetryTransform
} from '../../utils/drawingSystem';
import { DrawingControlPanel } from './DrawingControlPanel';
import { UndoIcon, RedoIcon, BrushIcon, ClearIcon } from './Icons';
import { useUser } from '../../contexts/UserContext';

// 本地存储键
const BRUSH_PRESETS_STORAGE_KEY = 'nebula_brush_presets';

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
    opacity: 0.9,            // 透明度 0.1-1
    emissive: 2.0,           // 发光强度 0.5-4
    fresnelPower: 2.0,       // 菲涅尔边缘 0.5-5
    sparkleEnabled: false,   // 闪点开关
    sparkleThreshold: 0.95,  // 闪点阈值 0.8-0.99
    flowSpeed: 1.0,          // 流动速度 0-20
    strandDensity: 30,       // 丝线密度 5-100
    bloomBoost: 0.5,         // 泛光 0-2
    // 波动参数 (与光环系统一致)
    waveType: 'off',         // 波形类型: off/sine/triangle
    wobbleFrequency: 10,     // 波动频率 1-80
    wobbleAmplitude: 0.5,    // 波动幅度 0.1-3
    pressureMode: 'none'
};

const defaultLightsaberSettings: Partial<LightsaberSettings> = {
    coreWidth: 0.4,          // 核心宽度 0.2-0.8
    coreColor: '#ffffff',    // 核心颜色
    glowColor: '#00aaff',    // 光晕颜色
    glowIntensity: 1.5,      // 光晕强度 0.5-3
    glowFalloff: 2.0,        // 光晕衰减 1-5
    thickness: 0.03,         // 线条粗细 0.001-0.1
    pulseEnabled: false,     // 脉冲开关
    pulseSpeed: 1.0,         // 脉冲速度 0.5-3
    pulseIntensity: 0.2,     // 脈冲强度 0-0.5
    pressureMode: 'none',
    smoothness: 0.5          // 笔迹平滑 0-1
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
    const [lightsaberSettings, setLightsaberSettings] = useState<Partial<LightsaberSettings>>(defaultLightsaberSettings);
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

    // 墨迹预设
    const { currentUser, saveCloudConfig, loadCloudConfig } = useUser();
    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);  // 当前选中的预设
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);  // 正在编辑名称的预设
    const [editingPresetName, setEditingPresetName] = useState('');  // 编辑中的名称
    const lastPreviewUpdateRef = useRef<number>(0);  // 预览更新节流

    // 加载预设（从本地存储，未来可扩展为云同步）
    useEffect(() => {
        try {
            const saved = localStorage.getItem(BRUSH_PRESETS_STORAGE_KEY);
            if (saved) {
                setBrushPresets(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load brush presets:', e);
        }
    }, []);

    // 保存预设到本地存储（并尝试云同步）
    const savePresetsToStorage = useCallback((presets: BrushPreset[]) => {
        setBrushPresets(presets);
        localStorage.setItem(BRUSH_PRESETS_STORAGE_KEY, JSON.stringify(presets));
        // 尝试云同步
        if (currentUser) {
            saveCloudConfig({ brushPresets: presets }).catch(e => console.warn('Cloud sync failed:', e));
        }
    }, [currentUser, saveCloudConfig]);

    // 创建新预设（直接使用默认名称）
    const handleCreatePreset = useCallback(() => {
        const newPreset: BrushPreset = {
            id: `preset_${Date.now()}`,
            name: `预设${brushPresets.length + 1}`,
            createdAt: Date.now(),
            brushType,
            particleSettings: brushType === 'particle' ? { ...particleSettings } : undefined,
            silkSettings: brushType === 'lineRing' ? { ...silkSettings } : undefined,
            lightsaberSettings: brushType === 'lightsaber' ? { ...lightsaberSettings } : undefined,
            color: brushColor
        };
        savePresetsToStorage([...brushPresets, newPreset]);
    }, [brushType, particleSettings, silkSettings, lightsaberSettings, brushColor, brushPresets, savePresetsToStorage]);

    // 更新预设（将当前参数保存到已选中的预设）
    const handleUpdatePreset = useCallback((presetId: string) => {
        const updatedPresets = brushPresets.map(p =>
            p.id === presetId ? {
                ...p,
                brushType,
                particleSettings: brushType === 'particle' ? { ...particleSettings } : undefined,
                silkSettings: brushType === 'lineRing' ? { ...silkSettings } : undefined,
                lightsaberSettings: brushType === 'lightsaber' ? { ...lightsaberSettings } : undefined,
                color: brushColor,
                updatedAt: Date.now()
            } : p
        );
        savePresetsToStorage(updatedPresets);
        setSelectedPresetId(null);  // 保存后取消选中
    }, [brushType, particleSettings, silkSettings, lightsaberSettings, brushColor, brushPresets, savePresetsToStorage]);

    // 重命名预设
    const handleRenamePreset = useCallback((presetId: string, newName: string) => {
        if (!newName.trim()) return;
        const updatedPresets = brushPresets.map(p =>
            p.id === presetId ? { ...p, name: newName.trim() } : p
        );
        savePresetsToStorage(updatedPresets);
        setEditingPresetId(null);
        setEditingPresetName('');
    }, [brushPresets, savePresetsToStorage]);

    // 应用预设
    const handleApplyPreset = useCallback((preset: BrushPreset) => {
        setBrushType(preset.brushType);
        if (preset.particleSettings) setParticleSettings(preset.particleSettings);
        if (preset.silkSettings) setSilkSettings(preset.silkSettings);
        if (preset.lightsaberSettings) setLightsaberSettings(preset.lightsaberSettings);
        setBrushColor(preset.color);
    }, []);

    // 删除预设
    const handleDeletePreset = useCallback((presetId: string) => {
        savePresetsToStorage(brushPresets.filter(p => p.id !== presetId));
    }, [brushPresets, savePresetsToStorage]);

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
        const { scene, camera, canvasGroup, strokesGroup, symmetryAxesGroup, centerPoint } = createDrawingScene();

        refsRef.current = {
            camera,
            scene,
            canvasGroup,
            strokesGroup,
            symmetryAxesGroup,
            centerPoint,
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
        let startTime = Date.now();
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            const refs = refsRef.current;
            if (!refs.scene || !refs.camera) return;

            // 更新 OrbitControls（如果存在）
            if (orbitControlsRef.current) {
                orbitControlsRef.current.update();
            }

            // 更新中心点漩涡动画
            if (refs.centerPoint && (refs.centerPoint.material as THREE.ShaderMaterial).uniforms) {
                const elapsed = (Date.now() - startTime) / 1000;
                (refs.centerPoint.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;

                // 更新所有丝环笔画的uTime (修复压感模式下流动效果静止)
                if (refs.strokesGroup) {
                    refs.strokesGroup.traverse((child) => {
                        if (child instanceof THREE.Group && child.userData.silkMaterials) {
                            const materials = child.userData.silkMaterials as THREE.ShaderMaterial[];
                            for (const mat of materials) {
                                if (mat.uniforms && mat.uniforms.uTime) {
                                    mat.uniforms.uTime.value = elapsed;
                                }
                            }
                        }
                    });
                }
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

            // 隐藏辅助元素（中心点、对称轴）- 边框已用CSS实现
            if (refs.centerPoint) refs.centerPoint.visible = false;
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
                // 画布渲染使用默认参数（无法阵级别调节，脉冲关闭，粒子大小缩放）
                const defaultMcSettings = {
                    opacity: 1.0,
                    hueShift: 0,
                    brightness: 1.0,
                    pulseEnabled: false,
                    pulseSpeed: 1.0,
                    pulseIntensity: 0.3,
                    particleSizeScale: 0.002  // 画布中粒子大幅缩小
                };
                if (stroke.brushType === 'particle') {
                    mesh = createParticleStrokeMesh(
                        stroke.points,
                        stroke.color,
                        stroke.particleRingSettings || {},
                        layer.symmetryMode,
                        layer.symmetryDivisions,
                        defaultMcSettings
                    );
                } else if (stroke.brushType === 'lightsaber') {
                    mesh = createLightsaberStrokeMesh(
                        stroke.points,
                        stroke.color,
                        stroke.lightsaberSettings || {},
                        layer.symmetryMode,
                        layer.symmetryDivisions,
                        defaultMcSettings
                    );
                } else {
                    mesh = createLineStrokeMesh(
                        stroke.points,
                        stroke.color,
                        stroke.silkRingSettings || {},
                        layer.symmetryMode,
                        layer.symmetryDivisions,
                        defaultMcSettings
                    );
                }
                strokesGroup.add(mesh);
            }
        }
    }, [isActive, currentCircle, soloLayerId]);

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
        // 容器现在就是画布尺寸（100%填充wrapper），直接使用
        const canvasSize = Math.min(rect.width, rect.height);

        const canvasRect = {
            left: rect.left,
            top: rect.top,
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
        // 容器现在就是画布尺寸，直接使用
        const canvasSize = Math.min(rect.width, rect.height);

        const canvasRect = {
            left: rect.left,
            top: rect.top,
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

        // 实时预览当前笔画（节流：每50ms更新一次）
        const now = Date.now();
        if (now - lastPreviewUpdateRef.current > 50) {
            lastPreviewUpdateRef.current = now;
            updateCurrentStrokePreview();
        }
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

        // 创建新预览（降低密度以提高性能）
        const previewMcSettings = { particleSizeScale: 0.002 };  // 画布粒子缩放
        if (brushType === 'particle') {
            // 预览时使用较低的密度以避免卡顿
            const previewSettings = {
                ...particleSettings,
                particleDensity: Math.max(50, Math.floor((particleSettings.particleDensity ?? 300) / 4))
            };
            refs.currentStrokeMesh = createParticleStrokeMesh(
                currentStrokeRef.current,
                brushColor,
                previewSettings,
                symmetryMode,
                symmetryDivisions,
                previewMcSettings
            );
        } else if (brushType === 'lightsaber') {
            refs.currentStrokeMesh = createLightsaberStrokeMesh(
                currentStrokeRef.current,
                brushColor,
                lightsaberSettings,
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
    }, [brushType, brushColor, particleSettings, silkSettings, lightsaberSettings, symmetryMode, symmetryDivisions]);

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
                lightsaberSettings: brushType === 'lightsaber' ? { ...lightsaberSettings } : undefined,
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
    }, [isDrawing, currentCircle, currentLayerId, brushType, particleSettings, silkSettings, lightsaberSettings, brushColor, customMagicCircles, onUpdateCircles]);

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

    // 清空当前图层所有笔画
    const handleClear = useCallback(() => {
        if (!currentCircle || !currentLayerId) return;

        const currentLayerStrokes = currentLayer?.strokes || [];
        if (currentLayerStrokes.length === 0) return;

        const updatedCircles = customMagicCircles.map(c => {
            if (c.id !== currentCircle.id) return c;
            return {
                ...c,
                layers: c.layers.map(l => {
                    if (l.id !== currentLayerId) return l;
                    return { ...l, strokes: [] };
                })
            };
        });

        onUpdateCircles(updatedCircles);
        setUndoStack([]);  // 清空撤销栈
        setRedoStack([]);  // 清空重做栈
    }, [currentCircle, currentLayer, currentLayerId, customMagicCircles, onUpdateCircles]);

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
            {/* 左侧画笔工具面板 - 极高透明玻璃样式 */}
            <div
                className="drawing-panel-glass"
                style={{
                    position: 'absolute',
                    left: 20,
                    top: 100,
                    width: 220,
                    maxHeight: 'calc(100vh - 220px)',
                    borderRadius: 16,
                    padding: 16,
                    pointerEvents: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div style={{ color: 'var(--ui-primary)', fontSize: 13, marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <BrushIcon size={16} style={{ color: 'var(--ui-primary)' }} />
                    <span>画笔工具</span>
                </div>

                {/* 墨迹预设 - 固定在顶部 */}
                <div style={{ marginBottom: 12, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#ffffff' }}>墨迹预设</span>
                        <button
                            onClick={handleCreatePreset}
                            style={{
                                width: 24,
                                height: 24,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: 4,
                                color: '#ffffff',
                                fontSize: 16,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="新建预设"
                        >
                            +
                        </button>
                    </div>
                    <div style={{
                        maxHeight: 100,
                        overflowY: 'auto',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }} className="custom-scrollbar">
                        {brushPresets.length === 0 ? (
                            <div style={{ padding: 10, fontSize: 11, color: '#666', textAlign: 'center' }}>
                                暂无预设
                            </div>
                        ) : (
                            brushPresets.map(preset => {
                                const isSelected = selectedPresetId === preset.id;
                                const isEditing = editingPresetId === preset.id;
                                return (
                                    <div
                                        key={preset.id}
                                        onClick={() => {
                                            if (isEditing) return;
                                            if (isSelected) {
                                                handleUpdatePreset(preset.id);
                                            } else {
                                                handleApplyPreset(preset);
                                                setSelectedPresetId(preset.id);
                                            }
                                        }}
                                        onDoubleClick={() => {
                                            if (!isEditing) {
                                                setEditingPresetId(preset.id);
                                                setEditingPresetName(preset.name);
                                            }
                                        }}
                                        style={{
                                            padding: '6px 8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 6,
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(var(--ui-primary-rgb), 0.15)' : 'transparent',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            transition: 'background 0.15s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editingPresetName}
                                                    onChange={(e) => setEditingPresetName(e.target.value)}
                                                    onBlur={() => handleRenamePreset(preset.id, editingPresetName)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePreset(preset.id, editingPresetName); if (e.key === 'Escape') { setEditingPresetId(null); setEditingPresetName(''); } }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{ flex: 1, fontSize: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--ui-primary)', borderRadius: 3, color: '#fff', padding: '2px 4px', outline: 'none' }}
                                                />
                                            ) : (
                                                <>
                                                    <span style={{ fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
                                                    <span style={{ fontSize: 9, color: '#666', flexShrink: 0 }}>{preset.brushType === 'particle' ? '粒子' : preset.brushType === 'lightsaber' ? '光剑' : '丝环'}</span>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); if (selectedPresetId === preset.id) setSelectedPresetId(null); }}
                                            style={{ width: 18, height: 18, background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 3, color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                            title="删除预设"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 画笔类型 - 固定 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexShrink: 0 }}>
                    {(['particle', 'lineRing', 'lightsaber'] as DrawingBrushType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setBrushType(type)}
                            className={brushType === type ? 'drawing-btn-active' : 'drawing-btn-ghost'}
                            style={{
                                flex: 1,
                                padding: '6px 0',
                                fontSize: 11,
                                cursor: 'pointer'
                            }}
                        >
                            {type === 'particle' ? '粒子' : type === 'lightsaber' ? '光剑' : '丝环'}
                        </button>
                    ))}
                </div>

                {/* 画笔参数 - 可滚动区域 */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', fontSize: 11, color: '#ffffff' }} className="custom-scrollbar">
                    {brushType === 'particle' && (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>压感模式</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setParticleSettings(prev => ({ ...prev, pressureMode: 'none' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: 'transparent',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'none' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'none' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
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
                                            background: 'transparent',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'calligraphy' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'calligraphy' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
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
                                            background: 'transparent',
                                            border: (particleSettings.pressureMode ?? 'calligraphy') === 'brightness' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: 6,
                                            color: (particleSettings.pressureMode ?? 'calligraphy') === 'brightness' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.6)',
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        亮度
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>粒子大小</span>
                                    <span style={{ color: '#ffffff' }}>{(particleSettings.particleSize || 2).toFixed(1)}</span>
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
                                    <span style={{ color: '#ffffff' }}>{(particleSettings.particleDensity ?? defaultParticleSettings.particleDensity ?? 300).toFixed(0)}</span>
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
                                    <span style={{ color: '#ffffff' }}>{(particleSettings.brightness || 2).toFixed(1)}</span>
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
                                        <span style={{ color: '#ffffff' }}>{particleSettings.bandwidth || 15}</span>
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
                                        <span style={{ color: '#ffffff' }}>{particleSettings.zThickness ?? particleSettings.bandwidth ?? 15}</span>
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
                    )}
                    {brushType === 'lineRing' && (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>压感模式</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setSilkSettings(prev => ({ ...prev, pressureMode: 'none' }))}
                                        style={{
                                            flex: 1,
                                            padding: '6px 0',
                                            background: 'transparent',
                                            border: (silkSettings.pressureMode ?? 'none') === 'none' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
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
                                            background: 'transparent',
                                            border: (silkSettings.pressureMode ?? 'none') === 'calligraphy' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
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
                                            background: 'transparent',
                                            border: (silkSettings.pressureMode ?? 'none') === 'brightness' ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.2)',
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
                                    <span style={{ color: '#ffffff' }}>{((silkSettings.thickness || 0.02) * 1000).toFixed(0)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={160}
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
                                    <span style={{ color: '#ffffff' }}>{(silkSettings.emissive || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.1}
                                    max={6}
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
                                    <span style={{ color: '#ffffff' }}>{(silkSettings.fresnelPower || 2).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.02}
                                    max={5}
                                    step={0.02}
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
                                    <span style={{ color: '#ffffff' }}>{(silkSettings.flowSpeed || 1).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={20}
                                    step={0.5}
                                    value={silkSettings.flowSpeed || 1}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, flowSpeed: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 丝线密度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>丝线密度</span>
                                    <span style={{ color: '#ffffff' }}>{silkSettings.strandDensity || 30}</span>
                                </div>
                                <input
                                    type="range"
                                    min={5}
                                    max={100}
                                    step={1}
                                    value={silkSettings.strandDensity || 30}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, strandDensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 透明度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>透明度</span>
                                    <span style={{ color: '#ffffff' }}>{(silkSettings.opacity || 0.9).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    value={silkSettings.opacity || 0.9}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 泛光 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>泛光</span>
                                    <span style={{ color: '#ffffff' }}>{(silkSettings.bloomBoost || 0.5).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.05}
                                    value={silkSettings.bloomBoost || 0.5}
                                    onChange={(e) => setSilkSettings(prev => ({ ...prev, bloomBoost: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* 几何波动 */}
                            <div style={{
                                marginTop: 12,
                                padding: '8px 10px',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{
                                    fontSize: 11,
                                    color: 'var(--ui-secondary)',
                                    marginBottom: 8
                                }}>
                                    几何波动
                                </div>

                                {/* 波形类型选择器 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 12 }}>波形</span>
                                    <select
                                        value={silkSettings.waveType || 'off'}
                                        onChange={(e) => setSilkSettings(prev => ({ ...prev, waveType: e.target.value as any }))}
                                        style={{
                                            flex: 1,
                                            padding: '4px 8px',
                                            background: 'rgba(30,30,40,0.8)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 4,
                                            color: '#fff',
                                            fontSize: 12,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="off">关闭</option>
                                        <option value="sine">正弦波</option>
                                        <option value="triangle">三角波</option>
                                    </select>
                                </div>

                                {silkSettings.waveType && silkSettings.waveType !== 'off' && (
                                    <>
                                        {/* 波动频率 */}
                                        <div style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <span>波动频率</span>
                                                <span style={{ color: '#ffffff' }}>{silkSettings.wobbleFrequency || 10}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={1}
                                                max={80}
                                                step={1}
                                                value={silkSettings.wobbleFrequency || 10}
                                                onChange={(e) => setSilkSettings(prev => ({ ...prev, wobbleFrequency: Number(e.target.value) }))}
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        {/* 波动幅度 */}
                                        <div style={{ marginBottom: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <span>波动幅度</span>
                                                <span style={{ color: '#ffffff' }}>{(silkSettings.wobbleAmplitude || 0.5).toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0.1}
                                                max={3}
                                                step={0.1}
                                                value={silkSettings.wobbleAmplitude || 0.5}
                                                onChange={(e) => setSilkSettings(prev => ({ ...prev, wobbleAmplitude: Number(e.target.value) }))}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                    {brushType === 'lightsaber' && (
                        <>
                            {/* 压感模式 */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>压感模式</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setLightsaberSettings(prev => ({ ...prev, pressureMode: 'none' }))}
                                        style={{
                                            flex: 1,
                                            padding: '5px 0',
                                            background: 'transparent',
                                            border: `1px solid ${lightsaberSettings.pressureMode === 'none' ? 'var(--ui-primary)' : 'var(--ui-secondary)'}`,
                                            color: lightsaberSettings.pressureMode === 'none' ? 'var(--ui-primary)' : '#666',
                                            fontSize: 10,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        无
                                    </button>
                                    <button
                                        onClick={() => setLightsaberSettings(prev => ({ ...prev, pressureMode: 'calligraphy' }))}
                                        style={{
                                            flex: 1,
                                            padding: '5px 0',
                                            background: 'transparent',
                                            border: `1px solid ${lightsaberSettings.pressureMode === 'calligraphy' ? 'var(--ui-primary)' : 'var(--ui-secondary)'}`,
                                            color: lightsaberSettings.pressureMode === 'calligraphy' ? 'var(--ui-primary)' : '#666',
                                            fontSize: 10,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        书法
                                    </button>
                                    <button
                                        onClick={() => setLightsaberSettings(prev => ({ ...prev, pressureMode: 'brightness' }))}
                                        style={{
                                            flex: 1,
                                            padding: '5px 0',
                                            background: 'transparent',
                                            border: `1px solid ${lightsaberSettings.pressureMode === 'brightness' ? 'var(--ui-primary)' : 'var(--ui-secondary)'}`,
                                            color: lightsaberSettings.pressureMode === 'brightness' ? 'var(--ui-primary)' : '#666',
                                            fontSize: 10,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        亮度
                                    </button>
                                </div>
                            </div>

                            {/* 线条粗细 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>线条粗细</span>
                                    <span style={{ color: '#ffffff' }}>{((lightsaberSettings.thickness || 0.03) * 1000).toFixed(0)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={100}
                                    step={1}
                                    value={(lightsaberSettings.thickness || 0.03) * 1000}
                                    onChange={(e) => setLightsaberSettings(prev => ({ ...prev, thickness: Number(e.target.value) / 1000 }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 核心宽度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>核心宽度</span>
                                    <span style={{ color: '#ffffff' }}>{(lightsaberSettings.coreWidth || 0.4).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.2}
                                    max={0.8}
                                    step={0.05}
                                    value={lightsaberSettings.coreWidth || 0.4}
                                    onChange={(e) => setLightsaberSettings(prev => ({ ...prev, coreWidth: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 光晕强度 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>光晕强度</span>
                                    <span style={{ color: '#ffffff' }}>{(lightsaberSettings.glowIntensity || 1.5).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0.5}
                                    max={3}
                                    step={0.1}
                                    value={lightsaberSettings.glowIntensity || 1.5}
                                    onChange={(e) => setLightsaberSettings(prev => ({ ...prev, glowIntensity: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 光晕衰减 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>光晕衰减</span>
                                    <span style={{ color: '#ffffff' }}>{(lightsaberSettings.glowFalloff || 2.0).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={5}
                                    step={0.2}
                                    value={lightsaberSettings.glowFalloff || 2.0}
                                    onChange={(e) => setLightsaberSettings(prev => ({ ...prev, glowFalloff: Number(e.target.value) }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 笔迹平滑 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span>笔迹平滑</span>
                                    <span style={{ color: '#ffffff' }}>{((lightsaberSettings.smoothness ?? 0.5) * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={(lightsaberSettings.smoothness ?? 0.5) * 100}
                                    onChange={(e) => setLightsaberSettings(prev => ({ ...prev, smoothness: Number(e.target.value) / 100 }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* 脉冲效果 */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <span>脉冲效果</span>
                                    <input
                                        type="checkbox"
                                        checked={lightsaberSettings.pulseEnabled || false}
                                        onChange={(e) => setLightsaberSettings(prev => ({ ...prev, pulseEnabled: e.target.checked }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </div>
                                {lightsaberSettings.pulseEnabled && (
                                    <>
                                        <div style={{ marginBottom: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <span style={{ fontSize: 10 }}>脉冲速度</span>
                                                <span style={{ color: '#ffffff' }}>{(lightsaberSettings.pulseSpeed || 1).toFixed(1)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0.5}
                                                max={3}
                                                step={0.1}
                                                value={lightsaberSettings.pulseSpeed || 1}
                                                onChange={(e) => setLightsaberSettings(prev => ({ ...prev, pulseSpeed: Number(e.target.value) }))}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <span style={{ fontSize: 10 }}>脉冲强度</span>
                                                <span style={{ color: '#ffffff' }}>{(lightsaberSettings.pulseIntensity || 0.2).toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={0.5}
                                                step={0.02}
                                                value={lightsaberSettings.pulseIntensity || 0.2}
                                                onChange={(e) => setLightsaberSettings(prev => ({ ...prev, pulseIntensity: Number(e.target.value) }))}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            {/* 双色选择 */}
                            <div style={{
                                marginTop: 12,
                                padding: '8px 10px',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ fontSize: 11, color: 'var(--ui-secondary)', marginBottom: 8 }}>
                                    光剑颜色
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 10 }}>核心</span>
                                        <input
                                            type="color"
                                            value={lightsaberSettings.coreColor || '#ffffff'}
                                            onChange={(e) => setLightsaberSettings(prev => ({ ...prev, coreColor: e.target.value }))}
                                            style={{ width: 28, height: 20, border: 'none', cursor: 'pointer', borderRadius: 3 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 10 }}>光晕</span>
                                        <input
                                            type="color"
                                            value={lightsaberSettings.glowColor || '#00aaff'}
                                            onChange={(e) => setLightsaberSettings(prev => ({ ...prev, glowColor: e.target.value }))}
                                            style={{ width: 28, height: 20, border: 'none', cursor: 'pointer', borderRadius: 3 }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {/* 颜色选择 - 在滚动区域内（光剑模式下隐藏，因为光剑有独立双色选择） */}
                    {brushType !== 'lightsaber' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: 12, color: '#ffffff' }}>颜色</span>
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                style={{ width: 40, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                            />
                            <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{brushColor}</span>
                        </div>
                    )}
                </div>

            </div>

            {/* 中央画布区域 - 带CSS渐变边框 */}
            <div
                className="drawing-canvas-wrapper"
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(70vh, 70vw)',
                    height: 'min(70vh, 70vw)',
                }}
            >
                {/* 4边渐变边框 */}
                <div className="drawing-border-top" />
                <div className="drawing-border-bottom" />
                <div className="drawing-border-left" />
                <div className="drawing-border-right" />

                {/* Three.js画布容器 */}
                <div
                    ref={canvasContainerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'auto',
                        cursor: 'crosshair',
                        touchAction: 'none'
                    }}
                />
            </div>

            {/* 画布左上角：Edit/Preview 模式切换按钮 */}
            <div
                style={{
                    position: 'absolute',
                    // 画布左边缘 = 50% - min(35vh, 35vw)，按钮在边框之上
                    left: 'calc(50% - min(35vh, 35vw))',
                    top: 'calc(50% - min(35vh, 35vw) - 36px)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 4,
                    pointerEvents: 'auto'
                }}
            >
                <button
                    onClick={() => setViewMode('edit')}
                    className={viewMode === 'edit' ? 'drawing-mode-btn-active' : 'drawing-mode-btn-inactive'}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '6px 0 0 6px',
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
                    className={viewMode === 'preview' ? 'drawing-mode-btn-active' : 'drawing-mode-btn-inactive'}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '0 6px 6px 0',
                        fontSize: 12,
                        fontWeight: viewMode === 'preview' ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Preview
                </button>
            </div>

            {/* 画布上方右侧：撤销/重做/清空 */}
            <div
                style={{
                    position: 'absolute',
                    // 画布右边缘 = 50% + min(35vh, 35vw)，按钮在画布上方
                    left: 'calc(50% + min(35vh, 35vw) - 110px)',
                    top: 'calc(50% - min(35vh, 35vw) - 36px)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 4,
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
                        background: undoStack.length > 0 ? 'rgba(50, 50, 60, 0.6)' : 'rgba(50,50,60,0.3)',
                        border: undoStack.length > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
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
                        background: redoStack.length > 0 ? 'rgba(50, 50, 60, 0.6)' : 'rgba(50,50,60,0.3)',
                        border: redoStack.length > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                    title="重做"
                >
                    <RedoIcon size={14} style={{ color: redoStack.length > 0 ? 'rgba(255,255,255,0.7)' : '#444' }} />
                </button>
                <button
                    onClick={handleClear}
                    disabled={!currentLayer || (currentLayer.strokes?.length || 0) === 0}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: (currentLayer?.strokes?.length || 0) > 0 ? 'rgba(80, 50, 50, 0.6)' : 'rgba(50,50,60,0.3)',
                        border: (currentLayer?.strokes?.length || 0) > 0 ? '1px solid rgba(255,100,100,0.2)' : '1px solid rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: (currentLayer?.strokes?.length || 0) > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                    title="清空当前图层"
                >
                    <ClearIcon size={14} style={{ color: (currentLayer?.strokes?.length || 0) > 0 ? 'rgba(255,150,150,0.8)' : '#444' }} />
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
        </div >
    );
};

export default DrawingCanvasOverlay;
