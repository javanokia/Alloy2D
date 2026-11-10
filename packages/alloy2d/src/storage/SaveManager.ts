/**
 * 引擎通用类型化持久化存档系统 (v1.1 新增)
 * - 自动化版本管理与跨版本平滑迁移 (Schema Migrations)
 * - 脏数据与损坏数据安全兜底，杜绝反序列化崩溃
 * - 内存缓存与持久化同步，支持多处变更订阅
 */
import { platform, PlatformAdapter } from '../platform/PlatformAdapter';

export interface SaveDriver {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface SaveEnvelope<T> {
  version: number;
  updatedAt: number;
  data: T;
}

export type MigrationFn = (oldData: unknown) => unknown;

export interface SaveManagerOptions<TData> {
  /** 存储键名 (引擎内部会自动添加命名空间前缀) */
  key: string;
  /** 当前数据结构的目标版本号 (从 1 开始的正整数) */
  version: number;
  /** 默认初始数据 (支持传入静态对象或工厂函数) */
  defaultData: TData | (() => TData);
  /** 版本升级迁移函数表：key 为升级前的旧版本号，value 为将其转换为下一版本的纯函数 */
  migrations?: Record<number, MigrationFn>;
  /** 可选注入存储驱动 (默认使用 platform.getStorage / setStorage) */
  driver?: SaveDriver;
}

export class DefaultPlatformSaveDriver implements SaveDriver {
  constructor(private readonly p: PlatformAdapter = platform) {}

  get(key: string): string | null {
    return this.p.getStorage(key);
  }

  set(key: string, value: string): void {
    this.p.setStorage(key, value);
  }
}

export class MemorySaveDriver implements SaveDriver {
  private map = new Map<string, string>();

  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }
}

export class SaveManager<TData> {
  public readonly key: string;
  public readonly version: number;

  private readonly driver: SaveDriver;
  private readonly defaultFactory: () => TData;
  private readonly migrations: Record<number, MigrationFn>;
  private cache: TData | null = null;
  private listeners = new Set<(data: TData) => void>();

  constructor(options: SaveManagerOptions<TData>) {
    this.key = options.key;
    this.version = Math.max(1, Math.floor(options.version));
    this.driver = options.driver ?? new DefaultPlatformSaveDriver();
    this.migrations = options.migrations ?? {};

    const def = options.defaultData;
    this.defaultFactory = typeof def === 'function' ? (def as () => TData) : () => JSON.parse(JSON.stringify(def));
  }

  /**
   * 获取当前缓存的数据 (未加载时会自动执行 load)
   */
  public get(): TData {
    if (this.cache === null) {
      this.cache = this.load();
    }
    return this.cache;
  }

  /**
   * 从持久化存储读取、校验并应用版本迁移
   */
  public load(): TData {
    const raw = this.driver.get(this.key);
    if (!raw) {
      const initial = this.defaultFactory();
      this.writeToStorage(initial, this.version);
      this.cache = initial;
      return initial;
    }

    try {
      const envelope = JSON.parse(raw) as SaveEnvelope<unknown>;
      if (!envelope || typeof envelope !== 'object' || typeof envelope.version !== 'number') {
        throw new Error('Invalid save envelope structure');
      }

      let curVer = envelope.version;
      let curData = envelope.data;

      // 执行版本迁移链
      while (curVer < this.version) {
        const migration = this.migrations[curVer];
        if (typeof migration === 'function') {
          curData = migration(curData);
          curVer++;
        } else {
          // 缺少迁移函数，合并默认字段兜底
          curData = { ...this.defaultFactory(), ...(typeof curData === 'object' && curData ? curData : {}) };
          curVer = this.version;
          break;
        }
      }

      const validatedData = curData as TData;
      // 若版本发生过升级，立即回写升级后的存档
      if (envelope.version !== this.version) {
        this.writeToStorage(validatedData, this.version);
      }

      this.cache = validatedData;
      return validatedData;
    } catch {
      // 存储损坏时安全回退默认值
      const fallback = this.defaultFactory();
      this.writeToStorage(fallback, this.version);
      this.cache = fallback;
      return fallback;
    }
  }

  /**
   * 保存或更新存档并通知所有监听者
   */
  public save(updater?: Partial<TData> | ((prev: TData) => TData)): TData {
    const prev = this.get();
    let next: TData;

    if (typeof updater === 'function') {
      next = updater(prev);
    } else if (updater && typeof updater === 'object' && !Array.isArray(updater)) {
      next = { ...prev, ...updater };
    } else {
      next = prev;
    }

    this.cache = next;
    this.writeToStorage(next, this.version);
    this.notify(next);
    return next;
  }

  /**
   * 重置存档为初始默认状态
   */
  public reset(): TData {
    const fresh = this.defaultFactory();
    this.cache = fresh;
    this.writeToStorage(fresh, this.version);
    this.notify(fresh);
    return fresh;
  }

  /**
   * 监听存档数据变化
   */
  public onChange(listener: (data: TData) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 导出可分享/备份的 JSON 字符串
   */
  public exportJson(): string {
    const envelope: SaveEnvelope<TData> = {
      version: this.version,
      updatedAt: Date.now(),
      data: this.get(),
    };
    return JSON.stringify(envelope, null, 2);
  }

  /**
   * 导入外部存档 JSON
   */
  public importJson(jsonStr: string): boolean {
    try {
      const envelope = JSON.parse(jsonStr) as SaveEnvelope<unknown>;
      if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) {
        return false;
      }
      this.driver.set(this.key, jsonStr);
      this.load();
      this.notify(this.get());
      return true;
    } catch {
      return false;
    }
  }

  private writeToStorage(data: TData, version: number): void {
    const envelope: SaveEnvelope<TData> = {
      version,
      updatedAt: Date.now(),
      data,
    };
    try {
      this.driver.set(this.key, JSON.stringify(envelope));
    } catch {
      // 存储满或写入受限
    }
  }

  private notify(data: TData): void {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch {
        // ignore listener errors
      }
    }
  }
}
