/**
 * input: DrawSettings（drawings + placements + symmetry2D/3D + brush）与 PlanetScene 提供的 planetMeshesRef
 * output: 在 Three.js Scene 中生成/更新绘图特效渲染对象（Points / InstancedMesh），并支持 placement 绑定到多个星球
 * pos: Workbench 绘图渲染器（PlanetScene 子系统），负责把 2D strokes 转为 3D Growth Space 并渲染
 * update: 一旦我被更新，请同步更新 components/README.md
 */

import * as THREE from 'three';
import {
    BrushType,
    DrawPoint2D,
    DrawSettings,
    Drawing,
    DrawingLayer,
    DrawingPlacement,
    RadialReflectionMode,
    Symmetry2DMode,
    Symmetry2DSettings,
    Symmetry3DMode,
    Symmetry3DSettings
} from '../types';

// ==================== SHADERS ====================

const inkVertexShader = `
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
        float noise = snoise(pos * 0.01 + vec3(0.0, uTime * 0.5, 0.0));
        pos += normalize(pos) * noise * uFlow * 5.0;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = size * aSize * (300.0 / -mvPosition.z);
}
`;

const inkFragmentShader = `
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
    
    gl_FragColor = vec4(uColor, strength * uOpacity * vAlpha);
}
`;

// --- STARDUST SHADER ---
const stardustVertexShader = `
varying float vAlpha;
attribute float aSize;
attribute float aAlpha;
uniform float uTime;

void main() {
    vAlpha = aAlpha;
    vec3 pos = position;
    // Twinkle effect based on position and time
    float twinkle = sin(uTime * 5.0 + pos.x * 0.1 + pos.y * 0.1) * 0.5 + 0.5;
    vAlpha *= (0.5 + 0.5 * twinkle);
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * aSize * (1.0 + twinkle * 0.5) * (300.0 / -mvPosition.z);
}
`;

const stardustFragmentShader = `
varying float vAlpha;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    
    // Sharp core, glowy edge
    float core = 1.0 - smoothstep(0.0, 0.1, dist);
    float glow = 1.0 - smoothstep(0.1, 0.5, dist);
    float alpha = core + glow * 0.5;
    
    gl_FragColor = vec4(uColor + vec3(0.5), alpha * uOpacity * vAlpha); // Add white tint
}
`;

// --- GAS CLOUD SHADER ---
const gasVertexShader = `
varying float vAlpha;
varying vec2 vUv;
attribute float aSize;
attribute float aAlpha;
uniform float uTime;

// Noise function (same as ink or simplified)
// ... (omitted for brevity, utilizing simple displacement)

void main() {
    vAlpha = aAlpha;
    vec3 pos = position;
    
    // Slow drift
    pos.x += sin(uTime * 0.2 + pos.y * 0.1) * 2.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * aSize * 2.0 * (300.0 / -mvPosition.z); // Larger fluffier
}
`;

const gasFragmentShader = `
varying float vAlpha;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    // Cloud texture procedural
    float noise = sin(uv.x * 10.0) * sin(uv.y * 10.0); // Placeholder noise
    float strength = smoothstep(0.5, 0.2, dist);
    
    gl_FragColor = vec4(uColor, strength * 0.5 * uOpacity * vAlpha);
}
`;

// --- ENERGY BEAM SHADER ---
const energyVertexShader = `
varying float vAlpha;
attribute float aSize;
attribute float aAlpha;

uniform float uTime;
uniform float uFlow;

void main() {
    vAlpha = aAlpha;
    vec3 pos = position;

    // subtle flicker/stream motion
    float wobble = sin(uTime * 10.0 + pos.x * 0.03 + pos.y * 0.03 + pos.z * 0.02);
    pos += normalize(pos + vec3(0.001)) * wobble * uFlow * 0.8;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * aSize * (300.0 / -mvPosition.z);
}
`;

