import { AppSettings, DepthMode, ColorFilterSettings, ColorTintMapping } from '../types';

// Simple Perlin-like noise function for 2D inputs
function noise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

// Improved noise with interpolation
function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  
  const n00 = noise(x0, y0);
  const n10 = noise(x0 + 1, y0);
  const n01 = noise(x0, y0 + 1);
  const n11 = noise(x0 + 1, y0 + 1);
  
  // Smooth interpolation
  const sx = dx * dx * (3 - 2 * dx);
  const sy = dy * dy * (3 - 2 * dy);
  
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return nx0 * (1 - sy) + nx1 * sy;
}

// Fractal Brownian Motion (FBM) - multi-octave noise
function fbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  
  return value / maxValue;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l] as [number, number, number]; // h, s, l in [0, 1]
}

// HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Hex to HSL
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return rgbToHsl(r, g, b);
}

// K-Means clustering for dominant color extraction
export function extractDominantColors(
  imageData: ImageData,
  colorCount: number,
  maxIterations: number = 20
): ColorTintMapping[] {
  const { data, width, height } = imageData;
  const sampleSize = Math.min(10000, width * height);
  const step = Math.max(1, Math.floor((width * height) / sampleSize));
  
  // Sample pixels and convert to HSL
  const samples: { h: number; s: number; l: number; count: number }[] = [];
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Skip transparent or near-black/white pixels
    if (a < 128) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.1 || l < 0.1 || l > 0.9) continue;
    
    samples.push({ h, s, l, count: 1 });
  }
  
  if (samples.length < colorCount) {
    return [];
  }
  
  // Initialize centroids using k-means++
  const centroids: { h: number; s: number; l: number }[] = [];
  
  // First centroid: random sample
  centroids.push({ ...samples[Math.floor(Math.random() * samples.length)] });
  
  // Remaining centroids: weighted by distance
  while (centroids.length < colorCount) {
    let maxDist = -1;
    let bestSample = samples[0];
    
    for (const sample of samples) {
      let minDist = Infinity;
      for (const c of centroids) {
        const hDiff = Math.min(Math.abs(sample.h - c.h), 1 - Math.abs(sample.h - c.h));
        const dist = hDiff * hDiff + (sample.s - c.s) ** 2 + (sample.l - c.l) ** 2;
        minDist = Math.min(minDist, dist);
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestSample = sample;
      }
    }
    centroids.push({ ...bestSample });
  }
  
  // K-means iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign samples to nearest centroid
    const clusters: { h: number; s: number; l: number; count: number }[][] = 
      Array.from({ length: colorCount }, () => []);
    
    for (const sample of samples) {
      let minDist = Infinity;
      let nearestIdx = 0;
      
      for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i];
        // Circular hue distance
        const hDiff = Math.min(Math.abs(sample.h - c.h), 1 - Math.abs(sample.h - c.h));
        const dist = hDiff * hDiff * 4 + (sample.s - c.s) ** 2 + (sample.l - c.l) ** 2;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      clusters[nearestIdx].push(sample);
    }
    
    // Update centroids
    let converged = true;
    for (let i = 0; i < colorCount; i++) {
      if (clusters[i].length === 0) continue;
      
      // Average hue using circular mean
      let sinSum = 0, cosSum = 0, sSum = 0, lSum = 0;
      for (const s of clusters[i]) {
        sinSum += Math.sin(s.h * 2 * Math.PI);
        cosSum += Math.cos(s.h * 2 * Math.PI);
        sSum += s.s;
        lSum += s.l;
      }
      
      const newH = (Math.atan2(sinSum, cosSum) / (2 * Math.PI) + 1) % 1;
      const newS = sSum / clusters[i].length;
      const newL = lSum / clusters[i].length;
      
      const hDiff = Math.min(Math.abs(newH - centroids[i].h), 1 - Math.abs(newH - centroids[i].h));
      if (hDiff > 0.01 || Math.abs(newS - centroids[i].s) > 0.01) {
        converged = false;
      }
      
      centroids[i] = { h: newH, s: newS, l: newL };
    }
    
    if (converged) break;
  }
  
  // Count samples per cluster and create mappings
  const clusterCounts: number[] = Array(colorCount).fill(0);
  for (const sample of samples) {
    let minDist = Infinity;
    let nearestIdx = 0;
    
    for (let i = 0; i < centroids.length; i++) {
      const c = centroids[i];
      const hDiff = Math.min(Math.abs(sample.h - c.h), 1 - Math.abs(sample.h - c.h));
      const dist = hDiff * hDiff * 4 + (sample.s - c.s) ** 2 + (sample.l - c.l) ** 2;
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }
    clusterCounts[nearestIdx]++;
  }
  
  const totalCount = clusterCounts.reduce((a, b) => a + b, 0);
  
  // Sort by percentage (descending)
  const results: ColorTintMapping[] = centroids
    .map((c, i) => {
      const [r, g, b] = hslToRgb(c.h, c.s, c.l);
      const hex = rgbToHex(r, g, b);
      return {
        sourceHue: c.h * 360,
        sourceColor: hex,
        targetColor: hex, // Default: same as source
        hueSpread: 1.0,
        percentage: Math.round((clusterCounts[i] / totalCount) * 100)
      };
    })
    .filter(m => m.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
  
  return results;
}

