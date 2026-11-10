import { describe, expect, it, vi } from 'vitest';
import { Application } from 'pixi.js';
import { bootstrapWxGame, WxGameHooks } from '../platform/bootstrapWxGame';
import { PlatformAdapter } from '../platform/PlatformAdapter';

function createMockApp(): Application {
  const stage = {
    addChild: vi.fn(),
    scale: { set: vi.fn() },
    position: { set: vi.fn() },
  };
  const renderer = {
    resize: vi.fn(),
  };
  const ticker = {
    stop: vi.fn(),
    start: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    FPS: 60,
  };
  return { stage, renderer, ticker, view: {} } as unknown as Application;
}

describe('bootstrapWxGame (微信小游戏通用启动器)', () => {
  it('按照流程调用 loadAssets、setup 并完成设计分辨率适配与生命周期挂接', async () => {
    let lifecycleCb: ((state: 'show' | 'hide') => void) | null = null;

    const mockPlatform: PlatformAdapter = {
      platformName: 'wx-minigame',
      getScreenSize: () => ({ width: 375, height: 667, dpr: 2 }),
      getSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0, capsuleBottom: 76 }),
      onTouchStart: vi.fn(() => () => {}),
      onLifecycleChange: vi.fn((cb) => {
        lifecycleCb = cb;
        return () => {
          lifecycleCb = null;
        };
      }),
      loadImage: vi.fn(async () => ({} as HTMLImageElement)),
      setStorage: vi.fn(),
      getStorage: vi.fn(() => null),
      unlockAudio: vi.fn(),
      suspendAudio: vi.fn(),
      resumeAudio: vi.fn(),
      playSound: vi.fn(),
      setSoundEnabled: vi.fn(),
      isAudioUnlocked: vi.fn(() => true),
    };

    const loadAssets = vi.fn(async () => {});
    const onLayout = vi.fn();
    const update = vi.fn();
    const onLifecycle = vi.fn();

    const hooks: WxGameHooks = {
      onLayout,
      update,
      onLifecycle,
    };

    const setup = vi.fn(async () => hooks);
    const mockApp = createMockApp();

    const runtime = await bootstrapWxGame({
      designWidth: 750,
      designHeight: 1334,
      backgroundColor: 0x123456,
      loadAssets,
      setup,
      platformAdapter: mockPlatform,
      createApp: () => mockApp,
    });

    expect(loadAssets).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(runtime.app).toBe(mockApp);
    expect(mockApp.renderer.resize).toHaveBeenCalledWith(375, 667);

    // 模拟微信切后台 onHide
    expect(lifecycleCb).not.toBeNull();
    lifecycleCb!('hide');
    expect(onLifecycle).toHaveBeenCalledWith('hide');
    expect(mockApp.ticker.stop).toHaveBeenCalled();

    // 模拟微信回到前台 onShow (应重新触发布局并恢复 ticker)
    lifecycleCb!('show');
    expect(onLifecycle).toHaveBeenCalledWith('show');
    expect(onLayout).toHaveBeenCalledTimes(2);
    expect(mockApp.ticker.start).toHaveBeenCalled();

    runtime.dispose();
  });
});
