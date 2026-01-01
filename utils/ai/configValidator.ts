/**
 * AI 创造系统 - 配置验证器
 * 
 * input: AI 输出的 patch JSON
 * output: 归一化后的 patch + warnings + errors
 * pos: 验证参数合法性，自动修复越界/非法值，仅结构错误触发回修
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { EffectType, EFFECT_SCHEMAS, FieldSchema } from './schemaBuilder';
import { applyRuleDefaults } from './moduleRules';

// ============================================
// 类型定义
// ============================================

export interface InstancePatch {
    id: string;
    fields: Record<string, any>;
}

export interface EffectPatch {
    instances: InstancePatch[];
}

export interface AIPatch {
    [effectType: string]: EffectPatch;
}

export interface AIOutput {
    patch: AIPatch;
    assumptions?: string[];
    warnings?: string[];
}

export interface ValidationResult {
    normalizedPatch: AIPatch;   // 自动修复后的 patch
    warnings: string[];          // 警告（已自动修复）
    errors: string[];            // 错误（需要回修）
}

// ============================================
// 主验证函数
// ============================================

/**
 * 验证并归一化 AI 输出的 patch
 */
export function validateAndNormalize(
    output: AIOutput,
    selectedModules: EffectType[]
): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const normalizedPatch: AIPatch = {};

    // 检查 patch 结构
    if (!output.patch || typeof output.patch !== 'object') {
        errors.push('patch 字段缺失或不是对象');
        return { normalizedPatch: {}, warnings, errors };
    }

    for (const [effectType, data] of Object.entries(output.patch)) {
        // 1. 检查模块是否在选择范围内
        if (!selectedModules.includes(effectType as EffectType)) {
            warnings.push(`模块 ${effectType} 未被选择，已忽略`);
            continue;
        }

        // 2. 检查模块是否存在 schema
        const schema = EFFECT_SCHEMAS[effectType as EffectType];
        if (!schema) {
            warnings.push(`未知模块 ${effectType}，已忽略`);
            continue;
        }

        // 3. 检查 instances 结构
        if (!data.instances || !Array.isArray(data.instances)) {
            errors.push(`${effectType}.instances 不是数组`);
            continue;
        }

        // 4. 处理每个实例
        const normalizedInstances: InstancePatch[] = [];

        for (const inst of data.instances) {
            if (!inst.id || typeof inst.id !== 'string') {
                errors.push(`${effectType} 实例缺少有效的 id`);
                continue;
            }

            if (!inst.fields || typeof inst.fields !== 'object') {
                errors.push(`${effectType}.${inst.id}.fields 不是对象`);
                continue;
            }

            // 归一化字段
            const { normalizedFields, fieldWarnings } = normalizeFields(
                effectType as EffectType,
                inst.fields,
                schema.fields
            );

            warnings.push(...fieldWarnings);

            // 应用规则默认值
            applyRuleDefaults(effectType as EffectType, normalizedFields);

            normalizedInstances.push({
                id: inst.id,
                fields: normalizedFields
            });
        }

        if (normalizedInstances.length > 0) {
            normalizedPatch[effectType] = { instances: normalizedInstances };
        }
    }

    return { normalizedPatch, warnings, errors };
}

// ============================================
// 字段归一化
// ============================================

function normalizeFields(
    effectType: EffectType,
    fields: Record<string, any>,
    schema: Record<string, FieldSchema>
): { normalizedFields: Record<string, any>; fieldWarnings: string[] } {
    const normalizedFields: Record<string, any> = {};
    const fieldWarnings: string[] = [];

    for (const [fieldName, value] of Object.entries(fields)) {
        const fieldDef = schema[fieldName];

        // 未知字段：静默忽略
        if (!fieldDef) {
            continue;
        }

        const normalized = normalizeValue(effectType, fieldName, value, fieldDef);

        if (normalized.warning) {
            fieldWarnings.push(normalized.warning);
        }

        normalizedFields[fieldName] = normalized.value;
    }

    return { normalizedFields, fieldWarnings };
}

function normalizeValue(
    effectType: EffectType,
    fieldName: string,
    value: any,
    fieldDef: FieldSchema
): { value: any; warning?: string } {
    const prefix = `${effectType}.${fieldName}`;

    switch (fieldDef.type) {
        case 'number': {
            let num = typeof value === 'number' ? value : parseFloat(value);

            if (isNaN(num)) {
                return {
                    value: fieldDef.default ?? 0,
                    warning: `${prefix}: "${value}" 不是有效数字，使用默认值 ${fieldDef.default}`
                };
            }

            // Clamp 到范围
            const originalNum = num;
            if (fieldDef.min !== undefined && num < fieldDef.min) {
                num = fieldDef.min;
            }
            if (fieldDef.max !== undefined && num > fieldDef.max) {
                num = fieldDef.max;
            }

            if (num !== originalNum) {
                return {
                    value: num,
                    warning: `${prefix}: ${originalNum} 超出范围 [${fieldDef.min}, ${fieldDef.max}]，已限制为 ${num}`
                };
            }

            return { value: num };
        }

        case 'boolean':
            return { value: Boolean(value) };

        case 'enum': {
            if (fieldDef.options?.includes(value)) {
                return { value };
            }

            // 非法枚举值：使用默认值，降级为 warning
            return {
                value: fieldDef.default ?? fieldDef.options?.[0] ?? value,
                warning: `${prefix}: "${value}" 不是有效选项 [${fieldDef.options?.join(', ')}]，使用默认值`
            };
        }

        case 'color': {
            // 验证 hex 格式
            if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                return { value };
            }

            // 尝试修复常见错误格式
            if (/^[0-9a-fA-F]{6}$/.test(value)) {
                return { value: '#' + value };
            }

            return {
                value: fieldDef.default ?? '#ffffff',
                warning: `${prefix}: "${value}" 不是有效颜色格式，使用默认值`
            };
        }

        case 'string':
            return { value: String(value) };

        default:
            return { value };
    }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 生成错误修复提示（用于回修请求）
 */
export function generateErrorFixPrompt(errors: string[]): string {
    return `你的输出有以下结构性错误，请修正：

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

请重新输出完整的 JSON，确保：
- patch 是对象
- 每个模块的 instances 是数组
- 每个实例有 id (字符串) 和 fields (对象)`;
}

/**
 * 解析 AI 输出的 JSON
 */
export function parseAIOutput(text: string): AIOutput | null {
    try {
        // 尝试直接解析
        return JSON.parse(text);
    } catch {
        // 尝试提取 JSON 块
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch {
                return null;
            }
        }

        // 尝试提取大括号内容
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            try {
                return JSON.parse(braceMatch[0]);
            } catch {
                return null;
            }
        }

        return null;
    }
}
