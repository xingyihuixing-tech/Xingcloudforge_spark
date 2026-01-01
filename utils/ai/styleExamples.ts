/**
 * AI 创造系统 - 风格示例预设
 * 
 * input: 效果类型 (EffectType)
 * output: 该效果的风格锚点示例
 * pos: 为 AI 提供"风格锚点"，提高配置准确性
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { EffectType } from './schemaBuilder';

// ============================================
// 类型定义
// ============================================

export interface StyleExample {
    name: string;           // 风格名称
    description: string;    // 风格描述
    config: Record<string, any>;  // 配置值
}

// ============================================
// 阶段 1 模块风格示例：particleCore + energyBody
// ============================================

export const STYLE_EXAMPLES: Partial<Record<EffectType, StyleExample[]>> = {

    // 粒子核心风格示例
    particleCore: [
        {
            name: '明亮恒星',
            description: '高亮度、高密度的恒星核心，暖色调',
            config: {
                fillMode: 'gradient',
                fillPercent: 50,
                density: 3,
                baseRadius: 120,
                baseHue: 30,           // 橙色
                baseSaturation: 0.9,
                rotationSpeed: 0.3,
                trailLength: 0.5,
                brightness: 2,
                particleSize: 1.5
            }
        },
        {
            name: '冰蓝星云',
            description: '低密度、冷色调的星云效果',
            config: {
                fillMode: 'shell',
                fillPercent: 20,
                density: 1.5,
                baseRadius: 150,
                baseHue: 200,          // 蓝色
                baseSaturation: 0.7,
                rotationSpeed: 0.1,
                trailLength: 1,
                brightness: 1.2,
                particleSize: 0.8
            }
        },
        {
            name: '紫色漩涡',
            description: '高速旋转的紫色粒子核心',
            config: {
                fillMode: 'solid',
                fillPercent: 80,
                density: 5,
                baseRadius: 100,
                baseHue: 280,          // 紫色
                baseSaturation: 0.8,
                rotationSpeed: 1.2,
                trailLength: 1.5,
                brightness: 1.8,
                particleSize: 1
            }
        }
    ],

    // 能量体风格示例
    energyBody: [
        {
            name: '科幻线框',
            description: '蓝色线框模式，科技感强',
            config: {
                radius: 120,
                polyhedronType: 'icosahedron',
                subdivisionLevel: 1,
                spherize: 0.3,
                renderMode: 'wireframe',
                rotationSpeed: 0.2,
                globalOpacity: 0.9,
                'edgeEffect.width': 2,
                'edgeEffect.color': '#00aaff',
                'shellEffect.opacity': 0
            }
        },
        {
            name: '能量薄壳',
            description: '半透明薄壳模式，柔和光晕',
            config: {
                radius: 150,
                polyhedronType: 'dodecahedron',
                subdivisionLevel: 2,
                spherize: 0.7,
                renderMode: 'shell',
                rotationSpeed: 0.15,
                globalOpacity: 0.7,
                'edgeEffect.width': 0,
                'shellEffect.opacity': 0.5
            }
        },
        {
            name: '复合能量场',
            description: '线框+薄壳混合，高级效果',
            config: {
                radius: 130,
                polyhedronType: 'icosahedron',
                subdivisionLevel: 1,
                spherize: 0.5,
                renderMode: 'both',
                rotationSpeed: 0.25,
                globalOpacity: 0.85,
                'edgeEffect.width': 1.5,
                'edgeEffect.color': '#66ffcc',
                'shellEffect.opacity': 0.3
            }
        }
    ]
};

// ============================================
// 辅助函数
// ============================================

/**
 * 获取模块的所有风格示例
 */
export function getStyleExamples(effectType: EffectType): StyleExample[] {
    return STYLE_EXAMPLES[effectType] || [];
}

/**
 * 生成风格示例文本（用于 KB）
 */
export function generateExamplesText(effectType: EffectType): string {
    const examples = getStyleExamples(effectType);
    if (examples.length === 0) return '';

    const lines = ['## 风格示例'];
    for (const example of examples) {
        lines.push(`### ${example.name}`);
        lines.push(`描述: ${example.description}`);
        lines.push('```json');
        lines.push(JSON.stringify(example.config, null, 2));
        lines.push('```');
    }
    return lines.join('\n');
}

/**
 * 根据描述匹配最相似的风格
 */
export function findSimilarStyle(
    effectType: EffectType,
    description: string
): StyleExample | null {
    const examples = getStyleExamples(effectType);
    if (examples.length === 0) return null;

    // 简单的关键词匹配
    const keywords = description.toLowerCase();

    for (const example of examples) {
        const exampleText = (example.name + example.description).toLowerCase();
        // 检查是否有重叠关键词
        const words = exampleText.split(/\s+/);
        for (const word of words) {
            if (word.length > 2 && keywords.includes(word)) {
                return example;
            }
        }
    }

    // 无匹配则返回第一个
    return examples[0];
}
