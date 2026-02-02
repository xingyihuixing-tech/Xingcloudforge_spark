/**
 * XingForge AI - Main Assistant Panel (Inspiration Mode v2.1)
 * 
 * input: isOpen, onClose, callbacks for presets
 * output: AI 交互面板 UI
 * pos: AI 系统的主入口组件
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Send, X, Save, Play, RotateCcw, Code, Check, Archive, Power, Trash2, Copy } from 'lucide-react';

// 工具导入
import { CHAT_MODELS, IMAGE_MODELS, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL } from '../utils/ai/modelConfig';
import { INSPIRATION_MODE_INFO, InspirationSubMode } from '../utils/ai/refineTemplates';
import { XingSparkSettingsPanel, XingSparkConfig, DEFAULT_XING_CONFIG, CHAT_FONT_OPTIONS } from './XingSparkSettings';
import { useUser } from '../contexts/UserContext';

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
    // 强制保存回调
    onForceSave?: () => void;
    // 生成完成回调
    onGenerationComplete?: () => void;
    // 效果参数编辑器回调
    onEffectSelect?: (effect: {
        id: string;
        name: string;
        params?: any[];
        paramsAnalyzing?: boolean;
    } | null) => void;
    onParamChange?: (effectId: string, paramId: string, newValue: any) => void;
    onResetParam?: (effectId: string, paramId: string) => void;
    onResetAllParams?: (effectId: string) => void;
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
                        📋 📋 复制 URL
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
    onConfigChange,
    onForceSave,
    onGenerationComplete,
    onEffectSelect,
    onParamChange,
    onResetParam,
    onResetAllParams
}) => {
    // === 模式状态 ===
    const [inspirationSubMode, setInspirationSubMode] = useState<InspirationSubMode>('background');
    const [isMinimized, setIsMinimized] = useState(false);

    // === 模型选择 (从配置持久化读取) ===
    const [chatModel, setChatModelState] = useState(xingConfig.chatModel || DEFAULT_CHAT_MODEL);
    const [imageModel, setImageModelState] = useState(xingConfig.imageModel || DEFAULT_IMAGE_MODEL);
    const [showModelSelector, setShowModelSelector] = useState(false);
    // 自由对话模式下，当前选中的模型类型 ('chat' 或 'image')
    const [freeChatModelType, setFreeChatModelType] = useState<'chat' | 'image'>('chat');

    // 模型变更处理器 (同步持久化)
    const setChatModel = useCallback((model: string) => {
        setChatModelState(model);
        onConfigChange(prev => ({ ...prev, chatModel: model }));
    }, [onConfigChange]);

    const setImageModel = useCallback((model: string) => {
        setImageModelState(model);
        onConfigChange(prev => ({ ...prev, imageModel: model }));
    }, [onConfigChange]);

    // === 输入状态 ===
    const [inputValue, setInputValue] = useState('');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // === 消息队列 ===
    interface QueuedMessage {
        id: string;
        content: string;
        uploadedImage?: string | null;
    }
    const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    // === 聊天状态 (初始为空) ===
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // === 图片预览 ===
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // === 保存状态 ===
    const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    // 创造模式对象历史
    const [createdObjectsHistory, setCreatedObjectsHistory] = useState<Map<string, any[]>>(new Map());

    // 可编辑参数接口
    interface EditableParam {
        id: string;
        name: string;
        varName: string;
        type: 'number' | 'color' | 'boolean';
        value: any;
        originalValue: any;
        min?: number;
        max?: number;
        step?: number;
    }

    // 场景对象管理器 (Saved Effects)
    // 本地运行时的对象引用（不序列化）
    interface SavedEffect {
        id: string;
        name: string;
        code: string;
        objects: any[]; // Three.js 对象引用，仅存在于内存
        isActive: boolean;
        params?: EditableParam[];      // 可编辑参数
        paramsAnalyzing?: boolean;     // 正在分析参数
    }
    // 云端存储的数据结构（不包含 objects）
    interface CloudSavedEffect {
        id: string;
        name: string;
        code: string;
        isActive: boolean;
        createdAt: number;
        params?: EditableParam[];      // 同步参数到云端
    }
    const [savedEffects, setSavedEffects] = useState<SavedEffect[]>([]);
    const [showArchive, setShowArchive] = useState(false);
    const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null); // 选中的效果（用于左侧参数面板）
    const [effectsLoaded, setEffectsLoaded] = useState(false); // 防止重复加载
    const lastSyncedEffectsRef = useRef<string>('[]'); // 初始化为空数组，防止误覆盖云端数据

    // 云同步 hooks
    const { loadCloudConfig, saveCloudConfig } = useUser();

    // === XingSpark 设置 ===
    const [showSettings, setShowSettings] = useState(false);
    // xingConfig moved to props
    const [logoState, setLogoState] = useState<'idle' | 'blinking'>('idle');
    const lastDoubleClickRef = useRef(0);
    const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // === 窗口拖拽 ===
    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 初始化位置：优先读取配置，否则默认在顶部下方 (避开导航栏)
    const [savedPosition, setSavedPosition] = useState(() => {
        if (xingConfig.panelPosition) {
            return xingConfig.panelPosition;
        }
        return {
            x: Math.max(0, (window.innerWidth - 600) / 2),
            y: 80 // 默认 Y 坐标，避开顶部导航栏
        };
    });

    const dragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialLeft: 0,
        initialTop: 0
    });

    // 最小化时的位置锚点 (底部 Y 坐标)
    const bottomAnchorRef = useRef<number | null>(null);

    // 监听最小化状态变化，同步调整位置 (防止视觉跳动)
    useLayoutEffect(() => {
        if (bottomAnchorRef.current !== null && panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect();
            const newHeight = rect.height;
            // 新的 Top = 之前的 Bottom - 新的高度
            const newTop = bottomAnchorRef.current - newHeight;

            setSavedPosition(prev => ({
                ...prev,
                y: Math.max(0, newTop)
            }));

            // 如果是展开操作，可能需要更新配置中的位置? 
            // 暂时只更新本地 state，拖拽结束才保存到配置
            bottomAnchorRef.current = null;
        }
    }, [isMinimized]); // 依赖 isMinimized 变化后触发

    // === 最小化逻辑 ===
    const handleToggleMinimize = (minimize: boolean) => {
        if (panelRef.current) {
            // 记录当前的底部位置作为锚点
            const rect = panelRef.current.getBoundingClientRect();
            bottomAnchorRef.current = rect.top + rect.height;
        }
        setIsMinimized(minimize);
    };

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!dragRef.current.isDragging || !panelRef.current) return;
        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;
        panelRef.current.style.left = `${dragRef.current.initialLeft + deltaX}px`;
        panelRef.current.style.top = `${dragRef.current.initialTop + deltaY}px`;
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragRef.current.isDragging) return;
        dragRef.current.isDragging = false;
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        if (panelRef.current) {
            panelRef.current.style.cursor = 'default';
            const style = window.getComputedStyle(panelRef.current);
            const newPos = {
                x: parseInt(style.left || '0', 10),
                y: parseInt(style.top || '0', 10)
            };
            setSavedPosition(newPos);

            // 持久化保存位置
            onConfigChange(prev => ({
                ...prev,
                panelPosition: newPos
            }));
        }
    }, [handleDragMove, onConfigChange]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return;
        e.preventDefault();
        const style = window.getComputedStyle(panelRef.current);
        dragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialLeft: parseInt(style.left || '0', 10),
            initialTop: parseInt(style.top || '0', 10)
        };
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        panelRef.current.style.cursor = 'grabbing';
    }, [handleDragMove, handleDragEnd]);

    // 清理事件监听器
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        };
    }, [handleDragMove, handleDragEnd]);

    // === 触摸拖拽处理 (长按逻辑) ===
    const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPosRef = useRef({ x: 0, y: 0 });
    const isTouchDraggingRef = useRef(false);

    // 触摸移动处理
    const handleTouchMove = useCallback((e: TouchEvent) => {
        // 如果正在拖拽，执行移动逻辑
        if (isTouchDraggingRef.current && panelRef.current) {
            e.preventDefault(); // 防止滚动
            const touch = e.touches[0];
            const deltaX = touch.clientX - dragRef.current.startX;
            const deltaY = touch.clientY - dragRef.current.startY;
            panelRef.current.style.left = `${dragRef.current.initialLeft + deltaX}px`;
            panelRef.current.style.top = `${dragRef.current.initialTop + deltaY}px`;
            return;
        }

        // 如果还没开始拖拽（在长按等待期），检查移动距离
        if (touchTimerRef.current) {
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - touchStartPosRef.current.x);
            const moveY = Math.abs(touch.clientY - touchStartPosRef.current.y);

            // 如果移动超过 10px，取消长按判定
            if (moveX > 10 || moveY > 10) {
                if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                touchTimerRef.current = null;
            }
        }
    }, []);

    // 触摸结束处理
    const handleTouchEnd = useCallback(() => {
        // 清理定时器
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }

        // 移除监听
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);

        // 如果是拖拽结束，保存位置
        if (isTouchDraggingRef.current && panelRef.current) {
            isTouchDraggingRef.current = false;
            dragRef.current.isDragging = false;

            // 恢复光标/样式
            panelRef.current.style.transform = 'none'; // 移除可能的缩放反馈

            const style = window.getComputedStyle(panelRef.current);
            const newPos = {
                x: parseInt(style.left || '0', 10),
                y: parseInt(style.top || '0', 10)
            };
            setSavedPosition(newPos);

            onConfigChange(prev => ({
                ...prev,
                panelPosition: newPos
            }));
        }
    }, [handleTouchMove, onConfigChange]);

    // 触摸开始处理
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!panelRef.current) return;

        // 记录初始触摸信息
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

        // 记录当前面板位置，为可能的拖拽做准备
        const style = window.getComputedStyle(panelRef.current);
        dragRef.current = {
            isDragging: false, // 尚未开始，等待长按
            startX: touch.clientX,
            startY: touch.clientY,
            initialLeft: parseInt(style.left || '0', 10),
            initialTop: parseInt(style.top || '0', 10)
        };

        // 设置长按定时器 (500ms)
        touchTimerRef.current = setTimeout(() => {
            isTouchDraggingRef.current = true;
            dragRef.current.isDragging = true;

            // 视觉反馈
            if (panelRef.current) {
                // 简单的缩放反馈提示已激活拖拽
                // 注意：这里直接操作 style，不触发重渲染
                // panelRef.current.style.transform = 'scale(1.02)';
                // 由于 scale 可能会影响布局计算，这里仅做轻微反馈或忽略
            }

            // 震动反馈 (如果设备支持)
            if (navigator.vibrate) navigator.vibrate(50);

        }, 500);

        // 添加全局监听 (passive: false 以便能 preventDefault)
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchcancel', handleTouchEnd);
    }, [handleTouchMove, handleTouchEnd]);
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

    // 加载云端配置 - REMOVED: App.tsx manages configuration to avoid double-fetch conflicts settings reset.
    // useEffect(() => { ... }, [userId, onConfigChange]);

    // 自动滚动到底部
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
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
                    subMode: inspirationSubMode === 'creation' ? 'creation_refine' : inspirationSubMode, // 创造模式使用专用润色
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

    // === 规范化换行（避免过多空行） ===
    const normalizeLineBreaks = (text: string) => {
        return text
            .replace(/\r\n/g, '\n')       // 统一换行符
            .replace(/\n{3,}/g, '\n\n')   // 连续3+换行 -> 2换行
            .trim();
    };

    // === 发送 ===
    const handleSend = useCallback(async () => {
        if (!inputValue.trim()) return;

        const prompt = normalizeLineBreaks(inputValue);
        const currentAttachedImage = uploadedImage;

        // 如果正在生成，加入队列
        if (isGenerating) {
            const queuedMsg: QueuedMessage = {
                id: generateId(),
                content: prompt,
                uploadedImage: currentAttachedImage
            };
            setMessageQueue(prev => [...prev, queuedMsg]);
            setInputValue('');
            clearUploadedImage();
            return;
        }

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
                // 创造模式：生成代码 (使用 Refine API)
                if (inspirationSubMode === 'creation') {
                    // [上下文记忆] 构建完整上下文
                    let contextHistory = '';

                    // 1. 添加最近 6 轮对话历史（12 条消息），完整内容
                    const recentMessages = messages.slice(-12);
                    if (recentMessages.length > 0) {
                        const historyText = recentMessages.map(m => {
                            const role = m.role === 'user' ? '用户' : 'AI';
                            // 完整内容，不压缩
                            return `${role}: ${m.content}`;
                        }).join('\n');
                        contextHistory += `\n\n【对话历史】\n${historyText}`;
                    }

                    // 2. 添加已保存效果摘要
                    if (savedEffects.length > 0) {
                        const effectsSummary = savedEffects.slice(-3).map(e => `- ${e.name}`).join('\n');
                        contextHistory += `\n\n【已创建并保存的对象】\n${effectsSummary}\n\n用户可能会引用上述历史内容或对象。`;
                    }

                    const res = await fetch('/api/ai/refine', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: prompt + contextHistory,
                            mode: 'inspiration',
                            subMode: 'creation_generate', // 创造模式使用专用生成
                            model: chatModel
                        })
                    });
                    const data = await res.json();
                    if (data.refined) {
                        setMessages(prev => [...prev, {
                            id: generateId(),
                            role: 'assistant',
                            content: data.refined,
                            subMode: 'creation', // 标记为 creation 模式，触发 CodeCard 渲染
                            type: 'text'
                        }]);
                        // 通知外部生成完成
                        if (onGenerationComplete) onGenerationComplete();
                    } else {
                        throw new Error(data.error || '代码生成失败');
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

                        // 通知外部生成完成
                        if (onGenerationComplete) onGenerationComplete();

                    } else {
                        throw new Error(data.error || '图片生成失败');
                    }
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
            abortControllerRef.current = null;
        }
    }, [inputValue, inspirationSubMode, imageModel, chatModel, freeChatModelType, uploadedImage, isGenerating, clearUploadedImage, messages]);

    // === 处理队列中的下一条消息 ===
    const processNextInQueue = useCallback(() => {
        setMessageQueue(prev => {
            if (prev.length === 0) return prev;
            const [next, ...rest] = prev;
            // 延迟处理，确保状态更新完成
            setTimeout(() => {
                setInputValue(next.content);
                if (next.uploadedImage) {
                    setUploadedImage(next.uploadedImage);
                }
                // 需要手动触发发送
            }, 100);
            return rest;
        });
    }, []);

    // 当生成完成且队列非空时，自动处理下一条
    useEffect(() => {
        if (!isGenerating && messageQueue.length > 0) {
            const next = messageQueue[0];
            setMessageQueue(prev => prev.slice(1));
            // 直接设置输入并自动发送
            setInputValue(next.content);
            if (next.uploadedImage) {
                setUploadedImage(next.uploadedImage);
            }
            // 延迟发送
            setTimeout(() => {
                const sendBtn = document.querySelector('[data-send-btn]') as HTMLButtonElement;
                if (sendBtn) sendBtn.click();
            }, 200);
        }
    }, [isGenerating, messageQueue]);

    // === 停止生成 ===
    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
    }, []);

    // === 创造模式逻辑 ===
    const handleRunCode = useCallback((code: string, messageId: string) => {
        try {
            // 使用主场景
            const context = (window as any).xingPlanetScene;
            if (!context) throw new Error("场景上下文未找到 (请确保在星球场景中)");

            const {
                scene, THREE, camera, renderer, controls,
                registerUpdate, unregisterUpdate,
                bloomPass, setBloom, setFog
            } = context;

            // 记录执行前的场景子对象
            const childrenBefore = new Set(scene.children);

            // 清理代码块标记
            const cleanCode = code.replace(/```javascript|```/g, '').trim();

            // 构造执行函数（传入 document 以支持纹理创建）
            const func = new Function(
                'scene', 'THREE', 'camera', 'renderer', 'controls',
                'registerUpdate', 'unregisterUpdate',
                'bloomPass', 'setBloom', 'setFog',
                'document',
                cleanCode
            );

            // 执行
            const result = func(
                scene, THREE, camera, renderer, controls,
                registerUpdate, unregisterUpdate,
                bloomPass, setBloom, setFog,
                document
            );

            // 查找新增的对象（对比执行前后场景子对象）
            const newObjects: any[] = [];
            scene.children.forEach((child: any) => {
                if (!childrenBefore.has(child)) {
                    newObjects.push(child);
                }
            });

            // 如果有明确 return 的对象，也加入（防止重复）
            if (result && result.isObject3D && !newObjects.includes(result)) {
                newObjects.push(result);
            }

            // 追踪创建的对象
            if (newObjects.length > 0) {
                setCreatedObjectsHistory(prev => {
                    const next = new Map(prev);
                    next.set(messageId, newObjects);
                    return next;
                });
                console.log(`[Creation Mode] Tracked ${newObjects.length} new object(s)`);
            } else {
                console.warn('[Creation Mode] No new objects detected after code execution');
            }

        } catch (e: any) {
            console.error('[Creation Mode] Execution error:', e);
        }
    }, []);

    const handleUndo = useCallback((messageId: string) => {
        const objects = createdObjectsHistory.get(messageId);
        if (objects) {
            // 优先使用独立画布
            const context = (window as any).xingPlanetScene;
            if (context) {
                objects.forEach((obj: any) => context.scene.remove(obj));
            }
            setCreatedObjectsHistory(prev => {
                const next = new Map(prev);
                next.delete(messageId);
                return next;
            });
        }
    }, [createdObjectsHistory]);

    // === 保存效果到管理器 ===
    const handleSaveEffect = useCallback(async (code: string, messageId: string) => {
        const objects = createdObjectsHistory.get(messageId);
        if (!objects || objects.length === 0) return;

        const cleanCode = code.replace(/```javascript|```/g, '').trim();
        const effectId = generateId();

        const newEffect: SavedEffect = {
            id: effectId,
            name: `效果 ${savedEffects.length + 1}`,
            code: cleanCode,
            objects: objects,
            isActive: true,
            params: [],
            paramsAnalyzing: true  // 标记正在分析
        };
        setSavedEffects(prev => [...prev, newEffect]);

        // 从历史中移除，现在由管理器控制
        setCreatedObjectsHistory(prev => {
            const next = new Map(prev);
            next.delete(messageId);
            return next;
        });

        // 后台分析参数（用户无感知）
        try {
            const res = await fetch('/api/ai/analyze-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: cleanCode })
            });
            const data = await res.json();

            if (data.params && data.params.length > 0) {
                // 为每个参数添加 id 和 originalValue
                const paramsWithId: EditableParam[] = data.params.map((p: any) => ({
                    ...p,
                    id: generateId(),
                    originalValue: p.value
                }));

                // 更新效果的参数
                setSavedEffects(prev => prev.map(e =>
                    e.id === effectId
                        ? { ...e, params: paramsWithId, paramsAnalyzing: false }
                        : e
                ));
                console.log(`[Creation Mode] Extracted ${paramsWithId.length} params for effect ${effectId}`);
            } else {
                setSavedEffects(prev => prev.map(e =>
                    e.id === effectId
                        ? { ...e, paramsAnalyzing: false }
                        : e
                ));
            }
        } catch (err) {
            console.error('[Creation Mode] Param analysis failed:', err);
            setSavedEffects(prev => prev.map(e =>
                e.id === effectId
                    ? { ...e, paramsAnalyzing: false }
                    : e
            ));
        }
    }, [createdObjectsHistory, savedEffects.length]);

    // === 独立的参数分析函数（供保存和选中时复用）===
    const analyzeEffectParams = useCallback(async (effectId: string) => {
        const effect = savedEffects.find(e => e.id === effectId);
        if (!effect || !effect.code) return;

        // 标记正在分析
        setSavedEffects(prev => prev.map(e =>
            e.id === effectId ? { ...e, paramsAnalyzing: true } : e
        ));

        try {
            const res = await fetch('/api/ai/analyze-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: effect.code })
            });
            const data = await res.json();

            if (data.params && data.params.length > 0) {
                const paramsWithId: EditableParam[] = data.params.map((p: any) => ({
                    ...p,
                    id: generateId(),
                    originalValue: p.value
                }));

                setSavedEffects(prev => prev.map(e =>
                    e.id === effectId
                        ? { ...e, params: paramsWithId, paramsAnalyzing: false }
                        : e
                ));
                console.log(`[Creation Mode] Analyzed ${paramsWithId.length} params for effect ${effectId}`);
            } else {
                setSavedEffects(prev => prev.map(e =>
                    e.id === effectId
                        ? { ...e, paramsAnalyzing: false }
                        : e
                ));
                console.log(`[Creation Mode] No params found for effect ${effectId}`);
            }
        } catch (err) {
            console.error('[Creation Mode] Param analysis failed:', err);
            setSavedEffects(prev => prev.map(e =>
                e.id === effectId
                    ? { ...e, paramsAnalyzing: false }
                    : e
            ));
        }
    }, [savedEffects]);

    // === 切换效果开关 ===
    const handleToggleEffect = useCallback((effectId: string) => {
        setSavedEffects(prev => prev.map(e => {
            if (e.id === effectId) {
                const context = (window as any).xingPlanetScene;
                if (context) {
                    if (e.isActive) {
                        // 关闭：从场景移除
                        e.objects.forEach(obj => context.scene.remove(obj));
                        return { ...e, isActive: false };
                    } else {
                        // 开启：检查 objects 是否为空
                        let objectsToAdd = e.objects;

                        if (objectsToAdd.length === 0 && e.code) {
                            // objects 为空，需要重新执行代码创建对象
                            try {
                                const {
                                    scene, THREE, camera, renderer, controls,
                                    registerUpdate, unregisterUpdate,
                                    bloomPass, setBloom, setFog
                                } = context;
                                const childrenBefore = new Set(scene.children);

                                const cleanCode = e.code.replace(/```javascript|```/g, '').trim();
                                const func = new Function(
                                    'scene', 'THREE', 'camera', 'renderer', 'controls',
                                    'registerUpdate', 'unregisterUpdate',
                                    'bloomPass', 'setBloom', 'setFog',
                                    'document',
                                    cleanCode
                                );
                                const result = func(
                                    scene, THREE, camera, renderer, controls,
                                    registerUpdate, unregisterUpdate,
                                    bloomPass, setBloom, setFog,
                                    document
                                );

                                const newObjects: any[] = [];
                                scene.children.forEach((child: any) => {
                                    if (!childrenBefore.has(child)) {
                                        newObjects.push(child);
                                    }
                                });
                                if (result && result.isObject3D && !newObjects.includes(result)) {
                                    newObjects.push(result);
                                }
                                objectsToAdd = newObjects;
                                console.log('[Creation Mode] Re-executed code, created', newObjects.length, 'objects');
                            } catch (err) {
                                console.error('[Creation Mode] Failed to re-execute code:', err);
                            }
                        } else {
                            // objects 不为空，直接添加回场景
                            objectsToAdd.forEach(obj => context.scene.add(obj));
                        }

                        return { ...e, objects: objectsToAdd, isActive: true };
                    }
                }
                return { ...e, isActive: !e.isActive };
            }
            return e;
        }));
    }, []);

    // === 删除效果 ===
    const handleDeleteEffect = useCallback((effectId: string) => {
        setSavedEffects(prev => {
            const effect = prev.find(e => e.id === effectId);
            if (effect) {
                // 优先使用独立画布
                const context = (window as any).xingPlanetScene;
                if (context && effect.isActive) {
                    effect.objects.forEach(obj => context.scene.remove(obj));
                }
            }
            return prev.filter(e => e.id !== effectId);
        });
        // 如果删除的是当前选中效果，清除选中
        if (selectedEffectId === effectId) {
            setSelectedEffectId(null);
        }
    }, [selectedEffectId]);

    // === 选中效果通知父组件 ===
    useEffect(() => {
        if (onEffectSelect) {
            const selectedEffect = savedEffects.find(e => e.id === selectedEffectId);
            if (selectedEffect) {
                onEffectSelect({
                    id: selectedEffect.id,
                    name: selectedEffect.name,
                    params: selectedEffect.params,
                    paramsAnalyzing: selectedEffect.paramsAnalyzing
                });
            } else {
                onEffectSelect(null);
            }
        }
    }, [selectedEffectId, savedEffects, onEffectSelect]);

    // === 参数变更处理（内部实现） ===
    const handleInternalParamChange = useCallback((effectId: string, paramId: string, newValue: any) => {
        setSavedEffects(prev => prev.map(effect => {
            if (effect.id !== effectId) return effect;

            // 1. 更新参数值
            const newParams = effect.params?.map(p =>
                p.id === paramId ? { ...p, value: newValue } : p
            );

            // 2. 更新代码中的参数值
            let newCode = effect.code;
            const param = effect.params?.find(p => p.id === paramId);
            if (param) {
                // 根据类型格式化值
                let formattedValue: string;
                if (param.type === 'color') {
                    formattedValue = typeof newValue === 'string' && newValue.startsWith('#')
                        ? '0x' + newValue.replace('#', '')
                        : String(newValue);
                } else {
                    formattedValue = String(newValue);
                }

                // 替换代码中的值
                const patterns = [
                    new RegExp(`(const\\s+${param.varName}\\s*=\\s*)[^;\\n]+`, 'g'),
                    new RegExp(`(${param.varName}\\s*:\\s*)[^,}\\n]+`, 'g')
                ];
                patterns.forEach(regex => {
                    newCode = newCode.replace(regex, `$1${formattedValue}`);
                });
            }

            // 3. 移除旧对象
            const context = (window as any).xingPlanetScene;
            if (context && effect.isActive) {
                effect.objects.forEach(obj => context.scene.remove(obj));
            }

            // 4. 重新执行代码
            let newObjects: any[] = [];
            if (context && effect.isActive) {
                try {
                    const { scene, THREE, camera, renderer, controls,
                        registerUpdate, unregisterUpdate,
                        bloomPass, setBloom, setFog } = context;
                    const childrenBefore = new Set(scene.children);

                    const func = new Function(
                        'scene', 'THREE', 'camera', 'renderer', 'controls',
                        'registerUpdate', 'unregisterUpdate',
                        'bloomPass', 'setBloom', 'setFog', 'document',
                        newCode
                    );
                    func(scene, THREE, camera, renderer, controls,
                        registerUpdate, unregisterUpdate,
                        bloomPass, setBloom, setFog, document);

                    scene.children.forEach((child: any) => {
                        if (!childrenBefore.has(child)) {
                            newObjects.push(child);
                        }
                    });
                    console.log(`[Creation Mode] Re-executed with updated param, created ${newObjects.length} objects`);
                } catch (err) {
                    console.error('[Creation Mode] Re-execution failed:', err);
                    newObjects = effect.objects; // 保持原对象
                }
            }

            return { ...effect, params: newParams, code: newCode, objects: newObjects };
        }));
    }, []);

    // === 重置单个参数 ===
    const handleInternalResetParam = useCallback((effectId: string, paramId: string) => {
        const effect = savedEffects.find(e => e.id === effectId);
        const param = effect?.params?.find(p => p.id === paramId);
        if (param) {
            handleInternalParamChange(effectId, paramId, param.originalValue);
        }
    }, [savedEffects, handleInternalParamChange]);

    // === 重置所有参数 ===
    const handleInternalResetAllParams = useCallback((effectId: string) => {
        const effect = savedEffects.find(e => e.id === effectId);
        effect?.params?.forEach(param => {
            handleInternalParamChange(effectId, param.id, param.originalValue);
        });
    }, [savedEffects, handleInternalParamChange]);

    // === 监听外部参数变更事件 (来自左侧 AIEffectParamsPanel) ===
    useEffect(() => {
        const onParamChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            handleInternalParamChange(detail.effectId, detail.paramId, detail.value);
        };
        const onResetParam = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            handleInternalResetParam(detail.effectId, detail.paramId);
        };
        const onResetAllParams = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            handleInternalResetAllParams(detail.effectId);
        };

        window.addEventListener('ai-effect-param-change', onParamChange);
        window.addEventListener('ai-effect-param-reset', onResetParam);
        window.addEventListener('ai-effect-all-params-reset', onResetAllParams);

        return () => {
            window.removeEventListener('ai-effect-param-change', onParamChange);
            window.removeEventListener('ai-effect-param-reset', onResetParam);
            window.removeEventListener('ai-effect-all-params-reset', onResetAllParams);
        };
    }, [handleInternalParamChange, handleInternalResetParam, handleInternalResetAllParams]);

    // === 云同步：从云端加载效果并重新执行代码 ===
    useEffect(() => {
        if (effectsLoaded || !userId) return;

        let cancelled = false;
        let cleanupSceneListener: (() => void) | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const restoreEffects = async (config: any, context: any) => {
            const restoredEffects: SavedEffect[] = [];

            for (const cloudEffect of config.creationEffects) {
                try {
                    const newObjects: any[] = [];

                    if (context && cloudEffect.isActive) {
                        const {
                            scene, THREE, camera, renderer, controls,
                            registerUpdate, unregisterUpdate,
                            bloomPass, setBloom, setFog
                        } = context;
                        const childrenBefore = new Set(scene.children);

                        const func = new Function(
                            'scene', 'THREE', 'camera', 'renderer', 'controls',
                            'registerUpdate', 'unregisterUpdate',
                            'bloomPass', 'setBloom', 'setFog',
                            'document',
                            cloudEffect.code
                        );
                        const result = func(
                            scene, THREE, camera, renderer, controls,
                            registerUpdate, unregisterUpdate,
                            bloomPass, setBloom, setFog,
                            document
                        );

                        scene.children.forEach((child: any) => {
                            if (!childrenBefore.has(child)) {
                                newObjects.push(child);
                            }
                        });
                        if (result && result.isObject3D && !newObjects.includes(result)) {
                            newObjects.push(result);
                        }
                    }

                    restoredEffects.push({
                        id: cloudEffect.id,
                        name: cloudEffect.name,
                        code: cloudEffect.code,
                        objects: newObjects,
                        isActive: cloudEffect.isActive,
                        params: cloudEffect.params
                    });
                } catch (e) {
                    console.error('[Creation Mode] Failed to restore effect:', cloudEffect.name, e);
                    restoredEffects.push({
                        id: cloudEffect.id,
                        name: cloudEffect.name,
                        code: cloudEffect.code,
                        objects: [],
                        isActive: false,
                        params: cloudEffect.params
                    });
                }
            }

            if (cancelled) return;

            setSavedEffects(restoredEffects);
            lastSyncedEffectsRef.current = JSON.stringify(
                restoredEffects.map(e => ({ id: e.id, name: e.name, code: e.code, isActive: e.isActive }))
            );
            console.log('[Creation Mode] Restored', restoredEffects.length, 'effects');
            setEffectsLoaded(true);
        };

        const loadAndMaybeRestore = async () => {
            try {
                const config = await loadCloudConfig();
                if (cancelled) return;

                if (!config?.creationEffects || config.creationEffects.length === 0) {
                    setEffectsLoaded(true);
                    return;
                }

                console.log('[Creation Mode] Loading', config.creationEffects.length, 'effects from cloud');

                const tryRestoreNow = async () => {
                    const context = (window as any).xingPlanetScene;
                    if (context) {
                        await restoreEffects(config, context);
                        return true;
                    }
                    return false;
                };

                // 1) 如果场景已就绪，直接恢复
                if (await tryRestoreNow()) return;

                // 2) 否则监听场景就绪事件（方案A），等待恢复
                const onSceneReady = async () => {
                    if (cancelled) return;
                    // 避免重复触发
                    if (effectsLoaded) return;
                    const context = (window as any).xingPlanetScene;
                    if (!context) return;
                    if (cleanupSceneListener) {
                        cleanupSceneListener();
                        cleanupSceneListener = null;
                    }
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    await restoreEffects(config, context);
                };

                window.addEventListener('xing-planet-scene-ready', onSceneReady);
                cleanupSceneListener = () => window.removeEventListener('xing-planet-scene-ready', onSceneReady);

                // 3) 兜底超时：避免永远挂起
                timeoutId = setTimeout(() => {
                    if (cancelled) return;
                    console.warn('[Creation Mode] Scene not ready after 30s, effect restoration deferred');
                    // 注意：这里不把 effectsLoaded 置 true，保留后续 scene-ready 事件的恢复机会
                }, 30000);

            } catch (e) {
                console.error('[Creation Mode] Failed to load effects from cloud:', e);
                setEffectsLoaded(true);
            }
        };

        // 小延迟：避免与场景初始化抢占主线程，但不再依赖 10s while 轮询
        const timer = setTimeout(loadAndMaybeRestore, 2000);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            if (cleanupSceneListener) cleanupSceneListener();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [userId, effectsLoaded, loadCloudConfig]);

    // === 云同步：保存效果到云端 ===
    useEffect(() => {
        if (!effectsLoaded || !userId) return;

        // 序列化当前效果（不包含 objects 和 createdAt）
        const currentEffectsStr = JSON.stringify(
            savedEffects.map(e => ({ id: e.id, name: e.name, code: e.code, isActive: e.isActive, params: e.params }))
        );

        // 内容相同则跳过保存
        if (currentEffectsStr === lastSyncedEffectsRef.current) {
            return;
        }

        const syncToCloud = async () => {
            const cloudEffects: CloudSavedEffect[] = savedEffects.map(e => ({
                id: e.id,
                name: e.name,
                code: e.code,
                isActive: e.isActive,
                createdAt: Date.now(),
                params: e.params  // 持久化参数到云端
            }));

            await saveCloudConfig({ creationEffects: cloudEffects });
            lastSyncedEffectsRef.current = currentEffectsStr; // 更新记录
            console.log('[Creation Mode] Synced', cloudEffects.length, 'effects to cloud');
        };

        // 使用 5 秒防抖，避免频繁保存
        const timer = setTimeout(syncToCloud, 5000);
        return () => clearTimeout(timer);
    }, [savedEffects, effectsLoaded, userId, saveCloudConfig]);

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
                freeChat: 'chat',
                creation: 'chat',
                creation_refine: 'chat',
                creation_generate: 'chat'
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

    // 同步 XingSpark 颜色到全局 CSS 变量，供 ControlPanel 等组件使用
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--xing-c1', xingConfig.gradient.colors[0] || '#71b0ff');
        root.style.setProperty('--xing-c2', xingConfig.gradient.colors[1] || '#FFB6C1');
        root.style.setProperty('--xing-c3', xingConfig.gradient.colors[2] || '#2bf6a5');
        root.style.setProperty('--xing-c4', xingConfig.gradient.colors[3] || '#37f1d2');
        root.style.setProperty('--xing-font', CHAT_FONT_OPTIONS.find(f => f.name === xingConfig.font)?.family || 'Pacifico');
    }, [xingConfig.gradient.colors, xingConfig.font]);

    // 当前选中的模型名称
    const currentChatModelName = CHAT_MODELS.find(m => m.id === chatModel)?.name || 'Chat';
    const currentImageModelName = IMAGE_MODELS.find(m => m.id === imageModel)?.name || 'Image';
    // 子模式提示词映射
    const subModePrompts: Record<InspirationSubMode, string> = {
        particleShape: '生成粒子形状图案...',
        background: '生成宇宙背景图...',
        magicCircle: '生成魔法阵图案...',
        freeChat: '输入任何内容...',
        creation: '创造一个红色立方体...',
        creation_refine: '创造一个红色立方体...',
        creation_generate: '创造一个红色立方体...'
    };

    const saveButtonText: Record<InspirationSubMode, string> = {
        particleShape: '保存到头部',
        background: '保存到背景',
        magicCircle: '保存到法阵',
        freeChat: '保存预设',
        creation: '保存对象',
        creation_refine: '保存对象',
        creation_generate: '保存对象'
    };

    return createPortal(
        <>
            <ImageModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

            <div
                ref={panelRef}
                className="fixed z-[9999]"
                style={{
                    left: savedPosition.x,
                    top: savedPosition.y,
                    // Control visibility via display to keep component mounted
                    display: isOpen ? 'block' : 'none',
                    pointerEvents: isMinimized ? 'none' : 'auto' // Pass through clicks when transparent
                }}
            >
                <div
                    className="ai-panel-container overflow-visible" // 允许子元素(如弹出菜单)溢出
                    style={{
                        width: '600px', // Keep full width for input area
                        height: isMinimized ? 'auto' : '85vh', // Auto height when minimized (Compact Mode)
                        background: isMinimized ? 'transparent' : undefined,
                        boxShadow: isMinimized ? 'none' : `
                            0 24px 48px rgba(0,0,0,0.15), 
                            0 8px 16px rgba(0,0,0,0.1),
                            0 0 20px ${xingConfig.gradient.colors[0]}40,
                            0 0 40px ${xingConfig.gradient.colors[1] || xingConfig.gradient.colors[0]}25,
                            0 0 60px ${xingConfig.gradient.colors[2] || xingConfig.gradient.colors[0]}15
                        `,
                        border: isMinimized ? 'none' : undefined,
                        pointerEvents: isMinimized ? 'none' : 'auto' // Container itself shouldn't block
                    }}
                >
                    {/* Borders - Only show when expanded */}
                    {!isMinimized && (
                        <>
                            <div className="ai-panel-border-top" style={{ background: `linear-gradient(90deg, transparent 0%, ${xingConfig.gradient.colors[0]} 20%, ${xingConfig.gradient.colors[1]} 50%, ${xingConfig.gradient.colors[2]} 80%, transparent 100%)` }}></div>
                            <div className="ai-panel-border-bottom" style={{ background: `linear-gradient(90deg, transparent 0%, ${xingConfig.gradient.colors[2]} 20%, ${xingConfig.gradient.colors[1]} 50%, ${xingConfig.gradient.colors[0]} 80%, transparent 100%)` }}></div>
                            <div className="ai-panel-border-left" style={{ top: '12px', background: `linear-gradient(to bottom, ${xingConfig.gradient.colors[0]}80 0%, ${xingConfig.gradient.colors[1]}80 50%, transparent 100%)` }}></div>
                            <div className="ai-panel-border-right" style={{ bottom: '12px', background: `linear-gradient(to bottom, transparent 0%, ${xingConfig.gradient.colors[1]}80 50%, ${xingConfig.gradient.colors[0]}80 100%)` }}></div>

                            {/* 标题栏 (Drag Handle) */}
                            <div
                                className="drag-handle flex items-center justify-between px-4 py-3 cursor-move border-b border-white/5 touch-none"
                                onMouseDown={handleDragStart}
                                onTouchStart={handleTouchStart}
                            >
                                <div className="flex items-center gap-2 relative">
                                    {/* XingSpark Logo */}
                                    {(() => {
                                        const colors = xingConfig.gradient?.colors || ['#71b0ff', '#FFB6C1', '#2bf6a5', '#37f1d2'];
                                        return (
                                            <span
                                                className={`xingspark-logo-title ${logoState === 'blinking' ? 'blinking' : ''}`}
                                                onDoubleClick={handleLogoDoubleClick}
                                                title="双击打开设置"
                                                style={{
                                                    fontSize: '1.6rem',
                                                    padding: '4px 8px',
                                                    lineHeight: 1.2,
                                                    fontFamily: `'${xingConfig.font || 'Pacifico'}', cursive`,
                                                    // 设置 CSS 自定义属性驱动动态渐变
                                                    '--xing-bg-image': `conic-gradient(from var(--xing-angle) at var(--xing-cx) var(--xing-cy), ${colors.join(', ')}, ${colors[0]})`,
                                                    '--xing-font': `'${xingConfig.font || 'Pacifico'}'`,
                                                } as React.CSSProperties}
                                            >
                                                <span style={{ fontSize: '1em' }}>X</span>
                                                <span style={{ fontSize: '0.9em' }}>ing</span>
                                                <span style={{ fontSize: '1.25em', marginLeft: '-0.05em' }}>S</span>
                                                <span style={{ fontSize: '0.9em' }}>park</span>
                                            </span>
                                        );
                                    })()}
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* 最小化按钮 */}
                                    <button
                                        onClick={() => handleToggleMinimize(true)}
                                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                        title="最小化 (只保留输入框)"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                    <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* XingSpark 设置 - Only when expanded */}
                    {!isMinimized && showSettings && (
                        <div className="flex-1 min-h-0 pointer-events-auto">
                            <XingSparkSettingsPanel
                                config={xingConfig}
                                setConfig={onConfigChange}
                                onBack={() => {
                                    setShowSettings(false);
                                    onForceSave?.(); // 退出设置时强制保存
                                }}
                                userId={userId}
                            />
                        </div>
                    )}

                    {/* 消息列表 - When expanded & not in settings */}
                    {!isMinimized && !showSettings && (
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 visible-scrollbar pointer-events-auto">
                            {messages.map(msg => (
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
                                    ) : msg.subMode === 'creation' && msg.role === 'assistant' ? (
                                        <div className="bg-[#1e1e1e] rounded-lg border border-white/10 overflow-hidden text-left w-full max-w-full">
                                            {/* Header */}
                                            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                                                <div className="flex items-center gap-2 text-xs text-blue-400">
                                                    <Code size={14} />
                                                    <span>生成代码</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* 复制按钮 - 始终显示 */}
                                                    <button
                                                        onClick={() => {
                                                            const cleanCode = msg.content.replace(/```javascript|```/g, '').trim();
                                                            navigator.clipboard.writeText(cleanCode);
                                                        }}
                                                        className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 text-white/50 hover:text-white/80 rounded text-xs transition-colors"
                                                        title="复制代码"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    {createdObjectsHistory.has(msg.id) ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveEffect(msg.content, msg.id)}
                                                                className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded text-xs text-blue-400 transition-colors"
                                                                title="保存到管理器"
                                                            >
                                                                <Save size={12} />
                                                                保存
                                                            </button>
                                                            <button
                                                                onClick={() => handleUndo(msg.id)}
                                                                className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded text-xs text-red-400 transition-colors"
                                                                title="撤销生成的对象"
                                                            >
                                                                <RotateCcw size={12} />
                                                                撤销
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRunCode(msg.content, msg.id)}
                                                            className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 text-green-400 rounded text-xs transition-colors"
                                                            title="立即运行代码"
                                                        >
                                                            <Play size={12} />
                                                            运行
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Code Preview - 允许选中复制 */}
                                            <div className="p-3 font-mono text-xs text-white/70 overflow-x-auto whitespace-pre-wrap max-h-[200px] custom-scrollbar select-text">
                                                {msg.content.replace(/```javascript|```/g, '').trim()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`inline-block px-3 py-2 rounded-xl relative group select-text ${msg.role === 'user' ? '' : 'bg-white/5 text-white/80'}`}
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
                                            {/* 复制按钮 - 浮动在右下角 */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(msg.content);
                                                }}
                                                className="absolute bottom-1 right-1 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100"
                                                title="复制消息"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    )}
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
                            <div className="p-3 bg-black/10 backdrop-blur-sm rounded-b-2xl pointer-events-auto">

                                {/* 子模式选择 (放在输入框上方，左对齐，圆角长方形) */}
                                {/* 最小化时：整行可拖动（点击空白处拖动） */}
                                <div
                                    className={`flex gap-2 mb-2 px-1 overflow-x-auto no-scrollbar items-center ${isMinimized ? 'cursor-move touch-none' : ''}`}
                                    onMouseDown={isMinimized ? handleDragStart : undefined}
                                    onTouchStart={isMinimized ? handleTouchStart : undefined}
                                >

                                    {(Object.keys(INSPIRATION_MODE_INFO) as InspirationSubMode[])
                                        .filter(m => m !== 'creation_refine' && m !== 'creation_generate') // 过滤内部模式
                                        .map(subMode => (
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

                                    {/* 最小化状态下的展开按钮 (放在最右侧) */}
                                    {isMinimized && (
                                        <button
                                            onClick={() => handleToggleMinimize(false)}
                                            className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shadow-sm border border-white/10"
                                            title="展开面板"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                                            展开
                                        </button>
                                    )}
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
                                            className="flex-1 bg-transparent text-white/90 placeholder-white/20 text-sm py-2 px-2 focus:outline-none resize-none overflow-y-auto min-h-[40px] max-h-[120px]"
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
                                            {/* 停止按钮（生成中显示） */}
                                            {isGenerating && (
                                                <button
                                                    onClick={handleStop}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                    title="停止生成"
                                                >
                                                    <div className="w-3 h-3 bg-red-400 rounded-sm" />
                                                </button>
                                            )}
                                            {/* 发送按钮（支持队列） */}
                                            <button
                                                data-send-btn
                                                onClick={handleSend}
                                                disabled={!inputValue.trim()}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 text-white/90 hover:bg-white/10 relative"
                                                title={isGenerating ? "添加到队列" : "发送"}
                                                style={{ filter: `drop-shadow(0 0 5px ${xingConfig.gradient.colors[2] || xingConfig.gradient.colors[1]})` }}
                                            >
                                                <Send size={18} strokeWidth={1.5} />
                                                {/* 队列徽标 */}
                                                {messageQueue.length > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                                                        {messageQueue.length}
                                                    </span>
                                                )}
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

                                        {/* 场景管理器图标 (归档) */}
                                        {inspirationSubMode === 'creation' && (
                                            <div className="relative ml-auto">
                                                <button
                                                    onClick={() => setShowArchive(!showArchive)}
                                                    className={`w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors ${savedEffects.length > 0 ? 'text-blue-400' : ''}`}
                                                    title="场景效果管理器"
                                                >
                                                    <Archive size={14} />
                                                </button>

                                                {/* 效果列表弹出层 */}
                                                {showArchive && (
                                                    <div className="absolute bottom-full right-0 mb-2 w-[200px] z-50">
                                                        <div className="bg-[#1a1a24] rounded-xl p-2 border border-white/10 shadow-2xl backdrop-blur-xl max-h-[200px] overflow-y-auto custom-scrollbar">
                                                            {savedEffects.length === 0 ? (
                                                                <div className="text-center text-white/30 text-xs py-2">暂无保存的效果</div>
                                                            ) : (
                                                                savedEffects.map(effect => (
                                                                    <div
                                                                        key={effect.id}
                                                                        className={`flex items-center justify-between gap-2 py-1.5 px-2 hover:bg-white/5 rounded-lg group cursor-pointer ${selectedEffectId === effect.id ? 'bg-blue-500/20 ring-1 ring-blue-400/50' : ''}`}
                                                                        onClick={() => {
                                                                            const newId = selectedEffectId === effect.id ? null : effect.id;
                                                                            setSelectedEffectId(newId);
                                                                            // 通知 App 层以渲染左侧参数面板
                                                                            if (newId && onEffectSelect) {
                                                                                onEffectSelect({
                                                                                    id: effect.id,
                                                                                    name: effect.name,
                                                                                    params: effect.params,
                                                                                    paramsAnalyzing: effect.paramsAnalyzing
                                                                                });
                                                                                // 如果没有参数且未在分析中，触发按需分析
                                                                                if ((!effect.params || effect.params.length === 0) && !effect.paramsAnalyzing) {
                                                                                    analyzeEffectParams(effect.id);
                                                                                }
                                                                            } else if (onEffectSelect) {
                                                                                onEffectSelect(null);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span className={`text-xs truncate flex-1 ${effect.isActive ? 'text-white/80' : 'text-white/30'}`}>
                                                                            {effect.name}
                                                                        </span>
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={() => navigator.clipboard.writeText(effect.code)}
                                                                                className="p-1 rounded text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                                title="复制代码"
                                                                            >
                                                                                <Copy size={12} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleToggleEffect(effect.id)}
                                                                                className={`p-1 rounded transition-colors ${effect.isActive ? 'text-green-400 hover:bg-green-500/20' : 'text-white/30 hover:bg-white/10'}`}
                                                                                title={effect.isActive ? '关闭' : '开启'}
                                                                            >
                                                                                <Power size={12} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteEffect(effect.id)}
                                                                                className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                                title="删除"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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

