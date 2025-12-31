import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SYSTEM_PROMPT_TEMPLATE } from '../utils/ai/schema';

/**
 * AI Assistant Panel (XingForge AI)
 */

interface AIAssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onApplySettings?: (settings: any) => void;
    onApplyPlanetSettings?: (settings: any) => void;
}

// 提取 JSON 的辅助函数
const extractJson = (text: string): any | null => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            try { return JSON.parse(match[1]); } catch (e2) { return null; }
        }
        const match2 = text.match(/\{[\s\S]*\}/);
        if (match2) {
            try { return JSON.parse(match2[0]); } catch (e3) { return null; }
        }
        return null;
    }
};

type AIChatMode = 'inspiration' | 'creator' | 'modifier';

// === 模型常量定义 ===
const CHAT_MODELS = [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude 3.5 Sonnet (默认)' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude 3.5 Opus' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude 3.5 Haiku' },
    { id: 'gemini-2.5-pro-thinking-512', name: 'Gemini 2.5 Pro Thinking' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
    { id: 'claude-sonnet-4-5-20250929-thinking', name: 'Claude Sonnet Thinking' }
];

const IMAGE_MODELS = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (默认)' },
    { id: 'gemini-3-pro-image-preview-flatfee', name: 'Gemini 3 Pro Flatfee' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
    { id: 'gemini-3-pro-preview-thinking', name: 'Gemini 3 Pro Thinking' }
];

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type?: 'text' | 'json-code' | 'image';
    thinking?: boolean;
    jsonData?: any;
    imageUrl?: string;
}

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ isOpen, onClose, onApplySettings, onApplyPlanetSettings }) => {
    // === 状态管理 ===
    const [activeMode, setActiveMode] = useState<AIChatMode>('inspiration');
    const [showSettings, setShowSettings] = useState(false);

    // 模型选择
    const [chatModel, setChatModel] = useState(CHAT_MODELS[0].id);
    const [imageModel, setImageModel] = useState(IMAGE_MODELS[0].id);

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'assistant', content: '我是 XingForge AI 助手。您可以让我帮忙画图(灵感模式)、生成星球配置(创造模式)，或者修改当前场景。支持拖拽图片进行分析！' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    // === 窗口拖拽逻辑 ===
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight - 500 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };
    const handleDragMove = useCallback((e: MouseEvent) => {
        if (isDragging) setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
    }, [isDragging]);
    const handleDragEnd = useCallback(() => setIsDragging(false), []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
        } else {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    // === 文件拖拽逻辑 (Vision) ===
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) setSelectedImage(event.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // === 消息发送逻辑 ===
    const handleSendMessage = async () => {
        if (!inputValue.trim() && !selectedImage) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            imageUrl: selectedImage || undefined
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        const currentImage = selectedImage;
        setSelectedImage(null);
        setIsThinking(true);

        try {
            // === 分支 1: 灵感模式 (调用生图 API) ===
            if (activeMode === 'inspiration' && !currentImage) {
                const response = await fetch('/api/ai/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: inputValue,
                        model: imageModel
                    }),
                });

                if (!response.ok) throw new Error('Image Gen Failed');
                const data = await response.json();

                const aiMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '为您生成了以下图片：',
                    type: 'image',
                    imageUrl: data.url
                };
                setMessages(prev => [...prev, aiMsg]);
                return;
            }

            // === 分支 2: 创造/修改模式 (调用 Chat API) ===
            const recentHistory = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

            let currentMessageContent: any = inputValue;
            if (currentImage) {
                currentMessageContent = [
                    { type: 'text', text: inputValue || "Analyze this image" },
                    { type: 'image_url', image_url: { url: currentImage } }
                ];
            }

            recentHistory.push({ role: 'user', content: currentMessageContent });

            const systemPrompt = SYSTEM_PROMPT_TEMPLATE(activeMode);

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: recentHistory,
                    model: chatModel,
                    systemPrompt: systemPrompt
                }),
            });

            if (!response.ok) throw new Error('AI Response Error');

            const data = await response.json();
            const jsonData = extractJson(data.content);
            const isJson = !!jsonData;

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.content,
                type: isJson ? 'json-code' : 'text',
                jsonData: jsonData
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error('Chat Error:', error);
            const errorMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '⚠️ 请求失败，请检查网络或配置。',
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={panelRef}
            className="fixed z-[9999] flex flex-col ai-glass-panel rounded-2xl overflow-hidden transition-opacity duration-300 animate-[ai-float_6s_ease-in-out_infinite]"
            style={{
                left: position.x, top: position.y,
                width: '600px', height: '450px',
                opacity: isOpen ? 1 : 0,
                pointerEvents: 'auto',
                boxShadow: isThinking ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.15)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onMouseDown={handleDragStart}
        >
            <div className="ai-glow-effect" />

            {/* === 顶部标题栏 === */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 drag-handle cursor-move select-none bg-white/5">
                <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full border border-indigo-400 ${isThinking ? 'animate-[spin_2s_linear_infinite]' : ''}`} style={{ borderTopColor: 'transparent' }} />
                        <div className={`w-3 h-3 rounded-full bg-indigo-500 ${isThinking ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className="text-sm font-bold text-white tracking-wider flex items-center gap-1">
                        XINGFORGE <span className="text-indigo-400">AI</span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Settings Toggle */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10 ${showSettings ? 'text-indigo-400 bg-white/10' : ''}`}
                        title="模型设置"
                    >
                        ⚙️
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-white/10">✕</button>
                </div>
            </div>

            {/* === 设置面板 Overlay === */}
            {showSettings && (
                <div className="absolute top-[50px] right-0 w-64 bg-[#1a1b26] border border-white/10 rounded-bl-xl shadow-2xl z-50 p-4 animate-[slide-in-right_0.2s_ease-out]">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Model Configuration</h3>
                    <div className="mb-4">
                        <label className="block text-xs text-indigo-300 mb-1">Chat & Logic Model</label>
                        <select
                            value={chatModel} onChange={(e) => setChatModel(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                        >
                            {CHAT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-pink-300 mb-1">Image Generation Model</label>
                        <select
                            value={imageModel} onChange={(e) => setImageModel(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-pink-500 outline-none"
                        >
                            {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* === 主体区域 === */}
            <div className="flex flex-1 overflow-hidden">
                {/* 侧边栏 */}
                <div className="w-14 border-r border-white/10 flex flex-col items-center py-4 gap-4 bg-black/20">
                    <ModeButton active={activeMode === 'inspiration'} onClick={() => setActiveMode('inspiration')} icon="🎨" tooltip="灵感模式 (绘图)" />
                    <ModeButton active={activeMode === 'creator'} onClick={() => setActiveMode('creator')} icon="🪐" tooltip="创造模式 (JSON)" />
                    <ModeButton active={activeMode === 'modifier'} onClick={() => setActiveMode('modifier')} icon="🔧" tooltip="修改模式" />
                </div>

                {/* 对话区域 */}
                <div className="flex-1 flex flex-col relative">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[message-fade-in_0.3s_ease-out]`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-gray-100 rounded-bl-none border border-white/5'
                                    }`}>
                                    {msg.type === 'json-code' ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs text-green-400 font-mono mb-1">✨ 生成了新的配置</div>
                                            <pre className="text-xs bg-black/50 p-2 rounded overflow-x-auto font-mono text-gray-300">
                                                {JSON.stringify(msg.jsonData, null, 2).slice(0, 150)}...
                                            </pre>
                                            <button
                                                onClick={() => {
                                                    if (msg.jsonData) {
                                                        if (msg.jsonData.planetSettings && onApplyPlanetSettings) {
                                                            onApplyPlanetSettings((prev: any) => ({ ...prev, ...msg.jsonData.planetSettings }));
                                                            alert('已应用星球配置！');
                                                        } else if (msg.jsonData.nebulaInstances && onApplySettings) {
                                                            onApplySettings((prev: any) => ({ ...prev, nebulaInstances: msg.jsonData.nebulaInstances }));
                                                            alert('已应用星云场景配置！');
                                                        } else if (msg.jsonData.radius || msg.jsonData.core) {
                                                            onApplyPlanetSettings((prev: any) => ({ ...prev, ...msg.jsonData }));
                                                            alert('已应用混合配置！');
                                                        } else {
                                                            if (onApplySettings) onApplySettings((prev: any) => ({ ...prev, ...msg.jsonData }));
                                                            alert('已应用设置！');
                                                        }
                                                    }
                                                }}
                                                className="mt-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 px-3 rounded flex items-center gap-1"
                                            >
                                                ⚡ 立即应用
                                            </button>
                                        </div>
                                    ) : msg.type === 'image' ? (
                                        <div className="flex flex-col gap-2">
                                            <span>{msg.content}</span>
                                            {msg.imageUrl && (
                                                <img src={msg.imageUrl} alt="Generated" className="rounded-lg shadow-lg border border-white/20 max-w-full h-auto mt-2" />
                                            )}
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                    {/* User Upload Preview */}
                                    {msg.role === 'user' && msg.imageUrl && (
                                        <img src={msg.imageUrl} alt="Uploaded" className="mt-2 rounded-lg max-h-32 border border-white/20" />
                                    )}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-white/5 rounded-2xl px-4 py-2 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 pt-2 relative z-10" onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
                        {selectedImage && (
                            <div className="absolute bottom-full left-4 mb-2">
                                <div className="relative group">
                                    <img src={selectedImage} alt="Preview" className="h-16 rounded-lg border border-indigo-500 shadow-lg" />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="relative group">
                            <div className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 transition-opacity duration-300 ${isThinking ? 'opacity-30' : 'group-focus-within:opacity-50'}`} />
                            <div className="relative flex items-center bg-black/40 rounded-xl border border-white/10 overflow-hidden">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        activeMode === 'inspiration' ? '描述想要生成的画面，或拖入参考图...' :
                                            activeMode === 'creator' ? '描述一个星球场景 (支持拖图分析)...' :
                                                '输入修改指令...'
                                    }
                                    className="flex-1 bg-transparent border-none text-white px-4 py-3 focus:ring-0 placeholder-gray-500 text-sm"
                                    disabled={isThinking}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isThinking}
                                    className={`px-4 py-2 mr-1 rounded-lg transition-all ${inputValue.trim() ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}
                                >
                                    ➤
                                </button>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-2 text-center">Powered by Gemini & Claude</div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: string; tooltip: string }> = ({ active, onClick, icon, tooltip }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
        >
            {icon}
        </button>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10">
            {tooltip}
        </div>
    </div>
);

export default AIAssistantPanel;
