/**
 * 光流路径系统
 * 实现欧拉路径、随机游走、多光包调度和顶点停靠
 */

import * as THREE from 'three';

// ==================== 类型定义 ====================

/** 边 */
export interface Edge {
  id: number;
  v1: number;  // 顶点索引
  v2: number;
  length: number;  // 边长度
  visitCount: number;  // 访问次数
}

/** 顶点 */
export interface Vertex {
  id: number;
  position: THREE.Vector3;
  edges: number[];  // 连接的边索引
  degree: number;   // 度数
}

/** 图结构 */
export interface Graph {
  vertices: Vertex[];
  edges: Edge[];
  adjacency: Map<number, Map<number, number>>;  // v1 -> v2 -> edgeId
}

/** 路径模式 */
export type PathMode = 'edge' | 'euler' | 'random';

/** 欧拉模式 */
export type EulerMode = 'strict' | 'autoAugment' | 'longestTrail';

/** 相位模式 */
export type PhaseMode = 'sync' | 'spread';

/** 光包状态 */
export interface LightPacket {
  id: number;
  pathIndex: number;      // 当前路径中的位置索引
  edgeProgress: number;   // 当前边上的进度 [0,1]
  currentEdge: number;    // 当前边索引
  previousEdge: number;   // 上一条边（用于无回溯）
  path: number[];         // 路径（边索引序列）
  phase: number;          // 初始相位偏移
  speed: number;          // 当前速度
  baseSpeed: number;      // 基础速度
  isDwelling: boolean;    // 是否停靠中
  dwellTimer: number;     // 停靠计时器
  dwellCooldown: number;  // 停靠冷却
  lastVertex: number;     // 上一个经过的顶点
}

/** 路径系统配置 */
export interface PathSystemConfig {
  pathMode: PathMode;
  eulerMode: EulerMode;
  phaseMode: PhaseMode;
  count: number;
  speed: number;
  // 随机游走参数
  noBacktrack: boolean;
  coverageWeight: number;   // 未访问边权重
  angleWeight: number;      // 转角代价权重
  // 停靠参数
  dwellEnabled: boolean;
  dwellThreshold: number;   // 度数阈值
  dwellDuration: number;    // 停靠时长
  dwellCooldown: number;    // 冷却时间
  dwellPulseIntensity: number;
  // 拥堵避免
  minPacketSpacing: number; // 最小间距
}

// ==================== 图构建 ====================

/**
 * 从 EdgesGeometry 构建图结构
 */
