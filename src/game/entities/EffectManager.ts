import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { Pool } from '../../utils/Pool';
import { assetManager, TILE_THEMES } from '../assets/AssetManager';

interface ParticleItem {
  sprite: Sprite;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  rotSpeed: number;
}

interface FloatingTextItem {
  textObj: Text;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * 粒子与飘字特效管理器 (对应文章 6.2 节：粒子特效、飘字、临时精灵全部走对象池 Pool<T> 复用，降低 GC 频率)
 * 同时将同图集粒子放在连续 Container 中以保持渲染批次合并 (对应文章 6.3 节)
 */
export class EffectManager {
  public readonly particleContainer: Container;
  public readonly textContainer: Container;

  private particlePool: Pool<ParticleItem>;
  private textPool: Pool<FloatingTextItem>;

  private activeParticles: Set<ParticleItem> = new Set();
  private activeTexts: Set<FloatingTextItem> = new Set();

  constructor() {
    this.particleContainer = new Container();
    this.textContainer = new Container();

    const textStyle = new TextStyle({
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 28,
      fontWeight: '900',
      fill: ['#ffffff', '#fde047'],
      stroke: '#0f172a',
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 2,
    });

    this.particlePool = new Pool<ParticleItem>(
      () => {
        const tex = assetManager.get('particle_star');
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        this.particleContainer.addChild(sprite);
        return {
          sprite,
          vx: 0,
          vy: 0,
          gravity: 0.25,
          life: 0,
          maxLife: 32,
          rotSpeed: 0,
        };
      },
      (item) => {
        item.sprite.visible = false;
        item.sprite.alpha = 1;
        item.sprite.scale.set(1);
        item.life = 0;
      },
      40
    );

    this.textPool = new Pool<FloatingTextItem>(
      () => {
        const textObj = new Text('', textStyle);
        textObj.anchor.set(0.5);
        textObj.visible = false;
        this.textContainer.addChild(textObj);
        return {
          textObj,
          vy: -1.8,
          life: 0,
          maxLife: 42,
        };
      },
      (item) => {
        item.textObj.visible = false;
        item.textObj.alpha = 1;
        item.textObj.scale.set(1);
        item.life = 0;
      },
      12
    );
  }

  /**
   * 触发消除粒子爆发特效
   */
  spawnTileExplosion(x: number, y: number, tileType: number, count = 8): void {
    const theme = TILE_THEMES[tileType % TILE_THEMES.length];
    const color = theme ? theme.hexColor : 0xffffff;

    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2.5 + Math.random() * 4.5;

      p.sprite.x = x;
      p.sprite.y = y;
      p.sprite.tint = color;
      p.sprite.scale.set(0.22 + Math.random() * 0.22);
      p.sprite.alpha = 1;
      p.sprite.visible = true;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1.8;
      p.gravity = 0.22;
      p.life = 0;
      p.maxLife = 24 + Math.floor(Math.random() * 14);
      p.rotSpeed = (Math.random() - 0.5) * 0.2;

      this.activeParticles.add(p);
    }
  }

  /**
   * 触发浮动得分/连击文字
   */
  spawnFloatingText(x: number, y: number, content: string): void {
    const item = this.textPool.acquire();
    item.textObj.text = content;
    item.textObj.x = x;
    item.textObj.y = y;
    item.textObj.alpha = 1;
    item.textObj.scale.set(0.8);
    item.textObj.visible = true;
    item.vy = -1.8;
    item.life = 0;
    item.maxLife = 40;

    this.activeTexts.add(item);
  }

  /**
   * 在 Pixi 主循环 ticker 中每帧更新
   */
  update(delta: number): void {
    for (const p of Array.from(this.activeParticles)) {
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.activeParticles.delete(p);
        this.particlePool.release(p);
        continue;
      }
      const progress = p.life / p.maxLife;
      p.sprite.x += p.vx * delta;
      p.sprite.y += p.vy * delta;
      p.vy += p.gravity * delta;
      p.sprite.rotation += p.rotSpeed * delta;
      p.sprite.alpha = Math.max(0, 1 - progress);
    }

    for (const t of Array.from(this.activeTexts)) {
      t.life += delta;
      if (t.life >= t.maxLife) {
        this.activeTexts.delete(t);
        this.textPool.release(t);
        continue;
      }
      const progress = t.life / t.maxLife;
      t.textObj.y += t.vy * delta;
      const scale = progress < 0.2 ? 0.8 + progress * 2 : 1.2 - (progress - 0.2) * 0.25;
      t.textObj.scale.set(scale);
      t.textObj.alpha = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;
    }
  }

  getTelemetry() {
    const pStats = this.particlePool.stats;
    const tStats = this.textPool.stats;
    return {
      particleActive: pStats.active,
      particleAvailable: pStats.available,
      textActive: tStats.active,
      textAvailable: tStats.available,
      totalHits: pStats.totalHits + tStats.totalHits,
      totalCreated: pStats.totalCreated + tStats.totalCreated,
    };
  }

  destroy(): void {
    this.activeParticles.clear();
    this.activeTexts.clear();
    this.particlePool.clear();
    this.textPool.clear();
    this.particleContainer.destroy({ children: true });
    this.textContainer.destroy({ children: true });
  }
}
