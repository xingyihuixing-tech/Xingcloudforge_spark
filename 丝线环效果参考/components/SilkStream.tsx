import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FlowRoute } from '../types';
import { silkVertexShader, silkFragmentShader } from './SilkShader';

interface SilkStreamProps {
  route: FlowRoute;
}

const SilkStream: React.FC<SilkStreamProps> = ({ route }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate a closed, organic orbital path
  const curve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 100; // Optimized segment count for performance with high particle count

    // 1. Establish a coordinate system for the orbit plane based on the axis
    const axis = route.orbitAxis.clone().normalize();
    
    // Find a perpendicular vector (u)
    let u = new THREE.Vector3(0, 1, 0);
    if (Math.abs(axis.y) > 0.99) u.set(1, 0, 0);
    u.cross(axis).normalize();
    
    // Find the third vector (v)
    const v = new THREE.Vector3().crossVectors(axis, u).normalize();

    // 2. Generate points around the circle with perturbations
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      
      // --- Organic Variation Math ---
      
      // Base Shape Wobble (Low Frequency)
      const baseWobble = Math.sin(theta * 3.0 + route.seed) * 0.4;
      
      // Spiral/Ripple (High Frequency)
      const spiralRipple = Math.cos(theta * route.wobbleFreq + route.seed * 2.0);
      
      // Dynamic Radius
      const r = route.orbitRadius + (baseWobble + spiralRipple) * route.wobbleAmp;

      // 2D Plane Position
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;

      // 3D Space Construction
      const point = new THREE.Vector3()
        .addScaledVector(u, x)
        .addScaledVector(v, y);
      
      // Z-Axis Drift (makes it 3D)
      const zDrift = Math.sin(theta * 2.0 + route.seed) * (route.wobbleAmp * 0.8);
      point.addScaledVector(axis, zDrift);

      points.push(point);
    }

    return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  }, [route]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: route.color },
    uSpeed: { value: route.speed },
    uOpacity: { value: 0.8 } 
  }), [route.color, route.speed]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 150, route.thickness, 6, true]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={silkVertexShader}
        fragmentShader={silkFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default SilkStream;
