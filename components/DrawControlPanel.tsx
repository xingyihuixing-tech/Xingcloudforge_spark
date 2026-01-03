/**
 * input: DrawSettings 全局绘图设置
 * output: 绘图控制面板 UI (Dimension Crafter)
 * pos: 控制笔刷、对称、图层的面板，与星球解耦
 * update: 一旦我被更新，请更新 components/README.md
 */
import React, { useEffect, useMemo } from 'react';
import {
    BrushSettings,
    BrushType,
    DrawSettings,
    Drawing,
    DrawingLayer,
    PlanetSceneSettings,
    RadialReflectionMode,
    Symmetry2DMode,
    Symmetry3DMode
} from '../types';

interface DrawControlPanelProps {
    settings: DrawSettings;
    setSettings: React.Dispatch<React.SetStateAction<DrawSettings>>;
    planetSettings: PlanetSceneSettings;
}

const DrawControlPanel: React.FC<DrawControlPanelProps> = ({ settings, setSettings, planetSettings }) => {

    // Ensure we have at least one Drawing
    useEffect(() => {
        const drawings = settings.drawings || [];
        if (drawings.length === 0) {
            const defaultDrawing: Drawing = {
                id: 'drawing-' + Date.now(),
                name: '我的绘图',
                visible: true,
                layers: [],
                activeLayerId: null
            };
            setSettings(prev => ({
                ...prev,
                drawings: [defaultDrawing],
                activeDrawingId: defaultDrawing.id
            }));
        }
    }, []);

    // Helpers
    const activeDrawing = useMemo(() =>
        settings.drawings?.find(d => d.id === settings.activeDrawingId),
        [settings.drawings, settings.activeDrawingId]);

    const activeLayer = useMemo(() =>
        activeDrawing?.layers.find(l => l.id === activeDrawing.activeLayerId),
        [activeDrawing]);

    const activePlacement = useMemo(() => {
        if (!settings.previewPlanetId || !activeDrawing) return null;
        return (settings.placements || []).find(p => p.drawingId === activeDrawing.id && p.planetId === settings.previewPlanetId) || null;
    }, [settings.placements, settings.previewPlanetId, activeDrawing]);

    // Action: Create new Drawing
    const addNewDrawing = () => {
        const newDrawing: Drawing = {
            id: 'drawing-' + Date.now(),
            name: `绘图 ${(settings.drawings?.length || 0) + 1}`,
            visible: true,
            layers: [],
            activeLayerId: null
        };
        setSettings(prev => ({
            ...prev,
            drawings: [...(prev.drawings || []), newDrawing],
            activeDrawingId: newDrawing.id
        }));
    };

    // Action: Add Layer (to active Drawing)
    const addNewLayer = () => {
        if (!activeDrawing) return;

        const newLayer: DrawingLayer = {
            id: 'layer-' + Date.now(),
            name: `图层 ${activeDrawing.layers.length + 1}`,
            visible: true,
            tilt: { x: 0, y: 0, z: 0 },
            scale: 1,
            altitude: 0,
            rotationSpeed: 0,
            brushType: settings.brush.type,
            color: settings.brush.color,
            opacity: 1,
            blending: 'additive',
            strokes: []
        };

        setSettings(prev => ({
            ...prev,
            drawings: (prev.drawings || []).map(d => {
                if (d.id === activeDrawing.id) {
                    return {
                        ...d,
                        layers: [...d.layers, newLayer],
                        activeLayerId: newLayer.id
                    };
                }
                return d;
            })
        }));
    };

    // Action: Update Active Layer
    const updateActiveLayer = (updates: Partial<DrawingLayer>) => {
        if (!activeDrawing || !activeLayer) return;

        setSettings(prev => ({
            ...prev,
            drawings: (prev.drawings || []).map(d => {
                if (d.id === activeDrawing.id) {
                    return {
                        ...d,
                        layers: d.layers.map(l => l.id === activeLayer.id ? { ...l, ...updates } : l)
                    };
                }
                return d;
            })
        }));
    };

    // Action: Toggle Layer Visibility
    const toggleLayerVisibility = (layerId: string) => {
        if (!activeDrawing) return;
        setSettings(prev => ({
            ...prev,
            drawings: (prev.drawings || []).map(d => {
                if (d.id === activeDrawing.id) {
                    return {
                        ...d,
                        layers: d.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l)
                    };
                }
                return d;
            })
        }));
    };

    // Action: Delete Layer
    const deleteLayer = (layerId: string) => {
        if (!activeDrawing) return;
        setSettings(prev => ({
            ...prev,
            drawings: (prev.drawings || []).map(d => {
                if (d.id === activeDrawing.id) {
                    const newLayers = d.layers.filter(l => l.id !== layerId);
                    const newActiveId = (layerId === d.activeLayerId)
                        ? (newLayers[newLayers.length - 1]?.id || null)
                        : d.activeLayerId;
                    return {
                        ...d,
                        layers: newLayers,
                        activeLayerId: newActiveId
                    };
                }
                return d;
            })
        }));
    };

    const updateBrush = (updates: Partial<BrushSettings>) => {
        setSettings(prev => {
            const nextBrush = { ...prev.brush, ...updates };
            const next: DrawSettings = { ...prev, brush: nextBrush };

            const currentDrawing = (prev.drawings || []).find(d => d.id === prev.activeDrawingId) || null;
            const currentLayer = currentDrawing?.layers.find(l => l.id === currentDrawing.activeLayerId) || null;
            if (!currentDrawing?.id || !currentLayer?.id) return next;

            const layerUpdates: Partial<DrawingLayer> = {};
            if (updates.type) layerUpdates.brushType = updates.type;
            if (updates.color) layerUpdates.color = updates.color;

            if (Object.keys(layerUpdates).length === 0) return next;

            next.drawings = (next.drawings || []).map(d => {
                if (d.id !== currentDrawing.id) return d;
                return {
                    ...d,
                    layers: (d.layers || []).map(l => l.id === currentLayer.id ? { ...l, ...layerUpdates } : l)
                };
            });

            return next;
        });
    };

    const updateSymmetry2D = (updates: Partial<DrawSettings['symmetry2D']>) => {
        setSettings(prev => ({ ...prev, symmetry2D: { ...prev.symmetry2D, ...updates } }));
    };

    const updateSymmetry3D = (updates: Partial<DrawSettings['symmetry3D']>) => {
        setSettings(prev => ({ ...prev, symmetry3D: { ...prev.symmetry3D, ...updates } }));
    };

    const setPlacementEnabled = (planetId: string, enabled: boolean) => {
        if (!activeDrawing) return;
        const placementId = `placement-${activeDrawing.id}-${planetId}`;
        setSettings(prev => {
            const exists = (prev.placements || []).some(p => p.id === placementId);
            if (enabled) {
                if (exists) return prev;
                return {
                    ...prev,
                    placements: [
                        ...(prev.placements || []),
                        {
                            id: placementId,
                            drawingId: activeDrawing.id,
                            planetId,
                            visible: true,
                            scale: 1,
                            tilt: { x: 0, y: 0, z: 0 },
                            offset: { x: 0, y: 0, z: 0 },
                            followPlanetRotation: 1
                        }
                    ]
                };
            }

            if (!exists) return prev;
            return {
                ...prev,
                placements: (prev.placements || []).filter(p => p.id !== placementId)
            };
        });
    };

    const updateActivePlacement = (updates: Partial<NonNullable<typeof activePlacement>>) => {
        if (!activePlacement) return;
        setSettings(prev => ({
            ...prev,
            placements: (prev.placements || []).map(p => p.id === activePlacement.id ? { ...p, ...updates } : p)
        }));
    };

    return (
        <div className="w-full h-full flex flex-col p-4 bg-gray-900/95 backdrop-blur-xl text-white overflow-y-auto custom-scrollbar border-l border-white/10">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                    <i className="fas fa-paint-brush"></i>
                    维度绘笔
                </h2>
                <button
                    onClick={() => setSettings(prev => ({ ...prev, enabled: false }))}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                    <i className="fas fa-times text-gray-400 hover:text-white"></i>
                </button>
            </div>

            <div className="space-y-6">

                {/* 1. Drawing Selector (Replaces Planet Selector) */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                            <i className="fas fa-folder-open text-xs"></i> 绘图作品
                        </div>
                        <button
                            onClick={addNewDrawing}
                            className="px-2 py-1 text-[10px] bg-purple-600/30 hover:bg-purple-600/50 rounded border border-purple-500/50 transition-colors"
                        >
                            + 新建
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(settings.drawings || []).map(drawing => {
                            const isSelected = activeDrawing?.id === drawing.id;
                            return (
                                <button
                                    key={drawing.id}
                                    onClick={() => setSettings(prev => ({ ...prev, activeDrawingId: drawing.id }))}
                                    className={`px-3 py-1.5 rounded text-xs border transition-all ${isSelected
                                        ? 'bg-gradient-to-r from-pink-500/30 to-purple-500/30 border-pink-500/50 text-white'
                                        : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/5'
                                        }`}
                                >
                                    <i className={`fas fa-image mr-1 ${isSelected ? 'text-pink-400' : ''}`}></i>
                                    {drawing.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3.5 Layer Transform */}
                {activeLayer && (
                    <div className="space-y-3 p-3 rounded-lg bg-black/20 border border-white/5">
                        <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                            <i className="fas fa-sliders-h text-xs"></i> 当前图层变换
                        </div>

                        <div className="space-y-2">
                            <div className="text-[11px] text-gray-400">倾角 (deg)</div>
                            {(['x', 'y', 'z'] as const).map(axis => (
                                <div key={axis} className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>{axis.toUpperCase()}</span>
                                        <span>{(activeLayer.tilt?.[axis] ?? 0).toFixed(0)}°</span>
                                    </div>
                                    <input
                                        type="range" min="-180" max="180" step="1"
                                        value={activeLayer.tilt?.[axis] ?? 0}
                                        onChange={(e) => updateActiveLayer({ tilt: { ...activeLayer.tilt, [axis]: parseInt(e.target.value) } as any })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            ))}

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>缩放</span>
                                    <span>{(activeLayer.scale ?? 1).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0.1" max="5" step="0.05"
                                    value={activeLayer.scale ?? 1}
                                    onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>高度(本地Z)</span>
                                    <span>{(activeLayer.altitude ?? 0).toFixed(0)}</span>
                                </div>
                                <input
                                    type="range" min="-500" max="500" step="5"
                                    value={activeLayer.altitude ?? 0}
                                    onChange={(e) => updateActiveLayer({ altitude: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>自转速度</span>
                                    <span>{(activeLayer.rotationSpeed ?? 0).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="-5" max="5" step="0.05"
                                    value={activeLayer.rotationSpeed ?? 0}
                                    onChange={(e) => updateActiveLayer({ rotationSpeed: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Layer Manager (for active Drawing) */}
                {activeDrawing && (
                    <div className="space-y-2 p-3 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                <i className="fas fa-layer-group text-xs"></i> 图层
                            </div>
                            <button
                                onClick={addNewLayer}
                                className="px-2 py-1 text-[10px] bg-blue-600/30 hover:bg-blue-600/50 rounded border border-blue-500/50 transition-colors"
                            >
                                + 添加
                            </button>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {activeDrawing.layers.map(layer => {
                                const isActive = layer.id === activeDrawing.activeLayerId;
                                return (
                                    <div
                                        key={layer.id}
                                        onClick={() => setSettings(prev => ({
                                            ...prev,
                                            drawings: (prev.drawings || []).map(d =>
                                                d.id === activeDrawing.id ? { ...d, activeLayerId: layer.id } : d
                                            )
                                        }))}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                                                className={`w-5 h-5 flex items-center justify-center ${layer.visible ? 'text-white' : 'text-gray-600'}`}
                                            >
                                                <i className={`fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`}></i>
                                            </button>
                                            <span className="text-xs">{layer.name}</span>
                                            <div className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: layer.color }}></div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                                            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-400"
                                        >
                                            <i className="fas fa-trash text-[10px]"></i>
                                        </button>
                                    </div>
                                );
                            })}
                            {activeDrawing.layers.length === 0 && (
                                <div className="text-center text-gray-500 text-xs py-4">
                                    暂无图层，点击上方添加
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Brush Settings */}
                <div className="space-y-3 p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <i className="fas fa-palette text-xs"></i> 笔刷设置
                    </div>

                    {/* Brush Type */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: BrushType.Stardust, label: '星尘', icon: 'fa-star' },
                            { id: BrushType.GasCloud, label: '气云', icon: 'fa-cloud' },
                            { id: BrushType.EnergyBeam, label: '能量', icon: 'fa-bolt' },
                            { id: BrushType.Crystal, label: '晶体', icon: 'fa-gem' },
                        ].map(b => (
                            <button
                                key={b.id}
                                onClick={() => updateBrush({ type: b.id })}
                                className={`flex flex-col items-center py-2 rounded text-[10px] transition-all border ${settings.brush?.type === b.id
                                    ? 'bg-gradient-to-b from-pink-500/30 to-purple-500/30 text-pink-200 border-pink-500/50'
                                    : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <i className={`fas ${b.icon} mb-1`}></i>
                                {b.label}
                            </button>
                        ))}
                    </div>

                    {/* Color & Size */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={settings.brush?.color || '#ffffff'}
                                onChange={(e) => updateBrush({ color: e.target.value })}
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/20"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>大小</span>
                                <span>{settings.brush?.size || 10}</span>
                            </div>
                            <input
                                type="range" min="1" max="50" step="1"
                                value={settings.brush?.size || 10}
                                onChange={(e) => updateBrush({ size: parseInt(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>不透明度</span>
                                <span>{((settings.brush?.opacity || 0.8) * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0.1" max="1" step="0.05"
                                value={settings.brush?.opacity || 0.8}
                                onChange={(e) => updateBrush({ opacity: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-300 pt-2 border-t border-white/10">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!settings.brush?.usePressure}
                                onChange={(e) => updateBrush({ usePressure: e.target.checked })}
                            />
                            压感
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!settings.brush?.pressureInfluence?.size}
                                onChange={(e) => updateBrush({ pressureInfluence: { ...settings.brush.pressureInfluence, size: e.target.checked } })}
                            />
                            压感影响大小
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!settings.brush?.pressureInfluence?.opacity}
                                onChange={(e) => updateBrush({ pressureInfluence: { ...settings.brush.pressureInfluence, opacity: e.target.checked } })}
                            />
                            压感影响不透明度
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!settings.brush?.pressureInfluence?.flow}
                                onChange={(e) => updateBrush({ pressureInfluence: { ...settings.brush.pressureInfluence, flow: e.target.checked } })}
                            />
                            压感影响流量
                        </label>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>防抖/稳定</span>
                            <span>{(settings.brush?.stabilization ?? 0).toFixed(2)}</span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.01"
                            value={settings.brush?.stabilization ?? 0}
                            onChange={(e) => updateBrush({ stabilization: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                        />
                    </div>

                    {settings.brush?.type === BrushType.EnergyBeam && (
                        <div className="space-y-2 pt-2 border-t border-white/10">
                            <div className="text-[11px] text-gray-400">能量束参数</div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>核心宽度</span>
                                    <span>{(settings.brush?.coreWidth ?? 0.4).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={settings.brush?.coreWidth ?? 0.4}
                                    onChange={(e) => updateBrush({ coreWidth: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>辉光强度</span>
                                    <span>{(settings.brush?.glowIntensity ?? 1.0).toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0" max="2" step="0.05"
                                    value={settings.brush?.glowIntensity ?? 1.0}
                                    onChange={(e) => updateBrush({ glowIntensity: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Symmetry Settings */}
                <div className="space-y-3 p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <i className="fas fa-expand-arrows-alt text-xs"></i> 对称模式
                    </div>

                    <div className="space-y-3">
                        <div className="text-[11px] text-gray-400">2D 对称</div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: Symmetry2DMode.None, label: '无' },
                                { id: Symmetry2DMode.Mirror, label: '镜像' },
                                { id: Symmetry2DMode.Radial, label: '径向/万花筒' }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => updateSymmetry2D({ mode: m.id })}
                                    className={`py-1 rounded text-[10px] transition-all border
                                         ${settings.symmetry2D?.mode === m.id
                                            ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                            : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {settings.symmetry2D?.mode === Symmetry2DMode.Mirror && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>对称轴角度</span>
                                    <span>{(settings.symmetry2D.mirrorAxisAngle ?? 90).toFixed(0)}°</span>
                                </div>
                                <input
                                    type="range" min="0" max="180" step="1"
                                    value={settings.symmetry2D.mirrorAxisAngle ?? 90}
                                    onChange={(e) => updateSymmetry2D({ mirrorAxisAngle: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                />
                            </div>
                        )}

                        {settings.symmetry2D?.mode === Symmetry2DMode.Radial && (
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>份数</span>
                                        <span>{settings.symmetry2D.segments || 8}</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="32" step="1"
                                        value={settings.symmetry2D.segments || 8}
                                        onChange={(e) => updateSymmetry2D({ segments: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: RadialReflectionMode.None, label: '仅旋转' },
                                        { id: RadialReflectionMode.Mirror, label: '带镜像' },
                                        { id: RadialReflectionMode.Kaleidoscope, label: '万花筒' }
                                    ].map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => updateSymmetry2D({ radialReflectionMode: r.id })}
                                            className={`py-1 rounded text-[10px] transition-all border
                                                 ${settings.symmetry2D.radialReflectionMode === r.id
                                                    ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                                    : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>旋转偏移</span>
                                        <span>{(settings.symmetry2D.rotationOffset ?? 0).toFixed(0)}°</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="360" step="1"
                                        value={settings.symmetry2D.rotationOffset ?? 0}
                                        onChange={(e) => updateSymmetry2D({ rotationOffset: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-white/10 text-[11px] text-gray-400">3D 对称生长</div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: Symmetry3DMode.None, label: '无' },
                                { id: Symmetry3DMode.Octant, label: '八分' },
                                { id: Symmetry3DMode.Cubic, label: '立方' },
                                { id: Symmetry3DMode.Octahedral, label: '八面' },
                                { id: Symmetry3DMode.Vortex, label: '涡旋' }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => updateSymmetry3D({ mode: m.id })}
                                    className={`py-1 rounded text-[10px] transition-all border
                                         ${settings.symmetry3D?.mode === m.id
                                            ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                            : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {settings.symmetry3D?.mode === Symmetry3DMode.Octant && (
                            <div className="flex gap-2 text-[10px] text-gray-300">
                                {(['x', 'y', 'z'] as const).map(axis => (
                                    <label key={axis} className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={!!settings.symmetry3D.octantAxes?.[axis]}
                                            onChange={(e) => updateSymmetry3D({ octantAxes: { ...settings.symmetry3D.octantAxes, [axis]: e.target.checked } })}
                                        />
                                        {axis.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        )}

                        {settings.symmetry3D?.mode === Symmetry3DMode.Vortex && (
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>份数</span>
                                        <span>{settings.symmetry3D.segments || 8}</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="32" step="1"
                                        value={settings.symmetry3D.segments || 8}
                                        onChange={(e) => updateSymmetry3D({ segments: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>高度步进</span>
                                        <span>{(settings.symmetry3D.heightStep ?? 10).toFixed(0)}</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="50" step="1"
                                        value={settings.symmetry3D.heightStep ?? 10}
                                        onChange={(e) => updateSymmetry3D({ heightStep: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>缩放衰减</span>
                                        <span>{(settings.symmetry3D.scaleDecay ?? 0.95).toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0.5" max="1" step="0.01"
                                        value={settings.symmetry3D.scaleDecay ?? 0.95}
                                        onChange={(e) => updateSymmetry3D({ scaleDecay: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>扭转/步</span>
                                        <span>{(settings.symmetry3D.twistPerStep ?? 20).toFixed(0)}°</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="90" step="1"
                                        value={settings.symmetry3D.twistPerStep ?? 20}
                                        onChange={(e) => updateSymmetry3D({ twistPerStep: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Canvas Settings */}
                <div className="space-y-2 p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>画布透明度</span>
                        <span>{((settings.canvasOpacity || 0.7) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range" min="0.1" max="1" step="0.1"
                        value={settings.canvasOpacity || 0.7}
                        onChange={(e) => setSettings(prev => ({ ...prev, canvasOpacity: parseFloat(e.target.value) }))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                    />

                    <label className="flex items-center gap-2 text-[10px] text-gray-300 mt-2">
                        <input
                            type="checkbox"
                            checked={!!settings.hideCanvasWhilePainting}
                            onChange={(e) => setSettings(prev => ({ ...prev, hideCanvasWhilePainting: e.target.checked }))}
                        />
                        绘制时弱化画布
                    </label>

                    <label className="flex items-center gap-2 text-[10px] text-gray-300 mt-1">
                        <input
                            type="checkbox"
                            checked={!!settings.hidePlanetWhileDrawing}
                            onChange={(e) => setSettings(prev => ({ ...prev, hidePlanetWhileDrawing: e.target.checked }))}
                        />
                        绘制时隐藏星球
                    </label>

                    <div className="space-y-1 mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>画布尺度</span>
                            <span>{(settings.canvasSize || 300).toFixed(0)}</span>
                        </div>
                        <input
                            type="range" min="50" max="800" step="10"
                            value={settings.canvasSize || 300}
                            onChange={(e) => setSettings(prev => ({ ...prev, canvasSize: parseInt(e.target.value) }))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="space-y-1 mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>预览星球</span>
                            <span className="text-[10px] text-gray-400">{settings.previewPlanetId || '未选择'}</span>
                        </div>
                        <select
                            value={settings.previewPlanetId || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, previewPlanetId: e.target.value || null }))}
                            className="w-full text-xs bg-black/30 border border-white/10 rounded px-2 py-1"
                        >
                            <option value="">(不预览)</option>
                            {(planetSettings.planets || []).map(p => (
                                <option key={p.id} value={p.id}>{p.name || p.id}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 6. Placements (Bind to Planets) */}
                {activeDrawing && (
                    <div className="space-y-3 p-3 rounded-lg bg-black/20 border border-white/5">
                        <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                            <i className="fas fa-link text-xs"></i> 应用到星球（绑定）
                        </div>

                        <div className="space-y-2">
                            {(planetSettings.planets || []).map(p => {
                                const placementId = `placement-${activeDrawing.id}-${p.id}`;
                                const enabled = (settings.placements || []).some(pl => pl.id === placementId);
                                return (
                                    <label key={p.id} className="flex items-center justify-between gap-2 text-[10px] text-gray-300">
                                        <span className="truncate">{p.name || p.id}</span>
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={(e) => setPlacementEnabled(p.id, e.target.checked)}
                                        />
                                    </label>
                                );
                            })}
                        </div>

                        {activePlacement && (
                            <div className="pt-2 border-t border-white/10 space-y-2">
                                <div className="text-[11px] text-gray-400">当前预览星球 Placement 变换</div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>缩放</span>
                                        <span>{(activePlacement.scale ?? 1).toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0.1" max="5" step="0.05"
                                        value={activePlacement.scale ?? 1}
                                        onChange={(e) => updateActivePlacement({ scale: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>

                                <div className="text-[11px] text-gray-400">倾角 (deg)</div>
                                {(['x', 'y', 'z'] as const).map(axis => (
                                    <div key={axis} className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-gray-500">
                                            <span>{axis.toUpperCase()}</span>
                                            <span>{(activePlacement.tilt?.[axis] ?? 0).toFixed(0)}°</span>
                                        </div>
                                        <input
                                            type="range" min="-180" max="180" step="1"
                                            value={activePlacement.tilt?.[axis] ?? 0}
                                            onChange={(e) => updateActivePlacement({ tilt: { ...activePlacement.tilt, [axis]: parseInt(e.target.value) } as any })}
                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                        />
                                    </div>
                                ))}

                                <div className="text-[11px] text-gray-400">偏移</div>
                                {(['x', 'y', 'z'] as const).map(axis => (
                                    <div key={axis} className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-gray-500">
                                            <span>{axis.toUpperCase()}</span>
                                            <span>{(activePlacement.offset?.[axis] ?? 0).toFixed(0)}</span>
                                        </div>
                                        <input
                                            type="range" min="-500" max="500" step="5"
                                            value={activePlacement.offset?.[axis] ?? 0}
                                            onChange={(e) => updateActivePlacement({ offset: { ...activePlacement.offset, [axis]: parseInt(e.target.value) } as any })}
                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                        />
                                    </div>
                                ))}

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>跟随星球自转</span>
                                        <span>{((activePlacement.followPlanetRotation ?? 1) * 100).toFixed(0)}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={activePlacement.followPlanetRotation ?? 1}
                                        onChange={(e) => updateActivePlacement({ followPlanetRotation: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default DrawControlPanel;
