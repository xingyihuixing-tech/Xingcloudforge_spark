/**
 * XingForge AI - Main Assistant Panel (v2.3)
 * 
 * input: isOpen, onClose, planets, settings callbacks
 * output: AI 交互面板 UI
 * pos: AI 系统的主入口组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// 工具导入
import { CHAT_MODELS, IMAGE_MODELS, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL } from '../utils/ai/modelConfig';
import { REFINE_TEMPLATES, INSPIRATION_MODE_INFO, InspirationSubMode } from '../utils/ai/refineTemplates';
import { ScopeSelection, createDefaultScopeSelection } from '../utils/ai/schemaBuilder';
import { buildSystemPrompt, buildUserPrompt, suggestScopeFromDescription } from '../utils/ai/promptBuilder';
import { extractJSON, validateAIOutput, generateRetryPrompt } from '../utils/ai/validator';
import { convertAIOutputToPlanet, applyAIPatchToPlanet, AISimplifiedOutput } from '../utils/ai/configMerger';

// 组件导入
import { ScopeSelector } from './ai/ScopeSelector';
import { PlanetSelector } from './ai/PlanetSelector';

// 类型导入
import type { PlanetSettings, PlanetSceneSettings } from '../types';

// ============================================
// 类型定义
// ============================================

export type AIMode = 'inspiration' | 'creator' | 'modifier';

interface AIAssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    // 创造模式回调
    onAddPlanet?: (planet: PlanetSettings) => void;
    // 修改模式回调
    onUpdatePlanet?: (planetId: string, planet: Partial<PlanetSettings>) => void;
    // 当前星球场景数据
    planetSettings?: PlanetSceneSettings;
    // 灵感模式：应用背景
    onApplyBackground?: (url: string) => void;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type?: 'text' | 'json' | 'image' | 'error';
    jsonData?: any;
    imageUrl?: string;
    subMode?: InspirationSubMode;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// ============================================
// 主组件
// ============================================

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
    isOpen,
    onClose,
    onAddPlanet,
    onUpdatePlanet,
    planetSettings,
    onApplyBackground
}) => {
    // === 模式状态 ===
    const [activeMode, setActiveMode] = useState<AIMode>('creator');
    const [inspirationSubMode, setInspirationSubMode] = useState<InspirationSubMode>('background');

    // === 模型选择 ===
    const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
    const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
    const [showSettings, setShowSettings] = useState(false);

    // === 范围选择 ===
    const [scopeSelection, setScopeSelection] = useState<ScopeSelection>({});
    const [scopeCollapsed, setScopeCollapsed] = useState(true);

    // === 修改模式 ===
    const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);

    // === 聊天状态 ===
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'assistant', content: '我是 XingForge AI 助手。选择模式后开始创作！\n\n🪐 **创造模式**: 用自然语言描述星球，AI 生成配置\n🎨 **灵感模式**: 生成背景图、粒子贴图、法阵\n🔧 **修改模式**: 微调现有星球参数' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // === 窗口拖拽 ===
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight - 600 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 拖拽处理
    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
            }
        };
        const handleUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDragging]);

    // 自动滚动
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 星球列表
    const planets = planetSettings?.planets?.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })) || [];

    // 获取选中星球的当前配置
    const getSelectedPlanetConfig = useCallback(() => {
        if (!selectedPlanetId || !planetSettings) return undefined;
        return planetSettings.planets.find(p => p.id === selectedPlanetId);
    }, [selectedPlanetId, planetSettings]);

    // === 润色功能 ===
    const handleRefine = useCallback(() => {
        if (!inputValue.trim()) return;

        if (activeMode === 'inspiration') {
            // 灵感模式：使用模板润色
            const template = REFINE_TEMPLATES[inspirationSubMode];
            const refined = template(inputValue.trim());
            setRefinedPrompt(refined);
        } else {
            // 创造/修改模式：生成详细的星球描述提示词
            const userInput = inputValue.trim();

            // 智能推荐范围
            const suggested = suggestScopeFromDescription(userInput);
            if (suggested.length > 0 && Object.keys(scopeSelection).length === 0) {
                const newSelection = createDefaultScopeSelection();
                const filtered: ScopeSelection = {};
                for (const effect of suggested) {
                    if (newSelection[effect]) {
                        filtered[effect] = newSelection[effect];
                    }
                }
                setScopeSelection(filtered);
                setScopeCollapsed(false);
            }

            // 创造模式的润色模板
            const creatorRefineTemplate = (input: string) => {
                const parts = [];
                parts.push(`创建一个完整的星球配置:`);
                parts.push(`主题描述: ${input}`);
                parts.push('');
                parts.push('要求:');
                parts.push('- 生成富有创意的中文名称');
                parts.push('- 参数值要有美学考量，不要使用默认值');
                parts.push('- 颜色搭配要协调统一');
                if (suggested.length > 0) {
                    parts.push(`- 重点配置以下效果: ${suggested.join(', ')}`);
                }
                return parts.join('\n');
            };

            const modifierRefineTemplate = (input: string) => {
                return `修改现有星球配置:\n${input}\n\n要求:\n- 只修改与描述相关的参数\n- 保持其他参数不变\n- 不要修改名称`;
            };

            const refined = activeMode === 'creator'
                ? creatorRefineTemplate(userInput)
                : modifierRefineTemplate(userInput);

            setRefinedPrompt(refined);
        }
    }, [inputValue, activeMode, inspirationSubMode, scopeSelection]);

    // === 发送消息 ===
    const handleSend = useCallback(async () => {
        const prompt = refinedPrompt || inputValue.trim();
        if (!prompt || isThinking) return;

        // 添加用户消息
        const userMsg: ChatMessage = { id: generateId(), role: 'user', content: prompt };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setRefinedPrompt(null);
        setIsThinking(true);

        try {
            if (activeMode === 'inspiration') {
                // === 灵感模式：生成图片 ===
                const res = await fetch('/api/ai/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        model: imageModel,
                        subMode: inspirationSubMode
                    })
                });
                const data = await res.json();

                if (data.url) {
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'assistant',
                        content: `✨ 已生成 ${INSPIRATION_MODE_INFO[inspirationSubMode].name}`,
                        type: 'image',
                        imageUrl: data.url,
                        subMode: inspirationSubMode
                    }]);
                } else {
                    throw new Error(data.error || '图片生成失败');
                }
            } else {
                // === 创造/修改模式：生成 JSON ===
                const currentPlanet = activeMode === 'modifier' ? getSelectedPlanetConfig() : undefined;

                const context = {
                    mode: activeMode,
                    selection: scopeSelection,
                    isSceneMode: false,
                    targetPlanetId: activeMode === 'modifier' ? (selectedPlanetId || undefined) : undefined,
                    currentConfig: currentPlanet
                };

                const systemPrompt = buildSystemPrompt(context);
                const userPrompt = buildUserPrompt(prompt, context);

                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: chatModel,
                        systemPrompt,
                        messages: [{ role: 'user', content: userPrompt }]
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'AI 请求失败');
                }

                const content = data.content || '';

                // 提取并验证 JSON
                const rawJson = extractJSON(content);
                if (!rawJson) {
                    throw new Error('AI 返回内容不是有效的 JSON');
                }

                const validation = validateAIOutput(rawJson);

                if (validation.warnings.length > 0) {
                    console.log('[AI Validator] Warnings:', validation.warnings);
                }

                if (!validation.valid || !validation.sanitized) {
                    throw new Error(validation.errors.join('; '));
                }

                setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'assistant',
                    content: `✨ ${activeMode === 'creator' ? '星球配置' : '修改建议'}已生成`,
                    type: 'json',
                    jsonData: validation.sanitized
                }]);
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'assistant',
                content: `❌ 错误: ${err.message}`,
                type: 'error'
            }]);
        } finally {
            setIsThinking(false);
        }
    }, [inputValue, refinedPrompt, activeMode, inspirationSubMode, imageModel, chatModel, scopeSelection, selectedPlanetId, isThinking, getSelectedPlanetConfig]);

    // === 应用配置 ===
    const handleApplyConfig = useCallback((jsonData: AISimplifiedOutput) => {
        try {
            if (activeMode === 'creator') {
                // 创造模式：生成新星球
                const newPlanet = convertAIOutputToPlanet(jsonData);
                if (onAddPlanet) {
                    onAddPlanet(newPlanet);
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'system',
                        content: `✅ 星球 "${newPlanet.name}" 已创建！`
                    }]);
                }
            } else if (activeMode === 'modifier' && selectedPlanetId) {
                // 修改模式：更新现有星球
                const currentPlanet = getSelectedPlanetConfig();
                if (currentPlanet && onUpdatePlanet) {
                    const updatedPlanet = applyAIPatchToPlanet(currentPlanet, jsonData);
                    onUpdatePlanet(selectedPlanetId, updatedPlanet);
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'system',
                        content: `✅ 星球 "${currentPlanet.name}" 已更新！`
                    }]);
                }
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'system',
                content: `❌ 应用失败: ${err.message}`,
                type: 'error'
            }]);
        }
    }, [activeMode, selectedPlanetId, getSelectedPlanetConfig, onAddPlanet, onUpdatePlanet]);

    // === 应用图片 ===
    const handleApplyImage = useCallback((imageUrl: string, subMode: InspirationSubMode) => {
        if (subMode === 'background' && onApplyBackground) {
            onApplyBackground(imageUrl);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'system',
                content: '✅ 背景图已应用！'
            }]);
        } else {
            // TODO: 法阵和粒子形状的应用
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'system',
                content: `⚠️ ${subMode} 应用功能开发中...`
            }]);
        }
    }, [onApplyBackground]);

    if (!isOpen) return null;

    // ============================================
    // 渲染
    // ============================================

    return createPortal(
        <div
            className="fixed z-[9999]"
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleDragStart}
        >
            <div
                className="w-[600px] rounded-2xl overflow-hidden shadow-2xl"
                style={{
                    background: 'linear-gradient(180deg, rgba(15,15,25,0.98) 0%, rgba(10,10,20,0.98) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 0 60px rgba(100,100,255,0.1)'
                }}
            >
                {/* 标题栏 */}
                <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-move">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse" />
                        <span className="text-white/90 font-semibold">XINGFORGE AI v2.3</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/90">⚙️</button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">✕</button>
                    </div>
                </div>

                {/* 模式切换 */}
                <div className="flex border-b border-white/10">
                    {(['creator', 'inspiration', 'modifier'] as AIMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setActiveMode(mode)}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeMode === mode
                                ? 'text-blue-300 border-b-2 border-blue-400 bg-blue-500/10'
                                : 'text-white/50 hover:text-white/70'
                                }`}
                        >
                            {mode === 'creator' ? '🪐 创造' : mode === 'inspiration' ? '🎨 灵感' : '🔧 修改'}
                        </button>
                    ))}
                </div>

                {/* 设置面板 */}
                {showSettings && (
                    <div className="p-3 border-b border-white/10 bg-black/30">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/50 mb-1 block">对话模型</label>
                                <select
                                    value={chatModel}
                                    onChange={e => setChatModel(e.target.value)}
                                    className="w-full bg-white/10 text-white/80 text-sm rounded-lg px-2 py-1.5 border border-white/10"
                                >
                                    {CHAT_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-white/50 mb-1 block">生图模型</label>
                                <select
                                    value={imageModel}
                                    onChange={e => setImageModel(e.target.value)}
                                    className="w-full bg-white/10 text-white/80 text-sm rounded-lg px-2 py-1.5 border border-white/10"
                                >
                                    {IMAGE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* 灵感模式子选项 */}
                {activeMode === 'inspiration' && (
                    <div className="flex gap-2 p-3 border-b border-white/10">
                        {(Object.keys(INSPIRATION_MODE_INFO) as InspirationSubMode[]).map(subMode => {
                            const info = INSPIRATION_MODE_INFO[subMode];
                            return (
                                <button
                                    key={subMode}
                                    onClick={() => setInspirationSubMode(subMode)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${inspirationSubMode === subMode
                                        ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
                                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                                        }`}
                                >
                                    {info.icon} {info.name}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 创造模式配置 */}
                {activeMode === 'creator' && (
                    <div className="p-3 border-b border-white/10">
                        <ScopeSelector
                            selection={scopeSelection}
                            onChange={setScopeSelection}
                            collapsed={scopeCollapsed}
                            onToggleCollapse={() => setScopeCollapsed(!scopeCollapsed)}
                        />
                    </div>
                )}

                {/* 修改模式配置 */}
                {activeMode === 'modifier' && (
                    <div className="p-3 border-b border-white/10 space-y-2">
                        <PlanetSelector
                            planets={planets}
                            selectedId={selectedPlanetId}
                            onChange={setSelectedPlanetId}
                        />
                        {selectedPlanetId && (
                            <ScopeSelector
                                selection={scopeSelection}
                                onChange={setScopeSelection}
                                collapsed={scopeCollapsed}
                                onToggleCollapse={() => setScopeCollapsed(!scopeCollapsed)}
                            />
                        )}
                    </div>
                )}

                {/* 消息列表 */}
                <div className="h-[200px] overflow-y-auto p-3 space-y-3">
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === 'user'
                                    ? 'bg-blue-500/30 text-white/90'
                                    : msg.role === 'system'
                                        ? 'bg-green-500/20 text-green-200'
                                        : msg.type === 'error'
                                            ? 'bg-red-500/20 text-red-200'
                                            : 'bg-white/10 text-white/80'
                                    }`}
                            >
                                {msg.type === 'image' && msg.imageUrl ? (
                                    <div>
                                        <img src={msg.imageUrl} alt="Generated" className="max-w-full rounded-lg mb-2" />
                                        <p className="text-sm">{msg.content}</p>
                                        <button
                                            onClick={() => handleApplyImage(msg.imageUrl!, msg.subMode || 'background')}
                                            className="mt-2 px-3 py-1 bg-green-500/30 text-green-200 rounded-lg text-sm hover:bg-green-500/40"
                                        >
                                            ⚡ 应用到{msg.subMode === 'background' ? '背景' : msg.subMode === 'magicCircle' ? '法阵' : '贴图'}
                                        </button>
                                    </div>
                                ) : msg.type === 'json' && msg.jsonData ? (
                                    <div>
                                        <p className="text-sm mb-2">{msg.content}</p>
                                        <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-h-[80px]">
                                            {JSON.stringify(msg.jsonData, null, 2).slice(0, 400)}...
                                        </pre>
                                        <button
                                            onClick={() => handleApplyConfig(msg.jsonData)}
                                            className="mt-2 px-3 py-1 bg-green-500/30 text-green-200 rounded-lg text-sm hover:bg-green-500/40"
                                        >
                                            ⚡ {activeMode === 'creator' ? '创建星球' : '应用修改'}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 rounded-xl px-4 py-2 text-white/60 animate-pulse">
                                思考中...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* 润色区 */}
                {refinedPrompt && (
                    <div className="px-3 py-2 bg-purple-500/10 border-t border-purple-400/20">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-purple-300">✨ 润色后的提示词</span>
                            <button onClick={() => setRefinedPrompt(null)} className="text-xs text-white/40 hover:text-white/60">取消</button>
                        </div>
                        <textarea
                            value={refinedPrompt}
                            onChange={e => setRefinedPrompt(e.target.value)}
                            className="w-full bg-black/30 text-white/80 text-sm rounded-lg p-2 resize-none border border-purple-400/20"
                            rows={2}
                        />
                    </div>
                )}

                {/* 输入区 */}
                <div className="p-3 border-t border-white/10">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={
                                activeMode === 'inspiration'
                                    ? '描述你想要的图片...'
                                    : activeMode === 'creator'
                                        ? '描述你想要的星球 (如: 冰蓝色的水晶星球，带有光环)'
                                        : '描述要修改的内容...'
                            }
                            className="flex-1 bg-white/10 text-white/90 placeholder-white/30 rounded-xl px-4 py-2 text-sm border border-white/10 focus:border-blue-400/50 focus:outline-none"
                        />
                        <button
                            onClick={handleRefine}
                            disabled={!inputValue.trim()}
                            className="px-3 py-2 rounded-xl text-sm font-medium bg-purple-500/30 text-purple-200 hover:bg-purple-500/40 disabled:opacity-30"
                        >
                            ✨
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isThinking || (!inputValue.trim() && !refinedPrompt)}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/30 text-blue-200 hover:bg-blue-500/40 disabled:opacity-30"
                        >
                            ➤
                        </button>
                    </div>
                </div>

                {/* 状态栏 */}
                <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
                    <span>
                        {activeMode === 'inspiration'
                            ? IMAGE_MODELS.find(m => m.id === imageModel)?.name
                            : CHAT_MODELS.find(m => m.id === chatModel)?.name}
                    </span>
                    <span>v2.3 | configMerger + validator</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AIAssistantPanel;
