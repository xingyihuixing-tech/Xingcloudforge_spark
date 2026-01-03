import React from 'react';
import { DrawSettings, DrawMode, PlanetSceneSettings, BrushSettings } from '../types';

interface DrawControlPanelProps {
    settings: DrawSettings;
    setSettings: React.Dispatch<React.SetStateAction<DrawSettings>>;
    planetSettings: PlanetSceneSettings;
}

const DrawControlPanel: React.FC<DrawControlPanelProps> = ({ settings, setSettings, planetSettings }) => {

    const updateBrush = (updates: Partial<BrushSettings>) => {
        setSettings(prev => ({
            ...prev,
            brush: {
                ...prev.brush,
                ...updates
            }
        }));
    };

    return (
        <div className="w-full h-full flex flex-col p-4 bg-gray-900/90 backdrop-blur-xl text-white overflow-y-auto custom-scrollbar"
            style={{
                background: 'linear-gradient(180deg, rgba(20,20,30,0.95) 0%, rgba(30,30,40,0.95) 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.1)'
            }}
        >
            {/* 顶部标题 */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                    <i className="fas fa-paint-brush"></i>
                    绘图工坊
                </h2>
                <button
                    onClick={() => setSettings(prev => ({ ...prev, enabled: false }))}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="退出绘图模式"
                >
                    <i className="fas fa-times text-gray-400 hover:text-white"></i>
                </button>
            </div>

            <div className="space-y-6">
                {/* 1. 画笔设置 */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-edit text-xs"></i> 笔刷设置
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 space-y-3 border border-white/5">
                        {/* 颜色选择 */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">颜色</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={settings.brush.color}
                                    onChange={(e) => updateBrush({ color: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                />
                                <span className="text-xs font-mono text-gray-500 uppercase">{settings.brush.color}</span>
                            </div>
                        </div>

                        {/* 大小 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>大小</span>
                                <span>{settings.brush.size}px</span>
                            </div>
                            <input
                                type="range"
                                min="1" max="50"
                                value={settings.brush.size}
                                onChange={(e) => updateBrush({ size: parseInt(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* 透明度 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>浓度</span>
                                <span>{Math.round(settings.brush.opacity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1" max="1" step="0.05"
                                value={settings.brush.opacity}
                                onChange={(e) => updateBrush({ opacity: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* 压感 */}
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer p-0.5">
                            <input
                                type="checkbox"
                                checked={settings.brush.usePressure}
                                onChange={(e) => updateBrush({ usePressure: e.target.checked })}
                                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                            />
                            启用压感控制 (大小/透明度)
                        </label>
                    </div>
                </div>

                {/* 2. 对称模式 */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-snowflake text-xs"></i> 对称系统
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 space-y-4 border border-white/5">

                        {/* 2D 平面模式 */}
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">2D 屏幕对称</div>
                            <div className="grid grid-cols-3 gap-1">
                                {[
                                    { id: DrawMode.MirrorX, label: '水平镜像' },
                                    { id: DrawMode.MirrorY, label: '垂直镜像' },
                                    { id: DrawMode.Quad, label: '四象限' },
                                    { id: DrawMode.Diagonal, label: '对角线' },
                                    { id: DrawMode.Kaleidoscope, label: '万花筒' },
                                    { id: DrawMode.Normal, label: '普通' },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSettings(prev => ({ ...prev, mode: m.id as DrawMode }))}
                                        className={`py-1.5 rounded text-[10px] transition-all border border-transparent
                                             ${settings.mode === m.id
                                                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                                                : 'bg-black/20 text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3D 空间模式 */}
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-2">
                                3D 空间对称
                                <span className="bg-blue-900/50 text-blue-300 text-[9px] px-1.5 py-0.5 rounded border border-blue-500/30">Raycast</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {[
                                    { id: DrawMode.PlanetSpin, label: '行星自转' },
                                    { id: DrawMode.Antipodal, label: '对极镜像' },
                                    { id: DrawMode.Vortex, label: '能量涡旋' },
                                    { id: DrawMode.Tetrahedral, label: '四面体' },
                                    { id: DrawMode.Cubic, label: '立方体' },
                                    // { id: DrawMode.Dodecahedral, label: '十二面体' },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSettings(prev => ({ ...prev, mode: m.id as DrawMode }))}
                                        className={`py-1.5 rounded text-[10px] transition-all border border-transparent
                                             ${settings.mode === m.id
                                                ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                                                : 'bg-black/20 text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 分段控制 (仅对部分模式有效) */}
                        {(settings.mode === DrawMode.Kaleidoscope || settings.mode === DrawMode.PlanetSpin || settings.mode === DrawMode.Vortex || settings.mode === DrawMode.Radial) && (
                            <div className="space-y-1 bg-black/20 p-2 rounded-lg">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>对称份数 (Segments)</span>
                                    <span>{settings.segments}</span>
                                </div>
                                <input
                                    type="range"
                                    min="2" max="64" step="1"
                                    value={settings.segments}
                                    onChange={(e) => setSettings(prev => ({ ...prev, segments: parseInt(e.target.value) }))}
                                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        )}

                        {/* 涡旋控制 */}
                        {settings.mode === DrawMode.Vortex && (
                            <div className="space-y-3 bg-black/20 p-2 rounded-lg">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>上升高度</span>
                                        <span>{settings.vortexHeight || 0}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-50" max="50" step="1"
                                        value={settings.vortexHeight || 0}
                                        onChange={(e) => setSettings(prev => ({ ...prev, vortexHeight: parseFloat(e.target.value) }))}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>缩放系数</span>
                                        <span>{settings.vortexScale || 1}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5" max="1.5" step="0.01"
                                        value={settings.vortexScale || 1}
                                        onChange={(e) => setSettings(prev => ({ ...prev, vortexScale: parseFloat(e.target.value) }))}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* 交互设置 (高度 & Ghost) */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-arrows-alt-v text-xs"></i> 空间交互
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 space-y-3 border border-white/5">

                        {/* 绘制高度 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>绘制高度 (Altitude)</span>
                                <span>{settings.altitude.toFixed(0)}</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="200" step="1"
                                value={settings.altitude}
                                onChange={(e) => setSettings(prev => ({ ...prev, altitude: parseFloat(e.target.value) }))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="text-[9px] text-gray-600">
                                提示: 按住 Alt + 滚轮 也可以快速调整
                            </div>
                        </div>

                        {/* 幽灵光标开关 */}
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer pt-2 border-t border-white/5">
                            <input
                                type="checkbox"
                                checked={settings.ghostCursorEnabled}
                                onChange={(e) => setSettings(prev => ({ ...prev, ghostCursorEnabled: e.target.checked }))}
                                className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500"
                            />
                            启用“幽灵光标”预览 (Ghost Cursor)
                        </label>
                    </div>
                </div>

                {/* 3. 墨水效果 */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-magic text-xs"></i> 墨迹特效
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 space-y-3 border border-white/5">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>流动感 (Turbulence)</span>
                                <span>{settings.inkFlow.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="1" step="0.05"
                                value={settings.inkFlow}
                                onChange={(e) => setSettings(prev => ({ ...prev, inkFlow: parseFloat(e.target.value) }))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>辉光强度</span>
                                <span>{settings.inkBloom.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="3.0" step="0.1"
                                value={settings.inkBloom}
                                onChange={(e) => setSettings(prev => ({ ...prev, inkBloom: parseFloat(e.target.value) }))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. 目标星球 */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <i className="fas fa-globe text-xs"></i> 目标星球
                    </div>

                    <div className="bg-white/5 rounded-xl p-2 border border-white/5 space-y-1">
                        {planetSettings.planets.map(planet => (
                            <button
                                key={planet.id}
                                onClick={() => setSettings(prev => ({ ...prev, bindPlanetId: planet.id }))}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between
                   ${(settings.bindPlanetId === planet.id || (!settings.bindPlanetId && planetSettings.planets[0].id === planet.id)) // 默认选中第一个
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : 'hover:bg-white/5 text-gray-400'}`}
                            >
                                <span>{planet.name || '未命名星球'}</span>
                                {(settings.bindPlanetId === planet.id || (!settings.bindPlanetId && planetSettings.planets[0].id === planet.id)) &&
                                    <i className="fas fa-check text-blue-400"></i>}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* 底部提示 */}
            <div className="mt-auto pt-6 text-center text-[10px] text-gray-600">
                双击画布空白处也可退出绘图模式
            </div>
        </div>
    );
};

export default DrawControlPanel;
