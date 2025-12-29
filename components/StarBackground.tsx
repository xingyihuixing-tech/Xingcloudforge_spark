import React, { useEffect, useRef } from 'react';

interface Star {
    x: number;
    y: number;
    size: number;
    opacity: number;
    speed: number;
    color: string;
}

export const StarBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let stars: Star[] = [];
        let width = window.innerWidth;
        let height = window.innerHeight;

        // 调色板：深空蓝紫到青色
        const colors = ['#ffffff', '#a5f3fc', '#c4b5fd', '#bae6fd'];

        const initStars = () => {
            stars = [];
            const starCount = Math.floor((width * height) / 3000); // 根据屏幕面积决定数量

            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5, // 0.5 - 2.0px
                    opacity: Math.random(),
                    speed: Math.random() * 0.2 + 0.05,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
        };

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initStars();
        };

        const animate = () => {
            ctx.fillStyle = 'rgba(5, 5, 20, 0.3)'; // 拖尾效果
            ctx.fillRect(0, 0, width, height);

            stars.forEach(star => {
                // 移动
                star.y -= star.speed;
                if (star.y < 0) {
                    star.y = height;
                    star.x = Math.random() * width;
                }

                // 闪烁
                if (Math.random() > 0.99) {
                    star.opacity = Math.random();
                }

                // 绘制
                ctx.beginPath();
                ctx.fillStyle = star.color;
                ctx.globalAlpha = star.opacity;
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        // 初始化
        handleResize();
        window.addEventListener('resize', handleResize);
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                background: 'linear-gradient(to bottom, #020617 0%, #0f172a 100%)', // 深邃背景
            }}
        />
    );
};
