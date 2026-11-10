import { Container, FederatedPointerEvent, Graphics, Sprite, Texture } from 'pixi.js';
import { animateTo, animateTransform, Easing, gameEvents } from 'alloy2d';

export const CARD_WIDTH = 68;
export const CARD_HEIGHT = 82;

/**
 * 《羊了个羊》卡牌实体类
 * 包含：3D 立体卡牌、正版图案纹理、上层遮挡阴影、点击交互、平滑飞入卡槽动画、消除爆炸特效
 */
export class YangCard {
  public readonly id: string;
  public readonly type: number;
  public layer: number;
  public x: number;
  public y: number;
  public isCovered = false;

  public readonly container: Container;
  public readonly cardSprite: Sprite;
  private readonly shadowGraphics: Graphics;
  private readonly maskOverlay: Graphics;

  private isEliminating = false;

  constructor(id: string, type: number, layer: number, x: number, y: number, texture: Texture) {
    this.id = id;
    this.type = type;
    this.layer = layer;
    this.x = x;
    this.y = y;

    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    // 1. 底部柔和立体投影
    this.shadowGraphics = new Graphics();
    this.shadowGraphics.beginFill(0x000000, 0.28);
    this.shadowGraphics.drawRoundedRect(
      -CARD_WIDTH / 2 + 2,
      -CARD_HEIGHT / 2 + 4,
      CARD_WIDTH - 4,
      CARD_HEIGHT - 4,
      14
    );
    this.shadowGraphics.endFill();
    this.container.addChild(this.shadowGraphics);

    // 2. 卡牌主体精灵
    this.cardSprite = new Sprite(texture);
    this.cardSprite.anchor.set(0.5);
    this.cardSprite.width = CARD_WIDTH;
    this.cardSprite.height = CARD_HEIGHT;
    this.container.addChild(this.cardSprite);

    // 3. 被遮挡时的半透明暗色蒙版
    this.maskOverlay = new Graphics();
    this.maskOverlay.beginFill(0x000000, 0.52);
    this.maskOverlay.drawRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 14);
    this.maskOverlay.endFill();
    this.maskOverlay.visible = false;
    this.container.addChild(this.maskOverlay);

    this.bindInteraction();
  }

  private bindInteraction(): void {
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.container.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.isEliminating) return;
      gameEvents.emit('yang-card-clicked', { card: this });
    });
  }

  setCovered(covered: boolean): void {
    this.isCovered = covered;
    this.maskOverlay.visible = covered;
    if (covered) {
      this.cardSprite.tint = 0x828282;
      this.container.cursor = 'default';
    } else {
      this.cardSprite.tint = 0xffffff;
      this.container.cursor = 'pointer';
    }
  }

  async moveTo(targetX: number, targetY: number, durationMS = 220): Promise<void> {
    this.x = targetX;
    this.y = targetY;
    return animateTo(this.container, targetX, targetY, durationMS, Easing.easeOutQuad);
  }

  /**
   * 点击后从牌堆平滑飞入卡槽动画，带轻微缩放回弹
   */
  async flyToSlot(targetX: number, targetY: number, durationMS = 240): Promise<void> {
    this.x = targetX;
    this.y = targetY;
    this.shadowGraphics.visible = false;
    this.maskOverlay.visible = false;
    this.cardSprite.tint = 0xffffff;

    this.container.scale.set(1.08);

    await Promise.all([
      animateTo(this.container, targetX, targetY, durationMS, Easing.easeOutQuad),
      animateTransform(this.container, {
        toScaleX: 1.0,
        toScaleY: 1.0,
        durationMS,
        ease: Easing.easeOutBack,
      }),
    ]);
  }

  /**
   * 点击被遮挡卡牌时的受阻晃动提示动画
   */
  async shakeForbidden(): Promise<void> {
    const originX = this.x;
    const dur = 40;
    await animateTo(this.container, originX - 5, this.y, dur);
    await animateTo(this.container, originX + 5, this.y, dur);
    await animateTo(this.container, originX - 3, this.y, dur);
    await animateTo(this.container, originX, this.y, dur);
  }

  /**
   * 三消匹配成功时的消除爆炸动画
   */
  async eliminate(): Promise<void> {
    this.isEliminating = true;
    this.container.eventMode = 'none';

    await animateTransform(this.container, {
      toScaleX: 1.25,
      toScaleY: 1.25,
      toAlpha: 0.1,
      durationMS: 180,
      ease: Easing.easeInBack,
    });

    this.container.visible = false;
    this.container.destroy({ children: true });
  }
}
