import React, { useEffect, useRef, useState } from 'react';
import { HandData, SingleHandData } from '../types';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

interface GestureHandlerProps {
  handDataRef: React.MutableRefObject<HandData>;
  enabled: boolean;
  showVideo?: boolean; // 是否显示摄像头小窗，默认 true
  showDebug?: boolean; // 是否显示调试信息小窗
}

// Configuration for gesture stability
const GESTURE_CONFIG = {
  STABILITY_FRAMES: 3,
  FIST_THRESHOLD: 1.1,
  MIN_CLOSED_FINGERS: 3,
  NO_HAND_FRAMES: 5,
  POSITION_SMOOTHING: 0.3,
  OPENNESS_SMOOTHING: 0.2,
  // 食指伸出检测阈值
  INDEX_POINTING_THRESHOLD: 1.4,
  // 刀状手势检测阈值
  KNIFE_HAND_THRESHOLD: 1.2,
  // 速度计算的平滑因子
  VELOCITY_SMOOTHING: 0.5,
};

// 单手状态跟踪
interface HandState {
  closedFrameCount: number;
  openFrameCount: number;
  noHandFrameCount: number;
  confirmedClosed: boolean;
  smoothedPos: { x: number; y: number };
  smoothedOpenness: number;
  lastPos: { x: number; y: number };
  velocity: { x: number; y: number };
}

const createDefaultHandState = (): HandState => ({
  closedFrameCount: 0,
  openFrameCount: 0,
  noHandFrameCount: 0,
  confirmedClosed: false,
  smoothedPos: { x: 0, y: 0 },
  smoothedOpenness: 0,
  lastPos: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
});

const createDefaultSingleHandData = (): SingleHandData => ({
  isActive: false,
  x: 0,
  y: 0,
  z: 0,
  isClosed: false,
  openness: 0,
  isIndexPointing: false,
  isKnifeHand: false,
  velocity: { x: 0, y: 0 },
});

