/**
 * AI 效果参数编辑器 - 左侧面板
 * 
 * input: selectedEffect, onParamChange, onResetParam
 * output: 渲染可编辑参数的 UI 面板
 * pos: AI 创造模式的左侧参数调整面板，类似绘画模式的左侧面板
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React from 'react';

// 可编辑参数接口
export interface EditableParam {
    id: string;
    name: string;
    varName: string;
    type: 'number' | 'color' | 'boolean';
    value: any;
    originalValue: any;
    min?: number;
    max?: number;
    step?: number;
}

// 保存的效果接口（从 AIAssistantPanel 导入的简化版本）
export interface SavedEffectForParams {
    id: string;
    name: string;
    params?: EditableParam[];
    paramsAnalyzing?: boolean;
}

interface AIEffectParamsPanelProps {
    selectedEffect: SavedEffectForParams | null;
    onParamChange: (effectId: string, paramId: string, newValue: any) => void;
    onResetParam: (effectId: string, paramId: string) => void;
    onResetAllParams: (effectId: string) => void;
}

const AIEffectParamsPanel: React.FC<AIEffectParamsPanelProps> = ({
    selectedEffect,
    onParamChange,
    onResetParam,
    onResetAllParams
}) => {
    // 未选中效果
    if (!selectedEffect) {
        return (
            <div className="p-4 text-center">
                <div className="text-gray-500 text-xs mb-2">
                    <span className="text-2xl">⚙️</span>
                </div>
                <p className="text-gray-400 text-xs">
                    在右侧效果管理器中
                    <br />选择一个效果以编辑参数
                </p>
            </div>
        );
    }

    // 正在分析中
    if (selectedEffect.paramsAnalyzing) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin inline-block w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full mb-2"></div>
                <p className="text-gray-400 text-xs">正在分析参数...</p>
            </div>
        );
    }

    // 没有可编辑参数
    if (!selectedEffect.params || selectedEffect.params.length === 0) {
        return (
            <div className="p-4 text-center">
                <div className="text-gray-500 text-2xl mb-2">📭</div>
                <p className="text-gray-400 text-xs">
                    此效果没有
                    <br />可编辑的参数
                </p>
            </div>
        );
    }

    return (
        <div className="p-2">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-xs text-white/90 font-medium truncate flex-1">
                    {selectedEffect.name}
                </div>
                <button
                    onClick={() => onResetAllParams(selectedEffect.id)}
                    className="text-[10px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                    title="重置所有参数"
                >
                    ↺ 全部重置
                </button>
            </div>

            {/* 参数列表 */}
            <div className="space-y-2">
                {selectedEffect.params.map(param => (
                    <div
                        key={param.id}
                        className="bg-white/5 rounded-lg p-2 border border-white/5"
                    >
                        {/* 参数标题行 */}
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] text-gray-300 font-medium">
                                {param.name}
                            </span>
                            <button
                                onClick={() => onResetParam(selectedEffect.id, param.id)}
                                className="text-[10px] text-gray-500 hover:text-white transition-colors"
                                title="重置此参数"
                            >
                                ↺
                            </button>
                        </div>

                        {/* 数值类型 */}
                        {param.type === 'number' && (
                            <div>
                                <input
                                    type="range"
                                    min={param.min ?? 0}
                                    max={param.max ?? 100}
                                    step={param.step ?? 1}
                                    value={param.value}
                                    onChange={(e) => onParamChange(selectedEffect.id, param.id, Number(e.target.value))}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-3 
                    [&::-webkit-slider-thumb]:h-3 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-blue-400
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white/30
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:cursor-pointer
                    hover:[&::-webkit-slider-thumb]:bg-blue-300"
                                />
                                <div className="text-right text-[10px] text-gray-500 mt-0.5">
                                    {typeof param.value === 'number'
                                        ? (param.step && param.step < 1 ? param.value.toFixed(2) : param.value)
                                        : param.value}
                                </div>
                            </div>
                        )}

                        {/* 颜色类型 */}
                        {param.type === 'color' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={typeof param.value === 'string' && param.value.startsWith('#')
                                        ? param.value
                                        : `#${(param.value >>> 0).toString(16).padStart(6, '0')}`}
                                    onChange={(e) => onParamChange(selectedEffect.id, param.id, e.target.value)}
                                    className="w-8 h-6 rounded cursor-pointer bg-transparent border border-white/20"
                                />
                                <span className="text-[10px] text-gray-500 flex-1 text-right">
                                    {typeof param.value === 'string' && param.value.startsWith('#')
                                        ? param.value.toUpperCase()
                                        : `0x${(param.value >>> 0).toString(16).toUpperCase()}`}
                                </span>
                            </div>
                        )}

                        {/* 布尔类型 */}
                        {param.type === 'boolean' && (
                            <button
                                onClick={() => onParamChange(selectedEffect.id, param.id, !param.value)}
                                className={`w-full px-2 py-1 text-[10px] rounded transition-all ${param.value
                                        ? 'bg-green-500/30 text-green-300 border border-green-500/30'
                                        : 'bg-gray-500/30 text-gray-400 border border-gray-500/30'
                                    }`}
                            >
                                {param.value ? '✓ 开启' : '✗ 关闭'}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* 底部提示 */}
            <div className="mt-3 px-1">
                <p className="text-[9px] text-gray-600 text-center">
                    修改参数后效果将自动更新
                </p>
            </div>
        </div>
    );
};

export default AIEffectParamsPanel;
