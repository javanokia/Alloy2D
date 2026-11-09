import { FederatedPointerEvent, Sprite, Texture } from 'pixi.js';
import {
  animateTo,
  animateTransform,
  Easing,
  gameEvents,
} from '@wegame/hybrid-engine';

export const TILE_SIZE = 80;
export const BOARD_COLS = 8;
export const BOARD_ROWS = 8;

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
