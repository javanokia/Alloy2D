import { Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js';
import {
  animateTransform,
  Easing,
  EffectManager,
  gameEvents,
  platform,
} from 'alloy2d';
import { FRUIT_CONFIGS, suikaAssetManager } from '../assets/SuikaAssetManager';
import { CircleBody, CirclePhysicsWorld } from '../physics/CirclePhysicsWorld';
import { useSuikaStore } from '../store/useSuikaStore';

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

// 游戏箱体边界定义
export const JAR_LEFT = 60;
export const JAR_RIGHT = 690;
export const JAR_BOTTOM = 1180;
export const JAR_DANGER_Y = 360;
export const DROP_Y = 220;

function safeVibrate(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  const g = globalThis as unknown as { wx?: { vibrateShort?: (opt: { type: string }) => void } };
  if (typeof g.wx !== 'undefined' && typeof g.wx.vibrateShort === 'function') {
    try {
      g.wx.vibrateShort({ type });
    } catch {}
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(type === 'heavy' ? 40 : 15);
    } catch {}
  }
}

export class SuikaGameSystem {
  public readonly rootContainer: Container;
  public readonly bgContainer: Container;
  public readonly jarContainer: Container;
  public readonly fruitContainer: Container;
  public readonly effectsContainer: Container;
  public readonly uiOverlayContainer: Container;

  private physicsWorld: CirclePhysicsWorld;
  private effectManager: EffectManager;

  // 准备发射的水果
  private dropperContainer: Container;
  private currentFruitSprite: Sprite | null = null;
  private currentTier = 0;
  private nextTier = 0;
  private isDropping = false; // 是否在等待下落冷却
  private dropCooldown = 0;
  private aimLineGraphics: Graphics;
  private dangerLineGraphics: Graphics;

  private shakeTimer = 0;
  private shakeIntensity = 0;

  constructor() {
    this.rootContainer = new Container();

    this.bgContainer = new Container();
    this.jarContainer = new Container();
    this.fruitContainer = new Container();
    this.effectsContainer = new Container();
    this.uiOverlayContainer = new Container();

    this.rootContainer.addChild(this.bgContainer);
    this.rootContainer.addChild(this.jarContainer);
    this.rootContainer.addChild(this.fruitContainer);
    this.rootContainer.addChild(this.effectsContainer);
    this.rootContainer.addChild(this.uiOverlayContainer);

    this.effectManager = new EffectManager({
      particleTexture: () => suikaAssetManager.get('particle_star')!,
      particlePoolSize: 60,
      textPoolSize: 20,
    });
    this.effectsContainer.addChild(this.effectManager.particleContainer);
    this.effectsContainer.addChild(this.effectManager.textContainer);

    this.physicsWorld = new CirclePhysicsWorld({
      boundary: {
        left: JAR_LEFT,
        right: JAR_RIGHT,
        bottom: JAR_BOTTOM,
        dangerY: JAR_DANGER_Y,
      },
      onMerge: (b1, b2) => this.handleFruitMerge(b1, b2),
      onDangerChange: (danger) => useSuikaStore.getState().setDanger(danger),
    });

    this.aimLineGraphics = new Graphics();
    this.dangerLineGraphics = new Graphics();
    this.dropperContainer = new Container();

    this.createBackground();
    this.createJarGraphics();
    this.createDangerLine();

    this.uiOverlayContainer.addChild(this.aimLineGraphics);
    this.uiOverlayContainer.addChild(this.dropperContainer);

    this.bindInteractions();
    this.bindStoreEvents();
  }

  private createBackground(): void {
    const bg = new Graphics();
    bg.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    bg.fill({ color: 0xffedd5, alpha: 1 });

    bg.rect(0, 0, DESIGN_WIDTH, 260);
    bg.fill({ color: 0xfed7aa, alpha: 0.6 });

    bg.rect(0, JAR_BOTTOM, DESIGN_WIDTH, DESIGN_HEIGHT - JAR_BOTTOM);
    bg.fill({ color: 0x78350f, alpha: 0.95 });

    bg.cacheAsBitmap = true;
    this.bgContainer.addChild(bg);
  }

