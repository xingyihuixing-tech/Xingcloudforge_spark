/**
 * input: App.tsx 传入的 settings 与各类 setSettings/回调；依赖 types.ts/constants.ts 的默认值与枚举
 * output: 控制面板 UI（参数编辑、实例选择、预设/导入导出，不含主题配置），驱动 settings 变化
 * pos: 全项目参数编辑的唯一入口之一；决定“全局 vs 选中实例”的写入策略
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '../contexts/UserContext';
import {
  AppSettings,
  DepthMode,
  ParticleShape,
  ColorFilterPreset,
  ColorFilter,
  LineMode,
  LineStyle,
  LineColorMode,
  LineRenderMode,
  GlowMode,
  NebulaBlendMode,
  LineGradientMode,
  AccretionLayer,
  ColorTintMapping,
  // 星球模块类型
  AppMode,
  PlanetSceneSettings,
  PlanetSettings,
  PlanetFillMode,
  ParticleRingSettings,
  ContinuousRingSettings,
  OrbitingFireflySettings,
  WanderingFireflyGroupSettings,
  OrbitingParticlesSettings,
  ParticleEmitterSettings,
  PlanetCoreSettings,
  RingOpacityGradient,
  SavedPlanetTemplate,
  TiltSettings,
  OrbitAxisSettings,
  RotationAxisSettings,
  RotationAxisPreset,
  SolidCoreSettings,
  SolidCorePresetType,
  CoreType,
  OrbitSettings,
  EnergyBodySettings,
  SurfaceFlameSettings,
  FlameJetSettings,
  SpiralFlameSettings,
  FlameSystemSettings,
  AfterimageZoneSettings,
  AfterimageSystemSettings,
  SilkRingSettings,
  NebulaPreset,
  NebulaInstance
} from '../types';
import {
  SAMPLE_IMAGES,
  COLOR_FILTER_PRESETS,
  COLOR_FILTER_PRESET_LABELS,
  DEFAULT_COLOR_FILTER,
  // 星球模块常量
  createDefaultPlanet,
  createDefaultParticleRing,
  createDefaultContinuousRing,
  createDefaultOrbitingFirefly,
  createDefaultWanderingGroup,
  createDefaultCore,
  createDefaultOrbiting,
  createDefaultEmitter,
  createDefaultEnergyBody,
  createDefaultSolidCore,
  createDefaultSurfaceFlame,
  createDefaultFlameJet,
  createDefaultSpiralFlame,
  SURFACE_FLAME_PRESETS,
  FLAME_JET_PRESETS,
  SPIRAL_FLAME_PRESETS,
  createDefaultSilkRing,
  SILK_RING_PRESETS,
  DEFAULT_FLAME_SYSTEM,
  DEFAULT_AFTERIMAGE_SYSTEM,
  createDefaultAfterimageZone,
  MAX_PLANETS,
  PLANET_TEMPLATES_STORAGE_KEY,
  PLANET_PARTICLE_WARNING_THRESHOLD,
  getTiltAngles,
  DEFAULT_TILT_SETTINGS,
  DEFAULT_ORBIT_AXIS_SETTINGS,
  ROTATION_AXIS_PRESETS,
  getRotationAxis,
  DEFAULT_ROTATION_AXIS_SETTINGS,
  SOLID_CORE_PRESETS,
  DEFAULT_SOLID_CORE,
  DEFAULT_ORBIT_SETTINGS,
  MAGIC_CIRCLE_TEXTURES,
  MAGIC_TEXTURE_CATEGORIES,
  MAGIC_CIRCLE_TEXTURES_BY_CATEGORY,
  MagicTextureCategory,
  BACKGROUND_IMAGES,
  // 模块预设
  PARTICLE_CORE_PRESETS,
  PARTICLE_RING_PRESETS,
  CONTINUOUS_RING_PRESETS,
  AFTERIMAGE_PARTICLE_PRESETS,
  AFTERIMAGE_TEXTURE_PRESETS,
  ORBITING_PARTICLES_PRESETS,
  EMITTER_PRESETS,
  ORBITING_FIREFLY_PRESETS,
  WANDERING_FIREFLY_PRESETS,
  ENERGY_BODY_PRESETS,
  DEFAULT_NEBULA_INSTANCE,
  createDefaultMaterialConfig
} from '../constants';

import { createThumbnail } from '../services/imageProcessing';
import { useLocalStorage } from '../utils/storage';
import { XingSparkConfig } from './XingSparkSettings';

import { ButtonMaterialConfig } from '../types';


type TabType = 'particle' | 'line' | 'interact';
type PlanetTabType = 'basic' | 'visual' | 'dynamic' | 'interact';

interface ControlPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  planetSettings: PlanetSceneSettings;
  setPlanetSettings: React.Dispatch<React.SetStateAction<PlanetSceneSettings>>;
  appMode: AppMode;
  onImageUpload: (file: File) => void;
  onSampleSelect: (url: string) => void;
  onClearMainNebula?: () => void;  // 清空主场景星云回调
  nebulaPreviewMode: boolean;  // 星云预览模式
  setNebulaPreviewMode: (mode: boolean) => void;
  fps: number;
  particleCount: number;
  colorPickMode: boolean;
  setColorPickMode: (mode: boolean) => void;
  pickedColor: { h: number; s: number; l: number } | null;
  onExtractColors?: () => void;  // 提取主色调回调
  gestureEnabled: boolean;
  setGestureEnabled: (enabled: boolean) => void;
  overlayMode?: boolean;  // 互通模式状态
  materialSettings?: import('../types').MaterialSettings;  // 从 App 传入的材质配置（用于样式生成）
  xingConfig?: XingSparkConfig; // 用于 Logo 样式同步
}

const DepthModeLabels: Record<DepthMode, string> = {
  [DepthMode.Brightness]: '亮度映射',
  [DepthMode.Hue]: '色相映射',
  [DepthMode.Saturation]: '饱和度映射',
  [DepthMode.Perlin]: '柏林噪声',
  [DepthMode.Radial]: '径向距离',
  [DepthMode.Layered]: '分层深度',
  [DepthMode.Emboss]: '浮雕效果',
  [DepthMode.Stereo]: '双眼视差',
  [DepthMode.FBM]: '分形噪声',
  [DepthMode.Wave]: '波浪效果'
};

const ParticleShapeLabels: Record<ParticleShape, string> = {
  [ParticleShape.Circle]: '圆形',
  [ParticleShape.Star]: '五角星',
  [ParticleShape.Snowflake]: '雪花',
  [ParticleShape.Heart]: '爱心',
  [ParticleShape.Crescent]: '月牙',
  [ParticleShape.CrossGlow]: '十字光',
  [ParticleShape.Sakura]: '樱花',
  [ParticleShape.Sun]: '太阳',
  [ParticleShape.Sun2]: '太阳2',
  [ParticleShape.Plum]: '梅花',
  [ParticleShape.Lily]: '百合',
  [ParticleShape.Lotus]: '莲花',
  [ParticleShape.Prism]: '棱镜',
};

const LineModeLabels: Record<LineMode, string> = {
  [LineMode.Distance]: '距离连线',
  [LineMode.Color]: '颜色相近',
  [LineMode.KNN]: 'K近邻',
  [LineMode.Delaunay]: '三角网格'
};

const LineStyleLabels: Record<LineStyle, string> = {
  [LineStyle.Solid]: '实线',
  [LineStyle.Dashed]: '虚线'
};

const GlowModeLabels: Record<GlowMode, string> = {
  [GlowMode.None]: '无光晕',
  [GlowMode.Soft]: '柔和',
  [GlowMode.Sharp]: '锐利恒星',
  [GlowMode.Aura]: '光环'
};

const NebulaBlendModeLabels: Record<NebulaBlendMode, string> = {
  [NebulaBlendMode.Additive]: '叠加发光',
  [NebulaBlendMode.Normal]: '普通混合'
};

const LineGradientModeLabels: Record<LineGradientMode, string> = {
  [LineGradientMode.Fixed]: '固定渐变',
  [LineGradientMode.ParticleColor]: '粒子颜色'
};

const LineColorModeLabels: Record<LineColorMode, string> = {
  [LineColorMode.Inherit]: '继承粒子',
  [LineColorMode.Gradient]: '渐变色',
  [LineColorMode.Custom]: '自定义'
};

const LineRenderModeLabels: Record<LineRenderMode, string> = {
  [LineRenderMode.Dynamic]: '动态 (GPU)',
  [LineRenderMode.Static]: '静态 (CPU)'
};

const ControlGroup: React.FC<{ title: string; children: React.ReactNode; rightContent?: React.ReactNode }> = ({ title, children, rightContent }) => (
  <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-bold tracking-wide" style={{ color: 'var(--ui-secondary)' }}>{title}</h3>
      {rightContent}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

// 启用/禁用按钮组件（带立体感的绿色/红色）
const EnableButton: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`px-2 py-0.5 text-[10px] rounded transition-all font-medium ${enabled
      ? 'text-white shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
      : 'text-white shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
      }`}
    style={{
      background: enabled
        ? 'linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)'
        : 'linear-gradient(180deg, #f87171 0%, #ef4444 50%, #dc2626 100%)',
    }}
  >
    {enabled ? '已启用' : '已禁用'}
  </button>
);

// ==================== 透明模态框组件 ====================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const TransparentModal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = '确定', cancelText = '取消' }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div
        className="relative pointer-events-auto rounded-2xl p-5 max-w-sm mx-4 min-w-[280px]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.10) 0%, rgba(15,15,25,0.10) 50%, rgba(20,20,30,0.10) 100%)',
          backdropFilter: 'blur(6px) saturate(180%)',
          WebkitBackdropFilter: 'blur(6px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderTop: '1px solid rgba(255,255,255,0.4)',
          borderLeft: '1px solid rgba(255,255,255,0.3)',
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -1px 0 rgba(0,0,0,0.1)
          `
        }}
      >
        <h3 className="text-base font-medium text-white mb-3" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{title}</h3>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 text-sm rounded-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--ui-primary-rgb, 99, 102, 241), 0.4) 0%, rgba(var(--ui-primary-rgb, 99, 102, 241), 0.2) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--ui-primary)',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 20px rgba(var(--ui-primary-rgb, 99, 102, 241), 0.3)`
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// 输入模态框
interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
}

const InputModal: React.FC<InputModalProps> = ({ isOpen, onClose, onConfirm, title, placeholder = '', defaultValue = '' }) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div
        className="relative pointer-events-auto rounded-2xl p-5 max-w-sm mx-4 w-full min-w-[280px]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.10) 0%, rgba(15,15,25,0.10) 50%, rgba(20,20,30,0.10) 100%)',
          backdropFilter: 'blur(6px) saturate(180%)',
          WebkitBackdropFilter: 'blur(6px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderTop: '1px solid rgba(255,255,255,0.4)',
          borderLeft: '1px solid rgba(255,255,255,0.3)',
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -1px 0 rgba(0,0,0,0.1)
          `
        }}
      >
        <h3 className="text-base font-medium text-white mb-4" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onConfirm(value.trim()); onClose(); } if (e.key === 'Escape') onClose(); }}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 text-sm rounded-lg text-white mb-5 focus:outline-none"
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
          >
            取消
          </button>
          <button
            onClick={() => { if (value.trim()) { onConfirm(value.trim()); onClose(); } }}
            className="px-4 py-2 text-sm rounded-lg transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--ui-primary-rgb, 99, 102, 241), 0.4) 0%, rgba(var(--ui-primary-rgb, 99, 102, 241), 0.2) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--ui-primary)',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 20px rgba(var(--ui-primary-rgb, 99, 102, 241), 0.3)`
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ==================== 预设列表组件 ====================
// 预设存储键
const PRESET_STORAGE_KEYS = {
  // 核心
  solidCore: 'planet_presets_solidCore',
  particleCore: 'planet_presets_particleCore',
  // 能量体
  energyBody: 'planet_presets_energyBody',
  // 能量罩/火焰
  surfaceFlame: 'planet_presets_surfaceFlame',
  flameJet: 'planet_presets_flameJet',
  spiralFlame: 'planet_presets_spiralFlame',
  // 残影
  afterimageTexture: 'planet_presets_afterimageTexture',
  afterimageParticle: 'planet_presets_afterimageParticle',
  // 光环
  particleRing: 'planet_presets_particleRing',
  continuousRing: 'planet_presets_continuousRing',
  // 辐射
  orbitingParticles: 'planet_presets_orbitingParticles',
  emitter: 'planet_presets_emitter',
  // 流萤
  orbitingFirefly: 'planet_presets_orbitingFirefly',
  wanderingFirefly: 'planet_presets_wanderingFirefly'
};

// 预设项接口
interface PresetItem {
  id: string;
  name: string;
  isBuiltIn: boolean;  // 是否为内置预设
  data: any;  // 预设数据
}

// 预设列表组件 Props
interface PresetListBoxProps {
  storageKey: string;  // localStorage 键
  builtInPresets: { id: string; name: string; data: any }[];  // 内置预设
  currentData: any;  // 当前实例数据（用于保存）
  hasInstance: boolean;  // 是否有选中的实例
  instanceName?: string;  // 当前实例名称
  onApplyToInstance: (data: any) => void;  // 应用到当前实例
  onCreateInstance: (data: any, presetName: string) => void;  // 从预设创建新实例
  title?: string;
  accentColor?: string;  // 主题色 (如 'purple', 'orange', 'red')
  moduleName?: string;  // 模块名称，用于导入导出
}

// 预设列表组件
const PresetListBox: React.FC<PresetListBoxProps> = ({
  storageKey,
  builtInPresets,
  currentData,
  hasInstance,
  instanceName = '',
  onApplyToInstance,
  onCreateInstance,
  title = '预设',
  accentColor = 'purple',
  moduleName = 'preset'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userPresets, setUserPresets] = useState<PresetItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 持久化当前选中的预设ID
  const [activeSchemeId, setActiveSchemeId] = useLocalStorage<string | null>(`${storageKey}_active_scheme_id`, null);

  // 模态框状态
  const [applyModal, setApplyModal] = useState<{ isOpen: boolean; presetId: string; presetName: string; data: any }>({ isOpen: false, presetId: '', presetName: '', data: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; presetId: string; presetName: string }>({ isOpen: false, presetId: '', presetName: '' });
  const [saveModal, setSaveModal] = useState<{ isOpen: boolean; presetId: string; presetName: string }>({ isOpen: false, presetId: '', presetName: '' });
  const [importConfirmModal, setImportConfirmModal] = useState<{ isOpen: boolean; moduleName: string; onConfirm: () => void }>({ isOpen: false, moduleName: '', onConfirm: () => { } });

  // 从 localStorage 加载用户预设
  useEffect(() => {
    const loadPresets = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setUserPresets(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    };

    loadPresets();

    // 监听 storage 事件以刷新预设列表
    window.addEventListener('storage', loadPresets);
    return () => window.removeEventListener('storage', loadPresets);
  }, [storageKey]);

  // 保存用户预设到 localStorage
  const saveUserPresets = (presets: PresetItem[]) => {
    setUserPresets(presets);
    try {
      localStorage.setItem(storageKey, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save presets:', e);
    }
  };

  // 合并内置预设和用户预设（过滤掉被用户覆盖的内置预设）
  const allPresets: PresetItem[] = [
    ...builtInPresets.map(p => ({ ...p, isBuiltIn: true })).filter(p => !userPresets.some(u => u.id === p.id)),
    ...userPresets
  ];

  // 双击重命名（仅用户预设）
  const handleDoubleClick = (preset: PresetItem) => {
    if (preset.isBuiltIn) return;
    setEditingId(preset.id);
    setEditingName(preset.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 提交重命名
  const handleRenameSubmit = () => {
    if (editingId && editingName.trim()) {
      const updated = userPresets.map(p =>
        p.id === editingId ? { ...p, name: editingName.trim() } : p
      );
      saveUserPresets(updated);
    }
    setEditingId(null);
  };

  // 点击预设
  const handlePresetClick = (preset: PresetItem) => {
    if (editingId === preset.id) return;
    const dataToApply = preset.data;
    const displayName = preset.name;

    if (hasInstance) {
      // 有实例，弹出确认框
      setApplyModal({ isOpen: true, presetId: preset.id, presetName: displayName, data: dataToApply });
    } else {
      // 无实例，直接创建
      onCreateInstance(dataToApply, displayName);
      setActiveSchemeId(preset.id);
    }
  };

  // 保存到预设
  const handleSaveToPreset = (presetId: string, presetName: string) => {
    if (!currentData) return;
    setSaveModal({ isOpen: true, presetId, presetName });
  };

  // 确认保存
  const confirmSave = () => {
    const { presetId, presetName } = saveModal;
    const existingIdx = userPresets.findIndex(p => p.id === presetId);
    if (existingIdx >= 0) {
      // 更新现有用户预设
      const updated = [...userPresets];
      updated[existingIdx] = { ...updated[existingIdx], data: { ...currentData } };
      saveUserPresets(updated);
    } else {
      // 内置预设被覆盖，创建同ID的用户预设
      const newPreset: PresetItem = { id: presetId, name: presetName, isBuiltIn: false, data: { ...currentData } };
      saveUserPresets([...userPresets, newPreset]);
    }
  };

  // 删除预设
  const handleDeletePreset = (presetId: string, presetName: string) => {
    setDeleteModal({ isOpen: true, presetId, presetName });
  };

  // 确认删除
  const confirmDelete = () => {
    saveUserPresets(userPresets.filter(p => p.id !== deleteModal.presetId));
  };

  // 导出单个预设
  const handleExportPreset = (preset: PresetItem) => {
    try {
      const exportData = {
        type: 'planet_preset',
        module: moduleName,
        version: 1,
        exportTime: new Date().toISOString(),
        presets: [{ id: preset.id, name: preset.name, data: preset.data, isBuiltIn: preset.isBuiltIn }]
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset_${moduleName}_${preset.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  // 导入预设的实际处理函数
  const doImport = (importData: any) => {
    const presetsToImport = (importData.presets || [])
      .filter((p: any) => !p.isBuiltIn)
      .map((p: any) => ({
        ...p,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isBuiltIn: false
      }));
    if (presetsToImport.length === 0) {
      alert('没有可导入的用户预设');
      return;
    }
    const mergedPresets = [...userPresets, ...presetsToImport];
    saveUserPresets(mergedPresets);
    alert(`成功导入 ${presetsToImport.length} 个预设`);
  };

  // 导入预设
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);
        if (importData.type !== 'planet_preset') {
          alert('无效的预设文件格式');
          return;
        }
        if (importData.module !== moduleName) {
          setImportConfirmModal({
            isOpen: true,
            moduleName: importData.module,
            onConfirm: () => doImport(importData)
          });
          return;
        }
        doImport(importData);
      } catch (err) {
        console.error('Import failed:', err);
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 使用CSS变量统一主题色（使用次交互色）
  const themeColors = {
    text: 'var(--ui-secondary)',  // 次交互色
    bg: 'var(--ui-primary)',
    bgHover: 'var(--accent-hover)'
  };

  return (
    <>
      <div className="mb-3 p-2 bg-gray-800/50 rounded">
        {/* 标题行 + 导入按钮 */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs" style={{ color: themeColors.text }}>{title}</label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-1.5 py-0.5 text-[9px] bg-gray-600 hover:bg-gray-500 text-white rounded"
            title="导入预设"
          >
            📥
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        {/* 预设列表框 */}
        <div className="h-[120px] overflow-y-auto bg-gray-900/50 rounded border border-gray-700">
          {allPresets.length === 0 ? (
            <div className="p-2 text-xs text-gray-500 text-center">暂无预设</div>
          ) : (
            allPresets.map(preset => {
              const isEditing = editingId === preset.id;
              const isUserPreset = !preset.isBuiltIn;

              return (
                <div
                  key={preset.id}
                  className={`flex items-center justify-between px-2 py-1 cursor-pointer group transition-colors ${activeSchemeId === preset.id
                    ? 'bg-blue-500/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-700/50 border-l-2 border-transparent'
                    }`}
                  onClick={() => handlePresetClick(preset)}
                  onDoubleClick={() => handleDoubleClick(preset)}
                >
                  {/* 名称 */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setEditingId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                      />
                    ) : (
                      <span className={`text-xs truncate block ${isUserPreset ? 'text-blue-300' : 'text-gray-300'}`}>
                        {isUserPreset ? '✨ ' : ''}{preset.name}
                      </span>
                    )}
                  </div>

                  {/* 操作按钮 - 始终显示 */}
                  <div className="flex items-center gap-1 ml-2">
                    {/* 保存按钮 - 所有预设都有 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSaveToPreset(preset.id, preset.name); }}
                      className="p-1 text-[10px] rounded transition-all hover:scale-105"
                      style={{
                        background: 'rgba(74, 222, 128, 0.15)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                        color: '#4ade80'
                      }}
                      title="保存当前参数到此预设"
                    >
                      💾
                    </button>
                    {/* 导出按钮 - 所有预设都有 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportPreset(preset); }}
                      className="p-1 text-[10px] rounded transition-all hover:scale-105"
                      style={{
                        background: 'rgba(96, 165, 250, 0.15)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        color: '#60a5fa'
                      }}
                      title="导出此预设"
                    >
                      📤
                    </button>
                    {/* 删除按钮 - 仅用户预设 */}
                    {isUserPreset && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id, preset.name); }}
                        className="p-1 text-[10px] rounded transition-all hover:scale-105"
                        style={{
                          background: 'rgba(248, 113, 113, 0.15)',
                          backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(248, 113, 113, 0.3)',
                          color: '#f87171'
                        }}
                        title="删除预设"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 应用确认模态框 */}
      <TransparentModal
        isOpen={applyModal.isOpen}
        onClose={() => setApplyModal({ ...applyModal, isOpen: false })}
        onConfirm={() => {
          onApplyToInstance(applyModal.data);
          setActiveSchemeId(applyModal.presetId);
        }}
        title="应用预设"
        message={`是否将预设"${applyModal.presetName}"的参数应用到当前${instanceName || '实例'}？`}
        confirmText="应用"
      />

      {/* 保存确认模态框 */}
      <TransparentModal
        isOpen={saveModal.isOpen}
        onClose={() => setSaveModal({ ...saveModal, isOpen: false })}
        onConfirm={confirmSave}
        title="保存预设"
        message={`是否将当前参数保存到预设"${saveModal.presetName}"？`}
        confirmText="保存"
      />

      {/* 删除确认模态框 */}
      <TransparentModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={confirmDelete}
        title="删除预设"
        message={`是否删除预设"${deleteModal.presetName}"？`}
        confirmText="删除"
      />

      {/* 导入确认模态框 */}
      <TransparentModal
        isOpen={importConfirmModal.isOpen}
        onClose={() => setImportConfirmModal({ ...importConfirmModal, isOpen: false })}
        onConfirm={importConfirmModal.onConfirm}
        title="导入预设"
        message={`该预设文件是为"${importConfirmModal.moduleName}"模块创建的，是否仍要导入？`}
        confirmText="导入"
      />
    </>
  );
};

// 保存到新预设按钮组件
interface SavePresetButtonProps {
  storageKey: string;
  currentData: any;
  defaultName: string;
  accentColor?: string;
  onSaved?: () => void;
}

const SavePresetButton: React.FC<SavePresetButtonProps> = ({ storageKey, currentData, defaultName, accentColor = 'purple', onSaved }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (presetName: string) => {
    const saved = localStorage.getItem(storageKey);
    const userPresets = saved ? JSON.parse(saved) : [];
    const newPreset = {
      id: `user_${Date.now()}`,
      name: presetName,
      isBuiltIn: false,
      data: { ...currentData, id: undefined, name: undefined, enabled: undefined }
    };
    localStorage.setItem(storageKey, JSON.stringify([...userPresets, newPreset]));

    // Set as active
    localStorage.setItem(`${storageKey}_active_scheme_id`, JSON.stringify(newPreset.id));
    window.dispatchEvent(new Event('local-storage'));

    onSaved?.();
    // 触发重新加载（通过 storage 事件）
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-0.5 text-[10px] text-white rounded transition-opacity hover:opacity-80"
        style={{ backgroundColor: 'color-mix(in srgb, var(--ui-edit-bar), #000 15%)' }}
        title="将当前配置保存为新预设"
      >
        保存到预设
      </button>
      <InputModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleSave}
        title="保存为新预设"
        placeholder="请输入预设名称"
        defaultValue={defaultName}
      />
    </>
  );
};

// 导出预设按钮组件
interface ExportPresetButtonProps {
  storageKey: string;
  moduleName: string;  // 模块名称，用于文件名
  builtInPresets?: { id: string; name: string; data: any }[];
}

const ExportPresetButton: React.FC<ExportPresetButtonProps> = ({ storageKey, moduleName, builtInPresets = [] }) => {
  const handleExport = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      const userPresets = saved ? JSON.parse(saved) : [];

      // 合并内置预设和用户预设
      const allPresets = [
        ...builtInPresets.map(p => ({ ...p, isBuiltIn: true })),
        ...userPresets
      ];

      if (allPresets.length === 0) {
        alert('没有可导出的预设');
        return;
      }

      const exportData = {
        type: 'planet_preset',
        module: moduleName,
        version: 1,
        exportTime: new Date().toISOString(),
        presets: allPresets
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset_${moduleName}_${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Export failed:', e);
      alert('导出失败');
    }
  };

  return (
    <button
      onClick={handleExport}
      className="px-2 py-0.5 text-[10px] bg-gray-600 hover:bg-gray-500 text-white rounded"
      title="导出预设到文件"
    >
      📤 导出
    </button>
  );
};

// 导入预设按钮组件
interface ImportPresetButtonProps {
  storageKey: string;
  moduleName: string;
  onImportComplete?: () => void;
}

const ImportPresetButton: React.FC<ImportPresetButtonProps> = ({ storageKey, moduleName, onImportComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirmModal, setImportConfirmModal] = useState<{ isOpen: boolean; moduleName: string; onConfirm: () => void }>({ isOpen: false, moduleName: '', onConfirm: () => { } });

  // 导入预设的实际处理函数
  const doImport = (importData: any) => {
    // 获取现有预设
    const saved = localStorage.getItem(storageKey);
    const existingPresets = saved ? JSON.parse(saved) : [];

    // 只导入用户预设（非内置）
    const presetsToImport = (importData.presets || [])
      .filter((p: any) => !p.isBuiltIn)
      .map((p: any) => ({
        ...p,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isBuiltIn: false
      }));

    if (presetsToImport.length === 0) {
      alert('没有可导入的用户预设');
      return;
    }

    // 合并预设
    const mergedPresets = [...existingPresets, ...presetsToImport];
    localStorage.setItem(storageKey, JSON.stringify(mergedPresets));

    // 触发刷新
    window.dispatchEvent(new Event('storage'));
    onImportComplete?.();

    alert(`成功导入 ${presetsToImport.length} 个预设`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);

        // 验证格式
        if (importData.type !== 'planet_preset') {
          alert('无效的预设文件格式');
          return;
        }

        if (importData.module !== moduleName) {
          setImportConfirmModal({
            isOpen: true,
            moduleName: importData.module,
            onConfirm: () => doImport(importData)
          });
          return;
        }

        doImport(importData);
      } catch (err) {
        console.error('Import failed:', err);
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);

    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-2 py-0.5 text-[10px] bg-gray-600 hover:bg-gray-500 text-white rounded"
        title="从文件导入预设"
      >
        📥 导入
      </button>

      {/* 导入确认模态框 */}
      <TransparentModal
        isOpen={importConfirmModal.isOpen}
        onClose={() => setImportConfirmModal({ ...importConfirmModal, isOpen: false })}
        onConfirm={importConfirmModal.onConfirm}
        title="导入预设"
        message={`该预设文件是为"${importConfirmModal.moduleName}"模块创建的，是否仍要导入到当前模块？`}
        confirmText="导入"
      />
    </>
  );
};

// 玻璃拟态切换按钮组件
const GlassToggle: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  color?: string;
  disabled?: boolean;
}> = ({ enabled, onChange, label, color, disabled = false }) => {
  const buttonColor = color || 'var(--ui-secondary)';
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!enabled);
      }}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-all font-medium w-full justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{
        background: enabled
          ? `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, ${buttonColor}20 100%)`
          : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${enabled ? buttonColor + '50' : 'rgba(255,255,255,0.08)'}`,
        borderTop: `1.5px solid ${enabled ? buttonColor + '90' : 'rgba(255,255,255,0.2)'}`,
        borderBottom: `1.5px solid rgba(0,0,0,0.3)`,
        color: enabled ? buttonColor : 'rgba(255,255,255,0.5)',
        boxShadow: enabled
          ? `0 0 10px ${buttonColor}25, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15)`
          : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.1)'
      }}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-80">{enabled ? '已启用' : '已禁用'}</span>
    </button>
  );
};

const RangeControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, disabled = false }) => {
  // 确保 value 是有效数字
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : min;
  // 根据step计算显示精度
  const decimals = step >= 1 ? 0 : Math.max(1, Math.ceil(-Math.log10(step)));
  return (
    <div className="flex flex-col mb-0.5">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-2)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-1)' }}>{safeValue.toFixed(decimals)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-1 rounded-lg appearance-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        style={{ backgroundColor: 'var(--border)' }}
      />
    </div>
  );
};

// 流萤头部贴图选择器（支持云端 AI 预设，含删除功能）
const HeadTextureSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { loadCloudConfig, saveCloudConfig } = useUser();
  const [cloudPresets, setCloudPresets] = useState<{ id: string; name: string; url: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; url: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');

  useEffect(() => {
    loadCloudConfig().then(config => {
      if (config?.headTexturePresets) {
        setCloudPresets(config.headTexturePresets);
      }
    });
  }, [loadCloudConfig]);

  // 重命名预设
  const handleRename = async (presetId: string, newName: string) => {
    if (!newName.trim()) { setEditingPresetId(null); return; }
    try {
      const config = await loadCloudConfig();
      if (config) {
        const updated = (config.headTexturePresets || []).map((p: any) =>
          p.id === presetId ? { ...p, name: newName.trim() } : p
        );
        await saveCloudConfig({ ...config, headTexturePresets: updated });
        setCloudPresets(updated);
      }
    } catch (err) {
      console.error('Rename preset failed:', err);
    } finally {
      setEditingPresetId(null);
      setEditingPresetName('');
    }
  };

  // 删除预设
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      // 1. 删除 Blob 文件
      await fetch(`/api/upload?url=${encodeURIComponent(deleteConfirm.url)}`, { method: 'DELETE' });
      // 2. 更新云配置
      const config = await loadCloudConfig();
      if (config) {
        const updated = (config.headTexturePresets || []).filter((p: any) => p.id !== deleteConfirm.id);
        await saveCloudConfig({ ...config, headTexturePresets: updated });
        setCloudPresets(updated);
      }
      // 3. 如果当前选中的被删除，清空选择
      if (value === deleteConfirm.url) {
        onChange('');
      }
    } catch (err) {
      console.error('Delete preset failed:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // 当前选中的云端预设
  const selectedCloudPreset = cloudPresets.find(p => p.url === value);

  return (
    <>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-300 w-16">选择贴图</span>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
        >
          <option value="">请选择...</option>
          <optgroup label="内置光效">
            <option value="/textures/flare1.png">光效 1</option>
            <option value="/textures/flare2.png">光效 2</option>
            <option value="/textures/flare3.png">光效 3</option>
            <option value="/textures/flare4.png">光效 4</option>
            <option value="/textures/flare5.png">光效 5</option>
            <option value="/textures/flare6.png">光效 6</option>
            <option value="/textures/flare7.png">光效 7</option>
            <option value="/textures/flare8.png">光效 8</option>
            <option value="/textures/flare9.png">光效 9</option>
          </optgroup>
          {cloudPresets.length > 0 && (
            <optgroup label={`✨ XingSpark (${cloudPresets.length})`}>
              {cloudPresets.map((preset) => (
                <option key={preset.id} value={preset.url}>{preset.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        {/* 重命名/删除按钮（仅当选中云端预设时显示） */}
        {selectedCloudPreset && (
          <div className="flex items-center gap-1">
            {editingPresetId === selectedCloudPreset.id ? (
              <input
                type="text"
                value={editingPresetName}
                onChange={(e) => setEditingPresetName(e.target.value)}
                onBlur={() => handleRename(selectedCloudPreset.id, editingPresetName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(selectedCloudPreset.id, editingPresetName);
                  if (e.key === 'Escape') { setEditingPresetId(null); setEditingPresetName(''); }
                }}
                autoFocus
                className="w-20 px-1 py-0.5 text-xs bg-gray-600 text-white border border-gray-500 rounded outline-none"
                placeholder="输入新名称"
              />
            ) : (
              <button
                onClick={() => { setEditingPresetId(selectedCloudPreset.id); setEditingPresetName(selectedCloudPreset.name); }}
                className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                title="重命名"
              >
                ✏️
              </button>
            )}
            <button
              onClick={() => setDeleteConfirm(selectedCloudPreset)}
              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
              title="删除此预设"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={() => !isDeleting && setDeleteConfirm(null)}>
          <div
            className="w-80 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(25,25,40,0.98) 0%, rgba(15,15,25,0.98) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 40px rgba(100,100,200,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-medium">确认删除</h3>
            </div>
            <div className="p-4">
              <p className="text-white/80 text-sm">确定要删除预设 "{deleteConfirm.name}" 吗？此操作不可撤销。</p>
            </div>
            <div className="p-3 flex gap-2 justify-end border-t border-white/10">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm text-white/60 hover:text-white/90 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 图片下拉选择器组件（支持分类标签页和缩略图预览）
const ImageSelectDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MagicTextureCategory | 'xingspark'>('cute');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载云端 AI 预设
  const { loadCloudConfig, saveCloudConfig } = useUser();
  const [cloudPresets, setCloudPresets] = useState<{ id: string; name: string; url: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; url: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCloudConfig().then(config => {
      if (config?.magicCircleTexturePresets) {
        setCloudPresets(config.magicCircleTexturePresets);
      }
    });
  }, [loadCloudConfig]);

  // 删除预设
  const handleDeletePreset = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/upload?url=${encodeURIComponent(deleteConfirm.url)}`, { method: 'DELETE' });
      const config = await loadCloudConfig();
      if (config) {
        const updated = (config.magicCircleTexturePresets || []).filter((p: any) => p.id !== deleteConfirm.id);
        await saveCloudConfig({ ...config, magicCircleTexturePresets: updated });
        setCloudPresets(updated);
      }
      if (value === deleteConfirm.url) {
        onChange('');
      }
    } catch (err) {
      console.error('Delete preset failed:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 获取当前选中项的标签
  const allOptions = MAGIC_CIRCLE_TEXTURES;
  const currentOption = allOptions.find(o => o.value === value) || cloudPresets.find(p => p.url === value) || allOptions[0];
  const currentCategoryOptions = activeCategory === 'xingspark' ? [] : MAGIC_CIRCLE_TEXTURES_BY_CATEGORY[activeCategory];

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-400 w-12">{label}</span>}
      <div ref={dropdownRef} className="relative flex-1">
        {/* 当前选中项 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-2 px-2 py-1.5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 transition-colors"
        >
          <div className="w-8 h-8 rounded border border-gray-600 overflow-hidden flex-shrink-0 bg-black">
            <img src={value} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
          </div>
          <span className="flex-1 text-left truncate">{currentOption?.label}</span>
          <span className="text-gray-500">{isOpen ? '▲' : '▼'}</span>
        </button>

        {/* 下拉面板 */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
            {/* 分类标签页 */}
            <div className="flex border-b border-gray-700">
              {MAGIC_TEXTURE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex-1 py-1.5 text-[10px] transition-colors ${activeCategory === cat.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  title={cat.label}
                >
                  {cat.icon}
                </button>
              ))}
              {/* XingSpark Tab */}
              <button
                onClick={() => setActiveCategory('xingspark')}
                className={`flex-1 py-1.5 text-[10px] transition-colors ${activeCategory === 'xingspark'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-purple-300'
                  }`}
                title={`XingSpark (${cloudPresets.length})`}
              >
                ✨
              </button>
            </div>

            {/* 图片网格 */}
            <div className="max-h-48 overflow-y-auto">
              {activeCategory === 'xingspark' ? (
                <div className="grid grid-cols-4 gap-1 p-2">
                  {cloudPresets.length > 0 ? (
                    cloudPresets.map((preset) => (
                      <div key={preset.id} className="relative group">
                        <button
                          onClick={() => { onChange(preset.url); setIsOpen(false); }}
                          className={`w-full p-1 rounded transition-colors ${preset.url === value
                            ? 'bg-purple-600 ring-2 ring-purple-400'
                            : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          title={preset.name}
                        >
                          <div className="w-full aspect-square rounded overflow-hidden bg-black">
                            <img
                              src={preset.url}
                              alt={preset.name}
                              className="w-full h-full object-contain"
                              loading="eager"
                              decoding="async"
                              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                            />
                          </div>
                        </button>
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(preset); }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 text-center py-4 text-gray-400 text-xs">
                      暂无 AI 生成贴图<br />
                      <span className="text-gray-500">使用 AI 助手 → 灵感模式 → 法阵图 生成</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1 p-2">
                  {currentCategoryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { onChange(opt.value); setIsOpen(false); }}
                      className={`p-1 rounded transition-colors ${opt.value === value
                        ? 'bg-blue-600 ring-2 ring-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      title={opt.label}
                    >
                      <div className="w-full aspect-square rounded overflow-hidden bg-black">
                        <img
                          src={opt.value}
                          alt={opt.label}
                          className="w-full h-full object-contain"
                          loading="eager"
                          decoding="async"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={() => !isDeleting && setDeleteConfirm(null)}>
          <div
            className="w-80 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(25,25,40,0.98) 0%, rgba(15,15,25,0.98) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 40px rgba(100,100,200,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-medium">确认删除</h3>
            </div>
            <div className="p-4">
              <p className="text-white/80 text-sm">确定要删除法阵贴图 "{deleteConfirm.name}" 吗？此操作不可撤销。</p>
            </div>
            <div className="p-3 flex gap-2 justify-end border-t border-white/10">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm text-white/60 hover:text-white/90 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeletePreset}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

// 法阵控制组件 - 独立组件避免 Hooks 规则违反
const MagicCircleControl: React.FC<{
  planet: PlanetSettings;
  updatePlanet: (updates: Partial<PlanetSettings>) => void;
  getButtonStyle?: (isActive: boolean) => React.CSSProperties;
}> = ({ planet, updatePlanet, getButtonStyle }) => {
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const soloCircleId = planet.magicCircles?.soloId || null;

  // 如果没有法阵，自动创建一个默认实例
  let circles = planet.magicCircles?.circles || [];
  if (circles.length === 0) {
    const defaultGradient = { enabled: false, mode: 'none' as const, colors: ['#ff6b6b', '#4ecdc4', '#ffd93d'], colorMidPosition: 0.5, colorMidWidth: 0, direction: 'radial' as const, directionCustom: { x: 1, y: 0, z: 0 }, spiralDensity: 2, spiralAxis: 'y' as const, proceduralAxis: 'y' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1, angle: 0, type: 'linear' as const };
    const defaultCircle = {
      id: 'default-magic-circle', name: '1', enabled: true,
      texture: '/magic/cute/circle01.png',
      yOffset: 0, radius: 150, rotationSpeed: 0.5, opacity: 0.8,
      hueShift: 0, baseHue: 200, baseSaturation: 1.0, saturationBoost: 1.0, brightness: 1.0, gradientColor: defaultGradient,
      pulseEnabled: false, pulseSpeed: 1.0, pulseIntensity: 0.3,
      breathEnabled: false, breathSpeed: 0.5, breathIntensity: 0.1,
      tilt: { ...DEFAULT_TILT_SETTINGS }
    };
    circles = [defaultCircle];
    // 延迟更新以避免渲染循环
    setTimeout(() => {
      updatePlanet({ magicCircles: { ...planet.magicCircles, enabled: true, circles: [defaultCircle] } });
    }, 0);
  }

  const effectiveSelectedCircleId = selectedCircleId && circles.find(c => c.id === selectedCircleId)
    ? selectedCircleId
    : circles[0]?.id || null;
  const currentCircle = circles.find(c => c.id === effectiveSelectedCircleId);

  const updateCircle = (id: string, updates: Partial<import('../types').MagicCircleSettings>) => {
    const newCircles = circles.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    updatePlanet({ magicCircles: { ...planet.magicCircles, circles: newCircles } });
  };

  // 设置 Solo 模式
  const setSoloCircleId = (id: string | null) => {
    updatePlanet({
      magicCircles: {
        enabled: true,
        circles: circles,
        soloId: id
      }
    });
  };

  // 生成下一个可用的数字名称
  const getNextName = () => {
    const existingNumbers = circles
      .map(c => parseInt(c.name))
      .filter(n => !isNaN(n));
    let next = 1;
    while (existingNumbers.includes(next)) next++;
    return String(next);
  };

  // 颜色模式相关
  const colorMode = currentCircle?.gradientColor?.enabled ? (currentCircle.gradientColor.mode || 'single') : 'none';
  const setColorMode = (mode: string) => {
    if (!currentCircle) return;
    if (mode === 'none') {
      updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, enabled: false, mode: 'none' } });
    } else {
      updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, enabled: true, mode: mode as any } });
    }
  };

  return (
    <ControlGroup title="法阵系统">
      <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
        <FloatingListSelector
          items={circles.map(c => ({
            id: c.id,
            name: c.name,
            enabled: soloCircleId ? c.id === soloCircleId : c.enabled
          }))}
          selectedId={effectiveSelectedCircleId}
          onSelect={setSelectedCircleId}
          onToggleEnabled={(id, enabled) => {
            if (soloCircleId) return;
            updateCircle(id, { enabled });
          }}
          onRename={(id, name) => updateCircle(id, { name })}
          onDelete={(id) => {
            const newCircles = circles.filter(c => c.id !== id);
            updatePlanet({ magicCircles: { ...planet.magicCircles, circles: newCircles } });
            if (effectiveSelectedCircleId === id) setSelectedCircleId(newCircles[0]?.id || null);
            if (soloCircleId === id) setSoloCircleId(null);
          }}
          onCopy={(id) => {
            const source = circles.find(c => c.id === id);
            if (source) {
              const newId = Date.now().toString();
              const copy = { ...source, id: newId, name: `${source.name} 副本` };
              updatePlanet({ magicCircles: { ...planet.magicCircles, circles: [...circles, copy] } });
              setSelectedCircleId(newId);
            }
          }}
          onAdd={() => {
            const id = Date.now().toString();
            const name = getNextName();
            const defaultGradient = { enabled: false, mode: 'none' as const, colors: ['#ff6b6b', '#4ecdc4', '#ffd93d'], colorMidPosition: 0.5, colorMidWidth: 0, direction: 'radial' as const, directionCustom: { x: 1, y: 0, z: 0 }, spiralDensity: 2, spiralAxis: 'y' as const, proceduralAxis: 'y' as const, proceduralCustomAxis: { x: 0, y: 1, z: 0 }, proceduralIntensity: 1, angle: 0, type: 'linear' as const };
            const newCircle = {
              id, name, enabled: true,
              texture: '/magic/cute/circle01.png',
              yOffset: 0, radius: 150, rotationSpeed: 0.5, opacity: 0.8,
              hueShift: 0, baseHue: 200, baseSaturation: 1.0, saturationBoost: 1.0, brightness: 1.0, gradientColor: defaultGradient,
              pulseEnabled: false, pulseSpeed: 1.0, pulseIntensity: 0.3,
              breathEnabled: false, breathSpeed: 0.5, breathIntensity: 0.1,
              tilt: { ...DEFAULT_TILT_SETTINGS }
            };
            updatePlanet({ magicCircles: { ...planet.magicCircles, circles: [...circles, newCircle] } });
            setSelectedCircleId(id);
          }}
          globalEnabled={planet.magicCircles?.enabled ?? true}
          onGlobalToggle={(enabled) => updatePlanet({ magicCircles: { ...planet.magicCircles!, enabled } })}
          soloId={soloCircleId}
          onSoloToggle={setSoloCircleId}
          title="法阵"
          titleStyle={{ color: 'var(--ui-secondary)' }}
          addButtonColor="bg-blue-600 hover:bg-blue-500"
          emptyText="暂无法阵"
        />

        {/* 选中法阵的参数 */}
        {currentCircle && (
          <div className="space-y-2 mt-3">
            {/* 贴图选择（带缩略图预览网格） */}
            <ImageSelectDropdown
              label="贴图"
              value={currentCircle.texture}
              onChange={(v) => updateCircle(currentCircle.id, { texture: v })}
            />

            {/* 基础参数 */}
            <RangeControl label="Y轴偏移" value={currentCircle.yOffset} min={-500} max={500} step={10} onChange={(v) => updateCircle(currentCircle.id, { yOffset: v })} />
            <RangeControl label="半径" value={currentCircle.radius} min={10} max={500} step={10} onChange={(v) => updateCircle(currentCircle.id, { radius: v })} />
            <RangeControl label="自转速度" value={currentCircle.rotationSpeed} min={-5} max={5} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { rotationSpeed: v })} />
            <RangeControl label="透明度" value={currentCircle.opacity} min={0} max={1} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { opacity: v })} />

            {/* 倾斜控制 */}
            <TiltPresetSelector
              tilt={currentCircle.tilt ?? DEFAULT_TILT_SETTINGS}
              onChange={(tilt) => updateCircle(currentCircle.id, { tilt })}
              getButtonStyle={getButtonStyle}
            />

            {/* 颜色调节 */}
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色调节</span>
              <RangeControl label="色相偏移" value={currentCircle.hueShift} min={0} max={360} step={5} onChange={(v) => updateCircle(currentCircle.id, { hueShift: v })} />
              <div className="h-2 rounded mb-2" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
              <RangeControl label="饱和度" value={currentCircle.saturationBoost ?? 1.0} min={0} max={5} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { saturationBoost: v })} />
              <RangeControl label="亮度" value={currentCircle.brightness} min={0.5} max={3} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { brightness: v })} />
            </div>

            {/* 染色 */}
            <div className="p-2 bg-gray-800/50 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">染色</span>
                <button
                  onClick={() => {
                    const newMode = colorMode === 'none' ? 'twoColor' : 'none';
                    setColorMode(newMode);
                  }}
                  className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                  style={{
                    background: colorMode !== 'none'
                      ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                      : 'rgba(120, 120, 120, 0.3)',
                    backdropFilter: 'blur(8px)',
                    border: colorMode !== 'none'
                      ? '1px solid var(--ui-secondary)'
                      : '1px solid rgba(255,255,255,0.1)',
                    color: colorMode !== 'none' ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {colorMode !== 'none' ? '已启用' : '已禁用'}
                </button>
              </div>

              {colorMode !== 'none' && (
                <>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[
                      { id: 'single', label: '单色' },
                      { id: 'twoColor', label: '双色' },
                      { id: 'threeColor', label: '三色' },
                      { id: 'procedural', label: '混色' }
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setColorMode(m.id)}
                        className="px-1 py-1 text-[10px] rounded transition-all duration-200" style={getButtonStyle ? getButtonStyle(colorMode === m.id) : undefined}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* 单色模式 */}
                  {colorMode === 'single' && (
                    <div className="space-y-1">
                      <RangeControl label="色相" value={currentCircle.baseHue ?? 200} min={0} max={360} step={5} onChange={(v) => updateCircle(currentCircle.id, { baseHue: v })} />
                      <div className="h-2 rounded" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
                      <RangeControl label="饱和度" value={currentCircle.baseSaturation ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateCircle(currentCircle.id, { baseSaturation: v })} />
                    </div>
                  )}

                  {/* 双色渐变 */}
                  {colorMode === 'twoColor' && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center justify-center">
                        <input type="color" value={currentCircle.gradientColor?.colors?.[0] || '#ff6b6b'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[0] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="起始色" />
                        <span className="text-gray-400">→</span>
                        <input type="color" value={currentCircle.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[1] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="结束色" />
                      </div>
                      <select value={currentCircle.gradientColor?.direction || 'radial'} onChange={(e) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                        <option value="radial">径向（中心→外）</option>
                        <option value="linearX">X轴线性</option>
                        <option value="linearY">Y轴线性</option>
                        <option value="spiral">螺旋</option>
                      </select>
                      {currentCircle.gradientColor?.direction === 'spiral' && (
                        <RangeControl label="螺旋圈数" value={currentCircle.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, spiralDensity: v } })} />
                      )}
                    </div>
                  )}

                  {/* 三色渐变 */}
                  {colorMode === 'threeColor' && (
                    <div className="space-y-2">
                      <div className="flex gap-1 items-center justify-center">
                        <input type="color" value={currentCircle.gradientColor?.colors?.[0] || '#ff6b6b'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[0] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                        <span className="text-gray-500">→</span>
                        <input type="color" value={currentCircle.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[1] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                        <span className="text-gray-500">→</span>
                        <input type="color" value={currentCircle.gradientColor?.colors?.[2] || '#ffd93d'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[2] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                      </div>
                      <RangeControl label="中间色位置" value={currentCircle.gradientColor?.colorMidPosition ?? 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colorMidPosition: v } })} />
                      <RangeControl label="中间色宽度" value={currentCircle.gradientColor?.colorMidWidth ?? 1} min={0} max={5} step={0.05} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colorMidWidth: v, colorMidWidth2: 0 } })} />
                      <RangeControl label="纯色带宽度" value={currentCircle.gradientColor?.colorMidWidth2 ?? 0} min={0} max={0.5} step={0.01} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colorMidWidth2: v, colorMidWidth: 1 } })} />
                      <select value={currentCircle.gradientColor?.direction || 'radial'} onChange={(e) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                        <option value="radial">径向（中心→外）</option>
                        <option value="linearX">X轴线性</option>
                        <option value="linearY">Y轴线性</option>
                        <option value="spiral">螺旋</option>
                      </select>
                      {currentCircle.gradientColor?.direction === 'spiral' && (
                        <RangeControl label="螺旋圈数" value={currentCircle.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, spiralDensity: v } })} />
                      )}
                    </div>
                  )}

                  {/* 混色渐变 */}
                  {colorMode === 'procedural' && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center justify-center">
                        <input type="color" value={currentCircle.gradientColor?.colors?.[0] || '#ff6b6b'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[0] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="颜色1" />
                        <span className="text-gray-400">↔</span>
                        <input type="color" value={currentCircle.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentCircle.gradientColor?.colors || [])]; colors[1] = e.target.value; updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="颜色2" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-400">混色轴向</span>
                        <select value={currentCircle.gradientColor?.proceduralAxis || 'y'} onChange={(e) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, proceduralAxis: e.target.value as any } })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white">
                          <option value="x">X轴</option>
                          <option value="y">Y轴</option>
                          <option value="z">Z轴</option>
                        </select>
                      </div>
                      <RangeControl label="混色强度" value={currentCircle.gradientColor?.proceduralIntensity ?? 1} min={0.1} max={3} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { gradientColor: { ...currentCircle.gradientColor, proceduralIntensity: v } })} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 脉冲发光 */}
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>脉冲发光</span>
              <RangeControl label="脉冲速度" value={currentCircle.pulseSpeed} min={0} max={5} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { pulseSpeed: v, pulseEnabled: v > 0 })} />
              <RangeControl label="脉冲强度" value={currentCircle.pulseIntensity} min={0} max={1} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { pulseIntensity: v })} />
            </div>

            {/* 缩放呼吸 */}
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>缩放呼吸</span>
              <RangeControl label="呼吸速度" value={currentCircle.breathSpeed} min={0} max={3} step={0.1} onChange={(v) => updateCircle(currentCircle.id, { breathSpeed: v, breathEnabled: v > 0 })} />
              <RangeControl label="呼吸幅度" value={currentCircle.breathIntensity} min={0} max={0.5} step={0.05} onChange={(v) => updateCircle(currentCircle.id, { breathIntensity: v })} />
            </div>
          </div>
        )}
      </div>
    </ControlGroup>
  );
};

// 色相范围选择器 - 可在色条上直接拖动选择
const HueRangeSlider: React.FC<{
  hueStart: number;
  hueEnd: number;
  onChange: (start: number, end: number) => void;
}> = ({ hueStart, hueEnd, onChange }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const dragStartRef = useRef({ x: 0, startVal: 0, endVal: 0 });

  const getHueFromX = (clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 360);
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'range') => {
    e.preventDefault();
    setDragging(type);
    dragStartRef.current = { x: e.clientX, startVal: hueStart, endVal: hueEnd };
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();

      if (dragging === 'start') {
        const newStart = getHueFromX(e.clientX);
        onChange(Math.min(newStart, hueEnd - 10), hueEnd);
      } else if (dragging === 'end') {
        const newEnd = getHueFromX(e.clientX);
        onChange(hueStart, Math.max(newEnd, hueStart + 10));
      } else if (dragging === 'range') {
        const delta = e.clientX - dragStartRef.current.x;
        const deltaHue = Math.round((delta / rect.width) * 360);
        const rangeSize = dragStartRef.current.endVal - dragStartRef.current.startVal;
        let newStart = dragStartRef.current.startVal + deltaHue;
        let newEnd = dragStartRef.current.endVal + deltaHue;

        if (newStart < 0) { newStart = 0; newEnd = rangeSize; }
        if (newEnd > 360) { newEnd = 360; newStart = 360 - rangeSize; }

        onChange(newStart, newEnd);
      }
    };

    const handleMouseUp = () => setDragging(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, hueStart, hueEnd, onChange]);

  const startPercent = (hueStart / 360) * 100;
  const widthPercent = ((hueEnd - hueStart) / 360) * 100;

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{hueStart}°</span>
        <span>{hueEnd}°</span>
      </div>
      <div
        ref={barRef}
        className="relative h-6 rounded cursor-crosshair select-none"
        style={{
          background: `linear-gradient(to right, 
            hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), 
            hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`
        }}
      >
        {/* 选中区域 */}
        <div
          className="absolute top-0 h-full bg-black/50 border-2 border-white shadow-lg cursor-move"
          style={{
            left: `${startPercent}%`,
            width: `${widthPercent}%`,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.8), inset 0 0 10px rgba(0,0,0,0.5)'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'range')}
        >
          {/* 左侧拖动手柄 */}
          <div
            className="absolute -left-1 top-0 w-3 h-full bg-white rounded-l cursor-ew-resize hover:bg-blue-400 shadow-md"
            style={{ boxShadow: '-2px 0 4px rgba(0,0,0,0.3)' }}
            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'start'); }}
          />
          {/* 右侧拖动手柄 */}
          <div
            className="absolute -right-1 top-0 w-3 h-full bg-white rounded-r cursor-ew-resize hover:bg-blue-400 shadow-md"
            style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.3)' }}
            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'end'); }}
          />
        </div>
      </div>
    </div>
  );
};

// 倾斜预设选择器组件（新版：轴 + 角度）
const TiltPresetSelector: React.FC<{
  tilt: TiltSettings;
  onChange: (tilt: TiltSettings) => void;
  getButtonStyle?: (isActive: boolean) => React.CSSProperties;
}> = ({ tilt, onChange, getButtonStyle }) => {
  const angleOptions = [0, 30, 45, 60];

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-400 mb-1">倾斜角度</label>
      {/* 轴选择 */}
      <div className="flex gap-1 mb-1">
        {(['x', 'y', 'z'] as const).map(axis => (
          <button
            key={axis}
            onClick={() => onChange({ ...tilt, axis })}
            className="flex-1 px-2 py-1 text-xs rounded transition-all duration-200"
            style={getButtonStyle ? getButtonStyle(tilt.axis === axis) : {
              background: tilt.axis === axis ? 'linear-gradient(145deg, #3b82f6, #2563eb)' : 'linear-gradient(145deg, #374151, #1f2937)',
              boxShadow: tilt.axis === axis ? '0 2px 8px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
              color: tilt.axis === axis ? 'white' : 'rgba(156,163,175,0.8)'
            }}
          >
            {axis.toUpperCase()}轴
          </button>
        ))}
      </div>
      {/* 角度选择 */}
      <div className="flex gap-1">
        {angleOptions.map(angle => {
          const active = !tilt.isCustom && tilt.angle === angle;
          return (
            <button
              key={angle}
              onClick={() => onChange({ ...tilt, angle, isCustom: false })}
              className="flex-1 px-1 py-1 text-xs rounded transition-all duration-200"
              style={getButtonStyle ? getButtonStyle(active) : {
                background: active ? 'linear-gradient(145deg, #16a34a, #15803d)' : 'linear-gradient(145deg, #374151, #1f2937)',
                boxShadow: active ? '0 2px 8px rgba(22,163,74,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
                color: active ? 'white' : 'rgba(156,163,175,0.8)'
              }}
            >
              {angle}°
            </button>
          );
        })}
        <button
          onClick={() => onChange({ ...tilt, isCustom: true })}
          className="flex-1 px-1 py-1 text-xs rounded transition-all duration-200"
          style={getButtonStyle ? getButtonStyle(tilt.isCustom) : {
            background: tilt.isCustom ? 'linear-gradient(145deg, #3b82f6, #2563eb)' : 'linear-gradient(145deg, #374151, #1f2937)',
            boxShadow: tilt.isCustom ? '0 2px 8px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
            color: tilt.isCustom ? 'white' : 'rgba(156,163,175,0.8)'
          }}
        >
          自定义
        </button>
      </div>
      {/* 自定义角度输入 */}
      {tilt.isCustom && (
        <input
          type="number"
          value={tilt.angle}
          onChange={(e) => onChange({ ...tilt, angle: Number(e.target.value) })}
          className="w-full px-2 py-1 bg-gray-700 rounded text-white text-xs mt-1"
          min={-90} max={90}
          placeholder="自定义角度"
        />
      )}
    </div>
  );
};

// 公转轴选择器组件（新版：预设 + XYZ滑块）
const OrbitAxisSelector: React.FC<{
  orbitAxis: OrbitAxisSettings;
  onChange: (orbitAxis: OrbitAxisSettings) => void;
  getButtonStyle?: (isActive: boolean) => React.CSSProperties;
}> = ({ orbitAxis, onChange, getButtonStyle }) => {
  // 预设值映射
  const presets: { label: string; x: number; y: number; z: number }[] = [
    { label: 'Y轴', x: 0, y: 1, z: 0 },
    { label: 'X轴', x: 1, y: 0, z: 0 },
    { label: 'Z轴', x: 0, y: 0, z: 1 },
    { label: '斜45°', x: 0.707, y: 0.707, z: 0 },
  ];

  // 获取当前自定义值（兼容旧数据）
  const customX = orbitAxis.customX ?? (orbitAxis.axis === 'x' ? 1 : 0);
  const customY = orbitAxis.customY ?? (orbitAxis.axis === 'y' ? 1 : 0);
  const customZ = orbitAxis.customZ ?? (orbitAxis.axis === 'z' ? 1 : 0);

  // 检测当前是否匹配某个预设
  const isPreset = (p: { x: number; y: number; z: number }) =>
    Math.abs(customX - p.x) < 0.01 && Math.abs(customY - p.y) < 0.01 && Math.abs(customZ - p.z) < 0.01;

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-400 mb-1">公转轴</label>
      {/* 预设按钮 */}
      <div className="flex gap-1 mb-2">
        {presets.map((p, i) => {
          const active = isPreset(p);
          return (
            <button
              key={i}
              onClick={() => onChange({ ...orbitAxis, customX: p.x, customY: p.y, customZ: p.z, isCustom: true })}
              className="flex-1 px-1 py-1 text-xs rounded transition-all duration-200"
              style={getButtonStyle ? getButtonStyle(active) : {
                background: active ? 'linear-gradient(145deg, #3b82f6, #2563eb)' : 'linear-gradient(145deg, #374151, #1f2937)',
                boxShadow: active ? '0 2px 8px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
                color: active ? 'white' : 'rgba(156,163,175,0.8)'
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* XYZ滑块 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">X</span>
          <input type="range" min={-1} max={1} step={0.01} value={customX} onChange={(e) => onChange({ ...orbitAxis, customX: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-red-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customX.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Y</span>
          <input type="range" min={-1} max={1} step={0.01} value={customY} onChange={(e) => onChange({ ...orbitAxis, customY: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-green-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customY.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Z</span>
          <input type="range" min={-1} max={1} step={0.01} value={customZ} onChange={(e) => onChange({ ...orbitAxis, customZ: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-blue-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customZ.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// 倾斜轴选择器组件（预设 + XYZ滑块，用于粒子环/连续环）
const TiltAxisSelector: React.FC<{
  tilt: TiltSettings;
  onChange: (tilt: TiltSettings) => void;
  label?: string;
  getButtonStyle?: (isActive: boolean) => React.CSSProperties;
}> = ({ tilt, onChange, label = '倾斜轴', getButtonStyle }) => {
  // 预设值映射（法向量）
  const presets: { label: string; x: number; y: number; z: number }[] = [
    { label: 'Y轴', x: 0, y: 1, z: 0 },     // 水平环
    { label: 'X轴', x: 1, y: 0, z: 0 },     // 垂直环（绕X）
    { label: 'Z轴', x: 0, y: 0, z: 1 },     // 垂直环（绕Z）
    { label: '斜45°', x: 0.707, y: 0.707, z: 0 },
  ];

  // 获取当前自定义值（兼容旧数据）
  const customX = tilt.customX ?? 0;
  const customY = tilt.customY ?? 1;
  const customZ = tilt.customZ ?? 0;

  // 检测当前是否匹配某个预设
  const isPreset = (p: { x: number; y: number; z: number }) =>
    Math.abs(customX - p.x) < 0.01 && Math.abs(customY - p.y) < 0.01 && Math.abs(customZ - p.z) < 0.01;

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {/* 预设按钮 */}
      <div className="flex gap-1 mb-2">
        {presets.map((p, i) => {
          const active = isPreset(p);
          return (
            <button
              key={i}
              onClick={() => onChange({ ...tilt, customX: p.x, customY: p.y, customZ: p.z, isCustom: true })}
              className="flex-1 px-1 py-1 text-xs rounded transition-all duration-200"
              style={getButtonStyle ? getButtonStyle(active) : {
                background: active ? 'linear-gradient(145deg, #0891b2, #0e7490)' : 'linear-gradient(145deg, #374151, #1f2937)',
                boxShadow: active ? '0 2px 8px rgba(8,145,178,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
                color: active ? 'white' : 'rgba(156,163,175,0.8)'
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* XYZ滑块 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">X</span>
          <input type="range" min={-1} max={1} step={0.01} value={customX} onChange={(e) => onChange({ ...tilt, customX: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-red-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customX.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Y</span>
          <input type="range" min={-1} max={1} step={0.01} value={customY} onChange={(e) => onChange({ ...tilt, customY: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-green-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customY.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Z</span>
          <input type="range" min={-1} max={1} step={0.01} value={customZ} onChange={(e) => onChange({ ...tilt, customZ: Number(e.target.value), isCustom: true })} className="flex-1 h-1 accent-blue-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customZ.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// 自转轴预设选择器组件（新版：预设 + XYZ滑块）
const RotationAxisPresetSelector: React.FC<{
  axis: RotationAxisSettings;
  onChange: (axis: RotationAxisSettings) => void;
  getButtonStyle?: (isActive: boolean) => React.CSSProperties;
}> = ({ axis, onChange, getButtonStyle }) => {
  // 预设值映射
  const presets: { label: string; x: number; y: number; z: number }[] = [
    { label: 'Y轴', x: 0, y: 1, z: 0 },
    { label: 'X轴', x: 1, y: 0, z: 0 },
    { label: 'Z轴', x: 0, y: 0, z: 1 },
    { label: '斜45°', x: 0.707, y: 0.707, z: 0 },
  ];

  // 获取当前自定义值
  const customX = axis.customX ?? 0;
  const customY = axis.customY ?? 1;
  const customZ = axis.customZ ?? 0;

  // 检测当前是否匹配某个预设
  const isPreset = (p: { x: number; y: number; z: number }) =>
    Math.abs(customX - p.x) < 0.01 && Math.abs(customY - p.y) < 0.01 && Math.abs(customZ - p.z) < 0.01;

  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-400 mb-1">自转轴</label>
      {/* 预设按钮 */}
      <div className="flex gap-1 mb-2">
        {presets.map((p, i) => {
          const active = isPreset(p);
          return (
            <button
              key={i}
              onClick={() => onChange({ ...axis, preset: 'custom', customX: p.x, customY: p.y, customZ: p.z })}
              className="flex-1 px-1 py-1 text-xs rounded transition-all duration-200"
              style={getButtonStyle ? getButtonStyle(active) : {
                background: active ? 'linear-gradient(145deg, #3b82f6, #2563eb)' : 'linear-gradient(145deg, #374151, #1f2937)',
                boxShadow: active ? '0 2px 8px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
                color: active ? 'white' : 'rgba(156,163,175,0.8)'
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* XYZ滑块 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">X</span>
          <input type="range" min={-1} max={1} step={0.01} value={customX} onChange={(e) => onChange({ ...axis, preset: 'custom', customX: Number(e.target.value) })} className="flex-1 h-1 accent-red-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customX.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Y</span>
          <input type="range" min={-1} max={1} step={0.01} value={customY} onChange={(e) => onChange({ ...axis, preset: 'custom', customY: Number(e.target.value) })} className="flex-1 h-1 accent-green-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customY.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-4">Z</span>
          <input type="range" min={-1} max={1} step={0.01} value={customZ} onChange={(e) => onChange({ ...axis, preset: 'custom', customZ: Number(e.target.value) })} className="flex-1 h-1 accent-blue-500" />
          <span className="text-[10px] text-gray-400 w-8 text-right">{customZ.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

// 可复用的浮窗列表选择器组件
interface FloatingListItem {
  id: string;
  name: string;
  enabled: boolean;
  color?: string;
}

interface FloatingListSelectorProps<T extends FloatingListItem> {
  items: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCopy?: (id: string) => void;
  onAdd: () => void;
  onColorChange?: (id: string, color: string) => void;
  globalEnabled?: boolean;
  onGlobalToggle?: (enabled: boolean) => void;
  // Solo 功能：仅显示某一项，不改变 enabled 状态
  soloId?: string | null;
  onSoloToggle?: (id: string | null) => void;
  title: string;
  titleColor?: string;
  titleStyle?: React.CSSProperties;
  addButtonColor: string;
  emptyText?: string;
}

function FloatingListSelector<T extends FloatingListItem>({
  items,
  selectedId,
  onSelect,
  onToggleEnabled,
  onRename,
  onDelete,
  onCopy,
  onAdd,
  onColorChange,
  globalEnabled = true,
  onGlobalToggle,
  soloId,
  onSoloToggle,
  title,
  titleColor,
  titleStyle,
  addButtonColor,
  emptyText = '暂无项目'
}: FloatingListSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭浮窗
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedItem = items.find(item => item.id === selectedId);

  const handleDoubleClick = (item: T) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleRenameSubmit = () => {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleItemClick = (item: T) => {
    if (editingId === item.id) return; // 正在编辑时不切换
    onSelect(item.id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 标题行：标题 + 启用按钮 + 添加按钮 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${titleColor || ''}`} style={titleStyle}>{title}</span>
          {onGlobalToggle && (
            <button
              onClick={() => onGlobalToggle(!globalEnabled)}
              className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
              style={{
                background: globalEnabled
                  ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                  : 'rgba(120, 120, 120, 0.3)',
                backdropFilter: 'blur(8px)',
                border: globalEnabled
                  ? '1px solid var(--ui-secondary)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: globalEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
              }}
            >
              {globalEnabled ? '已启用' : '已禁用'}
            </button>
          )}
        </div>
        <button
          onClick={onAdd}
          className="px-2 py-0.5 text-xs rounded transition-all"
          style={{
            background: 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--ui-secondary)',
            color: 'var(--ui-secondary)',
          }}
        >
          + 添加
        </button>
      </div>

      {/* 选择器行：显示当前选中项 */}
      <div
        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${!globalEnabled ? 'opacity-50' : ''}`}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
          border: isOpen ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isOpen ? '0 0 10px rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.2)' : 'none'
        }}
        onClick={() => globalEnabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-[10px] text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
          <span className="text-xs text-white truncate">
            {selectedItem ? selectedItem.name : (items.length > 0 ? '请选择...' : emptyText)}
          </span>
        </div>
        {selectedItem && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onColorChange && selectedItem.color && (
              <input
                type="color"
                value={selectedItem.color}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onColorChange(selectedItem.id, e.target.value)}
                className="w-5 h-5 rounded border-none p-0 cursor-pointer"
              />
            )}
            {/* Solo 按钮：仅显示当前项 */}
            {onSoloToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSoloToggle(soloId === selectedItem.id ? null : selectedItem.id);
                }}
                className="px-1.5 py-0.5 text-[10px] rounded transition-all font-medium"
                style={{
                  background: soloId === selectedItem.id
                    ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.4)'
                    : 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(8px)',
                  border: soloId === selectedItem.id
                    ? '1px solid var(--ui-secondary)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: soloId === selectedItem.id ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                }}
                title={soloId === selectedItem.id ? '取消仅显示' : '仅显示此项'}
              >
                S
              </button>
            )}
          </div>
        )}
      </div>

      {/* 浮窗列表 */}
      {isOpen && globalEnabled && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg shadow-xl max-h-48 overflow-y-auto"
          style={{
            background: 'rgba(30, 30, 40, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)',
          }}
        >
          {items.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">{emptyText}</div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-2 hover:bg-gray-700 cursor-pointer transition-colors ${item.id === selectedId ? 'bg-gray-700' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleEnabled(item.id, e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--ui-secondary)' }}
                  />
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-1 py-0.5 text-xs bg-gray-800 border border-blue-500 rounded text-white outline-none min-w-0"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-xs text-white truncate cursor-text select-none"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDoubleClick(item); }}
                      title="双击重命名"
                    >
                      {item.name}
                    </span>
                  )}
                  {item.id === selectedId && <span className="text-[10px] text-blue-400">✓</span>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onColorChange && item.color && (
                    <input
                      type="color"
                      value={item.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); onColorChange(item.id, e.target.value); }}
                      className="w-5 h-5 rounded border-none p-0 cursor-pointer"
                    />
                  )}
                  {onCopy && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCopy(item.id); }}
                      className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-gray-600"
                      title="拷贝"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-gray-600"
                    title="删除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const ControlPanel: React.FC<ControlPanelProps & { nebulaPresets: NebulaPreset[]; setNebulaPresets: React.Dispatch<React.SetStateAction<NebulaPreset[]>> }> = ({
  settings,
  setSettings,
  planetSettings,
  setPlanetSettings,
  appMode,
  onImageUpload,
  onSampleSelect,
  onClearMainNebula,
  nebulaPreviewMode,
  setNebulaPreviewMode,
  fps,
  particleCount,
  colorPickMode,
  setColorPickMode,
  pickedColor,
  onExtractColors,
  gestureEnabled,
  setGestureEnabled,
  overlayMode = false,  // 互通模式状态，默认false
  materialSettings: propMaterialSettings,  // 从 App 传入的材质配置
  nebulaPresets,
  setNebulaPresets
}) => {
  // 获取当前用户信息用于上传图片
  const { currentUser } = useUser();

  // 生成用户隔离的 localStorage 键（确保不同账户数据隔离）
  const getUserScopedKey = useCallback((baseKey: string) => {
    if (currentUser?.id) {
      return `${baseKey}_${currentUser.id}`;
    }
    return baseKey; // 未登录时使用全局键
  }, [currentUser?.id]);

  // 上传预设图片到云端，返回公网 URL
  const uploadPresetImage = useCallback(async (base64Data: string, presetId: string): Promise<string | null> => {
    if (!currentUser) {
      console.warn('Cannot upload image: user not logged in');
      return null;
    }

    try {
      // 将 base64 转换为 Blob
      const response = await fetch(base64Data);
      const blob = await response.blob();

      // 生成唯一文件名
      const fileName = `preset_${presetId}_${Date.now()}.png`;

      // 上传到 Blob 存储
      const uploadRes = await fetch(`/api/upload?userId=${currentUser.id}&type=preset&fileName=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        body: blob,
      });

      if (!uploadRes.ok) {
        console.error('Failed to upload preset image:', uploadRes.status);
        return null;
      }

      const data = await uploadRes.json();
      console.log('Preset image uploaded:', data.url);
      return data.url;
    } catch (error) {
      console.error('Error uploading preset image:', error);
      return null;
    }
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<TabType>('particle');
  const [particleSubTab, setParticleSubTab] = useState<'basic' | 'dynamic'>('basic');
  const [planetTab, setPlanetTab] = useState<PlanetTabType>('basic');
  const [planetSubTab, setPlanetSubTab] = useState<'core' | 'flame' | 'rings' | 'afterimage' | 'radiation' | 'fireflies' | 'magicCircle' | 'energyBody'>('core');
  const [afterimageSubTab, setAfterimageSubTab] = useState<'texture' | 'particles'>('texture');

  // 环系统选中状态


  // 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  const [showMaterialSettings, setShowMaterialSettings] = useState(false);
  const [materialPanelPos, setMaterialPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingMaterialPanel, setIsDraggingMaterialPanel] = useState(false);
  const [settingsPanelPos, setSettingsPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [expandedMaterialPanels, setExpandedMaterialPanels] = useState<Record<string, boolean>>({});

  // 按键材质类型定义
  type MaterialType = 'glass' | 'neon' | 'crystal' | 'neumorphism' | 'holographic';

  interface GlassParams {
    blur: number;
    opacity: number;
    borderOpacity: number;
    tint: string;
    tint2?: string;
  }

  interface NeonParams {
    glowIntensity: number;
    glowSpread: number;
    borderGlow: boolean;
    textGlow: boolean;
    color: string;
    color2?: string;
  }

  interface CrystalParams {
    facets: number;
    shine: number;
    depth: number;
    color: string;
    highlightColor: string;
    color2: string;
    highlightColor2: string;
  }

  interface NeumorphismParams {
    elevation: number;
    curvature: number;
    lightAngle: number;
    shadowIntensity: number;
    pressDepth: number;
    baseColor: string;
    highlightColor: string;
    shadowColor: string;
  }

  interface HolographicParams {
    colors: string[];
    colors2?: string[];
    speed: number;
    angle: number;
    shimmer: boolean;
    noiseIntensity: number;
  }

  interface ButtonMaterialConfig {
    type: MaterialType;
    glass: GlassParams;
    neon: NeonParams;
    crystal: CrystalParams;
    neumorphism: NeumorphismParams;
    holographic: HolographicParams;
  }

  // 默认材质参数
  const defaultGlass: GlassParams = { blur: 12, opacity: 0.1, borderOpacity: 0.15, tint: '#ffffff' };
  const defaultNeon: NeonParams = { glowIntensity: 60, glowSpread: 20, borderGlow: true, textGlow: true, color: '#22d3ee' };
  const defaultCrystal: CrystalParams = { facets: 3, shine: 70, depth: 50, color: '#6366f1', highlightColor: '#a5b4fc', color2: '#06b6d4', highlightColor2: '#67e8f9' };
  const defaultNeumorphism: NeumorphismParams = { elevation: 8, curvature: 50, lightAngle: 145, shadowIntensity: 40, pressDepth: 2, baseColor: '#2a2a35', highlightColor: '#4a4a5a', shadowColor: '#1a1a22' };
  const defaultHolographic: HolographicParams = { colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1', '#dda0dd'], speed: 3, angle: 45, shimmer: false, noiseIntensity: 20 };

  const createDefaultMaterialConfig = (type: MaterialType = 'glass'): ButtonMaterialConfig => ({
    type,
    glass: { ...defaultGlass },
    neon: { ...defaultNeon },
    crystal: { ...defaultCrystal },
    neumorphism: { ...defaultNeumorphism },
    holographic: { ...defaultHolographic }
  });

  // 材质设置：使用从 App 传入的 prop，提供默认值作为 fallback
  // 注意：App 管理 materialSettings 状态，这里只读取使用
  const defaultMaterialSettings = useMemo(() => ({
    modeSwitch: createDefaultMaterialConfig('crystal'),
    mainTabs: createDefaultMaterialConfig('neon'),
    mainTabColors: { basic: '#10b981', visual: '#a78bfa', interact: '#22d3ee' },
    moduleTabs: createDefaultMaterialConfig('neon'),
    moduleTabColors: { core: '#22d3ee', energyBody: '#f59e0b', rings: '#a78bfa', afterimage: '#f472b6', radiation: '#34d399', fireflies: '#fbbf24', magicCircle: '#c084fc' },
    optionButtons: createDefaultMaterialConfig('neumorphism'),
    subModuleTabs: {
      core: createDefaultMaterialConfig('neon'),
      energyBody: createDefaultMaterialConfig('neon'),
      rings: createDefaultMaterialConfig('neon'),
      afterimage: createDefaultMaterialConfig('neon'),
      radiation: createDefaultMaterialConfig('neon'),
      fireflies: createDefaultMaterialConfig('neon'),
      magicCircle: createDefaultMaterialConfig('neon')
    }
  }), []);

  // 合并 prop 和默认值，确保所有字段都存在
  const materialSettings = useMemo(() => {
    if (!propMaterialSettings) return defaultMaterialSettings;
    return {
      modeSwitch: propMaterialSettings.modeSwitch || defaultMaterialSettings.modeSwitch,
      mainTabs: propMaterialSettings.mainTabs || defaultMaterialSettings.mainTabs,
      mainTabColors: propMaterialSettings.mainTabColors || defaultMaterialSettings.mainTabColors,
      moduleTabs: propMaterialSettings.moduleTabs || defaultMaterialSettings.moduleTabs,
      moduleTabColors: propMaterialSettings.moduleTabColors || defaultMaterialSettings.moduleTabColors,
      optionButtons: propMaterialSettings.optionButtons || defaultMaterialSettings.optionButtons,
      subModuleTabs: (() => {
        const sub = propMaterialSettings.subModuleTabs;
        if (!sub) return defaultMaterialSettings.subModuleTabs;
        // 兼容旧数据：如果是单一配置对象（有type属性），则转换为Record
        if ('type' in sub) {
          const newRecord: any = {};
          Object.keys(defaultMaterialSettings.subModuleTabs).forEach(key => {
            newRecord[key] = sub;
          });
          return newRecord;
        }
        return sub;
      })()
    };
  }, [propMaterialSettings, defaultMaterialSettings]);

  // 材质预设类型
  type MaterialPreset = typeof materialSettings;

  // 内置材质预设
  const BUILT_IN_MATERIAL_PRESETS: { id: string; name: string; data: MaterialPreset }[] = [
    {
      id: 'default',
      name: '🎨 默认',
      data: {
        modeSwitch: createDefaultMaterialConfig('crystal'),
        mainTabs: createDefaultMaterialConfig('neon'),
        mainTabColors: { basic: '#10b981', visual: '#a78bfa', interact: '#22d3ee' },
        moduleTabs: createDefaultMaterialConfig('neon'),
        moduleTabColors: { core: '#10b981', energyBody: '#ef4444', rings: '#a78bfa', afterimage: '#06b6d4', radiation: '#22c55e', fireflies: '#eab308', magicCircle: '#ec4899' },
        optionButtons: createDefaultMaterialConfig('neumorphism'),
        subModuleTabs: { core: createDefaultMaterialConfig('neon'), energyBody: createDefaultMaterialConfig('neon'), rings: createDefaultMaterialConfig('neon'), afterimage: createDefaultMaterialConfig('neon'), radiation: createDefaultMaterialConfig('neon'), fireflies: createDefaultMaterialConfig('neon'), magicCircle: createDefaultMaterialConfig('neon') }
      }
    },
    {
      id: 'glass',
      name: '🪟 玻璃',
      data: {
        modeSwitch: createDefaultMaterialConfig('glass'),
        mainTabs: createDefaultMaterialConfig('glass'),
        mainTabColors: { basic: '#3b82f6', visual: '#8b5cf6', interact: '#06b6d4' },
        moduleTabs: createDefaultMaterialConfig('glass'),
        moduleTabColors: { core: '#3b82f6', energyBody: '#ef4444', rings: '#8b5cf6', afterimage: '#06b6d4', radiation: '#22c55e', fireflies: '#f59e0b', magicCircle: '#ec4899' },
        optionButtons: createDefaultMaterialConfig('glass'),
        subModuleTabs: { core: createDefaultMaterialConfig('glass'), energyBody: createDefaultMaterialConfig('glass'), rings: createDefaultMaterialConfig('glass'), afterimage: createDefaultMaterialConfig('glass'), radiation: createDefaultMaterialConfig('glass'), fireflies: createDefaultMaterialConfig('glass'), magicCircle: createDefaultMaterialConfig('glass') }
      }
    },
    {
      id: 'neon',
      name: '💡 霓虹',
      data: {
        modeSwitch: createDefaultMaterialConfig('neon'),
        mainTabs: createDefaultMaterialConfig('neon'),
        mainTabColors: { basic: '#22c55e', visual: '#f472b6', interact: '#38bdf8' },
        moduleTabs: createDefaultMaterialConfig('neon'),
        moduleTabColors: { core: '#22c55e', energyBody: '#f43f5e', rings: '#d946ef', afterimage: '#0ea5e9', radiation: '#84cc16', fireflies: '#fbbf24', magicCircle: '#a855f7' },
        optionButtons: createDefaultMaterialConfig('neon'),
        subModuleTabs: { core: createDefaultMaterialConfig('neon'), energyBody: createDefaultMaterialConfig('neon'), rings: createDefaultMaterialConfig('neon'), afterimage: createDefaultMaterialConfig('neon'), radiation: createDefaultMaterialConfig('neon'), fireflies: createDefaultMaterialConfig('neon'), magicCircle: createDefaultMaterialConfig('neon') }
      }
    },
    {
      id: 'crystal',
      name: '💎 水晶',
      data: {
        modeSwitch: createDefaultMaterialConfig('crystal'),
        mainTabs: createDefaultMaterialConfig('crystal'),
        mainTabColors: { basic: '#60a5fa', visual: '#c084fc', interact: '#2dd4bf' },
        moduleTabs: createDefaultMaterialConfig('crystal'),
        moduleTabColors: { core: '#60a5fa', energyBody: '#fb7185', rings: '#c084fc', afterimage: '#22d3ee', radiation: '#4ade80', fireflies: '#facc15', magicCircle: '#e879f9' },
        optionButtons: createDefaultMaterialConfig('crystal'),
        subModuleTabs: { core: createDefaultMaterialConfig('crystal'), energyBody: createDefaultMaterialConfig('crystal'), rings: createDefaultMaterialConfig('crystal'), afterimage: createDefaultMaterialConfig('crystal'), radiation: createDefaultMaterialConfig('crystal'), fireflies: createDefaultMaterialConfig('crystal'), magicCircle: createDefaultMaterialConfig('crystal') }
      }
    },
    {
      id: 'holographic',
      name: '🌈 全息',
      data: {
        modeSwitch: createDefaultMaterialConfig('holographic'),
        mainTabs: createDefaultMaterialConfig('holographic'),
        mainTabColors: { basic: '#a78bfa', visual: '#f472b6', interact: '#34d399' },
        moduleTabs: createDefaultMaterialConfig('holographic'),
        moduleTabColors: { core: '#a78bfa', energyBody: '#fb923c', rings: '#f472b6', afterimage: '#22d3ee', radiation: '#4ade80', fireflies: '#fcd34d', magicCircle: '#c084fc' },
        optionButtons: createDefaultMaterialConfig('holographic'),
        subModuleTabs: { core: createDefaultMaterialConfig('holographic'), energyBody: createDefaultMaterialConfig('holographic'), rings: createDefaultMaterialConfig('holographic'), afterimage: createDefaultMaterialConfig('holographic'), radiation: createDefaultMaterialConfig('holographic'), fireflies: createDefaultMaterialConfig('holographic'), magicCircle: createDefaultMaterialConfig('holographic') }
      }
    }
  ];

  // 用户保存的材质预设（初始化为空，在 useEffect 中根据用户加载）
  const [userMaterialPresets, setUserMaterialPresets] = useState<{ id: string; name: string; data: MaterialPreset }[]>([]);

  // 加载用户材质预设（用户切换时重新加载）
  useEffect(() => {
    try {
      const key = getUserScopedKey('user_material_presets');
      const saved = localStorage.getItem(key);
      setUserMaterialPresets(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setUserMaterialPresets([]);
    }
  }, [getUserScopedKey]);

  // 保存用户材质预设（使用用户隔离的键）
  useEffect(() => {
    const key = getUserScopedKey('user_material_presets');
    localStorage.setItem(key, JSON.stringify(userMaterialPresets));
  }, [userMaterialPresets, getUserScopedKey]);

  // 材质预设面板展开状态
  const [materialPresetExpanded, setMaterialPresetExpanded] = useState(false);
  const [editingMaterialPresetId, setEditingMaterialPresetId] = useState<string | null>(null);
  const [editingMaterialPresetName, setEditingMaterialPresetName] = useState('');

  // 星云预设状态
  // 星云预设状态 (Moved to App.tsx)
  // const [nebulaPresets, setNebulaPresets] = useState<NebulaPreset[]>(...);
  const [showNebulaPresetPanel, setShowNebulaPresetPanel] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(''); // 当前加载的图片URL
  const [currentImageDataUrl, setCurrentImageDataUrl] = useState<string>(''); // 当前图片的base64
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null); // 当前正在编辑的预设ID
  const [showSavePresetModal, setShowSavePresetModal] = useState(false); // 保存预设弹窗
  const [draggingPresetId, setDraggingPresetId] = useState<string | null>(null);
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastDragYRef = useRef<number | null>(null); // 记录上一次拖动的Y位置
  const [editingNebulaPresetId, setEditingNebulaPresetId] = useState<string | null>(null);
  const [editingNebulaPresetName, setEditingNebulaPresetName] = useState('');

  // 监听选中星云实例的变化，同步更新当前的图片状态
  // 这解决了"保存预设时图片丢失"的问题，确保 currentImageDataUrl 始终与当前选中的实例一致
  useEffect(() => {
    if (!settings.selectedNebulaId || !settings.nebulaInstances) return;

    const selectedInstance = settings.nebulaInstances.find(n => n.id === settings.selectedNebulaId);
    if (selectedInstance) {
      if (selectedInstance.imageUrl && selectedInstance.imageUrl !== currentImageUrl) {
        setCurrentImageUrl(selectedInstance.imageUrl);
      }
      // 如果 selectedInstance.imageUrl 是空的，这里不强制置空，保留最后一次有效值？
      // 不，应该置空，否则可能会保存错误的图片
      if (!selectedInstance.imageUrl && currentImageUrl) {
        setCurrentImageUrl('');
      }

      if (selectedInstance.imageDataUrl !== currentImageDataUrl) {
        setCurrentImageDataUrl(selectedInstance.imageDataUrl || '');
      }
    }
  }, [settings.selectedNebulaId, settings.nebulaInstances]);

  // 星云预设顺序（初始化为空，在 useEffect 中根据用户加载）
  const [presetOrder, setPresetOrder] = useState<string[]>([]);
  // 已删除的系统预设ID列表
  const [deletedBuiltInPresets, setDeletedBuiltInPresets] = useState<string[]>([]);
  // 系统预设重命名映射
  const [builtInPresetNames, setBuiltInPresetNames] = useState<Record<string, string>>({});

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const presetScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加载星云预设相关数据（用户切换时重新加载）
  useEffect(() => {
    try {
      const orderKey = getUserScopedKey('nebula_preset_order');
      const deletedKey = getUserScopedKey('deleted_builtin_presets');
      const namesKey = getUserScopedKey('builtin_preset_names');

      const orderSaved = localStorage.getItem(orderKey);
      const deletedSaved = localStorage.getItem(deletedKey);
      const namesSaved = localStorage.getItem(namesKey);

      setPresetOrder(orderSaved ? JSON.parse(orderSaved) : []);
      setDeletedBuiltInPresets(deletedSaved ? JSON.parse(deletedSaved) : []);
      setBuiltInPresetNames(namesSaved ? JSON.parse(namesSaved) : {});
    } catch (e) {
      setPresetOrder([]);
      setDeletedBuiltInPresets([]);
      setBuiltInPresetNames({});
    }
  }, [getUserScopedKey]);

  // 保存星云预设到localStorage
  // 保存星云预设到localStorage (Handled in App.tsx)
  // useEffect(() => {
  //   localStorage.setItem('nebula_presets', JSON.stringify(nebulaPresets));
  // }, [nebulaPresets]);

  // 保存预设顺序到localStorage（使用用户隔离的键）
  useEffect(() => {
    const key = getUserScopedKey('nebula_preset_order');
    localStorage.setItem(key, JSON.stringify(presetOrder));
  }, [presetOrder, getUserScopedKey]);

  // 保存已删除的系统预设到localStorage（使用用户隔离的键）
  useEffect(() => {
    const key = getUserScopedKey('deleted_builtin_presets');
    localStorage.setItem(key, JSON.stringify(deletedBuiltInPresets));
  }, [deletedBuiltInPresets, getUserScopedKey]);

  // 保存系统预设重命名到localStorage（使用用户隔离的键）
  useEffect(() => {
    const key = getUserScopedKey('builtin_preset_names');
    localStorage.setItem(key, JSON.stringify(builtInPresetNames));
  }, [builtInPresetNames, getUserScopedKey]);

  // 内置星云预设（过滤已删除的，应用重命名）
  const BUILT_IN_NEBULA_PRESETS: NebulaPreset[] = SAMPLE_IMAGES
    .map((img, i) => ({
      id: `builtin_${i}`,
      name: builtInPresetNames[`builtin_${i}`] || img.name,
      createdAt: 0,
      imageUrl: img.url,
      settings: settings, // 使用当前设置作为默认
      isBuiltIn: true
    }))
    .filter(p => !deletedBuiltInPresets.includes(p.id));

  // 合并内置预设和用户预设，并按顺序排列
  const allPresetsUnsorted = [...BUILT_IN_NEBULA_PRESETS, ...nebulaPresets];
  const allNebulaPresets = presetOrder.length > 0
    ? [...allPresetsUnsorted].sort((a, b) => {
      const indexA = presetOrder.indexOf(a.id);
      const indexB = presetOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    : allPresetsUnsorted;

  // 保存当前配置为新预设（异步：先上传图片到云端）
  const saveNebulaPreset = async (name: string) => {
    const presetId = Date.now().toString();

    // 如果有 base64 图片数据且用户已登录，尝试上传到云端
    let cloudImageUrl = currentImageUrl;
    if (currentImageDataUrl && currentUser) {
      const uploadedUrl = await uploadPresetImage(currentImageDataUrl, presetId);
      if (uploadedUrl) {
        cloudImageUrl = uploadedUrl;
      }
    }

    // 生成缩略图用于预设显示 (避免撑爆 LocalStorage)
    let thumbnailUrl = currentImageDataUrl;
    if (currentImageDataUrl && (!cloudImageUrl || !cloudImageUrl.startsWith('http'))) {
      thumbnailUrl = await createThumbnail(currentImageDataUrl);
    }

    const newPreset: NebulaPreset = {
      id: presetId,
      name,
      createdAt: Date.now(),
      imageUrl: cloudImageUrl,  // 使用云端 URL（如果上传成功）
      imageDataUrl: thumbnailUrl,  // 本地使用缩略图
      settings: { ...settings }
    };
    setNebulaPresets(prev => [...prev, newPreset]);
    setCurrentPresetId(newPreset.id);
  };

  // 更新当前预设（覆盖保存，支持系统预设和用户预设）
  const updateCurrentPreset = async () => {
    if (!currentPresetId) return;

    // 如果有 base64 图片数据且用户已登录，尝试上传到云端
    let cloudImageUrl = currentImageUrl;
    if (currentImageDataUrl && currentUser) {
      const uploadedUrl = await uploadPresetImage(currentImageDataUrl, currentPresetId);
      if (uploadedUrl) {
        cloudImageUrl = uploadedUrl;
      }
    }

    // 生成缩略图用于预设显示
    let thumbnailUrl = currentImageDataUrl;
    if (currentImageDataUrl && (!cloudImageUrl || !cloudImageUrl.startsWith('http'))) {
      thumbnailUrl = await createThumbnail(currentImageDataUrl);
    }

    // 检查是否是系统预设
    const isBuiltInPreset = currentPresetId.startsWith('builtin_');

    if (isBuiltInPreset) {
      // 系统预设：更新到用户预设列表中（如果已存在则更新，否则创建）
      const existingUserPreset = nebulaPresets.find(p => p.id === currentPresetId);
      if (existingUserPreset) {
        // 已经转换过的系统预设，直接更新
        setNebulaPresets(prev => prev.map(p =>
          p.id === currentPresetId
            ? { ...p, imageUrl: cloudImageUrl, imageDataUrl: thumbnailUrl, settings: { ...settings } }
            : p
        ));
      } else {
        // 首次保存系统预设，将其添加到用户预设列表
        const builtInPreset = allNebulaPresets.find(p => p.id === currentPresetId);
        if (builtInPreset) {
          const newPreset: NebulaPreset = {
            id: currentPresetId,
            name: builtInPreset.name,
            createdAt: Date.now(),
            imageUrl: cloudImageUrl,
            imageDataUrl: thumbnailUrl,
            settings: { ...settings },
            isBuiltIn: false // 转换为用户预设
          };
          setNebulaPresets(prev => [...prev, newPreset]);
        }
      }
    } else {
      // 用户预设：直接更新
      setNebulaPresets(prev => prev.map(p =>
        p.id === currentPresetId
          ? { ...p, imageUrl: cloudImageUrl, imageDataUrl: thumbnailUrl, settings: { ...settings } }
          : p
      ));
    }
    setShowSavePresetModal(false);
  };

  // 加载预设
  const loadNebulaPreset = (preset: NebulaPreset) => {
    if (!preset.isBuiltIn) {
      // 用户预设：加载配置，但保留当前的星云实例列表
      setSettings(prev => ({
        ...preset.settings,
        nebulaInstances: prev.nebulaInstances,
        selectedNebulaId: prev.selectedNebulaId
      }));
    }
    // 所有预设都设置currentPresetId，以支持保存功能
    setCurrentPresetId(preset.id);
    // 加载图片
    const imageUrl = preset.imageDataUrl || preset.imageUrl;
    onSampleSelect(imageUrl);
    setCurrentImageUrl(preset.imageUrl);
    setCurrentImageDataUrl(preset.imageDataUrl || '');
    // 进入预览模式：暂时隐藏星云列表，只显示主场景星云
    setNebulaPreviewMode(true);
  };

  // 删除预设（支持系统预设和用户预设）
  const deleteNebulaPreset = (id: string, isBuiltIn?: boolean) => {
    if (isBuiltIn) {
      setDeletedBuiltInPresets(prev => [...prev, id]);
    } else {
      setNebulaPresets(prev => prev.filter(p => p.id !== id));
    }
  };

  // 重命名预设（支持系统预设和用户预设）
  const renameNebulaPreset = (id: string, newName: string, isBuiltIn?: boolean) => {
    if (!newName.trim()) return;
    if (isBuiltIn) {
      setBuiltInPresetNames(prev => ({ ...prev, [id]: newName.trim() }));
    } else {
      setNebulaPresets(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
    }
    setEditingNebulaPresetId(null);
    setEditingNebulaPresetName('');
  };

  // 导出预设
  const exportNebulaPreset = (preset: NebulaPreset) => {
    const exportData = {
      ...preset,
      exportedAt: Date.now()
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nebula-preset-${preset.name}-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 导入预设
  const importNebulaPreset = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as NebulaPreset;
        const newPreset: NebulaPreset = {
          ...data,
          id: Date.now().toString(),
          createdAt: Date.now(),
          isBuiltIn: false
        };
        setNebulaPresets(prev => [...prev, newPreset]);
      } catch (err) {
        console.error('导入预设失败:', err);
      }
    };
    reader.readAsText(file);
  };

  // 预设拖动排序 - 丝滑跟随手指版本
  const handlePresetDragStart = (presetId: string, clientX: number, clientY: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setDragPosition({ x: clientX, y: clientY });
    setDraggingPresetId(presetId);
    lastDragYRef.current = clientY; // 记录初始Y位置
  };

  const handlePresetDragMove = (clientX: number, clientY: number) => {
    if (!draggingPresetId) return;
    setDragPosition({ x: clientX, y: clientY });

    // 基于手指移动方向的滚动逻辑
    const container = presetScrollContainerRef.current;
    if (container && lastDragYRef.current !== null) {
      const deltaY = clientY - lastDragYRef.current;
      const scrollSpeed = 1.5; // 滚动速度倍数

      // 手指向上移动(deltaY < 0) → 显示上方内容(scrollTop减少)
      // 手指向下移动(deltaY > 0) → 显示下方内容(scrollTop增加)
      if (Math.abs(deltaY) > 1) {
        container.scrollTop -= deltaY * scrollSpeed;
      }
    }
    lastDragYRef.current = clientY; // 更新上一次Y位置

    // 检测悬停的预设
    const element = document.elementFromPoint(clientX, clientY);
    const presetEl = element?.closest('[data-preset-id]');
    if (presetEl) {
      const targetId = presetEl.getAttribute('data-preset-id');
      if (targetId && targetId !== draggingPresetId) {
        setDragOverPresetId(targetId);
      }
    }
  };

  const handlePresetDragOver = (presetId: string) => {
    if (draggingPresetId && presetId !== draggingPresetId) {
      setDragOverPresetId(presetId);
    }
  };

  const handlePresetDragEnd = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    if (draggingPresetId && dragOverPresetId) {
      // 使用presetOrder来重新排序所有预设（包括内置预设）
      const currentOrder = presetOrder.length > 0
        ? [...presetOrder]
        : allNebulaPresets.map(p => p.id);

      const dragIndex = currentOrder.indexOf(draggingPresetId);
      const dropIndex = currentOrder.indexOf(dragOverPresetId);

      if (dragIndex !== -1 && dropIndex !== -1) {
        const [removed] = currentOrder.splice(dragIndex, 1);
        currentOrder.splice(dropIndex, 0, removed);
        setPresetOrder(currentOrder);
      } else if (dragIndex === -1 || dropIndex === -1) {
        // 如果有新预设不在顺序中，先添加所有预设ID
        const allIds = allNebulaPresets.map(p => p.id);
        const newOrder = [...allIds];
        const newDragIndex = newOrder.indexOf(draggingPresetId);
        const newDropIndex = newOrder.indexOf(dragOverPresetId);
        if (newDragIndex !== -1 && newDropIndex !== -1) {
          const [removed] = newOrder.splice(newDragIndex, 1);
          newOrder.splice(newDropIndex, 0, removed);
          setPresetOrder(newOrder);
        }
      }
    }
    setDraggingPresetId(null);
    setDragOverPresetId(null);
    setDragPosition(null);
    lastDragYRef.current = null; // 清理上一次Y位置
  };

  const handlePresetLongPressStart = (presetId: string, e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const target = e.currentTarget as HTMLElement;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    longPressTimerRef.current = setTimeout(() => {
      handlePresetDragStart(presetId, clientX, clientY, target);
    }, 300); // 300ms长按触发（更快响应）
  };

  const handlePresetLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 通用确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText?: string) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, confirmText });
  };

  // 通用输入弹窗状态
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  }>({ isOpen: false, title: '', placeholder: '', defaultValue: '', onConfirm: () => { } });

  const showInput = (title: string, placeholder: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setInputModal({ isOpen: true, title, placeholder, defaultValue, onConfirm });
  };

  // 生成材质样式的工具函数
  const generateMaterialStyle = (config: ButtonMaterialConfig, isActive: boolean, accentColor?: string, buttonIndex: number = 0) => {
    const { type } = config;
    const color = accentColor || '#6366f1';

    switch (type) {
      case 'glass': {
        const { blur, opacity, borderOpacity, tint, tint2 } = config.glass;
        // 根据buttonIndex选择颜色
        const currentTint = buttonIndex === 0 ? tint : (tint2 || tint);
        // 将tint颜色转换为rgba格式并应用透明度
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 255, g: 255, b: 255 };
        };
        const tintRgb = hexToRgb(currentTint);
        const tintOpacity = opacity * 0.6; // 染色透明度
        return isActive ? {
          background: `linear-gradient(135deg, rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${tintOpacity}), rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${opacity * 0.3}))`,
          backdropFilter: `blur(${blur}px)`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,${borderOpacity}), 0 0 20px rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},0.15)`,
          border: `1px solid rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${borderOpacity * 0.8})`,
          color: 'white'
        } : {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'rgba(156,163,175,0.7)'
        };
      }
      case 'neon': {
        const { glowIntensity, glowSpread, borderGlow, textGlow, color: neonColor, color2: neonColor2 } = config.neon;
        // 根据buttonIndex选择颜色，如果有accentColor则优先使用
        const c = accentColor || (buttonIndex === 0 ? neonColor : (neonColor2 || neonColor));
        const intensity = glowIntensity / 100;
        // 将hex颜色转换为rgba以支持透明度
        const hexToRgba = (hex: string, alpha: number) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          if (result) {
            return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
          }
          return hex;
        };
        // box-shadow会跟随border-radius，使用多层阴影创建柔和光晕
        const glowShadow = `0 0 ${Math.round(glowSpread * 0.5)}px ${hexToRgba(c, intensity * 0.6)}, 0 0 ${glowSpread}px ${hexToRgba(c, intensity * 0.4)}, 0 0 ${glowSpread * 1.5}px ${hexToRgba(c, intensity * 0.2)}${borderGlow ? `, inset 0 0 ${Math.round(glowSpread * 0.5)}px ${hexToRgba(c, 0.15)}` : ''}`;
        return isActive ? {
          background: `linear-gradient(180deg, ${hexToRgba(c, 0.15)} 0%, ${hexToRgba(c, 0.08)} 100%)`,
          boxShadow: glowShadow,
          border: `1px solid ${hexToRgba(c, 0.6)}`,
          borderRadius: '0.5rem',
          color: c,
          textShadow: textGlow ? `0 0 10px ${c}, 0 0 20px ${hexToRgba(c, 0.5)}` : 'none',
          position: 'relative' as const,
          zIndex: 1
        } : {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'rgba(156,163,175,0.7)'
        };
      }
      case 'crystal': {
        const { facets, shine, depth, color: crystalColor, highlightColor, color2, highlightColor2 } = config.crystal;
        // 根据buttonIndex选择颜色组（0=第一组，1=第二组）
        const c = buttonIndex === 1 ? color2 : crystalColor;
        const h = buttonIndex === 1 ? highlightColor2 : highlightColor;
        const shineOpacity = shine / 100;
        const depthOpacity = depth / 100;
        const gradientStops = facets === 2 ? `${c} 0%, ${h} 100%` :
          facets === 3 ? `${c} 0%, ${h} 50%, ${c} 100%` :
            facets === 4 ? `${c} 0%, ${h} 30%, ${c} 60%, ${h} 100%` :
              `${c} 0%, ${h} 25%, ${c} 50%, ${h} 75%, ${c} 100%`;
        return isActive ? {
          background: `linear-gradient(135deg, ${gradientStops})`,
          boxShadow: `0 4px 20px ${c}50, inset 0 2px 4px rgba(255,255,255,${shineOpacity * 0.4}), inset 0 -2px 4px rgba(0,0,0,${depthOpacity * 0.3})`,
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        } : {
          background: 'linear-gradient(135deg, rgba(50,50,70,0.6) 0%, rgba(30,30,45,0.8) 100%)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(180,180,200,0.8)'
        };
      }
      case 'neumorphism': {
        const { elevation, curvature, lightAngle, shadowIntensity, baseColor, highlightColor, shadowColor } = config.neumorphism;
        const rad = (lightAngle * Math.PI) / 180;
        const offsetX = Math.cos(rad) * elevation;
        const offsetY = Math.sin(rad) * elevation;
        const shadowAlpha = shadowIntensity / 100;
        return isActive ? {
          background: `linear-gradient(${lightAngle}deg, ${highlightColor} 0%, ${baseColor} ${curvature}%, ${shadowColor} 100%)`,
          boxShadow: `inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.3), ${offsetX}px ${offsetY}px ${elevation * 1.5}px rgba(0,0,0,${shadowAlpha}), 0 1px 2px rgba(0,0,0,0.2)`,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderBottom: '1px solid rgba(0,0,0,0.3)',
          color: 'white'
        } : {
          background: `linear-gradient(${lightAngle}deg, #252530 0%, #1a1a22 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)',
          color: 'rgba(156,163,175,0.7)'
        };
      }
      case 'holographic': {
        const { colors, colors2, speed, angle } = config.holographic;
        // 根据buttonIndex选择颜色组
        const currentColors = buttonIndex === 0 ? colors : (colors2 || colors);
        const colorStops = currentColors.map((c, i) => `${c} ${(i / (currentColors.length - 1)) * 100}%`).join(', ');
        return isActive ? {
          background: `linear-gradient(${angle}deg, ${colorStops})`,
          backgroundSize: '200% 200%',
          animation: speed > 0 ? `holographic-shift ${10 - speed}s ease infinite` : 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)'
        } : {
          background: 'linear-gradient(135deg, rgba(50,50,70,0.6) 0%, rgba(30,30,45,0.8) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(180,180,200,0.8)'
        };
      }
      default:
        return {};
    }
  };

  // 选项按钮样式生成器（用于轴选择、颜色模式等）
  const getOptionButtonStyle = (isActive: boolean): React.CSSProperties => {
    return generateMaterialStyle(materialSettings.optionButtons, isActive) as React.CSSProperties;
  };

  // 预设配色方案
  const DEFAULT_SCHEMES = {
    midnight: {
      name: '午夜星空',
      darkBg: '#000000',
      lightBg: '#F4F1EC',
      primary: '#6366F1',
      secondary: '#A5B4FC',
      textAccent: '#818CF8',
      decoration: '#4F46E5',
      editBar: '#14B8A6',
      isSystem: true
    },
    auroraWarm: {
      name: '极光冷暖',
      darkBg: '#0b1020',
      lightBg: '#F4F7FA',
      primary: '#22D3EE',
      secondary: '#F59E0B',
      textAccent: '#A78BFA',
      decoration: '#60A5FA',
      editBar: '#22D3EE',
      isSystem: true
    },
    cyberMagenta: {
      name: '赛博粉蓝',
      darkBg: '#0a0812',
      lightBg: '#F6F5FB',
      primary: '#00E5FF',
      secondary: '#FF8E53',
      textAccent: '#FF6EC7',
      decoration: '#9B59B6',
      editBar: '#00E5FF',
      isSystem: true
    },
    deepOcean: {
      name: '深海青蓝',
      darkBg: '#071b25',
      lightBg: '#F3F9FA',
      primary: '#14B8A6',
      secondary: '#38BDF8',
      textAccent: '#84CC16',
      decoration: '#0EA5E9',
      editBar: '#14B8A6',
      isSystem: true
    },
    solarIndigo: {
      name: '金冠靛蓝',
      darkBg: '#111019',
      lightBg: '#FAFAFD',
      primary: '#F4B400',
      secondary: '#6366F1',
      textAccent: '#FF6EC7',
      decoration: '#7C3AED',
      editBar: '#F4B400',
      isSystem: true
    },
    emeraldFlame: {
      name: '翡翠火焰',
      darkBg: '#0b1a16',
      lightBg: '#F3FBF8',
      primary: '#34D399',
      secondary: '#FB923C',
      textAccent: '#60A5FA',
      decoration: '#10B981',
      editBar: '#34D399',
      isSystem: true
    },
    lavaNebula: {
      name: '熔岩星云',
      darkBg: '#110b0c',
      lightBg: '#FFF7F4',
      primary: '#EF4444',
      secondary: '#F59E0B',
      textAccent: '#60A5FA',
      decoration: '#FB7185',
      editBar: '#EF4444',
      isSystem: true
    },
    glacierMint: {
      name: '冰川薄荷',
      darkBg: '#081417',
      lightBg: '#F2FAF9',
      primary: '#7DE2D1',
      secondary: '#9BDCFD',
      textAccent: '#B9A5FF',
      decoration: '#5AD1E2',
      editBar: '#7DE2D1',
      isSystem: true
    },
    sakuraNight: {
      name: '樱夜',
      darkBg: '#120d14',
      lightBg: '#FFF6FB',
      primary: '#F472B6',
      secondary: '#F59E0B',
      textAccent: '#60A5FA',
      decoration: '#D946EF',
      editBar: '#F472B6',
      isSystem: true
    },
    noirGold: {
      name: '黑金',
      darkBg: '#0b0b0d',
      lightBg: '#FBF8EE',
      primary: '#F5C857',
      secondary: '#86EFAC',
      textAccent: '#60A5FA',
      decoration: '#D4AF37',
      editBar: '#F5C857',
      isSystem: true
    },
    vaporwave: {
      name: '蒸汽波',
      darkBg: '#0d0b16',
      lightBg: '#F6FAFF',
      primary: '#8B5CF6',
      secondary: '#22D3EE',
      textAccent: '#FF7AB6',
      decoration: '#00F5D4',
      editBar: '#8B5CF6',
      isSystem: true
    },
    steelCyan: {
      name: '钢青',
      darkBg: '#0c141b',
      lightBg: '#F3F7FB',
      primary: '#06B6D4',
      secondary: '#94A3B8',
      textAccent: '#A5B4FC',
      decoration: '#1E293B',
      editBar: '#06B6D4',
      isSystem: true
    },
    desertAurora: {
      name: '沙漠极光',
      darkBg: '#1a1310',
      lightBg: '#FFF8EE',
      primary: '#F59E0B',
      secondary: '#22D3EE',
      textAccent: '#FCA5A5',
      decoration: '#EAB308',
      editBar: '#F59E0B',
      isSystem: true
    },
    forestTemple: {
      name: '森林神殿',
      darkBg: '#0c1612',
      lightBg: '#F4FBF6',
      primary: '#22C55E',
      secondary: '#FDE68A',
      textAccent: '#60A5FA',
      decoration: '#16A34A',
      editBar: '#22C55E',
      isSystem: true
    },
    stormBlue: {
      name: '风暴蓝',
      darkBg: '#0b1320',
      lightBg: '#F3F7FF',
      primary: '#3B82F6',
      secondary: '#FCD34D',
      textAccent: '#22D3EE',
      decoration: '#8B5CF6',
      editBar: '#3B82F6',
      isSystem: true
    },
    cosmicPurple: {
      name: '宇宙紫',
      darkBg: '#0f0a1a',
      lightBg: '#F8F5FF',
      primary: '#A855F7',
      secondary: '#EC4899',
      textAccent: '#38BDF8',
      decoration: '#7C3AED',
      editBar: '#A855F7',
      isSystem: true
    },
    bloodMoon: {
      name: '血月',
      darkBg: '#140808',
      lightBg: '#FFF5F5',
      primary: '#DC2626',
      secondary: '#F97316',
      textAccent: '#FDE68A',
      decoration: '#991B1B',
      editBar: '#DC2626',
      isSystem: true
    },
    neonCity: {
      name: '霓虹都市',
      darkBg: '#050510',
      lightBg: '#F5F5FF',
      primary: '#00FF87',
      secondary: '#FF00E5',
      textAccent: '#00D4FF',
      decoration: '#FFE600',
      editBar: '#00FF87',
      isSystem: true
    },
    autumnLeaf: {
      name: '秋叶',
      darkBg: '#151008',
      lightBg: '#FFFBF0',
      primary: '#EA580C',
      secondary: '#84CC16',
      textAccent: '#FBBF24',
      decoration: '#C2410C',
      editBar: '#EA580C',
      isSystem: true
    },
    arcticFrost: {
      name: '极地霜',
      darkBg: '#0a1218',
      lightBg: '#F0FEFF',
      primary: '#67E8F9',
      secondary: '#E0E7FF',
      textAccent: '#A5F3FC',
      decoration: '#0891B2',
      editBar: '#67E8F9',
      isSystem: true
    },
    sunsetGlow: {
      name: '落日余晖',
      darkBg: '#1a0f10',
      lightBg: '#FFF7F0',
      primary: '#FB7185',
      secondary: '#FBBF24',
      textAccent: '#A78BFA',
      decoration: '#F43F5E',
      editBar: '#FB7185',
      isSystem: true
    },
    bambooZen: {
      name: '竹林禅',
      darkBg: '#0d1510',
      lightBg: '#F5FBF5',
      primary: '#4ADE80',
      secondary: '#A3E635',
      textAccent: '#FCD34D',
      decoration: '#166534',
      editBar: '#4ADE80',
      isSystem: true
    },
    retroWave: {
      name: '复古波',
      darkBg: '#120818',
      lightBg: '#FFF5FA',
      primary: '#E879F9',
      secondary: '#22D3EE',
      textAccent: '#FDE047',
      decoration: '#C026D3',
      editBar: '#E879F9',
      isSystem: true
    }
  };

  // 方案类型定义
  type ColorScheme = {
    name: string;
    darkBg: string;
    lightBg: string;
    primary: string;
    secondary: string;
    textAccent: string;
    decoration: string;
    editBar: string;
    isSystem?: boolean;
  };

  // 状态：所有方案（预设+用户自定义）
  const [colorSchemes, setColorSchemes] = useState<Record<string, ColorScheme>>(DEFAULT_SCHEMES);

  // 状态：当前选中方案的 ID
  const [activeSchemeId, setActiveSchemeId] = useState<string>('midnight');

  // 状态：当前生效的颜色（可能与选中方案不同，因为用户可能在微调）
  const [customColors, setCustomColors] = useState({
    darkBg: '#000000',
    lightBg: '#F4F1EC',
    primary: DEFAULT_SCHEMES.midnight.primary,
    secondary: DEFAULT_SCHEMES.midnight.secondary,
    textAccent: DEFAULT_SCHEMES.midnight.textAccent,
    decoration: DEFAULT_SCHEMES.midnight.decoration,
    editBar: DEFAULT_SCHEMES.midnight.editBar
  });

  // 加载用户自定义方案和上次选中的方案（用户切换时重新加载）
  useEffect(() => {
    try {
      // 使用用户隔离的 localStorage 键
      const schemesKey = getUserScopedKey('user_color_schemes');
      const deletedKey = getUserScopedKey('deleted_system_schemes');
      const activeIdKey = getUserScopedKey('active_scheme_id');
      const activeColorsKey = getUserScopedKey('active_colors');

      // 加载用户方案
      const saved = localStorage.getItem(schemesKey);
      // 加载已删除的系统预设ID
      const deletedSystemSchemes: string[] = JSON.parse(localStorage.getItem(deletedKey) || '[]');

      // 从系统预设开始，排除已删除的
      let updatedSchemes: Record<string, ColorScheme> = {};
      Object.entries(DEFAULT_SCHEMES).forEach(([id, scheme]) => {
        if (!deletedSystemSchemes.includes(id)) {
          updatedSchemes[id] = scheme;
        }
      });

      // 合并用户方案
      if (saved) {
        const parsed = JSON.parse(saved);
        updatedSchemes = { ...updatedSchemes, ...parsed };
      }

      setColorSchemes(updatedSchemes);

      // 加载上次选中的方案ID和颜色
      const lastSchemeId = localStorage.getItem(activeIdKey);
      const lastColors = localStorage.getItem(activeColorsKey);

      if (lastSchemeId && updatedSchemes[lastSchemeId]) {
        setActiveSchemeId(lastSchemeId);
      } else {
        // 如果上次选中的方案已被删除，选择第一个可用方案
        const firstKey = Object.keys(updatedSchemes)[0];
        if (firstKey) setActiveSchemeId(firstKey);
      }
      if (lastColors) {
        const colors = JSON.parse(lastColors);
        setCustomColors(prev => ({ ...prev, ...colors }));
      }
    } catch (e) {
      console.error('Failed to load color schemes', e);
    }
  }, [getUserScopedKey]);

  // 切换配色方案
  const applyScheme = (schemeId: string) => {
    setActiveSchemeId(schemeId);
    const scheme = colorSchemes[schemeId];
    if (scheme) {
      setCustomColors(prev => ({
        ...prev,
        darkBg: scheme.darkBg,
        lightBg: scheme.lightBg,
        primary: scheme.primary,
        secondary: scheme.secondary,
        textAccent: scheme.textAccent,
        decoration: scheme.decoration,
        editBar: scheme.editBar
      }));
    }
  };

  // 保存/另存为方案
  const saveScheme = (asNew: boolean = false) => {
    const currentScheme = colorSchemes[activeSchemeId];

    if (asNew) {
      // 另存为新方案
      showInput('另存为新方案', '请输入方案名称', '我的配色', (name) => {
        const newId = `user_${Date.now()}`;
        const newScheme: ColorScheme = {
          name,
          darkBg: customColors.darkBg,
          lightBg: customColors.lightBg,
          primary: customColors.primary,
          secondary: customColors.secondary,
          textAccent: customColors.textAccent,
          decoration: customColors.decoration,
          editBar: customColors.editBar,
          isSystem: false
        };

        const updatedSchemes = { ...colorSchemes, [newId]: newScheme };
        setColorSchemes(updatedSchemes);
        setActiveSchemeId(newId);

        // 持久化用户方案
        const userSchemes = Object.fromEntries(
          Object.entries(updatedSchemes).filter(([_, s]) => !s.isSystem)
        );
        localStorage.setItem(getUserScopedKey('user_color_schemes'), JSON.stringify(userSchemes));
      });
    } else {
      // 更新当前方案
      showConfirm('保存修改', `确定保存对「${currentScheme.name}」的修改吗？`, () => {
        const updatedScheme = {
          ...currentScheme,
          darkBg: customColors.darkBg,
          lightBg: customColors.lightBg,
          primary: customColors.primary,
          secondary: customColors.secondary,
          textAccent: customColors.textAccent,
          decoration: customColors.decoration,
          editBar: customColors.editBar
        };

        const updatedSchemes = { ...colorSchemes, [activeSchemeId]: updatedScheme };
        setColorSchemes(updatedSchemes);

        // 保存所有用户方案和修改
        const userSchemes = Object.fromEntries(
          Object.entries(updatedSchemes).filter(([_, s]) => !s.isSystem)
        );
        localStorage.setItem(getUserScopedKey('user_color_schemes'), JSON.stringify(userSchemes));
      }, '保存');
    }
  };

  // 删除方案
  const deleteScheme = (schemeId: string) => {
    const scheme = colorSchemes[schemeId];
    if (!scheme) return;

    // 至少保留一个方案
    if (Object.keys(colorSchemes).length <= 1) {
      alert('至少需要保留一个配色方案');
      return;
    }

    showConfirm('删除方案', `确定删除方案「${scheme.name}」吗？`, () => {
      const { [schemeId]: deleted, ...rest } = colorSchemes;
      setColorSchemes(rest);

      // 如果删除的是当前选中的，切换到第一个可用方案
      if (activeSchemeId === schemeId) {
        const firstKey = Object.keys(rest)[0];
        applyScheme(firstKey);
      }

      // 更新持久化存储
      const userSchemes = Object.fromEntries(
        Object.entries(rest).filter(([_, s]) => !s.isSystem)
      );
      localStorage.setItem(getUserScopedKey('user_color_schemes'), JSON.stringify(userSchemes));

      // 如果是系统预设，记录已删除的ID
      if (scheme.isSystem) {
        const deletedSystemSchemes = JSON.parse(localStorage.getItem(getUserScopedKey('deleted_system_schemes')) || '[]');
        if (!deletedSystemSchemes.includes(schemeId)) {
          deletedSystemSchemes.push(schemeId);
          localStorage.setItem(getUserScopedKey('deleted_system_schemes'), JSON.stringify(deletedSystemSchemes));
        }
      }
    }, '删除');
  };

  // 应用主题和自定义颜色
  useEffect(() => {
    // 始终使用深色主题
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add('theme-dark');

    // 应用自定义颜色到 CSS 变量
    const root = document.documentElement;
    root.style.setProperty('--custom-dark-bg', customColors.darkBg);

    // 应用新版 5 色变量
    root.style.setProperty('--custom-primary', customColors.primary);
    root.style.setProperty('--custom-secondary', customColors.secondary);
    root.style.setProperty('--custom-text-accent', customColors.textAccent);
    root.style.setProperty('--custom-decoration', customColors.decoration);
    root.style.setProperty('--custom-edit-bar', customColors.editBar);

    // 持久化当前颜色设置
    // 持久化当前颜色设置（使用用户隔离的键）
    localStorage.setItem(getUserScopedKey('active_scheme_id'), activeSchemeId);
    localStorage.setItem(getUserScopedKey('active_colors'), JSON.stringify(customColors));

  }, [customColors, activeSchemeId]);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [editingPlanetId, setEditingPlanetId] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedPlanetTemplate[]>([]);
  const [orbitPanelCollapsed, setOrbitPanelCollapsed] = useState(true);

  // 各子系统的选中项ID
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(null);
  // Solo 功能：仅显示某个核心（不改变 enabled 状态）
  const [soloCoreId, setSoloCoreId] = useState<string | null>(null);
  const [selectedSolidCoreId, setSelectedSolidCoreId] = useState<string | null>(null);
  // Solo 功能：仅显示某个实体核心
  const [soloSolidCoreId, setSoloSolidCoreId] = useState<string | null>(null);
  const [solidCoreTab, setSolidCoreTab] = useState<'appearance' | 'texture' | 'lighting'>('appearance');
  const [coreSubTab, setCoreSubTab] = useState<'particle' | 'solid'>('particle');
  const [selectedParticleRingId, setSelectedParticleRingId] = useState<string | null>(null);
  const [selectedContinuousRingId, setSelectedContinuousRingId] = useState<string | null>(null);
  const [selectedSilkRingId, setSelectedSilkRingId] = useState<string | null>(null);
  const [ringSubTab, setRingSubTab] = useState<'particle' | 'continuous' | 'silk' | 'spiral'>('particle');
  const [flameSubTab, setFlameSubTab] = useState<'surface' | 'jet' | 'spiral'>('surface');
  const [selectedEnergyBodyId, setSelectedEnergyBodyId] = useState<string | null>(null);
  // Solo 功能：仅显示某个能量罩
  const [soloEnergyBodyId, setSoloEnergyBodyId] = useState<string | null>(null);
  const [energyBodySubTab, setEnergyBodySubTab] = useState<'geometry' | 'appearance' | 'effects'>('geometry');
  const [energyBodySystemSubTab, setEnergyBodySystemSubTab] = useState<'core' | 'shield'>('core');
  const [radiationSubTab, setRadiationSubTab] = useState<'orbiting' | 'emitter'>('orbiting');
  const [fireflySubTab, setFireflySubTab] = useState<'orbiting' | 'wandering'>('orbiting');
  const [selectedOrbitingId, setSelectedOrbitingId] = useState<string | null>(null);
  const [selectedEmitterId, setSelectedEmitterId] = useState<string | null>(null);
  const [selectedOrbitingFireflyId, setSelectedOrbitingFireflyId] = useState<string | null>(null);
  // Solo 功能：仅显示某个粒子环绕
  const [soloOrbitingFireflyId, setSoloOrbitingFireflyId] = useState<string | null>(null);
  const [selectedWanderingGroupId, setSelectedWanderingGroupId] = useState<string | null>(null);
  const [selectedAfterimageZoneId, setSelectedAfterimageZoneId] = useState<string | null>(null);
  const [selectedSurfaceFlameId, setSelectedSurfaceFlameId] = useState<string | null>(null);
  const [selectedSpiralFlameId, setSelectedSpiralFlameId] = useState<string | null>(null);
  // Solo 功能：仅显示某个螺旋环
  const [soloSpiralFlameId, setSoloSpiralFlameId] = useState<string | null>(null);
  // Solo 功能：仅显示某个粒子喷射
  const [soloFlameJetId, setSoloFlameJetId] = useState<string | null>(null);

  // 实体核心预设编辑状态
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');

  // 加载保存的星球模板
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PLANET_TEMPLATES_STORAGE_KEY);
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load planet templates:', e);
    }
  }, []);

  // 同步 soloCoreId 到 planetSettings
  useEffect(() => {
    setPlanetSettings(prev => ({ ...prev, soloCoreId }));
  }, [soloCoreId, setPlanetSettings]);

  // 同步 soloSolidCoreId 到 planetSettings
  useEffect(() => {
    setPlanetSettings(prev => ({ ...prev, soloSolidCoreId }));
  }, [soloSolidCoreId, setPlanetSettings]);

  // 同步 soloSpiralFlameId 到 planetSettings
  useEffect(() => {
    setPlanetSettings(prev => ({ ...prev, soloSpiralFlameId }));
  }, [soloSpiralFlameId, setPlanetSettings]);

  // 同步 soloOrbitingFireflyId 到 planetSettings
  useEffect(() => {
    setPlanetSettings(prev => ({ ...prev, soloOrbitingFireflyId }));
  }, [soloOrbitingFireflyId, setPlanetSettings]);

  // 同步 soloFlameJetId 到 planetSettings
  useEffect(() => {
    setPlanetSettings(prev => ({ ...prev, soloFlameJetId }));
  }, [soloFlameJetId, setPlanetSettings]);

  // 保存模板到 localStorage
  const saveTemplates = (templates: SavedPlanetTemplate[]) => {
    setSavedTemplates(templates);
    try {
      localStorage.setItem(PLANET_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.warn('Failed to save planet templates:', e);
    }
  };

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 获取当前选中的星云实例
  const selectedNebula = settings.selectedNebulaId
    ? (settings.nebulaInstances || []).find(n => n.id === settings.selectedNebulaId)
    : null;

  // 更新选中星云实例的属性（如果有选中的话）
  const updateSelectedNebula = <K extends keyof NebulaInstance>(key: K, value: NebulaInstance[K]) => {
    if (!settings.selectedNebulaId) return;
    const updated = (settings.nebulaInstances || []).map(n =>
      n.id === settings.selectedNebulaId ? { ...n, [key]: value } : n
    );
    handleChange('nebulaInstances', updated);
  };

  // 智能更新：有选中星云时更新星云实例，否则更新全局设置
  const handleParticleChange = (globalKey: keyof AppSettings, instanceKey: keyof NebulaInstance, value: any) => {
    if (selectedNebula) {
      updateSelectedNebula(instanceKey, value);
    } else {
      handleChange(globalKey, value);
    }
  };

  // 智能更新（需要重新生成粒子数据的参数）
  const handleParticleChangeWithRegenerate = (globalKey: keyof AppSettings, instanceKey: keyof NebulaInstance, value: any) => {
    if (selectedNebula) {
      // 更新参数并增加 dataVersion 触发重新生成
      const updated = (settings.nebulaInstances || []).map(n =>
        n.id === settings.selectedNebulaId
          ? { ...n, [instanceKey]: value, dataVersion: (n.dataVersion || 0) + 1 }
          : n
      );
      handleChange('nebulaInstances', updated);
    } else {
      handleChange(globalKey, value);
    }
  };

  // 获取参数值：优先使用选中星云的值，否则使用全局设置
  const getParticleValue = (globalKey: keyof AppSettings, instanceKey: keyof NebulaInstance) => {
    if (selectedNebula) {
      return (selectedNebula as any)[instanceKey];
    }
    return (settings as any)[globalKey];
  };

  // 当选中颜色时，自动添加到过滤列表
  useEffect(() => {
    if (pickedColor && settings.colorFilter.enabled) {
      const hue = Math.round(pickedColor.h * 360);
      const newFilter: ColorFilter = {
        id: Date.now().toString(),
        hueStart: Math.max(0, hue - 15),
        hueEnd: Math.min(360, hue + 15),
        enabled: true
      };
      handleChange('colorFilter', {
        ...settings.colorFilter,
        filters: [...settings.colorFilter.filters, newFilter]
      });
      setColorPickMode(false);
    }
  }, [pickedColor]);

  const tabs: { key: TabType; label: string; icon: string; color: string }[] = [
    { key: 'particle', label: '粒子\n效果', icon: '✨', color: '#10b981' },
    { key: 'line', label: '连线\n效果', icon: '🔗', color: '#a78bfa' },
    { key: 'interact', label: '交互\n设置', icon: '👆', color: '#22d3ee' }
  ];

  return (
    <div
      className="w-80 h-full overflow-y-auto p-4 transition-all"
      style={{
        position: 'relative',
        zIndex: 100,
        background: 'linear-gradient(135deg, rgba(10,10,20,0.06) 0%, rgba(5,5,15,0.06) 50%, rgba(10,10,20,0.06) 100%)',
        backdropFilter: 'blur(6px) saturate(180%)',
        WebkitBackdropFilter: 'blur(6px) saturate(180%)',
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), -12px 0 40px rgba(0, 0, 0, 0.3)',
        color: 'var(--text-1)'
      }}
    >
      {/* 设置按钮 */}


      {/* 标题栏 - 星云模式 */}
      {appMode === 'nebula' && (
        <div className="mb-4 pt-1">
          <h1 className="text-3xl font-bold mb-2 text-center xingspark-logo-title">
            XingCloud
          </h1>
          <div className="flex justify-between text-xs font-mono" style={{ color: 'var(--text-2)' }}>
            <span>FPS: {fps}</span>
            <span>粒子数: {(particleCount / 1000).toFixed(1)}k</span>
          </div>
        </div>
      )}

      {/* 标题栏 - 星球模式 */}
      {appMode === 'planet' && (
        <div className="mb-4 pt-1">
          <h1 className="text-3xl font-bold mb-2 text-center xingspark-logo-title">
            XingForge
          </h1>
          <div className="flex justify-between text-xs font-mono" style={{ color: 'var(--text-2)' }}>
            <span>FPS: {fps}</span>
            <span>粒子数: {(particleCount / 1000).toFixed(1)}k</span>
          </div>
        </div>
      )}

      {/* ==================== 星云模式控制面板 ==================== */}
      {appMode === 'nebula' && (() => {
        const secondaryInteractionColor = '#22d3ee';
        return (
          <>
            {/* 图像源 - 星云模式显示 */}
            <ControlGroup title="图像源">
              {/* 上传区域 */}
              <div
                className="rounded-xl p-4 text-center cursor-pointer relative transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: `linear-gradient(135deg, ${secondaryInteractionColor}15 0%, ${secondaryInteractionColor}08 100%)`,
                  border: `2px dashed ${secondaryInteractionColor}60`,
                  boxShadow: `inset 0 0 20px ${secondaryInteractionColor}15`
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        const id = Date.now().toString();
                        const existingInstances = settings.nebulaInstances || [];

                        // 创建新星云实例
                        const newNebula: NebulaInstance = {
                          ...DEFAULT_NEBULA_INSTANCE,
                          id,
                          name: `星云 ${existingInstances.length + 1}`,
                          imageUrl: '',
                          imageDataUrl: dataUrl,
                          enabled: true,
                        };

                        if (existingInstances.length === 0) {
                          // 列表为空：即时生成粒子显示
                          onImageUpload(file);
                          handleChange('nebulaInstances', [newNebula]);
                        } else {
                          // 列表不为空：取消其他实例勾选，仅勾选新增
                          const updatedInstances = existingInstances.map(n => ({ ...n, enabled: false }));
                          handleChange('nebulaInstances', [...updatedInstances, newNebula]);
                        }
                        handleChange('selectedNebulaId', id);
                        setCurrentImageDataUrl(dataUrl);
                        setCurrentImageUrl('');

                        // 自动同步到云端 (解决刷新后图片丢失问题)
                        if (currentUser) {
                          uploadPresetImage(dataUrl, "inst_" + id).then(cloudUrl => {
                            if (cloudUrl) {
                              setSettings(prev => ({
                                ...prev,
                                nebulaInstances: prev.nebulaInstances?.map(inst =>
                                  inst.id === id
                                    ? { ...inst, imageUrl: cloudUrl, imageDataUrl: undefined }
                                    : inst
                                )
                              }));
                              setCurrentImageUrl(cloudUrl);
                            }
                          }).catch(err => console.error("Auto-upload failed:", err));
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="text-2xl mb-2">☁️</div>
                <p className="text-xs text-gray-300">拖拽或点击上传图片</p>
              </div>

              {/* 预设列表 */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">预设图案</span>
                  <div className="flex gap-1">
                    {/* 玻璃样式按钮 */}
                    <button
                      onClick={() => setShowNebulaPresetPanel(true)}
                      className={`px-2 py-1 text-xs rounded-lg transition-all hover:scale-105 ${generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).className}`}
                      style={generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).style}
                      title="展开全部预设"
                    >
                      📋
                    </button>
                    <label
                      className={`px-2 py-1 text-xs rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center ${generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).className}`}
                      style={generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).style}
                      title="导入预设"
                    >
                      📥
                      <input type="file" accept=".json" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) importNebulaPreset(e.target.files[0]);
                      }} />
                    </label>
                  </div>
                </div>

                {/* 预设列表 - 显示前3个，点击直接添加到星云列表 */}
                <div className="grid grid-cols-3 gap-2">
                  {allNebulaPresets.slice(0, 3).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        // 点击直接添加到星云列表
                        const id = Date.now().toString();
                        const existingInstances = settings.nebulaInstances || [];
                        const newNebula: NebulaInstance = {
                          ...DEFAULT_NEBULA_INSTANCE,
                          id,
                          name: preset.name,
                          imageUrl: preset.imageUrl,
                          imageDataUrl: preset.imageDataUrl || '',
                          enabled: true,
                        };
                        // 取消其他实例勾选，仅勾选新增
                        const updatedInstances = existingInstances.map(n => ({ ...n, enabled: false }));
                        handleChange('nebulaInstances', [...updatedInstances, newNebula]);
                        handleChange('selectedNebulaId', id);
                      }}
                      className="h-12 rounded-lg bg-cover bg-center text-xs text-white/0 hover:text-white/100 transition-all flex items-center justify-center font-bold relative overflow-hidden group"
                      style={{
                        backgroundImage: `url(${preset.imageDataUrl || preset.imageUrl})`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                      title={preset.name}
                    >
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all" />
                      <span className="relative z-10 text-[10px] truncate px-1">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </ControlGroup>

            {/* 星云列表 */}
            <ControlGroup title="星云列表">
              {/* 顶部操作栏 */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setShowNebulaPresetPanel(true)}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).className}`}
                  style={generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).style}
                >
                  + 从预设中添加
                </button>
              </div>

              {/* 星云列表项 - 固定两行高度的滑动窗口 */}
              <div className="max-h-[120px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {(settings.nebulaInstances || []).map((nebula, idx) => (
                  <div
                    key={nebula.id}
                    onClick={() => {
                      handleChange('selectedNebulaId', nebula.id);
                      // 选中星云时自动启用它，确保可以实时调整参数
                      if (!nebula.enabled) {
                        const updated = (settings.nebulaInstances || []).map(n =>
                          n.id === nebula.id ? { ...n, enabled: true } : n
                        );
                        handleChange('nebulaInstances', updated);
                      }
                    }}
                    className="p-2 rounded cursor-pointer transition-colors"
                    style={settings.selectedNebulaId === nebula.id
                      ? {
                        background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.15)',
                        border: '1px solid var(--ui-primary)'
                      }
                      : {
                        background: 'rgba(31, 41, 55, 0.8)',
                        border: '1px solid transparent'
                      }
                    }
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={nebula.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          const updated = (settings.nebulaInstances || []).map(n =>
                            n.id === nebula.id ? { ...n, enabled: e.target.checked } : n
                          );
                          handleChange('nebulaInstances', updated);
                        }}
                        className="rounded flex-shrink-0"
                        style={{ accentColor: 'var(--ui-primary)' }}
                      />
                      {/* 缩略图 */}
                      <div
                        className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0"
                        style={{
                          backgroundImage: `url(${nebula.imageDataUrl || nebula.imageUrl})`,
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                      <span className="flex-1 px-1 py-0.5 text-xs text-white truncate">
                        {nebula.name}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        {/* 复制按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = Date.now().toString();
                            const copy: NebulaInstance = {
                              ...nebula,
                              id,
                              name: `${nebula.name} 副本`,
                            };
                            handleChange('nebulaInstances', [...(settings.nebulaInstances || []), copy]);
                            handleChange('selectedNebulaId', id);
                          }}
                          className="p-1 text-blue-400 hover:text-blue-300 hover:bg-gray-600 rounded transition-colors"
                          title="复制"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = (settings.nebulaInstances || []).filter(n => n.id !== nebula.id);
                            handleChange('nebulaInstances', updated);
                            if (settings.selectedNebulaId === nebula.id) {
                              handleChange('selectedNebulaId', updated[0]?.id || null);
                            }
                          }}
                          className="p-1 text-[10px] hover:bg-red-600/50 rounded transition-colors text-red-400"
                          title="删除"
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
                {(settings.nebulaInstances || []).length === 0 && (
                  <div className="p-3 text-center text-xs text-gray-500">
                    暂无星云，点击上方按钮添加
                  </div>
                )}
              </div>

              {/* 编辑栏 - 当有选中星云时显示 */}
              {settings.selectedNebulaId && (() => {
                const selectedNebula = (settings.nebulaInstances || []).find(n => n.id === settings.selectedNebulaId);
                if (!selectedNebula) return null;
                return (
                  <div className="mt-3 p-1.5 rounded flex items-center justify-between" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    backdropFilter: 'blur(8px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {selectedNebula.name || '未命名星云'}</span>
                    <button
                      onClick={() => {
                        // 使用统一样式的输入弹窗
                        showInput('保存到预设', '请输入预设名称', selectedNebula.name, async (presetName) => {
                          if (presetName) {
                            // 尝试优先上传图片以获取 Cloud URL
                            let finalImageUrl = selectedNebula.imageUrl;
                            if ((!finalImageUrl || !finalImageUrl.startsWith('http')) && selectedNebula.imageDataUrl) {
                              try {
                                const cloudUrl = await uploadPresetImage(selectedNebula.imageDataUrl, "preset_" + Date.now());
                                if (cloudUrl) finalImageUrl = cloudUrl;
                              } catch (e) { console.error("Preset upload failed", e); }
                            }

                            // 深拷贝settings，排除可能导致循环引用的字段
                            const settingsCopy = JSON.parse(JSON.stringify({
                              ...settings,
                              // 清理可能导致问题的大型数据
                              nebulaInstances: (settings.nebulaInstances || []).map(n => ({
                                ...n,
                                imageDataUrl: undefined // 不保存base64图片数据到预设
                              }))
                            }));
                            // 生成缩略图用于预设显示
                            let thumbnailUrl = selectedNebula.imageDataUrl;
                            if (selectedNebula.imageDataUrl && (!finalImageUrl || !finalImageUrl.startsWith('http'))) {
                              thumbnailUrl = await createThumbnail(selectedNebula.imageDataUrl);
                            }

                            const newPreset: NebulaPreset = {
                              id: Date.now().toString(),
                              name: presetName,
                              createdAt: Date.now(),
                              imageUrl: finalImageUrl,
                              imageDataUrl: thumbnailUrl,
                              settings: settingsCopy,
                            };
                            setNebulaPresets(prev => [...prev, newPreset]);
                          }
                        });
                      }}
                      className={`px-2 py-0.5 text-[10px] rounded transition-all font-medium ${generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).className}`}
                      style={generateMaterialStyle(materialSettings?.optionButtons || createDefaultMaterialConfig('glass'), false).style}
                    >
                      保存到预设
                    </button>
                  </div>
                );
              })()}
            </ControlGroup>

            {/* 选中星云的设置 */}
            {settings.selectedNebulaId && (() => {
              const selectedNebula = (settings.nebulaInstances || []).find(n => n.id === settings.selectedNebulaId);
              if (!selectedNebula) return null;

              const updateNebula = (key: keyof NebulaInstance, value: any) => {
                const updated = (settings.nebulaInstances || []).map(n =>
                  n.id === settings.selectedNebulaId ? { ...n, [key]: value } : n
                );
                handleChange('nebulaInstances', updated);
              };

              return (
                <ControlGroup title={`基础设置：${selectedNebula.name}`}>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500">X</label>
                        <input
                          type="number"
                          value={selectedNebula.position.x}
                          onChange={(e) => {
                            const str = e.target.value;
                            if (str === '' || str === '-') return; // 允许临时输入空或负号
                            const val = parseFloat(str);
                            if (!isNaN(val)) updateNebula('position', { ...selectedNebula.position, x: val });
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || e.target.value === '-') {
                              updateNebula('position', { ...selectedNebula.position, x: 0 });
                            }
                          }}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Y</label>
                        <input
                          type="number"
                          value={selectedNebula.position.y}
                          onChange={(e) => {
                            const str = e.target.value;
                            if (str === '' || str === '-') return;
                            const val = parseFloat(str);
                            if (!isNaN(val)) updateNebula('position', { ...selectedNebula.position, y: val });
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || e.target.value === '-') {
                              updateNebula('position', { ...selectedNebula.position, y: 0 });
                            }
                          }}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Z</label>
                        <input
                          type="number"
                          value={selectedNebula.position.z}
                          onChange={(e) => {
                            const str = e.target.value;
                            if (str === '' || str === '-') return;
                            const val = parseFloat(str);
                            if (!isNaN(val)) updateNebula('position', { ...selectedNebula.position, z: val });
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || e.target.value === '-') {
                              updateNebula('position', { ...selectedNebula.position, z: 0 });
                            }
                          }}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                        />
                      </div>
                    </div>
                    <RangeControl label="整体缩放" value={selectedNebula.scale} min={0.1} max={6} step={0.1} onChange={(v) => updateNebula('scale', v)} />
                  </div>
                </ControlGroup>
              );
            })()}

            {/* 保存预设弹窗 */}
            {showSavePresetModal && createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setShowSavePresetModal(false)}>
                <div
                  className="w-[85%] max-w-sm rounded-2xl p-5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.08) 100%)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderTop: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-sm font-medium text-white mb-4">保存预设</h3>
                  <p className="text-xs text-gray-300 mb-4">
                    {currentPresetId
                      ? '选择保存方式：覆盖当前预设或另存为新预设'
                      : '当前使用的是新图片，将创建新预设'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {/* 保存当前预设按钮 - 仅当有当前预设时显示，使用主交互色 */}
                    {currentPresetId && (
                      <button
                        onClick={updateCurrentPreset}
                        className="w-full py-2.5 text-sm rounded-lg transition-all hover:scale-[1.02]"
                        style={{
                          background: `linear-gradient(135deg, #6366f140 0%, #6366f120 100%)`,
                          border: `1px solid #6366f180`,
                          boxShadow: `0 0 12px #6366f130`,
                          color: 'white'
                        }}
                      >
                        💾 保存当前预设
                      </button>
                    )}
                    {/* 另存为新预设按钮 - 使用次交互色 */}
                    <button
                      onClick={() => {
                        setShowSavePresetModal(false);
                        showInput('另存为新预设', '请输入预设名称', `我的预设 ${nebulaPresets.length + 1}`, async (presetName) => {
                          if (presetName) {
                            const selectedNebula = (settings.nebulaInstances || []).find(n => n.id === settings.selectedNebulaId);
                            if (!selectedNebula) return;

                            let finalImageUrl = selectedNebula.imageUrl;
                            if ((!finalImageUrl || !finalImageUrl.startsWith('http')) && selectedNebula.imageDataUrl) {
                              try {
                                const cloudUrl = await uploadPresetImage(selectedNebula.imageDataUrl, "preset_" + Date.now());
                                finalImageUrl = cloudUrl || finalImageUrl;
                              } catch (e) { console.error(e); }
                            }

                            // Create new preset
                            const settingsCopy = JSON.parse(JSON.stringify({
                              ...settings,
                              nebulaInstances: (settings.nebulaInstances || []).map(n => ({
                                ...n,
                                imageDataUrl: undefined
                              }))
                            }));

                            // 生成缩略图用于预设显示
                            let thumbnailUrl = selectedNebula.imageDataUrl;
                            if (selectedNebula.imageDataUrl && (!finalImageUrl || !finalImageUrl.startsWith('http'))) {
                              thumbnailUrl = await createThumbnail(selectedNebula.imageDataUrl);
                            }

                            const newPreset: NebulaPreset = {
                              id: Date.now().toString(),
                              name: presetName,
                              createdAt: Date.now(),
                              imageUrl: finalImageUrl,
                              imageDataUrl: thumbnailUrl,
                              settings: settingsCopy,
                            };
                            setNebulaPresets(prev => [...prev, newPreset]);
                          }
                        });
                      }}
                      className="w-full py-2.5 text-sm rounded-lg transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, #22d3ee40 0%, #22d3ee20 100%)`,
                        border: `1px solid #22d3ee80`,
                        boxShadow: `0 0 12px #22d3ee30`,
                        color: 'white'
                      }}
                    >
                      ✨ 另存为新预设
                    </button>
                    {/* 取消按钮 */}
                    <button
                      onClick={() => setShowSavePresetModal(false)}
                      className="w-full py-2 text-sm rounded-lg transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* 预设浮窗 - 透明玻璃质感 + 增强上下立体感 */}
            {showNebulaPresetPanel && createPortal(
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
                onClick={() => { setShowNebulaPresetPanel(false); setEditingNebulaPresetId(null); }}
                onTouchMove={(e) => { if (draggingPresetId) { e.preventDefault(); e.stopPropagation(); } }}
                style={draggingPresetId ? { touchAction: 'none' } : undefined}
              >
                <div
                  className="w-[90%] max-w-lg max-h-[70vh] rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30,30,40,0.10) 0%, rgba(20,20,30,0.10) 50%, rgba(25,25,35,0.10) 100%)',
                    backdropFilter: 'blur(6px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(6px) saturate(180%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderTop: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 顶部标题栏 - 增强立体高光 */}
                  <div
                    className="flex items-center justify-between p-4"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.005) 100%)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.08)'
                    }}
                  >
                    <span className="text-sm font-medium text-white">全部预设</span>
                    <span className="text-[10px] text-gray-300/70">双击添加 · 长按拖动排序</span>
                    <button
                      onClick={() => { setShowNebulaPresetPanel(false); setEditingNebulaPresetId(null); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderTop: '1px solid rgba(255,255,255,0.3)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)'
                      }}
                    >
                      <span className="text-gray-200">✕</span>
                    </button>
                  </div>
                  {/* 内容区域 */}
                  <div
                    ref={presetScrollContainerRef}
                    className="p-4 overflow-y-auto max-h-[calc(70vh-60px)]"
                    style={draggingPresetId ? { touchAction: 'none', overscrollBehavior: 'contain' } : undefined}
                    onMouseMove={(e) => handlePresetDragMove(e.clientX, e.clientY)}
                    onTouchMove={(e) => {
                      if (draggingPresetId && e.touches[0]) {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePresetDragMove(e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    onMouseUp={handlePresetDragEnd}
                    onTouchEnd={handlePresetDragEnd}
                  >
                    <div className="grid grid-cols-3 gap-3">
                      {allNebulaPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className={`relative group transition-all cursor-pointer ${draggingPresetId === preset.id ? 'opacity-30 scale-90' : ''} ${dragOverPresetId === preset.id && draggingPresetId ? 'ring-2 ring-blue-400 scale-105' : ''}`}
                          onMouseDown={(e) => handlePresetLongPressStart(preset.id, e)}
                          onMouseUp={() => { handlePresetLongPressEnd(); }}
                          onMouseLeave={() => { handlePresetLongPressEnd(); }}
                          onTouchStart={(e) => handlePresetLongPressStart(preset.id, e)}
                          onTouchEnd={() => { handlePresetLongPressEnd(); }}
                          data-preset-id={preset.id}
                        >
                          {/* 图片区域 - 双击添加到星云列表 */}
                          <div
                            onDoubleClick={() => {
                              if (!draggingPresetId && editingNebulaPresetId !== preset.id) {
                                // 双击添加到星云列表
                                const id = Date.now().toString();
                                const existingInstances = settings.nebulaInstances || [];
                                const newNebula: NebulaInstance = {
                                  ...DEFAULT_NEBULA_INSTANCE,
                                  id,
                                  name: preset.name,
                                  imageUrl: preset.imageUrl,
                                  imageDataUrl: preset.imageDataUrl || '',
                                  enabled: true,
                                };
                                // 取消其他实例勾选，仅勾选新增
                                const updatedInstances = existingInstances.map(n => ({ ...n, enabled: false }));
                                handleChange('nebulaInstances', [...updatedInstances, newNebula]);
                                handleChange('selectedNebulaId', id);
                                setShowNebulaPresetPanel(false);
                              }
                            }}
                            className="w-full aspect-square rounded-xl bg-cover bg-center text-xs text-white transition-all flex flex-col items-center justify-end overflow-hidden cursor-pointer"
                            style={{
                              backgroundImage: `url(${preset.imageDataUrl || preset.imageUrl})`,
                              backgroundColor: 'rgba(50,50,60,0.8)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.15)'
                            }}
                          >
                          </div>
                          {/* 名称区域 - 独立出来支持双击重命名 */}
                          {editingNebulaPresetId === preset.id ? (
                            <input
                              type="text"
                              value={editingNebulaPresetName}
                              onChange={(e) => setEditingNebulaPresetName(e.target.value)}
                              onBlur={() => renameNebulaPreset(preset.id, editingNebulaPresetName, preset.isBuiltIn)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') renameNebulaPreset(preset.id, editingNebulaPresetName, preset.isBuiltIn);
                                if (e.key === 'Escape') { setEditingNebulaPresetId(null); setEditingNebulaPresetName(''); }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full mt-1 p-1 bg-black/80 text-[10px] text-center border-none outline-none text-white rounded"
                            />
                          ) : (
                            <div
                              className="w-full mt-1 p-1 bg-black/40 text-[10px] text-center truncate hover:bg-black/60 transition-all rounded cursor-text"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setEditingNebulaPresetId(preset.id);
                                setEditingNebulaPresetName(preset.name);
                              }}
                            >
                              {preset.name}
                            </div>
                          )}
                          {/* 操作按钮 - 所有预设都显示 */}
                          {(
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* 置顶按钮 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 将预设移到最前面
                                  const currentOrder = presetOrder.length > 0 ? [...presetOrder] : allNebulaPresets.map(p => p.id);
                                  const index = currentOrder.indexOf(preset.id);
                                  if (index > 0) {
                                    currentOrder.splice(index, 1);
                                    currentOrder.unshift(preset.id);
                                    setPresetOrder(currentOrder);
                                  }
                                }}
                                className="p-1.5 rounded-lg backdrop-blur-md text-[10px] transition-all hover:scale-110"
                                style={{
                                  background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.3)',
                                  border: '1px solid rgba(var(--ui-primary-rgb, 99, 102, 241), 0.6)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                                title="置顶"
                              >📌</button>
                              {/* 保存按钮 - 将当前编辑的星云实例保存到此预设 */}
                              {settings.selectedNebulaId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const selectedNebula = (settings.nebulaInstances || []).find(n => n.id === settings.selectedNebulaId);
                                    if (!selectedNebula) return;
                                    showConfirm(
                                      '保存到预设',
                                      `确定要将当前编辑的星云"${selectedNebula.name}"保存到预设"${preset.name}"吗？`,
                                      async () => {
                                        let finalImageUrl = selectedNebula.imageUrl;
                                        if ((!finalImageUrl || !finalImageUrl.startsWith('http')) && selectedNebula.imageDataUrl) {
                                          try {
                                            const cloudUrl = await uploadPresetImage(selectedNebula.imageDataUrl, "preset_" + Date.now());
                                            if (cloudUrl) finalImageUrl = cloudUrl;
                                          } catch (e) { console.error(e); }
                                        }

                                        if (preset.isBuiltIn) {
                                          // 内置预设：创建新的用户预设
                                          const newPreset: NebulaPreset = {
                                            id: Date.now().toString(),
                                            name: preset.name,
                                            createdAt: Date.now(),
                                            imageUrl: finalImageUrl,
                                            imageDataUrl: (finalImageUrl && finalImageUrl.startsWith('http')) ? undefined : selectedNebula.imageDataUrl,
                                            settings: settings,
                                          };
                                          setNebulaPresets(prev => [...prev, newPreset]);
                                        } else {
                                          // 用户预设：更新现有预设
                                          setNebulaPresets(prev => prev.map(p =>
                                            p.id === preset.id
                                              ? { ...p, imageUrl: finalImageUrl, imageDataUrl: (finalImageUrl && finalImageUrl.startsWith('http')) ? undefined : selectedNebula.imageDataUrl, settings: settings }
                                              : p
                                          ));
                                        }
                                      }
                                    );
                                  }}
                                  className="p-1.5 rounded-lg backdrop-blur-md text-[10px] transition-all hover:scale-110"
                                  style={{
                                    background: 'rgba(34, 197, 94, 0.3)',
                                    border: '1px solid rgba(34, 197, 94, 0.6)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                  }}
                                  title="保存当前星云到此预设"
                                >💾</button>
                              )}
                              {/* 玻璃样式导出按钮 */}
                              <button
                                onClick={(e) => { e.stopPropagation(); exportNebulaPreset(preset); }}
                                className="p-1.5 rounded-lg backdrop-blur-md text-[10px] transition-all hover:scale-110"
                                style={{
                                  background: 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)',
                                  border: '1px solid rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.6)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                                title="导出"
                              >📤</button>
                              {/* 玻璃样式删除按钮 */}
                              <button
                                onClick={(e) => { e.stopPropagation(); showConfirm('删除预设', `确定要删除预设"${preset.name}"吗？`, () => deleteNebulaPreset(preset.id, preset.isBuiltIn)); }}
                                className="p-1.5 rounded-lg backdrop-blur-md text-[10px] transition-all hover:scale-110"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.3)',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                                title="删除"
                              >🗑️</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 底部装饰 - 透明玻璃底边高光 */}
                  <div
                    className="h-1"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 100%)',
                      boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.15)'
                    }}
                  />
                </div>
              </div>,
              document.body
            )}

            {/* 拖动中的浮动预览 */}
            {draggingPresetId && dragPosition && createPortal(
              <div
                className="fixed pointer-events-none z-[10000]"
                style={{
                  left: dragPosition.x - dragOffset.x,
                  top: dragPosition.y - dragOffset.y,
                  width: 100,
                  height: 100,
                  transform: 'rotate(5deg) scale(1.1)',
                  transition: 'transform 0.1s ease-out'
                }}
              >
                {(() => {
                  const preset = allNebulaPresets.find(p => p.id === draggingPresetId);
                  if (!preset) return null;
                  return (
                    <div
                      className="w-full h-full rounded-xl bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${preset.imageDataUrl || preset.imageUrl})`,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 2px rgba(99, 102, 241, 0.6)',
                        border: '2px solid rgba(255,255,255,0.3)'
                      }}
                    />
                  );
                })()}
              </div>,
              document.body
            )}

            <div className="flex gap-2 mb-4 p-1.5 rounded-xl" style={{ background: 'linear-gradient(145deg, rgba(30,30,40,0.8), rgba(15,15,20,0.9))' }}>
              {tabs.map(tab => {
                const isActive = activeTab === tab.key;
                const tabColor = tab.color;
                const materialStyle = generateMaterialStyle(materialSettings?.mainTabs || createDefaultMaterialConfig('glass'), isActive, tabColor);

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-2.5 px-2 text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 font-medium relative overflow-hidden ${isActive ? 'transform scale-[1.02]' : 'hover:scale-[1.01]'}`}
                    style={materialStyle}
                  >
                    {/* 顶部高光条 */}
                    {isActive && (materialSettings?.mainTabs?.type === 'glass' || materialSettings?.mainTabs?.type === 'neumorphism') && (
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px]"
                        style={{ background: `linear-gradient(90deg, transparent 0%, ${tabColor}60 50%, transparent 100%)` }}
                      />
                    )}
                    <span className="text-sm" style={isActive && (materialSettings?.mainTabs?.type === 'neon' || materialSettings?.mainTabs?.type === 'neumorphism') ? {
                      filter: `drop-shadow(0 0 4px ${tabColor}80)`
                    } : undefined}>{tab.icon}</span>
                    <span className="whitespace-pre-line text-center leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ===== 粒子效果 Tab ===== */}
            {activeTab === 'particle' && (
              <>
                {/* 子Tab切换 - 霓虹发光样式 */}
                <div className="flex gap-2 mb-4">
                  {['basic', 'dynamic'].map((tabKey) => {
                    const isSubActive = particleSubTab === tabKey;
                    const subMatStyle = generateMaterialStyle(materialSettings?.moduleTabs || createDefaultMaterialConfig('glass'), isSubActive);
                    return (
                      <button
                        key={tabKey}
                        onClick={() => setParticleSubTab(tabKey as any)}
                        className={`flex-1 py-2 px-3 text-xs rounded-lg font-medium`}
                        style={subMatStyle}
                      >
                        {tabKey === 'basic' ? '基础设置' : '动态样式'}
                      </button>
                    );
                  })}
                </div>

                {/* 基础设置子Tab */}
                {particleSubTab === 'basic' && (
                  <>
                    <ControlGroup title={selectedNebula ? `粒子生成 ${selectedNebula.name}` : "粒子生成"}>
                      <RangeControl label="采样步长 (越小越密)" value={getParticleValue('density', 'density')} min={1} max={25} step={0.2} onChange={(v) => handleParticleChangeWithRegenerate('density', 'density', v)} />
                      <RangeControl label="亮度阈值" value={getParticleValue('threshold', 'threshold')} min={0} max={100} onChange={(v) => handleParticleChangeWithRegenerate('threshold', 'threshold', v)} />
                      <RangeControl label="基础大小" value={getParticleValue('baseSize', 'baseSize')} min={0} max={40} step={0.2} onChange={(v) => handleParticleChange('baseSize', 'baseSize', v)} />
                      <RangeControl label="亮度" value={getParticleValue('brightness', 'brightness')} min={0.1} max={3} step={0.1} onChange={(v) => handleParticleChange('brightness', 'brightness', v)} />
                      <RangeControl label="透明度" value={getParticleValue('opacity', 'opacity') ?? 1.0} min={0.1} max={3} step={0.1} onChange={(v) => handleParticleChange('opacity', 'opacity', v)} />

                      {/* 辉光和饱和度 */}
                      <div className="space-y-1 mt-2">
                        <RangeControl label="Bloom 辉光" value={settings.bloomStrength} min={0} max={1} step={0.01} onChange={(v) => handleChange('bloomStrength', v)} />
                        <RangeControl label="色彩饱和度" value={getParticleValue('colorSaturation', 'colorSaturation')} min={0} max={10} step={0.1} onChange={(v) => handleParticleChange('colorSaturation', 'colorSaturation', v)} />
                      </div>

                      {/* 轮廓优先采样 */}
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <GlassToggle
                          enabled={getParticleValue('edgeSamplingEnabled', 'edgeSamplingEnabled')}
                          onChange={(v) => handleParticleChangeWithRegenerate('edgeSamplingEnabled', 'edgeSamplingEnabled', v)}
                          label="轮廓优先采样"
                          color={secondaryInteractionColor}
                        />

                        {getParticleValue('edgeSamplingEnabled', 'edgeSamplingEnabled') && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl
                              label="边缘灵敏度"
                              value={getParticleValue('edgeSensitivity', 'edgeSensitivity')}
                              min={0.05} max={0.8} step={0.05}
                              onChange={(v) => handleParticleChangeWithRegenerate('edgeSensitivity', 'edgeSensitivity', v)}
                            />
                            <RangeControl
                              label="边缘密度提升"
                              value={getParticleValue('edgeDensityBoost', 'edgeDensityBoost')}
                              min={1} max={5} step={0.5}
                              onChange={(v) => handleParticleChangeWithRegenerate('edgeDensityBoost', 'edgeDensityBoost', v)}
                            />
                            <RangeControl
                              label="内部填充密度"
                              value={getParticleValue('fillDensity', 'fillDensity')}
                              min={0} max={1} step={0.1}
                              onChange={(v) => handleParticleChangeWithRegenerate('fillDensity', 'fillDensity', v)}
                            />
                            <p className="text-xs text-gray-500 mt-1">提示：填充密度=0 为纯轮廓效果</p>

                            <div className="mt-2">
                              <GlassToggle
                                enabled={getParticleValue('pureOutlineMode', 'pureOutlineMode')}
                                onChange={(v) => handleParticleChangeWithRegenerate('pureOutlineMode', 'pureOutlineMode', v)}
                                label="纯轮廓模式"
                                color={secondaryInteractionColor}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </ControlGroup>

                    <ControlGroup title={selectedNebula ? `3D 深度映射 ${selectedNebula.name}` : "3D 深度映射"}>
                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1">映射模式</label>
                        <select
                          value={getParticleValue('depthMode', 'depthMode')}
                          onChange={(e) => handleParticleChangeWithRegenerate('depthMode', 'depthMode', e.target.value as DepthMode)}
                          className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                        >
                          {Object.values(DepthMode).map(mode => (
                            <option key={mode} value={mode}>{DepthModeLabels[mode]}</option>
                          ))}
                        </select>
                      </div>
                      <RangeControl label="深度范围" value={getParticleValue('depthRange', 'depthRange')} min={0} max={800} onChange={(v) => handleParticleChangeWithRegenerate('depthRange', 'depthRange', v)} />

                      {/* 波浪模式参数 */}
                      {getParticleValue('depthMode', 'depthMode') === DepthMode.Wave && (
                        <>
                          <RangeControl label="波浪频率" value={getParticleValue('waveFrequency', 'waveFrequency')} min={0.005} max={0.1} step={0.005} onChange={(v) => handleParticleChangeWithRegenerate('waveFrequency', 'waveFrequency', v)} />
                          <RangeControl label="波浪振幅" value={getParticleValue('waveAmplitude', 'waveAmplitude')} min={0.1} max={2.0} step={0.1} onChange={(v) => handleParticleChangeWithRegenerate('waveAmplitude', 'waveAmplitude', v)} />
                        </>
                      )}

                      {/* 分形噪声参数 */}
                      {getParticleValue('depthMode', 'depthMode') === DepthMode.FBM && (
                        <>
                          <RangeControl label="噪声层数" value={getParticleValue('fbmOctaves', 'fbmOctaves')} min={1} max={8} step={1} onChange={(v) => handleParticleChangeWithRegenerate('fbmOctaves', 'fbmOctaves', v)} />
                          <RangeControl label="噪声强度" value={getParticleValue('noiseStrength', 'noiseStrength')} min={0} max={100} onChange={(v) => handleParticleChangeWithRegenerate('noiseStrength', 'noiseStrength', v)} />
                        </>
                      )}

                      {/* 柏林噪声参数 */}
                      {getParticleValue('depthMode', 'depthMode') === DepthMode.Perlin && (
                        <RangeControl label="噪声强度" value={getParticleValue('noiseStrength', 'noiseStrength')} min={0} max={100} onChange={(v) => handleParticleChangeWithRegenerate('noiseStrength', 'noiseStrength', v)} />
                      )}

                      {/* 双眼视差参数 */}
                      {getParticleValue('depthMode', 'depthMode') === DepthMode.Stereo && (
                        <RangeControl label="视差分离度" value={getParticleValue('stereoSeparation', 'stereoSeparation')} min={0} max={100} onChange={(v) => handleParticleChangeWithRegenerate('stereoSeparation', 'stereoSeparation', v)} />
                      )}

                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={getParticleValue('depthInvert', 'depthInvert')}
                          onChange={(e) => handleParticleChangeWithRegenerate('depthInvert', 'depthInvert', e.target.checked)}
                          className="rounded bg-gray-700/50 border-gray-600/50 w-3 h-3"
                        />
                        <span className="opacity-70">反转深度</span>
                      </div>
                    </ControlGroup>

                    {/* 几何映射 - 通过 shader uniform 实现，不需要重新生成粒子数据 */}
                    <ControlGroup title={selectedNebula ? `几何映射 ${selectedNebula.name}` : "几何映射"}>
                      <div className="mb-2">
                        <label className="block text-xs text-gray-400 mb-1">映射模式</label>
                        <select
                          value={getParticleValue('geometryMapping', 'geometryMapping')}
                          onChange={(e) => handleParticleChange('geometryMapping', 'geometryMapping', e.target.value as 'none' | 'sphere' | 'cylinder')}
                          className="w-full px-2 py-1 text-xs rounded bg-gray-700 border border-gray-600 text-white"
                        >
                          <option value="none">平面（无映射）</option>
                          <option value="sphere">球形映射</option>
                          <option value="cylinder">圆柱映射</option>
                        </select>
                      </div>
                      {getParticleValue('geometryMapping', 'geometryMapping') !== 'none' && (
                        <>
                          <RangeControl label="映射强度" value={getParticleValue('mappingStrength', 'mappingStrength')} min={0} max={1} step={0.05}
                            onChange={(v) => handleParticleChange('mappingStrength', 'mappingStrength', v)} />
                          <RangeControl label="半径" value={getParticleValue('mappingRadius', 'mappingRadius')} min={50} max={500} step={10}
                            onChange={(v) => handleParticleChange('mappingRadius', 'mappingRadius', v)} />
                          <RangeControl label="水平拼接" value={getParticleValue('mappingTileX', 'mappingTileX')} min={1} max={8} step={1}
                            onChange={(v) => handleParticleChange('mappingTileX', 'mappingTileX', v)} />
                          <RangeControl label="垂直拼接" value={getParticleValue('mappingTileY', 'mappingTileY')} min={1} max={4} step={1}
                            onChange={(v) => handleParticleChange('mappingTileY', 'mappingTileY', v)} />
                          <RangeControl label="边缘淡化" value={getParticleValue('mappingEdgeFade', 'mappingEdgeFade')} min={0} max={0.5} step={0.01}
                            onChange={(v) => handleParticleChange('mappingEdgeFade', 'mappingEdgeFade', v)} />
                        </>
                      )}
                    </ControlGroup>

                    {/* 颜色过滤 */}
                    <ControlGroup title="颜色过滤">
                      <GlassToggle
                        enabled={settings.colorFilter.enabled}
                        onChange={(v) => handleChange('colorFilter', { ...settings.colorFilter, enabled: v })}
                        label="启用颜色过滤"
                        color={secondaryInteractionColor}
                      />

                      {settings.colorFilter.enabled && (
                        <>
                          <div className="mb-2">
                            <label className="block text-xs text-gray-400 mb-1">预设</label>
                            <select
                              onChange={(e) => {
                                const preset = e.target.value as ColorFilterPreset;
                                const presetConfig = COLOR_FILTER_PRESETS[preset];
                                handleChange('colorFilter', { ...DEFAULT_COLOR_FILTER, ...presetConfig });
                              }}
                              className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                            >
                              {Object.keys(COLOR_FILTER_PRESETS).map(preset => (
                                <option key={preset} value={preset}>{COLOR_FILTER_PRESET_LABELS[preset as ColorFilterPreset]}</option>
                              ))}
                            </select>
                          </div>

                          <div className="my-2">
                            <GlassToggle
                              enabled={settings.colorFilter.invertMode}
                              onChange={(v) => handleChange('colorFilter', { ...settings.colorFilter, invertMode: v })}
                              label="反向模式"
                              color={secondaryInteractionColor}
                            />
                          </div>

                          <RangeControl
                            label="最小饱和度"
                            value={settings.colorFilter.saturationMin}
                            min={0} max={1} step={0.05}
                            onChange={(v) => handleChange('colorFilter', { ...settings.colorFilter, saturationMin: v })}
                          />

                          {/* 图片取色按钮 */}
                          <div className="mt-2">
                            <button
                              onClick={() => setColorPickMode(!colorPickMode)}
                              className={`w-full px-3 py-2 text-xs rounded border transition-colors flex items-center justify-center gap-2 ${colorPickMode
                                ? 'bg-yellow-600 border-yellow-400 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                                }`}
                            >
                              <i className="fas fa-eye-dropper"></i>
                              {colorPickMode ? '点击图片选择颜色...' : '从图片取色'}
                            </button>
                            {colorPickMode && (
                              <p className="text-xs text-yellow-400 mt-1">点击 3D 场景中的区域选择颜色</p>
                            )}
                          </div>

                          {/* 自定义色段列表 */}
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-gray-400">自定义色段</span>
                              <button
                                onClick={() => {
                                  const newFilter: ColorFilter = {
                                    id: Date.now().toString(),
                                    hueStart: 0,
                                    hueEnd: 60,
                                    enabled: true
                                  };
                                  handleChange('colorFilter', {
                                    ...settings.colorFilter,
                                    filters: [...settings.colorFilter.filters, newFilter]
                                  });
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white"
                              >
                                + 添加
                              </button>
                            </div>

                            {settings.colorFilter.filters.map((filter, index) => (
                              <div key={filter.id} className="mb-3 p-2 bg-gray-800 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={filter.enabled}
                                      onChange={(e) => {
                                        const newFilters = [...settings.colorFilter.filters];
                                        newFilters[index] = { ...filter, enabled: e.target.checked };
                                        handleChange('colorFilter', { ...settings.colorFilter, filters: newFilters });
                                      }}
                                      className="rounded bg-gray-700 border-gray-600"
                                    />
                                    <span className="text-xs text-gray-300">色段 {index + 1}</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newFilters = settings.colorFilter.filters.filter((_, i) => i !== index);
                                      handleChange('colorFilter', { ...settings.colorFilter, filters: newFilters });
                                    }}
                                    className="text-red-400 hover:text-red-300 text-xs"
                                  >
                                    删除
                                  </button>
                                </div>

                                {/* 可拖动色相范围选择器 */}
                                <HueRangeSlider
                                  hueStart={filter.hueStart}
                                  hueEnd={filter.hueEnd}
                                  onChange={(start, end) => {
                                    const newFilters = [...settings.colorFilter.filters];
                                    newFilters[index] = { ...filter, hueStart: start, hueEnd: end };
                                    handleChange('colorFilter', { ...settings.colorFilter, filters: newFilters });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </ControlGroup>

                    {/* 染色效果 */}
                    <ControlGroup title="染色效果">
                      <GlassToggle
                        enabled={settings.colorTint.enabled}
                        onChange={(v) => handleChange('colorTint', { ...settings.colorTint, enabled: v })}
                        label="启用染色"
                        color={secondaryInteractionColor}
                      />

                      <div className={`transition-opacity ${settings.colorTint.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div className="mb-4">
                          <RangeControl
                            label="主色调数量"
                            value={settings.colorTint.colorCount}
                            min={2} max={8} step={1}
                            onChange={(v) => handleChange('colorTint', { ...settings.colorTint, colorCount: v })}
                          />
                        </div>

                        <button
                          onClick={onExtractColors}
                          className="w-full px-3 py-2 mb-4 text-xs font-medium rounded bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all"
                        >
                          🎨 提取主色调
                        </button>

                        {settings.colorTint.mappings.length > 0 && (
                          <>
                            <p className="text-xs text-gray-400 mb-2">主色调映射</p>
                            {settings.colorTint.mappings.map((mapping, idx) => (
                              <div key={idx} className="mb-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-6 h-6 rounded border border-gray-600"
                                      style={{ backgroundColor: mapping.sourceColor }}
                                      title={`原色: ${mapping.sourceColor}`}
                                    />
                                    <span className="text-xs text-gray-400">→</span>
                                    <input
                                      type="color"
                                      value={mapping.targetColor}
                                      onChange={(e) => {
                                        const newMappings = [...settings.colorTint.mappings];
                                        newMappings[idx] = { ...mapping, targetColor: e.target.value };
                                        handleChange('colorTint', { ...settings.colorTint, mappings: newMappings });
                                      }}
                                      className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                                      title="目标颜色"
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500">{mapping.percentage}%</span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs">
                                  <span className="text-gray-400 w-14">色差缩放:</span>
                                  <input
                                    type="range"
                                    value={mapping.hueSpread}
                                    onChange={(e) => {
                                      const newMappings = [...settings.colorTint.mappings];
                                      newMappings[idx] = { ...mapping, hueSpread: Number(e.target.value) };
                                      handleChange('colorTint', { ...settings.colorTint, mappings: newMappings });
                                    }}
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    className="flex-1 h-1.5"
                                  />
                                  <span className="text-gray-300 w-8 text-right">{mapping.hueSpread.toFixed(1)}</span>
                                </div>
                              </div>
                            ))}

                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <RangeControl
                                label="全局混合强度"
                                value={settings.colorTint.globalStrength}
                                min={0} max={1} step={0.1}
                                onChange={(v) => handleChange('colorTint', { ...settings.colorTint, globalStrength: v })}
                              />
                            </div>
                          </>
                        )}

                        {settings.colorTint.mappings.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-4">
                            点击"提取主色调"按钮分析图像颜色
                          </p>
                        )}
                      </div>
                    </ControlGroup>

                    {/* 静态样式 */}
                    <ControlGroup title="静态样式">
                      {/* 粒子形状 */}
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1.5">粒子形状</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.values(ParticleShape).map(shape => (
                            <button
                              key={shape}
                              onClick={() => handleChange('particleShape', shape)}
                              className="px-2 py-1.5 text-xs rounded-lg transition-all"
                              style={settings.particleShape === shape ? {
                                background: `linear-gradient(135deg, ${secondaryInteractionColor}30 0%, ${secondaryInteractionColor}15 100%)`,
                                backdropFilter: 'blur(8px)',
                                border: `1px solid ${secondaryInteractionColor}`,
                                color: secondaryInteractionColor,
                                boxShadow: `0 0 10px ${secondaryInteractionColor}40, inset 0 1px 0 rgba(255,255,255,0.1)`
                              } : {
                                background: 'rgba(0,0,0,0.2)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.5)'
                              }}
                            >
                              {ParticleShapeLabels[shape]}
                            </button>
                          ))}
                        </div>
                      </div>

                    </ControlGroup>
                  </>
                )}

                {/* 动态样式子Tab */}
                {particleSubTab === 'dynamic' && (
                  <>
                    <ControlGroup title={selectedNebula ? `动态效果：${selectedNebula.name}` : "动态效果"}>
                      {/* 粒子微动 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <div className="text-xs mb-3 font-medium" style={{ color: secondaryInteractionColor }}>粒子微动 (Turbulence)</div>
                        <RangeControl
                          label="扰动强度"
                          value={selectedNebula ? selectedNebula.particleTurbulence : settings.particleTurbulence}
                          disabled={!selectedNebula}
                          min={0} max={1} step={0.05}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('particleTurbulence', v);
                          }}
                        />
                        {(selectedNebula ? selectedNebula.particleTurbulence : settings.particleTurbulence) > 0 && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl
                              label="扰动速度"
                              value={selectedNebula ? selectedNebula.turbulenceSpeed : settings.turbulenceSpeed}
                              disabled={!selectedNebula}
                              min={0.1} max={3} step={0.1}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('turbulenceSpeed', v);
                              }}
                            />
                            <RangeControl
                              label="扰动尺度"
                              value={selectedNebula ? selectedNebula.turbulenceScale : settings.turbulenceScale}
                              disabled={!selectedNebula}
                              min={0.001} max={0.02} step={0.001}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('turbulenceScale', v);
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* 呼吸效果 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.breathingEnabled : settings.breathingEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('breathingEnabled', v);
                          }}
                          label="呼吸效果"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.breathingEnabled : settings.breathingEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="呼吸速度" value={selectedNebula ? selectedNebula.breathingSpeed : settings.breathingSpeed} disabled={!selectedNebula} min={0.1} max={2} step={0.1} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('breathingSpeed', v); }} />
                            <RangeControl label="呼吸幅度" value={selectedNebula ? selectedNebula.breathingIntensity : settings.breathingIntensity} disabled={!selectedNebula} min={0.05} max={0.5} step={0.05} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('breathingIntensity', v); }} />
                          </div>
                        )}
                      </div>

                      {/* 涟漪效果 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.rippleEnabled : settings.rippleEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('rippleEnabled', v);
                          }}
                          label="涟漪效果"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.rippleEnabled : settings.rippleEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="涟漪速度" value={selectedNebula ? selectedNebula.rippleSpeed : settings.rippleSpeed} disabled={!selectedNebula} min={0.1} max={2} step={0.1} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('rippleSpeed', v); }} />
                            <RangeControl label="涟漪强度" value={selectedNebula ? selectedNebula.rippleIntensity : settings.rippleIntensity} disabled={!selectedNebula} min={5} max={50} step={5} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('rippleIntensity', v); }} />
                          </div>
                        )}
                      </div>

                      {/* 吸积盘旋转 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.accretionEnabled : settings.accretionEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('accretionEnabled', v);
                          }}
                          label="吸积盘旋转"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.accretionEnabled : settings.accretionEnabled) && (
                          <>
                            <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3 mb-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                              <RangeControl label="基础速度" value={selectedNebula ? selectedNebula.accretionSpeed : settings.accretionSpeed} disabled={!selectedNebula} min={0.1} max={2} step={0.1} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('accretionSpeed', v); }} />
                              <RangeControl label="强度" value={selectedNebula ? selectedNebula.accretionIntensity : settings.accretionIntensity} disabled={!selectedNebula} min={0.1} max={1} step={0.1} onChange={(v) => { if (!selectedNebula) return; updateSelectedNebula('accretionIntensity', v); }} />
                            </div>

                            {/* 多层配置 */}
                            <div className="border-t border-gray-700 pt-3">
                              <p className="text-xs text-gray-400 mb-3">圈层配置 (最多3层)</p>
                              {(selectedNebula ? selectedNebula.accretionLayers : settings.accretionLayers).map((layer, idx) => (
                                <div key={layer.id} className="mb-3 p-2 bg-gray-900/50 rounded border border-gray-700">
                                  <div className="flex items-center space-x-2 text-xs text-gray-300 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={layer.enabled}
                                      onChange={(e) => {
                                        if (!selectedNebula) return;
                                        const newLayers = [...selectedNebula.accretionLayers];
                                        newLayers[idx] = { ...layer, enabled: e.target.checked };
                                        updateSelectedNebula('accretionLayers', newLayers);
                                      }}
                                      disabled={!selectedNebula}
                                      className="rounded bg-gray-700 border-gray-600"
                                    />
                                    <span className="font-medium">第{idx + 1}层</span>
                                  </div>
                                  {layer.enabled && (
                                    <div className="space-y-2 pl-5">
                                      <div className="flex items-center space-x-2 text-xs">
                                        <span className="text-gray-400 w-14">外半径:</span>
                                        <input
                                          type="number"
                                          value={layer.radiusMax}
                                          onChange={(e) => {
                                            if (!selectedNebula) return;
                                            const newLayers = [...selectedNebula.accretionLayers];
                                            newLayers[idx] = { ...layer, radiusMax: Number(e.target.value) };
                                            updateSelectedNebula('accretionLayers', newLayers);
                                          }}
                                          disabled={!selectedNebula}
                                          className="w-16 bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                          min={10}
                                          max={500}
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2 text-xs">
                                        <span className="text-gray-400 w-14">方向:</span>
                                        <button
                                          onClick={() => {
                                            if (!selectedNebula) return;
                                            const newLayers = [...selectedNebula.accretionLayers];
                                            newLayers[idx] = { ...layer, direction: layer.direction === 1 ? -1 : 1 };
                                            updateSelectedNebula('accretionLayers', newLayers);
                                          }}
                                          disabled={!selectedNebula}
                                          className={`px-3 py-1 rounded text-xs font-medium ${layer.direction === 1 ? 'bg-blue-600' : 'bg-purple-600'}`}
                                        >
                                          {layer.direction === 1 ? '顺时针' : '逆时针'}
                                        </button>
                                      </div>
                                      <div className="flex items-center space-x-2 text-xs">
                                        <span className="text-gray-400 w-14">速度:</span>
                                        <input
                                          type="range"
                                          value={layer.speedMultiplier}
                                          onChange={(e) => {
                                            if (!selectedNebula) return;
                                            const newLayers = [...selectedNebula.accretionLayers];
                                            newLayers[idx] = { ...layer, speedMultiplier: Number(e.target.value) };
                                            updateSelectedNebula('accretionLayers', newLayers);
                                          }}
                                          disabled={!selectedNebula}
                                          min={0.1}
                                          max={3}
                                          step={0.1}
                                          className="flex-1 h-1.5"
                                        />
                                        <span className="text-gray-300 w-10 text-right">{layer.speedMultiplier}x</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* 拖尾残影 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={settings.trailEnabled}
                          onChange={(v) => handleChange('trailEnabled', v)}
                          label="拖尾残影"
                          color={secondaryInteractionColor}
                        />
                        {settings.trailEnabled && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="拖尾长度" value={settings.trailLength} min={0} max={1} step={0.05}
                              onChange={(v) => handleChange('trailLength', v)} />
                          </div>
                        )}
                      </div>

                      {/* 荧光闪烁 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.flickerEnabled : settings.flickerEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('flickerEnabled', v);
                          }}
                          label="荧光闪烁"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.flickerEnabled : settings.flickerEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="闪烁强度" value={selectedNebula ? selectedNebula.flickerIntensity : settings.flickerIntensity} min={0} max={1} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('flickerIntensity', v);
                              }} />
                            <RangeControl label="闪烁速度" value={selectedNebula ? selectedNebula.flickerSpeed : settings.flickerSpeed} min={0.5} max={5} step={0.5}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('flickerSpeed', v);
                              }} />
                          </div>
                        )}
                      </div>

                      {/* 真实海浪效果 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.waveEnabled : settings.waveEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('waveEnabled', v);
                          }}
                          label="真实海浪效果"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.waveEnabled : settings.waveEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="海浪振幅" value={selectedNebula ? selectedNebula.waveIntensity : settings.waveIntensity} min={5} max={100} step={5}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveIntensity', v);
                              }} />
                            <RangeControl label="海浪速度" value={selectedNebula ? selectedNebula.waveSpeed : settings.waveSpeed} min={0.1} max={3} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveSpeed', v);
                              }} />
                            <RangeControl label="波浪陡度" value={selectedNebula ? selectedNebula.waveSteepness : settings.waveSteepness} min={0} max={1} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveSteepness', v);
                              }} />
                            <RangeControl label="波浪层数" value={selectedNebula ? selectedNebula.waveLayers : settings.waveLayers} min={1} max={4} step={1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveLayers', v);
                              }} />
                            <RangeControl label="主波方向" value={selectedNebula ? selectedNebula.waveDirection : settings.waveDirection} min={0} max={360} step={15}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveDirection', v);
                              }} />
                            <RangeControl label="深度衰减" value={selectedNebula ? selectedNebula.waveDepthFade : settings.waveDepthFade} min={0} max={1} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('waveDepthFade', v);
                              }} />
                            <div className="mt-2">
                              <GlassToggle
                                enabled={selectedNebula ? selectedNebula.waveFoam : settings.waveFoam}
                                disabled={!selectedNebula}
                                onChange={(v) => {
                                  if (!selectedNebula) return;
                                  updateSelectedNebula('waveFoam', v);
                                }}
                                label="波峰泡沫"
                                color={secondaryInteractionColor}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 游走闪电效果 */}
                      <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.wanderingLightningEnabled : settings.wanderingLightningEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('wanderingLightningEnabled', v);
                          }}
                          label="游走闪电"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.wanderingLightningEnabled : settings.wanderingLightningEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="闪电强度" value={selectedNebula ? selectedNebula.wanderingLightningIntensity : settings.wanderingLightningIntensity} min={0} max={5} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('wanderingLightningIntensity', v);
                              }} />
                            <RangeControl label="游走速度" value={selectedNebula ? selectedNebula.wanderingLightningSpeed : settings.wanderingLightningSpeed} min={0.1} max={3} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('wanderingLightningSpeed', v);
                              }} />
                            <RangeControl label="闪电密度" value={selectedNebula ? selectedNebula.wanderingLightningDensity : settings.wanderingLightningDensity} min={1} max={10} step={1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('wanderingLightningDensity', v);
                              }} />
                            <RangeControl label="闪电宽度" value={selectedNebula ? selectedNebula.wanderingLightningWidth : settings.wanderingLightningWidth} min={1} max={20} step={1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('wanderingLightningWidth', v);
                              }} />
                          </div>
                        )}
                      </div>

                      {/* 闪电击穿效果 */}
                      <div className="p-3 bg-gray-800/50 rounded-lg">
                        <GlassToggle
                          enabled={selectedNebula ? selectedNebula.lightningBreakdownEnabled : settings.lightningBreakdownEnabled}
                          disabled={!selectedNebula}
                          onChange={(v) => {
                            if (!selectedNebula) return;
                            updateSelectedNebula('lightningBreakdownEnabled', v);
                          }}
                          label="闪电击穿"
                          color={secondaryInteractionColor}
                        />
                        {(selectedNebula ? selectedNebula.lightningBreakdownEnabled : settings.lightningBreakdownEnabled) && (
                          <div className="mt-3 ml-2 space-y-1 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                            <RangeControl label="击穿强度" value={selectedNebula ? selectedNebula.lightningBreakdownIntensity : settings.lightningBreakdownIntensity} min={0} max={1} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('lightningBreakdownIntensity', v);
                              }} />
                            <RangeControl label="击穿频率" value={selectedNebula ? selectedNebula.lightningBreakdownFrequency : settings.lightningBreakdownFrequency} min={0.1} max={2} step={0.1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('lightningBreakdownFrequency', v);
                              }} />
                            <RangeControl label="分支数量" value={selectedNebula ? selectedNebula.lightningBreakdownBranches : settings.lightningBreakdownBranches} min={0} max={5} step={1}
                              disabled={!selectedNebula}
                              onChange={(v) => {
                                if (!selectedNebula) return;
                                updateSelectedNebula('lightningBreakdownBranches', v);
                              }} />
                          </div>
                        )}
                      </div>
                    </ControlGroup>
                  </>
                )}
              </>
            )}

            {/* ===== 连线效果 Tab ===== */}
            {activeTab === 'line' && (
              <>
                <ControlGroup title="粒子连线">
                  <GlassToggle
                    enabled={settings.lineSettings.enabled}
                    onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, enabled: v })}
                    label="启用连线"
                    color={secondaryInteractionColor}
                  />

                  <div className={`transition-opacity ${settings.lineSettings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {/* 渲染模式 */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-400 mb-1">渲染模式</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(LineRenderMode).map(mode => {
                          const isActive = settings.lineSettings.renderMode === mode;
                          return (
                            <button
                              key={mode}
                              onClick={() => handleChange('lineSettings', { ...settings.lineSettings, renderMode: mode })}
                              className="px-2 py-1.5 text-xs rounded-lg transition-all font-medium"
                              style={{
                                background: isActive
                                  ? `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, ${secondaryInteractionColor}20 100%)`
                                  : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)',
                                border: `1px solid ${isActive ? secondaryInteractionColor + '60' : 'rgba(255,255,255,0.1)'}`,
                                borderTop: `1.5px solid ${isActive ? secondaryInteractionColor + '90' : 'rgba(255,255,255,0.2)'}`,
                                borderBottom: '1.5px solid rgba(0,0,0,0.3)',
                                color: isActive ? secondaryInteractionColor : 'rgba(255,255,255,0.5)',
                                boxShadow: isActive
                                  ? `0 0 8px ${secondaryInteractionColor}20, inset 0 1px 0 rgba(255,255,255,0.15)`
                                  : 'inset 0 1px 0 rgba(255,255,255,0.1)'
                              }}
                            >
                              {LineRenderModeLabels[mode]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 连线模式 */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-400 mb-1">连线模式</label>
                      <select
                        value={settings.lineSettings.mode}
                        onChange={(e) => handleChange('lineSettings', { ...settings.lineSettings, mode: e.target.value as LineMode })}
                        className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                      >
                        {Object.values(LineMode).map(mode => (
                          <option key={mode} value={mode}>{LineModeLabels[mode]}</option>
                        ))}
                      </select>
                    </div>

                    {/* 距离区间 - 所有模式可用 */}
                    <div className="mb-3 p-2 bg-gray-900 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-400">距离区间</span>
                        <button
                          onClick={() => {
                            const newRange = {
                              id: Date.now().toString(),
                              min: 0,
                              max: 50,
                              enabled: true
                            };
                            handleChange('lineSettings', {
                              ...settings.lineSettings,
                              distanceRanges: [...(settings.lineSettings.distanceRanges || []), newRange]
                            });
                          }}
                          className="px-2 py-1 text-xs rounded-lg transition-all font-medium"
                          style={{
                            background: `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, ${secondaryInteractionColor}20 100%)`,
                            border: `1px solid ${secondaryInteractionColor}60`,
                            borderTop: `1.5px solid ${secondaryInteractionColor}90`,
                            borderBottom: '1.5px solid rgba(0,0,0,0.3)',
                            color: secondaryInteractionColor,
                            boxShadow: `0 0 8px ${secondaryInteractionColor}20, inset 0 1px 0 rgba(255,255,255,0.15)`
                          }}
                        >
                          + 添加区间
                        </button>
                      </div>

                      {(settings.lineSettings.distanceRanges || []).map((range, idx) => (
                        <div key={range.id} className="flex items-center gap-2 mb-2 p-2 bg-gray-800 rounded">
                          <input
                            type="checkbox"
                            checked={range.enabled}
                            onChange={(e) => {
                              const updated = [...settings.lineSettings.distanceRanges];
                              updated[idx] = { ...range, enabled: e.target.checked };
                              handleChange('lineSettings', { ...settings.lineSettings, distanceRanges: updated });
                            }}
                            className="w-4 h-4"
                          />
                          <input
                            type="number"
                            value={range.min}
                            onChange={(e) => {
                              const updated = [...settings.lineSettings.distanceRanges];
                              updated[idx] = { ...range, min: Number(e.target.value) };
                              handleChange('lineSettings', { ...settings.lineSettings, distanceRanges: updated });
                            }}
                            className="w-16 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded"
                            min={0}
                          />
                          <span className="text-xs text-gray-500">-</span>
                          <input
                            type="number"
                            value={range.max}
                            onChange={(e) => {
                              const updated = [...settings.lineSettings.distanceRanges];
                              updated[idx] = { ...range, max: Number(e.target.value) };
                              handleChange('lineSettings', { ...settings.lineSettings, distanceRanges: updated });
                            }}
                            className="w-16 px-1 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded"
                            min={0}
                          />
                          {settings.lineSettings.distanceRanges.length > 1 && (
                            <button
                              onClick={() => {
                                const updated = settings.lineSettings.distanceRanges.filter((_, i) => i !== idx);
                                handleChange('lineSettings', { ...settings.lineSettings, distanceRanges: updated });
                              }}
                              className="px-1 text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 mt-1">只连接距离在区间内的粒子</p>
                    </div>

                    {/* K近邻模式参数 */}
                    {settings.lineSettings.mode === LineMode.KNN && (
                      <RangeControl
                        label="K值 (邻居数)"
                        value={settings.lineSettings.kNeighbors}
                        min={1} max={10} step={1}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, kNeighbors: v })}
                      />
                    )}

                    {/* 颜色模式参数 */}
                    {settings.lineSettings.mode === LineMode.Color && (
                      <RangeControl
                        label="颜色相似阈值"
                        value={settings.lineSettings.colorThreshold}
                        min={0.05} max={0.5} step={0.05}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, colorThreshold: v })}
                      />
                    )}

                    {/* 线条样式 */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-400 mb-1">线条样式</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(LineStyle).map(style => {
                          const isActive = settings.lineSettings.lineStyle === style;
                          return (
                            <button
                              key={style}
                              onClick={() => handleChange('lineSettings', { ...settings.lineSettings, lineStyle: style })}
                              className="px-2 py-1.5 text-xs rounded-lg transition-all font-medium"
                              style={{
                                background: isActive
                                  ? `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, ${secondaryInteractionColor}20 100%)`
                                  : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)',
                                border: `1px solid ${isActive ? secondaryInteractionColor + '60' : 'rgba(255,255,255,0.1)'}`,
                                borderTop: `1.5px solid ${isActive ? secondaryInteractionColor + '90' : 'rgba(255,255,255,0.2)'}`,
                                borderBottom: '1.5px solid rgba(0,0,0,0.3)',
                                color: isActive ? secondaryInteractionColor : 'rgba(255,255,255,0.5)',
                                boxShadow: isActive
                                  ? `0 0 8px ${secondaryInteractionColor}20, inset 0 1px 0 rgba(255,255,255,0.15)`
                                  : 'inset 0 1px 0 rgba(255,255,255,0.1)'
                              }}
                            >
                              {LineStyleLabels[style]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 线条颜色模式 */}
                    <div className="mb-2">
                      <label className="block text-xs text-gray-400 mb-1">线条颜色</label>
                      <select
                        value={settings.lineSettings.lineColorMode}
                        onChange={(e) => handleChange('lineSettings', { ...settings.lineSettings, lineColorMode: e.target.value as LineColorMode })}
                        className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                      >
                        {Object.values(LineColorMode).map(mode => (
                          <option key={mode} value={mode}>{LineColorModeLabels[mode]}</option>
                        ))}
                      </select>
                    </div>

                    {/* 自定义颜色 */}
                    {settings.lineSettings.lineColorMode === LineColorMode.Custom && (
                      <div className="mb-2">
                        <label className="block text-xs text-gray-400 mb-1">自定义颜色</label>
                        <input
                          type="color"
                          value={settings.lineSettings.customColor}
                          onChange={(e) => handleChange('lineSettings', { ...settings.lineSettings, customColor: e.target.value })}
                          className="w-full h-8 rounded border border-gray-700 cursor-pointer"
                        />
                      </div>
                    )}

                    {/* 渐变色设置 */}
                    {settings.lineSettings.lineColorMode === LineColorMode.Gradient && (
                      <div className="mb-3 p-2 bg-gray-900 rounded">
                        <p className="text-xs text-gray-400 mb-2">渐变色设置</p>

                        {/* 渐变模式选择 */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {Object.values(LineGradientMode).map(mode => (
                            <button
                              key={mode}
                              onClick={() => handleChange('lineSettings', { ...settings.lineSettings, gradientMode: mode })}
                              className={`px-2 py-1 text-xs rounded border transition-colors ${settings.lineSettings.gradientMode === mode
                                ? 'bg-blue-600 border-blue-400 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                                }`}
                            >
                              {LineGradientModeLabels[mode]}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          {settings.lineSettings.gradientMode === LineGradientMode.ParticleColor
                            ? '基于连线两端粒子颜色渐变'
                            : '基于位置的固定颜色渐变'}
                        </p>

                        {/* 固定渐变时显示颜色选择 */}
                        {settings.lineSettings.gradientMode === LineGradientMode.Fixed && (
                          <>
                            <div className="flex gap-2 mb-2">
                              <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">起始色</label>
                                <input
                                  type="color"
                                  value={settings.lineSettings.gradientColorStart || '#ff0080'}
                                  onChange={(e) => handleChange('lineSettings', { ...settings.lineSettings, gradientColorStart: e.target.value })}
                                  className="w-full h-8 rounded border border-gray-700 cursor-pointer"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">结束色</label>
                                <input
                                  type="color"
                                  value={settings.lineSettings.gradientColorEnd || '#00ffff'}
                                  onChange={(e) => handleChange('lineSettings', { ...settings.lineSettings, gradientColorEnd: e.target.value })}
                                  className="w-full h-8 rounded border border-gray-700 cursor-pointer"
                                />
                              </div>
                            </div>
                            <RangeControl
                              label="渐变强度 (%)"
                              value={Math.round((settings.lineSettings.gradientIntensity || 0.5) * 100)}
                              min={0} max={100} step={5}
                              onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, gradientIntensity: v / 100 })}
                            />
                            <p className="text-xs text-gray-500 mt-1">0%=纯继承色, 100%=纯渐变</p>
                          </>
                        )}
                      </div>
                    )}

                    <RangeControl
                      label="线条粗细"
                      value={settings.lineSettings.lineWidth}
                      min={0} max={100} step={1}
                      onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, lineWidth: v })}
                    />

                    <RangeControl
                      label="透明度 (%)"
                      value={Math.round(settings.lineSettings.opacity * 100)}
                      min={0} max={100} step={1}
                      onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, opacity: v / 100 })}
                    />

                    <GlassToggle
                      enabled={settings.lineSettings.fadeWithDistance}
                      onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, fadeWithDistance: v })}
                      label="距离淡出"
                      color={secondaryInteractionColor}
                    />

                    {/* 结构感知约束 */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">结构感知约束</p>
                      <p className="text-xs text-gray-600 mb-2">解决人物图像连线杂乱问题</p>

                      {/* 颜色约束 */}
                      <GlassToggle
                        enabled={settings.lineSettings.colorConstraintEnabled || false}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, colorConstraintEnabled: v })}
                        label="启用颜色约束"
                        color={secondaryInteractionColor}
                      />

                      {settings.lineSettings.colorConstraintEnabled && (
                        <div className="mt-2 ml-2 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                          <RangeControl
                            label="颜色容差 (%)"
                            value={Math.round((settings.lineSettings.colorTolerance || 0.3) * 100)}
                            min={5} max={100} step={5}
                            onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, colorTolerance: v / 100 })}
                          />
                        </div>
                      )}

                      {/* 每粒子连接数限制 */}
                      <RangeControl
                        label="每粒子最大连接"
                        value={settings.lineSettings.maxConnectionsPerParticle || 0}
                        min={0} max={10} step={1}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, maxConnectionsPerParticle: v })}
                      />
                      <p className="text-xs text-gray-600 mb-2">0=不限制, 3-4=干净网格</p>

                      {/* Z轴深度权重 */}
                      <RangeControl
                        label="Z轴深度权重"
                        value={settings.lineSettings.zDepthWeight ?? 1.0}
                        min={0} max={3} step={0.1}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, zDepthWeight: v })}
                      />
                      <p className="text-xs text-gray-600 mb-2">越大=深度分离越明显</p>

                      {/* 粒子大小过滤 */}
                      <div className="mt-2">
                        <GlassToggle
                          enabled={settings.lineSettings.sizeFilterEnabled || false}
                          onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, sizeFilterEnabled: v })}
                          label="粒子大小过滤"
                          color={secondaryInteractionColor}
                        />
                      </div>

                      {settings.lineSettings.sizeFilterEnabled && (
                        <div className="mt-2 ml-2 border-l-2 pl-3" style={{ borderColor: `${secondaryInteractionColor}40` }}>
                          <RangeControl
                            label="百分位过滤 (%)"
                            value={settings.lineSettings.minSizePercentile || 0}
                            min={0} max={50} step={5}
                            onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, minSizePercentile: v })}
                          />
                          <p className="text-xs text-gray-600 mb-1">过滤最小的前X%粒子</p>
                          <RangeControl
                            label="绝对最小尺寸"
                            value={settings.lineSettings.minSizeAbsolute || 0.1}
                            min={0} max={0.5} step={0.05}
                            onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, minSizeAbsolute: v })}
                          />
                          <RangeControl
                            label="相对最小尺寸 (%)"
                            value={Math.round((settings.lineSettings.minSizeRelative || 0.2) * 100)}
                            min={0} max={50} step={5}
                            onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, minSizeRelative: v / 100 })}
                          />
                          <p className="text-xs text-gray-600 mb-2">过滤小粒子，减少噪点连线</p>
                        </div>
                      )}
                    </div>

                    {/* 性能控制 */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">性能控制</p>
                      <RangeControl
                        label="采样比例 (%)"
                        value={Math.round(settings.lineSettings.sampleRatio * 100)}
                        min={1} max={100} step={1}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, sampleRatio: v / 100 })}
                      />
                      <RangeControl
                        label="最大连线数"
                        value={settings.lineSettings.maxLines / 1000}
                        min={5} max={100} step={5}
                        onChange={(v) => handleChange('lineSettings', { ...settings.lineSettings, maxLines: v * 1000 })}
                      />
                    </div>
                  </div>
                </ControlGroup>
              </>
            )}

            {/* ===== 交互 Tab ===== */}
            {activeTab === 'interact' && (
              <>
                <ControlGroup title="👆 手势交互">
                  <div className="flex items-center justify-between mb-3 p-2 bg-gray-800 rounded">
                    <span className="text-xs text-gray-300">手势控制</span>
                    <button
                      onClick={() => setGestureEnabled(!gestureEnabled)}
                      className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${gestureEnabled
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 text-gray-400'
                        }`}
                    >
                      {gestureEnabled ? '已开启' : '已关闭'}
                    </button>
                  </div>

                  <div className="p-2 bg-gray-800/50 rounded text-xs text-gray-400 mb-3">
                    <p>✋ 张开手掌 → 超新星爆发</p>
                    <p>✊ 握拳 → 黑洞吸引</p>
                  </div>
                </ControlGroup>

                <ControlGroup title="超新星爆发">
                  <RangeControl label="膨胀距离" value={settings.nebulaExplosionExpansion ?? 300} min={50} max={800} step={10} onChange={(v) => handleChange('nebulaExplosionExpansion', v)} />
                  <RangeControl label="湍流强度" value={settings.nebulaExplosionTurbulence ?? 80} min={0} max={200} step={5} onChange={(v) => handleChange('nebulaExplosionTurbulence', v)} />
                  <RangeControl label="旋转角度" value={settings.nebulaExplosionRotation ?? 0.4} min={0} max={2} step={0.1} onChange={(v) => handleChange('nebulaExplosionRotation', v)} />
                  <RangeControl label="粒子放大" value={settings.nebulaExplosionSizeBoost ?? 8} min={0} max={30} step={1} onChange={(v) => handleChange('nebulaExplosionSizeBoost', v)} />
                </ControlGroup>

                <ControlGroup title="黑洞效果">
                  <RangeControl label="Z轴压缩" value={settings.nebulaBlackHoleCompression ?? 0.05} min={0.01} max={0.5} step={0.01} onChange={(v) => handleChange('nebulaBlackHoleCompression', v)} />
                  <RangeControl label="旋转速度" value={settings.nebulaBlackHoleSpinSpeed ?? 400} min={50} max={1000} step={10} onChange={(v) => handleChange('nebulaBlackHoleSpinSpeed', v)} />
                  <RangeControl label="收缩半径" value={settings.nebulaBlackHoleTargetRadius ?? 30} min={5} max={100} step={5} onChange={(v) => handleChange('nebulaBlackHoleTargetRadius', v)} />
                  <RangeControl label="吸引强度" value={settings.nebulaBlackHolePull ?? 0.95} min={0.5} max={1.0} step={0.01} onChange={(v) => handleChange('nebulaBlackHolePull', v)} />
                </ControlGroup>

                <ControlGroup title="相机控制">
                  <GlassToggle
                    enabled={settings.autoRotate}
                    onChange={(v) => handleChange('autoRotate', v)}
                    label="自动旋转"
                    color={secondaryInteractionColor}
                  />
                  <RangeControl label="旋转速度" value={settings.autoRotateSpeed} min={0} max={2.0} step={0.1} onChange={(v) => handleChange('autoRotateSpeed', v)} />
                </ControlGroup>
              </>
            )}
          </>
        );
      })()}

      {/* ==================== 星球模式控制面板 ==================== */}
      {appMode === 'planet' && (
        <>
          {/* 星球列表 */}
          <ControlGroup title="星球列表">
            {/* 顶部操作栏 */}
            <div className="flex gap-2 mb-3">
              {planetSettings.planets.length < MAX_PLANETS ? (
                <button
                  onClick={() => {
                    const id = Date.now().toString();
                    const newPlanet = createDefaultPlanet(id, `星球 ${planetSettings.planets.length + 1}`);
                    setPlanetSettings(prev => ({
                      ...prev,
                      planets: [...prev.planets, newPlanet]
                    }));
                    setSelectedPlanetId(id);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all"
                  style={{
                    background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.1)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--ui-primary)',
                    color: 'var(--ui-primary)',
                  }}
                >
                  + 添加
                </button>
              ) : (
                <span className="flex-1 px-2 py-1.5 text-xs text-yellow-400 text-center bg-gray-800 rounded">已满 {MAX_PLANETS}</span>
              )}
              <button
                onClick={() => {
                  showInput('保存布局', '请输入布局名称', `星球场景 ${Date.now()}`, (name) => {
                    const layoutData = {
                      name,
                      planets: planetSettings.planets,
                      createdAt: Date.now()
                    };
                    const template: SavedPlanetTemplate = {
                      id: Date.now().toString(),
                      name,
                      createdAt: Date.now(),
                      planet: layoutData as any
                    };
                    saveTemplates([...savedTemplates, template]);
                  });
                }}
                className="px-2 py-1.5 text-xs rounded transition-all"
                style={{
                  background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.1)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--ui-primary)',
                  color: 'var(--ui-primary)',
                }}
                title="保存整个布局"
              >
                💾
              </button>
              <button
                onClick={() => {
                  const layoutData = {
                    planets: planetSettings.planets,
                    exportedAt: Date.now()
                  };
                  const dataStr = JSON.stringify(layoutData, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `planet-layout-${Date.now()}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
                className="px-2 py-1.5 text-xs rounded transition-all"
                style={{
                  background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.1)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--ui-primary)',
                  color: 'var(--ui-primary)',
                }}
                title="导出整个布局"
              >
                📥
              </button>
            </div>

            {/* 星球列表项 */}
            <div className="space-y-2">
              {planetSettings.planets.map((planet, idx) => (
                <div
                  key={planet.id}
                  onClick={() => setSelectedPlanetId(planet.id)}
                  className="p-2 rounded cursor-pointer transition-colors"
                  style={selectedPlanetId === planet.id
                    ? {
                      background: 'rgba(var(--ui-primary-rgb, 99, 102, 241), 0.15)',
                      border: '1px solid var(--ui-primary)'
                    }
                    : {
                      background: 'rgba(31, 41, 55, 0.8)',
                      border: '1px solid transparent'
                    }
                  }
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planet.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        const updated = planetSettings.planets.map(p =>
                          p.id === planet.id ? { ...p, enabled: e.target.checked } : p
                        );
                        setPlanetSettings(prev => ({ ...prev, planets: updated }));
                      }}
                      className="rounded flex-shrink-0"
                      style={{ accentColor: 'var(--ui-primary)' }}
                    />
                    {editingPlanetId === planet.id ? (
                      <input
                        type="text"
                        value={planet.name}
                        autoFocus
                        onBlur={() => setEditingPlanetId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingPlanetId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPlanetId(null);
                          }
                        }}
                        onChange={(e) => {
                          const updated = planetSettings.planets.map(p =>
                            p.id === planet.id ? { ...p, name: e.target.value } : p
                          );
                          setPlanetSettings(prev => ({ ...prev, planets: updated }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-1 py-0.5 text-xs bg-gray-800 border border-blue-500 text-white outline-none min-w-0 rounded"
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingPlanetId(planet.id);
                        }}
                        className="flex-1 px-1 py-0.5 text-xs text-white cursor-pointer truncate"
                        title="双击重命名"
                      >
                        {planet.name}
                      </span>
                    )}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showInput('保存为模板', '请输入模板名称', planet.name, (name) => {
                            const template: SavedPlanetTemplate = {
                              id: Date.now().toString(),
                              name,
                              createdAt: Date.now(),
                              planet: {
                                name: planet.name,
                                enabled: planet.enabled,
                                scale: planet.scale,
                                coreSystem: planet.coreSystem,
                                flameSystem: planet.flameSystem,
                                rings: planet.rings,
                                radiation: planet.radiation,
                                fireflies: planet.fireflies,
                                magicCircles: planet.magicCircles,
                                energyBodySystem: planet.energyBodySystem
                              }
                            };
                            saveTemplates([...savedTemplates, template]);
                          });
                        }}
                        className="p-1.5 text-xs rounded transition-all hover:scale-105"
                        style={{
                          background: 'rgba(74, 222, 128, 0.15)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(74, 222, 128, 0.3)',
                          color: '#4ade80'
                        }}
                        title="保存为模板"
                      >
                        💾
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const planetData = { ...planet };
                          const dataStr = JSON.stringify(planetData, null, 2);
                          const blob = new Blob([dataStr], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${planet.name}.json`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                        className="p-1.5 text-xs rounded transition-all hover:scale-105"
                        style={{
                          background: 'rgba(96, 165, 250, 0.15)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(96, 165, 250, 0.3)',
                          color: '#60a5fa'
                        }}
                        title="导出星球"
                      >
                        📥
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm('删除星球', `确定删除 "${planet.name}" 吗?`, () => {
                            const updated = planetSettings.planets.filter(p => p.id !== planet.id);
                            setPlanetSettings(prev => ({ ...prev, planets: updated }));
                            if (selectedPlanetId === planet.id) setSelectedPlanetId(null);
                          }, '删除');
                        }}
                        className="p-1.5 text-xs rounded transition-all hover:scale-105"
                        style={{
                          background: 'rgba(248, 113, 113, 0.15)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(248, 113, 113, 0.3)',
                          color: '#f87171'
                        }}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {planetSettings.planets.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">点击上方按钮添加星球</p>
              )}
            </div>
          </ControlGroup>

          {/* 已保存的模板 */}
          {savedTemplates.length > 0 && (
            <ControlGroup title="已保存模板">
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {savedTemplates.map(template => (
                  <div key={template.id} className="flex items-center justify-between p-1.5 bg-gray-800 rounded text-xs">
                    <span className="text-white truncate flex-1">{template.name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (planetSettings.planets.length >= MAX_PLANETS) {
                            alert(`已达到最大星球数量 (${MAX_PLANETS})`);
                            return;
                          }
                          const id = Date.now().toString();
                          const newPlanet: PlanetSettings = {
                            ...template.planet as any,
                            id,
                            position: { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50, z: 0 }
                          };
                          setPlanetSettings(prev => ({
                            ...prev,
                            planets: [...prev.planets, newPlanet]
                          }));
                          setSelectedPlanetId(id);
                        }}
                        className="px-1.5 py-0.5 bg-green-600 hover:bg-green-500 rounded"
                      >
                        应用
                      </button>
                      <button
                        onClick={() => {
                          showConfirm('删除模板', `确定删除模板 "${template.name}" 吗?`, () => {
                            const updated = savedTemplates.filter(t => t.id !== template.id);
                            saveTemplates(updated);
                          }, '删除');
                        }}
                        className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 rounded"
                      >
                        删
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ControlGroup>
          )}

          {/* Tab 切换栏 - 应用材质设置 */}
          <div className="flex gap-2 mb-4 p-1.5 rounded-xl" style={{ background: 'linear-gradient(145deg, rgba(30,30,40,0.8), rgba(15,15,20,0.9))' }}>
            {[
              { key: 'basic' as PlanetTabType, label: '星系\n创造', icon: '🪐' },
              { key: 'visual' as PlanetTabType, label: '特殊\n效果', icon: '✨' },
              { key: 'interact' as PlanetTabType, label: '星系\n交互', icon: '👆' }
            ].map(tab => {
              const isActive = planetTab === tab.key;
              const tabColor = materialSettings.mainTabColors[tab.key as keyof typeof materialSettings.mainTabColors];
              const materialStyle = generateMaterialStyle(materialSettings.mainTabs, isActive, tabColor);
              return (
                <button
                  key={tab.key}
                  onClick={() => setPlanetTab(tab.key)}
                  className={`flex-1 py-2.5 px-2 text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 font-medium relative overflow-hidden ${isActive ? 'transform scale-[1.02]' : 'hover:scale-[1.01]'
                    }`}
                  style={materialStyle}
                >
                  {/* 顶部高光条 */}
                  {isActive && materialSettings.mainTabs.type === 'neumorphism' && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px]"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, ${tabColor}60 50%, transparent 100%)`
                      }}
                    />
                  )}
                  <span className="text-sm" style={isActive && (materialSettings.mainTabs.type === 'neon' || materialSettings.mainTabs.type === 'neumorphism') ? {
                    filter: `drop-shadow(0 0 4px ${tabColor}80)`
                  } : undefined}>{tab.icon}</span>
                  <span className="whitespace-pre-line text-center leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ========== 星系创造 Tab ========== */}
          {planetTab === 'basic' && selectedPlanetId && (() => {
            const planet = planetSettings.planets.find(p => p.id === selectedPlanetId);
            if (!planet) return <p className="text-xs text-gray-500 text-center py-4">请先选择一个星球</p>;

            const updatePlanet = (updates: Partial<PlanetSettings>) => {
              setPlanetSettings(prev => ({
                ...prev,
                planets: prev.planets.map(p =>
                  p.id === selectedPlanetId ? { ...p, ...updates } : p
                )
              }));
            };

            return (
              <>
                {/* 基础设置 */}
                <ControlGroup title={`基础设置: ${planet.name}`}>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">位置</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">X</label>
                        <input
                          type="number"
                          step="0.1"
                          value={planet.position.x}
                          onChange={(e) => updatePlanet({ position: { ...planet.position, x: Number(e.target.value) } })}
                          className="w-full h-7 px-2 text-xs rounded"
                          style={{ backgroundColor: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Y</label>
                        <input
                          type="number"
                          step="0.1"
                          value={planet.position.y}
                          onChange={(e) => updatePlanet({ position: { ...planet.position, y: Number(e.target.value) } })}
                          className="w-full h-7 px-2 text-xs rounded"
                          style={{ backgroundColor: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Z</label>
                        <input
                          type="number"
                          step="0.1"
                          value={planet.position.z}
                          onChange={(e) => updatePlanet({ position: { ...planet.position, z: Number(e.target.value) } })}
                          className="w-full h-7 px-2 text-xs rounded"
                          style={{ backgroundColor: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                        />
                      </div>
                    </div>
                  </div>
                  <RangeControl label="整体缩放" value={planet.scale} min={0.5} max={3} step={0.1} onChange={(v) => updatePlanet({ scale: v })} />

                  {/* 公转功能 */}
                  <div className="mt-3 p-2 bg-gray-800/50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setOrbitPanelCollapsed(!orbitPanelCollapsed)}
                        className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
                      >
                        <span>🌀 公转</span>
                        <span className={`transform transition-transform text-[10px] ${orbitPanelCollapsed ? '' : 'rotate-180'}`}>▼</span>
                      </button>
                      <button
                        onClick={() => {
                          const currentOrbit = planet.orbit ?? { ...DEFAULT_ORBIT_SETTINGS };
                          updatePlanet({ orbit: { ...currentOrbit, enabled: !currentOrbit.enabled } });
                        }}
                        className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: planet.orbit?.enabled
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: planet.orbit?.enabled
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: planet.orbit?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {planet.orbit?.enabled ? '已启用' : '已禁用'}
                      </button>
                    </div>

                    {!orbitPanelCollapsed && planet.orbit?.enabled && (
                      <div className="space-y-2">
                        {(
                          <>
                            {/* 公转目标 */}
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">公转目标</label>
                              <select
                                value={planet.orbit?.targetPlanetId ?? ''}
                                onChange={(e) => {
                                  const targetId = e.target.value || null;
                                  updatePlanet({ orbit: { ...planet.orbit!, targetPlanetId: targetId } });
                                }}
                                className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white"
                              >
                                <option value="">场景原点</option>
                                {planetSettings.planets
                                  .filter(p => p.id !== planet.id && p.enabled)
                                  .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))
                                }
                              </select>
                            </div>

                            {/* 公转参数 */}
                            {(() => {
                              // 计算当前公转半径（基于星球位置距离）
                              let orbitRadius = planet.orbit?.orbitRadius ?? 200;
                              const targetId = planet.orbit?.targetPlanetId;
                              if (targetId) {
                                const target = planetSettings.planets.find(p => p.id === targetId);
                                if (target) {
                                  const dx = planet.position.x - target.position.x;
                                  const dy = planet.position.y - target.position.y;
                                  const dz = planet.position.z - target.position.z;
                                  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                                  if (dist > 1) orbitRadius = dist;
                                }
                              } else {
                                // 绕原点
                                const dist = Math.sqrt(
                                  planet.position.x ** 2 +
                                  planet.position.y ** 2 +
                                  planet.position.z ** 2
                                );
                                if (dist > 1) orbitRadius = dist;
                              }
                              return (
                                <div className="text-xs text-gray-400 mb-2">
                                  <span>公转半径: </span>
                                  <span className="text-white">{orbitRadius.toFixed(0)}</span>
                                  <span className="text-gray-500 ml-1">（基于星球位置距离）</span>
                                </div>
                              );
                            })()}
                            <RangeControl
                              label="公转速度"
                              value={planet.orbit?.orbitSpeed ?? 0.3}
                              min={-2}
                              max={2}
                              step={0.1}
                              onChange={(v) => updatePlanet({ orbit: { ...planet.orbit!, orbitSpeed: v } })}
                            />
                            <RangeControl
                              label="离心率"
                              value={planet.orbit?.eccentricity ?? 0}
                              min={0}
                              max={0.9}
                              step={0.05}
                              onChange={(v) => updatePlanet({ orbit: { ...planet.orbit!, eccentricity: v } })}
                            />
                            <RangeControl
                              label="初始相位"
                              value={planet.orbit?.initialPhase ?? 0}
                              min={0}
                              max={360}
                              step={5}
                              onChange={(v) => updatePlanet({ orbit: { ...planet.orbit!, initialPhase: v } })}
                            />

                            {/* 轨道倾斜 */}
                            <TiltPresetSelector
                              tilt={planet.orbit?.tilt ?? DEFAULT_TILT_SETTINGS}
                              onChange={(tilt) => updatePlanet({ orbit: { ...planet.orbit!, tilt } })}
                              getButtonStyle={getOptionButtonStyle}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </ControlGroup>

                {/* 七个并列子Tab - 应用材质设置 */}
                <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  overflow: 'visible'
                }}>
                  {[
                    {
                      key: 'core' as const, icon: '🌍', label: '核心', color: '#22d3ee', count:
                        ((planet.coreSystem?.coresEnabled ?? false) ? (planet.coreSystem?.cores?.filter(c => c.enabled).length ?? 0) : 0) +
                        ((planet.coreSystem?.solidCoresEnabled ?? true) ? (planet.coreSystem?.solidCores?.filter(c => c.enabled).length ?? 0) : 0)
                    },
                    {
                      key: 'energyBody' as const, icon: '⚡', label: '能量体', color: '#f59e0b', count:
                        ((planet.energyBodySystem?.enabled ?? true) && (planet.energyBodySystem?.coreEnabled ?? true) ? (planet.energyBodySystem?.energyBodies?.filter(e => e.enabled).length || 0) : 0) +
                        ((planet.energyBodySystem?.enabled ?? true) && (planet.flameSystem?.surfaceFlamesEnabled ?? true) ? (planet.flameSystem?.surfaceFlames?.filter(f => f.enabled).length || 0) : 0)
                    },
                    {
                      key: 'rings' as const, icon: '💫', label: '光环', color: '#a78bfa', count:
                        ((planet.rings.enabled ?? true) && planet.rings.particleRingsEnabled ? planet.rings.particleRings.filter(r => r.enabled).length : 0) +
                        ((planet.rings.enabled ?? true) && planet.rings.continuousRingsEnabled ? planet.rings.continuousRings.filter(r => r.enabled).length : 0) +
                        ((planet.rings.enabled ?? true) && planet.rings.silkRingsEnabled ? (planet.rings.silkRings || []).filter(r => r.enabled).length : 0) +
                        ((planet.rings.enabled ?? true) && (planet.flameSystem?.spiralFlamesEnabled ?? true) ? (planet.flameSystem?.spiralFlames?.filter(s => s.enabled).length || 0) : 0)
                    },
                    {
                      key: 'afterimage' as const, icon: '👻', label: '残影', color: '#f472b6', count:
                        ((planet.flameSystem?.enabled ?? true) && (planet.flameSystem?.flameJetsEnabled ?? true)) ? (planet.flameSystem?.flameJets?.filter(j => j.enabled).length || 0) : 0
                    },
                    {
                      key: 'radiation' as const, icon: '🌟', label: '辐射', color: '#34d399', count:
                        ((planet.radiation.enabled !== false) && planet.radiation.orbitingEnabled ? planet.radiation.orbitings.filter(o => o.enabled).length : 0) +
                        ((planet.radiation.enabled !== false) && planet.radiation.emitterEnabled ? planet.radiation.emitters.filter(e => e.enabled).length : 0)
                    },
                    {
                      key: 'fireflies' as const, icon: '✨', label: '流萤', color: '#fbbf24', count:
                        ((planet.fireflies.enabled !== false) && (planet.fireflies.orbitingEnabled ?? true) ? planet.fireflies.orbitingFireflies.filter(f => f.enabled).length : 0) +
                        ((planet.fireflies.enabled !== false) && (planet.fireflies.wanderingEnabled ?? true) ? planet.fireflies.wanderingGroups.filter(g => g.enabled).length : 0)
                    },
                    {
                      key: 'magicCircle' as const, icon: '🔮', label: '法阵', color: '#c084fc', count:
                        (planet.magicCircles?.enabled ?? true) ? (planet.magicCircles?.circles?.filter(c => c.enabled).length || 0) : 0
                    }
                  ].map(tab => {
                    const isActive = planetSubTab === tab.key;
                    const tabColor = materialSettings?.moduleTabColors?.[tab.key as keyof typeof materialSettings.moduleTabColors] || tab.color;
                    const materialStyle = generateMaterialStyle(materialSettings?.moduleTabs || createDefaultMaterialConfig('glass'), isActive, tabColor);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setPlanetSubTab(tab.key)}
                        className="flex-1 py-2 px-0.5 text-xs rounded-lg transition-all duration-300 flex flex-col items-center"
                        style={materialStyle}
                      >
                        <span className="text-base" style={isActive && materialSettings?.moduleTabs?.type === 'neon' ? {
                          filter: `drop-shadow(0 0 6px ${tabColor})`
                        } : undefined}>{tab.icon}</span>
                        <span className="text-[10px] font-medium">{tab.label}</span>
                        {tab.count > 0 && (
                          <span
                            className="mt-0.5 px-1.5 rounded-full text-[9px] font-bold"
                            style={isActive ? {
                              background: `${tabColor}30`,
                              color: materialStyle.color || tabColor,
                              boxShadow: materialSettings?.moduleTabs?.type === 'neon' ? `0 0 8px ${tabColor}50` : 'none'
                            } : {
                              background: 'rgba(255,255,255,0.1)',
                              color: 'rgba(156,163,175,0.8)'
                            }}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* ===== 核心 子Tab ===== */}
                {planetSubTab === 'core' && (() => {
                  // 粒子核心相关
                  const cores = planet.coreSystem?.cores ?? [];
                  const effectiveSelectedCoreId = selectedCoreId && cores.find(c => c.id === selectedCoreId)
                    ? selectedCoreId
                    : cores[0]?.id || null;
                  const currentCore = cores.find(c => c.id === effectiveSelectedCoreId);

                  const updateCore = (coreId: string, updates: Partial<PlanetCoreSettings>) => {
                    setPlanetSettings(prev => ({
                      ...prev,
                      planets: prev.planets.map(p =>
                        p.id === selectedPlanetId ? {
                          ...p,
                          coreSystem: {
                            ...p.coreSystem,
                            cores: (p.coreSystem?.cores ?? []).map(c =>
                              c.id === coreId ? { ...c, ...updates } : c
                            )
                          }
                        } : p
                      )
                    }));
                  };

                  // 实体核心相关（多预设多实例）
                  const solidCores: SolidCoreSettings[] = planet.coreSystem?.solidCores || [];

                  // 当前选中的实体核心
                  const effectiveSelectedSolidCoreId = selectedSolidCoreId && solidCores.find(c => c.id === selectedSolidCoreId)
                    ? selectedSolidCoreId
                    : solidCores.find(c => c.enabled)?.id || solidCores[0]?.id || null;
                  const currentSolidCore = solidCores.find(c => c.id === effectiveSelectedSolidCoreId);

                  const updateSolidCore = (coreId: string, updates: Partial<SolidCoreSettings>) => {
                    setPlanetSettings(prev => ({
                      ...prev,
                      planets: prev.planets.map(p =>
                        p.id === selectedPlanetId ? {
                          ...p,
                          coreSystem: {
                            ...p.coreSystem,
                            solidCores: (p.coreSystem?.solidCores || []).map(c =>
                              c.id === coreId ? { ...c, ...updates } : c
                            )
                          }
                        } : p
                      )
                    }));
                  };

                  return (
                    <>
                      {/* 核心类型切换Tab - 应用材质设置 */}
                      <div className="mb-3 flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {[
                          { key: 'particle' as const, label: '粒子核心', color: '#3b82f6' },
                          { key: 'solid' as const, label: '实体核心', color: '#8b5cf6' }
                        ].map(tab => {
                          const isActive = coreSubTab === tab.key;
                          const subConfig = materialSettings?.subModuleTabs?.core || createDefaultMaterialConfig('glass');
                          const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setCoreSubTab(tab.key)}
                              className="flex-1 py-1.5 px-2 text-xs rounded transition-all duration-200"
                              style={materialStyle}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* ===== 粒子核心面板 ===== */}
                      {coreSubTab === 'particle' && (() => {
                        return (
                          <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                            <FloatingListSelector
                              items={cores}
                              selectedId={effectiveSelectedCoreId}
                              onSelect={(id) => setSelectedCoreId(id)}
                              onToggleEnabled={(id, enabled) => updateCore(id, { enabled })}
                              onRename={(id, name) => updateCore(id, { name })}
                              onDelete={(id) => {
                                const updated = cores.filter(c => c.id !== id);
                                updatePlanet({ coreSystem: { ...planet.coreSystem, cores: updated } });
                                if (effectiveSelectedCoreId === id) setSelectedCoreId(updated[0]?.id || null);
                                if (soloCoreId === id) setSoloCoreId(null);
                              }}
                              onCopy={(id) => {
                                const source = cores.find(c => c.id === id);
                                if (source) {
                                  const newId = Date.now().toString();
                                  const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                  updatePlanet({ coreSystem: { ...planet.coreSystem, cores: [...cores, copy] } });
                                  setSelectedCoreId(newId);
                                }
                              }}
                              onAdd={() => {
                                const id = Date.now().toString();
                                const newCore = createDefaultCore(id, `核心 ${cores.length + 1}`);
                                updatePlanet({ coreSystem: { ...planet.coreSystem, cores: [...cores, newCore] } });
                                setSelectedCoreId(id);
                              }}
                              globalEnabled={planet.coreSystem?.coresEnabled ?? true}
                              onGlobalToggle={(enabled) => updatePlanet({ coreSystem: { ...planet.coreSystem, coresEnabled: enabled } })}
                              soloId={soloCoreId}
                              onSoloToggle={setSoloCoreId}
                              title="粒子核心"
                              titleStyle={{ color: 'var(--ui-secondary)' }}
                              addButtonColor="bg-blue-600 hover:bg-blue-500"
                              emptyText="暂无核心"
                            />

                            {/* 预设列表 */}
                            <PresetListBox
                              storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.particleCore)}
                              builtInPresets={Object.entries(PARTICLE_CORE_PRESETS).map(([id, data]) => ({
                                id,
                                name: {
                                  deepSpaceBlue: '深空靛蓝', moltenLava: '熔岩之心', emeraldDream: '翡翠幻境',
                                  prismRainbow: '虹彩幻影', cosmicPurple: '宇宙紫晶', solarFlare: '日冕烈焰'
                                }[id] || id,
                                data
                              }))}
                              currentData={currentCore ? { ...currentCore, id: undefined, name: undefined, enabled: undefined } : null}
                              hasInstance={!!currentCore}
                              instanceName="核心"
                              onApplyToInstance={(data) => {
                                if (currentCore) {
                                  updateCore(currentCore.id, { ...data });
                                }
                              }}
                              onCreateInstance={(data, presetName) => {
                                const count = cores.length + 1;
                                const newCore = {
                                  ...createDefaultCore(Date.now().toString(), `${presetName.replace(/^[^\s]+\s/, '')} ${count}`),
                                  ...data,
                                  enabled: true
                                };
                                updatePlanet({ coreSystem: { ...planet.coreSystem, cores: [...cores, newCore] } });
                                setSelectedCoreId(newCore.id);
                              }}
                              title="预设"
                              accentColor="teal"
                              moduleName="particleCore"
                            />

                            {currentCore && (<>
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentCore.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.particleCore)}
                                  currentData={currentCore}
                                  defaultName={currentCore.name}
                                  accentColor="teal"
                                />
                              </div>
                            </>)}

                            {currentCore && (() => {
                              // 当前颜色模式
                              const colorMode = currentCore.gradientColor.enabled ? (currentCore.gradientColor.mode || 'twoColor') : 'none';
                              const setColorMode = (mode: string) => {
                                if (mode === 'none') {
                                  updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, enabled: false, mode: 'none' } });
                                } else {
                                  updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, enabled: true, mode: mode as any } });
                                }
                              };

                              // 渐变方向控件内容（直接内联使用，避免函数组件导致的问题）
                              const directionSelectJSX = (
                                <select
                                  value={currentCore.gradientColor.direction || 'radial'}
                                  onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, direction: e.target.value as any } })}
                                  className="w-full text-xs bg-gray-700 rounded px-2 py-1.5 text-white cursor-pointer relative z-10"
                                >
                                  <option value="radial">径向（中心→外）</option>
                                  <option value="linearX">X轴线性</option>
                                  <option value="linearY">Y轴线性</option>
                                  <option value="linearZ">Z轴线性</option>
                                  <option value="linearCustom">自定义方向</option>
                                  <option value="spiral">螺旋</option>
                                </select>
                              );

                              const customDirectionJSX = currentCore.gradientColor.direction === 'linearCustom' && (
                                <div className="flex gap-1 items-center text-xs mt-1">
                                  <span className="text-gray-500">方向:</span>
                                  <input type="number" value={currentCore.gradientColor.directionCustom?.x ?? 1} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, directionCustom: { ...(currentCore.gradientColor.directionCustom || { x: 1, y: 0, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" placeholder="X" />
                                  <input type="number" value={currentCore.gradientColor.directionCustom?.y ?? 0} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, directionCustom: { ...(currentCore.gradientColor.directionCustom || { x: 1, y: 0, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" placeholder="Y" />
                                  <input type="number" value={currentCore.gradientColor.directionCustom?.z ?? 0} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, directionCustom: { ...(currentCore.gradientColor.directionCustom || { x: 1, y: 0, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" placeholder="Z" />
                                </div>
                              );

                              const spiralOptionsJSX = currentCore.gradientColor.direction === 'spiral' && (
                                <div className="mt-1 space-y-1">
                                  <div className="flex gap-2 items-center">
                                    <span className="text-xs text-gray-400">旋转轴</span>
                                    <select value={currentCore.gradientColor.spiralAxis || 'y'} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, spiralAxis: e.target.value as any } })} className="text-xs bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                      <option value="x">X</option>
                                      <option value="y">Y</option>
                                      <option value="z">Z</option>
                                    </select>
                                    <span className="text-xs text-gray-400 ml-2">圈数</span>
                                    <input type="number" value={currentCore.gradientColor.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, spiralDensity: parseFloat(e.target.value) || 2 } })} className="w-12 text-xs bg-gray-700 rounded px-1 text-white text-center" />
                                  </div>
                                </div>
                              );

                              return (
                                <div className="mt-3 space-y-3">
                                  {/* ===== 基础属性 ===== */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>基础属性</span>
                                    <RangeControl label="半径" value={currentCore.baseRadius} min={50} max={500} step={1} onChange={(v) => updateCore(currentCore.id, { baseRadius: v })} />
                                    <RangeControl label="粒子密度" value={currentCore.density} min={1} max={50} step={0.1} onChange={(v) => updateCore(currentCore.id, { density: v })} />
                                    <RangeControl label="粒子填充" value={currentCore.fillPercent} min={0} max={100} step={1} onChange={(v) => updateCore(currentCore.id, { fillPercent: v, fillMode: v === 0 ? PlanetFillMode.Shell : PlanetFillMode.Gradient })} />
                                    <RangeControl label="粒子大小" value={currentCore.particleSize || 1.0} min={1} max={10} step={0.05} onChange={(v) => updateCore(currentCore.id, { particleSize: v })} />
                                    <RangeControl label="亮度" value={currentCore.brightness || 1.0} min={0.1} max={3.0} step={0.1} onChange={(v) => updateCore(currentCore.id, { brightness: v })} />
                                  </div>

                                  {/* ===== 颜色模式 ===== */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色模式</span>

                                    {/* 模式切换按钮组 */}
                                    <div className="grid grid-cols-4 gap-1 mb-3">
                                      {[
                                        { id: 'none', label: '单色' },
                                        { id: 'twoColor', label: '双色' },
                                        { id: 'threeColor', label: '三色' },
                                        { id: 'procedural', label: '混色' }
                                      ].map(m => (
                                        <button
                                          key={m.id}
                                          onClick={() => setColorMode(m.id)}
                                          className="px-1 py-1 text-[10px] rounded transition-all duration-200"
                                          style={getOptionButtonStyle(colorMode === m.id)}
                                        >
                                          {m.label}
                                        </button>
                                      ))}
                                    </div>

                                    {/* 单色模式 */}
                                    {colorMode === 'none' && (
                                      <div className="space-y-1">
                                        <RangeControl label="色相" value={currentCore.baseHue} min={0} max={360} step={5} onChange={(v) => updateCore(currentCore.id, { baseHue: v })} />
                                        <div className="h-2 rounded" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
                                        <RangeControl label="饱和度" value={currentCore.baseSaturation ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateCore(currentCore.id, { baseSaturation: v })} />
                                      </div>
                                    )}

                                    {/* 双色渐变 */}
                                    {colorMode === 'twoColor' && (
                                      <div className="space-y-2">
                                        <div className="flex gap-2 items-center justify-center">
                                          <input type="color" value={currentCore.gradientColor.colors[0] || '#ff6b6b'} onChange={(e) => { const colors = [...(currentCore.gradientColor.colors || [])]; colors[0] = e.target.value; updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colors } }); }} className="w-12 h-8 rounded cursor-pointer" title="起始色" />
                                          <span className="text-gray-400 text-lg">→</span>
                                          <input type="color" value={currentCore.gradientColor.colors[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentCore.gradientColor.colors || [])]; colors[1] = e.target.value; updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colors } }); }} className="w-12 h-8 rounded cursor-pointer" title="结束色" />
                                        </div>
                                        {directionSelectJSX}
                                        {customDirectionJSX}
                                        {spiralOptionsJSX}
                                      </div>
                                    )}

                                    {/* 三色渐变 */}
                                    {colorMode === 'threeColor' && (
                                      <div className="space-y-2">
                                        <div className="flex gap-1 items-center justify-center">
                                          <input type="color" value={currentCore.gradientColor.colors[0] || '#ff6b6b'} onChange={(e) => { const colors = [...(currentCore.gradientColor.colors || [])]; colors[0] = e.target.value; updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="起始色" />
                                          <span className="text-gray-500">→</span>
                                          <input type="color" value={currentCore.gradientColor.colors[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentCore.gradientColor.colors || [])]; colors[1] = e.target.value; updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="中间色" />
                                          <span className="text-gray-500">→</span>
                                          <input type="color" value={currentCore.gradientColor.colors[2] || '#ffd93d'} onChange={(e) => { const colors = [...(currentCore.gradientColor.colors || [])]; colors[2] = e.target.value; updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colors } }); }} className="w-10 h-7 rounded cursor-pointer" title="结束色" />
                                        </div>
                                        <RangeControl label="中间色位置" value={currentCore.gradientColor.colorMidPosition ?? 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colorMidPosition: v } })} />
                                        <RangeControl label="中间色宽度" value={currentCore.gradientColor.colorMidWidth ?? 1} min={0} max={5} step={0.05} onChange={(v) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colorMidWidth: v, colorMidWidth2: 0 } })} />
                                        <RangeControl label="纯色带宽度" value={currentCore.gradientColor.colorMidWidth2 ?? 0} min={0} max={0.5} step={0.01} onChange={(v) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, colorMidWidth2: v, colorMidWidth: 1 } })} />
                                        {directionSelectJSX}
                                        {customDirectionJSX}
                                        {spiralOptionsJSX}
                                      </div>
                                    )}

                                    {/* 混色渐变（程序化） */}
                                    {colorMode === 'procedural' && (
                                      <div className="space-y-2">
                                        <RangeControl label="基础色相" value={currentCore.baseHue} min={0} max={360} step={5} onChange={(v) => updateCore(currentCore.id, { baseHue: v })} />
                                        <div className="h-2 rounded" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
                                        <RangeControl label="饱和度" value={currentCore.baseSaturation ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateCore(currentCore.id, { baseSaturation: v })} />

                                        <div className="pt-2 border-t border-gray-700">
                                          <div className="flex gap-2 items-center">
                                            <span className="text-xs text-gray-400">混色轴向</span>
                                            <select value={currentCore.gradientColor.proceduralAxis || 'y'} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, proceduralAxis: e.target.value as any } })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                              <option value="x">X轴</option>
                                              <option value="y">Y轴</option>
                                              <option value="z">Z轴</option>
                                              <option value="custom">自定义</option>
                                            </select>
                                          </div>
                                          {currentCore.gradientColor.proceduralAxis === 'custom' && (
                                            <div className="flex gap-1 items-center text-xs mt-1">
                                              <span className="text-gray-500">轴向:</span>
                                              <input type="number" value={currentCore.gradientColor.proceduralCustomAxis?.x ?? 0} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, proceduralCustomAxis: { ...(currentCore.gradientColor.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                              <input type="number" value={currentCore.gradientColor.proceduralCustomAxis?.y ?? 1} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, proceduralCustomAxis: { ...(currentCore.gradientColor.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                              <input type="number" value={currentCore.gradientColor.proceduralCustomAxis?.z ?? 0} onChange={(e) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, proceduralCustomAxis: { ...(currentCore.gradientColor.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                            </div>
                                          )}
                                          <RangeControl label="渐变强度" value={currentCore.gradientColor.proceduralIntensity ?? 1.0} min={0.1} max={5} step={0.1} onChange={(v) => updateCore(currentCore.id, { gradientColor: { ...currentCore.gradientColor, proceduralIntensity: v } })} />
                                          <span className="text-[10px] text-gray-500">强度越大，色相跨度越大</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* ===== 运动效果 ===== */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动效果</span>
                                    <RangeControl label="自转速度" value={currentCore.rotationSpeed} min={-2} max={2} step={0.02} onChange={(v) => updateCore(currentCore.id, { rotationSpeed: v })} />
                                    <RotationAxisPresetSelector axis={currentCore.rotationAxis} onChange={(axis) => updateCore(currentCore.id, { rotationAxis: axis })} getButtonStyle={getOptionButtonStyle} />
                                    <RangeControl label="拖尾长度" value={currentCore.trailLength} min={0} max={2} step={0.1} onChange={(v) => updateCore(currentCore.id, { trailLength: v })} />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* ===== 实体核心面板 ===== */}
                      {coreSubTab === 'solid' && (() => {
                        // 系统预设列表
                        const presetList = [
                          { id: 'magma', name: '🔥 岩浆' },
                          { id: 'gas', name: '🌀 气态' },
                          { id: 'ice', name: '❄️ 冰晶' },
                          { id: 'cyber', name: '💜 赛博' },
                          { id: 'custom', name: '⚙️ 自定义' },
                        ];

                        // 从预设创建新实体核心
                        const addSolidCoreFromPreset = (presetId: string) => {
                          const preset = SOLID_CORE_PRESETS[presetId as keyof typeof SOLID_CORE_PRESETS];
                          if (preset) {
                            const count = solidCores.filter(c => c.preset === presetId).length;
                            const baseName = presetId === 'magma' ? '岩浆' : presetId === 'gas' ? '气态' : presetId === 'ice' ? '冰晶' : presetId === 'cyber' ? '赛博' : '自定义';
                            const newInstance: SolidCoreSettings = {
                              ...preset,
                              id: `solid_${presetId}_${Date.now()}`,
                              name: count > 0 ? `${baseName} ${count + 1}` : baseName,
                              enabled: true,
                              preset: presetId
                            };
                            updatePlanet({ coreSystem: { ...planet.coreSystem, solidCores: [...solidCores, newInstance] } });
                            setSelectedSolidCoreId(newInstance.id);
                          }
                        };

                        return (
                          <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                            {/* 实体核心列表管理 */}
                            <FloatingListSelector
                              items={solidCores}
                              selectedId={effectiveSelectedSolidCoreId}
                              onSelect={(id) => setSelectedSolidCoreId(id)}
                              onToggleEnabled={(id, enabled) => updateSolidCore(id, { enabled })}
                              onRename={(id, name) => updateSolidCore(id, { name })}
                              onDelete={(id) => {
                                const updated = solidCores.filter(c => c.id !== id);
                                updatePlanet({ coreSystem: { ...planet.coreSystem, solidCores: updated } });
                                if (effectiveSelectedSolidCoreId === id) setSelectedSolidCoreId(updated[0]?.id || null);
                              }}
                              onCopy={(id) => {
                                const source = solidCores.find(c => c.id === id);
                                if (source) {
                                  const newId = `solid_${Date.now()}`;
                                  const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                  updatePlanet({ coreSystem: { ...planet.coreSystem, solidCores: [...solidCores, copy] } });
                                  setSelectedSolidCoreId(newId);
                                }
                              }}
                              onAdd={() => addSolidCoreFromPreset('custom')}
                              globalEnabled={planet.coreSystem?.solidCoresEnabled ?? true}
                              onGlobalToggle={(enabled) => updatePlanet({ coreSystem: { ...planet.coreSystem, solidCoresEnabled: enabled } })}
                              soloId={soloSolidCoreId}
                              onSoloToggle={setSoloSolidCoreId}
                              title="实体核心"
                              titleStyle={{ color: 'var(--ui-secondary)' }}
                              addButtonColor="bg-blue-600 hover:bg-blue-500"
                              emptyText="暂无实体核心"
                            />

                            {/* 预设列表 */}
                            <PresetListBox
                              storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.solidCore)}
                              builtInPresets={[
                                { id: 'magma', name: '岩浆星球', data: SOLID_CORE_PRESETS.magma },
                                { id: 'gaia', name: '盖亚生机', data: SOLID_CORE_PRESETS.gaia },
                                { id: 'hephaestus', name: '地狱熔炉', data: SOLID_CORE_PRESETS.hephaestus },
                                { id: 'frozenThrone', name: '极寒王座', data: SOLID_CORE_PRESETS.frozenThrone },
                                { id: 'gasGiant', name: '气态巨星', data: SOLID_CORE_PRESETS.gasGiant },
                                { id: 'dysonSphere', name: '戴森球阵列', data: SOLID_CORE_PRESETS.dysonSphere },
                                { id: 'ethereal', name: '以太幻境', data: SOLID_CORE_PRESETS.ethereal }
                              ]}
                              currentData={currentSolidCore ? { ...currentSolidCore, id: undefined, name: undefined, enabled: undefined } : null}
                              hasInstance={!!currentSolidCore}
                              instanceName="核心"
                              onApplyToInstance={(data) => {
                                if (currentSolidCore) {
                                  updateSolidCore(currentSolidCore.id, { ...data });
                                }
                              }}
                              onCreateInstance={(data, presetName) => {
                                const count = solidCores.length + 1;
                                const newInstance: SolidCoreSettings = {
                                  ...data,
                                  id: `solid_${Date.now()}`,
                                  name: `${presetName.replace(/^[^\s]+\s/, '')} ${count}`,
                                  enabled: true,
                                  preset: 'custom'
                                };
                                updatePlanet({ coreSystem: { ...planet.coreSystem, solidCores: [...solidCores, newInstance] } });
                                setSelectedSolidCoreId(newInstance.id);
                              }}
                              title="预设"
                              accentColor="purple"
                              moduleName="solidCore"
                            />

                            {/* 参数编辑区域 */}
                            {!currentSolidCore ? (
                              <div className="p-3 text-center text-xs text-gray-500 bg-gray-800/30 rounded">
                                请点击上方"+"按钮或预设按钮添加实体核心
                              </div>
                            ) : (
                              <>
                                {/* 当前编辑提示 + 保存到预设 */}
                                <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                  backdropFilter: 'blur(8px)',
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                  <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentSolidCore.name}</span>
                                  <SavePresetButton
                                    storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.solidCore)}
                                    currentData={currentSolidCore}
                                    defaultName={currentSolidCore.name}
                                    accentColor="teal"
                                  />
                                </div>

                                {/* ===== 二级Tab切换 ===== */}
                                {(() => {
                                  const sc = currentSolidCore.surfaceColor || { mode: 'none', baseColor: '#ff4400', colors: ['#ff4400', '#ffffff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 };
                                  const gc = currentSolidCore.glowColor || { mode: 'none', baseColor: '#ff6600', colors: ['#ff6600', '#ffffff'], colorMidPosition: 0.5, direction: 'radial', directionCustom: { x: 0, y: 1, z: 0 }, spiralDensity: 3, proceduralIntensity: 1.0 };
                                  const surfaceColorMode = sc.mode || 'none';
                                  const glowColorMode = gc.mode || 'none';
                                  const setSurfaceColorMode = (mode: string) => updateSolidCore(currentSolidCore.id, { surfaceColor: { ...sc, mode: mode as any } });
                                  const updateSurfaceColor = (updates: any) => updateSolidCore(currentSolidCore.id, { surfaceColor: { ...sc, ...updates } });
                                  const setGlowColorMode = (mode: string) => updateSolidCore(currentSolidCore.id, { glowColor: { ...gc, mode: mode as any } });
                                  const updateGlowColor = (updates: any) => updateSolidCore(currentSolidCore.id, { glowColor: { ...gc, ...updates } });

                                  // 状态指示器组件
                                  const StatusDot: React.FC<{ enabled: boolean }> = ({ enabled }) => (
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${enabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                                  );

                                  return (
                                    <>
                                      {/* Tab按钮 */}
                                      <div className="flex gap-1 mb-2 bg-gray-800/50 rounded p-1">
                                        <button onClick={() => setSolidCoreTab('appearance')} className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200" style={getOptionButtonStyle(solidCoreTab === 'appearance')}>🎨 外观</button>
                                        <button onClick={() => setSolidCoreTab('texture')} className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200" style={getOptionButtonStyle(solidCoreTab === 'texture')}>🌋 纹理</button>
                                        <button onClick={() => setSolidCoreTab('lighting')} className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200" style={getOptionButtonStyle(solidCoreTab === 'lighting')}>✨ 光效</button>
                                      </div>

                                      {/* ===== 外观 Tab ===== */}
                                      {solidCoreTab === 'appearance' && (
                                        <>
                                          {/* 基础属性 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>基础属性</span>
                                            <RangeControl label="半径" value={currentSolidCore.radius} min={10} max={300} step={5} onChange={(v) => updateSolidCore(currentSolidCore.id, { radius: v })} />
                                            <RangeControl label="亮度" value={currentSolidCore.brightness ?? 1.0} min={0.1} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { brightness: v })} />
                                            <RangeControl label="透明度" value={currentSolidCore.opacity} min={0} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { opacity: v })} />
                                          </div>

                                          {/* 运动效果 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动效果</span>
                                            <RangeControl label="自转速度" value={currentSolidCore.rotationSpeed ?? 0} min={-2} max={2} step={0.02} onChange={(v) => updateSolidCore(currentSolidCore.id, { rotationSpeed: v })} />
                                            <RotationAxisPresetSelector axis={currentSolidCore.rotationAxis ?? { preset: 'y', customX: 0, customY: 1, customZ: 0 }} onChange={(axis) => updateSolidCore(currentSolidCore.id, { rotationAxis: axis })} getButtonStyle={getOptionButtonStyle} />
                                          </div>

                                          {/* ===== 表面颜色 ===== */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>表面颜色</span>

                                            {/* 模式切换 */}
                                            <div className="grid grid-cols-4 gap-1 mb-2">
                                              {[{ id: 'none', label: '单色' }, { id: 'twoColor', label: '双色' }, { id: 'threeColor', label: '三色' }, { id: 'procedural', label: '混色' }].map(m => (
                                                <button key={m.id} onClick={() => setSurfaceColorMode(m.id)} className="px-1 py-1 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(surfaceColorMode === m.id)}>{m.label}</button>
                                              ))}
                                            </div>

                                            {/* 单色 */}
                                            {surfaceColorMode === 'none' && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">基础色</span>
                                                <input type="color" value={sc.baseColor || '#ff4400'} onChange={(e) => updateSurfaceColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" />
                                              </div>
                                            )}

                                            {/* 双色渐变 */}
                                            {surfaceColorMode === 'twoColor' && (
                                              <div className="space-y-2">
                                                <div className="flex gap-2 items-center justify-center">
                                                  <input type="color" value={sc.colors?.[0] || '#ff4400'} onChange={(e) => { const colors = [...(sc.colors || [])]; colors[0] = e.target.value; updateSurfaceColor({ colors }); }} className="w-10 h-6 rounded cursor-pointer" />
                                                  <span className="text-gray-400">→</span>
                                                  <input type="color" value={sc.colors?.[1] || '#ffffff'} onChange={(e) => { const colors = [...(sc.colors || [])]; colors[1] = e.target.value; updateSurfaceColor({ colors }); }} className="w-10 h-6 rounded cursor-pointer" />
                                                </div>
                                                <select value={sc.direction || 'radial'} onChange={(e) => updateSurfaceColor({ direction: e.target.value })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                                  <option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="linearCustom">自定义</option><option value="spiral">螺旋</option>
                                                </select>
                                                {sc.direction === 'spiral' && <RangeControl label="螺旋圈数" value={sc.spiralDensity || 3} min={0.5} max={10} step={0.5} onChange={(v) => updateSurfaceColor({ spiralDensity: v })} />}
                                              </div>
                                            )}

                                            {/* 三色渐变 */}
                                            {surfaceColorMode === 'threeColor' && (
                                              <div className="space-y-2">
                                                <div className="flex gap-1 items-center justify-center">
                                                  <input type="color" value={sc.colors?.[0] || '#ff4400'} onChange={(e) => { const colors = [...(sc.colors || [])]; colors[0] = e.target.value; updateSurfaceColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                  <span className="text-gray-500">→</span>
                                                  <input type="color" value={sc.colors?.[1] || '#ffaa00'} onChange={(e) => { const colors = [...(sc.colors || [])]; colors[1] = e.target.value; updateSurfaceColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                  <span className="text-gray-500">→</span>
                                                  <input type="color" value={sc.colors?.[2] || '#ffffff'} onChange={(e) => { const colors = [...(sc.colors || [])]; colors[2] = e.target.value; updateSurfaceColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                </div>
                                                <RangeControl label="中间色位置" value={sc.colorMidPosition || 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateSurfaceColor({ colorMidPosition: v })} />
                                                <RangeControl label="中间色宽度" value={sc.colorMidWidth ?? 1} min={0} max={5} step={0.05} onChange={(v) => updateSurfaceColor({ colorMidWidth: v, colorMidWidth2: 0 })} />
                                                <RangeControl label="纯色带宽度" value={sc.colorMidWidth2 ?? 0} min={0} max={0.5} step={0.01} onChange={(v) => updateSurfaceColor({ colorMidWidth2: v, colorMidWidth: 1 })} />
                                                <select value={sc.direction || 'radial'} onChange={(e) => updateSurfaceColor({ direction: e.target.value })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                                  <option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option>
                                                </select>
                                              </div>
                                            )}

                                            {/* 混色 */}
                                            {surfaceColorMode === 'procedural' && (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-gray-400">基础色</span>
                                                  <input type="color" value={sc.baseColor || '#ff4400'} onChange={(e) => updateSurfaceColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" />
                                                </div>
                                                <RangeControl label="混色强度" value={sc.proceduralIntensity || 1} min={0.1} max={5} step={0.1} onChange={(v) => updateSurfaceColor({ proceduralIntensity: v })} />
                                                <select value={sc.direction || 'radial'} onChange={(e) => updateSurfaceColor({ direction: e.target.value })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                                  <option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option>
                                                </select>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}

                                      {/* ===== 纹理 Tab ===== */}
                                      {solidCoreTab === 'texture' && (
                                        <>
                                          {/* 纹理基础 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>纹理基础</span>
                                            <RangeControl label="纹理尺度" value={currentSolidCore.scale} min={0.1} max={10} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { scale: v })} />
                                            <RangeControl label="流动速度" value={currentSolidCore.speed} min={0} max={2} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { speed: v })} />
                                            <RangeControl label="对比度" value={currentSolidCore.contrast} min={1} max={5} step={0.5} onChange={(v) => updateSolidCore(currentSolidCore.id, { contrast: v })} />
                                          </div>

                                          {/* 纹理混合 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>纹理混合</span>
                                            <RangeControl label="气态条纹" value={currentSolidCore.bandMix} min={0} max={2} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { bandMix: v })} />
                                            <RangeControl label="冰晶锐化" value={currentSolidCore.ridgeMix} min={0} max={2} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { ridgeMix: v })} />
                                            <RangeControl label="赛博网格" value={currentSolidCore.gridMix} min={0} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { gridMix: v })} />
                                          </div>

                                          {/* 多频叠加 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-gray-400">🌍 多频叠加</span>
                                              <span
                                                onClick={() => updateSolidCore(currentSolidCore.id, { multiFreqEnabled: !(currentSolidCore.multiFreqEnabled ?? false) })}
                                                className={`inline-block w-2.5 h-2.5 rounded-full cursor-pointer ${(currentSolidCore.multiFreqEnabled ?? false) ? 'bg-green-400' : 'bg-red-400'}`}
                                              />
                                            </div>
                                            <div className={!(currentSolidCore.multiFreqEnabled ?? false) ? 'opacity-40 pointer-events-none' : ''}>
                                              <RangeControl label="域扭曲" value={currentSolidCore.warpIntensity ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { warpIntensity: v })} />
                                              <RangeControl label="扭曲尺度" value={currentSolidCore.warpScale ?? 1} min={0.5} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { warpScale: v })} />
                                              <RangeControl label="细节权重" value={currentSolidCore.detailBalance ?? 0.3} min={0} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { detailBalance: v })} />
                                            </div>
                                          </div>

                                          {/* 熔岩裂隙 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-gray-400">🔥 熔岩裂隙</span>
                                              <span
                                                onClick={() => updateSolidCore(currentSolidCore.id, { crackEnabled: !(currentSolidCore.crackEnabled ?? false) })}
                                                className={`inline-block w-2.5 h-2.5 rounded-full cursor-pointer ${(currentSolidCore.crackEnabled ?? false) ? 'bg-green-400' : 'bg-red-400'}`}
                                              />
                                            </div>
                                            <div className={!(currentSolidCore.crackEnabled ?? false) ? 'opacity-40 pointer-events-none' : ''}>
                                              <RangeControl label="噪声尺度" value={currentSolidCore.crackScale ?? 4} min={1} max={10} step={0.5} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackScale: v })} />
                                              <RangeControl label="阈值" value={currentSolidCore.crackThreshold ?? 0.3} min={0.1} max={0.9} step={0.05} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackThreshold: v })} />
                                              <RangeControl label="羽化" value={currentSolidCore.crackFeather ?? 0.1} min={0.01} max={0.3} step={0.01} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackFeather: v })} />
                                              <RangeControl label="域扭曲" value={currentSolidCore.crackWarp ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackWarp: v })} />
                                              <RangeControl label="扭曲尺度" value={currentSolidCore.crackWarpScale ?? 1.5} min={0.5} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackWarpScale: v })} />
                                              <RangeControl label="流动速度" value={currentSolidCore.crackFlowSpeed ?? 0.2} min={0} max={5} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackFlowSpeed: v })} />
                                              <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] text-gray-500">裂隙色</span>
                                                <input type="color" value={currentSolidCore.crackColor1 ?? '#ffffff'} onChange={(e) => updateSolidCore(currentSolidCore.id, { crackColor1: e.target.value })} className="w-5 h-5 rounded cursor-pointer" title="内侧色" />
                                                <span className="text-[8px] text-gray-600">→</span>
                                                <input type="color" value={currentSolidCore.crackColor2 ?? '#ffaa00'} onChange={(e) => updateSolidCore(currentSolidCore.id, { crackColor2: e.target.value })} className="w-5 h-5 rounded cursor-pointer" title="外侧色" />
                                              </div>
                                              <RangeControl label="裂隙发光" value={currentSolidCore.crackEmission ?? 2} min={0} max={5} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { crackEmission: v })} />
                                            </div>
                                          </div>
                                        </>
                                      )}

                                      {/* ===== 光效 Tab ===== */}
                                      {solidCoreTab === 'lighting' && (
                                        <>
                                          {/* 自发光 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>✨ 自发光</span>
                                            <RangeControl label="发光强度" value={currentSolidCore.emissiveStrength ?? 0} min={0} max={5} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { emissiveStrength: v })} />
                                            <span className="text-[9px] text-gray-600 block mt-1">让亮部发光触发Bloom效果</span>
                                          </div>

                                          {/* 边缘光晕 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-gray-400">🔮 边缘光晕</span>
                                              <span
                                                onClick={() => updateSolidCore(currentSolidCore.id, { glowEnabled: !(currentSolidCore.glowEnabled ?? true) })}
                                                className={`inline-block w-2.5 h-2.5 rounded-full cursor-pointer ${(currentSolidCore.glowEnabled ?? true) ? 'bg-green-400' : 'bg-red-400'}`}
                                              />
                                            </div>
                                            <div className={!(currentSolidCore.glowEnabled ?? true) ? 'opacity-40 pointer-events-none' : ''}>
                                              {/* 光晕颜色 */}
                                              <div className="mb-2">
                                                <span className="text-[10px] text-gray-500 block mb-1">光晕颜色</span>
                                                <div className="grid grid-cols-4 gap-1 mb-2">
                                                  {[{ id: 'none', label: '单色' }, { id: 'twoColor', label: '双色' }, { id: 'threeColor', label: '三色' }, { id: 'procedural', label: '混色' }].map(m => (
                                                    <button key={m.id} onClick={() => setGlowColorMode(m.id)} className="px-1 py-0.5 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(glowColorMode === m.id)}>{m.label}</button>
                                                  ))}
                                                </div>

                                                {glowColorMode === 'none' && (
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">颜色</span>
                                                    <input type="color" value={gc.baseColor || '#ff6600'} onChange={(e) => updateGlowColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" />
                                                  </div>
                                                )}

                                                {glowColorMode === 'twoColor' && (
                                                  <div className="space-y-1">
                                                    <div className="flex gap-2 items-center justify-center">
                                                      <input type="color" value={gc.colors?.[0] || '#ff6600'} onChange={(e) => { const colors = [...(gc.colors || [])]; colors[0] = e.target.value; updateGlowColor({ colors }); }} className="w-10 h-6 rounded cursor-pointer" />
                                                      <span className="text-gray-400">→</span>
                                                      <input type="color" value={gc.colors?.[1] || '#ffffff'} onChange={(e) => { const colors = [...(gc.colors || [])]; colors[1] = e.target.value; updateGlowColor({ colors }); }} className="w-10 h-6 rounded cursor-pointer" />
                                                    </div>
                                                    <select value={gc.direction || 'radial'} onChange={(e) => updateGlowColor({ direction: e.target.value })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                                      <option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option>
                                                    </select>
                                                  </div>
                                                )}

                                                {glowColorMode === 'threeColor' && (
                                                  <div className="space-y-1">
                                                    <div className="flex gap-1 items-center justify-center">
                                                      <input type="color" value={gc.colors?.[0] || '#ff6600'} onChange={(e) => { const colors = [...(gc.colors || [])]; colors[0] = e.target.value; updateGlowColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                      <span className="text-gray-500">→</span>
                                                      <input type="color" value={gc.colors?.[1] || '#ffaa00'} onChange={(e) => { const colors = [...(gc.colors || [])]; colors[1] = e.target.value; updateGlowColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                      <span className="text-gray-500">→</span>
                                                      <input type="color" value={gc.colors?.[2] || '#ffffff'} onChange={(e) => { const colors = [...(gc.colors || [])]; colors[2] = e.target.value; updateGlowColor({ colors }); }} className="w-8 h-6 rounded cursor-pointer" />
                                                    </div>
                                                    <RangeControl label="中间色位置" value={gc.colorMidPosition || 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateGlowColor({ colorMidPosition: v })} />
                                                    <RangeControl label="中间色宽度" value={gc.colorMidWidth ?? 1} min={0} max={5} step={0.05} onChange={(v) => updateGlowColor({ colorMidWidth: v, colorMidWidth2: 0 })} />
                                                    <RangeControl label="纯色带宽度" value={gc.colorMidWidth2 ?? 0} min={0} max={0.5} step={0.01} onChange={(v) => updateGlowColor({ colorMidWidth2: v, colorMidWidth: 1 })} />
                                                    <select value={gc.direction || 'radial'} onChange={(e) => updateGlowColor({ direction: e.target.value })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                                      <option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option>
                                                    </select>
                                                  </div>
                                                )}

                                                {glowColorMode === 'procedural' && (
                                                  <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xs text-gray-400">基础色</span>
                                                      <input type="color" value={gc.baseColor || '#ff6600'} onChange={(e) => updateGlowColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" />
                                                    </div>
                                                    <RangeControl label="混色强度" value={gc.proceduralIntensity || 1} min={0.1} max={5} step={0.1} onChange={(v) => updateGlowColor({ proceduralIntensity: v })} />
                                                  </div>
                                                )}
                                              </div>

                                              {/* 光晕形态 */}
                                              <div className="mb-2 pt-2 border-t border-gray-700">
                                                <span className="text-[10px] text-gray-500 block mb-1">光晕形态</span>
                                                <RangeControl label="宽度" value={currentSolidCore.glowLength ?? 2.0} min={0.5} max={10} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { glowLength: v })} />
                                                <RangeControl label="强度" value={currentSolidCore.glowStrength ?? 1.0} min={0} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { glowStrength: v })} />
                                                <RangeControl label="发散高度" value={currentSolidCore.glowRadius ?? 0.2} min={0} max={1} step={0.01} onChange={(v) => updateSolidCore(currentSolidCore.id, { glowRadius: v })} />
                                              </div>

                                              {/* 光晕效果 */}
                                              <div className="pt-2 border-t border-gray-700">
                                                <span className="text-[10px] text-gray-500 block mb-1">光晕效果</span>
                                                <RangeControl label="边缘淡出" value={currentSolidCore.glowFalloff ?? 2.0} min={0.5} max={5} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { glowFalloff: v })} />
                                                <div className="flex items-center justify-between my-1">
                                                  <span className="text-xs text-gray-400">内亮外淡</span>
                                                  <input type="checkbox" checked={currentSolidCore.glowInward ?? false} onChange={(e) => updateSolidCore(currentSolidCore.id, { glowInward: e.target.checked })} className="w-4 h-4 rounded" />
                                                </div>
                                                <RangeControl label="Bloom外扩" value={currentSolidCore.glowBloomBoost ?? 1.0} min={0} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { glowBloomBoost: v })} />
                                              </div>
                                            </div>
                                          </div>

                                          {/* 定向光 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-gray-400">💡 定向光</span>
                                              <span
                                                onClick={() => updateSolidCore(currentSolidCore.id, { lightEnabled: !(currentSolidCore.lightEnabled ?? false) })}
                                                className={`inline-block w-2.5 h-2.5 rounded-full cursor-pointer ${(currentSolidCore.lightEnabled ?? false) ? 'bg-green-400' : 'bg-red-400'}`}
                                              />
                                            </div>
                                            <div className={!(currentSolidCore.lightEnabled ?? false) ? 'opacity-40 pointer-events-none' : ''}>
                                              <div className="flex items-center gap-1 mb-1">
                                                <span className="text-[9px] text-gray-500 w-12">光源色</span>
                                                <input type="color" value={currentSolidCore.lightColor ?? '#ffffff'} onChange={(e) => updateSolidCore(currentSolidCore.id, { lightColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer" />
                                              </div>
                                              <RangeControl label="光照强度" value={currentSolidCore.lightIntensity ?? 1} min={0} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { lightIntensity: v })} />
                                              <RangeControl label="环境光" value={currentSolidCore.lightAmbient ?? 0.2} min={0} max={1} step={0.05} onChange={(v) => updateSolidCore(currentSolidCore.id, { lightAmbient: v })} />
                                              <div className="mt-1">
                                                <span className="text-[9px] text-gray-500 block mb-1">光源方向</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                  <RangeControl label="X" value={currentSolidCore.lightDirection?.x ?? -1} min={-1} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { lightDirection: { ...(currentSolidCore.lightDirection ?? { x: -1, y: -1, z: 1 }), x: v } })} />
                                                  <RangeControl label="Y" value={currentSolidCore.lightDirection?.y ?? -1} min={-1} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { lightDirection: { ...(currentSolidCore.lightDirection ?? { x: -1, y: -1, z: 1 }), y: v } })} />
                                                  <RangeControl label="Z" value={currentSolidCore.lightDirection?.z ?? 1} min={-1} max={1} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { lightDirection: { ...(currentSolidCore.lightDirection ?? { x: -1, y: -1, z: 1 }), z: v } })} />
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* 法线高光 */}
                                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-gray-400">💎 法线高光</span>
                                              <span
                                                onClick={() => updateSolidCore(currentSolidCore.id, { bumpEnabled: !(currentSolidCore.bumpEnabled ?? false) })}
                                                className={`inline-block w-2.5 h-2.5 rounded-full cursor-pointer ${(currentSolidCore.bumpEnabled ?? false) ? 'bg-green-400' : 'bg-red-400'}`}
                                              />
                                            </div>
                                            <div className={!(currentSolidCore.bumpEnabled ?? false) ? 'opacity-40 pointer-events-none' : ''}>
                                              <RangeControl label="凹凸强度" value={currentSolidCore.bumpStrength ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => updateSolidCore(currentSolidCore.id, { bumpStrength: v })} />
                                              <RangeControl label="高光强度" value={currentSolidCore.specularStrength ?? 1} min={0} max={3} step={0.1} onChange={(v) => updateSolidCore(currentSolidCore.id, { specularStrength: v })} />
                                              <div className="flex items-center gap-1 mb-1">
                                                <span className="text-[9px] text-gray-500 w-12">高光色</span>
                                                <input type="color" value={currentSolidCore.specularColor ?? '#ffffff'} onChange={(e) => updateSolidCore(currentSolidCore.id, { specularColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer" />
                                              </div>
                                              <RangeControl label="粗糙度" value={currentSolidCore.roughness ?? 32} min={4} max={128} step={4} onChange={(v) => updateSolidCore(currentSolidCore.id, { roughness: v })} />
                                            </div>
                                          </div>

                                        </>
                                      )}

                                    </>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {/* 核心模块底部间距 */}
                {planetSubTab === 'core' && <div className="h-4" />}

                {/* ===== 光环 子Tab ===== */}
                {planetSubTab === 'rings' && (() => {
                  // 自动选中第一个粒子环
                  const effectiveSelectedParticleRingId = selectedParticleRingId && planet.rings.particleRings.find(r => r.id === selectedParticleRingId)
                    ? selectedParticleRingId
                    : planet.rings.particleRings[0]?.id || null;
                  const currentParticleRing = planet.rings.particleRings.find(r => r.id === effectiveSelectedParticleRingId);

                  // 自动选中第一个环带
                  const effectiveSelectedContinuousRingId = selectedContinuousRingId && planet.rings.continuousRings.find(r => r.id === selectedContinuousRingId)
                    ? selectedContinuousRingId
                    : planet.rings.continuousRings[0]?.id || null;
                  const currentContinuousRing = planet.rings.continuousRings.find(r => r.id === effectiveSelectedContinuousRingId);

                  const updateParticleRing = (ringId: string, updates: Partial<ParticleRingSettings>) => {
                    const updated = planet.rings.particleRings.map(r => r.id === ringId ? { ...r, ...updates } : r);
                    updatePlanet({ rings: { ...planet.rings, particleRings: updated } });
                  };

                  const updateContinuousRing = (ringId: string, updates: Partial<ContinuousRingSettings>) => {
                    const updated = planet.rings.continuousRings.map(r => r.id === ringId ? { ...r, ...updates } : r);
                    updatePlanet({ rings: { ...planet.rings, continuousRings: updated } });
                  };

                  // ===== 丝线环选中逻辑 =====
                  const silkRings = planet.rings.silkRings || [];
                  const effectiveSelectedSilkRingId = selectedSilkRingId && silkRings.find(r => r.id === selectedSilkRingId)
                    ? selectedSilkRingId
                    : silkRings[0]?.id || null;
                  const currentSilkRing = silkRings.find(r => r.id === effectiveSelectedSilkRingId);

                  const updateSilkRing = (ringId: string, updates: Partial<SilkRingSettings>) => {
                    const updated = silkRings.map(r => r.id === ringId ? { ...r, ...updates } : r);
                    updatePlanet({ rings: { ...planet.rings, silkRings: updated } });
                  };

                  const setSilkRingColorMode = (mode: string) => {
                    if (!currentSilkRing) return;
                    const currentColor = currentSilkRing.color || { mode: 'none', baseColor: '#00ffff', colors: ['#00ffff', '#ffffff'] };
                    if (mode === 'none') {
                      updateSilkRing(currentSilkRing.id, { color: { ...currentColor, mode: 'none' } as any });
                    } else {
                      updateSilkRing(currentSilkRing.id, { color: { ...currentColor, mode: mode as any } });
                    }
                  };

                  // 颜色模式辅助函数
                  const getColorMode = (gradientColor: any) => gradientColor?.enabled ? (gradientColor.mode || 'twoColor') : 'none';
                  const setParticleRingColorMode = (mode: string) => {
                    if (!currentParticleRing) return;
                    if (mode === 'none') {
                      updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, enabled: false, mode: 'none' } });
                    } else {
                      updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, enabled: true, mode: mode as any } });
                    }
                  };
                  const setContinuousRingColorMode = (mode: string) => {
                    if (!currentContinuousRing) return;
                    if (mode === 'none') {
                      updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, enabled: false, mode: 'none' } });
                    } else {
                      updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, enabled: true, mode: mode as any } });
                    }
                  };

                  // 螺旋环启用状态
                  const spiralEnabled = planet.flameSystem?.spiralFlamesEnabled !== false;
                  const flameSystem = planet.flameSystem || DEFAULT_FLAME_SYSTEM;

                  return (
                    <ControlGroup title="光环系统" rightContent={
                      <button
                        onClick={() => updatePlanet({ rings: { ...planet.rings, enabled: !(planet.rings.enabled ?? true) } })}
                        className="px-2 py-1 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: (planet.rings.enabled ?? true)
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: (planet.rings.enabled ?? true)
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: (planet.rings.enabled ?? true) ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {(planet.rings.enabled ?? true) ? '已启用' : '已禁用'}
                      </button>
                    }>
                      {/* Tab 切换 - 应用材质设置 */}
                      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {[
                          { key: 'particle' as const, label: '粒子环', count: planet.rings.particleRings.filter(r => r.enabled).length, color: '#a78bfa', enabled: (planet.rings.enabled ?? true) && planet.rings.particleRingsEnabled },
                          { key: 'continuous' as const, label: '环带', count: planet.rings.continuousRings.filter(r => r.enabled).length, color: '#60a5fa', enabled: (planet.rings.enabled ?? true) && planet.rings.continuousRingsEnabled },
                          { key: 'silk' as const, label: '线环', count: (planet.rings.silkRings || []).filter(r => r.enabled).length, color: '#f472b6', enabled: (planet.rings.enabled ?? true) && (planet.rings.silkRingsEnabled ?? true) },
                          { key: 'spiral' as const, label: '螺旋环', count: planet.flameSystem?.spiralFlames?.filter(s => s.enabled).length || 0, color: '#34d399', enabled: (planet.rings.enabled ?? true) && (planet.flameSystem?.spiralFlamesEnabled ?? true) }
                        ].map(tab => {
                          const isActive = ringSubTab === tab.key;
                          const subConfig = materialSettings?.subModuleTabs?.rings || createDefaultMaterialConfig('glass');
                          const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setRingSubTab(tab.key)}
                              className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200"
                              style={materialStyle}
                            >
                              {tab.label}{tab.enabled && ` (${tab.count})`}
                            </button>
                          );
                        })}
                      </div>

                      {/* ===== 粒子环 Tab ===== */}
                      {ringSubTab === 'particle' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.rings.particleRings}
                            selectedId={effectiveSelectedParticleRingId}
                            onSelect={(id) => setSelectedParticleRingId(id)}
                            onToggleEnabled={(id, enabled) => updateParticleRing(id, { enabled })}
                            onRename={(id, name) => updateParticleRing(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.rings.particleRings.filter(r => r.id !== id);
                              updatePlanet({ rings: { ...planet.rings, particleRings: updated } });
                              if (effectiveSelectedParticleRingId === id) setSelectedParticleRingId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.rings.particleRings.find(r => r.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ rings: { ...planet.rings, particleRings: [...planet.rings.particleRings, copy] } });
                                setSelectedParticleRingId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newRing = createDefaultParticleRing(id, `粒子环 ${planet.rings.particleRings.length + 1}`);
                              updatePlanet({ rings: { ...planet.rings, particleRings: [...planet.rings.particleRings, newRing] } });
                              setSelectedParticleRingId(id);
                            }}
                            globalEnabled={planet.rings.particleRingsEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ rings: { ...planet.rings, particleRingsEnabled: enabled } })}
                            soloId={planet.rings.particleRingsSoloId}
                            onSoloToggle={(id) => updatePlanet({ rings: { ...planet.rings, particleRingsSoloId: id } })}
                            title="粒子环"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无粒子环"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.particleRing)}
                            builtInPresets={Object.entries(PARTICLE_RING_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                iceShards: '冰晶环带', moltenTrack: '熔岩轨迹', stardustVeil: '星尘面纱',
                                voidRift: '虚空裂隙', auroraRibbon: '极光丝带', goldenHalo: '黄金光环'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentParticleRing ? { ...currentParticleRing, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentParticleRing}
                            instanceName="粒子环"
                            onApplyToInstance={(data) => {
                              if (currentParticleRing) {
                                updateParticleRing(currentParticleRing.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newRing = {
                                ...createDefaultParticleRing(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.rings.particleRings.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ rings: { ...planet.rings, particleRings: [...planet.rings.particleRings, newRing] } });
                              setSelectedParticleRingId(id);
                            }}
                            title="预设"
                            accentColor="blue"
                            moduleName="particleRing"
                          />

                          {currentParticleRing && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentParticleRing.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.particleRing)}
                                  currentData={currentParticleRing}
                                  defaultName={currentParticleRing.name}
                                  accentColor="blue"
                                />
                              </div>

                              {/* 几何参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>几何参数</span>
                                <RangeControl label="轨道半径" value={currentParticleRing.absoluteRadius} min={60} max={1000} step={10} onChange={(v) => updateParticleRing(currentParticleRing.id, { absoluteRadius: v })} />
                                <RangeControl label="离心率" value={currentParticleRing.eccentricity} min={0} max={0.9} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { eccentricity: v })} />
                                <RangeControl label="环宽度" value={currentParticleRing.bandwidth} min={1} max={500} step={5} onChange={(v) => updateParticleRing(currentParticleRing.id, { bandwidth: v })} />
                                <RangeControl label="环厚度" value={currentParticleRing.thickness} min={0} max={100} step={1} onChange={(v) => updateParticleRing(currentParticleRing.id, { thickness: v })} />
                              </div>

                              {/* 粒子外观 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>粒子外观</span>
                                <RangeControl label="粒子密度" value={currentParticleRing.particleDensity} min={1} max={50} step={1} onChange={(v) => updateParticleRing(currentParticleRing.id, { particleDensity: v })} />
                                <RangeControl label="粒子大小" value={currentParticleRing.particleSize || 1.0} min={0.5} max={5.0} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { particleSize: v })} />
                                <RangeControl label="亮度" value={currentParticleRing.brightness || 1.0} min={0.1} max={2.0} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { brightness: v })} />
                              </div>

                              {/* 颜色模式 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色模式</span>
                                <div className="grid grid-cols-4 gap-1 mb-2">
                                  {[
                                    { id: 'none', label: '单色' },
                                    { id: 'twoColor', label: '双色' },
                                    { id: 'threeColor', label: '三色' },
                                    { id: 'procedural', label: '混色' }
                                  ].map(m => (
                                    <button
                                      key={m.id}
                                      onClick={() => setParticleRingColorMode(m.id)}
                                      className="px-1 py-1 text-[10px] rounded transition-all duration-200"
                                      style={getOptionButtonStyle(getColorMode(currentParticleRing.gradientColor) === m.id)}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>

                                {/* 单色模式 */}
                                {getColorMode(currentParticleRing.gradientColor) === 'none' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">颜色</span>
                                    <input type="color" value={currentParticleRing.color} onChange={(e) => updateParticleRing(currentParticleRing.id, { color: e.target.value })} className="w-10 h-6 rounded cursor-pointer" />
                                  </div>
                                )}

                                {/* 双色渐变 */}
                                {getColorMode(currentParticleRing.gradientColor) === 'twoColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-2 items-center justify-center">
                                      <input type="color" value={currentParticleRing.gradientColor?.colors?.[0] || currentParticleRing.color} onChange={(e) => { const colors = [...(currentParticleRing.gradientColor?.colors || [])]; colors[0] = e.target.value; updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colors } }); }} className="w-10 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-400">→</span>
                                      <input type="color" value={currentParticleRing.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentParticleRing.gradientColor?.colors || [])]; colors[1] = e.target.value; updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colors } }); }} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    <select value={currentParticleRing.gradientColor?.direction || 'radial'} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                      <option value="radial">径向（中心→外）</option>
                                      <option value="linearX">X轴线性</option>
                                      <option value="linearY">Y轴线性</option>
                                      <option value="linearZ">Z轴线性</option>
                                      <option value="linearCustom">自定义方向</option>
                                      <option value="spiral">螺旋</option>
                                    </select>
                                    {currentParticleRing.gradientColor?.direction === 'linearCustom' && (
                                      <div className="flex gap-1 items-center text-xs">
                                        <span className="text-gray-500">方向:</span>
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.x ?? 1} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.y ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.z ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                    {currentParticleRing.gradientColor?.direction === 'spiral' && (
                                      <div className="flex gap-2 items-center text-xs">
                                        <span className="text-gray-400">旋转轴</span>
                                        <select value={currentParticleRing.gradientColor?.spiralAxis || 'y'} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, spiralAxis: e.target.value as any } })} className="bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                          <option value="x">X</option>
                                          <option value="y">Y</option>
                                          <option value="z">Z</option>
                                        </select>
                                        <span className="text-gray-400">圈数</span>
                                        <input type="number" value={currentParticleRing.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, spiralDensity: parseFloat(e.target.value) || 2 } })} className="w-12 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 三色渐变 */}
                                {getColorMode(currentParticleRing.gradientColor) === 'threeColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-1 items-center justify-center">
                                      <input type="color" value={currentParticleRing.gradientColor?.colors?.[0] || currentParticleRing.color} onChange={(e) => { const colors = [...(currentParticleRing.gradientColor?.colors || [])]; colors[0] = e.target.value; updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentParticleRing.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentParticleRing.gradientColor?.colors || [])]; colors[1] = e.target.value; updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentParticleRing.gradientColor?.colors?.[2] || '#ffd93d'} onChange={(e) => { const colors = [...(currentParticleRing.gradientColor?.colors || [])]; colors[2] = e.target.value; updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                    </div>
                                    <RangeControl label="中间色位置" value={currentParticleRing.gradientColor?.colorMidPosition ?? 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colorMidPosition: v } })} />
                                    <RangeControl label="中间色宽度" value={currentParticleRing.gradientColor?.colorMidWidth ?? 1} min={0} max={5} step={0.05} onChange={(v) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colorMidWidth: v, colorMidWidth2: 0 } })} />
                                    <RangeControl label="纯色带宽度" value={currentParticleRing.gradientColor?.colorMidWidth2 ?? 0} min={0} max={0.5} step={0.01} onChange={(v) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, colorMidWidth2: v, colorMidWidth: 1 } })} />
                                    <select value={currentParticleRing.gradientColor?.direction || 'radial'} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                      <option value="radial">径向（中心→外）</option>
                                      <option value="linearX">X轴线性</option>
                                      <option value="linearY">Y轴线性</option>
                                      <option value="linearZ">Z轴线性</option>
                                      <option value="linearCustom">自定义方向</option>
                                      <option value="spiral">螺旋</option>
                                    </select>
                                    {currentParticleRing.gradientColor?.direction === 'linearCustom' && (
                                      <div className="flex gap-1 items-center text-xs">
                                        <span className="text-gray-500">方向:</span>
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.x ?? 1} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.y ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.directionCustom?.z ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, directionCustom: { ...(currentParticleRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                    {currentParticleRing.gradientColor?.direction === 'spiral' && (
                                      <div className="flex gap-2 items-center text-xs">
                                        <span className="text-gray-400">旋转轴</span>
                                        <select value={currentParticleRing.gradientColor?.spiralAxis || 'y'} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, spiralAxis: e.target.value as any } })} className="bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                          <option value="x">X</option>
                                          <option value="y">Y</option>
                                          <option value="z">Z</option>
                                        </select>
                                        <span className="text-gray-400">圈数</span>
                                        <input type="number" value={currentParticleRing.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, spiralDensity: parseFloat(e.target.value) || 2 } })} className="w-12 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 混色模式 */}
                                {getColorMode(currentParticleRing.gradientColor) === 'procedural' && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">基础色</span>
                                      <input type="color" value={currentParticleRing.color} onChange={(e) => updateParticleRing(currentParticleRing.id, { color: e.target.value })} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-xs text-gray-400">混色轴向</span>
                                      <select value={currentParticleRing.gradientColor?.proceduralAxis || 'y'} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, proceduralAxis: e.target.value as any } })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                        <option value="x">X轴</option>
                                        <option value="y">Y轴</option>
                                        <option value="z">Z轴</option>
                                        <option value="radial">径向</option>
                                        <option value="custom">自定义</option>
                                      </select>
                                    </div>
                                    {currentParticleRing.gradientColor?.proceduralAxis === 'custom' && (
                                      <div className="flex gap-1 items-center text-xs">
                                        <span className="text-gray-500">轴向:</span>
                                        <input type="number" value={currentParticleRing.gradientColor?.proceduralCustomAxis?.x ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, proceduralCustomAxis: { ...(currentParticleRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.proceduralCustomAxis?.y ?? 1} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, proceduralCustomAxis: { ...(currentParticleRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentParticleRing.gradientColor?.proceduralCustomAxis?.z ?? 0} onChange={(e) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, proceduralCustomAxis: { ...(currentParticleRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                    <RangeControl label="渐变强度" value={currentParticleRing.gradientColor?.proceduralIntensity ?? 1.0} min={0.1} max={5} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { gradientColor: { ...currentParticleRing.gradientColor, proceduralIntensity: v } })} />
                                  </div>
                                )}
                              </div>

                              {/* 漩涡效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">漩涡效果</span>
                                  <button
                                    onClick={() => {
                                      const vortex = currentParticleRing.vortex || { enabled: false, armCount: 4, twist: 2, rotationSpeed: 0.5, radialDirection: 'static' as const, radialSpeed: 0.3, hardness: 0.5, colors: ['#ff6b6b', '#4ecdc4'] };
                                      updateParticleRing(currentParticleRing.id, { vortex: { ...vortex, enabled: !vortex.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentParticleRing.vortex?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentParticleRing.vortex?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentParticleRing.vortex?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentParticleRing.vortex?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentParticleRing.vortex?.enabled && (
                                  <div className="space-y-2">
                                    <RangeControl label="旋臂数量" value={currentParticleRing.vortex?.armCount ?? 4} min={1} max={12} step={1} onChange={(v) => updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, armCount: v } })} />
                                    <RangeControl label="扭曲程度" value={currentParticleRing.vortex?.twist ?? 2} min={0} max={10} step={0.5} onChange={(v) => updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, twist: v } })} />
                                    <RangeControl label="硬边程度" value={currentParticleRing.vortex?.hardness ?? 0.5} min={0} max={1} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, hardness: v } })} />

                                    {/* 漩涡颜色 */}
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-gray-400 text-xs">旋臂颜色</span>
                                        {(currentParticleRing.vortex?.colors?.length ?? 2) < 7 && (
                                          <button
                                            onClick={() => {
                                              const colors = [...(currentParticleRing.vortex?.colors || ['#ff6b6b', '#4ecdc4'])];
                                              colors.push('#ffd93d');
                                              updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, colors } });
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                                          >
                                            + 添加
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {(currentParticleRing.vortex?.colors || ['#ff6b6b', '#4ecdc4']).map((color, idx) => (
                                          <div key={idx} className="flex items-center gap-0.5">
                                            <input
                                              type="color"
                                              value={color}
                                              onChange={(e) => {
                                                const colors = [...(currentParticleRing.vortex?.colors || ['#ff6b6b', '#4ecdc4'])];
                                                colors[idx] = e.target.value;
                                                updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, colors } });
                                              }}
                                              className="w-6 h-6 rounded cursor-pointer"
                                            />
                                            {(currentParticleRing.vortex?.colors?.length ?? 2) > 2 && (
                                              <button
                                                onClick={() => {
                                                  const colors = [...(currentParticleRing.vortex?.colors || [])];
                                                  colors.splice(idx, 1);
                                                  updateParticleRing(currentParticleRing.id, { vortex: { ...currentParticleRing.vortex!, colors } });
                                                }}
                                                className="text-gray-500 hover:text-red-400 text-xs"
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 银河系效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">银河系效果</span>
                                  <button
                                    onClick={() => {
                                      const galaxy = currentParticleRing.galaxy || {
                                        enabled: false, preset: 'custom' as const, branches: 4, spin: 0.8,
                                        randomness: 0.25, randomnessPower: 3, coreSize: 0.2, coreBrightness: 1.5,
                                        useRadialGradient: true, insideColor: '#f8d090', outsideColor: '#2b1d42'
                                      };
                                      updateParticleRing(currentParticleRing.id, { galaxy: { ...galaxy, enabled: !galaxy.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentParticleRing.galaxy?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentParticleRing.galaxy?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentParticleRing.galaxy?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentParticleRing.galaxy?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentParticleRing.galaxy?.enabled && (() => {
                                  const gal = currentParticleRing.galaxy!;
                                  const updateGal = (updates: Partial<typeof gal>) => updateParticleRing(currentParticleRing.id, { galaxy: { ...gal, ...updates } });
                                  return (
                                    <div className="space-y-2">
                                      {/* 螺旋臂参数 */}
                                      <RangeControl label="螺旋臂数量" value={gal.branches ?? 4} min={1} max={12} step={1} onChange={(v) => updateGal({ branches: v })} />
                                      <RangeControl label="扭曲程度" value={gal.spin ?? 0.8} min={0} max={6} step={0.1} onChange={(v) => updateGal({ spin: v })} />
                                      <RangeControl label="粒子分散度" value={gal.randomness ?? 0.25} min={0} max={2} step={0.05} onChange={(v) => updateGal({ randomness: v })} />
                                      <RangeControl label="分散指数" value={gal.randomnessPower ?? 3} min={1} max={5} step={0.5} onChange={(v) => updateGal({ randomnessPower: v })} />

                                      {/* 核心参数 */}
                                      <RangeControl label="核心膨胀" value={gal.coreSize ?? 2} min={1} max={5} step={0.5} onChange={(v) => updateGal({ coreSize: v })} />
                                      <RangeControl label="亮度衰减强度" value={gal.coreBrightness ?? 2} min={0.5} max={5} step={0.25} onChange={(v) => updateGal({ coreBrightness: v })} />
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* 运动速度 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动速度</span>
                                <RangeControl label="公转速度" value={currentParticleRing.orbitSpeed} min={-2} max={2} step={0.02} onChange={(v) => updateParticleRing(currentParticleRing.id, { orbitSpeed: v })} />
                                <RangeControl label="自转速度" value={currentParticleRing.rotationSpeed ?? 0.3} min={-2} max={2} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { rotationSpeed: v })} />
                                <RangeControl label="起始相位" value={currentParticleRing.phaseOffset} min={0} max={360} step={15} onChange={(v) => updateParticleRing(currentParticleRing.id, { phaseOffset: v })} />
                                <RangeControl label="拖尾长度" value={currentParticleRing.trailLength ?? 0} min={0} max={1} step={0.1} onChange={(v) => updateParticleRing(currentParticleRing.id, { trailLength: v })} />
                              </div>

                              {/* 姿态设置 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>姿态设置</span>
                                <TiltAxisSelector tilt={currentParticleRing.tilt ?? DEFAULT_TILT_SETTINGS} onChange={(tilt) => updateParticleRing(currentParticleRing.id, { tilt })} getButtonStyle={getOptionButtonStyle} />
                                <OrbitAxisSelector orbitAxis={currentParticleRing.orbitAxis ?? DEFAULT_ORBIT_AXIS_SETTINGS} onChange={(orbitAxis) => updateParticleRing(currentParticleRing.id, { orbitAxis })} getButtonStyle={getOptionButtonStyle} />
                              </div>

                              {/* 点缀装饰 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">✨ 点缀装饰</span>
                                  <button
                                    onClick={() => {
                                      const ornament = currentParticleRing.ornament || {
                                        enabled: false, style: 'flare' as const, count: 20, distribution: 'uniform' as const,
                                        baseSize: 15, sizeRandomness: 0.3, colorMode: 'inherit' as const, color: '#ffffff',
                                        opacity: 1, brightness: 1.5, glowIntensity: 0.8, pulseEnabled: false,
                                        pulseSpeed: 1, pulseIntensity: 0.3, pulseSync: false, orbitSpeedMultiplier: 1,
                                        orbitPhaseRandomness: 0.8, flareLeaves: 4, flareWidth: 0.5
                                      };
                                      updateParticleRing(currentParticleRing.id, { ornament: { ...ornament, enabled: !ornament.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentParticleRing.ornament?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentParticleRing.ornament?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentParticleRing.ornament?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentParticleRing.ornament?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentParticleRing.ornament?.enabled && (() => {
                                  const orn = currentParticleRing.ornament!;
                                  const updateOrn = (updates: Partial<typeof orn>) => updateParticleRing(currentParticleRing.id, { ornament: { ...orn, ...updates } });
                                  return (
                                    <div className="space-y-2">
                                      {/* 样式选择 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">样式</span>
                                        <select
                                          value={orn.style}
                                          onChange={(e) => updateOrn({ style: e.target.value as any })}
                                          className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white"
                                        >
                                          <optgroup label="流萤样式">
                                            <option value="plain">圆点</option>
                                            <option value="flare">星芒</option>
                                            <option value="spark">火花</option>
                                            <option value="texture">贴图</option>
                                          </optgroup>
                                          <optgroup label="星云形状">
                                            <option value="star">星形</option>
                                            <option value="snowflake">雪花</option>
                                            <option value="heart">爱心</option>
                                            <option value="crescent">月牙</option>
                                            <option value="crossGlow">十字</option>
                                            <option value="sakura">樱花</option>
                                            <option value="sun">太阳</option>
                                            <option value="sun2">太阳2</option>
                                            <option value="plum">梅花</option>
                                            <option value="lily">百合</option>
                                            <option value="lotus">莲花</option>
                                            <option value="prism">棱镜</option>
                                          </optgroup>
                                        </select>
                                      </div>

                                      {/* 星芒参数 */}
                                      {orn.style === 'flare' && (
                                        <div className="flex gap-2">
                                          <RangeControl label="叶片数" value={orn.flareLeaves ?? 4} min={2} max={8} step={1} onChange={(v) => updateOrn({ flareLeaves: v })} />
                                          <RangeControl label="叶片宽" value={orn.flareWidth ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => updateOrn({ flareWidth: v })} />
                                        </div>
                                      )}

                                      {/* 数量与分布 */}
                                      <RangeControl label="数量" value={orn.count} min={5} max={100} step={5} onChange={(v) => updateOrn({ count: v })} />
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">分布</span>
                                        <div className="flex gap-1">
                                          {[{ id: 'uniform', label: '均匀' }, { id: 'cluster', label: '聚簇' }].map(d => (
                                            <button
                                              key={d.id}
                                              onClick={() => updateOrn({ distribution: d.id as any })}
                                              className="px-2 py-0.5 text-[10px] rounded transition-all"
                                              style={getOptionButtonStyle(orn.distribution === d.id)}
                                            >
                                              {d.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      {orn.distribution === 'cluster' && (
                                        <>
                                          <RangeControl label="聚簇数" value={orn.clusterCount ?? 3} min={2} max={8} step={1} onChange={(v) => updateOrn({ clusterCount: v })} />
                                          <RangeControl label="分散度" value={orn.clusterSpread ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => updateOrn({ clusterSpread: v })} />
                                        </>
                                      )}

                                      {/* 大小 */}
                                      <RangeControl label="基准大小" value={orn.baseSize} min={5} max={50} step={1} onChange={(v) => updateOrn({ baseSize: v })} />
                                      <RangeControl label="随机缩放" value={orn.sizeRandomness} min={0} max={1} step={0.1} onChange={(v) => updateOrn({ sizeRandomness: v })} />

                                      {/* 颜色模式 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">颜色</span>
                                        <div className="flex gap-1">
                                          {[{ id: 'inherit', label: '继承' }, { id: 'solid', label: '纯色' }].map(c => (
                                            <button
                                              key={c.id}
                                              onClick={() => updateOrn({ colorMode: c.id as any })}
                                              className="px-2 py-0.5 text-[10px] rounded transition-all"
                                              style={getOptionButtonStyle(orn.colorMode === c.id)}
                                            >
                                              {c.label}
                                            </button>
                                          ))}
                                        </div>
                                        {orn.colorMode === 'solid' && (
                                          <input type="color" value={orn.color} onChange={(e) => updateOrn({ color: e.target.value })} className="w-8 h-6 rounded cursor-pointer" />
                                        )}
                                      </div>

                                      {/* 透明度与发光 */}
                                      <RangeControl label="不透明度" value={orn.opacity ?? 1} min={0.1} max={1} step={0.1} onChange={(v) => updateOrn({ opacity: v })} />
                                      <RangeControl label="亮度" value={orn.brightness ?? 1.5} min={0.5} max={3} step={0.1} onChange={(v) => updateOrn({ brightness: v })} />
                                      <RangeControl label="发光强度" value={orn.glowIntensity ?? 0.8} min={0} max={2} step={0.1} onChange={(v) => updateOrn({ glowIntensity: v })} />

                                      {/* 脉冲动画 */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">脉冲</span>
                                        <button
                                          onClick={() => updateOrn({ pulseEnabled: !orn.pulseEnabled })}
                                          className="px-2 py-0.5 text-[10px] rounded"
                                          style={getOptionButtonStyle(orn.pulseEnabled)}
                                        >
                                          {orn.pulseEnabled ? '开启' : '关闭'}
                                        </button>
                                        {orn.pulseEnabled && (
                                          <button
                                            onClick={() => updateOrn({ pulseSync: !orn.pulseSync })}
                                            className="px-2 py-0.5 text-[10px] rounded"
                                            style={getOptionButtonStyle(orn.pulseSync)}
                                          >
                                            {orn.pulseSync ? '同步' : '随机'}
                                          </button>
                                        )}
                                      </div>
                                      {orn.pulseEnabled && (
                                        <>
                                          <RangeControl label="脉冲速度" value={orn.pulseSpeed ?? 1} min={0.5} max={3} step={0.1} onChange={(v) => updateOrn({ pulseSpeed: v })} />
                                          <RangeControl label="脉冲幅度" value={orn.pulseIntensity ?? 0.3} min={0} max={1} step={0.1} onChange={(v) => updateOrn({ pulseIntensity: v })} />
                                        </>
                                      )}

                                      {/* 公转速度 */}
                                      <RangeControl label="公转倍率" value={orn.orbitSpeedMultiplier ?? 1} min={0} max={2} step={0.1} onChange={(v) => updateOrn({ orbitSpeedMultiplier: v })} />
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ===== 线环 Tab ===== */}
                      {ringSubTab === 'silk' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={silkRings}
                            selectedId={effectiveSelectedSilkRingId}
                            onSelect={(id) => setSelectedSilkRingId(id)}
                            onToggleEnabled={(id, enabled) => updateSilkRing(id, { enabled })}
                            onRename={(id, name) => updateSilkRing(id, { name })}
                            onDelete={(id) => {
                              const updated = silkRings.filter(r => r.id !== id);
                              updatePlanet({ rings: { ...planet.rings, silkRings: updated } });
                              if (effectiveSelectedSilkRingId === id) setSelectedSilkRingId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = silkRings.find(r => r.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本`, seed: Math.random() * 1000 };
                                updatePlanet({ rings: { ...planet.rings, silkRings: [...silkRings, copy] } });
                                setSelectedSilkRingId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newRing = createDefaultSilkRing(id, `线环 ${silkRings.length + 1}`);
                              updatePlanet({ rings: { ...planet.rings, silkRings: [...silkRings, newRing] } });
                              setSelectedSilkRingId(id);
                            }}
                            globalEnabled={planet.rings.silkRingsEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ rings: { ...planet.rings, silkRingsEnabled: enabled } })}
                            soloId={planet.rings.silkRingsSoloId}
                            onSoloToggle={(id) => updatePlanet({ rings: { ...planet.rings, silkRingsSoloId: id } })}
                            title="线环"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-pink-600 hover:bg-pink-500"
                            emptyText="暂无线环"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.silkRing)}
                            builtInPresets={Object.entries(SILK_RING_PRESETS).map(([id, data]) => ({
                              id,
                              name: { dataStream: '数据流', silkRibbon: '丝绸飘带', energyFiber: '能量纤维', nebulaSilk: '星云丝带', fireSilk: '烈焰丝绸', custom: '自定义' }[id] || id,
                              data
                            }))}
                            currentData={currentSilkRing ? { ...currentSilkRing, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentSilkRing}
                            instanceName="线环"
                            onApplyToInstance={(data) => { if (currentSilkRing) updateSilkRing(currentSilkRing.id, { ...data }); }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newRing = { ...createDefaultSilkRing(id, `${presetName.replace(/^[^\s]+\s/, '')} ${silkRings.length + 1}`), ...data, enabled: true };
                              updatePlanet({ rings: { ...planet.rings, silkRings: [...silkRings, newRing] } });
                              setSelectedSilkRingId(id);
                            }}
                            title="预设"
                            accentColor="#f472b6"
                            moduleName="silkRing"
                          />

                          {currentSilkRing && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentSilkRing.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.silkRing)}
                                  currentData={currentSilkRing}
                                  defaultName={currentSilkRing.name}
                                  accentColor="#f472b6"
                                />
                              </div>

                              {/* 几何参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs text-gray-400 block mb-2">几何参数</span>
                                <RangeControl label="轨道半径" value={currentSilkRing.orbitRadius} min={60} max={1000} step={10} onChange={(v) => updateSilkRing(currentSilkRing.id, { orbitRadius: v })} />
                                <RangeControl label="线环粗细" value={currentSilkRing.thickness} min={0.01} max={5} step={0.01} onChange={(v) => updateSilkRing(currentSilkRing.id, { thickness: v })} />
                              </div>

                              {/* 簇效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs text-gray-400 block mb-2">丝带效果</span>
                                <RangeControl label="丝线数量" value={currentSilkRing.clusterCount ?? 1} min={1} max={12} step={1} onChange={(v) => updateSilkRing(currentSilkRing.id, { clusterCount: v })} />
                                <RangeControl label="轴向偏移" value={currentSilkRing.axisSpread ?? 0.02} min={0} max={0.3} step={0.005} onChange={(v) => updateSilkRing(currentSilkRing.id, { axisSpread: v })} />
                                <RangeControl label="半径偏移" value={currentSilkRing.radiusSpread ?? 1} min={0} max={80} step={1} onChange={(v) => updateSilkRing(currentSilkRing.id, { radiusSpread: v })} />
                              </div>

                              {/* 形态波动 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs text-gray-400 block mb-2">形态波动</span>
                                {/* 波形类型选择器 */}
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">波形类型</span>
                                  <select
                                    value={currentSilkRing.waveType || 'sine'}
                                    onChange={(e) => updateSilkRing(currentSilkRing.id, { waveType: e.target.value as any })}
                                    className="px-2 py-0.5 text-[10px] rounded bg-gray-700/50 border border-gray-600 text-gray-200 focus:outline-none focus:border-blue-500"
                                    style={{ minWidth: '80px' }}
                                  >
                                    <option value="off">关闭</option>
                                    <option value="sine">正弦波</option>
                                    <option value="noise">噪声波</option>
                                    <option value="triangle">三角波</option>
                                    <option value="square">方波</option>
                                    <option value="sawtooth">锯齿波</option>
                                    <option value="pulse">脉冲波</option>
                                    <option value="organic">有机波</option>
                                    <option value="ripple">涟漪波</option>
                                  </select>
                                </div>
                                {currentSilkRing.waveType !== 'off' && (
                                  <>
                                    <RangeControl label="波动频率" value={currentSilkRing.wobbleFrequency} min={1} max={100} step={1} onChange={(v) => updateSilkRing(currentSilkRing.id, { wobbleFrequency: v })} />
                                    <RangeControl label="波动幅度" value={currentSilkRing.wobbleAmplitude} min={0.1} max={50} step={0.1} onChange={(v) => updateSilkRing(currentSilkRing.id, { wobbleAmplitude: v })} />
                                  </>
                                )}
                                <RangeControl label="Z轴飘移" value={currentSilkRing.zDriftScale} min={0} max={20} step={0.5} onChange={(v) => updateSilkRing(currentSilkRing.id, { zDriftScale: v })} />
                                <RangeControl label="流动速度" value={currentSilkRing.flowSpeed} min={0} max={30} step={0.5} onChange={(v) => updateSilkRing(currentSilkRing.id, { flowSpeed: v })} />
                              </div>

                              {/* 视觉效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs text-gray-400 block mb-2">视觉效果</span>
                                <RangeControl label="丝线密度" value={currentSilkRing.strandDensity} min={5} max={200} step={1} onChange={(v) => updateSilkRing(currentSilkRing.id, { strandDensity: v })} />
                                {/* 闪点效果 */}
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-400">闪点效果</span>
                                  <button
                                    onClick={() => updateSilkRing(currentSilkRing.id, { sparkleEnabled: !currentSilkRing.sparkleEnabled })}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentSilkRing.sparkleEnabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentSilkRing.sparkleEnabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentSilkRing.sparkleEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentSilkRing.sparkleEnabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>
                                {currentSilkRing.sparkleEnabled && (
                                  <div className="mt-1">
                                    <RangeControl label="闪点阈值" value={currentSilkRing.sparkleThreshold} min={0.8} max={0.99} step={0.01} onChange={(v) => updateSilkRing(currentSilkRing.id, { sparkleThreshold: v })} />
                                  </div>
                                )}
                                <RangeControl label="菲涅尔指数" value={currentSilkRing.fresnelPower} min={0.5} max={8} step={0.5} onChange={(v) => updateSilkRing(currentSilkRing.id, { fresnelPower: v })} />
                                <RangeControl label="透明度" value={currentSilkRing.opacity} min={0.1} max={1} step={0.05} onChange={(v) => updateSilkRing(currentSilkRing.id, { opacity: v })} />
                                <RangeControl label="发光强度" value={currentSilkRing.emissive} min={0} max={5} step={0.1} onChange={(v) => updateSilkRing(currentSilkRing.id, { emissive: v })} />

                              </div>

                              {/* 颜色模式 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色模式</span>
                                <div className="grid grid-cols-4 gap-1 mb-2">
                                  {[
                                    { id: 'none', label: '单色' },
                                    { id: 'twoColor', label: '双色' },
                                    { id: 'threeColor', label: '三色' },
                                    { id: 'procedural', label: '混色' }
                                  ].map(m => (
                                    <button
                                      key={m.id}
                                      onClick={() => setSilkRingColorMode(m.id)}
                                      className="px-1 py-1 text-[10px] rounded transition-all duration-200"
                                      style={getOptionButtonStyle(currentSilkRing.color?.mode === m.id)}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>

                                {/* 单色模式 */}
                                {(!currentSilkRing.color?.mode || currentSilkRing.color?.mode === 'none') && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">颜色</span>
                                    <input type="color" value={currentSilkRing.color?.baseColor || currentSilkRing.color?.colors?.[0] || '#00ffff'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, baseColor: e.target.value, colors: [e.target.value, currentSilkRing.color?.colors?.[1] || '#ffffff', currentSilkRing.color?.colors?.[2] || '#00ffff'] } as any })} className="w-10 h-6 rounded cursor-pointer" />
                                  </div>
                                )}

                                {/* 双色渐变 */}
                                {currentSilkRing.color?.mode === 'twoColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-2 items-center justify-center">
                                      <input type="color" value={currentSilkRing.color?.colors?.[0] || '#00ffff'} onChange={(e) => { const colors = [...(currentSilkRing.color?.colors || ['#00ffff', '#ffffff', '#00ffff'])]; colors[0] = e.target.value; updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colors, baseColor: e.target.value } as any }); }} className="w-10 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-400">→</span>
                                      <input type="color" value={currentSilkRing.color?.colors?.[1] || '#ffffff'} onChange={(e) => { const colors = [...(currentSilkRing.color?.colors || ['#00ffff', '#ffffff', '#00ffff'])]; colors[1] = e.target.value; updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colors } as any }); }} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    <select value={currentSilkRing.color?.direction || 'radial'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, direction: e.target.value } as any })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                      <option value="radial">径向（中心→外）</option>
                                      <option value="linearX">X轴线性</option>
                                      <option value="linearY">Y轴线性</option>
                                      <option value="linearZ">Z轴线性</option>
                                      <option value="spiral">螺旋</option>
                                    </select>
                                    {currentSilkRing.color?.direction === 'spiral' && (
                                      <div className="flex gap-2 items-center text-xs">
                                        <span className="text-gray-400">旋转轴</span>
                                        <select value={currentSilkRing.color?.spiralAxis || 'y'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, spiralAxis: e.target.value } as any })} className="bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                          <option value="x">X</option>
                                          <option value="y">Y</option>
                                          <option value="z">Z</option>
                                        </select>
                                        <span className="text-gray-400">圈数</span>
                                        <input type="number" value={currentSilkRing.color?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, spiralDensity: parseFloat(e.target.value) || 2 } as any })} className="w-12 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                    <RangeControl label="过渡强度" value={currentSilkRing.color?.blendStrength ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, blendStrength: v } as any })} />
                                  </div>
                                )}

                                {/* 三色渐变 */}
                                {currentSilkRing.color?.mode === 'threeColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-1 items-center justify-center">
                                      <input type="color" value={currentSilkRing.color?.colors?.[0] || '#00ffff'} onChange={(e) => { const colors = [...(currentSilkRing.color?.colors || ['#00ffff', '#ffffff', '#ff00ff'])]; colors[0] = e.target.value; updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colors, baseColor: e.target.value } as any }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentSilkRing.color?.colors?.[1] || '#ffffff'} onChange={(e) => { const colors = [...(currentSilkRing.color?.colors || ['#00ffff', '#ffffff', '#ff00ff'])]; colors[1] = e.target.value; updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colors } as any }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentSilkRing.color?.colors?.[2] || '#ff00ff'} onChange={(e) => { const colors = [...(currentSilkRing.color?.colors || ['#00ffff', '#ffffff', '#ff00ff'])]; colors[2] = e.target.value; updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colors } as any }); }} className="w-8 h-6 rounded cursor-pointer" />
                                    </div>
                                    <RangeControl label="中间色位置" value={currentSilkRing.color?.colorMidPosition ?? 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colorMidPosition: v } as any })} />
                                    <RangeControl label="中间色宽度" value={currentSilkRing.color?.colorMidWidth ?? 0} min={0} max={5} step={0.1} onChange={(v) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, colorMidWidth: v } as any })} />
                                    <select value={currentSilkRing.color?.direction || 'radial'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, direction: e.target.value } as any })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                      <option value="radial">径向（中心→外）</option>
                                      <option value="linearX">X轴线性</option>
                                      <option value="linearY">Y轴线性</option>
                                      <option value="linearZ">Z轴线性</option>
                                      <option value="spiral">螺旋</option>
                                    </select>
                                    <RangeControl label="过渡强度" value={currentSilkRing.color?.blendStrength ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, blendStrength: v } as any })} />
                                  </div>
                                )}

                                {/* 混色模式 */}
                                {currentSilkRing.color?.mode === 'procedural' && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">基础色</span>
                                      <input type="color" value={currentSilkRing.color?.baseColor || '#00ffff'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, baseColor: e.target.value } as any })} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-xs text-gray-400">混色轴向</span>
                                      <select value={currentSilkRing.color?.proceduralAxis || 'y'} onChange={(e) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, proceduralAxis: e.target.value } as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                        <option value="x">X轴</option>
                                        <option value="y">Y轴</option>
                                        <option value="z">Z轴</option>
                                        <option value="radial">径向</option>
                                      </select>
                                    </div>
                                    <RangeControl label="渐变强度" value={currentSilkRing.color?.proceduralIntensity ?? 1.0} min={0.1} max={5} step={0.1} onChange={(v) => updateSilkRing(currentSilkRing.id, { color: { ...currentSilkRing.color, proceduralIntensity: v } as any })} />
                                  </div>
                                )}
                              </div>

                              {/* 运动速度 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动速度</span>
                                <RangeControl label="公转速度" value={currentSilkRing.orbitSpeed ?? 0} min={-2} max={2} step={0.02} onChange={(v) => updateSilkRing(currentSilkRing.id, { orbitSpeed: v })} />
                                <RangeControl label="自转速度" value={currentSilkRing.rotationSpeed ?? 0.1} min={-10} max={10} step={0.1} onChange={(v) => updateSilkRing(currentSilkRing.id, { rotationSpeed: v })} />
                              </div>

                              {/* 姿态设置 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>姿态设置</span>
                                <TiltAxisSelector tilt={currentSilkRing.tilt ?? DEFAULT_TILT_SETTINGS} onChange={(tilt) => updateSilkRing(currentSilkRing.id, { tilt })} getButtonStyle={getOptionButtonStyle} />
                                <OrbitAxisSelector orbitAxis={currentSilkRing.orbitAxis ?? DEFAULT_ORBIT_AXIS_SETTINGS} onChange={(orbitAxis) => updateSilkRing(currentSilkRing.id, { orbitAxis })} getButtonStyle={getOptionButtonStyle} />
                              </div>
                            </div>
                          )}
                          {/* 实例计数 */}
                          <div className="mt-2 text-xs text-gray-500 text-right">
                            已启用: {silkRings.filter(r => r.enabled).length} / {silkRings.length}
                          </div>
                        </div>
                      )}

                      {/* ===== 环带 Tab ===== */}
                      {ringSubTab === 'continuous' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.rings.continuousRings}
                            selectedId={effectiveSelectedContinuousRingId}
                            onSelect={(id) => setSelectedContinuousRingId(id)}
                            onToggleEnabled={(id, enabled) => updateContinuousRing(id, { enabled })}
                            onRename={(id, name) => updateContinuousRing(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.rings.continuousRings.filter(r => r.id !== id);
                              updatePlanet({ rings: { ...planet.rings, continuousRings: updated } });
                              if (effectiveSelectedContinuousRingId === id) setSelectedContinuousRingId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.rings.continuousRings.find(r => r.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ rings: { ...planet.rings, continuousRings: [...planet.rings.continuousRings, copy] } });
                                setSelectedContinuousRingId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newRing = createDefaultContinuousRing(id, `环带 ${planet.rings.continuousRings.length + 1}`);
                              updatePlanet({ rings: { ...planet.rings, continuousRings: [...planet.rings.continuousRings, newRing] } });
                              setSelectedContinuousRingId(id);
                            }}
                            globalEnabled={planet.rings.continuousRingsEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ rings: { ...planet.rings, continuousRingsEnabled: enabled } })}
                            soloId={planet.rings.continuousRingsSoloId}
                            onSoloToggle={(id) => updatePlanet({ rings: { ...planet.rings, continuousRingsSoloId: id } })}
                            title="环带"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无环带"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.continuousRing)}
                            builtInPresets={Object.entries(CONTINUOUS_RING_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                crystalStarlink: '水晶星链', cyberDataRing: '赛博数据环', neonCircuit: '霓虹赛道',
                                saturnRemnant: '土星遗迹', quantumRipple: '量子涟漪', coronaHalo: '日冕光环'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentContinuousRing ? { ...currentContinuousRing, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentContinuousRing}
                            instanceName="环带"
                            onApplyToInstance={(data) => {
                              if (currentContinuousRing) {
                                updateContinuousRing(currentContinuousRing.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newRing = {
                                ...createDefaultContinuousRing(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.rings.continuousRings.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ rings: { ...planet.rings, continuousRings: [...planet.rings.continuousRings, newRing] } });
                              setSelectedContinuousRingId(id);
                            }}
                            title="预设"
                            accentColor="purple"
                            moduleName="continuousRing"
                          />

                          {currentContinuousRing && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentContinuousRing.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.continuousRing)}
                                  currentData={currentContinuousRing}
                                  defaultName={currentContinuousRing.name}
                                  accentColor="purple"
                                />
                              </div>

                              {/* 几何参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>几何参数</span>
                                <RangeControl label="内半径" value={currentContinuousRing.absoluteInnerRadius} min={60} max={1000} step={10} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { absoluteInnerRadius: v })} />
                                <RangeControl label="外半径" value={currentContinuousRing.absoluteOuterRadius} min={60} max={1000} step={10} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { absoluteOuterRadius: v })} />
                                <RangeControl label="离心率" value={currentContinuousRing.eccentricity} min={0} max={0.9} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { eccentricity: v })} />
                              </div>

                              {/* 视觉效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>视觉效果</span>
                                <RangeControl label="透明度" value={currentContinuousRing.opacity} min={0.1} max={1} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { opacity: v })} />
                                <RangeControl label="亮度" value={currentContinuousRing.brightness || 1.0} min={0.5} max={3.0} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { brightness: v })} />
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-gray-400 text-xs">透明度渐变:</span>
                                  <select value={currentContinuousRing.opacityGradient} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { opacityGradient: e.target.value as RingOpacityGradient })} className="flex-1 px-2 py-1 bg-gray-700 rounded text-white text-xs cursor-pointer">
                                    <option value="none">无</option>
                                    <option value="fadeIn">渐入（内→外）</option>
                                    <option value="fadeOut">渐出（外→内）</option>
                                    <option value="fadeBoth">两端渐变</option>
                                  </select>
                                </div>
                                {currentContinuousRing.opacityGradient !== 'none' && (
                                  <RangeControl label="渐变强度" value={currentContinuousRing.opacityGradientStrength ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { opacityGradientStrength: v })} />
                                )}
                              </div>

                              {/* 颜色模式 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色模式</span>
                                <div className="grid grid-cols-4 gap-1 mb-2">
                                  {[
                                    { id: 'none', label: '单色' },
                                    { id: 'twoColor', label: '双色' },
                                    { id: 'threeColor', label: '三色' },
                                    { id: 'procedural', label: '混色' }
                                  ].map(m => (
                                    <button
                                      key={m.id}
                                      onClick={() => setContinuousRingColorMode(m.id)}
                                      className="px-1 py-1 text-[10px] rounded transition-all duration-200"
                                      style={getOptionButtonStyle(getColorMode(currentContinuousRing.gradientColor) === m.id)}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>

                                {/* 单色模式 */}
                                {getColorMode(currentContinuousRing.gradientColor) === 'none' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">颜色</span>
                                    <input type="color" value={currentContinuousRing.color} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { color: e.target.value })} className="w-10 h-6 rounded cursor-pointer" />
                                  </div>
                                )}

                                {/* 双色渐变 */}
                                {getColorMode(currentContinuousRing.gradientColor) === 'twoColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-2 items-center justify-center">
                                      <input type="color" value={currentContinuousRing.gradientColor?.colors?.[0] || currentContinuousRing.color} onChange={(e) => { const colors = [...(currentContinuousRing.gradientColor?.colors || [])]; colors[0] = e.target.value; updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colors } }); }} className="w-10 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-400">→</span>
                                      <input type="color" value={currentContinuousRing.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentContinuousRing.gradientColor?.colors || [])]; colors[1] = e.target.value; updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colors } }); }} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    {!currentContinuousRing.streakMode?.enabled && (
                                      <>
                                        <select value={currentContinuousRing.gradientColor?.direction || 'radial'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                          <option value="radial">径向（中心→外）</option>
                                          <option value="linearX">X轴线性</option>
                                          <option value="linearY">Y轴线性</option>
                                          <option value="linearZ">Z轴线性</option>
                                          <option value="linearCustom">自定义方向</option>
                                          <option value="spiral">螺旋</option>
                                        </select>
                                        {currentContinuousRing.gradientColor?.direction === 'linearCustom' && (
                                          <div className="flex gap-1 items-center text-xs">
                                            <span className="text-gray-500">方向:</span>
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.x ?? 1} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.y ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.z ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                          </div>
                                        )}
                                        {currentContinuousRing.gradientColor?.direction === 'spiral' && (
                                          <div className="flex gap-2 items-center text-xs">
                                            <span className="text-gray-400">旋转轴</span>
                                            <select value={currentContinuousRing.gradientColor?.spiralAxis || 'y'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, spiralAxis: e.target.value as any } })} className="bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                              <option value="x">X</option>
                                              <option value="y">Y</option>
                                              <option value="z">Z</option>
                                            </select>
                                            <span className="text-gray-400">圈数</span>
                                            <input type="number" value={currentContinuousRing.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, spiralDensity: parseFloat(e.target.value) || 2 } })} className="w-12 bg-gray-700 rounded px-1 text-white text-center" />
                                          </div>
                                        )}
                                        <RangeControl label="过渡强度" value={currentContinuousRing.gradientColor?.blendStrength ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, blendStrength: v } })} />
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* 三色渐变 */}
                                {getColorMode(currentContinuousRing.gradientColor) === 'threeColor' && (
                                  <div className="space-y-2">
                                    <div className="flex gap-1 items-center justify-center">
                                      <input type="color" value={currentContinuousRing.gradientColor?.colors?.[0] || currentContinuousRing.color} onChange={(e) => { const colors = [...(currentContinuousRing.gradientColor?.colors || [])]; colors[0] = e.target.value; updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentContinuousRing.gradientColor?.colors?.[1] || '#4ecdc4'} onChange={(e) => { const colors = [...(currentContinuousRing.gradientColor?.colors || [])]; colors[1] = e.target.value; updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                      <span className="text-gray-500">→</span>
                                      <input type="color" value={currentContinuousRing.gradientColor?.colors?.[2] || '#ffd93d'} onChange={(e) => { const colors = [...(currentContinuousRing.gradientColor?.colors || [])]; colors[2] = e.target.value; updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colors } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                    </div>
                                    {!currentContinuousRing.streakMode?.enabled && (
                                      <>
                                        <RangeControl label="中间色位置" value={currentContinuousRing.gradientColor?.colorMidPosition ?? 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colorMidPosition: v } })} />
                                        <RangeControl label="中间色宽度" value={currentContinuousRing.gradientColor?.colorMidWidth ?? 0} min={0} max={5} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, colorMidWidth: v } })} />
                                        <select value={currentContinuousRing.gradientColor?.direction || 'radial'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, direction: e.target.value as any } })} className="w-full text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                          <option value="radial">径向（中心→外）</option>
                                          <option value="linearX">X轴线性</option>
                                          <option value="linearY">Y轴线性</option>
                                          <option value="linearZ">Z轴线性</option>
                                          <option value="linearCustom">自定义方向</option>
                                          <option value="spiral">螺旋</option>
                                        </select>
                                        {currentContinuousRing.gradientColor?.direction === 'linearCustom' && (
                                          <div className="flex gap-1 items-center text-xs">
                                            <span className="text-gray-500">方向:</span>
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.x ?? 1} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.y ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                            <input type="number" value={currentContinuousRing.gradientColor?.directionCustom?.z ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, directionCustom: { ...(currentContinuousRing.gradientColor?.directionCustom || { x: 1, y: 0, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                          </div>
                                        )}
                                        {currentContinuousRing.gradientColor?.direction === 'spiral' && (
                                          <div className="flex gap-2 items-center text-xs">
                                            <span className="text-gray-400">旋转轴</span>
                                            <select value={currentContinuousRing.gradientColor?.spiralAxis || 'y'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, spiralAxis: e.target.value as any } })} className="bg-gray-700 rounded px-1 py-0.5 text-white cursor-pointer">
                                              <option value="x">X</option>
                                              <option value="y">Y</option>
                                              <option value="z">Z</option>
                                            </select>
                                            <span className="text-gray-400">圈数</span>
                                            <input type="number" value={currentContinuousRing.gradientColor?.spiralDensity ?? 2} min={0.5} max={10} step={0.5} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, spiralDensity: parseFloat(e.target.value) || 2 } })} className="w-12 bg-gray-700 rounded px-1 text-white text-center" />
                                          </div>
                                        )}
                                        <RangeControl label="过渡强度" value={currentContinuousRing.gradientColor?.blendStrength ?? 1.0} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, blendStrength: v } })} />
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* 混色模式 */}
                                {getColorMode(currentContinuousRing.gradientColor) === 'procedural' && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">基础色</span>
                                      <input type="color" value={currentContinuousRing.color} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { color: e.target.value })} className="w-10 h-6 rounded cursor-pointer" />
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-xs text-gray-400">混色轴向</span>
                                      <select value={currentContinuousRing.gradientColor?.proceduralAxis || 'y'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, proceduralAxis: e.target.value as any } })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                        <option value="x">X轴</option>
                                        <option value="y">Y轴</option>
                                        <option value="z">Z轴</option>
                                        <option value="radial">径向</option>
                                        <option value="custom">自定义</option>
                                      </select>
                                    </div>
                                    {currentContinuousRing.gradientColor?.proceduralAxis === 'custom' && (
                                      <div className="flex gap-1 items-center text-xs">
                                        <span className="text-gray-500">轴向:</span>
                                        <input type="number" value={currentContinuousRing.gradientColor?.proceduralCustomAxis?.x ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, proceduralCustomAxis: { ...(currentContinuousRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), x: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentContinuousRing.gradientColor?.proceduralCustomAxis?.y ?? 1} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, proceduralCustomAxis: { ...(currentContinuousRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), y: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                        <input type="number" value={currentContinuousRing.gradientColor?.proceduralCustomAxis?.z ?? 0} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, proceduralCustomAxis: { ...(currentContinuousRing.gradientColor?.proceduralCustomAxis || { x: 0, y: 1, z: 0 }), z: parseFloat(e.target.value) || 0 } } })} className="w-10 bg-gray-700 rounded px-1 text-white text-center" />
                                      </div>
                                    )}
                                    <RangeControl label="渐变强度" value={currentContinuousRing.gradientColor?.proceduralIntensity ?? 1.0} min={0.1} max={5} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { gradientColor: { ...currentContinuousRing.gradientColor, proceduralIntensity: v } })} />
                                  </div>
                                )}
                              </div>

                              {/* 漩涡效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">漩涡效果</span>
                                  <button
                                    onClick={() => {
                                      const vortex = currentContinuousRing.vortex || { enabled: false, armCount: 4, twist: 2, rotationSpeed: 0.5, radialDirection: 'static' as const, radialSpeed: 0.3, hardness: 0.5, colors: ['#ff6b6b', '#4ecdc4'] };
                                      updateContinuousRing(currentContinuousRing.id, { vortex: { ...vortex, enabled: !vortex.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.vortex?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.vortex?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.vortex?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.vortex?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentContinuousRing.vortex?.enabled && (
                                  <div className="space-y-2">
                                    <RangeControl label="旋臂数量" value={currentContinuousRing.vortex?.armCount ?? 4} min={1} max={12} step={1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, armCount: v } })} />
                                    <RangeControl label="扭曲程度" value={currentContinuousRing.vortex?.twist ?? 2} min={0} max={10} step={0.5} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, twist: v } })} />
                                    <RangeControl label="旋转速度" value={currentContinuousRing.vortex?.rotationSpeed ?? 0.5} min={-2} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, rotationSpeed: v } })} />
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 text-xs">收缩方向:</span>
                                      <select value={currentContinuousRing.vortex?.radialDirection || 'static'} onChange={(e) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, radialDirection: e.target.value as 'inward' | 'outward' | 'static' } })} className="flex-1 px-2 py-1 bg-gray-700 rounded text-white text-xs cursor-pointer">
                                        <option value="static">静止</option>
                                        <option value="inward">向内收缩</option>
                                        <option value="outward">向外扩散</option>
                                      </select>
                                    </div>
                                    {currentContinuousRing.vortex?.radialDirection !== 'static' && (
                                      <RangeControl label="收缩速度" value={currentContinuousRing.vortex?.radialSpeed ?? 0.3} min={0} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, radialSpeed: v } })} />
                                    )}
                                    <RangeControl label="硬边程度" value={currentContinuousRing.vortex?.hardness ?? 0.5} min={0} max={1} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, hardness: v } })} />

                                    {/* 漩涡颜色 */}
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-gray-400 text-xs">旋臂颜色</span>
                                        {(currentContinuousRing.vortex?.colors?.length ?? 2) < 7 && (
                                          <button
                                            onClick={() => {
                                              const colors = [...(currentContinuousRing.vortex?.colors || ['#ff6b6b', '#4ecdc4'])];
                                              colors.push('#ffd93d');
                                              updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, colors } });
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                                          >
                                            + 添加
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {(currentContinuousRing.vortex?.colors || ['#ff6b6b', '#4ecdc4']).map((color, idx) => (
                                          <div key={idx} className="flex items-center gap-0.5">
                                            <input
                                              type="color"
                                              value={color}
                                              onChange={(e) => {
                                                const colors = [...(currentContinuousRing.vortex?.colors || ['#ff6b6b', '#4ecdc4'])];
                                                colors[idx] = e.target.value;
                                                updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, colors } });
                                              }}
                                              className="w-6 h-6 rounded cursor-pointer"
                                            />
                                            {(currentContinuousRing.vortex?.colors?.length ?? 2) > 2 && (
                                              <button
                                                onClick={() => {
                                                  const colors = [...(currentContinuousRing.vortex?.colors || [])];
                                                  colors.splice(idx, 1);
                                                  updateContinuousRing(currentContinuousRing.id, { vortex: { ...currentContinuousRing.vortex!, colors } });
                                                }}
                                                className="text-gray-500 hover:text-red-400 text-xs"
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 显隐效果（旋臂透明遮罩） */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">显隐效果</span>
                                  <button
                                    onClick={() => {
                                      const vis = currentContinuousRing.visibilityEffect || { enabled: false, minOpacity: 0.2, armCount: 4, twist: 5, hardness: 0.5, rotationSpeed: 0.5, radialDirection: 'none' as const, radialSpeed: 0.3 };
                                      updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...vis, enabled: !vis.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.visibilityEffect?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.visibilityEffect?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.visibilityEffect?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.visibilityEffect?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentContinuousRing.visibilityEffect?.enabled && (
                                  <div className="space-y-1">
                                    <RangeControl label="最低透明度" value={currentContinuousRing.visibilityEffect?.minOpacity ?? 0.2} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, minOpacity: v } })} />
                                    <RangeControl label="旋臂数量" value={currentContinuousRing.visibilityEffect?.armCount ?? 4} min={1} max={12} step={1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, armCount: v } })} />
                                    <RangeControl label="扭曲程度" value={currentContinuousRing.visibilityEffect?.twist ?? 5} min={0} max={20} step={0.5} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, twist: v } })} />
                                    <RangeControl label="硬边程度" value={currentContinuousRing.visibilityEffect?.hardness ?? 0.5} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, hardness: v } })} />
                                    <RangeControl label="旋转速度" value={currentContinuousRing.visibilityEffect?.rotationSpeed ?? 0.5} min={-2} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, rotationSpeed: v } })} />
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="text-[10px] text-gray-500">径向流动</span>
                                      <select
                                        value={currentContinuousRing.visibilityEffect?.radialDirection ?? 'none'}
                                        onChange={(e) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, radialDirection: e.target.value as 'none' | 'inward' | 'outward' } })}
                                        className="bg-gray-700 text-white text-[10px] rounded px-1 py-0.5"
                                      >
                                        <option value="none">无</option>
                                        <option value="inward">向内</option>
                                        <option value="outward">向外</option>
                                      </select>
                                    </div>
                                    {currentContinuousRing.visibilityEffect?.radialDirection !== 'none' && (
                                      <RangeControl label="径向速度" value={currentContinuousRing.visibilityEffect?.radialSpeed ?? 0.3} min={0} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { visibilityEffect: { ...currentContinuousRing.visibilityEffect!, radialSpeed: v } })} />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 拉丝效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">拉丝效果</span>
                                  <button
                                    onClick={() => {
                                      const streak = currentContinuousRing.streakMode || { enabled: false, flowSpeed: 0.5, stripeCount: 12, radialStretch: 8, edgeSharpness: 0.3, distortion: 0.5, noiseScale: 1.0, flowDirection: 'cw' as const, brightness: 1.5 };
                                      updateContinuousRing(currentContinuousRing.id, { streakMode: { ...streak, enabled: !streak.enabled } });
                                    }}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.streakMode?.enabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.streakMode?.enabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.streakMode?.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.streakMode?.enabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>

                                {currentContinuousRing.streakMode?.enabled && (
                                  <div className="space-y-1">
                                    <RangeControl label="流动速度" value={currentContinuousRing.streakMode?.flowSpeed ?? 0.5} min={0.1} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, flowSpeed: v } })} />
                                    <RangeControl label="条纹数量" value={currentContinuousRing.streakMode?.stripeCount ?? 12} min={4} max={30} step={1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, stripeCount: v } })} />
                                    <RangeControl label="径向拉伸" value={currentContinuousRing.streakMode?.radialStretch ?? 8} min={1} max={20} step={1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, radialStretch: v } })} />
                                    <RangeControl label="脊线锐度" value={currentContinuousRing.streakMode?.edgeSharpness ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, edgeSharpness: v } })} />
                                    <RangeControl label="扭曲强度" value={currentContinuousRing.streakMode?.distortion ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, distortion: v } })} />
                                    <RangeControl label="噪声缩放" value={currentContinuousRing.streakMode?.noiseScale ?? 1.0} min={0.5} max={3} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, noiseScale: v } })} />
                                    <RangeControl label="整体亮度" value={currentContinuousRing.streakMode?.brightness ?? 1.5} min={0.5} max={3} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, brightness: v } })} />
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-gray-500">流动方向</span>
                                      <select
                                        value={currentContinuousRing.streakMode?.flowDirection ?? 'cw'}
                                        onChange={(e) => updateContinuousRing(currentContinuousRing.id, { streakMode: { ...currentContinuousRing.streakMode!, flowDirection: e.target.value as 'cw' | 'ccw' } })}
                                        className="bg-gray-700 text-white text-[10px] rounded px-1 py-0.5"
                                      >
                                        <option value="cw">顺时针</option>
                                        <option value="ccw">逆时针</option>
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 波动效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">波动效果</span>
                                  <button
                                    onClick={() => updateContinuousRing(currentContinuousRing.id, { wobbleEnabled: !currentContinuousRing.wobbleEnabled })}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.wobbleEnabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.wobbleEnabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.wobbleEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.wobbleEnabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>
                                {currentContinuousRing.wobbleEnabled && (
                                  <div className="space-y-1">
                                    <RangeControl label="波动频率" value={currentContinuousRing.wobbleFrequency ?? 6} min={1} max={20} step={1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { wobbleFrequency: v })} />
                                    <RangeControl label="波动幅度" value={currentContinuousRing.wobbleAmplitude ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { wobbleAmplitude: v })} />
                                    <RangeControl label="波动速度" value={currentContinuousRing.wobbleSpeed ?? 1.0} min={0.1} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { wobbleSpeed: v })} />
                                  </div>
                                )}
                              </div>

                              {/* Z轴抖动 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">Z轴抖动</span>
                                  <button
                                    onClick={() => updateContinuousRing(currentContinuousRing.id, { zDriftEnabled: !currentContinuousRing.zDriftEnabled })}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.zDriftEnabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.zDriftEnabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.zDriftEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.zDriftEnabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>
                                {currentContinuousRing.zDriftEnabled && (
                                  <div className="space-y-1">
                                    <RangeControl label="抖动幅度" value={currentContinuousRing.zDriftScale ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { zDriftScale: v })} />
                                    <RangeControl label="抖动速度" value={currentContinuousRing.zDriftSpeed ?? 0.5} min={0.1} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { zDriftSpeed: v })} />
                                  </div>
                                )}
                              </div>

                              {/* 菲涅尔边缘发光 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">边缘发光</span>
                                  <button
                                    onClick={() => updateContinuousRing(currentContinuousRing.id, { fresnelEnabled: !currentContinuousRing.fresnelEnabled })}
                                    className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                                    style={{
                                      background: currentContinuousRing.fresnelEnabled
                                        ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                        : 'rgba(120, 120, 120, 0.3)',
                                      backdropFilter: 'blur(8px)',
                                      border: currentContinuousRing.fresnelEnabled
                                        ? '1px solid var(--ui-secondary)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                      color: currentContinuousRing.fresnelEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                                    }}
                                  >
                                    {currentContinuousRing.fresnelEnabled ? '已启用' : '已禁用'}
                                  </button>
                                </div>
                                {currentContinuousRing.fresnelEnabled && (
                                  <div className="space-y-1">
                                    <RangeControl label="菲涅尔指数" value={currentContinuousRing.fresnelPower ?? 2.0} min={0.5} max={5} step={0.25} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { fresnelPower: v })} />
                                    <RangeControl label="发光亮度" value={currentContinuousRing.fresnelIntensity ?? 1.0} min={0} max={3} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { fresnelIntensity: v })} />
                                  </div>
                                )}
                              </div>

                              {/* 运动速度 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动速度</span>
                                <RangeControl label="公转速度" value={currentContinuousRing.orbitSpeed} min={-2} max={2} step={0.02} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { orbitSpeed: v })} />
                                <RangeControl label="自转速度" value={currentContinuousRing.rotationSpeed ?? 0.1} min={-2} max={2} step={0.1} onChange={(v) => updateContinuousRing(currentContinuousRing.id, { rotationSpeed: v })} />
                              </div>

                              {/* 姿态设置 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>姿态设置</span>
                                <TiltAxisSelector tilt={currentContinuousRing.tilt ?? DEFAULT_TILT_SETTINGS} onChange={(tilt) => updateContinuousRing(currentContinuousRing.id, { tilt })} getButtonStyle={getOptionButtonStyle} />
                                <OrbitAxisSelector orbitAxis={currentContinuousRing.orbitAxis ?? DEFAULT_ORBIT_AXIS_SETTINGS} onChange={(orbitAxis) => updateContinuousRing(currentContinuousRing.id, { orbitAxis })} getButtonStyle={getOptionButtonStyle} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ===== 螺旋环 Tab ===== */}
                      {ringSubTab === 'spiral' && (() => {
                        const flameSystem = planet.flameSystem || DEFAULT_FLAME_SYSTEM;
                        const spiralFlames = flameSystem.spiralFlames || [];
                        // 使用选中状态
                        const effectiveSpiralId = selectedSpiralFlameId && spiralFlames.find(s => s.id === selectedSpiralFlameId)
                          ? selectedSpiralFlameId
                          : spiralFlames[0]?.id || null;
                        const currentSpiral = spiralFlames.find(s => s.id === effectiveSpiralId);

                        const updateSpiral = (id: string, updates: Partial<SpiralFlameSettings>) => {
                          const updated = spiralFlames.map(s => s.id === id ? { ...s, ...updates } : s);
                          updatePlanet({ flameSystem: { ...flameSystem, spiralFlames: updated } });
                        };

                        const addSpiral = (presetId: string) => {
                          const preset = SPIRAL_FLAME_PRESETS[presetId as keyof typeof SPIRAL_FLAME_PRESETS] || {};
                          const name = presetId === 'tornado' ? '龙卷风' : presetId === 'galaxy' ? '星系旋臂' : presetId === 'dna' ? 'DNA螺旋' : presetId === 'vortex' ? '漩涡' : '自定义';
                          const id = `spiral_${Date.now()}`;
                          const newSpiral: SpiralFlameSettings = { ...createDefaultSpiralFlame(id, `${name} ${spiralFlames.length + 1}`), ...preset, enabled: true };
                          updatePlanet({ flameSystem: { ...flameSystem, spiralFlames: [...spiralFlames, newSpiral] } });
                          setSelectedSpiralFlameId(id);
                        };

                        return (
                          <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                            <FloatingListSelector items={spiralFlames.map(s => ({ id: s.id, name: s.name, enabled: s.enabled }))} selectedId={effectiveSpiralId} onSelect={(id) => setSelectedSpiralFlameId(id)} onToggleEnabled={(id, e) => updateSpiral(id, { enabled: e })} onRename={(id, n) => updateSpiral(id, { name: n })} onDelete={(id) => { updatePlanet({ flameSystem: { ...flameSystem, spiralFlames: spiralFlames.filter(s => s.id !== id) } }); if (effectiveSpiralId === id) setSelectedSpiralFlameId(null); }} onCopy={(id) => { const source = spiralFlames.find(s => s.id === id); if (source) { const newId = `spiral_${Date.now()}`; const copy = { ...source, id: newId, name: `${source.name} 副本` }; updatePlanet({ flameSystem: { ...flameSystem, spiralFlames: [...spiralFlames, copy] } }); setSelectedSpiralFlameId(newId); } }} onAdd={() => addSpiral('custom')} globalEnabled={spiralEnabled} onGlobalToggle={(e) => updatePlanet({ flameSystem: { ...flameSystem, spiralFlamesEnabled: e } })} soloId={soloSpiralFlameId} onSoloToggle={setSoloSpiralFlameId} title="螺旋环" titleStyle={{ color: 'var(--ui-secondary)' }} addButtonColor="bg-blue-600 hover:bg-blue-500" emptyText="暂无螺旋环" />

                            <PresetListBox
                              storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.spiralFlame)}
                              builtInPresets={Object.entries(SPIRAL_FLAME_PRESETS).filter(([id]) => id !== 'custom').map(([id, data]) => ({
                                id,
                                name: {
                                  geneHelix: '基因螺旋', phoenixRise: '凤凰升腾', hurricaneEye: '飓风之眼',
                                  shadowThorns: '暗影荆棘', galaxySpiral: '星河旋臂', energyDrill: '能量钻头'
                                }[id] || id,
                                data
                              }))}
                              currentData={currentSpiral ? { ...currentSpiral, id: undefined, name: undefined, enabled: undefined } : null}
                              hasInstance={!!currentSpiral}
                              instanceName="螺旋环"
                              onApplyToInstance={(data) => {
                                if (currentSpiral) {
                                  updateSpiral(currentSpiral.id, { ...data });
                                }
                              }}
                              onCreateInstance={(data, presetName) => {
                                const count = spiralFlames.length + 1;
                                const id = `spiral_${Date.now()}`;
                                const newSpiral: SpiralFlameSettings = { ...createDefaultSpiralFlame(id, `${presetName.replace(/^[^\s]+\s/, '')} ${count}`), ...data, enabled: true };
                                updatePlanet({ flameSystem: { ...flameSystem, spiralFlames: [...spiralFlames, newSpiral] } });
                                setSelectedSpiralFlameId(id);
                              }}
                              title="预设"
                              accentColor="blue"
                              moduleName="spiralFlame"
                            />

                            {currentSpiral && (<>
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentSpiral.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.spiralFlame)}
                                  currentData={currentSpiral}
                                  defaultName={currentSpiral.name}
                                  accentColor="blue"
                                />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>螺旋结构</span>
                                <RangeControl label="螺旋条数" value={currentSpiral.spiralCount} min={1} max={6} step={1} onChange={(v) => updateSpiral(currentSpiral.id, { spiralCount: v })} />
                                <div className="grid grid-cols-3 gap-1">
                                  {[{ id: 'cw', l: '顺时针' }, { id: 'ccw', l: '逆时针' }, { id: 'both', l: '双向' }].map(d => (
                                    <button key={d.id} onClick={() => updateSpiral(currentSpiral.id, { direction: d.id as any })} className="px-1 py-0.5 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(currentSpiral.direction === d.id)}>{d.l}</button>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>几何参数</span>
                                <RangeControl label="起始半径" value={currentSpiral.startRadius} min={1.0} max={3.0} step={0.05} onChange={(v) => updateSpiral(currentSpiral.id, { startRadius: v })} />
                                <RangeControl label="终止半径" value={currentSpiral.endRadius} min={1.0} max={3.0} step={0.05} onChange={(v) => updateSpiral(currentSpiral.id, { endRadius: v })} />
                                <RangeControl label="螺旋高度" value={currentSpiral.height} min={50} max={500} step={10} onChange={(v) => updateSpiral(currentSpiral.id, { height: v })} />
                                <RangeControl label="螺距" value={currentSpiral.pitch} min={0.1} max={2} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { pitch: v })} />
                                <RangeControl label="带宽" value={currentSpiral.thickness} min={0.02} max={0.3} step={0.01} onChange={(v) => updateSpiral(currentSpiral.id, { thickness: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>动态参数</span>
                                <RangeControl label="旋转速度" value={currentSpiral.rotationSpeed} min={0} max={3} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { rotationSpeed: v })} />
                                <RangeControl label="上升速度" value={currentSpiral.riseSpeed} min={-1} max={2} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { riseSpeed: v })} />
                                <RangeControl label="粒子数量" value={currentSpiral.particleCount} min={200} max={3000} step={100} onChange={(v) => updateSpiral(currentSpiral.id, { particleCount: v })} />
                                <RangeControl label="粒子大小" value={currentSpiral.particleSize ?? 4} min={1} max={10} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { particleSize: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>视觉效果</span>
                                <RangeControl label="透明度" value={currentSpiral.opacity} min={0} max={1} step={0.05} onChange={(v) => updateSpiral(currentSpiral.id, { opacity: v })} />
                                <RangeControl label="发光强度" value={currentSpiral.emissive} min={0} max={5} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { emissive: v })} />
                                <RangeControl label="Bloom增强" value={currentSpiral.bloomBoost} min={0} max={3} step={0.1} onChange={(v) => updateSpiral(currentSpiral.id, { bloomBoost: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色设置</span>
                                {(() => {
                                  const sc = (currentSpiral.color || { mode: 'twoColor' as const, baseColor: '#9900ff', colors: ['#9900ff', '#ff00ff'], colorMidPosition: 0.5, proceduralIntensity: 1.0, direction: 'linearY', directionCustom: { x: 1, y: 0, z: 0 }, spiralDensity: 2 } as any) as import('../types').SolidCoreColorSettings;
                                  const updateSpiralColor = (u: Partial<typeof sc>) => updateSpiral(currentSpiral.id, { color: { ...sc, ...u } as any });
                                  return (<>
                                    <div className="grid grid-cols-4 gap-1 mb-2">
                                      {[{ id: 'none', l: '单色' }, { id: 'twoColor', l: '双色' }, { id: 'threeColor', l: '三色' }, { id: 'procedural', l: '混色' }].map(m => (
                                        <button key={m.id} onClick={() => updateSpiralColor({ mode: m.id as any })} className="px-1 py-0.5 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(sc.mode === m.id)}>{m.l}</button>
                                      ))}
                                    </div>
                                    {sc.mode === 'none' && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">基础色</span><input type="color" value={sc.baseColor || '#9900ff'} onChange={(e) => updateSpiralColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" /></div>}
                                    {sc.mode === 'twoColor' && <><div className="flex gap-2 items-center justify-center"><input type="color" value={sc.colors?.[0] || '#9900ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[0] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-10 h-6 rounded cursor-pointer" /><span className="text-gray-400">→</span><input type="color" value={sc.colors?.[1] || '#ff00ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[1] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-10 h-6 rounded cursor-pointer" /></div><div className="flex gap-2 items-center mt-1"><span className="text-xs text-gray-400">渐变方向</span><select value={sc.direction || 'linearY'} onChange={(e) => updateSpiralColor({ direction: e.target.value as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer"><option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option></select></div></>}
                                    {sc.mode === 'threeColor' && <><div className="flex gap-1 items-center justify-center"><input type="color" value={sc.colors?.[0] || '#0088ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[0] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><span className="text-gray-500">→</span><input type="color" value={sc.colors?.[1] || '#9900ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[1] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><span className="text-gray-500">→</span><input type="color" value={sc.colors?.[2] || '#ff00ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[2] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /></div><RangeControl label="中间色位置" value={sc.colorMidPosition || 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateSpiralColor({ colorMidPosition: v })} /><div className="flex gap-2 items-center"><span className="text-xs text-gray-400">渐变方向</span><select value={sc.direction || 'linearY'} onChange={(e) => updateSpiralColor({ direction: e.target.value as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer"><option value="radial">径向</option><option value="linearX">X轴</option><option value="linearY">Y轴</option><option value="linearZ">Z轴</option><option value="spiral">螺旋</option></select></div></>}
                                    {sc.mode === 'procedural' && <><div className="flex gap-2 items-center justify-center"><input type="color" value={sc.colors?.[0] || '#9900ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[0] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><input type="color" value={sc.colors?.[1] || '#00ffff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[1] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><input type="color" value={sc.colors?.[2] || '#ff00ff'} onChange={(e) => { const c = [...(sc.colors || [])]; c[2] = e.target.value; updateSpiralColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /></div><RangeControl label="混色强度" value={sc.proceduralIntensity || 1.0} min={0.1} max={3} step={0.1} onChange={(v) => updateSpiralColor({ proceduralIntensity: v })} /></>}
                                  </>);
                                })()}
                              </div>

                            </>)}
                          </div>
                        );
                      })()}
                    </ControlGroup >
                  );
                })()}

                {/* ===== 残影 子Tab ===== */}
                {planetSubTab === 'afterimage' && (() => {
                  // 新版残影系统
                  const afterimageSystem = planet.afterimageSystem || DEFAULT_AFTERIMAGE_SYSTEM;
                  const zones = afterimageSystem.zones || [];
                  // 使用选中状态
                  const effectiveSelectedZoneId = selectedAfterimageZoneId && zones.find(z => z.id === selectedAfterimageZoneId)
                    ? selectedAfterimageZoneId
                    : zones[0]?.id || null;
                  const currentZone = zones.find(z => z.id === effectiveSelectedZoneId);
                  const particles = afterimageSystem.particles;
                  const texture = afterimageSystem.texture;

                  // 构建核心选项列表
                  const coreOptions: { id: string; name: string; type: 'particle' | 'solid' }[] = [];
                  planet.coreSystem.cores.forEach(c => {
                    if (c.enabled) coreOptions.push({ id: c.id, name: c.name, type: 'particle' });
                  });
                  (planet.coreSystem.solidCores || []).forEach(c => {
                    if (c.enabled) coreOptions.push({ id: c.id, name: c.name, type: 'solid' });
                  });

                  const updateAfterimage = (updates: Partial<AfterimageSystemSettings>) => {
                    updatePlanet({ afterimageSystem: { ...afterimageSystem, ...updates } });
                  };

                  const updateZone = (id: string, updates: Partial<AfterimageZoneSettings>) => {
                    const updated = zones.map(z => z.id === id ? { ...z, ...updates } : z);
                    updateAfterimage({ zones: updated });
                  };

                  const addZone = () => {
                    const newZone = createDefaultAfterimageZone(`zone_${Date.now()}`, `区域 ${zones.length + 1}`);
                    updateAfterimage({ zones: [...zones, newZone] });
                  };

                  return (
                    <ControlGroup title="残影系统" rightContent={
                      <button
                        onClick={() => updateAfterimage({ enabled: !afterimageSystem.enabled })}
                        className="px-2 py-1 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: afterimageSystem.enabled
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: afterimageSystem.enabled
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: afterimageSystem.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {afterimageSystem.enabled ? '已启用' : '已禁用'}
                      </button>
                    }>
                      <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                        {/* 绑定核心选择 */}
                        {coreOptions.length > 0 && (
                          <div className="mb-3 p-2 bg-gray-800/50 rounded">
                            <span className="text-xs text-gray-400 block mb-1">绑定核心</span>
                            <select
                              value={afterimageSystem.bindToCoreId || ''}
                              onChange={(e) => updateAfterimage({ bindToCoreId: e.target.value || undefined })}
                              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5"
                            >
                              <option value="">自动（第一个启用的核心）</option>
                              {coreOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name} ({opt.type === 'particle' ? '粒子' : '实体'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* 区域列表 */}
                        <FloatingListSelector
                          items={zones.map(z => ({ id: z.id, name: z.name, enabled: z.enabled }))}
                          selectedId={effectiveSelectedZoneId}
                          onSelect={(id) => setSelectedAfterimageZoneId(id)}
                          onToggleEnabled={(id, e) => updateZone(id, { enabled: e })}
                          onRename={(id, n) => updateZone(id, { name: n })}
                          onDelete={(id) => {
                            updateAfterimage({ zones: zones.filter(z => z.id !== id) });
                            if (effectiveSelectedZoneId === id) setSelectedAfterimageZoneId(null);
                          }}
                          onCopy={(id) => {
                            const source = zones.find(z => z.id === id);
                            if (source) {
                              const newId = `zone_${Date.now()}`;
                              const copy = { ...source, id: newId, name: `${source.name} 副本` };
                              updateAfterimage({ zones: [...zones, copy] });
                              setSelectedAfterimageZoneId(newId);
                            }
                          }}
                          onAdd={addZone}
                          title="区域"
                          titleStyle={{ color: 'var(--ui-secondary)' }}
                          addButtonColor="bg-blue-600 hover:bg-blue-500"
                          emptyText="暂无区域"
                        />

                        {/* 子Tab 切换 - 使用subModuleTabs材质配置 */}
                        <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                          {[
                            { key: 'texture' as const, label: '流动纹理', color: '#a855f7' },
                            { key: 'particles' as const, label: '发散粒子', color: '#ec4899' }
                          ].map(tab => {
                            const isActive = afterimageSubTab === tab.key;
                            const subConfig = materialSettings?.subModuleTabs?.afterimage || createDefaultMaterialConfig('glass');
                            const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                            return (
                              <button
                                key={tab.key}
                                onClick={() => setAfterimageSubTab(tab.key)}
                                className="flex-1 py-1.5 px-2 text-xs rounded transition-all duration-200"
                                style={materialStyle}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* 流动纹理/发散粒子 标题行（带启用/禁用） */}
                        {afterimageSubTab === 'texture' && (
                          <div className="flex items-center justify-between mb-2 p-1.5 bg-slate-600/30 rounded">
                            <span className="text-xs text-slate-300 font-medium">流动纹理</span>
                            <button
                              onClick={() => updateAfterimage({ texture: { ...texture, enabled: !texture.enabled } })}
                              className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                              style={{
                                background: texture.enabled
                                  ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                  : 'rgba(120, 120, 120, 0.3)',
                                backdropFilter: 'blur(8px)',
                                border: texture.enabled
                                  ? '1px solid var(--ui-secondary)'
                                  : '1px solid rgba(255,255,255,0.1)',
                                color: texture.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                              }}
                            >
                              {texture.enabled ? '已启用' : '已禁用'}
                            </button>
                          </div>
                        )}
                        {afterimageSubTab === 'particles' && (
                          <div className="flex items-center justify-between mb-2 p-1.5 bg-slate-600/30 rounded">
                            <span className="text-xs text-slate-300 font-medium">发散粒子</span>
                            <button
                              onClick={() => updateAfterimage({ particles: { ...particles, enabled: !particles.enabled } })}
                              className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                              style={{
                                background: particles.enabled
                                  ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                                  : 'rgba(120, 120, 120, 0.3)',
                                backdropFilter: 'blur(8px)',
                                border: particles.enabled
                                  ? '1px solid var(--ui-secondary)'
                                  : '1px solid rgba(255,255,255,0.1)',
                                color: particles.enabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                              }}
                            >
                              {particles.enabled ? '已启用' : '已禁用'}
                            </button>
                          </div>
                        )}

                        {/* 预设列表 */}
                        {afterimageSubTab === 'texture' && (
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.afterimageTexture)}
                            builtInPresets={[
                              { id: 'flow', name: '流体纹理', data: AFTERIMAGE_TEXTURE_PRESETS.flow },
                              { id: 'energy', name: '能量场', data: AFTERIMAGE_TEXTURE_PRESETS.energy },
                              { id: 'ghostly', name: '幽冥雾', data: AFTERIMAGE_TEXTURE_PRESETS.ghostly },
                              { id: 'cyberGrid', name: '赛博网格', data: AFTERIMAGE_TEXTURE_PRESETS.cyberGrid },
                              { id: 'plasmaRipples', name: '等离子波', data: AFTERIMAGE_TEXTURE_PRESETS.plasmaRipples },
                              { id: 'voidTendrils', name: '虚空触须', data: AFTERIMAGE_TEXTURE_PRESETS.voidTendrils }
                            ]}
                            currentData={texture}
                            hasInstance={true}
                            instanceName="流动纹理"
                            onApplyToInstance={(data) => updateAfterimage({ texture: { ...texture, ...data } })}
                            onCreateInstance={(data) => updateAfterimage({ texture: { ...texture, ...data, enabled: true } })}
                            title="预设"
                            accentColor="purple"
                            moduleName="afterimageTexture"
                          />
                        )}
                        {afterimageSubTab === 'particles' && (
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.afterimageParticle)}
                            builtInPresets={[
                              { id: 'spark', name: '火星四溅', data: AFTERIMAGE_PARTICLE_PRESETS.spark },
                              { id: 'dust', name: '星尘飘散', data: AFTERIMAGE_PARTICLE_PRESETS.dust },
                              { id: 'explosion', name: '爆发粒子', data: AFTERIMAGE_PARTICLE_PRESETS.explosion },
                              { id: 'softMist', name: '柔雾', data: AFTERIMAGE_PARTICLE_PRESETS.softMist },
                              { id: 'warpStars', name: '跃迁星流', data: AFTERIMAGE_PARTICLE_PRESETS.warpStars },
                              { id: 'quantumFoam', name: '量子泡沫', data: AFTERIMAGE_PARTICLE_PRESETS.quantumFoam }
                            ]}
                            currentData={particles}
                            hasInstance={true}
                            instanceName="发散粒子"
                            onApplyToInstance={(data) => updateAfterimage({ particles: { ...particles, ...data } })}
                            onCreateInstance={(data) => updateAfterimage({ particles: { ...particles, ...data, enabled: true } })}
                            title="预设"
                            accentColor="purple"
                            moduleName="afterimageParticle"
                          />
                        )}

                        {currentZone && (<>
                          <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                            backdropFilter: 'blur(8px)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentZone.name}</span>
                            {afterimageSubTab === 'texture' && (
                              <SavePresetButton
                                storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.afterimageTexture)}
                                currentData={texture}
                                defaultName="我的纹理"
                                accentColor="purple"
                              />
                            )}
                            {afterimageSubTab === 'particles' && (
                              <SavePresetButton
                                storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.afterimageParticle)}
                                currentData={particles}
                                defaultName="我的粒子"
                                accentColor="purple"
                              />
                            )}
                          </div>

                          {/* 区域形状（共用，不折叠）*/}
                          <div className="p-2 bg-gray-800/50 rounded mb-2">
                            <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>区域形状</span>
                            <RangeControl label="起始角度" value={currentZone.startAngle} min={0} max={360} step={5} onChange={(v) => updateZone(currentZone.id, { startAngle: v })} />
                            <RangeControl label="角度跨度" value={currentZone.angleSpan} min={10} max={360} step={5} onChange={(v) => updateZone(currentZone.id, { angleSpan: v })} />

                            <div className="mt-2">
                              <span className="text-xs text-gray-500 block mb-1">侧边类型</span>
                              <div className="grid grid-cols-2 gap-1 mb-2">
                                <button onClick={() => updateZone(currentZone.id, { sideLineType: 'straight' })} className="px-2 py-1 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(currentZone.sideLineType === 'straight')}>直线</button>
                                <button onClick={() => updateZone(currentZone.id, { sideLineType: 'curve' })} className="px-2 py-1 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(currentZone.sideLineType === 'curve')}>曲线</button>
                              </div>
                            </div>

                            <RangeControl label="侧边长度" value={currentZone.sideLineLength} min={0.5} max={5} step={0.1} onChange={(v) => updateZone(currentZone.id, { sideLineLength: v })} />
                            <RangeControl label="发散角度" value={currentZone.sideLineAngle} min={45} max={135} step={5} onChange={(v) => updateZone(currentZone.id, { sideLineAngle: v })} />
                            <div className="flex justify-between text-[10px] text-gray-500 -mt-1 mb-1">
                              <span>向内收</span><span>90°垂直</span><span>向外散</span>
                            </div>

                            {currentZone.sideLineType === 'curve' && (<>
                              <div className="grid grid-cols-2 gap-1 mt-2 mb-1">
                                <button onClick={() => updateZone(currentZone.id, { curveBendDirection: 'inward' })} className="px-2 py-1 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(currentZone.curveBendDirection === 'inward')}>凹</button>
                                <button onClick={() => updateZone(currentZone.id, { curveBendDirection: 'outward' })} className="px-2 py-1 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(currentZone.curveBendDirection === 'outward')}>凸</button>
                              </div>
                              <RangeControl label="弯曲强度" value={currentZone.curveBendStrength} min={0} max={1} step={0.1} onChange={(v) => updateZone(currentZone.id, { curveBendStrength: v })} />
                            </>)}
                          </div>
                        </>)}

                        {/* ===== 流动纹理 Tab ===== */}
                        {afterimageSubTab === 'texture' && (<>
                          {/* 参数内容（禁用时只读） */}
                          <div className={`p-2 bg-gray-800/50 rounded mb-2 ${!texture.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <RangeControl label="透明度" value={texture.opacity ?? 0.8} min={0} max={1} step={0.05} onChange={(v) => updateAfterimage({ texture: { ...texture, opacity: v } })} />

                            <div className="mt-2">
                              <span className="text-xs text-gray-500 block mb-1">颜色渐变（暗→亮）</span>
                              <div className="flex gap-2 items-center justify-center">
                                <input type="color" value={texture.colors?.[0] || '#ff00ff'} onChange={(e) => { const c = [...(texture.colors || ['#ff00ff', '#ff66ff', '#ffffff'])]; c[0] = e.target.value; updateAfterimage({ texture: { ...texture, colors: c } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                <span className="text-gray-500">→</span>
                                <input type="color" value={texture.colors?.[1] || '#ff66ff'} onChange={(e) => { const c = [...(texture.colors || ['#ff00ff', '#ff66ff', '#ffffff'])]; c[1] = e.target.value; updateAfterimage({ texture: { ...texture, colors: c } }); }} className="w-8 h-6 rounded cursor-pointer" />
                                <span className="text-gray-500">→</span>
                                <input type="color" value={texture.colors?.[2] || '#ffffff'} onChange={(e) => { const c = [...(texture.colors || ['#ff00ff', '#ff66ff', '#ffffff'])]; c[2] = e.target.value; updateAfterimage({ texture: { ...texture, colors: c } }); }} className="w-8 h-6 rounded cursor-pointer" />
                              </div>
                            </div>

                            {/* 纹理模式选择 */}
                            <div className="mt-3 pt-2 border-t border-gray-700">
                              <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>纹理模式</span>
                              <select
                                value={texture.textureMode || 'flow'}
                                onChange={(e) => updateAfterimage({ texture: { ...texture, textureMode: e.target.value as 'flow' | 'energy' } })}
                                className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5 mb-2"
                              >
                                <option value="flow">流动纹理</option>
                                <option value="energy">能量罩</option>
                              </select>
                            </div>

                            {/* 流动纹理模式参数 */}
                            {(texture.textureMode || 'flow') === 'flow' && (
                              <div className="mt-2">
                                <RangeControl label="流动速度" value={texture.flowSpeed ?? 0.5} min={0.1} max={2} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, flowSpeed: v } })} />
                                <RangeControl label="噪声缩放" value={texture.noiseScale ?? 1.0} min={0.5} max={3} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, noiseScale: v } })} />
                                <RangeControl label="拉伸因子" value={texture.stretchFactor ?? 2.0} min={0.2} max={5} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, stretchFactor: v } })} />

                                {/* 拉丝条纹效果 */}
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <span className="text-xs text-gray-500 block mb-2">拉丝条纹</span>
                                  <RangeControl label="条纹强度" value={texture.stripeIntensity ?? 0} min={0} max={1} step={0.02} onChange={(v) => updateAfterimage({ texture: { ...texture, stripeIntensity: v } })} />

                                  {(texture.stripeIntensity ?? 0) > 0 && (<>
                                    <RangeControl label="条纹密度" value={texture.stripeCount ?? 8} min={1} max={50} step={1} onChange={(v) => updateAfterimage({ texture: { ...texture, stripeCount: v } })} />
                                    <RangeControl label="径向拉伸" value={texture.directionalStretch ?? 1} min={1} max={50} step={1} onChange={(v) => updateAfterimage({ texture: { ...texture, directionalStretch: v } })} />
                                    <RangeControl label="脊线锐度" value={texture.edgeSharpness ?? 0} min={0} max={1} step={0.02} onChange={(v) => updateAfterimage({ texture: { ...texture, edgeSharpness: v } })} />
                                    <RangeControl label="扭曲强度" value={texture.distortion ?? 0} min={0} max={2} step={0.05} onChange={(v) => updateAfterimage({ texture: { ...texture, distortion: v } })} />
                                  </>)}
                                </div>
                              </div>
                            )}

                            {/* 能量罩模式参数 */}
                            {texture.textureMode === 'energy' && (
                              <div className="mt-2">
                                <RangeControl label="火团缩放" value={texture.energyFlameScale ?? 2.0} min={0.5} max={5} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, energyFlameScale: v } })} />
                                <RangeControl label="火团密度" value={texture.energyDensity ?? 0.5} min={0} max={1} step={0.05} onChange={(v) => updateAfterimage({ texture: { ...texture, energyDensity: v } })} />
                                <RangeControl label="流动速度" value={texture.energyFlowSpeed ?? 0.5} min={0.1} max={3} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, energyFlowSpeed: v } })} />
                                <RangeControl label="湍流强度" value={texture.energyTurbulence ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, energyTurbulence: v } })} />

                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 block mb-1">噪声类型</span>
                                  <select
                                    value={texture.energyNoiseType || 'simplex'}
                                    onChange={(e) => updateAfterimage({ texture: { ...texture, energyNoiseType: e.target.value as 'simplex' | 'voronoi' } })}
                                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
                                  >
                                    <option value="simplex">Simplex</option>
                                    <option value="voronoi">Voronoi</option>
                                  </select>
                                </div>

                                <RangeControl label="分形层数" value={texture.energyFractalLayers ?? 3} min={1} max={5} step={1} onChange={(v) => updateAfterimage({ texture: { ...texture, energyFractalLayers: v } })} />

                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 block mb-1">动画方向</span>
                                  <select
                                    value={texture.energyDirection || 'up'}
                                    onChange={(e) => updateAfterimage({ texture: { ...texture, energyDirection: e.target.value as 'up' | 'spiral' } })}
                                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1"
                                  >
                                    <option value="up">向上</option>
                                    <option value="spiral">螺旋</option>
                                  </select>
                                </div>

                                {/* 脉冲效果 */}
                                <div className="mt-2 pt-2 border-t border-gray-600">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">脉冲效果</span>
                                    <button
                                      onClick={() => updateAfterimage({ texture: { ...texture, energyPulseEnabled: !texture.energyPulseEnabled } })}
                                      className={`px-2 py-0.5 text-[10px] rounded ${texture.energyPulseEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                    >
                                      {texture.energyPulseEnabled ? '开' : '关'}
                                    </button>
                                  </div>
                                  {texture.energyPulseEnabled && (<>
                                    <RangeControl label="脉冲速度" value={texture.energyPulseSpeed ?? 1.0} min={0.5} max={3} step={0.1} onChange={(v) => updateAfterimage({ texture: { ...texture, energyPulseSpeed: v } })} />
                                    <RangeControl label="脉冲强度" value={texture.energyPulseIntensity ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => updateAfterimage({ texture: { ...texture, energyPulseIntensity: v } })} />
                                  </>)}
                                </div>
                              </div>
                            )}
                          </div>
                        </>)}

                        {/* ===== 发散粒子 Tab ===== */}
                        {afterimageSubTab === 'particles' && (<>
                          {/* 参数内容（禁用时只读） */}
                          <div className={`p-2 bg-gray-800/50 rounded mb-2 ${!particles.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <RangeControl label="发散速度" value={particles.speed} min={0.5} max={5} step={0.1} onChange={(v) => updateAfterimage({ particles: { ...particles, speed: v } })} />
                            <RangeControl label="速度随机" value={particles.speedRandomness} min={0} max={0.5} step={0.05} onChange={(v) => updateAfterimage({ particles: { ...particles, speedRandomness: v } })} />
                            <RangeControl label="粒子密度" value={particles.density} min={10} max={500} step={10} onChange={(v) => updateAfterimage({ particles: { ...particles, density: v } })} />
                            <RangeControl label="粒子大小" value={particles.size} min={1} max={20} step={1} onChange={(v) => updateAfterimage({ particles: { ...particles, size: v } })} />
                            <RangeControl label="生命周期" value={particles.lifespan} min={0.5} max={5} step={0.1} onChange={(v) => updateAfterimage({ particles: { ...particles, lifespan: v } })} />

                            <div className="mt-2">
                              <span className="text-xs text-gray-500 block mb-1">大小衰减</span>
                              <div className="grid grid-cols-3 gap-1">
                                {[{ id: 'none', l: '无' }, { id: 'linear', l: '线性' }, { id: 'exponential', l: '指数' }].map(m => (
                                  <button key={m.id} onClick={() => updateAfterimage({ particles: { ...particles, sizeDecay: m.id as any } })} className="px-1 py-0.5 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(particles.sizeDecay === m.id)}>{m.l}</button>
                                ))}
                              </div>
                            </div>

                            <div className="mt-2">
                              <span className="text-xs text-gray-500 block mb-1">颜色</span>
                              <div className="flex gap-2 items-center justify-center">
                                <input type="color" value={particles.colors[0] || '#ff4400'} onChange={(e) => { const c = [...particles.colors]; c[0] = e.target.value; updateAfterimage({ particles: { ...particles, colors: c } }); }} className="w-10 h-6 rounded cursor-pointer" />
                                <span className="text-gray-400">→</span>
                                <input type="color" value={particles.colors[1] || '#ffff00'} onChange={(e) => { const c = [...particles.colors]; c[1] = e.target.value; updateAfterimage({ particles: { ...particles, colors: c } }); }} className="w-10 h-6 rounded cursor-pointer" />
                              </div>
                            </div>
                          </div>
                        </>)}
                      </div>
                    </ControlGroup>
                  );
                })()}

                {/* ===== 法阵 子Tab ===== */}
                {planetSubTab === 'magicCircle' && (() => {
                  return <MagicCircleControl planet={planet} updatePlanet={updatePlanet} getButtonStyle={getOptionButtonStyle} />;
                })()}

                {/* ===== 能量体 子Tab ===== */}
                {planetSubTab === 'energyBody' && (() => {
                  // 如果没有能量体，自动创建一个默认实例
                  let energyBodies = planet.energyBodySystem?.energyBodies || [];
                  if (energyBodies.length === 0) {
                    const defaultId = 'default-energy-body';
                    const defaultEB = createDefaultEnergyBody(defaultId, '能量体 1');
                    energyBodies = [defaultEB];
                    // 延迟更新以避免渲染循环
                    setTimeout(() => {
                      updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: [defaultEB] } });
                    }, 0);
                  }

                  const effectiveSelectedEnergyBodyId = selectedEnergyBodyId && energyBodies.find(e => e.id === selectedEnergyBodyId)
                    ? selectedEnergyBodyId
                    : energyBodies[0]?.id || null;
                  const currentEnergyBody = energyBodies.find(e => e.id === effectiveSelectedEnergyBodyId);

                  const updateEnergyBody = (id: string, updates: Partial<EnergyBodySettings>) => {
                    const updated = energyBodies.map(e => e.id === id ? { ...e, ...updates } : e);
                    updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: updated } });
                  };

                  // 能量罩（原火焰系统表面火焰）
                  const flameSystem = planet.flameSystem || DEFAULT_FLAME_SYSTEM;
                  const surfaceFlames = flameSystem.surfaceFlames || [];
                  // 使用选中状态
                  const effectiveFlameId = selectedSurfaceFlameId && surfaceFlames.find(f => f.id === selectedSurfaceFlameId)
                    ? selectedSurfaceFlameId
                    : surfaceFlames[0]?.id || null;
                  const currentFlame = surfaceFlames.find(f => f.id === effectiveFlameId);

                  const updateFlame = (id: string, updates: Partial<SurfaceFlameSettings>) => {
                    const updated = surfaceFlames.map(f => f.id === id ? { ...f, ...updates } : f);
                    updatePlanet({ flameSystem: { ...flameSystem, surfaceFlames: updated } });
                  };

                  const addFlame = (presetId: string) => {
                    const preset = SURFACE_FLAME_PRESETS[presetId as keyof typeof SURFACE_FLAME_PRESETS] || {};
                    const name = presetId === 'classic' ? '经典' : presetId === 'rainbow' ? '彩虹' : presetId === 'ghostly' ? '幽冥' : presetId === 'plasma' ? '等离子' : '自定义';
                    const newId = `flame_${Date.now()}`;
                    const newFlame: SurfaceFlameSettings = { ...createDefaultSurfaceFlame(newId, `${name} ${surfaceFlames.length + 1}`), ...preset, enabled: true };
                    updatePlanet({ flameSystem: { ...flameSystem, surfaceFlames: [...surfaceFlames, newFlame] } });
                    setSelectedSurfaceFlameId(newId);
                  };

                  // 子模块启用状态
                  const shieldEnabled = flameSystem.surfaceFlamesEnabled !== false;

                  return (
                    <ControlGroup title="能量体系统" rightContent={
                      <button
                        onClick={() => updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, enabled: !(planet.energyBodySystem?.enabled ?? true) } })}
                        className="px-2 py-1 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: (planet.energyBodySystem?.enabled ?? true)
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: (planet.energyBodySystem?.enabled ?? true)
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: (planet.energyBodySystem?.enabled ?? true) ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {(planet.energyBodySystem?.enabled ?? true) ? '已启用' : '已禁用'}
                      </button>
                    }>
                      {/* 能量核 / 能量罩 子Tab 切换 - 应用材质设置 */}
                      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {[
                          { key: 'core' as const, label: '能量核', count: energyBodies.filter(e => e.enabled).length, color: '#f59e0b', enabled: (planet.energyBodySystem?.enabled ?? true) && (planet.energyBodySystem?.coreEnabled ?? true) },
                          { key: 'shield' as const, label: '能量罩', count: surfaceFlames.filter(f => f.enabled).length, color: '#ef4444', enabled: (planet.energyBodySystem?.enabled ?? true) && shieldEnabled }
                        ].map(tab => {
                          const isActive = energyBodySystemSubTab === tab.key;
                          const subConfig = materialSettings?.subModuleTabs?.energyBody || createDefaultMaterialConfig('glass');
                          const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setEnergyBodySystemSubTab(tab.key)}
                              className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200"
                              style={materialStyle}
                            >
                              {tab.label}{tab.enabled && ` (${tab.count})`}
                            </button>
                          );
                        })}
                      </div>

                      {/* ===== 能量核 Tab ===== */}
                      {energyBodySystemSubTab === 'core' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={energyBodies}
                            selectedId={effectiveSelectedEnergyBodyId}
                            onSelect={(id) => setSelectedEnergyBodyId(id)}
                            onToggleEnabled={(id, enabled) => updateEnergyBody(id, { enabled })}
                            onRename={(id, name) => updateEnergyBody(id, { name })}
                            onDelete={(id) => {
                              const updated = energyBodies.filter(e => e.id !== id);
                              updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: updated } });
                              if (effectiveSelectedEnergyBodyId === id) setSelectedEnergyBodyId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = energyBodies.find(e => e.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: [...energyBodies, copy] } });
                                setSelectedEnergyBodyId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newEB = createDefaultEnergyBody(id, `能量核 ${energyBodies.length + 1}`);
                              updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: [...energyBodies, newEB] } });
                              setSelectedEnergyBodyId(id);
                            }}
                            globalEnabled={planet.energyBodySystem?.coreEnabled ?? true}
                            onGlobalToggle={(enabled) => updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, coreEnabled: enabled } })}
                            soloId={planet.energyBodySystem?.soloId}
                            onSoloToggle={(id) => updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, soloId: id } })}
                            title="能量核"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无能量核"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.energyBody)}
                            builtInPresets={[
                              { id: 'metatron', name: '梅塔特隆', data: ENERGY_BODY_PRESETS.metatron },
                              { id: 'essenceCore', name: '源质核心', data: ENERGY_BODY_PRESETS.essenceCore },
                              { id: 'tesseract', name: '超立方体', data: ENERGY_BODY_PRESETS.tesseract },
                              { id: 'voidHeart', name: '虚空之心', data: ENERGY_BODY_PRESETS.voidHeart },
                              { id: 'starCrystal', name: '星之晶体', data: ENERGY_BODY_PRESETS.starCrystal },
                              { id: 'dimensionCage', name: '维度牢笼', data: ENERGY_BODY_PRESETS.dimensionCage }
                            ]}
                            currentData={currentEnergyBody ? { ...currentEnergyBody, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentEnergyBody}
                            instanceName="能量核"
                            onApplyToInstance={(data) => {
                              if (currentEnergyBody) {
                                updateEnergyBody(currentEnergyBody.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newEB = {
                                ...createDefaultEnergyBody(id, `${presetName.replace(/^[^\s]+\s/, '')} ${energyBodies.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ energyBodySystem: { ...planet.energyBodySystem!, energyBodies: [...energyBodies, newEB] } });
                              setSelectedEnergyBodyId(id);
                            }}
                            title="预设"
                            accentColor="teal"
                            moduleName="energyBody"
                          />

                          {currentEnergyBody && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentEnergyBody.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.energyBody)}
                                  currentData={currentEnergyBody}
                                  defaultName={currentEnergyBody.name}
                                  accentColor="teal"
                                />
                              </div>

                              {/* 渲染模式 - 顶层 */}
                              <div className="flex gap-1 mb-2">
                                {(['wireframe', 'shell', 'both'] as const).map(mode => (
                                  <button
                                    key={mode}
                                    onClick={() => updateEnergyBody(currentEnergyBody.id, { renderMode: mode })}
                                    className="flex-1 px-2 py-1.5 text-xs rounded transition-all duration-200" style={getOptionButtonStyle(currentEnergyBody.renderMode === mode)}
                                  >
                                    {mode === 'wireframe' ? '🔲 线框' : mode === 'shell' ? '🔘 薄壳' : '🔳 两者'}
                                  </button>
                                ))}
                              </div>

                              {/* 标签页切换 */}
                              <div className="flex gap-1 border-b border-gray-700 pb-1 mb-2">
                                {[
                                  { key: 'geometry' as const, label: '📐 形态' },
                                  { key: 'appearance' as const, label: '🎨 外观' },
                                  { key: 'effects' as const, label: '✨ 特效' }
                                ].map(tab => (
                                  <button
                                    key={tab.key}
                                    onClick={() => setEnergyBodySubTab(tab.key)}
                                    className={`flex-1 px-2 py-1 text-xs rounded-t ${energyBodySubTab === tab.key ? 'bg-gray-700 text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* ===== 形态标签页 ===== */}
                              {energyBodySubTab === 'geometry' && (
                                <div className="space-y-2">
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>基础几何</span>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs text-gray-400">类型</span>
                                      <select value={currentEnergyBody.polyhedronType} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { polyhedronType: e.target.value as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                        <optgroup label="柏拉图立体">
                                          <option value="tetrahedron">正四面体</option>
                                          <option value="cube">正六面体</option>
                                          <option value="octahedron">正八面体</option>
                                          <option value="dodecahedron">正十二面体</option>
                                          <option value="icosahedron">正二十面体</option>
                                        </optgroup>
                                        <optgroup label="截角多面体">
                                          <option value="truncatedTetrahedron">截角四面体</option>
                                          <option value="truncatedCube">截角六面体</option>
                                          <option value="truncatedOctahedron">截角八面体</option>
                                          <option value="truncatedDodecahedron">截角十二面体</option>
                                          <option value="truncatedIcosahedron">截角二十面体(足球)</option>
                                          <option value="cuboctahedron">截半立方体</option>
                                          <option value="icosidodecahedron">截半二十面体</option>
                                        </optgroup>
                                        <optgroup label="星形多面体">
                                          <option value="smallStellatedDodecahedron">小星形十二面体</option>
                                          <option value="star">立体五角星</option>
                                        </optgroup>
                                      </select>
                                    </div>
                                    <RangeControl label="半径" value={currentEnergyBody.radius} min={30} max={500} step={10} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { radius: v })} />
                                    {currentEnergyBody.polyhedronType.startsWith('truncated') || currentEnergyBody.polyhedronType === 'cuboctahedron' || currentEnergyBody.polyhedronType === 'icosidodecahedron' || currentEnergyBody.polyhedronType === 'smallStellatedDodecahedron' ? (
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-yellow-500/70">此类型不支持细分</span>
                                      </div>
                                    ) : (
                                      <RangeControl label="细分级别" value={currentEnergyBody.subdivisionLevel} min={0} max={4} step={1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { subdivisionLevel: v })} />
                                    )}
                                    <RangeControl label="球化程度" value={currentEnergyBody.spherize} min={0} max={1} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { spherize: v })} />
                                  </div>
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>变换</span>
                                    <RangeControl label="旋转速度" value={currentEnergyBody.rotationSpeed} min={-2} max={2} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { rotationSpeed: v })} />
                                    <RotationAxisPresetSelector axis={currentEnergyBody.rotationAxis} onChange={(axis) => updateEnergyBody(currentEnergyBody.id, { rotationAxis: axis })} getButtonStyle={getOptionButtonStyle} />
                                    <div className="mt-2">
                                      <TiltPresetSelector tilt={currentEnergyBody.tilt} onChange={(tilt) => updateEnergyBody(currentEnergyBody.id, { tilt })} getButtonStyle={getOptionButtonStyle} />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ===== 外观标签页 ===== */}
                              {energyBodySubTab === 'appearance' && (
                                <div className="space-y-2">
                                  {/* 边缘样式 */}
                                  {(currentEnergyBody.renderMode === 'wireframe' || currentEnergyBody.renderMode === 'both') && (
                                    <div className="p-2 bg-gray-800/50 rounded">
                                      <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>边缘样式</span>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-400">颜色</span>
                                        <input type="color" value={currentEnergyBody.edgeEffect.color} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, color: e.target.value } })} className="w-8 h-6 rounded cursor-pointer" />
                                        <label className="flex items-center gap-1">
                                          <input type="checkbox" checked={currentEnergyBody.edgeEffect.gradientEnabled} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, gradientEnabled: e.target.checked } })} />
                                          <span className="text-xs text-gray-400">渐变</span>
                                        </label>
                                        {currentEnergyBody.edgeEffect.gradientEnabled && (
                                          <input type="color" value={currentEnergyBody.edgeEffect.gradientEndColor} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, gradientEndColor: e.target.value } })} className="w-8 h-6 rounded cursor-pointer" />
                                        )}
                                      </div>
                                      <RangeControl label="发光强度" value={currentEnergyBody.edgeEffect.glowIntensity} min={0} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, glowIntensity: v } })} />
                                      {/* 虚线效果 */}
                                      <div className="flex items-center justify-between mt-2 mb-1">
                                        <span className="text-xs text-gray-400">虚线效果</span>
                                        <button
                                          onClick={() => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, dashPattern: { ...currentEnergyBody.edgeEffect.dashPattern, enabled: !currentEnergyBody.edgeEffect.dashPattern.enabled } } })}
                                          className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                          style={{
                                            background: currentEnergyBody.edgeEffect.dashPattern.enabled
                                              ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                              : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                            boxShadow: currentEnergyBody.edgeEffect.dashPattern.enabled
                                              ? '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)'
                                              : '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
                                          }}
                                        />
                                      </div>
                                      <RangeControl label="虚线占比" value={currentEnergyBody.edgeEffect.dashPattern.dashRatio} min={0.1} max={0.9} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, dashPattern: { ...currentEnergyBody.edgeEffect.dashPattern, dashRatio: v } } })} />
                                      <RangeControl label="虚线密度" value={currentEnergyBody.edgeEffect.dashPattern.dashDensity ?? 10} min={2} max={30} step={1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, dashPattern: { ...currentEnergyBody.edgeEffect.dashPattern, dashDensity: v } } })} />
                                      <RangeControl label="流动速度" value={currentEnergyBody.edgeEffect.dashPattern.flowSpeed} min={0} max={5} step={0.5} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeEffect: { ...currentEnergyBody.edgeEffect, dashPattern: { ...currentEnergyBody.edgeEffect.dashPattern, flowSpeed: v } } })} />
                                    </div>
                                  )}
                                  {/* 顶点样式 */}
                                  {(currentEnergyBody.renderMode === 'wireframe' || currentEnergyBody.renderMode === 'both') && (
                                    <div className="p-2 bg-gray-800/50 rounded">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400">顶点光点</span>
                                        <button
                                          onClick={() => updateEnergyBody(currentEnergyBody.id, { vertexEffect: { ...currentEnergyBody.vertexEffect, enabled: !currentEnergyBody.vertexEffect.enabled } })}
                                          className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                          style={{
                                            background: currentEnergyBody.vertexEffect.enabled
                                              ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                              : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
                                          }}
                                        />
                                      </div>
                                      <div className={!currentEnergyBody.vertexEffect.enabled ? 'opacity-50' : ''}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-xs text-gray-400">颜色</span>
                                          <input type="color" value={currentEnergyBody.vertexEffect.color} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { vertexEffect: { ...currentEnergyBody.vertexEffect, color: e.target.value } })} className="w-8 h-6 rounded cursor-pointer" />
                                          <select value={currentEnergyBody.vertexEffect.shape} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { vertexEffect: { ...currentEnergyBody.vertexEffect, shape: e.target.value as any } })} className="text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                            <option value="circle">圆形</option>
                                            <option value="diamond">菱形</option>
                                            <option value="star">星形</option>
                                          </select>
                                        </div>
                                        <RangeControl label="大小" value={currentEnergyBody.vertexEffect.size} min={1} max={80} step={1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { vertexEffect: { ...currentEnergyBody.vertexEffect, size: v } })} />
                                        <RangeControl label="发光强度" value={currentEnergyBody.vertexEffect.glowIntensity} min={0} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { vertexEffect: { ...currentEnergyBody.vertexEffect, glowIntensity: v } })} />
                                      </div>
                                    </div>
                                  )}
                                  {/* 薄壳样式 */}
                                  {(currentEnergyBody.renderMode === 'shell' || currentEnergyBody.renderMode === 'both') && (
                                    <div className="p-2 bg-gray-800/50 rounded">
                                      <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>薄壳效果</span>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-400">颜色</span>
                                        <input type="color" value={currentEnergyBody.shellEffect.color} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { shellEffect: { ...currentEnergyBody.shellEffect, color: e.target.value } })} className="w-8 h-6 rounded cursor-pointer" />
                                      </div>
                                      <RangeControl label="透明度" value={currentEnergyBody.shellEffect.opacity} min={0} max={1} step={0.05} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { shellEffect: { ...currentEnergyBody.shellEffect, opacity: v } })} />
                                      <RangeControl label="菲涅尔强度" value={currentEnergyBody.shellEffect.fresnelIntensity} min={0} max={2} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { shellEffect: { ...currentEnergyBody.shellEffect, fresnelIntensity: v } })} />
                                      <RangeControl label="菲涅尔指数" value={currentEnergyBody.shellEffect.fresnelPower} min={0.5} max={5} step={0.5} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { shellEffect: { ...currentEnergyBody.shellEffect, fresnelPower: v } })} />
                                    </div>
                                  )}
                                  {/* 整体 */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>整体</span>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs text-gray-400">混合</span>
                                      <select value={currentEnergyBody.blendMode} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { blendMode: e.target.value as 'additive' | 'normal' })} className="text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                        <option value="additive">叠加</option>
                                        <option value="normal">正常</option>
                                      </select>
                                    </div>
                                    <RangeControl label="整体透明度" value={currentEnergyBody.globalOpacity} min={0} max={1} step={0.05} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { globalOpacity: v })} />
                                  </div>
                                </div>
                              )}

                              {/* ===== 特效标签页（合并动画+特效+设置） ===== */}
                              {energyBodySubTab === 'effects' && (
                                <div className="space-y-2">
                                  {/* 形态动画 */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>形态动画</span>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-400">呼吸缩放</span>
                                      <input type="checkbox" checked={currentEnergyBody.organicAnimation.breathingEnabled} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, breathingEnabled: e.target.checked } })} />
                                    </div>
                                    {currentEnergyBody.organicAnimation.breathingEnabled && (
                                      <>
                                        <RangeControl label="呼吸强度" value={currentEnergyBody.organicAnimation.breathingIntensity} min={0} max={0.5} step={0.05} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, breathingIntensity: v } })} />
                                        <RangeControl label="呼吸速度" value={currentEnergyBody.organicAnimation.breathingSpeed} min={0.1} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, breathingSpeed: v } })} />
                                      </>
                                    )}
                                    <div className="flex items-center justify-between mt-2 mb-1">
                                      <span className="text-xs text-gray-400">噪声抖动</span>
                                      <input type="checkbox" checked={currentEnergyBody.organicAnimation.noiseEnabled} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, noiseEnabled: e.target.checked } })} />
                                    </div>
                                    {currentEnergyBody.organicAnimation.noiseEnabled && (
                                      <>
                                        <RangeControl label="噪声幅度" value={currentEnergyBody.organicAnimation.noiseAmplitude} min={0} max={0.1} step={0.002} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, noiseAmplitude: v } })} />
                                        <RangeControl label="噪声频率" value={currentEnergyBody.organicAnimation.noiseFrequency} min={0.5} max={5} step={0.5} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, noiseFrequency: v } })} />
                                        <RangeControl label="噪声速度" value={currentEnergyBody.organicAnimation.noiseSpeed} min={0.1} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { organicAnimation: { ...currentEnergyBody.organicAnimation, noiseSpeed: v } })} />
                                      </>
                                    )}
                                  </div>

                                  {/* 边缘动画 */}
                                  {(currentEnergyBody.renderMode === 'wireframe' || currentEnergyBody.renderMode === 'both') && (
                                    <div className="p-2 bg-gray-800/50 rounded">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-400">边缘脉动</span>
                                        <button
                                          onClick={() => updateEnergyBody(currentEnergyBody.id, { edgeBreathing: { ...currentEnergyBody.edgeBreathing, enabled: !(currentEnergyBody.edgeBreathing?.enabled ?? false) } })}
                                          className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                          style={{
                                            background: (currentEnergyBody.edgeBreathing?.enabled ?? false)
                                              ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                              : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
                                          }}
                                        />
                                      </div>
                                      <RangeControl label="脉动速度" value={currentEnergyBody.edgeBreathing?.speed ?? 0.5} min={0.1} max={2} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeBreathing: { ...currentEnergyBody.edgeBreathing, speed: v } })} />
                                      <RangeControl label="发光振幅" value={currentEnergyBody.edgeBreathing?.glowAmplitude ?? 0.4} min={0} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeBreathing: { ...currentEnergyBody.edgeBreathing, glowAmplitude: v } })} />
                                      <RangeControl label="透明振幅" value={currentEnergyBody.edgeBreathing?.alphaAmplitude ?? 0.15} min={0} max={1} step={0.05} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeBreathing: { ...currentEnergyBody.edgeBreathing, alphaAmplitude: v } })} />
                                      <RangeControl label="噪声混合" value={currentEnergyBody.edgeBreathing?.noiseMix ?? 0.3} min={0} max={1} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { edgeBreathing: { ...currentEnergyBody.edgeBreathing, noiseMix: v } })} />
                                    </div>
                                  )}

                                  {/* 光流巡游 */}
                                  {(currentEnergyBody.renderMode === 'wireframe' || currentEnergyBody.renderMode === 'both') && (
                                    <div className="p-2 bg-gray-800/50 rounded">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400">光流巡游</span>
                                        <button
                                          onClick={() => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, enabled: !currentEnergyBody.lightFlow.enabled } })}
                                          className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                          style={{
                                            background: currentEnergyBody.lightFlow.enabled
                                              ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                              : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
                                          }}
                                        />
                                      </div>
                                      {currentEnergyBody.lightFlow.enabled && (
                                        <>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-gray-400">颜色</span>
                                            <input type="color" value={currentEnergyBody.lightFlow.color} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, color: e.target.value } })} className="w-8 h-6 rounded cursor-pointer" />
                                          </div>
                                          <RangeControl label="流动速度" value={currentEnergyBody.lightFlow.speed} min={0.1} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, speed: v } })} />
                                          <RangeControl label="光斑长度" value={currentEnergyBody.lightFlow.length} min={0.05} max={0.5} step={0.05} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, length: v } })} />
                                          <RangeControl label="光斑强度" value={currentEnergyBody.lightFlow.intensity} min={0} max={3} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, intensity: v } })} />
                                          <RangeControl label="光斑数量" value={currentEnergyBody.lightFlow.count} min={1} max={10} step={1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, count: v } })} />
                                          <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-gray-400 w-16">路径</span>
                                            <select value={currentEnergyBody.lightFlow.pathMode ?? 'edge'} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, pathMode: e.target.value as 'edge' | 'euler' | 'random' } })} className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1">
                                              <option value="edge">沿边</option>
                                              <option value="euler">欧拉回路</option>
                                              <option value="random">随机</option>
                                            </select>
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-400 w-16">相位</span>
                                            <select value={currentEnergyBody.lightFlow.phaseMode ?? 'spread'} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, phaseMode: e.target.value as 'sync' | 'spread' } })} className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1">
                                              <option value="sync">同相</option>
                                              <option value="spread">错相</option>
                                            </select>
                                          </div>
                                          <RangeControl label="脉冲速度" value={currentEnergyBody.lightFlow.pulseSpeed ?? 0} min={0} max={5} step={0.5} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, pulseSpeed: v, pulseEnabled: v > 0 } })} />
                                          <RangeControl label="停靠阈值" value={currentEnergyBody.lightFlow.dwellThreshold ?? 0} min={0} max={6} step={1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, dwellThreshold: v, dwellEnabled: v > 0 } })} />
                                          <RangeControl label="停靠时长" value={currentEnergyBody.lightFlow.dwellDuration ?? 0} min={0} max={1} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { lightFlow: { ...currentEnergyBody.lightFlow, dwellDuration: v } })} />
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* 后期处理 */}
                                  <div className="p-2 bg-gray-800/50 rounded">
                                    <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>后期处理</span>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-400">色差效果</span>
                                      <input type="checkbox" checked={currentEnergyBody.postEffects?.chromaticAberrationEnabled ?? false} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { postEffects: { ...currentEnergyBody.postEffects, chromaticAberrationEnabled: e.target.checked } })} />
                                    </div>
                                    {currentEnergyBody.postEffects?.chromaticAberrationEnabled && (
                                      <RangeControl label="色差强度" value={currentEnergyBody.postEffects?.chromaticAberrationIntensity ?? 0.01} min={0} max={0.05} step={0.005} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { postEffects: { ...currentEnergyBody.postEffects, chromaticAberrationIntensity: v } })} />
                                    )}
                                    <div className="flex items-center justify-between mt-2 mb-1">
                                      <span className="text-xs text-gray-400">暗角效果</span>
                                      <input type="checkbox" checked={currentEnergyBody.postEffects?.vignetteEnabled ?? false} onChange={(e) => updateEnergyBody(currentEnergyBody.id, { postEffects: { ...currentEnergyBody.postEffects, vignetteEnabled: e.target.checked } })} />
                                    </div>
                                    {currentEnergyBody.postEffects?.vignetteEnabled && (
                                      <>
                                        <RangeControl label="暗角强度" value={currentEnergyBody.postEffects?.vignetteIntensity ?? 0.5} min={0} max={1} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { postEffects: { ...currentEnergyBody.postEffects, vignetteIntensity: v } })} />
                                        <RangeControl label="暗角半径" value={currentEnergyBody.postEffects?.vignetteRadius ?? 0.8} min={0.3} max={1.2} step={0.1} onChange={(v) => updateEnergyBody(currentEnergyBody.id, { postEffects: { ...currentEnergyBody.postEffects, vignetteRadius: v } })} />
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ===== 能量罩 Tab ===== */}
                      {energyBodySystemSubTab === 'shield' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector items={surfaceFlames.map(f => ({ id: f.id, name: f.name, enabled: f.enabled }))} selectedId={effectiveFlameId} onSelect={(id) => setSelectedSurfaceFlameId(id)} onToggleEnabled={(id, e) => updateFlame(id, { enabled: e })} onRename={(id, n) => updateFlame(id, { name: n })} onDelete={(id) => { updatePlanet({ flameSystem: { ...flameSystem, surfaceFlames: surfaceFlames.filter(f => f.id !== id) } }); if (effectiveFlameId === id) setSelectedSurfaceFlameId(null); }} onCopy={(id) => { const source = surfaceFlames.find(f => f.id === id); if (source) { const newId = `flame_${Date.now()}`; const copy = { ...source, id: newId, name: `${source.name} 副本` }; updatePlanet({ flameSystem: { ...flameSystem, surfaceFlames: [...surfaceFlames, copy] } }); setSelectedSurfaceFlameId(newId); } }} onAdd={() => addFlame('custom')} globalEnabled={shieldEnabled} onGlobalToggle={(e) => updatePlanet({ flameSystem: { ...flameSystem, surfaceFlamesEnabled: e } })} title="能量罩" titleStyle={{ color: 'var(--ui-secondary)' }} addButtonColor="bg-blue-600 hover:bg-blue-500" emptyText="暂无能量罩" />

                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.surfaceFlame)}
                            builtInPresets={[
                              { id: 'atField', name: 'AT力场', data: SURFACE_FLAME_PRESETS.atField },
                              { id: 'polarisShield', name: '极光护盾', data: SURFACE_FLAME_PRESETS.polarisShield },
                              { id: 'plasmaShell', name: '等离子壳', data: SURFACE_FLAME_PRESETS.plasmaShell },
                              { id: 'imaginaryWall', name: '虚数屏障', data: SURFACE_FLAME_PRESETS.imaginaryWall },
                              { id: 'divineAegis', name: '神圣庇护', data: SURFACE_FLAME_PRESETS.divineAegis },
                              { id: 'bioMembrane', name: '生物膜', data: SURFACE_FLAME_PRESETS.bioMembrane },
                              { id: 'waterRipple', name: '水波纹', data: SURFACE_FLAME_PRESETS.waterRipple }
                            ]}
                            currentData={currentFlame ? { ...currentFlame, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentFlame}
                            instanceName="能量罩"
                            onApplyToInstance={(data) => {
                              if (currentFlame) {
                                updateFlame(currentFlame.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const count = surfaceFlames.length + 1;
                              const newFlame: SurfaceFlameSettings = { ...createDefaultSurfaceFlame(`flame_${Date.now()}`, `${presetName.replace(/^[^\s]+\s/, '')} ${count}`), ...data, enabled: true };
                              updatePlanet({ flameSystem: { ...flameSystem, surfaceFlames: [...surfaceFlames, newFlame] } });
                            }}
                            title="预设"
                            accentColor="teal"
                            moduleName="surfaceFlame"
                          />

                          {currentFlame && (
                            <>
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentFlame.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.surfaceFlame)}
                                  currentData={currentFlame}
                                  defaultName={currentFlame.name}
                                  accentColor="teal"
                                />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>基础属性</span>
                                <RangeControl label="半径" value={currentFlame.radius} min={50} max={300} step={5} onChange={(v) => updateFlame(currentFlame.id, { radius: v })} />
                                <RangeControl label="厚度" value={currentFlame.thickness} min={0.05} max={0.5} step={0.01} onChange={(v) => updateFlame(currentFlame.id, { thickness: v })} />
                                <RangeControl label="透明度" value={currentFlame.opacity} min={0} max={1} step={0.05} onChange={(v) => updateFlame(currentFlame.id, { opacity: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>能量参数</span>
                                <RangeControl label="能量尺寸" value={currentFlame.flameScale} min={0.1} max={3} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { flameScale: v })} />
                                <RangeControl label="覆盖密度" value={currentFlame.density} min={0.3} max={1} step={0.05} onChange={(v) => updateFlame(currentFlame.id, { density: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>质感参数</span>
                                <RangeControl label="流动速度" value={currentFlame.flowSpeed} min={0} max={3} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { flowSpeed: v })} />
                                <RangeControl label="扰动强度" value={currentFlame.turbulence} min={0} max={2} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { turbulence: v })} />
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] text-gray-500 w-16">噪声类型</span>
                                  <select value={currentFlame.noiseType} onChange={(e) => updateFlame(currentFlame.id, { noiseType: e.target.value as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                    <option value="simplex">Simplex</option>
                                    <option value="voronoi">Voronoi</option>
                                    <option value="ripple">水波纹</option>
                                  </select>
                                </div>
                                {currentFlame.noiseType === 'ripple' && (() => {
                                  const ripple = currentFlame.rippleSettings || {
                                    waveCount: 15, waveSpeed: 1.5, damping: 0.3,
                                    multiSourceEnabled: false, sourceCount: 1, sourceSpread: 0.5, interference: 0.5
                                  };
                                  const updateRipple = (u: Partial<typeof ripple>) => updateFlame(currentFlame.id, { rippleSettings: { ...ripple, ...u } });
                                  return (
                                    <div className="p-2 bg-gray-700/30 rounded mt-1 mb-1">
                                      <span className="text-[9px] text-cyan-400 block mb-1">水波纹参数</span>
                                      <RangeControl label="波纹环数" value={ripple.waveCount} min={5} max={30} step={1} onChange={(v) => updateRipple({ waveCount: v })} />
                                      <RangeControl label="传播速度" value={ripple.waveSpeed} min={0.5} max={3} step={0.1} onChange={(v) => updateRipple({ waveSpeed: v })} />
                                      <RangeControl label="边缘衰减" value={ripple.damping} min={0} max={1} step={0.05} onChange={(v) => updateRipple({ damping: v })} />
                                      <div className="flex items-center justify-between mt-2 mb-1">
                                        <span className="text-[9px] text-gray-400">多波源干涉</span>
                                        <input type="checkbox" checked={ripple.multiSourceEnabled} onChange={(e) => updateRipple({ multiSourceEnabled: e.target.checked })} className="w-3 h-3 rounded" />
                                      </div>
                                      {ripple.multiSourceEnabled && (<>
                                        <RangeControl label="波源数量" value={ripple.sourceCount} min={1} max={5} step={1} onChange={(v) => updateRipple({ sourceCount: v })} />
                                        <RangeControl label="波源分散" value={ripple.sourceSpread} min={0} max={1} step={0.1} onChange={(v) => updateRipple({ sourceSpread: v })} />
                                        <RangeControl label="干涉强度" value={ripple.interference} min={0} max={1} step={0.1} onChange={(v) => updateRipple({ interference: v })} />
                                      </>)}
                                    </div>
                                  );
                                })()}
                                <RangeControl label="分形层级" value={currentFlame.fractalLayers} min={1} max={5} step={1} onChange={(v) => updateFlame(currentFlame.id, { fractalLayers: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>视觉效果</span>
                                <RangeControl label="发光强度" value={currentFlame.emissive} min={0} max={5} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { emissive: v })} />
                                <RangeControl label="Bloom增强" value={currentFlame.bloomBoost} min={0} max={3} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { bloomBoost: v })} />
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>动画效果</span>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] text-gray-500 w-16">舔舐方向</span>
                                  <select value={currentFlame.direction} onChange={(e) => updateFlame(currentFlame.id, { direction: e.target.value as any })} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white">
                                    <option value="up">向上</option>
                                    <option value="spiral">螺旋上升</option>
                                  </select>
                                </div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] text-gray-500">脉动效果</span>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={currentFlame.pulseEnabled} onChange={(e) => updateFlame(currentFlame.id, { pulseEnabled: e.target.checked })} className="w-3 h-3 rounded" />
                                    <span className="text-[9px] text-gray-400">启用</span>
                                  </label>
                                </div>
                                {currentFlame.pulseEnabled && (<>
                                  <RangeControl label="脉动速度" value={currentFlame.pulseSpeed} min={0} max={3} step={0.1} onChange={(v) => updateFlame(currentFlame.id, { pulseSpeed: v })} />
                                  <RangeControl label="脉动幅度" value={currentFlame.pulseIntensity} min={0} max={1} step={0.05} onChange={(v) => updateFlame(currentFlame.id, { pulseIntensity: v })} />
                                </>)}
                              </div>

                              <div className="p-2 bg-gray-800/50 rounded mb-2">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>颜色设置</span>
                                {(() => {
                                  const fc = currentFlame.color || { mode: 'twoColor', baseColor: '#ff6600', colors: ['#ff6600', '#ffff00'], colorMidPosition: 0.5, proceduralIntensity: 1.0 };
                                  const updateColor = (u: any) => updateFlame(currentFlame.id, { color: { ...fc, ...u } });
                                  return (<>
                                    <div className="grid grid-cols-4 gap-1 mb-2">
                                      {[{ id: 'none', l: '单色' }, { id: 'twoColor', l: '双色' }, { id: 'threeColor', l: '三色' }, { id: 'procedural', l: '混色' }].map(m => (
                                        <button key={m.id} onClick={() => updateColor({ mode: m.id })} className="px-1 py-0.5 text-[10px] rounded transition-all duration-200" style={getOptionButtonStyle(fc.mode === m.id)}>{m.l}</button>
                                      ))}
                                    </div>
                                    {fc.mode === 'none' && <div className="flex items-center gap-2"><span className="text-xs text-gray-400">基础色</span><input type="color" value={fc.baseColor || '#ff6600'} onChange={(e) => updateColor({ baseColor: e.target.value })} className="w-12 h-6 rounded cursor-pointer" /></div>}
                                    {fc.mode === 'twoColor' && <div className="flex gap-2 items-center justify-center"><input type="color" value={fc.colors?.[0] || '#ff6600'} onChange={(e) => { const c = [...(fc.colors || [])]; c[0] = e.target.value; updateColor({ colors: c }); }} className="w-10 h-6 rounded cursor-pointer" /><span className="text-gray-400">→</span><input type="color" value={fc.colors?.[1] || '#ffff00'} onChange={(e) => { const c = [...(fc.colors || [])]; c[1] = e.target.value; updateColor({ colors: c }); }} className="w-10 h-6 rounded cursor-pointer" /></div>}
                                    {fc.mode === 'threeColor' && <><div className="flex gap-1 items-center justify-center"><input type="color" value={fc.colors?.[0] || '#ffff00'} onChange={(e) => { const c = [...(fc.colors || [])]; c[0] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><span className="text-gray-500">→</span><input type="color" value={fc.colors?.[1] || '#ff6600'} onChange={(e) => { const c = [...(fc.colors || [])]; c[1] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><span className="text-gray-500">→</span><input type="color" value={fc.colors?.[2] || '#ff0000'} onChange={(e) => { const c = [...(fc.colors || [])]; c[2] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /></div><RangeControl label="中间色位置" value={fc.colorMidPosition || 0.5} min={0.1} max={0.9} step={0.05} onChange={(v) => updateColor({ colorMidPosition: v })} /></>}
                                    {fc.mode === 'procedural' && <><div className="flex gap-2 items-center justify-center"><input type="color" value={fc.colors?.[0] || '#ff6600'} onChange={(e) => { const c = [...(fc.colors || [])]; c[0] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><input type="color" value={fc.colors?.[1] || '#00ffff'} onChange={(e) => { const c = [...(fc.colors || [])]; c[1] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /><input type="color" value={fc.colors?.[2] || '#00ff88'} onChange={(e) => { const c = [...(fc.colors || [])]; c[2] = e.target.value; updateColor({ colors: c }); }} className="w-8 h-6 rounded cursor-pointer" /></div><RangeControl label="混色强度" value={fc.proceduralIntensity || 1.0} min={0.1} max={3} step={0.1} onChange={(v) => updateColor({ proceduralIntensity: v })} /></>}
                                  </>);
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </ControlGroup>
                  );
                })()}

                {/* ===== 粒子辐射 子Tab ===== */}
                {planetSubTab === 'radiation' && (() => {
                  // 自动选中第一个粒子环绕
                  const effectiveSelectedOrbitingId = selectedOrbitingId && planet.radiation.orbitings.find(o => o.id === selectedOrbitingId)
                    ? selectedOrbitingId
                    : planet.radiation.orbitings[0]?.id || null;
                  const currentOrbiting = planet.radiation.orbitings.find(o => o.id === effectiveSelectedOrbitingId);

                  // 自动选中第一个粒子喷射
                  const effectiveSelectedEmitterId = selectedEmitterId && planet.radiation.emitters.find(e => e.id === selectedEmitterId)
                    ? selectedEmitterId
                    : planet.radiation.emitters[0]?.id || null;
                  const currentEmitter = planet.radiation.emitters.find(e => e.id === effectiveSelectedEmitterId);

                  const updateOrbiting = (orbitingId: string, updates: Partial<OrbitingParticlesSettings>) => {
                    const updated = planet.radiation.orbitings.map(o => o.id === orbitingId ? { ...o, ...updates } : o);
                    updatePlanet({ radiation: { ...planet.radiation, orbitings: updated } });
                  };

                  const updateEmitter = (emitterId: string, updates: Partial<ParticleEmitterSettings>) => {
                    const updated = planet.radiation.emitters.map(e => e.id === emitterId ? { ...e, ...updates } : e);
                    updatePlanet({ radiation: { ...planet.radiation, emitters: updated } });
                  };

                  const radiationEnabled = planet.radiation.enabled !== false;

                  return (
                    <ControlGroup title="粒子辐射系统" rightContent={
                      <button
                        onClick={() => updatePlanet({ radiation: { ...planet.radiation, enabled: !radiationEnabled } })}
                        className="px-2 py-1 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: radiationEnabled
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: radiationEnabled
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: radiationEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {radiationEnabled ? '已启用' : '已禁用'}
                      </button>
                    }>
                      {/* 子Tab切换 - 应用材质设置 */}
                      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {[
                          { key: 'orbiting' as const, label: '粒子环绕', color: '#34d399' },
                          { key: 'emitter' as const, label: '粒子喷射', color: '#f472b6' }
                        ].map(tab => {
                          const isActive = radiationSubTab === tab.key;
                          const subConfig = materialSettings?.subModuleTabs?.radiation || createDefaultMaterialConfig('glass');
                          const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setRadiationSubTab(tab.key)}
                              className="flex-1 py-1.5 px-2 text-xs rounded transition-all duration-200"
                              style={materialStyle}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* 粒子环绕 */}
                      {radiationSubTab === 'orbiting' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.radiation.orbitings}
                            selectedId={effectiveSelectedOrbitingId}
                            onSelect={(id) => setSelectedOrbitingId(id)}
                            onToggleEnabled={(id, enabled) => updateOrbiting(id, { enabled })}
                            onRename={(id, name) => updateOrbiting(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.radiation.orbitings.filter(o => o.id !== id);
                              updatePlanet({ radiation: { ...planet.radiation, orbitings: updated } });
                              if (effectiveSelectedOrbitingId === id) setSelectedOrbitingId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.radiation.orbitings.find(o => o.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ radiation: { ...planet.radiation, orbitings: [...planet.radiation.orbitings, copy] } });
                                setSelectedOrbitingId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newOrbiting = createDefaultOrbiting(id, `粒子环绕 ${planet.radiation.orbitings.length + 1}`);
                              updatePlanet({ radiation: { ...planet.radiation, orbitings: [...planet.radiation.orbitings, newOrbiting] } });
                              setSelectedOrbitingId(id);
                            }}
                            onColorChange={(id, color) => updateOrbiting(id, { color })}
                            globalEnabled={planet.radiation.orbitingEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ radiation: { ...planet.radiation, orbitingEnabled: enabled } })}
                            soloId={soloOrbitingFireflyId}
                            onSoloToggle={setSoloOrbitingFireflyId}
                            title="粒子环绕"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无粒子环绕"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.orbitingParticles)}
                            builtInPresets={Object.entries(ORBITING_PARTICLES_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                electrons: '量子旋涡', halo: '圣光守护', swarm: '翠绿蜂群',
                                sanctuary: '圣殿守卫', naniteSwarm: '纳米虫群', verdantWisps: '翠绿生机',
                                asteroidBelt: '碎石带', dataStream: '数据洪流'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentOrbiting ? { ...currentOrbiting, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentOrbiting}
                            instanceName="粒子环绕"
                            onApplyToInstance={(data) => {
                              if (currentOrbiting) {
                                updateOrbiting(currentOrbiting.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newOrbiting = {
                                ...createDefaultOrbiting(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.radiation.orbitings.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ radiation: { ...planet.radiation, orbitings: [...planet.radiation.orbitings, newOrbiting] } });
                              setSelectedOrbitingId(id);
                            }}
                            title="预设"
                            accentColor="cyan"
                            moduleName="orbitingParticles"
                          />

                          {/* 粒子环绕参数区域 */}
                          {currentOrbiting && (
                            <div className="mt-3 space-y-3">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentOrbiting.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.orbitingParticles)}
                                  currentData={currentOrbiting}
                                  defaultName={currentOrbiting.name}
                                  accentColor="cyan"
                                />
                              </div>

                              {/* 基础参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>基础参数</span>
                                <RangeControl label="粒子密度" value={currentOrbiting.particleDensity ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => updateOrbiting(currentOrbiting.id, { particleDensity: v })} />
                                <RangeControl label="环绕半径(R倍)" value={currentOrbiting.orbitRadius} min={0.1} max={5} step={0.1} onChange={(v) => updateOrbiting(currentOrbiting.id, { orbitRadius: v })} />
                                <RangeControl label="球壳厚度" value={currentOrbiting.thickness} min={1} max={1000} step={1} onChange={(v) => updateOrbiting(currentOrbiting.id, { thickness: v })} />
                              </div>

                              {/* 转动轴 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>转动轴</span>
                                <div className="grid grid-cols-4 gap-1">
                                  {[
                                    { label: 'Y轴', value: { x: 0, y: 1, z: 0 } },
                                    { label: 'Y轴30°', value: { x: Math.sin(30 * Math.PI / 180), y: Math.cos(30 * Math.PI / 180), z: 0 } },
                                    { label: 'Y轴45°', value: { x: Math.sin(45 * Math.PI / 180), y: Math.cos(45 * Math.PI / 180), z: 0 } },
                                    { label: 'Y轴60°', value: { x: Math.sin(60 * Math.PI / 180), y: Math.cos(60 * Math.PI / 180), z: 0 } },
                                  ].map(preset => {
                                    const currentDir = currentOrbiting.mainDirection || { x: 0, y: 1, z: 0 };
                                    const isActive = Math.abs(currentDir.x - preset.value.x) < 0.01 && Math.abs(currentDir.y - preset.value.y) < 0.01;
                                    return (
                                      <button
                                        key={preset.label}
                                        onClick={() => updateOrbiting(currentOrbiting.id, { mainDirection: preset.value })}
                                        className="py-1 px-1 text-[10px] rounded transition-all duration-200"
                                        style={getOptionButtonStyle(isActive)}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <RangeControl label="旋转速度" value={currentOrbiting.baseSpeed} min={0.1} max={2} step={0.05} onChange={(v) => updateOrbiting(currentOrbiting.id, { baseSpeed: v })} />
                              </div>

                              {/* 外观 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>外观</span>
                                <RangeControl label="亮度" value={currentOrbiting.brightness || 1.0} min={0.1} max={3.0} step={0.1} onChange={(v) => updateOrbiting(currentOrbiting.id, { brightness: v })} />
                                <RangeControl label="粒子大小" value={currentOrbiting.particleSize || 1.0} min={0.5} max={5.0} step={0.1} onChange={(v) => updateOrbiting(currentOrbiting.id, { particleSize: v })} />
                                <RangeControl label="距离淡出" value={currentOrbiting.fadeStrength * 100 || 0} min={0} max={100} step={1} onChange={(v) => updateOrbiting(currentOrbiting.id, { fadeWithDistance: v > 0, fadeStrength: v / 100 })} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 粒子喷射 */}
                      {radiationSubTab === 'emitter' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.radiation.emitters}
                            selectedId={effectiveSelectedEmitterId}
                            onSelect={(id) => setSelectedEmitterId(id)}
                            onToggleEnabled={(id, enabled) => updateEmitter(id, { enabled })}
                            onRename={(id, name) => updateEmitter(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.radiation.emitters.filter(e => e.id !== id);
                              updatePlanet({ radiation: { ...planet.radiation, emitters: updated } });
                              if (effectiveSelectedEmitterId === id) setSelectedEmitterId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.radiation.emitters.find(e => e.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ radiation: { ...planet.radiation, emitters: [...planet.radiation.emitters, copy] } });
                                setSelectedEmitterId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newEmitter = createDefaultEmitter(id, `粒子喷射 ${planet.radiation.emitters.length + 1}`);
                              updatePlanet({ radiation: { ...planet.radiation, emitters: [...planet.radiation.emitters, newEmitter] } });
                              setSelectedEmitterId(id);
                            }}
                            onColorChange={(id, color) => updateEmitter(id, { color })}
                            globalEnabled={planet.radiation.emitterEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ radiation: { ...planet.radiation, emitterEnabled: enabled } })}
                            soloId={soloFlameJetId}
                            onSoloToggle={setSoloFlameJetId}
                            title="粒子喷射"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无粒子喷射"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.emitter)}
                            builtInPresets={Object.entries(EMITTER_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                fountain: '晨曦喷泉', jet: '熔岩喷流', explosion: '恒星爆发',
                                solarStorm: '太阳风暴', abyssalJet: '深海喷泉', warpDrive: '曲率引擎',
                                sporeSpread: '孢子扩散', gravityLeak: '引力漏斗', dragonBreath: '龙息'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentEmitter ? { ...currentEmitter, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentEmitter}
                            instanceName="粒子喷射"
                            onApplyToInstance={(data) => {
                              if (currentEmitter) {
                                updateEmitter(currentEmitter.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newEmitter = {
                                ...createDefaultEmitter(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.radiation.emitters.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ radiation: { ...planet.radiation, emitters: [...planet.radiation.emitters, newEmitter] } });
                              setSelectedEmitterId(id);
                            }}
                            title="预设"
                            accentColor="teal"
                            moduleName="emitter"
                          />

                          {/* 粒子喷射参数区域 */}
                          {currentEmitter && (
                            <div className="mt-3 space-y-3">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentEmitter.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.emitter)}
                                  currentData={currentEmitter}
                                  defaultName={currentEmitter.name}
                                  accentColor="teal"
                                />
                              </div>

                              {/* 发射设置 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>发射设置</span>
                                <RangeControl label="发射起点(R倍)" value={currentEmitter.emissionRangeMin} min={0.2} max={5} step={0.1} onChange={(v) => updateEmitter(currentEmitter.id, { emissionRangeMin: v })} />
                                <RangeControl label="消散边界(R倍)" value={currentEmitter.emissionRangeMax} min={0.2} max={15} step={0.1} onChange={(v) => updateEmitter(currentEmitter.id, { emissionRangeMax: v })} />
                                <RangeControl label="发射速率(/秒)" value={currentEmitter.birthRate} min={50} max={2000} step={50} onChange={(v) => updateEmitter(currentEmitter.id, { birthRate: v })} />
                              </div>

                              {/* 运动参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动参数</span>
                                <RangeControl label="生命周期(秒)" value={currentEmitter.lifeSpan} min={0.5} max={5} step={0.5} onChange={(v) => updateEmitter(currentEmitter.id, { lifeSpan: v })} />
                                <RangeControl label="初始速度" value={currentEmitter.initialSpeed} min={10} max={200} step={10} onChange={(v) => updateEmitter(currentEmitter.id, { initialSpeed: v })} />
                                <RangeControl label="速度衰减" value={currentEmitter.drag} min={0} max={0.99} step={0.05} onChange={(v) => updateEmitter(currentEmitter.id, { drag: v })} />
                              </div>

                              {/* 外观 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>外观</span>
                                <RangeControl label="亮度" value={currentEmitter.brightness || 1.0} min={0.5} max={3.0} step={0.1} onChange={(v) => updateEmitter(currentEmitter.id, { brightness: v })} />
                                <RangeControl label="粒子大小" value={currentEmitter.particleSize} min={0.5} max={5} step={0.1} onChange={(v) => updateEmitter(currentEmitter.id, { particleSize: v })} />
                                <RangeControl label="淡出强度" value={currentEmitter.fadeOutStrength ?? (currentEmitter.fadeOut ? 1 : 0)} min={0} max={3} step={0.1} onChange={(v) => updateEmitter(currentEmitter.id, { fadeOutStrength: v })} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ControlGroup>
                  );
                })()}

                {/* ===== 流萤 子Tab ===== */}
                {planetSubTab === 'fireflies' && (() => {
                  // 注意：云端头部贴图预设通过 ImageSelectDropdown 的 cloudPresets 加载
                  // 不能在 IIFE 中调用 Hooks（违反 React 规则）
                  // headTextureCloudPresets 直接使用空数组，用户可以使用法阵贴图选择器中的 XingSpark Tab
                  const headTextureCloudPresets: { id: string; name: string; url: string }[] = [];

                  // 自动选中第一个旋转流萤
                  const effectiveSelectedOrbitingFireflyId = selectedOrbitingFireflyId && planet.fireflies.orbitingFireflies.find(f => f.id === selectedOrbitingFireflyId)
                    ? selectedOrbitingFireflyId
                    : planet.fireflies.orbitingFireflies[0]?.id || null;
                  const currentOrbitingFirefly = planet.fireflies.orbitingFireflies.find(f => f.id === effectiveSelectedOrbitingFireflyId);

                  // 自动选中第一个飞舞流萤组
                  const effectiveSelectedWanderingGroupId = selectedWanderingGroupId && planet.fireflies.wanderingGroups.find(g => g.id === selectedWanderingGroupId)
                    ? selectedWanderingGroupId
                    : planet.fireflies.wanderingGroups[0]?.id || null;
                  const currentWanderingGroup = planet.fireflies.wanderingGroups.find(g => g.id === effectiveSelectedWanderingGroupId);

                  const updateOrbitingFirefly = (fireflyId: string, updates: Partial<OrbitingFireflySettings>) => {
                    const updated = planet.fireflies.orbitingFireflies.map(f => f.id === fireflyId ? { ...f, ...updates } : f);
                    updatePlanet({ fireflies: { ...planet.fireflies, orbitingFireflies: updated } });
                  };

                  const updateWanderingGroup = (groupId: string, updates: Partial<WanderingFireflyGroupSettings>) => {
                    const updated = planet.fireflies.wanderingGroups.map(g => g.id === groupId ? { ...g, ...updates } : g);
                    updatePlanet({ fireflies: { ...planet.fireflies, wanderingGroups: updated } });
                  };

                  const firefliesEnabled = planet.fireflies.enabled !== false;

                  return (
                    <ControlGroup title="流萤系统" rightContent={
                      <button
                        onClick={() => updatePlanet({ fireflies: { ...planet.fireflies, enabled: !firefliesEnabled } })}
                        className="px-2 py-1 text-[10px] rounded transition-all font-medium"
                        style={{
                          background: firefliesEnabled
                            ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)'
                            : 'rgba(120, 120, 120, 0.3)',
                          backdropFilter: 'blur(8px)',
                          border: firefliesEnabled
                            ? '1px solid var(--ui-secondary)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: firefliesEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {firefliesEnabled ? '已启用' : '已禁用'}
                      </button>
                    }>
                      {/* 子Tab 切换 - 应用材质设置 */}
                      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {[
                          { key: 'orbiting' as const, label: '旋转流萤', color: '#fbbf24' },
                          { key: 'wandering' as const, label: '游走流萤', color: '#a3e635' }
                        ].map(tab => {
                          const isActive = fireflySubTab === tab.key;
                          const subConfig = materialSettings?.subModuleTabs?.fireflies || createDefaultMaterialConfig('glass');
                          const materialStyle = generateMaterialStyle(subConfig, isActive, tab.color);
                          return (
                            <button
                              key={tab.key}
                              onClick={() => setFireflySubTab(tab.key)}
                              className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all duration-200"
                              style={materialStyle}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* 旋转流萤 */}
                      {fireflySubTab === 'orbiting' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.fireflies.orbitingFireflies}
                            selectedId={effectiveSelectedOrbitingFireflyId}
                            onSelect={(id) => setSelectedOrbitingFireflyId(id)}
                            onToggleEnabled={(id, enabled) => updateOrbitingFirefly(id, { enabled })}
                            onRename={(id, name) => updateOrbitingFirefly(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.fireflies.orbitingFireflies.filter(f => f.id !== id);
                              updatePlanet({ fireflies: { ...planet.fireflies, orbitingFireflies: updated } });
                              if (effectiveSelectedOrbitingFireflyId === id) setSelectedOrbitingFireflyId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.fireflies.orbitingFireflies.find(f => f.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ fireflies: { ...planet.fireflies, orbitingFireflies: [...planet.fireflies.orbitingFireflies, copy] } });
                                setSelectedOrbitingFireflyId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newFirefly = createDefaultOrbitingFirefly(id, `旋转流萤 ${planet.fireflies.orbitingFireflies.length + 1}`);
                              updatePlanet({ fireflies: { ...planet.fireflies, orbitingFireflies: [...planet.fireflies.orbitingFireflies, newFirefly] } });
                              setSelectedOrbitingFireflyId(id);
                            }}
                            onColorChange={(id, color) => updateOrbitingFirefly(id, { color })}
                            globalEnabled={planet.fireflies.orbitingEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ fireflies: { ...planet.fireflies, orbitingEnabled: enabled } })}
                            soloId={soloOrbitingFireflyId}
                            onSoloToggle={setSoloOrbitingFireflyId}
                            title="旋转流萤"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无旋转流萤"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.orbitingFirefly)}
                            builtInPresets={Object.entries(ORBITING_FIREFLY_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                moonShadow: '月影幽灵', guardianPixie: '守护精灵', crimsonEye: '猩红之眼',
                                frostNova: '冰霜新星', aetherCyclone: '以太旋风', prismLight: '棱镜之光'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentOrbitingFirefly ? { ...currentOrbitingFirefly, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentOrbitingFirefly}
                            instanceName="旋转流萤"
                            onApplyToInstance={(data) => {
                              if (currentOrbitingFirefly) {
                                updateOrbitingFirefly(currentOrbitingFirefly.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newFirefly = {
                                ...createDefaultOrbitingFirefly(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.fireflies.orbitingFireflies.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ fireflies: { ...planet.fireflies, orbitingFireflies: [...planet.fireflies.orbitingFireflies, newFirefly] } });
                              setSelectedOrbitingFireflyId(id);
                            }}
                            title="预设"
                            accentColor="teal"
                            moduleName="orbitingFirefly"
                          />

                          {/* 旋转流萤参数 */}
                          {currentOrbitingFirefly && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentOrbitingFirefly.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.orbitingFirefly)}
                                  currentData={currentOrbitingFirefly}
                                  defaultName={currentOrbitingFirefly.name}
                                  accentColor="teal"
                                />
                              </div>

                              {/* 轨道参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>轨道</span>
                                <RangeControl label="轨道半径" value={currentOrbitingFirefly.absoluteOrbitRadius} min={50} max={1000} step={2} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { absoluteOrbitRadius: v })} />
                                <RangeControl label="公转速度" value={currentOrbitingFirefly.orbitSpeed} min={0.1} max={2} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { orbitSpeed: v })} />
                                <div className="flex items-center gap-2 my-1">
                                  <input type="checkbox" checked={currentOrbitingFirefly.billboardOrbit || false} onChange={(e) => updateOrbitingFirefly(currentOrbitingFirefly.id, { billboardOrbit: e.target.checked })} className="w-4 h-4 rounded bg-gray-600" />
                                  <span className="text-xs text-gray-300">描边模式</span>
                                  <span className="text-xs text-gray-500">（轨道始终面向相机）</span>
                                </div>
                                <div className={currentOrbitingFirefly.billboardOrbit ? 'opacity-40 pointer-events-none' : ''}>
                                  <OrbitAxisSelector orbitAxis={currentOrbitingFirefly.orbitAxis} onChange={(orbitAxis) => updateOrbitingFirefly(currentOrbitingFirefly.id, { orbitAxis })} getButtonStyle={getOptionButtonStyle} />
                                  {currentOrbitingFirefly.billboardOrbit && <span className="text-xs text-gray-500 block -mt-1 mb-1">（描边模式下无效）</span>}
                                </div>
                                <RangeControl label="初始相位" value={currentOrbitingFirefly.initialPhase} min={0} max={360} step={15} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { initialPhase: v })} />
                              </div>

                              {/* 外观参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>外观</span>
                                <RangeControl label="大小" value={currentOrbitingFirefly.size} min={1} max={80} step={0.5} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { size: v })} />
                                <RangeControl label="亮度" value={currentOrbitingFirefly.brightness} min={0.5} max={8} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { brightness: v })} />
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-300 w-16">头部样式</span>
                                  <select
                                    value={currentOrbitingFirefly.headStyle || 'flare'}
                                    onChange={(e) => updateOrbitingFirefly(currentOrbitingFirefly.id, { headStyle: e.target.value as any })}
                                    className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
                                  >
                                    <option value="plain">普通圆点</option>
                                    <option value="flare">N叶星芒</option>
                                    <option value="spark">尖锐火花</option>
                                    <option value="texture">贴图</option>
                                    <optgroup label="── 星云粒子形状 ──">
                                      <option value="star">⭐ 星星</option>
                                      <option value="snowflake">❄️ 雪花</option>
                                      <option value="heart">❤️ 爱心</option>
                                      <option value="crescent">🌙 月牙</option>
                                      <option value="crossglow">✨ 十字辉光</option>
                                      <option value="sakura">🌸 樱花</option>
                                      <option value="sun">☀️ 太阳</option>
                                      <option value="sun2">🌟 太阳2</option>
                                      <option value="plum">🌺 梅花</option>
                                      <option value="lily">🌼 百合</option>
                                      <option value="lotus">🪷 莲花</option>
                                      <option value="prism">💎 棱镜晶体</option>
                                    </optgroup>
                                  </select>
                                </div>
                                {currentOrbitingFirefly.headStyle === 'flare' && (
                                  <>
                                    <RangeControl label="星芒强度" value={currentOrbitingFirefly.flareIntensity ?? 1} min={0} max={2} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { flareIntensity: v })} />
                                    <RangeControl label="叶片数" value={currentOrbitingFirefly.flareLeaves ?? 4} min={4} max={8} step={1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { flareLeaves: v })} />
                                    <RangeControl label="星芒宽度" value={currentOrbitingFirefly.flareWidth ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { flareWidth: v })} />
                                    <RangeControl label="色散强度" value={currentOrbitingFirefly.chromaticAberration ?? 0.3} min={0} max={1} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { chromaticAberration: v })} />
                                  </>
                                )}
                                {currentOrbitingFirefly.headStyle === 'texture' && (
                                  <>
                                    <HeadTextureSelect
                                      value={currentOrbitingFirefly.headTexture || ''}
                                      onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { headTexture: v })}
                                    />
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-gray-300 w-16">颜色模式</span>
                                      <select
                                        value={currentOrbitingFirefly.colorMode || 'solid'}
                                        onChange={(e) => updateOrbitingFirefly(currentOrbitingFirefly.id, { colorMode: e.target.value as any })}
                                        className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
                                      >
                                        <option value="solid">纯色（使用配置颜色）</option>
                                        <option value="texture">贴图原色</option>
                                        <option value="tint">混合（贴图×配置色）</option>
                                      </select>
                                    </div>
                                  </>
                                )}
                                <RangeControl label="光晕强度" value={currentOrbitingFirefly.glowIntensity ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { glowIntensity: v })} />
                                <RangeControl label="脉冲速度" value={currentOrbitingFirefly.pulseSpeed ?? 1} min={0} max={10} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { pulseSpeed: v })} />
                              </div>

                              {/* 动态效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>动态效果</span>
                                <RangeControl label="速度拉伸" value={currentOrbitingFirefly.velocityStretch ?? 0} min={0} max={2} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { velocityStretch: v })} />
                                <RangeControl label="噪声扰动" value={currentOrbitingFirefly.noiseAmount ?? 0.2} min={0} max={1} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { noiseAmount: v })} />
                              </div>

                              {/* 拖尾参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">拖尾</span>
                                  <button
                                    onClick={() => updateOrbitingFirefly(currentOrbitingFirefly.id, { trailEnabled: !currentOrbitingFirefly.trailEnabled })}
                                    className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                    style={{
                                      background: currentOrbitingFirefly.trailEnabled
                                        ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                        : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
                                    }}
                                  />
                                </div>
                                <RangeControl label="拖尾长度" value={currentOrbitingFirefly.trailLength} min={1} max={1000} step={5} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { trailLength: v })} />
                                <RangeControl label="粗细衰减" value={currentOrbitingFirefly.trailTaperPower ?? 1.0} min={0.3} max={3} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { trailTaperPower: v })} />
                                <RangeControl label="拖尾透明度" value={currentOrbitingFirefly.trailOpacity ?? 0.8} min={0} max={1} step={0.1} onChange={(v) => updateOrbitingFirefly(currentOrbitingFirefly.id, { trailOpacity: v })} />
                              </div>

                              {/* 轨道波动 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-400">轨道半径波动</span>
                                  <button
                                    onClick={() => {
                                      const wave = currentOrbitingFirefly.radiusWave || { enabled: false, amplitude: 20, frequency: 0.5, randomPhase: true, waveType: 'sine' as const };
                                      updateOrbitingFirefly(currentOrbitingFirefly.id, { radiusWave: { ...wave, enabled: !wave.enabled } });
                                    }}
                                    className="w-3 h-3 rounded-full cursor-pointer transition-all"
                                    style={{
                                      background: (currentOrbitingFirefly.radiusWave?.enabled ?? false)
                                        ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e 50%, #15803d)'
                                        : 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 50%, #b91c1c)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-400 w-16">波形</span>
                                  <select value={currentOrbitingFirefly.radiusWave?.waveType || 'sine'} onChange={(e) => {
                                    const wave = currentOrbitingFirefly.radiusWave || { enabled: false, amplitude: 20, frequency: 0.5, randomPhase: true, waveType: 'sine' as const };
                                    updateOrbitingFirefly(currentOrbitingFirefly.id, { radiusWave: { ...wave, waveType: e.target.value as 'sine' | 'triangle' } });
                                  }} className="flex-1 text-xs bg-gray-700 rounded px-2 py-1 text-white cursor-pointer">
                                    <option value="sine">正弦波（平滑）</option>
                                    <option value="triangle">三角波（锐利）</option>
                                  </select>
                                </div>
                                <RangeControl label="波动幅度" value={currentOrbitingFirefly.radiusWave?.amplitude ?? 20} min={5} max={100} step={5} onChange={(v) => {
                                  const wave = currentOrbitingFirefly.radiusWave || { enabled: false, amplitude: 20, frequency: 0.5, randomPhase: true, waveType: 'sine' as const };
                                  updateOrbitingFirefly(currentOrbitingFirefly.id, { radiusWave: { ...wave, amplitude: v } });
                                }} />
                                <RangeControl label="波动频率" value={currentOrbitingFirefly.radiusWave?.frequency ?? 0.5} min={0.1} max={3} step={0.1} onChange={(v) => {
                                  const wave = currentOrbitingFirefly.radiusWave || { enabled: false, amplitude: 20, frequency: 0.5, randomPhase: true, waveType: 'sine' as const };
                                  updateOrbitingFirefly(currentOrbitingFirefly.id, { radiusWave: { ...wave, frequency: v } });
                                }} />
                                <div className="flex items-center gap-2 mt-1">
                                  <input type="checkbox" checked={currentOrbitingFirefly.radiusWave?.randomPhase ?? true} onChange={(e) => {
                                    const wave = currentOrbitingFirefly.radiusWave || { enabled: false, amplitude: 20, frequency: 0.5, randomPhase: true, waveType: 'sine' as const };
                                    updateOrbitingFirefly(currentOrbitingFirefly.id, { radiusWave: { ...wave, randomPhase: e.target.checked } });
                                  }} className="w-4 h-4 rounded bg-gray-600" />
                                  <span className="text-xs text-gray-300">随机相位</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 游走流萤 */}
                      {fireflySubTab === 'wandering' && (
                        <div className="border-l-2 pl-2" style={{ borderColor: 'var(--ui-decoration)' }}>
                          <FloatingListSelector
                            items={planet.fireflies.wanderingGroups}
                            selectedId={effectiveSelectedWanderingGroupId}
                            onSelect={(id) => setSelectedWanderingGroupId(id)}
                            onToggleEnabled={(id, enabled) => updateWanderingGroup(id, { enabled })}
                            onRename={(id, name) => updateWanderingGroup(id, { name })}
                            onDelete={(id) => {
                              const updated = planet.fireflies.wanderingGroups.filter(g => g.id !== id);
                              updatePlanet({ fireflies: { ...planet.fireflies, wanderingGroups: updated } });
                              if (effectiveSelectedWanderingGroupId === id) setSelectedWanderingGroupId(updated[0]?.id || null);
                            }}
                            onCopy={(id) => {
                              const source = planet.fireflies.wanderingGroups.find(g => g.id === id);
                              if (source) {
                                const newId = Date.now().toString();
                                const copy = { ...source, id: newId, name: `${source.name} 副本` };
                                updatePlanet({ fireflies: { ...planet.fireflies, wanderingGroups: [...planet.fireflies.wanderingGroups, copy] } });
                                setSelectedWanderingGroupId(newId);
                              }
                            }}
                            onAdd={() => {
                              const id = Date.now().toString();
                              const newGroup = createDefaultWanderingGroup(id, `游走流萤 ${planet.fireflies.wanderingGroups.length + 1}`);
                              updatePlanet({ fireflies: { ...planet.fireflies, wanderingGroups: [...planet.fireflies.wanderingGroups, newGroup] } });
                              setSelectedWanderingGroupId(id);
                            }}
                            onColorChange={(id, color) => updateWanderingGroup(id, { color })}
                            globalEnabled={planet.fireflies.wanderingEnabled}
                            onGlobalToggle={(enabled) => updatePlanet({ fireflies: { ...planet.fireflies, wanderingEnabled: enabled } })}
                            title="游走流萤组"
                            titleStyle={{ color: 'var(--ui-secondary)' }}
                            addButtonColor="bg-blue-600 hover:bg-blue-500"
                            emptyText="暂无游走流萤组"
                          />

                          {/* 预设列表 */}
                          <PresetListBox
                            storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.wanderingFirefly)}
                            builtInPresets={Object.entries(WANDERING_FIREFLY_PRESETS).map(([id, data]) => ({
                              id,
                              name: {
                                midsummer: '仲夏夜之梦', ghostFire: '幽蓝鬼火', crimsonEmber: '绯红余烬',
                                holyParticle: '圣光微粒', sakuraFall: '樱花落', neonPulse: '霓虹脉冲'
                              }[id] || id,
                              data
                            }))}
                            currentData={currentWanderingGroup ? { ...currentWanderingGroup, id: undefined, name: undefined, enabled: undefined } : null}
                            hasInstance={!!currentWanderingGroup}
                            instanceName="游走流萤组"
                            onApplyToInstance={(data) => {
                              if (currentWanderingGroup) {
                                updateWanderingGroup(currentWanderingGroup.id, { ...data });
                              }
                            }}
                            onCreateInstance={(data, presetName) => {
                              const id = Date.now().toString();
                              const newGroup = {
                                ...createDefaultWanderingGroup(id, `${presetName.replace(/^[^\s]+\s/, '')} ${planet.fireflies.wanderingGroups.length + 1}`),
                                ...data,
                                enabled: true
                              };
                              updatePlanet({ fireflies: { ...planet.fireflies, wanderingGroups: [...planet.fireflies.wanderingGroups, newGroup] } });
                              setSelectedWanderingGroupId(id);
                            }}
                            title="预设"
                            accentColor="green"
                            moduleName="wanderingFirefly"
                          />

                          {/* 游走流萤组参数 */}
                          {currentWanderingGroup && (
                            <div className="mt-3 space-y-2">
                              {/* 当前编辑 + 保存预设 */}
                              <div className="mb-2 p-1.5 rounded flex items-center justify-between" style={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                backdropFilter: 'blur(8px)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span className="text-xs" style={{ color: 'var(--ui-edit-bar)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>编辑: {currentWanderingGroup.name}</span>
                                <SavePresetButton
                                  storageKey={getUserScopedKey(PRESET_STORAGE_KEYS.wanderingFirefly)}
                                  currentData={currentWanderingGroup}
                                  defaultName={currentWanderingGroup.name}
                                  accentColor="green"
                                />
                              </div>

                              {/* 数量和边界 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>数量与边界</span>
                                <RangeControl label="数量" value={currentWanderingGroup.count} min={1} max={1000} step={1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { count: v })} />
                                <RangeControl label="内边界(R)" value={currentWanderingGroup.innerRadius} min={0.5} max={5} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { innerRadius: v })} />
                                <RangeControl label="外边界(R)" value={currentWanderingGroup.outerRadius} min={1} max={15} step={0.5} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { outerRadius: v })} />
                              </div>

                              {/* 运动参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>运动</span>
                                <RangeControl label="移动速度" value={currentWanderingGroup.speed} min={0.1} max={2} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { speed: v })} />
                                <RangeControl label="转向频率" value={currentWanderingGroup.turnFrequency} min={0} max={1} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { turnFrequency: v })} />
                              </div>

                              {/* 外观参数 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>外观</span>
                                <RangeControl label="大小" value={currentWanderingGroup.size} min={1} max={80} step={1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { size: v })} />
                                <RangeControl label="亮度" value={currentWanderingGroup.brightness || 1.0} min={0.5} max={8} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { brightness: v })} />
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-300 w-16">头部样式</span>
                                  <select
                                    value={currentWanderingGroup.headStyle || 'flare'}
                                    onChange={(e) => updateWanderingGroup(currentWanderingGroup.id, { headStyle: e.target.value as any })}
                                    className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
                                  >
                                    <option value="plain">普通圆点</option>
                                    <option value="flare">N叶星芒</option>
                                    <option value="spark">尖锐火花</option>
                                    <option value="texture">贴图</option>
                                    <optgroup label="── 星云粒子形状 ──">
                                      <option value="star">⭐ 星星</option>
                                      <option value="snowflake">❄️ 雪花</option>
                                      <option value="heart">❤️ 爱心</option>
                                      <option value="crescent">🌙 月牙</option>
                                      <option value="crossglow">✨ 十字辉光</option>
                                      <option value="sakura">🌸 樱花</option>
                                      <option value="sun">☀️ 太阳</option>
                                      <option value="sun2">🌟 太阳2</option>
                                      <option value="plum">🌺 梅花</option>
                                      <option value="lily">🌼 百合</option>
                                      <option value="lotus">🪷 莲花</option>
                                      <option value="prism">💎 棱镜晶体</option>
                                    </optgroup>
                                  </select>
                                </div>
                                {currentWanderingGroup.headStyle === 'flare' && (
                                  <>
                                    <RangeControl label="星芒强度" value={currentWanderingGroup.flareIntensity ?? 1} min={0} max={2} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { flareIntensity: v })} />
                                    <RangeControl label="叶片数" value={currentWanderingGroup.flareLeaves ?? 4} min={4} max={8} step={1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { flareLeaves: v })} />
                                    <RangeControl label="星芒宽度" value={currentWanderingGroup.flareWidth ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { flareWidth: v })} />
                                    <RangeControl label="色散强度" value={currentWanderingGroup.chromaticAberration ?? 0.3} min={0} max={1} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { chromaticAberration: v })} />
                                  </>
                                )}
                                {currentWanderingGroup.headStyle === 'texture' && (
                                  <>
                                    <HeadTextureSelect
                                      value={currentWanderingGroup.headTexture || ''}
                                      onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { headTexture: v })}
                                    />
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-gray-300 w-16">颜色模式</span>
                                      <select
                                        value={currentWanderingGroup.colorMode || 'solid'}
                                        onChange={(e) => updateWanderingGroup(currentWanderingGroup.id, { colorMode: e.target.value as any })}
                                        className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
                                      >
                                        <option value="solid">纯色（使用配置颜色）</option>
                                        <option value="texture">贴图原色</option>
                                        <option value="tint">混合（贴图×配置色）</option>
                                      </select>
                                    </div>
                                  </>
                                )}
                                <RangeControl label="光晕强度" value={currentWanderingGroup.glowIntensity ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { glowIntensity: v })} />
                                <RangeControl label="脉冲速度" value={currentWanderingGroup.pulseSpeed ?? 1.5} min={0} max={10} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { pulseSpeed: v })} />
                              </div>

                              {/* 动态效果 */}
                              <div className="p-2 bg-gray-800/50 rounded">
                                <span className="text-xs block mb-2" style={{ color: 'var(--ui-secondary)' }}>动态效果</span>
                                <RangeControl label="速度拉伸" value={currentWanderingGroup.velocityStretch ?? 0.5} min={0} max={2} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { velocityStretch: v })} />
                                <RangeControl label="噪声扰动" value={currentWanderingGroup.noiseAmount ?? 0.2} min={0} max={1} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { noiseAmount: v })} />
                                <RangeControl label="粗细衰减" value={currentWanderingGroup.trailTaperPower ?? 1.0} min={0.3} max={3} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { trailTaperPower: v })} />
                                <RangeControl label="拖尾透明度" value={currentWanderingGroup.trailOpacity ?? 0.8} min={0} max={1} step={0.1} onChange={(v) => updateWanderingGroup(currentWanderingGroup.id, { trailOpacity: v })} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ControlGroup>
                  );
                })()}
              </>
            );
          })()}

          {/* 未选择星球时的提示 */}
          {planetTab === 'basic' && !selectedPlanetId && (
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <p className="text-xs text-gray-400">请先在上方星球列表中选择一个星球</p>
            </div>
          )}

          {/* ========== 特殊效果 Tab ========== */}
          {planetTab === 'visual' && (
            <>
              {/* 视觉效果 */}
              <ControlGroup title="🎨 视觉效果">
                <RangeControl label="Bloom 辉光" value={planetSettings.bloomStrength} min={0} max={10} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, bloomStrength: v }))} />
              </ControlGroup>

              {/* 动态效果 */}
              <ControlGroup title="🌊 动态效果">
                {/* 呼吸 */}
                <div className="mb-3 p-2 bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span className="font-medium">呼吸效果</span>
                    <button
                      onClick={() => setPlanetSettings(prev => ({ ...prev, breathingEnabled: !prev.breathingEnabled }))}
                      className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                      style={{
                        background: planetSettings.breathingEnabled ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: planetSettings.breathingEnabled ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                        color: planetSettings.breathingEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {planetSettings.breathingEnabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                  {planetSettings.breathingEnabled && (
                    <div className="space-y-1">
                      <RangeControl label="呼吸速度" value={planetSettings.breathingSpeed} min={0.1} max={2} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, breathingSpeed: v }))} />
                      <RangeControl label="呼吸幅度" value={planetSettings.breathingIntensity} min={0.05} max={0.5} step={0.05} onChange={(v) => setPlanetSettings(prev => ({ ...prev, breathingIntensity: v }))} />
                    </div>
                  )}
                </div>

                {/* 游走闪电 */}
                <div className="mb-3 p-2 bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span className="font-medium">游走闪电</span>
                    <button
                      onClick={() => setPlanetSettings(prev => ({ ...prev, wanderingLightningEnabled: !prev.wanderingLightningEnabled }))}
                      className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                      style={{
                        background: planetSettings.wanderingLightningEnabled ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: planetSettings.wanderingLightningEnabled ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                        color: planetSettings.wanderingLightningEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {planetSettings.wanderingLightningEnabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                  {planetSettings.wanderingLightningEnabled && (
                    <div className="space-y-1">
                      <RangeControl label="闪电强度" value={planetSettings.wanderingLightningIntensity} min={0} max={2} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, wanderingLightningIntensity: v }))} />
                      <RangeControl label="游走速度" value={planetSettings.wanderingLightningSpeed} min={0.1} max={3} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, wanderingLightningSpeed: v }))} />
                      <RangeControl label="闪电密度" value={planetSettings.wanderingLightningDensity} min={1} max={10} step={1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, wanderingLightningDensity: v }))} />
                      <RangeControl label="闪电宽度" value={planetSettings.wanderingLightningWidth} min={1} max={10} step={1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, wanderingLightningWidth: v }))} />
                    </div>
                  )}
                </div>

                {/* 闪电击穿 */}
                <div className="p-2 bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span className="font-medium">闪电击穿</span>
                    <button
                      onClick={() => setPlanetSettings(prev => ({ ...prev, lightningBreakdownEnabled: !prev.lightningBreakdownEnabled }))}
                      className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                      style={{
                        background: planetSettings.lightningBreakdownEnabled ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: planetSettings.lightningBreakdownEnabled ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                        color: planetSettings.lightningBreakdownEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {planetSettings.lightningBreakdownEnabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                  {planetSettings.lightningBreakdownEnabled && (
                    <div className="space-y-1">
                      <RangeControl label="击穿强度" value={planetSettings.lightningBreakdownIntensity} min={0} max={3} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, lightningBreakdownIntensity: v }))} />
                      <RangeControl label="击穿频率" value={planetSettings.lightningBreakdownFrequency} min={0.1} max={2} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, lightningBreakdownFrequency: v }))} />
                      <RangeControl label="分支数" value={planetSettings.lightningBreakdownBranches} min={1} max={5} step={1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, lightningBreakdownBranches: v }))} />
                    </div>
                  )}
                </div>
              </ControlGroup>

              {/* 上升效果 */}
              <ControlGroup title="🌟 上升效果">
                {/* 璀璨星雨 */}
                <div className="mb-3 p-2 bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span className="font-medium">璀璨星雨</span>
                    <button
                      onClick={() => setPlanetSettings(prev => ({ ...prev, starRainEnabled: !prev.starRainEnabled }))}
                      className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                      style={{
                        background: planetSettings.starRainEnabled ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: planetSettings.starRainEnabled ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                        color: planetSettings.starRainEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {planetSettings.starRainEnabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                  {planetSettings.starRainEnabled && (
                    <div className="space-y-1">
                      <RangeControl label="粒子数量" value={planetSettings.starRainCount} min={50} max={1500} step={50} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainCount: v }))} />
                      <RangeControl label="粒子大小" value={planetSettings.starRainSize} min={1} max={15} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainSize: v }))} />
                      <RangeControl label="上升速度" value={planetSettings.starRainSpeed} min={0.1} max={5} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainSpeed: v }))} />
                      <RangeControl label="速度差异" value={planetSettings.starRainSpeedVariation} min={0} max={1} step={0.05} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainSpeedVariation: v }))} />
                      <RangeControl label="上升高度" value={planetSettings.starRainHeight} min={50} max={1000} step={25} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainHeight: v }))} />
                      <RangeControl label="扩散范围" value={planetSettings.starRainSpread} min={20} max={500} step={10} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainSpread: v }))} />
                      <RangeControl label="拖尾长度" value={planetSettings.starRainTrailLength} min={0} max={10} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainTrailLength: v }))} />
                      <RangeControl label="亮度" value={planetSettings.starRainBrightness} min={0.3} max={5} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, starRainBrightness: v }))} />
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">颜色</span>
                          <input type="color" value={planetSettings.starRainColor} onChange={(e) => setPlanetSettings(prev => ({ ...prev, starRainColor: e.target.value }))} className="w-8 h-6 rounded cursor-pointer" />
                        </div>
                        <button
                          onClick={() => setPlanetSettings(prev => ({ ...prev, starRainReverse: !prev.starRainReverse }))}
                          className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                          style={{
                            background: planetSettings.starRainReverse ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                            backdropFilter: 'blur(8px)',
                            border: planetSettings.starRainReverse ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                            color: planetSettings.starRainReverse ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {planetSettings.starRainReverse ? '下落' : '上升'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">头部样式</span>
                        <select
                          value={planetSettings.starRainHeadStyle || 'plain'}
                          onChange={(e) => setPlanetSettings(prev => ({ ...prev, starRainHeadStyle: e.target.value as 'plain' | 'star' }))}
                          className="flex-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
                        >
                          <option value="plain">普通圆点</option>
                          <option value="star">星形</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 体积薄雾 */}
                <div className="p-2 bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                    <span className="font-medium">体积薄雾</span>
                    <button
                      onClick={() => setPlanetSettings(prev => ({ ...prev, volumeFogEnabled: !prev.volumeFogEnabled }))}
                      className="px-2 py-0.5 text-[10px] rounded transition-all font-medium"
                      style={{
                        background: planetSettings.volumeFogEnabled ? 'rgba(var(--ui-secondary-rgb, 165, 180, 252), 0.3)' : 'rgba(120, 120, 120, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: planetSettings.volumeFogEnabled ? '1px solid var(--ui-secondary)' : '1px solid rgba(255,255,255,0.1)',
                        color: planetSettings.volumeFogEnabled ? 'var(--ui-secondary)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {planetSettings.volumeFogEnabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                  {planetSettings.volumeFogEnabled && (
                    <div className="space-y-1">
                      <RangeControl label="层数" value={planetSettings.volumeFogLayers} min={3} max={30} step={1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, volumeFogLayers: v }))} />
                      <RangeControl label="半径" value={planetSettings.volumeFogOuterRadius} min={50} max={1000} step={10} onChange={(v) => setPlanetSettings(prev => ({ ...prev, volumeFogOuterRadius: v }))} />
                      <RangeControl label="高度范围" value={planetSettings.volumeFogHeight} min={50} max={1000} step={10} onChange={(v) => setPlanetSettings(prev => ({ ...prev, volumeFogHeight: v }))} />
                      <RangeControl label="透明度" value={planetSettings.volumeFogOpacity} min={0.05} max={0.3} step={0.01} onChange={(v) => setPlanetSettings(prev => ({ ...prev, volumeFogOpacity: v }))} />
                      <RangeControl label="流动速度" value={planetSettings.volumeFogSpeed} min={0.1} max={5} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, volumeFogSpeed: v }))} />
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-400">颜色</span>
                        <input type="color" value={planetSettings.volumeFogColor} onChange={(e) => setPlanetSettings(prev => ({ ...prev, volumeFogColor: e.target.value }))} className="w-8 h-6 rounded cursor-pointer" />
                      </div>
                    </div>
                  )}
                </div>
              </ControlGroup>

              <p className="text-xs text-gray-500 text-center mt-2">特殊效果为全局设置，不保存到单个星球</p>
            </>
          )}

          {/* ========== 星系交互 Tab ========== */}
          {planetTab === 'interact' && (
            <>
              <ControlGroup title="👆 手势交互">
                {/* 手势控制开关 */}
                <div className="flex items-center justify-between mb-3 p-2 bg-gray-800 rounded">
                  <span className="text-xs text-gray-300">手势控制</span>
                  <button
                    onClick={() => setGestureEnabled(!gestureEnabled)}
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${gestureEnabled
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-400'
                      }`}
                  >
                    {gestureEnabled ? '已开启' : '已关闭'}
                  </button>
                </div>

                <div className="p-2 bg-gray-800/50 rounded text-xs text-gray-400 mb-3">
                  <p>✋ 张开手掌 → 超新星爆发</p>
                  <p>✊ 握拳 → 黑洞吸引</p>
                </div>
              </ControlGroup>

              <ControlGroup title="超新星爆发">
                <RangeControl label="膨胀距离" value={planetSettings.explosionExpansion ?? 300} min={50} max={800} step={10} onChange={(v) => setPlanetSettings(prev => ({ ...prev, explosionExpansion: v }))} />
                <RangeControl label="湍流强度" value={planetSettings.explosionTurbulence ?? 80} min={0} max={200} step={5} onChange={(v) => setPlanetSettings(prev => ({ ...prev, explosionTurbulence: v }))} />
                <RangeControl label="旋转角度" value={planetSettings.explosionRotation ?? 0.4} min={0} max={2} step={0.1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, explosionRotation: v }))} />
                <RangeControl label="粒子放大" value={planetSettings.explosionSizeBoost ?? 8} min={0} max={30} step={1} onChange={(v) => setPlanetSettings(prev => ({ ...prev, explosionSizeBoost: v }))} />
                <RangeControl label="恢复速度" value={planetSettings.explosionRecoverySpeed ?? 0.15} min={0.01} max={0.5} step={0.01} onChange={(v) => setPlanetSettings(prev => ({ ...prev, explosionRecoverySpeed: v }))} />
              </ControlGroup>

              <ControlGroup title="黑洞效果">
                <RangeControl label="Z轴压缩" value={planetSettings.blackHoleCompression ?? 0.05} min={0.01} max={0.5} step={0.01} onChange={(v) => setPlanetSettings(prev => ({ ...prev, blackHoleCompression: v }))} />
                <RangeControl label="旋转速度" value={planetSettings.blackHoleSpinSpeed ?? 400} min={50} max={1000} step={10} onChange={(v) => setPlanetSettings(prev => ({ ...prev, blackHoleSpinSpeed: v }))} />
                <RangeControl label="收缩半径" value={planetSettings.blackHoleTargetRadius ?? 30} min={5} max={100} step={5} onChange={(v) => setPlanetSettings(prev => ({ ...prev, blackHoleTargetRadius: v }))} />
                <RangeControl label="吸引强度" value={planetSettings.blackHolePull ?? 0.95} min={0.5} max={1.0} step={0.01} onChange={(v) => setPlanetSettings(prev => ({ ...prev, blackHolePull: v }))} />
                <RangeControl label="恢复速度" value={planetSettings.blackHoleRecoverySpeed ?? 0.15} min={0.01} max={0.5} step={0.01} onChange={(v) => setPlanetSettings(prev => ({ ...prev, blackHoleRecoverySpeed: v }))} />
              </ControlGroup>

              <ControlGroup title="📷 相机设置">
                {/* 相机自动旋转开关 */}
                <div className="flex items-center justify-between mb-3 p-2 bg-gray-800 rounded">
                  <span className="text-xs text-gray-300">视角自动旋转</span>
                  <button
                    onClick={() => setPlanetSettings(prev => ({ ...prev, cameraAutoRotate: !prev.cameraAutoRotate }))}
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${planetSettings.cameraAutoRotate
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-400'
                      }`}
                  >
                    {planetSettings.cameraAutoRotate ? '已开启' : '已关闭'}
                  </button>
                </div>

                {planetSettings.cameraAutoRotate && (
                  <RangeControl
                    label="旋转速度"
                    value={planetSettings.cameraAutoRotateSpeed}
                    min={0.1}
                    max={2}
                    step={0.1}
                    onChange={(v) => setPlanetSettings(prev => ({ ...prev, cameraAutoRotateSpeed: v }))}
                  />
                )}
              </ControlGroup>

              <div className="p-4 bg-gray-800 rounded-lg">
                <h4 className="text-xs font-bold text-white mb-2">交互说明</h4>
                <ul className="text-xs text-gray-400 list-disc pl-4 space-y-1">
                  <li><strong>鼠标/触控:</strong> 旋转视角</li>
                  <li><strong>滚轮:</strong> 缩放视角</li>
                  <li><strong>手掌平移:</strong> 推动/吸引粒子</li>
                  <li><strong>自动旋转:</strong> 相机缓慢环绕星球</li>
                </ul>
              </div>
            </>
          )}
        </>
      )
      }

      {/* 通用确认弹窗 */}
      <TransparentModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
      />

      {/* 通用输入弹窗 */}
      <InputModal
        isOpen={inputModal.isOpen}
        onClose={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={inputModal.onConfirm}
        title={inputModal.title}
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
      />
    </div >
  );
};

export default ControlPanel;