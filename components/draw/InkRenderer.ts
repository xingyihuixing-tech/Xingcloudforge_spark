/**
 * InkRenderer - 墨迹渲染器
 * 
 * input: 笔触数据、对称设置、笔刷参数
 * output: Three.js 粒子系统，渲染到场景中
 * pos: 绘图系统渲染核心，负责将 2D 笔触转换为 3D 粒子效果
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

// ==================== 渲染器类 ====================

export class InkRenderer {
    private scene: THREE.Scene;
    private particleSystems: Map<string, THREE.Points>;
    private materials: Map<BrushType, THREE.ShaderMaterial>;
    private clock: THREE.Clock;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.particleSystems = new Map();
        this.materials = new Map();
        this.clock = new THREE.Clock();

        // 预创建所有笔刷类型的材质
        this.initMaterials();
    }

    // 初始化材质
    private initMaterials(): void {
        const brushTypes = Object.values(BrushType);

        for (const brushType of brushTypes) {
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

            this.materials.set(brushType, material);
        }
    }

    // 获取默认 uniforms
    private getDefaultUniforms(brushType: BrushType): Record<string, THREE.IUniform> {
        const baseUniforms: Record<string, THREE.IUniform> = {
            uTime: { value: 0 },
            uSize: { value: 10 },
            uOpacity: { value: 0.8 }
        };

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

    // 更新笔刷 uniforms
    updateBrushUniforms(brushSettings: BrushSettings): void {
        const material = this.materials.get(brushSettings.type);
        if (!material) return;

        // 基础参数
        material.uniforms.uSize.value = brushSettings.size;
        material.uniforms.uOpacity.value = brushSettings.opacity;

        // 特定笔刷参数
        switch (brushSettings.type) {
            case BrushType.Stardust:
                if (brushSettings.stardust) {
                    material.uniforms.uDensity.value = brushSettings.stardust.density;
                    material.uniforms.uScatter.value = brushSettings.stardust.scatter;
                    material.uniforms.uGlowIntensity.value = brushSettings.stardust.glowIntensity;
                    material.uniforms.uTwinkleSpeed.value = brushSettings.stardust.twinkleSpeed;
                }
                break;

            case BrushType.GasCloud:
                if (brushSettings.gasCloud) {
                    material.uniforms.uNoiseScale.value = brushSettings.gasCloud.noiseScale;
                    material.uniforms.uFlowSpeed.value = brushSettings.gasCloud.flowSpeed;
                    material.uniforms.uSoftness.value = brushSettings.gasCloud.softness;
                    material.uniforms.uTurbulence.value = brushSettings.gasCloud.turbulence;
                }
                break;

            case BrushType.EnergyBeam:
                if (brushSettings.energyBeam) {
                    material.uniforms.uCoreWidth.value = brushSettings.energyBeam.coreWidth;
                    material.uniforms.uGlowRadius.value = brushSettings.energyBeam.glowRadius;
                    material.uniforms.uGlowIntensity.value = brushSettings.energyBeam.glowIntensity;
                    material.uniforms.uElectricArc.value = brushSettings.energyBeam.electricArc ? 1 : 0;
                    material.uniforms.uArcFrequency.value = brushSettings.energyBeam.arcFrequency;
                }
                break;

            case BrushType.SpiralRing:
                if (brushSettings.spiralRing) {
                    material.uniforms.uSpiralDensity.value = brushSettings.spiralRing.spiralDensity;
                    material.uniforms.uPitch.value = brushSettings.spiralRing.pitch;
                    material.uniforms.uThickness.value = brushSettings.spiralRing.thickness;
                    material.uniforms.uRotationSpeed.value = brushSettings.spiralRing.rotationSpeed;
                    material.uniforms.uRiseSpeed.value = brushSettings.spiralRing.riseSpeed;
                    material.uniforms.uEmissive.value = brushSettings.spiralRing.emissive;
                }
                break;

            case BrushType.Firefly:
                if (brushSettings.firefly) {
                    material.uniforms.uHeadSize.value = brushSettings.firefly.headSize;
                    material.uniforms.uHeadBrightness.value = brushSettings.firefly.headBrightness;
                    material.uniforms.uPulseSpeed.value = brushSettings.firefly.pulseSpeed;
                    material.uniforms.uHeadStyle.value =
                        brushSettings.firefly.headStyle === 'plain' ? 0 :
                            brushSettings.firefly.headStyle === 'flare' ? 1 : 2;
                    material.uniforms.uFlareLeaves.value = brushSettings.firefly.flareLeaves;
                }
                break;

            case BrushType.Fracture:
                if (brushSettings.fracture) {
                    material.uniforms.uCrackScale.value = brushSettings.fracture.crackScale;
                    material.uniforms.uCrackThreshold.value = brushSettings.fracture.crackThreshold;
                    material.uniforms.uCrackFeather.value = brushSettings.fracture.crackFeather;
                    material.uniforms.uCrackWarp.value = brushSettings.fracture.crackWarp;
                    material.uniforms.uFlowSpeed.value = brushSettings.fracture.flowSpeed;
                    material.uniforms.uEmission.value = brushSettings.fracture.emission;
                }
                break;
        }
    }

    // 从笔触数据创建粒子几何体
    createGeometryFromStroke(
        stroke: Stroke,
        layer: DrawingLayer,
        projection: ProjectionMode,
        scale: number = 100
    ): THREE.BufferGeometry {
        const points = stroke.points;
        const numPoints = points.length / 4; // [x, y, pressure, timestamp]

        // 应用对称获取所有 3D 点
        const allPoints: Point3D[] = [];
        const allPressures: number[] = [];
        const allIndices: number[] = [];

        for (let i = 0; i < numPoints; i++) {
            const p2d: Point2D = {
                x: points[i * 4],
                y: points[i * 4 + 1],
                pressure: points[i * 4 + 2]
            };

            const symmetricPoints = applySymmetry(p2d, stroke.symmetrySnapshot);

            for (const p3d of symmetricPoints) {
                // 根据投影模式转换坐标
                let finalPos: THREE.Vector3;

                switch (projection) {
                    case ProjectionMode.Sphere:
                        // 球面映射
                        const theta = p3d.x * Math.PI;
                        const phi = (p3d.y + 1) * Math.PI / 2;
                        finalPos = new THREE.Vector3(
                            Math.sin(phi) * Math.cos(theta) * scale,
                            Math.cos(phi) * scale,
                            Math.sin(phi) * Math.sin(theta) * scale
                        );
                        break;

                    case ProjectionMode.Ring:
                        // 环形映射
                        const ringAngle = p3d.x * Math.PI;
                        const ringRadius = scale * (0.8 + p3d.z * 0.2);
                        finalPos = new THREE.Vector3(
                            Math.cos(ringAngle) * ringRadius,
                            p3d.y * scale * 0.1,
                            Math.sin(ringAngle) * ringRadius
                        );
                        break;

                    case ProjectionMode.Screen:
                    default:
                        // 屏幕空间映射
                        finalPos = new THREE.Vector3(
                            p3d.x * scale,
                            p3d.y * scale,
                            p3d.z * scale * 0.1
                        );
                        break;
                }

                allPoints.push({
                    x: finalPos.x,
                    y: finalPos.y,
                    z: finalPos.z,
                    pressure: p3d.pressure
                });
                allPressures.push(p3d.pressure);
                allIndices.push(allPoints.length - 1);
            }
        }

        // 创建几何体
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(allPoints.length * 3);
        const pressures = new Float32Array(allPoints.length);
        const indices = new Float32Array(allPoints.length);
        const colors = new Float32Array(allPoints.length * 3);

        // 解析颜色
        const color = new THREE.Color(layer.color);

        for (let i = 0; i < allPoints.length; i++) {
            positions[i * 3] = allPoints[i].x;
            positions[i * 3 + 1] = allPoints[i].y;
            positions[i * 3 + 2] = allPoints[i].z;
            pressures[i] = allPressures[i];
            indices[i] = i;
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aPressure', new THREE.BufferAttribute(pressures, 1));
        geometry.setAttribute('aPointIndex', new THREE.BufferAttribute(indices, 1));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

        return geometry;
    }

    // 渲染单个图层
    renderLayer(
        layer: DrawingLayer,
        drawing: Drawing,
        settings: DrawSettings
    ): void {
        if (!layer.visible || layer.strokes.length === 0) return;

        const layerId = `${drawing.id}_${layer.id}`;

        // 移除旧的粒子系统
        const existing = this.particleSystems.get(layerId);
        if (existing) {
            this.scene.remove(existing);
            existing.geometry.dispose();
        }

        // 合并所有笔触几何体
        const geometries: THREE.BufferGeometry[] = [];

        for (const stroke of layer.strokes) {
            const geometry = this.createGeometryFromStroke(
                stroke,
                layer,
                layer.projection,
                100 * layer.transform.scale
            );
            geometries.push(geometry);
        }

        if (geometries.length === 0) return;

        // 合并几何体
        const mergedGeometry = this.mergeGeometries(geometries);

        // 获取材质并设置混合模式
        const material = this.materials.get(layer.brushType);
        if (!material) return;

        const clonedMaterial = material.clone();
        clonedMaterial.blending = layer.blending === 'additive'
            ? THREE.AdditiveBlending
            : THREE.NormalBlending;

        // 创建粒子系统
        const points = new THREE.Points(mergedGeometry, clonedMaterial);

        // 应用图层变换
        points.rotation.x = layer.transform.tilt.x * Math.PI / 180;
        points.rotation.y = layer.transform.tilt.y * Math.PI / 180;
        points.rotation.z = layer.transform.tilt.z * Math.PI / 180;
        points.position.y = layer.transform.altitude;

        this.scene.add(points);
        this.particleSystems.set(layerId, points);

        // 清理临时几何体
        geometries.forEach(g => g.dispose());
    }

    // 合并多个几何体
    private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
        if (geometries.length === 1) return geometries[0];

        // 计算总点数
        let totalPoints = 0;
        for (const g of geometries) {
            totalPoints += g.getAttribute('position').count;
        }

        // 创建合并后的数组
        const positions = new Float32Array(totalPoints * 3);
        const pressures = new Float32Array(totalPoints);
        const indices = new Float32Array(totalPoints);
        const colors = new Float32Array(totalPoints * 3);

        let offset = 0;
        for (const g of geometries) {
            const count = g.getAttribute('position').count;
            const pos = g.getAttribute('position').array as Float32Array;
            const pres = g.getAttribute('aPressure').array as Float32Array;
            const idx = g.getAttribute('aPointIndex').array as Float32Array;
            const col = g.getAttribute('aColor').array as Float32Array;

            positions.set(pos, offset * 3);
            pressures.set(pres, offset);
            colors.set(col, offset * 3);

            // 更新索引偏移
            for (let i = 0; i < count; i++) {
                indices[offset + i] = idx[i] + offset;
            }

            offset += count;
        }

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('aPressure', new THREE.BufferAttribute(pressures, 1));
        merged.setAttribute('aPointIndex', new THREE.BufferAttribute(indices, 1));
        merged.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

        return merged;
    }

    // 渲染整个绘图实例
    renderDrawing(drawing: Drawing, settings: DrawSettings): void {
        if (!drawing.visible) return;

        for (const layer of drawing.layers) {
            this.renderLayer(layer, drawing, settings);
        }
    }

    // 更新动画
    update(): void {
        const time = this.clock.getElapsedTime();

        // 更新所有材质的时间 uniform
        for (const material of this.materials.values()) {
            if (material.uniforms.uTime) {
                material.uniforms.uTime.value = time;
            }
        }

        // 更新旋转动画
        for (const [layerId, points] of this.particleSystems) {
            // 从 layerId 获取旋转速度（简化版）
            // 实际应该从 layer.transform.rotationSpeed 获取
            points.rotation.y += 0.001;
        }
    }

    // 清除所有粒子系统
    clear(): void {
        for (const [id, points] of this.particleSystems) {
            this.scene.remove(points);
            points.geometry.dispose();
        }
        this.particleSystems.clear();
    }

    // 销毁渲染器
    dispose(): void {
        this.clear();
        for (const material of this.materials.values()) {
            material.dispose();
        }
        this.materials.clear();
    }
}

export default InkRenderer;