// Apply color tinting to a single pixel
export function applyColorTint(
  r: number, g: number, b: number,
  mappings: ColorTintMapping[],
  globalStrength: number
): [number, number, number] {
  if (mappings.length === 0 || globalStrength === 0) {
    return [r, g, b];
  }
  
  const [h, s, l] = rgbToHsl(r, g, b);
  const hue = h * 360;
  
  // Find nearest source color
  let minDist = Infinity;
  let nearestMapping: ColorTintMapping | null = null;
  
  for (const mapping of mappings) {
    // Circular hue distance
    let hDiff = Math.abs(hue - mapping.sourceHue);
    if (hDiff > 180) hDiff = 360 - hDiff;
    
    if (hDiff < minDist) {
      minDist = hDiff;
      nearestMapping = mapping;
    }
  }
  
  if (!nearestMapping) return [r, g, b];
  
  // Calculate new hue
  const [targetH] = hexToHsl(nearestMapping.targetColor);
  const sourceHueNorm = nearestMapping.sourceHue / 360;
  
  // Hue difference from source
  let hueDiff = h - sourceHueNorm;
  // Handle circular wrap
  if (hueDiff > 0.5) hueDiff -= 1;
  if (hueDiff < -0.5) hueDiff += 1;
  
  // Apply hue spread
  const scaledDiff = hueDiff * nearestMapping.hueSpread;
  let newH = targetH + scaledDiff;
  // Normalize to [0, 1]
  newH = ((newH % 1) + 1) % 1;
  
  // Blend with original based on global strength
  const finalH = h + (newH - h) * globalStrength;
  const normalizedFinalH = ((finalH % 1) + 1) % 1;
  
  const [newR, newG, newB] = hslToRgb(normalizedFinalH, s, l);
  return [newR, newG, newB];
}

// Check if a color should be filtered out
function shouldFilterColor(
  r: number, g: number, b: number,
  filterSettings: ColorFilterSettings
): boolean {
  if (!filterSettings.enabled) return false;
  
  const [h, s] = rgbToHsl(r, g, b);
  const hue = h * 360; // Convert to 0-360 range
  
  // Check saturation filter
  if (s < filterSettings.saturationMin || s > filterSettings.saturationMax) {
    return !filterSettings.invertMode; // If invert, keep these; otherwise filter out
  }
  
  // Check hue filters
  let matchesAnyFilter = false;
  
  for (const filter of filterSettings.filters) {
    if (!filter.enabled) continue;
    
    let inRange: boolean;
    if (filter.hueStart <= filter.hueEnd) {
      // Normal range (e.g., 80-160)
      inRange = hue >= filter.hueStart && hue <= filter.hueEnd;
    } else {
      // Wrapping range (e.g., 345-15 for red)
      inRange = hue >= filter.hueStart || hue <= filter.hueEnd;
    }
    
    if (inRange) {
      matchesAnyFilter = true;
      break;
    }
  }
  
  // invertMode: true = keep matching colors, false = exclude matching colors
  if (filterSettings.invertMode) {
    // Only keep colors that match a filter
    return !matchesAnyFilter;
  } else {
    // Exclude colors that match a filter
    return matchesAnyFilter;
  }
}

