/**
 * XingForge AI - Chat API Endpoint
 * 
 * input: POST { messages, systemPrompt, model }
 * output: { content: string }
 * pos: 后端 API 端点
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

// 内联模型分组 (双 Key 路由)
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
    'gemini-3-pro-image-preview-flatfee',
    'gemini-3-pro-preview-thinking'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { messages, systemPrompt, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    // 确定代理和 API Key
    const targetModel = model || 'claude-sonnet-4-5-20250929';

    let baseUrl: string;
    let apiKey: string | undefined;

    if (XUAI_MODELS.includes(targetModel)) {
        baseUrl = process.env.IMAGE_PROXY_BASE_URL || 'https://api.xuai.chat/v1';
        apiKey = process.env.IMAGE_API_KEY;
    } else if (GEMINI_CHAT_MODELS.includes(targetModel)) {
        baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
        apiKey = process.env.JIMIAI_API_KEY_GEMINI;
    } else {
        // 默认 Claude 系列
        baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
        apiKey = process.env.JIMIAI_API_KEY_CLAUDE;
    }

    if (!apiKey) {
        console.error('Missing API Key for model:', targetModel);
        return res.status(500).json({ error: 'Server AI Configuration Missing - Check Vercel Environment Variables' });
    }

    try {
        const apiMessages = [...messages];
        if (systemPrompt) {
            apiMessages.unshift({ role: 'system', content: systemPrompt });
        }

        const payload = {
            model: targetModel,
            messages: apiMessages,
            temperature: 0.7,
            stream: false,
            max_tokens: 8000
        };

        console.log(`[AI Chat] Model: ${targetModel}, Proxy: ${baseUrl}`);

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
            console.error('Proxy Error:', proxyRes.status, errorText);
            return res.status(500).json({ error: `Proxy API Error: ${proxyRes.status} - ${errorText.slice(0, 200)}` });
        }

        const data = await proxyRes.json();
        const aiContent = data.choices?.[0]?.message?.content || '';

        return res.status(200).json({ content: aiContent });

    } catch (error: any) {
        console.error('AI Request Failed:', error);
        return res.status(500).json({ error: error.message || 'AI Processing Failed' });
    }
}