  private createJarGraphics(): void {
    const jar = new Graphics();
    const w = JAR_RIGHT - JAR_LEFT;
    const h = JAR_BOTTOM - JAR_DANGER_Y;

    // 1. 容器内部磨砂半透明背景
    jar.roundRect(JAR_LEFT, JAR_DANGER_Y, w, h, 28);
    jar.fill({ color: 0xffffff, alpha: 0.55 });

    // 2. 容器精致玻璃反光边框
    jar.roundRect(JAR_LEFT, JAR_DANGER_Y, w, h, 28);
    jar.stroke({ width: 8, color: 0xfdba74, alpha: 0.9 });

    // 3. 底部木质承重底座
    jar.roundRect(JAR_LEFT - 12, JAR_BOTTOM - 6, w + 24, 28, 12);
    jar.fill({ color: 0x9a3412, alpha: 0.95 });
    jar.stroke({ width: 3, color: 0xc2410c, alpha: 0.8 });

    jar.cacheAsBitmap = true;
    this.jarContainer.addChild(jar);
  }

  private createDangerLine(): void {
    this.dangerLineGraphics.clear();
    const y = JAR_DANGER_Y;

    const dash = 14;
    const gap = 10;
    for (let x = JAR_LEFT + 10; x < JAR_RIGHT - 10; x += dash + gap) {
      this.dangerLineGraphics.moveTo(x, y);
      this.dangerLineGraphics.lineTo(Math.min(x + dash, JAR_RIGHT - 10), y);
    }
    this.dangerLineGraphics.stroke({ width: 3, color: 0xef4444, alpha: 0.85 });

    this.jarContainer.addChild(this.dangerLineGraphics);
  }

  private bindInteractions(): void {
    this.rootContainer.eventMode = 'static';
    this.rootContainer.hitArea = {
      contains: (x: number, y: number) => x >= 0 && x <= DESIGN_WIDTH && y >= 0 && y <= DESIGN_HEIGHT,
    };

    let isTouching = false;

    this.rootContainer.on('pointerdown', (e: FederatedPointerEvent) => {
      const { isGameOver, activeItemMode } = useSuikaStore.getState();
      if (isGameOver) return;

      const pos = e.getLocalPosition(this.rootContainer);

      if (activeItemMode) {
        this.handlePropTargetClick(pos.x, pos.y, activeItemMode);
        return;
      }

      isTouching = true;
      this.updateDropperPosition(pos.x);
    });

    this.rootContainer.on('pointermove', (e: FederatedPointerEvent) => {
      if (!isTouching || this.isDropping) return;
      const pos = e.getLocalPosition(this.rootContainer);
      this.updateDropperPosition(pos.x);
    });

    const releaseDrop = () => {
      if (!isTouching) return;
      isTouching = false;
      if (!this.isDropping) {
        this.dropCurrentFruit();
      }
    };

    this.rootContainer.on('pointerup', releaseDrop);
    this.rootContainer.on('pointerupoutside', releaseDrop);
  }

  private bindStoreEvents(): void {
    gameEvents.on('suika-shake', () => {
      platform.playSound('click');
      this.triggerEarthquake();
    });
  }

  public initGame(): void {
    this.physicsWorld.clear();
    useSuikaStore.getState().resetGame();

    this.currentTier = Math.floor(Math.random() * 3);
    this.nextTier = Math.floor(Math.random() * 3);
    useSuikaStore.getState().setNextTier(this.nextTier);

    this.dropperContainer.x = DESIGN_WIDTH / 2;
    this.dropperContainer.y = DROP_Y;
    this.spawnDropperFruit();
    this.updateAimLine();
  }

  private updateDropperPosition(targetX: number): void {
    const fruit = FRUIT_CONFIGS[this.currentTier];
    const clampedX = Math.max(
      JAR_LEFT + fruit.radius + 10,
      Math.min(JAR_RIGHT - fruit.radius - 10, targetX)
    );
    this.dropperContainer.x = clampedX;
    this.updateAimLine();
  }

