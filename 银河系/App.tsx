import React, { useState } from 'react';
import Experience from './components/Experience';
import Controls from './components/Controls';
import { DEFAULT_PARAMETERS } from './constants';
import { GalaxyParameters, CameraView } from './types';

const App: React.FC = () => {
  const [params, setParams] = useState<GalaxyParameters>(DEFAULT_PARAMETERS);
  const [cameraView, setCameraView] = useState<CameraView>(CameraView.ANGLED);

  return (
    <div className="relative w-full h-full bg-black text-white">
      {/* Main 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Experience params={params} cameraView={cameraView} />
      </div>

      {/* Overlay UI */}
      <Controls 
        params={params} 
        setParams={setParams} 
        setCameraView={setCameraView}
        particleCount={params.count}
      />

      {/* Title Overlay */}
      <div className="absolute top-6 left-6 pointer-events-none z-10">
        <h1 className="text-4xl font-light tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          STELLAR<span className="font-bold text-blue-300">FORGE</span>
        </h1>
        <p className="text-blue-200/60 text-sm tracking-widest mt-1 uppercase">
          Interactive Galaxy Simulation
        </p>
      </div>

      {/* Interaction Hint */}
      <div className="absolute bottom-6 left-6 pointer-events-none z-10 opacity-50">
        <div className="flex items-center gap-4 text-xs font-mono">
           <span className="flex items-center gap-1">
             <span className="w-4 h-4 border border-white/30 rounded-full flex items-center justify-center">L</span>
             <span>ROTATE</span>
           </span>
           <span className="flex items-center gap-1">
             <span className="w-4 h-4 border border-white/30 rounded-full flex items-center justify-center">R</span>
             <span>PAN</span>
           </span>
           <span className="flex items-center gap-1">
             <span className="w-4 h-4 border border-white/30 rounded-full flex items-center justify-center">S</span>
             <span>ZOOM</span>
           </span>
        </div>
      </div>
    </div>
  );
};

export default App;