export const silkVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
uniform float uTime;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  
  // Wobbly mesh displacement for "living" feel
  // We use world position for noise to avoid UV seams affecting the displacement shape
  float wobble = sin(position.x * 2.0 + uTime) * cos(position.z * 2.0 + uTime) * 0.05;
  vec3 pos = position + normal * wobble;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const silkFragmentShader = `
uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  // Use vUv.x (length along tube) for flow.
  // Since it's a closed loop, TubeGeometry usually wraps UVs 0..1.
  // We multiply by a large number to repeat texture, creating flow.
  float xRepeat = 20.0; 
  float flowOffset = uTime * uSpeed * 2.0;
  
  // Coordinates for noise
  float x = vUv.x * xRepeat + flowOffset;
  float y = vUv.y; // Circumference

  // 1. Base Strands (Thin lines)
  float strands = sin(y * 30.0 + x * 0.5) * 0.5 + 0.5;
  strands = pow(strands, 4.0); // Very thin

  // 2. Flowing Energy Packets (Variation along length)
  // We use sine waves that wrap nicely or just fast noise
  float energy = sin(x) * 0.5 + 0.5;
  energy *= sin(x * 0.3 + 2.0) * 0.5 + 0.5; // Composite wave to make it irregular
  
  // 3. Sparkles
  float sparkle = step(0.95, fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233))) * 43758.5453));

  // Combine
  float brightness = strands * (energy * 1.5 + sparkle);
  
  // Edge Fading (Fresnel)
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.0);
  
  // Soft edges for the "silk" feel
  brightness *= fresnel;

  vec3 finalColor = uColor * (1.0 + brightness * 3.0);
  float alpha = brightness * uOpacity;
  
  // Make the dark parts purely transparent
  alpha = smoothstep(0.05, 0.8, alpha);

  gl_FragColor = vec4(finalColor, alpha);
}
`;