import { Vector3, Color } from 'three';

export interface FlowRoute {
  id: string;
  orbitAxis: Vector3;    // The axis the ring rotates around
  orbitRadius: number;   // Base distance from center
  wobbleFreq: number;    // How many "waves" are in the circle
  wobbleAmp: number;     // How far the waves extend outwards
  tilt: number;          // Additional randomization
  speed: number;
  color: Color;
  thickness: number;
  seed: number;          // Random seed for unique noise offsets
}
