import React, { useState } from 'react';
import World from './components/World';
import { Activity, Globe, Wifi, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [activeStat, setActiveStat] = useState<number | null>(null);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <World />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-12">
        
        {/* Header */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
              DATA SPHERE
            </h1>
            <p className="text-blue-200/70 text-sm md:text-base mt-2 tracking-widest uppercase font-mono">
              Global Neural Network Visualization
            </p>
          </div>
          
          <div className="hidden md:flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-green-400 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              SYSTEM ONLINE
            </div>
            <div className="text-right text-white/50 text-xs font-mono">
              LAT: 35.6895° N <br />
              LON: 139.6917° E
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-2/3 lg:w-1/2 pointer-events-auto">
          {[
            { icon: Globe, label: "Active Nodes", value: "4,291" },
            { icon: Zap, label: "Throughput", value: "840 TB/s" },
            { icon: Activity, label: "Latency", value: "12ms" },
            { icon: Wifi, label: "Coverage", value: "99.9%" },
          ].map((stat, idx) => (
            <div 
              key={idx}
              className={`
                group backdrop-blur-md bg-black/20 border border-white/10 p-4 rounded-lg 
                hover:bg-white/5 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer
                ${activeStat === idx ? 'border-cyan-500 bg-cyan-900/20' : ''}
              `}
              onMouseEnter={() => setActiveStat(idx)}
              onMouseLeave={() => setActiveStat(null)}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${activeStat === idx ? 'text-cyan-400' : 'text-blue-400/70'}`} />
                <div className={`w-1.5 h-1.5 rounded-full ${activeStat === idx ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-white/20'}`}></div>
              </div>
              <div className="text-2xl font-bold text-white mb-1 tracking-tight">{stat.value}</div>
              <div className="text-xs text-blue-200/50 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Vignette Overlay for cinematic look */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
    </div>
  );
};

export default App;