export function buildGraphFromEdgesGeometry(
  edgesGeometry: THREE.BufferGeometry
): Graph {
  const positions = edgesGeometry.attributes.position.array;
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const adjacency = new Map<number, Map<number, number>>();
  
  // 顶点去重映射
  const vertexMap = new Map<string, number>();
  const toKey = (x: number, y: number, z: number) => 
    `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
  
  const getOrCreateVertex = (x: number, y: number, z: number): number => {
    const key = toKey(x, y, z);
    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }
    const id = vertices.length;
    vertices.push({
      id,
      position: new THREE.Vector3(x, y, z),
      edges: [],
      degree: 0
    });
    vertexMap.set(key, id);
    adjacency.set(id, new Map());
    return id;
  };
  
  // 遍历边
  for (let i = 0; i < positions.length; i += 6) {
    const v1 = getOrCreateVertex(positions[i], positions[i + 1], positions[i + 2]);
    const v2 = getOrCreateVertex(positions[i + 3], positions[i + 4], positions[i + 5]);
    
    // 避免重复边
    if (adjacency.get(v1)?.has(v2)) continue;
    
    const edgeId = edges.length;
    const length = vertices[v1].position.distanceTo(vertices[v2].position);
    
    edges.push({
      id: edgeId,
      v1,
      v2,
      length,
      visitCount: 0
    });
    
    // 更新邻接表
    adjacency.get(v1)!.set(v2, edgeId);
    adjacency.get(v2)!.set(v1, edgeId);
    
    // 更新顶点
    vertices[v1].edges.push(edgeId);
    vertices[v2].edges.push(edgeId);
    vertices[v1].degree++;
    vertices[v2].degree++;
  }
  
  return { vertices, edges, adjacency };
}

// ==================== 欧拉路径 ====================

/**
 * 查找奇度数顶点
 */
function findOddDegreeVertices(graph: Graph): number[] {
  return graph.vertices
    .filter(v => v.degree % 2 === 1)
    .map(v => v.id);
}

/**
 * Hierholzer 算法生成欧拉路径
 */
function hierholzer(
  graph: Graph, 
  startVertex: number,
  usedEdges: Set<number>
): number[] {
  const path: number[] = [];
  const stack: number[] = [startVertex];
  const tempPath: number[] = [];
  
  // 复制邻接表用于遍历
  const remaining = new Map<number, Set<number>>();
  graph.vertices.forEach(v => {
    remaining.set(v.id, new Set(v.edges.filter(e => !usedEdges.has(e))));
  });
  
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const edges = remaining.get(current)!;
    
    if (edges.size > 0) {
      // 取一条未使用的边
      const edgeId = edges.values().next().value;
      const edge = graph.edges[edgeId];
      const next = edge.v1 === current ? edge.v2 : edge.v1;
      
      // 标记边为已使用
      edges.delete(edgeId);
      remaining.get(next)!.delete(edgeId);
      
      stack.push(next);
      tempPath.push(edgeId);
    } else {
      stack.pop();
      if (tempPath.length > 0) {
        path.unshift(tempPath.pop()!);
      }
    }
  }
  
  return path;
}

/**
 * 最短路径（用于连接奇度数顶点）- Dijkstra
 */
function shortestPath(graph: Graph, start: number, end: number): number[] {
  const dist = new Map<number, number>();
  const prev = new Map<number, { vertex: number; edge: number }>();
  const visited = new Set<number>();
  
  graph.vertices.forEach(v => dist.set(v.id, Infinity));
  dist.set(start, 0);
  
  while (true) {
    // 找最小距离未访问顶点
    let minDist = Infinity;
    let current = -1;
    dist.forEach((d, v) => {
      if (!visited.has(v) && d < minDist) {
        minDist = d;
        current = v;
      }
    });
    
    if (current === -1 || current === end) break;
    visited.add(current);
    
    // 更新邻居
    graph.adjacency.get(current)?.forEach((edgeId, neighbor) => {
      if (visited.has(neighbor)) return;
      const edge = graph.edges[edgeId];
      const newDist = dist.get(current)! + edge.length;
      if (newDist < dist.get(neighbor)!) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, { vertex: current, edge: edgeId });
      }
    });
  }
  
  // 回溯路径
  const path: number[] = [];
  let cur = end;
  while (prev.has(cur)) {
    const p = prev.get(cur)!;
    path.unshift(p.edge);
    cur = p.vertex;
  }
  
  return path;
}

/**
 * 生成欧拉路径
 */
export function generateEulerPath(
  graph: Graph,
  mode: EulerMode = 'autoAugment'
): number[] {
  if (graph.edges.length === 0) return [];
  
  const oddVertices = findOddDegreeVertices(graph);
  
  // 严格模式：必须是欧拉图
  if (mode === 'strict' && oddVertices.length > 2) {
    console.warn('Graph is not Eulerian, falling back to longestTrail');
    mode = 'longestTrail';
  }
  
  // 自动补边模式（Chinese Postman）
  if (mode === 'autoAugment' && oddVertices.length > 2) {
    // 将奇度数顶点配对并用最短路径连接
    // 简化实现：贪心配对最近的奇度数顶点
    const augmentedEdges: number[] = [];
    const pairedSet = new Set<number>();
    
    for (let i = 0; i < oddVertices.length; i++) {
      if (pairedSet.has(oddVertices[i])) continue;
      
      let minDist = Infinity;
      let bestPair = -1;
      let bestPath: number[] = [];
      
      for (let j = i + 1; j < oddVertices.length; j++) {
        if (pairedSet.has(oddVertices[j])) continue;
        
        const path = shortestPath(graph, oddVertices[i], oddVertices[j]);
        const dist = path.reduce((sum, e) => sum + graph.edges[e].length, 0);
        
        if (dist < minDist) {
          minDist = dist;
          bestPair = j;
          bestPath = path;
        }
      }
      
      if (bestPair !== -1) {
        pairedSet.add(oddVertices[i]);
        pairedSet.add(oddVertices[bestPair]);
        augmentedEdges.push(...bestPath);
      }
    }
    
    // 在补边后运行 Hierholzer
    // 这里简化：直接将补边加入路径
    const mainPath = hierholzer(graph, graph.vertices[0].id, new Set());
    return [...mainPath, ...augmentedEdges];
  }
  
  // 最长轨迹模式
  if (mode === 'longestTrail') {
    // 从度数最高的顶点开始
    const startVertex = graph.vertices.reduce((best, v) => 
      v.degree > best.degree ? v : best
    ).id;
    return hierholzer(graph, startVertex, new Set());
  }
  
  // 标准欧拉路径
  const startVertex = oddVertices.length > 0 ? oddVertices[0] : 0;
  return hierholzer(graph, startVertex, new Set());
}

// ==================== 随机游走 ====================

/**
 * 计算边的方向向量
 */
function getEdgeDirection(graph: Graph, edge: Edge, fromVertex: number): THREE.Vector3 {
  const v1 = graph.vertices[edge.v1].position;
  const v2 = graph.vertices[edge.v2].position;
  return edge.v1 === fromVertex 
    ? v2.clone().sub(v1).normalize()
    : v1.clone().sub(v2).normalize();
}

/**
 * 随机游走选择下一条边
 */
function selectNextEdge(
  graph: Graph,
  currentVertex: number,
  previousEdge: number,
  config: PathSystemConfig
): number {
  const vertex = graph.vertices[currentVertex];
  const candidates: { edge: number; weight: number }[] = [];
  
  // 获取上一条边的方向（如果有）
  let prevDir: THREE.Vector3 | null = null;
  if (previousEdge >= 0) {
    prevDir = getEdgeDirection(graph, graph.edges[previousEdge], currentVertex);
  }
  
  for (const edgeId of vertex.edges) {
    // 无回溯：跳过上一条边
    if (config.noBacktrack && edgeId === previousEdge) continue;
    
    const edge = graph.edges[edgeId];
    let weight = 1.0;
    
    // 覆盖权重：未访问/少访问的边权重更高
    const visitPenalty = Math.max(0.1, 1 - edge.visitCount * 0.2);
    weight *= 1 + config.coverageWeight * (visitPenalty - 0.5) * 2;
    
    // 转角代价：优先小转角
    if (prevDir && config.angleWeight > 0) {
      const nextDir = getEdgeDirection(graph, edge, currentVertex);
      const dot = prevDir.dot(nextDir);  // -1 到 1
      const angleFactor = (dot + 1) / 2;  // 0 到 1，1 表示同向
      weight *= 1 + config.angleWeight * (angleFactor - 0.5) * 2;
    }
    
    candidates.push({ edge: edgeId, weight: Math.max(0.01, weight) });
  }
  
  if (candidates.length === 0) {
    // 没有候选，允许回溯
    return vertex.edges[Math.floor(Math.random() * vertex.edges.length)];
  }
  
  // 加权随机选择
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c.edge;
  }
  
  return candidates[candidates.length - 1].edge;
}

/**
 * 生成随机游走路径（固定长度）
 */
export function generateRandomWalkPath(
  graph: Graph,
  startVertex: number,
  pathLength: number,
  config: PathSystemConfig
): number[] {
  if (graph.edges.length === 0) return [];
  
  const path: number[] = [];
  let currentVertex = startVertex;
  let previousEdge = -1;
  
  for (let i = 0; i < pathLength; i++) {
    const nextEdge = selectNextEdge(graph, currentVertex, previousEdge, config);
    path.push(nextEdge);
    
    // 更新访问计数
    graph.edges[nextEdge].visitCount++;
    
    // 移动到下一个顶点
    const edge = graph.edges[nextEdge];
    currentVertex = edge.v1 === currentVertex ? edge.v2 : edge.v1;
    previousEdge = nextEdge;
  }
  
  return path;
}

// ==================== 多光包调度器 ====================

/**
 * 创建光包
 */
export function createLightPackets(
  graph: Graph,
  config: PathSystemConfig
): LightPacket[] {
  const packets: LightPacket[] = [];
  
  // 生成主路径（用于 euler 模式）
  let mainPath: number[] = [];
  if (config.pathMode === 'euler') {
    mainPath = generateEulerPath(graph, config.eulerMode as EulerMode);
    if (mainPath.length === 0) {
      // 回退到 edge 模式
      mainPath = graph.edges.map(e => e.id);
    }
  }
  
  for (let i = 0; i < config.count; i++) {
    let path: number[];
    let phase: number;
    
    if (config.pathMode === 'euler') {
      // 欧拉模式：所有光包共享路径
      path = [...mainPath];
      phase = config.phaseMode === 'spread' 
        ? i / config.count 
        : 0;
    } else if (config.pathMode === 'random') {
      // 随机模式：每个光包独立路径
      const startVertex = Math.floor(Math.random() * graph.vertices.length);
      const pathLength = Math.max(graph.edges.length, 50);
      path = generateRandomWalkPath(graph, startVertex, pathLength, config);
      phase = config.phaseMode === 'spread' 
        ? i / config.count 
        : 0;
    } else {
      // edge 模式：按边独立
      path = graph.edges.map(e => e.id);
      phase = config.phaseMode === 'spread' 
        ? i / config.count 
        : 0;
    }
    
    packets.push({
      id: i,
      pathIndex: Math.floor(path.length * phase) % Math.max(1, path.length),
      edgeProgress: 0,
      currentEdge: path.length > 0 ? path[Math.floor(path.length * phase) % path.length] : 0,
      previousEdge: -1,
      path,
      phase,
      speed: config.speed,
      baseSpeed: config.speed,
      isDwelling: false,
      dwellTimer: 0,
      dwellCooldown: 0,
      lastVertex: -1
    });
  }
  
  return packets;
}

/**
 * 更新光包状态
 */
export function updateLightPackets(
  packets: LightPacket[],
  graph: Graph,
  config: PathSystemConfig,
  deltaTime: number
): void {
  for (const packet of packets) {
    // 更新冷却
    if (packet.dwellCooldown > 0) {
      packet.dwellCooldown -= deltaTime;
    }
    
    // 停靠状态
    if (packet.isDwelling) {
      packet.dwellTimer -= deltaTime;
      if (packet.dwellTimer <= 0) {
        packet.isDwelling = false;
        packet.dwellCooldown = config.dwellCooldown;
      }
      continue;
    }
    
    // 拥堵避免：检查与其他光包的间距
    let shouldSlow = false;
    for (const other of packets) {
      if (other.id === packet.id) continue;
      if (other.currentEdge !== packet.currentEdge) continue;
      
      const distance = Math.abs(other.edgeProgress - packet.edgeProgress);
      if (distance < config.minPacketSpacing && other.edgeProgress > packet.edgeProgress) {
        shouldSlow = true;
        break;
      }
    }
    
    packet.speed = shouldSlow ? packet.baseSpeed * 0.3 : packet.baseSpeed;
    
    // 移动
    if (packet.path.length === 0) continue;
    
    const currentEdge = graph.edges[packet.currentEdge];
    // 速度计算：使 speed=1 时，每秒完成一条边（与传统模式保持一致）
    // 边长度归一化：较长的边需要更多时间
    const normalizedLength = Math.max(1, currentEdge.length / 100);
    const progressDelta = (packet.speed * deltaTime) / normalizedLength;
    packet.edgeProgress += progressDelta;
    
    // 到达边的终点
    while (packet.edgeProgress >= 1) {
      packet.edgeProgress -= 1;
      packet.pathIndex = (packet.pathIndex + 1) % packet.path.length;
      packet.previousEdge = packet.currentEdge;
      packet.currentEdge = packet.path[packet.pathIndex];
      
      // 确定到达的顶点
      const prevEdge = graph.edges[packet.previousEdge];
      const currEdge = graph.edges[packet.currentEdge];
      
      // 找公共顶点
      let arrivedVertex = -1;
      if (prevEdge.v1 === currEdge.v1 || prevEdge.v1 === currEdge.v2) {
        arrivedVertex = prevEdge.v1;
      } else if (prevEdge.v2 === currEdge.v1 || prevEdge.v2 === currEdge.v2) {
        arrivedVertex = prevEdge.v2;
      }
      
      // 顶点停靠检测
      if (config.dwellEnabled && 
          arrivedVertex >= 0 && 
          arrivedVertex !== packet.lastVertex &&
          packet.dwellCooldown <= 0) {
        const vertex = graph.vertices[arrivedVertex];
        if (vertex.degree >= config.dwellThreshold) {
          packet.isDwelling = true;
          packet.dwellTimer = config.dwellDuration;
          packet.lastVertex = arrivedVertex;
          packet.edgeProgress = 0;
          break;
        }
      }
      
      packet.lastVertex = arrivedVertex;
    }
  }
}

/**
 * 获取光包在世界空间的位置
 */
export function getPacketWorldPosition(
  packet: LightPacket,
  graph: Graph
): THREE.Vector3 {
  if (graph.edges.length === 0) return new THREE.Vector3();
  
  const edge = graph.edges[packet.currentEdge];
  const v1 = graph.vertices[edge.v1].position;
  const v2 = graph.vertices[edge.v2].position;
  
  return v1.clone().lerp(v2, packet.edgeProgress);
}

/**
 * 获取每条边上的光包信息（用于着色器）
 */
export function getEdgeLightData(
  packets: LightPacket[],
  edgeCount: number
): Float32Array {
  // 每条边存储最多 4 个光包的进度
  const data = new Float32Array(edgeCount * 4);
  data.fill(-1);  // -1 表示无光包
  
  const edgePacketCounts = new Map<number, number>();
  
  for (const packet of packets) {
    const edgeId = packet.currentEdge;
    const slot = edgePacketCounts.get(edgeId) || 0;
    
    if (slot < 4) {
      data[edgeId * 4 + slot] = packet.edgeProgress;
      edgePacketCounts.set(edgeId, slot + 1);
    }
  }
  
  return data;
}

/**
 * 获取停靠顶点信息（用于脉冲效果）
 */
export function getDwellingVertices(
  packets: LightPacket[],
  graph: Graph
): { vertexId: number; intensity: number }[] {
  const dwelling: { vertexId: number; intensity: number }[] = [];
  
  for (const packet of packets) {
    if (packet.isDwelling && packet.lastVertex >= 0) {
      const progress = 1 - packet.dwellTimer / 0.5;  // 假设 0.5s 停靠时长
      const intensity = Math.sin(progress * Math.PI);  // 脉冲曲线
      dwelling.push({ vertexId: packet.lastVertex, intensity });
    }
  }
  
  return dwelling;
}