  private updateAimLine(): void {
    this.aimLineGraphics.clear();
    if (this.isDropping) return;

    const x = this.dropperContainer.x;
    const startY = DROP_Y + FRUIT_CONFIGS[this.currentTier].radius;
    const endY = JAR_BOTTOM;

    const dash = 12;
    const gap = 12;
    for (let y = startY + 10; y < endY - 10; y += dash + gap) {
      this.aimLineGraphics.moveTo(x, y);
      this.aimLineGraphics.lineTo(x, Math.min(y + dash, endY - 10));
    }
    this.aimLineGraphics.stroke({ width: 2, color: 0xf97316, alpha: 0.45 });

    this.aimLineGraphics.circle(x, endY - 12, 10);
    this.aimLineGraphics.fill({ color: 0xf97316, alpha: 0.35 });
  }

  private spawnDropperFruit(): void {
    if (this.currentFruitSprite) {
      this.dropperContainer.removeChild(this.currentFruitSprite);
      this.currentFruitSprite.destroy();
      this.currentFruitSprite = null;
    }

    const tex = suikaAssetManager.getFruitTexture(this.currentTier);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cfg = FRUIT_CONFIGS[this.currentTier];
    const size = cfg.radius * 2;
    sprite.width = size;
    sprite.height = size;

    this.dropperContainer.addChild(sprite);
    this.currentFruitSprite = sprite;

    sprite.scale.set(0.2);
    animateTransform(sprite, {
      toScaleX: 1,
      toScaleY: 1,
      durationMS: 160,
      ease: Easing.easeOutBack,
    });
  }

  private dropCurrentFruit(): void {
    if (this.isDropping) return;
    this.isDropping = true;
    this.aimLineGraphics.clear();

    const spawnX = this.dropperContainer.x;
    const spawnY = this.dropperContainer.y;
    const tier = this.currentTier;

    if (this.currentFruitSprite) {
      this.dropperContainer.removeChild(this.currentFruitSprite);
      this.currentFruitSprite.destroy();
      this.currentFruitSprite = null;
    }

    this.createPhysicsFruit(spawnX, spawnY, tier, 0, 3);
    platform.playSound('click');

    this.dropCooldown = 500;
    this.currentTier = this.nextTier;
    this.nextTier = Math.floor(Math.random() * 4);
    useSuikaStore.getState().setNextTier(this.nextTier);

    setTimeout(() => {
      this.isDropping = false;
      this.spawnDropperFruit();
      this.updateAimLine();
    }, this.dropCooldown);
  }

