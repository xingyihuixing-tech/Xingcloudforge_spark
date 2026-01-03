/**
 * InkRenderer - 墨迹3D渲染器
 * 
 * input: DrawSettings（包含 drawings/layers/strokes 数据）
 * output: Three.js 粒子系统，渲染到场景中
 * pos: 将 2D 笔触数据转换为 3D 粒子效果
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

import * as THREE from 'three';
import {
    DrawSettings,
    Drawing,
    DrawingLayer,
    Stroke,
    BrushType,
    BrushSettings,
    SymmetrySettings,
    ProjectionMode
} from '../../types';
import { applySymmetry, Point2D, Point3D } from './SymmetryEngine';
import INK_SHADERS from './InkShaders';

// 渲染层的唯一标识
interface LayerRenderData {
    points: THREE.Points;
    geometry: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
    strokeCount: number; // 用于检测是否需要更新
    lastUpdateTime: number;
}

export class InkRenderer {
    private scene: THREE.Scene;
    private layerRenderData: Map<string, LayerRenderData>;
    private materialCache: Map<BrushType, THREE.ShaderMaterial>;
    private clock: THREE.Clock;
    private sphereRadius: number;
    private needsUpdate: Set<string>; // 需要更新的图层 ID

    constructor(scene: THREE.Scene, sphereRadius: number = 100) {
        this.scene = scene;
        this.layerRenderData = new Map();
        this.materialCache = new Map();
        this.clock = new THREE.Clock();
        this.sphereRadius = sphereRadius;
        this.needsUpdate = new Set();

        this.initMaterialCache();
    }

    // 初始化材质缓存
    private initMaterialCache(): void {
        for (const brushType of Object.values(BrushType)) {
            const shaders = INK_SHADERS[brushType];
            if (!shaders) continue;

            const material = new THREE.ShaderMaterial({
                vertexShader: shaders.vertex,
                fragmentShader: shaders.fragment,
                uniforms: this.getDefaultUniforms(brushType),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            this.materialCache.set(brushType, material);
        }
    }

    // 获取默认 uniforms
    private getDefaultUniforms(brushType: BrushType): Record<string, THREE.IUniform> {
        const baseUniforms: Record<string, THREE.IUniform> = {
            uTime: { value: 0 },
            uSize: { value: 10 },
            uOpacity: { value: 0.8 }
        };

        // 根据笔刷类型添加特定 uniforms
        switch (brushType) {
            case BrushType.Stardust:
                return {
                    ...baseUniforms,
                    uDensity: { value: 50 },
                    uScatter: { value: 15 },
                    uGlowIntensity: { value: 1.5 },
                    uTwinkleSpeed: { value: 2 }
                };
            case BrushType.GasCloud:
                return {
                    ...baseUniforms,
                    uNoiseScale: { value: 2 },
                    uFlowSpeed: { value: 0.5 },
                    uSoftness: { value: 0.6 },
                    uTurbulence: { value: 0.3 }
                };
            case BrushType.EnergyBeam:
                return {
                    ...baseUniforms,
                    uCoreWidth: { value: 0.3 },
                    uGlowRadius: { value: 20 },
                    uGlowIntensity: { value: 1.5 },
                    uElectricArc: { value: 0 },
                    uArcFrequency: { value: 3 }
                };
            case BrushType.SpiralRing:
                return {
                    ...baseUniforms,
                    uSpiralDensity: { value: 3 },
                    uPitch: { value: 0.5 },
                    uThickness: { value: 10 },
                    uRotationSpeed: { value: 0.5 },
                    uRiseSpeed: { value: 0.3 },
                    uEmissive: { value: 1.5 }
                };
            case BrushType.Firefly:
                return {
                    ...baseUniforms,
                    uHeadSize: { value: 8 },
                    uHeadBrightness: { value: 2 },
                    uPulseSpeed: { value: 1 },
                    uHeadStyle: { value: 1 },
                    uFlareLeaves: { value: 4 }
                };
            case BrushType.Fracture:
                return {
                    ...baseUniforms,
                    uCrackScale: { value: 2 },
                    uCrackThreshold: { value: 0.5 },
                    uCrackFeather: { value: 0.15 },
                    uCrackWarp: { value: 0.3 },
                    uFlowSpeed: { value: 0.2 },
                    uEmission: { value: 1 }
                };
            default:
                return baseUniforms;
        }
    }

    // 标记图层需要更新
    markLayerDirty(layerId: string): void {
        this.needsUpdate.add(layerId);
    }

    // 从笔触创建几何体
    private createGeometryFromLayer(
        layer: DrawingLayer,
        projection: ProjectionMode
    ): THREE.BufferGeometry {
        const allPoints: number[] = [];
        const allPressures: number[] = [];
        const allIndices: number[] = [];
        const allColors: number[] = [];

        const color = new THREE.Color(layer.color);
        let pointIndex = 0;

        for (const stroke of layer.strokes) {
            const numPoints = stroke.points.length / 4;

            for (let i = 0; i < numPoints; i++) {
                const p2d: Point2D = {
                    x: stroke.points[i * 4],
                    y: stroke.points[i * 4 + 1],
                    pressure: stroke.points[i * 4 + 2]
                };

                // 应用对称获取所有 3D 点
                const symmetricPoints = applySymmetry(p2d, stroke.symmetrySnapshot);

                for (const p3d of symmetricPoints) {
                    // 根据投影模式转换坐标
                    let finalX: number, finalY: number, finalZ: number;
                    const scale = this.sphereRadius * layer.transform.scale;

                    switch (projection) {
                        case ProjectionMode.Sphere:
                            // 球面映射：将 2D 坐标映射到球面
                            const theta = p3d.x * Math.PI; // 经度
                            const phi = (p3d.y + 1) * Math.PI / 2; // 纬度
                            finalX = Math.sin(phi) * Math.cos(theta) * scale;
                            finalY = Math.cos(phi) * scale;
                            finalZ = Math.sin(phi) * Math.sin(theta) * scale;
                            break;

                        case ProjectionMode.Ring:
                            // 环形映射：围绕 Y 轴形成环
                            const ringAngle = p3d.x * Math.PI;
                            const ringRadius = scale * (0.8 + p3d.z * 0.2);
                            finalX = Math.cos(ringAngle) * ringRadius;
                            finalY = p3d.y * scale * 0.1;
                            finalZ = Math.sin(ringAngle) * ringRadius;
                            break;

                        case ProjectionMode.Screen:
                        default:
                            // 屏幕空间：平面映射
                            finalX = p3d.x * scale;
                            finalY = p3d.y * scale;
                            finalZ = (p3d.z || 0) * scale * 0.1;
                            break;
                    }

                    // 应用图层高度偏移
                    finalY += layer.transform.altitude;

                    allPoints.push(finalX, finalY, finalZ);
                    allPressures.push(p3d.pressure);
                    allIndices.push(pointIndex++);
                    allColors.push(color.r, color.g, color.b);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPoints, 3));
        geometry.setAttribute('aPressure', new THREE.Float32BufferAttribute(allPressures, 1));
        geometry.setAttribute('aPointIndex', new THREE.Float32BufferAttribute(allIndices, 1));
        geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(allColors, 3));

        return geometry;
    }

    // 更新或创建图层的渲染数据
    private syncLayer(layer: DrawingLayer, drawing: Drawing, settings: DrawSettings): void {
        const layerId = `${drawing.id}_${layer.id}`;
        const existing = this.layerRenderData.get(layerId);

        // 检查是否需要更新
        const needsRebuild = !existing ||
            this.needsUpdate.has(layer.id) ||
            existing.strokeCount !== layer.strokes.length;

        if (!needsRebuild) return;

        // 移除旧的渲染对象
        if (existing) {
            this.scene.remove(existing.points);
            existing.geometry.dispose();
        }

        // 如果图层为空或不可见，不创建新对象
        if (!layer.visible || layer.strokes.length === 0) {
            this.layerRenderData.delete(layerId);
            this.needsUpdate.delete(layer.id);
            return;
        }

        // 创建新几何体
        const geometry = this.createGeometryFromLayer(layer, layer.projection);

        // 获取材质（克隆以支持不同混合模式）
        const baseMaterial = this.materialCache.get(layer.brushType);
        if (!baseMaterial) {
            this.needsUpdate.delete(layer.id);
            return;
        }

        const material = baseMaterial.clone();
        material.blending = layer.blending === 'additive'
            ? THREE.AdditiveBlending
            : THREE.NormalBlending;

        // 创建粒子系统
        const points = new THREE.Points(geometry, material);

        // 应用图层变换
        points.rotation.x = layer.transform.tilt.x * Math.PI / 180;
        points.rotation.y = layer.transform.tilt.y * Math.PI / 180;
        points.rotation.z = layer.transform.tilt.z * Math.PI / 180;

        this.scene.add(points);

        // 保存渲染数据
        this.layerRenderData.set(layerId, {
            points,
            geometry,
            material,
            strokeCount: layer.strokes.length,
            lastUpdateTime: this.clock.getElapsedTime()
        });

        this.needsUpdate.delete(layer.id);
    }

    // 同步所有绘图数据（仅更新有变化的部分）
    sync(settings: DrawSettings): void {
        if (!settings.enabled) return;

        const validLayerIds = new Set<string>();

        for (const drawing of settings.drawings) {
            if (!drawing.visible) continue;

            for (const layer of drawing.layers) {
                const layerId = `${drawing.id}_${layer.id}`;
                validLayerIds.add(layerId);
                this.syncLayer(layer, drawing, settings);
            }
        }

        // 清理已删除的图层
        for (const [layerId, data] of this.layerRenderData) {
            if (!validLayerIds.has(layerId)) {
                this.scene.remove(data.points);
                data.geometry.dispose();
                this.layerRenderData.delete(layerId);
            }
        }
    }

    // 更新动画（每帧调用）
    update(brushSettings?: BrushSettings): void {
        const time = this.clock.getElapsedTime();

        // 更新所有材质的时间 uniform
        for (const material of this.materialCache.values()) {
            if (material.uniforms.uTime) {
                material.uniforms.uTime.value = time;
            }
        }

        // 更新笔刷相关 uniforms
        if (brushSettings) {
            const material = this.materialCache.get(brushSettings.type);
            if (material) {
                material.uniforms.uSize.value = brushSettings.size;
                material.uniforms.uOpacity.value = brushSettings.opacity;
            }
        }

        // 更新图层旋转动画
        for (const [layerId, data] of this.layerRenderData) {
            // 解析 layerId 获取旋转速度（简化：使用固定旋转）
            data.points.rotation.y += 0.002;
        }
    }

    // 设置球体半径
    setSphereRadius(radius: number): void {
        this.sphereRadius = radius;
        // 标记所有图层需要更新
        for (const [layerId] of this.layerRenderData) {
            const layerIdOnly = layerId.split('_')[1];
            if (layerIdOnly) this.needsUpdate.add(layerIdOnly);
        }
    }

    // 清除所有渲染数据
    clear(): void {
        for (const [, data] of this.layerRenderData) {
            this.scene.remove(data.points);
            data.geometry.dispose();
        }
        this.layerRenderData.clear();
        this.needsUpdate.clear();
    }

    // 销毁渲染器
    dispose(): void {
        this.clear();
        for (const material of this.materialCache.values()) {
            material.dispose();
        }
        this.materialCache.clear();
    }
}

export default InkRenderer;
