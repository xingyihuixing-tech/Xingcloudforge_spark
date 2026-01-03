import * as THREE from 'three';
import { DrawSettings, DrawMode, DrawingLayer, BrushType, ProjectionMode, SymmetryMode } from '../types';

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

// ==================== INK MANAGER ====================

export class InkManager {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private domElement: HTMLElement;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    // Meshes for the active instance's layers
    private layerMeshes: Map<string, THREE.Points> = new Map();
    private activeLayerId: string | null = null;

    // The single Interaction Canvas (Always exists, toggled visible)
    private canvasMesh: THREE.Mesh;

    // Target Planet Tracking
    private targetPlanet: THREE.Object3D | null = null;

    private isDrawing: boolean = false;
    private settings: DrawSettings | null = null;

    // Event listeners
    private _onDown: (e: PointerEvent) => void;
    private _onMove: (e: PointerEvent) => void;
    private _onUp: (e: PointerEvent) => void;

    private ghostMesh: THREE.Points | null = null;
    private ghostPositions: Float32Array;

    constructor(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.ghostPositions = new Float32Array(64 * 3);

        // 1. Initialize Interaction Canvas (Independent) - HIDDEN, only for raycasting if needed
        const geometry = new THREE.SphereGeometry(100, 64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0, // Completely invisible
            wireframe: false, // No wireframe visualization
            visible: false,
            depthWrite: false
        });
        this.canvasMesh = new THREE.Mesh(geometry, material);
        this.canvasMesh.name = 'InteractionCanvas';
        this.canvasMesh.visible = false; // ALWAYS hidden - we use HoloCanvas for 2D input now
        this.canvasMesh.renderOrder = 9999;
        // Don't add to scene if we're using HoloCanvas exclusively
        // this.scene.add(this.canvasMesh);

        this.initGhostMesh();

        this._onDown = this.onPointerDown.bind(this);
        this._onMove = this.onPointerMove.bind(this);
        this._onUp = this.onPointerUp.bind(this);

