/**
 * input: Three.js ShaderMaterial uniforms（由 AppSettings/NebulaInstance 等驱动）
 * output: 导出星云粒子系统 vertex/fragment shader 字符串
 * pos: 星云视觉效果权威实现（包含互通模式颜色补偿 uOverlayMode 与各类特效）
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

// 星云粒子系统的Shader代码 - 供NebulaScene和PlanetScene共享

export const nebulaVertexShader = `
precision highp float;

uniform float uTime;
uniform float uSize;
uniform vec3 uHandPos;
uniform float uHandActive;
uniform float uInteractionRadius;
uniform float uInteractionStrength;
uniform float uReturnSpeed;
uniform float uExplosion;
uniform float uBlackHole;
uniform float uTurbulence;
uniform float uTurbulenceSpeed;
uniform float uTurbulenceScale;

// 爆炸效果参数
uniform float uExplosionExpansion;
uniform float uExplosionTurbulence;
uniform float uExplosionRotation;
uniform float uExplosionSizeBoost;

// 黑洞效果参数
uniform float uBlackHoleCompression;
uniform float uBlackHoleSpinSpeed;
uniform float uBlackHoleTargetRadius;
uniform float uBlackHolePull;

uniform float uBreathing;
uniform float uBreathingSpeed;
uniform float uRipple;
uniform float uRippleSpeed;
uniform float uAccretion;
uniform float uAccretionSpeed;
uniform vec3 uAccretionRadii;
uniform vec3 uAccretionDirs;
uniform vec3 uAccretionSpeeds;
uniform float uAccretionLayerCount;

uniform float uWaveEnabled;
uniform float uWaveIntensity;
uniform float uWaveSpeed;
uniform float uWaveSteepness;
uniform float uWaveLayers;
uniform float uWaveDirection;
uniform float uWaveDepthFade;
uniform float uWaveFoam;

uniform float uGeometryMapping;
uniform float uMappingStrength;
uniform float uMappingRadius;
uniform vec2 uImageSize;
uniform float uMappingTileX;
uniform float uMappingTileY;

attribute float aSize;
attribute vec3 aColor;
attribute float aParticleId;
attribute vec2 aTileIndex;

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter;
varying float vParticleId;
varying vec2 vVelocity;
varying float vWaveFoam;
varying float vWaveHeight;
varying vec3 vWorldPos;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { 
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

mat3 rotateZ(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

void main() {
  vColor = aColor;
  vParticleId = aParticleId;
  vec3 pos = position;
  float extraSize = 1.0;
  vec2 velocityXY = vec2(0.0);
  vWaveFoam = 0.0;
  vWaveHeight = 0.0;
  
  float distFromCenter = length(pos.xy);
  vDistFromCenter = distFromCenter;
  
  pos.z *= 1.5;

  if (uBlackHole < 0.1 && uExplosion < 0.1) {
    float drift = snoise(vec3(pos.xy * 0.005, uTime * 0.1));
    pos.z += drift * 20.0;
    
    if (uTurbulence > 0.001) {
      float noiseScale = 0.01 * uTurbulenceScale;
      float timeScale = uTime * uTurbulenceSpeed;
      vec3 noisePos = pos * noiseScale + vec3(timeScale);
      vec3 turbOffset = vec3(
        snoise(noisePos + vec3(0.0, 100.0, 0.0)),
        snoise(noisePos + vec3(100.0, 0.0, 0.0)),
        snoise(noisePos + vec3(0.0, 0.0, 100.0))
      );
      vec3 turbDisplacement = turbOffset * uTurbulence * 30.0;
      pos += turbDisplacement;
      velocityXY += turbDisplacement.xy * uTurbulenceSpeed;
    }
    
    if (uBreathing > 0.001) {
      float breathPhase = sin(uTime * uBreathingSpeed * 2.0);
      float breathScale = 1.0 + breathPhase * uBreathing;
      float breathVelocity = cos(uTime * uBreathingSpeed * 2.0) * uBreathingSpeed * 2.0 * uBreathing;
      velocityXY += pos.xy * breathVelocity * 0.5;
      pos.xy *= breathScale;
      extraSize *= 1.0 + breathPhase * uBreathing * 0.3;
    }
    
    if (uRipple > 0.001) {
      float ripplePhase = sin(distFromCenter * 0.02 - uTime * uRippleSpeed * 3.0);
      pos.z += ripplePhase * uRipple;
    }
    
    if (uAccretion > 0.001) {
      float layerDir = 1.0;
      float layerSpeed = 1.0;
      
      if (uAccretionLayerCount >= 1.0) {
        if (distFromCenter < uAccretionRadii.x) {
          layerDir = uAccretionDirs.x;
          layerSpeed = uAccretionSpeeds.x;
        } else if (uAccretionLayerCount >= 2.0 && distFromCenter < uAccretionRadii.y) {
          layerDir = uAccretionDirs.y;
          layerSpeed = uAccretionSpeeds.y;
        } else if (uAccretionLayerCount >= 3.0) {
          layerDir = uAccretionDirs.z;
          layerSpeed = uAccretionSpeeds.z;
        } else {
          layerDir = uAccretionLayerCount >= 2.0 ? uAccretionDirs.y : uAccretionDirs.x;
          layerSpeed = uAccretionLayerCount >= 2.0 ? uAccretionSpeeds.y : uAccretionSpeeds.x;
        }
      }
      
      float baseRotSpeed = (300.0 / (distFromCenter + 50.0)) * uAccretionSpeed;
      float angle = baseRotSpeed * layerSpeed * uTime * uAccretion * layerDir;
      float c = cos(angle);
      float s = sin(angle);
      vec2 rotated = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      float rotSpeed = baseRotSpeed * layerSpeed * uAccretion * layerDir;
      velocityXY += vec2(-pos.y, pos.x) * rotSpeed * 0.1;
      pos.xy = rotated;
    }
  }

  if (uExplosion > 0.001) {
    float noiseVal = snoise(pos * 0.015 + uTime * 0.1);
    float maxExpansion = uExplosionExpansion * uExplosion;
    float speedVar = smoothstep(-0.5, 1.0, noiseVal);
    vec3 dir = normalize(pos);
    pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
    vec3 turb = vec3(
      snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
      snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
      snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
    );
    pos += turb * uExplosionTurbulence * uExplosion;
    pos = rotateZ(uExplosion * uExplosionRotation) * pos;
    extraSize += uExplosion * uExplosionSizeBoost;
  }
  
  if (uBlackHole > 0.001) {
    pos.z *= mix(1.0, uBlackHoleCompression, uBlackHole);
    float r = length(pos.xy);
    float spin = (uBlackHoleSpinSpeed / (r + 10.0)) * uTime * 1.0 * uBlackHole;
    pos = rotateZ(spin) * pos;
    float targetR = uBlackHoleTargetRadius + r * 0.2;
    float pull = uBlackHole * uBlackHolePull;
    if (r > 1.0) {
      float newR = mix(r, targetR, pull);
      pos.xy = normalize(pos.xy) * newR;
    }
    float jetSignal = snoise(vec3(position.xy * 0.8, 42.0));
    if (jetSignal > 0.7 && r < 120.0) {
      float jetIntensity = uBlackHole;
      float jetLen = 500.0 * jetIntensity;
      float side = sign(position.z);
      if (side == 0.0) side = 1.0;
      pos.xy *= 0.05;
      pos.z = side * (50.0 + jetLen * abs(jetSignal));
      float jetTwist = pos.z * 0.05 - uTime * 5.0;
      pos.x += sin(jetTwist) * 10.0;
      pos.y += cos(jetTwist) * 10.0;
      extraSize += 5.0 * jetIntensity;
      vColor = mix(vColor, vec3(0.6, 0.8, 1.0), jetIntensity);
    } else {
      float currentR = length(pos.xy);
      if (currentR < 60.0) {
        float heat = (1.0 - currentR / 60.0) * uBlackHole;
        vColor = mix(vColor, vec3(1.0, 0.9, 0.6), heat);
        extraSize += 3.0 * heat;
      }
    }
  }

  if (uHandActive > 0.5 && uBlackHole < 0.1 && uExplosion < 0.1) {
    vec3 toHand = pos - uHandPos;
    float dist = length(toHand);
    if (dist < uInteractionRadius) {
      vec3 dir = normalize(toHand);
      float force = (1.0 - dist / uInteractionRadius);
      force = pow(force, 2.0) * uInteractionStrength;
      pos += dir * force;
    }
  }

  if (uMappingStrength > 0.001 && uImageSize.x > 1.0 && uImageSize.y > 1.0) {
    vec3 originalPos = pos;
    float u = (position.x + uImageSize.x * 0.5) / uImageSize.x;
    float v = (position.y + uImageSize.y * 0.5) / uImageSize.y;
    u = clamp(u, 0.0, 1.0);
    v = clamp(v, 0.0, 1.0);
    
    vec3 mappedPos = pos;
    float PI = 3.14159265;
    float tileIndexX = aTileIndex.x;
    float tileIndexY = aTileIndex.y;
    
    if (uGeometryMapping > 0.5 && uGeometryMapping < 1.5) {
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float phi = tileIndexX * sectorAngle + u * sectorAngle;
      float latitudeRange = PI / uMappingTileY;
      float theta = -PI * 0.5 + tileIndexY * latitudeRange + v * latitudeRange;
      float R = uMappingRadius;
      mappedPos.x = R * cos(theta) * cos(phi);
      mappedPos.y = R * sin(theta);
      mappedPos.z = R * cos(theta) * sin(phi);
      mappedPos += normalize(mappedPos) * (pos.z - position.z) * 0.1;
    } else if (uGeometryMapping > 1.5) {
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float alpha = tileIndexX * sectorAngle + u * sectorAngle;
      float R = uMappingRadius;
      mappedPos.x = R * cos(alpha);
      mappedPos.z = R * sin(alpha);
      float totalHeight = uImageSize.y;
      float heightPerTile = totalHeight / uMappingTileY;
      mappedPos.y = -totalHeight * 0.5 + tileIndexY * heightPerTile + v * heightPerTile;
      vec2 radialDir = normalize(vec2(mappedPos.x, mappedPos.z));
      mappedPos.x += radialDir.x * (pos.z - position.z) * 0.1;
      mappedPos.z += radialDir.y * (pos.z - position.z) * 0.1;
    }
    
    pos = mix(originalPos, mappedPos, uMappingStrength);
  }

  vDepth = pos.z;
  vVelocity = velocityXY;
  vWorldPos = pos;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float safeZ = min(mvPosition.z, -10.0);
  gl_PointSize = uSize * aSize * extraSize * (300.0 / -safeZ);
  gl_PointSize = clamp(gl_PointSize, 0.1, 100.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const nebulaFragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uShape;
uniform float uSaturation;
uniform sampler2D uShapeTexture;
uniform float uGlowMode;
uniform float uGlowIntensity;
uniform float uTime;
uniform float uFlickerEnabled;
uniform float uFlickerIntensity;
uniform float uFlickerSpeed;
uniform float uBrightness;
uniform float uOpacity;
uniform float uOverlayMode; // 互通模式颜色补偿

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter;
varying float vParticleId;
varying vec2 vVelocity;
varying float vWaveFoam;
varying float vWaveHeight;
varying vec3 vWorldPos;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float computeGlow(float dist, float glowMode, float intensity) {
    if (glowMode < 0.5) {
        return 1.0;
    } else if (glowMode < 1.5) {
        float fadeStart = max(0.0, 0.5 - intensity * 0.025);
        return 1.0 - smoothstep(fadeStart, 0.5, dist);
    } else if (glowMode < 2.5) {
        float strength = max(0.0, 1.0 - dist * 2.0);
        float exponent = max(0.5, 10.0 / intensity);
        return pow(strength, exponent);
    } else {
        float coreExponent = max(0.5, 8.0 / intensity);
        float core = pow(max(0.0, 1.0 - dist * 2.5), coreExponent);
        float ringWidth = 0.02 + 0.04 * (intensity / 20.0);
        float ring = smoothstep(0.3, 0.3 + ringWidth, dist) * (1.0 - smoothstep(0.4, 0.5, dist));
        return core + ring * 0.5;
    }
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  float alpha = 1.0;
  
  float scaleFactor = 1.8;
  vec2 scaledCoord = coord * scaleFactor;
  float scaledDist = length(scaledCoord);
  
  // 程序化形状渲染
  if (uShape < 0.5) {
    if (dist > 0.5) discard;
    alpha = computeGlow(dist, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 1.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float r = 0.5 * (0.55 + 0.45 * cos(5.0 * angle));
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 2.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float f = abs(cos(angle * 3.0));
    f += 0.5 * abs(cos(angle * 12.0));
    float r = 0.5 * clamp(f, 0.3, 0.8);
    if (scaledDist > r && scaledDist > 0.2) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 3.5) {
    vec2 p = scaledCoord * 2.5;
    p.y = -p.y + 0.2;
    float heart = pow(p.x * p.x + p.y * p.y - 0.35, 3.0) - p.x * p.x * p.y * p.y * p.y;
    if (heart > 0.0) discard;
    alpha = computeGlow(scaledDist * 1.2, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 4.5) {
    float d1 = length(scaledCoord);
    float d2 = length(scaledCoord - vec2(0.22, 0.0));
    if (d1 > 0.45 || d2 < 0.38) discard;
    float edgeDist = (0.45 - d1) / 0.45;
    alpha = computeGlow(1.0 - edgeDist, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 5.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.6 + 0.4 * abs(cos(2.0 * angle)));
    float curve = 0.08 * cos(4.0 * angle);
    float r = petal + curve;
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 6.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.8 + 0.5 * cos(5.0 * angle) + 0.2 * cos(10.0 * angle));
    float notch = 0.05 * (1.0 + cos(5.0 * angle + 3.14159));
    float r = petal - notch;
    if (scaledDist > r) discard;
    alpha = computeGlow(scaledDist / r, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 7.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float rays = 0.35 + 0.15 * cos(12.0 * angle);
    float core = 0.25;
    if (scaledDist > rays) discard;
    if (scaledDist < core) {
      alpha = computeGlow(scaledDist / core, uGlowMode, uGlowIntensity);
    } else {
      float rayFade = 1.0 - (scaledDist - core) / (rays - core);
      alpha = rayFade * 0.8;
    }
  }
  else if (uShape < 8.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.35 * (1.0 + 0.5 * cos(5.0 * angle));
    if (scaledDist > petal && scaledDist > 0.15) discard;
    alpha = computeGlow(scaledDist / petal, uGlowMode, uGlowIntensity);
  }
  else if (uShape < 9.5) {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.6 + 0.5 * abs(cos(3.0 * angle)));
    if (scaledDist > petal) discard;
    alpha = computeGlow(scaledDist / petal, uGlowMode, uGlowIntensity);
  }
  else {
    float angle = atan(scaledCoord.y, scaledCoord.x);
    float petal = 0.4 * (0.7 + 0.4 * cos(8.0 * angle));
    if (scaledDist > petal) discard;
    alpha = computeGlow(scaledDist / petal, uGlowMode, uGlowIntensity);
  }
  
  vec3 color = vColor;
  
  if (uSaturation != 1.0) {
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, uSaturation);
  }
  
  color *= uBrightness;
  
  if (uFlickerEnabled > 0.5) {
    float flickerPhase = sin(uTime * uFlickerSpeed + vParticleId * 6.283) * 0.5 + 0.5;
    float flickerAmount = mix(1.0, flickerPhase, uFlickerIntensity);
    alpha *= flickerAmount;
  }
  
  float finalAlpha = min(alpha * uOpacity, 1.0);
  
  // 互通模式颜色补偿：提升颜色饱和度和亮度以抵消透明混合导致的颜色变淡
  float overlay = clamp(uOverlayMode, 0.0, 1.0);
  if (overlay > 0.001) {
    color *= mix(1.0, 2.5, overlay); // 亮度补偿（按强度渐进）
    // 增加饱和度补偿（按强度渐进）
    float grayComp = dot(color, vec3(0.299, 0.587, 0.114));
    float satBoost = mix(1.0, 1.2, overlay);
    color = mix(vec3(grayComp), color, satBoost);
  }
  
  gl_FragColor = vec4(color, finalAlpha);
}
`;
