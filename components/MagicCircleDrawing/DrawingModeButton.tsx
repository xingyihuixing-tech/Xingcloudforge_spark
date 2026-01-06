/**
 * input: onClick handler from parent, position from localStorage or default
 * output: Draggable floating button for entering drawing mode
 * pos: Floating UI element that can be positioned anywhere on screen
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BrushIcon } from './Icons';

const STORAGE_KEY = 'drawing_button_position';

interface DrawingModeButtonProps {
    onClick: () => void;
    disabled?: boolean;
}

export const DrawingModeButton: React.FC<DrawingModeButtonProps> = ({
    onClick,
    disabled = false
}) => {
    // 从 localStorage 加载位置
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) { /* ignore */ }
        // 默认位置：左下角
        return { x: 20, y: window.innerHeight - 100 };
    });

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // 保存位置到 localStorage
    const savePosition = useCallback((pos: { x: number; y: number }) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
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
    const clickStartRef = useRef<number>(0);

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
            className={`fixed z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all ${isDragging
                    ? 'scale-110 shadow-2xl cursor-grabbing'
                    : 'cursor-grab hover:scale-105 shadow-lg'
                } ${disabled
                    ? 'bg-gray-700 text-gray-500 opacity-50'
                    : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'
                }`}
            style={{
                left: position.x,
                top: position.y,
                boxShadow: isDragging
                    ? '0 0 30px rgba(168, 85, 247, 0.6)'
                    : '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(168, 85, 247, 0.3)'
            }}
            title="进入绘图模式"
        >
            <BrushIcon size={24} />
        </button>
    );
};

export default DrawingModeButton;