const GestureHandler: React.FC<GestureHandlerProps> = ({ handDataRef, enabled, showVideo = true, showDebug = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugVisible, setDebugVisible] = useState(showDebug);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const lastVideoTimeRef = useRef(-1);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // 当手势交互关闭时，重置 handDataRef 到默认值
  useEffect(() => {
    if (!enabled) {
      handDataRef.current = {
        isActive: false,
        x: 0,
        y: 0,
        z: 0,
        isPinching: false,
        isClosed: false,
        openness: 0,
        twoHandsActive: false,
        twoHandsDistance: 0,
        leftHand: undefined,
        rightHand: undefined
      };
    }
  }, [enabled, handDataRef]);

  // 双手状态跟踪
  const leftHandStateRef = useRef<HandState>(createDefaultHandState());
  const rightHandStateRef = useRef<HandState>(createDefaultHandState());
  
  // 兼容旧逻辑的单手状态
  const closedFrameCountRef = useRef(0);
  const openFrameCountRef = useRef(0);
  const noHandFrameCountRef = useRef(0);
  const confirmedClosedRef = useRef(false);
  const smoothedPosRef = useRef({ x: 0, y: 0 });
  const smoothedOpennessRef = useRef(0);

  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2, // 支持双手检测
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
        handLandmarkerRef.current = handLandmarker;
        setIsLoaded(true);
      } catch (err) {
        console.error(err);
        setError("无法加载 MediaPipe");
      }
    };
    if (enabled) init();
  }, [enabled]);

  useEffect(() => {
    if (!isLoaded || !enabled) return;

    const enableCam = async () => {
        // 检查是否在安全上下文中（HTTPS或localhost）
        if (!window.isSecureContext) {
            setError("需要HTTPS或localhost");
            console.warn('摄像头API需要安全上下文（HTTPS或localhost）');
            return;
        }
        
        if (!navigator.mediaDevices) {
            setError("浏览器不支持mediaDevices");
            console.warn('navigator.mediaDevices 不可用');
            return;
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            setError("浏览器不支持getUserMedia");
            console.warn('getUserMedia 不可用');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
            }
        } catch (err: any) {
            console.error('摄像头访问错误:', err);
            if (err.name === 'NotAllowedError') {
                setError("摄像头权限被拒绝");
            } else if (err.name === 'NotFoundError') {
                setError("未找到摄像头设备");
            } else if (err.name === 'NotReadableError') {
                setError("摄像头被占用");
            } else {
                setError(`摄像头错误: ${err.name}`);
            }
        }
    };

    enableCam();

    return () => {
        // Cleanup
        if (videoRef.current && videoRef.current.srcObject) {
             const stream = videoRef.current.srcObject as MediaStream;
             stream.getTracks().forEach(track => track.stop());
        }
        cancelAnimationFrame(requestRef.current);
    };
  }, [isLoaded, enabled]);


  // 处理单手数据
  const processHandLandmarks = (
    landmarks: any[], 
    handedness: string,
    stateRef: React.MutableRefObject<HandState>
  ): SingleHandData => {
    const state = stateRef.current;
    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
    const mcps = [5, 9, 13, 17]; // Corresponding MCP joints
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    let totalOpenness = 0;
    let fingersClosedCount = 0;
    const fingerExtensions: number[] = [];
    
    for (let i = 0; i < 4; i++) {
      const tip = landmarks[tips[i]];
      const mcp = landmarks[mcps[i]];
      const tipDist = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
      const mcpDist = Math.sqrt(Math.pow(mcp.x - wrist.x, 2) + Math.pow(mcp.y - wrist.y, 2));
      const fingerExtension = tipDist / mcpDist;
      fingerExtensions.push(fingerExtension);
      const fingerOpenness = Math.max(0, Math.min(1, (fingerExtension - 0.8) / 0.7));
      totalOpenness += fingerOpenness;
      if (tipDist < mcpDist * GESTURE_CONFIG.FIST_THRESHOLD) {
        fingersClosedCount++;
      }
    }
    
    const rawOpenness = totalOpenness / 4;
    state.smoothedOpenness += (rawOpenness - state.smoothedOpenness) * GESTURE_CONFIG.OPENNESS_SMOOTHING;
    
    // 握拳检测
    const rawIsClosed = fingersClosedCount >= GESTURE_CONFIG.MIN_CLOSED_FINGERS;
    if (rawIsClosed) {
      state.closedFrameCount++;
      state.openFrameCount = 0;
      if (state.closedFrameCount >= GESTURE_CONFIG.STABILITY_FRAMES) {
        state.confirmedClosed = true;
      }
    } else {
      state.openFrameCount++;
      state.closedFrameCount = 0;
      if (state.openFrameCount >= GESTURE_CONFIG.STABILITY_FRAMES) {
        state.confirmedClosed = false;
      }
    }
    
    // 食指伸出检测（写字姿势）：食指伸出，其他手指闭合
    const indexExtended = fingerExtensions[0] > GESTURE_CONFIG.INDEX_POINTING_THRESHOLD;
    const othersClosed = fingerExtensions[1] < 1.0 && fingerExtensions[2] < 1.0 && fingerExtensions[3] < 1.0;
    const isIndexPointing = indexExtended && othersClosed;
    
    // 刀状手势检测：所有手指伸直并拢
    const allExtended = fingerExtensions.every(e => e > GESTURE_CONFIG.KNIFE_HAND_THRESHOLD);
    const isKnifeHand = allExtended && rawOpenness > 0.7;
    
    // 位置平滑
    const palmX = landmarks[9].x;
    const palmY = landmarks[9].y;
    const rawNdcX = -(palmX * 2 - 1);
    const rawNdcY = -(palmY * 2 - 1);
    state.smoothedPos.x += (rawNdcX - state.smoothedPos.x) * GESTURE_CONFIG.POSITION_SMOOTHING;
    state.smoothedPos.y += (rawNdcY - state.smoothedPos.y) * GESTURE_CONFIG.POSITION_SMOOTHING;
    
    // 速度计算
    const velocityX = (state.smoothedPos.x - state.lastPos.x) * 60; // 假设60fps
    const velocityY = (state.smoothedPos.y - state.lastPos.y) * 60;
    state.velocity.x += (velocityX - state.velocity.x) * GESTURE_CONFIG.VELOCITY_SMOOTHING;
    state.velocity.y += (velocityY - state.velocity.y) * GESTURE_CONFIG.VELOCITY_SMOOTHING;
    state.lastPos.x = state.smoothedPos.x;
    state.lastPos.y = state.smoothedPos.y;
    
    state.noHandFrameCount = 0;
    
    return {
      isActive: true,
      x: state.smoothedPos.x,
      y: state.smoothedPos.y,
      z: landmarks[9].z,
      isClosed: state.confirmedClosed,
      openness: state.smoothedOpenness,
      isIndexPointing,
      isKnifeHand,
      velocity: { x: state.velocity.x, y: state.velocity.y }
    };
  };
  
  // 重置手部状态
  const resetHandState = (stateRef: React.MutableRefObject<HandState>) => {
    const state = stateRef.current;
    state.noHandFrameCount++;
    if (state.noHandFrameCount >= GESTURE_CONFIG.NO_HAND_FRAMES) {
      state.confirmedClosed = false;
      state.closedFrameCount = 0;
      state.openFrameCount = 0;
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;
    
    let startTimeMs = performance.now();
    
    if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
      lastVideoTimeRef.current = videoRef.current.currentTime;
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      let leftHandData: SingleHandData = createDefaultSingleHandData();
      let rightHandData: SingleHandData = createDefaultSingleHandData();
      let primaryHandData: SingleHandData | null = null;
      
      if (results.landmarks && results.landmarks.length > 0) {
        // 处理检测到的每只手
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const handedness = results.handednesses?.[i]?.[0]?.categoryName || 'Right';
          
          if (handedness === 'Left') {
            // 注意：摄像头镜像，所以Left实际是右手
            rightHandData = processHandLandmarks(landmarks, handedness, rightHandStateRef);
            if (!primaryHandData) primaryHandData = rightHandData;
          } else {
            leftHandData = processHandLandmarks(landmarks, handedness, leftHandStateRef);
            if (!primaryHandData) primaryHandData = leftHandData;
          }
        }
        
        // 重置未检测到的手
        if (!rightHandData.isActive) resetHandState(rightHandStateRef);
        if (!leftHandData.isActive) resetHandState(leftHandStateRef);
        
        noHandFrameCountRef.current = 0;
      } else {
        // 没有检测到任何手
        resetHandState(leftHandStateRef);
        resetHandState(rightHandStateRef);
        noHandFrameCountRef.current++;
      }
      
      // 计算双手距离
      let twoHandsDistance = 0;
      const twoHandsActive = leftHandData.isActive && rightHandData.isActive;
      if (twoHandsActive) {
        const dx = leftHandData.x - rightHandData.x;
        const dy = leftHandData.y - rightHandData.y;
        twoHandsDistance = Math.sqrt(dx * dx + dy * dy);
      }
      
      // 兼容旧接口：使用主手数据
      const primary = primaryHandData || leftHandData;
      
      // 同步旧的状态变量（保持星云模式兼容）
      if (primary.isActive) {
        smoothedPosRef.current.x = primary.x;
        smoothedPosRef.current.y = primary.y;
        smoothedOpennessRef.current = primary.openness;
        confirmedClosedRef.current = primary.isClosed;
      }
      
      handDataRef.current = {
        isActive: primary.isActive,
        x: primary.x,
        y: primary.y,
        z: primary.z,
        isPinching: false,
        isClosed: primary.isClosed,
        openness: primary.openness,
        leftHand: leftHandData,
        rightHand: rightHandData,
        twoHandsActive,
        twoHandsDistance
      };
      
      if (noHandFrameCountRef.current >= GESTURE_CONFIG.NO_HAND_FRAMES) {
        handDataRef.current.isActive = false;
      }
      
      // 更新调试信息
      const debugLines = [
        `激活: ${primary.isActive ? '✓' : '✗'}`,
        `位置: (${primary.x.toFixed(2)}, ${primary.y.toFixed(2)})`,
        `握拳: ${primary.isClosed ? '✓' : '✗'}`,
        `张开度: ${(primary.openness * 100).toFixed(0)}%`,
        `食指: ${leftHandData.isIndexPointing || rightHandData.isIndexPointing ? '✓' : '✗'}`,
        `刀状: ${leftHandData.isKnifeHand || rightHandData.isKnifeHand ? '✓' : '✗'}`,
        `双手: ${twoHandsActive ? '✓' : '✗'}`,
        `距离: ${twoHandsDistance.toFixed(2)}`
      ];
      setDebugInfo(debugLines.join('\n'));
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  if (!enabled) return null;

  // 调试小窗组件
  const DebugPanel = () => (
    <div 
      className={`absolute top-4 left-4 z-50 transition-all duration-300 ${debugVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ fontFamily: 'monospace' }}
    >
      <div className="bg-black/80 border border-cyan-500/50 rounded-lg p-3 text-xs text-cyan-400 shadow-lg backdrop-blur-sm min-w-[160px]">
        <div className="flex justify-between items-center mb-2 border-b border-cyan-500/30 pb-1">
          <span className="font-bold text-cyan-300">🖐️ 手势调试</span>
          <button 
            onClick={() => setDebugVisible(false)}
            className="text-cyan-500 hover:text-white transition-colors pointer-events-auto"
          >
            ✕
          </button>
        </div>
        <pre className="whitespace-pre-wrap leading-relaxed">{debugInfo || '等待手势...'}</pre>
        {error && <div className="text-red-400 mt-2 text-xs">{error}</div>}
      </div>
    </div>
  );

  // 显示/隐藏按钮
  const ToggleButton = () => (
    <button
      onClick={() => setDebugVisible(!debugVisible)}
      className="absolute top-4 left-4 z-50 bg-black/60 hover:bg-black/80 border border-cyan-500/50 text-cyan-400 rounded-full w-8 h-8 flex items-center justify-center text-sm transition-all duration-200 pointer-events-auto"
      title="显示/隐藏手势调试"
      style={{ display: debugVisible ? 'none' : 'flex' }}
    >
      🖐️
    </button>
  );

  // 如果不显示视频，只渲染隐藏的 video 元素用于手势检测
  if (!showVideo) {
    return (
      <>
        <video 
          ref={videoRef} 
          className="hidden" 
          autoPlay 
          muted 
          playsInline 
        />
        <ToggleButton />
        <DebugPanel />
      </>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
      <div className="relative border border-white/20 rounded overflow-hidden shadow-lg w-32 h-24 bg-black">
        <video 
            ref={videoRef} 
            className="w-full h-full object-cover opacity-50 transform scale-x-[-1]" 
            autoPlay 
            muted 
            playsInline 
        />
        {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xs text-center p-1 bg-black/80">{error}</div>}
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>
      <p className="text-xs text-white/50 mt-1 ml-1 font-mono">手势追踪已激活</p>
      <ToggleButton />
      <DebugPanel />
    </div>
  );
};

export default GestureHandler;