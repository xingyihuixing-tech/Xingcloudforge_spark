/**
 * XingForge AI - Config Merger
 * 
 * input: AI 简化输出 (AISimplifiedOutput)
 * output: 完整的 PlanetSettings (与 types.ts 完全兼容)
 * pos: AI 系统的核心转换层，将 AI 输出合并到默认模板中
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import {
    createDefaultPlanet,
    createDefaultCore,
    createDefaultSolidCore,
    createDefaultSurfaceFlame,
    createDefaultSpiralFlame,
    createDefaultOrbiting,
    createDefaultEmitter,
    createDefaultOrbitingFirefly,
    createDefaultWanderingGroup,
    createDefaultParticleRing,
    createDefaultContinuousRing,
    createDefaultEnergyBody,
} from '../../constants';

import type {
    PlanetSettings,
    PlanetCoreSettings,
    SolidCoreSettings,
    SurfaceFlameSettings,
    SpiralFlameSettings,
    OrbitingParticlesSettings,
    ParticleEmitterSettings,
    OrbitingFireflySettings,
    WanderingFireflyGroupSettings,
    ParticleRingSettings,
    ContinuousRingSettings,
    EnergyBodySettings,
} from '../../types';

// ============================================
// AI 简化输出类型定义
// ============================================

// AI 只需要提供这些简化的字段
export interface AISimplifiedOutput {
    name?: string;  // 星球名称

    // 核心系统
    particleCore?: Partial<PlanetCoreSettings>;
    solidCore?: Partial<SolidCoreSettings>;

    // 火焰系统
    surfaceFlame?: Partial<SurfaceFlameSettings>;
    spiralRing?: Partial<SpiralFlameSettings>;

    // 环系统
    particleRing?: Partial<ParticleRingSettings>;
    ringBelt?: Partial<ContinuousRingSettings>;

    // 辐射系统
    particleOrbit?: Partial<OrbitingParticlesSettings>;
    particleJet?: Partial<ParticleEmitterSettings>;

    // 流萤系统
    rotatingFirefly?: Partial<OrbitingFireflySettings>;
    wanderingFirefly?: Partial<WanderingFireflyGroupSettings>;

    // 能量体系统
    energyBody?: Partial<EnergyBodySettings>;
}

// ============================================
// 工具函数
// ============================================

function generateId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * 深度合并两个对象 (target 会被 source 覆盖)
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        if (source[key] !== undefined) {
            const targetValue = (target as any)[key];
            const sourceValue = (source as any)[key];

            if (
                targetValue !== null &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue) &&
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue)
            ) {
                // 递归合并嵌套对象
                (result as any)[key] = deepMerge(targetValue, sourceValue);
            } else {
                // 直接覆盖
                (result as any)[key] = sourceValue;
            }
        }
    }

    return result;
}

// ============================================
// 主转换函数
// ============================================

/**
 * 将 AI 简化输出转换为完整的 PlanetSettings
 */
