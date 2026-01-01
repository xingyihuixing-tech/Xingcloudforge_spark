/**
 * XingForge AI - Prompt Refine API (Multimodal)
 * 
 * input: POST { prompt, mode, subMode, imageBase64? }
 * output: { refined: string }
 * pos: AI 润色用户提示词，支持图片分析
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// import { getProxyConfig, DEFAULT_CHAT_MODEL, CHAT_MODELS } from '../../utils/ai/modelConfig'; // 移除这行，避免Vercel路径解析失败

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

// 润色系统提示词 (强化版本 - 严格禁止英文和前缀)
const REFINE_PROMPTS: Record<string, string> = {
    // 粒子形状
    inspiration_particleShape: `你是提示词润色器。严格遵守以下规则：
1. 禁止输出任何英文
2. 禁止添加开头语、解释、评论、前缀
3. 禁止使用Markdown格式
4. 直接以润色内容开头

任务：润色以下用于生成粒子贴图的描述，补充形状、发光、对比度等细节。`,

    // 背景图
    inspiration_background: `你是提示词润色器。严格遵守以下规则：
1. 禁止输出任何英文
2. 禁止添加开头语、解释、评论、前缀
3. 禁止使用Markdown格式
4. 直接以润色内容开头

任务：润色以下用于生成星空全景背景的描述，补充色调、星云、氛围等细节。`,

    // 法阵图 (宽泛，不限主题)
    inspiration_magicCircle: `你是提示词润色器。严格遵守以下规则：
1. 禁止输出任何英文
2. 禁止添加开头语、解释、评论、前缀
3. 禁止使用Markdown格式
4. 直接以润色内容开头

任务：润色以下用于生成图像的描述，补充构图、风格、细节等。`,

    // 创造模式
    creator: `你是提示词润色器。严格遵守以下规则：
1. 禁止输出任何英文
2. 禁止添加开头语、解释、评论、前缀
3. 禁止使用Markdown格式
4. 直接以润色内容开头

任务：润色以下用于创建星球特效的描述，扩展为详细的视觉效果描述。`,

    // 修改模式
    modifier: `你是提示词润色器。严格遵守以下规则：
1. 禁止输出任何英文
2. 禁止添加开头语、解释、评论、前缀
3. 禁止使用Markdown格式
4. 直接以润色内容开头

任务：润色以下用于修改星球配置的描述，明确指出需要调整的参数方向。`
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

    const { prompt, mode, subMode, imageBase64, model } = req.body;

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

    // 内联逻辑：优先使用传入的 model，否则默认 Sonnet
    // 润色功能统一使用 Chat Proxy (Jimiai)，因为它支持所有主流对话模型
    const defaultModel = 'claude-sonnet-4-5-20250929';
    const targetModel = model || defaultModel;

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
            model: targetModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.7,
            stream: false,
            max_tokens: 500
        };

        console.log(`[Refine] Mode: ${mode}, SubMode: ${subMode}, HasImage: ${!!imageBase64}, Model: ${targetModel}`);

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

        // ============ 强化后处理清理 ============
        refined = refined.trim();

        // 1. 移除 Markdown 代码块
        refined = refined.replace(/```[\s\S]*?```/g, '');
        refined = refined.replace(/`([^`]+)`/g, '$1');

        // 2. 移除以英文字母开头的整段（常见如 "I appreciate...", "Here's..."）
        // 保留以中文/数字/标点开头的内容
        const lines = refined.split('\n');
        const cleanedLines = lines.filter((line: string) => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            // 如果行首是英文字母，检测是否整行主要是英文
            if (/^[A-Za-z]/.test(trimmed)) {
                // 如果中文字符少于20%，认为是英文段落，移除
                const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
                if (chineseChars / trimmed.length < 0.2) {
                    return false;
                }
            }
            return true;
        });
        refined = cleanedLines.join('\n').trim();

        // 3. 移除常见中文前缀
        const prefixPatterns = [
            /^(好的[，,。.]?\s*)/,
            /^(以下是[^：:]*[：:]?\s*)/,
            /^(润色后的[^：:]*[：:]?\s*)/,
            /^(润色结果[：:]?\s*)/,
            /^(这是[^：:]*[：:]?\s*)/,
        ];
        for (const pattern of prefixPatterns) {
            refined = refined.replace(pattern, '');
        }

        // 4. 移除首尾引号
        if ((refined.startsWith('"') && refined.endsWith('"')) ||
            (refined.startsWith('「') && refined.endsWith('」')) ||
            (refined.startsWith('"') && refined.endsWith('"'))) {
            refined = refined.slice(1, -1);
        }

        // 5. 最终 trim
        refined = refined.trim();

        return res.status(200).json({ refined });

    } catch (error: any) {
        console.error('Refine Failed:', error);
        return res.status(500).json({ error: error.message });
    }
}
