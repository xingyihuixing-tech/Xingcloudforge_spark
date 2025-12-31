/**
 * XingForge AI Schema Definition
 * 
 * input: types.ts (as mental reference)
 * output: JSON Schemas for AI context injection
 * pos: Used by promptBuilder to teach AI the allowed parameters
 */

export const NEBULA_SCHEMA_PROMPT = `
Nebula Instance Structure:
\`\`\`json
{
  "name": "string (Creative Name)",
  "imageUrl": "string (Leave empty for now, generate background later)",
  "position": { "x": number (-500 to 500), "y": number, "z": number },
  "scale": number (0.1 to 5),
  "density": number (Step size: 1-10, lower is denser),
  "brightness": number (0.1 to 3),
  "opacity": number (0.1 to 1),
  "baseSize": number (0.5 to 5),
  "colorSaturation": number (0-2),
  "depthMode": "enum('Brightness' | 'Hue' | 'Saturation' | 'Perlin' | 'Radial' | 'Layered' | 'Emboss' | 'Stereo' | 'FBM' | 'Wave')",
  "particleTurbulence": number (0-1),
  "turbulenceSpeed": number (0-2),
  "breathingEnabled": boolean,
  "breathingSpeed": number (0.1-2),
  "flickerEnabled": boolean,
  "flickerSpeed": number (0.5-5),
  "accretionEnabled": boolean,
  "accretionSpeed": number (0.1-2),
  "accretionLayers": [
    { "id": "uuid", "enabled": true, "radiusMax": number, "direction": 1 or -1, "speedMultiplier": number }
  ],
  "waveEnabled": boolean,
  "waveIntensity": number (0-100),
  "wanderingLightningEnabled": boolean,
  "lightningBreakdownEnabled": boolean
}
\`\`\`
`;

export const PLANET_SCHEMA_PROMPT = `
Planet Settings Structure:
\`\`\`json
{
  "planetSettings": {
    "radius": number (50-500),
    
    "core": {
      "enabled": boolean,
      "fillMode": "enum('shell' | 'gradient' | 'solid')",
      "fillPercent": number (0-100),
      "density": number (0.1-10),
      "baseRadius": number (50-500),
      "baseHue": number (0-360),
      "gradientColor": {
        "enabled": boolean,
        "mode": "enum('none'|'twoColor'|'threeColor'|'procedural')",
        "colors": ["#hex", "#hex"],
        "direction": "enum('radial'|'linearX'|'linearY'|'linearZ'|'custom')"
      },
      "rotationSpeed": number (-2 to 2)
    },

    "solidCore": {
      "enabled": boolean,
      "radius": number (10-300),
      "surfaceColor": {
        "mode": "enum('none'|'twoColor'|'threeColor'|'procedural')",
        "baseColor": "#hex",
        "colors": ["#hex"...],
        "spiralDensity": number (0.5-10)
      },
      "scale": number (Texture scale 0.1-10),
      "speed": number (0-2),
      "crackEnabled": boolean,
      "crackColor1": "#hex (Inner)",
      "crackColor2": "#hex (Outer)",
      "lightEnabled": boolean,
      "glowEnabled": boolean,
      "glowColor": { "mode": "...", "colors": ["..."] },
      "glowStrength": number (0-3)
    },

    "ring": {
      "enabled": boolean,
      "radius": number (100-800),
      "tubeRadius": number (5-50),
      "particleCount": number (1000-20000),
      "colorMode": "enum('single' | 'rainbow' | 'gradient')",
      "color": "#hex",
      "rotationSpeed": { "x": number, "y": number, "z": number }
    },

    "atmosphere": {
      "enabled": boolean,
      "height": number (10-100),
      "density": number (0-1),
      "color": "#hex"
    }
  }
}
\`\`\`
`;

export const SYSTEM_PROMPT_TEMPLATE = (mode: string) => `
You are XingForge AI, an expert 3D scene architect.
Your task is to generate valid JSON configurations for a 3D Planet & Nebula engine.

Current Mode: ${mode.toUpperCase()}

Constraints:
1. ONLY return valid JSON code blocks. No markdown explanation outside the code block unless requested.
2. Use the following Schemas as your strict guideline. Do not invent keys not present in the schema.
3. For colors, use Hex strings (#RRGGBB).

${PLANET_SCHEMA_PROMPT}

${NEBULA_SCHEMA_PROMPT}

If the user asks to "Create a scene", generate a full JSON object with \`nebulaInstances\` array and \`planetSettings\`.
If the user asks to "Modify", return ONLY the changed fields in a partial JSON object.
`;
