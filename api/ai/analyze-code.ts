/**
 * XingForge AI - Code Parameter Analysis API
 * 
 * input: POST { code: string }
 * output: { params: EditableParam[] }
 * pos: 使用 Gemini 2.0 Flash 分析 AI 生成的代码，提取可编辑参数
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};

// 参数分析提示词
const ANALYZE_PROMPT = `分析以下 Three.js 代码，提取所有可以被用户调整的参数。

要求：
1. 识别数值常量（如 const count = 1000, const size = 50）
2. 识别颜色值（如 0xff0000 或 "#ff0000" 或 new THREE.Color(0x...)）
3. 识别布尔值开关
4. 忽略临时变量、循环变量、数组索引
5. 为每个参数推断合理的 min/max/step 范围

重要排除规则（必须遵守）：
- 排除所有与全局后处理效果相关的变量：bloom、bloomStrength、bloomRadius、bloomThreshold、fog、fogEnabled、fogColor、fogDensity
- 排除任何调用 setBloom() 或 setFog() 相关的参数
- 只提取与当前3D对象本身相关的参数（如尺寸、颜色、数量、速度等）

返回 JSON 数组格式，每个元素包含：
{
  "name": "中文参数名称",
  "varName": "代码中的变量名",
  "type": "number" | "color" | "boolean",
  "value": 当前值,
  "min": 最小值(仅number),
  "max": 最大值(仅number),
  "step": 步长(仅number)
}

只返回 JSON 数组，不要任何其他文字。如果没有可提取的参数，返回空数组 []。

代码：
\`\`\`javascript
CODE_PLACEHOLDER
\`\`\``;

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

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required', params: [] });
    }

    try {
        // 使用 Claude Sonnet 分析（通过 chat proxy）
        const baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
        const apiKey = process.env.JIMIAI_API_KEY_CLAUDE;

        if (!apiKey) {
            console.error('[analyze-code] Missing Claude API Key');
            return res.status(500).json({ error: 'AI Config Missing', params: [] });
        }

        const prompt = ANALYZE_PROMPT.replace('CODE_PLACEHOLDER', code);

        const payload = {
            model: 'claude-sonnet-4-5-20250929',
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            stream: false
        };

        console.log('[analyze-code] Analyzing code...');

        const proxyRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!proxyRes.ok) {
            const errorText = await proxyRes.text();
            console.error('[analyze-code] API Error:', proxyRes.status, errorText);
            return res.status(200).json({ params: [], error: 'Analysis failed' });
        }

        const data = await proxyRes.json();
        const text = data.choices?.[0]?.message?.content || '[]';

        // 提取 JSON 数组
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        let params: any[] = [];

        if (jsonMatch) {
            try {
                params = JSON.parse(jsonMatch[0]);
                console.log(`[analyze-code] Extracted ${params.length} parameters`);
            } catch (e) {
                console.error('[analyze-code] JSON parse error:', e);
                params = [];
            }
        }

        // 验证和清理参数
        params = params.filter(p =>
            p.name &&
            p.varName &&
            ['number', 'color', 'boolean'].includes(p.type) &&
            p.value !== undefined
        );

        return res.status(200).json({ params });

    } catch (error: any) {
        console.error('[analyze-code] Error:', error);
        return res.status(200).json({ params: [], error: error.message });
    }
}
