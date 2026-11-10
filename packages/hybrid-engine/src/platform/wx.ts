/**
 * 微信小游戏全局对象 (wx) 的最小类型声明与安全获取函数
 * 供平台适配层、音频系统、启动模板等模块共享，避免循环依赖
 */

export interface WxSafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface WxMenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** 微信 InnerAudioContext 的最小子集 */
export interface WxInnerAudioContext {
  src: string;
  loop: boolean;
  volume: number;
  autoplay?: boolean;
  play(): void;
  pause(): void;
  stop(): void;
  seek?(position: number): void;
  destroy(): void;
}

export interface WxMiniGameGlobal {
  getSystemInfoSync(): {
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    statusBarHeight?: number;
    safeArea?: WxSafeArea;
  };
  getMenuButtonBoundingClientRect?: () => WxMenuButtonRect;
  createCanvas(): HTMLCanvasElement;
  createImage(): HTMLImageElement;
  getStorageSync(key: string): string;
  setStorageSync(key: string, data: string): void;
  onTouchStart(
    cb: (res: { touches: Array<{ clientX: number; clientY: number }> }) => void
  ): void;
  offTouchStart(
    cb: (res: { touches: Array<{ clientX: number; clientY: number }> }) => void
  ): void;
  onShow?: (cb: () => void) => void;
  offShow?: (cb: () => void) => void;
  onHide?: (cb: () => void) => void;
  offHide?: (cb: () => void) => void;
  onAudioInterruptionBegin?: (cb: () => void) => void;
  onAudioInterruptionEnd?: (cb: () => void) => void;
  createWebAudioContext?: () => AudioContext;
  createInnerAudioContext?: () => WxInnerAudioContext;
}

export function getWx(): WxMiniGameGlobal | null {
  const g = globalThis as unknown as { wx?: WxMiniGameGlobal };
  if (typeof g.wx !== 'undefined' && typeof g.wx.getSystemInfoSync === 'function') {
    return g.wx;
  }
  return null;
}
