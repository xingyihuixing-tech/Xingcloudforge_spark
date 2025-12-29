/**
 * 用户登录/选择界面组件
 * 
 * input: UserContext (用户状态)
 * output: 用户选择/登录/注册界面
 * pos: 应用入口组件，未登录时显示此界面
 * 
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useEffect } from 'react';
import { useUser, User } from '../contexts/UserContext';

// 可选头像列表
const AVATAR_OPTIONS = ['👨', '👩', '👧', '👦', '👴', '👵', '🧑', '👤', '🦸', '🧙', '👽', '🤖', '🌟', '🔮', '🚀', '🌙'];

interface UserLoginProps {
    onLoginSuccess?: () => void;
}

export function UserLogin({ onLoginSuccess }: UserLoginProps) {
    const { users, login, register, refreshUsers, isLoading, isOnline } = useUser();

    const [mode, setMode] = useState<'select' | 'login' | 'register'>('select');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 注册表单
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('👤');

    useEffect(() => {
        refreshUsers();
    }, [refreshUsers]);

    const handleUserSelect = (user: User) => {
        setSelectedUser(user);
        setMode('login');
        setPassword('');
        setError('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsSubmitting(true);
        setError('');

        const success = await login(selectedUser.id, password || undefined);

        if (success) {
            onLoginSuccess?.();
        } else {
            setError('密码错误，请重试');
        }

        setIsSubmitting(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newUserId.trim()) {
            setError('请输入用户ID');
            return;
        }
        if (!newUserName.trim()) {
            setError('请输入显示名称');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const success = await register(
            newUserId.trim().toLowerCase(),
            newUserName.trim(),
            newPassword || undefined,
            selectedAvatar
        );

        if (success) {
            onLoginSuccess?.();
        } else {
            setError('注册失败，用户ID可能已存在');
        }

        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="user-login-container">
                <div className="user-login-card">
                    <div className="loading-spinner" />
                    <p>加载中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="user-login-container">
            <div className="user-login-card">
                {/* 标题 */}
                <div className="login-header">
                    <h1>🌌 星云粒子可视化</h1>
                    <p className="login-subtitle">
                        {!isOnline && <span className="offline-badge">离线模式</span>}
                        {mode === 'select' && '选择用户或创建新用户'}
                        {mode === 'login' && `欢迎回来，${selectedUser?.name}`}
                        {mode === 'register' && '创建新用户'}
                    </p>
                </div>

                {/* 错误提示 */}
                {error && <div className="login-error">{error}</div>}

                {/* 用户选择模式 */}
                {mode === 'select' && (
                    <div className="user-select-grid">
                        {users.length > 0 ? (
                            users.map(user => (
                                <button
                                    key={user.id}
                                    className="user-avatar-button"
                                    onClick={() => handleUserSelect(user)}
                                >
                                    <span className="avatar">{user.avatar}</span>
                                    <span className="name">{user.name}</span>
                                </button>
                            ))
                        ) : (
                            <p className="no-users-hint">暂无用户，请创建一个</p>
                        )}

                        <button
                            className="user-avatar-button add-user"
                            onClick={() => setMode('register')}
                            disabled={!isOnline}
                        >
                            <span className="avatar">➕</span>
                            <span className="name">新建用户</span>
                        </button>
                    </div>
                )}

                {/* 登录模式 */}
                {mode === 'login' && selectedUser && (
                    <form onSubmit={handleLogin} className="login-form">
                        <div className="selected-user-display">
                            <span className="big-avatar">{selectedUser.avatar}</span>
                            <span className="user-name">{selectedUser.name}</span>
                        </div>

                        <div className="form-group">
                            <label>密码（如果设置了）</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="输入4位密码，没有则留空"
                                maxLength={4}
                                className="password-input"
                                autoFocus
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setMode('select');
                                    setSelectedUser(null);
                                }}
                            >
                                返回
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '登录中...' : '进入'}
                            </button>
                        </div>
                    </form>
                )}

                {/* 注册模式 */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="login-form">
                        <div className="avatar-picker">
                            <label>选择头像</label>
                            <div className="avatar-grid">
                                {AVATAR_OPTIONS.map(avatar => (
                                    <button
                                        key={avatar}
                                        type="button"
                                        className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                                        onClick={() => setSelectedAvatar(avatar)}
                                    >
                                        {avatar}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>用户ID（英文/数字）</label>
                            <input
                                type="text"
                                value={newUserId}
                                onChange={e => setNewUserId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                placeholder="例如: dad, mom, xiaoming"
                                maxLength={20}
                                className="text-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>显示名称</label>
                            <input
                                type="text"
                                value={newUserName}
                                onChange={e => setNewUserName(e.target.value)}
                                placeholder="例如: 爸爸, 妈妈, 小明"
                                maxLength={20}
                                className="text-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>密码（可选，4位数字）</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value.replace(/\D/g, ''))}
                                placeholder="留空则无需密码"
                                maxLength={4}
                                className="password-input"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setMode('select');
                                    setNewUserId('');
                                    setNewUserName('');
                                    setNewPassword('');
                                }}
                            >
                                返回
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSubmitting || !isOnline}
                            >
                                {isSubmitting ? '创建中...' : '创建用户'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
        .user-login-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a2a 100%);
          z-index: 9999;
        }

        .user-login-card {
          background: rgba(20, 20, 40, 0.95);
          border-radius: 20px;
          padding: 40px;
          min-width: 400px;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
                      0 0 100px rgba(100, 100, 255, 0.1);
          border: 1px solid rgba(100, 100, 200, 0.2);
          backdrop-filter: blur(20px);
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-header h1 {
          font-size: 28px;
          color: #fff;
          margin: 0 0 10px 0;
          background: linear-gradient(135deg, #a8edea, #fed6e3);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-subtitle {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          margin: 0;
        }

        .offline-badge {
          display: inline-block;
          background: rgba(255, 150, 0, 0.2);
          color: #ffa500;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          margin-right: 8px;
        }

        .login-error {
          background: rgba(255, 100, 100, 0.1);
          border: 1px solid rgba(255, 100, 100, 0.3);
          color: #ff6b6b;
          padding: 10px 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .user-select-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 15px;
        }

        .user-avatar-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px 15px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .user-avatar-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(100, 200, 255, 0.5);
          transform: translateY(-3px);
        }

        .user-avatar-button .avatar {
          font-size: 40px;
        }

        .user-avatar-button .name {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }

        .user-avatar-button.add-user {
          border-style: dashed;
        }

        .user-avatar-button.add-user:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .no-users-hint {
          grid-column: 1 / -1;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 20px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .selected-user-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px;
        }

        .big-avatar {
          font-size: 60px;
        }

        .user-name {
          font-size: 20px;
          color: #fff;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .text-input,
        .password-input {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 12px 15px;
          font-size: 16px;
          color: #fff;
          outline: none;
          transition: all 0.3s ease;
        }

        .text-input:focus,
        .password-input:focus {
          border-color: rgba(100, 200, 255, 0.5);
          background: rgba(255, 255, 255, 0.1);
        }

        .password-input {
          letter-spacing: 8px;
          text-align: center;
        }

        .avatar-picker label {
          display: block;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 10px;
        }

        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
        }

        .avatar-option {
          aspect-ratio: 1;
          font-size: 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .avatar-option:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .avatar-option.selected {
          border-color: #64c8ff;
          background: rgba(100, 200, 255, 0.2);
        }

        .form-actions {
          display: flex;
          gap: 15px;
          margin-top: 10px;
        }

        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 14px 20px;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(100, 100, 200, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #64c8ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}

export default UserLogin;
