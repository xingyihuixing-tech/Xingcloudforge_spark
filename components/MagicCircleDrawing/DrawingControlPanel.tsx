/**
 * input: customMagicCircles, currentCircleId, currentLayer, symmetryMode/Divisions from parent
 * output: Drawing mode control panel UI with circle list, layer management, symmetry controls
 * pos: Right-side control panel replacement when drawing mode is active
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState } from 'react';
import {
    CustomMagicCircle,
    MagicCircleLayer,
    SymmetryMode,
    SymmetryParams
} from '../../types';
import {
    CloseIcon,
    EyeOpenIcon,
    EyeClosedIcon,
    SoloIcon,
    DeleteIcon,
    AddIcon,
    CheckIcon,
    EditIcon,
    MagicCircleIcon,
    LayerIcon,
    SymmetryIcon
} from './Icons';

// ==================== Props 接口 ====================

interface DrawingControlPanelProps {
    customMagicCircles: CustomMagicCircle[];
    currentCircleId: string | null;
    onSelectCircle: (id: string) => void;
    onToggleCircleEnabled: (id: string, enabled: boolean) => void;
    onCreateCircle: () => void;
    onDeleteCircle: (id: string) => void;
    onRenameCircle: (id: string, name: string) => void;

    // 图层管理
    currentLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onToggleLayerVisibility: (id: string) => void;
    soloLayerId: string | null;
    onToggleLayerSolo: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onCreateLayer: () => void;

    // 对称设置
    symmetryMode: SymmetryMode;
    symmetryDivisions: number;
    symmetryParams?: SymmetryParams;
    onUpdateSymmetry: (mode: SymmetryMode, divisions: number) => void;
    onUpdateSymmetryParams: (params: SymmetryParams) => void;

    // 关闭
    onClose: () => void;
}

// ==================== 主组件 ====================

export const DrawingControlPanel: React.FC<DrawingControlPanelProps> = ({
    customMagicCircles,
    currentCircleId,
    onSelectCircle,
    onToggleCircleEnabled,
    onCreateCircle,
    onDeleteCircle,
    onRenameCircle,
    currentLayerId,
    onSelectLayer,
    onToggleLayerVisibility,
    soloLayerId,
    onToggleLayerSolo,
    onDeleteLayer,
    onCreateLayer,
    symmetryMode,
    symmetryDivisions,
    symmetryParams,
    onUpdateSymmetry,
    onUpdateSymmetryParams,
    onClose
}) => {
    const [editingCircleName, setEditingCircleName] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    const [circleListCollapsed, setCircleListCollapsed] = useState(false);

    const currentCircle = customMagicCircles.find(c => c.id === currentCircleId);
    const layers = currentCircle?.layers || [];

    // 对称模式选项（已移除星芒、轨道环）
    const symmetryModes: { mode: SymmetryMode; label: string }[] = [
        { mode: 'none', label: '无' },
        { mode: 'radial', label: '径向' },
        { mode: 'kaleidoscope', label: '万花筒' },
        { mode: 'vortex', label: '漩涡' },
        { mode: 'sphere', label: '球面' }
    ];

    // 对称分割数选项
    const divisionOptions = [2, 3, 4, 6, 8, 12, 16, 24];

    // 开始重命名法阵
    const startRenaming = (circle: CustomMagicCircle) => {
        setEditingCircleName(circle.id);
        setTempName(circle.name);
    };

    // 完成重命名
    const finishRenaming = () => {
        if (editingCircleName && tempName.trim()) {
            onRenameCircle(editingCircleName, tempName.trim());
        }
        setEditingCircleName(null);
        setTempName('');
    };

    return (
        <div
            className="drawing-panel-glass fixed right-0 top-0 bottom-0 w-64 flex flex-col z-[200]"
            style={{
                pointerEvents: 'auto',
                borderRadius: '16px 0 0 16px'
            }}
        >
            {/* 头部 - 关闭按钮 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-white font-medium">绘图模式</span>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    title="退出绘图模式"
                >
                    <CloseIcon size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* ==================== 自定义法阵列表 ==================== */}
                <div className="drawing-panel-glass rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setCircleListCollapsed(!circleListCollapsed)}
                            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                        >
                            <span className="text-xs">{circleListCollapsed ? '►' : '▼'}</span>
                            <MagicCircleIcon size={14} />
                            <span className="text-xs font-medium">自定义法阵</span>
                        </button>
                        <button
                            onClick={onCreateCircle}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-green-400 hover:text-green-300"
                            title="新建法阵"
                        >
                            <AddIcon size={14} />
                        </button>
                    </div>

                    {!circleListCollapsed && (

                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {customMagicCircles.map(circle => {
                                const isSelected = circle.id === currentCircleId;
                                const isEditing = editingCircleName === circle.id;

                                return (
                                    <div
                                        key={circle.id}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${isSelected
                                            ? 'drawing-circle-selected'
                                            : 'hover:bg-white/5 border border-transparent'
                                            }`}
                                    >

                                        {/* 名称 (可编辑) */}
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={tempName}
                                                    onChange={e => setTempName(e.target.value)}
                                                    onBlur={finishRenaming}
                                                    onKeyDown={e => e.key === 'Enter' && finishRenaming()}
                                                    className="w-full px-1 py-0.5 text-xs bg-gray-700 rounded text-white outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => onSelectCircle(circle.id)}
                                                    onDoubleClick={() => startRenaming(circle)}
                                                    className={`w-full text-left text-xs truncate ${isSelected ? 'text-white' : 'text-gray-300'
                                                        }`}
                                                >
                                                    {circle.name}
                                                    {isSelected && <span className="ml-1 text-purple-400">★</span>}
                                                </button>
                                            )}
                                        </div>


                                        {/* 删除按钮 */}
                                        <button
                                            onClick={() => onDeleteCircle(circle.id)}
                                            className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
                                            title="删除法阵"
                                        >
                                            <DeleteIcon size={12} />
                                        </button>
                                    </div>
                                );
                            })}

                            {customMagicCircles.length === 0 && (
                                <div className="text-center py-3 text-gray-500 text-xs">
                                    暂无法阵，点击 + 创建
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ==================== 对称设置 ==================== */}
                <div className="drawing-panel-glass rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-300 mb-2">
                        <SymmetryIcon size={14} />
                        <span className="text-xs font-medium">对称设置</span>
                    </div>

                    {/* 对称模式 - 换行布局，竖向文字 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                        {symmetryModes.map(({ mode, label }) => (
                            <button
                                key={mode}
                                onClick={() => onUpdateSymmetry(mode, symmetryDivisions)}
                                className={`px-2 py-1.5 text-xs rounded transition-all ${symmetryMode === mode
                                    ? 'drawing-symmetry-btn-active'
                                    : 'drawing-symmetry-btn-inactive'
                                    }`}
                                style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 分割数 (仅非 none 模式显示) */}
                    {symmetryMode !== 'none' && (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-gray-400 w-12">分割数</span>
                                {/* 减按钮 */}
                                <button
                                    onClick={() => onUpdateSymmetry(symmetryMode, Math.max(2, symmetryDivisions - 1))}
                                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center text-sm"
                                    title="减少"
                                >
                                    −
                                </button>

                                {/* 滑块 */}
                                <input
                                    type="range"
                                    min={2}
                                    max={100}
                                    value={symmetryDivisions}
                                    onChange={(e) => onUpdateSymmetry(symmetryMode, Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />

                                {/* 加按钮 */}
                                <button
                                    onClick={() => onUpdateSymmetry(symmetryMode, Math.min(100, symmetryDivisions + 1))}
                                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center text-sm"
                                    title="增加"
                                >
                                    +
                                </button>

                                {/* 数值显示 */}
                                <span className="text-xs text-white w-8 text-center">{symmetryDivisions}</span>
                            </div>

                            {/* ========== 径向参数 ========== */}
                            {symmetryMode === 'radial' && (
                                <div className="space-y-2 mt-2 pt-2 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">起始相位</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={360}
                                            step={5}
                                            value={symmetryParams?.radialPhaseOffset ?? 0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, radialPhaseOffset: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{symmetryParams?.radialPhaseOffset ?? 0}°</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">缩放变化</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={0.5}
                                            step={0.05}
                                            value={symmetryParams?.radialScaleVariation ?? 0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, radialScaleVariation: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.radialScaleVariation ?? 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* ========== 万花筒参数 ========== */}
                            {symmetryMode === 'kaleidoscope' && (
                                <div className="space-y-2 mt-2 pt-2 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">镜像轴角</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={180}
                                            step={5}
                                            value={symmetryParams?.kaleidoscopeMirrorAngle ?? 0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, kaleidoscopeMirrorAngle: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{symmetryParams?.kaleidoscopeMirrorAngle ?? 0}°</span>
                                    </div>
                                </div>
                            )}

                            {/* ========== 漩涡参数 ========== */}
                            {symmetryMode === 'vortex' && (
                                <div className="space-y-2 mt-2 pt-2 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">扭曲强度</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={5}
                                            step={0.1}
                                            value={symmetryParams?.vortexTwistFactor ?? 2.0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, vortexTwistFactor: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.vortexTwistFactor ?? 2.0).toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">衰减系数</span>
                                        <input
                                            type="range"
                                            min={0.5}
                                            max={6}
                                            step={0.1}
                                            value={symmetryParams?.vortexTwistDecay ?? 3.0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, vortexTwistDecay: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.vortexTwistDecay ?? 3.0).toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">旋转方向</span>
                                        <button
                                            onClick={() => onUpdateSymmetryParams({ ...symmetryParams, vortexDirection: (symmetryParams?.vortexDirection ?? 1) * -1 })}
                                            className="flex-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                                        >
                                            {(symmetryParams?.vortexDirection ?? 1) > 0 ? '逆时针 ↺' : '顺时针 ↻'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">中心偏移</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={0.3}
                                            step={0.02}
                                            value={symmetryParams?.vortexCenterOffset ?? 0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, vortexCenterOffset: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.vortexCenterOffset ?? 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* ========== 球面参数 ========== */}
                            {symmetryMode === 'sphere' && (
                                <div className="space-y-2 mt-2 pt-2 border-t border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">球体半径</span>
                                        <input
                                            type="range"
                                            min={0.2}
                                            max={1.0}
                                            step={0.05}
                                            value={symmetryParams?.sphereRadius ?? 0.5}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, sphereRadius: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.sphereRadius ?? 0.5).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">纬度缩放</span>
                                        <input
                                            type="range"
                                            min={0.5}
                                            max={2.0}
                                            step={0.1}
                                            value={symmetryParams?.sphereLatScale ?? 1.0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, sphereLatScale: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.sphereLatScale ?? 1.0).toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">经度缩放</span>
                                        <input
                                            type="range"
                                            min={0.5}
                                            max={2.0}
                                            step={0.1}
                                            value={symmetryParams?.sphereLonScale ?? 1.0}
                                            onChange={(e) => onUpdateSymmetryParams({ ...symmetryParams, sphereLonScale: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                        />
                                        <span className="text-xs text-white w-8 text-center">{(symmetryParams?.sphereLonScale ?? 1.0).toFixed(1)}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ==================== 图层管理 ==================== */}
                <div className="drawing-panel-glass rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-gray-300">
                            <LayerIcon size={14} />
                            <span className="text-xs font-medium">图层</span>
                        </div>
                        <button
                            onClick={onCreateLayer}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-green-400 hover:text-green-300"
                            title="新建图层"
                        >
                            <AddIcon size={14} />
                        </button>
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {layers.map(layer => {
                            const isSelected = layer.id === currentLayerId;
                            const isSolo = layer.id === soloLayerId;

                            return (
                                <div
                                    key={layer.id}
                                    onClick={() => onSelectLayer(layer.id)}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all ${isSelected
                                        ? 'drawing-layer-selected'
                                        : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    {/* 可见性按钮 */}
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            onToggleLayerVisibility(layer.id);
                                        }}
                                        className={`p-0.5 rounded transition-colors ${layer.visible
                                            ? 'text-white hover:text-gray-300'
                                            : 'text-gray-500 hover:text-gray-400'
                                            }`}
                                        title={layer.visible ? '隐藏图层' : '显示图层'}
                                    >
                                        {layer.visible ? <EyeOpenIcon size={14} /> : <EyeClosedIcon size={14} />}
                                    </button>

                                    {/* 图层名称 */}
                                    <span className={`flex-1 text-xs truncate ${isSelected ? 'text-white' : 'text-gray-300'
                                        }`}>
                                        {layer.name}
                                    </span>

                                    {/* Solo 按钮 */}
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            onToggleLayerSolo(layer.id);
                                        }}
                                        className={`p-0.5 rounded transition-colors ${isSolo
                                            ? 'text-yellow-400 bg-yellow-600/30'
                                            : 'text-gray-500 hover:text-yellow-400'
                                            }`}
                                        title={isSolo ? '取消 Solo' : 'Solo 此图层'}
                                    >
                                        <SoloIcon size={12} />
                                    </button>

                                    {/* 删除按钮 */}
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            onDeleteLayer(layer.id);
                                        }}
                                        className="p-0.5 rounded text-gray-500 hover:text-red-400 transition-colors"
                                        title="删除图层"
                                    >
                                        <DeleteIcon size={12} />
                                    </button>
                                </div>
                            );
                        })}

                        {layers.length === 0 && (
                            <div className="text-center py-3 text-gray-500 text-xs">
                                暂无图层，点击 + 创建
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrawingControlPanel;
