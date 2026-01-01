/**
 * XingForge AI - Image Generation API (Multimodal)
 * 
 * input: POST { prompt, model, subMode, imageBase64? }
 * output: { url: string, raw: string }
 * pos: 后端 API 端点，支持参考图片
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

// 子模式生成提示词
const SUB_MODE_PROMPTS = {
    particleShape: {
        noImage: (prompt: string) =>
            `Generate a particle sprite texture: ${prompt}. Requirements: Pure black background (#000000), white/light glowing pattern, 1:1 square aspect ratio (256x256 pixels), soft glow edges, suitable for particle system.`,
        withImage: (prompt: string) =>
            `Based on the reference image and user description, generate a particle sprite texture: ${prompt}. Requirements: Pure black background (#000000), extract main shape and apply white/light glow effect, 1:1 square aspect ratio (256x256 pixels).`
    },

    background: {
        noImage: (prompt: string) =>
            `Generate an HDR equirectangular panorama: ${prompt}. Requirements: 2:1 aspect ratio (2048x1024), deep space cosmic theme, no text or watermarks, suitable for 360 degree skybox.`,
        withImage: (prompt: string) =>
            `Transform the reference image into an HDR equirectangular panorama: ${prompt}. Requirements: 2:1 aspect ratio, extend scene for 360 degree coverage, maintain original color palette and mood.`
    },

    magicCircle: {
        noImage: (prompt: string) =>
            `Generate an image: ${prompt}. Requirements: Pure black background (#000000), 1:1 square aspect ratio (512x512 pixels), centered composition.`,
        withImage: (prompt: string) =>
            `Create an image with the reference as visual center: ${prompt}. Requirements: Pure black background (#000000), 1:1 square aspect ratio (512x512 pixels), centered design incorporating the reference.`
    }
};

// 生图模型
const IMAGE_MODELS = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview-flatfee'
];

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

    const { prompt, model, subMode, imageBase64 } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 校验模型
    const targetModel = model || 'gemini-3-pro-image-preview';
    if (!IMAGE_MODELS.includes(targetModel)) {
        return res.status(400).json({
            error: `Model ${targetModel} does not support image generation. Use: ${IMAGE_MODELS.join(', ')}`
        });
    }

    // 直接访问环境变量
    const baseUrl = process.env.IMAGE_PROXY_BASE_URL || 'https://api.xuai.chat/v1';
    const apiKey = process.env.IMAGE_API_KEY;

    if (!apiKey) {
        console.error('Missing IMAGE_API_KEY');
        return res.status(500).json({ error: 'Image API Config Missing' });
    }

    try {
        // 获取提示词模板
        const templates = SUB_MODE_PROMPTS[subMode as keyof typeof SUB_MODE_PROMPTS] || SUB_MODE_PROMPTS.magicCircle;
        const hasImage = !!imageBase64;
        const finalPrompt = hasImage ? templates.withImage(prompt) : templates.noImage(prompt);

        console.log(`[Image Gen] Model: ${targetModel}, SubMode: ${subMode}, HasImage: ${hasImage}, AspectRatio: ${subMode === 'background' ? '16:9' : '1:1'}`);

        // 构建消息内容
        let messageContent: any;

        if (hasImage) {
            // 多模态消息
            messageContent = [
                {
                    type: 'image_url',
                    image_url: {
                        url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
                    }
                },
                {
                    type: 'text',
                    text: finalPrompt
                }
            ];
        } else {
            messageContent = finalPrompt;
        }

        // 根据子模式设置宽高比
        const aspectRatioConfig: Record<string, { aspectRatio: string; imageSize?: string }> = {
            particleShape: { aspectRatio: '1:1' },
            background: { aspectRatio: '16:9', imageSize: '2K' }, // 全景图用宽屏，高分辨率
            magicCircle: { aspectRatio: '1:1' }
        };
        const imageConfig = aspectRatioConfig[subMode as string] || aspectRatioConfig.magicCircle;

        const payload = {
            model: targetModel,
            messages: [
                { role: 'user', content: messageContent }
            ],
            stream: false,
            ...imageConfig // 添加 aspectRatio 和可选的 imageSize
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
            return res.status(500).json({ error: `Image API Error: ${proxyRes.status} - ${errorText.slice(0, 200)}` });
        }

        const data = await proxyRes.json();
        const content = data.choices?.[0]?.message?.content || '';

        // 提取 URL
        const urlMatch = content.match(/https?:\/\/[^\s\)\]"']+/);

        if (urlMatch) {
            let cleanUrl = urlMatch[0];
            // 清理尾部标点
            while (cleanUrl.match(/[\)\]\.,;:'"]+$/)) {
                cleanUrl = cleanUrl.replace(/[\)\]\.,;:'"]+$/, '');
            }
            return res.status(200).json({ url: cleanUrl, raw: content });
        } else {
            // 检查是否有 base64 图片
            const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
            if (base64Match) {
                return res.status(200).json({ url: base64Match[0], raw: content, isBase64: true });
            }
            return res.status(200).json({ error: 'No image found in response', raw: content });
        }

    } catch (error: any) {
        console.error('Image Gen Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
