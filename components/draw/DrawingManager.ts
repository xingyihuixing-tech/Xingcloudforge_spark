/**
 * DrawingManager - 绘图管理器
 * 
 * input: DrawSettings 状态、笔触输入事件
 * output: 管理 Drawing/Layer 数据、提供 CRUD 操作
 * pos: 绘图系统核心状态管理模块
 * update: 一旦我被更新，请更新 components/draw 目录的 _README.md
 */

// 生成唯一 ID（使用 crypto API 或时间戳备用）
const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // 备用方案
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

import {
    DrawSettings,
    Drawing,
    DrawingLayer,
    Stroke,
    BrushSettings,
    SymmetrySettings,
    BrushType,
    ProjectionMode
} from '../../types';
import {
    createDefaultDrawing,
    createDefaultDrawingLayer
} from '../../constants';

// ==================== 绘图实例管理 ====================

/**
 * 创建新的绘图实例
 */
export function createNewDrawing(name?: string): Drawing {
    const id = generateId();
    return createDefaultDrawing(id, name || `绘图 ${Date.now() % 1000}`);
}

/**
 * 添加新绘图到设置
 */
export function addDrawing(
    settings: DrawSettings,
    drawing?: Drawing
): DrawSettings {
    const newDrawing = drawing || createNewDrawing();
    return {
        ...settings,
        drawings: [...settings.drawings, newDrawing],
        activeDrawingId: newDrawing.id
    };
}

/**
 * 删除绘图
 */
export function removeDrawing(
    settings: DrawSettings,
    drawingId: string
): DrawSettings {
    const newDrawings = settings.drawings.filter(d => d.id !== drawingId);
    const newBindings = settings.planetBindings.filter(b => b.drawingId !== drawingId);

    return {
        ...settings,
        drawings: newDrawings,
        planetBindings: newBindings,
        activeDrawingId: settings.activeDrawingId === drawingId
            ? (newDrawings[0]?.id || null)
            : settings.activeDrawingId
    };
}

/**
 * 更新绘图属性
 */
export function updateDrawing(
    settings: DrawSettings,
    drawingId: string,
    updates: Partial<Drawing>
): DrawSettings {
    return {
        ...settings,
        drawings: settings.drawings.map(d =>
            d.id === drawingId ? { ...d, ...updates } : d
        )
    };
}

/**
 * 获取当前激活的绘图
 */
export function getActiveDrawing(settings: DrawSettings): Drawing | null {
    if (!settings.activeDrawingId) return null;
    return settings.drawings.find(d => d.id === settings.activeDrawingId) || null;
}

// ==================== 图层管理 ====================

/**
 * 创建新图层
 */
export function createNewLayer(
    brush: BrushSettings,
    name?: string
): DrawingLayer {
    const id = generateId();
    const layer = createDefaultDrawingLayer(id, name || `图层 ${Date.now() % 1000}`);

    // 使用当前笔刷设置
    return {
        ...layer,
        brushType: brush.type,
        color: brush.color,
        params: extractBrushParams(brush)
    };
}

/**
 * 添加新图层到绘图
 */
export function addLayer(
    settings: DrawSettings,
    drawingId: string,
    layer?: DrawingLayer
): DrawSettings {
    const newLayer = layer || createNewLayer(settings.brush);

    return {
        ...settings,
        drawings: settings.drawings.map(d => {
            if (d.id !== drawingId) return d;
            return {
                ...d,
                layers: [...d.layers, newLayer],
                activeLayerId: newLayer.id
            };
        })
    };
}

/**
 * 删除图层
 */
export function removeLayer(
    settings: DrawSettings,
    drawingId: string,
    layerId: string
): DrawSettings {
    return {
        ...settings,
        drawings: settings.drawings.map(d => {
            if (d.id !== drawingId) return d;
            const newLayers = d.layers.filter(l => l.id !== layerId);
            return {
                ...d,
                layers: newLayers,
                activeLayerId: d.activeLayerId === layerId
                    ? (newLayers[0]?.id || null)
                    : d.activeLayerId
            };
        })
    };
}

/**
 * 更新图层属性
 */
export function updateLayer(
    settings: DrawSettings,
    drawingId: string,
    layerId: string,
    updates: Partial<DrawingLayer>
): DrawSettings {
    return {
        ...settings,
        drawings: settings.drawings.map(d => {
            if (d.id !== drawingId) return d;
            return {
                ...d,
                layers: d.layers.map(l =>
                    l.id === layerId ? { ...l, ...updates } : l
                )
            };
        })
    };
}

/**
 * 获取当前激活的图层
 */
export function getActiveLayer(settings: DrawSettings): DrawingLayer | null {
    const drawing = getActiveDrawing(settings);
    if (!drawing || !drawing.activeLayerId) return null;
    return drawing.layers.find(l => l.id === drawing.activeLayerId) || null;
}

// ==================== 笔触管理 ====================

/**
 * 创建新笔触
 */
export function createStroke(
    points: Float32Array,
    symmetrySettings: SymmetrySettings
): Stroke {
    return {
        id: generateId(),
        points,
        symmetrySnapshot: { ...symmetrySettings }
    };
}

/**
 * 添加笔触到图层
 */
export function addStroke(
    settings: DrawSettings,
    drawingId: string,
    layerId: string,
    stroke: Stroke
): DrawSettings {
    return updateLayer(settings, drawingId, layerId, {
        strokes: [
            ...(getActiveLayer(settings)?.strokes || []),
            stroke
        ]
    });
}

/**
 * 清空图层笔触
 */
export function clearStrokes(
    settings: DrawSettings,
    drawingId: string,
    layerId: string
): DrawSettings {
    return updateLayer(settings, drawingId, layerId, { strokes: [] });
}