const energyFragmentShader = `
varying float vAlpha;

uniform vec3 uColor;
uniform float uOpacity;
uniform float uGlowIntensity;
uniform float uCoreWidth;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float coreR = mix(0.05, 0.28, clamp(uCoreWidth, 0.0, 1.0));
    float core = 1.0 - smoothstep(0.0, coreR, dist);
    float glow = 1.0 - smoothstep(coreR, 0.5, dist);

    float glowBoost = 0.35 + 1.6 * clamp(uGlowIntensity, 0.0, 2.0);
    float a = core + glow * glowBoost;

    vec3 col = uColor * (1.0 + 1.6 * clamp(uGlowIntensity, 0.0, 2.0)) + vec3(0.15) * clamp(uGlowIntensity, 0.0, 2.0);
    gl_FragColor = vec4(col, a * uOpacity * vAlpha);
}
`;

// ==================== INK MANAGER（渲染器） ====================

type PlanetMeshesMap = Map<string, { core: THREE.Object3D }>;

type LayerRender = {
    id: string;
    group: THREE.Group;
    points?: THREE.Points;
    instanced?: THREE.InstancedMesh;
    signature: string;
};

type PlacementRender = {
    id: string;
    group: THREE.Group;
    layerRenders: Map<string, LayerRender>;
    signature: string;
};

const BLOOM_LAYER = 1;

export class InkManager {
    private scene: THREE.Scene;
    private renderRoot: THREE.Group;

    private settings: DrawSettings | null = null;
    private planets: Map<string, any> | null = null;

    private placementRenders: Map<string, PlacementRender> = new Map();

    constructor(scene: THREE.Scene, _camera: THREE.Camera, _domElement: HTMLElement) {
        this.scene = scene;
        this.renderRoot = new THREE.Group();
        this.renderRoot.name = 'InkWorkbenchRoot';
        this.renderRoot.renderOrder = 998;
        this.scene.add(this.renderRoot);
    }

    public setSettings(settings: DrawSettings) {
        this.settings = settings;
    }

    public setPlanets(planets: Map<string, any>) {
        this.planets = planets;
    }

    public dispose() {
        this.placementRenders.forEach(p => this.disposePlacement(p));
        this.placementRenders.clear();
        this.scene.remove(this.renderRoot);
    }

    public update(time: number) {
        if (!this.settings?.enabled) {
            this.renderRoot.visible = false;
            return;
        }
        this.renderRoot.visible = true;

        const settings = this.settings;
        const placements = settings.placements || [];

        // 1) 同步 placements（创建/删除）
        const visiblePlacementIds = new Set(placements.filter(p => p.visible !== false).map(p => p.id));
        for (const [id, pr] of this.placementRenders) {
            if (!visiblePlacementIds.has(id)) {
                this.disposePlacement(pr);
                this.placementRenders.delete(id);
            }
        }

        placements.forEach(p => {
            if (p.visible === false) return;
            const pr = this.ensurePlacement(p);
            this.updatePlacementTransform(pr.group, p);
            const drawing = (settings.drawings || []).find(d => d.id === p.drawingId);
            if (!drawing) {
                this.clearPlacementLayers(pr);
                return;
            }
            this.syncDrawingLayers(pr, drawing, p, time);
        });
    }

    private ensurePlacement(p: DrawingPlacement): PlacementRender {
        let pr = this.placementRenders.get(p.id);
        if (!pr) {
            const group = new THREE.Group();
            group.name = `InkPlacement:${p.id}`;
            group.layers.enable(BLOOM_LAYER);
            this.renderRoot.add(group);
            pr = { id: p.id, group, layerRenders: new Map(), signature: '' };
            this.placementRenders.set(p.id, pr);
        }
        return pr;
    }

    private disposePlacement(pr: PlacementRender) {
        pr.layerRenders.forEach(lr => this.disposeLayerRender(lr));
        pr.layerRenders.clear();
        if (pr.group.parent) pr.group.parent.remove(pr.group);
    }

    private clearPlacementLayers(pr: PlacementRender) {
        pr.layerRenders.forEach(lr => this.disposeLayerRender(lr));
        pr.layerRenders.clear();
    }

    private disposeLayerRender(lr: LayerRender) {
        if (lr.points) {
            if (lr.points.parent) lr.points.parent.remove(lr.points);
            lr.points.geometry.dispose();
            (lr.points.material as THREE.Material).dispose();
        }
        if (lr.instanced) {
            if (lr.instanced.parent) lr.instanced.parent.remove(lr.instanced);
            lr.instanced.geometry.dispose();
            (lr.instanced.material as THREE.Material).dispose();
        }
        if (lr.group.parent) lr.group.parent.remove(lr.group);
    }

