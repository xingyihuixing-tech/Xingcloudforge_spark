import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Stats } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Galaxy from './Galaxy';
import { GalaxyParameters, CameraView } from '../types';

interface ExperienceProps {
  params: GalaxyParameters;
  cameraView: CameraView;
}

// Helper to handle camera transitions
const CameraController: React.FC<{ view: CameraView }> = ({ view }) => {
  const { camera, controls } = useThree();
  const controlsRef = useRef<any>(null); // OrbitControls type is tricky to import sometimes, using any for safety

  useEffect(() => {
    const duration = 1500; // ms (not used for simple lerp here, instant switch or simple logic)
    // In a real app we might use gsap or spring for smooth transitions
    
    let targetPos = new THREE.Vector3();

    switch (view) {
      case CameraView.TOP:
        targetPos.set(0, 10, 0);
        break;
      case CameraView.SIDE:
        targetPos.set(10, 0, 0);
        break;
      case CameraView.CENTER:
        targetPos.set(0.1, 0.1, 0.1); // Close to center
        break;
      case CameraView.ANGLED:
      default:
        targetPos.set(0, 6, 8);
        break;
    }

    // Smoothly interpolate - using a simple set for this demo to ensure reliability
    // To make it smoother we would do this in useFrame, but specific positions are requested.
    // Let's just set it and let OrbitControls handle the damping if enabled.
    camera.position.copy(targetPos);
    camera.lookAt(0, 0, 0);
    
  }, [view, camera]);

  return null;
};

const Experience: React.FC<ExperienceProps> = ({ params, cameraView }) => {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 6, 8], fov: 60 }}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    >
      <color attach="background" args={['#050505']} />
      
      <CameraController view={cameraView} />
      
      <OrbitControls 
        makeDefault 
        enableDamping={true} 
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={20}
      />

      <Galaxy params={params} />

      {params.enableStars && (
        <Stars radius={50} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      )}

      {params.enableBloom && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      )}

      {/* Stats for performance monitoring */}
      <Stats className="!left-auto !right-0 !top-auto !bottom-0" />
    </Canvas>
  );
};

export default Experience;