import React, { useState } from 'react';
import { useUser, User } from '../contexts/UserContext';
import { PlanetAvatar } from './PlanetAvatar';
import { ThemeSettingsModal } from './ThemeSettingsModal';
import { SettingsModal } from './SettingsModal';
import { AppSettings, PlanetSceneSettings, ThemeConfig, MaterialSettings, MaterialPreset } from '../types';

interface UserMenuProps {
    settings?: AppSettings;
    setSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
    planetSettings?: PlanetSceneSettings;
    setPlanetSettings?: React.Dispatch<React.SetStateAction<PlanetSceneSettings>>;
    appMode?: 'nebula' | 'planet';

    // 主题配置
    themeConfig?: ThemeConfig;
    setThemeConfig?: React.Dispatch<React.SetStateAction<ThemeConfig>>;
    // 材质配置
    materialSettings?: MaterialSettings;
    setMaterialSettings?: React.Dispatch<React.SetStateAction<MaterialSettings>>;
    // 材质预设
    userMaterialPresets?: MaterialPreset[];
    setUserMaterialPresets?: React.Dispatch<React.SetStateAction<MaterialPreset[]>>;
}

export const UserMenu: React.FC<UserMenuProps> = ({
    settings, setSettings, planetSettings, setPlanetSettings, appMode,

    themeConfig, setThemeConfig,
    materialSettings, setMaterialSettings,
    userMaterialPresets, setUserMaterialPresets
}) => {
    const { currentUser, logout, switchAccount, updateProfile, changePassword, uploadAvatar } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'profile' | 'password' | 'theme' | null>(null);

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
                        className="absolute top-full left-0 mt-2 w-60 p-2 rounded-xl border border-white/10 z-50 transform origin-top-left animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200"
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

                        <MenuItem icon="palette" label="Theme Settings" onClick={() => { setModalMode('theme'); setIsOpen(false); }} />
                        <div className="h-px bg-white/10 my-1 mx-2" />

                        <MenuItem icon="user-edit" label="Edit Profile" onClick={() => { setModalMode('profile'); setIsOpen(false); }} />
                        <MenuItem icon="key" label="Change Password" onClick={() => { setModalMode('password'); setIsOpen(false); }} />

                        <div className="h-px bg-white/10 my-1 mx-2" />

                        <MenuItem icon="exchange-alt" label="Switch Account" onClick={handleSwitch} />
                        <MenuItem icon="sign-out-alt" label="Log Out" variant="danger" onClick={handleLogout} />
                    </div>
                </>
            )}

            {/* 个人资料/密码设置弹窗 */}
            <SettingsModal
                isOpen={modalMode === 'profile' || modalMode === 'password'}
                mode={modalMode === 'password' ? 'password' : 'profile'}
                onClose={() => setModalMode(null)}
                user={currentUser}
                onUpdateProfile={async (data) => {
                    // UserContext.updateProfile expects (name, avatar) but we have Partial<User>
                    return await updateProfile(data.name || currentUser.name, data.avatar || currentUser.avatar);
                }}
                onChangePassword={async (oldPass, newPass) => {
                    const result = await changePassword(oldPass, newPass);
                    return result.success;
                }}
                onUploadAvatar={async (file) => {
                    const result = await uploadAvatar(file);
                    return { success: result.success, url: result.url || '' };
                }}
            />

            {/* 主题设置弹窗 */}
            <ThemeSettingsModal
                isOpen={modalMode === 'theme'}
                onClose={() => setModalMode(null)}
                settings={settings}
                setSettings={setSettings}
                planetSettings={planetSettings}
                setPlanetSettings={setPlanetSettings}
                appMode={appMode}

                themeConfig={themeConfig}
                setThemeConfig={setThemeConfig}
                materialSettings={materialSettings}
                setMaterialSettings={setMaterialSettings}
                userMaterialPresets={userMaterialPresets}
                setUserMaterialPresets={setUserMaterialPresets}
            />
        </div>
    );
};

const MenuItem = ({ icon, label, onClick, variant = 'default' }: { icon: string, label: string, onClick: () => void, variant?: 'default' | 'danger' }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${variant === 'danger'
            ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
    >
        <i className={`fas fa-${icon} w-4 text-center opacity-70`} />
        {label}
    </button>
);
