import { SceneName, useGameStore } from '../../store/useGameStore';

/**
 * 状态同步控制器：按需同步与帧末批量同步 (对应文章 3.4 节与 4.4 节)
 * 严禁在 Pixi ticker 内每帧调用 React setState，通过 dirtyFlags 在每帧结束时批量合并推送
 */
export type DirtyKey = 'score' | 'level' | 'targetScore' | 'movesLeft' | 'combo' | 'scene' | 'coins';

export interface InternalGameState {
  score: number;
  level: number;
  targetScore: number;
  movesLeft: number;
  combo: number;
  scene: SceneName;
  coinsDelta: number;
}

class StateSyncController {
  private dirtyFlags: Set<DirtyKey> = new Set();
  private flushCount = 0;
  private mergedMutationsCount = 0;

  public state: InternalGameState = {
    score: 0,
    level: 1,
    targetScore: 1000,
    movesLeft: 20,
    combo: 0,
    scene: 'menu',
    coinsDelta: 0,
  };

  /**
   * 标记某个状态属性已变脏，不立即触发 React 重渲染
   */
  markDirty(key: DirtyKey): void {
    if (this.dirtyFlags.has(key)) {
      // 同一帧内多次修改同一状态，被脏标记成功合并！
      this.mergedMutationsCount++;
    }
    this.dirtyFlags.add(key);
  }

  /**
   * 在 Pixi 每帧结束时统一调用，批量同步到 Zustand Store
   */
  flushDirty(): void {
    if (this.dirtyFlags.size === 0) return;

    this.flushCount++;
    const store = useGameStore.getState();

    this.dirtyFlags.forEach((key) => {
      switch (key) {
        case 'score':
          store.setScore(this.state.score);
          break;
        case 'level':
          store.setLevel(this.state.level);
          break;
        case 'targetScore':
          store.setTargetScore(this.state.targetScore);
          break;
        case 'movesLeft':
          store.setMovesLeft(this.state.movesLeft);
          break;
        case 'combo':
          store.setCombo(this.state.combo);
          break;
        case 'scene':
          store.setScene(this.state.scene);
          break;
        case 'coins':
          if (this.state.coinsDelta !== 0) {
            store.addCoins(this.state.coinsDelta);
            this.state.coinsDelta = 0;
          }
          break;
      }
    });

    store.updateTelemetry({
      dirtyFlushCount: this.flushCount,
      dirtyMergedCount: this.mergedMutationsCount,
    });

    this.dirtyFlags.clear();
  }

  resetStats(): void {
    this.dirtyFlags.clear();
  }
}

export const stateSync = new StateSyncController();
