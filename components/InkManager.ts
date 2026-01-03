import * as THREE from 'three';
import { DrawSettings, DrawMode, DrawingLayer } from '../types';

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
        float noise = snoise(pos * 0.1 + vec3(0.0, uTime * 0.5, 0.0));
        pos += normalize(pos) * noise * uFlow * 5.0;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation (simulating perspective)
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
    
    // Bloom boost
    vec3 finalColor = uColor * (1.0 + uBloom);
    
    gl_FragColor = vec4(finalColor, strength * uOpacity * vAlpha);
}
`;

// ==================== INK MANAGER ====================

export class InkManager {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private domElement: HTMLElement;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    // Rendering Data using Layers
    private layerMeshes: Map<string, THREE.Points> = new Map();
    private activeLayerId: string | null = null;

    // Interaction Canvas
    private canvasMesh: THREE.Mesh | null = null;
    private planetGroup: THREE.Object3D | null = null; // The parent group we draw on

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

        // Ghost cursor buffer (max 64 points)
        this.ghostPositions = new Float32Array(64 * 3);

        this.initCanvasMesh();
        this.initGhostMesh();

        // Bind events
        this._onDown = this.onPointerDown.bind(this);
        this._onMove = this.onPointerMove.bind(this);
        this._onUp = this.onPointerUp.bind(this);

        this.addListeners();
    }

    private initCanvasMesh() {
        // Create an invisible interaction sphere
        // Radius 100 matches the standard planet radius
        const geometry = new THREE.SphereGeometry(100, 64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.05, // Slight visibility for feedback
            wireframe: true, // Grid effect
            side: THREE.DoubleSide,
            depthWrite: false,
            visible: false
        });

        this.canvasMesh = new THREE.Mesh(geometry, material);
        this.canvasMesh.name = 'InteractionCanvas';
        this.canvasMesh.renderOrder = 998;
        this.scene.add(this.canvasMesh);
    }

    private initGhostMesh() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.ghostPositions, 3).setUsage(THREE.DynamicDrawUsage));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 5,
            sizeAttenuation: false, // Screen space size
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            depthWrite: false
        });

        this.ghostMesh = new THREE.Points(geometry, material);
        this.ghostMesh.renderOrder = 1000;
        this.ghostMesh.visible = false;
        this.scene.add(this.ghostMesh);
    }

    public setSettings(settings: DrawSettings) {
        this.settings = settings;
        this.activeLayerId = settings.activeLayerId;

        // Update interaction canvas
        if (this.canvasMesh) {
            this.canvasMesh.visible = settings.enabled && settings.mode !== DrawMode.Off;

            // Base radius 100. Scale = 1 + (altitude / 100)
            const alt = settings.currentAltitude !== undefined ? settings.currentAltitude : settings.altitude;
            const scale = 1.0 + (alt / 100.0);
            this.canvasMesh.scale.setScalar(scale);

            if (this.canvasMesh.material instanceof THREE.MeshBasicMaterial) {
                this.canvasMesh.material.opacity = settings.enabled ? 0.05 : 0;
            }
        }

        // Sync Layers
        this.syncLayers(settings.layers);

        // Toggle ghost cursor visibility
        if (this.ghostMesh) {
            this.ghostMesh.visible = settings.ghostCursorEnabled;
            if (this.ghostMesh.material instanceof THREE.PointsMaterial) {
                this.ghostMesh.material.color.set(settings.brush.color);
            }
        }
    }

    private syncLayers(layers: DrawingLayer[]) {
        // 1. Remove meshes for deleted layers
        const layerIds = new Set(layers.map(l => l.id));
        for (const [id, mesh] of this.layerMeshes) {
            if (!layerIds.has(id)) {
                if (mesh.parent) mesh.parent.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
                this.layerMeshes.delete(id);
            }
        }

        // 2. Create/Update meshes
        layers.forEach(layer => {
            let mesh = this.layerMeshes.get(layer.id);

            // Create if new
            if (!mesh) {
                // Initialize buffer with enough space
                const maxPoints = 50000;
                // Reuse layer points if they are large enough, otherwise create new
                // For now, assume layer.points is the source. 
                // To allow dynamic drawing, we need a fixed large buffer and partial update.
                // We'll create a fresh buffer and copy layer points into it.
                // Or better: Use layer.points directly if it's already a Float32Array of correct size.
                // Given the type definition, layer.points is likely just the data. 
                // We'll allocate a standard large buffer for editing.

                const positions = new Float32Array(maxPoints * 3);
                const sizes = new Float32Array(maxPoints);
                const alphas = new Float32Array(maxPoints);

                // Copy existing data
                positions.set(layer.points);
                // Fill defaults for sizes/alphas (since we don't persist them yet in DrawingLayer)
                sizes.fill(10.0);
                alphas.fill(1.0);

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
                geometry.setDrawRange(0, layer.count);

                const material = new THREE.ShaderMaterial({
                    vertexShader: inkVertexShader,
                    fragmentShader: inkFragmentShader,
                    uniforms: {
                        uTime: { value: 0 },
                        uColor: { value: new THREE.Color(layer.color) },
                        uOpacity: { value: layer.opacity },
                        uFlow: { value: 0.0 },
                        uBloom: { value: 0.0 }, // Can add visual style to Layer later
                        size: { value: 1.0 }
                    },
                    transparent: true,
                    depthWrite: false,
                    blending: layer.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
                });

                mesh = new THREE.Points(geometry, material);
                mesh.frustumCulled = false;
                mesh.renderOrder = 999;
                mesh.userData = { layerId: layer.id };

                this.layerMeshes.set(layer.id, mesh);
                this.scene.add(mesh); // Initial add
            }

            if (mesh) {
                mesh.visible = layer.visible;
                const mat = mesh.material as THREE.ShaderMaterial;
                mat.uniforms.uColor.value.set(layer.color);
                mat.uniforms.uOpacity.value = layer.opacity;

                this.updateLayerTransform(mesh, layer);
                this.reparentMesh(mesh, layer.bindPlanetId);
            }
        });
    }

    private updateLayerTransform(mesh: THREE.Points, layer: DrawingLayer) {
        mesh.rotation.set(
            THREE.MathUtils.degToRad(layer.tilt.x),
            THREE.MathUtils.degToRad(layer.tilt.y),
            THREE.MathUtils.degToRad(layer.tilt.z)
        );

        const alt = layer.altitude || 0;
        const altitudeScale = 1.0 + (alt / 100.0);
        const finalScale = layer.scale * altitudeScale;
        mesh.scale.setScalar(finalScale);

        if (layer.rotationSpeed !== 0) {
            mesh.userData.rotationSpeed = layer.rotationSpeed;
        } else {
            mesh.userData.rotationSpeed = 0;
        }
    }

    private reparentMesh(mesh: THREE.Points, planetId: string | null) {
        // If current active planet matches target, attach to it.
        if (this.planetGroup && this.planetGroup.userData.planetId === planetId) {
            if (mesh.parent !== this.planetGroup) {
                this.planetGroup.add(mesh);
            }
        } else {
            // Fallback to scene
            if (mesh.parent !== this.scene) {
                this.scene.add(mesh);
            }
        }
    }

    public setPlanet(planetGroup: THREE.Object3D | null) {
        if (this.planetGroup === planetGroup) return;

        if (this.planetGroup && this.canvasMesh) {
            this.planetGroup.remove(this.canvasMesh);
        }

        this.planetGroup = planetGroup;

        if (planetGroup && this.canvasMesh) {
            planetGroup.add(this.canvasMesh);
            this.canvasMesh.visible = this.settings?.enabled ?? false;
        } else if (this.canvasMesh) {
            this.scene.add(this.canvasMesh);
            this.canvasMesh.visible = false;
        }

        // Re-parent layers
        if (this.settings) {
            this.syncLayers(this.settings.layers);
        }
    }

    public update(time: number) {
        this.layerMeshes.forEach(mesh => {
            const mat = mesh.material as THREE.ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTime.value = time;

                if (mesh.userData.rotationSpeed) {
                    mesh.rotation.y += mesh.userData.rotationSpeed * 0.001;
                }
            }
        });
    }

    public dispose() {
        this.removeListeners();
        this.layerMeshes.forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
        this.layerMeshes.clear();

        if (this.canvasMesh) {
            if (this.canvasMesh.parent) this.canvasMesh.parent.remove(this.canvasMesh);
            this.canvasMesh.geometry.dispose();
            (this.canvasMesh.material as THREE.Material).dispose();
        }

        if (this.ghostMesh) {
            if (this.ghostMesh.parent) this.ghostMesh.parent.remove(this.ghostMesh);
            this.ghostMesh.geometry.dispose();
            (this.ghostMesh.material as THREE.Material).dispose();
        }
    }

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
        if (!this.canvasMesh) return;

        const rect = this.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.mouse.set(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Raycast against Interaction Canvas
        const intersects = this.raycaster.intersectObject(this.canvasMesh, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const point = hit.point;
            const pressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 0.5;
            const effectivePressure = e.pointerType === 'pen' ? pressure : 1.0;

            if (this.isDrawing) {
                this.handleAddPoint(point, effectivePressure);
            }

            if (this.settings.ghostCursorEnabled) {
                this.updateGhostCursor(point);
            }
        } else {
            if (this.ghostMesh) {
                const posAttr = this.ghostMesh.geometry.attributes.position as THREE.BufferAttribute;
                posAttr.count = 0;
                posAttr.needsUpdate = true;
            }
        }
    }

    private updateGhostCursor(worldPoint: THREE.Vector3) {
        if (!this.ghostMesh || !this.planetGroup || !this.settings) return;

        // Convert world to local (Canvas Space = Planet Space)
        const localPoint = worldPoint.clone();
        this.planetGroup.worldToLocal(localPoint);

        // Canvas is already at 'Altitude', so localPoint is correct.

        const points = this.generateSymmetryPoints(localPoint);
        const posAttr = this.ghostMesh.geometry.attributes.position as THREE.BufferAttribute;

        points.forEach((p, i) => {
            if (i < 64) {
                posAttr.setXYZ(i, p.x, p.y, p.z);
            }
        });

        posAttr.setDrawRange(0, points.length);
        posAttr.needsUpdate = true;
    }

    private handleAddPoint(worldPoint: THREE.Vector3, pressure: number) {
        if (!this.settings || !this.activeLayerId || !this.planetGroup) return;

        const layer = this.settings.layers.find(l => l.id === this.activeLayerId);
        if (!layer) return;

        const mesh = this.layerMeshes.get(layer.id);
        if (!mesh) return;

        // Transform Logic:
        // Point is on Canvas (Planet Local).
        // Layer has additional transform (Tilt, Scale).
        // We want the point to appear at 'worldPoint' visually.
        // But the Mesh is transformed. So we must Inverse-Transform the point into Mesh Space.

        const localPoint = worldPoint.clone();
        this.planetGroup.worldToLocal(localPoint);

        // Inverse Transform
        mesh.updateMatrix();
        const invMatrix = mesh.matrix.clone().invert();
        localPoint.applyMatrix4(invMatrix);

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

            const baseSize = this.settings!.brush.size || 10;
            sizes[i] = baseSize * (this.settings!.brush.usePressure ? pressure : 1.0);
            alphas[i] = this.settings!.brush.usePressure ? pressure : 1.0;

            layer.count++;

            // Sync back to layer.points so it persists?
            // Currently layer.count increases, but layer.points is not automatically updated 
            // if we are writing to `positions` which is a copy.
            // Wait, we initialized positions from layer.points. 
            // But layer.points might be a smaller array initially.
            // For true persistence, `layer.points` should reference this buffer or we copy back.
            // For now, let's assume `positions` is the authoritative buffer while session is active.
            // If we save, we'd need to serialize `positions` up to `layer.count`.
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
