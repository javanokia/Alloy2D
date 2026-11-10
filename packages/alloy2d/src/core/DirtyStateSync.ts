/**
 * 引擎内置泛型脏标记状态同步控制器 (对应文章 3.4 节与 4.4 节：按需同步与帧末批量同步)
 * 避免在 Pixi ticker 中高频触发 React setState，同一帧内多次状态变更会被自动合并为一次帧末推送
 */
export interface DirtySyncStats {
  flushCount: number;
  mergedCount: number;
}

export type DirtyFlushHandler<TState extends Record<string, any>> = (
  dirtyKeys: ReadonlySet<keyof TState>,
  state: TState,
  stats: DirtySyncStats
) => void;

export class DirtyStateSync<TState extends Record<string, any>> {
  public state: TState;
  private dirtyFlags: Set<keyof TState> = new Set();
  private flushCount = 0;
  private mergedMutationsCount = 0;
  private onFlush: DirtyFlushHandler<TState>;

  constructor(initialState: TState, onFlush: DirtyFlushHandler<TState>) {
    this.state = { ...initialState };
    this.onFlush = onFlush;
  }

  /**
   * 标记某个状态属性已变脏，不立即触发 React 重渲染
   */
  public markDirty(key: keyof TState): void {
    if (this.dirtyFlags.has(key)) {
      this.mergedMutationsCount++;
    }
    this.dirtyFlags.add(key);
  }

  /**
   * 在 Pixi 每帧结束时统一调用，批量同步到外部状态库 (如 Zustand)
   */
  public flushDirty(): void {
    if (this.dirtyFlags.size === 0) return;
    this.flushCount++;

    const dirtyKeys = new Set(this.dirtyFlags);
    this.dirtyFlags.clear();

    this.onFlush(dirtyKeys, this.state, {
      flushCount: this.flushCount,
      mergedCount: this.mergedMutationsCount,
    });
  }

  public getStats(): DirtySyncStats {
    return {
      flushCount: this.flushCount,
      mergedCount: this.mergedMutationsCount,
    };
  }

  public clearFlags(): void {
    this.dirtyFlags.clear();
  }
}
