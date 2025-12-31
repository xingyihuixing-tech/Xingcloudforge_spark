/**
 * XingForge AI - Image Generation API Endpoint
 * 
 * input: POST { prompt, model, subMode }
 * output: { url: string, raw: string }
 * pos: 后端 API 端点，使用 modelConfig.ts 路由 + 校验生图模型
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getProxyConfig, isImageModel, DEFAULT_IMAGE_MODEL } from '../../utils/ai/modelConfig';

// 子模式提示词模板
const SUB_MODE_PROMPTS: Record<string, (prompt: string) => string> = {
    particleShape: (prompt: string) =>
        `Generate a particle texture image: ${prompt}. Style: pure black background (#000000), white/light glowing pattern, 256x256 pixels, square PNG, clean geometric shape, sharp edges, suitable for particle system sprite.`,

    background: (prompt: string) =>
        `Generate a cosmic background: ${prompt}. Style: 16:9 landscape (1920x1080), deep space theme, no text/watermarks, high resolution, rich but comfortable colors, stars/nebula/galaxies.`,

    magicCircle: (prompt: string) =>
        `Generate a magic circle pattern: ${prompt}. Style: pure black background (#000000), glowing neon/energy lines, strictly center-symmetric geometric structure, 512x512 pixels, square PNG with transparency, intricate runes and geometric details.`,

    default: (prompt: string) =>
        `Generate an image: ${prompt}`
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

    const { prompt, model, subMode } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 校验模型能力
    const targetModel = model || DEFAULT_IMAGE_MODEL;
    if (!isImageModel(targetModel)) {
        return res.status(400).json({
            error: `Model ${targetModel} does not support image generation`
        });
    }

    const { baseUrl, apiKey } = getProxyConfig(targetModel);

    if (!apiKey) {
        return res.status(500).json({ error: 'Image Config Missing' });
    }

    try {
        const promptBuilder = SUB_MODE_PROMPTS[subMode] || SUB_MODE_PROMPTS.default;
        const finalPrompt = promptBuilder(prompt);

        console.log(`[Image Gen] Model: ${targetModel}, SubMode: ${subMode || 'default'}`);

        const payload = {
            model: targetModel,
            messages: [
                { role: 'user', content: finalPrompt }
            ],
            stream: false
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
            const errorText = await proxyRes.text();
            console.error('Image API Error:', proxyRes.status, errorText);
            throw new Error(`Image API Error: ${proxyRes.status}`);
        }

        const data = await proxyRes.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取 URL
        const urlMatch = content.match(/https?:\/\/[^\s\)]+/);

        if (urlMatch) {
            let cleanUrl = urlMatch[0];
            if (cleanUrl.endsWith(')') || cleanUrl.endsWith(']')) {
                cleanUrl = cleanUrl.slice(0, -1);
            }
            return res.status(200).json({ url: cleanUrl, raw: content });
        } else {
            return res.status(200).json({ error: 'No image URL found', raw: content });
        }

    } catch (error: any) {
        console.error('Image Gen Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
