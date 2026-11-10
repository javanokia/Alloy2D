import { BaseTexture, Texture } from 'pixi.js';
import {
  ATLAS_PADDING,
  BaseAssetManager,
  traceRoundedRect,
} from 'alloy2d';

export const TILE_TYPES_COUNT = 6;

export interface TileTheme {
  id: number;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  hexColor: number;
}

export const TILE_THEMES: TileTheme[] = [
  { id: 0, name: '炽焰红宝石', primaryColor: '#ff4d6d', secondaryColor: '#c9184a', hexColor: 0xff4d6d },
  { id: 1, name: '星海蓝水晶', primaryColor: '#38bdf8', secondaryColor: '#0284c7', hexColor: 0x38bdf8 },
  { id: 2, name: '森语绿翡翠', primaryColor: '#34d399', secondaryColor: '#059669', hexColor: 0x34d399 },
  { id: 3, name: '雷霆金琥珀', primaryColor: '#fbbf24', secondaryColor: '#d97706', hexColor: 0xfbbf24 },
  { id: 4, name: '幻月紫晶石', primaryColor: '#c084fc', secondaryColor: '#7c3aed', hexColor: 0xc084fc },
  { id: 5, name: '极光冰棱钻', primaryColor: '#f472b6', secondaryColor: '#db2777', hexColor: 0xf472b6 },
];

/**
 * 星耀三消游戏专属图集管理器：继承自引擎 BaseAssetManager
 */
export class Match3AssetManager extends BaseAssetManager {
  private initialized = false;

  public async initBuiltInAtlas(): Promise<void> {
    if (this.initialized) return;

    const cellSize = 96;
    const pad = ATLAS_PADDING;
    const cols = 4;
    const rows = 3;
    const canvasWidth = cols * (cellSize + pad * 2);
    const canvasHeight = rows * (cellSize + pad * 2);

    const canvas = this.createOffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d')!;

    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawTileGem(ctx, x, y, cellSize, TILE_THEMES[i], i);
    }

    {
      const col = 6 % cols;
      const row = Math.floor(6 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawSelectionFrame(ctx, x, y, cellSize);
    }

    {
      const col = 7 % cols;
      const row = Math.floor(7 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawParticleStar(ctx, x, y, cellSize);
    }

    const baseTex = BaseTexture.from(canvas);
    this.atlasBaseTextures.push(baseTex);

    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.registerSubTexture(baseTex, `tile_${i}`, x, y, cellSize, cellSize);
    }

    {
      const col = 6 % cols;
      const row = Math.floor(6 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.registerSubTexture(baseTex, 'tile_select', x, y, cellSize, cellSize);
    }

    {
      const col = 7 % cols;
      const row = Math.floor(7 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.registerSubTexture(baseTex, 'particle_star', x, y, cellSize, cellSize);
    }

    this.initialized = true;
  }

  public getTileTexture(type: number): Texture {
    const tex = this.get(`tile_${type % TILE_TYPES_COUNT}`);
    if (!tex) {
      throw new Error(`Texture tile_${type} not initialized.`);
    }
    return tex;
  }

  private drawTileGem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    theme: TileTheme,
    shapeType: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const r = 18;
    const pad = 6;
    const w = size - pad * 2;
    const h = size - pad * 2;

    const grad = ctx.createLinearGradient(pad, pad, pad, pad + h);
    grad.addColorStop(0, theme.primaryColor);
    grad.addColorStop(1, theme.secondaryColor);

    traceRoundedRect(ctx, pad, pad, w, h, r);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();

    traceRoundedRect(ctx, pad + 5, pad + 4, w - 10, h * 0.42, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();

    const cx = size / 2;
    const cy = size / 2 + 1;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    switch (shapeType) {
      case 0: {
        ctx.moveTo(cx, cy + 15);
        ctx.bezierCurveTo(cx - 22, cy + 2, cx - 20, cy - 18, cx, cy - 8);
        ctx.bezierCurveTo(cx + 20, cy - 18, cx + 22, cy + 2, cx, cy + 15);
        break;
      }
      case 1: {
        const spikes = 5;
        const outerR = 17;
        const innerR = 8;
        for (let i = 0; i < spikes * 2; i++) {
          const rad = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const px = cx + Math.cos(angle) * rad;
          const py = cy + Math.sin(angle) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 2: {
        ctx.moveTo(cx, cy - 17);
        ctx.lineTo(cx + 15, cy);
        ctx.lineTo(cx, cy + 17);
        ctx.lineTo(cx - 15, cy);
        ctx.closePath();
        break;
      }
      case 3: {
        ctx.moveTo(cx + 4, cy - 18);
        ctx.lineTo(cx - 11, cy + 2);
        ctx.lineTo(cx - 1, cy + 2);
        ctx.lineTo(cx - 5, cy + 18);
        ctx.lineTo(cx + 12, cy - 2);
        ctx.lineTo(cx + 2, cy - 2);
        ctx.closePath();
        break;
      }
      case 4: {
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          const px = cx + Math.cos(angle) * 15;
          const py = cy + Math.sin(angle) * 15;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      default: {
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        break;
      }
    }
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawSelectionFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    traceRoundedRect(ctx, 3, 3, size - 6, size - 6, 20);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  private drawParticleStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.42);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  public override destroy(): void {
    super.destroy();
    this.initialized = false;
  }
}

export const assetManager = new Match3AssetManager();
