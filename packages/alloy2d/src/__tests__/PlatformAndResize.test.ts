import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'pixi.js';
import {
  computeSafeAreaDesignOffsets,
  resizeStageToDesign,
} from '../core/screenResize';
import { WxMiniGamePlatformAdapter } from '../platform/PlatformAdapter';

describe('PlatformAdapter & ScreenResize (多端适配与刘海屏/胶囊安全区计算)', () => {
  const originalWx = (globalThis as Record<string, unknown>).wx;

  afterEach(() => {
    (globalThis as Record<string, unknown>).wx = originalWx;
  });

  it('WxMiniGamePlatformAdapter 正确读取系统尺寸、限制最大 DPR=2，并计算刘海屏与右上角胶囊安全区', () => {
    const storageMap = new Map<string, string>();
    let registeredShowCb: (() => void) | null = null;
    let registeredHideCb: (() => void) | null = null;

    (globalThis as Record<string, unknown>).wx = {
      getSystemInfoSync: () => ({
        windowWidth: 390,
        windowHeight: 844,
        pixelRatio: 3, // iPhone 14 Pro 3x 屏幕应被限制为 2x 以保障移动 GPU 帧率
        statusBarHeight: 47,
        safeArea: {
          top: 47,
          bottom: 810,
          left: 0,
          right: 390,
          width: 390,
          height: 763,
        },
      }),
      getMenuButtonBoundingClientRect: () => ({
        top: 51,
        bottom: 83,
        left: 290,
        right: 377,
        width: 87,
        height: 32,
      }),
      getStorageSync: (k: string) => storageMap.get(k) || '',
      setStorageSync: (k: string, v: string) => storageMap.set(k, v),
      onShow: (cb: () => void) => {
        registeredShowCb = cb;
      },
      offShow: vi.fn(),
      onHide: (cb: () => void) => {
        registeredHideCb = cb;
      },
      offHide: vi.fn(),
    };

    const wxAdapter = new WxMiniGamePlatformAdapter();

    // 1. 验证屏幕尺寸与 DPR 限制
    expect(wxAdapter.getScreenSize()).toEqual({
      width: 390,
      height: 844,
      dpr: 2,
    });

    // 2. 验证刘海屏与微信胶囊安全区
    const insets = wxAdapter.getSafeAreaInsets();
    expect(insets).toEqual({
      top: 51, // max(safeArea.top=47, menuButton.top=51)
      bottom: 34, // 844 - 810
      left: 0,
      right: 0,
      capsuleBottom: 83,
    });

    // 3. 验证本地存储读写
    wxAdapter.setStorage('highScore', '9500');
    expect(wxAdapter.getStorage('highScore')).toBe('9500');

    // 4. 验证前后台生命周期回调
    const lifecycleSpy = vi.fn();
    wxAdapter.onLifecycleChange(lifecycleSpy);

    registeredHideCb!();
    expect(lifecycleSpy).toHaveBeenCalledWith('hide');

    registeredShowCb!();
    expect(lifecycleSpy).toHaveBeenCalledWith('show');
  });

  it('resizeStageToDesign 在不同长宽比屏幕下正确计算等比缩放与居中留白偏移', () => {
    (globalThis as Record<string, unknown>).window = {
      innerWidth: 375,
      innerHeight: 812,
      devicePixelRatio: 2,
    };

    const mockApp = {
      renderer: {
        resize: vi.fn(),
      },
      stage: {
        scale: {
          set: vi.fn(),
        },
        x: 0,
        y: 0,
      },
    } as unknown as Application;

    const result = resizeStageToDesign(mockApp, 750, 1334);

    // 375 / 750 = 0.5, 812 / 1334 = 0.608 -> scale 取较小值 0.5
    expect(result.scale).toBeCloseTo(0.5, 4);
    expect(result.offsetX).toBeCloseTo(0, 4);
    // 垂直居中偏移: (812 - 1334 * 0.5) / 2 = (812 - 667) / 2 = 72.5
    expect(result.offsetY).toBeCloseTo(72.5, 4);
    expect(mockApp.renderer.resize).toHaveBeenCalledWith(375, 812);
    expect(mockApp.stage.scale.set).toHaveBeenCalledWith(0.5);
  });

  it('computeSafeAreaDesignOffsets 能够正确将屏幕像素安全边距换算为 750x1334 设计坐标系偏移', () => {
    (globalThis as Record<string, unknown>).window = {
      innerWidth: 375,
      innerHeight: 667,
      devicePixelRatio: 2,
    };
    const offsets = computeSafeAreaDesignOffsets(750, 1334);
    expect(offsets.safeTopDesign).toBeGreaterThanOrEqual(0);
    expect(offsets.safeBottomDesign).toBeGreaterThanOrEqual(0);
  });
});
