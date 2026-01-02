import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame, extend } from '@react-three/fiber';
import { DrawSettings, DrawMode, BrushSettings } from '../types';

// Register custom shader material
import { shaderMaterial } from '@react-three/drei';

// Ink Shader Material (Based on Nebula logic but lighter)
const InkMaterial = shaderMaterial(
    {
        uTime: 0,
        uColor: new THREE.Color(1, 1, 1),
        uOpacity: 1.0,
        uFlow: 0.0,      // Ink flow/turbulence
        uBloom: 1.0,     // Bloom strength
        uMap: null,      // Optional texture map
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    varying float vAlpha;
    varying float vSize;
    attribute float aSize;
    attribute float aAlpha;
    
    uniform float uTime;
    uniform float uFlow;

    // Simplex noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i); 
        vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vUv = uv;
      vAlpha = aAlpha;
      vSize = aSize;
      
      vec3 pos = position;
      
      // Ink flow turbulence
      if (uFlow > 0.0) {
        float noise = snoise(pos * 0.1 + vec3(0.0, uTime * 0.5, 0.0));
        pos += normalize(pos) * noise * uFlow * 5.0;
      }
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      gl_PointSize = size * aSize * (300.0 / -mvPosition.z);
    }
  `,
    // Fragment Shader
    `
    varying float vAlpha;
    varying float vSize;
    
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uBloom;
    
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float dist = length(uv);
      if (dist > 0.5) discard;
      
      // Soft brush edge
      float strength = smoothstep(0.5, 0.0, dist);
      
      // Bloom boost
      vec3 finalColor = uColor * (1.0 + uBloom);
      
      gl_FragColor = vec4(finalColor, strength * uOpacity * vAlpha);
    }
  `
);

extend({ InkMaterial });

interface InkCanvasProps {
    settings: DrawSettings;
    planetRef: React.MutableRefObject<THREE.Object3D | null>;
    camera: THREE.Camera;
}

// Maximum number of points in the buffer
const MAX_POINTS = 50000;

export const InkCanvas: React.FC<InkCanvasProps> = ({ settings, planetRef, camera }) => {
    const { gl } = useThree();
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<any>(null);

    // Data buffers
    const [positions] = useState(() => new Float32Array(MAX_POINTS * 3));
    const [sizes] = useState(() => new Float32Array(MAX_POINTS));
    const [alphas] = useState(() => new Float32Array(MAX_POINTS));
    const countRef = useRef(0);

    const geometryRef = useRef<THREE.BufferGeometry>(null);

    // Input state
    const isDrawing = useRef(false);
    const lastPoint = useRef<THREE.Vector3 | null>(null);

    // Helper for raycaster
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const mouse = useMemo(() => new THREE.Vector2(), []);

    // Update shader Uniforms
    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uTime = clock.getElapsedTime();
            materialRef.current.uColor.set(settings.brush.color);
            materialRef.current.uOpacity = settings.brush.opacity;
            materialRef.current.uFlow = settings.inkFlow;
            materialRef.current.uBloom = settings.inkBloom;
        }
    });

    // Handle pointer events
    useEffect(() => {
        const canvas = gl.domElement;

        const handlePointerDown = (e: PointerEvent) => {
            if (!settings.enabled || settings.mode === DrawMode.Off) return;
            if (e.button !== 0) return; // Only left click
            isDrawing.current = true;
            lastPoint.current = null;
        };

        const handlePointerUp = () => {
            isDrawing.current = false;
            lastPoint.current = null;
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDrawing.current || !settings.enabled || settings.mode === DrawMode.Off) return;
            if (!planetRef.current) return;

            // Correctly handle normalization based on canvas bounding box
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            mouse.set(x, y);
            raycaster.setFromCamera(mouse, camera);

            // Intersection with the Planet (or its children)
            // We assume planetRef points to a Group or Mesh containing the sphere
            const intersects = raycaster.intersectObjects([planetRef.current], true);

            if (intersects.length > 0) {
                // Get the interaction point on surface
                const point = intersects[0].point;

                // Pressure 
                const pressure = e.pressure !== undefined ? e.pressure : 0.5;
                // If not supported pointer type (like mouse with pressure=0 or 0.5 const), default to 1.0 or user setting
                const effectivePressure = e.pointerType === 'pen' ? pressure : 1.0;

                handleAddPoint(point, effectivePressure);
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointermove', handlePointerMove);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointermove', handlePointerMove);
        };
    }, [settings, planetRef, camera, gl]);

    const handleAddPoint = (worldPoint: THREE.Vector3, pressure: number) => {
        if (countRef.current >= MAX_POINTS) return; // Buffer full

        // Convert world point to local point relative to planet container
        // But since the InkMesh is inside the same container, we might just use worldPoint or local.
        // However, if the planet rotates, we want the ink to stick.
        // So the InkCanvas mesh should be a child of the planet mesh.
        // If InkCanvas is rendered inside PlanetScene, it should be inside the rotating group.

        // We assume the received 'worldPoint' is in World Space.
        // We need to convert it to Local Space of the planet so it rotates with it.
        const localPoint = worldPoint.clone();
        if (planetRef.current) {
            planetRef.current.worldToLocal(localPoint);
        }

        // Apply altitude
        localPoint.normalize().multiplyScalar(planetRef.current ? 100 + settings.altitude : 150); // Assuming base radius 100 if unknown, but better use normalized direction
        // Wait, we need actual radius. The intersects point is ON the surface.
        // So we just add altitude to the radius of that point.
        const currentRadius = localPoint.length();
        localPoint.normalize().multiplyScalar(currentRadius + settings.altitude);


        // === Symmetry Engine ===
        const pointsToAdd: THREE.Vector3[] = [];

        if (settings.mode === DrawMode.Kaleidoscope) {
            // 2D Kaleidoscope Logic (Projected on Sphere? Or Screen Space?)
            // User asked for "2D Kaleidoscope". Strictly speaking, 2D kaleidoscope logic is normally in screen space.
            // But we are drawing ON a 3D planet. 
            // Compromise: We treat the "North Pole" (Y-axis) as the center of the kaleidoscope?
            // Or we just do Radial Symmetry around the Y-axis (Planetary Spin covers this).
            // Let's implement "Radial Symmetry" around the Y-axis as the most robust "Kaleidoscope-like" effect on a sphere.
            // Wait, "Planetary Spin" IS Radial Symmetry around Y-axis.
            // "2D Kaleidoscope" usually implies mirroring too. 
            // Let's implement Radial + Mirror around Y-axis.

            const segments = settings.segments;
            const angleStep = (Math.PI * 2) / segments;

            // Convert to Spherical to easily manipulate angle (theta/phi)
            const spherical = new THREE.Spherical().setFromVector3(localPoint);

            for (let i = 0; i < segments; i++) {
                const theta = spherical.theta + angleStep * i;
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                pointsToAdd.push(p);

                // Mirroring? If we want true kaleidoscope, we mirror within the segment.
                // For simplicity first pass: just Radial (Rotational Symmetry).
                // If user wants mirror:
                // const pMirror = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, -theta);
                // pointsToAdd.push(pMirror);
            }

        } else if (settings.mode === DrawMode.PlanetSpin) {
            // 3D Planetary Spin (Longitude)
            // Logic: Same as above, N points along the equator (Y-axis rotation).
            // Just reusing the loop above.
            const segments = settings.segments;
            const angleStep = (Math.PI * 2) / segments;
            const spherical = new THREE.Spherical().setFromVector3(localPoint);

            for (let i = 0; i < segments; i++) {
                const theta = spherical.theta + angleStep * i;
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                pointsToAdd.push(p);
            }
        }

        // Add real points to buffer
        pointsToAdd.forEach(p => {
            if (countRef.current >= MAX_POINTS) return;

            const i = countRef.current;
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            sizes[i] = settings.brush.size * (settings.brush.usePressure ? pressure : 1.0);
            alphas[i] = settings.brush.usePressure ? pressure : 1.0;

            countRef.current++;
        });

        // Mark for update
        if (geometryRef.current) {
            geometryRef.current.attributes.position.needsUpdate = true;
            geometryRef.current.attributes.aSize.needsUpdate = true;
            geometryRef.current.attributes.aAlpha.needsUpdate = true;
            geometryRef.current.setDrawRange(0, countRef.current);
        }
    };

    // Clear function (exposed via some event? or just use a key for now)
    // For now, no clear button implemented in this minimal component.

    return (
        <points ref={pointsRef}>
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute
                    attach="attributes-position"
                    count={MAX_POINTS}
                    array={positions}
                    itemSize={3}
                    usage={THREE.DynamicDrawUsage}
                />
                <bufferAttribute
                    attach="attributes-aSize"
                    count={MAX_POINTS}
                    array={sizes}
                    itemSize={1}
                    usage={THREE.DynamicDrawUsage}
                />
                <bufferAttribute
                    attach="attributes-aAlpha"
                    count={MAX_POINTS}
                    array={alphas}
                    itemSize={1}
                    usage={THREE.DynamicDrawUsage}
                />
            </bufferGeometry>
            {/* @ts-ignore */}
            <inkMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
    );
};
