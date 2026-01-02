/**
 * XingForge AI - Main Assistant Panel (Inspiration Mode v2.0)
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
    // 原有的 scopeSelection 状态已移除（创造模式简化重构）

    // === 模型选择 ===
    const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
    const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
    const [showSettings, setShowSettings] = useState(false);

    // === 输入状态 ===
    const [inputValue, setInputValue] = useState('');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // === 聊天状态 ===
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: '🎨 **灵感模式**\n\n选择子功能后，输入描述并点击 ✨ 润色或直接发送。\n\n支持上传参考图片进行分析。'
        }
    ]);

    // === 图片预览 ===
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // === 保存状态 ===
    const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    // === 窗口拖拽 ===
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 320, y: 100 });
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
                // 润色结果替换输入框
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

                // 清理上传的图片
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
            // 1. 下载图片
            const imgRes = await fetch(msg.imageUrl);
            const blob = await imgRes.blob();

            // 2. 上传到云端
            const name = customName || msg.suggestedName || 'AI生成';
            const typeMap: Record<InspirationSubMode, string> = {
                particleShape: 'headTexture',
                background: 'background',
                magicCircle: 'magicCircleTexture'
            };
            const fileType = typeMap[msg.subMode || 'magicCircle'];

            const uploadRes = await fetch(
                `/api/upload?userId=${userId}&type=${fileType}&fileName=${encodeURIComponent(name)}.png`,
                {
                    method: 'POST',
                    body: blob
                }
            );
            const uploadData = await uploadRes.json();

            if (!uploadData.url) {
                throw new Error('上传失败');
            }

            // 3. 创建预设
            const preset: AIGeneratedPreset = {
                id: generateId(),
                name,
                url: uploadData.url,
                createdAt: Date.now()
            };

            // 4. 调用对应回调
            if (msg.subMode === 'particleShape' && onSaveHeadTexture) {
                onSaveHeadTexture(preset);
            } else if (msg.subMode === 'background' && onSaveBackground) {
                onSaveBackground(preset);
            } else if (msg.subMode === 'magicCircle' && onSaveMagicCircleTexture) {
                onSaveMagicCircleTexture(preset);
            }

            setMessages(prev => prev.map(m =>
                m.id === msg.id
                    ? { ...m, content: `✅ 已保存: ${name}` }
                    : m
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

    // ============================================
    // 渲染
    // ============================================

    const saveButtonText: Record<InspirationSubMode, string> = {
        particleShape: '保存到头部样式',
        background: '保存到背景预设',
        magicCircle: '保存到法阵贴图'
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
                    className="w-[640px] rounded-2xl overflow-hidden shadow-2xl"
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
                            <span className="text-white/40 text-xs">灵感模式 v2.0</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white/90">⚙️</button>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">✕</button>
                        </div>
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

                    {/* 灵感子模式 */}
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

                    {/* 消息列表 */}
                    <div className="h-[280px] overflow-y-auto p-3 space-y-3">
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
                                            <img
                                                src={msg.imageUrl}
                                                alt="Generated"
                                                className="max-w-full max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setPreviewImage(msg.imageUrl!)}
                                            />
                                            <p className="text-xs text-white/50 mt-1">点击图片放大查看</p>

                                            {/* 保存区域 */}
                                            {msg.subMode && (
                                                <div className="mt-3 p-2 bg-black/20 rounded-lg">
                                                    {editingName?.id === msg.id ? (
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                value={editingName.name}
                                                                onChange={e => setEditingName({ ...editingName, name: e.target.value })}
                                                                className="flex-1 bg-white/10 text-white/90 text-sm rounded px-2 py-1 border border-white/20"
                                                                placeholder="输入名称"
                                                            />
                                                            <button
                                                                onClick={() => handleSavePreset(msg, editingName.name)}
                                                                disabled={savingId === msg.id}
                                                                className="px-2 py-1 bg-green-500/30 text-green-200 rounded text-sm hover:bg-green-500/40 disabled:opacity-50"
                                                            >
                                                                {savingId === msg.id ? '...' : '确定'}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingName(null)}
                                                                className="px-2 py-1 bg-white/10 text-white/60 rounded text-sm hover:bg-white/20"
                                                            >
                                                                取消
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 items-center">
                                                            <span className="text-sm text-white/60">名称:</span>
                                                            <span className="text-sm text-white/80">{msg.suggestedName}</span>
                                                            <button
                                                                onClick={() => setEditingName({ id: msg.id, name: msg.suggestedName || '' })}
                                                                className="text-xs text-white/40 hover:text-white/60"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <div className="flex-1" />
                                                            <button
                                                                onClick={() => handleSavePreset(msg)}
                                                                disabled={savingId === msg.id || !userId}
                                                                className="px-3 py-1 bg-blue-500/30 text-blue-200 rounded-lg text-sm hover:bg-blue-500/40 disabled:opacity-50"
                                                            >
                                                                {savingId === msg.id ? '保存中...' : `💾 ${saveButtonText[msg.subMode]}`}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {!userId && (
                                                        <p className="text-xs text-yellow-300/60 mt-1">⚠️ 请先登录以保存预设</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isGenerating && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 rounded-xl px-4 py-2 text-white/60 animate-pulse">
                                    🎨 生成中...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 上传图片预览 */}
                    {uploadedImage && (
                        <div className="px-3 py-2 bg-purple-500/10 border-t border-purple-400/20">
                            <div className="flex items-center gap-2">
                                <img
                                    src={uploadedImage}
                                    alt="Upload"
                                    className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setPreviewImage(uploadedImage)}
                                    title="点击放大预览"
                                />
                                <span className="text-xs text-purple-200 flex-1">已上传参考图片 (点击放大)</span>
                                <button onClick={clearUploadedImage} className="text-xs text-white/40 hover:text-white/60">✕ 移除</button>
                            </div>
                        </div>
                    )}

                    {/* 输入区 (支持拖拽图片) */}
                    <div
                        className="p-3 border-t border-white/10"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <div className="flex gap-2 items-end">
                            {/* 图片上传按钮 */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80"
                                title="上传参考图片"
                            >
                                📎
                            </button>

                            {/* 输入框 (支持粘贴图片) */}
                            <textarea
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                onPaste={handlePaste}
                                placeholder={`描述你想要的${INSPIRATION_MODE_INFO[inspirationSubMode].name}... (可粘贴/拖拽图片)`}
                                className="flex-1 bg-white/10 text-white/90 placeholder-white/30 rounded-xl px-4 py-2 text-sm border border-white/10 focus:border-blue-400/50 focus:outline-none resize-none"
                                rows={2}
                            />

                            {/* 润色按钮 */}
                            <button
                                onClick={handleRefine}
                                disabled={!inputValue.trim() || isRefining}
                                className={`px-3 py-2 rounded-xl text-sm font-medium bg-purple-500/30 text-purple-200 hover:bg-purple-500/40 disabled:opacity-30 ${isRefining ? 'animate-pulse' : ''}`}
                                title="AI 润色提示词"
                            >
                                {isRefining ? '...' : '✨'}
                            </button>

                            {/* 发送按钮 */}
                            <button
                                onClick={handleSend}
                                disabled={isGenerating || !inputValue.trim()}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/30 text-blue-200 hover:bg-blue-500/40 disabled:opacity-30"
                            >
                                ➤
                            </button>
                        </div>
                    </div>

                    {/* 状态栏 */}
                    <div className="px-3 py-1.5 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
                        <span>
                            {`对话: ${CHAT_MODELS.find(m => m.id === chatModel)?.name} | 生图: ${IMAGE_MODELS.find(m => m.id === imageModel)?.name}`}
                        </span>
                        <span>Enter 发送 | Shift+Enter 换行</span>
                    </div>
                </div>
            </div>

            {/* 图片放大预览 Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10001] cursor-pointer"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                        <button
                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full text-white hover:bg-black/70 flex items-center justify-center"
                            onClick={() => setPreviewImage(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>,
        document.body
    );
};

export default AIAssistantPanel;
