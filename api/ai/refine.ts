/**
 * XingForge AI - Prompt Refine API Endpoint
 * 
 * input: POST { prompt, mode, subMode }
 * output: { refined: string }
 * pos: 后端 API 端点，使用 AI 润色用户提示词
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// 润色系统提示词
const REFINE_SYSTEM_PROMPTS: Record<string, string> = {
    inspiration_background: `你是一个专业的 AI 绘画提示词优化专家。用户会给你一个简单的背景图描述，你需要将其扩展为详细的英文提示词。
要求：
- 输出纯英文，适合 AI 绘图
- 描述宇宙/星空主题
- 包含色彩、氛围、构图细节
- 16:9 横向构图 (1920x1080)
- 无文字、无水印
- 只输出润色后的提示词，不要有任何解释`,

    inspiration_particleShape: `你是一个专业的 AI 绘画提示词优化专家。用户会给你一个粒子形状描述，你需要将其扩展为详细的英文提示词。
要求：
- 输出纯英文，适合 AI 绘图
- 纯黑背景 (#000000)
- 白色或浅色发光图案
- 256x256 像素，正方形
- 简洁几何形状，边缘清晰
- 只输出润色后的提示词，不要有任何解释`,

    inspiration_magicCircle: `你是一个专业的 AI 绘画提示词优化专家。用户会给你一个法阵描述，你需要将其扩展为详细的英文提示词。
要求：
- 输出纯英文，适合 AI 绘图
- 纯黑背景 (#000000)
- 发光线条效果 (霓虹/能量风格)
- 严格中心对称的几何结构
- 512x512 像素，正方形，支持透明
- 复杂精细的符文/几何细节
- 只输出润色后的提示词，不要有任何解释`,

    creator: `你是一个专业的星球特效配置专家。用户会给你一个星球描述，你需要将其扩展为详细的配置需求描述。
要求：
- 输出中文
- 描述星球的视觉效果、颜色、氛围
- 建议使用哪些效果模块（粒子核心、实体核心、能量罩、螺旋环、粒子环、环带等）
- 描述每个效果的大致参数方向
- 只输出润色后的描述，不要有任何解释`,

    modifier: `你是一个专业的星球特效配置专家。用户会给你一个修改需求，你需要将其扩展为详细的修改描述。
要求：
- 输出中文
- 明确指出需要修改哪些参数
- 描述修改的方向和程度
- 只输出润色后的描述，不要有任何解释`
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

    const { prompt, mode, subMode } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 确定系统提示词
    let systemPromptKey = mode;
    if (mode === 'inspiration' && subMode) {
        systemPromptKey = `inspiration_${subMode}`;
    }

    const systemPrompt = REFINE_SYSTEM_PROMPTS[systemPromptKey] || REFINE_SYSTEM_PROMPTS.creator;

    // 使用快速模型
    const baseUrl = process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1';
    const apiKey = process.env.CHAT_API_KEY;

    if (!apiKey) {
        console.error('Missing CHAT_API_KEY');
        return res.status(500).json({ error: 'AI Config Missing' });
    }

    try {
        const payload = {
            model: 'claude-haiku-4-5-20251001',  // 使用快速模型
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            stream: false,
            max_tokens: 500
        };

        console.log(`[Refine] Mode: ${mode}, SubMode: ${subMode}`);

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
        const refined = data.choices?.[0]?.message?.content || prompt;

        return res.status(200).json({ refined: refined.trim() });

    } catch (error: any) {
        console.error('Refine Failed:', error);
        return res.status(500).json({ error: error.message });
    }
}
