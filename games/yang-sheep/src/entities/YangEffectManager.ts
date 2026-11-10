import { EffectManager } from '@wegame/hybrid-engine';
import { TILE_THEMES, yangAssetManager } from '../assets/YangAssetManager';

/**
 * 《羊了个羊》粒子爆裂与浮动文字特效
 * 基于引擎通用 EffectManager (Pool<T> 对象池复用)，仅保留牌面配色与玩法参数
 */
export class YangEffectManager extends EffectManager {
  constructor() {
    super({
      particleTexture: () => yangAssetManager.get('particle_star'),
      burst: { count: 12, fade: 'quadratic' },
      floatingText: { startScale: 0.85, maxLife: 40, animation: 'drift' },
    });
  }

  spawnTileExplosion(x: number, y: number, tileType: number, count = 12): void {
    const theme = TILE_THEMES[tileType % TILE_THEMES.length];
    this.spawnBurst(x, y, theme ? theme.hexColor : 0xffffff, count);
  }
}
