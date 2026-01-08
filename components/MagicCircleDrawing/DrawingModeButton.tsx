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
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0, currentX: 0, currentY: 0, hasMoved: false });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // 保存位置到 localStorage
    const savePosition = useCallback((pos: { x: number; y: number }) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
            setIsCustomPos(true);
        } catch (e) { /* ignore */ }
    }, []);

    // 开始拖动 (鼠标)
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y,
            currentX: position.x,
            currentY: position.y,
            hasMoved: false
        };
    }, [position, disabled]);

    // 开始拖动 (触摸)
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled) return;
        const touch = e.touches[0];
        setIsDragging(true);
        dragStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            posX: position.x,
            posY: position.y,
            currentX: position.x,
            currentY: position.y,
            hasMoved: false
        };
    }, [position, disabled]);

    // 拖动中 - 直接操作DOM而非setState，避免重渲染卡顿
    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (clientX: number, clientY: number) => {
            if (!buttonRef.current) return;
            const dx = clientX - dragStartRef.current.x;
            const dy = clientY - dragStartRef.current.y;

            // 检测是否真的移动了
            if (Math.abs(dx) + Math.abs(dy) > 5) {
                dragStartRef.current.hasMoved = true;
            }

            const newX = Math.max(0, Math.min(window.innerWidth - 60, dragStartRef.current.posX + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, dragStartRef.current.posY + dy));

            // 直接修改 DOM style，不触发 React 重渲染
            buttonRef.current.style.left = `${newX}px`;
            buttonRef.current.style.top = `${newY}px`;

            // 记录最终位置用于结束时保存
            dragStartRef.current.currentX = newX;
            dragStartRef.current.currentY = newY;
        };

        const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault(); // 防止页面滚动
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        const handleEnd = () => {
            setIsDragging(false);
            // 仅在拖动结束时更新 state 和 localStorage
            const finalPos = { x: dragStartRef.current.currentX, y: dragStartRef.current.currentY };
            setPosition(finalPos);
            savePosition(finalPos);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, savePosition]);

    // 点击处理 - 只有未拖动时才触发 onClick
    const handleClick = useCallback(() => {
        if (disabled) return;
        // 如果发生了拖动，不触发点击
        if (!dragStartRef.current.hasMoved) {
            onClick();
        }
    }, [onClick, disabled]);

    return (
        <button
            ref={buttonRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
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
