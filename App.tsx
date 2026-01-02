/**
 * input: 用户交互与本地存储（settings/planetSceneSettings）、图片处理结果、手势数据
 * output: 应用根组件（模式切换、状态管理、向各场景/控制面板下发 settings 与回调）
 * pos: 全局状态（含主题/材质配置）与参数流的中枢（UI -> state -> 渲染组件 uniforms）
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useState, useEffect, useRef } from 'react';
import NebulaScene from './components/NebulaScene';
import PlanetScene, { CameraInfo } from './components/PlanetScene';
import ControlPanel from './components/ControlPanel';
import GestureHandler from './components/GestureHandler';
import { UserProvider, useUser } from './contexts/UserContext';
import { UserMenu } from './components/UserMenu';
import { UserLogin } from './components/UserLogin';
import AIAssistantPanel from './components/AIAssistantPanel';
import { AppSettings, HandData, AppMode, PlanetSceneSettings, NebulaInstance, NebulaBlendMode, ThemeConfig, MaterialSettings, MaterialPreset, NebulaPreset } from './types';
import {
  DEFAULT_SETTINGS,
  SAMPLE_IMAGES,
  getPerformanceAdjustedSettings,
  DEFAULT_PLANET_SCENE_SETTINGS,
  PLANET_SCENE_STORAGE_KEY,
  createDefaultPlanet,
  DEFAULT_NEBULA_INSTANCE,
  DEFAULT_THEME_CONFIG,
  DEFAULT_COLOR_SCHEMES,
  DEFAULT_MATERIAL_SETTINGS,
  BUILT_IN_MATERIAL_PRESETS,
  createDefaultMaterialConfig
} from './constants';
import { generateMaterialStyle } from './utils/materialStyle';
import { processImage, ProcessedData, extractDominantColors } from './services/imageProcessing';

// LocalStorage key for settings persistence
const SETTINGS_STORAGE_KEY = 'nebula-viz-settings';

// 数据版本 - 更新此版本号会自动清除旧数据
const DATA_VERSION = 70;
const DATA_VERSION_KEY = 'nebula-viz-data-version';

// 用户隔离的 localStorage 键生成函数
const getUserScopedStorageKey = (baseKey: string, userId?: string | null): string => {
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  return baseKey;
};

// 检查并清除旧版本数据
const checkAndClearOldData = () => {
  try {
    const savedVersion = localStorage.getItem(DATA_VERSION_KEY);
    if (savedVersion !== String(DATA_VERSION)) {
      console.log('检测到旧版本数据，正在清除...');
      // 清除所有相关数据（注意：只清除全局键，用户隔离的键保留）
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      localStorage.removeItem(PLANET_SCENE_STORAGE_KEY);
      localStorage.removeItem('solidCorePresets');
      localStorage.removeItem('planetTemplates');
      // 更新版本号
      localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION));
      console.log('旧数据已清除，使用默认设置');
    }
  } catch (e) {
    console.warn('版本检查失败:', e);
  }
};

// 应用启动时检查数据版本
checkAndClearOldData();

// 加载星球场景设置（支持用户隔离）
const loadPlanetSceneSettings = (userId?: string | null): PlanetSceneSettings => {
  try {
    const key = getUserScopedStorageKey(PLANET_SCENE_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_PLANET_SCENE_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load planet scene settings:', e);
  }
  return DEFAULT_PLANET_SCENE_SETTINGS;
};

// 保存星球场景设置（支持用户隔离）
const savePlanetSceneSettings = (settings: PlanetSceneSettings, userId?: string | null) => {
  try {
    const key = getUserScopedStorageKey(PLANET_SCENE_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save planet scene settings:', e);
  }
};

// Load settings from localStorage（支持用户隔离）
const loadSavedSettings = (userId?: string | null): AppSettings => {
  try {
    const key = getUserScopedStorageKey(SETTINGS_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new settings added in updates
      // Always use latest maxParticles from defaults (don't restore old limits)
      const result = { ...DEFAULT_SETTINGS, ...parsed, maxParticles: DEFAULT_SETTINGS.maxParticles };
      // 合并星云实例的默认属性（处理旧版本数据缺少新属性的问题）
      if (result.nebulaInstances && Array.isArray(result.nebulaInstances)) {
        result.nebulaInstances = result.nebulaInstances.map((instance: any) => ({
          ...DEFAULT_NEBULA_INSTANCE,
          ...instance,
        }));
      }
      return ensureBackgroundSettings(result);
    }
  } catch (e) {
    console.warn('Failed to load saved settings:', e);
  }
  return getPerformanceAdjustedSettings();
}

// 确保默认设置包含 background (应对旧数据无此字段的情况)
const ensureBackgroundSettings = (settings: AppSettings): AppSettings => {
  if (!settings.background) {
    return {
      ...settings,
      background: {
        enabled: true,
        panoramaUrl: '/background/starfield.jpg',
        brightness: 1.0,
        saturation: 1.0,
        rotation: 0
      }
    };
  }
  return settings;
};

// Save settings to localStorage（支持用户隔离）
const saveSettings = (settings: AppSettings, userId?: string | null) => {
  try {
    // 智能过滤: 只有当存在有效的云端URL(http开头)时才剔除本地Base64
    // 这样既防止了 Quota 溢出(正常情况)，又保证了上传窗口期/离线时数据不丢(兜底)
    const safeSettings = {
      ...settings,
      nebulaInstances: settings.nebulaInstances?.map(inst => ({
        ...inst,
        imageDataUrl: (inst.imageUrl && inst.imageUrl.startsWith('http'))
          ? undefined
          : inst.imageDataUrl
      }))
    };
    const key = getUserScopedStorageKey(SETTINGS_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify(safeSettings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
};

// ==================== 主题与材质配置加载/保存 ====================

const THEME_CONFIG_STORAGE_KEY = 'nebula_theme_config_v1';
const MATERIAL_SETTINGS_STORAGE_KEY = 'nebula_material_settings_v1';
const MATERIAL_PRESETS_STORAGE_KEY = 'nebula_material_presets_v1';

// 加载主题配置（支持用户隔离）
const loadThemeConfig = (userId?: string | null): ThemeConfig => {
  try {
    const key = getUserScopedStorageKey(THEME_CONFIG_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 合并默认系统预设（处理新增预设）
      const schemes = { ...DEFAULT_COLOR_SCHEMES };
      // 过滤已删除的系统预设
      const deletedIds = parsed.deletedSystemSchemeIds || [];
      deletedIds.forEach((id: string) => { delete schemes[id]; });
      // 合并用户方案
      Object.entries(parsed.schemes || {}).forEach(([id, scheme]) => {
        if (!(scheme as any).isSystem) {
          schemes[id] = scheme as any;
        }
      });
      return {
        schemes,
        activeSchemeId: parsed.activeSchemeId || 'midnight',
        activeColors: parsed.activeColors || DEFAULT_THEME_CONFIG.activeColors,
        consoleBg: parsed.consoleBg || '#000000',
        deletedSystemSchemeIds: deletedIds
      };
    }
  } catch (e) {
    console.warn('Failed to load theme config:', e);
  }
  return { ...DEFAULT_THEME_CONFIG };
};

// 保存主题配置（支持用户隔离）
const saveThemeConfig = (config: ThemeConfig, userId?: string | null) => {
  try {
    // 只保存用户方案和状态，不保存系统预设
    const userSchemes: Record<string, any> = {};
    Object.entries(config.schemes).forEach(([id, scheme]) => {
      if (!scheme.isSystem) {
        userSchemes[id] = scheme;
      }
    });
    const key = getUserScopedStorageKey(THEME_CONFIG_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify({
      schemes: userSchemes,
      activeSchemeId: config.activeSchemeId,
      activeColors: config.activeColors,
      consoleBg: config.consoleBg,
      deletedSystemSchemeIds: config.deletedSystemSchemeIds
    }));
  } catch (e) {
    console.warn('Failed to save theme config:', e);
  }
};

// 加载材质设置（支持用户隔离）
const loadMaterialSettings = (userId?: string | null): MaterialSettings => {
  try {
    const key = getUserScopedStorageKey(MATERIAL_SETTINGS_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 兼容旧数据：确保 subModuleTabs 为 Record
      if (parsed.subModuleTabs && parsed.subModuleTabs.type) {
        // 是单一对象，转换为 Record（以前的逻辑把Record转单一，现在的逻辑把单一转Record）
        // 但实际上 ControlPanel 和 ThemeSettingsModal 已经处理了，这里只需删除错误的降级逻辑即可
        // 或者直接保留原样，不做任何处理，直到后面统一迁移
      }
      return { ...DEFAULT_MATERIAL_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load material settings:', e);
  }
  return { ...DEFAULT_MATERIAL_SETTINGS };
};

// 保存材质设置（支持用户隔离）
const saveMaterialSettings = (settings: MaterialSettings, userId?: string | null) => {
  try {
    const key = getUserScopedStorageKey(MATERIAL_SETTINGS_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save material settings:', e);
  }
};

// 加载用户材质预设（支持用户隔离）
const loadUserMaterialPresets = (userId?: string | null): MaterialPreset[] => {
  try {
    const key = getUserScopedStorageKey(MATERIAL_PRESETS_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load material presets:', e);
  }
  return [];
};

// 保存用户材质预设（支持用户隔离）
const saveUserMaterialPresets = (presets: MaterialPreset[], userId?: string | null) => {
  try {
    const key = getUserScopedStorageKey(MATERIAL_PRESETS_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save material presets:', e);
  }
};

// 加载星云预设（支持用户隔离）
const NEBULA_PRESETS_STORAGE_KEY = 'nebula_presets';
const loadNebulaPresets = (userId?: string | null): NebulaPreset[] => {
  try {
    const key = getUserScopedStorageKey(NEBULA_PRESETS_STORAGE_KEY, userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load nebula presets:', e);
  }
  return [];
};

// 保存星云预设（支持用户隔离）
const saveNebulaPresets = (presets: NebulaPreset[], userId?: string | null) => {
  try {
    // 智能过滤: 只有云端URL有效时才剔除Base64
    const safePresets = presets.map(p => ({
      ...p,
      imageDataUrl: (p.imageUrl && p.imageUrl.startsWith('http'))
        ? undefined
        : p.imageDataUrl
    }));
    const key = getUserScopedStorageKey(NEBULA_PRESETS_STORAGE_KEY, userId);
    localStorage.setItem(key, JSON.stringify(safePresets));
  } catch (e) {
    console.warn('Failed to save nebula presets:', e);
  }
};

const App: React.FC = () => {
  // 用户登录状态
  const { currentUser, isLoading: isUserLoading, saveCloudConfig, loadCloudConfig } = useUser();

  // Initialize with default/global settings first
  const [settings, setSettings] = useState<AppSettings>(() => loadSavedSettings(null));
  const [planetSettings, setPlanetSettings] = useState<PlanetSceneSettings>(() => loadPlanetSceneSettings(null));
  const [appMode, setAppMode] = useState<AppMode>('nebula');
  const [overlayMode, setOverlayMode] = useState(false); // 叠加模式：同时显示星云和星球

  const [data, setData] = useState<ProcessedData | null>(null);

  // 主题与材质配置状态（App 作为 SSOT）
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadThemeConfig(null));
  const [materialSettings, setMaterialSettings] = useState<MaterialSettings>(() => loadMaterialSettings(null));
  const [userMaterialPresets, setUserMaterialPresets] = useState<MaterialPreset[]>(() => loadUserMaterialPresets(null));
  const [nebulaPresets, setNebulaPresets] = useState<NebulaPreset[]>(() => loadNebulaPresets(null));
  const [hasHydratedFromCloud, setHasHydratedFromCloud] = useState(false);

  // 星云预览模式
  const [nebulaPreviewMode, setNebulaPreviewMode] = useState(false);

  // 多星云实例的粒子数据缓存
  const [nebulaInstancesData, setNebulaInstancesData] = useState<Map<string, ProcessedData>>(new Map());

  // 追踪已加载云配置的用户ID，防止重复hydration
  const hasLoadedUserIdRef = useRef<string | null>(null);

  // 监听用户切换，从本地存储重新加载该用户的数据
  useEffect(() => {
    const userId = currentUser?.id || null;
    console.log('User changed, reloading local data for:', userId || 'guest');

    setSettings(loadSavedSettings(userId));
    setPlanetSettings(loadPlanetSceneSettings(userId));
    setThemeConfig(loadThemeConfig(userId));
    setMaterialSettings(loadMaterialSettings(userId));
    setUserMaterialPresets(loadUserMaterialPresets(userId));
    setNebulaPresets(loadNebulaPresets(userId));
  }, [currentUser?.id]);

  // Cloud Sync: Load data on user login
  useEffect(() => {
    // 只有当用户ID真正变化时才加载云配置
    if (currentUser && hasLoadedUserIdRef.current !== currentUser.id) {
      hasLoadedUserIdRef.current = currentUser.id;
      loadCloudConfig().then(config => {
        if (config) {
          if (config.settings) {
            const cloudSettings = config.settings;
            // Merge cloud settings with defaults, BUT preserve local imageDataUrl if cloud missing it
            setSettings(prev => {
              const newSettings = { ...prev, ...cloudSettings };
              // Smart merge strategies for nebulaInstances
              if (cloudSettings.nebulaInstances && prev.nebulaInstances) {
                newSettings.nebulaInstances = cloudSettings.nebulaInstances.map((cloudInst: any) => {
                  const localInst = prev.nebulaInstances!.find(p => p.id === cloudInst.id);
                  // If cloud doesn't have image data but local does, keep local
                  if (localInst && !cloudInst.imageDataUrl && localInst.imageDataUrl) {
                    return { ...cloudInst, imageDataUrl: localInst.imageDataUrl };
                  }
                  return cloudInst;
                });
              }
              return newSettings;
            });
            // REMOVED explicit localStorage.setItem here because it was saving the stripped cloud data 
            // and overwriting valid local data. We rely on the debounced effect to save the merged state.
          }
          if (config.presets && Array.isArray(config.presets)) {
            const cloudPresets = config.presets;
            setNebulaPresets(prev => {
              // Smart merge for presets
              const prevList = prev || [];
              return cloudPresets.map((cloudPreset: any) => {
                const localPreset = prevList.find(p => p.id === cloudPreset.id);
                if (localPreset && !cloudPreset.imageDataUrl && localPreset.imageDataUrl) {
                  return { ...cloudPreset, imageDataUrl: localPreset.imageDataUrl };
                }
                return cloudPreset;
              }) as NebulaPreset[];
            });
          }
          if (config.planetScene) {
            setPlanetSettings(prev => ({ ...prev, ...config.planetScene }));
            // REMOVED explicit localStorage write to avoid sync issues
          }
          // 加载主题配置
          if (config.theme?.themeConfig) {
            const cloudTheme = config.theme.themeConfig;
            setThemeConfig(prev => ({
              ...prev,
              activeSchemeId: (cloudTheme as any).activeSchemeId || prev.activeSchemeId,
              activeColors: (cloudTheme as any).activeColors || prev.activeColors,
              consoleBg: (cloudTheme as any).consoleBg || prev.consoleBg,
              deletedSystemSchemeIds: (cloudTheme as any).deletedSystemSchemeIds || prev.deletedSystemSchemeIds
            }));
          }
          // 加载材质配置
          if (config.theme?.materialSettings) {
            setMaterialSettings(prev => ({ ...prev, ...(config.theme!.materialSettings as any) }));
          }
          if (config.theme?.userMaterialPresets) {
            setUserMaterialPresets(config.theme.userMaterialPresets as any);
          }
        }
        setHasHydratedFromCloud(true);
      });
    } else if (!currentUser) {
      hasLoadedUserIdRef.current = null;
      setHasHydratedFromCloud(true); // 未登录时直接标记
    }
  }, [currentUser, loadCloudConfig]);

  // Cloud Sync: Auto-save when settings change (Debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      // Always save to local storage (User Scoped)
      const userId = currentUser?.id || null;
      saveSettings(settings, userId);
      savePlanetSceneSettings(planetSettings, userId);
      saveThemeConfig(themeConfig, userId);
      saveMaterialSettings(materialSettings, userId);
      saveUserMaterialPresets(userMaterialPresets, userId);
      saveNebulaPresets(nebulaPresets, userId);

      // If logged in and hydrated, save to cloud
      if (currentUser && hasHydratedFromCloud) {
        // 过滤掉 imageDataUrl（太大），只同步 imageUrl（云端 URL）
        const presetsForCloud = nebulaPresets.map(preset => ({
          ...preset,
          imageDataUrl: undefined  // 不同步 base64 数据到云端
        }));

        // 同样过滤掉 settings.nebulaInstances 中的 imageDataUrl
        const settingsForCloud = {
          ...settings,
          nebulaInstances: settings.nebulaInstances?.map(instance => ({
            ...instance,
            imageDataUrl: undefined // 不同步 base64 数据到云端
          }))
        };

        saveCloudConfig({
          settings: settingsForCloud as any,
          planetScene: planetSettings as any,
          theme: {

            themeConfig: {
              activeSchemeId: themeConfig.activeSchemeId,
              activeColors: themeConfig.activeColors,
              consoleBg: themeConfig.consoleBg,
              deletedSystemSchemeIds: themeConfig.deletedSystemSchemeIds
            },
            materialSettings,
            userMaterialPresets
          },
          presets: presetsForCloud as any[]
        });
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(handler);
  }, [settings, planetSettings, themeConfig, materialSettings, userMaterialPresets, nebulaPresets, currentUser, hasHydratedFromCloud, saveCloudConfig]);

  // 应用主题 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    const { activeColors, consoleBg } = themeConfig;

    // 控制台背景色
    root.style.setProperty('--custom-dark-bg', consoleBg);

    // 5色主题变量
    root.style.setProperty('--custom-primary', activeColors.primary);
    root.style.setProperty('--custom-secondary', activeColors.secondary);
    root.style.setProperty('--custom-text-accent', activeColors.textAccent);
    root.style.setProperty('--custom-decoration', activeColors.decoration);
    root.style.setProperty('--custom-edit-bar', activeColors.editBar);

    // 计算 secondary 的 RGB 格式（用于透明度混合）
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '165, 180, 252';
    };
    root.style.setProperty('--custom-secondary-rgb', hexToRgb(activeColors.secondary));
  }, [themeConfig.activeColors, themeConfig.consoleBg]);




  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false); // AI 面板状态
  const [fps, setFps] = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);

  // 相机信息状态
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);

  // 取色模式状态
  const [colorPickMode, setColorPickMode] = useState(false);
  const [pickedColor, setPickedColor] = useState<{ h: number; s: number; l: number } | null>(null);

  // Store cached image for re-processing when settings change
  const cachedImageRef = useRef<HTMLImageElement | null>(null);

  // Use ref to access latest settings without causing re-renders
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Shared ref for MediaPipe data to avoid React render cycles for 60fps updates
  const handDataRef = useRef<HandData>({
    isActive: false,
    x: 0,
    y: 0,
    z: 0,
    isPinching: false,
    isClosed: false,
    openness: 0,
    twoHandsActive: false,
    twoHandsDistance: 0
  });

  // Process image with settings
  const doProcessImage = (img: HTMLImageElement, currentSettings: AppSettings) => {
    setIsProcessing(true);
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        console.log("Starting image processing...");
        const processed = processImage(img, currentSettings);
        console.log("Processed result:", processed.count, "particles");
        setData(processed);
      } catch (error) {
        console.error("Failed to process image", error);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Load and process new image
  const handleImageProcess = async (imageSrc: string | File) => {
    setIsProcessing(true);
    console.log("Loading image:", imageSrc);
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      const src = imageSrc instanceof File ? URL.createObjectURL(imageSrc) : imageSrc;
      img.src = src;

      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log("Image loaded successfully:", img.width, "x", img.height);
          resolve(true);
        };
        img.onerror = (e) => {
          console.error("Image load error:", e);
          reject(e);
        };
      });

      // Cache the loaded image for re-processing
      cachedImageRef.current = img;

      // Process the image with current settings
      console.log("Processing image with settings:", settingsRef.current);
      doProcessImage(img, settingsRef.current);

    } catch (error) {
      console.error("Failed to load image", error);
      setIsProcessing(false);
    }
  };

  // Auto re-process when settings that affect geometry change
  const prevSettingsRef = useRef<string>('');

  useEffect(() => {
    // 判断颜色过滤是否真的会影响结果
    // 只有在启用且有实际过滤效果时才包含在 relevantSettings 中
    const colorFilterActive = settings.colorFilter.enabled && (
      settings.colorFilter.filters.some(f => f.enabled) ||
      settings.colorFilter.saturationMin > 0 ||
      settings.colorFilter.saturationMax < 1 ||
      settings.colorFilter.invertMode
    );

    // 判断染色效果是否激活
    const colorTintActive = settings.colorTint.enabled && settings.colorTint.mappings.length > 0;

    const relevantSettings = JSON.stringify({
      density: settings.density,
      threshold: settings.threshold,
      depthMode: settings.depthMode,
      depthInvert: settings.depthInvert,
      depthRange: settings.depthRange,
      maxParticles: settings.maxParticles,
      noiseStrength: settings.noiseStrength,
      // New settings
      waveFrequency: settings.waveFrequency,
      waveAmplitude: settings.waveAmplitude,
      fbmOctaves: settings.fbmOctaves,
      stereoSeparation: settings.stereoSeparation,
      // 只在颜色过滤真正激活时才包含
      colorFilter: colorFilterActive ? settings.colorFilter : null,
      // 染色效果
      colorTint: colorTintActive ? settings.colorTint : null,
      // Edge sampling settings
      edgeSamplingEnabled: settings.edgeSamplingEnabled,
      edgeSensitivity: settings.edgeSensitivity,
      edgeDensityBoost: settings.edgeDensityBoost,
      fillDensity: settings.fillDensity,
      pureOutlineMode: settings.pureOutlineMode,
      edgeCropPercent: settings.edgeCropPercent,
      circularCrop: settings.circularCrop,
    });

    if (prevSettingsRef.current && prevSettingsRef.current !== relevantSettings && cachedImageRef.current) {
      // Settings changed, re-process
      const timer = setTimeout(() => {
        if (cachedImageRef.current) {
          doProcessImage(cachedImageRef.current, settings);
        }
      }, 150);

      prevSettingsRef.current = relevantSettings;
      return () => clearTimeout(timer);
    }

    prevSettingsRef.current = relevantSettings;
  }, [settings.density, settings.threshold, settings.depthMode, settings.depthInvert, settings.depthRange, settings.maxParticles, settings.noiseStrength, settings.waveFrequency, settings.waveAmplitude, settings.fbmOctaves, settings.stereoSeparation, settings.colorFilter, settings.colorTint, settings.edgeSamplingEnabled, settings.edgeSensitivity, settings.edgeDensityBoost, settings.fillDensity, settings.pureOutlineMode, settings.edgeCropPercent, settings.circularCrop]);

  // Save settings to localStorage when they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Save planet settings to localStorage when they change
  useEffect(() => {
    savePlanetSceneSettings(planetSettings);
  }, [planetSettings]);

  // 用于跟踪每个实例的数据版本
  const instanceDataVersionsRef = useRef<Map<string, string>>(new Map());

  // 监听全局颜色过滤和染色设置变化，清除版本记录以触发多星云实例重新处理
  const colorFilterJson = JSON.stringify(settings.colorFilter);
  const colorTintJson = JSON.stringify(settings.colorTint);
  useEffect(() => {
    // 清除所有实例的版本记录，强制重新处理
    instanceDataVersionsRef.current.clear();
  }, [colorFilterJson, colorTintJson]);

  // 使用 JSON.stringify 确保深层变化也能触发更新
  // 包含所有会影响粒子数据生成的参数
  const nebulaInstancesJson = JSON.stringify(
    (settings.nebulaInstances || []).map(n => ({
      id: n.id,
      enabled: n.enabled,
      dataVersion: n.dataVersion,
      density: n.density,
      threshold: n.threshold,
      edgeSamplingEnabled: n.edgeSamplingEnabled,
      edgeSensitivity: n.edgeSensitivity,
      edgeDensityBoost: n.edgeDensityBoost,
      fillDensity: n.fillDensity,
      pureOutlineMode: n.pureOutlineMode,
      depthMode: n.depthMode,
      depthRange: n.depthRange,
      depthInvert: n.depthInvert,
      noiseStrength: n.noiseStrength,
      waveFrequency: n.waveFrequency,
      waveAmplitude: n.waveAmplitude,
      fbmOctaves: n.fbmOctaves,
      stereoSeparation: n.stereoSeparation,
      // 注意：几何映射参数（geometryMapping, mappingStrength 等）通过 shader uniform 实现，
      // 不需要重新生成粒子数据，所以不包含在这里
    }))
  );

  // 处理多星云实例的粒子数据生成
  useEffect(() => {
    const nebulaInstances = settings.nebulaInstances || [];

    // 清理已删除实例的数据
    const instanceIds = new Set(nebulaInstances.map(n => n.id));
    let needCleanup = false;
    nebulaInstancesData.forEach((_, id) => {
      if (!instanceIds.has(id)) {
        needCleanup = true;
      }
    });

    if (needCleanup) {
      const cleanedMap = new Map(nebulaInstancesData);
      cleanedMap.forEach((_, id) => {
        if (!instanceIds.has(id)) {
          cleanedMap.delete(id);
          instanceDataVersionsRef.current.delete(id);
        }
      });
      setNebulaInstancesData(cleanedMap);
    }

    // 为每个星云实例生成粒子数据
    const processInstances = async () => {
      for (const instance of nebulaInstances) {
        if (!instance.enabled) continue;

        // 生成参数签名，用于检测参数变化
        const paramSignature = JSON.stringify({
          density: instance.density,
          threshold: instance.threshold,
          edgeSamplingEnabled: instance.edgeSamplingEnabled,
          edgeSensitivity: instance.edgeSensitivity,
          edgeDensityBoost: instance.edgeDensityBoost,
          fillDensity: instance.fillDensity,
          pureOutlineMode: instance.pureOutlineMode,
          depthMode: instance.depthMode,
          depthRange: instance.depthRange,
          depthInvert: instance.depthInvert,
          noiseStrength: instance.noiseStrength,
          waveFrequency: instance.waveFrequency,
          waveAmplitude: instance.waveAmplitude,
          fbmOctaves: instance.fbmOctaves,
          stereoSeparation: instance.stereoSeparation,
          imageUrl: instance.imageDataUrl || instance.imageUrl,
        });

        // 检查是否需要重新生成（新实例或参数变化）
        const currentSignature = instanceDataVersionsRef.current.get(instance.id);
        const needsRegenerate = currentSignature === undefined || currentSignature !== paramSignature;

        if (!needsRegenerate) continue;

        const imageUrl = instance.imageDataUrl || instance.imageUrl;
        if (!imageUrl) {
          console.warn(`Nebula instance ${instance.id} has no image URL`);
          continue;
        }

        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              // 验证图片尺寸有效
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                resolve();
              } else {
                reject(new Error('Invalid image dimensions'));
              }
            };
            img.onerror = (e) => {
              console.error(`Failed to load image for instance ${instance.id}:`, e);
              reject(e);
            };
            // 设置 src 必须在设置 onload 之后，否则缓存的图片可能不触发 onload
            img.src = imageUrl;
            // 如果图片已缓存，立即检查 complete 状态
            if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
              resolve();
            }
          });

          // 使用实例的独立参数生成粒子数据
          const instanceSettings = {
            ...settings,
            density: instance.density,
            threshold: instance.threshold,
            baseSize: instance.baseSize,
            brightness: instance.brightness,
            opacity: instance.opacity,
            colorSaturation: instance.colorSaturation,
            edgeSamplingEnabled: instance.edgeSamplingEnabled,
            edgeSensitivity: instance.edgeSensitivity,
            edgeDensityBoost: instance.edgeDensityBoost,
            fillDensity: instance.fillDensity,
            pureOutlineMode: instance.pureOutlineMode,
            depthMode: instance.depthMode,
            depthRange: instance.depthRange,
            depthInvert: instance.depthInvert,
            noiseStrength: instance.noiseStrength,
            waveFrequency: instance.waveFrequency,
            waveAmplitude: instance.waveAmplitude,
            fbmOctaves: instance.fbmOctaves,
            stereoSeparation: instance.stereoSeparation,
            geometryMapping: instance.geometryMapping,
            mappingStrength: instance.mappingStrength,
            mappingRadius: instance.mappingRadius,
            mappingTileX: instance.mappingTileX,
            mappingTileY: instance.mappingTileY,
            particleTurbulence: instance.particleTurbulence,
            turbulenceSpeed: instance.turbulenceSpeed,
            turbulenceScale: instance.turbulenceScale,
          };

          const processed = processImage(img, instanceSettings);
          setNebulaInstancesData(prev => {
            const newMap = new Map(prev);
            newMap.set(instance.id, processed);
            return newMap;
          });
          // 记录已处理的参数签名
          instanceDataVersionsRef.current.set(instance.id, paramSignature);
        } catch (error) {
          console.error(`Failed to process nebula instance ${instance.id}:`, error);
        }
      }
    };

    processInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nebulaInstancesJson, settings]);

  // 不再自动加载初始样本，仅在用户点击预设时加载
  // useEffect(() => {
  //   handleImageProcess(SAMPLE_IMAGES[0].url);
  // }, []);

  const handleLoadSample = (url: string) => {
    handleImageProcess(url);
  };

  const handleFileUpload = (file: File) => {
    handleImageProcess(file);
  };

  // 提取主色调
  const handleExtractColors = async () => {
    // 优先使用主星云图片，否则尝试使用当前选中的星云实例图片
    let img: HTMLImageElement | null = cachedImageRef.current;

    if (!img) {
      // 尝试从当前选中的星云实例获取图片
      const selectedInstance = settings.nebulaInstances?.find(n => n.id === settings.selectedNebulaId);
      const imageUrl = selectedInstance?.imageDataUrl || selectedInstance?.imageUrl;

      if (!imageUrl) {
        console.warn('No image loaded for color extraction');
        return;
      }

      // 加载星云实例图片
      try {
        img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        await new Promise<void>((resolve, reject) => {
          img!.onload = () => resolve();
          img!.onerror = reject;
        });
      } catch (error) {
        console.error('Failed to load nebula instance image for color extraction:', error);
        return;
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 使用较小的尺寸加速处理
    const maxSize = 400;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const mappings = extractDominantColors(imageData, settings.colorTint.colorCount);

    setSettings(prev => ({
      ...prev,
      colorTint: {
        ...prev.colorTint,
        mappings
      }
    }));
  };



  // 计算总粒子数
  const calculateTotalParticles = () => {
    let total = 0;

    // 1. 星云粒子
    if (appMode === 'nebula' || overlayMode) {
      if (data) {
        total += data.count;
      }
      // 加上所有启用的星云实例
      if (settings.nebulaInstances) {
        settings.nebulaInstances.forEach(instance => {
          if (instance.enabled) {
            const instanceData = nebulaInstancesData.get(instance.id);
            if (instanceData) {
              total += instanceData.count;
            }
          }
        });
      }
    }

    // 2. 星球粒子
    if (appMode === 'planet' || overlayMode) {
      // 星球模式下始终计算粒子，不检查 planetSettings.enabled (那是创造模式开关)
      // 2.1 星雨
      if (planetSettings.starRainEnabled && planetSettings.starRainCount) {
        total += planetSettings.starRainCount;
      }

      planetSettings.planets.forEach(planet => {
        // 2.2 粒子核心
        if (planet.coreSystem?.coresEnabled && planet.coreSystem.coreType === 'particle') {
          (planet.coreSystem?.cores || []).forEach(core => {
            if (core.enabled) {
              // 估算: 4/3 * PI * R^3 * density * fillPercent/100
              const volume = (4 / 3) * Math.PI * Math.pow(core.baseRadius, 3);
              const particleCount = volume * core.density * (core.fillPercent / 100) * 0.001; // 0.001是缩放因子
              total += Math.max(1000, particleCount); // 至少1000粒子
            }
          });
        }

        // 2.3 流萤
        if (planet.fireflies?.enabled) {
          if (planet.fireflies.orbitingEnabled) {
            planet.fireflies.orbitingFireflies.forEach(f => {
              if (f.enabled) {
                // 头部 + 拖尾 (TrailLen)
                total += 1; // 头部
                if (f.trailEnabled) total += f.trailLength;
              }
            });
          }
          if (planet.fireflies.wanderingEnabled) {
            planet.fireflies.wanderingGroups.forEach(g => {
              if (g.enabled) {
                const groupCount = g.count;
                total += groupCount; // 头部
                // 游走流萤没有显式的 trailLength 设置，在代码中写死或默认，这里估算每个有20个拖尾点
                total += groupCount * 20;
              }
            });
          }
        }

        // 2.3 粒子环
        if (planet.rings?.enabled && planet.rings.particleRingsEnabled) {
          planet.rings.particleRings.forEach(r => {
            if (r.enabled) {
              // 估算: 2 * PI * radius * density
              const count = Math.floor(2 * Math.PI * r.absoluteRadius * r.particleDensity);
              total += count;
              // 环也有拖尾
              if (r.trailEnabled) {
                total += count * r.trailLength; // 这里的trailLength是倍数还是点数? 
                // types.ts: trailLength number 0.1-1.0 (拖尾长度比例) 或者 0-2? 
                // 实际上粒子环的拖尾是在shader里实现的还是物理点? 
                // 查看 ParticleRing 实现, 它是 InstancedMesh 或者是 Points? 
                // 通常粒子环是 Points, 拖尾可能是 buffer 里的。
                // 为避免过度计算，暂时只算主粒子。
              }
            }
          });
        }

        // 2.4 辐射/喷发
        if (planet.radiation?.enabled) {
          if (planet.radiation.emitterEnabled) {
            planet.radiation.emitters.forEach(e => {
              if (e.enabled) {
                // 估算: birthRate * lifeSpan
                total += e.birthRate * e.lifeSpan;
              }
            });
          }
          if (planet.radiation.orbitingEnabled) {
            planet.radiation.orbitings.forEach(o => {
              if (o.enabled) {
                // OrbitingParticlesSettings 有 particleCount 但标记为旧数据? 
                // 新版可能是 particleDensity * area? 
                // 查看 types.ts: particleDensity: number; // 粒子密度 0.1-5
                // orbitRadius: number;
                // 估算: 4 * PI * R^2 * density (如果是球壳)
                // 简单点如果 density 较小，可能是 count = density * 1000
                // 或者看有没有 particleCount 字段
                // types.ts 说 particleCount?: number // 兼容旧数据
                // 假设 density * 1000
                total += o.particleDensity * 1000;
              }
            });
          }
        }

        // 2.5 火焰系统 (螺旋/喷射)
        if (planet.flameSystem?.enabled) {
          if (planet.flameSystem.spiralFlamesEnabled) {
            planet.flameSystem.spiralFlames.forEach(s => {
              if (s.enabled && s.renderType === 'particles') {
                total += s.particleCount;
              }
            });
          }
          if (planet.flameSystem.flameJetsEnabled) {
            planet.flameSystem.flameJets.forEach(j => {
              if (j.enabled) {
                total += j.particleCount;
              }
            });
          }
        }
      });
    }

    return Math.floor(total);
  };

  // FPS Counter (simple)
  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    const loop = () => {
      const time = performance.now();
      frame++;
      if (time - lastTime >= 1000) {
        setFps(frame);
        frame = 0;
        lastTime = time;
      }
      requestAnimationFrame(loop);
    };
    loop();
  }, []);

  // 检测移动设备
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 如果用户未登录，显示登录界面
  if (!currentUser) {
    return <UserLogin />;
  }

  return (
    <div className="w-full h-screen relative overflow-hidden font-sans" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-1)' }}>
      {/* 3D Scene Area - 全屏 */}
      <div className="absolute inset-0">
        {/* 用户信息显示 - 左上角 */}
        <div className="absolute top-0 left-0 p-2 md:p-3 z-50">
          <UserMenu
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
          {/* AI 按钮 */}
          <button
            onClick={() => setShowAIPanel(true)}
            className="ml-2 px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-bold transition-all duration-300 shadow-lg hover:shadow-indigo-500/30 flex items-center gap-1"
            title="打开 AI 助手"
          >
            ✨ AI
          </button>
        </div>

        {/* 顶部模式切换栏 - 水晶宝石风格 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 rounded-b-2xl border-t-0"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,30,0.08) 0%, rgba(40,40,60,0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderTop: 'none'
          }}
        >
          <button
            onClick={() => setAppMode('nebula')}
            className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300"
            style={{
              ...generateMaterialStyle(materialSettings.modeSwitch || createDefaultMaterialConfig('glass'), appMode === 'nebula').style,
              fontFamily: 'inherit'
            }}
          >
            <i className="fas fa-cloud-meatball mr-1 md:mr-2"></i>
            <span className="hidden sm:inline">星云模式</span>
            <span className="sm:hidden">星云</span>
          </button>

          {/* 叠加模式按钮 - 圆形互通按钮 */}
          <button
            onClick={() => {
              setOverlayMode(!overlayMode);
              // 启用叠加模式时，确保有星球
              if (!overlayMode && planetSettings.planets.length === 0) {
                const id = Date.now().toString();
                const newPlanet = createDefaultPlanet(id, '星球 1');
                setPlanetSettings(prev => ({
                  ...prev,
                  planets: [newPlanet]
                }));
              }
            }}
            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden ${overlayMode ? 'rotate-180 scale-110' : 'hover:scale-105'
              }`}
            style={{
              background: overlayMode ? 'linear-gradient(135deg, #60a5fa, #c084fc)' : 'rgba(255,255,255,0.05)',
              boxShadow: overlayMode ? '0 0 20px rgba(167,139,250,0.4)' : 'inset 0 1px 2px rgba(255,255,255,0.1)',
              border: overlayMode ? 'none' : '1px solid rgba(255,255,255,0.1)'
            }}
            title={overlayMode ? "关闭互通模式" : "开启互通模式 (双场景叠加)"}
          >
            <i className={`fas fa-infinity text-sm md:text-lg ${overlayMode ? 'text-white' : 'text-white/40'}`} />
          </button>

          <button
            onClick={() => {
              setAppMode('planet');
              if (planetSettings.planets.length === 0) {
                const id = Date.now().toString();
                const newPlanet = createDefaultPlanet(id, '星球 1');
                setPlanetSettings(prev => ({
                  ...prev,
                  planets: [newPlanet]
                }));
              }
            }}
            className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300"
            style={{
              ...generateMaterialStyle(materialSettings.modeSwitch || createDefaultMaterialConfig('glass'), appMode === 'planet').style,
              fontFamily: 'inherit'
            }}
          >
            <i className="fas fa-globe mr-1 md:mr-2"></i>
            <span className="hidden sm:inline">星球模式</span>
            <span className="sm:hidden">星球</span>
          </button>
        </div>

        {isProcessing && appMode === 'nebula' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-blue-400 font-mono animate-pulse">正在处理星云数据...</p>
          </div>
        )}

        {/* 条件渲染场景 - 支持叠加模式 */}
        {/* 星云场景：仅nebula模式下显示（互通模式下由PlanetScene渲染星云） */}
        {appMode === 'nebula' && !overlayMode && (
          <div className="w-full h-full">
            <NebulaScene
              data={data}
              settings={settings}
              handData={handDataRef}
              colorPickMode={colorPickMode}
              onColorPick={(color) => {
                setPickedColor(color);
              }}
              nebulaInstancesData={nebulaInstancesData}
              nebulaPreviewMode={nebulaPreviewMode}
              overlayMode={false}
              sidebarOpen={showControls}
            />
          </div>
        )}
        {/* 星球场景：planet模式或互通模式下显示（互通模式下同时渲染星球和星云） */}
        {(appMode === 'planet' || overlayMode) && (
          <div className="w-full h-full">
            <PlanetScene
              settings={planetSettings}
              handData={handDataRef}
              onCameraChange={setCameraInfo}
              resetCameraRef={resetCameraRef}
              overlayMode={overlayMode}
              nebulaData={overlayMode ? data : undefined}
              nebulaSettings={overlayMode ? settings : undefined}
              nebulaInstancesData={overlayMode ? nebulaInstancesData : undefined}
              sidebarOpen={showControls}
            />
          </div>
        )}

        {/* Floating Toggle for Sidebar */}
        <button
          onClick={() => setShowControls(!showControls)}
          className={`absolute top-4 z-[200] w-7 h-14 rounded-lg transition-all duration-300 flex items-center justify-center ${showControls ? 'right-[324px]' : 'right-2'}`}
          style={{
            background: 'rgba(30,30,40,0.25)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.25)'
          }}
        >
          <span className="text-white text-base font-light">{showControls ? '›' : '‹'}</span>
        </button>

        {/* 视角信息面板 - 仅星球模式显示 - 玻璃样式 */}
        {appMode === 'planet' && cameraInfo && (
          <div
            className="absolute bottom-24 md:bottom-8 left-4 z-40 rounded-xl p-3"
            style={{
              background: 'rgba(30,30,40,0.16)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)'
            }}
          >
            <div className="text-xs text-gray-400 space-y-1 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-12">位置</span>
                <span className="text-white">
                  X:{cameraInfo.position.x} Y:{cameraInfo.position.y} Z:{cameraInfo.position.z}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-12">距离</span>
                <span className="text-cyan-400">{cameraInfo.distance}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-12">角度</span>
                <span className="text-yellow-400">
                  极:{cameraInfo.polarAngle}° 方位:{cameraInfo.azimuthAngle}°
                </span>
              </div>
            </div>
            <button
              onClick={() => resetCameraRef.current?.()}
              className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg transition-all font-medium hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1.5px solid var(--ui-primary)',
                boxShadow: '0 2px 12px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.95)'
              }}
            >
              🎯 还原初始视角
            </button>
          </div>
        )}

        {/* 互通模式设置面板 - 仅互通模式+星云模式下显示 - 玻璃样式 */}
        {overlayMode && appMode === 'nebula' && (
          <div
            className="absolute bottom-24 md:bottom-8 left-4 z-40 rounded-xl p-3"
            style={{
              background: 'rgba(30,30,40,0.16)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              minWidth: '180px'
            }}
          >
            <span className="text-xs font-medium block mb-2 text-cyan-400">互通模式设置</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[10px] min-w-[40px]">辉光:</span>
              <input
                type="range"
                min={0} max={3} step={0.05}
                value={settings.overlayBloomStrength ?? 1.0}
                onChange={(e) => setSettings(prev => ({ ...prev, overlayBloomStrength: parseFloat(e.target.value) }))}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{ background: 'rgba(55,65,81,0.5)' }}
              />
              <span className="text-white text-[10px] w-8 text-right">{(settings.overlayBloomStrength ?? 1.0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 手势处理器（支持iPad） */}
        <GestureHandler handDataRef={handDataRef} enabled={gestureEnabled} showVideo={false} />
      </div>

      {/* Sidebar - 悬浮在右侧 */}
      <div className={`
        absolute top-0 right-0 h-full
        ${showControls ? 'w-full md:w-80' : 'w-0'} 
        transition-all duration-300 ease-in-out 
        overflow-hidden
        z-[100]
      `}>
        <div className="w-full md:w-80 h-full">
          <ControlPanel
            settings={settings}
            setSettings={setSettings}
            planetSettings={planetSettings}
            setPlanetSettings={setPlanetSettings}
            appMode={appMode}
            onImageUpload={handleFileUpload}
            onSampleSelect={handleLoadSample}
            onClearMainNebula={() => setData(null)}
            nebulaPreviewMode={nebulaPreviewMode}
            setNebulaPreviewMode={setNebulaPreviewMode}
            fps={fps}
            particleCount={calculateTotalParticles()}
            colorPickMode={colorPickMode}
            setColorPickMode={setColorPickMode}
            pickedColor={pickedColor}
            onExtractColors={handleExtractColors}
            gestureEnabled={gestureEnabled}
            setGestureEnabled={setGestureEnabled}
            overlayMode={overlayMode}
            materialSettings={materialSettings}
            nebulaPresets={nebulaPresets}
            setNebulaPresets={setNebulaPresets}
          />
        </div>
      </div>

      {/* AI 助手按钮 */}
      <button
        onClick={() => setShowAIPanel(true)}
        className="fixed bottom-6 left-6 z-[200] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        ✨ AI
      </button>

      {/* AI 助手面板 */}
      <AIAssistantPanel
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        userId={currentUser?.id}
        planetSettings={planetSettings}
        onAddPlanet={(planet) => {
          setPlanetSettings(prev => ({
            ...prev,
            enabled: true,
            planets: [...prev.planets, planet]
          }));
        }}
        onUpdatePlanet={(id, updates) => {
          setPlanetSettings(prev => ({
            ...prev,
            planets: prev.planets.map(p => p.id === id ? { ...p, ...updates } : p)
          }));
        }}
        onApplyBackground={(url) => {
          setPlanetSettings(prev => ({
            ...prev,
            background: { ...prev.background, panoramaUrl: url, enabled: true }
          }));
        }}
        onSaveHeadTexture={async (preset) => {
          // 保存到云配置
          const config = await loadCloudConfig() || { version: 1, updatedAt: new Date().toISOString() };
          const headTexturePresets = config.headTexturePresets || [];
          headTexturePresets.push(preset);
          const ok = await saveCloudConfig({ ...config, headTexturePresets });
          if (ok) {
            console.log('Saved head texture preset:', preset.name);
          } else {
            console.error('Failed to save head texture preset:', preset.name);
          }
        }}
        onSaveBackground={async (preset) => {
          const config = await loadCloudConfig() || { version: 1, updatedAt: new Date().toISOString() };
          const backgroundPresets = config.backgroundPresets || [];
          backgroundPresets.push(preset);
          const ok = await saveCloudConfig({ ...config, backgroundPresets });
          if (ok) {
            console.log('Saved background preset:', preset.name);
          } else {
            console.error('Failed to save background preset:', preset.name);
          }
        }}
        onSaveMagicCircleTexture={async (preset) => {
          const config = await loadCloudConfig() || { version: 1, updatedAt: new Date().toISOString() };
          const magicCircleTexturePresets = config.magicCircleTexturePresets || [];
          magicCircleTexturePresets.push(preset);
          const ok = await saveCloudConfig({ ...config, magicCircleTexturePresets });
          if (ok) {
            console.log('Saved magic circle texture preset:', preset.name);
          } else {
            console.error('Failed to save magic circle texture preset:', preset.name);
          }
        }}
      />
    </div >
  );
};

export default App;