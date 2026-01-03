import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { atmosphereVertexShader, atmosphereFragmentShader } from './AtmosphereShader';

const Globe: React.FC = () => {
  const globeRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (globeRef.current) {
      globeRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group>
      {/* Main Planet Body - Dark with minimal reflection */}
      <Sphere ref={globeRef} args={[10, 64, 64]}>
        <meshPhongMaterial
          color="#000510"
          emissive="#001020"
          specular="#111111"
          shininess={10}
          transparent={false}
        />
      </Sphere>

      {/* Wireframe Overlay to simulate "Data" grid */}
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[10.05, 32, 32]} />
        <meshBasicMaterial
          color="#1a2b4a"
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Atmospheric Glow */}
      <mesh ref={atmosphereRef} scale={[1.2, 1.2, 1.2]}>
        <sphereGeometry args={[10, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          uniforms={{
            uColor: { value: new THREE.Color('#0066ff') },
            uIntensity: { value: 0.8 },
          }}
        />
      </mesh>
    </group>
  );
};

export default Globe;
