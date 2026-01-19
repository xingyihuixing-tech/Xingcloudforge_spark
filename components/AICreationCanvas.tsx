/**
 * AICreationCanvas.tsx
 * 
 * INPUT: 主场景的 camera 引用 (通过 window.xingPlanetScene)
 * OUTPUT: 暴露 window.aiCreationCanvas 接口供 AI 代码注入
 * POS: 独立的 AI 创造模式画布，与主场景叠加显示
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

interface AICreationCanvasProps {
    enabled?: boolean;
}

const AICreationCanvas: React.FC<AICreationCanvasProps> = ({ enabled = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const bloomPassRef = useRef<UnrealBloomPass | null>(null);
    const animationFrameRef = useRef<number>(0);
    const clockRef = useRef<THREE.Clock>(new THREE.Clock());
    const [isReady, setIsReady] = useState(false);

    // AI 更新回调注册表
    const aiUpdateCallbacksRef = useRef<Set<(deltaTime: number) => void>>(new Set());

    useEffect(() => {
        if (!enabled || !canvasRef.current) return;

        // 等待主场景初始化
        const waitForMainScene = setInterval(() => {
            const mainScene = (window as any).xingPlanetScene;
            if (mainScene?.camera) {
                clearInterval(waitForMainScene);
                initCanvas(mainScene);
            }
        }, 100);

        return () => {
            clearInterval(waitForMainScene);
            cleanup();
        };
    }, [enabled]);

    const initCanvas = useCallback((mainScene: any) => {
        if (!canvasRef.current) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // 独立场景
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // 独立渲染器 (透明背景)
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            premultipliedAlpha: false  // 关键：禁用预乘alpha，确保透明度正确
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setClearColor(0x000000, 0); // 完全透明
        renderer.autoClear = false;  // 关键：禁用自动清除，手动控制
        rendererRef.current = renderer;

        // 继承主场景相机
        const camera = mainScene.camera as THREE.PerspectiveCamera;

        // 独立后处理
        const composer = new EffectComposer(renderer);

        const renderPass = new RenderPass(scene, camera);
        renderPass.clear = false;  // 关键：不清除画布，保持透明
        renderPass.clearDepth = true;  // 但需要清除深度缓冲
        composer.addPass(renderPass);

        // 独立 Bloom (AI 可控制)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            1.5,  // strength
            0.4,  // radius
            0.1   // threshold
        );
        composer.addPass(bloomPass);
        bloomPassRef.current = bloomPass;

        const outputPass = new OutputPass();
        composer.addPass(outputPass);
        composerRef.current = composer;

        // 回调注册表
        const aiUpdateCallbacks = aiUpdateCallbacksRef.current;

        // 暴露 AI 接口
        (window as any).aiCreationCanvas = {
            // 独立资源
            scene,
            renderer,
            bloomPass,
            THREE,

            // 继承资源
            camera,
            controls: mainScene.controls,

            // 注册每帧更新回调
            registerUpdate: (callback: (deltaTime: number) => void) => {
                aiUpdateCallbacks.add(callback);
                console.log('[AI Canvas] Registered update callback, total:', aiUpdateCallbacks.size);
            },

            // 注销更新回调
            unregisterUpdate: (callback: (deltaTime: number) => void) => {
                aiUpdateCallbacks.delete(callback);
                console.log('[AI Canvas] Unregistered update callback, total:', aiUpdateCallbacks.size);
            },

            // 清空场景
            clearScene: () => {
                while (scene.children.length > 0) {
                    const obj = scene.children[0];
                    scene.remove(obj);
                    if ((obj as any).geometry) (obj as any).geometry.dispose();
                    if ((obj as any).material) {
                        const mat = (obj as any).material;
                        if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
                        else mat.dispose();
                    }
                }
                aiUpdateCallbacks.clear();
                console.log('[AI Canvas] Scene cleared');
            },

            // 设置 Bloom 参数
            setBloom: (strength: number, radius: number, threshold: number) => {
                bloomPass.strength = strength;
                bloomPass.radius = radius;
                bloomPass.threshold = threshold;
                console.log('[AI Canvas] Bloom updated:', { strength, radius, threshold });
            },

            // 设置雾效
            setFog: (color: number, density: number) => {
                scene.fog = new THREE.FogExp2(color, density);
                console.log('[AI Canvas] Fog set:', { color: color.toString(16), density });
            },

            // 清除雾效
            clearFog: () => {
                scene.fog = null;
            },

            // 获取纹理生成器
            getParticleTexture: (type: 'soft' | 'sharp' | 'ring' = 'soft') => {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d')!;
                const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);

                if (type === 'soft') {
                    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    g.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
                    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
                    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                } else if (type === 'sharp') {
                    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    g.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
                    g.addColorStop(0.2, 'rgba(255, 255, 255, 0.05)');
                    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                } else if (type === 'ring') {
                    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
                    g.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
                    g.addColorStop(0.85, 'rgba(255, 255, 255, 0.8)');
                    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
                }

                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 64, 64);
                const tex = new THREE.Texture(canvas);
                tex.needsUpdate = true;
                return tex;
            }
        };

        // 独立动画循环
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            const deltaTime = clockRef.current.getDelta();

            // 执行 AI 注册的回调
            aiUpdateCallbacks.forEach(callback => {
                try {
                    callback(deltaTime);
                } catch (e) {
                    console.error('[AI Canvas] Callback error:', e);
                }
            });

            // 渲染 (使用继承的相机)
            if (composerRef.current && sceneRef.current && rendererRef.current) {
                // 手动清除为透明
                rendererRef.current.clear();
                composerRef.current.render();
            }
        };

        animate();
        setIsReady(true);
        console.log('[AI Canvas] Initialized with shared camera from main scene');

        // 窗口 resize 处理
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            renderer.setSize(w, h);
            composer.setSize(w, h);
            bloomPass.resolution.set(w, h);
        };
        window.addEventListener('resize', handleResize);

        // 保存 cleanup 引用
        (window as any)._aiCanvasCleanup = () => {
            window.removeEventListener('resize', handleResize);
        };

    }, []);

    const cleanup = useCallback(() => {
        // 取消动画循环
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // 清理场景
        if ((window as any).aiCreationCanvas?.clearScene) {
            (window as any).aiCreationCanvas.clearScene();
        }

        // 清理渲染器
        if (rendererRef.current) {
            rendererRef.current.dispose();
        }

        // 清理后处理
        if (composerRef.current) {
            composerRef.current.dispose();
        }

        // 移除全局引用
        delete (window as any).aiCreationCanvas;

        // 调用 resize 清理
        if ((window as any)._aiCanvasCleanup) {
            (window as any)._aiCanvasCleanup();
            delete (window as any)._aiCanvasCleanup;
        }

        console.log('[AI Canvas] Cleaned up');
    }, []);

    if (!enabled) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none', // 交互穿透到主场景
                zIndex: 5, // 在主场景之上，UI 之下
            }}
        />
    );
};

export default AICreationCanvas;
