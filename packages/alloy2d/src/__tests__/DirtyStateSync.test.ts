import { describe, expect, it, vi } from 'vitest';
import { DirtyStateSync } from '../core/DirtyStateSync';

interface TestGameState {
  score: number;
  combo: number;
  movesLeft: number;
}

describe('DirtyStateSync (脏标记帧末批量状态同步控制器)', () => {
  it('调用 markDirty 时不立即触发 onFlush，仅在 flushDirty 时同步', () => {
    const onFlush = vi.fn();
    const sync = new DirtyStateSync<TestGameState>(
      { score: 0, combo: 0, movesLeft: 20 },
      onFlush
    );

    sync.state.score = 100;
    sync.markDirty('score');

    expect(onFlush).not.toHaveBeenCalled();

    sync.flushDirty();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(Array.from(onFlush.mock.calls[0][0])).toEqual(['score']);
    expect(onFlush.mock.calls[0][1].score).toBe(100);
  });

  it('无脏标记时调用 flushDirty 为空操作，不触发无意义重渲染', () => {
    const onFlush = vi.fn();
    const sync = new DirtyStateSync<TestGameState>(
      { score: 0, combo: 0, movesLeft: 20 },
      onFlush
    );

    sync.flushDirty();
    sync.flushDirty();

    expect(onFlush).not.toHaveBeenCalled();
    expect(sync.getStats()).toEqual({ flushCount: 0, mergedCount: 0 });
  });

  it('同一帧内多次修改同一字段并标记脏时，自动合并为一次推送并精确统计 mergedCount', () => {
    const onFlush = vi.fn();
    const sync = new DirtyStateSync<TestGameState>(
      { score: 0, combo: 0, movesLeft: 20 },
      onFlush
    );

    // 模拟一帧内消除了 10 个棋子，每次累加 30 分并标记脏
    for (let i = 0; i < 10; i++) {
      sync.state.score += 30;
      sync.markDirty('score');
    }

    sync.flushDirty();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(sync.state.score).toBe(300);
    // 10 次 markDirty('score') 中，第 1 次新增标记，后续 9 次被成功合并
    expect(sync.getStats()).toEqual({ flushCount: 1, mergedCount: 9 });

    // 第二次 flushDirty 时因为上一帧末已清空脏标记，不再重复触发
    sync.flushDirty();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('同一帧内修改多个不同字段时，帧末一次性批量返回所有变脏的键集合', () => {
    let flushedKeys: Array<keyof TestGameState> = [];
    const sync = new DirtyStateSync<TestGameState>(
      { score: 0, combo: 0, movesLeft: 20 },
      (keys) => {
        flushedKeys = Array.from(keys);
      }
    );

    sync.state.score = 150;
    sync.markDirty('score');

    sync.state.combo = 3;
    sync.markDirty('combo');

    sync.state.movesLeft = 19;
    sync.markDirty('movesLeft');

    sync.flushDirty();
    expect(flushedKeys).toEqual(['score', 'combo', 'movesLeft']);
  });

  it('clearFlags 能够直接丢弃待同步的脏标记而不触发 onFlush', () => {
    const onFlush = vi.fn();
    const sync = new DirtyStateSync<TestGameState>(
      { score: 0, combo: 0, movesLeft: 20 },
      onFlush
    );

    sync.markDirty('score');
    sync.clearFlags();
    sync.flushDirty();

    expect(onFlush).not.toHaveBeenCalled();
  });
});
