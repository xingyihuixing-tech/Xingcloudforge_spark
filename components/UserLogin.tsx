/**
 * 用户登录/选择界面组件 V2
 * 
 * input: UserContext (用户状态)
 * output: 极简星空风格登录界面，支持本机记忆模式
 * 
 * update: 一旦我被更新，务必更新我的开头注释
 */

import React, { useState, useEffect } from 'react';
import { useUser, SavedUser } from '../contexts/UserContext';
import { BackgroundManager } from './BackgroundManager';
import { PlanetAvatar } from './PlanetAvatar';

export function UserLogin() {
  const { savedUsers, login, register, removeSavedUser, currentUser, isLoading, isOnline } = useUser();

  // 视图模式：'saved-list' (记忆列表) | 'auth-form' (账号登录)
  // 如果没有保存的用户，默认进入 auth-form
  const [viewMode, setViewMode] = useState<'saved-list' | 'auth-form'>(
    savedUsers.length > 0 ? 'saved-list' : 'auth-form'
  );

  // 表单状态
  const [isRegistering, setIsRegistering] = useState(false); // 登录 vs 注册
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState(''); // 仅注册用

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 监听保存列表变化，如果清空了自动跳到表单
  useEffect(() => {
    if (savedUsers.length === 0 && viewMode === 'saved-list') {
      setViewMode('auth-form');
    }
  }, [savedUsers, viewMode]);

  // 处理登录提交
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError('请输入User ID');
      return;
    }

    setIsSubmitting(true);
    setError('');

    let res;
    if (isRegistering) {
      if (!nickname.trim()) {
        setError('请输入昵称');
        setIsSubmitting(false);
        return;
      }
      if (password && password.length < 6) {
        setError('密码至少6位');
        setIsSubmitting(false);
        return;
      }
      // 注册：生成默认星球头像 (以userId为seed)
      res = await register(
        userId.trim().toLowerCase(),
        nickname.trim(),
        password || undefined,
        undefined // 让后端或Context处理默认头像逻辑，或者这里传空
      );
    } else {
      res = await login(userId.trim().toLowerCase(), password || undefined);
    }

    if (!res.success) {
      setError(res.error || '操作失败');
    }

    setIsSubmitting(false);
  };

  // 处理快捷登录
  const handleQuickLogin = async (user: SavedUser) => {
    // 尝试无密码登录/自动恢复
    const res = await login(user.id);
    if (res.success) {
      // success - Context updates, redirect/UI update happens automatically via currentUser change
    } else {
      // 失败（通常是因为Token过期或Logout后需要密码）
      // 不要显示错误，直接跳转输入框让用户输入密码
      setUserId(user.id);
      setPassword(''); // Ensure password is empty
      setViewMode('auth-form');
      // setError(res.error || '需要验证密码'); // 用户反馈不希望看到错误，直接输入密码
      setError(''); // Clear error
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        <div className="animate-spin text-4xl">🌌</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden font-sans text-white select-none">
      {/* 动态背景管理器 */}
      <BackgroundManager />

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4">

        {/* 标题区 - 品牌升级 */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-top-10 duration-700 pt-12 pb-6">
          <h1 className="text-7xl md:text-8xl mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 animate-pulse leading-relaxed py-4 drop-shadow-[0_0_50px_rgba(50,200,255,0.8)]"
            style={{ fontFamily: '"Great Vibes", cursive' }}>
            Xingstar Space
          </h1>
          <p className="text-cyan-200/80 text-sm md:text-base tracking-[0.5em] uppercase font-light drop-shadow-md" style={{ fontFamily: '"Orbitron", sans-serif' }}>
            Particle Visualization Engine
          </p>
        </div>

        {/* 错误提示 - 修复背景 */}
        {error && (
          <div className="mb-6 px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl backdrop-blur-md animate-in slide-in-from-top-5 max-w-md text-center shadow-lg">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </div>
        )}

        {/* 场景 A: 记忆列表 */}
        {viewMode === 'saved-list' && (
          <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-wrap justify-center items-center gap-8 mb-10">
              {savedUsers.map(user => (
                <div key={user.id} className="group relative flex flex-col items-center">
                  <button
                    onClick={() => handleQuickLogin(user)}
                    className="relative w-28 h-28 md:w-32 md:h-32 rounded-full transition-transform duration-300 group-hover:scale-110 focus:outline-none"
                  >
                    <PlanetAvatar userId={user.id} imageUrl={user.avatar} size="xl" className="w-full h-full shadow-2xl shadow-cyan-500/20" />
                    <div className="absolute inset-0 rounded-full ring-4 ring-transparent group-hover:ring-cyan-500/30 transition-all duration-500" />
                  </button>
                  <span className="mt-4 text-lg font-medium text-white/90 group-hover:text-cyan-300 transition-colors drop-shadow-md">
                    {user.name}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定要忘记 "${user.name}" 吗？`)) removeSavedUser(user.id);
                    }}
                    className="absolute -top-1 -right-1 w-7 h-7 bg-white/10 hover:bg-red-500/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-md"
                  >
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
              ))}

              {/* Add Account Button - Wrapped like saved user cards for alignment */}
              <div className="group relative flex flex-col items-center">
                <button
                  onClick={() => {
                    setUserId('');
                    setPassword('');
                    setViewMode('auth-form');
                  }}
                  className="flex flex-col items-center justify-center gap-3 w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-dashed border-white/20 text-white/40 hover:border-cyan-400/50 hover:text-cyan-300 hover:bg-white/5 transition-all duration-300"
                >
                  <i className="fas fa-plus text-2xl group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium tracking-wide">ADD</span>
                </button>
                <span className="mt-4 text-lg font-medium text-white/40 group-hover:text-cyan-300 transition-colors drop-shadow-md">
                  New
                </span>
              </div>
            </div>
            {/* Clear All Button */}
            <button
              onClick={() => {
                if (confirm('确定要清除所有本机记录吗？')) savedUsers.forEach(u => removeSavedUser(u.id));
              }}
              className="text-white/30 hover:text-white/60 text-xs tracking-wider transition-colors hover:underline"
            >
              CLEAR LOCAL HISTORY
            </button>
          </div>
        )}

        {/* 场景 B: 登录表单 */}
        {
          viewMode === 'auth-form' && (
            <div className="relative w-full max-w-sm md:max-w-md bg-black/8 backdrop-blur-sm border border-white/5 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-black/20 hover:shadow-[0_0_70px_rgba(0,0,0,0.6)] hover:border-white/10">

              {/* 头像预览 */}
              <div className="flex justify-center -mt-16 mb-6">
                <div className="bg-[#0f172a] p-2 rounded-full">
                  <PlanetAvatar userId={userId || 'guest'} size="lg" />
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="space-y-1">
                  <input
                    type="text"
                    value={userId}
                    onChange={e => setUserId(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    placeholder="User ID (e.g. alex)"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/40 focus:outline-none transition-all text-center leading-normal"
                    maxLength={20}
                    autoFocus
                  />
                </div>

                {isRegistering && (
                  <div className="space-y-1 animate-in fade-in height-auto">
                    <input
                      type="text"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      placeholder="Nickname"
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/40 focus:outline-none transition-all text-center"
                      maxLength={20}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={isRegistering ? "Password (6+ chars)" : "Password (optional)"}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/40 focus:outline-none transition-all text-center tracking-widest"
                      maxLength={10}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || (!userId && !isRegistering)}
                  className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
                >
                  {isSubmitting ? 'Processing...' : (isRegistering ? 'Sign Up' : 'Log In')}
                </button>
              </form>

              <div className="mt-6 flex justify-between items-center text-sm">
                {savedUsers.length > 0 && (
                  <button
                    onClick={() => setViewMode('saved-list')}
                    className="text-white/40 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-arrow-left" /> Back
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  className={`ml-auto ${savedUsers.length === 0 ? 'w-full text-center' : ''} text-cyan-400/80 hover:text-cyan-300 transition-colors`}
                >
                  {isRegistering ? 'Have an account? Log In' : 'New User? Sign Up'}
                </button>
              </div>
            </div>
          )
        }

      </div >
    </div >
  );
}
