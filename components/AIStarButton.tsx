import React from 'react';

interface AIStarButtonProps {
    onClick?: () => void;
    className?: string;
    title?: string;
}

/**
 * AI 助手唤醒按钮
 * 使用 index.css 中的 .ai-star-btn 类实现流动渐变效果
 */
export const AIStarButton: React.FC<AIStarButtonProps> = ({
    onClick,
    className = '',
    title = "唤起 AI 助手"
}) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center p-2 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 shadow-lg transition-all hover:scale-105 active:scale-95 ${className}`}
            title={title}
        >
            {/* 使用 CSS 实现的流动渐变圆钝星 */}
            <div className="ai-star-btn relative z-10" />

            {/* 外部装饰光圈 (可选) */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
};
