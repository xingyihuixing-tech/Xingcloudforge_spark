/**
 * XingForge AI - Creator Panel (简化版)
 * 
 * input: planetSettings, onAddPlanet callback
 * output: 创造星球的 UI，生成后直接添加新星球
 * pos: AI 创造模式的核心组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useCallback } from 'react';
import { PlanetSettings, PlanetSceneSettings, PlanetCoreSettings } from '../../types';
import { createDefaultPlanet, createDefaultCore } from '../../constants';
import { normalizePlanetSettings } from '../../utils/normalizePlanetSettings';

// ============================================
// 类型定义
// ============================================

type ModuleType = 'particleCore' | 'energyBody' | 'ring' | 'radiation' | 'firefly';

interface ModuleOption {
    id: ModuleType;
    name: string;
    icon: string;
    available: boolean;
}

const MODULES: ModuleOption[] = [
    { id: 'particleCore', name: '粒子核心', icon: '⚛️', available: true },
    { id: 'energyBody', name: '能量体', icon: '💠', available: false },
    { id: 'ring', name: '星环', icon: '💫', available: false },
    { id: 'radiation', name: '粒子辐射', icon: '✨', available: false },
    { id: 'firefly', name: '流萤', icon: '🔮', available: false },
];

interface CreatorPanelProps {
    planetSettings?: PlanetSceneSettings;
    onAddPlanet?: (planet: PlanetSettings) => void;
}

// ============================================
// 主组件
// ============================================

export const CreatorPanel: React.FC<CreatorPanelProps> = ({
    planetSettings,
    onAddPlanet
}) => {
    // 状态
    const [selectedModule, setSelectedModule] = useState<ModuleType>('particleCore');
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 生成并添加星球
    const handleGenerate = useCallback(async () => {
        if (!description.trim()) {
            setError('请输入效果描述');
            return;
        }

        if (!onAddPlanet) {
            setError('无法添加星球：缺少回调函数');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStatusMessage('正在生成配置...');

        try {
            // 调用 AI 创造 API
            const res = await fetch('/api/ai/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: description,
                    selectedModules: [selectedModule],
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || '生成失败');
            }

            setStatusMessage('正在创建星球...');

            // 创建新星球
            const newPlanetId = `ai-planet-${Date.now()}`;
            const newPlanetName = `AI星球 ${new Date().toLocaleTimeString()}`;

            // 基础星球
            let newPlanet = createDefaultPlanet(newPlanetId, newPlanetName);

            // 应用 AI 生成的配置
            if (data.patch && data.patch.effects) {
                for (const effect of data.patch.effects) {
                    if (effect.effectType === 'particleCore' && effect.instances) {
                        // 处理粒子核心
                        const cores: PlanetCoreSettings[] = [];
                        for (const inst of effect.instances) {
                            const coreId = `ai-core-${Date.now()}-${cores.length}`;
                            const defaultCore = createDefaultCore(coreId, inst.fields?.name || 'AI核心');

                            // 合并 AI 生成的字段
                            const mergedCore: PlanetCoreSettings = {
                                ...defaultCore,
                                enabled: true,
                            };

                            // 应用 AI 返回的字段
                            if (inst.fields) {
                                for (const [key, value] of Object.entries(inst.fields)) {
                                    if (key in mergedCore) {
                                        (mergedCore as any)[key] = value;
                                    }
                                }
                            }

                            cores.push(mergedCore);
                        }

                        if (cores.length > 0) {
                            newPlanet.coreSystem.cores = cores;
                            newPlanet.coreSystem.coresEnabled = true;
                        }
                    }
                }
            }

            // 规范化配置（确保所有字段完整）
            newPlanet = normalizePlanetSettings(newPlanet);

            // 添加到场景
            onAddPlanet(newPlanet);

            setStatusMessage(`✓ 已创建星球: ${newPlanetName}`);
            setDescription('');

            // 3秒后清除状态消息
            setTimeout(() => setStatusMessage(null), 3000);

        } catch (err: any) {
            console.error('Create error:', err);
            setError(err.message || '生成失败');
            setStatusMessage(null);
        } finally {
            setIsGenerating(false);
        }
    }, [description, selectedModule, onAddPlanet]);

    return (
        <div className="flex flex-col h-full">
            {/* 模块选择 */}
            <div className="p-3 border-b border-gray-700">
                <div className="text-xs text-gray-400 mb-2">选择模块</div>
                <div className="flex flex-wrap gap-2">
                    {MODULES.map(mod => (
                        <button
                            key={mod.id}
                            onClick={() => mod.available && setSelectedModule(mod.id)}
                            disabled={!mod.available}
                            className={`
                px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5
                ${selectedModule === mod.id
                                    ? 'bg-blue-600 text-white'
                                    : mod.available
                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                                }
              `}
                        >
                            <span>{mod.icon}</span>
                            <span>{mod.name}</span>
                            {!mod.available && <span className="text-xs">(即将推出)</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* 描述输入 */}
            <div className="p-3 flex-1 flex flex-col">
                <div className="text-xs text-gray-400 mb-2">效果描述</div>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="描述你想要的星球效果，例如：一个燃烧的熔岩核心，带有金色的粒子..."
                    className="flex-1 min-h-[120px] p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                    disabled={isGenerating}
                />
            </div>

            {/* 状态/错误信息 */}
            {(statusMessage || error) && (
                <div className={`px-3 py-2 text-sm ${error ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20'}`}>
                    {error || statusMessage}
                </div>
            )}

            {/* 生成按钮 */}
            <div className="p-3 border-t border-gray-700">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !description.trim()}
                    className={`
            w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2
            ${isGenerating || !description.trim()
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500'
                        }
          `}
                >
                    {isGenerating ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            <span>生成中...</span>
                        </>
                    ) : (
                        <>
                            <span>✨</span>
                            <span>生成星球</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CreatorPanel;
