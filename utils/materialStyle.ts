/**
 * materialStyle.ts
 * 
 * input: ButtonMaterialConfig from types.ts, isActive boolean
 * output: { style: CSSProperties, className: string }
 * pos: 共享工具函数，用于生成按钮的动态材质样式
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的 README.md（如有）
 */

import type { ButtonMaterialConfig } from '../types';
import type { CSSProperties } from 'react';

/**
 * 将 HEX 颜色转换为 RGB 字符串格式
 */
export const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '255, 255, 255';
};

/**
 * 根据材质配置生成按钮样式
 * @param config - 按钮材质配置（来自 materialSettings）
 * @param isActive - 是否为激活状态
 * @returns { style, className } - 内联样式和类名
 */
export const generateMaterialStyle = (
    config: ButtonMaterialConfig | undefined,
    isActive: boolean
): { style: CSSProperties, className: string } => {
    if (!config) return { style: {}, className: '' };

    const type = config.type;
    const style: CSSProperties = { transition: 'all 0.3s ease' };
    let className = '';

    switch (type) {
        case 'glass': {
            const { blur, opacity, borderOpacity, tint } = config.glass;
            const rgb = hexToRgb(tint);
            style.backgroundColor = isActive
                ? `rgba(${rgb}, ${Math.min(1, opacity + 0.2)})`
                : `rgba(${rgb}, ${opacity})`;
            style.backdropFilter = `blur(${blur}px)`;
            style.WebkitBackdropFilter = `blur(${blur}px)`;
            style.borderColor = `rgba(255, 255, 255, ${isActive ? Math.min(1, borderOpacity + 0.2) : borderOpacity})`;
            style.boxShadow = isActive ? '0 0 15px rgba(255,255,255,0.1)' : 'none';
            if (isActive) style.transform = 'scale(1.02)';
            className = 'backdrop-blur-md';
            break;
        }
        case 'neon': {
            const { glowIntensity, borderGlow, textGlow, color } = config.neon;
            style.backgroundColor = isActive ? `${color}33` : 'transparent';
            style.borderColor = isActive ? color : `${color}40`;
            style.color = isActive ? color : `${color}aa`;

            const glow = isActive ? glowIntensity : glowIntensity * 0.5;
            const shadowParts: string[] = [];
            if (borderGlow) shadowParts.push(`0 0 ${glow}px ${color}`);
            if (borderGlow && isActive) shadowParts.push(`inset 0 0 ${glow / 2}px ${color}`);
            style.boxShadow = shadowParts.join(', ');

            if (textGlow) style.textShadow = `0 0 ${glow}px ${color}`;
            break;
        }
        case 'crystal': {
            const { shine, color, highlightColor } = config.crystal;
            style.backgroundColor = `${color}20`;
            style.borderColor = `${color}60`;
            style.borderTopColor = highlightColor;
            style.borderLeftColor = highlightColor;
            style.backgroundImage = `linear-gradient(135deg, ${highlightColor}40 0%, transparent 50%, ${color}40 100%)`;
            if (isActive) {
                style.boxShadow = `0 0 ${shine}px ${color}60, inset 0 0 ${shine / 2}px ${highlightColor}40`;
            }
            break;
        }
        case 'neumorphism': {
            const { elevation, lightAngle, baseColor, shadowColor, highlightColor } = config.neumorphism;
            style.backgroundColor = baseColor;
            style.color = '#fff';
            const rad = lightAngle * (Math.PI / 180);
            const x = Math.cos(rad) * elevation;
            const y = Math.sin(rad) * elevation;

            if (isActive) {
                style.boxShadow = `inset ${x}px ${y}px ${elevation * 2}px ${shadowColor}, inset ${-x}px ${-y}px ${elevation * 2}px ${highlightColor}`;
            } else {
                style.boxShadow = `${x}px ${y}px ${elevation * 2}px ${shadowColor}, ${-x}px ${-y}px ${elevation * 2}px ${highlightColor}`;
            }
            break;
        }
        case 'holographic': {
            style.background = `linear-gradient(${135 + (isActive ? 180 : 0)}deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))`;
            style.borderColor = 'rgba(255,255,255,0.2)';
            if (isActive) {
                style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)';
                style.border = '1px solid rgba(0, 255, 255, 0.5)';
            }
            break;
        }
    }
    return { style, className };
};
