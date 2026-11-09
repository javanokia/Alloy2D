/**
 * 通用对象池 (对应文章 6.2 节：避免频繁创建销毁导致 GC 帧率波动)
 */
export class Pool<T> {
  private available: T[] = [];
  private factory: () => T;
  private reset: (item: T) => void;
  private _activeCount = 0;
  private _totalCreated = 0;
  private _totalHits = 0;

  constructor(factory: () => T, reset: (item: T) => void, initialSize = 20) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
      this._totalCreated++;
    }
  }

  acquire(): T {
    this._activeCount++;
    if (this.available.length > 0) {
      this._totalHits++;
      return this.available.pop()!;
    }
    this._totalCreated++;
    return this.factory();
  }

  release(item: T): void {
    this.reset(item);
    this._activeCount = Math.max(0, this._activeCount - 1);
    this.available.push(item);
  }

  clear(): void {
    this.available = [];
    this._activeCount = 0;
  }

  get stats() {
    return {
      available: this.available.length,
      active: this._activeCount,
      totalCreated: this._totalCreated,
      totalHits: this._totalHits,
    };
  }
}
