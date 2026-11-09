/**
 * 引擎内置多平台适配层 (对应文章 5.2 节、7.2 节与第 8 节踩坑记录 4、5)
 * 抹平 Web 浏览器、微信小游戏 (wx)、桌面壳 (Electron) 的 API 差异
 * 包含：屏幕与刘海屏/胶囊安全区计算、前后台生命周期 (onShow/onHide)、音频中断恢复、存储与图片加载
 */

export type PlatformType = 'web' | 'wx-minigame' | 'electron-desktop';

export type LifecycleState = 'show' | 'hide';

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
  unlockAudio(): void;
  suspendAudio(): void;
  resumeAudio(): void;
  playSound(sound: SoundEffectType | string): void;
  setSoundEnabled(enabled: boolean): void;
  isAudioUnlocked(): boolean;
}

interface WxSafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface WxMenuButtonRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface WxMiniGameGlobal {
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
}

function getWx(): WxMiniGameGlobal | null {
  const g = globalThis as unknown as { wx?: WxMiniGameGlobal };
  if (typeof g.wx !== 'undefined' && typeof g.wx.getSystemInfoSync === 'function') {
    return g.wx;
  }
  return null;
}

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private enabled = true;
  private suspendedByLifecycle = false;

  unlock(): void {
    if (!this.ctx) {
      const wxObj = getWx();
      if (wxObj && typeof wxObj.createWebAudioContext === 'function') {
        try {
          this.ctx = wxObj.createWebAudioContext();
        } catch {
          this.ctx = null;
        }
      } else if (typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          try {
            this.ctx = new AudioCtx();
          } catch {
            this.ctx = null;
          }
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      try {
        this.ctx.resume();
      } catch {
        // ignore
      }
    }
    this.unlocked = true;
    this.suspendedByLifecycle = false;
  }

  suspend(): void {
    this.suspendedByLifecycle = true;
    if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
      try {
        this.ctx.suspend();
      } catch {
        // ignore
      }
    }
  }

  resume(): void {
    this.suspendedByLifecycle = false;
    if (
      this.unlocked &&
      this.enabled &&
      this.ctx &&
      this.ctx.state === 'suspended' &&
      typeof this.ctx.resume === 'function'
    ) {
      try {
        this.ctx.resume();
      } catch {
        // ignore
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  play(type: SoundEffectType | string): void {
    if (!this.enabled || this.suspendedByLifecycle) return;
    if (!this.unlocked) {
      this.unlock();
    }
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      try {
        this.ctx.resume();
      } catch {
        // ignore
      }
    }

    const now = this.ctx.currentTime || 0;

    const playTone = (
      freqStart: number,
      freqEnd: number,
      duration: number,
      wave: OscillatorType = 'sine',
      gainVal = 0.14,
      delay = 0
    ) => {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freqStart, now + delay);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + delay + duration);

        gain.gain.setValueAtTime(gainVal, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + duration);
      } catch {
        // ignore
      }
    };

    switch (type) {
      case 'click':
        playTone(520, 680, 0.06, 'triangle', 0.12);
        break;
      case 'swap':
        playTone(340, 520, 0.1, 'sine', 0.12);
        break;
      case 'invalid':
        playTone(220, 150, 0.16, 'sawtooth', 0.1);
        break;
      case 'match':
        playTone(523.25, 659.25, 0.12, 'sine', 0.15, 0);
        playTone(659.25, 783.99, 0.15, 'sine', 0.15, 0.06);
        break;
      case 'combo':
        playTone(587.33, 783.99, 0.12, 'triangle', 0.16, 0);
        playTone(783.99, 987.77, 0.14, 'triangle', 0.16, 0.06);
        playTone(987.77, 1174.66, 0.18, 'triangle', 0.18, 0.12);
        break;
      case 'powerup':
        playTone(180, 880, 0.25, 'sawtooth', 0.16, 0);
        break;
      case 'win':
        playTone(523.25, 523.25, 0.12, 'triangle', 0.16, 0);
        playTone(659.25, 659.25, 0.12, 'triangle', 0.16, 0.11);
        playTone(783.99, 783.99, 0.12, 'triangle', 0.16, 0.22);
        playTone(1046.5, 1046.5, 0.3, 'triangle', 0.2, 0.33);
        break;
      case 'lose':
        playTone(392.0, 349.23, 0.18, 'sawtooth', 0.12, 0);
        playTone(349.23, 293.66, 0.22, 'sawtooth', 0.12, 0.18);
        playTone(293.66, 220.0, 0.32, 'sawtooth', 0.14, 0.38);
        break;
      default:
        playTone(440, 660, 0.08, 'sine', 0.1);
        break;
    }
  }
}

