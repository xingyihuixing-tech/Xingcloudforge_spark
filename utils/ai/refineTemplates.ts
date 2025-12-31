/**
 * XingForge AI - 润色模板
 * 
 * input: 用户输入的简单描述
 * output: 润色后的中文提示词
 * pos: 灵感模式的 Prompt 润色逻辑
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

export type InspirationSubMode = 'particleShape' | 'background' | 'magicCircle';

// ============================================
// 润色模板 (中文版，用户可编辑)
// ============================================

export const REFINE_TEMPLATES: Record<InspirationSubMode, (input: string) => string> = {
    /**
     * 粒子形状 - 用于流萤头部样式
     * 约束: 纯黑背景、白色/浅色图案、256x256、PNG
     */
    particleShape: (input: string) =>
        `生成一个粒子形状图案: ${input}。
要求:
- 纯黑背景 (#000000)
- 白色或浅色发光图案
- 256x256 像素，正方形
- PNG 格式，适合作为粒子贴图
- 简洁几何形状，边缘清晰`,

    /**
     * 背景图 - 用于主题设置
     * 约束: 宇宙/星空主题、16:9、无文字
     */
    background: (input: string) =>
        `生成宇宙背景图: ${input}。
要求:
- 16:9 横向构图 (1920x1080)
- 深空宇宙主题
- 无文字、无水印
- 高清晰度，适合作为网页背景
- 色彩丰富但不刺眼，适合长时间观看`,

    /**
     * 法阵图 - 用于法阵系统预设
     * 约束: 纯黑背景、发光线条、中心对称、正方形
     */
    magicCircle: (input: string) =>
        `生成魔法阵图案: ${input}。
要求:
- 纯黑背景 (#000000)
- 发光线条效果 (霓虹/能量风格)
- 严格中心对称的几何结构
- 512x512 像素，正方形
- PNG 格式，支持透明通道
- 复杂精细的符文/几何细节`
};

// ============================================
// 英文润色模板 (发送给 AI 生图用)
// ============================================

export const REFINE_TO_ENGLISH: Record<InspirationSubMode, (chinesePrompt: string) => string> = {
    particleShape: (chinesePrompt: string) =>
        `Generate a particle texture: ${chinesePrompt}. Style: pure black background (#000000), white/light glowing pattern, 256x256 pixels, square PNG, clean geometric shape, sharp edges, suitable for particle system sprite.`,

    background: (chinesePrompt: string) =>
        `Generate a cosmic background: ${chinesePrompt}. Style: 16:9 landscape (1920x1080), deep space theme, no text/watermarks, high resolution, rich but comfortable colors for prolonged viewing, stars/nebula/galaxies.`,

    magicCircle: (chinesePrompt: string) =>
        `Generate a magic circle pattern: ${chinesePrompt}. Style: pure black background (#000000), glowing neon/energy lines, strictly center-symmetric geometric structure, 512x512 pixels, square PNG with transparency, intricate runes and geometric details.`
};

// ============================================
// 模式描述
// ============================================

export const INSPIRATION_MODE_INFO: Record<InspirationSubMode, { name: string; desc: string; icon: string }> = {
    particleShape: {
        name: '粒子形状',
        desc: '生成可用于流萤头部的粒子贴图',
        icon: '✦'
    },
    background: {
        name: '背景图',
        desc: '生成宇宙主题的背景图片',
        icon: '🌌'
    },
    magicCircle: {
        name: '法阵图',
        desc: '生成魔法阵纹理图案',
        icon: '⭕'
    }
};
