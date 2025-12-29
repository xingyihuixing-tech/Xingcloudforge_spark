import React, { useState } from 'react';
import { useUser, User } from '../contexts/UserContext';
import { PlanetAvatar } from './PlanetAvatar';

export const UserMenu: React.FC = () => {
    const { currentUser, logout, switchAccount, updateProfile, changePassword, uploadAvatar } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'profile' | 'password' | null>(null);

    if (!currentUser) return null;

    const handleLogout = () => {
        logout();
        setIsOpen(false);
    };

    const handleSwitch = () => {
        switchAccount(); // 保留免密
        setIsOpen(false);
    };

    return (
        <div className="relative z-50">
            {/* 触发器 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-xl transition-all duration-300 hover:bg-white/10 group"
                style={{
                    background: 'rgba(20,20,30,0.4)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <PlanetAvatar userId={currentUser.id} imageUrl={currentUser.avatar} size="sm" className="group-hover:scale-105 transition-transform" />
                <span className="text-sm text-white/90 font-medium hidden sm:block max-w-[100px] truncate shadow-black drop-shadow-md">
                    {currentUser.name}
                </span>
                <i className={`fas fa-chevron-down text-xs text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        className="absolute top-full right-0 mt-2 w-60 p-2 rounded-xl border border-white/10 z-50 transform origin-top-right animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200"
                        style={{
                            background: 'rgba(15, 15, 25, 0.95)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.8)'
                        }}
                    >
                        <div className="px-3 py-3 border-b border-white/5 mb-1">
                            <p className="text-xs text-white/40 mb-0.5">Signed in as</p>
                            <p className="text-sm text-white font-medium truncate tracking-wide">{currentUser.name}</p>
                            <p className="text-xs text-white/30 font-mono truncate mt-0.5 opacity-60">@{currentUser.id}</p>
                        </div>

                        <MenuItem icon="user-edit" label="Edit Profile" onClick={() => { setModalMode('profile'); setIsOpen(false); }} />
                        <MenuItem icon="key" label="Change Password" onClick={() => { setModalMode('password'); setIsOpen(false); }} />

                        <div className="h-px bg-white/10 my-1 mx-2" />

                        <MenuItem icon="exchange-alt" label="Switch Account" onClick={handleSwitch} />
                        <MenuItem icon="sign-out-alt" label="Log Out" variant="danger" onClick={handleLogout} />
                    </div>
                </>
            )}

            {/* 模态框 */}
            {modalMode && (
                <SettingsModal
                    mode={modalMode}
                    user={currentUser}
                    onClose={() => setModalMode(null)}
                    updateProfile={updateProfile}
                    changePassword={changePassword}
                    uploadAvatar={uploadAvatar}
                />
            )}
        </div>
    );
};

const MenuItem = ({ icon, label, onClick, variant = 'default' }: { icon: string, label: string, onClick: () => void, variant?: 'default' | 'danger' }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${variant === 'danger'
            ? 'text-red-400 hover:bg-red-500/10 hover:pl-4'
            : 'text-white/70 hover:bg-white/10 hover:text-white hover:pl-4'
            }`}
    >
        <i className={`fas fa-${icon} w-5 text-center opacity-70`} />
        {label}
    </button>
);

// 设置模态框子组件
const SettingsModal = ({
    mode,
    user,
    onClose,
    updateProfile,
    changePassword,
    uploadAvatar
}: {
    mode: 'profile' | 'password',
    user: User,
    onClose: () => void,
    updateProfile: (name: string, avatar: string) => Promise<boolean>,
    changePassword: (oldP: string, newP: string) => Promise<{ success: boolean, error?: string }>,
    uploadAvatar: (file: File) => Promise<{ success: boolean, url?: string, error?: string }>
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Profile State
    const [name, setName] = useState(user.name);
    const [avatarUrl, setAvatarUrl] = useState(user.avatar || '');

    // File Upload State
    const [isUploading, setIsUploading] = useState(false);

    // Password State
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                setError('Image too large (max 2MB)');
                return;
            }

            setIsUploading(true);
            setError('');

            const res = await uploadAvatar(file);
            if (res.success && res.url) {
                setAvatarUrl(res.url); // Preview immediately
                setSuccessMsg('Avatar uploaded!');
            } else {
                setError(res.error || 'Upload failed');
            }
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccessMsg('');

        if (mode === 'profile') {
            const success = await updateProfile(name, avatarUrl);
            if (success) {
                setSuccessMsg('Profile updated!');
                setTimeout(onClose, 1000);
            } else {
                setError('Failed to update profile');
            }
        } else {
            if (newPass.length < 6) {
                setError('Password too short (min 6)');
                setIsLoading(false);
                return;
            }
            const res = await changePassword(oldPass, newPass);
            if (res.success) {
                setSuccessMsg('Password changed!');
                setTimeout(onClose, 1000);
            } else {
                setError(res.error || 'Failed to change password');
            }
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-md bg-[#0f1016] border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300"
                style={{ boxShadow: '0 0 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors">
                    <i className="fas fa-times text-lg" />
                </button>

                <h2 className="text-xl text-white font-semibold mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                        {mode === 'profile' ? <i className="fas fa-user-edit" /> : <i className="fas fa-key" />}
                    </div>
                    {mode === 'profile' ? 'Edit Profile' : 'Change Password'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <i className="fas fa-exclamation-circle" /> {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-300 text-sm rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <i className="fas fa-check-circle" /> {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {mode === 'profile' ? (
                        <>
                            <div className="flex flex-col items-center mb-6 gap-4">
                                <div className="relative group cursor-pointer">
                                    <PlanetAvatar userId={user.id} imageUrl={avatarUrl} size="lg" />
                                    {/* Upload Overlay */}
                                    <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-semibold backdrop-blur-sm">
                                        {isUploading ? <i className="fas fa-spinner fa-spin" /> : 'UPLOAD'}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                                    </label>
                                </div>
                                {/* 增加一个文字提示 */}
                                <p className="text-xs text-white/40">Click avatar to upload new image</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-white/40 ml-1 uppercase tracking-wider font-semibold">Nickname</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 focus:bg-white/10 focus:outline-none transition-all"
                                    placeholder="Enter nickname"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-xs text-white/40 ml-1 uppercase tracking-wider font-semibold">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPass}
                                    onChange={e => setOldPass(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 focus:bg-white/10 focus:outline-none transition-all"
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-white/40 ml-1 uppercase tracking-wider font-semibold">New Password</label>
                                <input
                                    type="password"
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500/50 focus:bg-white/10 focus:outline-none transition-all"
                                    placeholder="Min 6 characters"
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || isUploading}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