  private createPhysicsFruit(
    x: number,
    y: number,
    tier: number,
    vx = 0,
    vy = 0
  ): CircleBody {
    const cfg = FRUIT_CONFIGS[tier];
    const tex = suikaAssetManager.getFruitTexture(tier);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const size = cfg.radius * 2;
    sprite.width = size;
    sprite.height = size;
    sprite.x = x;
    sprite.y = y;

    this.fruitContainer.addChild(sprite);

    const body: CircleBody = {
      id: `fruit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tier,
      x,
      y,
      vx,
      vy,
      radius: cfg.radius,
      mass: (cfg.radius * cfg.radius) / 100,
      isMerging: false,
      spawnTime: performance.now(),
      sprite,
    };

    this.physicsWorld.addBody(body);
    return body;
  }

  private handleFruitMerge(b1: CircleBody, b2: CircleBody): void {
    const nextTier = b1.tier + 1;
    const midX = (b1.x + b2.x) / 2;
    const midY = (b1.y + b2.y) / 2;

    this.physicsWorld.removeBody(b1.id);
    this.physicsWorld.removeBody(b2.id);

    // 播放消失缩放动画后销毁
    animateTransform(b1.sprite, {
      toScaleX: 0,
      toScaleY: 0,
      durationMS: 120,
      ease: Easing.easeInBack,
    }).then(() => {
      if (b1.sprite.parent) b1.sprite.parent.removeChild(b1.sprite);
      b1.sprite.destroy();
    });

    animateTransform(b2.sprite, {
      toScaleX: 0,
      toScaleY: 0,
      durationMS: 120,
      ease: Easing.easeInBack,
    }).then(() => {
      if (b2.sprite.parent) b2.sprite.parent.removeChild(b2.sprite);
      b2.sprite.destroy();
    });

    // 生成进化后的新实体
    const newBody = this.createPhysicsFruit(midX, midY, nextTier, (b1.vx + b2.vx) * 0.4, -2.5);
    newBody.sprite.scale.set(0.4);
    animateTransform(newBody.sprite, {
      toScaleX: 1,
      toScaleY: 1,
      durationMS: 200,
      ease: Easing.easeOutBack,
    });

    // 粒子喷发与飘字
    const targetCfg = FRUIT_CONFIGS[nextTier];
    const tintColor = parseInt(targetCfg.primaryColor.replace('#', ''), 16);
    this.effectManager.spawnBurst(midX, midY, tintColor, 14);
    this.effectManager.spawnFloatingText(midX, midY - 20, `+${targetCfg.score}`);

    // 播放升级合成音效与触觉反馈
    platform.playSound('match');
    safeVibrate('light');

    // 加分与连击
    useSuikaStore.getState().addScore(targetCfg.score, true);

    // 触发轻微震屏
    this.triggerScreenShake(nextTier >= 7 ? 8 : 4);
  }

  private handlePropTargetClick(clickX: number, clickY: number, mode: 'bomb' | 'upgrade'): void {
    let target: CircleBody | null = null;
    for (const b of this.physicsWorld.bodies) {
      const dx = b.x - clickX;
      const dy = b.y - clickY;
      if (dx * dx + dy * dy <= b.radius * b.radius * 1.4) {
        target = b;
        break;
      }
    }

    if (!target) return;

    if (mode === 'bomb') {
      this.physicsWorld.removeBody(target.id);
      this.effectManager.spawnBurst(target.x, target.y, 0xef4444, 24);
      platform.playSound('invalid');
      safeVibrate('medium');
      this.physicsWorld.applyExplosionImpulse(target.x, target.y);
      if (target.sprite.parent) target.sprite.parent.removeChild(target.sprite);
      target.sprite.destroy();
      useSuikaStore.getState().setActiveItemMode(null);
    } else if (mode === 'upgrade') {
      if (target.tier < 10) {
        const nextTier = target.tier + 1;
        const tx = target.x;
        const ty = target.y;
        this.physicsWorld.removeBody(target.id);
        if (target.sprite.parent) target.sprite.parent.removeChild(target.sprite);
        target.sprite.destroy();

        const upgraded = this.createPhysicsFruit(tx, ty, nextTier, 0, -2);
        upgraded.sprite.scale.set(0.3);
        animateTransform(upgraded.sprite, {
          toScaleX: 1,
          toScaleY: 1,
          durationMS: 200,
          ease: Easing.easeOutBack,
        });
        platform.playSound('powerup');
        safeVibrate('heavy');
      }
      useSuikaStore.getState().setActiveItemMode(null);
    }
  }

  public triggerEarthquake(): void {
    this.physicsWorld.applyEarthquake();
    this.triggerScreenShake(12, 400);
    safeVibrate('heavy');
  }

  public triggerScreenShake(intensity = 6, durationMS = 200): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = durationMS;
  }

  public update(delta: number): void {
    const { isGameOver } = useSuikaStore.getState();
    if (isGameOver) return;

    this.physicsWorld.update(delta);
    this.effectManager.update(delta);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta * 16.6;
      const ox = (Math.random() - 0.5) * this.shakeIntensity;
      const oy = (Math.random() - 0.5) * this.shakeIntensity;
      this.rootContainer.x = ox;
      this.rootContainer.y = oy;
      if (this.shakeTimer <= 0) {
        this.rootContainer.x = 0;
        this.rootContainer.y = 0;
      }
    }

    const dangerDuration = this.physicsWorld.getDangerDuration();
    if (dangerDuration > 0) {
      const alpha = 0.4 + Math.sin(performance.now() * 0.01) * 0.45;
      this.dangerLineGraphics.alpha = alpha;

      if (dangerDuration >= 3.0) {
        useSuikaStore.getState().setGameOver(true);
        platform.playSound('invalid');
        safeVibrate('heavy');
      }
    } else {
      this.dangerLineGraphics.alpha = 0.85;
    }
  }

  public destroy(): void {
    this.physicsWorld.clear();
    this.effectManager.destroy();
    this.rootContainer.destroy({ children: true });
  }
}
