/**
 * input: App 传入的 themeConfig/materialSettings 与对应 setters
 * output: 主题配色与按钮材质的配置弹窗
 * pos: 系统视觉风格配置中心；管理 22 种配色方案与 5 类材质特效
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '../contexts/UserContext';

import { AppSettings, PlanetSceneSettings, ThemeConfig, MaterialSettings, MaterialPreset, ButtonMaterialConfig, MaterialType } from '../types';
import { BACKGROUND_IMAGES, DEFAULT_COLOR_SCHEMES, createDefaultMaterialConfig, BUILT_IN_MATERIAL_PRESETS } from '../constants';

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
    const [bgSubTab, setBgSubTab] = useState<'builtin' | 'ai'>('builtin');

    // Cloud presets from user context
    const { loadCloudConfig, saveCloudConfig } = useUser();
    const [cloudBackgroundPresets, setCloudBackgroundPresets] = useState<{ id: string; name: string; url: string }[]>([]);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; url: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [saveConfirm, setSaveConfirm] = useState<{ type: 'save' | 'saveAs'; schemeName: string; onConfirm: () => void } | null>(null);
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [editingPresetName, setEditingPresetName] = useState('');

    // Load cloud presets on mount
    useEffect(() => {
        loadCloudConfig().then(config => {
            if (config?.backgroundPresets) {
                setCloudBackgroundPresets(config.backgroundPresets);
            }
        });
    }, [loadCloudConfig]);

    // 删除背景预设
    const handleDeletePreset = async () => {
        if (!deleteConfirm) return;
        setIsDeleting(true);
        try {
            await fetch(`/api/upload?url=${encodeURIComponent(deleteConfirm.url)}`, { method: 'DELETE' });
            const config = await loadCloudConfig();
            if (config) {
                const updated = (config.backgroundPresets || []).filter((p: any) => p.id !== deleteConfirm.id);
                await saveCloudConfig({ ...config, backgroundPresets: updated });
                setCloudBackgroundPresets(updated);
            }
            if (currentBg?.panoramaUrl === deleteConfirm.url) {
                updateBackground({ panoramaUrl: '' });
            }
        } catch (err) {
            console.error('Delete preset failed:', err);
        } finally {
            setIsDeleting(false);
            setDeleteConfirm(null);
        }
    };

    // 重命名背景预设
    const handleRenamePreset = async (presetId: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            const config = await loadCloudConfig();
            if (config) {
                const updated = (config.backgroundPresets || []).map((p: any) =>
                    p.id === presetId ? { ...p, name: newName.trim() } : p
                );
                await saveCloudConfig({ ...config, backgroundPresets: updated });
                setCloudBackgroundPresets(updated);
            }
        } catch (err) {
            console.error('Rename preset failed:', err);
        } finally {
            setEditingPresetId(null);
            setEditingPresetName('');
        }
    };

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent pointer-events-none">
            {/* Click outside to close - disabled for right side interaction */}
            <div className="absolute inset-0 pointer-events-auto" style={{ right: '400px' }} onClick={onClose} />

            <div
                className="relative w-[600px] h-[500px] bg-[#0f1016] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 pointer-events-auto"
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
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">全景图选择</label>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setBgSubTab('builtin')}
                                                    className={`px-2 py-0.5 text-[10px] rounded ${bgSubTab === 'builtin' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/40 hover:text-white/60'}`}
                                                >
                                                    内置
                                                </button>
                                                <button
                                                    onClick={() => setBgSubTab('ai')}
                                                    className={`px-2 py-0.5 text-[10px] rounded ${bgSubTab === 'ai' ? 'bg-purple-500/20 text-purple-400' : 'text-white/40 hover:text-white/60'}`}
                                                >
                                                    ✨ AI ({cloudBackgroundPresets.length})
                                                </button>
                                            </div>
                                        </div>

                                        {bgSubTab === 'builtin' ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                {BACKGROUND_IMAGES.map((img: any) => (
                                                    <button
                                                        key={img.value}
                                                        onClick={() => updateBackground({ panoramaUrl: img.value })}
                                                        className={`relative aspect-[4/3] rounded-lg border overflow-hidden transition-all
                                                            ${currentBg?.panoramaUrl === img.value
                                                                ? 'border-cyan-500 ring-2 ring-cyan-500/50'
                                                                : 'border-white/10 hover:border-white/30'
                                                            }`}
                                                    >
                                                        <img
                                                            src={img.value}
                                                            alt={img.label}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                            <span className="text-[9px] text-white/80 truncate block">{img.label}</span>
                                                        </div>
                                                        {currentBg?.panoramaUrl === img.value && (
                                                            <div className="absolute top-1 right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                                                                <i className="fas fa-check text-[8px] text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2">
                                                {cloudBackgroundPresets.length > 0 ? (
                                                    cloudBackgroundPresets.map((preset) => (
                                                        <div key={preset.id} className="relative group">
                                                            <button
                                                                onClick={() => updateBackground({ panoramaUrl: preset.url })}
                                                                className={`relative w-full aspect-[4/3] rounded-lg border overflow-hidden transition-all
                                                                    ${currentBg?.panoramaUrl === preset.url
                                                                        ? 'border-purple-500 ring-2 ring-purple-500/50'
                                                                        : 'border-white/10 hover:border-white/30'
                                                                    }`}
                                                            >
                                                                <img
                                                                    src={preset.url}
                                                                    alt={preset.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                                    {editingPresetId === preset.id ? (
                                                                        <input
                                                                            type="text"
                                                                            value={editingPresetName}
                                                                            onChange={(e) => setEditingPresetName(e.target.value)}
                                                                            onBlur={() => handleRenamePreset(preset.id, editingPresetName)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleRenamePreset(preset.id, editingPresetName);
                                                                                if (e.key === 'Escape') { setEditingPresetId(null); setEditingPresetName(''); }
                                                                            }}
                                                                            autoFocus
                                                                            className="w-full text-[9px] bg-white/20 text-white border border-white/30 rounded px-1 py-0.5 outline-none"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            className="text-[9px] text-white/80 truncate block cursor-text hover:text-white"
                                                                            onDoubleClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingPresetId(preset.id);
                                                                                setEditingPresetName(preset.name);
                                                                            }}
                                                                            title="双击重命名"
                                                                        >
                                                                            {preset.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {currentBg?.panoramaUrl === preset.url && (
                                                                    <div className="absolute top-1 left-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                                                        <i className="fas fa-check text-[8px] text-white" />
                                                                    </div>
                                                                )}
                                                            </button>
                                                            {/* 删除按钮 */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(preset); }}
                                                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                                title="删除"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-3 text-center py-4 text-white/30 text-xs">
                                                        暂无 AI 生成的背景图<br />
                                                        <span className="text-white/20">使用 AI 助手 → 灵感模式 → 背景图 生成</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                                                {/* 删除按钮 - 所有方案都可删除 */}
                                                {Object.keys(themeConfig?.schemes || {}).length > 1 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (setThemeConfig && themeConfig) {
                                                                const schemeIds = Object.keys(themeConfig.schemes);
                                                                const isCurrentlyActive = themeConfig.activeSchemeId === id;

                                                                // 删除方案
                                                                const newSchemes = { ...themeConfig.schemes };
                                                                delete newSchemes[id];

                                                                // 如果删除的是当前选中的方案，切换到第一个可用方案
                                                                let newActiveId = themeConfig.activeSchemeId;
                                                                if (isCurrentlyActive) {
                                                                    const remainingIds = schemeIds.filter(sid => sid !== id);
                                                                    newActiveId = remainingIds[0] || 'default';
                                                                }

                                                                setThemeConfig({
                                                                    ...themeConfig,
                                                                    schemes: newSchemes,
                                                                    activeSchemeId: newActiveId,
                                                                    activeColors: newSchemes[newActiveId]?.colors || themeConfig.activeColors
                                                                });
                                                            }
                                                        }}
                                                        className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/0 hover:bg-red-500/80 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                                        title={scheme.isSystem ? "删除系统方案" : "删除此方案"}
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
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => {
                                                if (setThemeConfig && themeConfig && themeConfig.activeSchemeId) {
                                                    const currentScheme = themeConfig.schemes[themeConfig.activeSchemeId];
                                                    if (currentScheme) {
                                                        setSaveConfirm({
                                                            type: 'save',
                                                            schemeName: currentScheme.name,
                                                            onConfirm: () => {
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
                                                        });
                                                    }
                                                }
                                            }}
                                            className="flex-1 py-2 px-3 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                                        >
                                            <i className="fas fa-save mr-1" /> 保存到 {themeConfig?.schemes[themeConfig.activeSchemeId]?.name || '当前方案'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (setThemeConfig && themeConfig) {
                                                    setSaveConfirm({
                                                        type: 'saveAs',
                                                        schemeName: '新方案',
                                                        onConfirm: () => {
                                                            const newId = `custom_${Date.now()}`;
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
                                                    });
                                                }
                                            }}
                                            className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
                                        >
                                            <i className="fas fa-plus mr-1" /> 另存为
                                        </button>
                                    </div>
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
                                                        const builtIn = BUILT_IN_MATERIAL_PRESETS.find((p) => p.id === preset.id);
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
                                        config={(() => {
                                            const sub = materialSettings?.subModuleTabs;
                                            if (!sub) return undefined;
                                            // 兼容旧数据：如果是单一配置对象（有type属性），直接使用
                                            if ('type' in sub && typeof (sub as any).type === 'string') {
                                                return sub as any as ButtonMaterialConfig;
                                            }
                                            // 新数据：取core作为代表
                                            return sub['core'];
                                        })()}
                                        onChange={(config) => {
                                            if (setMaterialSettings && materialSettings) {
                                                // 确保保存为新的 Record 结构
                                                const subModuleKeys = ['core', 'energyBody', 'rings', 'afterimage', 'radiation', 'fireflies', 'magicCircle'];
                                                const newSubModuleTabs: Record<string, ButtonMaterialConfig> = {};

                                                subModuleKeys.forEach(key => {
                                                    newSubModuleTabs[key] = config;
                                                });

                                                setMaterialSettings({ ...materialSettings, subModuleTabs: newSubModuleTabs });
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

            {/* 删除确认弹窗 */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 pointer-events-auto" onClick={() => !isDeleting && setDeleteConfirm(null)}>
                    <div
                        className="w-80 rounded-xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(25,25,40,0.98) 0%, rgba(15,15,25,0.98) 100%)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 0 40px rgba(100,100,200,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-white/10">
                            <h3 className="text-white font-medium">确认删除</h3>
                        </div>
                        <div className="p-4">
                            <p className="text-white/80 text-sm">确定要删除背景预设 "{deleteConfirm.name}" 吗？此操作不可撤销。</p>
                        </div>
                        <div className="p-3 flex gap-2 justify-end border-t border-white/10">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={isDeleting}
                                className="px-3 py-1.5 text-sm text-white/60 hover:text-white/90 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeletePreset}
                                disabled={isDeleting}
                                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 保存确认弹窗 */}
            {saveConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 pointer-events-auto" onClick={() => setSaveConfirm(null)}>
                    <div
                        className="w-80 rounded-xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(180deg, rgba(25,25,40,0.98) 0%, rgba(15,15,25,0.98) 100%)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 0 40px rgba(100,200,200,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-white/10">
                            <h3 className="text-white font-medium">
                                {saveConfirm.type === 'save' ? '确认保存' : '确认另存为'}
                            </h3>
                        </div>
                        <div className="p-4">
                            <p className="text-white/80 text-sm">
                                {saveConfirm.type === 'save'
                                    ? `确定要将当前颜色保存到 "${saveConfirm.schemeName}" 方案吗？`
                                    : `确定要创建新方案 "${saveConfirm.schemeName}" 吗？`
                                }
                            </p>
                        </div>
                        <div className="p-3 flex gap-2 justify-end border-t border-white/10">
                            <button
                                onClick={() => setSaveConfirm(null)}
                                className="px-3 py-1.5 text-sm text-white/60 hover:text-white/90 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    saveConfirm.onConfirm();
                                    setSaveConfirm(null);
                                }}
                                className="px-3 py-1.5 text-sm text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

// 材质参数编辑器组件
const MaterialParamEditor: React.FC<{
    config: ButtonMaterialConfig;
    onChange: (updates: Partial<ButtonMaterialConfig>) => void;
}> = ({ config, onChange }) => {
    const type = config.type;

    return (
        <div className="mt-3 p-3 rounded-lg bg-black/20 border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {type === 'glass' && (
                <>
                    <RangeControl label="模糊度 (px)" value={config.glass.blur} min={0} max={20} step={1} onChange={(v) => onChange({ glass: { ...config.glass, blur: v } })} />
                    <RangeControl label="不透明度" value={config.glass.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ glass: { ...config.glass, opacity: v } })} />
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-white/60 w-16">色调</label>
                        <input type="color" value={config.glass.tint} onChange={(e) => onChange({ glass: { ...config.glass, tint: e.target.value } })} className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                    </div>
                </>
            )}
            {type === 'neon' && (
                <>
                    <RangeControl label="发光强度" value={config.neon.glowIntensity} min={0} max={20} step={1} onChange={(v) => onChange({ neon: { ...config.neon, glowIntensity: v } })} />
                    <div className="flex items-center gap-4 py-1">
                        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                            <input type="checkbox" checked={config.neon.borderGlow} onChange={(e) => onChange({ neon: { ...config.neon, borderGlow: e.target.checked } })} className="rounded bg-white/10 border-white/20 text-cyan-500" />
                            边框发光
                        </label>
                        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                            <input type="checkbox" checked={config.neon.textGlow} onChange={(e) => onChange({ neon: { ...config.neon, textGlow: e.target.checked } })} className="rounded bg-white/10 border-white/20 text-cyan-500" />
                            文字发光
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-white/60 w-16">主色</label>
                        <input type="color" value={config.neon.color} onChange={(e) => onChange({ neon: { ...config.neon, color: e.target.value } })} className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                    </div>
                </>
            )}
            {type === 'crystal' && (
                <>
                    <RangeControl label="切面数" value={config.crystal.facets} min={0} max={20} step={1} onChange={(v) => onChange({ crystal: { ...config.crystal, facets: v } })} />
                    <RangeControl label="光泽度" value={config.crystal.shine} min={0} max={100} step={5} onChange={(v) => onChange({ crystal: { ...config.crystal, shine: v } })} />
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-white/60 w-16">主色</label>
                        <input type="color" value={config.crystal.color} onChange={(e) => onChange({ crystal: { ...config.crystal, color: e.target.value } })} className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                        <label className="text-xs text-white/60 w-16 ml-2">高光</label>
                        <input type="color" value={config.crystal.highlightColor} onChange={(e) => onChange({ crystal: { ...config.crystal, highlightColor: e.target.value } })} className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                    </div>
                </>
            )}
            {type === 'neumorphism' && (
                <>
                    <RangeControl label="凸起 (px)" value={config.neumorphism.elevation} min={0} max={20} step={1} onChange={(v) => onChange({ neumorphism: { ...config.neumorphism, elevation: v } })} />
                    <RangeControl label="光照角度" value={config.neumorphism.lightAngle} min={0} max={360} step={15} onChange={(v) => onChange({ neumorphism: { ...config.neumorphism, lightAngle: v } })} />
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-white/60">基础</label>
                            <input type="color" value={config.neumorphism.baseColor} onChange={(e) => onChange({ neumorphism: { ...config.neumorphism, baseColor: e.target.value } })} className="w-5 h-5 rounded cursor-pointer bg-transparent" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-white/60">阴影</label>
                            <input type="color" value={config.neumorphism.shadowColor} onChange={(e) => onChange({ neumorphism: { ...config.neumorphism, shadowColor: e.target.value } })} className="w-5 h-5 rounded cursor-pointer bg-transparent" />
                        </div>
                    </div>
                </>
            )}
            {type === 'holographic' && (
                <>
                    <RangeControl label="动画速度" value={config.holographic.speed} min={0} max={10} step={1} onChange={(v) => onChange({ holographic: { ...config.holographic, speed: v } })} />
                    <RangeControl label="噪点强度" value={config.holographic.noiseIntensity ?? 0.1} min={0} max={1} step={0.1} onChange={(v) => onChange({ holographic: { ...config.holographic, noiseIntensity: v } })} />
                    <div className="flex items-center gap-4 py-1">
                        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                            <input type="checkbox" checked={config.holographic.shimmer} onChange={(e) => onChange({ holographic: { ...config.holographic, shimmer: e.target.checked } })} className="rounded bg-white/10 border-white/20 text-cyan-500" />
                            动态闪烁
                        </label>
                    </div>
                </>
            )}
        </div>
    );
};

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
    const [expanded, setExpanded] = useState(false);
    const currentType = config?.type || 'glass';

    return (
        <div className="p-2 rounded-lg bg-white/5 border border-white/10 transition-colors hover:border-white/20">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <span className="text-xs text-white font-medium">{label}</span>
                    <span className="text-[10px] text-white/40 ml-1">{desc}</span>
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${expanded ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white hover:bg-white/10'}`}
                >
                    {expanded ? '收起参数' : '调整参数'}
                </button>
            </div>

            {/* 材质类型选择 */}
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

            {/* 详细参数编辑器 */}
            {expanded && config && (
                <MaterialParamEditor config={config} onChange={(updates) => {
                    // 合并更新：确保只更新当前 type 对应的字段
                    // 注意：updates 也是 Partial<ButtonMaterialConfig>
                    // 递归合并太麻烦，直接浅合并第一层 key (glass, neon etc)
                    const newConfig = { ...config };
                    // 遍历 updates 的 key 并合并
                    (Object.keys(updates) as Array<keyof ButtonMaterialConfig>).forEach(key => {
                        if (key === 'type') {
                            newConfig.type = updates.type as MaterialType;
                        } else {
                            // 这里假设 updates[key] 是对象，需要与 config[key] 合并
                            // 但实际上我们的 MaterialParamEditor 传回的 updates 已经是完整的了吗？
                            // 不，MaterialParamEditor 传回的是 { glass: { ...old.glass, blur: v } }
                            // 所以这里直接覆盖即可
                            (newConfig as any)[key] = (updates as any)[key];
                        }
                    });
                    onChange(newConfig);
                }} />
            )}
        </div>
    );
};
