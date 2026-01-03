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

// 工具导入
import { CHAT_MODELS, IMAGE_MODELS, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL } from '../utils/ai/modelConfig';
import { INSPIRATION_MODE_INFO, InspirationSubMode } from '../utils/ai/refineTemplates';
import { XingSparkSettingsContent, XingSparkConfig, DEFAULT_XING_CONFIG, CHAT_FONT_OPTIONS } from './XingSparkSettings';

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
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    type?: 'text' | 'image' | 'error';
    imageUrl?: string;
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
    onSaveMagicCircleTexture
}) => {
    // === 模式状态 ===
    const [inspirationSubMode, setInspirationSubMode] = useState<InspirationSubMode>('background');

    // === 模型选择 ===
    const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
    const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
    const [showModelSelector, setShowModelSelector] = useState(false);

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
    const [xingConfig, setXingConfig] = useState<XingSparkConfig>(DEFAULT_XING_CONFIG);
    const [showXingSettings, setShowXingSettings] = useState(false);
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
            setShowXingSettings(true);
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
                        setXingConfig({
                            ...DEFAULT_XING_CONFIG,
                            ...loaded,
                            gradient: { ...DEFAULT_XING_CONFIG.gradient, ...loaded.gradient },
                            inputGlow: { ...DEFAULT_XING_CONFIG.inputGlow, ...loaded.inputGlow },
                            theme: { ...DEFAULT_XING_CONFIG.theme, ...loaded.theme },
                        });
                    }
                })
                .catch(err => console.error('加载 XingSpark 配置失败:', err));
        }
    }, [userId]);

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

    // === 发送 (生成图像) ===
    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isGenerating) return;

        const prompt = inputValue.trim();

        // 添加用户消息
        const userMsg: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: uploadedImage ? `[附图] ${prompt}` : prompt
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsGenerating(true);

        try {
            // 灵感模式：生成图片
            const res = await fetch('/api/ai/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    model: imageModel,
                    subMode: inspirationSubMode,
                    imageBase64: uploadedImage || undefined
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
    }, [inputValue, inspirationSubMode, imageModel, uploadedImage, isGenerating, clearUploadedImage]);

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
                magicCircle: 'magicCircleTexture'
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

    if (!isOpen) return null;

    // 当前选中的模型名称
    const currentChatModelName = CHAT_MODELS.find(m => m.id === chatModel)?.name || 'Chat';
    const currentImageModelName = IMAGE_MODELS.find(m => m.id === imageModel)?.name || 'Image';

    const saveButtonText: Record<InspirationSubMode, string> = {
        particleShape: '保存到头部',
        background: '保存到背景',
        magicCircle: '保存到法阵'
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
                    className={`w-[600px] ai-panel-container ${isRefining ? 'refining' : ''}`}
                // 样式由 CSS .ai-panel-container 控制 (4-segment breathe borders)
                >
                    {/* 4-Segment Breathe Borders */}
                    <div className="ai-panel-border-top"></div>
                    <div className="ai-panel-border-bottom"></div>
                    <div className="ai-panel-border-left"></div>
                    <div className="ai-panel-border-right"></div>

                    {/* 标题栏 (Drag Handle) */}
                    <div className="drag-handle flex items-center justify-between px-4 py-3 cursor-move border-b border-white/5">
                        <div className="flex items-center gap-2 relative">
                            {/* XingSpark Logo with Dynamic Gradient (Reference Style) */}
                            <span
                                className={`cursor-pointer select-none ${logoState === 'blinking' ? 'animate-pulse' : ''}`}
                                style={{
                                    fontFamily: `'${xingConfig.font}', cursive`,
                                    fontSize: '1.4rem',
                                    background: `conic-gradient(from 0deg at 50% 50%, ${[...xingConfig.gradient.colors, xingConfig.gradient.colors[0]].join(', ')})`,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                    filter: `saturate(${xingConfig.gradient.saturation}%) brightness(${xingConfig.gradient.brightness}%)`,
                                }}
                                onDoubleClick={handleLogoDoubleClick}
                                title="双击打开设置"
                            >
                                <span style={{ fontSize: '1em' }}>X</span>
                                <span style={{ fontSize: '0.9em' }}>ing</span>
                                <span style={{ fontSize: '1.25em', marginLeft: '-0.05em' }}>S</span>
                                <span style={{ fontSize: '0.9em' }}>park</span>
                            </span>
                            {/* 展开/收起指示 */}
                            {showXingSettings && (
                                <span className="text-xs text-white/30 ml-2">▼</span>
                            )}
                        </div>
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">✕</button>
                    </div>

                    {/* XingSpark 设置 - 显示在标题栏下方，无额外外框 */}
                    {showXingSettings && (
                        <div className="flex-1 min-h-0">
                            <XingSparkSettingsContent
                                config={xingConfig}
                                setConfig={setXingConfig}
                                onBack={() => setShowXingSettings(false)}
                            />
                        </div>
                    )}

                    {/* 消息列表 - 当设置面板关闭时显示 */}
                    {!showXingSettings && (
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
                                                {msg.subMode && (
                                                    <div className="mt-2 text-left">
                                                        <button
                                                            onClick={() => handleSavePreset(msg)}
                                                            disabled={savingId === msg.id || !userId}
                                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/90 text-xs rounded transition-colors backdrop-blur-sm"
                                                        >
                                                            {savingId === msg.id ? 'Saving...' : `💾 ${saveButtonText[msg.subMode]}`}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={`inline-block px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${msg.role === 'user'
                                                ? 'bg-blue-500/20 text-blue-100'
                                                : 'bg-white/5 text-white/80'
                                                }`}>
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
                    {!showXingSettings && (
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

                                {/* 真正的输入框 Wrapper - 应用 .ai-input-container */}
                                <div
                                    className={`flex items-end gap-2 bg-white/5 rounded-xl p-1 transition-colors ai-input-container ${isRefining ? 'refining' : ''}`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                >
                                    {/* 左：上传按钮 (+号) */}
                                    <div className="flex-shrink-0 mb-0.5">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors text-lg"
                                            title="上传"
                                        >
                                            +
                                        </button>
                                    </div>

                                    {/* 中：输入框 */}
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
                                        className="flex-1 bg-transparent text-white/90 placeholder-white/20 text-sm py-2 px-1 focus:outline-none resize-none overflow-hidden min-h-[40px]"
                                        rows={2}
                                    />

                                    {/* 右：功能按钮 (正方形) */}
                                    <div className="flex-shrink-0 flex gap-1 items-center pb-0.5">
                                        <button
                                            onClick={handleRefine}
                                            disabled={!inputValue.trim() || isRefining}
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg ${isRefining ? 'text-white animate-pulse' : 'text-white/40 hover:text-white hover:bg-white/10'
                                                } transition-colors`}
                                            title="润色"
                                        >
                                            ✨
                                        </button>
                                        <button
                                            onClick={handleSend}
                                            disabled={isGenerating || !inputValue.trim()}
                                            style={{ height: textareaRef.current ? Math.min(Math.max(textareaRef.current.scrollHeight, 40), 120) : 40 }}
                                            className="w-10 flex items-center justify-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 transition-all disabled:opacity-30 disabled:hover:bg-white/10"
                                        >
                                            ➤
                                        </button>
                                    </div>

                                </div>
                            </div>

                            {/* 底部：双模型显示与切换 */}
                            <div className="relative border-t border-white/5">
                                <button
                                    onClick={() => setShowModelSelector(!showModelSelector)}
                                    className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                                >
                                    <div className="flex gap-4">
                                        <span>Chat: <span className="text-white/50">{currentChatModelName}</span></span>
                                        <span>Image: <span className="text-white/50">{currentImageModelName}</span></span>
                                    </div>
                                    <span className={`transform transition-transform duration-300 ${showModelSelector ? 'rotate-180' : ''}`}>^</span>
                                </button>

                                {/* 模型选择面板 (展开) */}
                                {showModelSelector && (
                                    <div className="absolute bottom-full left-0 w-full px-2 mb-1">
                                        <div className="bg-[#1a1a24] rounded-xl p-3 grid grid-cols-2 gap-4 border border-white/10 shadow-2xl">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-1">对话模型</span>
                                                {CHAT_MODELS.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setChatModel(m.id)}
                                                        className={`text-left text-xs py-1.5 px-2 rounded-lg transition-colors ${chatModel === m.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
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
                                                        onClick={() => setImageModel(m.id)}
                                                        className={`text-left text-xs py-1.5 px-2 rounded-lg transition-colors ${imageModel === m.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
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
                        </>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default AIAssistantPanel;

