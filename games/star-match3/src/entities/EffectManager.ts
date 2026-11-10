import { EffectManager as EngineEffectManager } from '@wegame/hybrid-engine';
import { assetManager, TILE_THEMES } from '../assets/Match3AssetManager';

/**
 * 星耀三消特效：基于引擎通用 EffectManager，仅保留三消玩法相关的方块爆裂配色
 */
export class EffectManager extends EngineEffectManager {
  constructor() {
    super({
      particleTexture: () => assetManager.get('particle_star'),
      burst: { count: 8 },
      floatingText: { startScale: 0.8, maxLife: 40, animation: 'pop' },
    });
  }

  spawnTileExplosion(x: number, y: number, tileType: number, count = 8): void {
    const theme = TILE_THEMES[tileType % TILE_THEMES.length];
    this.spawnBurst(x, y, theme ? theme.hexColor : 0xffffff, count);
  }
}
