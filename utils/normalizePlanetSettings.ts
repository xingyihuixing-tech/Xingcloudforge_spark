/**
 * 星球配置规范化函数
 * 
 * input: 不完整的 Partial<PlanetSettings>
 * output: 完整的 PlanetSettings，所有字段都有默认值
 * pos: 前端专用，确保渲染时不会因缺失字段崩溃
 * update: 一旦 constants.ts 的默认结构改变，需要同步更新这里
 * 
 * 重要：此文件只能在前端调用，不能被 API/Node 端引用（constants.ts 有浏览器依赖）
 */

import {
    PlanetSettings,
    PlanetCoreSettings,
    EnergyBodySettings
} from '../types';
import {
    createDefaultPlanet,
    createDefaultCore,
    createDefaultEnergyBody
} from '../constants';

/**
 * 规范化整个星球配置
 * 确保所有嵌套对象都有完整的默认值
 */
export function normalizePlanetSettings(raw: Partial<PlanetSettings>): PlanetSettings {
    const id = raw.id || `planet-${Date.now()}`;
    const name = raw.name || '新星球';
    const base = createDefaultPlanet(id, name);

    return {
        ...base,
        ...raw,
        id,
        name,
        // 核心系统
        coreSystem: normalizeCoreSystem(raw.coreSystem, base.coreSystem),
        // 能量体系统
        energyBodySystem: normalizeEnergyBodySystem(raw.energyBodySystem, base.energyBodySystem),
        // 其他系统保持默认（后续实现时添加）
        flameSystem: raw.flameSystem || base.flameSystem,
        afterimageSystem: raw.afterimageSystem || base.afterimageSystem,
        rings: raw.rings || base.rings,
        radiation: raw.radiation || base.radiation,
        fireflies: raw.fireflies || base.fireflies,
        magicCircles: raw.magicCircles || base.magicCircles,
    };
}

/**
 * 规范化核心系统
 */
function normalizeCoreSystem(
    raw: Partial<PlanetSettings['coreSystem']> | undefined,
    defaults: PlanetSettings['coreSystem']
) {
    if (!raw) return defaults;

    return {
        ...defaults,
        ...raw,
        cores: (raw.cores || []).map(core => normalizeCore(core)),
        solidCores: raw.solidCores || defaults.solidCores,
    };
}

/**
 * 规范化单个粒子核心
 * 深度合并所有嵌套对象
 */
function normalizeCore(raw: Partial<PlanetCoreSettings>): PlanetCoreSettings {
    const id = raw.id || `core-${Date.now()}`;
    const name = raw.name || '粒子核心';
    const defaults = createDefaultCore(id, name);

    return {
        ...defaults,
        ...raw,
        id,
        name,
        // 深度合并嵌套对象
        gradient: {
            ...defaults.gradient,
            ...(raw.gradient || {}),
        },
        noiseSettings: {
            ...defaults.noiseSettings,
            ...(raw.noiseSettings || {}),
        },
        tilt: {
            ...defaults.tilt,
            ...(raw.tilt || {}),
        },
        rotationAxis: {
            ...defaults.rotationAxis,
            ...(raw.rotationAxis || {}),
        },
    };
}

/**
 * 规范化能量体系统
 */
function normalizeEnergyBodySystem(
    raw: Partial<PlanetSettings['energyBodySystem']> | undefined,
    defaults: PlanetSettings['energyBodySystem']
) {
    if (!raw) return defaults;

    return {
        ...defaults,
        ...raw,
        energyBodies: (raw.energyBodies || []).map(eb => normalizeEnergyBody(eb)),
    };
}

/**
 * 规范化单个能量体
 * 深度合并所有嵌套对象（二级嵌套也要处理）
 */
function normalizeEnergyBody(raw: Partial<EnergyBodySettings>): EnergyBodySettings {
    const id = raw.id || `eb-${Date.now()}`;
    const name = raw.name || '能量体';
    const defaults = createDefaultEnergyBody(id, name);

    return {
        ...defaults,
        ...raw,
        id,
        name,
        // 深度合并所有嵌套对象
        edgeEffect: {
            ...defaults.edgeEffect,
            ...(raw.edgeEffect || {}),
            // 二级嵌套
            dashPattern: {
                ...defaults.edgeEffect.dashPattern,
                ...(raw.edgeEffect?.dashPattern || {}),
            },
        },
        vertexEffect: {
            ...defaults.vertexEffect,
            ...(raw.vertexEffect || {}),
        },
        shellEffect: {
            ...defaults.shellEffect,
            ...(raw.shellEffect || {}),
        },
        organicAnimation: {
            ...defaults.organicAnimation,
            ...(raw.organicAnimation || {}),
        },
        lightFlow: {
            ...defaults.lightFlow,
            ...(raw.lightFlow || {}),
        },
        edgeBreathing: {
            ...defaults.edgeBreathing,
            ...(raw.edgeBreathing || {}),
        },
        sphericalVoronoi: {
            ...defaults.sphericalVoronoi,
            ...(raw.sphericalVoronoi || {}),
        },
        postEffects: {
            ...defaults.postEffects,
            ...(raw.postEffects || {}),
        },
        tilt: {
            ...defaults.tilt,
            ...(raw.tilt || {}),
        },
        rotationAxis: {
            ...defaults.rotationAxis,
            ...(raw.rotationAxis || {}),
        },
    };
}
