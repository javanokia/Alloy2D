import { describe, expect, it, vi } from 'vitest';
import { Sprite } from 'pixi.js';
import { CircleBody, CirclePhysicsWorld } from '../physics/CirclePhysicsWorld';

function createMockBody(
  id: string,
  tier: number,
  x: number,
  y: number,
  radius = 24
): CircleBody {
  return {
    id,
    tier,
    x,
    y,
    vx: 0,
    vy: 0,
    radius,
    mass: (radius * radius) / 100,
    isMerging: false,
    spawnTime: performance.now(),
    sprite: { x, y } as unknown as Sprite,
  };
}

describe('CirclePhysicsWorld (大西瓜圆周碰撞与物理求解器)', () => {
  const boundary = {
    left: 60,
    right: 690,
    bottom: 1180,
    dangerY: 360,
  };

  it('重力驱动与底部边界碰撞约束', () => {
    const world = new CirclePhysicsWorld({ boundary, gravity: 1.0 });
    const body = createMockBody('b1', 0, 300, 1000, 20);
    world.addBody(body);

    // 步进多次
    for (let i = 0; i < 30; i++) {
      world.update(1.0);
    }

    // 应该在重力作用下向下移动并最终限制在地面 (1180 - 20 = 1160)
    expect(body.y).toBeLessThanOrEqual(1160);
    expect(body.y).toBeGreaterThan(1100);
  });

  it('左侧与右侧墙体边界限制与反弹', () => {
    const world = new CirclePhysicsWorld({ boundary });
    const bLeft = createMockBody('bLeft', 0, 65, 800, 20);
    bLeft.vx = -10;
    world.addBody(bLeft);

    world.update(1.0);
    expect(bLeft.x).toBeGreaterThanOrEqual(boundary.left + bLeft.radius);

    const bRight = createMockBody('bRight', 0, 685, 800, 20);
    bRight.vx = 10;
    world.addBody(bRight);

    world.update(1.0);
    expect(bRight.x).toBeLessThanOrEqual(boundary.right - bRight.radius);
  });

  it('同等级水果碰撞时正确触发 onMerge 回调并标记 isMerging', () => {
    const onMerge = vi.fn();
    const world = new CirclePhysicsWorld({ boundary, onMerge });

    // 两个等级为 1、半径为 30 的水果，相距 40（重叠 20）
    const b1 = createMockBody('f1', 1, 300, 800, 30);
    const b2 = createMockBody('f2', 1, 340, 800, 30);
    world.addBody(b1);
    world.addBody(b2);

    world.update(1.0);

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith(b1, b2);
    expect(b1.isMerging).toBe(true);
    expect(b2.isMerging).toBe(true);
  });

  it('不同等级水果碰撞时不触发合成，而是执行弹性冲量推开', () => {
    const onMerge = vi.fn();
    const world = new CirclePhysicsWorld({ boundary, onMerge });

    // 一个等级 0，一个等级 2，重叠相撞
    const b1 = createMockBody('f1', 0, 300, 800, 25);
    const b2 = createMockBody('f2', 2, 330, 800, 40);
    world.addBody(b1);
    world.addBody(b2);

    world.update(1.0);

    expect(onMerge).not.toHaveBeenCalled();
    expect(b1.isMerging).toBe(false);
    expect(b2.isMerging).toBe(false);
    // 两球应被推开，间距扩大
    const newDist = Math.abs(b2.x - b1.x);
    expect(newDist).toBeGreaterThan(30);
  });

  it('摇晃道具为水果施加扰动与向上速度', () => {
    const world = new CirclePhysicsWorld({ boundary });
    const b1 = createMockBody('f1', 0, 300, 1160, 20);
    world.addBody(b1);

    world.applyEarthquake();
    expect(b1.vy).toBeLessThan(0); // 向上
    expect(b1.vx).not.toBe(0); // 带有水平扰动
  });
});
