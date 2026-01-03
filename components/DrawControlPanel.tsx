/**
 * input: DrawSettings 全局绘图设置
 * output: 绘图控制面板 UI (Dimension Crafter)
 * pos: 控制笔刷、对称、图层的面板，与星球解耦
 * update: 一旦我被更新，请更新 components 目录的 _README.md
 */
import React, { useEffect, useMemo } from 'react';
import { DrawSettings, BrushSettings, DrawingLayer, Drawing, BrushType, SymmetryMode, ProjectionMode, SymmetrySettings, PlanetSceneSettings } from '../types';

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
            altitude: 10,
            rotationSpeed: 0,
            projection: settings.projection,
            brushType: settings.brush.type,
            color: settings.brush.color,
            opacity: 1,
            blending: 'additive',
            params: {},
            points: new Float32Array(),
            count: 0
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
        setSettings(prev => ({ ...prev, brush: { ...prev.brush, ...updates } }));
    };

    const updateSymmetry = (updates: Partial<SymmetrySettings>) => {
        setSettings(prev => ({ ...prev, symmetry: { ...(prev.symmetry || {}), ...updates } }));
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
                </div>

                {/* 4. Symmetry Settings */}
                <div className="space-y-3 p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <i className="fas fa-expand-arrows-alt text-xs"></i> 对称模式
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: SymmetryMode.None, label: '无' },
                            { id: SymmetryMode.Mirror, label: '镜像' },
                            { id: SymmetryMode.Radial, label: '径向' },
                            { id: SymmetryMode.Spiral, label: '螺旋' },
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => updateSymmetry({ mode: m.id })}
                                className={`py-1 rounded text-[10px] transition-all border
                                     ${settings.symmetry?.mode === m.id
                                        ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                        : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Symmetry Params */}
                    {settings.symmetry?.mode === SymmetryMode.Mirror && (
                        <div className="flex gap-2">
                            {['x', 'y', 'quad'].map(axis => (
                                <button
                                    key={axis}
                                    onClick={() => updateSymmetry({ mirrorAxis: axis as any })}
                                    className={`px-2 py-1 text-[10px] rounded border ${settings.symmetry?.mirrorAxis === axis ? 'bg-purple-500/30 border-purple-500' : 'border-white/10'}`}
                                >
                                    {axis.toUpperCase()}轴
                                </button>
                            ))}
                        </div>
                    )}

                    {(settings.symmetry?.mode === SymmetryMode.Radial || settings.symmetry?.mode === SymmetryMode.Spiral) && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>份数</span>
                                <span>{settings.symmetry?.segments || 8}</span>
                            </div>
                            <input
                                type="range" min="2" max="32" step="1"
                                value={settings.symmetry?.segments || 8}
                                onChange={(e) => updateSymmetry({ segments: parseInt(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                            />
                        </div>
                    )}
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
                </div>

            </div>
        </div>
    );
};

export default DrawControlPanel;
