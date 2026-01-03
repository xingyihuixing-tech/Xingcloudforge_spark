import React, { useEffect, useMemo } from 'react';
import { DrawSettings, BrushSettings, DrawingLayer, DrawingInstance, BrushType, SymmetryMode, ProjectionMode, SymmetrySettings, PlanetSceneSettings } from '../types';

interface DrawControlPanelProps {
    settings: DrawSettings;
    setSettings: React.Dispatch<React.SetStateAction<DrawSettings>>;
    planetSettings: PlanetSceneSettings;
}

const DrawControlPanel: React.FC<DrawControlPanelProps> = ({ settings, setSettings, planetSettings }) => {

    // Ensure we have at least one Instance (for current planet)
    useEffect(() => {
        // Init default instance if none
        if (!settings.instances || settings.instances.length === 0) {
            const defaultPlanet = planetSettings.planets[0] || { id: 'default', name: 'Default Planet' };
            const defaultInstance: DrawingInstance = {
                id: 'instance-' + defaultPlanet.id,
                name: `画板: ${defaultPlanet.name}`,
                bindPlanetId: defaultPlanet.id,
                visible: true,
                layers: [],
                activeLayerId: null
            };
            setSettings(prev => ({
                ...prev,
                instances: [defaultInstance],
                activeInstanceId: defaultInstance.id
            }));
        }
    }, [planetSettings.planets]);

    // Helpers
    const activeInstance = useMemo(() =>
        settings.instances?.find(i => i.id === settings.activeInstanceId),
        [settings.instances, settings.activeInstanceId]);

    const activeLayer = useMemo(() =>
        activeInstance?.layers.find(l => l.id === activeInstance.activeLayerId),
        [activeInstance]);


    // Action: Switch Planet (Instance)
    const switchInstance = (planetId: string) => {
        const existingInstance = settings.instances.find(i => i.bindPlanetId === planetId);

        if (existingInstance) {
            setSettings(prev => ({ ...prev, activeInstanceId: existingInstance.id }));
        } else {
            // Create new instance for this planet
            const planet = planetSettings.planets.find(p => p.id === planetId);
            const newInstance: DrawingInstance = {
                id: 'instance-' + planetId,
                name: `画板: ${planet?.name || '未知星球'}`,
                bindPlanetId: planetId,
                visible: true,
                layers: [],
                activeLayerId: null
            };
            setSettings(prev => ({
                ...prev,
                instances: [...prev.instances, newInstance],
                activeInstanceId: newInstance.id
            }));
        }
    };

    // Action: Add Layer (to active Instance)
    const addNewLayer = () => {
        if (!activeInstance) return;

        const newLayer: DrawingLayer = {
            id: 'layer-' + Date.now(),
            name: `图层 ${activeInstance.layers.length + 1}`,
            visible: true,
            tilt: { x: 0, y: 0, z: 0 },
            scale: 1,
            altitude: settings.altitude || 10,
            rotationSpeed: 0,
            projection: settings.projection,
            brushType: settings.brush.type,
            color: settings.brush.color,
            opacity: 1,
            blending: 'additive',
            params: {}, // Store specific brush params here if needed
            points: new Float32Array(),
            count: 0
        };

        setSettings(prev => ({
            ...prev,
            instances: prev.instances.map(inst => {
                if (inst.id === activeInstance.id) {
                    return {
                        ...inst,
                        layers: [...inst.layers, newLayer],
                        activeLayerId: newLayer.id
                    };
                }
                return inst;
            })
        }));
    };

    // Action: Update Active Layer
    const updateActiveLayer = (updates: Partial<DrawingLayer>) => {
        if (!activeInstance || !activeLayer) return;

        setSettings(prev => ({
            ...prev,
            instances: prev.instances.map(inst => {
                if (inst.id === activeInstance.id) {
                    return {
                        ...inst,
                        layers: inst.layers.map(l => l.id === activeLayer.id ? { ...l, ...updates } : l)
                    };
                }
                return inst;
            })
        }));
    };

    // Action: Toggle Layer Visibility
    const toggleLayerVisibility = (layerId: string) => {
        if (!activeInstance) return;
        setSettings(prev => ({
            ...prev,
            instances: prev.instances.map(inst => {
                if (inst.id === activeInstance.id) {
                    return {
                        ...inst,
                        layers: inst.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l)
                    };
                }
                return inst;
            })
        }));
    };

    // Action: Delete Layer
    const deleteLayer = (layerId: string) => {
        if (!activeInstance) return;
        setSettings(prev => ({
            ...prev,
            instances: prev.instances.map(inst => {
                if (inst.id === activeInstance.id) {
                    const newLayers = inst.layers.filter(l => l.id !== layerId);
                    const newActiveId = (layerId === inst.activeLayerId)
                        ? (newLayers[newLayers.length - 1]?.id || null)
                        : inst.activeLayerId;
                    return {
                        ...inst,
                        layers: newLayers,
                        activeLayerId: newActiveId
                    };
                }
                return inst;
            })
        }));
    };

    const updateBrush = (updates: Partial<BrushSettings>) => {
        setSettings(prev => ({ ...prev, brush: { ...prev.brush, ...updates } }));
    };

    const updateSymmetry = (updates: Partial<SymmetrySettings>) => {
        setSettings(prev => ({ ...prev, symmetry: { ...prev.symmetry, ...updates } }));
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

                {/* 1. 目标星球 (Instance Selector) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-globe text-xs"></i> 目标星球 (画板)
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {planetSettings.planets.map(planet => {
                            const isSelected = activeInstance?.bindPlanetId === planet.id;
                            return (
                                <button
                                    key={planet.id}
                                    onClick={() => switchInstance(planet.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors border
                                    ${isSelected
                                            ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'}`}
                                >
                                    {planet.name || '星球 ' + planet.id}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. 图层管理 (Layers in Active Instance) */}
                {activeInstance && (
                    <div className="space-y-2 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-300">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-layer-group text-xs"></i>
                                <span>{activeInstance.name} - 图层</span>
                            </div>
                            <button
                                onClick={addNewLayer}
                                className="bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 text-xs px-2 py-1 rounded border border-purple-500/30 transition-colors"
                            >
                                <i className="fas fa-plus mr-1"></i> 新建
                            </button>
                        </div>

                        <div className="bg-black/30 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 border border-white/5 min-h-[60px]">
                            {activeInstance.layers.length === 0 && (
                                <div className="text-gray-500 text-[10px] text-center py-4">点击“新建”创建第一个组件</div>
                            )}
                            {activeInstance.layers.map(layer => (
                                <div
                                    key={layer.id}
                                    onClick={() => setSettings(prev => ({
                                        ...prev,
                                        instances: prev.instances.map(i => i.id === activeInstance.id ? { ...i, activeLayerId: layer.id } : i)
                                    }))}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors
                                        ${activeInstance.activeLayerId === layer.id ? 'bg-purple-600/30 border border-purple-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                                            className={`text-xs ${layer.visible ? 'text-gray-300' : 'text-gray-600'}`}
                                        >
                                            <i className={`fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                        </button>
                                        <span className={`text-xs truncate ${activeInstance.activeLayerId === layer.id ? 'text-purple-200 font-medium' : 'text-gray-400'}`}>
                                            {layer.name}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                                    >
                                        <i className="fas fa-trash-alt text-[10px]"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. 当前图层属性 (Transform) */}
                {activeLayer && (
                    <div className="space-y-3 p-3 bg-purple-900/10 rounded-xl border border-purple-500/10">
                        <div className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-2">
                            组件属性: {activeLayer.name}
                        </div>

                        {/* 变换控制 */}
                        <div className="space-y-2">
                            {/* Tilt */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500">倾角 X</span>
                                    <input type="number" value={activeLayer.tilt.x}
                                        onChange={(e) => updateActiveLayer({ tilt: { ...activeLayer.tilt, x: parseFloat(e.target.value) } })}
                                        className="w-full bg-black/30 border border-white/10 rounded px-1 py-0.5 text-xs text-center"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500">倾角 Y</span>
                                    <input type="number" value={activeLayer.tilt.y}
                                        onChange={(e) => updateActiveLayer({ tilt: { ...activeLayer.tilt, y: parseFloat(e.target.value) } })}
                                        className="w-full bg-black/30 border border-white/10 rounded px-1 py-0.5 text-xs text-center"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500">倾角 Z</span>
                                    <input type="number" value={activeLayer.tilt.z}
                                        onChange={(e) => updateActiveLayer({ tilt: { ...activeLayer.tilt, z: parseFloat(e.target.value) } })}
                                        className="w-full bg-black/30 border border-white/10 rounded px-1 py-0.5 text-xs text-center"
                                    />
                                </div>
                            </div>

                            {/* Scale & Altitude */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>缩放</span>
                                        <span>{activeLayer.scale.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range" min="0.1" max="5" step="0.1"
                                        value={activeLayer.scale}
                                        onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded appearance-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>高度</span>
                                        <span>{activeLayer.altitude.toFixed(0)}</span>
                                    </div>
                                    <input
                                        type="range" min="-50" max="200" step="1"
                                        value={activeLayer.altitude}
                                        onChange={(e) => updateActiveLayer({ altitude: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded appearance-none"
                                    />
                                </div>
                            </div>
                            {/* Rotation Animation */}
                            <div className="space-y-1 pt-1 border-t border-white/5">
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>自转动画</span>
                                    <span>{activeLayer.rotationSpeed.toFixed(1)}</span>
                                </div>
                                <input
                                    type="range" min="-10" max="10" step="0.5"
                                    value={activeLayer.rotationSpeed}
                                    onChange={(e) => updateActiveLayer({ rotationSpeed: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded appearance-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Brush & Symmetry */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-magic text-xs"></i> 绘笔与对称
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 space-y-4 border border-white/5">

                        {/* 4.1 笔刷类型 */}
                        <div className="space-y-2">
                            <div className="text-[10px] text-gray-500 uppercase flex justify-between">
                                <span>笔刷类型</span>
                                <span className="text-gray-400">{settings.brush.type}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {[
                                    { id: BrushType.Stardust, icon: 'fa-asterisk', label: '星尘' },
                                    { id: BrushType.GasCloud, icon: 'fa-cloud', label: '气云' },
                                    { id: BrushType.EnergyBeam, icon: 'fa-bolt', label: '光束' },
                                    { id: BrushType.Crystal, icon: 'fa-gem', label: '晶体' },
                                ].map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => updateBrush({ type: b.id })}
                                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all border
                                            ${settings.brush.type === b.id
                                                ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                                : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                                    >
                                        <i className={`fas ${b.icon} text-sm mb-1`}></i>
                                        <span className="text-[10px] scale-90">{b.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4.2 笔刷参数 */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">颜色</span>
                                <input
                                    type="color"
                                    value={settings.brush.color}
                                    onChange={(e) => {
                                        updateBrush({ color: e.target.value });
                                        if (activeLayer) updateActiveLayer({ color: e.target.value });
                                    }}
                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500">大小 ({settings.brush.size})</span>
                                    <input
                                        type="range" min="1" max="100"
                                        value={settings.brush.size}
                                        onChange={(e) => updateBrush({ size: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500">透明度 ({settings.brush.opacity.toFixed(1)})</span>
                                    <input
                                        type="range" min="0.1" max="1" step="0.1"
                                        value={settings.brush.opacity}
                                        onChange={(e) => updateBrush({ opacity: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4.3 对称系统 */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase">对称模式</div>
                            <div className="grid grid-cols-4 gap-1">
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
                                             ${settings.symmetry.mode === m.id
                                                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                                : 'bg-black/20 text-gray-400 border-transparent hover:bg-white/5'}`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {/* Symmetry Params */}
                            {settings.symmetry.mode === SymmetryMode.Mirror && (
                                <div className="flex gap-2">
                                    {['x', 'y', 'quad'].map(axis => (
                                        <button
                                            key={axis}
                                            onClick={() => updateSymmetry({ mirrorAxis: axis as any })}
                                            className={`px-2 py-1 text-[10px] rounded border ${settings.symmetry.mirrorAxis === axis ? 'bg-purple-500/30 border-purple-500' : 'border-white/10'}`}
                                        >
                                            {axis.toUpperCase()}轴
                                        </button>
                                    ))}
                                </div>
                            )}

                            {(settings.symmetry.mode === SymmetryMode.Radial || settings.symmetry.mode === SymmetryMode.Spiral) && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>份数</span>
                                        <span>{settings.symmetry.segments}</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="32" step="1"
                                        value={settings.symmetry.segments}
                                        onChange={(e) => updateSymmetry({ segments: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* 4.4 Holo-Pad Visibility */}
                        <div className="space-y-1 pt-2 border-t border-white/5">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>画板透明度 (辅助线)</span>
                                <span>{(settings.canvasOpacity * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.1"
                                value={settings.canvasOpacity}
                                onChange={(e) => setSettings(prev => ({ ...prev, canvasOpacity: parseFloat(e.target.value) }))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrawControlPanel;
