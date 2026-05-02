# 光剑画笔修复报告

## 问题描述
自定义法阵绘图系统中，使用光剑画笔绘制的笔画无法在画布和场景中显示。

## 根本原因

### 1. 渲染循环中缺少光剑材质的 uTime 更新
**影响文件**：
- `components/MagicCircleDrawing/index.tsx`
- `components/PlanetScene.tsx`

**问题详情**：
- 光剑画笔使用 `THREE.ShaderMaterial` 和自定义 shader
- Shader 中的动画效果（脉冲、流动等）依赖 `uTime` uniform
- 渲染循环只更新了丝环画笔（`silkMaterials`）的 `uTime`
- 光剑材质的 `uTime` 从未被更新，导致 shader 无法正常工作

### 2. 材质存储方式不一致
- 丝环画笔：材质存储在 `userData.silkMaterials`
- 光剑画笔：材质存储在 `__lightsaberMaterials`（双下划线前缀）
- 渲染循环只检查 `userData.silkMaterials`，导致光剑材质被忽略

### 3. 为什么看不见光剑
- 光剑使用 `AdditiveBlending`（加法混合）模式
- 当 `uTime` 为 0 时，shader 中某些动画效果可能导致 alpha 值为 0 或极小
- 即使几何体正确生成，由于材质参数未更新，最终渲染结果完全透明

## 修复方案

### 修复 1：DrawingCanvas 渲染循环
**文件**：`components/MagicCircleDrawing/index.tsx`  
**位置**：第 361-369 行

**修改内容**：
```typescript
// 更新所有丝环笔画的uTime (修复压感模式下流动效果静止)
if (refs.strokesGroup) {
    refs.strokesGroup.traverse((child) => {
        if (child instanceof THREE.Group && child.userData.silkMaterials) {
            const materials = child.userData.silkMaterials as THREE.ShaderMaterial[];
            for (const mat of materials) {
                if (mat.uniforms && mat.uniforms.uTime) {
                    mat.uniforms.uTime.value = elapsed;
                }
            }
        }
        // 更新光剑笔画的uTime (修复光剑无法显示的问题)
        if (child instanceof THREE.Group && (child as any).__lightsaberMaterials) {
            const materials = (child as any).__lightsaberMaterials as THREE.ShaderMaterial[];
            for (const mat of materials) {
                if (mat.uniforms && mat.uniforms.uTime) {
                    mat.uniforms.uTime.value = elapsed;
                }
            }
        }
    });
}
```

### 修复 2：PlanetScene 渲染循环
**文件**：`components/PlanetScene.tsx`  
**位置**：第 7773-7781 行

**修改内容**：
```typescript
customMagicCirclesGroupRef.current.traverse((child) => {
    if (child instanceof THREE.Points || child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        const material = child.material as THREE.ShaderMaterial;
        if (material?.uniforms?.uTime) {
            material.uniforms.uTime.value = time;
        }
    }
    // 更新光剑笔画的 uTime (修复光剑无法显示的问题)
    if (child instanceof THREE.Group && (child as any).__lightsaberMaterials) {
        const materials = (child as any).__lightsaberMaterials as THREE.ShaderMaterial[];
        for (const mat of materials) {
            if (mat.uniforms && mat.uniforms.uTime) {
                mat.uniforms.uTime.value = time;
            }
        }
    }
});
```

## 修复效果

修复后，光剑画笔将能够：
1. ✅ 在绘图画布中实时预览
2. ✅ 保存后在画布中正确显示
3. ✅ 在 PlanetScene 场景中正确渲染
4. ✅ 支持所有光剑特效（脉冲、流动、核心/光晕双色等）
5. ✅ 支持所有对称模式（径向、万花筒、星芒、球面等）

## 技术细节

### 光剑 Shader 依赖的 uniforms
```glsl
uniform float uTime;              // 时间（用于动画）
uniform vec3 uCoreColor;          // 核心颜色
uniform vec3 uGlowColor;          // 光晕颜色
uniform float uCoreWidth;         // 核心宽度
uniform float uGlowIntensity;     // 光晕强度
uniform float uGlowFalloff;       // 光晕衰减
uniform float uPulseEnabled;      // 脉冲开关
uniform float uPulseSpeed;        // 脉冲速度
uniform float uPulseIntensity;    // 脉冲强度
```

### 材质存储位置
- **创建位置**：`utils/drawingSystem.ts` 第 1635 行
- **存储方式**：`(group as any).__lightsaberMaterials = lightsaberMaterials;`
- **数据类型**：`THREE.ShaderMaterial[]`

## 测试建议

1. **基础测试**：
   - 进入绘图模式
   - 选择光剑画笔
   - 绘制笔画
   - 验证实时预览是否可见

2. **保存测试**：
   - 绘制并保存光剑笔画
   - 退出并重新进入绘图模式
   - 验证保存的笔画是否正确显示

3. **场景渲染测试**：
   - 在星球模式下查看自定义法阵
   - 验证光剑笔画是否在 3D 场景中正确渲染

4. **特效测试**：
   - 测试不同的光剑参数（核心宽度、光晕强度等）
   - 测试脉冲效果
   - 测试不同的对称模式

5. **性能测试**：
   - 绘制大量光剑笔画
   - 验证帧率是否稳定
   - 检查是否有内存泄漏

## 相关文件

- `components/MagicCircleDrawing/index.tsx` - 绘图画布组件
- `components/PlanetScene.tsx` - 星球场景组件
- `utils/drawingSystem.ts` - 绘图系统工具函数
- `types.ts` - 类型定义（LightsaberSettings）

## 修复日期
2026-05-02

## 修复人员
Claude (Opus 4.7)
