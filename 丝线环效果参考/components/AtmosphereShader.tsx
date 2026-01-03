export const atmosphereVertexShader = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const atmosphereFragmentShader = `
varying vec3 vNormal;
uniform vec3 uColor;
uniform float uIntensity;

void main() {
  float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
  gl_FragColor = vec4(uColor, 1.0) * intensity * uIntensity;
}
`;
