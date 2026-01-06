/**
 * input: onClick handler from parent, showControls for position calculation
 * output: Draggable floating button for entering drawing mode
 * pos: Floating UI element positioned below AI star button
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BrushIcon } from './Icons';

const STORAGE_KEY = 'drawing_button_position';

interface DrawingModeButtonProps {
    onClick: () => void;
    disabled?: boolean;
    showControls?: boolean; // 控制台是否显示，用于计算默认位置
}

export const DrawingModeButton: React.FC<DrawingModeButtonProps> = ({
    onClick,
    disabled = false,
    showControls = true
}) => {
    // 计算默认位置：AI 星星按钮下方（top-24 + 按钮高度 + 间距 ≈ 96 + 44 + 16 = 156）
    const getDefaultPosition = useCallback(() => {
        const rightOffset = showControls ? 324 : 16; // 与 AI 星星按钮位置对齐
        return {
            x: window.innerWidth - rightOffset - 44, // 44 是按钮宽度
            y: 156 // AI 星星(top-24=96) + 按钮高度(44) + 间距(16)
        };
    }, [showControls]);

    // 是否使用自定义位置
    const [isCustomPos, setIsCustomPos] = useState(false);

    // 从 localStorage 加载位置
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setIsCustomPos(true);
                return JSON.parse(saved);
            }
        } catch (e) { /* ignore */ }
        return getDefaultPosition();
    });

    // showControls 变化时更新默认位置（仅当未自定义时）
    useEffect(() => {
        if (!isCustomPos) {
            setPosition(getDefaultPosition());
        }
    }, [showControls, isCustomPos, getDefaultPosition]);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // 保存位置到 localStorage
    const savePosition = useCallback((pos: { x: number; y: number }) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
            setIsCustomPos(true);
        } catch (e) { /* ignore */ }
    }, []);

    // 开始拖动
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
        };
    }, [position, disabled]);

    // 拖动中
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            const newX = Math.max(0, Math.min(window.innerWidth - 60, dragStartRef.current.posX + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, dragStartRef.current.posY + dy));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            savePosition(position);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, position, savePosition]);

    // 点击处理 - 只有短按才触发 onClick
    const handleClick = useCallback(() => {
        if (disabled) return;
        // 如果拖动了，不触发点击
        const dragDistance = Math.abs(position.x - dragStartRef.current.posX) +
            Math.abs(position.y - dragStartRef.current.posY);
        if (dragDistance < 5) {
            onClick();
        }
    }, [onClick, position, disabled]);

    return (
        <button
            ref={buttonRef}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            disabled={disabled}
            className={`group fixed z-40 flex items-center justify-center p-2 rounded-full transition-all ${isDragging
                    ? 'scale-110 cursor-grabbing'
                    : 'cursor-grab hover:scale-105 active:scale-95'
                } ${disabled
                    ? 'opacity-50'
                    : ''
                }`}
            style={{
                left: position.x,
                top: position.y,
                width: 44,
                height: 44,
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isDragging
                    ? '0 0 30px rgba(255, 170, 0, 0.4)'
                    : '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
            title="进入绘图模式"
        >
            <BrushIcon size={20} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            {/* 悬停光圈效果 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
};

export default DrawingModeButton;