        this.addListeners();
    }

    private initGhostMesh() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.ghostPositions, 3).setUsage(THREE.DynamicDrawUsage));

        const material = new THREE.PointsMaterial({
            color: 0xffffff, size: 5, sizeAttenuation: false,
            transparent: true, opacity: 0.5,
            depthTest: false, depthWrite: false
        });

        this.ghostMesh = new THREE.Points(geometry, material);
        this.ghostMesh.renderOrder = 10000;
        this.ghostMesh.visible = false;
        geometry.setDrawRange(0, 0); // Start with zero points visible
        // Don't add ghost mesh - we don't need preview dots on 3D scene
        // this.scene.add(this.ghostMesh);
    }

    public setSettings(settings: DrawSettings) {
        this.settings = settings;

        // 1. Resolve Active Drawing (Defensive: handle legacy settings)
        const drawings = settings.drawings || [];
        const activeDrawing = drawings.find(d => d.id === settings.activeDrawingId);

        if (activeDrawing) {
            this.activeLayerId = activeDrawing.activeLayerId;
            this.syncLayers(activeDrawing.layers);
        } else {
            this.syncLayers([]); // No drawing, clear layers
        }

        // 2. Update Canvas State
        const isEnabled = settings.enabled;
        if (this.canvasMesh) {
            this.canvasMesh.visible = isEnabled;
            // Scale based on altitude (Visual feedback)
            const alt = settings.altitude || 10;
            const scale = 1.0 + (alt / 100.0);
            this.canvasMesh.scale.setScalar(scale);

            if (this.canvasMesh.material instanceof THREE.MeshBasicMaterial) {
                this.canvasMesh.material.opacity = isEnabled ? 0.05 : 0;
            }
        }

        // 3. Ghost Cursor
        if (this.ghostMesh) {
            this.ghostMesh.visible = settings.ghostCursorEnabled && isEnabled;
            if (this.ghostMesh.material instanceof THREE.PointsMaterial) {
                this.ghostMesh.material.color.set(settings.brush.color);
            }
        }
    }

    // ==================== 4. PROJECTION ENGINE (Dimension Crafter) ====================

    public projectStroke(strokeData: Float32Array) {
        if (!this.settings || !this.activeLayerId) return;

        const layerMesh = this.layerMeshes.get(this.activeLayerId);
        if (!layerMesh) return;

        // Find the layer data object (we need to update the source data too, ideally)
        // For now, we update the MESH directly. 
        // In a real app, we should update the valid source-of-truth in React/State.
        // But for performance, we update Mesh here and maybe sync back later?
        // Let's assume 'layerMesh.userData' holds reference or we just append to geometry.

        const geometry = layerMesh.geometry;
        const positions = geometry.attributes.position.array as Float32Array;
        const sizes = geometry.attributes.aSize.array as Float32Array;
        const alphas = geometry.attributes.aAlpha.array as Float32Array;

        // Get current draw range/count to append
        let count = geometry.drawRange.count;
        if (count >= positions.length / 3) {
            console.warn("Layer Full!"); // Should handle resize/rotation buffer
            return;
        }

        // Projection Parameters
        // For now, assume Sphere Projection default
        // Start radius = Planet Radius (e.g. 100) + Altitude
        const baseRadius = 100; // Fixed planet radius assumption or get from targetPlanet bounding box
        const altitude = 10; // Default altitude since new DrawSettings no longer has this at top level
        const radius = baseRadius + altitude;

        // Symmetry Settings (Defensive: handle legacy settings)
        const sym = this.settings.symmetry || { mode: SymmetryMode.None, mirrorAxis: 'x', segments: 8 };
        const symMode = sym.mode || SymmetryMode.None;
        const segments = (symMode === SymmetryMode.Radial || symMode === SymmetryMode.Spiral) ? (sym.segments || 8) : 1;
        const mirrors = (symMode === SymmetryMode.Mirror) ? (sym.mirrorAxis === 'quad' ? 4 : 2) : 1;

        // Total copies = segments * mirrors (simplified, usually exclusive)
        // If Mirror Mode: 2 or 4 copies.
        // If Radial Mode: N segments.
        // If Spiral Mode: N segments with offset.

        // Iterate Stroke Points
        for (let i = 0; i < strokeData.length; i += 4) {
            const uRaw = strokeData[i];
            const vRaw = strokeData[i + 1];
            const pressure = strokeData[i + 2];

            if (count >= positions.length / 3) break;

            // Generate Symmetry Points
            const iterations = (symMode === SymmetryMode.Mirror) ? mirrors : segments;

            for (let s = 0; s < iterations; s++) {
                if (count >= positions.length / 3) break;

                let u = uRaw;
                let v = vRaw;

                // --- APPY SYMMETRY (UV Space Manipulation) ---
                if (symMode === SymmetryMode.Mirror) {
                    if (sym.mirrorAxis === 'x' && s === 1) u = 1.0 - u;
                    if (sym.mirrorAxis === 'y' && s === 1) v = 1.0 - v;
                    if (sym.mirrorAxis === 'quad') {
                        if (s === 1) u = 1.0 - u;
                        if (s === 2) v = 1.0 - v;
                        if (s === 3) { u = 1.0 - u; v = 1.0 - v; }
                    }
                }

                // Radial Symmetry is usually rotational in 3D, not just UV flip.
                // But for "Kaleidoscope" in 2D, it is UV rot.
                // For "Radial" in 3D (Planet), it usually means repeating the stroke at different Longitudes.

                // --- PROJECTION (UV -> 3D Local) ---
                let x = 0, y = 0, z = 0;

                // 3D Offset for Spiral
                let spiralHeight = 0;
                let spiralScale = 1.0;

                if (symMode === SymmetryMode.Spiral) {
                    // Spiral logic: Shift Altitude or Y per segment?
                    // User want "Spiral Ring" or "Spiral Projection"?
                    // Let's assume logic: Rotate Angle + Shift Height
                    spiralHeight = (s / segments) * (sym.twist || 50); // Vertical offset ?
                    // Actually, let's keep it simple: Just rotation for now, handled below.
                }

                switch (layerMesh.userData.projection) {
                    case ProjectionMode.Ring:
                        // RING PROJECTION (Top-down disc)
                        // U = Angle (0..1 -> 0..2PI)
                        // V = Radius (0..1 -> Inner..Outer)
                        const angle = (u - 0.5) * Math.PI * 2;
                        const r = (v * 50) + radius; // Map V to width of ring

                        x = r * Math.cos(angle);
                        z = r * Math.sin(angle);
                        y = 0; // Flat ring? Or allow tilt?
                        break;
                    case ProjectionMode.Sphere:
                    default:
                        // SPHERE PROJECTION (Default)
                        const theta = (u - 0.5) * Math.PI * 2; // Longitude
                        const phi = (v - 0.5) * Math.PI;       // Latitude

                        x = radius * Math.cos(phi) * Math.cos(theta);
                        y = radius * Math.sin(phi);
                        z = radius * Math.cos(phi) * Math.sin(theta);
                        break;
                }

                // --- APPLY 3D SYMMETRY (Rotation) ---
                if (symMode === SymmetryMode.Radial || symMode === SymmetryMode.Spiral) {
                    const angleStep = (Math.PI * 2) / segments;
                    const rotAngle = s * angleStep;

                    // Rotate (x,z) around Y axis
                    const cosA = Math.cos(rotAngle);
                    const sinA = Math.sin(rotAngle);
                    const rx = x * cosA - z * sinA;
                    const rz = x * sinA + z * cosA;
                    x = rx;
                    z = rz;

                    // Spiral Twist (Height offset or Radius decay?)
                    if (symMode === SymmetryMode.Spiral) {
                        y += (s * 2.0); // Simple height stack
                        // x *= (1.0 - s * 0.05); // Decay radius
                        // z *= (1.0 - s * 0.05);
                    }
                }

                positions[count * 3] = x;
                positions[count * 3 + 1] = y;
                positions[count * 3 + 2] = z;

                // Size & Alpha
                const brush = this.settings.brush;
                sizes[count] = brush.size * (brush.pressureInfluence.size ? pressure : 1.0);
                alphas[count] = brush.opacity * (brush.pressureInfluence.opacity ? pressure : 1.0);

                count++;
            }
        }

        // Update Geometry
        geometry.setDrawRange(0, count);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.aSize.needsUpdate = true;
        geometry.attributes.aAlpha.needsUpdate = true;

        // Persist count? 
        // layer.count = count; // Need to sync back to settings somehow if we want persistence
    }


    private syncLayers(layers: DrawingLayer[]) {
        const layerIds = new Set(layers.map(l => l.id));

        // Delete removed layers
        for (const [id, mesh] of this.layerMeshes) {
            if (!layerIds.has(id)) {
                if (mesh.parent) mesh.parent.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
                this.layerMeshes.delete(id);
            }
        }

        // Create/Update layers
        layers.forEach(layer => {
            let mesh = this.layerMeshes.get(layer.id);

            // Init Mesh
            if (!mesh) {
                const maxPoints = 30000;
                const positions = new Float32Array(maxPoints * 3);
                const sizes = new Float32Array(maxPoints);
                const alphas = new Float32Array(maxPoints);

                // Load existing data if any
                if (layer.points && layer.points.length > 0) {
                    positions.set(layer.points);
                }
                sizes.fill(10.0);
                alphas.fill(1.0);

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
                geometry.setDrawRange(0, layer.count);

                let vShader = inkVertexShader;
                let fShader = inkFragmentShader;

                if (layer.brushType === BrushType.Stardust) {
                    vShader = stardustVertexShader;
                    fShader = stardustFragmentShader;
                } else if (layer.brushType === BrushType.GasCloud) {
                    vShader = gasVertexShader;
                    fShader = gasFragmentShader;
                }

                const material = new THREE.ShaderMaterial({
                    vertexShader: vShader,
                    fragmentShader: fShader,
                    uniforms: {
                        uTime: { value: 0 },
                        uColor: { value: new THREE.Color(layer.color) },
                        uOpacity: { value: layer.opacity },
                        uFlow: { value: 0.0 },
                        size: { value: 1.0 }
                    },
                    transparent: true,
                    depthWrite: false,
                    blending: layer.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
                });

                mesh = new THREE.Points(geometry, material);
                mesh.frustumCulled = false;
                mesh.renderOrder = 999;
                mesh.userData = {
                    layerId: layer.id,
                    rotationSpeed: layer.rotationSpeed,
                    projection: layer.projection || ProjectionMode.Sphere
                };
                this.layerMeshes.set(layer.id, mesh);

                // Add to scene (not planet, to avoid scale inheritance issues)
                this.scene.add(mesh);
            }

            if (mesh) {
                mesh.visible = layer.visible;
                const mat = mesh.material as THREE.ShaderMaterial;
                mat.uniforms.uColor.value.set(layer.color);
                mat.uniforms.uOpacity.value = layer.opacity;
                mesh.userData.rotationSpeed = layer.rotationSpeed;

                this.updateLayerTransform(mesh, layer);
            }
        });
    }

    private updateLayerTransform(mesh: THREE.Points, layer: DrawingLayer) {
        // Apply Transform relative to Planet Center
        // We do this by keeping the mesh at (0,0,0) locally but rotating/scaling it.
        // It should follow the planet position.

        if (this.targetPlanet) {
            mesh.position.copy(this.targetPlanet.getWorldPosition(new THREE.Vector3()));
        }

        mesh.rotation.set(
            THREE.MathUtils.degToRad(layer.tilt.x),
            THREE.MathUtils.degToRad(layer.tilt.y),
            THREE.MathUtils.degToRad(layer.tilt.z)
        );

        const alt = layer.altitude || 0;
        const altitudeScale = 1.0 + (alt / 100.0);
        const finalScale = layer.scale * altitudeScale;
        mesh.scale.setScalar(finalScale);
    }

    public setPlanet(planet: THREE.Object3D | null) {
        this.targetPlanet = planet;
        if (this.targetPlanet && this.canvasMesh) {
            // Move canvas to planet position
            const worldPos = this.targetPlanet.getWorldPosition(new THREE.Vector3());
            this.canvasMesh.position.copy(worldPos);
        }
    }

    public update(time: number) {
        // Update Canvas Position
        if (this.targetPlanet && this.canvasMesh) {
            const worldPos = this.targetPlanet.getWorldPosition(new THREE.Vector3());
            this.canvasMesh.position.copy(worldPos);
        }

        // Update Layers
        this.layerMeshes.forEach(mesh => {
            // Follow planet
            if (this.targetPlanet) {
                const worldPos = this.targetPlanet.getWorldPosition(new THREE.Vector3());
                mesh.position.copy(worldPos);

                // Inherit planet rotation for "sticking" effect?
                // If we want layers to stick to planet surface, we should multiply by planet rotation.
                // But for "Halo" effects, independent rotation is better.
                // For now, let's just support self-rotation + position tracking.
            }

            const mat = mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;
            }
            if (mesh.userData.rotationSpeed) {
                mesh.rotation.y += mesh.userData.rotationSpeed * 0.001;
            }
        });
    }

    // ... [Event Listeners: addListeners, removeListeners, onPointerDown, onPointerUp, dispose] ...
    private addListeners() {
        this.domElement.addEventListener('pointerdown', this._onDown);
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    }
    private removeListeners() {
        this.domElement.removeEventListener('pointerdown', this._onDown);
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
    }
    public dispose() {
        this.removeListeners();
        this.scene.remove(this.canvasMesh);
        this.canvasMesh.geometry.dispose();
        this.layerMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
        });
        this.layerMeshes.clear();
    }
    private onPointerDown(e: PointerEvent) {
        if (!this.settings?.enabled || this.settings.mode === DrawMode.Off) return;
        if (e.button !== 0) return;
        this.isDrawing = true;
    }
    private onPointerUp(e: PointerEvent) {
        this.isDrawing = false;
    }

    private onPointerMove(e: PointerEvent) {
        if (!this.settings?.enabled || this.settings.mode === DrawMode.Off) return;
        if (!this.canvasMesh || !this.canvasMesh.visible) return;

        const rect = this.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.mouse.set(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.canvasMesh, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (this.isDrawing) {
                this.handleAddPoint(hit.point, e.pressure || 0.5);
            }
            if (this.settings.ghostCursorEnabled) {
                this.updateGhostCursor(hit.point);
            }
        } else {
            // Hide ghost if off canvas
            if (this.ghostMesh) {
                this.ghostMesh.geometry.setDrawRange(0, 0);
            }
        }
    }

    private updateGhostCursor(worldPoint: THREE.Vector3) {
        if (!this.ghostMesh || !this.targetPlanet) return;

        // Convert World -> Local (Relative to Planet Center)
        // Since Canvas is centered on Planet, Local = World - PlanetPos
        const planetPos = this.targetPlanet.getWorldPosition(new THREE.Vector3());
        const localPoint = worldPoint.clone().sub(planetPos);

        const points = this.generateSymmetryPoints(localPoint);
        const posAttr = this.ghostMesh.geometry.attributes.position as THREE.BufferAttribute;

        // Update Ghost Mesh Position to match Planet
        this.ghostMesh.position.copy(planetPos);

        points.forEach((p, i) => {
            if (i < 64) posAttr.setXYZ(i, p.x, p.y, p.z);
        });

        posAttr.needsUpdate = true;
        this.ghostMesh.geometry.setDrawRange(0, points.length);
    }

    private handleAddPoint(worldPoint: THREE.Vector3, pressure: number) {
        if (!this.settings || !this.activeLayerId || !this.targetPlanet) return;

        const activeInstance = this.settings.instances.find(i => i.id === this.settings!.activeInstanceId);
        const layer = activeInstance?.layers.find(l => l.id === this.activeLayerId);
        const mesh = this.layerMeshes.get(this.activeLayerId!);

        if (!layer || !mesh) return;

        // Calc Local Point relative to Mesh
        // Mesh Position = Planet Position
        // Mesh Rotation = Layer Tilt
        // Mesh Scale = Layer Scale

        const planetPos = this.targetPlanet.getWorldPosition(new THREE.Vector3());

        // 1. Center relative to planet
        const relPoint = worldPoint.clone().sub(planetPos);

        // 2. Inverse Transform (Scale & Rotation)
        // We use the Mesh's matrix for convenience, ensuring `updateMatrix()` is called.
        mesh.updateMatrix();
        const invMatrix = mesh.matrix.clone().invert();

        // Wait, mesh.matrix includes position. 
        // worldPoint is World. mesh.matrix maps Local -> World.
        // So Local = World * Invert(Matrix)
        const localPoint = worldPoint.clone().applyMatrix4(invMatrix);

        const pointsToAdd = this.generateSymmetryPoints(localPoint);
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position.array as Float32Array;
        const sizes = geometry.attributes.aSize.array as Float32Array;
        const alphas = geometry.attributes.aAlpha.array as Float32Array;

        pointsToAdd.forEach(p => {
            if (layer.count >= positions.length / 3) return;
            const i = layer.count;

            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            sizes[i] = (this.settings!.brush.size || 10) * pressure;
            alphas[i] = pressure;

            layer.count++;
        });

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.aSize.needsUpdate = true;
        geometry.attributes.aAlpha.needsUpdate = true;
        geometry.setDrawRange(0, layer.count);
    }

    private generateSymmetryPoints(localPoint: THREE.Vector3): THREE.Vector3[] {
        if (!this.settings) return [localPoint];
        const { mode, segments } = this.settings;
        const points: THREE.Vector3[] = [];

        const add = (p: THREE.Vector3) => points.push(p);

        if (mode === DrawMode.Normal) {
            add(localPoint);
        } else if (mode === DrawMode.MirrorX) {
            add(localPoint);
            add(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
        } else if (mode === DrawMode.MirrorY) {
            add(localPoint);
            add(new THREE.Vector3(localPoint.x, -localPoint.y, localPoint.z));
        } else if (mode === DrawMode.Quad) {
            add(localPoint);
            add(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
            add(new THREE.Vector3(localPoint.x, -localPoint.y, localPoint.z));
            add(new THREE.Vector3(-localPoint.x, -localPoint.y, localPoint.z));
        } else if (mode === DrawMode.Diagonal) {
            add(localPoint);
            add(new THREE.Vector3(localPoint.y, localPoint.x, localPoint.z));
            add(new THREE.Vector3(-localPoint.y, -localPoint.x, localPoint.z));
        } else if (mode === DrawMode.Radial || mode === DrawMode.Kaleidoscope || mode === DrawMode.PlanetSpin) {
            const angleStep = (Math.PI * 2) / segments;
            const spherical = new THREE.Spherical().setFromVector3(localPoint);
            for (let i = 0; i < segments; i++) {
                const theta = spherical.theta + angleStep * i;
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                add(p);
            }
        } else if (mode === DrawMode.Antipodal) {
            add(localPoint);
            add(localPoint.clone().negate());
        } else if (mode === DrawMode.Cubic) {
            add(localPoint);
            add(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
            add(new THREE.Vector3(localPoint.x, -localPoint.y, localPoint.z));
            add(new THREE.Vector3(localPoint.x, localPoint.y, -localPoint.z));
            add(new THREE.Vector3(-localPoint.x, -localPoint.y, localPoint.z));
            add(new THREE.Vector3(localPoint.x, -localPoint.y, -localPoint.z));
            add(new THREE.Vector3(-localPoint.x, localPoint.y, -localPoint.z));
            add(new THREE.Vector3(-localPoint.x, -localPoint.y, -localPoint.z));
        } else if (mode === DrawMode.Vortex) {
            const { vortexHeight = 10, vortexScale = 0.95 } = this.settings;
            const angleStep = (Math.PI * 2) / segments;
            const spherical = new THREE.Spherical().setFromVector3(localPoint);
            for (let i = 0; i < segments; i++) {
                const theta = spherical.theta + angleStep * i;
                const yOffset = i * (vortexHeight / segments);
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                p.y += yOffset;
                const scale = Math.pow(vortexScale, i);
                p.multiplyScalar(scale);
                add(p);
            }
        } else {
            add(localPoint);
        }

        return points;
    }
}
