/**
 * XingForge AI - Model Configuration & Router (Unified Source)
 * 
 * input: modelId (string)
 * output: proxy config (baseUrl, apiKey)
 * pos: AI 系统的唯一路由真理源，API 层直接导入使用
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

// ============================================
// 模型常量定义 (以代理商后台为准)
// ============================================

export interface ModelInfo {
    id: string;
    name: string;
    desc: string;
    keyGroup: 'claude' | 'gemini' | 'xuai';  // 决定使用哪个 API Key
    capability: 'chat' | 'image';
}

// Jimiai 代理 - Claude 系列 (Key1)
export const CLAUDE_MODELS: ModelInfo[] = [
    { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', desc: '顶级推理能力', keyGroup: 'claude', capability: 'chat' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', desc: '平衡速度与质量 (推荐)', keyGroup: 'claude', capability: 'chat' },
    { id: 'claude-sonnet-4-5-20250929-thinking', name: 'Claude Sonnet Thinking', desc: '思维链推理', keyGroup: 'claude', capability: 'chat' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', desc: '极速响应', keyGroup: 'claude', capability: 'chat' },
];

// Jimiai 代理 - Gemini 系列 (Key2)
export const GEMINI_CHAT_MODELS: ModelInfo[] = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: '快速响应', keyGroup: 'gemini', capability: 'chat' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: '多模态理解', keyGroup: 'gemini', capability: 'chat' },
];

// Xuai 代理 - 生图模型 (IMAGE_API_KEY)
export const XUAI_MODELS: ModelInfo[] = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Image', desc: '高质量生图 (推荐)', keyGroup: 'xuai', capability: 'image' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash', desc: '快速生图', keyGroup: 'xuai', capability: 'image' },
    { id: 'gemini-3-pro-image-preview-flatfee', name: 'Gemini 3 Flatfee', desc: '固定费率', keyGroup: 'xuai', capability: 'image' },
    { id: 'gemini-3-pro-preview-thinking', name: 'Gemini 3 Thinking', desc: '深度思考 (Xuai)', keyGroup: 'xuai', capability: 'chat' },
];

// 合并导出
export const CHAT_MODELS: ModelInfo[] = [...CLAUDE_MODELS, ...GEMINI_CHAT_MODELS];
export const IMAGE_MODELS: ModelInfo[] = XUAI_MODELS.filter(m => m.capability === 'image');
export const ALL_MODELS: ModelInfo[] = [...CLAUDE_MODELS, ...GEMINI_CHAT_MODELS, ...XUAI_MODELS];

// ============================================
// 路由逻辑 (唯一实现)
// ============================================

export interface ProxyConfig {
    baseUrl: string;
    apiKey: string;
}

// Claude 模型 ID 列表 (用于 API 内联判断)
export const CLAUDE_MODEL_IDS = CLAUDE_MODELS.map(m => m.id);
// Gemini Chat 模型 ID 列表
export const GEMINI_CHAT_MODEL_IDS = GEMINI_CHAT_MODELS.map(m => m.id);
// Xuai 模型 ID 列表
export const XUAI_MODEL_IDS = XUAI_MODELS.map(m => m.id);

/**
 * 根据模型 ID 获取代理配置 (唯一路由函数)
 */
export function getProxyConfig(modelId: string): ProxyConfig {
    const model = ALL_MODELS.find(m => m.id === modelId);

    if (model?.keyGroup === 'xuai') {
        return {
            baseUrl: process.env.IMAGE_PROXY_BASE_URL || 'https://api.xuai.chat/v1',
            apiKey: process.env.IMAGE_API_KEY || ''
        };
    }

    if (model?.keyGroup === 'gemini') {
        return {
            baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
            apiKey: process.env.JIMIAI_API_KEY_GEMINI || ''
        };
    }

    // 默认走 Claude Key
    return {
        baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
        apiKey: process.env.JIMIAI_API_KEY_CLAUDE || ''
    };
}

/**
 * 判断模型是否为生图模型
 */
export function isImageModel(modelId: string): boolean {
    const model = ALL_MODELS.find(m => m.id === modelId);
    return model?.capability === 'image';
}

/**
 * 获取模型信息
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
    return ALL_MODELS.find(m => m.id === modelId);
}

// ============================================
// 默认模型
// ============================================

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-5-20250929';
export const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
