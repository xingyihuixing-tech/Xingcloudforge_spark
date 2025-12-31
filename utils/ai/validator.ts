/**
 * XingForge AI - Validator & AutoFix
 * 
 * input: AI 返回的 JSON 字符串/对象
 * output: 验证结果 + 修正后的对象
 * pos: AI 输出校验与自动修复层
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { EFFECT_SCHEMAS, EffectType } from './schemaBuilder';
import type { AISimplifiedOutput } from './configMerger';

// ============================================
// 类型定义
// ============================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    sanitized: AISimplifiedOutput | null;
}

// AI 输出中允许的顶级键
const ALLOWED_TOP_KEYS: (keyof AISimplifiedOutput | 'name')[] = [
    'name',
    'particleCore',
    'solidCore',
    'surfaceFlame',
    'spiralRing',
    'particleRing',
    'ringBelt',
    'particleOrbit',
    'particleJet',
    'rotatingFirefly',
    'wanderingFirefly',
    'energyBody'
];

// effectType 到 schemaBuilder 的映射
const EFFECT_TYPE_MAP: Record<string, EffectType> = {
    particleCore: 'particleCore',
    solidCore: 'solidCore',
    surfaceFlame: 'energyCore',
    spiralRing: 'spiralRing',
    particleRing: 'particleRing',
    ringBelt: 'ringBelt',
    particleOrbit: 'particleOrbit',
    particleJet: 'particleJet',
    rotatingFirefly: 'rotatingFirefly',
    wanderingFirefly: 'wanderingFirefly',
    energyBody: 'energyBody'
};

// ============================================
// 提取 JSON
// ============================================

/**
 * 从 AI 响应中提取 JSON
 */
export function extractJSON(text: string): any | null {
    if (!text || typeof text !== 'string') return null;

    // 1. 尝试直接解析
    try {
        return JSON.parse(text);
    } catch { }

    // 2. 尝试提取 ```json ... ``` 代码块
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        try {
            return JSON.parse(jsonBlockMatch[1]);
        } catch { }
    }

    // 3. 尝试提取 ``` ... ``` 代码块
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1]);
        } catch { }
    }

    // 4. 尝试提取第一个 {...} 对象
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            return JSON.parse(objectMatch[0]);
        } catch { }
    }

    return null;
}

// ============================================
// 验证函数
// ============================================

/**
 * 验证并修正 AI 输出
 */
export function validateAIOutput(raw: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 基础类型检查
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            valid: false,
            errors: ['AI 输出必须是 JSON 对象'],
            warnings: [],
            sanitized: null
        };
    }

    const sanitized: AISimplifiedOutput = {};

    // 2. 遍历所有键
    for (const key of Object.keys(raw)) {
        // 2.1 检查是否是允许的键
        if (!ALLOWED_TOP_KEYS.includes(key as any)) {
            warnings.push(`忽略未知字段: ${key}`);
            continue;
        }

        // 2.2 处理 name 字段
        if (key === 'name') {
            if (typeof raw[key] === 'string') {
                sanitized.name = raw[key];
            } else {
                warnings.push('name 必须是字符串，已忽略');
            }
            continue;
        }

        // 2.3 验证效果配置
        const effectConfig = raw[key];
        if (typeof effectConfig !== 'object' || effectConfig === null) {
            warnings.push(`${key} 必须是对象，已忽略`);
            continue;
        }

        // 2.4 验证字段值范围
        const schemaType = EFFECT_TYPE_MAP[key];
        const schema = schemaType ? EFFECT_SCHEMAS[schemaType] : null;

        const sanitizedConfig: any = {};

        for (const [fieldName, fieldValue] of Object.entries(effectConfig)) {
            // 特殊处理 name 字段 (允许任意字符串)
            if (fieldName === 'name') {
                sanitizedConfig[fieldName] = String(fieldValue);
                continue;
            }

            if (!schema) {
                // 没有 schema，直接通过
                sanitizedConfig[fieldName] = fieldValue;
                continue;
            }

            const fieldSchema = schema.fields[fieldName];
            if (!fieldSchema) {
                // 未知字段，但可能是嵌套字段，允许通过
                sanitizedConfig[fieldName] = fieldValue;
                continue;
            }

            // 类型校验 + 范围修正
            if (fieldSchema.type === 'number') {
                let numValue = Number(fieldValue);
                if (isNaN(numValue)) {
                    warnings.push(`${key}.${fieldName} 不是有效数字，使用默认值`);
                    numValue = fieldSchema.default ?? fieldSchema.min ?? 0;
                } else {
                    // 范围修正
                    if (fieldSchema.min !== undefined && numValue < fieldSchema.min) {
                        warnings.push(`${key}.${fieldName} 低于最小值 ${fieldSchema.min}，已修正`);
                        numValue = fieldSchema.min;
                    }
                    if (fieldSchema.max !== undefined && numValue > fieldSchema.max) {
                        warnings.push(`${key}.${fieldName} 高于最大值 ${fieldSchema.max}，已修正`);
                        numValue = fieldSchema.max;
                    }
                }
                sanitizedConfig[fieldName] = numValue;

            } else if (fieldSchema.type === 'boolean') {
                sanitizedConfig[fieldName] = Boolean(fieldValue);

            } else if (fieldSchema.type === 'enum') {
                if (fieldSchema.options?.includes(String(fieldValue))) {
                    sanitizedConfig[fieldName] = fieldValue;
                } else {
                    warnings.push(`${key}.${fieldName} 值 "${fieldValue}" 不在允许列表中，使用默认值`);
                    sanitizedConfig[fieldName] = fieldSchema.default ?? fieldSchema.options?.[0];
                }

            } else if (fieldSchema.type === 'color') {
                // 简单颜色格式验证
                const colorValue = String(fieldValue);
                if (/^#[0-9a-fA-F]{6}$/.test(colorValue)) {
                    sanitizedConfig[fieldName] = colorValue;
                } else {
                    warnings.push(`${key}.${fieldName} 不是有效的十六进制颜色，使用默认值`);
                    sanitizedConfig[fieldName] = fieldSchema.default ?? '#ffffff';
                }

            } else {
                sanitizedConfig[fieldName] = fieldValue;
            }
        }

        (sanitized as any)[key] = sanitizedConfig;
    }

    // 3. 检查是否有至少一个有效配置
    const hasAnyConfig = Object.keys(sanitized).some(k => k !== 'name');
    if (!hasAnyConfig && !sanitized.name) {
        errors.push('没有找到任何有效的效果配置');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitized: errors.length === 0 ? sanitized : null
    };
}

/**
 * 生成重试提示词 (用于 AutoFix)
 */
export function generateRetryPrompt(originalPrompt: string, errors: string[], warnings: string[]): string {
    let retryHint = '请修正以下问题后重新生成:\n';

    if (errors.length > 0) {
        retryHint += '\n**错误:**\n';
        errors.forEach(e => retryHint += `- ${e}\n`);
    }

    if (warnings.length > 0) {
        retryHint += '\n**警告:**\n';
        warnings.forEach(w => retryHint += `- ${w}\n`);
    }

    return `${originalPrompt}\n\n[系统提示] ${retryHint}`;
}
