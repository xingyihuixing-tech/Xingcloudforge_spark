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
    register: (userId: string, name: string, password?: string, avatar?: string) => Promise<{ success: boolean; error?: string }>;
    removeSavedUser: (userId: string) => void; // "忘记账号"

    // 用户管理
    updateProfile: (name: string, avatar: string) => Promise<boolean>;
    changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;

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
                if (user) {
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
    const updateSavedUsers = (user: User) => {
        setSavedUsers(prev => {
            // 移除旧的（如果存在）
            const filtered = prev.filter(u => u.id !== user.id);
            // 添加新的到头部
            const newUser: SavedUser = {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                lastLogin: Date.now()
            };
            const newList = [newUser, ...filtered];
            localStorage.setItem(SAVED_USERS_KEY, JSON.stringify(newList));
            return newList;
        });
    };

    const login = async (userId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        setSyncStatus('syncing');

        try {
            // 离线/模拟登录
            if (!isOnline) {
                const savedUser = savedUsers.find(u => u.id === userId);
                if (savedUser) {
                    const user = {
                        id: savedUser.id,
                        name: savedUser.name,
                        avatar: savedUser.avatar,
                        createdAt: new Date().toISOString()
                    };
                    setCurrentUser(user);
                    localStorage.setItem(CURRENT_USER_KEY, userId);
                    updateSavedUsers(user);
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

            // 成功登录后，加入本地记忆列表
            updateSavedUsers(user);

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
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
    };

    // --- 配置同步逻辑 ---
    const loadCloudConfig = async () => {
        if (!currentUser) return null;

        // 先尝试加载离线缓存
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
                        // 更新缓存
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

        // 1. 保存到本地缓存
        const cacheKey = OFFLINE_CONFIG_PREFIX + currentUser.id;
        const currentConfigStr = localStorage.getItem(cacheKey);
        const newConfig = {
            ...(currentConfigStr ? JSON.parse(currentConfigStr) : {}),
            ...config,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(cacheKey, JSON.stringify(newConfig));

        // 2. 如果在线，推送到云端
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
        register,
        removeSavedUser,
        updateProfile,
        changePassword,
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
