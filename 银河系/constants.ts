import { GalaxyParameters, Preset, CameraView } from './types';

export const DEFAULT_PARAMETERS: GalaxyParameters = {
  count: 100000,
  size: 0.015,
  radius: 5,
  branches: 3,
  spin: 1,
  randomness: 0.2,
  randomnessPower: 3,
  insideColor: '#ff6030',
  outsideColor: '#1b3984',
  speed: 0.2,
  enableBloom: true,
  enableStars: true,
  rotationSpeed: 0.1,
  hasCompanion: false,
  showSolarSystem: false,
  coreSize: 0.1,
};

export const GALAXY_PRESETS: Preset[] = [
  {
    name: 'Milky Way (Home)',
    params: {
      branches: 4,
      spin: 0.8,
      randomness: 0.25,
      randomnessPower: 3,
      insideColor: '#f8d090', // Warm Gold Core
      outsideColor: '#2b1d42', // Deep Purple/Blue Arms
      radius: 6,
      count: 120000,
      showSolarSystem: true,
      hasCompanion: false,
      coreSize: 0.2,
      enableBloom: true,
    },
    cameraView: CameraView.ANGLED
  },
  {
    name: 'Andromeda (M31)',
    params: {
      branches: 2,
      spin: 1.5,
      randomness: 0.4,
      randomnessPower: 3,
      insideColor: '#ffebd4', // Bright White/Peach
      outsideColor: '#6e8cc7', // Soft Blue
      radius: 7,
      count: 150000, // Higher density
      showSolarSystem: false,
      hasCompanion: false,
      coreSize: 0.4,
      enableBloom: true,
    },
    cameraView: CameraView.ANGLED
  },
  {
    name: 'Sombrero (M104)',
    params: {
      branches: 20, // Many branches create a disk-like appearance
      spin: 4,
      randomness: 0.2,
      randomnessPower: 5, 
      insideColor: '#fff6d9', // Bright Bulge
      outsideColor: '#2c1b18', // Dark Dust Lane
      radius: 5,
      coreSize: 2.0, // Large central bulge
      count: 100000,
      showSolarSystem: false,
      hasCompanion: false,
      rotationSpeed: 0.05,
    },
    cameraView: CameraView.SIDE
  },
  {
    name: 'Whirlpool (M51)',
    params: {
      branches: 2,
      spin: 1.2,
      randomness: 0.3,
      randomnessPower: 3,
      insideColor: '#ffffff',
      outsideColor: '#5599ff', // Bright Blue
      radius: 5,
      hasCompanion: true, // Interacting galaxy
      showSolarSystem: false,
      coreSize: 0.15,
      count: 110000,
    },
    cameraView: CameraView.TOP
  },
  {
    name: 'Flower (Spring)',
    params: {
      branches: 6,
      spin: 0.4,
      randomness: 1.5,
      randomnessPower: 2.5,
      insideColor: '#ffd700', // Gold core
      outsideColor: '#ffb7c5', // Cherry blossom
      radius: 6,
      count: 90000,
      size: 0.02,
      speed: 0.1,
      hasCompanion: false,
      showSolarSystem: false,
      enableBloom: true,
    },
    cameraView: CameraView.ANGLED
  },
  {
    name: 'Aurora (Polar)',
    params: {
      branches: 3,
      spin: 0.1, // Almost straight lines/curtains
      randomness: 2.5, // High scatter for curtain effect
      randomnessPower: 1.5,
      insideColor: '#00ffaa', // Green/Teal
      outsideColor: '#a020f0', // Purple
      radius: 5,
      count: 100000,
      size: 0.02,
      enableStars: true,
      rotationSpeed: 0.02, // Slow dance
      coreSize: 0.5, 
      hasCompanion: false,
      showSolarSystem: false,
    },
    cameraView: CameraView.SIDE // Best for "curtains"
  },
  {
    name: 'Ocean Vortex',
    params: {
      branches: 5,
      spin: 3.5, // Tight spiral
      randomness: 0.3,
      randomnessPower: 4,
      insideColor: '#000080', // Navy
      outsideColor: '#00ffff', // Cyan
      radius: 6,
      count: 120000,
      speed: 0.4, // Fast flow
      enableBloom: true,
      coreSize: 0, // Deep hole
      hasCompanion: false,
      showSolarSystem: false,
    },
    cameraView: CameraView.TOP
  },
  {
    name: 'Forest (Life)',
    params: {
      branches: 8,
      spin: 0.5,
      randomness: 0.8,
      randomnessPower: 3,
      insideColor: '#ffbf00', // Amber
      outsideColor: '#228b22', // Forest Green
      radius: 7,
      count: 110000,
      size: 0.015,
      hasCompanion: false,
      showSolarSystem: false,
    },
    cameraView: CameraView.ANGLED
  },
  {
    name: 'Desert Storm',
    params: {
      branches: 1, // Continuous
      spin: 6, // Very tight
      randomness: 1.2, // Dusty
      randomnessPower: 2,
      insideColor: '#cd853f', // Peru
      outsideColor: '#f4a460', // SandyBrown
      radius: 5,
      count: 150000,
      size: 0.01, // Fine sand
      speed: 0.8, // Fast wind
      enableBloom: false, 
      rotationSpeed: 0.3,
      hasCompanion: false,
      showSolarSystem: false,
    },
    cameraView: CameraView.ANGLED
  }
];