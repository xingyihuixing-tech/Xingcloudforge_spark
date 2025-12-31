import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxy API Configuration
const CHAT_PROXY_BASE_URL = process.env.CHAT_PROXY_BASE_URL;
const CHAT_API_KEY = process.env.CHAT_API_KEY;
const MODEL_NAME_CLAUDE = process.env.MODEL_NAME_CLAUDE || 'claude-sonnet-4-5-20250929';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Increased for Image/Vision
        },
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Handling
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Invalid messages format' });
        return;
    }

    if (!CHAT_PROXY_BASE_URL || !CHAT_API_KEY) {
        console.error('Missing Chat Configuration');
        res.status(500).json({ error: 'Server AI Configuration Missing' });
        return;
    }

    // Use model from request (Dynamic) or env default
    const targetModel = req.body.model || MODEL_NAME_CLAUDE;

    try {
        // Prepare messages array (insert system prompt if present)
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

        console.log(`Sending Logic request to: ${CHAT_PROXY_BASE_URL}/chat/completions`, { model: targetModel });

        const proxyRes = await fetch(`${CHAT_PROXY_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHAT_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!proxyRes.ok) {
            const errorText = await proxyRes.text();
            console.error('Proxy Error:', proxyRes.status, errorText);
            throw new Error(`Proxy API Error: ${proxyRes.status} - ${errorText}`);
        }

        const data = await proxyRes.json();
        const aiContent = data.choices?.[0]?.message?.content || '';

        return res.status(200).json({ content: aiContent });

    } catch (error: any) {
        console.error('AI Request Failed:', error);
        return res.status(500).json({ error: error.message || 'AI Processing Failed' });
    }
}