const soundEngine = new ProceduralSoundEngine();

export class WxMiniGamePlatformAdapter implements PlatformAdapter {
  readonly platformName: PlatformType = 'wx-minigame';

  constructor() {
    const wxObj = getWx();
    if (wxObj && typeof wxObj.onAudioInterruptionBegin === 'function') {
      wxObj.onAudioInterruptionBegin(() => {
        soundEngine.suspend();
      });
    }
    if (wxObj && typeof wxObj.onAudioInterruptionEnd === 'function') {
      wxObj.onAudioInterruptionEnd(() => {
        soundEngine.resume();
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
      width: window.innerWidth || 375,
      height: window.innerHeight || 667,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
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
        soundEngine.resume();
        cb('show');
      };
      const onHideHandler = () => {
        soundEngine.suspend();
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
    soundEngine.unlock();
  }

  suspendAudio(): void {
    soundEngine.suspend();
  }

  resumeAudio(): void {
    soundEngine.resume();
  }

  playSound(sound: SoundEffectType | string): void {
    soundEngine.play(sound);
  }

  setSoundEnabled(enabled: boolean): void {
    soundEngine.setEnabled(enabled);
  }

  isAudioUnlocked(): boolean {
    return soundEngine.isUnlocked();
  }
}

export class WebPlatformAdapter implements PlatformAdapter {
  readonly platformName: PlatformType;

  constructor(simulatedPlatform: PlatformType = 'web') {
    this.platformName = simulatedPlatform;
  }

  getScreenSize(): { width: number; height: number; dpr: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    };
  }

  getSafeAreaInsets(): SafeAreaInsets {
    return { top: 0, bottom: 0, left: 0, right: 0, capsuleBottom: 0 };
  }

  onTouchStart(cb: (x: number, y: number) => void): () => void {
    const handler = (e: PointerEvent) => {
      cb(e.clientX, e.clientY);
    };
    window.addEventListener('pointerdown', handler, { passive: true });
    return () => window.removeEventListener('pointerdown', handler);
  }

  onLifecycleChange(cb: (state: LifecycleState) => void): () => void {
    const handleVisibility = () => {
      if (document.hidden) {
        soundEngine.suspend();
        cb('hide');
      } else {
        soundEngine.resume();
        cb('show');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }

  loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  setStorage(key: string, value: string): void {
    try {
      localStorage.setItem(`rg_engine_${key}`, value);
    } catch {
      // ignore
    }
  }

  getStorage(key: string): string | null {
    try {
      return localStorage.getItem(`rg_engine_${key}`);
    } catch {
      return null;
    }
  }

  unlockAudio(): void {
    soundEngine.unlock();
  }

  suspendAudio(): void {
    soundEngine.suspend();
  }

  resumeAudio(): void {
    soundEngine.resume();
  }

  playSound(sound: SoundEffectType | string): void {
    soundEngine.play(sound);
  }

  setSoundEnabled(enabled: boolean): void {
    soundEngine.setEnabled(enabled);
  }

  isAudioUnlocked(): boolean {
    return soundEngine.isUnlocked();
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
