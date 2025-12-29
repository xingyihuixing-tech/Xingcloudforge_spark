import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { StarBackground } from './StarBackground';
import { ThreePlanetScene, PlanetPreset } from './ThreePlanetScene';
import { ThreeParticleJourney } from './ThreeParticleJourney';
// @ts-ignore
import { useUser } from '../contexts/UserContext';

export type BackgroundType = 'nebula' | 'galaxy' | 'journey' | PlanetPreset;

export const BackgroundManager: React.FC = () => {
    // Logic: 
    // 1. If savedUsers.length === 0 (New/Cleared) -> 'journey'
    // 2. Else -> Random from [gaia, inferno, glacial, nebula, galaxy, journey]

    const { savedUsers } = useUser();
    const [current, setCurrent] = useState<BackgroundType>('journey');
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (initialized) return;

        if (savedUsers.length === 0) {
            setCurrent('journey');
        } else {
            // Random Selection
            // Options: gasi(gaia), lava(inferno), ice(glacial), nebula, galaxy, journey(star map)
            const options: BackgroundType[] = ['gaia', 'inferno', 'glacial', 'nebula', 'galaxy', 'journey'];
            const randomBg = options[Math.floor(Math.random() * options.length)];
            setCurrent(randomBg);
        }
        setInitialized(true);
    }, [savedUsers, initialized]);

    const renderBackground = () => {
        switch (current) {
            case 'nebula': return <StarBackground />;
            case 'galaxy': return <ThreeGalaxyBackground />; // Using existing component
            case 'journey': return <ThreeParticleJourney />;

            // Planets
            case 'gaia':
            case 'inferno':
            case 'glacial':
                return <ThreePlanetScene preset={current as PlanetPreset} />;

            default: return <ThreeParticleJourney />;
        }
    };

    return (
        <div className="fixed inset-0 z-0 bg-black transition-opacity duration-1000">
            {renderBackground()}
        </div>
    );
};

const BgBtn = ({ type, icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`group relative w - 10 h - 10 md: w - 12 md: h - 12 rounded - xl flex items - center justify - center transition - all duration - 300 ${active
            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-110'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white hover:scale-105'
            } `}
        title={label}
    >
        <i className={`fas fa - ${icon} text - sm md: text - lg`} />
        {/* Tooltip */}
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            {label}
        </span>
    </button>
);

// --- Three.js Components ---

const useThreeSetup = (initScene: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => (() => void)) => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;
        const w = window.innerWidth;
        const h = window.innerHeight;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.0005); // Global fog for depth

        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Custom Init Logic
        const cleanup = initScene(scene, camera, renderer);

        return () => {
            window.removeEventListener('resize', handleResize);
            cleanup();
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
};

// 1. Warp Speed
const ThreeWarpBackground = () => {
    return useThreeSetup((scene, camera, renderer) => {
        const starCount = 6000;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const velocities = []; // store z-speed

        for (let i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
            positions[i * 3 + 2] = Math.random() * 2000; // depth
            velocities.push(Math.random() * 5 + 2);
        }
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        const stars = new THREE.Points(geom, mat);
        scene.add(stars);

        let frameId = 0;
        const animate = () => {
            const pos = stars.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < starCount; i++) {
                // Move Z towards camera
                pos[i * 3 + 2] -= 10; // Speed constant or variable
                // Reset if behind camera
                if (pos[i * 3 + 2] < -50) {
                    pos[i * 3 + 2] = 2000;
                    pos[i * 3] = (Math.random() - 0.5) * 1000; // Warp toward center slightly logic?
                    pos[i * 3 + 1] = (Math.random() - 0.5) * 1000;
                }
            }
            stars.geometry.attributes.position.needsUpdate = true;

            // Slight rotation
            stars.rotation.z += 0.002;

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();

        return () => cancelAnimationFrame(frameId);
    });
};

