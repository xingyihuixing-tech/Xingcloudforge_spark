/**
 * AI 创造系统 - 配置生成 API (完全内联版)
 * 
 * input: POST { selectedModules, modes?, description, model? }
 * output: { success, patch, warnings, errors }
 * pos: 接收用户选择，调用 AI 生成配置，验证并返回
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 * 
 * 注意：所有依赖代码已内联，避免 Vercel Serverless 模块解析问题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================
// 内联模型路由配置 (与 refine.ts 保持一致)
// ============================================

const CLAUDE_MODELS = [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-5-20250929-thinking',
    'claude-haiku-4-5-20251001'
];
const GEMINI_CHAT_MODELS = [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview'
];
const XUAI_MODELS = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-3-pro-preview-thinking',
    'gemini-3-pro-image-preview-flatfee'
];
const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-5-20250929';

function getProxyConfig(modelId: string): { baseUrl: string; apiKey: string } {
    if (XUAI_MODELS.includes(modelId)) {
        return {
            baseUrl: process.env.IMAGE_PROXY_BASE_URL || 'https://api.xuai.chat/v1',
            apiKey: process.env.IMAGE_API_KEY || ''
        };
    }
    if (GEMINI_CHAT_MODELS.includes(modelId)) {
        return {
            baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
            apiKey: process.env.JIMIAI_API_KEY_GEMINI || ''
        };
    }
    return {
        baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
        apiKey: process.env.JIMIAI_API_KEY_CLAUDE || ''
    };
}

// ============================================
// 内联类型定义
// ============================================

type EffectType =
    | 'particleCore' | 'solidCore' | 'energyCore' | 'energyBody'
    | 'particleRing' | 'ringBelt' | 'spiralRing' | 'particleOrbit'
    | 'particleJet' | 'rotatingFirefly' | 'wanderingFirefly';

interface FieldSchema {
    type: 'number' | 'boolean' | 'string' | 'enum' | 'color';
    min?: number;
    max?: number;
    default?: any;
    options?: string[];
    desc: string;
}

interface EffectSchema {
    name: string;
    fields: Record<string, FieldSchema>;
}

// ============================================
// 内联 Schema 定义 (精简版，只包含常用模块)
// ============================================

const EFFECT_INFO: Record<EffectType, { name: string; icon: string }> = {
    particleCore: { name: '粒子核心', icon: '⚪' },
    solidCore: { name: '实体核心', icon: '🔴' },
    energyCore: { name: '能量核', icon: '⚡' },
    energyBody: { name: '能量体', icon: '🔷' },
    particleRing: { name: '粒子环', icon: '⭕' },
    ringBelt: { name: '环带', icon: '🌀' },
    spiralRing: { name: '螺旋环', icon: '🌊' },
    particleOrbit: { name: '粒子环绕', icon: '💫' },
    particleJet: { name: '粒子喷射', icon: '🚀' },
    rotatingFirefly: { name: '旋转流萤', icon: '✨' },
    wanderingFirefly: { name: '游走流萤', icon: '🌟' },
};

const EFFECT_SCHEMAS: Record<EffectType, EffectSchema> = {
    particleCore: {
        name: '粒子核心',
        fields: {
            // 基础几何参数
            'fillMode': { type: 'enum', options: ['shell', 'gradient', 'solid'], default: 'shell', desc: '填充模式：shell=外壳, gradient=渐变填充, solid=实心' },
            'fillPercent': { type: 'number', min: 0, max: 100, default: 0, desc: '填充百分比(0=纯外壳, 100=实心)' },
            'density': { type: 'number', min: 0.1, max: 10, default: 1.5, desc: '粒子密度倍数' },
            'baseRadius': { type: 'number', min: 50, max: 500, default: 100, desc: '核心半径(像素)' },
            'particleSize': { type: 'number', min: 0.5, max: 5, default: 1, desc: '粒子大小' },
            'brightness': { type: 'number', min: 0.1, max: 3, default: 1, desc: '亮度倍数' },
            // 基础颜色（单色模式）
            'baseHue': { type: 'number', min: 0, max: 360, default: 200, desc: '基础色相(0=红,60=黄,120=绿,180=青,240=蓝,300=品红)' },
            'baseSaturation': { type: 'number', min: 0, max: 1, default: 1, desc: '饱和度(0=灰色,1=纯色)' },
            // 渐变色设置
            'gradientColor.enabled': { type: 'boolean', default: false, desc: '是否启用渐变' },
            'gradientColor.mode': { type: 'enum', options: ['none', 'twoColor', 'threeColor', 'procedural'], default: 'twoColor', desc: '渐变模式' },
            'gradientColor.colors.0': { type: 'color', default: '#ff4400', desc: '渐变色1(暗部/起始)' },
            'gradientColor.colors.1': { type: 'color', default: '#ffcc00', desc: '渐变色2(亮部/结束)' },
            'gradientColor.colors.2': { type: 'color', default: '#ffffff', desc: '渐变色3(threeColor模式)' },
            'gradientColor.direction': { type: 'enum', options: ['radial', 'linearX', 'linearY', 'linearZ', 'spiral'], default: 'radial', desc: '渐变方向' },
            // 动态效果
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.3, desc: '自转速度(负值=反向)' },
            'trailLength': { type: 'number', min: 0, max: 2, default: 0, desc: '拖尾长度(0=关闭)' },
        }
    },
    solidCore: {
        name: '实体核心',
        fields: {
            'radius': { type: 'number', min: 10, max: 300, default: 100, desc: '球体半径' },
            'surfaceColor.baseColor': { type: 'color', default: '#ff6600', desc: '表面主色' },
            'emissiveStrength': { type: 'number', min: 0, max: 5, default: 1, desc: '自发光强度' },
            'brightness': { type: 'number', min: 0.5, max: 3, default: 1, desc: '亮度' },
        }
    },
    energyCore: {
        name: '能量核',
        fields: {
            'radius': { type: 'number', min: 50, max: 500, default: 120, desc: '半径' },
            'polyhedronType': { type: 'enum', options: ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'], default: 'icosahedron', desc: '多面体类型' },
            'spherize': { type: 'number', min: 0, max: 1, default: 0, desc: '球化程度' },
            'globalOpacity': { type: 'number', min: 0, max: 1, default: 0.8, desc: '透明度' },
        }
    },
    energyBody: {
        name: '能量体',
        fields: {
            'radius': { type: 'number', min: 50, max: 500, default: 150, desc: '半径' },
            'polyhedronType': { type: 'enum', options: ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'], default: 'icosahedron', desc: '多面体类型' },
            'renderMode': { type: 'enum', options: ['wireframe', 'shell', 'both'], default: 'both', desc: '渲染模式' },
            'edgeEffect.color': { type: 'color', default: '#00ffff', desc: '边线颜色' },
        }
    },
    particleRing: {
        name: '粒子环',
        fields: {
            'absoluteRadius': { type: 'number', min: 50, max: 600, default: 200, desc: '轨道半径' },
            'particleDensity': { type: 'number', min: 0.1, max: 10, default: 2, desc: '粒子密度' },
            'color': { type: 'color', default: '#88aaff', desc: '颜色' },
            'orbitSpeed': { type: 'number', min: -2, max: 2, default: 0.5, desc: '公转速度' },
        }
    },
    ringBelt: {
        name: '环带',
        fields: {
            'absoluteInnerRadius': { type: 'number', min: 50, max: 500, default: 120, desc: '内半径' },
            'absoluteOuterRadius': { type: 'number', min: 60, max: 600, default: 200, desc: '外半径' },
            'color': { type: 'color', default: '#ffaa66', desc: '颜色' },
            'opacity': { type: 'number', min: 0.1, max: 1, default: 0.7, desc: '透明度' },
        }
    },
    spiralRing: {
        name: '螺旋环',
        fields: {
            'spiralCount': { type: 'number', min: 1, max: 6, default: 2, desc: '螺旋条数' },
            'direction': { type: 'enum', options: ['cw', 'ccw', 'both'], default: 'cw', desc: '旋转方向' },
            'baseRadius': { type: 'number', min: 50, max: 300, default: 100, desc: '基础半径' },
            'opacity': { type: 'number', min: 0, max: 1, default: 0.8, desc: '透明度' },
        }
    },
    particleOrbit: {
        name: '粒子环绕',
        fields: {
            'particleDensity': { type: 'number', min: 0.1, max: 5, default: 1, desc: '粒子密度' },
            'orbitRadius': { type: 'number', min: 0.1, max: 5, default: 1.5, desc: '环绕半径(倍R)' },
            'color': { type: 'color', default: '#66ffaa', desc: '颜色' },
            'brightness': { type: 'number', min: 0.1, max: 3, default: 1, desc: '亮度' },
        }
    },
    particleJet: {
        name: '粒子喷射',
        fields: {
            'birthRate': { type: 'number', min: 50, max: 2000, default: 500, desc: '每秒生成数' },
            'initialSpeed': { type: 'number', min: 10, max: 200, default: 80, desc: '初始速度' },
            'color': { type: 'color', default: '#ff8844', desc: '颜色' },
            'brightness': { type: 'number', min: 0.5, max: 3, default: 1.5, desc: '亮度' },
        }
    },
    rotatingFirefly: {
        name: '旋转流萤',
        fields: {
            'absoluteOrbitRadius': { type: 'number', min: 50, max: 500, default: 150, desc: '轨道半径' },
            'size': { type: 'number', min: 1, max: 100, default: 20, desc: '头部大小' },
            'color': { type: 'color', default: '#ffff88', desc: '颜色' },
            'brightness': { type: 'number', min: 0.5, max: 8, default: 2, desc: '亮度' },
        }
    },
    wanderingFirefly: {
        name: '游走流萤',
        fields: {
            'count': { type: 'number', min: 1, max: 50, default: 10, desc: '该组数量' },
            'speed': { type: 'number', min: 0.1, max: 2, default: 0.5, desc: '移动速度' },
            'color': { type: 'color', default: '#88ffff', desc: '颜色' },
            'brightness': { type: 'number', min: 0.5, max: 8, default: 2, desc: '亮度' },
        }
    },
};

// ============================================
// 内联 KB 构建函数 (简化版)
// ============================================

function buildKnowledgeSnippet(selectedModules: EffectType[]): string {
    const sections: string[] = [];

    sections.push(`# 星球效果配置规格

你需要为以下效果模块生成配置参数。输出必须是 JSON 格式。

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

    for (const effectType of selectedModules) {
        const schema = EFFECT_SCHEMAS[effectType];
        const info = EFFECT_INFO[effectType];
        if (!schema) continue;

        sections.push(`---\n## ${info?.icon || '•'} ${schema.name} (${effectType})\n`);
        sections.push(`| 字段 | 类型 | 范围/选项 | 默认值 | 说明 |`);
        sections.push(`|------|------|----------|--------|------|`);

        for (const [name, field] of Object.entries(schema.fields)) {
            const rangeOrOptions = field.type === 'enum'
                ? (field.options?.join('/') || '-')
                : field.type === 'number'
                    ? `${field.min ?? '-'} ~ ${field.max ?? '-'}`
                    : '-';
            sections.push(`| ${name} | ${field.type} | ${rangeOrOptions} | ${field.default ?? '-'} | ${field.desc} |`);
        }
    }

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

// ============================================
// 内联验证函数
// ============================================

interface AIOutput {
    patch: Record<string, { instances: Array<{ id: string; fields: Record<string, any> }> }>;
    assumptions?: string[];
    warnings?: string[];
}

interface ValidationResult {
    normalizedPatch: Record<string, any>;
    warnings: string[];
    errors: string[];
}

function validateAndNormalize(output: AIOutput, selectedModules: EffectType[]): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const normalizedPatch: Record<string, any> = {};

    if (!output.patch || typeof output.patch !== 'object') {
        errors.push('patch 字段缺失或不是对象');
        return { normalizedPatch: {}, warnings, errors };
    }

    for (const [effectType, data] of Object.entries(output.patch)) {
        if (!selectedModules.includes(effectType as EffectType)) {
            warnings.push(`模块 ${effectType} 未被选择，已忽略`);
            continue;
        }

        const schema = EFFECT_SCHEMAS[effectType as EffectType];
        if (!schema) {
            warnings.push(`未知模块 ${effectType}，已忽略`);
            continue;
        }

        if (!data.instances || !Array.isArray(data.instances)) {
            errors.push(`${effectType}.instances 不是数组`);
            continue;
        }

        const normalizedInstances: Array<{ id: string; fields: Record<string, any> }> = [];

        for (const inst of data.instances) {
            if (!inst.id || typeof inst.id !== 'string') {
                errors.push(`${effectType} 实例缺少有效的 id`);
                continue;
            }

            if (!inst.fields || typeof inst.fields !== 'object') {
                errors.push(`${effectType}.${inst.id}.fields 不是对象`);
                continue;
            }

            const normalizedFields: Record<string, any> = {};
            for (const [fieldName, value] of Object.entries(inst.fields)) {
                const fieldDef = schema.fields[fieldName];
                if (!fieldDef) continue;

                // 简单归一化
                if (fieldDef.type === 'number') {
                    let num = typeof value === 'number' ? value : parseFloat(value as string);
                    if (isNaN(num)) num = fieldDef.default ?? 0;
                    if (fieldDef.min !== undefined && num < fieldDef.min) num = fieldDef.min;
                    if (fieldDef.max !== undefined && num > fieldDef.max) num = fieldDef.max;
                    normalizedFields[fieldName] = num;
                } else if (fieldDef.type === 'color') {
                    normalizedFields[fieldName] = /^#[0-9a-fA-F]{6}$/.test(value as string) ? value : fieldDef.default;
                } else if (fieldDef.type === 'enum') {
                    normalizedFields[fieldName] = fieldDef.options?.includes(value as string) ? value : fieldDef.default;
                } else {
                    normalizedFields[fieldName] = value;
                }
            }

            normalizedInstances.push({ id: inst.id, fields: normalizedFields });
        }

        if (normalizedInstances.length > 0) {
            normalizedPatch[effectType] = { instances: normalizedInstances };
        }
    }

    return { normalizedPatch, warnings, errors };
}

function parseAIOutput(text: string): AIOutput | null {
    try {
        return JSON.parse(text);
    } catch {
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try { return JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
        }
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            try { return JSON.parse(braceMatch[0]); } catch { /* ignore */ }
        }
        return null;
    }
}

