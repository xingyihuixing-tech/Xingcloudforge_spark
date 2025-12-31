/**
 * XingForge AI - Planet Selector Component
 * 
 * input: planets 列表, selectedId, onChange
 * output: 选中的星球 ID
 * pos: 修改模式下选择目标星球
 * update: 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md
 */

import React from 'react';

interface Planet {
    id: string;
    name: string;
    enabled: boolean;
}

interface PlanetSelectorProps {
    planets: Planet[];
    selectedId: string | null;
    onChange: (planetId: string) => void;
}

export const PlanetSelector: React.FC<PlanetSelectorProps> = ({
    planets,
    selectedId,
    onChange
}) => {
    if (planets.length === 0) {
        return (
            <div className="text-sm text-white/40 text-center py-4">
                暂无星球，请先在创造模式中创建
            </div>
        );
    }

    return (
        <div className="bg-black/40 rounded-lg border border-white/10 overflow-hidden">
            <div className="px-3 py-2 bg-white/5 text-sm font-medium text-white/80">
                🎯 选择要修改的星球
            </div>
            <div className="max-h-[150px] overflow-y-auto">
                {planets.map(planet => (
                    <label
                        key={planet.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${selectedId === planet.id ? 'bg-blue-500/20' : ''
                            }`}
                    >
                        <input
                            type="radio"
                            name="planet"
                            checked={selectedId === planet.id}
                            onChange={() => onChange(planet.id)}
                            className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-lg">🪐</span>
                        <span className={`text-sm flex-1 ${planet.enabled ? 'text-white/80' : 'text-white/40'}`}>
                            {planet.name}
                        </span>
                        {!planet.enabled && (
                            <span className="text-xs text-white/30">(已禁用)</span>
                        )}
                    </label>
                ))}
            </div>
        </div>
    );
};

export default PlanetSelector;
