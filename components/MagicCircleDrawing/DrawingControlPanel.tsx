/**
 * input: customMagicCircles, currentCircleId, currentLayer, symmetryMode/Divisions from parent
 * output: Drawing mode control panel UI with circle list, layer management, symmetry controls
 * pos: Right-side control panel replacement when drawing mode is active
 * update: 一旦我被更新，务必更新本文件头部注释以及所属文件夹的架构md
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    CustomMagicCircle,
    MagicCircleLayer,
    SymmetryMode
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
    onUpdateSymmetry: (mode: SymmetryMode, divisions: number) => void;
    symmetryParams: {
        vortexMaxTwist?: number;
        bloomMinScale?: number;
        bloomMaxScale?: number;
        bloomRotationDeg?: number;
        sphereRadius?: number;
        gridCellSize?: number;
        gridCircleRings?: number;
        liquidStrength?: number;
        liquidFrequency?: number;
        starburstInnerScale?: number;
        starburstOuterScale?: number;
        prismRadius?: number;
        orbitalMaxTiltDeg?: number;
        foldingRadius?: number;
    };
    onUpdateSymmetryParams: (params: Partial<DrawingControlPanelProps['symmetryParams']>) => void;

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
    onUpdateSymmetry,
    symmetryParams,
    onUpdateSymmetryParams,
    onClose
}) => {
    const [editingCircleName, setEditingCircleName] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    const [isCircleListOpen, setIsCircleListOpen] = useState(false);
    const circleListRef = useRef<HTMLDivElement>(null);

    const currentCircle = customMagicCircles.find(c => c.id === currentCircleId);
    const layers = currentCircle?.layers || [];

    // 对称模式选项
    const symmetryModes: { mode: SymmetryMode; label: string }[] = [
        { mode: 'none', label: '无' },
        { mode: 'radial', label: '径向' },
        { mode: 'kaleidoscope', label: '万花筒' },
        { mode: 'starburst', label: '星芒' },
        { mode: 'prism', label: '棱镜' },
        { mode: 'vortex', label: '漩涡' },
        { mode: 'bloom', label: '绽放' },
        { mode: 'sphere', label: '球面' },
        { mode: 'orbital', label: '轨道环' },
        { mode: 'folding', label: '折叠' },
        { mode: 'liquid', label: '湍流' },
        { mode: 'gridHex', label: '蜂巢' },
        { mode: 'gridCircle', label: '圆形' }
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

    // 点击外部关闭法阵列表
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (circleListRef.current && !circleListRef.current.contains(e.target as Node)) {
                setIsCircleListOpen(false);
            }
        };
        if (isCircleListOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isCircleListOpen]);

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
                        <div className="flex items-center gap-2 text-gray-300">
                            <MagicCircleIcon size={14} />
                            <span className="text-xs font-medium">自定义法阵</span>
                        </div>
                        <button
                            onClick={onCreateCircle}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-green-400 hover:text-green-300"
                            title="新建法阵"
                        >
                            <AddIcon size={14} />
                        </button>
                    </div>

                    {/* 法阵弹出式选择器 */}
                    <div ref={circleListRef} className="relative">
                        {/* 触发按钮 - 显示当前选中法阵 */}
                        <button
                            onClick={() => setIsCircleListOpen(!isCircleListOpen)}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-700/80 text-white text-xs rounded border border-white/10 cursor-pointer hover:bg-gray-600/80 transition-colors"
                        >
                            <span className="truncate">
                                {currentCircle?.name || '选择法阵...'}
                            </span>
                            <span className="text-gray-500 ml-2">{isCircleListOpen ? '▲' : '▼'}</span>
                        </button>

                        {/* 弹出列表 */}
                        {isCircleListOpen && (
                            <div className="absolute z-50 left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {customMagicCircles.length === 0 ? (
                                    <div className="px-3 py-2 text-gray-500 text-xs">暂无法阵</div>
                                ) : (
                                    customMagicCircles.map(circle => {
                                        const isSelected = circle.id === currentCircleId;
                                        const isEditing = editingCircleName === circle.id;

                                        return isEditing ? (
                                            <div key={circle.id} className="px-2 py-1">
                                                <input
                                                    type="text"
                                                    value={tempName}
                                                    onChange={e => setTempName(e.target.value)}
                                                    onBlur={finishRenaming}
                                                    onKeyDown={e => e.key === 'Enter' && finishRenaming()}
                                                    className="w-full px-2 py-1 text-xs bg-gray-700 rounded text-white outline-none"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                key={circle.id}
                                                className={`group flex items-center justify-between px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-purple-500/30 text-white' : 'text-gray-300 hover:bg-gray-700'
                                                    }`}
                                                onClick={() => {
                                                    onSelectCircle(circle.id);
                                                    setIsCircleListOpen(false);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    startRenaming(circle);
                                                }}
                                            >
                                                <div className="flex items-center gap-2 flex-1 truncate">
                                                    {isSelected && <span className="text-purple-400 text-xs">★</span>}
                                                    <span className="text-xs truncate">{circle.name}</span>
                                                </div>
                                                {/* 删除按钮 - 每项都有 */}
                                                {customMagicCircles.length > 1 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteCircle(circle.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                                        title="删除"
                                                    >
                                                        <DeleteIcon size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ==================== 对称设置 ==================== */}
                <div className="drawing-panel-glass rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-300 mb-2">
                        <SymmetryIcon size={14} />
                        <span className="text-xs font-medium">对称设置</span>
                    </div>

                    {/* 对称模式 - 多行布局 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                        {symmetryModes.map(({ mode, label }) => (
                            <button
                                key={mode}
                                onClick={() => onUpdateSymmetry(mode, symmetryDivisions)}
                                className={`px-2 py-1 text-xs rounded transition-all ${symmetryMode === mode
                                    ? 'drawing-symmetry-btn-active'
                                    : 'drawing-symmetry-btn-inactive'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 分割数 (仅非 none 模式显示) */}
                    {symmetryMode !== 'none' && (
                        <div className="flex items-center gap-2">
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
                    )}

                    {/* ==================== 模式专属参数 ==================== */}
                    {/* 漩涡模式参数 */}
                    {symmetryMode === 'vortex' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="text-xs text-gray-400 block mb-1">扭曲圈数</span>
                            <div className="flex items-center gap-2">
                                <input type="range" min={0.5} max={5} step={0.1}
                                    value={symmetryParams.vortexMaxTwist ?? 1.5}
                                    onChange={(e) => onUpdateSymmetryParams({ vortexMaxTwist: Number(e.target.value) })}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                <span className="text-xs text-white w-8 text-center">{(symmetryParams.vortexMaxTwist ?? 1.5).toFixed(1)}</span>
                            </div>
                        </div>
                    )}

                    {/* 绽放模式参数 */}
                    {symmetryMode === 'bloom' && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">最小缩放</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={0.1} max={1} step={0.1}
                                        value={symmetryParams.bloomMinScale ?? 0.2}
                                        onChange={(e) => onUpdateSymmetryParams({ bloomMinScale: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.bloomMinScale ?? 0.2).toFixed(1)}x</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">最大缩放</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={1} max={4} step={0.1}
                                        value={symmetryParams.bloomMaxScale ?? 2.0}
                                        onChange={(e) => onUpdateSymmetryParams({ bloomMaxScale: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.bloomMaxScale ?? 2.0).toFixed(1)}x</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">层间角度</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={10} max={60} step={5}
                                        value={symmetryParams.bloomRotationDeg ?? 30}
                                        onChange={(e) => onUpdateSymmetryParams({ bloomRotationDeg: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{symmetryParams.bloomRotationDeg ?? 30}°</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 球面模式参数 */}
                    {symmetryMode === 'sphere' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="text-xs text-gray-400 block mb-1">球体半径</span>
                            <div className="flex items-center gap-2">
                                <input type="range" min={0.1} max={0.5} step={0.05}
                                    value={symmetryParams.sphereRadius ?? 0.25}
                                    onChange={(e) => onUpdateSymmetryParams({ sphereRadius: Number(e.target.value) })}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                <span className="text-xs text-white w-8 text-center">{(symmetryParams.sphereRadius ?? 0.25).toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* 星芒模式参数 */}
                    {symmetryMode === 'starburst' && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">内缩比例</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={0.2} max={0.8} step={0.05}
                                        value={symmetryParams.starburstInnerScale ?? 0.5}
                                        onChange={(e) => onUpdateSymmetryParams({ starburstInnerScale: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.starburstInnerScale ?? 0.5).toFixed(2)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">外延比例</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={1} max={2} step={0.1}
                                        value={symmetryParams.starburstOuterScale ?? 1.3}
                                        onChange={(e) => onUpdateSymmetryParams({ starburstOuterScale: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.starburstOuterScale ?? 1.3).toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 棱镜模式参数 */}
                    {symmetryMode === 'prism' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="text-xs text-gray-400 block mb-1">棱柱半径</span>
                            <div className="flex items-center gap-2">
                                <input type="range" min={0.1} max={0.5} step={0.05}
                                    value={symmetryParams.prismRadius ?? 0.3}
                                    onChange={(e) => onUpdateSymmetryParams({ prismRadius: Number(e.target.value) })}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                <span className="text-xs text-white w-8 text-center">{(symmetryParams.prismRadius ?? 0.3).toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* 轨道环模式参数 */}
                    {symmetryMode === 'orbital' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="text-xs text-gray-400 block mb-1">最大倾角</span>
                            <div className="flex items-center gap-2">
                                <input type="range" min={30} max={90} step={5}
                                    value={symmetryParams.orbitalMaxTiltDeg ?? 90}
                                    onChange={(e) => onUpdateSymmetryParams({ orbitalMaxTiltDeg: Number(e.target.value) })}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                <span className="text-xs text-white w-8 text-center">{symmetryParams.orbitalMaxTiltDeg ?? 90}°</span>
                            </div>
                        </div>
                    )}

                    {/* 折叠模式参数 */}
                    {symmetryMode === 'folding' && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="text-xs text-gray-400 block mb-1">折叠半径</span>
                            <div className="flex items-center gap-2">
                                <input type="range" min={0.1} max={0.4} step={0.05}
                                    value={symmetryParams.foldingRadius ?? 0.25}
                                    onChange={(e) => onUpdateSymmetryParams({ foldingRadius: Number(e.target.value) })}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                <span className="text-xs text-white w-8 text-center">{(symmetryParams.foldingRadius ?? 0.25).toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* 网格模式参数 */}
                    {(symmetryMode === 'gridHex' || symmetryMode === 'gridCircle') && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">格子大小</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={0.05} max={0.3} step={0.01}
                                        value={symmetryParams.gridCellSize ?? 0.15}
                                        onChange={(e) => onUpdateSymmetryParams({ gridCellSize: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.gridCellSize ?? 0.15).toFixed(2)}</span>
                                </div>
                            </div>
                            {symmetryMode === 'gridCircle' && (
                                <div>
                                    <span className="text-xs text-gray-400 block mb-1">环数</span>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min={2} max={10} step={1}
                                            value={symmetryParams.gridCircleRings ?? 4}
                                            onChange={(e) => onUpdateSymmetryParams({ gridCircleRings: Number(e.target.value) })}
                                            className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                        <span className="text-xs text-white w-8 text-center">{symmetryParams.gridCircleRings ?? 4}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 湍流模式参数 */}
                    {symmetryMode === 'liquid' && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">扭曲强度</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={0.02} max={0.2} step={0.01}
                                        value={symmetryParams.liquidStrength ?? 0.08}
                                        onChange={(e) => onUpdateSymmetryParams({ liquidStrength: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{(symmetryParams.liquidStrength ?? 0.08).toFixed(2)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block mb-1">噪声频率</span>
                                <div className="flex items-center gap-2">
                                    <input type="range" min={1} max={20} step={1}
                                        value={symmetryParams.liquidFrequency ?? 7}
                                        onChange={(e) => onUpdateSymmetryParams({ liquidFrequency: Number(e.target.value) })}
                                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                    <span className="text-xs text-white w-8 text-center">{symmetryParams.liquidFrequency ?? 7}</span>
                                </div>
                            </div>
                        </div>
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
