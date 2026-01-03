import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Globe from './Globe';
import SilkStream from './SilkStream';
import { FlowRoute } from '../types';

// Rotator component to slowly spin the entire connection network
const NetworkGroup: React.FC<{ routes: FlowRoute[] }> = ({ routes }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Spin the whole system slowly to show off the 3D depth
            groupRef.current.rotation.y += delta * 0.05;
            groupRef.current.rotation.z += delta * 0.02;
        }
    });
    
    return (
        <group ref={groupRef}>
            {routes.map((route) => (
                <SilkStream key={route.id} route={route} />
            ))}
        </group>
    );
}

const World: React.FC = () => {
  // Generate organic orbital data streams
  const routes = useMemo<FlowRoute[]>(() => {
    const items: FlowRoute[] = [];
    
    const palette = [
      new THREE.Color('#00ffff'), // Cyan
      new THREE.Color('#4d9fff'), // Light Blue
      new THREE.Color('#0066ff'), // Deep Blue
      new THREE.Color('#aaddff'), // Pale Blue
      new THREE.Color('#00ffcc'), // Teal
      new THREE.Color('#8844ff'), // Purple accent
      new THREE.Color('#ffffff'), // White hot highlights
    ];

    // Configuration for clusters
    const numClusters = 32; // Number of main "ribbons"
    
    for (let c = 0; c < numClusters; c++) {
      // --- Cluster Properties ---
      
      // 1. Non-uniform Radius Distribution
      // Use power function to push more clusters closer to planet surface, fewer far out
      // Base radius 10.0 (planet surface)
      const distFactor = Math.pow(Math.random(), 2.0); // Curve distribution
      const clusterBaseRadius = 11.0 + distFactor * 12.0; 

      // 2. Cluster Axis (Orientation)
      // Randomize orientation but bias slightly towards equator for some coherence
      const clusterAxis = new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 0.8, 
        (Math.random() - 0.5) * 2.0
      ).normalize();

      // 3. Cluster visual identity
      const clusterBaseColor = palette[Math.floor(Math.random() * palette.length)];
      // Faster base speed for the whole cluster
      const clusterBaseSpeed = 2.0 + Math.random() * 2.5; 
      
      // Determine strands per cluster (thicker bundles near surface, thinner far out)
      const strandsPerCluster = 6 + Math.floor(Math.random() * 6);

      // --- Generate Strands for this Cluster ---
      for (let s = 0; s < strandsPerCluster; s++) {
        // Variation within the cluster
        
        // Spread radius slightly so they don't overlap perfectly
        const radiusSpread = (Math.random() - 0.5) * 0.6;
        const orbitRadius = clusterBaseRadius + radiusSpread;

        // Spread axis slightly for "ribbon" width effect
        const axisSpread = new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        );
        const orbitAxis = clusterAxis.clone().add(axisSpread).normalize();

        // Wobble characteristics
        // Inner orbits vibrate faster, outer ones slower
        const wobbleFreq = 6 + Math.random() * 4;
        const wobbleAmp = 0.3 + (Math.random() * 0.2);

        // Speed variation within cluster
        const speed = clusterBaseSpeed + (Math.random() - 0.5) * 0.4;
        
        // Finer thickness for silk look
        const thickness = 0.02 + Math.random() * 0.08;

        items.push({
          id: `cluster-${c}-strand-${s}`,
          orbitAxis,
          orbitRadius,
          wobbleFreq,
          wobbleAmp,
          tilt: Math.random() * Math.PI * 2,
          speed,
          color: clusterBaseColor,
          thickness,
          seed: Math.random() * 1000, // Unique noise offset
        } as any);
      }
    }
    return items;
  }, []);

  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 35], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#020205']} />
        
        {/* Cinematic Lighting */}
        <ambientLight intensity={0.2} />
        <pointLight position={[50, 20, 50]} intensity={2.0} color="#ccddff" />
        <pointLight position={[-30, -20, -20]} intensity={2.5} color="#4455ff" />
        <spotLight position={[0, 50, 0]} angle={0.5} penumbra={1} intensity={1.5} color="#00ffff" />
        
        <Stars radius={150} depth={60} count={8000} factor={4} saturation={0} fade speed={0.8} />

        <Globe />

        <NetworkGroup routes={routes} />

        <OrbitControls 
          enablePan={false} 
          minDistance={15} 
          maxDistance={70} 
          autoRotate 
          autoRotateSpeed={0.8}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};

export default World;
