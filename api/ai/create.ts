/**
 * AI 创造系统 - 配置生成 API
 * 
 * input: POST { selectedModules, modes?, description, baseConfig? }
 * output: { success, config, warnings, errors }
 * pos: 接收用户选择，调用 Claude 生成配置，验证并应用
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EffectType } from '../../utils/ai/schemaBuilder';
import { buildKnowledgeSnippet } from '../../utils/ai/kbBuilder';
import { validateAndNormalize, parseAIOutput, generateErrorFixPrompt, AIOutput } from '../../utils/ai/configValidator';
// 内联模型分组 (双 Key 路由 - 不依赖 modelConfig.ts，避免 Vercel 模块解析问题)
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

// 内联代理配置函数
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
    // 默认 Claude 系列
    return {
        baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
        apiKey: process.env.JIMIAI_API_KEY_CLAUDE || ''
    };
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};

// 最大回修次数
const MAX_FIX_ROUNDS = 2;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const {
        selectedModules,
        modes = {},
        description,
        model
    } = req.body;

    // 参数验证
    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
        return res.status(400).json({ error: 'selectedModules is required and must be a non-empty array' });
    }

    if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: 'description is required' });
    }

    // 验证模块类型
    const validModules = selectedModules.filter((m: string) =>
        ['particleCore', 'solidCore', 'energyCore', 'energyBody', 'particleRing',
            'ringBelt', 'spiralRing', 'particleOrbit', 'particleJet',
            'rotatingFirefly', 'wanderingFirefly'].includes(m)
    ) as EffectType[];

    if (validModules.length === 0) {
        return res.status(400).json({ error: 'No valid modules selected' });
    }

    // 使用 modelConfig 获取正确的代理配置
    const targetModel = model || DEFAULT_CHAT_MODEL;
    const proxyConfig = getProxyConfig(targetModel);

    if (!proxyConfig.apiKey) {
        console.error('Missing API Key for model:', targetModel);
        return res.status(500).json({ error: 'API Config Missing' });
    }

    try {
        // 1. 构建 KB
        const kb = buildKnowledgeSnippet({
            selectedModules: validModules,
            modes,
            includeExamples: true,
            includeRules: true,
            compact: false
        });

        // 2. 构建 system prompt
        const systemPrompt = `你是一个星球效果配置专家。

${kb}

请仔细阅读上述规格，根据用户描述生成合理的配置。只输出 JSON，不要添加任何解释。`;

        // 3. 第一次调用
        let aiOutput = await callClaude(proxyConfig.baseUrl, proxyConfig.apiKey, targetModel, systemPrompt, description);

        if (!aiOutput) {
            return res.status(500).json({ error: 'AI 返回内容无法解析为 JSON' });
        }

        // 4. 验证并归一化
        let validation = validateAndNormalize(aiOutput, validModules);

        // 5. 回修循环（如有结构性错误）
        let fixRound = 0;
        while (validation.errors.length > 0 && fixRound < MAX_FIX_ROUNDS) {
            fixRound++;
            console.log(`[Create] Fix round ${fixRound}, errors:`, validation.errors);

            // 回修时保留原始描述
            const fixPrompt = `原始需求: ${description}

${generateErrorFixPrompt(validation.errors)}`;
            aiOutput = await callClaude(proxyConfig.baseUrl, proxyConfig.apiKey, targetModel, systemPrompt, fixPrompt);

            if (!aiOutput) {
                break;
            }

            validation = validateAndNormalize(aiOutput, validModules);
        }

        // 6. 返回结果
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
        return res.status(500).json({
            error: error.message || 'Internal Server Error'
        });
    }
}

/**
 * 调用 Claude API
 */
async function callClaude(
    baseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<AIOutput | null> {
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

    if (!content) {
        console.error('[Create] Empty response from AI');
        return null;
    }

    console.log('[Create] AI Response:', content.substring(0, 200) + '...');

    return parseAIOutput(content);
}
