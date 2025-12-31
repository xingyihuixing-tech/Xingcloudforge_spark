/**
 * XingForge AI - Main Assistant Panel
 * 
 * input: isOpen, onClose, settings callbacks
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
import { buildSystemPrompt, buildUserPrompt, AIMode, suggestScopeFromDescription } from '../utils/ai/promptBuilder';

// 组件导入
import { ScopeSelector } from './ai/ScopeSelector';
import { PlanetSelector } from './ai/PlanetSelector';

// ============================================
// 类型定义
// ============================================

interface AIAssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onApplySettings?: (settings: any) => void;
    onApplyPlanetSettings?: (settings: any) => void;
    planets?: Array<{ id: string; name: string; enabled: boolean }>;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type?: 'text' | 'json' | 'image' | 'refined';
    jsonData?: any;
    imageUrl?: string;
}

// ============================================
// 辅助函数
// ============================================

const extractJson = (text: string): any | null => {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            try { return JSON.parse(match[1]); } catch { }
        }
        const match2 = text.match(/\{[\s\S]*\}/);
        if (match2) {
            try { return JSON.parse(match2[0]); } catch { }
        }
        return null;
    }
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// ============================================
// 主组件
// ============================================

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
    isOpen,
    onClose,
    onApplySettings,
    onApplyPlanetSettings,
    planets = []
}) => {
    // === 模式状态 ===
    const [activeMode, setActiveMode] = useState<AIMode>('inspiration');
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
        { id: '1', role: 'assistant', content: '我是 XingForge AI 助手。选择模式后开始创作！' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // === 窗口拖拽 ===
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight - 550 });
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

    // === 润色功能 ===
    const handleRefine = useCallback(() => {
        if (!inputValue.trim()) return;

        if (activeMode === 'inspiration') {
            const template = REFINE_TEMPLATES[inspirationSubMode];
            const refined = template(inputValue.trim());
            setRefinedPrompt(refined);
        } else {
            // 创造/修改模式：智能推荐范围
            const suggested = suggestScopeFromDescription(inputValue);
            if (suggested.length > 0 && Object.keys(scopeSelection).length === 0) {
                const newSelection = createDefaultScopeSelection();
                // 只保留推荐的效果
                const filtered: ScopeSelection = {};
                for (const effect of suggested) {
                    if (newSelection[effect]) {
                        filtered[effect] = newSelection[effect];
                    }
                }
                setScopeSelection(filtered);
                setScopeCollapsed(false);
            }
            setRefinedPrompt(`[AI 推荐配置范围已更新]`);
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
                // 灵感模式：生成图片
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
                        imageUrl: data.url
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'assistant',
                        content: data.error || '图片生成失败'
                    }]);
                }
            } else {
                // 创造/修改模式：生成 JSON
                const context = {
                    mode: activeMode,
                    selection: scopeSelection,
                    isSceneMode: false,
                    targetPlanetId: activeMode === 'modifier' ? (selectedPlanetId || undefined) : undefined
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
                const content = data.content || '';
                const jsonData = extractJson(content);

                setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'assistant',
                    content: jsonData ? '✨ 已生成配置' : content,
                    type: jsonData ? 'json' : 'text',
                    jsonData
                }]);
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'assistant',
                content: `❌ 错误: ${err.message}`
            }]);
        } finally {
            setIsThinking(false);
        }
    }, [inputValue, refinedPrompt, activeMode, inspirationSubMode, imageModel, chatModel, scopeSelection, selectedPlanetId, isThinking]);

    // === 应用配置 ===
    const handleApply = useCallback((jsonData: any) => {
        if (activeMode === 'modifier' && onApplyPlanetSettings) {
            onApplyPlanetSettings(jsonData);
        } else if (onApplySettings) {
            onApplySettings(jsonData);
        }
        setMessages(prev => [...prev, {
            id: generateId(),
            role: 'system',
            content: '✅ 配置已应用！'
        }]);
    }, [activeMode, onApplySettings, onApplyPlanetSettings]);

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
                        <span className="text-white/90 font-semibold">XINGFORGE AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/90"
                        >
                            ⚙️
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                            ✕
                        </button>
                    </div>
                </div>

                {/* 模式切换 */}
                <div className="flex border-b border-white/10">
                    {(['inspiration', 'creator', 'modifier'] as AIMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setActiveMode(mode)}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeMode === mode
                                ? 'text-blue-300 border-b-2 border-blue-400 bg-blue-500/10'
                                : 'text-white/50 hover:text-white/70'
                                }`}
                        >
                            {mode === 'inspiration' ? '🎨 灵感' : mode === 'creator' ? '🪐 创造' : '🔧 修改'}
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

                {/* 创造/修改模式配置 */}
                {(activeMode === 'creator' || activeMode === 'modifier') && (
                    <div className="p-3 border-b border-white/10 space-y-2">
                        {activeMode === 'modifier' && (
                            <PlanetSelector
                                planets={planets}
                                selectedId={selectedPlanetId}
                                onChange={setSelectedPlanetId}
                            />
                        )}
                        <ScopeSelector
                            selection={scopeSelection}
                            onChange={setScopeSelection}
                            collapsed={scopeCollapsed}
                            onToggleCollapse={() => setScopeCollapsed(!scopeCollapsed)}
                        />
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
                                        : 'bg-white/10 text-white/80'
                                    }`}
                            >
                                {msg.type === 'image' && msg.imageUrl ? (
                                    <div>
                                        <img src={msg.imageUrl} alt="Generated" className="max-w-full rounded-lg mb-2" />
                                        <p className="text-sm">{msg.content}</p>
                                    </div>
                                ) : msg.type === 'json' && msg.jsonData ? (
                                    <div>
                                        <p className="text-sm mb-2">{msg.content}</p>
                                        <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-h-[100px]">
                                            {JSON.stringify(msg.jsonData, null, 2).slice(0, 500)}...
                                        </pre>
                                        <button
                                            onClick={() => handleApply(msg.jsonData)}
                                            className="mt-2 px-3 py-1 bg-green-500/30 text-green-200 rounded-lg text-sm hover:bg-green-500/40"
                                        >
                                            ⚡ 应用配置
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

                {/* 润色提示词显示 */}
                {refinedPrompt && (
                    <div className="px-3 py-2 bg-purple-500/10 border-t border-purple-400/20">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-purple-300">✨ 润色后的提示词 (可编辑)</span>
                            <button
                                onClick={() => setRefinedPrompt(null)}
                                className="text-xs text-white/40 hover:text-white/60"
                            >
                                取消
                            </button>
                        </div>
                        <textarea
                            value={refinedPrompt}
                            onChange={e => setRefinedPrompt(e.target.value)}
                            className="w-full bg-black/30 text-white/80 text-sm rounded-lg p-2 resize-none border border-purple-400/20"
                            rows={3}
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
                                        ? '描述你想要的星球...'
                                        : '描述要修改的内容...'
                            }
                            className="flex-1 bg-white/10 text-white/90 placeholder-white/30 rounded-xl px-4 py-2 text-sm border border-white/10 focus:border-blue-400/50 focus:outline-none"
                        />
                        <button
                            onClick={handleRefine}
                            disabled={!inputValue.trim()}
                            className="px-3 py-2 rounded-xl text-sm font-medium bg-purple-500/30 text-purple-200 hover:bg-purple-500/40 disabled:opacity-30"
                        >
                            ✨ 润色
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
                        {activeMode === 'inspiration' ? IMAGE_MODELS.find(m => m.id === imageModel)?.name : CHAT_MODELS.find(m => m.id === chatModel)?.name}
                    </span>
                    <span>Powered by XingForge</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AIAssistantPanel;