    private updatePlacementTransform(group: THREE.Group, p: DrawingPlacement) {
        const planetCore = this.planets?.get(p.planetId)?.core || null;
        const planetPos = planetCore ? planetCore.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const planetQuat = planetCore ? planetCore.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();

        const follow = THREE.MathUtils.clamp(p.followPlanetRotation ?? 1, 0, 1);
        const baseQuat = new THREE.Quaternion();
        baseQuat.slerp(planetQuat, follow);

        const tiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            THREE.MathUtils.degToRad(p.tilt?.x || 0),
            THREE.MathUtils.degToRad(p.tilt?.y || 0),
            THREE.MathUtils.degToRad(p.tilt?.z || 0)
        ));

        group.position.copy(planetPos);
        group.position.x += p.offset?.x || 0;
        group.position.y += p.offset?.y || 0;
        group.position.z += p.offset?.z || 0;

        group.quaternion.copy(baseQuat).multiply(tiltQuat);
        group.scale.setScalar(p.scale || 1);
    }

    private syncDrawingLayers(pr: PlacementRender, drawing: Drawing, placement: DrawingPlacement, time: number) {
        const layerIds = new Set((drawing.layers || []).filter(l => l.visible !== false).map(l => l.id));
        for (const [id, lr] of pr.layerRenders) {
            if (!layerIds.has(id)) {
                this.disposeLayerRender(lr);
                pr.layerRenders.delete(id);
            }
        }

        (drawing.layers || []).forEach(layer => {
            if (layer.visible === false) return;
            let lr = pr.layerRenders.get(layer.id);
            if (!lr) {
                const g = new THREE.Group();
                g.name = `InkLayer:${layer.id}`;
                g.layers.enable(BLOOM_LAYER);
                pr.group.add(g);
                lr = { id: layer.id, group: g, signature: '' };
                pr.layerRenders.set(layer.id, lr);
            }

            this.updateLayerTransform(lr.group, layer);
            this.updateLayerMeshes(lr, layer, drawing, placement);
            this.updateLayerUniforms(lr, layer, time);
        });
    }

    private updateLayerTransform(group: THREE.Group, layer: DrawingLayer) {
        group.rotation.set(
            THREE.MathUtils.degToRad(layer.tilt?.x || 0),
            THREE.MathUtils.degToRad(layer.tilt?.y || 0),
            THREE.MathUtils.degToRad(layer.tilt?.z || 0)
        );
        group.scale.setScalar(layer.scale || 1);
        group.position.set(0, 0, layer.altitude || 0);
    }

    private updateLayerUniforms(lr: LayerRender, layer: DrawingLayer, time: number) {
        if (lr.points) {
            const mat = lr.points.material as THREE.ShaderMaterial;
            if (mat.uniforms?.uTime) mat.uniforms.uTime.value = time;
            if (mat.uniforms?.uColor) mat.uniforms.uColor.value.set(layer.color);
            if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = layer.opacity;

            if (layer.brushType === BrushType.EnergyBeam) {
                const energy = this.getEnergyParams(layer);
                if (mat.uniforms?.uGlowIntensity) mat.uniforms.uGlowIntensity.value = energy.glowIntensity;
                if (mat.uniforms?.uCoreWidth) mat.uniforms.uCoreWidth.value = energy.coreWidth;
                if (mat.uniforms?.uFlow) mat.uniforms.uFlow.value = 0.35 + energy.glowIntensity * 0.25;
                if (mat.uniforms?.size) mat.uniforms.size.value = 0.85;
            } else {
                if (mat.uniforms?.uFlow) mat.uniforms.uFlow.value = 0.0;
                if (mat.uniforms?.size) mat.uniforms.size.value = 1.0;
            }
        }
        if (lr.instanced) {
            const mat = lr.instanced.material as THREE.MeshBasicMaterial;
            mat.color.set(layer.color);
            mat.opacity = layer.opacity;
        }

        if (layer.rotationSpeed) {
            lr.group.rotation.y += layer.rotationSpeed * 0.001;
        }
    }

    private updateLayerMeshes(lr: LayerRender, layer: DrawingLayer, drawing: Drawing, placement: DrawingPlacement) {
        const strokes = layer.strokes || [];
        const strokeCount = strokes.length;
        let totalPoints = 0;
        let lastStrokeId = '';
        let lastStrokePoints = 0;
        if (strokeCount > 0) {
            const last = strokes[strokeCount - 1];
            lastStrokeId = last.id;
            lastStrokePoints = last.points?.length || 0;
        }
        strokes.forEach(s => { totalPoints += (s.points?.length || 0); });

        const signature = [
            drawing.id,
            placement.id,
            layer.id,
            layer.brushType,
            layer.color,
            layer.opacity,
            layer.blending,
            strokeCount,
            totalPoints,
            lastStrokeId,
            lastStrokePoints
        ].join('|');

        if (signature === lr.signature) return;
        lr.signature = signature;

        // Rebuild
        if (layer.brushType === BrushType.Crystal) {
            if (lr.points) {
                if (lr.points.parent) lr.points.parent.remove(lr.points);
                lr.points.geometry.dispose();
                (lr.points.material as THREE.Material).dispose();
                lr.points = undefined;
            }
            this.buildCrystalLayer(lr, layer);
        } else {
            if (lr.instanced) {
                if (lr.instanced.parent) lr.instanced.parent.remove(lr.instanced);
                lr.instanced.geometry.dispose();
                (lr.instanced.material as THREE.Material).dispose();
                lr.instanced = undefined;
            }
            this.buildPointsLayer(lr, layer);
        }
    }

    private buildPointsLayer(lr: LayerRender, layer: DrawingLayer) {
        const samples = this.collectLayerSamples(layer);
        const count = samples.length;

        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const alphas = new Float32Array(count);

        samples.forEach((s, i) => {
            positions[i * 3] = s.pos.x;
            positions[i * 3 + 1] = s.pos.y;
            positions[i * 3 + 2] = s.pos.z;
            sizes[i] = s.size;
            alphas[i] = s.alpha;
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        geometry.setDrawRange(0, count);

        let vShader = inkVertexShader;
        let fShader = inkFragmentShader;

        if (layer.brushType === BrushType.Stardust) {
            vShader = stardustVertexShader;
            fShader = stardustFragmentShader;
        } else if (layer.brushType === BrushType.GasCloud) {
            vShader = gasVertexShader;
            fShader = gasFragmentShader;
        } else if (layer.brushType === BrushType.EnergyBeam) {
            vShader = energyVertexShader;
            fShader = energyFragmentShader;
        }

        const material = new THREE.ShaderMaterial({
            vertexShader: vShader,
            fragmentShader: fShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(layer.color) },
                uOpacity: { value: layer.opacity },
                uBloom: { value: 0.0 },
                uFlow: { value: 0.0 },
                uGlowIntensity: { value: 1.0 },
                uCoreWidth: { value: 0.4 },
                size: { value: 1.0 }
            },
            transparent: true,
            depthWrite: false,
            blending: layer.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 999;
        points.layers.enable(BLOOM_LAYER);

        if (lr.points) {
            if (lr.points.parent) lr.points.parent.remove(lr.points);
            lr.points.geometry.dispose();
            (lr.points.material as THREE.Material).dispose();
        }
        lr.points = points;
        lr.group.add(points);
    }

    private buildCrystalLayer(lr: LayerRender, layer: DrawingLayer) {
        const samples = this.collectLayerSamples(layer);
        const maxInstances = 6000;
        const count = Math.min(samples.length, maxInstances);

        const geometry = new THREE.TetrahedronGeometry(1, 0);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(layer.color),
            transparent: true,
            opacity: layer.opacity,
            blending: layer.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: false
        });

        const instanced = new THREE.InstancedMesh(geometry, material, count);
        instanced.frustumCulled = false;
        instanced.renderOrder = 999;
        instanced.layers.enable(BLOOM_LAYER);

        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            const sample = samples[i];
            const rot = new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            q.setFromEuler(rot);
            const size = Math.max(0.5, sample.size * 0.2);
            s.set(size, size * (0.8 + Math.random() * 0.6), size);
            m.compose(sample.pos, q, s);
            instanced.setMatrixAt(i, m);
        }
        instanced.instanceMatrix.needsUpdate = true;

        if (lr.instanced) {
            if (lr.instanced.parent) lr.instanced.parent.remove(lr.instanced);
            lr.instanced.geometry.dispose();
            (lr.instanced.material as THREE.Material).dispose();
        }
        lr.instanced = instanced;
        lr.group.add(instanced);
    }

    private getEnergyParams(layer: DrawingLayer): { coreWidth: number; glowIntensity: number } {
        const fromSettings = this.settings?.brush;
        if (fromSettings?.type === BrushType.EnergyBeam) {
            return {
                coreWidth: THREE.MathUtils.clamp(fromSettings.coreWidth ?? 0.4, 0, 1),
                glowIntensity: THREE.MathUtils.clamp(fromSettings.glowIntensity ?? 1.0, 0, 2)
            };
        }

        const strokes = layer.strokes || [];
        for (let i = strokes.length - 1; i >= 0; i--) {
            const b = strokes[i]?.brush;
            if (b?.type === BrushType.EnergyBeam) {
                return {
                    coreWidth: THREE.MathUtils.clamp(b.coreWidth ?? 0.4, 0, 1),
                    glowIntensity: THREE.MathUtils.clamp(b.glowIntensity ?? 1.0, 0, 2)
                };
            }
        }

        return { coreWidth: 0.4, glowIntensity: 1.0 };
    }

    private collectLayerSamples(layer: DrawingLayer): Array<{ pos: THREE.Vector3; size: number; alpha: number }> {
        const out: Array<{ pos: THREE.Vector3; size: number; alpha: number }> = [];
        const strokes = layer.strokes || [];

        const isEnergy = layer.brushType === BrushType.EnergyBeam;

        strokes.forEach(stroke => {
            const brush = stroke.brush;
            const baseSize = brush.size || 10;
            const baseOpacity = brush.opacity ?? 1;
            const usePressure = brush.usePressure;

            const pts = stroke.points || [];
            if (!isEnergy || pts.length <= 1) {
                pts.forEach(pt => {
                    const uvCopies = this.applySymmetry2D(pt, stroke.symmetry2D);
                    uvCopies.forEach(uv => {
                        const posBase = this.uvToGrowth(uv, stroke.canvasSize, stroke.symmetry3D);
                        const posCopies = this.applySymmetry3D(posBase, stroke.symmetry3D);
                        posCopies.forEach(pos => {
                            const p = usePressure ? (pt.pressure ?? 1) : 1;
                            const size = (brush.pressureInfluence?.size ? baseSize * p : baseSize);
                            const alpha = (brush.pressureInfluence?.opacity ? baseOpacity * p : baseOpacity);
                            out.push({ pos, size, alpha });
                        });
                    });
                });
                return;
            }

            const canvasSize = stroke.canvasSize || 300;
            for (let si = 0; si < pts.length - 1; si++) {
                const a = pts[si];
                const b = pts[si + 1];

                const du = (b.u - a.u) * canvasSize;
                const dv = (b.v - a.v) * canvasSize;
                const distPx = Math.sqrt(du * du + dv * dv);

                const pa = a.pressure ?? 1;
                const pb = b.pressure ?? 1;
                const pAvg = (pa + pb) * 0.5;
                const flowMul = brush.pressureInfluence?.flow ? THREE.MathUtils.clamp(pAvg, 0.25, 2.0) : 1.0;
                const steps = Math.min(64, Math.max(1, Math.floor(distPx * 0.25 * flowMul)));

                for (let j = 0; j <= steps; j++) {
                    if (si > 0 && j === 0) continue;
                    const t = steps === 0 ? 0 : j / steps;

                    const pt: DrawPoint2D = {
                        ...a,
                        u: a.u + (b.u - a.u) * t,
                        v: a.v + (b.v - a.v) * t,
                        pressure: pa + (pb - pa) * t,
                        tiltX: (a.tiltX ?? 0) + ((b.tiltX ?? 0) - (a.tiltX ?? 0)) * t,
                        tiltY: (a.tiltY ?? 0) + ((b.tiltY ?? 0) - (a.tiltY ?? 0)) * t
                    };

                    const uvCopies = this.applySymmetry2D(pt, stroke.symmetry2D);
                    uvCopies.forEach(uv => {
                        const posBase = this.uvToGrowth(uv, canvasSize, stroke.symmetry3D);
                        const posCopies = this.applySymmetry3D(posBase, stroke.symmetry3D);
                        posCopies.forEach(pos => {
                            const p = usePressure ? (pt.pressure ?? 1) : 1;
                            const size = (brush.pressureInfluence?.size ? baseSize * p : baseSize) * 0.9;
                            const alpha = (brush.pressureInfluence?.opacity ? baseOpacity * p : baseOpacity);
                            out.push({ pos, size, alpha });
                        });
                    });
                }
            }
        });

        return out;
    }

    private applySymmetry2D(pt: DrawPoint2D, sym: Symmetry2DSettings): DrawPoint2D[] {
        const centerU = 0.5;
        const centerV = 0.5;

        if (!sym || sym.mode === Symmetry2DMode.None) {
            return [pt];
        }

        const relX = pt.u - centerU;
        const relY = pt.v - centerV;

        if (sym.mode === Symmetry2DMode.Mirror) {
            const angle = (sym.mirrorAxisAngle || 0) * Math.PI / 180;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            // Rotate -> mirror -> rotate back
            const x1 = relX * cosA + relY * sinA;
            const y1 = -relX * sinA + relY * cosA;
            const y1m = -y1;
            const xr = x1 * cosA - y1m * sinA;
            const yr = x1 * sinA + y1m * cosA;
            return [
                pt,
                { ...pt, u: centerU + xr, v: centerV + yr }
            ];
        }

        const segments = Math.max(2, sym.segments || 2);
        const step = (Math.PI * 2) / segments;
        const radius = Math.sqrt(relX * relX + relY * relY);
        const baseAngle = Math.atan2(relY, relX) + (sym.rotationOffset || 0) * Math.PI / 180;

        const out: DrawPoint2D[] = [];

        if (sym.radialReflectionMode === RadialReflectionMode.Kaleidoscope) {
            const local = ((baseAngle % step) + step) % step;
            for (let i = 0; i < segments; i++) {
                const a = i * step + (i % 2 === 0 ? local : step - local);
                out.push({ ...pt, u: centerU + radius * Math.cos(a), v: centerV + radius * Math.sin(a) });
            }
            return out;
        }

        for (let i = 0; i < segments; i++) {
            const a = baseAngle + step * i;
            out.push({ ...pt, u: centerU + radius * Math.cos(a), v: centerV + radius * Math.sin(a) });

            if (sym.radialReflectionMode === RadialReflectionMode.Mirror) {
                const sectorCenter = step * i + step * 0.5;
                const aMirror = 2 * sectorCenter - a;
                out.push({ ...pt, u: centerU + radius * Math.cos(aMirror), v: centerV + radius * Math.sin(aMirror) });
            }
        }

        return out;
    }

    private uvToGrowth(pt: DrawPoint2D, canvasSize: number, sym3D: Symmetry3DSettings): THREE.Vector3 {
        const size = canvasSize || 300;
        const x = (pt.u - 0.5) * size;
        const y = (0.5 - pt.v) * size;
        const r = Math.sqrt(x * x + y * y);
        const depth = THREE.MathUtils.clamp(sym3D?.depthFromRadius ?? 0, 0, 1);
        const z = -r * depth;
        return new THREE.Vector3(x, y, z);
    }

    private applySymmetry3D(pos: THREE.Vector3, sym: Symmetry3DSettings): THREE.Vector3[] {
        if (!sym || sym.mode === Symmetry3DMode.None) {
            return [pos.clone()];
        }

        if (sym.mode === Symmetry3DMode.Octant) {
            const sx = sym.octantAxes?.x ? [-1, 1] : [1];
            const sy = sym.octantAxes?.y ? [-1, 1] : [1];
            const sz = sym.octantAxes?.z ? [-1, 1] : [1];
            const out: THREE.Vector3[] = [];
            sx.forEach(ax => sy.forEach(ay => sz.forEach(az => {
                out.push(new THREE.Vector3(pos.x * ax, pos.y * ay, pos.z * az));
            })));
            return out;
        }

        if (sym.mode === Symmetry3DMode.Cubic) {
            const rotations: THREE.Quaternion[] = [
                new THREE.Quaternion(),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))
            ];
            return rotations.map(q => pos.clone().applyQuaternion(q));
        }

        if (
            sym.mode === Symmetry3DMode.Tetrahedral ||
            sym.mode === Symmetry3DMode.Octahedral ||
            sym.mode === Symmetry3DMode.Dodecahedral ||
            sym.mode === Symmetry3DMode.Icosahedral
        ) {
            const normals = this.getPolyhedronFaceNormals(sym.mode);
            const zAxis = new THREE.Vector3(0, 0, 1);
            return normals.map(n => {
                const q = new THREE.Quaternion().setFromUnitVectors(zAxis, n);
                return pos.clone().applyQuaternion(q);
            });
        }

        if (sym.mode === Symmetry3DMode.Vortex) {
            const segments = Math.max(2, sym.segments || 2);
            const step = (Math.PI * 2) / segments;
            const out: THREE.Vector3[] = [];
            const heightStep = sym.heightStep ?? 10;
            const scaleDecay = sym.scaleDecay ?? 0.95;
            const twistPer = (sym.twistPerStep ?? 0) * Math.PI / 180;
            for (let i = 0; i < segments; i++) {
                const angle = i * step + i * twistPer;
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
                const p = pos.clone().applyQuaternion(q);
                const s = Math.pow(scaleDecay, i);
                p.multiplyScalar(s);
                p.z += i * heightStep;
                out.push(p);
            }
            return out;
        }

        return [pos.clone()];
    }

    private getPolyhedronFaceNormals(mode: Symmetry3DMode): THREE.Vector3[] {
        // 使用“面法向集合”实现将基础生成空间复制到多面体各面方向。
        // 说明：这里的 normals 采用“对偶多面体顶点”作为面法向（数量分别为 4/8/12/20）。
        const out: THREE.Vector3[] = [];
        const push = (x: number, y: number, z: number) => out.push(new THREE.Vector3(x, y, z).normalize());

        if (mode === Symmetry3DMode.Tetrahedral) {
            // 4 面：使用 (±1,±1,±1) 的 4 组中“奇数个负号”的组合（等价于四面体对称）
            push(1, 1, 1);
            push(-1, -1, 1);
            push(-1, 1, -1);
            push(1, -1, -1);
            return out;
        }

        if (mode === Symmetry3DMode.Octahedral) {
            // 8 面：所有 (±1,±1,±1)
            const signs = [-1, 1];
            signs.forEach(x => signs.forEach(y => signs.forEach(z => push(x, y, z))));
            return out;
        }

        const phi = (1 + Math.sqrt(5)) / 2;
        const invPhi = 1 / phi;

        if (mode === Symmetry3DMode.Dodecahedral) {
            // 12 面：使用 icosahedron 的 12 顶点作为 dodecahedron 的 12 面法向
            // (0, ±1, ±φ), (±1, ±φ, 0), (±φ, 0, ±1)
            const s = [-1, 1];
            s.forEach(y => s.forEach(z => push(0, y, z * phi)));
            s.forEach(x => s.forEach(y => push(x, y * phi, 0)));
            s.forEach(x => s.forEach(z => push(x * phi, 0, z)));
            return out;
        }

        // Icosahedral: 20 面：使用 dodecahedron 的 20 顶点作为 icosahedron 的 20 面法向
        // (±1,±1,±1) (8)
        // (0, ±1/φ, ±φ) (4)
        // (±1/φ, ±φ, 0) (4)
        // (±φ, 0, ±1/φ) (4)
        if (mode === Symmetry3DMode.Icosahedral) {
            const s = [-1, 1];
            s.forEach(x => s.forEach(y => s.forEach(z => push(x, y, z))));
            s.forEach(y => s.forEach(z => push(0, y * invPhi, z * phi)));
            s.forEach(x => s.forEach(y => push(x * invPhi, y * phi, 0)));
            s.forEach(x => s.forEach(z => push(x * phi, 0, z * invPhi)));
            return out;
        }

        return out;
    }
}
