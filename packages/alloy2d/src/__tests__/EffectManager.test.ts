import { beforeAll, describe, expect, it } from 'vitest';
import { DOMAdapter, Texture } from 'pixi.js';
import { EffectManager } from '../effects/EffectManager';

describe('EffectManager (通用粒子与浮动文字特效)', () => {
  beforeAll(() => {
    class FakeCanvas {
      width = 1;
      height = 1;
      style = {};
      getContext() {
        return {
          font: '',
          fillText: () => {},
          measureText: () => ({ width: 10 }),
          fillRect: () => {},
          clearRect: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: [] }),
        };
      }
    }
    (globalThis as unknown as { HTMLCanvasElement: unknown }).HTMLCanvasElement = FakeCanvas;
    try {
      DOMAdapter.set({
        ...DOMAdapter.get(),
        createCanvas: () => new FakeCanvas() as unknown as HTMLCanvasElement,
      });
    } catch {}
  });

  it('初始化创建容器与对象池，并正确报告初始遥测指标', () => {
    const effects = new EffectManager({
      particleTexture: () => Texture.EMPTY,
      particlePoolSize: 10,
      textPoolSize: 5,
    });

    expect(effects.particleContainer).toBeDefined();
    expect(effects.textContainer).toBeDefined();

    const telemetry = effects.getTelemetry();
    expect(telemetry.particleActive).toBe(0);
    expect(telemetry.particleAvailable).toBe(10);
    expect(telemetry.textActive).toBe(0);
    expect(telemetry.textAvailable).toBe(5);
    expect(telemetry.totalCreated).toBe(15);
  });

  it('spawnBurst 激活指定数量粒子并在 update 推进后归还对象池', () => {
    const effects = new EffectManager({
      particleTexture: () => Texture.EMPTY,
      particlePoolSize: 10,
      burst: {
        count: 4,
        lifeMin: 2,
        lifeMax: 2,
      },
    });

    effects.spawnBurst(100, 100, 0xff0000, 4);

    expect(effects.activeCount.particles).toBe(4);
    expect(effects.getTelemetry().particleActive).toBe(4);

    // 步进 1 个 delta (生命周期未结束)
    effects.update(1);
    expect(effects.activeCount.particles).toBe(4);

    // 再步进 2 个 delta (生命周期已达到 maxLife=2)
    effects.update(2);
    expect(effects.activeCount.particles).toBe(0);
    expect(effects.getTelemetry().particleActive).toBe(0);
  });

  it('spawnFloatingText 激活文字对象并在超时后自动回收', () => {
    const effects = new EffectManager({
      particleTexture: () => Texture.EMPTY,
      floatingText: {
        maxLife: 3,
        vy: -2,
        startScale: 1,
        animation: 'pop',
      },
    });

    effects.spawnFloatingText(50, 50, '+100 分');
    expect(effects.activeCount.texts).toBe(1);

    effects.update(2);
    expect(effects.activeCount.texts).toBe(1);

    effects.update(2);
    expect(effects.activeCount.texts).toBe(0);
  });

  it('destroy 安全销毁容器并清空对象池', () => {
    const effects = new EffectManager({
      particleTexture: () => Texture.EMPTY,
      particlePoolSize: 4,
    });

    effects.spawnBurst(0, 0, 0xffffff, 2);
    effects.spawnFloatingText(0, 0, 'Test');

    effects.destroy();
    expect(effects.activeCount.particles).toBe(0);
    expect(effects.activeCount.texts).toBe(0);
  });
});
