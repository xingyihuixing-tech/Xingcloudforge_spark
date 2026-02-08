# 光剑Billboard替换脚本
# 读取原文件
$filePath = "d:\chrome下载\version-1\utils\drawingSystem.ts"
$content = Get-Content $filePath -Encoding UTF8

# 获取替换前后的内容
$before = $content[0..1301]  # 1-1302行 (0-indexed: 0-1301)
$after = $content[1791..($content.Length-1)]  # 1793行及之后 (0-indexed: 1792)

# 新的Billboard着色器和函数
$newContent = @'
// ==================== 光剑Billboard着色器（高性能版本）====================

const lightsaberBillboardVertexShader = `
precision highp float;

attribute float aSide;       // -1 或 1，表示在线条的哪一侧
attribute float aProgress;   // 0-1，沿路径的进度
attribute float aTaper;      // 端点渐变因子

uniform float uLineWidth;
uniform float uTime;
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;

varying float vSide;
varying float vProgress;
varying float vTaper;

void main() {
    vSide = aSide;
    vProgress = aProgress;
    vTaper = aTaper;
    
    vec3 pos = position;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const lightsaberBillboardFragmentShader = `
precision highp float;

varying float vSide;
varying float vProgress;
varying float vTaper;

uniform float uTime;
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
uniform float uCoreWidth;
uniform float uGlowIntensity;
uniform float uGlowFalloff;
uniform float uPulseEnabled;
uniform float uPulseSpeed;
uniform float uPulseIntensity;
uniform float uFlowEnabled;

uniform float uMCOpacity;
uniform float uMCHueShift;
uniform float uMCBrightness;
uniform float uMCSaturationBoost;
uniform float uMCColorMode;
uniform vec3 uMCColor1;
uniform vec3 uMCColor2;
uniform vec3 uMCColor3;
uniform float uMCColorMidPos;
uniform float uMCProceduralIntensity;
uniform float uMCBaseHue;
uniform float uMCBaseSaturation;

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    
    if (s == 0.0) return vec3(l);
    
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    
    return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
}

vec3 rgb2hsl(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float l = (maxC + minC) / 2.0;
    float h = 0.0, s = 0.0;
    
    if (maxC != minC) {
        float d = maxC - minC;
        s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
        if (maxC == rgb.r) h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0);
        else if (maxC == rgb.g) h = (rgb.b - rgb.r) / d + 2.0;
        else h = (rgb.r - rgb.g) / d + 4.0;
        h /= 6.0;
    }
    return vec3(h, s, l);
}

