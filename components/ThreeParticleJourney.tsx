import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// @ts-ignore
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// @ts-ignore
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

export const ThreeParticleJourney: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // --- 配置参数 ---
        const CONFIG = {
            particleCount: 20000,
            starSize: 0.6,
            gasSize: 6.0,
            starRatio: 0.7,
            colorCore: { h: 0.6, s: 0.9, l: 0.9 },
            colorEdge: { h: 0.65, s: 0.8, l: 0.1 },
            transitionSpeed: 0.02,
            bloomStrength: 1.5,
            bloomRadius: 0.5,
            bloomThreshold: 0.1,
            cycleDuration: 12000 // 12秒切换一次形态
        };

        // State variables inside closure
        let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
        let controls: any, composer: any;
        let particles: THREE.Points, particleGeometry: THREE.BufferGeometry, particleMaterial: THREE.PointsMaterial;

        let positions: Float32Array;
        let targetPositions: Float32Array;
        let colors: Float32Array;
        let sizes: Float32Array;
        let types: Int8Array;

        let frameId = 0;
        let lastSwitchTime = Date.now();
        const shapes = ['galaxy', 'river', 'nebula'];
        let currentShapeIdx = 0;

        // --- Init ---
        const init = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            // 1. Scene
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x050505, 0.002);

            // 2. Camera
            camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
            camera.position.set(0, 40, 80);

            // 3. Renderer
            renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
            renderer.setSize(w, h);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ReinhardToneMapping;
            mountRef.current!.appendChild(renderer.domElement);

            // 4. Controls
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.8; // 稍微调快一点展示视角
            controls.maxDistance = 300;
            controls.enableZoom = false; // 登录页禁用缩放干扰
            controls.enablePan = false;

            // 5. Post Processing
            const renderScene = new RenderPass(scene, camera);
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(w, h),
                CONFIG.bloomStrength,
                CONFIG.bloomRadius,
                CONFIG.bloomThreshold
            );
            composer = new EffectComposer(renderer);
            composer.addPass(renderScene);
            composer.addPass(bloomPass);

            createParticles();
            generateGalaxyTargets(); // Start with Galaxy

            animate();
        };

        const createParticles = () => {
            particleGeometry = new THREE.BufferGeometry();

            positions = new Float32Array(CONFIG.particleCount * 3);
            targetPositions = new Float32Array(CONFIG.particleCount * 3);
            colors = new Float32Array(CONFIG.particleCount * 3);
            sizes = new Float32Array(CONFIG.particleCount);
            types = new Int8Array(CONFIG.particleCount);

            const sprite = generateSoftSprite();

            for (let i = 0; i < CONFIG.particleCount; i++) {
                // Init pos
                positions[i * 3] = (Math.random() - 0.5) * 200;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

                const isGas = Math.random() > CONFIG.starRatio;
                types[i] = isGas ? 1 : 0;

                if (isGas) {
                    sizes[i] = CONFIG.gasSize * (0.8 + Math.random() * 0.5);
                } else {
                    sizes[i] = CONFIG.starSize * (0.5 + Math.random() * 1.5);
                }
            }

            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

            particleMaterial = new THREE.PointsMaterial({
                size: 1.0,
                map: sprite,
                sizeAttenuation: true,
                color: 0xffffff,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                vertexColors: true
            });

            particles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(particles);
        };

        const generateSoftSprite = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (!ctx) return new THREE.Texture();

            const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
            grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.4)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
            grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 64);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        };

        const updateParticleColor = (index: number, ratio: number) => {
            const i3 = index * 3;
            const type = types[index];
            ratio = Math.max(0, Math.min(1, ratio));

            const h = THREE.MathUtils.lerp(CONFIG.colorCore.h, CONFIG.colorEdge.h, ratio);
            const s = THREE.MathUtils.lerp(CONFIG.colorCore.s, CONFIG.colorEdge.s, ratio);
            let l = THREE.MathUtils.lerp(CONFIG.colorCore.l, CONFIG.colorEdge.l, ratio);

            if (type === 1) {
                l *= 0.15;
            } else {
                l *= (0.8 + Math.random() * 0.4);
            }

            const color = new THREE.Color().setHSL(h, s, l);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        };

        // --- Generators ---

        const generateGalaxyTargets = () => {
            const params = { radius: 45, branches: 3, spin: 1.2, randomness: 0.6, randomnessPower: 3 };
            for (let i = 0; i < CONFIG.particleCount; i++) {
                const i3 = i * 3;
                const radius = Math.random() * params.radius;
                const spinAngle = radius * params.spin;
                const branchAngle = (i % params.branches) / params.branches * Math.PI * 2;

                const rPower = Math.random();
                const randomX = Math.pow(rPower, params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
                const randomY = Math.pow(rPower, params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius * 0.5;
                const randomZ = Math.pow(rPower, params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;

                const baseX = Math.cos(branchAngle + spinAngle) * radius;
                const baseZ = Math.sin(branchAngle + spinAngle) * radius;

                targetPositions[i3] = baseX + randomX;
                targetPositions[i3 + 1] = randomY;
                targetPositions[i3 + 2] = baseZ + randomZ;
                updateParticleColor(i, radius / params.radius);
            }
            particleGeometry.attributes.color.needsUpdate = true;
        };

        const generateRiverTargets = () => {
            const length = 120;
            const widthBase = 12;
            for (let i = 0; i < CONFIG.particleCount; i++) {
                const i3 = i * 3;
                const x = (Math.random() - 0.5) * length;
                const progress = (x + length / 2) / length;
                const curveZ = Math.sin(x * 0.08) * 20 + Math.sin(x * 0.03) * 10;
                const curveY = Math.cos(x * 0.05) * 8;
                const currentWidth = widthBase * (0.8 + 0.4 * Math.sin(progress * Math.PI * 3));
                const rRand = Math.pow(Math.random(), 2);
                const theta = Math.random() * Math.PI * 2;
                const scatterR = rRand * currentWidth;
                const randomY = Math.sin(theta) * scatterR * 0.4;
                const randomZ = Math.cos(theta) * scatterR;

                targetPositions[i3] = x;
                targetPositions[i3 + 1] = curveY + randomY;
                targetPositions[i3 + 2] = curveZ + randomZ;
                updateParticleColor(i, Math.abs(x) / (length / 1.8));
            }
            particleGeometry.attributes.color.needsUpdate = true;
        };

        const generateNebulaTargets = () => {
            const radius = 35;
            for (let i = 0; i < CONFIG.particleCount; i++) {
                const i3 = i * 3;
                const u = Math.random();
                const v = Math.random();
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                const rOffset = (Math.sin(theta * 3) * Math.cos(phi * 4)) * 5;
                const r = (radius + rOffset) * Math.cbrt(Math.random());

                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.sin(phi) * Math.sin(theta);
                const z = r * Math.cos(phi);

                targetPositions[i3] = x;
                targetPositions[i3 + 1] = y;
                targetPositions[i3 + 2] = z;
                updateParticleColor(i, Math.sqrt(x * x + y * y + z * z) / radius);
            }
            particleGeometry.attributes.color.needsUpdate = true;
        };

        const switchShape = (shape: string) => {
            if (shape === 'galaxy') generateGalaxyTargets();
            else if (shape === 'river') generateRiverTargets();
            else if (shape === 'nebula') generateNebulaTargets();

            // 切换形状时，稍微改变转速，带来不同感觉
            if (shape === 'river') controls.autoRotateSpeed = 0.5;
            else controls.autoRotateSpeed = 0.8;
        };

        const handleResize = () => {
            if (!camera || !renderer) return;
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };

        const animate = () => {
            // Auto Cycle logic
            const now = Date.now();
            if (now - lastSwitchTime > CONFIG.cycleDuration) {
                lastSwitchTime = now;
                currentShapeIdx = (currentShapeIdx + 1) % shapes.length;
                switchShape(shapes[currentShapeIdx]);
            }

            // Lerp Positions
            const positionsArr = particleGeometry.attributes.position.array as Float32Array;
            for (let i = 0; i < CONFIG.particleCount * 3; i++) {
                positionsArr[i] += (targetPositions[i] - positionsArr[i]) * CONFIG.transitionSpeed;
            }
            particleGeometry.attributes.position.needsUpdate = true;

            controls.update();
            composer.render();
            frameId = requestAnimationFrame(animate);
        };

        init();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId);
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
            // Fix: Use the variables from closure
            if (particleGeometry) particleGeometry.dispose();
            if (particleMaterial) particleMaterial.dispose();
        };
    }, []);

    // 可以在这里加一个隐形的 UI 提示？不，直接做成背景比较纯粹。
    return (
        <div ref={mountRef} className="absolute inset-0 w-full h-full -z-10 bg-black" />
    );
};
