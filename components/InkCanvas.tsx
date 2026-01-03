/**
 * input: （已废弃）旧版 InkCanvas 依赖 DrawMode 与球面 raycast 绘制逻辑
 * output: null
 * pos: 保留文件以兼容历史引用；当前 Workbench 绘图由 HoloCanvas + InkManager 接管
 * update: 一旦我被更新，请同步更新 components/README.md
 */

import React from 'react';
import { DrawSettings } from '../types';

interface InkCanvasProps {
    settings: DrawSettings;
}

export const InkCanvas: React.FC<InkCanvasProps> = (_props) => {
    return null;
};
