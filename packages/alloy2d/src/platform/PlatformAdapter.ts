/**
 * 引擎内置多平台适配层 (对应文章 5.2 节、7.2 节与第 8 节踩坑记录 4、5)
 * 抹平 Web 浏览器、微信小游戏 (wx)、桌面壳 (Electron) 的 API 差异
 * 包含：屏幕与刘海屏/胶囊安全区计算、前后台生命周期 (onShow/onHide)、音频中断恢复、存储与图片加载
 */

import { audioManager } from '../audio/AudioManager';
import { getWx } from './wx';

export type PlatformType = 'web' | 'wx-minigame' | 'electron-desktop';

export type LifecycleState = 'show' | 'hide';

/**
 * v1.0 内置合成音名称。
 * @deprecated v1.1 起音效改由 `audioManager.register()` 按名称注册，`playSound` 接受任意字符串。
 */
export type SoundEffectType =
  | 'click'
  | 'swap'
  | 'match'
  | 'combo'
  | 'invalid'
  | 'powerup'
  | 'win'
  | 'lose';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  capsuleBottom: number;
}

export interface PlatformAdapter {
  readonly platformName: PlatformType;
  getScreenSize(): { width: number; height: number; dpr: number };
  getSafeAreaInsets(): SafeAreaInsets;
  onTouchStart(cb: (x: number, y: number) => void): () => void;
  onLifecycleChange(cb: (state: LifecycleState) => void): () => void;
  loadImage(url: string): Promise<HTMLImageElement>;
  setStorage(key: string, value: string): void;
  getStorage(key: string): string | null;
  /** 以下音频方法为兼容保留，内部委托给 `audioManager` */
  unlockAudio(): void;
  suspendAudio(): void;
  resumeAudio(): void;
  playSound(sound: SoundEffectType | string): void;
  setSoundEnabled(enabled: boolean): void;
  isAudioUnlocked(): boolean;
}


export class WxMiniGamePlatformAdapter implements PlatformAdapter {
  readonly platformName: PlatformType = 'wx-minigame';

  constructor() {
    const wxObj = getWx();
    if (wxObj && typeof wxObj.onAudioInterruptionBegin === 'function') {
      wxObj.onAudioInterruptionBegin(() => {
        audioManager.suspend();
      });
    }
    if (wxObj && typeof wxObj.onAudioInterruptionEnd === 'function') {
      wxObj.onAudioInterruptionEnd(() => {
        audioManager.resume();
      });
    }
  }

  getScreenSize(): { width: number; height: number; dpr: number } {
    const wxObj = getWx();
    if (wxObj) {
      const info = wxObj.getSystemInfoSync();
      return {
        width: info.windowWidth,
        height: info.windowHeight,
        dpr: Math.min(info.pixelRatio || 1, 2),
      };
    }
    return {
      width: typeof window !== 'undefined' ? window.innerWidth || 375 : 375,
      height: typeof window !== 'undefined' ? window.innerHeight || 667 : 667,
      dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    };
  }

  getSafeAreaInsets(): SafeAreaInsets {
    const wxObj = getWx();
    if (wxObj) {
      const info = wxObj.getSystemInfoSync();
      const winW = info.windowWidth;
      const winH = info.windowHeight;
      const safe = info.safeArea;

      let top = safe ? safe.top : info.statusBarHeight || 20;
      const bottom = safe ? Math.max(0, winH - safe.bottom) : 0;
      const left = safe ? safe.left : 0;
      const right = safe ? Math.max(0, winW - safe.right) : 0;

      let capsuleBottom = top + 36;
      if (typeof wxObj.getMenuButtonBoundingClientRect === 'function') {
        try {
          const rect = wxObj.getMenuButtonBoundingClientRect();
          if (rect && rect.bottom > 0) {
            capsuleBottom = rect.bottom;
            top = Math.max(top, rect.top);
          }
        } catch {
          // ignore
        }
      }

      return { top, bottom, left, right, capsuleBottom };
    }
    return { top: 0, bottom: 0, left: 0, right: 0, capsuleBottom: 0 };
  }

  onTouchStart(cb: (x: number, y: number) => void): () => void {
    const wxObj = getWx();
    if (wxObj && typeof wxObj.onTouchStart === 'function') {
      const handler = (res: { touches: Array<{ clientX: number; clientY: number }> }) => {
        const touch = res.touches && res.touches[0];
        if (touch) {
          cb(touch.clientX, touch.clientY);
        }
      };
      wxObj.onTouchStart(handler);
      return () => {
        if (typeof wxObj.offTouchStart === 'function') {
          wxObj.offTouchStart(handler);
        }
      };
    }
    return () => {};
  }

