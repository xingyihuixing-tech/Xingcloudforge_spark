/**
 * 用户配置管理API
 * 
 * input: HTTP请求 (GET获取配置, POST保存配置)
 * output: JSON响应 (配置数据或错误信息)
 * pos: 管理用户的粒子配置、场景设置等数据
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Redis客户端 - 支持多种环境变量名称格式
const RAW_REDIS_URL = process.env.KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL
    || process.env.UPSTASH_REDIS_REST_KV_URL
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_REDIS_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

// 将 rediss:// URL 转换为 https:// REST API URL
function convertToRestUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    // 如果已经是 https:// 格式，直接返回
    if (url.startsWith('https://')) return url;
    // 如果是 rediss:// 或 redis:// 格式，提取主机名并转换
    if (url.startsWith('rediss://') || url.startsWith('redis://')) {
        try {
            // rediss://default:token@host.upstash.io:6379 -> https://host.upstash.io
            const match = url.match(/@([^:]+)/);
            if (match && match[1]) {
                return `https://${match[1]}`;
            }
        } catch (e) {
            console.error('Failed to parse Redis URL:', e);
        }
    }
    return url;
}

const REDIS_URL = convertToRestUrl(RAW_REDIS_URL);

// 只在环境变量有效时初始化 Redis
const redis = REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

// 配置数据结构
interface UserConfig {
    version: number;
    updatedAt: string;
    settings?: Record<string, unknown>;
    planetScene?: Record<string, unknown>;
    presets?: Array<Record<string, unknown>>;
    solidCorePresets?: Array<Record<string, unknown>>;
    planetTemplates?: Array<Record<string, unknown>>;
    // 主题与材质配置
    theme?: {
        themeConfig?: Record<string, unknown>;
        materialSettings?: Record<string, unknown>;
        userMaterialPresets?: Array<Record<string, unknown>>;
    };
    // AI 生成的预设列表
    headTexturePresets?: Array<{ id: string; name: string; url: string; createdAt: number }>;
    backgroundPresets?: Array<{ id: string; name: string; url: string; createdAt: number }>;
    magicCircleTexturePresets?: Array<{ id: string; name: string; url: string; createdAt: number }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 检查 Redis 是否可用
    if (!redis) {
        console.error('Config API Error: Redis environment variables not configured');
        return res.status(503).json({
            error: 'Database service unavailable',
            message: 'Redis 环境变量未配置。请检查 KV_REST_API_URL 和 KV_REST_API_TOKEN'
        });
    }

    try {
        switch (req.method) {
            case 'GET':
                return await getConfig(req, res);
            case 'POST':
                return await saveConfig(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Config API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// 获取用户配置
async function getConfig(req: VercelRequest, res: VercelResponse) {
    const userId = req.query.userId as string;

    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }

    // 验证用户是否存在
    const exists = await redis!.sismember('users', userId);
    if (!exists) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const config = await redis!.get(`config:${userId}`) as UserConfig | null;

    if (!config) {
        // 返回空配置
        return res.status(200).json({
            config: {
                version: 1,
                updatedAt: new Date().toISOString(),
                settings: null,
                planetScene: null,
                presets: [],
                solidCorePresets: [],
                planetTemplates: [],
                theme: null,
                // AI 预设默认空数组
                headTexturePresets: [],
                backgroundPresets: [],
                magicCircleTexturePresets: [],
            }
        });
    }

    return res.status(200).json({ config });
}

// 保存用户配置
async function saveConfig(req: VercelRequest, res: VercelResponse) {
    const { userId, config } = req.body;

    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }

    // 验证用户是否存在
    const exists = await redis!.sismember('users', userId);
    if (!exists) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 获取现有配置并合并
    const existingConfig = await redis!.get(`config:${userId}`) as UserConfig | null;

    const newConfig: UserConfig = {
        version: (existingConfig?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        settings: config.settings ?? existingConfig?.settings,
        planetScene: config.planetScene ?? existingConfig?.planetScene,
        presets: config.presets ?? existingConfig?.presets ?? [],
        solidCorePresets: config.solidCorePresets ?? existingConfig?.solidCorePresets ?? [],
        planetTemplates: config.planetTemplates ?? existingConfig?.planetTemplates ?? [],
        theme: config.theme ?? existingConfig?.theme,
        // AI 预设字段
        headTexturePresets: config.headTexturePresets ?? existingConfig?.headTexturePresets ?? [],
        backgroundPresets: config.backgroundPresets ?? existingConfig?.backgroundPresets ?? [],
        magicCircleTexturePresets: config.magicCircleTexturePresets ?? existingConfig?.magicCircleTexturePresets ?? [],
    };

    await redis!.set(`config:${userId}`, newConfig);

    return res.status(200).json({
        success: true,
        version: newConfig.version,
        updatedAt: newConfig.updatedAt
    });
}
