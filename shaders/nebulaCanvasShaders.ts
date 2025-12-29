/**
 * input: Three.js ShaderMaterial uniforms（由 AppSettings/NebulaInstance 等驱动）
 * output: 导出 Canvas 版星云 vertex/fragment shader 字符串
 * pos: Canvas 渲染链路的星云视觉实现，需与主 shader 保持一致（含 uOverlayMode 等）
 * update: 一旦我被更新，务必同步更新本文件头部注释与所属目录的架构 md。
 */

// NebulaScene 使用的 Canvas 纹理 Shader
// 与 NebulaScene.tsx 中的 shader 完全一致

export const nebulaCanvasVertexShader = `
precision highp float;

uniform float uTime;
uniform float uSize;
uniform vec3 uHandPos;
uniform float uHandActive; // 0.0 or 1.0
uniform float uInteractionRadius;
uniform float uInteractionStrength;
uniform float uReturnSpeed;
uniform float uExplosion; // 0.0 to 1.0 (Explode Out)
uniform float uBlackHole; // 0.0 to 1.0 (Implode In)
uniform float uTurbulence; // 粒子扰动强度

// 爆炸效果参数
uniform float uExplosionExpansion;    // 膨胀距离
uniform float uExplosionTurbulence;   // 湍流强度
uniform float uExplosionRotation;     // 旋转角度
uniform float uExplosionSizeBoost;    // 粒子放大

// 黑洞效果参数
uniform float uBlackHoleCompression;  // Z轴压缩
uniform float uBlackHoleSpinSpeed;    // 旋转速度
uniform float uBlackHoleTargetRadius; // 收缩半径
uniform float uBlackHolePull;         // 吸引强度
uniform float uTurbulenceSpeed; // 扰动速度
uniform float uTurbulenceScale; // 扰动尺度

// 高级动态效果
uniform float uBreathing;        // 呼吸效果强度
uniform float uBreathingSpeed;   // 呼吸速度
uniform float uRipple;           // 涟漪效果强度
uniform float uRippleSpeed;      // 涟漪速度
uniform float uAccretion;        // 吸积盘旋转强度
uniform float uAccretionSpeed;   // 吸积盘基础旋转速度
// 多层吸积盘配置 (最多3层)
uniform vec3 uAccretionRadii;       // 各层外边界半径
uniform vec3 uAccretionDirs;        // 各层旋转方向 (1或-1)
uniform vec3 uAccretionSpeeds;      // 各层速度倍数
uniform float uAccretionLayerCount; // 启用的层数

// 真实海浪效果（Gerstner波）
uniform float uWaveEnabled;         // 启用海浪
uniform float uWaveIntensity;       // 海浪振幅
uniform float uWaveSpeed;           // 海浪速度
uniform float uWaveSteepness;       // 波浪陡度 0-1
uniform float uWaveLayers;          // 波浪层数 1-4
uniform float uWaveDirection;       // 主波方向角度（弧度）
uniform float uWaveDepthFade;       // 深度衰减
uniform float uWaveFoam;            // 波峰泡沫

// 几何映射
uniform float uGeometryMapping;     // 0=none, 1=sphere, 2=cylinder
uniform float uMappingStrength;     // 映射强度 0-1
uniform float uMappingRadius;       // 球体/圆柱半径
uniform vec2 uImageSize;            // 原始图像尺寸（用于UV计算）
uniform float uMappingTileX;        // 水平拼接数 1-8
uniform float uMappingTileY;        // 垂直拼接数 1-4
uniform float uMappingEdgeFade;     // 边缘淡化强度 0-0.5

attribute float aSize;
attribute vec3 aColor;
attribute float aParticleId;  // 粒子ID用于碎片形状和闪烁
attribute vec2 aTileIndex;    // 拼接区域索引 (x, y)

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;     // 传递给片段着色器
varying vec2 vVelocity;        // 速度向量（用于拖尾，基于动态效果计算）
varying float vWaveFoam;       // 波峰泡沫强度
varying float vWaveHeight;     // 海浪高度（用于颜色渐变）
varying float vEdgeFade;       // 边缘淡化系数
varying vec3 vWorldPos;        // 世界坐标（用于闪电效果）

// Simplex noise for organic movement
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// Rotation matrix
mat3 rotateZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, -s, 0.0,
        s,  c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {
  vColor = aColor;
  vParticleId = aParticleId;  // 传递粒子ID
  vec3 pos = position;
  float extraSize = 1.0;
  
  // 初始化速度向量（用于拖尾效果）
  vec2 velocityXY = vec2(0.0);
  
  // 初始化波峰泡沫和海浪高度
  vWaveFoam = 0.0;
  vWaveHeight = 0.0;
  
  // 计算到中心的距离（用于多种效果）
  float distFromCenter = length(pos.xy);
  vDistFromCenter = distFromCenter;
  
  // 1. Base Depth Enhancement
  pos.z *= 1.5;

  // 2. Ambient Floating + 粒子微动（Curl Noise 扰动）
  if (uBlackHole < 0.1 && uExplosion < 0.1) {
      float drift = snoise(vec3(pos.xy * 0.005, uTime * 0.1));
      pos.z += drift * 20.0;
      
      // 粒子微动效果 - 基于位置和时间的噪声扰动
      if (uTurbulence > 0.001) {
          float noiseScale = 0.01 * uTurbulenceScale;
          float timeScale = uTime * uTurbulenceSpeed;
          
          // 3D Curl noise for smooth, fluid-like motion
          vec3 noisePos = pos * noiseScale + vec3(timeScale);
          vec3 turbOffset = vec3(
              snoise(noisePos + vec3(0.0, 100.0, 0.0)),
              snoise(noisePos + vec3(100.0, 0.0, 0.0)),
              snoise(noisePos + vec3(0.0, 0.0, 100.0))
          );
          
          // 应用扰动，强度可调
          vec3 turbDisplacement = turbOffset * uTurbulence * 30.0;
          pos += turbDisplacement;
          
          // 累积速度（用于拖尾）
          velocityXY += turbDisplacement.xy * uTurbulenceSpeed;
      }
      
      // === 呼吸效果 ===
      if (uBreathing > 0.001) {
          float breathPhase = sin(uTime * uBreathingSpeed * 2.0);
          float breathScale = 1.0 + breathPhase * uBreathing;
          
          // 计算呼吸速度（缩放变化率）
          float breathVelocity = cos(uTime * uBreathingSpeed * 2.0) * uBreathingSpeed * 2.0 * uBreathing;
          velocityXY += pos.xy * breathVelocity * 0.5;
          
          pos.xy *= breathScale;
          extraSize *= 1.0 + breathPhase * uBreathing * 0.3;
      }
      
      // === 涟漪效果 ===
      if (uRipple > 0.001) {
          float ripplePhase = sin(distFromCenter * 0.02 - uTime * uRippleSpeed * 3.0);
          pos.z += ripplePhase * uRipple;
      }
      
      // === 海浪效果（Gerstner波） ===
      if (uWaveEnabled > 0.5) {
          float totalWaveZ = 0.0;
          float totalWaveHeight = 0.0;
          
          // 多层波浪叠加
          for (float layer = 0.0; layer < 4.0; layer++) {
              if (layer >= uWaveLayers) break;
              
              // 每层波浪有不同的频率和方向偏移
              float layerScale = 1.0 / (layer + 1.0);
              float layerFreq = 0.01 * (layer + 1.0);
              float dirOffset = layer * 0.5;  // 每层方向偏移
              
              // 应用主波方向
              float dirAngle = uWaveDirection + dirOffset;
              float dirX = cos(dirAngle);
              float dirY = sin(dirAngle);
              
              // 计算波浪相位
              float wavePhase = (pos.x * dirX + pos.y * dirY) * layerFreq - uTime * uWaveSpeed * (1.0 + layer * 0.3);
              
              // Gerstner波：使用陡度参数
              float steepness = uWaveSteepness * layerScale;
              float waveHeight = sin(wavePhase);
              float waveZ = waveHeight * uWaveIntensity * layerScale;
              
              // 陡度影响水平位移（Gerstner特性）
              if (steepness > 0.01) {
                  pos.x += cos(wavePhase) * steepness * uWaveIntensity * layerScale * dirX * 0.1;
                  pos.y += cos(wavePhase) * steepness * uWaveIntensity * layerScale * dirY * 0.1;
              }
              
              totalWaveZ += waveZ;
              totalWaveHeight += waveHeight * layerScale;
          }
          
          // 深度衰减：根据原始z位置衰减波浪效果
          float depthFactor = 1.0 - uWaveDepthFade * clamp((position.z + 100.0) / 200.0, 0.0, 1.0);
          pos.z += totalWaveZ * depthFactor;
          
          // 传递归一化高度
          vWaveHeight = totalWaveHeight / uWaveLayers;
          
          // 泡沫在波峰
          if (uWaveFoam > 0.5) {
              vWaveFoam = max(0.0, vWaveHeight);
          }
      }
      
      // === 吸积盘旋转效果（多层配置版） ===
      if (uAccretion > 0.001) {
          // 根据距离确定所在层，获取该层的方向和速度
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
                  // 超出所有层范围，使用最后一层
                  layerDir = uAccretionLayerCount >= 2.0 ? uAccretionDirs.y : uAccretionDirs.x;
                  layerSpeed = uAccretionLayerCount >= 2.0 ? uAccretionSpeeds.y : uAccretionSpeeds.x;
              }
          }
          
          // 近快远慢的基础旋转
          float baseRotSpeed = (300.0 / (distFromCenter + 50.0)) * uAccretionSpeed;
          float angle = baseRotSpeed * layerSpeed * uTime * uAccretion * layerDir;
          
          float c = cos(angle);
          float s = sin(angle);
          vec2 rotated = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          
          // 累积旋转速度（切线方向）
          float rotSpeed = baseRotSpeed * layerSpeed * uAccretion * layerDir;
          velocityXY += vec2(-pos.y, pos.x) * rotSpeed * 0.1;
          
          pos.xy = rotated;
      }
  }

  // --- EXPLOSION: VOLUMETRIC NEBULA CLOUD ---
  if (uExplosion > 0.001) {
      // Create a dense cloud structure to fill the screen
      
      // Noise for clustering
      float noiseVal = snoise(pos * 0.015 + uTime * 0.1); 
      
      // Radial Expansion - 使用可控参数
      float maxExpansion = uExplosionExpansion * uExplosion; 
      
      // Non-linear speed: distinct layers
      float speedVar = smoothstep(-0.5, 1.0, noiseVal); 
      vec3 dir = normalize(pos);
      
      // Expansion logic
      pos += dir * maxExpansion * (0.4 + 0.6 * speedVar);
      
      // Turbulence - 使用可控参数
      vec3 turb = vec3(
          snoise(pos * 0.01 + vec3(0.0, uTime * 0.3, 0.0)),
          snoise(pos * 0.01 + vec3(100.0, uTime * 0.3, 100.0)),
          snoise(pos * 0.01 + vec3(200.0, 200.0, uTime * 0.3))
      );
      
      pos += turb * uExplosionTurbulence * uExplosion;
      
      // Galaxy Rotation - 使用可控参数
      pos = rotateZ(uExplosion * uExplosionRotation) * pos;
      
      // Size Boost - 使用可控参数
      extraSize += uExplosion * uExplosionSizeBoost; 
  }
  
  // --- BLACK HOLE: QUASAR / JETS ---
  if (uBlackHole > 0.001) {
      // 1. Flatten to Accretion Disk - 使用可控参数
      pos.z *= mix(1.0, uBlackHoleCompression, uBlackHole);
      
      // 2. Vortex Spin - 使用可控参数
      float r = length(pos.xy);
      float spin = (uBlackHoleSpinSpeed / (r + 10.0)) * uTime * 1.0 * uBlackHole;
      pos = rotateZ(spin) * pos;
      
      // 3. Gravitational Compression - 使用可控参数
      float targetR = uBlackHoleTargetRadius + r * 0.2; 
      float pull = uBlackHole * uBlackHolePull; 
      
      if (r > 1.0) {
          float newR = mix(r, targetR, pull);
          pos.xy = normalize(pos.xy) * newR;
      }
      
      // 4. RELATIVISTIC JETS (Cool Factor)
      // Pick random particles to form jets
      // Use original position for stable noise
      float jetSignal = snoise(vec3(position.xy * 0.8, 42.0)); 
      
      if (jetSignal > 0.7 && r < 120.0) {
          float jetIntensity = uBlackHole;
          
          // Shoot up/down along Z
          float jetLen = 500.0 * jetIntensity;
          float side = sign(position.z);
          if (side == 0.0) side = 1.0;
          
          // Squeeze tight in XY
          pos.xy *= 0.05; 
          
          // Stretch Z
          pos.z = side * (50.0 + jetLen * abs(jetSignal)); 
          
          // Spiral the jet
          float jetTwist = pos.z * 0.05 - uTime * 5.0;
          pos.x += sin(jetTwist) * 10.0;
          pos.y += cos(jetTwist) * 10.0;
          
          // High Energy Look
          extraSize += 5.0 * jetIntensity;
          vColor = mix(vColor, vec3(0.6, 0.8, 1.0), jetIntensity); // Blue Jets
      } else {
          // Disk Glow
          float currentR = length(pos.xy);
          if (currentR < 60.0) {
              float heat = (1.0 - currentR / 60.0) * uBlackHole;
              vColor = mix(vColor, vec3(1.0, 0.9, 0.6), heat); // Gold Core
              extraSize += 3.0 * heat;
          }
      }
  }

  // --- Hand Interaction (Repulse) ---
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

  // === 几何映射（球形/圆柱） ===
  if (uMappingStrength > 0.001 && uImageSize.x > 1.0 && uImageSize.y > 1.0) {
    vec3 originalPos = pos;
    
    // 计算UV坐标（基于原始position）
    // 粒子位置范围是 [-width/2, +width/2]，转换为 [0, 1]
    float u = (position.x + uImageSize.x * 0.5) / uImageSize.x;
    float v = (position.y + uImageSize.y * 0.5) / uImageSize.y;
    u = clamp(u, 0.0, 1.0);
    v = clamp(v, 0.0, 1.0);
    
    // 拼接逻辑：使用CPU复制的粒子，每组粒子映射到不同的拼接区域
    // aTileIndex.x = 水平拼接索引 (0 到 tileX-1)
    // aTileIndex.y = 垂直拼接索引 (0 到 tileY-1)
    vec3 mappedPos = pos;
    float PI = 3.14159265;
    
    // 获取当前粒子的拼接区域索引
    float tileIndexX = aTileIndex.x;
    float tileIndexY = aTileIndex.y;
    
    if (uGeometryMapping > 0.5 && uGeometryMapping < 1.5) {
      // 球形映射
      // 每个副本占据 360°/N 的经度范围和 180°/M 的纬度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float phi = tileIndexX * sectorAngle + u * sectorAngle;  // 经度
      
      float latitudeRange = PI / uMappingTileY;
      float theta = -PI * 0.5 + tileIndexY * latitudeRange + v * latitudeRange;  // 纬度
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(theta) * cos(phi);
      mappedPos.y = R * sin(theta);
      mappedPos.z = R * cos(theta) * sin(phi);
      
      // 保留动态效果偏移
      mappedPos += normalize(mappedPos) * (pos.z - position.z) * 0.1;
      
    } else if (uGeometryMapping > 1.5) {
      // 圆柱映射
      // 每个副本占据 360°/N 的角度范围
      float sectorAngle = 2.0 * PI / uMappingTileX;
      float alpha = tileIndexX * sectorAngle + u * sectorAngle;
      
      float R = uMappingRadius;
      mappedPos.x = R * cos(alpha);
      mappedPos.z = R * sin(alpha);
      
      // 垂直方向：每个副本占据圆柱高度的 1/M
      float totalHeight = uImageSize.y;
      float heightPerTile = totalHeight / uMappingTileY;
      mappedPos.y = -totalHeight * 0.5 + tileIndexY * heightPerTile + v * heightPerTile;
      
      // 保留动态效果偏移（径向方向）
      vec2 radialDir = normalize(vec2(mappedPos.x, mappedPos.z));
      mappedPos.x += radialDir.x * (pos.z - position.z) * 0.1;
      mappedPos.z += radialDir.y * (pos.z - position.z) * 0.1;
    }
    
    // 根据映射强度混合
    pos = mix(originalPos, mappedPos, uMappingStrength);
    
    // 计算边缘淡化系数（只在有拼接时生效）
    if (uMappingTileX > 1.0 || uMappingTileY > 1.0) {
      float fadeRange = uMappingEdgeFade;
      float fadeU = smoothstep(0.0, fadeRange, u) * smoothstep(1.0, 1.0 - fadeRange, u);
      float fadeV = smoothstep(0.0, fadeRange, v) * smoothstep(1.0, 1.0 - fadeRange, v);
      vEdgeFade = fadeU * fadeV;
    } else {
      vEdgeFade = 1.0;
    }
  } else {
    vEdgeFade = 1.0;
  }

  vDepth = pos.z;
  vVelocity = velocityXY;  // 传递速度向量到片段着色器
  vWorldPos = pos;         // 传递世界坐标（用于闪电计算）
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  
  // Perspective Size Attenuation - 安全计算
  // 确保 mvPosition.z 为负值且有足够距离，防止 NaN/Inf
  float safeZ = min(mvPosition.z, -10.0);  // 至少距离相机10单位
  gl_PointSize = uSize * aSize * extraSize * (300.0 / -safeZ);
  
  // 限制点大小范围，防止极端值
  gl_PointSize = clamp(gl_PointSize, 0.1, 100.0);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const nebulaCanvasFragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uShape; // 0=circle, 1=star, 2=snowflake, 3=heart, 4=crescent, 5=crossglow, 6=sakura, 7=sun, 8=sun2, 9=plum, 10=lily, 11=lotus, 12=prism
uniform float uSaturation;
uniform sampler2D uShapeTexture; // Canvas绘制的形状纹理图集
// 闪电效果
uniform float uWanderingLightning;      // 游走闪电强度
uniform float uWanderingLightningSpeed; // 游走速度
uniform float uWanderingLightningDensity; // 闪电密度
uniform float uWanderingLightningWidth; // 闪电宽度（未使用，保留兼容）
uniform float uLightningBreakdown;      // 闪电击穿强度
uniform float uLightningBreakdownFreq;  // 击穿频率
uniform float uLightningBranches;       // 分支数量
uniform vec2 uImageSize;                // 图像尺寸（用于闪电比例计算）
uniform float uGlowMode;     // 0=none, 1=soft, 2=sharp, 3=aura
uniform float uGlowIntensity; // 光晕强度
uniform float uTime;         // 用于闪烁和碎片形状
uniform float uFlickerEnabled;
uniform float uFlickerIntensity;
uniform float uFlickerSpeed;
uniform float uBrightness;  // 亮度调整
uniform float uOpacity;     // 透明度调整
uniform float uOverlayMode; // 互通模式颜色补偿强度 0-1

varying vec3 vColor;
varying float vDepth;
varying float vDistFromCenter; // 用于涟漪和吸积盘效果
varying float vParticleId;   // 粒子ID（用于碎片形状和闪烁）
varying float vEdgeFade;     // 边缘淡化系数
varying vec2 vVelocity;      // 粒子速度向量（用于拖尾）
varying float vWaveFoam;     // 波峰泡沫强度
varying float vWaveHeight;   // 海浪高度（用于颜色渐变）
varying vec3 vWorldPos;      // 世界坐标（用于闪电效果）

// 简化的噪声函数（用于闪电锯齿）
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// 计算光晕效果
// dist: 归一化距离 (0~1, 0=中心, 1=边缘)
// glowMode: 0=none, 1=soft, 2=sharp, 3=aura
// intensity: 光晕强度参数 (1-20)
float computeGlow(float dist, float glowMode, float intensity) {
    if (glowMode < 0.5) {
        // None - 无光晕，完全硬边缘
        // 完全不使用 intensity 参数，返回固定值
        return 1.0;
    } else if (glowMode < 1.5) {
        // Soft - 柔和光晕（smoothstep）
        // intensity 越大，渐变范围越大，效果越柔和
        float fadeStart = max(0.0, 0.5 - intensity * 0.025);  // intensity 1->0.475, 20->0.0
        return 1.0 - smoothstep(fadeStart, 0.5, dist);
    } else if (glowMode < 2.5) {
        // Sharp - 锐利光晕（指数衰减，像恒星）
        // intensity 越大，光晕越亮/扩散越大
        float strength = max(0.0, 1.0 - dist * 2.0);
        float exponent = max(0.5, 10.0 / intensity);  // intensity大 -> exponent小 -> 更亮
        return pow(strength, exponent);
    } else {
        // Aura - 光环效果
        float coreExponent = max(0.5, 8.0 / intensity);
        float core = pow(max(0.0, 1.0 - dist * 2.5), coreExponent);
        float ringWidth = 0.02 + 0.04 * (intensity / 20.0);
        float ring = smoothstep(0.3, 0.3 + ringWidth, dist) * (1.0 - smoothstep(0.4, 0.5, dist));
        return core + ring * 0.5;
    }
}

// 简单哈希函数已在上方定义（用于闪电锯齿和碎片形状）

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  float alpha = 1.0;
  
  int shapeIdx = int(uShape + 0.5);
  shapeIdx = clamp(shapeIdx, 0, 12);
  
  // 圆形粒子使用程序化渲染（硬边缘）
  if (shapeIdx == 0) {
    // Circle - 程序化硬边缘
    if (dist > 0.5) discard;
    alpha = computeGlow(dist, uGlowMode, uGlowIntensity);
  } else {
    // 其他形状使用Canvas纹理图集采样
    // 纹理图集布局: 4列 x 4行 = 16种形状（当前13种）
    // 形状索引: 0=Circle, 1=Star, 2=Snowflake, 3=Heart, 4=Crescent, 5=CrossGlow, 6=Sakura, 7=Sun, 8=Sun2, 9=Plum, 10=Lily, 11=Lotus, 12=Prism
    float col = mod(float(shapeIdx), 4.0);
    float row = floor(float(shapeIdx) / 4.0);
    
    // 计算在图集中的UV坐标
    // flipY=false 时，UV(0,0) 对应 Canvas 左上角，Y轴向下
    vec2 atlasUV = vec2(
      (col + gl_PointCoord.x) / 4.0,
      (row + gl_PointCoord.y) / 4.0
    );
    
    // 从纹理采样
    vec4 texColor = texture2D(uShapeTexture, atlasUV);
    alpha = texColor.a;
    
    // 如果alpha太低则丢弃（硬边缘）
    if (alpha < 0.5) discard;
    
    // 应用光晕效果（dist 需要归一化到 0~1 范围）
    alpha *= computeGlow(dist * 2.0, uGlowMode, uGlowIntensity);
  }

  // 荧光闪烁效果
  if (uFlickerEnabled > 0.5) {
    float flickerPhase = vParticleId * 6.28318 + uTime * uFlickerSpeed;
    float flicker = 0.5 + 0.5 * sin(flickerPhase);
    flicker = mix(1.0, flicker, uFlickerIntensity);
    alpha *= flicker;
  }
  
  // ============ 闪电效果（基于世界坐标） ============
  vec3 lightningColor = vColor;
  
  // 计算图形半径 R（用于相对尺寸）
  float R = max(uImageSize.x, uImageSize.y) * 0.5;
  if (R < 1.0) R = 400.0;  // 防止除零
  
  // 归一化世界坐标到 [-1, 1]
  vec2 normPos = vWorldPos.xy / R;
  
  // === 游走闪电团（Wandering Plasma Clusters） ===
  if (uWanderingLightning > 0.01) {
    float t = uTime * uWanderingLightningSpeed;
    float clusterHit = 0.0;
    
    // 3-5 个能量团
    for (float i = 0.0; i < 5.0; i++) {
      if (i >= uWanderingLightningDensity) break;
      
      // 每个能量团的随机种子
      float seed = i * 17.31 + 0.5;
      
      // 能量团中心位置（布朗运动游走）
      float cx = sin(t * 0.7 + seed * 3.0) * 0.6 + sin(t * 1.3 + seed) * 0.3;
      float cy = cos(t * 0.5 + seed * 2.0) * 0.6 + cos(t * 1.1 + seed * 1.5) * 0.3;
      vec2 clusterCenter = vec2(cx, cy);
      
      // 到能量团中心的距离
      float distToCluster = length(normPos - clusterCenter);
      
      // 能量团半径（0.15R ~ 0.25R）
      float clusterRadius = 0.15 + 0.1 * sin(seed * 5.0);
      
      // 团内效果
      if (distToCluster < clusterRadius * 1.5) {
        // 核心亮度
        float coreBrightness = smoothstep(clusterRadius, 0.0, distToCluster);
        
        // 内部电弧效果
        float angle = atan(normPos.y - cy, normPos.x - cx);
        float arcNoise = sin(angle * 8.0 + t * 5.0 + seed * 10.0) * 0.5 + 0.5;
        arcNoise *= sin(angle * 12.0 - t * 3.0 + seed * 7.0) * 0.5 + 0.5;
        
        // 闪烁
        float flicker = 0.7 + 0.3 * sin(t * 15.0 + seed * 20.0);
        
        float brightness = coreBrightness * (0.5 + arcNoise * 0.5) * flicker;
        clusterHit = max(clusterHit, brightness);
      }
    }
    
    // 团簇间电弧（当两个团靠近时）
    for (float i = 0.0; i < 4.0; i++) {
      float j = i + 1.0;
      if (j >= uWanderingLightningDensity) break;
      
      float seed1 = i * 17.31 + 0.5;
      float seed2 = j * 17.31 + 0.5;
      
      vec2 c1 = vec2(
        sin(t * 0.7 + seed1 * 3.0) * 0.6 + sin(t * 1.3 + seed1) * 0.3,
        cos(t * 0.5 + seed1 * 2.0) * 0.6 + cos(t * 1.1 + seed1 * 1.5) * 0.3
      );
      vec2 c2 = vec2(
        sin(t * 0.7 + seed2 * 3.0) * 0.6 + sin(t * 1.3 + seed2) * 0.3,
        cos(t * 0.5 + seed2 * 2.0) * 0.6 + cos(t * 1.1 + seed2 * 1.5) * 0.3
      );
      
      float interDist = length(c2 - c1);
      if (interDist < 0.8) {
        // 计算到连接线的距离
        vec2 lineDir = normalize(c2 - c1);
        float proj = dot(normPos - c1, lineDir);
        proj = clamp(proj, 0.0, interDist);
        vec2 closestPoint = c1 + lineDir * proj;
        float distToLine = length(normPos - closestPoint);
        
        // 锯齿效果
        float zigzag = sin(proj * 30.0 + t * 10.0) * 0.02;
        distToLine += zigzag;
        
        // 电弧宽度和亮度
        float arcWidth = 0.03 * (1.0 - interDist / 0.8);
        float arcBrightness = smoothstep(arcWidth * 2.0, 0.0, distToLine);
        arcBrightness *= (1.0 - interDist / 0.8);  // 越近越亮
        
        clusterHit = max(clusterHit, arcBrightness * 0.8);
      }
    }
    
    // 应用游走闪电效果
    if (clusterHit > 0.01) {
      // 颜色梯度：核心白 → 青色光晕 → 蓝色边缘
      vec3 coreColor = vec3(1.0, 1.0, 1.0);       // 白色核心
      vec3 glowColor = vec3(0.5, 1.0, 1.0);       // 青色光晕
      vec3 edgeColor = vec3(0.2, 0.4, 1.0);       // 蓝色边缘
      
      vec3 electricColor;
      if (clusterHit > 0.7) {
        electricColor = mix(glowColor, coreColor, (clusterHit - 0.7) / 0.3);
      } else if (clusterHit > 0.3) {
        electricColor = mix(edgeColor, glowColor, (clusterHit - 0.3) / 0.4);
      } else {
        electricColor = edgeColor;
      }
      
      lightningColor = mix(vColor, electricColor, clusterHit * uWanderingLightning);
      alpha = max(alpha, clusterHit * uWanderingLightning);
    }
  }
  
  // === 闪电击穿效果（贯穿整个图案） ===
  if (uLightningBreakdown > 0.01) {
    float breakdownCycle = uTime * uLightningBreakdownFreq;
    float cyclePhase = fract(breakdownCycle);
    float cycleIndex = floor(breakdownCycle);
    
    // 闪电持续时间
    if (cyclePhase < 0.4) {
      float breakdownIntensity = 1.0 - cyclePhase / 0.4;
      breakdownIntensity = pow(breakdownIntensity, 1.5);
      
      float totalStrike = 0.0;
      
      // 3-5 条主干闪电，从边缘穿心
      for (float bolt = 0.0; bolt < 5.0; bolt++) {
        if (bolt >= 3.0 + uLightningBranches * 0.5) break;
        
        float boltSeed = cycleIndex * 100.0 + bolt * 37.73;
        
        // 入射点和出射点（在边缘对角位置）
        float angle1 = hash(boltSeed) * 6.28318 + bolt * 1.2;
        float angle2 = angle1 + 3.14159 + (hash(boltSeed + 1.0) - 0.5) * 1.0;
        
        vec2 p1 = vec2(cos(angle1), sin(angle1)) * 1.2;  // 略超出边界确保穿透
        vec2 p2 = vec2(cos(angle2), sin(angle2)) * 1.2;
        
        // 主干方向
        vec2 boltDir = normalize(p2 - p1);
        float boltLength = length(p2 - p1);
        
        // 计算粒子到主干的投影
        float proj = dot(normPos - p1, boltDir);
        proj = clamp(proj, 0.0, boltLength);
        
        // 沿主干的位置比例
        float alongBolt = proj / boltLength;
        
        // 锯齿偏移（中点位移模拟）
        float zigzag = 0.0;
        float amplitude = 0.15;
        for (float octave = 0.0; octave < 4.0; octave++) {
          float freq = pow(2.0, octave);
          zigzag += sin(alongBolt * freq * 10.0 + boltSeed * (octave + 1.0) + uTime * 2.0) * amplitude / freq;
        }
        
        // 计算到锯齿路径的距离
        vec2 boltPoint = p1 + boltDir * proj;
        vec2 perpDir = vec2(-boltDir.y, boltDir.x);
        boltPoint += perpDir * zigzag;
        
        float distToBolt = length(normPos - boltPoint);
        
        // 主干宽度（核心 + 光晕）
        float coreWidth = 0.02;
        float glowWidth = 0.08;
        
        float coreBrightness = smoothstep(coreWidth, 0.0, distToBolt);
        float glowBrightness = smoothstep(glowWidth, coreWidth, distToBolt) * 0.5;
        float boltBrightness = coreBrightness + glowBrightness;
        
        // 分支
        for (float branch = 0.0; branch < 3.0; branch++) {
          if (branch >= uLightningBranches) break;
          
          float branchSeed = boltSeed + branch * 23.45;
          float branchStart = 0.2 + hash(branchSeed) * 0.6;  // 分支起点
          
          if (alongBolt > branchStart - 0.05 && alongBolt < branchStart + 0.3) {
            // 分支方向（30-45度角）
            float branchAngle = (hash(branchSeed + 1.0) - 0.5) * 0.8;  // ±0.4 rad ≈ ±23°
            vec2 branchDir = vec2(
              boltDir.x * cos(branchAngle) - boltDir.y * sin(branchAngle),
              boltDir.x * sin(branchAngle) + boltDir.y * cos(branchAngle)
            );
            
            vec2 branchOrigin = p1 + boltDir * (branchStart * boltLength) + perpDir * zigzag;
            float branchProj = dot(normPos - branchOrigin, branchDir);
            branchProj = clamp(branchProj, 0.0, 0.4);
            
            // 分支锯齿
            float branchZigzag = sin(branchProj * 20.0 + branchSeed) * 0.03;
            vec2 branchPoint = branchOrigin + branchDir * branchProj;
            branchPoint += vec2(-branchDir.y, branchDir.x) * branchZigzag;
            
            float distToBranch = length(normPos - branchPoint);
            float branchWidth = 0.015 * (1.0 - branchProj * 2.0);
            branchWidth = max(branchWidth, 0.005);
            
            float branchBrightness = smoothstep(branchWidth * 2.0, 0.0, distToBranch) * 0.7;
            boltBrightness = max(boltBrightness, branchBrightness);
          }
        }
        
        totalStrike = max(totalStrike, boltBrightness);
      }
      
      totalStrike *= breakdownIntensity;
      
      // 应用闪电击穿效果
      if (totalStrike > 0.01) {
        // 颜色梯度
        vec3 coreColor = vec3(1.0, 1.0, 1.0);
        vec3 glowColor = vec3(0.53, 1.0, 1.0);
        vec3 edgeColor = vec3(0.0, 0.0, 1.0);
        
        vec3 strikeColor;
        if (totalStrike > 0.7) {
          strikeColor = mix(glowColor, coreColor, (totalStrike - 0.7) / 0.3);
        } else if (totalStrike > 0.3) {
          strikeColor = mix(edgeColor, glowColor, (totalStrike - 0.3) / 0.4);
        } else {
          strikeColor = mix(edgeColor * 0.5, edgeColor, totalStrike / 0.3);
        }
        
        lightningColor = mix(lightningColor, strikeColor, totalStrike * uLightningBreakdown);
        alpha = max(alpha, totalStrike * uLightningBreakdown);
      }
    }
  }

  // === 海浪颜色效果 ===
  vec3 finalColor = lightningColor;
  
  // 三段式海浪颜色（基于高度）
  if (abs(vWaveHeight) > 0.001 || vWaveFoam > 0.01) {
    // 颜色定义
    vec3 deepColor = vec3(0.0, 0.08, 0.25);   // 深蓝（波谷）
    vec3 midColor = vec3(0.0, 0.45, 0.55);    // 青蓝（浪身）
    vec3 peakColor = vec3(0.7, 0.95, 1.0);    // 浅青白（波峰）
    vec3 foamColor = vec3(1.0, 1.0, 1.0);     // 纯白（泡沫）
    
    // 将高度从 [-1,1] 映射到 [0,1]
    float heightT = (vWaveHeight + 1.0) * 0.5;
    
    // 三段式颜色插值
    vec3 waveColor;
    if (heightT < 0.4) {
      // 深水区 → 中层区
      waveColor = mix(deepColor, midColor, heightT / 0.4);
    } else if (heightT < 0.7) {
      // 中层区 → 波峰区
      waveColor = mix(midColor, peakColor, (heightT - 0.4) / 0.3);
    } else {
      // 波峰区
      waveColor = peakColor;
    }
    
    // 混合原始颜色和海浪颜色（保留部分原始色调）
    float waveColorStrength = 0.6;  // 海浪颜色强度
    finalColor = mix(lightningColor, waveColor, waveColorStrength);
    
    // 泡沫效果
    if (vWaveFoam > 0.01) {
      // 高频闪烁模拟阳光反射
      float sparkle = sin(uTime * 25.0 + vParticleId * 100.0) * 0.5 + 0.5;
      sparkle *= sin(uTime * 37.0 + vParticleId * 73.0) * 0.5 + 0.5;
      float foamFlicker = 0.7 + sparkle * 0.3;  // 0.7-1.0 范围闪烁
      
      // 泡沫颜色：白色 + 闪烁
      vec3 sparklingFoam = foamColor * foamFlicker;
      
      // 根据泡沫强度混合
      float foamMix = vWaveFoam * 0.8;
      finalColor = mix(finalColor, sparklingFoam, foamMix);
      
      // 泡沫增加亮度和不透明度
      alpha = max(alpha, vWaveFoam * 0.6);
    }
  }

  // Saturation
  vec3 color = finalColor;
  if (uSaturation != 1.0) {
     vec3 hsv = rgb2hsv(color);
     hsv.y *= uSaturation;
     color = hsv2rgb(hsv);
  }
  
  // 应用亮度和透明度
  color *= uBrightness;
  float overlay = clamp(uOverlayMode, 0.0, 1.0);
  if (overlay > 0.001) {
    color *= mix(1.0, 2.5, overlay);
    float grayComp = dot(color, vec3(0.299, 0.587, 0.114));
    float satBoost = mix(1.0, 1.2, overlay);
    color = mix(vec3(grayComp), color, satBoost);
  }
  float finalAlpha = min(alpha * uOpacity * vEdgeFade, 1.0);
  
  gl_FragColor = vec4(color, finalAlpha);
}
`;
