import { FederatedPointerEvent, Sprite, Texture } from 'pixi.js';
import { Easing, animateTo, animateTransform } from '../../utils/tween';
import { gameEvents } from '../core/EventBus';

export const TILE_SIZE = 80;
export const BOARD_COLS = 8;
export const BOARD_ROWS = 8;

/**
 * 游戏棋子实体类 (对应文章 4.1 节：封装 Pixi Sprite，对外暴露业务方法，隔离底层渲染细节)
 */
export class Tile {
  sprite: Sprite;
  row: number;
  col: number;
  type: number;
  private dragStartPos: { x: number; y: number } | null = null;

  constructor(texture: Texture, row: number, col: number, type: number) {
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.width = TILE_SIZE - 4;
    this.sprite.height = TILE_SIZE - 4;

    this.row = row;
    this.col = col;
    this.type = type;

    this.updatePosition();
    this.bindInteraction();
  }

  /**
   * 绑定 Pixi v7 事件模型 (对应文章 4.3 节与第 8 节踩坑记录 1：使用 eventMode = 'static')
   */
  private bindInteraction(): void {
    this.sprite.eventMode = 'static';
    this.sprite.cursor = 'pointer';

    this.sprite.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragStartPos = { x: e.global.x, y: e.global.y };
      gameEvents.emit('tile-clicked', { row: this.row, col: this.col });
    });

    this.sprite.on('pointerup', (e: FederatedPointerEvent) => {
      if (!this.dragStartPos) return;
      const dx = e.global.x - this.dragStartPos.x;
      const dy = e.global.y - this.dragStartPos.y;
      this.dragStartPos = null;

      // 支持滑动手势交换相邻棋子
      const threshold = 24;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          const targetCol = this.col + (dx > 0 ? 1 : -1);
          gameEvents.emit('tile-swipe', {
            fromRow: this.row,
            fromCol: this.col,
            toRow: this.row,
            toCol: targetCol,
          });
        } else {
          const targetRow = this.row + (dy > 0 ? 1 : -1);
          gameEvents.emit('tile-swipe', {
            fromRow: this.row,
            fromCol: this.col,
            toRow: targetRow,
            toCol: this.col,
          });
        }
      }
    });

    this.sprite.on('pointerupoutside', () => {
      this.dragStartPos = null;
    });
  }

  updatePosition(): void {
    this.sprite.x = this.col * TILE_SIZE + TILE_SIZE / 2;
    this.sprite.y = this.row * TILE_SIZE + TILE_SIZE / 2;
  }

  /**
   * 平滑移动到新行列 (对应文章 4.1 节)
   */
  async moveTo(row: number, col: number, durationMS = 190): Promise<void> {
    this.row = row;
    this.col = col;
    return animateTo(
      this.sprite,
      this.col * TILE_SIZE + TILE_SIZE / 2,
      this.row * TILE_SIZE + TILE_SIZE / 2,
      durationMS,
      Easing.easeOutQuad
    );
  }

  /**
   * 播放生成入场动画
   */
  async playSpawnAnimation(): Promise<void> {
    const targetScale = (TILE_SIZE - 4) / 96;
    this.sprite.scale.set(0.1);
    this.sprite.alpha = 0;
    return animateTransform(this.sprite, {
      toScaleX: targetScale,
      toScaleY: targetScale,
      toAlpha: 1,
      durationMS: 200,
      ease: Easing.easeOutBack,
    });
  }

  /**
   * 播放消除缩小动画
   */
  async playEliminateAnimation(): Promise<void> {
    return animateTransform(this.sprite, {
      toScaleX: 0.05,
      toScaleY: 0.05,
      toAlpha: 0,
      durationMS: 170,
      ease: Easing.easeInBack,
    });
  }

  setType(type: number, texture: Texture): void {
    this.type = type;
    this.sprite.texture = texture;
  }

  destroy(): void {
    this.sprite.removeAllListeners();
    this.sprite.destroy();
  }
}