export function convertAIOutputToPlanet(
    aiOutput: AISimplifiedOutput,
    basePlanet?: PlanetSettings
): PlanetSettings {
    // 使用基础星球或创建新星球
    const planetId = generateId();
    const planet = basePlanet
        ? { ...basePlanet }
        : createDefaultPlanet(planetId, aiOutput.name || 'AI 星球');

    // 更新星球名称
    if (aiOutput.name) {
        planet.name = aiOutput.name;
    }

    // === 粒子核心 ===
    if (aiOutput.particleCore) {
        const coreId = generateId();
        const coreName = (aiOutput.particleCore as any).name || '粒子核心';
        const defaultCore = createDefaultCore(coreId, coreName);
        const mergedCore = deepMerge(defaultCore, aiOutput.particleCore);
        mergedCore.enabled = true;

        planet.coreSystem.coresEnabled = true;
        planet.coreSystem.cores = [mergedCore];
    }

    // === 实体核心 ===
    if (aiOutput.solidCore) {
        const coreId = generateId();
        const coreName = (aiOutput.solidCore as any).name || '实体核心';
        const defaultCore = createDefaultSolidCore(coreId, coreName);
        const mergedCore = deepMerge(defaultCore, aiOutput.solidCore);
        mergedCore.enabled = true;

        planet.coreSystem.solidCoresEnabled = true;
        planet.coreSystem.solidCores = [mergedCore];
    }

    // === 能量罩 (SurfaceFlame) ===
    if (aiOutput.surfaceFlame) {
        const id = generateId();
        const name = (aiOutput.surfaceFlame as any).name || '能量罩';
        const defaultFlame = createDefaultSurfaceFlame(id, name);
        const mergedFlame = deepMerge(defaultFlame, aiOutput.surfaceFlame);
        mergedFlame.enabled = true;

        planet.flameSystem.enabled = true;
        planet.flameSystem.surfaceFlamesEnabled = true;
        planet.flameSystem.surfaceFlames = [mergedFlame];
    }

    // === 螺旋环 (SpiralFlame) ===
    if (aiOutput.spiralRing) {
        const id = generateId();
        const name = (aiOutput.spiralRing as any).name || '螺旋环';
        const defaultSpiral = createDefaultSpiralFlame(id, name);
        const mergedSpiral = deepMerge(defaultSpiral, aiOutput.spiralRing);
        mergedSpiral.enabled = true;

        planet.flameSystem.enabled = true;
        planet.flameSystem.spiralFlamesEnabled = true;
        planet.flameSystem.spiralFlames = [mergedSpiral];
    }

    // === 粒子环 ===
    if (aiOutput.particleRing) {
        const id = generateId();
        const name = (aiOutput.particleRing as any).name || '粒子环';
        const defaultRing = createDefaultParticleRing(id, name);
        const mergedRing = deepMerge(defaultRing, aiOutput.particleRing);
        mergedRing.enabled = true;

        planet.rings.particleRingsEnabled = true;
        planet.rings.particleRings = [mergedRing];
    }

    // === 环带 (ContinuousRing) ===
    if (aiOutput.ringBelt) {
        const id = generateId();
        const name = (aiOutput.ringBelt as any).name || '环带';
        const defaultRing = createDefaultContinuousRing(id, name);
        const mergedRing = deepMerge(defaultRing, aiOutput.ringBelt);
        mergedRing.enabled = true;

        planet.rings.continuousRingsEnabled = true;
        planet.rings.continuousRings = [mergedRing];
    }

    // === 粒子环绕 ===
    if (aiOutput.particleOrbit) {
        const id = generateId();
        const name = (aiOutput.particleOrbit as any).name || '粒子环绕';
        const defaultOrbiting = createDefaultOrbiting(id, name);
        const mergedOrbiting = deepMerge(defaultOrbiting, aiOutput.particleOrbit);
        mergedOrbiting.enabled = true;

        planet.radiation.orbitingEnabled = true;
        planet.radiation.orbitings = [mergedOrbiting];
    }

    // === 粒子喷射 ===
    if (aiOutput.particleJet) {
        const id = generateId();
        const name = (aiOutput.particleJet as any).name || '粒子喷射';
        const defaultEmitter = createDefaultEmitter(id, name);
        const mergedEmitter = deepMerge(defaultEmitter, aiOutput.particleJet);
        mergedEmitter.enabled = true;

        planet.radiation.emitterEnabled = true;
        planet.radiation.emitters = [mergedEmitter];
    }

    // === 旋转流萤 ===
    if (aiOutput.rotatingFirefly) {
        const id = generateId();
        const name = (aiOutput.rotatingFirefly as any).name || '旋转流萤';
        const defaultFirefly = createDefaultOrbitingFirefly(id, name);
        const mergedFirefly = deepMerge(defaultFirefly, aiOutput.rotatingFirefly);
        mergedFirefly.enabled = true;

        planet.fireflies.orbitingEnabled = true;
        planet.fireflies.orbitingFireflies = [mergedFirefly];
    }

    // === 游走流萤 ===
    if (aiOutput.wanderingFirefly) {
        const id = generateId();
        const name = (aiOutput.wanderingFirefly as any).name || '游走流萤';
        const defaultGroup = createDefaultWanderingGroup(id, name);
        const mergedGroup = deepMerge(defaultGroup, aiOutput.wanderingFirefly);
        mergedGroup.enabled = true;

        planet.fireflies.wanderingEnabled = true;
        planet.fireflies.wanderingGroups = [mergedGroup];
    }

    // === 能量体 ===
    if (aiOutput.energyBody) {
        const id = generateId();
        const name = (aiOutput.energyBody as any).name || '能量体';
        const defaultBody = createDefaultEnergyBody(id, name);
        const mergedBody = deepMerge(defaultBody, aiOutput.energyBody);
        mergedBody.enabled = true;

        planet.energyBodySystem.enabled = true;
        planet.energyBodySystem.energyBodies = [mergedBody];
    }

    return planet;
}

/**
 * 将 AI Patch 增量更新应用到现有星球
 */
export function applyAIPatchToPlanet(
    planet: PlanetSettings,
    patch: Partial<AISimplifiedOutput>
): PlanetSettings {
    // 保持现有 ID 和名称
    const result = convertAIOutputToPlanet(patch as AISimplifiedOutput, planet);
    result.id = planet.id;
    result.name = planet.name;  // 修改模式不改名称
    return result;
}