function generateErrorFixPrompt(errors: string[]): string {
    return `你的输出有以下结构性错误，请修正：

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

请重新输出完整的 JSON，确保：
- patch 是对象
- 每个模块的 instances 是数组
- 每个实例有 id (字符串) 和 fields (对象)`;
}

// ============================================
// API Handler
// ============================================

export const config = {
    api: { bodyParser: { sizeLimit: '1mb' } },
};

const MAX_FIX_ROUNDS = 2;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { selectedModules, modes = {}, description, model } = req.body;

    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
        return res.status(400).json({ error: 'selectedModules is required' });
    }
    if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: 'description is required' });
    }

    const validModules = selectedModules.filter((m: string) =>
        Object.keys(EFFECT_SCHEMAS).includes(m)
    ) as EffectType[];

    if (validModules.length === 0) {
        return res.status(400).json({ error: 'No valid modules selected' });
    }

    // 模型路由 (支持用户切换)
    const targetModel = model || DEFAULT_CHAT_MODEL;
    const proxyConfig = getProxyConfig(targetModel);

    if (!proxyConfig.apiKey) {
        console.error('Missing API Key for model:', targetModel);
        return res.status(500).json({ error: 'API Config Missing' });
    }

    try {
        const kb = buildKnowledgeSnippet(validModules);
        const systemPrompt = `你是一个星球效果配置专家。

${kb}

请仔细阅读上述规格，根据用户描述生成合理的配置。只输出 JSON，不要添加任何解释。`;

        let aiOutput = await callAI(proxyConfig.baseUrl, proxyConfig.apiKey, targetModel, systemPrompt, description);

        if (!aiOutput) {
            return res.status(500).json({ error: 'AI 返回内容无法解析为 JSON' });
        }

        let validation = validateAndNormalize(aiOutput, validModules);
        let fixRound = 0;

        while (validation.errors.length > 0 && fixRound < MAX_FIX_ROUNDS) {
            fixRound++;
            const fixPrompt = `原始需求: ${description}\n\n${generateErrorFixPrompt(validation.errors)}`;
            aiOutput = await callAI(proxyConfig.baseUrl, proxyConfig.apiKey, targetModel, systemPrompt, fixPrompt);
            if (!aiOutput) break;
            validation = validateAndNormalize(aiOutput, validModules);
        }

        if (validation.errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: validation.errors,
                warnings: validation.warnings,
                message: `经过 ${fixRound} 轮修复仍有错误`
            });
        }

        return res.status(200).json({
            success: true,
            patch: validation.normalizedPatch,
            warnings: validation.warnings,
            fixRounds: fixRound
        });

    } catch (error: any) {
        console.error('[Create] Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

async function callAI(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<AIOutput | null> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Create] API Error:', response.status, errorText);
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    console.log('[Create] AI Response:', content.substring(0, 200) + '...');
    return parseAIOutput(content);
}