void main() {
    float distFromCenter = abs(vSide);
    float coreAlpha = (1.0 - smoothstep(uCoreWidth * 0.5, uCoreWidth * 0.5 + 0.15, distFromCenter)) * vTaper;
    float glowAlpha = pow(1.0 - distFromCenter, uGlowFalloff) * uGlowIntensity * vTaper;
    
    if (uPulseEnabled > 0.5) {
        float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159 + vProgress * 6.28318) * uPulseIntensity * 0.5;
        glowAlpha *= pulse;
    }
    
    if (uFlowEnabled > 0.5) {
        float flow = sin(vProgress * 20.0 - uTime * 3.0) * 0.15 + 0.85;
        glowAlpha *= flow;
    }
    
    vec3 finalColor = mix(uGlowColor, uCoreColor, coreAlpha);
    float t = vProgress;
    
    if (uMCColorMode > 0.5) {
        vec3 tintColor = finalColor;
        if (uMCColorMode > 3.5) {
            vec3 hsl = rgb2hsl(finalColor);
            hsl.x = uMCBaseHue / 360.0;
            hsl.y = uMCBaseSaturation;
            tintColor = hsl2rgb(hsl);
        } else if (uMCColorMode < 1.5) {
            tintColor = mix(uMCColor1, uMCColor2, t);
        } else if (uMCColorMode < 2.5) {
            tintColor = t < uMCColorMidPos 
                ? mix(uMCColor1, uMCColor2, t / uMCColorMidPos)
                : mix(uMCColor2, uMCColor3, (t - uMCColorMidPos) / (1.0 - uMCColorMidPos));
        } else if (uMCColorMode < 3.5) {
            float hue = mod(t + uTime * 0.1, 1.0);
            tintColor = hsl2rgb(vec3(hue, 0.8, 0.6)) * uMCProceduralIntensity;
        }
        float tintMix = (1.0 - coreAlpha) * 0.8;
        finalColor = mix(finalColor, tintColor * length(finalColor), tintMix);
    }
    
    if (abs(uMCHueShift) > 0.001) {
        vec3 hsl = rgb2hsl(finalColor);
        hsl.x = mod(hsl.x + uMCHueShift, 1.0);
        finalColor = hsl2rgb(hsl);
    }
    
    if (uMCSaturationBoost > 0.001 || uMCSaturationBoost < 1.999) {
        vec3 hsl = rgb2hsl(finalColor);
        hsl.y = clamp(hsl.y * uMCSaturationBoost, 0.0, 1.0);
        finalColor = hsl2rgb(hsl);
    }
    
    finalColor *= uMCBrightness;
    float alpha = max(coreAlpha, glowAlpha * 0.85) * uMCOpacity;
    alpha = smoothstep(0.02, 0.9, alpha);
    
    gl_FragColor = vec4(finalColor, alpha);
}
`;

export function createLightsaberStrokeMesh(
    points: StrokePoint[],
    color: string,
    settings: Partial<LightsaberSettings>,
    symmetryMode: SymmetryMode,
    symmetryDivisions: number,
    magicCircleSettings?: {
        opacity?: number;
        hueShift?: number;
        brightness?: number;
        pulseEnabled?: boolean;
        pulseSpeed?: number;
        pulseIntensity?: number;
        baseHue?: number;
        baseSaturation?: number;
        saturationBoost?: number;
        colorMode?: number;
        color1?: THREE.Vector3;
        color2?: THREE.Vector3;
        color3?: THREE.Vector3;
        colorMidPos?: number;
        proceduralIntensity?: number;
    },
    symmetryParams?: SymmetryParams
): THREE.Group {
    const group = new THREE.Group();
    if (points.length < 2) return group;

    const lightsaberMaterials: THREE.ShaderMaterial[] = [];
    const baseLineWidth = (settings.thickness || 0.03) * 0.5;
    const mcSettings = magicCircleSettings || {};

    const glowColorObj = new THREE.Color(settings.glowColor || color);
    const coreColorObj = new THREE.Color(settings.coreColor || '#ffffff');

    const basePath = points.map(p => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure ?? 1.0
    }));

    const taperLength = 0.15;
    const allPaths = applySymmetryToPath(basePath, symmetryMode, symmetryDivisions, symmetryParams);
    const pressureCurve = (p: number) => 0.3 + p * 0.7;

    const positions: number[] = [];
    const sides: number[] = [];
    const progresses: number[] = [];
    const tapers: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    for (const path of allPaths) {
        if (path.length < 2) continue;

        let totalLen = 0;
        const segLengths: number[] = [0];
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            const dz = (path[i].z ?? 0) - (path[i - 1].z ?? 0);
            totalLen += Math.sqrt(dx * dx + dy * dy + dz * dz);
            segLengths.push(totalLen);
        }
        if (totalLen < 0.001) continue;

        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            const progress = segLengths[i] / totalLen;

            let tx: number, ty: number, tz: number;
            if (i === 0) {
                tx = path[1].x - pt.x;
                ty = path[1].y - pt.y;
                tz = (path[1].z ?? 0) - (pt.z ?? 0);
            } else if (i === path.length - 1) {
                tx = pt.x - path[i - 1].x;
                ty = pt.y - path[i - 1].y;
                tz = (pt.z ?? 0) - (path[i - 1].z ?? 0);
            } else {
                tx = path[i + 1].x - path[i - 1].x;
                ty = path[i + 1].y - path[i - 1].y;
                tz = (path[i + 1].z ?? 0) - (path[i - 1].z ?? 0);
            }

            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.0001) { tx /= tLen; ty /= tLen; tz /= tLen; }

            let nx = -ty, ny = tx;
            const nLen = Math.sqrt(nx * nx + ny * ny);
            if (nLen > 0.0001) { nx /= nLen; ny /= nLen; }

            const pressure = pt.pressure ?? 1.0;
            const pressureWidth = baseLineWidth * pressureCurve(pressure);

            let taper = 1.0;
            if (progress < taperLength) {
                taper = Math.pow(progress / taperLength, 0.5);
            } else if (progress > 1 - taperLength) {
                taper = Math.pow((1 - progress) / taperLength, 0.5);
            }

            const width = pressureWidth * 3.0;

            positions.push(pt.x + nx * width, pt.y + ny * width, pt.z ?? 0);
            sides.push(-1);
            progresses.push(progress);
            tapers.push(taper);

            positions.push(pt.x - nx * width, pt.y - ny * width, pt.z ?? 0);
            sides.push(1);
            progresses.push(progress);
            tapers.push(taper);
        }

        const pathVertexStart = vertexOffset;
        for (let i = 0; i < path.length - 1; i++) {
            const baseIdx = pathVertexStart + i * 2;
            indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
            indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }
        vertexOffset += path.length * 2;
    }

    if (positions.length === 0) return group;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
    geometry.setAttribute('aProgress', new THREE.Float32BufferAttribute(progresses, 1));
    geometry.setAttribute('aTaper', new THREE.Float32BufferAttribute(tapers, 1));
    geometry.setIndex(indices);

    const material = new THREE.ShaderMaterial({
        vertexShader: lightsaberBillboardVertexShader,
        fragmentShader: lightsaberBillboardFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uLineWidth: { value: baseLineWidth },
            uCoreColor: { value: coreColorObj },
            uGlowColor: { value: glowColorObj },
            uCoreWidth: { value: settings.coreWidth ?? 0.3 },
            uGlowIntensity: { value: settings.glowIntensity ?? 1.0 },
            uGlowFalloff: { value: settings.glowFalloff ?? 2.0 },
            uPulseEnabled: { value: mcSettings.pulseEnabled ? 1.0 : 0.0 },
            uPulseSpeed: { value: mcSettings.pulseSpeed ?? 1.0 },
            uPulseIntensity: { value: mcSettings.pulseIntensity ?? 0.3 },
            uFlowEnabled: { value: 1.0 },
            uMCOpacity: { value: mcSettings.opacity ?? 1.0 },
            uMCHueShift: { value: (mcSettings.hueShift ?? 0) / 360.0 },
            uMCBrightness: { value: mcSettings.brightness ?? 1.0 },
            uMCSaturationBoost: { value: mcSettings.saturationBoost ?? 1.0 },
            uMCColorMode: { value: mcSettings.colorMode ?? 0 },
            uMCColor1: { value: mcSettings.color1 ?? new THREE.Vector3(1, 0, 0) },
            uMCColor2: { value: mcSettings.color2 ?? new THREE.Vector3(0, 1, 0) },
            uMCColor3: { value: mcSettings.color3 ?? new THREE.Vector3(0, 0, 1) },
            uMCColorMidPos: { value: mcSettings.colorMidPos ?? 0.5 },
            uMCProceduralIntensity: { value: mcSettings.proceduralIntensity ?? 1.0 },
            uMCBaseHue: { value: mcSettings.baseHue ?? 0 },
            uMCBaseSaturation: { value: mcSettings.baseSaturation ?? 1.0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    lightsaberMaterials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    (group as any).__lightsaberMaterials = lightsaberMaterials;

    return group;
}

'@

# 合并内容
$result = $before + $newContent.Split("`n") + $after

# 写入文件
$result | Set-Content $filePath -Encoding UTF8

Write-Host "光剑函数已替换为Billboard实现"
