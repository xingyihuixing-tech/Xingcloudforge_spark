/**
 * input: App 传入的 themeConfig/materialSettings 与对应 setters
 * output: 主题配色与按钮材质的配置弹窗
 * pos: 系统视觉风格配置中心；管理 22 种配色方案与 5 类材质特效
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { AppSettings, PlanetSceneSettings, ThemeConfig, MaterialSettings, MaterialPreset, ButtonMaterialConfig, MaterialType } from '../types';
import { BACKGROUND_IMAGES, DEFAULT_COLOR_SCHEMES, createDefaultMaterialConfig } from '../constants';

interface ThemeSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings?: AppSettings;
    setSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
    planetSettings?: PlanetSceneSettings;
    setPlanetSettings?: React.Dispatch<React.SetStateAction<PlanetSceneSettings>>;
    appMode?: 'nebula' | 'planet';

    // 主题配置
    themeConfig?: ThemeConfig;
    setThemeConfig?: React.Dispatch<React.SetStateAction<ThemeConfig>>;
    // 材质配置
    materialSettings?: MaterialSettings;
    setMaterialSettings?: React.Dispatch<React.SetStateAction<MaterialSettings>>;
    // 材质预设
    userMaterialPresets?: MaterialPreset[];
    setUserMaterialPresets?: React.Dispatch<React.SetStateAction<MaterialPreset[]>>;
}

type TabType = 'background' | 'theme' | 'material';

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
    isOpen, onClose, settings, setSettings, planetSettings, setPlanetSettings, appMode,
    themeConfig, setThemeConfig,
    materialSettings, setMaterialSettings,
    userMaterialPresets, setUserMaterialPresets
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('theme');



    // Use effects to sync or load defaults if needed

    if (!isOpen) return null;





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
                                {/* 配色方案预设列表 */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">配色方案 ({Object.keys(themeConfig?.schemes || {}).length})</label>
                                        <button
                                            onClick={() => {
                                                const newId = `custom_${Date.now()}`;
                                                if (setThemeConfig && themeConfig) {
                                                    setThemeConfig({
                                                        ...themeConfig,
                                                        schemes: {
                                                            ...themeConfig.schemes,
                                                            [newId]: {
                                                                name: '新方案',
                                                                colors: { ...themeConfig.activeColors },
                                                                isSystem: false
                                                            }
                                                        },
                                                        activeSchemeId: newId
                                                    });
                                                }
                                            }}
                                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                        >
                                            <i className="fas fa-plus" /> 另存为
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                        {Object.entries(themeConfig?.schemes || {}).map(([id, scheme]) => (
                                            <button
                                                key={id}
                                                onClick={() => {
                                                    if (setThemeConfig && themeConfig) {
                                                        setThemeConfig({
                                                            ...themeConfig,
                                                            activeSchemeId: id,
                                                            activeColors: { ...scheme.colors }
                                                        });
                                                    }
                                                }}
                                                className={`p-2 rounded-lg border text-left text-xs transition-all group relative
                                                    ${themeConfig?.activeSchemeId === id
                                                        ? 'bg-cyan-500/20 border-cyan-500/50'
                                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex gap-0.5">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: scheme.colors.primary }} />
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: scheme.colors.secondary }} />
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: scheme.colors.textAccent }} />
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: scheme.colors.decoration }} />
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: scheme.colors.editBar }} />
                                                    </div>
                                                    {scheme.isSystem && <span className="text-[9px] text-white/30">系统</span>}
                                                </div>
                                                <span className="text-white/80 group-hover:text-white">{scheme.name}</span>
                                                {/* 删除按钮 */}
                                                {!scheme.isSystem && themeConfig?.activeSchemeId !== id && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (setThemeConfig && themeConfig) {
                                                                const newSchemes = { ...themeConfig.schemes };
                                                                delete newSchemes[id];
                                                                setThemeConfig({ ...themeConfig, schemes: newSchemes });
                                                            }
                                                        }}
                                                        className="absolute top-1 right-1 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <i className="fas fa-times text-[10px]" />
                                                    </button>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 5色编辑器 */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="text-xs text-white/60 mb-3 uppercase tracking-wider font-semibold">自定义颜色</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[
                                            { key: 'primary', label: '主交互色', desc: '按钮、链接' },
                                            { key: 'secondary', label: '次交互色', desc: '边框、次要元素' },
                                            { key: 'textAccent', label: '标题强调', desc: '标题、重点文字' },
                                            { key: 'decoration', label: '装饰线条', desc: '分隔线、边框' },
                                            { key: 'editBar', label: '编辑栏', desc: '输入框高亮' },
                                        ].map(({ key, label, desc }) => (
                                            <div key={key} className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={(themeConfig?.activeColors as any)?.[key] || '#6366f1'}
                                                    onChange={(e) => {
                                                        if (setThemeConfig && themeConfig) {
                                                            setThemeConfig({
                                                                ...themeConfig,
                                                                activeColors: {
                                                                    ...themeConfig.activeColors,
                                                                    [key]: e.target.value
                                                                }
                                                            });
                                                        }
                                                    }}
                                                    className="w-8 h-8 rounded-lg cursor-pointer border border-white/10"
                                                />
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">{label}</span>
                                                    <span className="text-xs text-white/30 ml-2">{desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* 保存当前方案按钮 */}
                                    <button
                                        onClick={() => {
                                            if (setThemeConfig && themeConfig && themeConfig.activeSchemeId) {
                                                const currentScheme = themeConfig.schemes[themeConfig.activeSchemeId];
                                                if (currentScheme) {
                                                    setThemeConfig({
                                                        ...themeConfig,
                                                        schemes: {
                                                            ...themeConfig.schemes,
                                                            [themeConfig.activeSchemeId]: {
                                                                ...currentScheme,
                                                                colors: { ...themeConfig.activeColors }
                                                            }
                                                        }
                                                    });
                                                }
                                            }
                                        }}
                                        className="mt-4 w-full py-2 px-3 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                                    >
                                        <i className="fas fa-save mr-1" /> 保存到当前方案
                                    </button>
                                </div>

                                {/* 控制台背景色 */}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <input
                                        type="color"
                                        value={themeConfig?.consoleBg || '#000000'}
                                        onChange={(e) => {
                                            if (setThemeConfig && themeConfig) {
                                                setThemeConfig({
                                                    ...themeConfig,
                                                    consoleBg: e.target.value
                                                });
                                            }
                                        }}
                                        className="w-8 h-8 rounded-lg cursor-pointer border border-white/10"
                                    />
                                    <div>
                                        <span className="text-sm text-white">控制台背景色</span>
                                        <span className="text-xs text-white/30 ml-2">(独立于配色方案)</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'material' && (
                            <div className="space-y-4">
                                {/* 材质预设快选 */}
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 block">快速预设</label>
                                    <div className="grid grid-cols-5 gap-1">
                                        {[
                                            { id: 'default', name: '默认', icon: '🎨' },
                                            { id: 'glass', name: '玻璃', icon: '🪟' },
                                            { id: 'neon', name: '霓虹', icon: '💡' },
                                            { id: 'crystal', name: '水晶', icon: '💎' },
                                            { id: 'holographic', name: '全息', icon: '🌈' },
                                        ].map(preset => (
                                            <button
                                                key={preset.id}
                                                onClick={() => {
                                                    // 应用内置预设
                                                    if (setMaterialSettings) {
                                                        const builtIn = require('../constants').BUILT_IN_MATERIAL_PRESETS.find((p: any) => p.id === preset.id);
                                                        if (builtIn) {
                                                            setMaterialSettings(builtIn.data);
                                                        }
                                                    }
                                                }}
                                                className="p-2 rounded-lg border border-white/10 hover:border-cyan-500/50 text-center transition-all hover:bg-cyan-500/10"
                                            >
                                                <div className="text-lg mb-0.5">{preset.icon}</div>
                                                <div className="text-[10px] text-white/60">{preset.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 5个按钮组设置 */}
                                <div className="space-y-3">
                                    <label className="text-xs text-white/40 uppercase tracking-wider font-semibold block">按钮组材质</label>

                                    {/* 模式切换按钮 */}
                                    <ButtonGroupSetting
                                        label="模式切换"
                                        desc="星云/星球切换按钮"
                                        config={materialSettings?.modeSwitch}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                setMaterialSettings({ ...materialSettings, modeSwitch: config });
                                            }
                                        }}
                                    />

                                    {/* 主Tab按钮 */}
                                    <ButtonGroupSetting
                                        label="主Tab"
                                        desc="星系创造/特殊效果/星系交互"
                                        config={materialSettings?.mainTabs}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                setMaterialSettings({ ...materialSettings, mainTabs: config });
                                            }
                                        }}
                                    />

                                    {/* 模块Tab按钮 */}
                                    <ButtonGroupSetting
                                        label="模块Tab"
                                        desc="核心/能量体/光环等"
                                        config={materialSettings?.moduleTabs}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                setMaterialSettings({ ...materialSettings, moduleTabs: config });
                                            }
                                        }}
                                    />

                                    {/* 选项按钮 */}
                                    <ButtonGroupSetting
                                        label="选项按钮"
                                        desc="轴选择、颜色模式等"
                                        config={materialSettings?.optionButtons}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                setMaterialSettings({ ...materialSettings, optionButtons: config });
                                            }
                                        }}
                                    />

                                    {/* 子模块Tab（统一设置） */}
                                    <ButtonGroupSetting
                                        label="子模块Tab"
                                        desc="统一应用于所有子模块"
                                        config={materialSettings?.subModuleTabs}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                setMaterialSettings({ ...materialSettings, subModuleTabs: config });
                                            }
                                        }}
                                    />
                                </div>

                                {/* 用户预设管理 */}
                                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-white/60">我的预设</span>
                                        <button
                                            onClick={() => {
                                                if (setUserMaterialPresets && userMaterialPresets && materialSettings) {
                                                    const newPreset = {
                                                        id: `user_${Date.now()}`,
                                                        name: `预设 ${userMaterialPresets.length + 1}`,
                                                        data: { ...materialSettings }
                                                    };
                                                    setUserMaterialPresets([...userMaterialPresets, newPreset]);
                                                }
                                            }}
                                            className="text-xs text-cyan-400 hover:text-cyan-300"
                                        >
                                            <i className="fas fa-plus mr-1" /> 保存当前
                                        </button>
                                    </div>
                                    {userMaterialPresets && userMaterialPresets.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {userMaterialPresets.map((preset, idx) => (
                                                <div key={preset.id} className="group relative">
                                                    <button
                                                        onClick={() => {
                                                            if (setMaterialSettings) {
                                                                setMaterialSettings(preset.data);
                                                            }
                                                        }}
                                                        className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-cyan-500/20 text-white/70 hover:text-white transition-all"
                                                    >
                                                        {preset.name}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (setUserMaterialPresets) {
                                                                setUserMaterialPresets(userMaterialPresets.filter(p => p.id !== preset.id));
                                                            }
                                                        }}
                                                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500/80 text-white text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-white/30">暂无保存的预设</p>
                                    )}
                                </div>
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

// 按钮组材质设置组件

const MATERIAL_TYPE_LABELS: Record<MaterialType, { name: string; icon: string }> = {
    glass: { name: '玻璃', icon: '🪟' },
    neon: { name: '霓虹', icon: '💡' },
    crystal: { name: '水晶', icon: '💎' },
    neumorphism: { name: '3D', icon: '🔘' },
    holographic: { name: '全息', icon: '🌈' },
};

const ButtonGroupSetting: React.FC<{
    label: string;
    desc: string;
    config?: ButtonMaterialConfig;
    onChange: (config: ButtonMaterialConfig) => void;
}> = ({ label, desc, config, onChange }) => {
    const currentType = config?.type || 'glass';

    return (
        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <span className="text-xs text-white font-medium">{label}</span>
                    <span className="text-[10px] text-white/40 ml-1">{desc}</span>
                </div>
            </div>
            <div className="flex gap-1">
                {(Object.keys(MATERIAL_TYPE_LABELS) as MaterialType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => {
                            const newConfig = config ? { ...config, type } : createDefaultMaterialConfig(type);
                            onChange(newConfig);
                        }}
                        className={`flex-1 py-1.5 rounded text-center transition-all ${currentType === type
                            ? 'bg-cyan-500/30 border border-cyan-500/50'
                            : 'bg-white/5 border border-white/5 hover:bg-white/10'
                            }`}
                    >
                        <div className="text-sm">{MATERIAL_TYPE_LABELS[type].icon}</div>
                        <div className="text-[9px] text-white/60">{MATERIAL_TYPE_LABELS[type].name}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};
