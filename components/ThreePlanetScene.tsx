import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type PlanetPreset = 'gaia' | 'inferno' | 'glacial' | 'storm' | 'synth';

interface Props {
    preset: PlanetPreset;
}

// GLSL Noise 3D
const noise3D = `
// Simplex 3D Noise 
// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0.0 + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N=N*N*N*N )
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

const vertexShader = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uDisplacement;
uniform float uSpeed;

varying vec2 vUv;
varying vec3 vNormal;
varying float vNoise;
varying vec3 vPosition;

${noise3D}

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  
  float n = snoise(position * uNoiseScale + vec3(uTime * uSpeed));
  vNoise = n;
  
  vec3 newPos = position + normal * n * uDisplacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`;

const fragmentShader = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uAtmosphere;
uniform vec3 uAtmosphereColor;
uniform bool uSynthMode;

varying vec3 vNormal;
varying float vNoise;
varying vec3 vPosition;

void main() {
  // Simple lighting
  vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
  float diff = max(dot(vNormal, lightDir), 0.0);
  
  // Color Mixing based on noise
  vec3 color;
  float n = vNoise * 0.5 + 0.5; // 0..1
  
  if (uSynthMode) {
     // Grid effect for Synth
     float grid = step(0.95, fract(vPosition.y * 2.0)) + step(0.95, fract(vPosition.x * 2.0));
     color = mix(uColor1, uColor2, grid);
     color += uColor3 * pow(n, 3.0);
  } else {
    // Topo mixing
    if (n < 0.3) {
      color = mix(uColor1, uColor2, n / 0.3);
    } else {
      color = mix(uColor2, uColor3, (n - 0.3) / 0.7);
    }
  }
  
  // Diffuse Lighting
  color *= (0.5 + 0.5 * diff);
  
  // Atmosphere / Rim Light
  vec3 viewDir = normalize(cameraPosition - vPosition); // approx in varying? No, vPosition is local. 
  // Standard Rim: 1 - dot(normal, view)
  // Actually we need viewDir in view space or world space. 
  // For simplicity, just use Z component of Normal (approx for view space aligned)
  // vNormal is in View Space if we used normalMatrix.
  float rim = 1.0 - abs(dot(vNormal, vec3(0,0,1)));
  color += uAtmosphereColor * pow(rim, 3.0) * uAtmosphere;
  
  gl_FragColor = vec4(color, 1.0);
}
`;

const CONFIGS: Record<PlanetPreset, {
    c1: number[], c2: number[], c3: number[],
    scale: number, displ: number, speed: number,
    atm: number, atmC: number[], synth: boolean
}> = {
    gaia: {
        c1: [0.0, 0.1, 0.4], // Deep Ocean
        c2: [0.0, 0.6, 0.1], // Land
        c3: [1.0, 1.0, 1.0], // Snow/Cloud
        scale: 1.5, displ: 0.1, speed: 0.1,
        atm: 0.8, atmC: [0.2, 0.6, 1.0], synth: false
    },
    inferno: {
        c1: [0.3, 0.0, 0.0], // Dark Rock
        c2: [1.0, 0.2, 0.0], // Lava
        c3: [1.0, 0.9, 0.0], // Hot
        scale: 2.0, displ: 0.3, speed: 0.2,
        atm: 1.0, atmC: [1.0, 0.2, 0.0], synth: false
    },
    glacial: {
        c1: [0.2, 0.4, 0.8], // Deep Ice
        c2: [0.6, 0.8, 1.0], // Surface
        c3: [0.9, 1.0, 1.0], // Highlights
        scale: 0.8, displ: 0.05, speed: 0.05,
        atm: 0.6, atmC: [0.8, 0.9, 1.0], synth: false
    },
    storm: {
        c1: [0.1, 0.0, 0.2], // Dark Purple
        c2: [0.4, 0.0, 0.6], // Storm
        c3: [1.0, 0.5, 0.8], // Lightning
        scale: 5.0, displ: 0.05, speed: 0.4,
        atm: 0.4, atmC: [0.8, 0.0, 1.0], synth: false
    },
    synth: {
        c1: [0.0, 0.0, 0.1], // Black/Blue
        c2: [0.0, 1.0, 1.0], // Cyan
        c3: [1.0, 0.0, 1.0], // Magenta
        scale: 1.0, displ: 0.0, speed: 0.2,
        atm: 0.9, atmC: [0.0, 1.0, 1.0], synth: true
    }
};

export const ThreePlanetScene: React.FC<Props> = ({ preset }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef<any>(null);
    const targetConfigRef = useRef(CONFIGS[preset]);

    // Transition logic
    useEffect(() => {
        targetConfigRef.current = CONFIGS[preset];
    }, [preset]);

    useEffect(() => {
        if (!mountRef.current) return;
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);

        // Mesh
        const geom = new THREE.SphereGeometry(1.8, 128, 128); // High detail for displacement

        const initial = CONFIGS[preset];
        const uniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Vector3(...initial.c1) },
            uColor2: { value: new THREE.Vector3(...initial.c2) },
            uColor3: { value: new THREE.Vector3(...initial.c3) },
            uNoiseScale: { value: initial.scale },
            uDisplacement: { value: initial.displ },
            uSpeed: { value: initial.speed },
            uAtmosphere: { value: initial.atm },
            uAtmosphereColor: { value: new THREE.Vector3(...initial.atmC) },
            uSynthMode: { value: initial.synth }
        };
        uniformsRef.current = uniforms;

        const mat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true
        });

        const planet = new THREE.Mesh(geom, mat);
        scene.add(planet);

        // Stars particles in background
        const starGeom = new THREE.BufferGeometry();
        const starPos = [];
        for (let i = 0; i < 2000; i++) {
            starPos.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 50 - 20);
        }
        starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.6 });
        const stars = new THREE.Points(starGeom, starMat);
        scene.add(stars);

        // Resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Loop
        let frameId = 0;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const lerpVec = (v: THREE.Vector3, tArr: number[], f: number) => {
            v.x = lerp(v.x, tArr[0], f);
            v.y = lerp(v.y, tArr[1], f);
            v.z = lerp(v.z, tArr[2], f);
        };

        const animate = (time: number) => {
            const t = time * 0.001;
            uniforms.uTime.value = t;

            // Rotate planet
            planet.rotation.y = t * 0.1;
            stars.rotation.z = t * 0.02;

            // Transition Interp
            const target = targetConfigRef.current;
            const f = 0.05; // Smoothing factor

            lerpVec(uniforms.uColor1.value, target.c1, f);
            lerpVec(uniforms.uColor2.value, target.c2, f);
            lerpVec(uniforms.uColor3.value, target.c3, f);
            lerpVec(uniforms.uAtmosphereColor.value, target.atmC, f);

            uniforms.uNoiseScale.value = lerp(uniforms.uNoiseScale.value, target.scale, f);
            uniforms.uDisplacement.value = lerp(uniforms.uDisplacement.value, target.displ, f);
            uniforms.uSpeed.value = lerp(uniforms.uSpeed.value, target.speed, f);
            uniforms.uAtmosphere.value = lerp(uniforms.uAtmosphere.value, target.atm, f);
            uniforms.uSynthMode.value = target.synth; // Boolean, sudden switch

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId);
            mountRef.current?.removeChild(renderer.domElement);
            renderer.dispose();
            geom.dispose();
            mat.dispose();
        };
    }, []); // Only mount once, use refs for updates

    return <div ref={mountRef} className="absolute inset-0 w-full h-full -z-10 bg-black" />;
};
