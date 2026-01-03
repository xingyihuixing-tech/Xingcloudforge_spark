import React from 'react';
import { GalaxyParameters, CameraView, Preset } from '../types';
import { GALAXY_PRESETS, DEFAULT_PARAMETERS } from '../constants';
import Panel from './UI/Panel';

interface ControlsProps {
  params: GalaxyParameters;
  setParams: React.Dispatch<React.SetStateAction<GalaxyParameters>>;
  setCameraView: (view: CameraView) => void;
  particleCount: number;
}

const SliderControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs text-gray-400">
      <span>{label}</span>
      <span>{value.toFixed(step < 0.1 ? 2 : 1)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer hover:bg-gray-600 accent-blue-500"
    />
  </div>
);

const ColorControl: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-400">{label}</span>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-6 bg-transparent border-none cursor-pointer"
      />
      <span className="text-xs font-mono text-gray-500">{value}</span>
    </div>
  </div>
);

const ToggleControl: React.FC<{
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-400">{label}</span>
    <input 
      type="checkbox" 
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded bg-gray-700 accent-blue-500 cursor-pointer"
    />
  </div>
);

const Controls: React.FC<ControlsProps> = ({ params, setParams, setCameraView, particleCount }) => {
  
  const updateParam = <K extends keyof GalaxyParameters>(key: K, value: GalaxyParameters[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: Preset) => {
    setParams(prev => ({
      ...prev,
      ...preset.params
    }));
    if (preset.cameraView) {
      setCameraView(preset.cameraView);
    }
  };

  const resetParams = () => {
    setParams(DEFAULT_PARAMETERS);
  };

  return (
    <div className="absolute top-0 right-0 w-80 h-full p-4 overflow-y-auto pointer-events-none flex flex-col gap-4 z-10">
      {/* Enable pointer events only for the panels */}
      <div className="pointer-events-auto space-y-4">
        
        <Panel title="Statistics">
           <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
             <div>Particles:</div>
             <div className="text-right font-mono text-blue-400">{particleCount.toLocaleString()}</div>
             <div>Diameter:</div>
             <div className="text-right font-mono text-blue-400">~100k LY</div>
           </div>
        </Panel>

        <Panel title="Galaxies" collapsible>
          <div className="grid grid-cols-2 gap-2">
            {GALAXY_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="px-3 py-2 text-xs text-left font-medium text-white bg-white/10 hover:bg-blue-600/50 border border-white/5 hover:border-blue-400/50 rounded transition-all duration-200 h-full flex items-center"
              >
                {preset.name}
              </button>
            ))}
            <button
                onClick={resetParams}
                className="col-span-2 mt-2 px-3 py-2 text-xs font-medium text-red-200 bg-red-900/20 hover:bg-red-900/50 border border-red-900/50 rounded transition-colors duration-200"
              >
                Reset Default
              </button>
          </div>
        </Panel>

        <Panel title="Camera" collapsible>
          <div className="flex gap-2 justify-between">
             <button onClick={() => setCameraView(CameraView.ANGLED)} className="flex-1 py-1 px-2 text-xs bg-white/10 hover:bg-white/20 rounded">Angled</button>
             <button onClick={() => setCameraView(CameraView.TOP)} className="flex-1 py-1 px-2 text-xs bg-white/10 hover:bg-white/20 rounded">Top</button>
             <button onClick={() => setCameraView(CameraView.SIDE)} className="flex-1 py-1 px-2 text-xs bg-white/10 hover:bg-white/20 rounded">Side</button>
             <button onClick={() => setCameraView(CameraView.CENTER)} className="flex-1 py-1 px-2 text-xs bg-white/10 hover:bg-white/20 rounded">Core</button>
          </div>
        </Panel>

        <Panel title="Structure" collapsible>
          <SliderControl 
            label="Branch Count" 
            value={params.branches} min={1} max={12} step={1} 
            onChange={(v) => updateParam('branches', v)} 
          />
          <SliderControl 
            label="Spin Angle" 
            value={params.spin} min={-2} max={6} step={0.1} 
            onChange={(v) => updateParam('spin', v)} 
          />
          <SliderControl 
            label="Radius" 
            value={params.radius} min={2} max={10} step={0.1} 
            onChange={(v) => updateParam('radius', v)} 
          />
          <SliderControl 
            label="Core Bulge" 
            value={params.coreSize} min={0} max={3} step={0.1} 
            onChange={(v) => updateParam('coreSize', v)} 
          />
        </Panel>

        <Panel title="Features" collapsible>
           <div className="space-y-3 pt-1">
             <ToggleControl 
                label="Show Solar System" 
                checked={params.showSolarSystem} 
                onChange={(v) => updateParam('showSolarSystem', v)} 
             />
             <ToggleControl 
                label="Interacting Companion" 
                checked={params.hasCompanion} 
                onChange={(v) => updateParam('hasCompanion', v)} 
             />
           </div>
        </Panel>

        <Panel title="Particles" collapsible>
          <SliderControl 
            label="Count (Density)" 
            value={params.count} min={1000} max={200000} step={1000} 
            onChange={(v) => updateParam('count', v)} 
          />
          <SliderControl 
            label="Size" 
            value={params.size} min={0.001} max={0.1} step={0.001} 
            onChange={(v) => updateParam('size', v)} 
          />
          <SliderControl 
            label="Randomness" 
            value={params.randomness} min={0} max={3} step={0.01} 
            onChange={(v) => updateParam('randomness', v)} 
          />
        </Panel>

        <Panel title="Colors" collapsible>
          <ColorControl 
            label="Core Color" 
            value={params.insideColor} 
            onChange={(v) => updateParam('insideColor', v)} 
          />
          <ColorControl 
            label="Outer Color" 
            value={params.outsideColor} 
            onChange={(v) => updateParam('outsideColor', v)} 
          />
        </Panel>

        <Panel title="Animation & Effects" collapsible>
          <SliderControl 
            label="Simulation Speed" 
            value={params.speed} min={0} max={2} step={0.1} 
            onChange={(v) => updateParam('speed', v)} 
          />
           <SliderControl 
            label="Rotation Speed" 
            value={params.rotationSpeed} min={-0.5} max={0.5} step={0.01} 
            onChange={(v) => updateParam('rotationSpeed', v)} 
          />
          <div className="space-y-2 pt-2">
            <ToggleControl 
              label="Bloom Effect" 
              checked={params.enableBloom} 
              onChange={(v) => updateParam('enableBloom', v)} 
            />
            <ToggleControl 
              label="Background Stars" 
              checked={params.enableStars} 
              onChange={(v) => updateParam('enableStars', v)} 
            />
          </div>
        </Panel>
      </div>
      
      <div className="pointer-events-auto mt-auto mb-4">
        <div className="bg-black/40 backdrop-blur-sm p-2 rounded text-[10px] text-center text-gray-500">
           Stellar Forge v1.2 • React + Three.js
        </div>
      </div>
    </div>
  );
};

export default Controls;