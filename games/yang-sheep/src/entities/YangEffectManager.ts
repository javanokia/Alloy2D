import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { Pool, PoolStats } from '@wegame/hybrid-engine';
import { TILE_THEMES, yangAssetManager } from '../assets/YangAssetManager';

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
 * 《羊了个羊》粒子爆裂与浮动文字特效管理器
 * 使用 @wegame/hybrid-engine 的 Pool<T> 对象池复用，杜绝高频 GC 卡顿
 */
export class YangEffectManager {
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
        const tex = yangAssetManager.get('particle_star');
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
          maxLife: 40,
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

  spawnTileExplosion(x: number, y: number, tileType: number, count = 12): void {
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

  spawnFloatingText(x: number, y: number, content: string): void {
    const item = this.textPool.acquire();
    item.textObj.text = content;
    item.textObj.x = x;
    item.textObj.y = y;
    item.textObj.alpha = 1;
    item.textObj.scale.set(0.85);
    item.textObj.visible = true;
    item.vy = -1.8;
    item.life = 0;
    item.maxLife = 40;

    this.activeTexts.add(item);
  }

  update(delta: number): void {
    for (const p of Array.from(this.activeParticles)) {
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.activeParticles.delete(p);
        this.particlePool.release(p);
        continue;
      }
      p.vy += p.gravity * delta;
      p.sprite.x += p.vx * delta;
      p.sprite.y += p.vy * delta;
      p.sprite.rotation += p.rotSpeed * delta;
      const progress = p.life / p.maxLife;
      p.sprite.alpha = 1 - progress * progress;
    }

    for (const t of Array.from(this.activeTexts)) {
      t.life += delta;
      if (t.life >= t.maxLife) {
        this.activeTexts.delete(t);
        this.textPool.release(t);
        continue;
      }
      t.textObj.y += t.vy * delta;
      const progress = t.life / t.maxLife;
      t.textObj.alpha = 1 - progress;
      t.textObj.scale.set(0.85 + progress * 0.25);
    }
  }

  getTelemetry(): {
    particleStats: PoolStats;
    textStats: PoolStats;
  } {
    return {
      particleStats: this.particlePool.stats,
      textStats: this.textPool.stats,
    };
  }

  destroy(): void {
    this.particlePool.clear();
    this.textPool.clear();
    this.activeParticles.clear();
    this.activeTexts.clear();
    this.particleContainer.destroy({ children: true });
    this.textContainer.destroy({ children: true });
  }
}
