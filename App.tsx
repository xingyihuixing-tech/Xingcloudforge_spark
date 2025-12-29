/**
 * input: 用户交互与本地存储（settings/planetSceneSettings）、图片处理结果、手势数据
 * output: 应用根组件（模式切换、状态管理、向各场景/控制面板下发 settings 与回调）
 * pos: 全局状态与参数流的中枢（UI -> state -> 渲染组件 uniforms）
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

import React, { useState, useEffect, useRef } from 'react';
import NebulaScene from './components/NebulaScene';
import PlanetScene, { CameraInfo } from './components/PlanetScene';
import ControlPanel from './components/ControlPanel';
import GestureHandler from './components/GestureHandler';
import { UserLogin } from './components/UserLogin';
import { useUser } from './contexts/UserContext';
import { AppSettings, HandData, AppMode, PlanetSceneSettings, NebulaInstance, NebulaBlendMode } from './types';
import {
  DEFAULT_SETTINGS,
  SAMPLE_IMAGES,
  getPerformanceAdjustedSettings,
  DEFAULT_PLANET_SCENE_SETTINGS,
  PLANET_SCENE_STORAGE_KEY,
  createDefaultPlanet,
  DEFAULT_NEBULA_INSTANCE
} from './constants';
import { processImage, ProcessedData, extractDominantColors } from './services/imageProcessing';

// LocalStorage key for settings persistence
const SETTINGS_STORAGE_KEY = 'nebula-viz-settings';

// 数据版本 - 更新此版本号会自动清除旧数据
const DATA_VERSION = 70;
const DATA_VERSION_KEY = 'nebula-viz-data-version';

// 检查并清除旧版本数据
const checkAndClearOldData = () => {
  try {
    const savedVersion = localStorage.getItem(DATA_VERSION_KEY);
    if (savedVersion !== String(DATA_VERSION)) {
      console.log('检测到旧版本数据，正在清除...');
      // 清除所有相关数据
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

// 加载星球场景设置
const loadPlanetSceneSettings = (): PlanetSceneSettings => {
  try {
    const saved = localStorage.getItem(PLANET_SCENE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_PLANET_SCENE_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load planet scene settings:', e);
  }
  return DEFAULT_PLANET_SCENE_SETTINGS;
};

// 保存星球场景设置
const savePlanetSceneSettings = (settings: PlanetSceneSettings) => {
  try {
    localStorage.setItem(PLANET_SCENE_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save planet scene settings:', e);
  }
};

// Load settings from localStorage
const loadSavedSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
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

// Save settings to localStorage
const saveSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
};

const App: React.FC = () => {
  // 用户登录状态
  const { currentUser, isLoading: isUserLoading } = useUser();

  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [planetSettings, setPlanetSettings] = useState<PlanetSceneSettings>(loadPlanetSceneSettings);
  const [appMode, setAppMode] = useState<AppMode>('nebula');
  const [overlayMode, setOverlayMode] = useState(false); // 叠加模式：同时显示星云和星球
  const [modeSwitchMaterial, setModeSwitchMaterial] = useState<any>(null);
  const [data, setData] = useState<ProcessedData | null>(null);

  // 星云预览模式：点击预设时暂时隐藏星云列表，只显示主场景星云
  const [nebulaPreviewMode, setNebulaPreviewMode] = useState(false);

  // 多星云实例的粒子数据缓存
  const [nebulaInstancesData, setNebulaInstancesData] = useState<Map<string, ProcessedData>>(new Map());

  // 读取模式切换按钮的材质设置
  useEffect(() => {
    const loadMaterial = () => {
      try {
        const saved = localStorage.getItem('button_material_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setModeSwitchMaterial(parsed.modeSwitch);
        }
      } catch (e) { }
    };
    loadMaterial();
    // 监听storage变化
    window.addEventListener('storage', loadMaterial);
    // 定期检查（同页面修改时storage事件不触发）
    const interval = setInterval(loadMaterial, 1000);
    return () => {
      window.removeEventListener('storage', loadMaterial);
      clearInterval(interval);
    };
  }, []);

  // 生成模式切换按钮样式
  const getModeSwitchStyle = (isActive: boolean, accentColor: string, buttonIndex: number = 0) => {
    if (!modeSwitchMaterial) {
      // 默认水晶样式
      return isActive ? {
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 30%, ${accentColor}99 60%, ${accentColor}cc 100%)`,
        boxShadow: `0 4px 20px ${accentColor}50, inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)`,
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

    const { type } = modeSwitchMaterial;
    switch (type) {
      case 'glass': {
        const { blur, opacity, borderOpacity } = modeSwitchMaterial.glass;
        return isActive ? {
          background: `rgba(255,255,255,${opacity})`,
          backdropFilter: `blur(${blur}px)`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,${borderOpacity})`,
          border: `1px solid rgba(255,255,255,${borderOpacity})`,
          color: 'white'
        } : {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'rgba(156,163,175,0.7)'
        };
      }
      case 'neon': {
        const { glowIntensity, glowSpread, borderGlow, textGlow, color: neonColor } = modeSwitchMaterial.neon;
        const c = accentColor || neonColor;
        const intensity = glowIntensity / 100;
        return isActive ? {
          background: `linear-gradient(180deg, ${c}15 0%, ${c}08 100%)`,
          boxShadow: `0 0 ${glowSpread}px ${c}${Math.round(intensity * 60).toString(16).padStart(2, '0')}, 0 0 ${glowSpread * 2}px ${c}${Math.round(intensity * 30).toString(16).padStart(2, '0')}${borderGlow ? `, inset 0 0 ${glowSpread}px ${c}10` : ''}`,
          border: `1px solid ${c}60`,
          color: c,
          textShadow: textGlow ? `0 0 10px ${c}, 0 0 20px ${c}80` : 'none'
        } : {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'rgba(156,163,175,0.7)'
        };
      }
      case 'crystal': {
        const { facets, shine, depth, color: crystalColor, highlightColor, color2, highlightColor2 } = modeSwitchMaterial.crystal;
        // 根据buttonIndex选择颜色组
        const c = buttonIndex === 1 ? (color2 || '#06b6d4') : crystalColor;
        const h = buttonIndex === 1 ? (highlightColor2 || '#67e8f9') : highlightColor;
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
        const { elevation, curvature, lightAngle, shadowIntensity, baseColor, highlightColor, shadowColor } = modeSwitchMaterial.neumorphism;
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
        const { colors, angle } = modeSwitchMaterial.holographic;
        const colorStops = colors.map((c: string, i: number) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
        return isActive ? {
          background: `linear-gradient(${angle}deg, ${colorStops})`,
          backgroundSize: '200% 200%',
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(true);
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
          planet.coreSystem.cores.forEach(core => {
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
        {/* 用户信息显示 */}
        <div className="absolute top-2 right-2 md:top-4 md:right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            background: 'rgba(20,20,30,0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span className="text-lg">{currentUser.avatar}</span>
          <span className="text-sm text-white/80">{currentUser.name}</span>
        </div>

        {/* 顶部模式切换栏 - 水晶宝石风格 */}
        <div className="absolute top-2 md:top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,30,0.08) 0%, rgba(40,40,60,0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          <button
            onClick={() => setAppMode('nebula')}
            className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300"
            style={getModeSwitchStyle(appMode === 'nebula', '#6366f1', 0)}
          >
            <i className="fas fa-cloud mr-1 md:mr-2"></i>
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
            className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300"
            style={overlayMode ? {
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.5), 0 0 20px rgba(6, 182, 212, 0.5), inset 0 2px 4px rgba(255,255,255,0.3)',
              border: '2px solid rgba(255,255,255,0.4)',
            } : {
              background: 'linear-gradient(135deg, rgba(50,50,70,0.6) 0%, rgba(30,30,45,0.8) 100%)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            title={overlayMode ? '关闭叠加模式' : '开启叠加模式（同时显示星云和星球）'}
          >
            <span className="text-lg" style={{ filter: overlayMode ? 'drop-shadow(0 0 4px white)' : 'none' }}>
              {overlayMode ? '🔗' : '⊕'}
            </span>
          </button>

          <button
            onClick={() => {
              setAppMode('planet');
              // 如果没有星球，自动创建一个默认星球
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
            style={getModeSwitchStyle(appMode === 'planet', '#06b6d4', 1)}
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
            className="absolute bottom-4 left-4 z-40 rounded-xl p-3"
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
            className="absolute bottom-4 left-4 z-40 rounded-xl p-3"
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
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-[10px] min-w-[40px]">混合:</span>
              <select
                value={settings.overlayBlendMode ?? NebulaBlendMode.Additive}
                onChange={(e) => setSettings(prev => ({ ...prev, overlayBlendMode: e.target.value as NebulaBlendMode }))}
                className="flex-1 px-2 py-1 rounded text-[10px] cursor-pointer"
                style={{
                  background: 'rgba(55,65,81,0.5)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <option value={NebulaBlendMode.Additive}>叠加发光</option>
                <option value={NebulaBlendMode.Normal}>普通混合</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-[10px] min-w-[40px]">亮度:</span>
              <input
                type="range"
                min={0} max={3} step={0.05}
                value={settings.overlayBrightness ?? 0.5}
                onChange={(e) => setSettings(prev => ({ ...prev, overlayBrightness: parseFloat(e.target.value) }))}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{ background: 'rgba(55,65,81,0.5)' }}
              />
              <span className="text-white text-[10px] w-8 text-right">{(settings.overlayBrightness ?? 0.5).toFixed(2)}</span>
            </div>
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

            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-400 text-[10px] min-w-[40px]">补偿:</span>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={settings.overlayColorCompensation ?? 1.0}
                onChange={(e) => setSettings(prev => ({ ...prev, overlayColorCompensation: parseFloat(e.target.value) }))}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{ background: 'rgba(55,65,81,0.5)' }}
              />
              <span className="text-white text-[10px] w-8 text-right">{(settings.overlayColorCompensation ?? 1.0).toFixed(2)}</span>
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
          />
        </div>
      </div>
    </div>
  );
};

export default App;