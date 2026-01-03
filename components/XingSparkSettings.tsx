/**
 * XingSpark Settings Components
 * 
 * input: config, setConfig, activeTab
 * output: XingSpark 设置内容 UI (Logo风格/颜色/对话栏设置)
 * pos: AI 系统的品牌设置组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useCallback } from 'react';

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

export interface XingSparkConfig {
    font: string;
    gradient: LogoGradientConfig;
    inputGlow: InputGlowConfig;
    theme: ThemeConfig;
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
// 内嵌设置内容组件
// ============================================

interface XingSparkSettingsContentProps {
    activeTab: 'style' | 'color' | 'chat';
    config: XingSparkConfig;
    setConfig: React.Dispatch<React.SetStateAction<XingSparkConfig>>;
}

export const XingSparkSettingsContent: React.FC<XingSparkSettingsContentProps> = ({
    activeTab,
    config,
    setConfig
}) => {
    // 安全获取配置 (防止云端旧配置缺少新字段)
    const theme = config.theme ?? DEFAULT_XING_CONFIG.theme;
    const inputGlow = config.inputGlow ?? DEFAULT_XING_CONFIG.inputGlow;
    const gradient = config.gradient ?? DEFAULT_XING_CONFIG.gradient;

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

    return (
        <div className="space-y-4">
            {/* Logo 风格 Tab */}
            {activeTab === 'style' && (
                <div className="grid grid-cols-5 gap-2">
                    {FONT_OPTIONS.map(font => {
                        const isSelected = config.font === font.name;
                        return (
                            <button
                                key={font.name}
                                onClick={() => setConfig(prev => ({ ...prev, font: font.name }))}
                                className={`p-2 rounded-lg transition-all hover:scale-[1.02] bg-white/5 hover:bg-white/10`}
                                style={{
                                    border: isSelected ? `2px solid ${gradient.colors[0]}` : '1px solid rgba(100,116,139,0.2)',
                                    boxShadow: isSelected ? `0 0 12px ${gradient.colors[0]}40` : 'none'
                                }}
                            >
                                <div
                                    className="text-center"
                                    style={{
                                        fontFamily: `'${font.name}', cursive`,
                                        fontSize: '1rem',
                                        background: `conic-gradient(from 0deg at 50% 50%, ${[...gradient.colors, gradient.colors[0]].join(', ')})`,
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        color: 'transparent',
                                        lineHeight: '1.5',
                                    }}
                                >
                                    XS
                                </div>
                                <div className="text-[8px] text-center text-white/40 mt-1 truncate">{font.label}</div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Logo 颜色 Tab */}
            {activeTab === 'color' && (
                <div className="space-y-3">
                    {/* 渐变预设 */}
                    <div className="grid grid-cols-8 gap-1">
                        {GRADIENT_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => updateGradient({ colors: [...preset.colors] })}
                                className="p-1 rounded transition-all hover:scale-105"
                                title={preset.name}
                            >
                                <div
                                    className="w-full h-4 rounded"
                                    style={{ background: `linear-gradient(90deg, ${preset.colors.join(', ')})` }}
                                />
                            </button>
                        ))}
                    </div>

                    {/* 颜色选择器 */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">颜色:</span>
                        {gradient.colors.map((color, i) => (
                            <input
                                key={i}
                                type="color"
                                value={color}
                                onChange={e => {
                                    const colors = [...gradient.colors];
                                    colors[i] = e.target.value;
                                    updateGradient({ colors });
                                }}
                                className="w-6 h-6 rounded cursor-pointer border-0"
                            />
                        ))}
                    </div>

                    {/* 饱和度 & 亮度 */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-white/50">饱和度: {gradient.saturation}%</label>
                            <input
                                type="range" min="0" max="200"
                                value={gradient.saturation}
                                onChange={e => updateGradient({ saturation: parseInt(e.target.value) })}
                                className="w-full h-1"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-white/50">亮度: {gradient.brightness}%</label>
                            <input
                                type="range" min="50" max="150"
                                value={gradient.brightness}
                                onChange={e => updateGradient({ brightness: parseInt(e.target.value) })}
                                className="w-full h-1"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 对话栏设置 Tab */}
            {activeTab === 'chat' && (
                <div className="space-y-4">
                    {/* 对话字体 */}
                    <div>
                        <label className="text-xs text-white/60 mb-2 block">消息气泡字体</label>
                        <div className="flex gap-2">
                            {CHAT_FONT_OPTIONS.map(font => (
                                <button
                                    key={font.id}
                                    onClick={() => updateTheme({ chatFont: font.id })}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${theme.chatFont === font.id
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
                    <div>
                        <label className="text-xs text-white/60">字体大小: {theme.chatFontSize}px</label>
                        <input
                            type="range" min="12" max="20"
                            value={theme.chatFontSize}
                            onChange={e => updateTheme({ chatFontSize: parseInt(e.target.value) })}
                            className="w-full h-1 mt-1"
                        />
                    </div>

                    {/* 输入框光晕 */}
                    <div>
                        <label className="text-xs text-white/60 mb-2 block">输入框边框光晕</label>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40">颜色:</span>
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
                                    className="w-5 h-5 rounded cursor-pointer border-0"
                                />
                            ))}
                        </div>
                    </div>

                    {/* 光晕参数 */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-white/50">速度: {inputGlow.speed}s</label>
                            <input
                                type="range" min="2" max="12"
                                value={inputGlow.speed}
                                onChange={e => updateInputGlow({ speed: parseInt(e.target.value) })}
                                className="w-full h-1"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-white/50">模糊: {inputGlow.thickBlur}px</label>
                            <input
                                type="range" min="4" max="24"
                                value={inputGlow.thickBlur}
                                onChange={e => updateInputGlow({ thickBlur: parseInt(e.target.value) })}
                                className="w-full h-1"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default XingSparkSettingsContent;
