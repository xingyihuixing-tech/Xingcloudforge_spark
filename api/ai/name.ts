/**
 * XingForge AI - Image Naming API
 * 
 * input: POST { imageUrl, subMode }
 * output: { name: string }
 * pos: AI 为生成的图片命名
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const NAME_PROMPTS: Record<string, string> = {
    particleShape: `请为这个粒子贴图起一个简短的中文名称（2-4个字），体现其视觉特征。
只输出名称，不要任何解释。`,

    background: `请为这张星空背景图起一个简短的中文名称（2-4个字），体现其氛围。
只输出名称，不要任何解释。`,

    magicCircle: `请为这张图片起一个简短的中文名称（2-6个字），体现其主题。
格式: XingSpark [名称]
只输出完整名称，不要任何解释。`
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

    const { imageUrl, subMode } = req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    const systemPrompt = NAME_PROMPTS[subMode] || NAME_PROMPTS.magicCircle;

    const baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
    const apiKey = process.env.CHAT_API_KEY;

    if (!apiKey) {
        // 如果没有 API key，返回默认名称
        const defaultNames: Record<string, string> = {
            particleShape: '星光',
            background: '深空',
            magicCircle: 'XingSpark 1'
        };
        return res.status(200).json({ name: defaultNames[subMode] || 'AI生成' });
    }

    try {
        const payload = {
            model: 'claude-haiku-4-5-20251001',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: imageUrl }
                        },
                        {
                            type: 'text',
                            text: '请为这张图片命名'
                        }
                    ]
                }
            ],
            temperature: 0.8,
            stream: false,
            max_tokens: 50
        };

        const proxyRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!proxyRes.ok) {
            console.error('Name API Error:', proxyRes.status);
            return res.status(200).json({ name: subMode === 'magicCircle' ? 'XingSpark' : 'AI生成' });
        }

        const data = await proxyRes.json();
        let name = data.choices?.[0]?.message?.content?.trim() || 'AI生成';

        // 清理名称
        name = name.replace(/["""'']/g, '').trim();
        if (name.length > 20) {
            name = name.slice(0, 20);
        }

        return res.status(200).json({ name });

    } catch (error: any) {
        console.error('Name API Failed:', error);
        return res.status(200).json({ name: 'AI生成' });
    }
}
