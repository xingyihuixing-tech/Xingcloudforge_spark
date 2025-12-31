/**
 * XingForge AI - Schema Builder
 * 
 * input: 用户选择的范围 (ScopeSelection)
 * output: 动态生成的 Schema JSON，用于注入 System Prompt
 * pos: AI 约束系统的核心，确保生成的配置符合类型定义
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

// ============================================
// 效果类型定义 (11种)
// ============================================

export type EffectType =
    | 'particleCore'      // 粒子核心
    | 'solidCore'         // 实体核心
    | 'energyCore'        // 能量核 (能量体简化版)
    | 'energyBody'        // 能量体
    | 'particleRing'      // 粒子环
    | 'ringBelt'          // 环带
    | 'spiralRing'        // 螺旋环 (SpiralFlameSettings)
    | 'particleOrbit'     // 粒子环绕 (OrbitingParticlesSettings)
    | 'particleJet'       // 粒子喷射 (ParticleEmitterSettings)
    | 'rotatingFirefly'   // 旋转流萤 (OrbitingFireflySettings)
    | 'wanderingFirefly'; // 游走流萤 (WanderingFireflyGroupSettings)

// 效果信息
export const EFFECT_INFO: Record<EffectType, { name: string; icon: string; maxInstances: number }> = {
    particleCore: { name: '粒子核心', icon: '⚪', maxInstances: 6 },
    solidCore: { name: '实体核心', icon: '🔴', maxInstances: 6 },
    energyCore: { name: '能量核', icon: '⚡', maxInstances: 6 },
    energyBody: { name: '能量体', icon: '🔷', maxInstances: 6 },
    particleRing: { name: '粒子环', icon: '⭕', maxInstances: 6 },
    ringBelt: { name: '环带', icon: '🌀', maxInstances: 6 },
    spiralRing: { name: '螺旋环', icon: '🌊', maxInstances: 6 },
    particleOrbit: { name: '粒子环绕', icon: '💫', maxInstances: 6 },
    particleJet: { name: '粒子喷射', icon: '🚀', maxInstances: 6 },
    rotatingFirefly: { name: '旋转流萤', icon: '✨', maxInstances: 6 },
    wanderingFirefly: { name: '游走流萤', icon: '🌟', maxInstances: 6 },
};

// ============================================
// 字段约束定义
// ============================================

export interface FieldSchema {
    type: 'number' | 'boolean' | 'string' | 'enum' | 'color';
    min?: number;
    max?: number;
    default?: any;
    options?: string[];
    desc: string;
}

export interface EffectSchema {
    name: string;
    fields: Record<string, FieldSchema>;
}

// ============================================
// 各效果的 Schema 定义
// ============================================

export const EFFECT_SCHEMAS: Record<EffectType, EffectSchema> = {
    particleCore: {
        name: '粒子核心',
        fields: {
            'fillMode': { type: 'enum', options: ['shell', 'gradient', 'solid'], default: 'gradient', desc: '填充模式' },
            'fillPercent': { type: 'number', min: 0, max: 100, default: 50, desc: '填充百分比' },
            'density': { type: 'number', min: 0.1, max: 10, default: 2, desc: '粒子密度' },
            'baseRadius': { type: 'number', min: 50, max: 500, default: 100, desc: '基础半径' },
            'baseHue': { type: 'number', min: 0, max: 360, default: 0, desc: '基础色相' },
            'baseSaturation': { type: 'number', min: 0, max: 1, default: 0.8, desc: '饱和度' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.3, desc: '自转速度' },
            'trailLength': { type: 'number', min: 0, max: 2, default: 0, desc: '拖尾长度' },
            'brightness': { type: 'number', min: 0.1, max: 3, default: 1, desc: '亮度' },
            'particleSize': { type: 'number', min: 0.5, max: 5, default: 1, desc: '粒子大小' },
        }
    },

    solidCore: {
        name: '实体核心',
        fields: {
            'radius': { type: 'number', min: 10, max: 300, default: 100, desc: '球体半径' },
            'surfaceColor.baseColor': { type: 'color', default: '#ff6600', desc: '表面主色' },
            'scale': { type: 'number', min: 0.1, max: 10, default: 1, desc: '纹理尺度' },
            'speed': { type: 'number', min: 0, max: 2, default: 0.5, desc: '流动速度' },
            'contrast': { type: 'number', min: 1, max: 5, default: 2, desc: '对比度' },
            'emissiveStrength': { type: 'number', min: 0, max: 5, default: 1, desc: '自发光强度' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.2, desc: '自转速度' },
            'opacity': { type: 'number', min: 0, max: 1, default: 1, desc: '透明度' },
            'brightness': { type: 'number', min: 0.5, max: 3, default: 1, desc: '亮度' },
            'glowEnabled': { type: 'boolean', default: true, desc: '边缘光晕' },
            'glowStrength': { type: 'number', min: 0, max: 3, default: 1, desc: '光晕强度' },
        }
    },

    energyCore: {
        name: '能量核',
        fields: {
            'radius': { type: 'number', min: 50, max: 500, default: 120, desc: '半径' },
            'polyhedronType': { type: 'enum', options: ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'], default: 'icosahedron', desc: '多面体类型' },
            'spherize': { type: 'number', min: 0, max: 1, default: 0, desc: '球化程度' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.3, desc: '自转速度' },
            'globalOpacity': { type: 'number', min: 0, max: 1, default: 0.8, desc: '整体透明度' },
        }
    },

    energyBody: {
        name: '能量体',
        fields: {
            'radius': { type: 'number', min: 50, max: 500, default: 150, desc: '半径' },
            'polyhedronType': { type: 'enum', options: ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron', 'truncatedIcosahedron'], default: 'icosahedron', desc: '多面体类型' },
            'subdivisionLevel': { type: 'number', min: 0, max: 4, default: 0, desc: '细分级别' },
            'spherize': { type: 'number', min: 0, max: 1, default: 0.5, desc: '球化程度' },
            'renderMode': { type: 'enum', options: ['wireframe', 'shell', 'both'], default: 'both', desc: '渲染模式' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.2, desc: '自转速度' },
            'globalOpacity': { type: 'number', min: 0, max: 1, default: 0.9, desc: '透明度' },
            'edgeEffect.width': { type: 'number', min: 0.5, max: 5, default: 1, desc: '边线粗细' },
            'edgeEffect.color': { type: 'color', default: '#00ffff', desc: '边线颜色' },
            'shellEffect.opacity': { type: 'number', min: 0, max: 1, default: 0.3, desc: '薄壳透明度' },
        }
    },

    particleRing: {
        name: '粒子环',
        fields: {
            'absoluteRadius': { type: 'number', min: 50, max: 600, default: 200, desc: '轨道半径' },
            'particleDensity': { type: 'number', min: 0.1, max: 10, default: 2, desc: '粒子密度' },
            'bandwidth': { type: 'number', min: 1, max: 50, default: 10, desc: '环宽度' },
            'thickness': { type: 'number', min: 0, max: 20, default: 5, desc: '环厚度' },
            'orbitSpeed': { type: 'number', min: -2, max: 2, default: 0.5, desc: '公转速度' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0, desc: '自转速度' },
            'color': { type: 'color', default: '#88aaff', desc: '颜色' },
            'eccentricity': { type: 'number', min: 0, max: 0.9, default: 0, desc: '离心率' },
            'trailEnabled': { type: 'boolean', default: false, desc: '启用拖尾' },
            'brightness': { type: 'number', min: 0.1, max: 2, default: 1, desc: '亮度' },
        }
    },

    ringBelt: {
        name: '环带',
        fields: {
            'absoluteInnerRadius': { type: 'number', min: 50, max: 500, default: 120, desc: '内半径' },
            'absoluteOuterRadius': { type: 'number', min: 60, max: 600, default: 200, desc: '外半径' },
            'orbitSpeed': { type: 'number', min: -2, max: 2, default: 0.3, desc: '公转速度' },
            'rotationSpeed': { type: 'number', min: -2, max: 2, default: 0.1, desc: '自转速度' },
            'color': { type: 'color', default: '#ffaa66', desc: '颜色' },
            'opacity': { type: 'number', min: 0.1, max: 1, default: 0.7, desc: '透明度' },
            'eccentricity': { type: 'number', min: 0, max: 0.9, default: 0, desc: '离心率' },
            'brightness': { type: 'number', min: 0.5, max: 3, default: 1, desc: '亮度' },
        }
    },

    spiralRing: {
        name: '螺旋环',
        fields: {
            'spiralCount': { type: 'number', min: 1, max: 6, default: 2, desc: '螺旋条数' },
            'direction': { type: 'enum', options: ['cw', 'ccw', 'both'], default: 'cw', desc: '旋转方向' },
            'baseRadius': { type: 'number', min: 50, max: 300, default: 100, desc: '基础半径' },
            'height': { type: 'number', min: 0.5, max: 5, default: 1.5, desc: '螺旋高度' },
            'pitch': { type: 'number', min: 0.1, max: 2, default: 0.5, desc: '螺距' },
            'thickness': { type: 'number', min: 0.05, max: 0.5, default: 0.1, desc: '厚度' },
            'rotationSpeed': { type: 'number', min: 0, max: 3, default: 1, desc: '旋转速度' },
            'opacity': { type: 'number', min: 0, max: 1, default: 0.8, desc: '透明度' },
            'emissive': { type: 'number', min: 0, max: 5, default: 2, desc: '发光强度' },
        }
    },

    particleOrbit: {
        name: '粒子环绕',
        fields: {
            'particleDensity': { type: 'number', min: 0.1, max: 5, default: 1, desc: '粒子密度' },
            'orbitRadius': { type: 'number', min: 0.1, max: 5, default: 1.5, desc: '环绕半径(倍R)' },
            'thickness': { type: 'number', min: 1, max: 1000, default: 100, desc: '球壳厚度' },
            'color': { type: 'color', default: '#66ffaa', desc: '颜色' },
            'baseSpeed': { type: 'number', min: 0.1, max: 2, default: 0.5, desc: '旋转速度' },
            'turbulence': { type: 'number', min: 0, max: 1, default: 0.3, desc: '随机扰动' },
            'fadeWithDistance': { type: 'boolean', default: true, desc: '距离淡出' },
            'brightness': { type: 'number', min: 0.1, max: 3, default: 1, desc: '亮度' },
        }
    },

    particleJet: {
        name: '粒子喷射',
        fields: {
            'emissionRangeMin': { type: 'number', min: 0, max: 2, default: 1, desc: '发射起点(倍R)' },
            'emissionRangeMax': { type: 'number', min: 1, max: 10, default: 5, desc: '消散边界(倍R)' },
            'birthRate': { type: 'number', min: 50, max: 2000, default: 500, desc: '每秒生成数' },
            'lifeSpan': { type: 'number', min: 0.5, max: 5, default: 2, desc: '生命周期(秒)' },
            'initialSpeed': { type: 'number', min: 10, max: 200, default: 80, desc: '初始速度' },
            'drag': { type: 'number', min: 0, max: 0.99, default: 0.3, desc: '速度衰减' },
            'color': { type: 'color', default: '#ff8844', desc: '颜色' },
            'particleSize': { type: 'number', min: 0.5, max: 5, default: 1.5, desc: '粒子大小' },
            'fadeOutStrength': { type: 'number', min: 0, max: 1, default: 0.8, desc: '淡出强度' },
            'brightness': { type: 'number', min: 0.5, max: 3, default: 1.5, desc: '亮度' },
        }
    },

    rotatingFirefly: {
        name: '旋转流萤',
        fields: {
            'absoluteOrbitRadius': { type: 'number', min: 50, max: 500, default: 150, desc: '轨道半径' },
            'orbitSpeed': { type: 'number', min: 0.1, max: 2, default: 0.5, desc: '公转速度' },
            'size': { type: 'number', min: 1, max: 100, default: 20, desc: '头部大小' },
            'color': { type: 'color', default: '#ffff88', desc: '颜色' },
            'brightness': { type: 'number', min: 0.5, max: 8, default: 2, desc: '亮度' },
            'headStyle': { type: 'enum', options: ['plain', 'flare', 'spark', 'texture'], default: 'flare', desc: '头部样式' },
            'trailEnabled': { type: 'boolean', default: true, desc: '启用拖尾' },
            'trailLength': { type: 'number', min: 1, max: 1000, default: 100, desc: '拖尾长度' },
            'pulseSpeed': { type: 'number', min: 0, max: 3, default: 1, desc: '脉冲速度' },
            'glowIntensity': { type: 'number', min: 0, max: 2, default: 1, desc: '光晕强度' },
        }
    },

    wanderingFirefly: {
        name: '游走流萤',
        fields: {
            'count': { type: 'number', min: 1, max: 50, default: 10, desc: '该组数量' },
            'innerRadius': { type: 'number', min: 0.5, max: 5, default: 1, desc: '内边界(倍R)' },
            'outerRadius': { type: 'number', min: 1, max: 15, default: 5, desc: '外边界(倍R)' },
            'speed': { type: 'number', min: 0.1, max: 2, default: 0.5, desc: '移动速度' },
            'turnFrequency': { type: 'number', min: 0, max: 1, default: 0.3, desc: '转向频率' },
            'size': { type: 'number', min: 1, max: 100, default: 15, desc: '头部大小' },
            'color': { type: 'color', default: '#88ffff', desc: '颜色' },
            'brightness': { type: 'number', min: 0.5, max: 8, default: 2, desc: '亮度' },
            'headStyle': { type: 'enum', options: ['plain', 'flare', 'spark', 'texture'], default: 'plain', desc: '头部样式' },
            'pulseSpeed': { type: 'number', min: 0, max: 3, default: 0.5, desc: '脉冲速度' },
        }
    },
};

// ============================================
// 字段约束配置
// ============================================

export interface FieldConstraint {
    enabled: boolean;       // 是否让 AI 配置
    min?: number;           // 用户设定的最小值 (覆盖默认)
    max?: number;           // 用户设定的最大值 (覆盖默认)
    enumOptions?: string[]; // 用户限定的枚举值
    freeMode?: boolean;     // 自由发挥 (忽略约束)
}

export interface InstanceConfig {
    instanceId: string;     // 实例 ID (e.g., 'instance_1')
    fields: Record<string, FieldConstraint>;
}

export interface ScopeSelection {
    [effectType: string]: InstanceConfig[];
}

// ============================================
// 动态 Schema 生成
// ============================================

/**
 * 根据用户选择的范围生成 Schema
 */
