import { describe, expect, it, vi } from 'vitest';
import { MemorySaveDriver, SaveManager } from '../storage/SaveManager';

interface PlayerProfileV1 {
  coins: number;
  highScore: number;
}

interface PlayerProfileV2 {
  coins: number;
  highScore: number;
  unlockedCharacters: string[];
}

interface PlayerProfileV3 {
  coins: number;
  highScore: number;
  unlockedCharacters: string[];
  settings: {
    bgmVolume: number;
    sfxVolume: number;
  };
}

describe('SaveManager (类型化持久化存档与版本平滑迁移)', () => {
  it('初次读取时生成默认数据并存盘', () => {
    const driver = new MemorySaveDriver();
    const save = new SaveManager<PlayerProfileV1>({
      key: 'player_profile',
      version: 1,
      defaultData: { coins: 100, highScore: 0 },
      driver,
    });

    const data = save.get();
    expect(data.coins).toBe(100);
    expect(data.highScore).toBe(0);

    const raw = driver.get('player_profile');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).data.coins).toBe(100);
  });

  it('更新存档 save(updater) 触发持久化并通知 onChange 订阅者', () => {
    const driver = new MemorySaveDriver();
    const save = new SaveManager<PlayerProfileV1>({
      key: 'player_profile',
      version: 1,
      defaultData: { coins: 100, highScore: 0 },
      driver,
    });

    const listener = vi.fn();
    save.onChange(listener);

    save.save({ coins: 250 });
    expect(save.get().coins).toBe(250);
    expect(listener).toHaveBeenCalledWith({ coins: 250, highScore: 0 });

    // 函数式更新
    save.save((prev) => ({ ...prev, highScore: 999 }));
    expect(save.get().highScore).toBe(999);
  });

  it('跨版本自动迁移链 (Schema Migration: V1 -> V2 -> V3)', () => {
    const driver = new MemorySaveDriver();

    // 预先写入一份旧版本的 V1 存档
    driver.set(
      'player_profile',
      JSON.stringify({
        version: 1,
        updatedAt: 1000,
        data: { coins: 300, highScore: 50 },
      })
    );

    // 用 V3 版本的结构初始化 SaveManager，并配置迁移函数链
    const saveV3 = new SaveManager<PlayerProfileV3>({
      key: 'player_profile',
      version: 3,
      defaultData: {
        coins: 0,
        highScore: 0,
        unlockedCharacters: ['default'],
        settings: { bgmVolume: 1, sfxVolume: 1 },
      },
      migrations: {
        1: (old: unknown) => {
          const v1 = old as PlayerProfileV1;
          const v2: PlayerProfileV2 = {
            ...v1,
            unlockedCharacters: ['hero_starter'],
          };
          return v2;
        },
        2: (old: unknown) => {
          const v2 = old as PlayerProfileV2;
          const v3: PlayerProfileV3 = {
            ...v2,
            settings: { bgmVolume: 0.8, sfxVolume: 0.8 },
          };
          return v3;
        },
      },
      driver,
    });

    const upgraded = saveV3.get();
    expect(upgraded.coins).toBe(300); // 保留 V1 的旧数据
    expect(upgraded.unlockedCharacters).toEqual(['hero_starter']); // 来自 V1->V2 迁移
    expect(upgraded.settings.bgmVolume).toBe(0.8); // 来自 V2->V3 迁移

    // 检查存储中的版本号是否已被提升为 3
    const savedRaw = JSON.parse(driver.get('player_profile')!);
    expect(savedRaw.version).toBe(3);
  });

  it('损坏或非法 JSON 自动优雅降级到默认数据，杜绝游戏闪退', () => {
    const driver = new MemorySaveDriver();
    driver.set('player_profile', 'BROKEN_CORRUPTED_JSON_123{{{');

    const save = new SaveManager<PlayerProfileV1>({
      key: 'player_profile',
      version: 1,
      defaultData: { coins: 50, highScore: 0 },
      driver,
    });

    expect(() => save.get()).not.toThrow();
    expect(save.get().coins).toBe(50);
  });

  it('exportJson 与 importJson 支持存档导出与恢复', () => {
    const driver = new MemorySaveDriver();
    const save = new SaveManager<PlayerProfileV1>({
      key: 'player_profile',
      version: 1,
      defaultData: { coins: 500, highScore: 100 },
      driver,
    });

    const exported = save.exportJson();
    expect(typeof exported).toBe('string');

    // 清空重置
    save.reset();
    expect(save.get().coins).toBe(500);

    save.save({ coins: 0 });
    expect(save.get().coins).toBe(0);

    // 导入恢复
    const ok = save.importJson(exported);
    expect(ok).toBe(true);
    expect(save.get().coins).toBe(500);
  });
});
