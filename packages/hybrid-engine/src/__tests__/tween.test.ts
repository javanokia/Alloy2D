import { beforeEach, describe, expect, it } from 'vitest';
import { DisplayObject } from 'pixi.js';
import {
  animateTo,
  animateTransform,
  Easing,
  tweenManager,
} from '../utils/tween';

function createMockDisplayObject(x = 0, y = 0): DisplayObject {
  const scale = {
    x: 1,
    y: 1,
    set(sx: number, sy?: number) {
      this.x = sx;
      this.y = sy ?? sx;
    },
  };
  return {
    x,
    y,
    alpha: 1,
    scale,
    destroyed: false,
  } as unknown as DisplayObject;
}

describe('TweenManager & Easing (基于 Ticker 的补间动画系统)', () => {
  beforeEach(() => {
    tweenManager.clear();
  });

  it('缓动函数 Easing 在边界 t=0 和 t=1 时返回精确值', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(1)).toBe(1);
    expect(Easing.easeOutQuad(0)).toBe(0);
    expect(Easing.easeOutQuad(1)).toBe(1);
    expect(Easing.easeOutBack(0)).toBeCloseTo(0, 5);
    expect(Easing.easeOutBack(1)).toBeCloseTo(1, 5);
    expect(Easing.easeInBack(0)).toBeCloseTo(0, 5);
    expect(Easing.easeInBack(1)).toBeCloseTo(1, 5);
  });

  it('animateTo 随 ticker.update 推进平滑插值坐标并在完成时 resolve Promise', async () => {
    const obj = createMockDisplayObject(10, 20);
    // 100ms 动画，使用线性插值
    const promise = animateTo(obj, 110, 220, 100, Easing.linear);

    expect(tweenManager.activeCount).toBe(1);

    // 推进 3 帧 (3 / 60 * 1000 = 50ms，即进度 50%)
    tweenManager.update(3);
    expect(obj.x).toBeCloseTo(60, 1);
    expect(obj.y).toBeCloseTo(120, 1);
    expect(tweenManager.activeCount).toBe(1);

    // 再推进 3 帧 (到达 100ms，进度 100%)
    tweenManager.update(3);
    await promise;

    expect(obj.x).toBeCloseTo(110, 1);
    expect(obj.y).toBeCloseTo(220, 1);
    expect(tweenManager.activeCount).toBe(0);
  });

  it('animateTransform 支持同时插值 scale、alpha 与 y 坐标', async () => {
    const obj = createMockDisplayObject(0, 100);
    const promise = animateTransform(obj, {
      toScaleX: 0.5,
      toScaleY: 0.5,
      toAlpha: 0,
      toY: 50,
      durationMS: 100,
      ease: Easing.linear,
    });

    // 推进 6 帧 (100ms)
    tweenManager.update(6);
    await promise;

    expect(obj.scale.x).toBeCloseTo(0.5, 2);
    expect(obj.scale.y).toBeCloseTo(0.5, 2);
    expect(obj.alpha).toBeCloseTo(0, 2);
    expect(obj.y).toBeCloseTo(50, 2);
  });

  it('当目标 DisplayObject 在动画途中被销毁 (destroyed = true) 时，安全终止并 resolve', async () => {
    const obj = createMockDisplayObject(0, 0);
    const promise = animateTo(obj, 200, 200, 500, Easing.linear);

    // 模拟中途销毁
    (obj as unknown as { destroyed: boolean }).destroyed = true;
    tweenManager.update(1);

    await promise;
    expect(tweenManager.activeCount).toBe(0);
  });
});