// ==================== 星球绑定 ====================

/**
 * 绑定绘图到星球
 */
export function bindDrawingToPlanet(
    settings: DrawSettings,
    drawingId: string,
    planetId: string
): DrawSettings {
    const existingBinding = settings.planetBindings.find(b => b.drawingId === drawingId);

    if (existingBinding) {
        // 添加星球到现有绑定
        if (!existingBinding.planetIds.includes(planetId)) {
            return {
                ...settings,
                planetBindings: settings.planetBindings.map(b =>
                    b.drawingId === drawingId
                        ? { ...b, planetIds: [...b.planetIds, planetId] }
                        : b
                )
            };
        }
        return settings;
    }

    // 创建新绑定
    return {
        ...settings,
        planetBindings: [
            ...settings.planetBindings,
            { drawingId, planetIds: [planetId] }
        ]
    };
}

/**
 * 解除绘图与星球的绑定
 */
export function unbindDrawingFromPlanet(
    settings: DrawSettings,
    drawingId: string,
    planetId: string
): DrawSettings {
    return {
        ...settings,
        planetBindings: settings.planetBindings
            .map(b => {
                if (b.drawingId !== drawingId) return b;
                return {
                    ...b,
                    planetIds: b.planetIds.filter(id => id !== planetId)
                };
            })
            .filter(b => b.planetIds.length > 0)
    };
}

/**
 * 获取绑定到某星球的所有绘图
 */
export function getDrawingsForPlanet(
    settings: DrawSettings,
    planetId: string
): Drawing[] {
    const bindingIds = settings.planetBindings
        .filter(b => b.planetIds.includes(planetId))
        .map(b => b.drawingId);

    return settings.drawings.filter(d => bindingIds.includes(d.id));
}

// ==================== 辅助函数 ====================

/**
 * 提取笔刷参数
 */
function extractBrushParams(brush: BrushSettings): Record<string, number> {
    const params: Record<string, number> = {
        size: brush.size,
        opacity: brush.opacity
    };

    switch (brush.type) {
        case BrushType.Stardust:
            if (brush.stardust) {
                params.density = brush.stardust.density;
                params.scatter = brush.stardust.scatter;
                params.glowIntensity = brush.stardust.glowIntensity;
                params.twinkleSpeed = brush.stardust.twinkleSpeed;
            }
            break;
        case BrushType.GasCloud:
            if (brush.gasCloud) {
                params.noiseScale = brush.gasCloud.noiseScale;
                params.flowSpeed = brush.gasCloud.flowSpeed;
                params.softness = brush.gasCloud.softness;
                params.turbulence = brush.gasCloud.turbulence;
            }
            break;
        case BrushType.EnergyBeam:
            if (brush.energyBeam) {
                params.coreWidth = brush.energyBeam.coreWidth;
                params.glowRadius = brush.energyBeam.glowRadius;
                params.glowIntensity = brush.energyBeam.glowIntensity;
                params.stabilization = brush.energyBeam.stabilization;
                params.arcFrequency = brush.energyBeam.arcFrequency;
            }
            break;
        case BrushType.SpiralRing:
            if (brush.spiralRing) {
                params.spiralDensity = brush.spiralRing.spiralDensity;
                params.pitch = brush.spiralRing.pitch;
                params.thickness = brush.spiralRing.thickness;
                params.rotationSpeed = brush.spiralRing.rotationSpeed;
                params.riseSpeed = brush.spiralRing.riseSpeed;
                params.emissive = brush.spiralRing.emissive;
            }
            break;
        case BrushType.Firefly:
            if (brush.firefly) {
                params.headSize = brush.firefly.headSize;
                params.headBrightness = brush.firefly.headBrightness;
                params.trailLength = brush.firefly.trailLength;
                params.trailTaper = brush.firefly.trailTaper;
                params.trailOpacity = brush.firefly.trailOpacity;
                params.pulseSpeed = brush.firefly.pulseSpeed;
            }
            break;
        case BrushType.Fracture:
            if (brush.fracture) {
                params.crackScale = brush.fracture.crackScale;
                params.crackThreshold = brush.fracture.crackThreshold;
                params.crackFeather = brush.fracture.crackFeather;
                params.crackWarp = brush.fracture.crackWarp;
                params.flowSpeed = brush.fracture.flowSpeed;
                params.emission = brush.fracture.emission;
            }
            break;
    }

    return params;
}

/**
 * 自动创建绘图和图层（如果不存在）
 * 用于用户开始绘制时自动初始化
 */
export function ensureActiveDrawingAndLayer(settings: DrawSettings): DrawSettings {
    let newSettings = settings;

    // 确保有激活的绘图
    if (!newSettings.activeDrawingId || !getActiveDrawing(newSettings)) {
        newSettings = addDrawing(newSettings);
    }

    // 确保有激活的图层
    const drawing = getActiveDrawing(newSettings);
    if (drawing && (!drawing.activeLayerId || !drawing.layers.find(l => l.id === drawing.activeLayerId))) {
        newSettings = addLayer(newSettings, drawing.id);
    }

    return newSettings;
}

export default {
    // 绘图管理
    createNewDrawing,
    addDrawing,
    removeDrawing,
    updateDrawing,
    getActiveDrawing,
    // 图层管理
    createNewLayer,
    addLayer,
    removeLayer,
    updateLayer,
    getActiveLayer,
    // 笔触管理
    createStroke,
    addStroke,
    clearStrokes,
    // 星球绑定
    bindDrawingToPlanet,
    unbindDrawingFromPlanet,
    getDrawingsForPlanet,
    // 辅助
    ensureActiveDrawingAndLayer
};
