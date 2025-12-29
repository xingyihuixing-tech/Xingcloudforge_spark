import React, { useMemo } from 'react';

interface PlanetAvatarProps {
    userId: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    imageUrl?: string; // 支持直接传入图片
}

/**
 * 根据字符串生成确定性的数字
 */
const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
};

/**
 * 生成星球的颜色配置
 */
const generatePlanetStyle = (seed: string) => {
    const hash = hashString(seed);

    // 基础色相 (0-360)
    const h1 = Math.abs(hash % 360);
    // 互补色或近似色
    const h2 = (h1 + 30 + Math.abs((hash >> 8) % 60)) % 360;
    const h3 = (h1 + 180) % 360;

    // 饱和度和亮度
    const s = 60 + Math.abs((hash >> 4) % 30); // 60-90%
    const l = 40 + Math.abs((hash >> 6) % 20); // 40-60%

    // 纹理类型 (0-2)
    const textureType = Math.abs(hash % 3);

    // 环的参数
    const hasRing = Math.abs(hash % 2) === 0;
    const ringColor = `hsla(${h3}, 70%, 70%, 0.8)`;
    const ringAngle = -15 + Math.abs((hash >> 3) % 30); // -15 to 15 deg

    return {
        background: `radial-gradient(circle at 30% 30%, hsla(${h1}, ${s}%, ${l + 20}%, 1) 0%, hsla(${h1}, ${s}%, ${l}%, 1) 40%, hsla(${h2}, ${s}%, ${l - 20}%, 1) 100%)`,
        boxShadow: `inset -4px -4px 10px rgba(0,0,0,0.5), inset 2px 2px 8px rgba(255,255,255,0.4), 0 0 15px hsla(${h1}, ${s}%, 50%, 0.3)`,
        ring: hasRing ? { color: ringColor, angle: ringAngle } : null,
        textureType
    };
};

export const PlanetAvatar: React.FC<PlanetAvatarProps> = ({ userId, size = 'md', className = '', imageUrl }) => {
    const style = useMemo(() => generatePlanetStyle(userId), [userId]);

    const sizeMap = {
        sm: 32,
        md: 48,
        lg: 80,
        xl: 120
    };

    const width = sizeMap[size];

    // 如果有图片URL，显示图片
    if (imageUrl) {
        return (
            <div
                className={`relative rounded-full overflow-hidden border-2 border-white/10 ${className}`}
                style={{ width, height: width }}
            >
                <img src={imageUrl} alt={userId} className="w-full h-full object-cover" />
            </div>
        );
    }

    return (
        <div
            className={`relative rounded-full ${className}`}
            style={{
                width,
                height: width,
                background: style.background,
                boxShadow: style.boxShadow,
            }}
        >
            {/* 纹理层 - 简单的CSS图案模拟 */}
            {style.textureType === 1 && (
                <div className="absolute inset-0 rounded-full opacity-30" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.2) 10px, rgba(0,0,0,0.2) 20px)'
                }} />
            )}

            {/* 环 - 如果有 */}
            {style.ring && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
                    style={{
                        width: width * 1.6,
                        height: width * 0.4,
                        borderColor: style.ring.color,
                        borderTopColor: 'transparent', // 增加一点遮挡感
                        borderBottomColor: style.ring.color,
                        transform: `translate(-50%, -50%) rotate(${style.ring.angle}deg)`,
                        opacity: 0.8,
                        boxShadow: `0 0 10px ${style.ring.color}`
                    }}
                />
            )}

            {/* 高光反光点 */}
            <div className="absolute top-[20%] left-[20%] w-[15%] h-[15%] bg-white rounded-full opacity-40 blur-[1px]" />
        </div>
    );
};
