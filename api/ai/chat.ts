/**
 * XingForge AI - Chat API Endpoint
 * 
 * input: POST { messages, systemPrompt, model }
 * output: { content: string }
 * pos: 后端 API 端点，使用 modelConfig.ts 路由
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getProxyConfig, DEFAULT_CHAT_MODEL } from '../../utils/ai/modelConfig';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

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

    // 使用统一路由
    const targetModel = model || DEFAULT_CHAT_MODEL;
    const { baseUrl, apiKey } = getProxyConfig(targetModel);

    if (!apiKey) {
        console.error('Missing API Key for model:', targetModel);
        return res.status(500).json({ error: 'Server AI Configuration Missing' });
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
            throw new Error(`Proxy API Error: ${proxyRes.status}`);
        }

        const data = await proxyRes.json();
        const aiContent = data.choices?.[0]?.message?.content || '';

        return res.status(200).json({ content: aiContent });

    } catch (error: any) {
        console.error('AI Request Failed:', error);
        return res.status(500).json({ error: error.message || 'AI Processing Failed' });
    }
}
