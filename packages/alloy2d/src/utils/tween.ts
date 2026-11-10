import { DisplayObject } from 'pixi.js';

export type EaseFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
};

interface ActiveTween {
  update: (deltaMS: number) => boolean;
  resolve: () => void;
}

export class TweenManager {
  private tweens: Set<ActiveTween> = new Set();

  /**
   * 在 Pixi 主循环 ticker 中调用 (对应文章 3.4 节)
   */
  update(deltaFrames: number): void {
    const deltaMS = (deltaFrames / 60) * 1000;
    for (const tween of Array.from(this.tweens)) {
      const done = tween.update(deltaMS);
      if (done) {
        this.tweens.delete(tween);
        tween.resolve();
      }
    }
  }

  add(updateFn: (deltaMS: number) => boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tweens.add({
        update: updateFn,
        resolve,
      });
    });
  }

  clear(): void {
    for (const tween of this.tweens) {
      tween.resolve();
    }
    this.tweens.clear();
  }

  get activeCount(): number {
    return this.tweens.size;
  }
}

export const tweenManager = new TweenManager();

/**
 * 平滑移动 DisplayObject 到目标坐标 (对应文章 4.1 节 Tile.moveTo)
 */
export function animateTo(
  target: DisplayObject,
  toX: number,
  toY: number,
  durationMS = 180,
  ease: EaseFn = Easing.easeOutQuad
): Promise<void> {
  const startX = target.x;
  const startY = target.y;
  let elapsed = 0;

  return tweenManager.add((deltaMS) => {
    if (target.destroyed) return true;
    elapsed += deltaMS;
    const progress = Math.min(1, elapsed / durationMS);
    const k = ease(progress);
    target.x = startX + (toX - startX) * k;
    target.y = startY + (toY - startY) * k;
    return progress >= 1;
  });
}

/**
 * 缩放与透明度插值动画（用于消除、弹窗弹性弹出等反馈）
 */
export function animateTransform(
  target: DisplayObject,
  options: {
    toScaleX?: number;
    toScaleY?: number;
    toAlpha?: number;
    toY?: number;
    durationMS?: number;
    ease?: EaseFn;
  }
): Promise<void> {
  const startScaleX = target.scale.x;
  const startScaleY = target.scale.y;
  const startAlpha = target.alpha;
  const startY = target.y;

  const toScaleX = options.toScaleX ?? startScaleX;
  const toScaleY = options.toScaleY ?? startScaleY;
  const toAlpha = options.toAlpha ?? startAlpha;
  const toY = options.toY ?? startY;
  const durationMS = options.durationMS ?? 180;
  const ease = options.ease ?? Easing.easeOutQuad;

  let elapsed = 0;

  return tweenManager.add((deltaMS) => {
    if (target.destroyed) return true;
    elapsed += deltaMS;
    const progress = Math.min(1, elapsed / durationMS);
    const k = ease(progress);
    target.scale.set(
      startScaleX + (toScaleX - startScaleX) * k,
      startScaleY + (toScaleY - startScaleY) * k
    );
    target.alpha = startAlpha + (toAlpha - startAlpha) * k;
    target.y = startY + (toY - startY) * k;
    return progress >= 1;
  });
}
