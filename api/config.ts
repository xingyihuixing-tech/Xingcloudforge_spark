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

// Redis客户端
const redis = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// 配置数据结构
interface UserConfig {
    version: number;
    updatedAt: string;
    settings?: Record<string, unknown>;
    planetScene?: Record<string, unknown>;
    presets?: Array<Record<string, unknown>>;
    solidCorePresets?: Array<Record<string, unknown>>;
    planetTemplates?: Array<Record<string, unknown>>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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
    const exists = await redis.sismember('users', userId);
    if (!exists) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const config = await redis.get(`config:${userId}`) as UserConfig | null;

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
    const exists = await redis.sismember('users', userId);
    if (!exists) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 获取现有配置并合并
    const existingConfig = await redis.get(`config:${userId}`) as UserConfig | null;

    const newConfig: UserConfig = {
        version: (existingConfig?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        settings: config.settings ?? existingConfig?.settings,
        planetScene: config.planetScene ?? existingConfig?.planetScene,
        presets: config.presets ?? existingConfig?.presets ?? [],
        solidCorePresets: config.solidCorePresets ?? existingConfig?.solidCorePresets ?? [],
        planetTemplates: config.planetTemplates ?? existingConfig?.planetTemplates ?? [],
    };

    await redis.set(`config:${userId}`, newConfig);

    return res.status(200).json({
        success: true,
        version: newConfig.version,
        updatedAt: newConfig.updatedAt
    });
}