  onLifecycleChange(cb: (state: LifecycleState) => void): () => void {
    const wxObj = getWx();
    if (wxObj && typeof wxObj.onShow === 'function' && typeof wxObj.onHide === 'function') {
      const onShowHandler = () => {
        audioManager.resume();
        cb('show');
      };
      const onHideHandler = () => {
        audioManager.suspend();
        cb('hide');
      };
      wxObj.onShow(onShowHandler);
      wxObj.onHide(onHideHandler);
      return () => {
        if (typeof wxObj.offShow === 'function') wxObj.offShow(onShowHandler);
        if (typeof wxObj.offHide === 'function') wxObj.offHide(onHideHandler);
      };
    }
    return () => {};
  }

  loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const wxObj = getWx();
      const img = wxObj ? wxObj.createImage() : new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  setStorage(key: string, value: string): void {
    try {
      const wxObj = getWx();
      if (wxObj) {
        wxObj.setStorageSync(`rg_engine_${key}`, value);
      } else {
        localStorage.setItem(`rg_engine_${key}`, value);
      }
    } catch {
      // ignore
    }
  }

  getStorage(key: string): string | null {
    try {
      const wxObj = getWx();
      if (wxObj) {
        const val = wxObj.getStorageSync(`rg_engine_${key}`);
        return val ? String(val) : null;
      }
      return localStorage.getItem(`rg_engine_${key}`);
    } catch {
      return null;
    }
  }

  unlockAudio(): void {
    audioManager.unlock();
  }

  suspendAudio(): void {
    audioManager.suspend();
  }

  resumeAudio(): void {
    audioManager.resume();
  }

  playSound(sound: SoundEffectType | string): void {
    audioManager.play(sound);
  }

  setSoundEnabled(enabled: boolean): void {
    audioManager.setSfxEnabled(enabled);
  }

  isAudioUnlocked(): boolean {
    return audioManager.isUnlocked();
  }
}

export class WebPlatformAdapter implements PlatformAdapter {
  readonly platformName: PlatformType;

  constructor(simulatedPlatform: PlatformType = 'web') {
    this.platformName = simulatedPlatform;
  }

  getScreenSize(): { width: number; height: number; dpr: number } {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth || 375,
        height: window.innerHeight || 667,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      };
    }
    return { width: 375, height: 667, dpr: 1 };
  }

  getSafeAreaInsets(): SafeAreaInsets {
    return { top: 0, bottom: 0, left: 0, right: 0, capsuleBottom: 0 };
  }

  onTouchStart(cb: (x: number, y: number) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: PointerEvent) => {
      cb(e.clientX, e.clientY);
    };
    window.addEventListener('pointerdown', handler, { passive: true });
    return () => window.removeEventListener('pointerdown', handler);
  }

  onLifecycleChange(cb: (state: LifecycleState) => void): () => void {
    if (typeof document === 'undefined') return () => {};
    const handleVisibility = () => {
      if (document.hidden) {
        audioManager.suspend();
        cb('hide');
      } else {
        audioManager.resume();
        cb('show');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }

  loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (typeof Image === 'undefined') {
        reject(new Error('Image is not defined in current environment'));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  setStorage(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`rg_engine_${key}`, value);
      }
    } catch {
      // ignore
    }
  }

  getStorage(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(`rg_engine_${key}`);
      }
      return null;
    } catch {
      return null;
    }
  }

  unlockAudio(): void {
    audioManager.unlock();
  }

  suspendAudio(): void {
    audioManager.suspend();
  }

  resumeAudio(): void {
    audioManager.resume();
  }

  playSound(sound: SoundEffectType | string): void {
    audioManager.play(sound);
  }

  setSoundEnabled(enabled: boolean): void {
    audioManager.setSfxEnabled(enabled);
  }

  isAudioUnlocked(): boolean {
    return audioManager.isUnlocked();
  }
}

function createPlatformAdapter(): PlatformAdapter {
  if (getWx() !== null) {
    return new WxMiniGamePlatformAdapter();
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    return new WebPlatformAdapter('electron-desktop');
  }
  return new WebPlatformAdapter('web');
}

export const platform: PlatformAdapter = createPlatformAdapter();
