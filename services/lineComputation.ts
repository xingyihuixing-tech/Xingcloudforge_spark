import { LineSettings, LineMode, LineRenderMode, DistanceRange } from '../types';
import { ProcessedData } from './imageProcessing';

export interface LineData {
  positions: Float32Array;  // 每条线2个点，每点3个坐标
  colors: Float32Array;     // 每条线2个点，每点3个颜色分量
  count: number;            // 线段数量
}

// 检查距离是否在任一启用的区间内
function isDistanceInRanges(dist: number, ranges: DistanceRange[]): boolean {
  const enabledRanges = ranges.filter(r => r.enabled);
  if (enabledRanges.length === 0) return true; // 没有区间时全部通过
  return enabledRanges.some(r => dist >= r.min && dist <= r.max);
}

// 检查粒子大小是否满足连线条件
function isParticleSizeValid(
  size: number,
  minAbsolute: number,
  minRelative: number,
  maxSize: number
): boolean {
  // 绝对大小检查
  if (size < minAbsolute) return false;
  // 相对大小检查（相对于最大粒子）
  if (maxSize > 0 && size < maxSize * minRelative) return false;
  return true;
}

// 计算粒子大小数组的最大值
function getMaxParticleSize(sizes: Float32Array, count: number): number {
  let max = 0;
  for (let i = 0; i < count; i++) {
    if (sizes[i] > max) max = sizes[i];
  }
  return max;
}

// 计算百分位阈值：返回最小的前 percentile% 粒子的大小阈值
function getPercentileThreshold(sizes: Float32Array, count: number, percentile: number): number {
  if (percentile <= 0 || count === 0) return 0;
  
  // 采样排序以提高性能（对于大量粒子）
  const sampleSize = Math.min(count, 10000);
  const step = Math.max(1, Math.floor(count / sampleSize));
  
  const sampledSizes: number[] = [];
  for (let i = 0; i < count; i += step) {
    sampledSizes.push(sizes[i]);
  }
  
  // 升序排序
  sampledSizes.sort((a, b) => a - b);
  
  // 计算百分位索引
  const index = Math.floor(sampledSizes.length * percentile / 100);
  return sampledSizes[Math.min(index, sampledSizes.length - 1)];
}

// 获取距离在区间中的归一化位置（用于透明度渐变）
function getDistanceFade(dist: number, ranges: DistanceRange[], fadeEnabled: boolean = true): number {
  const enabledRanges = ranges.filter(r => r.enabled);
  if (enabledRanges.length === 0) return 1.0;
  
  for (const r of enabledRanges) {
    if (dist >= r.min && dist <= r.max) {
      if (!fadeEnabled) return 1.0;
      
      const rangeSize = r.max - r.min;
      if (rangeSize <= 0) return 1.0;
      
      // 只在最大距离边缘淡出，最小距离不淡出
      const distFromMax = r.max - dist;
      const fadeZone = rangeSize * 0.15; // 减少到 15% 边缘区域淡出
      if (distFromMax < fadeZone) {
        const t = distFromMax / fadeZone;
        return t * t * (3.0 - 2.0 * t); // smoothstep
      }
      return 1.0;
    }
  }
  return 0.0;
}

