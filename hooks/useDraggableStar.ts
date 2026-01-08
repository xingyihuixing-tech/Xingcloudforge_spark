import React, { useRef, useCallback, useEffect, useState } from 'react';
import { XingSparkConfig } from '../components/XingSparkSettings';

/**
 * Hook for Draggable Star Logic (Direct DOM Manipulation)
 * 支持鼠标和触摸拖动
 */
export function useDraggableStar(
    xingConfig: XingSparkConfig,
    setXingConfig: React.Dispatch<React.SetStateAction<XingSparkConfig>>,
    defaultPositionClasses: string = "top-24 right-1" // Fallback classes
) {
    const starRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialLeft: 0,
        initialTop: 0
    });
    // 追踪是否发生了有意义的拖动
    const hasDraggedRef = useRef(false);

    // Local state to force render only when switching between "Custom Position" and "Default CSS Position"
    // If xingConfig.starPosition is null, we rely on CSS classes (top-24, etc.)
    // If it has value, we apply inline styles.
    const isCustomPosition = !!xingConfig.starPosition;

    // Effect to apply saved position on mount/config change
    useEffect(() => {
        if (starRef.current && xingConfig.starPosition) {
            starRef.current.style.left = `${xingConfig.starPosition.x}px`;
            starRef.current.style.top = `${xingConfig.starPosition.y}px`;
            // Override any class-based positioning
            starRef.current.style.right = 'auto'; // Important to unset right if set by class
            starRef.current.style.bottom = 'auto';
        }
    }, [xingConfig.starPosition]);

    // 通用拖动开始逻辑
    const startDrag = useCallback((clientX: number, clientY: number) => {
        if (!starRef.current) return;

        // 重置拖动标志
        hasDraggedRef.current = false;

        const style = window.getComputedStyle(starRef.current);
        const left = parseInt(style.left || '0', 10);
        const top = parseInt(style.top || '0', 10);

        dragRef.current = {
            isDragging: true,
            startX: clientX,
            startY: clientY,
            initialLeft: left,
            initialTop: top
        };

        starRef.current.style.cursor = 'grabbing';
    }, []);

    // 鼠标拖动开始
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startDrag(e.clientX, e.clientY);

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }, [startDrag]);

    // 触摸拖动开始
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }, [startDrag]);

    // 通用移动逻辑
    const moveElement = useCallback((clientX: number, clientY: number) => {
        if (!dragRef.current.isDragging || !starRef.current) return;

        const deltaX = clientX - dragRef.current.startX;
        const deltaY = clientY - dragRef.current.startY;

        // 检测拖动距离超过阈值
        const distance = Math.abs(deltaX) + Math.abs(deltaY);
        if (distance > 5) {
            hasDraggedRef.current = true;
        }

        const newLeft = dragRef.current.initialLeft + deltaX;
        const newTop = dragRef.current.initialTop + deltaY;

        starRef.current.style.left = `${newLeft}px`;
        starRef.current.style.top = `${newTop}px`;
        // Ensure we override right/bottom during drag
        starRef.current.style.right = 'auto';
    }, []);

    const handleDragMove = useCallback((e: MouseEvent) => {
        moveElement(e.clientX, e.clientY);
    }, [moveElement]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault(); // 防止页面滚动
        moveElement(e.touches[0].clientX, e.touches[0].clientY);
    }, [moveElement]);

    // 通用结束逻辑
    const endDrag = useCallback(() => {
        if (!dragRef.current.isDragging) return;

        dragRef.current.isDragging = false;

        if (starRef.current) {
            starRef.current.style.cursor = 'grab';

            // Save final position to config (Persist to Cloud)
            const style = window.getComputedStyle(starRef.current);
            const finalX = parseInt(style.left || '0', 10);
            const finalY = parseInt(style.top || '0', 10);

            // 使用函数式更新，避免闭包中的旧值覆盖最新配置
            setXingConfig(prev => ({
                ...prev,
                starPosition: { x: finalX, y: finalY }
            }));
        }

        // 延迟重置 hasDragged，确保 click 事件能检测到
        setTimeout(() => {
            hasDraggedRef.current = false;
        }, 100);
    }, [setXingConfig]);

    const handleDragEnd = useCallback(() => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        endDrag();
    }, [handleDragMove, endDrag]);

    const handleTouchEnd = useCallback(() => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        endDrag();
    }, [handleTouchMove, endDrag]);

    // 返回 wasDragged 检测函数
    const wasDragged = useCallback(() => hasDraggedRef.current, []);

    return {
        starRef,
        handleDragStart,
        handleTouchStart,  // 新增触摸开始
        isCustomPosition,
        wasDragged  // 新增：检查是否刚发生过拖动
    };
}
