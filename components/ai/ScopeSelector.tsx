/**
 * XingForge AI - Scope Selector Component
 * 
 * input: onChange callback, initialSelection
 * output: ScopeSelection 对象
 * pos: 范围选择器 UI 组件，支持 11 种效果类型的多实例配置
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React, { useState, useCallback } from 'react';
import {
    EffectType,
    EFFECT_INFO,
    EFFECT_SCHEMAS,
    ScopeSelection,
    InstanceConfig,
    FieldConstraint,
    FieldSchema
} from '../../utils/ai/schemaBuilder';

interface ScopeSelectorProps {
    selection: ScopeSelection;
    onChange: (selection: ScopeSelection) => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

// 效果类型列表
const EFFECT_TYPES: EffectType[] = [
    'particleCore', 'solidCore', 'energyCore', 'energyBody',
    'particleRing', 'ringBelt', 'spiralRing',
    'particleOrbit', 'particleJet',
    'rotatingFirefly', 'wanderingFirefly'
];

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
    selection,
    onChange,
    collapsed = true,
    onToggleCollapse
}) => {
    const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set());

    // 切换效果展开状态
    const toggleEffectExpand = useCallback((effectType: string) => {
        setExpandedEffects(prev => {
            const next = new Set(prev);
            if (next.has(effectType)) {
                next.delete(effectType);
            } else {
                next.add(effectType);
            }
            return next;
        });
    }, []);

    // 切换效果启用状态
    const toggleEffect = useCallback((effectType: EffectType, enabled: boolean) => {
        const newSelection = { ...selection };
        if (enabled) {
            // 添加默认实例
            const schema = EFFECT_SCHEMAS[effectType];
            const fields: Record<string, FieldConstraint> = {};
            for (const fieldName of Object.keys(schema.fields)) {
                fields[fieldName] = { enabled: true, freeMode: false };
            }
            newSelection[effectType] = [{ instanceId: 'instance_1', fields }];
        } else {
            delete newSelection[effectType];
        }
        onChange(newSelection);
    }, [selection, onChange]);

    // 添加实例
    const addInstance = useCallback((effectType: EffectType) => {
        const instances = selection[effectType] || [];
        if (instances.length >= 6) return; // 最多 6 个

        const schema = EFFECT_SCHEMAS[effectType];
        const fields: Record<string, FieldConstraint> = {};
        for (const fieldName of Object.keys(schema.fields)) {
            fields[fieldName] = { enabled: true, freeMode: false };
        }

        const newSelection = {
            ...selection,
            [effectType]: [...instances, { instanceId: `instance_${instances.length + 1}`, fields }]
        };
        onChange(newSelection);
    }, [selection, onChange]);

    // 删除实例
    const removeInstance = useCallback((effectType: EffectType, index: number) => {
        const instances = selection[effectType] || [];
        if (instances.length <= 1) {
            // 删除最后一个实例 = 禁用效果
            const newSelection = { ...selection };
            delete newSelection[effectType];
            onChange(newSelection);
        } else {
            const newInstances = instances.filter((_, i) => i !== index);
            onChange({ ...selection, [effectType]: newInstances });
        }
    }, [selection, onChange]);

    // 切换字段启用状态
    const toggleField = useCallback((effectType: EffectType, instanceIndex: number, fieldName: string, enabled: boolean) => {
        const instances = [...(selection[effectType] || [])];
        if (!instances[instanceIndex]) return;

        const instance = { ...instances[instanceIndex] };
        instance.fields = { ...instance.fields };
        instance.fields[fieldName] = { ...instance.fields[fieldName], enabled };
        instances[instanceIndex] = instance;

        onChange({ ...selection, [effectType]: instances });
    }, [selection, onChange]);

    // 设置字段约束
    const setFieldConstraint = useCallback((
        effectType: EffectType,
        instanceIndex: number,
        fieldName: string,
        constraint: Partial<FieldConstraint>
    ) => {
        const instances = [...(selection[effectType] || [])];
        if (!instances[instanceIndex]) return;

        const instance = { ...instances[instanceIndex] };
        instance.fields = { ...instance.fields };
        instance.fields[fieldName] = { ...instance.fields[fieldName], ...constraint };
        instances[instanceIndex] = instance;

        onChange({ ...selection, [effectType]: instances });
    }, [selection, onChange]);

    // 渲染数值约束滑块
    const renderNumberConstraint = (
        effectType: EffectType,
        instanceIndex: number,
        fieldName: string,
        fieldSchema: FieldSchema,
        constraint: FieldConstraint
    ) => {
        const min = fieldSchema.min ?? 0;
        const max = fieldSchema.max ?? 100;
        const currentMin = constraint.min ?? min;
        const currentMax = constraint.max ?? max;

        return (
            <div className="flex items-center gap-2 text-xs">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={currentMin}
                    onChange={(e) => setFieldConstraint(effectType, instanceIndex, fieldName, { min: parseFloat(e.target.value) })}
                    className="w-16 h-1 accent-blue-500"
                    disabled={constraint.freeMode}
                />
                <span className="text-white/50 w-12">{currentMin.toFixed(1)}</span>
                <span className="text-white/30">-</span>
                <span className="text-white/50 w-12">{currentMax.toFixed(1)}</span>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={currentMax}
                    onChange={(e) => setFieldConstraint(effectType, instanceIndex, fieldName, { max: parseFloat(e.target.value) })}
                    className="w-16 h-1 accent-blue-500"
                    disabled={constraint.freeMode}
                />
            </div>
        );
    };

    if (collapsed) {
        return (
            <button
                onClick={onToggleCollapse}
                className="w-full px-3 py-2 text-left text-sm text-white/70 bg-white/5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
            >
                <span>🎛️</span>
                <span>配置范围 (点击展开)</span>
                <span className="ml-auto text-xs text-white/40">
                    {Object.keys(selection).length}/{EFFECT_TYPES.length} 已选
                </span>
            </button>
        );
    }

    return (
        <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden">
            {/* 标题栏 */}
            <div className="px-3 py-2 bg-white/5 flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">🎛️ 配置范围</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            // 全选
                            const allSelection: ScopeSelection = {};
                            for (const effectType of EFFECT_TYPES) {
                                const schema = EFFECT_SCHEMAS[effectType];
                                const fields: Record<string, FieldConstraint> = {};
                                for (const fieldName of Object.keys(schema.fields)) {
                                    fields[fieldName] = { enabled: true, freeMode: false };
                                }
                                allSelection[effectType] = [{ instanceId: 'instance_1', fields }];
                            }
                            onChange(allSelection);
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                    >
                        全选
                    </button>
                    <button
                        onClick={() => onChange({})}
                        className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20"
                    >
                        清空
                    </button>
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20"
                        >
                            收起
                        </button>
                    )}
                </div>
            </div>

            {/* 效果列表 */}
            <div className="max-h-[300px] overflow-y-auto">
                {EFFECT_TYPES.map(effectType => {
                    const info = EFFECT_INFO[effectType];
                    const schema = EFFECT_SCHEMAS[effectType];
                    const instances = selection[effectType] || [];
                    const isEnabled = instances.length > 0;
                    const isExpanded = expandedEffects.has(effectType);

                    return (
                        <div key={effectType} className="border-b border-white/5 last:border-b-0">
                            {/* 效果行 */}
                            <div className="px-3 py-2 flex items-center gap-2 hover:bg-white/5">
                                <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) => toggleEffect(effectType, e.target.checked)}
                                    className="w-4 h-4 accent-blue-500"
                                />
                                <span className="text-lg">{info.icon}</span>
                                <span className="text-sm text-white/80 flex-1">{info.name}</span>
                                {isEnabled && (
                                    <>
                                        <span className="text-xs text-white/40">{instances.length}个实例</span>
                                        {instances.length < 6 && (
                                            <button
                                                onClick={() => addInstance(effectType)}
                                                className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                                            >
                                                +
                                            </button>
                                        )}
                                        <button
                                            onClick={() => toggleEffectExpand(effectType)}
                                            className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/60"
                                        >
                                            {isExpanded ? '▲' : '▼'}
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* 展开的实例详情 */}
                            {isEnabled && isExpanded && (
                                <div className="px-4 py-2 bg-black/30">
                                    {instances.map((instance, idx) => (
                                        <div key={instance.instanceId} className="mb-3 last:mb-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs text-white/50">实例 {idx + 1}</span>
                                                {instances.length > 1 && (
                                                    <button
                                                        onClick={() => removeInstance(effectType, idx)}
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        删除
                                                    </button>
                                                )}
                                            </div>
                                            {/* 字段列表 */}
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                {Object.entries(schema.fields).map(([fieldName, fieldSchema]) => {
                                                    const constraint = instance.fields[fieldName] || { enabled: true };
                                                    return (
                                                        <div key={fieldName} className="flex items-center gap-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={constraint.enabled}
                                                                onChange={(e) => toggleField(effectType, idx, fieldName, e.target.checked)}
                                                                className="w-3 h-3 accent-blue-500"
                                                            />
                                                            <span className={`text-xs ${constraint.enabled ? 'text-white/70' : 'text-white/30'}`}>
                                                                {fieldSchema.desc}
                                                            </span>
                                                            {constraint.enabled && fieldSchema.type === 'number' && (
                                                                <button
                                                                    onClick={() => setFieldConstraint(effectType, idx, fieldName, { freeMode: !constraint.freeMode })}
                                                                    className={`text-xs px-1 rounded ${constraint.freeMode ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/40'}`}
                                                                    title={constraint.freeMode ? '自由发挥' : '有约束'}
                                                                >
                                                                    {constraint.freeMode ? '自由' : '约束'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ScopeSelector;