// 计算两个颜色之间的距离
function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// 计算两点之间的距离
function pointDistance(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 带 Z 轴权重的 3D 距离计算
function weightedDistance3D(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  zWeight: number = 1.0
): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = (z1 - z2) * zWeight;  // Z 轴距离乘以权重
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 2D 距离
function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// 检查两个粒子的颜色是否相近（用于颜色约束）
function isColorSimilar(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  tolerance: number  // 0-1, 越小越严格
): boolean {
  // 归一化颜色差异 (最大可能差异是 sqrt(3) ≈ 1.732)
  const dist = colorDistance(r1, g1, b1, r2, g2, b2);
  const maxDist = Math.sqrt(3);  // sqrt(1^2 + 1^2 + 1^2)
  const normalizedDist = dist / maxDist;
  return normalizedDist <= tolerance;
}

// Delaunay 三角剖分使用的数据结构
interface Point2D {
  x: number;
  y: number;
  idx: number;  // 原始索引
}

interface Triangle {
  p1: number;
  p2: number;
  p3: number;
}

// 计算三角形外接圆
function circumcircle(
  p1: Point2D, p2: Point2D, p3: Point2D
): { cx: number; cy: number; r: number } | null {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;
  
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;
  
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  
  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
  
  return { cx: ux, cy: uy, r };
}

// 检查点是否在外接圆内
function inCircumcircle(p: Point2D, t: Triangle, points: Point2D[]): boolean {
  const circle = circumcircle(points[t.p1], points[t.p2], points[t.p3]);
  if (!circle) return false;
  
  const dist = distance2D(p.x, p.y, circle.cx, circle.cy);
  return dist < circle.r;
}

// Bowyer-Watson Delaunay 三角剖分算法
function delaunayTriangulation(points: Point2D[]): Triangle[] {
  if (points.length < 3) return [];
  
  // 找到边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy) * 2;
  
  // 创建超级三角形
  const superP1: Point2D = { x: minX - deltaMax, y: minY - deltaMax, idx: -1 };
  const superP2: Point2D = { x: minX + deltaMax * 2, y: minY - deltaMax, idx: -2 };
  const superP3: Point2D = { x: minX + dx / 2, y: maxY + deltaMax, idx: -3 };
  
  const allPoints = [...points, superP1, superP2, superP3];
  const superIndices = [points.length, points.length + 1, points.length + 2];
  
  let triangles: Triangle[] = [{ p1: superIndices[0], p2: superIndices[1], p3: superIndices[2] }];
  
  // 逐个添加点
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const badTriangles: Triangle[] = [];
    
    // 找到所有外接圆包含该点的三角形
    for (const t of triangles) {
      if (inCircumcircle(p, t, allPoints)) {
        badTriangles.push(t);
      }
    }
    
    // 找到多边形边界
    const polygon: [number, number][] = [];
    for (const t of badTriangles) {
      const edges: [number, number][] = [
        [t.p1, t.p2],
        [t.p2, t.p3],
        [t.p3, t.p1]
      ];
      
      for (const edge of edges) {
        // 检查边是否被其他坏三角形共享
        let shared = false;
        for (const other of badTriangles) {
          if (other === t) continue;
          const otherEdges: [number, number][] = [
            [other.p1, other.p2],
            [other.p2, other.p3],
            [other.p3, other.p1]
          ];
          for (const oe of otherEdges) {
            if ((edge[0] === oe[0] && edge[1] === oe[1]) ||
                (edge[0] === oe[1] && edge[1] === oe[0])) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) {
          polygon.push(edge);
        }
      }
    }
    
    // 移除坏三角形
    triangles = triangles.filter(t => !badTriangles.includes(t));
    
    // 用新点和多边形边创建新三角形
    for (const edge of polygon) {
      triangles.push({ p1: edge[0], p2: edge[1], p3: i });
    }
  }
  
  // 移除包含超级三角形顶点的三角形
  triangles = triangles.filter(t => 
    !superIndices.includes(t.p1) && 
    !superIndices.includes(t.p2) && 
    !superIndices.includes(t.p3)
  );
  
  return triangles;
}

// Fisher-Yates 随机打乱算法
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 基于距离的连线计算
function computeDistanceLines(
  data: ProcessedData,
  settings: LineSettings
): LineData {
  const { positions, colors, sizes, count } = data;
  const ranges = settings.distanceRanges || [{ id: '1', min: 0, max: settings.maxDistance, enabled: true }];
  const maxLines = settings.maxLines;
  const sampleRatio = settings.sampleRatio;
  
  // 结构感知约束参数
  const colorConstraintEnabled = settings.colorConstraintEnabled || false;
  const colorTolerance = settings.colorTolerance || 0.3;
  const maxConnectionsPerParticle = settings.maxConnectionsPerParticle || 0;
  const zDepthWeight = settings.zDepthWeight ?? 1.0;
  
  // 粒子大小过滤参数
  const sizeFilterEnabled = settings.sizeFilterEnabled || false;
  const minSizeAbsolute = settings.minSizeAbsolute || 0;
  const minSizeRelative = settings.minSizeRelative || 0;
  const minSizePercentile = settings.minSizePercentile || 0;
  const maxParticleSize = sizeFilterEnabled ? getMaxParticleSize(sizes, count) : 0;
  // 计算百分位阈值
  const percentileThreshold = (sizeFilterEnabled && minSizePercentile > 0) 
    ? getPercentileThreshold(sizes, count, minSizePercentile) 
    : 0;
  
  // 获取最大距离用于快速过滤
  const enabledRanges = ranges.filter(r => r.enabled);
  const maxPossibleDist = enabledRanges.length > 0 
    ? Math.max(...enabledRanges.map(r => r.max))
    : settings.maxDistance;
  
  // 采样粒子并随机打乱顺序，确保连线分布均匀
  const sampleStep = Math.max(1, Math.floor(1 / sampleRatio));
  let sampledIndices: number[] = [];
  for (let i = 0; i < count; i += sampleStep) {
    // 粒子大小过滤（绝对/相对/百分位）
    if (sizeFilterEnabled) {
      // 百分位过滤：过滤最小的前X%
      if (minSizePercentile > 0 && sizes[i] < percentileThreshold) continue;
      // 绝对/相对过滤
      if (!isParticleSizeValid(sizes[i], minSizeAbsolute, minSizeRelative, maxParticleSize)) continue;
    }
    sampledIndices.push(i);
  }
  // 随机打乱，避免连线集中在图像一侧
  sampledIndices = shuffleArray(sampledIndices);
  
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  let lineCount = 0;
  
  // 每个粒子的连接计数（用于限制每粒子连接数）
  const connectionCount = new Map<number, number>();
  
  // 对于每个采样粒子，找到距离内的其他粒子
  for (let i = 0; i < sampledIndices.length && lineCount < maxLines; i++) {
    const idx1 = sampledIndices[i];
    
    // 检查粒子1是否已达到连接上限
    if (maxConnectionsPerParticle > 0) {
      const count1 = connectionCount.get(idx1) || 0;
      if (count1 >= maxConnectionsPerParticle) continue;
    }
    
    const x1 = positions[idx1 * 3];
    const y1 = positions[idx1 * 3 + 1];
    const z1 = positions[idx1 * 3 + 2];
    const r1 = colors[idx1 * 3];
    const g1 = colors[idx1 * 3 + 1];
    const b1 = colors[idx1 * 3 + 2];
    
    for (let j = i + 1; j < sampledIndices.length && lineCount < maxLines; j++) {
      const idx2 = sampledIndices[j];
      
      // 检查粒子2是否已达到连接上限
      if (maxConnectionsPerParticle > 0) {
        const count2 = connectionCount.get(idx2) || 0;
        if (count2 >= maxConnectionsPerParticle) continue;
      }
      
      const x2 = positions[idx2 * 3];
      const y2 = positions[idx2 * 3 + 1];
      const z2 = positions[idx2 * 3 + 2];
      
      // 使用带 Z 轴权重的距离计算
      const dist = weightedDistance3D(x1, y1, z1, x2, y2, z2, zDepthWeight);
      
      // 快速过滤超出最大范围的
      if (dist > maxPossibleDist) continue;
      
      // 检查是否在任一距离区间内
      if (!isDistanceInRanges(dist, ranges)) continue;
      
      const r2 = colors[idx2 * 3];
      const g2 = colors[idx2 * 3 + 1];
      const b2 = colors[idx2 * 3 + 2];
      
      // 颜色约束检查：如果启用，跳过颜色差异过大的粒子对
      if (colorConstraintEnabled) {
        if (!isColorSimilar(r1, g1, b1, r2, g2, b2, colorTolerance)) {
          continue;
        }
      }
      
      // 添加线段
      linePositions.push(x1, y1, z1, x2, y2, z2);
      
      // 基于距离区间的透明度淡化
      const fade = getDistanceFade(dist, ranges, settings.fadeWithDistance);
      
      // 应用淡化到颜色（模拟透明度）
      lineColors.push(
        r1 * fade, g1 * fade, b1 * fade, 
        r2 * fade, g2 * fade, b2 * fade
      );
      
      lineCount++;
      
      // 更新连接计数
      if (maxConnectionsPerParticle > 0) {
        connectionCount.set(idx1, (connectionCount.get(idx1) || 0) + 1);
        connectionCount.set(idx2, (connectionCount.get(idx2) || 0) + 1);
        
        // 再次检查粒子1是否达到上限，如果是则跳出内层循环
        if ((connectionCount.get(idx1) || 0) >= maxConnectionsPerParticle) break;
      }
    }
  }
  
  return {
    positions: new Float32Array(linePositions),
    colors: new Float32Array(lineColors),
    count: lineCount
  };
}

// 基于颜色相近的连线计算
function computeColorLines(
  data: ProcessedData,
  settings: LineSettings
): LineData {
  const { positions, colors, count } = data;
  const colorThreshold = settings.colorThreshold;
  const ranges = settings.distanceRanges || [{ id: '1', min: 0, max: settings.maxDistance * 2, enabled: true }];
  const maxLines = settings.maxLines;
  const sampleRatio = settings.sampleRatio;
  
  const enabledRanges = ranges.filter(r => r.enabled);
  const maxDist = enabledRanges.length > 0 
    ? Math.max(...enabledRanges.map(r => r.max))
    : settings.maxDistance * 2;
  
  const sampleStep = Math.max(1, Math.floor(1 / sampleRatio));
  let sampledIndices: number[] = [];
  for (let i = 0; i < count; i += sampleStep) {
    sampledIndices.push(i);
  }
  sampledIndices = shuffleArray(sampledIndices);
  
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  let lineCount = 0;
  
  for (let i = 0; i < sampledIndices.length && lineCount < maxLines; i++) {
    const idx1 = sampledIndices[i];
    const x1 = positions[idx1 * 3];
    const y1 = positions[idx1 * 3 + 1];
    const z1 = positions[idx1 * 3 + 2];
    const r1 = colors[idx1 * 3];
    const g1 = colors[idx1 * 3 + 1];
    const b1 = colors[idx1 * 3 + 2];
    
    for (let j = i + 1; j < sampledIndices.length && lineCount < maxLines; j++) {
      const idx2 = sampledIndices[j];
      const x2 = positions[idx2 * 3];
      const y2 = positions[idx2 * 3 + 1];
      const z2 = positions[idx2 * 3 + 2];
      const r2 = colors[idx2 * 3];
      const g2 = colors[idx2 * 3 + 1];
      const b2 = colors[idx2 * 3 + 2];
      
      const dist = pointDistance(x1, y1, z1, x2, y2, z2);
      if (dist > maxDist) continue;
      
      const cDist = colorDistance(r1, g1, b1, r2, g2, b2);
      
      if (cDist < colorThreshold) {
        linePositions.push(x1, y1, z1, x2, y2, z2);
        
        // 基于距离的透明度曲线
        const t = dist / maxDist;
        const fade = 1.0 - (t * t * (3.0 - 2.0 * t));
        
        lineColors.push(
          r1 * fade, g1 * fade, b1 * fade,
          r2 * fade, g2 * fade, b2 * fade
        );
        lineCount++;
      }
    }
  }
  
  return {
    positions: new Float32Array(linePositions),
    colors: new Float32Array(lineColors),
    count: lineCount
  };
}

// 基于 K 近邻的连线计算
function computeKNNLines(
  data: ProcessedData,
  settings: LineSettings
): LineData {
  const { positions, colors, sizes, count } = data;
  const k = settings.kNeighbors;
  const maxLines = settings.maxLines;
  const sampleRatio = settings.sampleRatio;
  
  // 结构感知约束参数
  const colorConstraintEnabled = settings.colorConstraintEnabled || false;
  const colorTolerance = settings.colorTolerance || 0.3;
  const zDepthWeight = settings.zDepthWeight ?? 1.0;
  
  // 粒子大小过滤参数
  const sizeFilterEnabled = settings.sizeFilterEnabled || false;
  const minSizeAbsolute = settings.minSizeAbsolute || 0;
  const minSizeRelative = settings.minSizeRelative || 0;
  const minSizePercentile = settings.minSizePercentile || 0;
  const maxParticleSize = sizeFilterEnabled ? getMaxParticleSize(sizes, count) : 0;
  const percentileThreshold = (sizeFilterEnabled && minSizePercentile > 0) 
    ? getPercentileThreshold(sizes, count, minSizePercentile) 
    : 0;
  
  const sampleStep = Math.max(1, Math.floor(1 / sampleRatio));
  let sampledIndices: number[] = [];
  for (let i = 0; i < count; i += sampleStep) {
    if (sizeFilterEnabled) {
      if (minSizePercentile > 0 && sizes[i] < percentileThreshold) continue;
      if (!isParticleSizeValid(sizes[i], minSizeAbsolute, minSizeRelative, maxParticleSize)) continue;
    }
    sampledIndices.push(i);
  }
  sampledIndices = shuffleArray(sampledIndices);
  
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  let lineCount = 0;
  const addedPairs = new Set<string>();
  
  for (let i = 0; i < sampledIndices.length && lineCount < maxLines; i++) {
    const idx1 = sampledIndices[i];
    const x1 = positions[idx1 * 3];
    const y1 = positions[idx1 * 3 + 1];
    const z1 = positions[idx1 * 3 + 2];
    const r1 = colors[idx1 * 3];
    const g1 = colors[idx1 * 3 + 1];
    const b1 = colors[idx1 * 3 + 2];
    
    // 计算到所有其他点的距离（带 Z 轴权重）
    const distances: { idx: number; dist: number }[] = [];
    for (let j = 0; j < sampledIndices.length; j++) {
      if (i === j) continue;
      const idx2 = sampledIndices[j];
      const x2 = positions[idx2 * 3];
      const y2 = positions[idx2 * 3 + 1];
      const z2 = positions[idx2 * 3 + 2];
      
      // 使用带 Z 轴权重的距离
      const dist = weightedDistance3D(x1, y1, z1, x2, y2, z2, zDepthWeight);
      
      // 如果启用颜色约束，预先过滤颜色差异过大的点
      if (colorConstraintEnabled) {
        const cr2 = colors[idx2 * 3];
        const cg2 = colors[idx2 * 3 + 1];
        const cb2 = colors[idx2 * 3 + 2];
        if (!isColorSimilar(r1, g1, b1, cr2, cg2, cb2, colorTolerance)) {
          continue;
        }
      }
      
      distances.push({ idx: idx2, dist });
    }
    
    // 排序找到最近的 k 个
    distances.sort((a, b) => a.dist - b.dist);
    
    for (let n = 0; n < Math.min(k, distances.length) && lineCount < maxLines; n++) {
      const idx2 = distances[n].idx;
      
      // 避免重复添加
      const pairKey = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`;
      if (addedPairs.has(pairKey)) continue;
      addedPairs.add(pairKey);
      
      const x2 = positions[idx2 * 3];
      const y2 = positions[idx2 * 3 + 1];
      const z2 = positions[idx2 * 3 + 2];
      const r2 = colors[idx2 * 3];
      const g2 = colors[idx2 * 3 + 1];
      const b2 = colors[idx2 * 3 + 2];
      
      linePositions.push(x1, y1, z1, x2, y2, z2);
      
      // 基于距离的透明度曲线（使用最近的 k 个点中的最大距离作为参考）
      const maxDistForFade = distances[Math.min(k - 1, distances.length - 1)]?.dist || 1;
      const t = distances[n].dist / maxDistForFade;
      const fade = 1.0 - (t * t * (3.0 - 2.0 * t)) * 0.5; // 衰减幅度减半
      
      lineColors.push(
        r1 * fade, g1 * fade, b1 * fade,
        r2 * fade, g2 * fade, b2 * fade
      );
      lineCount++;
    }
  }
  
  return {
    positions: new Float32Array(linePositions),
    colors: new Float32Array(lineColors),
    count: lineCount
  };
}

// Delaunay 三角剖分连线计算
function computeDelaunayLines(
  data: ProcessedData,
  settings: LineSettings
): LineData {
  const { positions, colors, sizes, count } = data;
  const ranges = settings.distanceRanges || [{ id: '1', min: 0, max: settings.maxDistance, enabled: true }];
  const maxLines = settings.maxLines;
  const sampleRatio = settings.sampleRatio;
  
  // 结构感知约束参数
  const colorConstraintEnabled = settings.colorConstraintEnabled || false;
  const colorTolerance = settings.colorTolerance || 0.3;
  const zDepthWeight = settings.zDepthWeight ?? 1.0;
  
  // 粒子大小过滤参数
  const sizeFilterEnabled = settings.sizeFilterEnabled || false;
  const minSizeAbsolute = settings.minSizeAbsolute || 0;
  const minSizeRelative = settings.minSizeRelative || 0;
  const minSizePercentile = settings.minSizePercentile || 0;
  const maxParticleSize = sizeFilterEnabled ? getMaxParticleSize(sizes, count) : 0;
  const percentileThreshold = (sizeFilterEnabled && minSizePercentile > 0) 
    ? getPercentileThreshold(sizes, count, minSizePercentile) 
    : 0;
  
  // 获取最大距离用于快速过滤
  const enabledRanges = ranges.filter(r => r.enabled);
  const maxPossibleDist = enabledRanges.length > 0 
    ? Math.max(...enabledRanges.map(r => r.max))
    : settings.maxDistance;
  
  // 采样粒子 - Delaunay 需要较少的点才能快速计算
  const sampleStep = Math.max(1, Math.floor(1 / sampleRatio));
  let sampledIndices: number[] = [];
  for (let i = 0; i < count; i += sampleStep) {
    if (sizeFilterEnabled) {
      if (minSizePercentile > 0 && sizes[i] < percentileThreshold) continue;
      if (!isParticleSizeValid(sizes[i], minSizeAbsolute, minSizeRelative, maxParticleSize)) continue;
    }
    sampledIndices.push(i);
  }
  // 随机打乱后取样，确保空间分布均匀
  sampledIndices = shuffleArray(sampledIndices);
  
  // 限制点数以保证性能
  const maxPoints = Math.min(sampledIndices.length, 3000);
  const finalIndices = sampledIndices.slice(0, maxPoints);
  
  // 创建 2D 点集 (使用 X, Y 坐标进行三角剖分)
  const points2D: Point2D[] = finalIndices.map((idx, i) => ({
    x: positions[idx * 3],
    y: positions[idx * 3 + 1],
    idx: idx
  }));
  
  // 执行 Delaunay 三角剖分
  const triangles = delaunayTriangulation(points2D);
  
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  let lineCount = 0;
  const addedEdges = new Set<string>();
  
  // 从三角形提取边
  for (const t of triangles) {
    if (lineCount >= maxLines) break;
    
    const edges: [number, number][] = [
      [t.p1, t.p2],
      [t.p2, t.p3],
      [t.p3, t.p1]
    ];
    
    for (const [i1, i2] of edges) {
      if (lineCount >= maxLines) break;
      
      // 避免重复边
      const edgeKey = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
      if (addedEdges.has(edgeKey)) continue;
      addedEdges.add(edgeKey);
      
      const idx1 = points2D[i1].idx;
      const idx2 = points2D[i2].idx;
      
      const x1 = positions[idx1 * 3];
      const y1 = positions[idx1 * 3 + 1];
      const z1 = positions[idx1 * 3 + 2];
      const x2 = positions[idx2 * 3];
      const y2 = positions[idx2 * 3 + 1];
      const z2 = positions[idx2 * 3 + 2];
      
      // 使用带 Z 轴权重的 3D 距离过滤
      const dist = weightedDistance3D(x1, y1, z1, x2, y2, z2, zDepthWeight);
      if (dist > maxPossibleDist) continue;
      if (!isDistanceInRanges(dist, ranges)) continue;
      
      const r1 = colors[idx1 * 3];
      const g1 = colors[idx1 * 3 + 1];
      const b1 = colors[idx1 * 3 + 2];
      const r2 = colors[idx2 * 3];
      const g2 = colors[idx2 * 3 + 1];
      const b2 = colors[idx2 * 3 + 2];
      
      // 颜色约束检查
      if (colorConstraintEnabled) {
        if (!isColorSimilar(r1, g1, b1, r2, g2, b2, colorTolerance)) {
          continue;
        }
      }
      
      // 基于距离区间的透明度淡化
      const fade = getDistanceFade(dist, ranges, settings.fadeWithDistance);
      
      linePositions.push(x1, y1, z1, x2, y2, z2);
      lineColors.push(
        r1 * fade, g1 * fade, b1 * fade,
        r2 * fade, g2 * fade, b2 * fade
      );
      lineCount++;
    }
  }
  
  return {
    positions: new Float32Array(linePositions),
    colors: new Float32Array(lineColors),
    count: lineCount
  };
}

// 主计算函数
export function computeLines(
  data: ProcessedData,
  settings: LineSettings
): LineData | null {
  if (!settings.enabled || data.count < 2) {
    return null;
  }
  
  switch (settings.mode) {
    case LineMode.Distance:
      return computeDistanceLines(data, settings);
    case LineMode.Color:
      return computeColorLines(data, settings);
    case LineMode.KNN:
      return computeKNNLines(data, settings);
    case LineMode.Delaunay:
      return computeDelaunayLines(data, settings);
    default:
      return computeDistanceLines(data, settings);
  }
}
