import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_PADDING,
  BaseAssetManager,
  traceRoundedRect,
} from '../assets/BaseAssetManager';

describe('BaseAssetManager & traceRoundedRect (资源与动态图集管理基类)', () => {
  const originalWx = (globalThis as Record<string, unknown>).wx;

  afterEach(() => {
    (globalThis as Record<string, unknown>).wx = originalWx;
  });

  it('严格保持图集安全间距 ATLAS_PADDING = 4px，防止相邻纹理缩放旋转边缘渗色', () => {
    expect(ATLAS_PADDING).toBe(4);
  });

  it('traceRoundedRect 使用兼容微信小游戏 Canvas 2D 的 arcTo 绘制闭合圆角路径', () => {
    const mockCtx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    traceRoundedRect(mockCtx, 10, 20, 100, 80, 16);

    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.moveTo).toHaveBeenCalledWith(26, 20);
    expect(mockCtx.arcTo).toHaveBeenCalledTimes(4);
    expect(mockCtx.closePath).toHaveBeenCalledTimes(1);
  });

  it('在微信小游戏环境下优先调用 wx.createCanvas 创建离屏图集画布', () => {
    const fakeCanvas = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
    const createCanvasSpy = vi.fn(() => fakeCanvas);

    (globalThis as Record<string, unknown>).wx = {
      createCanvas: createCanvasSpy,
    };

    const mgr = new BaseAssetManager();
    const canvas = mgr.createOffscreenCanvas(512, 256);

    expect(createCanvasSpy).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(256);
  });
});
