import { describe, expect, it, vi } from 'vitest';
import { Application, Container } from 'pixi.js';
import { SceneManager } from '../core/SceneManager';

type TestSceneName = 'menu' | 'game' | 'settlement';

function createMockApp(): Application {
  const stage = {
    addChild: vi.fn(),
  };
  return { stage } as unknown as Application;
}

function createMockContainer(): Container {
  return {
    visible: true,
    destroy: vi.fn(),
  } as unknown as Container;
}

describe('SceneManager (场景管理器)', () => {
  it('注册场景时默认隐藏 (visible = false) 并挂载到 app.stage', () => {
    const app = createMockApp();
    const mgr = new SceneManager<TestSceneName>(app);
    const menuScene = createMockContainer();

    mgr.register('menu', menuScene);

    expect(menuScene.visible).toBe(false);
    expect(app.stage.addChild).toHaveBeenCalledWith(menuScene);
    expect(mgr.getCurrentScene()).toBeNull();
  });

  it('switchTo 切换场景时仅修改 visible 属性而不销毁原场景，并触发回调', () => {
    const app = createMockApp();
    const onSwitch = vi.fn();
    const mgr = new SceneManager<TestSceneName>(app, onSwitch);

    const menuScene = createMockContainer();
    const gameScene = createMockContainer();
    const settleScene = createMockContainer();

    mgr.register('menu', menuScene);
    mgr.register('game', gameScene);
    mgr.register('settlement', settleScene);

    mgr.switchTo('menu');
    expect(menuScene.visible).toBe(true);
    expect(gameScene.visible).toBe(false);
    expect(mgr.getCurrentScene()).toBe('menu');
    expect(onSwitch).toHaveBeenCalledWith('menu');

    mgr.switchTo('game');
    expect(menuScene.visible).toBe(false);
    expect(gameScene.visible).toBe(true);
    expect(menuScene.destroy).not.toHaveBeenCalled();
    expect(mgr.getCurrentScene()).toBe('game');
    expect(onSwitch).toHaveBeenCalledWith('game');
  });

  it('destroy 时遍历销毁所有已注册场景容器并重置当前场景引用', () => {
    const app = createMockApp();
    const mgr = new SceneManager<TestSceneName>(app);
    const menuScene = createMockContainer();
    const gameScene = createMockContainer();

    mgr.register('menu', menuScene);
    mgr.register('game', gameScene);
    mgr.switchTo('game');

    mgr.destroy();

    expect(menuScene.destroy).toHaveBeenCalledWith({ children: true });
    expect(gameScene.destroy).toHaveBeenCalledWith({ children: true });
    expect(mgr.getCurrentScene()).toBeNull();
  });
});
