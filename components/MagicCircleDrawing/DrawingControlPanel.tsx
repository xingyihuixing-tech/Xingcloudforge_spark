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
    onClose
}) => {
    const [editingCircleName, setEditingCircleName] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    const currentCircle = customMagicCircles.find(c => c.id === currentCircleId);
    const layers = currentCircle?.layers || [];

    // 对称模式选项
    const symmetryModes: { mode: SymmetryMode; label: string }[] = [
        { mode: 'none', label: '无' },
        { mode: 'radial', label: '径向' },
        { mode: 'kaleidoscope', label: '万花筒' }
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
        <div className="fixed right-0 top-0 bottom-0 w-72 bg-gray-900/95 backdrop-blur-md border-l border-white/10 flex flex-col z-50">
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
                <div className="bg-gray-800/50 rounded-lg p-3">
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

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {customMagicCircles.map(circle => {
                            const isSelected = circle.id === currentCircleId;
                            const isEditing = editingCircleName === circle.id;

                            return (
                                <div
                                    key={circle.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${isSelected
                                            ? 'bg-purple-600/30 border border-purple-500/50'
                                            : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    {/* 勾选框 - 控制显示 */}
                                    <button
                                        onClick={() => onToggleCircleEnabled(circle.id, !circle.enabled)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${circle.enabled
                                                ? 'bg-green-600 border-green-500'
                                                : 'bg-transparent border-gray-500 hover:border-gray-400'
                                            }`}
                                        title={circle.enabled ? '点击隐藏' : '点击显示'}
                                    >
                                        {circle.enabled && <CheckIcon size={10} />}
                                    </button>

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

                                    {/* 编辑按钮 */}
                                    <button
                                        onClick={() => onSelectCircle(circle.id)}
                                        className={`p-1 rounded transition-colors ${isSelected
                                                ? 'text-purple-400'
                                                : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                        title="编辑此法阵"
                                    >
                                        <EditIcon size={12} />
                                    </button>

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
                </div>

                {/* ==================== 对称设置 ==================== */}
                <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-300 mb-2">
                        <SymmetryIcon size={14} />
                        <span className="text-xs font-medium">对称设置</span>
                    </div>

                    {/* 对称模式 */}
                    <div className="flex gap-1 mb-2">
                        {symmetryModes.map(({ mode, label }) => (
                            <button
                                key={mode}
                                onClick={() => onUpdateSymmetry(mode, symmetryDivisions)}
                                className={`flex-1 px-2 py-1.5 text-xs rounded transition-all ${symmetryMode === mode
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 分割数 (仅非 none 模式显示) */}
                    {symmetryMode !== 'none' && (
                        <div className="flex flex-wrap gap-1">
                            {divisionOptions.map(n => (
                                <button
                                    key={n}
                                    onClick={() => onUpdateSymmetry(symmetryMode, n)}
                                    className={`px-2 py-1 text-xs rounded transition-all ${symmetryDivisions === n
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ==================== 图层管理 ==================== */}
                <div className="bg-gray-800/50 rounded-lg p-3">
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
                                            ? 'bg-blue-600/30 border border-blue-500/50'
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
