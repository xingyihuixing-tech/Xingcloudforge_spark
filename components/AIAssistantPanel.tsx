/**
 * XingForge AI - Main Assistant Panel (Inspiration Mode v2.1)
 * 
 * input: isOpen, onClose, callbacks for presets
 * output: AI 交互面板 UI
 * pos: AI 系统的主入口组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Send, X, Save } from 'lucide-react';

// 工具导入
import { CHAT_MODELS, IMAGE_MODELS, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL } from '../utils/ai/modelConfig';
import { INSPIRATION_MODE_INFO, InspirationSubMode } from '../utils/ai/refineTemplates';
import { XingSparkSettingsPanel, XingSparkConfig, DEFAULT_XING_CONFIG, CHAT_FONT_OPTIONS } from './XingSparkSettings';

// ============================================
// 类型定义
// ============================================

export type AIMode = 'inspiration';

// AI 生成预设
export interface AIGeneratedPreset {
    id: string;
    name: string;
    url: string;
    createdAt: number;
}

interface AIAssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    // 当前用户 ID
    userId?: string;
    // 灵感模式回调
    onSaveHeadTexture?: (preset: AIGeneratedPreset) => void;
    onSaveBackground?: (preset: AIGeneratedPreset) => void;
    onSaveMagicCircleTexture?: (preset: AIGeneratedPreset) => void;
    // XingSpark 配置 (Lifted State from App.tsx)
    xingConfig: XingSparkConfig;
    onConfigChange: React.Dispatch<React.SetStateAction<XingSparkConfig>>;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type?: 'text' | 'image' | 'error';
    imageUrl?: string;
    attachedImage?: string; // 用户发送时附带的图片
    subMode?: InspirationSubMode;
    suggestedName?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// ============================================
// 图片放大 Modal
// ============================================

const ImageModal: React.FC<{
    imageUrl: string | null;
    onClose: () => void;
}> = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80"
            onClick={onClose}
        >
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white/60 hover:text-white text-xl"
                >
                    ✕ 关闭
                </button>
                <img src={imageUrl} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg" />
                <div className="mt-2 flex gap-2 justify-center">
                    <a
                        href={imageUrl}
                        download
                        className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/20"
                    >
                        📥 下载
                    </a>
                    <button
                        onClick={() => navigator.clipboard.writeText(imageUrl)}
                        className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/20"
                    >
                        📋 复制 URL
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ============================================
// 主组件
// ============================================

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
    isOpen,
    onClose,
    userId,
    onSaveHeadTexture,
    onSaveBackground,
    onSaveMagicCircleTexture,
    xingConfig,
    onConfigChange
}) => {
    // === 模式状态 ===
    const [inspirationSubMode, setInspirationSubMode] = useState<InspirationSubMode>('background');

    // === 模型选择 ===
    const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
    const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
    const [showModelSelector, setShowModelSelector] = useState(false);
    // 自由对话模式下，当前选中的模型类型 ('chat' 或 'image')
    const [freeChatModelType, setFreeChatModelType] = useState<'chat' | 'image'>('chat');

    // === 输入状态 ===
    const [inputValue, setInputValue] = useState('');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // === 聊天状态 (初始为空) ===
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // === 图片预览 ===
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // === 保存状态 ===
    const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    // === XingSpark 设置 ===
    const [showSettings, setShowSettings] = useState(false);
    // xingConfig moved to props
    const [logoState, setLogoState] = useState<'idle' | 'blinking'>('idle');
    const lastDoubleClickRef = useRef(0);
    const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // === 窗口拖拽 ===
    // 默认位置居中
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 300 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // XingSpark 双击处理
    const handleLogoDoubleClick = useCallback(() => {
        const now = Date.now();
        if (logoState === 'blinking' && now - lastDoubleClickRef.current < 3000) {
            // 闪烁期间再次双击 -> 打开设置
            if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
            setLogoState('idle');
            setShowSettings(true);
        } else {
            // 第一次双击 -> 开始闪烁
            lastDoubleClickRef.current = now;
            setLogoState('blinking');
            if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
            blinkTimeoutRef.current = setTimeout(() => {
                setLogoState('idle');
            }, 3000);
        }
    }, [logoState]);

    // 加载云端配置
    useEffect(() => {
        if (userId) {
            fetch(`/api/config?userId=${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.config?.xingSparkConfig) {
                        const loaded = data.config.xingSparkConfig;
                        // 深度合并默认值，确保旧配置缺少的新字段有默认值
                        onConfigChange({
                            ...DEFAULT_XING_CONFIG,
                            ...loaded,
                            gradient: { ...DEFAULT_XING_CONFIG.gradient, ...loaded.gradient },
                            inputGlow: { ...DEFAULT_XING_CONFIG.inputGlow, ...loaded.inputGlow },
                            theme: { ...DEFAULT_XING_CONFIG.theme, ...loaded.theme },
                            userMsg: { ...DEFAULT_XING_CONFIG.userMsg, ...loaded.userMsg },
                        });
                    }
                })
                .catch(err => console.error('加载 XingSpark 配置失败:', err));
        }
    }, [userId, onConfigChange]);

    // 拖拽处理
    const handleDragStart = (e: React.MouseEvent) => {
        // 允许通过顶部拖拽区域拖拽 (Header)
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - position.y });
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
    }, [isDragging, position.x, position.y]);

    // 自动滚动
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 自动调整输入框高度
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            // 2行约 48px, 5行约 120px
            const newHeight = Math.min(Math.max(scrollHeight, 48), 120);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [inputValue]);

    // === 图片上传 ===
    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setUploadedImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    const clearUploadedImage = useCallback(() => {
        setUploadedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // === 粘贴图片 ===
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        setUploadedImage(event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                }
                break;
            }
        }
    }, []);

    // === 拖拽图片 ===
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    // === 润色功能 (调用 AI) ===
    const handleRefine = useCallback(async () => {
        if (!inputValue.trim() || isRefining) return;

        setIsRefining(true);

        try {
            const res = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: inputValue.trim(),
                    mode: 'inspiration',
                    subMode: inspirationSubMode,
                    imageBase64: uploadedImage || undefined,
                    model: chatModel
                })
            });

            const data = await res.json();

            if (data.refined) {
                setInputValue(data.refined);
            } else {
                console.error('Refine error:', data.error);
            }
        } catch (err) {
            console.error('Refine fetch error:', err);
        } finally {
            setIsRefining(false);
        }
    }, [inputValue, inspirationSubMode, uploadedImage, isRefining, chatModel]);

    // === 发送 ===
    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isGenerating) return;

        const prompt = inputValue.trim();
        const currentAttachedImage = uploadedImage; // 保存当前附图

        // 添加用户消息
        const userMsg: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: prompt,
            attachedImage: currentAttachedImage || undefined
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setUploadedImage(null); // 清空附图
        setIsGenerating(true);

        try {
            // 自由对话模式：根据模型类型决定 API
            if (inspirationSubMode === 'freeChat') {
                if (freeChatModelType === 'chat') {
                    // 使用 Chat API，无系统提示词，带历史消息
                    const historyMessages = messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }));
                    const res = await fetch('/api/ai/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [...historyMessages, { role: 'user', content: prompt }],
                            model: chatModel,
                            // freeChat 模式不使用系统提示词
                            noSystemPrompt: true
                        })
                    });
                    const data = await res.json();
                    if (data.content) {
                        setMessages(prev => [...prev, {
                            id: generateId(),
                            role: 'assistant',
                            content: data.content
                        }]);
                    } else {
                        throw new Error(data.error || '对话失败');
                    }
                } else {
                    // 使用 Image API，无特殊提示词
                    const res = await fetch('/api/ai/image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: prompt,
                            model: imageModel,
                            // freeChat 模式不使用 subMode 模板
                            subMode: undefined,
                            imageBase64: currentAttachedImage || undefined
                        })
                    });
                    const data = await res.json();
                    if (data.url) {
                        setMessages(prev => [...prev, {
                            id: generateId(),
                            role: 'assistant',
                            content: '🖼️ 生成完成',
                            type: 'image',
                            imageUrl: data.url
                        }]);
                    } else {
                        throw new Error(data.error || '图片生成失败');
                    }
                }
            } else {
                // 灵感模式：生成图片 (原有逻辑)
                const res = await fetch('/api/ai/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        model: imageModel,
                        subMode: inspirationSubMode,
                        imageBase64: currentAttachedImage || undefined
                    })
                });
                const data = await res.json();

                if (data.url) {
                    // 获取 AI 命名
                    let suggestedName = 'AI生成';
                    try {
                        const nameRes = await fetch('/api/ai/name', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageUrl: data.url,
                                subMode: inspirationSubMode
                            })
                        });
                        const nameData = await nameRes.json();
                        suggestedName = nameData.name || suggestedName;
                    } catch (e) {
                        console.error('Name API error:', e);
                    }

                    setMessages(prev => [...prev, {
                        id: generateId(),
                        role: 'assistant',
                        content: `✨ 生成完成`,
                        type: 'image',
                        imageUrl: data.url,
                        subMode: inspirationSubMode,
                        suggestedName
                    }]);

                    clearUploadedImage();
                } else {
                    throw new Error(data.error || '图片生成失败');
                }
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'assistant',
                content: `❌ 错误: ${err.message}`,
                type: 'error'
            }]);
        } finally {
            setIsGenerating(false);
        }
    }, [inputValue, inspirationSubMode, imageModel, chatModel, freeChatModelType, uploadedImage, isGenerating, clearUploadedImage, messages]);

    // === 保存预设 ===
    const handleSavePreset = useCallback(async (msg: ChatMessage, customName?: string) => {
        if (!msg.imageUrl || !userId || savingId) return;

        setSavingId(msg.id);

        try {
            const imgRes = await fetch(msg.imageUrl);
            const blob = await imgRes.blob();

            const name = customName || msg.suggestedName || 'AI生成';
            const typeMap: Record<InspirationSubMode, string> = {
                particleShape: 'headTexture',
                background: 'background',
                magicCircle: 'magicCircleTexture',
                freeChat: 'chat'
            };
            const fileType = typeMap[msg.subMode || 'magicCircle'];

            const uploadRes = await fetch(
                `/api/upload?userId=${userId}&type=${fileType}&fileName=${encodeURIComponent(name)}.png`,
                { method: 'POST', body: blob }
            );
            const uploadData = await uploadRes.json();

            if (!uploadData.url) throw new Error('上传失败');

            const preset: AIGeneratedPreset = {
                id: generateId(),
                name,
                url: uploadData.url,
                createdAt: Date.now()
            };

            if (msg.subMode === 'particleShape' && onSaveHeadTexture) {
                onSaveHeadTexture(preset);
            } else if (msg.subMode === 'background' && onSaveBackground) {
                onSaveBackground(preset);
            } else if (msg.subMode === 'magicCircle' && onSaveMagicCircleTexture) {
                onSaveMagicCircleTexture(preset);
            }

            setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, content: `✅ 已保存: ${name}` } : m
            ));

        } catch (err: any) {
            console.error('Save preset error:', err);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'system',
                content: `❌ 保存失败: ${err.message}`,
                type: 'error'
            }]);
        } finally {
            setSavingId(null);
            setEditingName(null);
        }
    }, [userId, savingId, onSaveHeadTexture, onSaveBackground, onSaveMagicCircleTexture]);

    // === 配置持久化 ===
    const saveTimeoutRef = useRef<any>(null);

    const saveToCloud = useCallback((newConfig: XingSparkConfig) => {
        if (!userId) return;

        // 使用 debounce 避免频繁请求
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                // 先获取现有配置以保留其他字段
                const currentRes = await fetch(`/api/config?userId=${userId}`);
                const currentData = await currentRes.json();

                const payload = {
                    userId,
                    config: {
                        ...(currentData.config || {}),
                        xingSparkConfig: newConfig
                    }
                };

                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                console.log('XingSpark 配置已保存到云端');
            } catch (err) {
                console.error('保存配置失败:', err);
            }
        }, 1000);
    }, [userId]);

    // 监听配置变化自动保存
    useEffect(() => {
        if (userId) {
            saveToCloud(xingConfig);
        }
    }, [xingConfig, userId, saveToCloud]);

    // 同步 XingSpark 颜色到全局 CSS 变量，供 ControlPanel 等组件使用
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--xing-c1', xingConfig.gradient.colors[0] || '#71b0ff');
        root.style.setProperty('--xing-c2', xingConfig.gradient.colors[1] || '#FFB6C1');
        root.style.setProperty('--xing-c3', xingConfig.gradient.colors[2] || '#2bf6a5');
        root.style.setProperty('--xing-c4', xingConfig.gradient.colors[3] || '#37f1d2');
        root.style.setProperty('--xing-font', CHAT_FONT_OPTIONS.find(f => f.name === xingConfig.font)?.family || 'Pacifico');
    }, [xingConfig.gradient.colors, xingConfig.font]);

    if (!isOpen) return null;

    // 当前选中的模型名称
    const currentChatModelName = CHAT_MODELS.find(m => m.id === chatModel)?.name || 'Chat';
    const currentImageModelName = IMAGE_MODELS.find(m => m.id === imageModel)?.name || 'Image';
    // 子模式提示词映射
    const subModePrompts: Record<InspirationSubMode, string> = {
        particleShape: '生成粒子形状图案...',
        background: '生成宇宙背景图...',
        magicCircle: '生成魔法阵图案...',
        freeChat: '输入任何内容...'
    };

    const saveButtonText: Record<InspirationSubMode, string> = {
        particleShape: '保存到头部',
        background: '保存到背景',
        magicCircle: '保存到法阵',
        freeChat: '保存预设'
    };

    return createPortal(
        <>
            <ImageModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

            <div
                className="fixed z-[9999]"
                style={{ left: position.x, top: position.y }}
                onMouseDown={handleDragStart}
            >
                <div
                    className="w-[600px] ai-panel-container"
                    style={{
                        // 动态边框光晕效果 (参考 AISidebar.tsx 5610-5616)
                        boxShadow: `
                            0 24px 48px rgba(0,0,0,0.15), 
                            0 8px 16px rgba(0,0,0,0.1),
                            0 0 20px ${xingConfig.gradient.colors[0]}40,
                            0 0 40px ${xingConfig.gradient.colors[1] || xingConfig.gradient.colors[0]}25,
                            0 0 60px ${xingConfig.gradient.colors[2] || xingConfig.gradient.colors[0]}15
                        `,
                    }}
                >
                    {/* 4-Segment Breathe Borders - colors are in CSS, but check if they need to match user config. 
                        Ref project uses fixed gradients for borders, but user asked for "follow logo color gradient preset".
                        If strictly following reference AISidebar.tsx (which I can't fully see all lines of right now but know the concept),
                        the border segments inside are gradient. The MAIN container border might be separate.
                        User said: "ai面板的边框颜色也被你硬编码了... 跟随着logo颜色的渐变预设来的".
                        So I will actually apply the Gradient Colors to the 4 border segments if possible, 
                        OR just the main border if that's what they meant. 
                        Let's apply dynamic main border first as per plan.
                     */}
                    <div className="ai-panel-border-top" style={{ background: `linear-gradient(90deg, transparent 0%, ${xingConfig.gradient.colors[0]} 20%, ${xingConfig.gradient.colors[1]} 50%, ${xingConfig.gradient.colors[2]} 80%, transparent 100%)` }}></div>
                    <div className="ai-panel-border-bottom" style={{ background: `linear-gradient(90deg, transparent 0%, ${xingConfig.gradient.colors[2]} 20%, ${xingConfig.gradient.colors[1]} 50%, ${xingConfig.gradient.colors[0]} 80%, transparent 100%)` }}></div>
                    <div className="ai-panel-border-left" style={{ background: `linear-gradient(to bottom, ${xingConfig.gradient.colors[0]}80 0%, ${xingConfig.gradient.colors[1]}80 50%, transparent 100%)` }}></div>
                    <div className="ai-panel-border-right" style={{ background: `linear-gradient(to bottom, transparent 0%, ${xingConfig.gradient.colors[1]}80 50%, ${xingConfig.gradient.colors[0]}80 100%)` }}></div>

                    {/* 标题栏 (Drag Handle) */}
                    <div className="drag-handle flex items-center justify-between px-4 py-3 cursor-move border-b border-white/5">
                        <div className="flex items-center gap-2 relative">
                            {/* XingSpark Logo with Dynamic Gradient - 使用 CSS 类名触发动画 */}
                            {(() => {
                                const colors = xingConfig.gradient.colors;
                                const normalized = colors.length >= 4 ? colors : [...colors, ...Array(4 - colors.length).fill(colors[colors.length - 1])];
                                return (
                                    <span
                                        className={`xingspark-logo-title ${logoState === 'blinking' ? 'blinking' : ''}`}
                                        onDoubleClick={handleLogoDoubleClick}
                                        title="双击打开设置"
                                    >
                                        <span style={{ fontSize: '1em' }}>X</span>
                                        <span style={{ fontSize: '0.9em' }}>ing</span>
                                        <span style={{ fontSize: '1.25em', marginLeft: '-0.05em' }}>S</span>
                                        <span style={{ fontSize: '0.9em' }}>park</span>
                                    </span>
                                );
                            })()}
                            {/* 展开/收起指示 */}
                            {/* 三角符号已移除 */}
                        </div>
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">✕</button>
                    </div>

                    {/* XingSpark 设置 - 显示在标题栏下方，无额外外框 */}
                    {showSettings && (
                        <div className="flex-1 min-h-0">
                            <XingSparkSettingsPanel
                                config={xingConfig}
                                setConfig={onConfigChange}
                                onBack={() => setShowSettings(false)}
                                userId={userId}
                                onSave={saveToCloud}
                            />
                        </div>
                    )}

                    {/* 消息列表 - 当设置面板关闭时显示 */}
                    {!showSettings && (
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="h-full flex items-center justify-center text-white/10 text-sm italic select-none">
                                    {/* 空状态 */}
                                </div>
                            )}
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] ${msg.role === 'user' ? 'text-right' : 'text-left'
                                        }`}>
                                        {msg.type === 'image' && msg.imageUrl ? (
                                            <div className="inline-block relative group">
                                                <img
                                                    src={msg.imageUrl}
                                                    alt="Generated"
                                                    className="max-h-[160px] rounded-lg shadow-lg cursor-pointer hover:opacity-95 transition-opacity"
                                                    onClick={() => setPreviewImage(msg.imageUrl!)}
                                                />
                                                {msg.subMode && msg.subMode !== 'freeChat' && (
                                                    <div className="mt-2 text-left">
                                                        <button
                                                            onClick={() => handleSavePreset(msg)}
                                                            disabled={savingId === msg.id || !userId}
                                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/90 text-xs rounded transition-colors backdrop-blur-sm"
                                                        >
                                                            {savingId === msg.id ? 'Saving...' : (
                                                                <><Save size={12} className="inline mr-1" />{saveButtonText[msg.subMode]}</>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                className={`inline-block px-3 py-2 rounded-xl ${msg.role === 'user' ? '' : 'bg-white/5 text-white/80'}`}
                                                style={{
                                                    // 应用对话字体和字号
                                                    fontFamily: CHAT_FONT_OPTIONS.find(f => f.id === xingConfig.theme?.chatFont)?.family || CHAT_FONT_OPTIONS[0].family,
                                                    fontSize: `${xingConfig.theme?.chatFontSize ?? 14}px`,
                                                    wordBreak: 'break-word',
                                                    whiteSpace: 'pre-wrap',
                                                    ...(msg.role === 'user' ? {
                                                        backgroundSize: '200% 200%',
                                                        animation: `xing-gradient-flow ${xingConfig.userMsg?.speed ?? 6}s ease infinite`,
                                                        background: `linear-gradient(${xingConfig.userMsg?.angle ?? 135}deg, ${(xingConfig.userMsg?.colors ?? ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2']).map((c, i, arr) => {
                                                            const opacity = i === 0 ? (xingConfig.userMsg?.lightOpacity ?? 0.15) : (xingConfig.userMsg?.darkOpacity ?? 0.25);
                                                            return `${c}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
                                                        }).join(', ')})`,
                                                        border: `1px solid ${xingConfig.userMsg?.borderColor ?? '#71b0ff'}40`,
                                                        color: 'rgba(255,255,255,0.9)',
                                                    } : {})
                                                }}
                                            >
                                                {/* 附图显示 */}
                                                {msg.attachedImage && (
                                                    <img
                                                        src={msg.attachedImage}
                                                        alt="附图"
                                                        className="max-h-[80px] rounded mb-2 cursor-pointer hover:opacity-80"
                                                        onClick={() => setPreviewImage(msg.attachedImage!)}
                                                    />
                                                )}
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* 加载状态 */}
                            {isGenerating && (
                                <div className="flex justify-start">
                                    <div className="px-3 py-2 rounded-xl bg-white/5 text-white/40 text-sm animate-pulse">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* 上传图片预览 和 输入区域 - 当设置面板关闭时显示 */}
                    {!showSettings && (
                        <>
                            {/* 上传图片预览 */}
                            {uploadedImage && (
                                <div className="px-4 py-1 flex items-center gap-2">
                                    <div className="relative group">
                                        <img src={uploadedImage} className="w-8 h-8 rounded object-cover border border-white/10" alt="ref" />
                                        <button
                                            onClick={clearUploadedImage}
                                            className="absolute -top-1 -right-1 bg-red-500/80 rounded-full w-3 h-3 flex items-center justify-center text-[8px] text-white opacity-0 group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-white/40">参考图已就绪</span>
                                </div>
                            )}

                            {/* 输入区域容器 */}
                            <div className="p-3 bg-black/10 backdrop-blur-sm rounded-b-2xl">

                                {/* 子模式选择 (放在输入框上方，左对齐，圆角长方形) */}
                                <div className="flex gap-2 mb-2 px-1 overflow-x-auto no-scrollbar">
                                    {(Object.keys(INSPIRATION_MODE_INFO) as InspirationSubMode[]).map(subMode => (
                                        <button
                                            key={subMode}
                                            onClick={() => setInspirationSubMode(subMode)}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${inspirationSubMode === subMode
                                                ? 'bg-white/10 border-white/20 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                                                : 'bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/70'
                                                }`}
                                        >
                                            {INSPIRATION_MODE_INFO[subMode].name}
                                        </button>
                                    ))}
                                </div>

                                {/* 6.2 Strict UI: Input Box Flowing Glow (Conditional) */}
                                <div
                                    className={`flex flex-col bg-white/5 rounded-xl transition-colors ai-input-container ${isRefining ? 'refining' : ''}`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    style={{
                                        // 常态静态光晕 + 边框颜色 (增强版)
                                        borderColor: isRefining ? 'transparent' : `rgba(${parseInt(xingConfig.inputGlow.colors[0].slice(1, 3), 16)}, ${parseInt(xingConfig.inputGlow.colors[0].slice(3, 5), 16)}, ${parseInt(xingConfig.inputGlow.colors[0].slice(5, 7), 16)}, ${xingConfig.inputGlow.borderOpacity})`,
                                        boxShadow: isRefining ? undefined : `
                                            0 0 ${xingConfig.inputGlow.thickBlur * 2}px ${xingConfig.inputGlow.colors[0]}${Math.round(Math.min(xingConfig.inputGlow.thickOpacity * 1.5, 1) * 255).toString(16).padStart(2, '0')},
                                            0 0 ${xingConfig.inputGlow.thinBlur * 2}px ${xingConfig.inputGlow.colors[1] || xingConfig.inputGlow.colors[0]}${Math.round(Math.min(xingConfig.inputGlow.thinOpacity * 1.5, 1) * 255).toString(16).padStart(2, '0')},
                                            0 0 ${xingConfig.inputGlow.thickBlur * 3}px ${xingConfig.inputGlow.colors[0]}20
                                        `,
                                    }}
                                >
                                    {/* 输入区域 - 左边textarea + 右边按钮 */}
                                    <div className="flex items-center gap-1 p-1">
                                        <textarea
                                            ref={textareaRef}
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            onPaste={handlePaste}
                                            placeholder="输入描述..."
                                            className="flex-1 bg-transparent text-white/90 placeholder-white/20 text-sm py-2 px-2 focus:outline-none resize-none overflow-hidden min-h-[40px]"
                                            rows={2}
                                        />
                                        {/* 右侧按钮 - 固定正方形，上下居中 */}
                                        <div className="flex-shrink-0 flex flex-col gap-1 self-center pr-1">
                                            {/* 自由对话模式下隐藏润色按钮 */}
                                            {inspirationSubMode !== 'freeChat' && (
                                                <button
                                                    onClick={handleRefine}
                                                    disabled={!inputValue.trim() || isRefining}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isRefining ? 'bg-white/20 text-white animate-pulse' : 'bg-transparent text-white/80 hover:text-white hover:bg-white/10'}`}
                                                    title="润色"
                                                    style={{ filter: `drop-shadow(0 0 5px ${xingConfig.gradient.colors[0]})` }}
                                                >
                                                    <Sparkles size={18} strokeWidth={1.5} />
                                                </button>
                                            )}
                                            <button
                                                onClick={handleSend}
                                                disabled={isGenerating || !inputValue.trim()}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 text-white/90 hover:bg-white/10"
                                                title="发送"
                                                style={{ filter: `drop-shadow(0 0 5px ${xingConfig.gradient.colors[2] || xingConfig.gradient.colors[1]})` }}
                                            >
                                                <Send size={18} strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 分隔线 */}
                                    <div className="border-t border-white/10 mx-2" />

                                    {/* 底部工具栏: [+] */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors text-sm"
                                            title="上传"
                                        >
                                            +
                                        </button>
                                        {/* 双模型选择器 (移入工具栏) */}
                                        <div className="relative ml-2 flex-1">
                                            <button
                                                onClick={() => setShowModelSelector(!showModelSelector)}
                                                className="flex items-center gap-3 text-[10px] text-white/40 hover:text-white/70 transition-colors focus:outline-none"
                                            >
                                                <span className="text-left">Chat: <span className="text-white/60">{currentChatModelName}</span></span>
                                                <span className="text-left">Image: <span className="text-white/60">{currentImageModelName}</span></span>
                                                <span className={`transform transition-transform duration-300 ml-1 ${showModelSelector ? 'rotate-180' : ''}`}>^</span>
                                            </button>

                                            {/* 模型选择面板 (向上弹出) */}
                                            {showModelSelector && (
                                                <div className="absolute bottom-full left-0 mb-2 w-[240px] z-50">
                                                    <div className="bg-[#1a1a24] rounded-xl p-3 grid grid-cols-2 gap-3 border border-white/10 shadow-2xl backdrop-blur-xl">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-1">对话模型</span>
                                                            {CHAT_MODELS.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => {
                                                                        setChatModel(m.id);
                                                                        if (inspirationSubMode === 'freeChat') {
                                                                            setFreeChatModelType('chat');
                                                                        }
                                                                        setShowModelSelector(false);
                                                                    }}
                                                                    className={`text-left text-[10px] py-1.5 px-2 rounded-lg transition-colors ${inspirationSubMode === 'freeChat'
                                                                        ? (freeChatModelType === 'chat' && chatModel === m.id ? 'bg-white/10 text-white ring-1 ring-white/30' : 'text-white/40 hover:text-white/80 hover:bg-white/5')
                                                                        : (chatModel === m.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5')
                                                                        }`}
                                                                >
                                                                    {m.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-1">生图模型</span>
                                                            {IMAGE_MODELS.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => {
                                                                        setImageModel(m.id);
                                                                        if (inspirationSubMode === 'freeChat') {
                                                                            setFreeChatModelType('image');
                                                                        }
                                                                        setShowModelSelector(false);
                                                                    }}
                                                                    className={`text-left text-[10px] py-1.5 px-2 rounded-lg transition-colors ${inspirationSubMode === 'freeChat'
                                                                        ? (freeChatModelType === 'image' && imageModel === m.id ? 'bg-white/10 text-white ring-1 ring-white/30' : 'text-white/40 hover:text-white/80 hover:bg-white/5')
                                                                        : (imageModel === m.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5')
                                                                        }`}
                                                                >
                                                                    {m.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 底部：双模型显示与切换 */}

                        </>
                    )}
                </div>
            </div >
        </>,
        document.body
    );
};

export default AIAssistantPanel;

