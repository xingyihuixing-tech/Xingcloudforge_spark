/**
 * AI 创造系统 - Patch 应用器
 * 
 * input: PlanetSettings + AI 生成的 patch
 * output: 更新后的 PlanetSettings
 * pos: 将 effectType+instanceId 格式的 patch 映射到真实数据结构
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { PlanetSettings } from '../../types';
import { EffectType } from './schemaBuilder';
import { AIPatch, InstancePatch } from './configValidator';

// ============================================
// 路径映射配置
// ============================================

type ArrayGetter = (planet: PlanetSettings) => any[] | undefined;

/**
 * 效果类型到 PlanetSettings 路径的映射
 * 返回该效果类型对应的实例数组
 */
const EFFECT_PATH_MAP: Record<EffectType, ArrayGetter> = {
    particleCore: (p) => p.coreSystem?.cores,
    solidCore: (p) => p.coreSystem?.solidCores,
    energyCore: (p) => {
        // energyCore 可能在 energyBodySystem 或单独的 energyCores
        // 根据实际结构调整
        return undefined; // 阶段 1 暂不支持
    },
    energyBody: (p) => p.energyBodySystem?.energyBodies,
    particleRing: (p) => p.rings?.particleRings,
    ringBelt: (p) => p.rings?.continuousRings,
    spiralRing: (p) => p.flameSystem?.spiralFlames,
    particleOrbit: (p) => p.radiation?.orbitings,
    particleJet: (p) => p.radiation?.emitters,
    rotatingFirefly: (p) => p.fireflies?.orbitingFireflies,
    wanderingFirefly: (p) => p.fireflies?.wanderingGroups,
};

// ============================================
// 主应用函数
// ============================================

/**
 * 将 AI patch 应用到单颗星球配置
 */
export function applyEffectPatchToPlanet(
    planet: PlanetSettings,
    patch: AIPatch
): PlanetSettings {
    // 深拷贝避免直接修改原对象
    const result = deepClone(planet);

    for (const [effectType, data] of Object.entries(patch)) {
        const getArray = EFFECT_PATH_MAP[effectType as EffectType];
        if (!getArray) {
            console.warn(`[patchApplier] 未知效果类型: ${effectType}`);
            continue;
        }

        const targetArray = getArray(result);
        if (!targetArray || !Array.isArray(targetArray)) {
            console.warn(`[patchApplier] 效果 ${effectType} 的目标数组不存在`);
            continue;
        }

        for (const inst of data.instances) {
            applyInstancePatch(targetArray, inst, effectType);
        }
    }

    return result;
}

/**
 * 应用单个实例的 patch
 */
function applyInstancePatch(
    targetArray: any[],
    inst: InstancePatch,
    effectType: string
): void {
    // 解析实例 ID → 数组索引
    // v1 简单映射: instance_1 → index 0
    const indexMatch = inst.id.match(/instance_(\d+)/);
    const index = indexMatch ? parseInt(indexMatch[1]) - 1 : 0;

    if (index < 0 || index >= targetArray.length) {
        console.warn(`[patchApplier] ${effectType}.${inst.id} 索引超出范围`);
        return;
    }

    const target = targetArray[index];
    if (!target) return;

    // 应用字段
    for (const [field, value] of Object.entries(inst.fields)) {
        setNestedValue(target, field, value);
    }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 设置嵌套字段值
 * 支持 'edgeEffect.width' → target.edgeEffect.width
 */
function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || current[key] === null) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

/**
 * 获取嵌套字段值
 */
export function getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current === undefined || current === null) {
            return undefined;
        }
        current = current[key];
    }

    return current;
}

/**
 * 深拷贝对象
 */
function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (cloned as any)[key] = deepClone((obj as any)[key]);
        }
    }

    return cloned;
}

/**
 * 确保效果系统存在
 * 用于初始化空的星球配置
 */
export function ensureEffectSystem(
    planet: PlanetSettings,
    effectType: EffectType
): void {
    switch (effectType) {
        case 'particleCore':
        case 'solidCore':
            if (!planet.coreSystem) {
                planet.coreSystem = {
                    coresEnabled: true,
                    solidCoresEnabled: true,
                    coreType: effectType === 'particleCore' ? 'particle' : 'solid',
                    cores: [],
                    solidCores: []
                };
            }
            break;
        case 'energyBody':
            if (!planet.energyBodySystem) {
                planet.energyBodySystem = {
                    enabled: true,
                    energyBodies: []
                };
            }
            break;
        // 其他模块后续扩展...
    }
}

/**
 * 创建默认实例（如果数组为空）
 */
export function ensureDefaultInstance(
    planet: PlanetSettings,
    effectType: EffectType
): void {
    ensureEffectSystem(planet, effectType);

    const getArray = EFFECT_PATH_MAP[effectType];
    if (!getArray) return;

    const arr = getArray(planet);
    if (arr && arr.length === 0) {
        // 添加一个默认实例
        // 这里需要根据具体类型创建默认实例
        // 阶段 1 暂时不实现，由外部确保
        console.warn(`[patchApplier] ${effectType} 数组为空，需要先创建实例`);
    }
}
