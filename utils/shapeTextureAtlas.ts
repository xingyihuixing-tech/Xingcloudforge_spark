import * as THREE from 'three';

// Canvas形状纹理生成
// 使用Canvas API绘制形状，生成纹理图集
export function createShapeTextureAtlas(): THREE.CanvasTexture {
  const size = 256; // 每个形状的尺寸
  const cols = 4;   // 4列
  const rows = 4;   // 4行 = 16种形状（当前13种）
  const canvas = document.createElement('canvas');
  canvas.width = size * cols;
  canvas.height = size * rows;
  const mainCtx = canvas.getContext('2d')!;
  
  // 清空画布
  mainCtx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 辅助函数：绘制五角星
  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };
  
  // 形状绘制函数（接收ctx参数）
  const shapes: Array<(ctx: CanvasRenderingContext2D, cx: number, cy: number) => void> = [
    // 0: Circle (圆形)
    (ctx, cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.fill();
    },
    // 1: Star (五角星)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      drawStar(ctx, cx, cy, 5, 60, 24);
      ctx.fill();
    },
    // 2: Snowflake (钻石冰星)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.0, 1.0);
      ctx.fillStyle = "white";
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 30);
        ctx.lineTo(0, 50);
        ctx.lineTo(-10, 30);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 55, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    // 3: Heart (爱心)
    (ctx, cx, cy) => {
      const scale = 3.5;
      ctx.save();
      ctx.translate(cx, cy - 15);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-10, -10, -20, 5, 0, 20);
      ctx.bezierCurveTo(20, 5, 10, -10, 0, 0);
      ctx.fill();
      ctx.restore();
    },
    // 4: Crescent (月牙)
    (ctx, cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx + 45, cy - 15, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    },
    // 5: CrossGlow (十字光芒)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(2, 2);
      ctx.fillStyle = "white";
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(0, -50);
        ctx.lineTo(3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(0, -30);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    // 6: Sakura (樱花)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.2, 1.2);
      ctx.fillStyle = "white";
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(20, -30, 0, -48);
        ctx.quadraticCurveTo(-20, -30, 0, -8);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    // 7: Sun (太阳)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const rays = 6;
      const circleRadius = 30;
      const rayStartRadius = 42;
      const rayEndRadius = 65;
      const rayWidth = Math.PI / 8;
      
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle - rayWidth) * rayStartRadius,
          cy + Math.sin(angle - rayWidth) * rayStartRadius
        );
        ctx.lineTo(
          cx + Math.cos(angle) * rayEndRadius,
          cy + Math.sin(angle) * rayEndRadius
        );
        ctx.lineTo(
          cx + Math.cos(angle + rayWidth) * rayStartRadius,
          cy + Math.sin(angle + rayWidth) * rayStartRadius
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
      ctx.fill();
    },
    // 8: Sun2 (太阳2)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const rays = 8;
      const circleRadius = 28;
      const rayEndRadius = 70;
      const rayHalfAngle = Math.PI / rays;
      
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;
        const leftAngle = angle - rayHalfAngle;
        const rightAngle = angle + rayHalfAngle;
        
        const leftX = cx + Math.cos(leftAngle) * circleRadius;
        const leftY = cy + Math.sin(leftAngle) * circleRadius;
        const rightX = cx + Math.cos(rightAngle) * circleRadius;
        const rightY = cy + Math.sin(rightAngle) * circleRadius;
        
        const tipX = cx + Math.cos(angle) * rayEndRadius;
        const tipY = cy + Math.sin(angle) * rayEndRadius;
        
        const sideCtrlRadius = (circleRadius + rayEndRadius) * 0.45;
        const leftCtrlAngle = angle - rayHalfAngle * 0.65;
        const rightCtrlAngle = angle + rayHalfAngle * 0.65;
        const leftCtrlX = cx + Math.cos(leftCtrlAngle) * sideCtrlRadius;
        const leftCtrlY = cy + Math.sin(leftCtrlAngle) * sideCtrlRadius;
        const rightCtrlX = cx + Math.cos(rightCtrlAngle) * sideCtrlRadius;
        const rightCtrlY = cy + Math.sin(rightCtrlAngle) * sideCtrlRadius;
        
        const bottomCtrlRadius = circleRadius + 12;
        const bottomCtrlX = cx + Math.cos(angle) * bottomCtrlRadius;
        const bottomCtrlY = cy + Math.sin(angle) * bottomCtrlRadius;
        
        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.quadraticCurveTo(leftCtrlX, leftCtrlY, tipX, tipY);
        ctx.quadraticCurveTo(rightCtrlX, rightCtrlY, rightX, rightY);
        ctx.quadraticCurveTo(bottomCtrlX, bottomCtrlY, leftX, leftY);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
      ctx.fill();
    },
    // 9: Plum (梅花)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const r = 60;
      
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.arc(0, -r * 0.55, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'white';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 8);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 0.4);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
    // 10: Lily (百合)
    (ctx, cx, cy) => {
      ctx.fillStyle = "white";
      const r = 60;
      
      ctx.save();
      ctx.translate(cx, cy);
      
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 6);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.4, -r * 0.4, 0, -r);
        ctx.quadraticCurveTo(-r * 0.4, -r * 0.4, 0, 0);
        ctx.fill();
        
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.7);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.1, -r * 0.4, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.1, -r * 0.4, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        ctx.restore();
      }
      ctx.restore();
    },
    // 11: Lotus (莲花)
    (ctx, cx, cy) => {
      const r = 60;
      
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grad.addColorStop(0, "rgba(255,255,255, 1)");
      grad.addColorStop(1, "rgba(255,255,255, 0.5)");
      ctx.fillStyle = grad;
      
      ctx.save();
      ctx.translate(cx, cy);
      
      const count = 8;
      for (let i = 0; i < count; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / count);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.4, 0, -r);
        ctx.quadraticCurveTo(-r * 0.6, -r * 0.4, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    // 12: Prism (棱镜晶体)
    (ctx, cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 1.5;
      
      // 缩放因子，使形状适配256x256画布
      const scale = 1.1;
      
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 3);
        
        // 绘制半透明菱形主体
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15 * scale, 30 * scale);
        ctx.lineTo(0, 55 * scale);
        ctx.lineTo(-15 * scale, 30 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 绘制内部折射结构
        ctx.beginPath();
        ctx.moveTo(0, 10 * scale);
        ctx.lineTo(0, 45 * scale);
        ctx.moveTo(-5 * scale, 30 * scale);
        ctx.lineTo(5 * scale, 30 * scale);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.stroke();
        
        ctx.restore();
      }
      ctx.restore();
    },
  ];
  
  // 逐个绘制每个形状到图集（使用离屏canvas确保隔离）
  shapes.forEach((drawFn, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.clearRect(0, 0, size, size);
    offCtx.fillStyle = "white";
    
    drawFn(offCtx, size / 2, size / 2);
    
    mainCtx.drawImage(offscreen, col * size, row * size);
  });
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
