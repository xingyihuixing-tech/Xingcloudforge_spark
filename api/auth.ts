/**
 * 用户认证API
 * 
 * input: HTTP请求 (GET获取用户列表, POST登录/注册)
 * output: JSON响应 (用户数据或错误信息)
 * pos: 提供用户认证服务，是用户系统的核心API
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 用户数据结构
interface User {
    id: string;
    name: string;
    avatar: string;
    password?: string;
    createdAt: string;
}

// Redis客户端（通过环境变量自动配置）
const redis = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// 默认头像列表
const DEFAULT_AVATARS = ['👨', '👩', '👧', '👦', '👴', '👵', '🧑', '👤'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (req.method) {
            case 'GET':
                return await getUsers(req, res);
            case 'POST':
                return await handleAuth(req, res);
            case 'PUT':
                return await updateUser(req, res);
            case 'DELETE':
                return await deleteUser(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Auth API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// 获取所有用户（不含密码）
async function getUsers(req: VercelRequest, res: VercelResponse) {
    const userIds = await redis.smembers('users') as string[];

    if (!userIds || userIds.length === 0) {
        return res.status(200).json({ users: [] });
    }

    const users: Omit<User, 'password'>[] = [];
    for (const userId of userIds) {
        const userData = await redis.hgetall(`user:${userId}`) as User | null;
        if (userData) {
            const { password, ...userWithoutPassword } = userData;
            users.push(userWithoutPassword);
        }
    }

    return res.status(200).json({ users });
}

// 处理登录/注册
async function handleAuth(req: VercelRequest, res: VercelResponse) {
    const { action, userId, name, password, avatar } = req.body;

    if (action === 'login') {
        // 登录验证
        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        const userData = await redis.hgetall(`user:${userId}`) as User | null;
        if (!userData) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 如果设置了密码，需要验证
        if (userData.password && userData.password !== password) {
            return res.status(401).json({ error: '密码错误' });
        }

        const { password: _, ...userWithoutPassword } = userData;
        return res.status(200).json({ success: true, user: userWithoutPassword });
    }

    if (action === 'register') {
        // 注册新用户
        if (!userId || !name) {
            return res.status(400).json({ error: '用户ID和名称不能为空' });
        }

        // 检查用户是否已存在
        const exists = await redis.sismember('users', userId);
        if (exists) {
            return res.status(409).json({ error: '用户ID已存在' });
        }

        const newUser: User = {
            id: userId,
            name,
            avatar: avatar || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
            password: password || undefined,
            createdAt: new Date().toISOString(),
        };

        // 保存用户
        await redis.sadd('users', userId);
        await redis.hset(`user:${userId}`, newUser);

        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json({ success: true, user: userWithoutPassword });
    }

    return res.status(400).json({ error: '无效的操作' });
}

// 更新用户信息
async function updateUser(req: VercelRequest, res: VercelResponse) {
    const { userId, name, avatar, newPassword, oldPassword } = req.body;

    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }

    const userData = await redis.hgetall(`user:${userId}`) as User | null;
    if (!userData) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 如果更改密码，需要验证旧密码
    if (newPassword !== undefined) {
        if (userData.password && userData.password !== oldPassword) {
            return res.status(401).json({ error: '旧密码错误' });
        }
    }

    // 更新字段
    const updates: Partial<User> = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;
    if (newPassword !== undefined) updates.password = newPassword || undefined;

    await redis.hset(`user:${userId}`, updates);

    return res.status(200).json({ success: true });
}

// 删除用户
async function deleteUser(req: VercelRequest, res: VercelResponse) {
    const { userId, password } = req.body;

    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }

    const userData = await redis.hgetall(`user:${userId}`) as User | null;
    if (!userData) {
        return res.status(404).json({ error: '用户不存在' });
    }

    // 验证密码
    if (userData.password && userData.password !== password) {
        return res.status(401).json({ error: '密码错误' });
    }

    // 删除用户数据
    await redis.srem('users', userId);
    await redis.del(`user:${userId}`);
    await redis.del(`config:${userId}`);

    return res.status(200).json({ success: true });
}
