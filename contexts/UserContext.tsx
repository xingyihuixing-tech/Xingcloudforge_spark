/**
 * 用户状态管理 Context (V2)
 * 
 * input: 无（顶层Provider）
 * output: UserContext - 提供用户状态和操作方法给所有子组件
 * pos: 应用的用户状态管理核心，提供登录状态、用户信息、配置同步功能
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ============ 类型定义 ============

export interface User {
    id: string;
    name: string;
    avatar: string; // 星球预设标识或图片URL
    createdAt: string;
    password?: string; // 仅在API请求时使用
}

// 简化的用户摘要（用于本地存储列表）
export interface SavedUser {
    id: string;
    name: string;
    avatar: string;
    lastLogin: number;
    isLoggedOut?: boolean; // 新增：是否显式登出
}

// 用户配置结构
export interface UserConfig {
    version: number;
    updatedAt: string;
    settings?: Record<string, unknown>;
    planetScene?: Record<string, unknown>;
    presets?: Array<Record<string, unknown>>;
    [key: string]: any;
}

interface UserContextType {
    currentUser: User | null;
    savedUsers: SavedUser[]; // 本地记住的用户列表
    isLoading: boolean;
    isOnline: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';

    // 动作
    login: (userId: string, password?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    switchAccount: () => void;
    register: (userId: string, name: string, password?: string, avatar?: string) => Promise<{ success: boolean; error?: string }>;
    removeSavedUser: (userId: string) => void; // "忘记账号"

    // 用户管理
    updateProfile: (name: string, avatar: string) => Promise<boolean>;
    changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
    uploadAvatar: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>; // 新增

    // 配置
    loadCloudConfig: () => Promise<UserConfig | null>;
    saveCloudConfig: (config: Partial<UserConfig>) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 本地存储键
const SAVED_USERS_KEY = 'nebula_saved_users';
const CURRENT_USER_KEY = 'nebula_current_user_id';
const OFFLINE_CONFIG_PREFIX = 'nebula_offline_config_';

export function UserProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [savedUsers, setSavedUsers] = useState<SavedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    // 初始化加载
    useEffect(() => {
        // 1. 加载本地保存的用户列表
        try {
            const saved = localStorage.getItem(SAVED_USERS_KEY);
            if (saved) {
                setSavedUsers(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Failed to load saved users', e);
        }

        // 2. 尝试自动恢复登录（如果有上次登录记录）
        // 注意：这里仅恢复UI状态，实际上Token验证应在API层。
        // 为了更好的体验，如果本地列表有该用户，我们默认信任并恢复（仅限无密码或Session有效场景）
        // 简化实现：直接恢复显示
        const lastUserId = localStorage.getItem(CURRENT_USER_KEY);
        if (lastUserId) {
            const saved = localStorage.getItem(SAVED_USERS_KEY);
            if (saved) {
                const users = JSON.parse(saved) as SavedUser[];
                const user = users.find(u => u.id === lastUserId);
                // 只有当用户没有显式登出时才自动恢复
                if (user && !user.isLoggedOut) {
                    setCurrentUser({
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        createdAt: new Date(user.lastLogin).toISOString()
                    });
                }
            }
        }

        setIsLoading(false);

        // 监听网络状态
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 更新本地存储
    const updateSavedUsers = (user: User, isLoggedOut: boolean = false) => {
        setSavedUsers(prev => {
            // 移除旧的（如果存在）
            const filtered = prev.filter(u => u.id !== user.id);
            // 添加新的到头部
            const newUser: SavedUser = {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                lastLogin: Date.now(),
                isLoggedOut
            };
            const newList = [newUser, ...filtered];
            localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(newList));
            return newList;
        });
    };

    const login = async (userId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setSyncStatus('syncing');

        const localUser = savedUsers.find(u => u.id === userId);

        // 如果没有提供密码，且本地有记录且没登出 -> 信任本地进行免密登录
        if (!password && localUser && !localUser.isLoggedOut) {
            const user = {
                id: localUser.id,
                name: localUser.name,
                avatar: localUser.avatar,
                createdAt: new Date().toISOString()
            };
            setCurrentUser(user);
            localStorage.setItem(CURRENT_USER_KEY, userId);
            updateSavedUsers(user, false); // 更新时间，并确保标记为未登出
            setIsLoading(false);
            setSyncStatus('idle');
            return { success: true };
        }

        try {
            // 离线/模拟登录
            if (!isOnline) {
                if (localUser) {
                    const user = {
                        id: localUser.id,
                        name: localUser.name,
                        avatar: localUser.avatar,
                        createdAt: new Date().toISOString()
                    };
                    setCurrentUser(user);
                    localStorage.setItem(CURRENT_USER_KEY, userId);
                    updateSavedUsers(user, false);
                    setSyncStatus('idle');
                    setIsLoading(false);
                    return { success: true };
                }
                // 如果是新用户且离线，无法登录
                setIsLoading(false);
                return { success: false, error: "离线模式下仅允许已保存用户登录" };
            }

            // API 登录请求
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', userId, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setIsLoading(false);
                setSyncStatus('error');
                return { success: false, error: data.error || '登录失败' };
            }

            const user = data.user;
            setCurrentUser(user);
            localStorage.setItem(CURRENT_USER_KEY, user.id);

            // 成功登录后，加入本地记忆列表，并标记为未登出
            updateSavedUsers(user, false);

            setSyncStatus('idle');
            setIsLoading(false);
            return { success: true };

        } catch (error) {
            console.error('Login error:', error);
            setIsLoading(false);
            setSyncStatus('error');
            return { success: false, error: '网络错误，请重试' };
        }
    };

    const register = async (userId: string, name: string, password?: string, avatar?: string): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', userId, name, password, avatar })
            });

            const data = await res.json();

            if (!res.ok) {
                setIsLoading(false);
                return { success: false, error: data.error || '注册失败' };
            }

            const user = data.user;
            setCurrentUser(user);
            localStorage.setItem(CURRENT_USER_KEY, user.id);
            updateSavedUsers(user);

            setIsLoading(false);
            return { success: true };
        } catch (error) {
            setIsLoading(false);
            return { success: false, error: '网络错误，请重试' };
        }
    };

    const updateProfile = async (name: string, avatar: string): Promise<boolean> => {
        if (!currentUser) return false;

        try {
            const res = await fetch('/api/auth', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, name, avatar })
            });

            if (res.ok) {
                // 更新本地状态
                const updatedUser = { ...currentUser, name, avatar };
                setCurrentUser(updatedUser);
                updateSavedUsers(updatedUser);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    const changePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
        if (!currentUser) return { success: false, error: '未登录' };

        try {
            const res = await fetch('/api/auth', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    oldPassword: oldPass,
                    newPassword: newPass
                })
            });

            const data = await res.json();
            if (res.ok) return { success: true };
            return { success: false, error: data.error || '修改失败' };
        } catch (e) {
            return { success: false, error: '网络错误' };
        }
    };

    // 忘记账号（移除本地记录）
    const removeSavedUser = (userId: string) => {
        setSavedUsers(prev => {
            const newList = prev.filter(u => u.id !== userId);
            localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(newList));
            return newList;
        });
        // 如果移除的是当前登录用户，则登出
        if (currentUser?.id === userId) {
            logout();
        }
    };

    const logout = () => {
        if (currentUser) {
            setSavedUsers(prev => {
                const newList = prev.map(u =>
                    u.id === currentUser.id ? { ...u, isLoggedOut: true } : u
                );
                localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(newList));
                return newList;
            });
        }
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
    };

    const switchAccount = () => {
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
    };

    const uploadAvatar = async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
        if (!currentUser) return { success: false, error: '未登录' };

        try {
            console.log('Starting upload for:', file.name, 'Size:', file.size);
            const res = await fetch(`/api/upload?userId=${currentUser.id}&fileName=${encodeURIComponent(file.name)}`, {
                method: 'POST',
                body: file,
                headers: {
                    // 通常 fetch body 为 File 时不需要手动设置 Content-Type，浏览器会自动处理 multipart/boundary
                    // 但这里 api/upload 似乎是 raw streaming body 读取，所以不要设置 boundary?
                    // api/upload.ts 用 'for await chunks' 读取，说明是 raw body。
                    // 浏览器发送 File body 时，默认 content-type 是文件的 MIME type。
                }
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('Upload failed endpoint:', res.status, res.statusText, text);
                if (res.status === 404) {
                    return { success: false, error: '上传服务未找到 (Local Dev需配置Proxy或使用Vercel)' };
                }
                try {
                    const json = JSON.parse(text);
                    return { success: false, error: json.error || `Upload failed: ${res.status}` };
                } catch {
                    return { success: false, error: `Upload error: ${res.status} ${res.statusText}` };
                }
            }

            const data = await res.json();
            console.log('Upload success:', data);

            if (data.url) {
                // 更新头像
                await updateProfile(currentUser.name, data.url);
                return { success: true, url: data.url };
            } else {
                return { success: false, error: 'No URL returned' };
            }
        } catch (err: any) {
            console.error('Upload network error:', err);
            return { success: false, error: err.message || 'Network Error' };
        }
    };

    const loadCloudConfig = async () => {
        if (!currentUser) return null;

        const cacheKey = OFFLINE_CONFIG_PREFIX + currentUser.id;
        const cached = localStorage.getItem(cacheKey);
        let config: UserConfig | null = cached ? JSON.parse(cached) : null;

        if (isOnline) {
            try {
                const res = await fetch(`/api/config?userId=${currentUser.id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.config) {
                        config = data.config;
                        localStorage.setItem(cacheKey, JSON.stringify(config));
                    }
                }
            } catch (e) {
                console.warn('Failed to load cloud config', e);
            }
        }
        return config;
    };

    const saveCloudConfig = async (config: Partial<UserConfig>) => {
        if (!currentUser) return false;

        const cacheKey = OFFLINE_CONFIG_PREFIX + currentUser.id;
        const currentConfigStr = localStorage.getItem(cacheKey);
        const newConfig = {
            ...(currentConfigStr ? JSON.parse(currentConfigStr) : {}),
            ...config,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(cacheKey, JSON.stringify(newConfig));

        if (isOnline) {
            try {
                setSyncStatus('syncing');
                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, config: newConfig })
                });
                setSyncStatus('synced');
                return true;
            } catch (e) {
                setSyncStatus('error');
                return false;
            }
        }
        return true;
    };

    const value = {
        currentUser,
        savedUsers,
        isLoading,
        isOnline,
        syncStatus,
        login,
        logout,
        switchAccount,
        register,
        removeSavedUser,
        updateProfile,
        changePassword,
        uploadAvatar,
        loadCloudConfig,
        saveCloudConfig
    };

    return (
        <UserContext.Provider value={value}>{children}</UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
