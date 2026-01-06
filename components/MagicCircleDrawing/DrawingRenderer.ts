/**
 * input: Canvas container ref, symmetry settings
 * output: Three.js orthographic scene for drawing with particle/line effects
 * pos: 3D rendering logic for magic circle drawing
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */
import * as THREE from 'three';
import {
    MagicCircleStroke,
    StrokePoint,
    ParticleBrushSettings,
    LineRingBrushSettings,
    SymmetryMode
} from '../../types';

export class DrawingRenderer {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private container: HTMLElement;
    private animationId: number | null = null;

    // 辅助线组
    private guidesGroup: THREE.Group;

    // 笔画组
    private strokesGroup: THREE.Group;

    // 当前绘制中的笔画
    private currentStrokeMesh: THREE.Points | THREE.Line | null = null;

    // 时间 uniform
    private uTime = { value: 0 };
    private startTime = Date.now();

    constructor(container: HTMLElement) {
        this.container = container;

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        // 创建场景
        this.scene = new THREE.Scene();

        // 创建正交相机 (坐标系 0-100)
        this.camera = new THREE.OrthographicCamera(0, 100, 100, 0, 0.1, 1000);
        this.camera.position.set(50, 50, 100);
        this.camera.lookAt(50, 50, 0);

        // 创建辅助线组
        this.guidesGroup = new THREE.Group();
        this.scene.add(this.guidesGroup);

        // 创建笔画组
        this.strokesGroup = new THREE.Group();
        this.scene.add(this.strokesGroup);

        // 初始化大小
        this.resize();

        // 将渲染器添加到容器
        container.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.pointerEvents = 'none';

        // 开始渲染循环
        this.animate();
    }

    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.renderer.setSize(width, height);
    }

    /**
     * 更新辅助线 (中心点 + 对称轴)
     */
    updateGuides(symmetryMode: SymmetryMode, divisions: number) {
        // 清除旧辅助线
        while (this.guidesGroup.children.length > 0) {
            const child = this.guidesGroup.children[0];
            this.guidesGroup.remove(child);
            if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose();
            if ((child as THREE.Line).material) ((child as THREE.Line).material as THREE.Material).dispose();
        }

        const center = new THREE.Vector3(50, 50, 0);
        const guideColor = 0xffaa00;
        const guideOpacity = 0.3;

        // 创建虚线材质
        const dashMaterial = new THREE.LineDashedMaterial({
            color: guideColor,
            transparent: true,
            opacity: guideOpacity,
            dashSize: 2,
            gapSize: 1
        });

        // 中心点十字线
        const crossSize = 3;
        const crossGeomH = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(center.x - crossSize, center.y, 0),
            new THREE.Vector3(center.x + crossSize, center.y, 0)
        ]);
        const crossGeomV = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(center.x, center.y - crossSize, 0),
            new THREE.Vector3(center.x, center.y + crossSize, 0)
        ]);

        const crossH = new THREE.Line(crossGeomH, new THREE.LineBasicMaterial({ color: guideColor, opacity: 0.8, transparent: true }));
        const crossV = new THREE.Line(crossGeomV, new THREE.LineBasicMaterial({ color: guideColor, opacity: 0.8, transparent: true }));
        this.guidesGroup.add(crossH);
        this.guidesGroup.add(crossV);

        // 对称轴虚线 (仅在 radial 或 kaleidoscope 模式)
        if (symmetryMode !== 'none') {
            const radius = 48; // 稍微小于画布半边
            for (let i = 0; i < divisions; i++) {
                const angle = (Math.PI * 2 / divisions) * i;
                const endX = center.x + radius * Math.cos(angle);
                const endY = center.y + radius * Math.sin(angle);

                const lineGeom = new THREE.BufferGeometry().setFromPoints([
                    center.clone(),
                    new THREE.Vector3(endX, endY, 0)
                ]);

                const line = new THREE.Line(lineGeom, dashMaterial.clone());
                line.computeLineDistances(); // 虚线需要此调用
                this.guidesGroup.add(line);
            }
        }
    }

    /**
     * 添加完成的笔画
     */
    addStroke(
        stroke: MagicCircleStroke,
        symmetryMode: SymmetryMode,
        divisions: number
    ) {
        const allPoints = this.applySymmetry(stroke.points, symmetryMode, divisions);

        allPoints.forEach((points, idx) => {
            const mesh = this.createStrokeMesh(stroke, points);
            mesh.name = `stroke_${stroke.id}_${idx}`;
            this.strokesGroup.add(mesh);
        });
    }

    /**
     * 更新当前绘制中的笔画
     */
    updateCurrentStroke(
        stroke: MagicCircleStroke | null,
        symmetryMode: SymmetryMode,
        divisions: number
    ) {
        // 移除旧的当前笔画
        const toRemove = this.strokesGroup.children.filter(c => c.name.startsWith('current_'));
        toRemove.forEach(c => {
            this.strokesGroup.remove(c);
            if ((c as THREE.Points).geometry) (c as THREE.Points).geometry.dispose();
        });

        if (!stroke || stroke.points.length < 2) return;

        const allPoints = this.applySymmetry(stroke.points, symmetryMode, divisions);
        allPoints.forEach((points, idx) => {
            const mesh = this.createStrokeMesh(stroke, points);
            mesh.name = `current_${idx}`;
            this.strokesGroup.add(mesh);
        });
    }

    /**
     * 创建笔画 Mesh
     */
    private createStrokeMesh(
        stroke: MagicCircleStroke,
        points: StrokePoint[]
    ): THREE.Points | THREE.Line {
        if (stroke.brushType === 'particle') {
            return this.createParticleStroke(stroke, points);
        } else {
            return this.createLineStroke(stroke, points);
        }
    }

    /**
     * 创建粒子笔画
     */
    private createParticleStroke(
        stroke: MagicCircleStroke,
        points: StrokePoint[]
    ): THREE.Points {
        const settings = stroke.brushSettings as ParticleBrushSettings;

        // 根据密度采样点
        const sampleStep = Math.max(1, Math.floor(1 / settings.baseDensity));
        const sampledPoints: number[] = [];
        const sizes: number[] = [];

        for (let i = 0; i < points.length; i += sampleStep) {
            const p = points[i];
            sampledPoints.push(p.x * 100, p.y * 100, 0); // 转换到 0-100 坐标系
            sizes.push(settings.baseSize * (0.3 + p.pressure * 0.7)); // 压感影响大小
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(sampledPoints, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        // 粒子材质 (发光效果)
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(stroke.color) },
                uGlowIntensity: { value: settings.glowIntensity },
                uTime: this.uTime
            },
            vertexShader: `
        attribute float size;
        varying float vSize;
        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uGlowIntensity;
        uniform float uTime;
        varying float vSize;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // 发光效果
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 1.5 - uGlowIntensity * 0.5);
          
          vec3 color = uColor * (1.0 + uGlowIntensity * glow);
          float alpha = glow * 0.8;
          
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Points(geometry, material);
    }

    /**
     * 创建线条笔画
     */
    private createLineStroke(
        stroke: MagicCircleStroke,
        points: StrokePoint[]
    ): THREE.Line {
        const settings = stroke.brushSettings as LineRingBrushSettings;

        const linePoints = points.map(p => new THREE.Vector3(p.x * 100, p.y * 100, 0));
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);

        // 线条材质 (发光效果)
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(stroke.color) },
                uGlowIntensity: { value: settings.glowIntensity },
                uTime: this.uTime
            },
            vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uGlowIntensity;
        void main() {
          vec3 color = uColor * (1.0 + uGlowIntensity * 0.5);
          gl_FragColor = vec4(color, 0.8);
        }
      `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const line = new THREE.Line(geometry, material);
        // 注意：Three.js 原生 Line 不支持线宽 (WebGL 限制)
        // 如需粗线，需要使用 THREE.Line2 或自定义几何体
        return line;
    }

    /**
     * 应用对称变换
     */
    private applySymmetry(
        points: StrokePoint[],
        mode: SymmetryMode,
        divisions: number
    ): StrokePoint[][] {
        if (mode === 'none') return [points];

        const results: StrokePoint[][] = [];
        const center = 0.5;

        for (let i = 0; i < divisions; i++) {
            const angle = (Math.PI * 2 / divisions) * i;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const transformed = points.map(p => {
                const dx = p.x - center;
                const dy = p.y - center;
                return {
                    ...p,
                    x: center + dx * cos - dy * sin,
                    y: center + dx * sin + dy * cos
                };
            });
            results.push(transformed);

            // 万花筒模式：每份内部镜像
            if (mode === 'kaleidoscope') {
                const mirrored = transformed.map(p => ({
                    ...p,
                    x: 1 - p.x
                }));
                results.push(mirrored);
            }
        }

        return results;
    }

    /**
     * 清除所有笔画
     */
    clearStrokes() {
        while (this.strokesGroup.children.length > 0) {
            const child = this.strokesGroup.children[0];
            this.strokesGroup.remove(child);
            if ((child as THREE.Points).geometry) (child as THREE.Points).geometry.dispose();
            if ((child as THREE.Points).material) {
                const mat = (child as THREE.Points).material;
                if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                else (mat as THREE.Material).dispose();
            }
        }
    }

    /**
     * 渲染循环
     */
    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);

        // 更新时间
        this.uTime.value = (Date.now() - this.startTime) / 1000;

        this.renderer.render(this.scene, this.camera);
    };

    /**
     * 生成缩略图
     */
    generateThumbnail(width = 128, height = 128): string {
        // 临时调整渲染器大小
        this.renderer.setSize(width, height);
        this.renderer.render(this.scene, this.camera);
        const dataUrl = this.renderer.domElement.toDataURL('image/png');
        // 恢复原大小
        this.resize();
        return dataUrl;
    }

    /**
     * 销毁
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.clearStrokes();

        while (this.guidesGroup.children.length > 0) {
            const child = this.guidesGroup.children[0];
            this.guidesGroup.remove(child);
        }

        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}
