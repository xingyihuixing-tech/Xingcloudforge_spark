import { useRef, useCallback, useEffect, useState } from 'react';
import { XingSparkConfig } from '../components/XingSparkSettings';

/**
 * Hook for Draggable Star Logic (Direct DOM Manipulation)
 */
export function useDraggableStar(
    xingConfig: XingSparkConfig,
    setXingConfig: (newConfig: XingSparkConfig) => void,
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

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (!starRef.current) return;

        e.preventDefault();
        e.stopPropagation();

        const style = window.getComputedStyle(starRef.current);
        const left = parseInt(style.left || '0', 10);
        const top = parseInt(style.top || '0', 10);

        dragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialLeft: left,
            initialTop: top
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        starRef.current.style.cursor = 'grabbing';
    }, []);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!dragRef.current.isDragging || !starRef.current) return;

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;

        const newLeft = dragRef.current.initialLeft + deltaX;
        const newTop = dragRef.current.initialTop + deltaY;

        starRef.current.style.left = `${newLeft}px`;
        starRef.current.style.top = `${newTop}px`;
        // Ensure we override right/bottom during drag
        starRef.current.style.right = 'auto';
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragRef.current.isDragging) return;

        dragRef.current.isDragging = false;
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);

        if (starRef.current) {
            starRef.current.style.cursor = 'grab';

            // Save final position to config (Persist to Cloud)
            const style = window.getComputedStyle(starRef.current);
            const finalX = parseInt(style.left || '0', 10);
            const finalY = parseInt(style.top || '0', 10);

            setXingConfig({
                ...xingConfig,
                starPosition: { x: finalX, y: finalY }
            });
        }
    }, [xingConfig, setXingConfig]);

    return {
        starRef,
        handleDragStart,
        isCustomPosition
    };
}
