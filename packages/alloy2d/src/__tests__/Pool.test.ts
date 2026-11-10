import { describe, expect, it, vi } from 'vitest';
import { Pool } from '../utils/Pool';

interface MockParticle {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

describe('Pool<T> (通用对象池)', () => {
  it('初始化时按 initialSize 预创建指定数量的对象放入闲置池', () => {
    let seq = 0;
    const factory = vi.fn(() => ({ id: ++seq, x: 0, y: 0, active: false }));
    const reset = vi.fn((item: MockParticle) => {
      item.x = 0;
      item.y = 0;
      item.active = false;
    });

    const pool = new Pool<MockParticle>(factory, reset, 10);

    expect(factory).toHaveBeenCalledTimes(10);
    expect(pool.stats).toEqual({
      available: 10,
      active: 0,
      totalCreated: 10,
      totalHits: 0,
    });
  });

  it('acquire 优先从闲置池复用对象并累加 totalHits，release 时重置状态并归还', () => {
    let seq = 0;
    const factory = vi.fn(() => ({ id: ++seq, x: 0, y: 0, active: false }));
    const reset = vi.fn((item: MockParticle) => {
      item.x = 0;
      item.y = 0;
      item.active = false;
    });

    const pool = new Pool<MockParticle>(factory, reset, 2);

    const p1 = pool.acquire();
    p1.x = 120;
    p1.y = 240;
    p1.active = true;

    expect(pool.stats).toEqual({
      available: 1,
      active: 1,
      totalCreated: 2,
      totalHits: 1,
    });

    pool.release(p1);
    expect(reset).toHaveBeenCalledWith(p1);
    expect(p1.x).toBe(0);
    expect(p1.active).toBe(false);
    expect(pool.stats.available).toBe(2);
    expect(pool.stats.active).toBe(0);

    // 再次 acquire 应拿到刚才归还的同一个对象引用 p1
    const pReused = pool.acquire();
    expect(pReused).toBe(p1);
    expect(pool.stats.totalHits).toBe(2);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('当闲置池耗尽时，acquire 自动调用 factory 动态扩容', () => {
    let seq = 0;
    const factory = vi.fn(() => ({ id: ++seq, x: 0, y: 0, active: false }));
    const pool = new Pool<MockParticle>(factory, () => {}, 1);

    const a = pool.acquire(); // 命中闲置池
    const b = pool.acquire(); // 闲置池已空，触发扩容

    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(pool.stats).toEqual({
      available: 0,
      active: 2,
      totalCreated: 2,
      totalHits: 1,
    });
  });

  it('clear 能够清空闲置池并归零活跃计数', () => {
    const pool = new Pool(
      () => ({ v: 1 }),
      () => {},
      5
    );
    pool.acquire();
    pool.clear();

    expect(pool.stats.available).toBe(0);
    expect(pool.stats.active).toBe(0);
  });
});