// Sobel edge detection with improved normalization
function calculateGradient(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  height?: number
): number {
  // Get brightness of surrounding pixels with bounds checking
  const getBrightness = (px: number, py: number): number => {
    // Clamp coordinates to valid range
    px = Math.max(0, Math.min(width - 1, px));
    py = Math.max(0, Math.min((height || 10000) - 1, py));
    const i = (py * width + px) * 4;
    if (i < 0 || i >= data.length - 2) return 0;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  
  // Sobel kernels (3x3)
  const gx = 
    -1 * getBrightness(x - 1, y - 1) + 1 * getBrightness(x + 1, y - 1) +
    -2 * getBrightness(x - 1, y)     + 2 * getBrightness(x + 1, y) +
    -1 * getBrightness(x - 1, y + 1) + 1 * getBrightness(x + 1, y + 1);
    
  const gy = 
    -1 * getBrightness(x - 1, y - 1) - 2 * getBrightness(x, y - 1) - 1 * getBrightness(x + 1, y - 1) +
     1 * getBrightness(x - 1, y + 1) + 2 * getBrightness(x, y + 1) + 1 * getBrightness(x + 1, y + 1);
  
  // Gradient magnitude with improved normalization
  // Max possible gradient is sqrt(4*255^2 + 4*255^2) ≈ 1442
  const magnitude = Math.sqrt(gx * gx + gy * gy);
  // Normalize to 0-1 range with soft clamp
  return Math.min(1.0, magnitude / 500);
}

// 计算边缘强度图（带高斯模糊预处理）
function computeEdgeMap(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const edgeMap = new Float32Array(width * height);
  
  // 计算每个像素的边缘强度
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      edgeMap[y * width + x] = calculateGradient(data, width, x, y, height);
    }
  }
  
  // 简单的 3x3 均值模糊平滑边缘图
  const smoothedMap = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += edgeMap[(y + dy) * width + (x + dx)];
        }
      }
      smoothedMap[y * width + x] = sum / 9;
    }
  }
  
  return smoothedMap;
}

export interface ProcessedData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array; // Normalized size multiplier based on brightness
  count: number;
  // Store original dimensions for proper scaling
  originalWidth: number;
  originalHeight: number;
  scaleFactor: number;
  // 处理后的画布尺寸（用于UV计算）
  canvasWidth: number;
  canvasHeight: number;
}

// Configuration for image processing
const IMAGE_CONFIG = {
  // Maximum canvas size for processing (affects memory usage)
  MAX_CANVAS_SIZE: 1600,
  // Minimum canvas size to ensure enough detail
  MIN_CANVAS_SIZE: 400,
  // Target aspect ratio range (will pad if outside this range)
  MAX_ASPECT_RATIO: 2.5,
  // Base scale factor for 3D positioning
  BASE_SCALE: 1.0,
};

