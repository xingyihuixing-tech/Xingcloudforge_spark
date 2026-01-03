/**
 * XingSpark Settings Components (完整参考项目实现)
 * 
 * input: config, setConfig, activeTab, onBack
 * output: XingSpark 设置内容 UI (Logo风格/颜色/对话栏设置)
 * pos: AI 系统的品牌设置组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useCallback, useState } from 'react';
import { Palette, ChevronDown, X } from 'lucide-react';

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

export interface ThemeConfig {
    chatFont: string;
    chatFontSize: number;
}

// 用户消息气泡配置 (参考 AISidebar.tsx 6282-6366)
export interface UserMsgConfig {
    colors: string[];       // 4色渐变
    angle: number;          // 0-360°
    speed: number;          // 动画速度 2-12s
    lightOpacity: number;   // 浅色透明度 0.05-0.5
    darkOpacity: number;    // 深色透明度 0.1-0.6
    borderColor: string;    // 边框颜色 hex
}

export interface XingSparkConfig {
    font: string;
    gradient: LogoGradientConfig;
    inputGlow: InputGlowConfig;
    theme: ThemeConfig;
    userMsg: UserMsgConfig;
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
    },
    theme: {
        chatFont: 'default',
        chatFontSize: 14
    },
    userMsg: {
        colors: ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2'],
        angle: 135,
        speed: 6,
        lightOpacity: 0.15,
        darkOpacity: 0.25,
        borderColor: '#71b0ff'
    }
};

// 10种字体选项 (完全匹配参考项目)
const FONT_OPTIONS = [
    { name: 'Pacifico', label: '活泼手写', size: '1.4rem' },
    { name: 'Great Vibes', label: '经典书法', size: '1.8rem' },
    { name: 'Dancing Script', label: '律动连笔', size: '1.6rem' },
    { name: 'Sacramento', label: '极细现代', size: '2rem' },
    { name: 'Pinyon Script', label: '华丽典雅', size: '1.8rem' },
    { name: 'Herr Von Muellerhoff', label: '极致线稿', size: '2.2rem' },
    { name: 'Parisienne', label: '浪漫法式', size: '1.6rem' },
    { name: 'Clicker Script', label: '俏皮跳跃', size: '1.8rem' },
    { name: 'Monsieur La Doulaise', label: '复古雕花', size: '2rem' },
    { name: 'Allura', label: '丝滑柔顺', size: '2rem' },
];

// 对话字体选项
const CHAT_FONT_OPTIONS = [
    { id: 'default', name: '默认', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif' },
    { id: 'kaiti', name: '楷体', family: '"Kaiti SC", "Kaiti TC", "DFKai-SB", "KaiTi", "楷体", "STKaiti", "华文楷体", serif' },
    { id: 'xingkai', name: '行楷', family: '"Xingkai SC", "STXingkai", "行楷", "华文行楷", "Kaiti SC", cursive' },
    { id: 'songti', name: '宋体', family: '"Songti SC", "Songti TC", "STSong", "SimSun", "宋体", "Noto Serif SC", serif' },
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

// 导出字体选项供消息渲染使用
export { CHAT_FONT_OPTIONS };

// ============================================
// 完整设置面板组件 (内嵌在 AI 面板中)
// ============================================

interface XingSparkSettingsPanelProps {
    config: XingSparkConfig;
    setConfig: React.Dispatch<React.SetStateAction<XingSparkConfig>>;
    onBack: () => void;
}

export const XingSparkSettingsPanel: React.FC<XingSparkSettingsPanelProps> = ({
    config,
    setConfig,
    onBack
}) => {
    const [activeTab, setActiveTab] = useState<'style' | 'color' | 'chat'>('style');
    // 渐变预设折叠状态
    const [gradientPresetsExpanded, setGradientPresetsExpanded] = useState(false);
    // 预设保存弹窗状态
    const [showPresetDialog, setShowPresetDialog] = useState<'save' | 'update' | null>(null);
    const [presetEditName, setPresetEditName] = useState('');

    // 安全获取配置 (防止云端旧配置缺少新字段)
    const theme = config.theme ?? DEFAULT_XING_CONFIG.theme;
    const inputGlow = config.inputGlow ?? DEFAULT_XING_CONFIG.inputGlow;
    const gradient = config.gradient ?? DEFAULT_XING_CONFIG.gradient;
    const userMsg = config.userMsg ?? DEFAULT_XING_CONFIG.userMsg;

    // 匹配当前颜色的预设
    const currentPreset = GRADIENT_PRESETS.find(p =>
        p.colors.length === gradient.colors.length &&
        p.colors.every((c, i) => c.toLowerCase() === gradient.colors[i].toLowerCase())
    );

    // 颜色数组归一化 (确保至少 4 个颜色点)
    const normalizeColors = (colors: string[]): string[] => {
        if (colors.length >= 4) return colors;
        const result = [...colors];
        while (result.length < 4) {
            result.push(result[result.length - 1]);
        }
        return result;
    };

    // 更新渐变配置
    const updateGradient = useCallback((updates: Partial<LogoGradientConfig>) => {
        setConfig(prev => ({ ...prev, gradient: { ...DEFAULT_XING_CONFIG.gradient, ...prev.gradient, ...updates } }));
    }, [setConfig]);

    // 更新输入框光晕配置
    const updateInputGlow = useCallback((updates: Partial<InputGlowConfig>) => {
        setConfig(prev => ({ ...prev, inputGlow: { ...DEFAULT_XING_CONFIG.inputGlow, ...prev.inputGlow, ...updates } }));
    }, [setConfig]);

    // 更新主题配置
    const updateTheme = useCallback((updates: Partial<ThemeConfig>) => {
        setConfig(prev => ({ ...prev, theme: { ...DEFAULT_XING_CONFIG.theme, ...prev.theme, ...updates } }));
    }, [setConfig]);

    // 更新用户消息气泡配置
    const updateUserMsg = useCallback((updates: Partial<UserMsgConfig>) => {
        setConfig(prev => ({ ...prev, userMsg: { ...DEFAULT_XING_CONFIG.userMsg, ...prev.userMsg, ...updates } }));
    }, [setConfig]);

    return (
        <div className="flex flex-col h-full">
            {/* Tab 头部 + 返回按钮 */}
            <div className="flex items-center border-b border-white/10">
                {/* 返回按钮 */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 px-3 py-2.5 text-white/40 hover:text-white/80 transition-colors"
                    title="返回对话"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Tab 按钮 */}
                {[
                    { id: 'style' as const, label: 'Logo 风格' },
                    { id: 'color' as const, label: 'Logo 颜色' },
                    { id: 'chat' as const, label: '对话栏设置' },
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2.5 px-4 text-xs font-medium transition-all ${isActive ? '' : 'text-white/50 hover:text-white/80'
                                }`}
                            style={isActive ? {
                                color: gradient.colors[0],
                                borderBottom: `2px solid ${gradient.colors[0]}`,
                                boxShadow: `0 2px 8px ${gradient.colors[0]}40`,
                            } : undefined}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* ========== Logo 风格 Tab ========== */}
                {activeTab === 'style' && (
                    <div className="space-y-4">
                        {/* 实时预览 */}
                        <div className="flex justify-center py-4">
                            <span
                                style={{
                                    fontFamily: `'${config.font}', cursive`,
                                    fontSize: '2rem',
                                    background: `conic-gradient(from 0deg at 50% 50%, ${[...gradient.colors, gradient.colors[0]].join(', ')})`,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                    filter: `saturate(${gradient.saturation}%) brightness(${gradient.brightness}%)`,
                                    textShadow: gradient.glow.enabled ? `0 0 ${gradient.glow.intensity}px ${gradient.colors[0]}` : 'none',
                                }}
                            >
                                <span style={{ fontSize: '1em' }}>X</span>
                                <span style={{ fontSize: '0.9em' }}>ing</span>
                                <span style={{ fontSize: '1.25em', marginLeft: '-0.05em' }}>S</span>
                                <span style={{ fontSize: '0.9em' }}>park</span>
                            </span>
                        </div>

                        {/* 10种字体 - 2列2列网格 (参考项目样式) */}
                        <div className="grid grid-cols-2 gap-3">
                            {FONT_OPTIONS.map(font => {
                                const isSelected = config.font === font.name;
                                return (
                                    <button
                                        key={font.name}
                                        onClick={() => setConfig(prev => ({ ...prev, font: font.name }))}
                                        className="p-4 rounded-xl transition-all hover:scale-[1.02] bg-white/5 hover:bg-white/10"
                                        style={{
                                            border: isSelected ? `2px solid ${gradient.colors[0]}` : '1px solid rgba(100,116,139,0.2)',
                                            boxShadow: isSelected ? `0 0 16px ${gradient.colors[0]}40, 0 0 24px ${gradient.colors[1] || gradient.colors[0]}20` : 'none'
                                        }}
                                    >
                                        <div
                                            className="text-center mb-2"
                                            style={{
                                                fontFamily: `'${font.name}', cursive`,
                                                fontSize: font.size,
                                                background: `conic-gradient(from 0deg at 50% 50%, ${[...gradient.colors, gradient.colors[0]].join(', ')})`,
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
                    </div>
                )}

                {/* ========== Logo 颜色 Tab ========== */}
                {activeTab === 'color' && (
                    <div className="space-y-4">
                        {/* 实时预览 */}
                        <div className="flex justify-center py-3 rounded-xl bg-white/5">
                            <span
                                style={{
                                    fontFamily: `'${config.font}', cursive`,
                                    fontSize: '2rem',
                                    background: `conic-gradient(from 0deg at 50% 50%, ${[...gradient.colors, gradient.colors[0]].join(', ')})`,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                    filter: `saturate(${gradient.saturation}%) brightness(${gradient.brightness}%)`,
                                }}
                            >
                                XingSpark
                            </span>
                        </div>

                        {/* 渐变预设 - 可折叠列表 */}
                        <div className="rounded-xl border border-slate-700 bg-slate-800/30">
                            <button
                                onClick={() => setGradientPresetsExpanded(!gradientPresetsExpanded)}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700/50 rounded-xl transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Palette size={14} />
                                    渐变预设 · <span className="text-xs opacity-70">{currentPreset?.name || '自定义'}</span>
                                </span>
                                <ChevronDown size={16} className={`transition-transform ${gradientPresetsExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {gradientPresetsExpanded && (
                                <div className="px-3 pb-3 space-y-3">
                                    <div className="grid grid-cols-4 gap-2">
                                        {GRADIENT_PRESETS.map(preset => {
                                            const isActive = currentPreset?.id === preset.id;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => updateGradient({ colors: [...preset.colors] })}
                                                    className={`w-full p-2 rounded-lg text-center transition-all hover:scale-105 hover:bg-slate-700 ${isActive ? 'ring-2 ring-blue-400' : ''}`}
                                                    title={preset.name}
                                                >
                                                    <div className="w-full h-6 rounded-md mb-1" style={{ background: `linear-gradient(90deg, ${preset.colors.join(', ')})` }} />
                                                    <span className="text-[10px] text-slate-400">{preset.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex gap-2 pt-2">
                                        {currentPreset && (
                                            <button
                                                onClick={() => setShowPresetDialog('update')}
                                                className="flex-1 py-2 text-xs rounded-lg transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600"
                                            >
                                                保存到「{currentPreset.name}」
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setPresetEditName(''); setShowPresetDialog('save'); }}
                                            className="flex-1 py-2 text-xs rounded-lg border-dashed border-2 transition-colors border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                                        >
                                            + 保存为新预设
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 预设保存弹窗 */}
                        {showPresetDialog && (
                            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPresetDialog(null)}>
                                <div
                                    className="rounded-2xl p-5 w-[320px]"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                                        backdropFilter: 'blur(24px)',
                                        WebkitBackdropFilter: 'blur(24px)',
                                        border: '1px solid rgba(100, 116, 139, 0.3)',
                                        boxShadow: '0 24px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset'
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-base font-semibold text-slate-200">
                                            {showPresetDialog === 'save' ? '保存新预设' : `保存到「${currentPreset?.name}」`}
                                        </h3>
                                        <button onClick={() => setShowPresetDialog(null)} className="text-slate-400 hover:text-white">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* 预览 */}
                                    <div className="w-full h-8 rounded-lg mb-4" style={{ background: `linear-gradient(90deg, ${gradient.colors.join(', ')})` }} />

                                    {showPresetDialog === 'save' && (
                                        <input
                                            type="text"
                                            value={presetEditName}
                                            onChange={e => setPresetEditName(e.target.value)}
                                            placeholder="请输入预设名称"
                                            className="w-full px-3 py-2 rounded-lg text-sm mb-4 bg-slate-800 text-slate-200 border-slate-600 border focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            autoFocus
                                        />
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowPresetDialog(null)}
                                            className="flex-1 py-2 text-sm rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={() => {
                                                // TODO: 保存到云端
                                                console.log('保存预设:', showPresetDialog === 'save' ? presetEditName : currentPreset?.name, gradient.colors);
                                                setShowPresetDialog(null);
                                            }}
                                            disabled={showPresetDialog === 'save' && !presetEditName.trim()}
                                            className="flex-1 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            确认保存
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 颜色数量 */}
                        <div>
                            <label className="text-xs text-white/60">颜色数量: {gradient.colors.length}</label>
                            <input
                                type="range" min="2" max="5"
                                value={gradient.colors.length}
                                onChange={e => {
                                    const count = parseInt(e.target.value);
                                    const colors = [...gradient.colors];
                                    while (colors.length < count) colors.push('#71b0ff');
                                    while (colors.length > count) colors.pop();
                                    updateGradient({ colors });
                                }}
                                className="w-full h-1 mt-1"
                            />
                        </div>

                        {/* 颜色选择器 */}
                        <div className="flex flex-wrap gap-2">
                            {gradient.colors.map((color, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => {
                                            const colors = [...gradient.colors];
                                            colors[i] = e.target.value;
                                            updateGradient({ colors });
                                        }}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <span className="text-[10px] text-white/40">#{i + 1}</span>
                                </div>
                            ))}
                        </div>

                        {/* 渐变类型 - 玻璃风格按钮 */}
                        <div>
                            <label className="text-xs font-medium text-slate-300">渐变类型</label>
                            <div className="flex gap-2 mt-1">
                                {(['conic', 'linear', 'radial'] as const).map(type => {
                                    const gradientColors = gradient.colors;
                                    const isActive = gradient.type === type;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => updateGradient({ type })}
                                            className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105"
                                            style={isActive ? {
                                                background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
                                                color: 'white',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                boxShadow: `0 4px 12px ${gradientColors[0]}50, inset 0 1px 0 rgba(255,255,255,0.3)`,
                                                border: '1px solid rgba(255,255,255,0.2)',
                                            } : {
                                                background: 'linear-gradient(135deg, rgba(51,65,85,0.6) 0%, rgba(30,41,59,0.8) 100%)',
                                                backdropFilter: 'blur(8px)',
                                                color: '#cbd5e1',
                                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.1)',
                                                border: '1px solid rgba(100,116,139,0.3)',
                                            }}
                                        >
                                            {type === 'conic' ? '漩涡' : type === 'linear' ? '线性' : '放射'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 流动方式 - 玻璃风格按钮 */}
                        <div>
                            <label className="text-xs font-medium text-slate-300">流动方式</label>
                            <div className="flex gap-2 mt-1">
                                {(['vortex', 'wave'] as const).map(flowType => {
                                    const gradientColors = gradient.colors;
                                    const isActive = gradient.flowType === flowType;
                                    return (
                                        <button
                                            key={flowType}
                                            onClick={() => updateGradient({ flowType })}
                                            className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105"
                                            style={isActive ? {
                                                background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
                                                color: 'white',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                boxShadow: `0 4px 12px ${gradientColors[0]}50, inset 0 1px 0 rgba(255,255,255,0.3)`,
                                                border: '1px solid rgba(255,255,255,0.2)',
                                            } : {
                                                background: 'linear-gradient(135deg, rgba(51,65,85,0.6) 0%, rgba(30,41,59,0.8) 100%)',
                                                backdropFilter: 'blur(8px)',
                                                color: '#cbd5e1',
                                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.1)',
                                                border: '1px solid rgba(100,116,139,0.3)',
                                            }}
                                        >
                                            {flowType === 'vortex' ? '漩涡' : '波浪'}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => updateGradient({ flowDirection: gradient.flowDirection === 'cw' ? 'ccw' : 'cw' })}
                                    className="px-3 py-1.5 text-xs rounded-lg transition-all hover:scale-105"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(51,65,85,0.6) 0%, rgba(30,41,59,0.8) 100%)',
                                        backdropFilter: 'blur(8px)',
                                        color: '#cbd5e1',
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.1)',
                                        border: '1px solid rgba(100,116,139,0.3)',
                                    }}
                                >
                                    {gradient.flowDirection === 'cw' ? '顺时针' : '逆时针'}
                                </button>
                            </div>
                        </div>

                        {/* 速度、轨道范围 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/60">流动速度: {gradient.flowSpeed}</label>
                                <input
                                    type="range" min="1" max="10"
                                    value={gradient.flowSpeed}
                                    onChange={e => updateGradient({ flowSpeed: parseInt(e.target.value) })}
                                    className="w-full h-1 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60">轨道范围: {gradient.orbitRange}%</label>
                                <input
                                    type="range" min="20" max="80"
                                    value={gradient.orbitRange}
                                    onChange={e => updateGradient({ orbitRange: parseInt(e.target.value) })}
                                    className="w-full h-1 mt-1"
                                />
                            </div>
                        </div>

                        {/* 饱和度 & 亮度 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/60">饱和度: {gradient.saturation}%</label>
                                <input
                                    type="range" min="0" max="200"
                                    value={gradient.saturation}
                                    onChange={e => updateGradient({ saturation: parseInt(e.target.value) })}
                                    className="w-full h-1 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-white/60">亮度: {gradient.brightness}%</label>
                                <input
                                    type="range" min="50" max="150"
                                    value={gradient.brightness}
                                    onChange={e => updateGradient({ brightness: parseInt(e.target.value) })}
                                    className="w-full h-1 mt-1"
                                />
                            </div>
                        </div>

                        {/* 发光效果 */}
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-white/60">发光效果</label>
                            <button
                                onClick={() => updateGradient({ glow: { ...gradient.glow, enabled: !gradient.glow.enabled } })}
                                className={`w-10 h-5 rounded-full transition-all ${!gradient.glow.enabled ? 'bg-white/20' : 'bg-cyan-500'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${gradient.glow.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {gradient.glow.enabled && (
                            <div>
                                <label className="text-xs text-white/40">发光强度: {gradient.glow.intensity}px</label>
                                <input
                                    type="range" min="0" max="20"
                                    value={gradient.glow.intensity}
                                    onChange={e => updateGradient({ glow: { ...gradient.glow, intensity: parseInt(e.target.value) } })}
                                    className="w-full h-1 mt-1"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ========== 对话栏设置 Tab ========== */}
                {activeTab === 'chat' && (
                    <div className="space-y-5">
                        {/* 对话字体 */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <h3 className="text-sm font-medium text-white/80 mb-3">消息气泡字体</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {CHAT_FONT_OPTIONS.map(font => (
                                    <button
                                        key={font.id}
                                        onClick={() => updateTheme({ chatFont: font.id })}
                                        className={`px-3 py-2.5 text-sm rounded-lg transition-all ${theme.chatFont === font.id
                                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                                            : 'text-white/50 hover:text-white/80 bg-white/5 border border-transparent'
                                            }`}
                                        style={{ fontFamily: font.family }}
                                    >
                                        {font.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 字体大小 */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <h3 className="text-sm font-medium text-white/80 mb-3">字体大小: {theme.chatFontSize}px</h3>
                            <input
                                type="range" min="12" max="20"
                                value={theme.chatFontSize}
                                onChange={e => updateTheme({ chatFontSize: parseInt(e.target.value) })}
                                className="w-full h-2"
                            />
                            <div className="flex justify-between text-[10px] text-white/40 mt-1">
                                <span>12px</span>
                                <span>14px</span>
                                <span>16px</span>
                                <span>18px</span>
                                <span>20px</span>
                            </div>
                        </div>

                        {/* 输入框光晕 */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <h3 className="text-sm font-medium text-white/80 mb-3">输入框边框光晕</h3>
                            <div className="space-y-3">
                                {/* 光晕颜色 */}
                                <div>
                                    <label className="text-xs text-white/50 mb-2 block">光晕颜色</label>
                                    <div className="flex gap-2">
                                        {inputGlow.colors.map((color, i) => (
                                            <input
                                                key={i}
                                                type="color"
                                                value={color}
                                                onChange={e => {
                                                    const newColors = [...inputGlow.colors];
                                                    newColors[i] = e.target.value;
                                                    updateInputGlow({ colors: newColors });
                                                }}
                                                className="w-8 h-8 rounded cursor-pointer border-0"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* 动画速度 */}
                                <div>
                                    <label className="text-xs text-white/50">动画速度: {inputGlow.speed}s</label>
                                    <input
                                        type="range" min="2" max="12"
                                        value={inputGlow.speed}
                                        onChange={e => updateInputGlow({ speed: parseInt(e.target.value) })}
                                        className="w-full h-1 mt-1"
                                    />
                                </div>

                                {/* 模糊度 & 透明度 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-white/50">粗光晕模糊: {inputGlow.thickBlur}px</label>
                                        <input
                                            type="range" min="4" max="24"
                                            value={inputGlow.thickBlur}
                                            onChange={e => updateInputGlow({ thickBlur: parseInt(e.target.value) })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50">粗光晕强度: {Math.round(inputGlow.thickOpacity * 100)}%</label>
                                        <input
                                            type="range" min="5" max="50"
                                            value={inputGlow.thickOpacity * 100}
                                            onChange={e => updateInputGlow({ thickOpacity: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50">细光晕模糊: {inputGlow.thinBlur}px</label>
                                        <input
                                            type="range" min="2" max="12"
                                            value={inputGlow.thinBlur}
                                            onChange={e => updateInputGlow({ thinBlur: parseInt(e.target.value) })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50">细光晕强度: {Math.round(inputGlow.thinOpacity * 100)}%</label>
                                        <input
                                            type="range" min="5" max="30"
                                            value={inputGlow.thinOpacity * 100}
                                            onChange={e => updateInputGlow({ thinOpacity: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                </div>

                                {/* 边框透明度 */}
                                <div>
                                    <label className="text-xs text-white/50">边框透明度: {Math.round(inputGlow.borderOpacity * 100)}%</label>
                                    <input
                                        type="range" min="10" max="100"
                                        value={inputGlow.borderOpacity * 100}
                                        onChange={e => updateInputGlow({ borderOpacity: parseInt(e.target.value) / 100 })}
                                        className="w-full h-1 mt-1"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 用户消息气泡设置 */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <h3 className="text-sm font-medium text-white/80 mb-3">用户消息气泡</h3>
                            <div className="space-y-3">
                                {/* 渐变颜色 */}
                                <div>
                                    <label className="text-xs text-white/50 mb-2 block">渐变颜色</label>
                                    <div className="flex gap-2">
                                        {userMsg.colors.map((color, i) => (
                                            <input
                                                key={i}
                                                type="color"
                                                value={color}
                                                onChange={e => {
                                                    const newColors = [...userMsg.colors];
                                                    newColors[i] = e.target.value;
                                                    updateUserMsg({ colors: newColors });
                                                }}
                                                className="w-8 h-8 rounded cursor-pointer border-0"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* 渐变角度 */}
                                <div>
                                    <label className="text-xs text-white/50">渐变角度: {userMsg.angle}°</label>
                                    <input
                                        type="range" min="0" max="360"
                                        value={userMsg.angle}
                                        onChange={e => updateUserMsg({ angle: parseInt(e.target.value) })}
                                        className="w-full h-1 mt-1"
                                    />
                                </div>

                                {/* 动画速度 */}
                                <div>
                                    <label className="text-xs text-white/50">动画速度: {userMsg.speed}s</label>
                                    <input
                                        type="range" min="2" max="12"
                                        value={userMsg.speed}
                                        onChange={e => updateUserMsg({ speed: parseInt(e.target.value) })}
                                        className="w-full h-1 mt-1"
                                    />
                                </div>

                                {/* 透明度 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-white/50">浅色透明度: {Math.round(userMsg.lightOpacity * 100)}%</label>
                                        <input
                                            type="range" min="5" max="50"
                                            value={userMsg.lightOpacity * 100}
                                            onChange={e => updateUserMsg({ lightOpacity: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50">深色透明度: {Math.round(userMsg.darkOpacity * 100)}%</label>
                                        <input
                                            type="range" min="10" max="60"
                                            value={userMsg.darkOpacity * 100}
                                            onChange={e => updateUserMsg({ darkOpacity: parseInt(e.target.value) / 100 })}
                                            className="w-full h-1 mt-1"
                                        />
                                    </div>
                                </div>

                                {/* 边框颜色 */}
                                <div>
                                    <label className="text-xs text-white/50">边框颜色</label>
                                    <input
                                        type="color"
                                        value={userMsg.borderColor}
                                        onChange={e => updateUserMsg({ borderColor: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 mt-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// 保持向后兼容的默认导出
export default XingSparkSettingsPanel;

// 旧的 XingSparkSettingsContent 也保留 (用于其他地方引用)
export const XingSparkSettingsContent = XingSparkSettingsPanel;