// 2. Galaxy Spiral
const ThreeGalaxyBackground = () => {
    return useThreeSetup((scene, camera, renderer) => {
        camera.position.z = 100;
        camera.position.y = 30;
        camera.lookAt(0, 0, 0);

        const particles = new THREE.BufferGeometry();
        const count = 10000;
        const posArray = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            // Spiral Logic
            const angle = Math.random() * Math.PI * 2 * 3; // 3 turns
            const radius = Math.random() * 50 + 10;
            const spread = (Math.random() - 0.5) * 10; // random offset

            // Spiral Arm 1 & 2
            const armOffset = i % 2 === 0 ? 0 : Math.PI;

            const x = Math.cos(angle + armOffset) * radius + (Math.random() - 0.5) * radius * 0.5;
            const y = (Math.random() - 0.5) * 5; // Flat galaxy
            const z = Math.sin(angle + armOffset) * radius + (Math.random() - 0.5) * radius * 0.5;

            posArray[i * 3] = x;
            posArray[i * 3 + 1] = y;
            posArray[i * 3 + 2] = z;

            // Color (Center: Gold/White, Edge: Pink/Cyan/Purple)
            const dist = Math.sqrt(x * x + z * z);
            const color = new THREE.Color();
            if (dist < 15) {
                color.setHex(0xffaa00); // Core Gold
            } else {
                // Gradient from inner to outer
                const t = (dist - 15) / 50;
                if (Math.random() > 0.5) color.setHSL(0.8 + t * 0.1, 0.9, 0.6); // Magenta/Pink
                else color.setHSL(0.5 + t * 0.1, 0.9, 0.6); // Cyan/Blue
            }

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const galaxy = new THREE.Points(particles, mat);
        scene.add(galaxy);

        let frameId = 0;
        const animate = () => {
            galaxy.rotation.y += 0.001;
            camera.position.z = 100 + Math.sin(Date.now() * 0.0005) * 20; // Breathe
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(frameId);
    });
};

// 3. Black Hole (Accretion Disk)
const ThreeBlackHoleBackground = () => {
    return useThreeSetup((scene, camera, renderer) => {
        camera.position.z = 30;

        // Black Sphere
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(4, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        scene.add(sphere);

        // Accretion Disk (Particles)
        const diskGeom = new THREE.BufferGeometry();
        const count = 5000;
        const pos = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 6 + Math.random() * 15;

            pos[i * 3] = Math.cos(angle) * radius;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5; // Thin disk
            pos[i * 3 + 2] = Math.sin(angle) * radius;

            // Color gradient (Hot inner: White/Orange -> Cool outer: Red/Dark)
            const color = new THREE.Color();
            const t = (radius - 6) / 15;
            if (t < 0.2) color.setHex(0xffffff); // Inner edge white
            else if (t < 0.5) color.setHex(0xffaa00); // Orange
            else color.setHex(0xcc0000); // Red

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        diskGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        diskGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const diskMat = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });
        const disk = new THREE.Points(diskGeom, diskMat);
        // Tilt disk
        disk.rotation.x = Math.PI * 0.2;
        scene.add(disk);

        // Glow Sprite? (Optional, skip for perf/simplicity, using fog instead)

        let frameId = 0;
        const animate = () => {
            // Rotate disk
            disk.rotation.y -= 0.005;
            // Rotate particles inside? (Shader needed for true fluid)

            // Wobble camera
            camera.position.y = Math.sin(Date.now() * 0.0005) * 5;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(frameId);
    });
};

// 4. Cyber Grid
const ThreeCyberGridBackground = () => {
    return useThreeSetup((scene, camera, renderer) => {
        camera.position.z = 50;
        camera.position.y = 10;

        // Rolling Grid (Plane)
        const planeGeom = new THREE.PlaneGeometry(200, 200, 40, 40);
        // Deform to make mountains
        const pos = planeGeom.attributes.position.array as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i];
            const y = pos[i + 1]; // Actually local y, which will be Z in world
            // Make edges higher
            const dist = Math.abs(x);
            if (dist > 30) {
                pos[i + 2] = Math.random() * (dist - 30) * 0.5; // Z height (mountains)
            }
        }
        planeGeom.computeVertexNormals();

        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const grid = new THREE.Mesh(planeGeom, mat);
        grid.rotation.x = -Math.PI / 2;
        scene.add(grid);

        // Top Sun
        const sun = new THREE.Mesh(
            new THREE.CircleGeometry(20, 32),
            new THREE.MeshBasicMaterial({ color: 0xff00ff })
        );
        sun.position.set(0, 10, -50);
        scene.add(sun);

        // Grid lines on Sun (Scanline effect) - simplified using Stripes?
        // Just simple sun for now.

        let frameId = 0;
        const animate = () => {
            // Move grid towards camera simulation
            grid.position.z += 0.2;
            if (grid.position.z > 5) grid.position.z = 0;

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(frameId);
    });
};
