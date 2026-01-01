/**
 * AI 创造系统 - KB 构建器
 * 
 * input: 用户选择的模块、模式配置
 * output: 可注入 system prompt 的 KB 文本片段
 * pos: 按需组装 Spec+Rules+Examples，控制 prompt 长度
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { EffectType, EFFECT_SCHEMAS, EFFECT_INFO, FieldSchema } from './schemaBuilder';
import { generateRulesText } from './moduleRules';
import { generateExamplesText } from './styleExamples';

// ============================================
// 类型定义
// ============================================

export interface KBBuildOptions {
    selectedModules: EffectType[];
    modes?: Record<EffectType, Record<string, any>>;  // 模式选择 e.g., { energyBody: { renderMode: 'wireframe' } }
    includeExamples?: boolean;  // 是否包含风格示例
    includeRules?: boolean;     // 是否包含规则
    compact?: boolean;          // 紧凑模式（减少 token）
}

// ============================================
// KB 构建器
// ============================================

/**
 * 构建 KB 文本片段
 */
export function buildKnowledgeSnippet(options: KBBuildOptions): string {
    const {
        selectedModules,
        modes = {},
        includeExamples = true,
        includeRules = true,
        compact = false
    } = options;

    const sections: string[] = [];

    // 1. 全局说明
    sections.push(`# 星球效果配置规格

你需要为以下效果模块生成配置参数。输出必须是 JSON 格式。`);

    // 2. 输出格式说明
    sections.push(`
## 输出格式

\`\`\`json
{
  "patch": {
    "<effectType>": {
      "instances": [
        { "id": "instance_1", "fields": { "<字段名>": <值> } }
      ]
    }
  },
  "assumptions": ["你做的假设"],
  "warnings": ["潜在问题提示"]
}
\`\`\`
`);

    // 3. 各模块 Spec
    for (const effectType of selectedModules) {
        const schema = EFFECT_SCHEMAS[effectType];
        const info = EFFECT_INFO[effectType];
        if (!schema) continue;

        const modeConfig = modes[effectType] || {};

        sections.push(`---\n## ${info?.icon || '•'} ${schema.name} (${effectType})`);

        // 字段规格表
        if (compact) {
            sections.push(generateCompactSpec(schema.fields));
        } else {
            sections.push(generateFullSpec(schema.fields));
        }

        // 当前模式提示
        if (Object.keys(modeConfig).length > 0) {
            sections.push(`\n### 当前模式设置`);
            for (const [key, value] of Object.entries(modeConfig)) {
                sections.push(`- ${key}: ${value}`);
            }
        }

        // 规则
        if (includeRules) {
            const rulesText = generateRulesText(effectType);
            if (rulesText) {
                sections.push('\n' + rulesText);
            }
        }

        // 示例
        if (includeExamples) {
            const examplesText = generateExamplesText(effectType);
            if (examplesText) {
                sections.push('\n' + examplesText);
            }
        }
    }

    // 4. 通用约束
    sections.push(`
---
## 通用约束

- 颜色使用 6 位 hex 格式，如 \`#ff6600\`
- 数值超出范围会被自动 clamp
- 只配置你选择的模块，不要添加其他模块
- 如果某个字段不确定，使用 default 值或省略
`);

    return sections.join('\n');
}

/**
 * 生成完整字段规格
 */
function generateFullSpec(fields: Record<string, FieldSchema>): string {
    const lines = ['\n### 字段规格\n| 字段 | 类型 | 范围/选项 | 默认值 | 说明 |', '|------|------|----------|--------|------|'];

    for (const [name, field] of Object.entries(fields)) {
        const rangeOrOptions = field.type === 'enum'
            ? (field.options?.join('/') || '-')
            : field.type === 'number'
                ? `${field.min ?? '-'} ~ ${field.max ?? '-'}`
                : '-';

        lines.push(`| ${name} | ${field.type} | ${rangeOrOptions} | ${field.default ?? '-'} | ${field.desc} |`);
    }

    return lines.join('\n');
}

/**
 * 生成紧凑字段规格（减少 token）
 */
function generateCompactSpec(fields: Record<string, FieldSchema>): string {
    const lines = ['\n### 字段'];

    for (const [name, field] of Object.entries(fields)) {
        if (field.type === 'number') {
            lines.push(`- ${name}: ${field.min}-${field.max}, 默认${field.default}`);
        } else if (field.type === 'enum') {
            lines.push(`- ${name}: [${field.options?.join('|')}], 默认${field.default}`);
        } else if (field.type === 'color') {
            lines.push(`- ${name}: hex颜色, 默认${field.default}`);
        } else if (field.type === 'boolean') {
            lines.push(`- ${name}: 布尔, 默认${field.default}`);
        }
    }

    return lines.join('\n');
}

/**
 * 估算 KB token 数量（粗略）
 */
export function estimateTokens(text: string): number {
    // 粗略估算：中文约 2 字符/token，英文约 4 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
}
