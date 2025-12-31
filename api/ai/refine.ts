/**
 * XingForge AI - Prompt Refine API (Multimodal)
 * 
 * input: POST { prompt, mode, subMode, imageBase64? }
 * output: { refined: string }
 * pos: AI 润色用户提示词，支持图片分析
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

// 润色系统提示词 (宽泛版本)
const REFINE_PROMPTS: Record<string, string> = {
    // 粒子形状
    inspiration_particleShape: `请润色以下用于生成粒子贴图的描述，使其更加详细和适合AI绘图。
直接输出润色后的中文描述，不要添加任何解释或前缀。`,

    // 背景图
    inspiration_background: `请润色以下用于生成星空背景的描述，使其更加详细和适合AI绘图。
直接输出润色后的中文描述，不要添加任何解释或前缀。`,

    // 法阵图 (宽泛，不限主题)
    inspiration_magicCircle: `请润色以下用于生成图像的描述，使其更加详细和适合AI绘图。
直接输出润色后的中文描述，不要添加任何解释或前缀。`,

    // 创造模式
    creator: `请润色以下用于创建星球特效的描述，扩展为详细的视觉效果描述。
直接输出润色后的中文描述，不要添加任何解释或前缀。`,

    // 修改模式
    modifier: `请润色以下用于修改星球配置的描述，明确指出需要调整的参数方向。
直接输出润色后的中文描述，不要添加任何解释或前缀。`
};

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

    const { prompt, mode, subMode, imageBase64 } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 确定系统提示词
    let systemPromptKey = mode;
    if (mode === 'inspiration' && subMode) {
        systemPromptKey = `inspiration_${subMode}`;
    }

    const baseSystemPrompt = REFINE_PROMPTS[systemPromptKey] || REFINE_PROMPTS.creator;

    // 如果有图片，添加图片分析指令
    const systemPrompt = imageBase64
        ? `${baseSystemPrompt}\n\n用户上传了一张参考图片，请分析图片特征并融入你的润色描述中。`
        : baseSystemPrompt;

    // 使用对话模型
    const baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
    const apiKey = process.env.CHAT_API_KEY;

    if (!apiKey) {
        console.error('Missing CHAT_API_KEY');
        return res.status(500).json({ error: 'AI Config Missing' });
    }

    try {
        // 构建消息 (支持多模态)
        let userContent: any;

        if (imageBase64) {
            // 多模态消息
            userContent = [
                {
                    type: 'image_url',
                    image_url: {
                        url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
                    }
                },
                {
                    type: 'text',
                    text: `用户描述: ${prompt}`
                }
            ];
        } else {
            userContent = `用户描述: ${prompt}`;
        }

        const payload = {
            model: 'claude-haiku-4-5-20251001',  // 快速模型
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.7,
            stream: false,
            max_tokens: 500
        };

        console.log(`[Refine] Mode: ${mode}, SubMode: ${subMode}, HasImage: ${!!imageBase64}`);

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
            console.error('Refine Error:', proxyRes.status, errorText);
            return res.status(500).json({ error: `Refine Error: ${proxyRes.status}` });
        }

        const data = await proxyRes.json();
        let refined = data.choices?.[0]?.message?.content || prompt;

        // 清理结果，只保留纯净的中文描述
        refined = refined.trim();
        // 移除可能的引号
        if ((refined.startsWith('"') && refined.endsWith('"')) ||
            (refined.startsWith('「') && refined.endsWith('」'))) {
            refined = refined.slice(1, -1);
        }

        return res.status(200).json({ refined });

    } catch (error: any) {
        console.error('Refine Failed:', error);
        return res.status(500).json({ error: error.message });
    }
}
