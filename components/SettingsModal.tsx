import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../contexts/UserContext';
import { PlanetAvatar } from './PlanetAvatar';
import { base64ToBlob } from '../services/imageProcessing';

interface SettingsModalProps {
    mode: 'profile' | 'password';
    user: User;
    onClose: () => void;
    updateProfile: (updates: Partial<User>) => Promise<boolean>;
    changePassword: (oldPw: string, newPw: string) => Promise<boolean>;
    uploadAvatar: (file: File) => Promise<{ success: boolean; url: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    mode, user, onClose, updateProfile, changePassword, uploadAvatar
}) => {
    const [name, setName] = useState(user.name);
    const [bio, setBio] = useState(user.bio || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleProfileUpdate = async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const result = await updateProfile({ name, bio });
            if (result) {
                setSuccess('Profile updated successfully');
                setTimeout(onClose, 1000);
            } else {
                setError('Failed to update profile');
            }
        } catch (e) {
            setError('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const result = await changePassword(oldPassword, newPassword);
            if (result) {
                setSuccess('Password changed successfully');
                setTimeout(onClose, 1000);
            } else {
                setError('Incorrect old password');
            }
        } catch (e) {
            setError('An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const res = await uploadAvatar(file);
            if (res.success) {
                await updateProfile({ avatar: res.url });
                setSuccess('Avatar updated');
            } else {
                setError('Upload failed');
            }
        } catch (err) {
            setError('Upload error');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-[400px] bg-[#0f1016] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
                    <i className="fas fa-times" />
                </button>

                <h2 className="text-xl font-medium text-white mb-6">
                    {mode === 'profile' ? 'Edit Profile' : 'Change Password'}
                </h2>

                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{error}</div>}
                {success && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">{success}</div>}

                {mode === 'profile' ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-4">
                            <PlanetAvatar userId={user.id} imageUrl={user.avatar} size="lg" />
                            <div>
                                <label className="block text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer">
                                    Change Avatar
                                    <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                                </label>
                                <p className="text-xs text-white/30 mt-1">Max 2MB, JPG/PNG</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Display Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Bio</label>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors h-24 resize-none"
                            />
                        </div>
                        <button
                            onClick={handleProfileUpdate}
                            disabled={isLoading}
                            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors mt-2 disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Current Password</label>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>
                        <button
                            onClick={handlePasswordChange}
                            disabled={isLoading}
                            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors mt-2 disabled:opacity-50"
                        >
                            {isLoading ? 'Changing Password...' : 'Change Password'}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
