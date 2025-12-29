import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { AppSettings, PlanetSceneSettings } from '../types';
import { BACKGROUND_IMAGES } from '../constants';

interface ThemeSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings?: AppSettings;
    setSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
    planetSettings?: PlanetSceneSettings;
    setPlanetSettings?: React.Dispatch<React.SetStateAction<PlanetSceneSettings>>;
    appMode?: 'nebula' | 'planet';
    modeSwitchMaterial?: any;
    setModeSwitchMaterial?: React.Dispatch<React.SetStateAction<any>>;
}

type TabType = 'background' | 'theme' | 'material';

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
    isOpen, onClose, settings, setSettings, planetSettings, setPlanetSettings, appMode, modeSwitchMaterial, setModeSwitchMaterial
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('theme');

    // Internal state for material if not provided (fallback)
    const [localMaterial, setLocalMaterial] = useState<any>(null);
    const currentMaterial = modeSwitchMaterial || localMaterial;

    // Use effects to sync or load defaults if needed

    if (!isOpen) return null;

    const handleMaterialChange = (type: string, newSettings: any) => {
        const fullSettings = { type, ...newSettings };
        if (setModeSwitchMaterial) {
            setModeSwitchMaterial(fullSettings);
        } else {
            setLocalMaterial(fullSettings);
        }
        // LocalStorage is handled by App.tsx side effect now
        localStorage.setItem('button_material_settings', JSON.stringify({ modeSwitch: fullSettings }));
        window.dispatchEvent(new Event('storage'));
    };

    const handleThemeColorChange = (color: string) => {
        document.documentElement.style.setProperty('--ui-primary', color);
        localStorage.setItem('theme_primary_color', color);
    };

    // Helper to get current background settings based on mode
    const getBackgroundSettings = () => {
        if (appMode === 'planet' && planetSettings?.background) {
            return planetSettings.background;
        }
        return settings?.background;
    };

    const updateBackground = (updates: any) => {
        if (appMode === 'planet' && setPlanetSettings) {
            setPlanetSettings(prev => ({
                ...prev,
                background: { ...prev.background!, ...updates }
            }));
        } else if (setSettings) {
            setSettings(prev => ({
                ...prev,
                background: { ...prev.background!, ...updates }
            }));
        }
    };

    const currentBg = getBackgroundSettings();

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose} />

            <div
                className="relative w-[600px] h-[500px] bg-[#0f1016] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                style={{ boxShadow: '0 0 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-medium text-white flex items-center gap-2">
                        <i className="fas fa-paint-brush text-cyan-400" />
                        主题设置
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <i className="fas fa-times" />
                    </button>
                </div>

                {/* Content Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-32 bg-black/20 border-r border-white/5 flex flex-col py-4 gap-1">
                        <TabButton active={activeTab === 'theme'} onClick={() => setActiveTab('theme')} icon="palette" label="配色方案" />
                        <TabButton active={activeTab === 'material'} onClick={() => setActiveTab('material')} icon="gem" label="按键材质" />
                        <TabButton active={activeTab === 'background'} onClick={() => setActiveTab('background')} icon="image" label="背景设置" />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        {activeTab === 'background' && (
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h3 className="text-sm font-medium text-white mb-3 flex justify-between items-center">
                                        背景开关
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${currentBg?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                                            {currentBg?.enabled ? '已启用' : '已禁用'}
                                        </span>
                                    </h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={currentBg?.enabled ?? true}
                                            onChange={(e) => updateBackground({ enabled: e.target.checked })}
                                            className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-gray-700"
                                        />
                                        <span className="text-sm text-gray-300">启用深空背景</span>
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">全景图选择</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {BACKGROUND_IMAGES.map((img: any) => (
                                                <button
                                                    key={img.value}
                                                    onClick={() => updateBackground({ panoramaUrl: img.value })}
                                                    className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center gap-2
                                                        ${currentBg?.panoramaUrl === img.value
                                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                                                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ opacity: currentBg?.panoramaUrl === img.value ? 1 : 0 }} />
                                                    {img.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <RangeControl
                                        label="背景亮度"
                                        value={currentBg?.brightness ?? 1}
                                        min={0} max={2} step={0.1}
                                        onChange={(v) => updateBackground({ brightness: v })}
                                    />
                                    <RangeControl
                                        label="背景饱和度"
                                        value={currentBg?.saturation ?? 1}
                                        min={0} max={3} step={0.1}
                                        onChange={(v) => updateBackground({ saturation: v })}
                                    />
                                    <RangeControl
                                        label="背景旋转"
                                        value={currentBg?.rotation ?? 0}
                                        min={0} max={360} step={15}
                                        onChange={(v) => updateBackground({ rotation: v })}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'theme' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 block">主题色 (Primary)</label>
                                    <div className="grid grid-cols-5 gap-3">
                                        {[
                                            { color: '#6366f1', name: 'Indigo' },
                                            { color: '#ec4899', name: 'Pink' },
                                            { color: '#06b6d4', name: 'Cyan' },
                                            { color: '#8b5cf6', name: 'Purple' },
                                            { color: '#10b981', name: 'Emerald' },
                                            { color: '#f59e0b', name: 'Amber' },
                                            { color: '#ef4444', name: 'Red' },
                                            { color: '#3b82f6', name: 'Blue' },
                                            { color: '#84cc16', name: 'Lime' },
                                            { color: '#d946ef', name: 'Fuchsia' },
                                        ].map(c => (
                                            <button
                                                key={c.color}
                                                className="group relative w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-lg mx-auto"
                                                style={{ background: c.color }}
                                                onClick={() => handleThemeColorChange(c.color)}
                                                title={c.name}
                                            >
                                                <div className="absolute inset-0 rounded-full ring-2 ring-white/0 group-hover:ring-white/50 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
                                    <h4 className="text-sm font-medium text-white mb-2">预览</h4>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: 'var(--ui-primary)' }}>Primary Button</button>
                                        <button className="px-3 py-1.5 rounded-lg text-white/80 text-xs border border-white/20">Secondary</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'material' && (
                            <div className="space-y-4">
                                <p className="text-xs text-white/50 mb-2">选择全局 UI 按钮的材质风格。</p>
                                <MaterialOption
                                    label="水晶质感 (Crystal)"
                                    active={currentMaterial?.type === 'crystal'}
                                    onClick={() => handleMaterialChange('crystal', { crystal: { facets: 4, shine: 80, depth: 60, color: '#6366f1', highlightColor: '#a5b4fc', color2: '#06b6d4', highlightColor2: '#67e8f9' } })}
                                />
                                <MaterialOption
                                    label="霓虹辉光 (Neon)"
                                    active={currentMaterial?.type === 'neon'}
                                    onClick={() => handleMaterialChange('neon', { neon: { glowIntensity: 80, glowSpread: 10, borderGlow: true, textGlow: true, color: '#22d3ee' } })}
                                />
                                <MaterialOption
                                    label="磨砂玻璃 (Glass)"
                                    active={currentMaterial?.type === 'glass'}
                                    onClick={() => handleMaterialChange('glass', { glass: { blur: 20, opacity: 0.1, borderOpacity: 0.2 } })}
                                />
                                <MaterialOption
                                    label="全息投影 (Holographic)"
                                    active={currentMaterial?.type === 'holographic'}
                                    onClick={() => handleMaterialChange('holographic', { holographic: { angle: 135, colors: ['#ff0080', '#7928ca', '#4ade80'] } })}
                                />
                                <MaterialOption
                                    label="新拟态 (Neumorphism)"
                                    active={currentMaterial?.type === 'neumorphism'}
                                    onClick={() => handleMaterialChange('neumorphism', { neumorphism: { elevation: 5, curvature: 20 } })}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: string, label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 text-xs font-medium flex items-center gap-3 transition-all relative
            ${active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}
        `}
    >
        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400" />}
        <i className={`fas fa-${icon} w-4 text-center ${active ? 'text-cyan-400' : ''}`} />
        {label}
    </button>
);

const MaterialOption: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full p-3 rounded-xl border text-left transition-all ${active ? 'bg-cyan-500/20 border-cyan-500/50 text-white' : 'bg-black/20 border-white/5 text-white/50 hover:bg-white/5 hover:text-white'}`}
    >
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            {active && <i className="fas fa-check-circle text-cyan-400" />}
        </div>
    </button>
);

const RangeControl: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
    <div>
        <div className="flex justify-between mb-1">
            <label className="text-xs text-white/60">{label}</label>
            <span className="text-xs text-cyan-400 font-mono">{value.toFixed(1)}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
        />
    </div>
);