export function buildSchemaFromSelection(selection: ScopeSelection): object {
    const schema: Record<string, any> = {};

    for (const [effectType, instances] of Object.entries(selection)) {
        if (!instances || instances.length === 0) continue;

        const effectSchema = EFFECT_SCHEMAS[effectType as EffectType];
        if (!effectSchema) continue;

        schema[effectType] = {
            description: effectSchema.name,
            instances: instances.map((inst, idx) => {
                const instanceSchema: Record<string, any> = {
                    id: inst.instanceId || `instance_${idx + 1}`,
                    fields: {}
                };

                for (const [fieldName, constraint] of Object.entries(inst.fields)) {
                    if (!constraint.enabled) continue;

                    const fieldDef = effectSchema.fields[fieldName];
                    if (!fieldDef) continue;

                    const fieldOutput: any = {
                        type: fieldDef.type,
                        desc: fieldDef.desc,
                    };

                    if (constraint.freeMode) {
                        fieldOutput.constraint = '自由发挥';
                    } else {
                        if (fieldDef.type === 'number') {
                            fieldOutput.min = constraint.min ?? fieldDef.min;
                            fieldOutput.max = constraint.max ?? fieldDef.max;
                        } else if (fieldDef.type === 'enum') {
                            fieldOutput.options = constraint.enumOptions ?? fieldDef.options;
                        }
                    }

                    if (fieldDef.default !== undefined) {
                        fieldOutput.default = fieldDef.default;
                    }

                    instanceSchema.fields[fieldName] = fieldOutput;
                }

                return instanceSchema;
            })
        };
    }

    return schema;
}

/**
 * 生成默认的全选范围（用于 AI 智能推荐模式）
 */
export function createDefaultScopeSelection(): ScopeSelection {
    const selection: ScopeSelection = {};

    for (const effectType of Object.keys(EFFECT_SCHEMAS) as EffectType[]) {
        const effectSchema = EFFECT_SCHEMAS[effectType];
        const fields: Record<string, FieldConstraint> = {};

        for (const fieldName of Object.keys(effectSchema.fields)) {
            fields[fieldName] = { enabled: true, freeMode: false };
        }

        selection[effectType] = [{ instanceId: 'instance_1', fields }];
    }

    return selection;
}

/**
 * 获取效果类型的中文名称
 */
export function getEffectName(effectType: EffectType): string {
    return EFFECT_INFO[effectType]?.name || effectType;
}

/**
 * 获取效果类型的图标
 */
export function getEffectIcon(effectType: EffectType): string {
    return EFFECT_INFO[effectType]?.icon || '•';
}
