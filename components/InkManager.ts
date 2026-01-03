import * as THREE from 'three';
import { DrawSettings, DrawMode } from '../types';

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

    private pointsMesh: THREE.Points | null = null;
    private geometry: THREE.BufferGeometry | null = null;
    private material: THREE.ShaderMaterial | null = null;

    private positions: Float32Array;
    private sizes: Float32Array;
    private alphas: Float32Array;
    private pointCount: number = 0;
    private maxPoints: number = 50000;

    private isDrawing: boolean = false;
    private settings: DrawSettings | null = null;
    private planetObj: THREE.Object3D | null = null;

    // Event listeners
    private _onDown: (e: PointerEvent) => void;
    private _onMove: (e: PointerEvent) => void;
    private _onUp: (e: PointerEvent) => void;

    private ghostMesh: THREE.Points | null = null;
    private ghostPositions: Float32Array;

    /**
     * @param scene The THREE.Scene (or group) to add the ink mesh to.
     * @param camera The camera used for raycasting.
     * @param domElement The canvas DOM element for event listeners.
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize buffers
        this.positions = new Float32Array(this.maxPoints * 3);
        this.sizes = new Float32Array(this.maxPoints);
        this.alphas = new Float32Array(this.maxPoints);

        // Ghost cursor buffer (max 64 points)
        this.ghostPositions = new Float32Array(64 * 3);

        this.initMesh();
        this.initGhostMesh();

        // Bind events
        this._onDown = this.onPointerDown.bind(this);
        this._onMove = this.onPointerMove.bind(this);
        this._onUp = this.onPointerUp.bind(this);

        this.addListeners();
    }

    private initMesh() {
        // Create Geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));

        this.geometry = geometry;

        // Create Material
        const material = new THREE.ShaderMaterial({
            vertexShader: inkVertexShader,
            fragmentShader: inkFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(1, 1, 1) },
                uOpacity: { value: 1.0 },
                uFlow: { value: 0.0 },
                uBloom: { value: 1.0 },
                size: { value: 1.0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.material = material;

        // Create Mesh
        this.pointsMesh = new THREE.Points(geometry, material);
        this.pointsMesh.frustumCulled = false; // Always render
        this.pointsMesh.renderOrder = 999; // Draw on top

        this.scene.add(this.pointsMesh);
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
        if (this.material) {
            this.material.uniforms.uColor.value.set(settings.brush.color);
            this.material.uniforms.uOpacity.value = settings.brush.opacity;
            this.material.uniforms.uFlow.value = settings.inkFlow;
            this.material.uniforms.uBloom.value = settings.inkBloom;
        }

        // Toggle ghost cursor visibility
        if (this.ghostMesh) {
            this.ghostMesh.visible = settings.ghostCursorEnabled;
            if (this.ghostMesh.material instanceof THREE.PointsMaterial) {
                this.ghostMesh.material.color.set(settings.brush.color);
            }
        }
    }

    public setPlanet(planet: THREE.Object3D | null) {
        if (this.planetObj === planet) return;

        if (this.pointsMesh) {
            if (this.pointsMesh.parent) {
                this.pointsMesh.parent.remove(this.pointsMesh);
            }
            if (planet) {
                planet.add(this.pointsMesh);
                // Also add ghost mesh to planet to follow rotaton
                if (this.ghostMesh) planet.add(this.ghostMesh);
            } else {
                this.scene.add(this.pointsMesh);
                if (this.ghostMesh) this.scene.add(this.ghostMesh);
            }
        }
        this.planetObj = planet;
    }

    public update(time: number) {
        if (this.material) {
            this.material.uniforms.uTime.value = time;
        }
    }

    public dispose() {
        this.removeListeners();
        if (this.pointsMesh) {
            if (this.pointsMesh.parent) this.pointsMesh.parent.remove(this.pointsMesh);
            this.pointsMesh.geometry.dispose();
            (this.pointsMesh.material as THREE.Material).dispose();
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
        if (!this.planetObj) return;

        // Calculate Mouse Position normalized [-1, 1]
        const rect = this.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.mouse.set(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.planetObj, true);

        // Filter intersects
        let hit: THREE.Intersection | null = null;
        for (const intersect of intersects) {
            if (intersect.object === this.pointsMesh || intersect.object === this.ghostMesh) {
                continue;
            }
            if (!intersect.object.visible) continue;
            hit = intersect;
            break;
        }

        if (hit) {
            const point = hit.point;
            const pressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 0.5;
            const effectivePressure = e.pointerType === 'pen' ? pressure : 1.0;

            if (this.isDrawing) {
                this.handleAddPoint(point, effectivePressure);
            }

            // Update Ghost Cursor
            if (this.settings.ghostCursorEnabled) {
                this.updateGhostCursor(point);
            }
        } else {
            // Hide ghost cursor if not hitting planet
            if (this.ghostMesh) {
                this.ghostMesh.position.set(0, 0, 0); // Hack: move away or clear buffer
                // Instead of setting visible=false which might flicker, we clear the buffer
                const posAttr = this.ghostMesh.geometry.attributes.position as THREE.BufferAttribute;
                posAttr.setXYZ(0, 0, 0, 0); // Just set first one to 0
                posAttr.count = 0;
                posAttr.needsUpdate = true;
            }
        }
    }

    private updateGhostCursor(worldPoint: THREE.Vector3) {
        if (!this.ghostMesh || !this.planetObj || !this.settings) return;

        const localPoint = worldPoint.clone();
        this.planetObj.worldToLocal(localPoint);

        // Apply altitude
        const len = localPoint.length();
        localPoint.normalize().multiplyScalar(len + this.settings.altitude);

        const points = this.generateSymmetryPoints(localPoint);
        const posAttr = this.ghostMesh.geometry.attributes.position as THREE.BufferAttribute;

        points.forEach((p, i) => {
            if (i < 64) {
                posAttr.setXYZ(i, p.x, p.y, p.z);
            }
        });

        // Hide unused points
        posAttr.setDrawRange(0, points.length);
        posAttr.needsUpdate = true;
    }

    private handleAddPoint(worldPoint: THREE.Vector3, pressure: number) {
        if (!this.settings || !this.planetObj) return;
        if (this.pointCount >= this.maxPoints) return;

        const localPoint = worldPoint.clone();
        this.planetObj.worldToLocal(localPoint);

        const len = localPoint.length();
        localPoint.normalize().multiplyScalar(len + this.settings.altitude);

        const pointsToAdd = this.generateSymmetryPoints(localPoint);

        pointsToAdd.forEach(p => {
            if (this.pointCount >= this.maxPoints) return;

            const i = this.pointCount;
            this.positions[i * 3] = p.x;
            this.positions[i * 3 + 1] = p.y;
            this.positions[i * 3 + 2] = p.z;

            const baseSize = this.settings!.brush.size || 10;
            const size = baseSize * 0.5 * (this.settings!.brush.usePressure ? pressure : 1.0);
            this.sizes[i] = size;
            this.alphas[i] = this.settings!.brush.usePressure ? pressure : 1.0;

            this.pointCount++;
        });

        if (this.geometry) {
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.aSize.needsUpdate = true;
            this.geometry.attributes.aAlpha.needsUpdate = true;
            this.geometry.setDrawRange(0, this.pointCount);
        }
    }

    private generateSymmetryPoints(localPoint: THREE.Vector3): THREE.Vector3[] {
        if (!this.settings) return [localPoint];
        const { mode, segments } = this.settings;
        const points: THREE.Vector3[] = [];

        // Helper to add unique points (simple dist check could be added if needed)
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
            // Mirror across x=y plane (z unchanged), and x=-y
            // Simple approach: swap x and y
            add(localPoint);
            add(new THREE.Vector3(localPoint.y, localPoint.x, localPoint.z)); // x=y mirroring?
            // For full 4-way diagonal:
            add(new THREE.Vector3(-localPoint.y, -localPoint.x, localPoint.z));
        } else if (mode === DrawMode.Radial || mode === DrawMode.Kaleidoscope || mode === DrawMode.PlanetSpin) {
            // Radial Symmetry around Y axis (North Pole)
            const angleStep = (Math.PI * 2) / segments;
            const spherical = new THREE.Spherical().setFromVector3(localPoint);

            for (let i = 0; i < segments; i++) {
                const theta = spherical.theta + angleStep * i;
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                add(p);

                if (mode === DrawMode.Kaleidoscope) {
                    // Internal mirror within the sector
                    // Mirror theta? 
                    // Simple kaleidoscope: mirror across the sector bisector
                    // Or mirror across X then rotate?
                    // Approach: Mirror theta relative to current sector start
                    // Actually, kaleidoscope usually means mirror neighbor.
                    // Let's mirror the generated point across the plane defined by its angle
                    // Simplified: just mirror across X plane first, then rotate all?
                    // Proper implementation:
                    // 1. Convert to spherical
                    // 2. Modulo angle to get into first sector
                    // 3. Mirror if in second half of sector
                    // 4. Rotate back to all sectors
                }
            }
        } else if (mode === DrawMode.Antipodal) {
            add(localPoint);
            add(localPoint.clone().negate());
        } else if (mode === DrawMode.Tetrahedral) {
            // 4 vertices of tetrahedron. Hard to map arbitrary point. 
            // Usually this means applying the symmetry group of the tetrahedron.
            // Tetrahedron group T has 12 rotational symmetries.
            // For a drawing tool, we usually want to replicate the stroke on all faces.
            // Simplified: Reference the vertices of a tetrahedron inscribed in sphere
            // V1(1,1,1), V2(1,-1,-1), V3(-1,1,-1), V4(-1,-1,1)
            // Implementing full point group symmetry requires matrix operations.
            // Placeholder: just normal for now to avoid complexity spike without math library.
            add(localPoint);
        } else if (mode === DrawMode.Cubic) {
            // Cube has octahedral symmetry (Oh). 48 symmetries.
            // Simplified: 6 faces.
            // Project point to nearest face, then replicate to other 6 faces?
            // Or just rotate 90 deg on X, Y, Z?
            // Let's implement basic 8 corners or 6 faces.
            // "Play it safe": Simple 8-way octane symmetry
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
                // Add height offset (spiral up)
                // Note: spherical.phi is 0 at top (Y+). 
                // We can modify radius or just translate Y.
                // Vortex usually moves UP.
                const yOffset = i * (vortexHeight / segments);

                // Calc position
                const p = new THREE.Vector3().setFromSphericalCoords(spherical.radius, spherical.phi, theta);
                p.y += yOffset;

                // Scale down
                const scale = Math.pow(vortexScale, i);
                p.multiplyScalar(scale);

                add(p);
            }
        }
        else {
            add(localPoint);
        }

        return points;
    }
}
