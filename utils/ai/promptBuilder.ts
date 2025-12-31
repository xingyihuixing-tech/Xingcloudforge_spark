/**
 * XingForge AI - Prompt Builder
 * 
 * input: 模式 (mode) + 用户选择 (selection) + 上下文 (context)
 * output: 完整的 System Prompt + User Prompt
 * pos: 构建发送给 AI 的最终提示词
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { buildSchemaFromSelection, ScopeSelection, EffectType, EFFECT_INFO } from './schemaBuilder';

export type AIMode = 'inspiration' | 'creator' | 'modifier';

// ============================================
// System Prompt 模板
// ============================================

const BASE_ROLE = `你是 XingForge AI，一个专业的 3D 星球场景配置生成器。你的任务是根据用户描述生成符合约束的 JSON 配置。`;

const OUTPUT_RULES = `
## 输出规则
1. 只返回纯 JSON，不要包含 markdown 代码块
2. 不要添加任何解释或注释
3. 所有数值必须严格遵守 min/max 范围
4. 枚举值必须使用指定的选项
5. 颜色使用 HEX 格式 (如 #ff6600)
`;

const NAMING_RULE = `
## 命名规则
为每个新创建的效果实例生成一个富有想象力的中文名称，放在 "name" 字段。
例如: "熔岩巨人", "冰霜卫星", "极光漩涡"
`;

const MODIFIER_RULES = `
## 修改规则
1. 只修改用户指定的部分，其他字段保持原值
2. 不要修改 id 和 name 字段
3. 返回增量 Patch 对象，只包含需要修改的字段
`;

// ============================================
// Prompt 构建函数
// ============================================

export interface PromptContext {
    mode: AIMode;
    selection?: ScopeSelection;
    currentConfig?: any;        // 修改模式：当前配置
    targetPlanetId?: string;    // 修改模式：目标星球ID
    isSceneMode?: boolean;      // 创建模式：是否场景模式（多星球）
    planetCount?: number;       // 创建模式：星球数量
}

/**
 * 构建 System Prompt
 */
export function buildSystemPrompt(context: PromptContext): string {
    const { mode, selection } = context;

    let systemPrompt = BASE_ROLE + '\n';

    if (mode === 'creator') {
        // 创建模式
        if (context.isSceneMode) {
            systemPrompt += `\n## 任务\n创建一个包含 ${context.planetCount || 3} 个星球的场景配置。每个星球需要独立的参数和公转设置。\n`;
        } else {
            systemPrompt += `\n## 任务\n创建一个单独的星球配置。\n`;
        }

        if (selection) {
            const schema = buildSchemaFromSelection(selection);
            systemPrompt += `\n## 配置范围 (仅生成以下字段)\n${JSON.stringify(schema, null, 2)}\n`;
        }

        systemPrompt += OUTPUT_RULES;
        systemPrompt += NAMING_RULE;

    } else if (mode === 'modifier') {
        // 修改模式
        systemPrompt += `\n## 任务\n修改现有星球配置。目标星球 ID: ${context.targetPlanetId || '未指定'}\n`;

        if (context.currentConfig) {
            systemPrompt += `\n## 当前配置\n${JSON.stringify(context.currentConfig, null, 2)}\n`;
        }

        if (selection) {
            const schema = buildSchemaFromSelection(selection);
            systemPrompt += `\n## 允许修改的范围\n${JSON.stringify(schema, null, 2)}\n`;
        }

        systemPrompt += OUTPUT_RULES;
        systemPrompt += MODIFIER_RULES;

    } else {
        // 灵感模式 - 主要用于图片生成，不需要复杂的 Schema
        systemPrompt += `\n## 任务\n分析用户描述并生成创意内容。\n`;
    }

    return systemPrompt;
}

/**
 * 构建用户请求提示
 */
export function buildUserPrompt(userInput: string, context: PromptContext): string {
    const { mode } = context;

    if (mode === 'modifier' && context.targetPlanetId) {
        return `请修改星球 "${context.targetPlanetId}" 的配置:\n${userInput}`;
    }

    if (mode === 'creator' && context.isSceneMode) {
        return `请创建一个星球场景:\n${userInput}`;
    }

    return userInput;
}

/**
 * 生成简化的范围描述 (用于 UI 显示)
 */
export function generateScopeDescription(selection: ScopeSelection): string {
    const parts: string[] = [];

    for (const [effectType, instances] of Object.entries(selection)) {
        if (!instances || instances.length === 0) continue;

        const info = EFFECT_INFO[effectType as EffectType];
        if (!info) continue;

        const enabledFieldCount = instances.reduce((sum, inst) => {
            return sum + Object.values(inst.fields).filter(f => f.enabled).length;
        }, 0);

        if (enabledFieldCount > 0) {
            parts.push(`${info.icon} ${info.name} (${instances.length}个实例, ${enabledFieldCount}项)`);
        }
    }

    return parts.length > 0 ? parts.join(', ') : '未选择任何范围';
}

// ============================================
// 智能范围推荐
// ============================================

/**
 * 根据用户描述智能推荐配置范围
 */
export function suggestScopeFromDescription(description: string): EffectType[] {
    const suggestions: EffectType[] = [];
    const desc = description.toLowerCase();

    // 关键词匹配
    if (desc.includes('核心') || desc.includes('星球') || desc.includes('行星')) {
        suggestions.push('particleCore');
    }
    if (desc.includes('岩') || desc.includes('熔岩') || desc.includes('岩浆') || desc.includes('固体')) {
        suggestions.push('solidCore');
    }
    if (desc.includes('能量') || desc.includes('几何') || desc.includes('多面体')) {
        suggestions.push('energyBody');
    }
    if (desc.includes('环') || desc.includes('土星')) {
        suggestions.push('particleRing');
        suggestions.push('ringBelt');
    }
    if (desc.includes('螺旋') || desc.includes('漩涡')) {
        suggestions.push('spiralRing');
    }
    if (desc.includes('喷射') || desc.includes('喷发') || desc.includes('爆发')) {
        suggestions.push('particleJet');
    }
    if (desc.includes('流萤') || desc.includes('萤火') || desc.includes('闪烁')) {
        suggestions.push('rotatingFirefly');
        suggestions.push('wanderingFirefly');
    }
    if (desc.includes('环绕') || desc.includes('包围')) {
        suggestions.push('particleOrbit');
    }

    // 如果没有匹配到，返回基础推荐
    if (suggestions.length === 0) {
        suggestions.push('particleCore', 'solidCore');
    }

    return [...new Set(suggestions)]; // 去重
}
