import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface ThemeSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'background' | 'theme' | 'material';

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('theme');
    const [modeSwitchMaterial, setModeSwitchMaterial] = useState<any>(null);

    if (!isOpen) return null;

    const handleMaterialChange = (type: string, settings: any) => {
        const newSettings = { modeSwitch: { type, ...settings } };
        setModeSwitchMaterial(newSettings.modeSwitch);
        localStorage.setItem('button_material_settings', JSON.stringify(newSettings));
        window.dispatchEvent(new Event('storage'));
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-[500px] h-[400px] bg-[#0f1016] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
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
                        <TabButton active={activeTab === 'background'} onClick={() => setActiveTab('background')} icon="image" label="背景图片" />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {activeTab === 'background' && (
                            <div className="text-center text-white/40 py-10">
                                <i className="fas fa-hard-hat text-3xl mb-3 block" />
                                <p>背景设置功能开发中...</p>
                                <p className="text-xs mt-2 opacity-50">（目前由 App 自动管理）</p>
                            </div>
                        )}

                        {activeTab === 'theme' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 block">主题色 (Primary)</label>
                                    <div className="grid grid-cols-5 gap-3">
                                        {['#6366f1', '#ec4899', '#06b6d4', '#8b5cf6', '#10b981'].map(c => (
                                            <button
                                                key={c}
                                                className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-lg"
                                                style={{ background: c }}
                                                onClick={() => {
                                                    document.documentElement.style.setProperty('--ui-primary', c);
                                                    // 同时保存到 localStorage 以便持久化
                                                    localStorage.setItem('theme_primary_color', c);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 block">字体风格</label>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-2 bg-white/5 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10 transition-colors">标准无衬线</button>
                                        <button className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-lg text-white hover:bg-white/10 transition-colors" style={{ fontFamily: 'Great Vibes' }}>Xingcloud</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'material' && (
                            <div className="space-y-4">
                                <MaterialOption
                                    label="水晶质感"
                                    active={modeSwitchMaterial?.type === 'crystal'}
                                    onClick={() => handleMaterialChange('crystal', { crystal: { facets: 4, shine: 80, depth: 60, color: '#6366f1', highlightColor: '#a5b4fc', color2: '#06b6d4', highlightColor2: '#67e8f9' } })}
                                />
                                <MaterialOption
                                    label="霓虹辉光"
                                    active={modeSwitchMaterial?.type === 'neon'}
                                    onClick={() => handleMaterialChange('neon', { neon: { glowIntensity: 80, glowSpread: 10, borderGlow: true, textGlow: true, color: '#22d3ee' } })}
                                />
                                <MaterialOption
                                    label="磨砂玻璃"
                                    active={modeSwitchMaterial?.type === 'glass'}
                                    onClick={() => handleMaterialChange('glass', { glass: { blur: 20, opacity: 0.1, borderOpacity: 0.2 } })}
                                />
                                <MaterialOption
                                    label="全息投影"
                                    active={modeSwitchMaterial?.type === 'holographic'}
                                    onClick={() => handleMaterialChange('holographic', { holographic: { angle: 135, colors: ['#ff0080', '#7928ca', '#4ade80'] } })}
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
        className={`w-full text-left px-4 py-3 text-xs font-medium flex items-center gap-3 transition-all
            ${active ? 'bg-white/10 text-white border-l-2 border-cyan-400' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-l-2 border-transparent'}
        `}
    >
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
