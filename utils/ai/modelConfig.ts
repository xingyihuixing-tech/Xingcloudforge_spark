/**
 * XingForge AI - Model Configuration & Router
 * 
 * input: modelId (string)
 * output: proxy config (baseUrl, apiKey)
 * pos: AI 系统的核心路由逻辑
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

// ============================================
// 模型常量定义
// ============================================

export interface ModelInfo {
    id: string;
    name: string;
    desc: string;
    proxy: 'jimiai' | 'xuai';
    capability: 'chat' | 'image' | 'vision';
}

// 纯文本/逻辑模型 (用于 JSON 生成、代码推理、对话)
export const CHAT_MODELS: ModelInfo[] = [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', desc: '平衡速度与质量 (推荐)', proxy: 'jimiai', capability: 'chat' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', desc: '顶级推理能力', proxy: 'jimiai', capability: 'chat' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', desc: '极速响应', proxy: 'jimiai', capability: 'chat' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: '多模态理解', proxy: 'jimiai', capability: 'vision' },
    { id: 'gemini-2.5-pro-thinking-512', name: 'Gemini 2.5 Thinking', desc: '深度思考', proxy: 'jimiai', capability: 'chat' },
    { id: 'claude-sonnet-4-5-20250929-thinking', name: 'Claude Sonnet Thinking', desc: '思维链推理', proxy: 'jimiai', capability: 'chat' },
    { id: 'gemini-3-pro-preview-thinking', name: 'Gemini 3 Thinking', desc: '深度思考 (Xuai)', proxy: 'xuai', capability: 'vision' },
];

// 图像生成模型 (用于文生图)
export const IMAGE_MODELS: ModelInfo[] = [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Image', desc: '高质量生图', proxy: 'xuai', capability: 'image' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash', desc: '快速生图', proxy: 'xuai', capability: 'image' },
    { id: 'gemini-3-pro-image-preview-flatfee', name: 'Gemini 3 Flatfee', desc: '固定费率', proxy: 'xuai', capability: 'image' },
];

// 所有模型
export const ALL_MODELS = [...CHAT_MODELS, ...IMAGE_MODELS];

// ============================================
// 路由逻辑
// ============================================

const PROXY_2_MODEL_IDS = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview-flatfee',
    'gemini-3-pro-preview-thinking'
];

export interface ProxyConfig {
    baseUrl: string;
    apiKey: string;
}

/**
 * 根据模型 ID 获取代理配置
 */
export function getProxyConfig(modelId: string): ProxyConfig {
    if (PROXY_2_MODEL_IDS.includes(modelId)) {
        return {
            baseUrl: process.env.IMAGE_PROXY_BASE_URL || 'https://api.xuai.chat/v1',
            apiKey: process.env.IMAGE_API_KEY || ''
        };
    }
    return {
        baseUrl: process.env.CHAT_PROXY_BASE_URL || 'https://jimiai.ai/v1',
        apiKey: process.env.CHAT_API_KEY || ''
    };
}

/**
 * 判断模型是否支持生图
 */
export function isImageGenerationModel(modelId: string): boolean {
    return ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview-flatfee'].includes(modelId);
}

/**
 * 判断模型是否支持视觉理解
 */
export function supportsVision(modelId: string): boolean {
    return ['gemini-3-pro-preview', 'gemini-3-pro-preview-thinking'].includes(modelId);
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
export const DEFAULT_VISION_MODEL = 'gemini-3-pro-preview';
