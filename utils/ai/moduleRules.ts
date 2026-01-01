/**
 * AI 创造系统 - 模块规则定义
 * 
 * input: 效果类型 (EffectType)
 * output: 该效果的依赖/互斥/默认值规则
 * pos: 定义参数间的关联规则，用于 KB 生成和验证
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { EffectType } from './schemaBuilder';

// ============================================
// 规则类型定义
// ============================================

export interface RuleCondition {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
    value: any;
}

export interface RuleEffect {
    require?: string[];                    // 必填字段
    defaults?: Record<string, any>;        // 默认值
    exclude?: string[];                    // 排除字段
    recommend?: Record<string, { min: number; max: number }>; // 推荐范围
}

export interface ModuleRule {
    description: string;                   // 规则描述（用于 KB）
    when: RuleCondition;
    then: RuleEffect;
}

// ============================================
// 阶段 1 模块规则：particleCore + energyBody
// ============================================

export const MODULE_RULES: Partial<Record<EffectType, ModuleRule[]>> = {

    // 粒子核心规则（较简单）
    particleCore: [
        {
            description: '外壳模式时 fillPercent 应设为 0-30',
            when: { field: 'fillMode', operator: '=', value: 'shell' },
            then: {
                recommend: { 'fillPercent': { min: 0, max: 30 } }
            }
        },
        {
            description: '实心模式时 fillPercent 应设为 70-100',
            when: { field: 'fillMode', operator: '=', value: 'solid' },
            then: {
                recommend: { 'fillPercent': { min: 70, max: 100 } }
            }
        }
    ],

    // 能量体规则
    energyBody: [
        {
            description: '线框模式：需要配置边线参数，薄壳透明度设为 0',
            when: { field: 'renderMode', operator: '=', value: 'wireframe' },
            then: {
                require: ['edgeEffect.width', 'edgeEffect.color'],
                defaults: { 'shellEffect.opacity': 0 }
            }
        },
        {
            description: '薄壳模式：需要配置薄壳参数',
            when: { field: 'renderMode', operator: '=', value: 'shell' },
            then: {
                require: ['shellEffect.opacity'],
                defaults: { 'edgeEffect.width': 0 }
            }
        },
        {
            description: '两者模式：同时配置边线和薄壳',
            when: { field: 'renderMode', operator: '=', value: 'both' },
            then: {
                require: ['edgeEffect.width', 'edgeEffect.color', 'shellEffect.opacity']
            }
        },
        {
            description: '高细分球化时效果更佳',
            when: { field: 'subdivisionLevel', operator: '>=', value: 2 },
            then: {
                recommend: { 'spherize': { min: 0.3, max: 1 } }
            }
        }
    ]
};

// ============================================
// 规则辅助函数
// ============================================

/**
 * 获取模块的所有规则
 */
export function getModuleRules(effectType: EffectType): ModuleRule[] {
    return MODULE_RULES[effectType] || [];
}

/**
 * 检查条件是否满足
 */
export function checkCondition(condition: RuleCondition, fields: Record<string, any>): boolean {
    const value = fields[condition.field];

    switch (condition.operator) {
        case '=':
            return value === condition.value;
        case '!=':
            return value !== condition.value;
        case '>':
            return typeof value === 'number' && value > condition.value;
        case '<':
            return typeof value === 'number' && value < condition.value;
        case '>=':
            return typeof value === 'number' && value >= condition.value;
        case '<=':
            return typeof value === 'number' && value <= condition.value;
        default:
            return false;
    }
}

/**
 * 获取匹配的规则效果
 */
export function getMatchingRuleEffects(
    effectType: EffectType,
    fields: Record<string, any>
): RuleEffect[] {
    const rules = getModuleRules(effectType);
    return rules
        .filter(rule => checkCondition(rule.when, fields))
        .map(rule => rule.then);
}

/**
 * 应用规则默认值到字段
 */
export function applyRuleDefaults(
    effectType: EffectType,
    fields: Record<string, any>
): void {
    const effects = getMatchingRuleEffects(effectType, fields);

    for (const effect of effects) {
        if (effect.defaults) {
            for (const [key, value] of Object.entries(effect.defaults)) {
                // 只在字段未设置时应用默认值
                if (fields[key] === undefined) {
                    fields[key] = value;
                }
            }
        }
    }
}

/**
 * 生成规则描述文本（用于 KB）
 */
export function generateRulesText(effectType: EffectType): string {
    const rules = getModuleRules(effectType);
    if (rules.length === 0) return '';

    const lines = ['## 参数规则'];
    for (const rule of rules) {
        lines.push(`- ${rule.description}`);
    }
    return lines.join('\n');
}
