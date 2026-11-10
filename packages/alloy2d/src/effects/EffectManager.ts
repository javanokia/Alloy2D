/**
 * 引擎通用特效管理器 (v1.1 从各游戏工程下沉)
 * 粒子爆裂 + 浮动文字，基于 Pool<T> 对象池复用，避免高频 GC 卡顿
 */
import { Container, ITextStyle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { Pool } from '../utils/Pool';

export interface BurstOptions {
  /** 默认粒子数量 */
  count: number;
  speedMin: number;
  speedMax: number;
  /** 初速度额外的向上偏移 (正数向上) */
  upwardBias: number;
  gravity: number;
  lifeMin: number;
  lifeMax: number;
  scaleMin: number;
  scaleMax: number;
  /** 透明度衰减曲线：linear = 1 - p，quadratic = 1 - p² */
  fade: 'linear' | 'quadratic';
}

export interface FloatingTextOptions {
  vy: number;
  maxLife: number;
  startScale: number;
  /** pop：先放大再回落，末段淡出；drift：匀速放大并线性淡出 */
  animation: 'pop' | 'drift';
}

export interface EffectManagerOptions {
  /** 粒子纹理获取函数 (延迟到首次创建粒子时调用，便于图集重建后取到新纹理) */
  particleTexture: () => Texture | null | undefined;
  textStyle?: Partial<ITextStyle>;
  particlePoolSize?: number;
  textPoolSize?: number;
  burst?: Partial<BurstOptions>;
  floatingText?: Partial<FloatingTextOptions>;
}

/** 与 EngineInspectorDock 的 InspectorPoolTelemetry 结构一致 */
export interface EffectTelemetry {
  particleActive: number;
  particleAvailable: number;
  textActive: number;
  textAvailable: number;
  totalHits: number;
  totalCreated: number;
}

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

export const DEFAULT_BURST_OPTIONS: BurstOptions = {
  count: 8,
  speedMin: 2.5,
  speedMax: 7,
  upwardBias: 1.8,
  gravity: 0.22,
  lifeMin: 24,
  lifeMax: 38,
  scaleMin: 0.22,
  scaleMax: 0.44,
  fade: 'linear',
};

export const DEFAULT_FLOATING_TEXT_OPTIONS: FloatingTextOptions = {
  vy: -1.8,
  maxLife: 40,
  startScale: 0.8,
  animation: 'pop',
};

export const DEFAULT_FLOATING_TEXT_STYLE: Partial<ITextStyle> = {
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
};

export class EffectManager {
  public readonly particleContainer: Container;
  public readonly textContainer: Container;

  protected readonly burstOptions: BurstOptions;
  protected readonly textOptions: FloatingTextOptions;

  private readonly particlePool: Pool<ParticleItem>;
  private readonly textPool: Pool<FloatingTextItem>;
  private readonly activeParticles = new Set<ParticleItem>();
  private readonly activeTexts = new Set<FloatingTextItem>();

  constructor(options: EffectManagerOptions) {
    this.particleContainer = new Container();
    this.textContainer = new Container();
    this.burstOptions = { ...DEFAULT_BURST_OPTIONS, ...options.burst };
    this.textOptions = { ...DEFAULT_FLOATING_TEXT_OPTIONS, ...options.floatingText };

    const textStyle = new TextStyle({ ...DEFAULT_FLOATING_TEXT_STYLE, ...options.textStyle });

    this.particlePool = new Pool<ParticleItem>(
      () => {
        const sprite = new Sprite(options.particleTexture() ?? Texture.EMPTY);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        this.particleContainer.addChild(sprite);
        return { sprite, vx: 0, vy: 0, gravity: 0, life: 0, maxLife: 1, rotSpeed: 0 };
      },
      (item) => {
        item.sprite.visible = false;
        item.sprite.alpha = 1;
        item.sprite.scale.set(1);
        item.life = 0;
      },
      options.particlePoolSize ?? 40
    );

    this.textPool = new Pool<FloatingTextItem>(
      () => {
        const textObj = new Text('', textStyle);
        textObj.anchor.set(0.5);
        textObj.visible = false;
        this.textContainer.addChild(textObj);
        return { textObj, vy: this.textOptions.vy, life: 0, maxLife: this.textOptions.maxLife };
      },
      (item) => {
        item.textObj.visible = false;
        item.textObj.alpha = 1;
        item.textObj.scale.set(1);
        item.life = 0;
      },
      options.textPoolSize ?? 12
    );
  }

  /** 在 (x, y) 处以 tint 颜色向四周爆裂粒子 */
  spawnBurst(x: number, y: number, tint = 0xffffff, count = this.burstOptions.count): void {
    const o = this.burstOptions;
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = o.speedMin + Math.random() * (o.speedMax - o.speedMin);

      p.sprite.x = x;
      p.sprite.y = y;
      p.sprite.tint = tint;
      p.sprite.scale.set(o.scaleMin + Math.random() * (o.scaleMax - o.scaleMin));
      p.sprite.alpha = 1;
      p.sprite.visible = true;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - o.upwardBias;
      p.gravity = o.gravity;
      p.life = 0;
      p.maxLife = o.lifeMin + Math.floor(Math.random() * Math.max(1, o.lifeMax - o.lifeMin));
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
    item.textObj.scale.set(this.textOptions.startScale);
    item.textObj.visible = true;
    item.vy = this.textOptions.vy;
    item.life = 0;
    item.maxLife = this.textOptions.maxLife;
    this.activeTexts.add(item);
  }

  update(delta: number): void {
    const quadratic = this.burstOptions.fade === 'quadratic';
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
      p.sprite.alpha = Math.max(0, quadratic ? 1 - progress * progress : 1 - progress);
    }

    const { animation, startScale } = this.textOptions;
    for (const t of Array.from(this.activeTexts)) {
      t.life += delta;
      if (t.life >= t.maxLife) {
        this.activeTexts.delete(t);
        this.textPool.release(t);
        continue;
      }
      const progress = t.life / t.maxLife;
      t.textObj.y += t.vy * delta;
      if (animation === 'pop') {
        const peak = startScale + 0.4;
        const scale = progress < 0.2 ? startScale + progress * 2 : peak - (progress - 0.2) * 0.25;
        t.textObj.scale.set(scale);
        t.textObj.alpha = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;
      } else {
        t.textObj.scale.set(startScale + progress * 0.25);
        t.textObj.alpha = Math.max(0, 1 - progress);
      }
    }
  }

  get activeCount(): { particles: number; texts: number } {
    return { particles: this.activeParticles.size, texts: this.activeTexts.size };
  }

  getTelemetry(): EffectTelemetry {
    const p = this.particlePool.stats;
    const t = this.textPool.stats;
    return {
      particleActive: p.active,
      particleAvailable: p.available,
      textActive: t.active,
      textAvailable: t.available,
      totalHits: p.totalHits + t.totalHits,
      totalCreated: p.totalCreated + t.totalCreated,
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
