import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GalaxyParameters } from '../types';

interface GalaxyProps {
  params: GalaxyParameters;
}

const Galaxy: React.FC<GalaxyProps> = ({ params }) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate geometry data
  const { positions, colors, solarSystemPosition } = useMemo(() => {
    const { 
      count, radius, branches, spin, randomness, randomnessPower, 
      insideColor, outsideColor, hasCompanion, showSolarSystem, coreSize 
    } = params;
    
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorInside = new THREE.Color(insideColor);
    const colorOutside = new THREE.Color(outsideColor);

    // Helper to generate a single star position
    const generateStar = (
        i: number, 
        currentRadius: number, 
        currentBranches: number, 
        currentSpin: number, 
        offsetX: number, 
        offsetZ: number,
        isCompanion: boolean
    ) => {
      const i3 = i * 3;
      
      // Radius distribution
      const r = Math.random() * currentRadius;
      
      // Spin & Branch
      const spinAngle = r * currentSpin;
      const branchAngle = ((i % currentBranches) / currentBranches) * Math.PI * 2;

      // Randomness
      // We use a different random function for Y to allow for central bulges
      const randomX = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
      // Core bulge logic: More vertical spread near center (r -> 0)
      // coreSize 0.1 is standard, higher means bigger bulge
      const coreFactor = Math.exp(-r * 3) * (coreSize * 2); 
      const randomY = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r 
                      + (Math.random() - 0.5) * coreFactor; 
      
      const randomZ = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;

      const x = Math.cos(branchAngle + spinAngle) * r + randomX + offsetX;
      const y = randomY;
      const z = Math.sin(branchAngle + spinAngle) * r + randomZ + offsetZ;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Color mixing
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, r / currentRadius);
      
      // Add some variation for realism
      if (!isCompanion && Math.random() < 0.05) {
         // Dust lanes or star clusters
         mixedColor.offsetHSL(0, 0, 0.2); 
      }

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    };

    // Main Galaxy Loop
    const mainGalaxyCount = hasCompanion ? Math.floor(count * 0.85) : count;
    
    for (let i = 0; i < mainGalaxyCount; i++) {
       generateStar(i, radius, branches, spin, 0, 0, false);
    }

    // Companion Galaxy Loop
    if (hasCompanion) {
       for (let i = mainGalaxyCount; i < count; i++) {
         // Companion is smaller and offset
         generateStar(i, radius * 0.35, 2, spin * 1.5, radius * 1.3, radius * 0.3, true);
       }
    }

    // Calculate Solar System Position (approximate location on an arm)
    let solarPos = new THREE.Vector3(0, 0, 0);
    if (showSolarSystem) {
       // Place it ~2/3rds out on one of the arms
       const solarR = radius * 0.6; 
       // Choose the first branch angle (0)
       const solarAngle = 0 * Math.PI * 2 + (solarR * spin);
       solarPos.set(
          Math.cos(solarAngle) * solarR,
          0,
          Math.sin(solarAngle) * solarR
       );
    }

    return { positions, colors, solarSystemPosition: solarPos };
  }, [
    params.count, 
    params.radius, 
    params.branches, 
    params.spin, 
    params.randomness, 
    params.randomnessPower, 
    params.insideColor, 
    params.outsideColor,
    params.hasCompanion,
    params.showSolarSystem,
    params.coreSize
  ]);

  // Animation frame
  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * params.rotationSpeed * params.speed;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={params.size}
          sizeAttenuation={true}
          depthWrite={false}
          vertexColors={true}
          blending={THREE.AdditiveBlending}
          transparent={true}
          opacity={0.8}
        />
      </points>

      {/* Solar System Marker */}
      {params.showSolarSystem && (
        <group 
          position={solarSystemPosition} 
          // Inverse rotation to stay with the galaxy if needed, 
          // but since points rotate, we need this marker to rotate with it.
          // The easiest way is to put it inside the rotating object or animate it.
          // For now, let's just let it sit in the group. 
          // To make it rotate WITH the galaxy, we need to apply the same rotation ref or parent it.
        > 
           {/* 
             Actually, the pointsRef rotates the geometry. 
             If we want the marker to rotate WITH the galaxy, it should be a child of an object that rotates.
             However, pointsRef is on <points>. We can wrap both in a <group> ref that rotates.
           */}
           <MovingMarker 
             position={solarSystemPosition} 
             speed={params.rotationSpeed * params.speed}
             label="Solar System"
           />
        </group>
      )}
    </group>
  );
};

// Component to handle the rotation of the marker separately to match galaxy rotation
// Or we could refactor the parent structure. Let's just animate its position or container rotation.
const MovingMarker: React.FC<{position: THREE.Vector3, speed: number, label: string}> = ({ position, speed, label }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return (
    <group ref={groupRef}>
      <group position={position}>
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#ff3333" toneMapped={false} />
        </mesh>
        <mesh>
           <ringGeometry args={[0.1, 0.12, 32]} />
           <meshBasicMaterial color="#ff3333" side={THREE.DoubleSide} transparent opacity={0.5} toneMapped={false} />
        </mesh>
        <Html distanceFactor={15} zIndexRange={[100, 0]}>
          <div className="flex flex-col items-center pointer-events-none transform -translate-y-full -mt-2">
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 text-xs px-2 py-1 rounded whitespace-nowrap shadow-[0_0_10px_rgba(255,50,50,0.3)]">
              {label}
            </div>
            <div className="w-px h-4 bg-red-500/50"></div>
          </div>
        </Html>
      </group>
    </group>
  )
}

export default Galaxy;