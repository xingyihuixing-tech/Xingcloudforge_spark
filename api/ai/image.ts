import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxy API Configuration (Image Provider)
const IMAGE_PROXY_BASE_URL = process.env.IMAGE_PROXY_BASE_URL;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY;
const MODEL_NAME_GEMINI_IMAGE = process.env.MODEL_NAME_GEMINI_IMAGE || 'gemini-3-pro-image-preview';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { prompt } = req.body;

    if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
    }

    if (!IMAGE_PROXY_BASE_URL || !IMAGE_API_KEY) {
        res.status(500).json({ error: 'Image Config Missing' });
        return;
    }

    try {
        console.log('Generating Image with Gemini:', prompt);

        // Gemini Image models in proxies are often triggered via Chat Completions
        const payload = {
            model: req.body.model || MODEL_NAME_GEMINI_IMAGE,
            messages: [
                {
                    role: 'user',
                    content: `Generate an image: ${prompt}`
                }
            ],
            stream: false
        };

        const proxyRes = await fetch(`${IMAGE_PROXY_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${IMAGE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!proxyRes.ok) {
            throw new Error(`Proxy Error: ${await proxyRes.text()}`);
        }

        const data = await proxyRes.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Extract URL from Markdown: ![description](url) or just (url) or raw url
        // Radius regex to find https://...
        const urlMatch = content.match(/https?:\/\/[^\s\)]+/);

        if (urlMatch) {
            // Remove trailing ) or ] if present
            let cleanUrl = urlMatch[0];
            if (cleanUrl.endsWith(')') || cleanUrl.endsWith(']')) {
                cleanUrl = cleanUrl.slice(0, -1);
            }
            return res.status(200).json({ url: cleanUrl, raw: content });
        } else {
            // Sometimes it returns just text if generation fails
            return res.status(200).json({ error: 'No image URL found', raw: content });
        }

    } catch (error: any) {
        console.error('Image Gen Error:', error);
        res.status(500).json({ error: error.message });
    }
}
