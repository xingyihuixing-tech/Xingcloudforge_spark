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

    // 创造模式 (返回代码)
    inspiration_creation: `You are a Three.js expert. Your task is to generate Javascript code to create 3D objects or effects in an existing Three.js scene.

Rules:
1. Output ONLY a valid JavaScript code block (markdown format). No explanations.
2. Variables available in scope:
   - \`scene\`: The THREE.Scene instance.
   - \`THREE\`: The THREE namespace.
   - \`camera\`: The current camera.
   - \`renderer\`: The WebGLRenderer.
   - \`controls\`: The OrbitControls.
3. DO NOT clear the scene. Only \`scene.add()\` new objects.
4. DO NOT define imports.
5. Code must be safe (no infinite loops, no dom manipulation).
6. If creating multiple objects, group them into a \`THREE.Group\` and add the group to the scene.
7. Return the created object(s) at the end if possible, or we will assume the last added object is the target.

Example Input: "Create a red cube"
Example Output:
\`\`\`javascript
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0, 0);
scene.add(cube);
return cube;
\`\`\``,

    /**
     * 创造模式 - 润色 (视觉设计)
     * Role: 3D 视觉概念设计师
     */
    inspiration_creation_refine: `你是一名专业的 3D 视觉概念设计师。你的任务是将用户的简短描述扩展为详细、具体、画面感强的视觉方案描述。

【任务要求】
1. 专注于补充：材质属性（发光、透明度、反射、折射）、颜色变化（渐变、流动色彩）、表面纹理（噪声、裂纹、能量脉络）、光效细节（内发光、边缘光、Bloom辉光）。
2. 描述要具体可实施，让程序员能够据此编写 Three.js 代码。
3. 仅输出润色后的中文描述，不要输出代码，不要输出解释。

【丰富示例】

输入："一个球"
输出："一个半径约 50 的半透明能量球体。表面覆盖缓慢流动的青色与紫色渐变能量脉络，使用 Simplex 噪声生成纹理。核心处有强烈的白色点光源，边缘呈现 Fresnel 效应的淡蓝色光晕。整体带有轻微的脉冲呼吸效果，亮度在 0.8 到 1.2 之间周期性变化。"

输入："星云"
输出："一大片弥漫在空间中的粒子云。使用数千个微小的发光粒子，颜色从深紫色过渡到粉红色再到金橙色。粒子密度不均匀，中心区域较密，边缘逐渐稀疏。粒子带有随机闪烁效果，并且整体云层有缓慢的旋涡式旋转。建议使用 Points 几何体配合自定义着色器实现。"

输入："魔法环"
输出："一个悬浮在空中的圆环形能量结构。环体由无数细小的发光线条交织而成，线条颜色在蓝色和白色之间交替。环的内侧边缘有向内发散的能量射线，外侧有向外扩散的光芒碎片。整个环绕自身中心轴缓慢旋转，同时有微弱的上下浮动。"

输入："裂缝地面"
输出："一块平面，表面呈现深灰色岩石质感，布满发光的能量裂缝。裂缝使用 Voronoi 噪声生成，宽度不一，深处发出炽热的橙红色光芒，边缘过渡到暗红色。裂缝中的亮度随时间脉动，仿佛岩浆在地下流动。平面边缘逐渐透明消失，融入周围空间。"

输入："水晶"
输出："一簇不规则的晶体结构，由多个大小不一的尖锥体组成。材质使用高透明度的玻璃质感，带有内部折射效果和明显的 Fresnel 边缘高光。晶体颜色呈淡蓝青色，某些晶体核心隐约有发光核。整个晶簇悬浮并缓慢自转。"`,

    /**
     * 创造模式 - 生成 (代码实现)
     * Role: Three.js 资深工程师
     */
    inspiration_creation_generate: `你是一名 Three.js 资深开发工程师。根据用户的描述生成可执行的 JavaScript 代码。

【执行环境】
你的代码运行在主场景中，与现有星球/粒子共存：

可用变量：
- scene：THREE.Scene 实例（主场景）
- THREE：Three.js 库
- camera：相机（用户可通过 OrbitControls 控制）
- renderer：WebGLRenderer
- controls：OrbitControls
- bloomPass：UnrealBloomPass 实例

可用函数：
- registerUpdate(callback)：注册每帧更新函数，callback 接收 deltaTime 参数（秒）
- unregisterUpdate(callback)：注销更新函数
- setBloom(strength, radius, threshold)：设置 Bloom 参数
- setFog(color, density)：设置雾效（color 为十六进制数字）

【尺度规范】
- 本场景尺度较大，相机距离约 500-2000
- **若用户未指定尺寸，对象基准大小应在 100-200 之间**
- 粒子系统推荐 5000-30000 个粒子

【特殊规则】
- 当用户提及"背景"、"天空"、"宇宙"、"星空"时，创建巨大尺度的场景元素（半径 5000+）

【代码规范】
1. 仅输出 JavaScript 代码块
2. 不要输出任何解释文字
3. **必须调用 scene.add() 将对象添加到场景**
4. 代码末尾返回创建的主要对象
5. 禁止使用 window，禁止无限循环（允许使用 document.createElement 创建纹理）
6. **如需动画效果，必须使用 registerUpdate() 注册更新函数**

【简单示例 - 发光球体】
setBloom(1.5, 0.5, 0.1);

const geometry = new THREE.SphereGeometry(150, 32, 32);
const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 200, 0);
scene.add(mesh);

registerUpdate((dt) => {
    mesh.rotation.y += dt * 0.5;
});

return mesh;

【粒子系统示例 - 旋涡星云】
setBloom(1.2, 0.8, 0.15);
setFog(0x020205, 0.002);

const particleCount = 20000;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);
const particleData = [];

for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.pow(Math.random(), 1.5) * 200;
    
    positions[i*3] = Math.cos(angle) * radius;
    positions[i*3+1] = (Math.random() - 0.5) * radius * 0.2;
    positions[i*3+2] = Math.sin(angle) * radius;
    
    const color = new THREE.Color();
    color.setHSL(0.6 + (radius/220) * 0.15, 0.8, 0.6 - (radius/220) * 0.4);
    colors[i*3] = color.r;
    colors[i*3+1] = color.g;
    colors[i*3+2] = color.b;
    
    sizes[i] = Math.random() * 3 + 1;
    particleData.push({ angle, radius, speed: 0.002 + Math.random() * 0.003 });
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.PointsMaterial({
    size: 4,
    vertexColors: true,
    map: getParticleTexture('soft'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

registerUpdate((dt) => {
    const pos = geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
        const d = particleData[i];
        d.angle -= d.speed;
        pos[i*3] = Math.cos(d.angle) * d.radius;
        pos[i*3+2] = Math.sin(d.angle) * d.radius;
    }
    geometry.attributes.position.needsUpdate = true;
});

return particles;`,

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
        ? `${baseSystemPrompt} \n\n用户上传了一张参考图片，请分析图片特征并融入你的润色描述中。`
        : baseSystemPrompt;

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
        'gemini-3-pro-preview-thinking',
        'gemini-3-pro-image-preview-flatfee'
    ];

    // 内联逻辑：优先使用传入的 model，否则默认 Sonnet
    const defaultModel = 'claude-sonnet-4-5-20250929';
    const targetModel = model || defaultModel;

    // 根据模型确定代理和 API Key
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
            stream: false
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
            return res.status(500).json({ error: `Refine Error: ${proxyRes.status} ${errorText}` });
        }

        const data = await proxyRes.json();
        let refined = data.choices?.[0]?.message?.content || prompt;

        // ============ 强化后处理清理 ============
        refined = refined.trim();

        // [Create Mode] Skip cleanup for code generation
        if (subMode === 'creation' || subMode === 'creation_generate') {
            return res.status(200).json({ refined });
        }

        // 1. 移除 Markdown 代码块
        refined = refined.replace(/```[\s\S]*? ```/g, '');
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
