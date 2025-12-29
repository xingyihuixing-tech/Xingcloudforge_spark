import React, { useState, useEffect } from 'react';
import { StarBackground } from './StarBackground'; // 原有的，改名 NebulaStorm?
// 将来导入其他背景组件
// import { WarpSpeed } from './backgrounds/WarpSpeed';
// import { CyberRain } from './backgrounds/CyberRain';
// ...

// 临时占位背景组件
const WarpSpeed = () => <div className="absolute inset-0 bg-black"><canvas id="bg-warp" className="w-full h-full" /></div>;
const QuantumField = () => <div className="absolute inset-0 bg-gray-900"><div className="w-full h-full flex items-center justify-center text-white/20">Quantum Field Loading...</div></div>;
// ...

export type BackgroundType = 'nebula' | 'warp' | 'quantum' | 'blackhole' | 'rain';

export const BackgroundManager: React.FC<{ activeBg?: BackgroundType; onChange?: (type: BackgroundType) => void }> = ({ activeBg = 'nebula', onChange }) => {
    const [current, setCurrent] = useState<BackgroundType>(activeBg);

    useEffect(() => {
        if (activeBg) setCurrent(activeBg);
    }, [activeBg]);

    const handleChange = (type: BackgroundType) => {
        setCurrent(type);
        onChange?.(type);
    };

    const renderBackground = () => {
        switch (current) {
            case 'nebula': return <StarBackground />;
            case 'warp': return <WarpBackground />;
            case 'quantum': return <QuantumBackground />;
            case 'blackhole': return <BlackHoleBackground />;
            case 'rain': return <RainBackground />;
            default: return <StarBackground />;
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-0">
                {renderBackground()}
            </div>

            {/* 切换器 UI */}
            <div className="fixed bottom-4 right-4 z-[60] flex gap-2 p-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-xl transition-opacity hover:opacity-100 opacity-60">
                <BgBtn type="nebula" icon="cloud" label="Nebula" active={current === 'nebula'} onClick={() => handleChange('nebula')} />
                <BgBtn type="warp" icon="space-shuttle" label="Warp" active={current === 'warp'} onClick={() => handleChange('warp')} />
                <BgBtn type="quantum" icon="atom" label="Quantum" active={current === 'quantum'} onClick={() => handleChange('quantum')} />
                <BgBtn type="blackhole" icon="circle" label="Void" active={current === 'blackhole'} onClick={() => handleChange('blackhole')} />
                <BgBtn type="rain" icon="code" label="Matrix" active={current === 'rain'} onClick={() => handleChange('rain')} />
            </div>
        </>
    );
};

const BgBtn = ({ type, icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 scale-110' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'
            }`}
        title={label}
    >
        <i className={`fas fa-${icon} text-xs md:text-sm`} />
    </button>
);

// --- Sub Components (Will be moved to separate files later) ---

const WarpBackground = () => {
    useEffect(() => {
        const canvas = document.getElementById('warp-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let stars: any[] = [];
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        // Init stars
        for (let i = 0; i < 400; i++) stars.push({ x: (Math.random() - 0.5) * w, y: (Math.random() - 0.5) * h, z: Math.random() * w });

        let animId = 0;
        const draw = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; // trail key
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';

            stars.forEach(s => {
                s.z -= 15; // speed
                if (s.z <= 0) {
                    s.x = (Math.random() - 0.5) * w;
                    s.y = (Math.random() - 0.5) * h;
                    s.z = w;
                }

                const k = 128.0 / s.z;
                const px = s.x * k + w / 2;
                const py = s.y * k + h / 2;

                if (px >= 0 && px <= w && py >= 0 && py <= h) {
                    const size = (1 - s.z / w) * 3;
                    ctx.beginPath();
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            animId = requestAnimationFrame(draw);
        };

        draw();

        const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener('resize', handleResize);
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize); };
    }, []);

    return <canvas id="warp-canvas" className="absolute inset-0 w-full h-full bg-black" />;
};

const RainBackground = () => {
    useEffect(() => {
        const canvas = document.getElementById('rain-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;
        const cols = Math.floor(w / 20) + 1;
        const ypos = Array(cols).fill(0);

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        let animId = 0;
        const matrix = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#0f0';
            ctx.font = '15pt monospace';

            ypos.forEach((y, ind) => {
                const text = String.fromCharCode(Math.random() * 128);
                const x = ind * 20;
                ctx.fillText(text, x, y);
                if (y > 100 + Math.random() * 10000) ypos[ind] = 0;
                else ypos[ind] = y + 20;
            });
            animId = requestAnimationFrame(matrix);
        };
        matrix();
        const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener('resize', handleResize);
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', handleResize); };
    }, []);

    return <canvas id="rain-canvas" className="absolute inset-0 w-full h-full bg-black" />;
};

const QuantumBackground = () => {
    // Simple CSS Gradient Animation for now
    return (
        <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
            <div className="absolute top-0 left-0 w-[200%] h-[200%] animate-spin-slow opacity-30" style={{
                background: 'conic-gradient(from 0deg, #ff0080, #7928ca, #ff0080)',
                filter: 'blur(100px)',
                animationDuration: '20s'
            }} />
            <div className="absolute bottom-0 right-0 w-[150%] h-[150%] animate-spin-reverse-slow opacity-30" style={{
                background: 'conic-gradient(from 180deg, #0070f3, #00dfd8, #0070f3)',
                filter: 'blur(80px)',
                animationDuration: '30s'
            }} />
            <div className="absolute inset-0 backdrop-blur-3xl" />
        </div>
    );
};

const BlackHoleBackground = () => {
    // 模拟黑洞吸积盘
    return (
        <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center">
            {/* 吸积盘 */}
            <div className="relative w-[600px] h-[600px] rounded-full" style={{
                background: 'radial-gradient(circle, #000 40%, transparent 42%), conic-gradient(from 0deg, transparent 0%, #ff6b6b 10%, #feca57 20%, transparent 30%, transparent 70%, #48dbfb 80%, #ff9ff3 90%, transparent 100%)',
                animation: 'spin 10s linear infinite',
                filter: 'blur(20px) brightness(1.5)'
            }}></div>
            {/* 事件视界 */}
            <div className="absolute w-[200px] h-[200px] bg-black rounded-full shadow-[0_0_50px_rgba(255,100,50,0.5)] z-10" />
            <div className="absolute inset-0 bg-black/20" />
        </div>
    );
};
