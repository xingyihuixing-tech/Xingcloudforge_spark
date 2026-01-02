/**
 * XingSpark Settings Panel Component
 * 
 * input: isOpen, onClose, xingConfig, setXingConfig, userId
 * output: XingSpark 设置弹窗 UI (Logo风格/颜色/对话栏设置)
 * pos: AI 系统的品牌设置组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============================================
// XingSpark 配置类型
// ============================================

export interface LogoGradientConfig {
    colors: string[];
    type: 'conic' | 'linear' | 'radial';
    angle: number;
    flowType: 'vortex' | 'wave';
    flowSpeed: number;
    flowDirection: 'cw' | 'ccw';
    orbitRange: number;
    saturation: number;
    brightness: number;
    glow: { enabled: boolean; color: string; intensity: number };
}

export interface InputGlowConfig {
    colors: string[];
    speed: number;
    thickBlur: number;
    thickOpacity: number;
    thinBlur: number;
    thinOpacity: number;
    borderOpacity: number;
}

export interface XingSparkConfig {
    font: string;
    gradient: LogoGradientConfig;
    inputGlow: InputGlowConfig;
}

// 默认配置
export const DEFAULT_XING_CONFIG: XingSparkConfig = {
    font: 'Pacifico',
    gradient: {
        colors: ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2'],
        type: 'conic',
        angle: 135,
        flowType: 'vortex',
        flowSpeed: 5,
        flowDirection: 'cw',
        orbitRange: 50,
        saturation: 120,
        brightness: 105,
        glow: { enabled: true, color: 'auto', intensity: 6 }
    },
    inputGlow: {
        colors: ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2'],
        speed: 6,
        thickBlur: 12,
        thickOpacity: 0.25,
        thinBlur: 6,
        thinOpacity: 0.15,
        borderOpacity: 0.5
    }
};

// 字体选项
const FONT_OPTIONS = [
    { name: 'Pacifico', label: '活泼手写', size: '1.4rem' },
    { name: 'Great Vibes', label: '经典书法', size: '1.8rem' },
    { name: 'Dancing Script', label: '律动连笔', size: '1.6rem' },
    { name: 'Sacramento', label: '极细现代', size: '2rem' },
    { name: 'Pinyon Script', label: '华丽典雅', size: '1.8rem' },
    { name: 'Parisienne', label: '浪漫法式', size: '1.6rem' },
    { name: 'Clicker Script', label: '俏皮跳跃', size: '1.8rem' },
    { name: 'Allura', label: '丝滑柔顺', size: '2rem' },
];

// 渐变预设
const GRADIENT_PRESETS = [
    { id: 'default', name: '默认蓝粉', colors: ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2'] },
    { id: 'aurora', name: '极光', colors: ['#37f1d2', '#71b0ff', '#c084fc'] },
    { id: 'sunset', name: '日落', colors: ['#ff9a56', '#ff6b8a', '#ffb6c1'] },
    { id: 'forest', name: '森林', colors: ['#22c55e', '#84cc16', '#a3e635'] },
    { id: 'starry', name: '星空', colors: ['#3b82f6', '#8b5cf6', '#ec4899'] },
    { id: 'ocean', name: '海洋', colors: ['#06b6d4', '#0ea5e9', '#3b82f6'] },
    { id: 'candy', name: '糖果', colors: ['#f472b6', '#fb7185', '#fbbf24'] },
    { id: 'neon', name: '霓虹', colors: ['#a855f7', '#ec4899', '#06b6d4', '#22c55e'] },
];

interface XingSparkSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    config: XingSparkConfig;
    setConfig: React.Dispatch<React.SetStateAction<XingSparkConfig>>;
    userId?: string;
}

const XingSparkSettings: React.FC<XingSparkSettingsProps> = ({
    isOpen,
    onClose,
    config,
    setConfig,
    userId
}) => {
    const [activeTab, setActiveTab] = useState<'style' | 'color' | 'chat'>('style');
    const [isSaving, setIsSaving] = useState(false);

    // 更新渐变配置
    const updateGradient = useCallback((updates: Partial<LogoGradientConfig>) => {
        setConfig(prev => ({ ...prev, gradient: { ...prev.gradient, ...updates } }));
    }, [setConfig]);

    // 更新输入框光晕配置
    const updateInputGlow = useCallback((updates: Partial<InputGlowConfig>) => {
        setConfig(prev => ({ ...prev, inputGlow: { ...prev.inputGlow, ...updates } }));
    }, [setConfig]);

    // 保存配置到云端
    const saveToCloud = useCallback(async () => {
        if (!userId) return;
        setIsSaving(true);
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    config: { xingSparkConfig: config }
                })
            });
        } catch (err) {
            console.error('保存 XingSpark 配置失败:', err);
        } finally {
            setIsSaving(false);
        }
    }, [userId, config]);

    // 自动保存
    useEffect(() => {
        if (userId) {
            const timer = setTimeout(saveToCloud, 1000);
            return () => clearTimeout(timer);
        }
    }, [config, userId, saveToCloud]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center z-[10000]"
            onClick={onClose}
        >
            <div
                className="rounded-2xl w-[600px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col relative"
                style={{
                    background: 'rgba(15, 23, 42, 0.12)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    boxShadow: `
                        0 24px 48px rgba(0,0,0,0.15), 
                        0 8px 16px rgba(0,0,0,0.1),
                        0 0 20px ${config.gradient.colors[0]}40,
                        0 0 40px ${config.gradient.colors[1] || config.gradient.colors[0]}25
                    `
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* 四边独立渐变边框 */}
                <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                    style={{
                        background: `linear-gradient(90deg, transparent 0%, ${config.gradient.colors[0]} 20%, ${config.gradient.colors[1] || config.gradient.colors[0]} 50%, ${config.gradient.colors[2] || config.gradient.colors[0]} 80%, transparent 100%)`,
                        animation: 'breathe 3.5s ease-in-out infinite'
                    }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none"
                    style={{
                        background: `linear-gradient(90deg, transparent 0%, ${config.gradient.colors[2] || config.gradient.colors[0]} 20%, ${config.gradient.colors[1] || config.gradient.colors[0]} 50%, ${config.gradient.colors[0]} 80%, transparent 100%)`,
                        animation: 'breathe 3.5s ease-in-out infinite'
                    }}
                />
                <div className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
                    style={{
                        background: `linear-gradient(to bottom, ${config.gradient.colors[0]}cc 0%, ${config.gradient.colors[1] || config.gradient.colors[0]}80 30%, ${config.gradient.colors[2] || config.gradient.colors[0]}40 70%, transparent 100%)`,
                        animation: 'breathe 3.5s ease-in-out infinite'
                    }}
                />
                <div className="absolute right-0 top-0 bottom-0 w-[2px] pointer-events-none"
                    style={{
                        background: `linear-gradient(to bottom, transparent 0%, ${config.gradient.colors[2] || config.gradient.colors[0]}40 30%, ${config.gradient.colors[1] || config.gradient.colors[0]}80 70%, ${config.gradient.colors[0]}cc 100%)`,
                        animation: 'breathe 3.5s ease-in-out infinite'
                    }}
                />

                {/* Tab 头部 */}
                <div className="flex border-b border-white/10">
                    {[
                        { id: 'style' as const, label: 'Logo 风格' },
                        { id: 'color' as const, label: 'Logo 颜色' },
                        { id: 'chat' as const, label: '对话栏设置' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                                    : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab 内容 */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {/* Logo 风格 Tab */}
                    {activeTab === 'style' && (
                        <div className="grid grid-cols-2 gap-3">
                            {FONT_OPTIONS.map(font => {
                                const isSelected = config.font === font.name;
                                return (
                                    <button
                                        key={font.name}
                                        onClick={() => setConfig(prev => ({ ...prev, font: font.name }))}
                                        className={`p-4 rounded-xl transition-all hover:scale-[1.02] bg-white/5 hover:bg-white/10`}
                                        style={{
                                            border: isSelected ? `2px solid ${config.gradient.colors[0]}` : '1px solid rgba(100,116,139,0.2)',
                                            boxShadow: isSelected ? `0 0 16px ${config.gradient.colors[0]}40` : 'none'
                                        }}
                                    >
                                        <div
                                            className="text-center mb-2"
                                            style={{
                                                fontFamily: `'${font.name}', cursive`,
                                                fontSize: font.size,
                                                background: `conic-gradient(from 0deg at 50% 50%, ${[...config.gradient.colors, config.gradient.colors[0]].join(', ')})`,
                                                WebkitBackgroundClip: 'text',
                                                backgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                color: 'transparent',
                                            }}
                                        >
                                            <span style={{ fontSize: '1em' }}>X</span>
                                            <span style={{ fontSize: '0.9em' }}>ing</span>
                                            <span style={{ fontSize: '1.25em', marginLeft: '-0.05em' }}>S</span>
                                            <span style={{ fontSize: '0.9em' }}>park</span>
                                        </div>
                                        <div className="text-[10px] text-center text-white/40">{font.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Logo 颜色 Tab */}
                    {activeTab === 'color' && (
                        <div className="space-y-5">
                            {/* 渐变预设 */}
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-white/80 mb-3">渐变预设</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {GRADIENT_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => updateGradient({ colors: [...preset.colors] })}
                                            className="p-2 rounded-lg text-center transition-all hover:scale-105 bg-white/5 hover:bg-white/10"
                                        >
                                            <div
                                                className="w-full h-6 rounded-md mb-1"
                                                style={{ background: `linear-gradient(90deg, ${preset.colors.join(', ')})` }}
                                            />
                                            <span className="text-[10px] text-white/50">{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 颜色选择器 */}
                            <div>
                                <label className="text-xs font-medium text-white/60">
                                    渐变颜色数量: {config.gradient.colors.length}
                                </label>
                                <input
                                    type="range"
                                    min="2" max="5"
                                    value={config.gradient.colors.length}
                                    onChange={e => {
                                        const count = parseInt(e.target.value);
                                        const colors = [...config.gradient.colors];
                                        while (colors.length < count) colors.push('#71b0ff');
                                        while (colors.length > count) colors.pop();
                                        updateGradient({ colors });
                                    }}
                                    className="w-full mt-1"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {config.gradient.colors.map((color, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={e => {
                                                const colors = [...config.gradient.colors];
                                                colors[i] = e.target.value;
                                                updateGradient({ colors });
                                            }}
                                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                        />
                                        <span className="text-[10px] text-white/40">#{i + 1}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 流动速度 */}
                            <div>
                                <label className="text-xs font-medium text-white/60">
                                    流动速度: {config.gradient.flowSpeed}
                                </label>
                                <input
                                    type="range"
                                    min="1" max="10"
                                    value={config.gradient.flowSpeed}
                                    onChange={e => updateGradient({ flowSpeed: parseInt(e.target.value) })}
                                    className="w-full mt-1"
                                />
                            </div>

                            {/* 饱和度 & 亮度 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-white/60">
                                        饱和度: {config.gradient.saturation}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0" max="200"
                                        value={config.gradient.saturation}
                                        onChange={e => updateGradient({ saturation: parseInt(e.target.value) })}
                                        className="w-full mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-white/60">
                                        亮度: {config.gradient.brightness}%
                                    </label>
                                    <input
                                        type="range"
                                        min="50" max="150"
                                        value={config.gradient.brightness}
                                        onChange={e => updateGradient({ brightness: parseInt(e.target.value) })}
                                        className="w-full mt-1"
                                    />
                                </div>
                            </div>

                            {/* 发光效果 */}
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-white/60">发光效果</label>
                                <button
                                    onClick={() => updateGradient({ glow: { ...config.gradient.glow, enabled: !config.gradient.glow.enabled } })}
                                    className={`w-10 h-5 rounded-full transition-all ${!config.gradient.glow.enabled ? 'bg-white/20' : 'bg-cyan-500'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${config.gradient.glow.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            {config.gradient.glow.enabled && (
                                <div>
                                    <label className="text-xs text-white/40">
                                        发光强度: {config.gradient.glow.intensity}px
                                    </label>
                                    <input
                                        type="range"
                                        min="0" max="20"
                                        value={config.gradient.glow.intensity}
                                        onChange={e => updateGradient({ glow: { ...config.gradient.glow, intensity: parseInt(e.target.value) } })}
                                        className="w-full mt-1"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 对话栏设置 Tab */}
                    {activeTab === 'chat' && (
                        <div className="space-y-5">
                            {/* 输入框光晕设置 */}
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-sm font-medium text-white/80 mb-3">输入框光晕</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-white/50">光晕颜色</label>
                                        <div className="flex gap-2 mt-1">
                                            {config.inputGlow.colors.map((color, i) => (
                                                <input
                                                    key={i}
                                                    type="color"
                                                    value={color}
                                                    onChange={e => {
                                                        const newColors = [...config.inputGlow.colors];
                                                        newColors[i] = e.target.value;
                                                        updateInputGlow({ colors: newColors });
                                                    }}
                                                    className="w-8 h-8 rounded cursor-pointer border-0"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50">动画速度: {config.inputGlow.speed}s</label>
                                        <input
                                            type="range"
                                            min="2" max="12"
                                            value={config.inputGlow.speed}
                                            onChange={e => updateInputGlow({ speed: parseInt(e.target.value) })}
                                            className="w-full mt-1"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-white/50">粗光晕模糊: {config.inputGlow.thickBlur}px</label>
                                            <input
                                                type="range"
                                                min="4" max="24"
                                                value={config.inputGlow.thickBlur}
                                                onChange={e => updateInputGlow({ thickBlur: parseInt(e.target.value) })}
                                                className="w-full mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50">粗光晕强度: {Math.round(config.inputGlow.thickOpacity * 100)}%</label>
                                            <input
                                                type="range"
                                                min="5" max="50"
                                                value={config.inputGlow.thickOpacity * 100}
                                                onChange={e => updateInputGlow({ thickOpacity: parseInt(e.target.value) / 100 })}
                                                className="w-full mt-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 保存状态 */}
                            {isSaving && (
                                <div className="text-center text-xs text-white/40">正在保存...</div>
                            )}
                        </div>
                    )}
                </div>

                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>
        </div>,
        document.body
    );
};

export default XingSparkSettings;
