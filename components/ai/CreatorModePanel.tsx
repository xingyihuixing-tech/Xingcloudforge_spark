/**
 * XingForge AI - Creator Mode Panel
 * 
 * input: onAddPlanet callback, chat model
 * output: 简化的模块选择 + 描述输入 + API 调用 UI
 * pos: 创造模式的核心 UI，与 api/ai/create.ts 匹配
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useCallback } from 'react';
import { EffectType, EFFECT_INFO } from '../../utils/ai/schemaBuilder';
import { AIPatch } from '../../utils/ai/configValidator';
import { applyEffectPatchToPlanet } from '../../utils/ai/patchApplier';
import { createDefaultPlanet } from '../../constants';
import type { PlanetSettings } from '../../types';

// ============================================
// 类型定义
// ============================================

interface CreatorModePanelProps {
    onAddPlanet: (planet: PlanetSettings) => void;
    chatModel: string;
}

interface GenerationResult {
    success: boolean;
    patch?: AIPatch;
    warnings?: string[];
    errors?: string[];
    message?: string;
}

// 阶段 1 支持的模块
const PHASE1_MODULES: EffectType[] = ['particleCore', 'energyBody'];

// 所有模块（用于显示）
const ALL_MODULES: EffectType[] = [
    'particleCore', 'solidCore', 'energyCore', 'energyBody',
    'particleRing', 'ringBelt', 'spiralRing',
    'particleOrbit', 'particleJet',
    'rotatingFirefly', 'wanderingFirefly'
];

// energyBody 渲染模式选项
const RENDER_MODES = [
    { value: 'wireframe', label: '线框' },
    { value: 'shell', label: '薄壳' },
    { value: 'both', label: '两者' }
];

// ============================================
// 主组件
// ============================================

export const CreatorModePanel: React.FC<CreatorModePanelProps> = ({
    onAddPlanet,
    chatModel
}) => {
    // 模块选择状态
    const [selectedModules, setSelectedModules] = useState<Set<EffectType>>(new Set(['particleCore']));

    // 模式状态
    const [energyBodyRenderMode, setEnergyBodyRenderMode] = useState<string>('wireframe');

    // 输入状态
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // 结果状态
    const [result, setResult] = useState<GenerationResult | null>(null);

    // 切换模块选择
    const toggleModule = useCallback((effectType: EffectType) => {
        // 只允许切换阶段1支持的模块
        if (!PHASE1_MODULES.includes(effectType)) return;

        setSelectedModules(prev => {
            const next = new Set(prev);
            if (next.has(effectType)) {
                next.delete(effectType);
            } else {
                next.add(effectType);
            }
            return next;
        });
    }, []);

    // 生成配置
    const handleGenerate = useCallback(async () => {
        if (selectedModules.size === 0) {
            setResult({ success: false, errors: ['请至少选择一个模块'] });
            return;
        }

        if (!description.trim()) {
            setResult({ success: false, errors: ['请输入描述'] });
            return;
        }

        setIsGenerating(true);
        setResult(null);

        try {
            // 构建模式配置
            const modes: Record<string, any> = {};
            if (selectedModules.has('energyBody')) {
                modes.energyBody = { renderMode: energyBodyRenderMode };
            }

            const response = await fetch('/api/ai/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedModules: Array.from(selectedModules),
                    modes,
                    description: description.trim(),
                    model: chatModel
                })
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    patch: data.patch,
                    warnings: data.warnings || []
                });
            } else {
                setResult({
                    success: false,
                    errors: data.errors || [data.error || '生成失败'],
                    warnings: data.warnings || [],
                    message: data.message
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                errors: [error.message || '网络错误']
            });
        } finally {
            setIsGenerating(false);
        }
    }, [selectedModules, description, energyBodyRenderMode, chatModel]);

    // 应用配置（创建新星球）
    const handleApply = useCallback(() => {
        if (!result?.patch) return;

        // 创建新星球
        const planetId = `ai-planet-${Date.now()}`;
        const basePlanet = createDefaultPlanet(planetId, `AI星球 ${new Date().toLocaleTimeString()}`);

        // 应用 AI 生成的配置
        const configuredPlanet = applyEffectPatchToPlanet(basePlanet, result.patch);

        // 添加到场景
        onAddPlanet(configuredPlanet);

        // 清空结果
        setResult(null);
        setDescription('');
    }, [result, onAddPlanet]);

    return (
        <div className="space-y-3">
            {/* 模块选择 */}
            <div className="p-3 bg-black/30 rounded-lg">
                <div className="text-sm text-white/70 mb-2">选择效果模块:</div>
                <div className="space-y-1">
                    {ALL_MODULES.map(effectType => {
                        const info = EFFECT_INFO[effectType];
                        const isSupported = PHASE1_MODULES.includes(effectType);
                        const isSelected = selectedModules.has(effectType);

                        return (
                            <div key={effectType} className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleModule(effectType)}
                                    disabled={!isSupported}
                                    className="w-4 h-4 accent-blue-500"
                                />
                                <span className={`text-lg ${isSupported ? '' : 'opacity-40'}`}>
                                    {info.icon}
                                </span>
                                <span className={`text-sm ${isSupported ? 'text-white/80' : 'text-white/40'}`}>
                                    {info.name}
                                    {!isSupported && <span className="text-xs ml-1">(即将支持)</span>}
                                </span>

                                {/* energyBody 渲染模式选择 */}
                                {effectType === 'energyBody' && isSelected && (
                                    <select
                                        value={energyBodyRenderMode}
                                        onChange={e => setEnergyBodyRenderMode(e.target.value)}
                                        className="ml-auto bg-white/10 text-white/80 text-xs rounded px-2 py-1 border border-white/20"
                                    >
                                        {RENDER_MODES.map(mode => (
                                            <option key={mode.value} value={mode.value}>
                                                {mode.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 描述输入 */}
            <div className="p-3 bg-black/30 rounded-lg">
                <div className="text-sm text-white/70 mb-2">描述你想要的效果:</div>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="例如：科幻风格的蓝色能量体，带有线框效果..."
                    className="w-full bg-white/10 text-white/90 text-sm rounded-lg px-3 py-2 border border-white/20 resize-none h-20"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || selectedModules.size === 0}
                    className={`w-full mt-2 py-2 rounded-lg text-sm font-medium transition-colors ${isGenerating || selectedModules.size === 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
                        }`}
                >
                    {isGenerating ? '⏳ 生成中...' : '✨ 生成星球配置'}
                </button>
            </div>

            {/* 结果显示 */}
            {result && (
                <div className={`p-3 rounded-lg ${result.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {result.success ? (
                        <>
                            <div className="text-green-300 text-sm mb-2">
                                ✓ 配置生成成功
                                {result.warnings && result.warnings.length > 0 && (
                                    <span className="text-yellow-300 ml-2">
                                        ({result.warnings.length} 个警告)
                                    </span>
                                )}
                            </div>

                            {/* 显示警告 */}
                            {result.warnings && result.warnings.length > 0 && (
                                <div className="text-xs text-yellow-300/80 mb-2 max-h-20 overflow-y-auto">
                                    {result.warnings.map((w, i) => (
                                        <div key={i}>• {w}</div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={handleApply}
                                className="w-full py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                                🚀 添加到场景
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-red-300 text-sm mb-1">
                                ✗ 生成失败
                            </div>
                            <div className="text-xs text-red-300/80">
                                {result.errors?.map((e, i) => (
                                    <div key={i}>• {e}</div>
                                ))}
                                {result.message && <div className="mt-1 text-white/50">{result.message}</div>}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default CreatorModePanel;
