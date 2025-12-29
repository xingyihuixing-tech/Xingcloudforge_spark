import React from 'react';

interface PlanetAvatarProps {
    userId: string;
    imageUrl?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const PlanetAvatar: React.FC<PlanetAvatarProps> = ({
    userId,
    imageUrl,
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-24 h-24',
        xl: 'w-32 h-32'
    };

    // 如果有图片URL且加载成功，显示图片；否则显示生成的星球
    // 为了处理图片加载失败，我们可以简单地用 onError 回退，但这里我们优先显示预设，如果 imageUrl 存在则尝试覆盖
    // 更稳健的做法：如果 imageUrl 存在，渲染 img，并带 onError 处理

    // 生成确定性索引 (0-7)
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const planetIndex = Math.abs(hash) % 8;

    return (
        <div
            className={`relative rounded-full overflow-hidden shrink-0 transition-transform hover:scale-105 active:scale-95 ${sizeClasses[size]} ${className}`}
            style={{ boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={userId}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        // 显示下层的 div (预设星球)
                    }}
                />
            ) : null}

            {/* 预设星球层 (总是存在，作为背景或 fallback) */}
            <div
                className="absolute inset-0 w-full h-full -z-10 bg-black transition-all duration-300"
                style={PRESET_STYLES[planetIndex]}
            >
                {/* 纹理/光照层 - 通用 */}
                <div className="absolute inset-0 rounded-full shadow-[inset_-30%_-30%_50%_rgba(0,0,0,0.8),inset_10%_10%_20%_rgba(255,255,255,0.3)]" />
                {/* 环 (部分星球有) */}
                {[2, 6].includes(planetIndex) && (
                    <div className="absolute top-1/2 left-1/2 w-[160%] h-[20%] border-[2px] border-white/30 rounded-[50%] -translate-x-1/2 -translate-y-1/2 rotate-[-20deg]" style={{ boxShadow: '0 0 10px rgba(255,255,255,0.2)' }} />
                )}
            </div>
        </div>
    );
};

// 8种预设样式 (Inline CSS for reliability)
const PRESET_STYLES = [
    // 1. Ice World
    { background: 'linear-gradient(135deg, #cffafe 0%, #06b6d4 50%, #1e3a8a 100%)' },

    // 2. Lava Planet
    { background: 'radial-gradient(circle at 30% 30%, #fbbf24, #ea580c, #7f1d1d)' },

    // 3. Gas Giant (Banded)
    { background: 'linear-gradient(135deg, #fcd34d 0%, #d97706 20%, #b45309 40%, #fcd34d 60%, #78350f 100%)' },

    // 4. Terrestrial (Blue/Green)
    { background: 'linear-gradient(135deg, #86efac 0%, #3b82f6 50%, #1e1b4b 100%)' },

    // 5. Toxic (Purple/Green)
    { background: 'radial-gradient(circle at 70% 20%, #a7f3d0, #8b5cf6, #4c1d95)' },

    // 6. Star (Glowing)
    { background: 'linear-gradient(45deg, #fef3c7, #f97316, #dc2626)', boxShadow: '0 0 20px #f59e0b' },

    // 7. Cyber (Neon)
    { background: '#111827', border: '1px solid rgba(34,211,238,0.5)', boxShadow: 'inset 0 0 20px #06b6d4' },

    // 8. Midnight (Dark)
    { background: 'linear-gradient(to bottom, #334155, #0f172a, #000000)' }
];