export const processImage = (
  img: HTMLImageElement,
  settings: AppSettings
): ProcessedData => {
  const canvas = document.createElement('canvas');
  
  // Get original dimensions
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  
  if (originalWidth === 0 || originalHeight === 0) {
    throw new Error('Invalid image dimensions');
  }
  
  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight;
  
  // Determine processing dimensions
  // Goal: Scale to fit within MAX_CANVAS_SIZE while maintaining aspect ratio
  // and ensuring minimum detail level
  let width: number;
  let height: number;
  
  if (aspectRatio >= 1) {
    // Landscape or square
    width = Math.min(originalWidth, IMAGE_CONFIG.MAX_CANVAS_SIZE);
    width = Math.max(width, IMAGE_CONFIG.MIN_CANVAS_SIZE);
    height = Math.round(width / aspectRatio);
    
    // Ensure height is also within bounds
    if (height > IMAGE_CONFIG.MAX_CANVAS_SIZE) {
      height = IMAGE_CONFIG.MAX_CANVAS_SIZE;
      width = Math.round(height * aspectRatio);
    }
    if (height < IMAGE_CONFIG.MIN_CANVAS_SIZE) {
      height = IMAGE_CONFIG.MIN_CANVAS_SIZE;
      width = Math.round(height * aspectRatio);
    }
  } else {
    // Portrait
    height = Math.min(originalHeight, IMAGE_CONFIG.MAX_CANVAS_SIZE);
    height = Math.max(height, IMAGE_CONFIG.MIN_CANVAS_SIZE);
    width = Math.round(height * aspectRatio);
    
    // Ensure width is also within bounds
    if (width > IMAGE_CONFIG.MAX_CANVAS_SIZE) {
      width = IMAGE_CONFIG.MAX_CANVAS_SIZE;
      height = Math.round(width / aspectRatio);
    }
    if (width < IMAGE_CONFIG.MIN_CANVAS_SIZE) {
      width = IMAGE_CONFIG.MIN_CANVAS_SIZE;
      height = Math.round(width / aspectRatio);
    }
  }
  
  // Ensure dimensions are even numbers (helps with some rendering)
  width = Math.floor(width / 2) * 2;
  height = Math.floor(height / 2) * 2;
  
  // Calculate scale factor for consistent 3D visualization size
  // Normalize based on the larger dimension to keep similar visual size
  const maxDim = Math.max(width, height);
  const scaleFactor = (IMAGE_CONFIG.BASE_SCALE * 600) / maxDim;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw image centered and scaled to fill canvas
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Pre-compute edge map if edge sampling is enabled (使用优化的边缘检测)
  let edgeMap: Float32Array | null = null;
  if (settings.edgeSamplingEnabled) {
    edgeMap = computeEdgeMap(data, width, height);
  }

  // Calculate base step and edge step
  const baseStep = Math.max(1, Math.floor(settings.density));
  // Edge areas get denser sampling
  const edgeStep = Math.max(1, Math.floor(baseStep / settings.edgeDensityBoost));
  
  // Estimate particle count to allocate buffers - use generous estimate
  let estimatedCount = Math.ceil((width * height) / (baseStep * baseStep));
  if (settings.edgeSamplingEnabled) {
    // Need more particles due to edge density boost
    // 使用更大的倍数确保 buffer 足够
    const boostFactor = Math.max(5, settings.edgeDensityBoost * 3);
    estimatedCount = Math.ceil(estimatedCount * boostFactor);
  }
  // Apply maxParticles limit after estimation
  const maxAllowed = settings.maxParticles > 0 ? settings.maxParticles : estimatedCount;
  estimatedCount = Math.min(estimatedCount, maxAllowed);
  
  // 确保估算值不会太小
  estimatedCount = Math.max(estimatedCount, 10000);

  const positions = new Float32Array(estimatedCount * 3);
  const colors = new Float32Array(estimatedCount * 3);
  const sizes = new Float32Array(estimatedCount);

  let particleIndex = 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  
  // Edge threshold for classification
  const edgeThreshold = settings.edgeSensitivity;
  
  // Flag to break out of nested loops
  let bufferFull = false;
  
  // 边缘裁剪边界计算
  const cropPercent = settings.edgeCropPercent / 100;
  const cropX = Math.floor(width * cropPercent);
  const cropY = Math.floor(height * cropPercent);
  const minX = cropX;
  const maxX = width - cropX;
  const minY = cropY;
  const maxY = height - cropY;
  
  // 圆形裁剪参数
  const centerX = width / 2;
  const centerY = height / 2;
  const cropRadius = Math.min(width, height) / 2 * (1 - cropPercent);
  
  // 检查像素是否在有效区域内（支持圆形和矩形裁剪）
  const isInBounds = (x: number, y: number) => {
    if (settings.circularCrop) {
      // 圆形裁剪：检查到中心的距离
      const dx = x - centerX;
      const dy = y - centerY;
      return Math.sqrt(dx * dx + dy * dy) <= cropRadius;
    } else {
      // 矩形裁剪
      return x >= minX && x < maxX && y >= minY && y < maxY;
    }
  };

  // Two-pass sampling when edge sampling is enabled
  if (settings.edgeSamplingEnabled && edgeMap) {
    // Pass 1: Sample edge areas with higher density
    for (let y = 0; y < height && !bufferFull; y += edgeStep) {
      for (let x = 0; x < width && !bufferFull; x += edgeStep) {
        if (particleIndex >= estimatedCount) {
          bufferFull = true;
          break;
        }
        
        // 边缘裁剪检查
        if (!isInBounds(x, y)) continue;
        
        const edgeStrength = edgeMap[y * width + x];
        if (edgeStrength < edgeThreshold) continue; // Skip non-edge pixels
        
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness < settings.threshold || a < 50) continue;
        if (shouldFilterColor(r, g, b, settings.colorFilter)) continue;
        
        // Add edge particle with size boost
        addParticle(x, y, r, g, b, brightness, 1.0 + edgeStrength);
      }
    }
    
    // Pass 2: Sample non-edge areas with lower density (if fillDensity > 0 and not pure outline mode)
    if (settings.fillDensity > 0 && !settings.pureOutlineMode && !bufferFull) {
      const fillStep = Math.max(1, Math.floor(baseStep / settings.fillDensity));
      for (let y = 0; y < height && !bufferFull; y += fillStep) {
        for (let x = 0; x < width && !bufferFull; x += fillStep) {
          if (particleIndex >= estimatedCount) {
            bufferFull = true;
            break;
          }
          
          // 边缘裁剪检查
          if (!isInBounds(x, y)) continue;
          
          const edgeStrength = edgeMap[y * width + x];
          if (edgeStrength >= edgeThreshold) continue; // Skip edge pixels (already sampled)
          
          // Random skip for fill areas to create sparse effect
          if (Math.random() > settings.fillDensity) continue;
          
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness < settings.threshold || a < 50) continue;
          if (shouldFilterColor(r, g, b, settings.colorFilter)) continue;
          
          // Add fill particle with smaller size
          addParticle(x, y, r, g, b, brightness, 0.5);
        }
      }
    }
  } else {
    // Original uniform sampling
    for (let y = 0; y < height && !bufferFull; y += baseStep) {
      for (let x = 0; x < width && !bufferFull; x += baseStep) {
        if (particleIndex >= estimatedCount) {
          bufferFull = true;
          break;
        }
        
        // 边缘裁剪检查
        if (!isInBounds(x, y)) continue;

        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Brightness calculation (perceived)
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        // Threshold check
        if (brightness < settings.threshold || a < 50) continue;
        
        // Color filter check
        if (shouldFilterColor(r, g, b, settings.colorFilter)) continue;
        
        addParticle(x, y, r, g, b, brightness, 1.0);
      }
    }
  }
  
  // Helper function to add a particle
  function addParticle(x: number, y: number, r: number, g: number, b: number, brightness: number, sizeMultiplier: number) {
    if (particleIndex >= estimatedCount) return;
    
    const normalizedBrightness = brightness / 255;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate Z based on mode
    let z = 0;
    
    switch (settings.depthMode) {
      case DepthMode.InverseBrightness:
        z = (1.0 - normalizedBrightness) * settings.depthRange;
        break;
        
      case DepthMode.Hue: {
        const [h] = rgbToHsl(r, g, b);
        z = h * settings.depthRange;
        break;
      }
        
      case DepthMode.Saturation: {
        const [, s] = rgbToHsl(r, g, b);
        z = s * settings.depthRange;
        break;
      }
        
      case DepthMode.Perlin: {
        const noiseVal = noise(x * 0.01, y * 0.01);
        z = normalizedBrightness * (settings.depthRange * 0.5) + noiseVal * settings.noiseStrength;
        break;
      }
        
      case DepthMode.Radial:
        z = (1.0 - (dist / maxDist)) * settings.depthRange;
        break;
        
      case DepthMode.Layered:
        if (brightness < 64) z = 0;
        else if (brightness < 128) z = settings.depthRange * 0.33;
        else if (brightness < 192) z = settings.depthRange * 0.66;
        else z = settings.depthRange;
        break;
        
      case DepthMode.Emboss: {
        const gradient = calculateGradient(data, width, x, y);
        z = gradient * settings.depthRange;
        break;
      }
        
      case DepthMode.FBM: {
        const fbmVal = fbm(x * 0.008, y * 0.008, settings.fbmOctaves);
        z = normalizedBrightness * (settings.depthRange * 0.3) + 
            fbmVal * settings.depthRange * 0.7 * (settings.noiseStrength / 40);
        break;
      }
        
      case DepthMode.Wave: {
        const wavePhase = dist * settings.waveFrequency;
        const waveVal = (Math.sin(wavePhase) + 1) * 0.5;
        z = waveVal * settings.depthRange * settings.waveAmplitude;
        break;
      }
        
      case DepthMode.Stereo:
        z = normalizedBrightness * settings.depthRange;
        break;
        
      case DepthMode.Brightness:
      default:
        z = normalizedBrightness * settings.depthRange;
        break;
    }

    if (settings.depthInvert) z = -z;

    // X, Y mapping (centered)
    let posX = x - cx;
    const posY = -(y - cy); // Flip Y
    
    // For Stereo mode, apply X offset based on depth for parallax effect
    if (settings.depthMode === DepthMode.Stereo) {
      const depthOffset = (z / settings.depthRange) * settings.stereoSeparation;
      posX += depthOffset;
    }

    positions[particleIndex * 3] = posX;
    positions[particleIndex * 3 + 1] = posY;
    positions[particleIndex * 3 + 2] = z;

    // Apply color tinting if enabled
    let finalR = r, finalG = g, finalB = b;
    if (settings.colorTint.enabled && settings.colorTint.mappings.length > 0) {
      [finalR, finalG, finalB] = applyColorTint(r, g, b, settings.colorTint.mappings, settings.colorTint.globalStrength);
    }

    colors[particleIndex * 3] = finalR / 255;
    colors[particleIndex * 3 + 1] = finalG / 255;
    colors[particleIndex * 3 + 2] = finalB / 255;

    // Size based on brightness and sizeMultiplier
    sizes[particleIndex] = normalizedBrightness * sizeMultiplier;

    particleIndex++;
  }

  return {
    positions: positions.slice(0, particleIndex * 3),
    colors: colors.slice(0, particleIndex * 3),
    sizes: sizes.slice(0, particleIndex),
    count: particleIndex,
    originalWidth,
    originalHeight,
    scaleFactor,
    canvasWidth: width,
    canvasHeight: height,
  };
};