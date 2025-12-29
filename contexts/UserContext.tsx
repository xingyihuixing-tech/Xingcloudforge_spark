/**
 * 用户状态管理 Context
 * 
 * input: 无（顶层Provider）
 * output: UserContext - 提供用户状态和操作方法给所有子组件
 * pos: 应用的用户状态管理核心，提供登录状态、用户信息、配置同步功能
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============ 类型定义 ============

export interface User {
    id: string;
    name: string;
    avatar: string;
    createdAt: string;
}

export interface UserConfig {
    version: number;
    updatedAt: string;
    settings?: Record<string, unknown>;
    planetScene?: Record<string, unknown>;
    presets?: Array<Record<string, unknown>>;
    solidCorePresets?: Array<Record<string, unknown>>;
    planetTemplates?: Array<Record<string, unknown>>;
}

interface UserContextType {
    // 状态
    currentUser: User | null;
    users: User[];
    isLoading: boolean;
    isOnline: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    lastSyncTime: Date | null;

    // 用户操作
    login: (userId: string, password?: string) => Promise<boolean>;
    logout: () => void;
    register: (userId: string, name: string, password?: string, avatar?: string) => Promise<boolean>;
    refreshUsers: () => Promise<void>;

    // 配置操作
    loadCloudConfig: () => Promise<UserConfig | null>;
    saveCloudConfig: (config: Partial<UserConfig>) => Promise<boolean>;

    // API基础URL
    apiBaseUrl: string;
}

// ============ Context 创建 ============

const UserContext = createContext<UserContextType | null>(null);

// 本地存储键
const CURRENT_USER_KEY = 'nebula_current_user';
const LOCAL_CONFIG_CACHE_KEY = 'nebula_config_cache';

// API基础URL（根据环境自动判断）
const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return '';

    // 生产环境使用相对路径
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return '';
    }

    // 本地开发 - 需要通过Vercel CLI运行才能测试API
    // 如果直接用 vite dev，API不可用
    return '';
};

// ============ Provider 组件 ============

export function UserProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    const apiBaseUrl = getApiBaseUrl();

    // 监听网络状态
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 初始化：尝试恢复登录状态
    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);

            // 尝试从本地存储恢复用户
            const savedUser = localStorage.getItem(CURRENT_USER_KEY);
            if (savedUser) {
                try {
                    const user = JSON.parse(savedUser) as User;
                    setCurrentUser(user);
                } catch (e) {
                    localStorage.removeItem(CURRENT_USER_KEY);
                }
            }

            // 获取用户列表
            await refreshUsers();
            setIsLoading(false);
        };

        initAuth();
    }, []);

    // 刷新用户列表
    const refreshUsers = useCallback(async () => {
        if (!isOnline) return;

        try {
            const response = await fetch(`${apiBaseUrl}/api/auth`);
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    }, [apiBaseUrl, isOnline]);

    // 登录
    const login = useCallback(async (userId: string, password?: string): Promise<boolean> => {
        if (!isOnline) {
            // 离线模式：检查本地缓存
            const savedUser = localStorage.getItem(CURRENT_USER_KEY);
            if (savedUser) {
                const user = JSON.parse(savedUser) as User;
                if (user.id === userId) {
                    setCurrentUser(user);
                    return true;
                }
            }
            return false;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', userId, password }),
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentUser(data.user);
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user));
                return true;
            }

            return false;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }, [apiBaseUrl, isOnline]);

    // 登出
    const logout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem(CURRENT_USER_KEY);
    }, []);

    // 注册
    const register = useCallback(async (
        userId: string,
        name: string,
        password?: string,
        avatar?: string
    ): Promise<boolean> => {
        if (!isOnline) {
            return false;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', userId, name, password, avatar }),
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentUser(data.user);
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user));
                await refreshUsers();
                return true;
            }

            return false;
        } catch (error) {
            console.error('Register failed:', error);
            return false;
        }
    }, [apiBaseUrl, isOnline, refreshUsers]);

    // 加载云端配置
    const loadCloudConfig = useCallback(async (): Promise<UserConfig | null> => {
        if (!currentUser) return null;

        setSyncStatus('syncing');

        // 尝试从云端加载
        if (isOnline) {
            try {
                const response = await fetch(`${apiBaseUrl}/api/config?userId=${currentUser.id}`);
                if (response.ok) {
                    const data = await response.json();

                    // 缓存到本地
                    localStorage.setItem(
                        `${LOCAL_CONFIG_CACHE_KEY}_${currentUser.id}`,
                        JSON.stringify(data.config)
                    );

                    setSyncStatus('synced');
                    setLastSyncTime(new Date());
                    return data.config;
                }
            } catch (error) {
                console.error('Failed to load cloud config:', error);
            }
        }

        // 回退到本地缓存
        try {
            const cached = localStorage.getItem(`${LOCAL_CONFIG_CACHE_KEY}_${currentUser.id}`);
            if (cached) {
                setSyncStatus('idle');
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error('Failed to load cached config');
        }

        setSyncStatus('error');
        return null;
    }, [apiBaseUrl, currentUser, isOnline]);

    // 保存配置到云端
    const saveCloudConfig = useCallback(async (config: Partial<UserConfig>): Promise<boolean> => {
        if (!currentUser) return false;

        // 先保存到本地缓存
        const existingCache = localStorage.getItem(`${LOCAL_CONFIG_CACHE_KEY}_${currentUser.id}`);
        const existingConfig = existingCache ? JSON.parse(existingCache) : {};
        const mergedConfig = { ...existingConfig, ...config };
        localStorage.setItem(`${LOCAL_CONFIG_CACHE_KEY}_${currentUser.id}`, JSON.stringify(mergedConfig));

        if (!isOnline) {
            setSyncStatus('idle');
            return true; // 离线时返回成功，后续联网同步
        }

        setSyncStatus('syncing');

        try {
            const response = await fetch(`${apiBaseUrl}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, config }),
            });

            if (response.ok) {
                setSyncStatus('synced');
                setLastSyncTime(new Date());
                return true;
            }
        } catch (error) {
            console.error('Failed to save cloud config:', error);
        }

        setSyncStatus('error');
        return false;
    }, [apiBaseUrl, currentUser, isOnline]);

    const value: UserContextType = {
        currentUser,
        users,
        isLoading,
        isOnline,
        syncStatus,
        lastSyncTime,
        login,
        logout,
        register,
        refreshUsers,
        loadCloudConfig,
        saveCloudConfig,
        apiBaseUrl,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

// ============ Hook ============

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}

export default UserContext;
