export interface GalaxyParameters {
  count: number;
  size: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
  insideColor: string;
  outsideColor: string;
  speed: number;
  enableBloom: boolean;
  enableStars: boolean;
  rotationSpeed: number;
  // New specific features
  hasCompanion: boolean;
  showSolarSystem: boolean;
  coreSize: number; // Controls the thickness of the central bulge
}

export enum CameraView {
  TOP = 'TOP',
  SIDE = 'SIDE',
  ANGLED = 'ANGLED',
  CENTER = 'CENTER'
}

export interface Preset {
  name: string;
  params: Partial<GalaxyParameters>;
  cameraView?: CameraView;
}