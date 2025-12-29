/**
 * 文件上传API
 * 
 * input: FormData (包含文件) 或 JSON (删除请求)
 * output: JSON响应 (文件URL或错误信息)
 * pos: 处理用户文件上传，存储到Vercel Blob
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import { put, del, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: false, // 禁用默认body解析，用于处理FormData
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (req.method) {
            case 'GET':
                return await listFiles(req, res);
            case 'POST':
                return await uploadFile(req, res);
            case 'DELETE':
                return await deleteFile(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Upload API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// 列出用户文件
async function listFiles(req: VercelRequest, res: VercelResponse) {
    const userId = req.query.userId as string;
    const prefix = userId ? `users/${userId}/` : '';

    try {
        const { blobs } = await list({ prefix });

        const files = blobs.map(blob => ({
            url: blob.url,
            pathname: blob.pathname,
            size: blob.size,
            uploadedAt: blob.uploadedAt,
        }));

        return res.status(200).json({ files });
    } catch (error) {
        console.error('List files error:', error);
        return res.status(500).json({ error: 'Failed to list files' });
    }
}

// 上传文件
async function uploadFile(req: VercelRequest, res: VercelResponse) {
    // 从URL参数获取用户ID和文件类型
    const userId = req.query.userId as string;
    const fileType = req.query.type as string || 'file'; // 'background', 'texture', 'file'
    const fileName = req.query.fileName as string;

    if (!userId) {
        return res.status(400).json({ error: '用户ID不能为空' });
    }

    try {
        // 读取请求体
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // 生成文件路径
        const timestamp = Date.now();
        const safeName = fileName || `${fileType}_${timestamp}`;
        const pathname = `users/${userId}/${fileType}s/${safeName}`;

        // 上传到Blob
        const blob = await put(pathname, buffer, {
            access: 'public',
            addRandomSuffix: false,
        });

        return res.status(200).json({
            success: true,
            url: blob.url,
            pathname: blob.pathname,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Failed to upload file' });
    }
}

// 删除文件
async function deleteFile(req: VercelRequest, res: VercelResponse) {
    const url = req.query.url as string;

    if (!url) {
        return res.status(400).json({ error: '文件URL不能为空' });
    }

    try {
        await del(url);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete file' });
    }
}
