import { BaseTexture, Rectangle, Texture } from 'pixi.js';
import { BaseAssetManager, platform } from 'alloy2d';

export const TILE_TYPES_COUNT = 16;

export interface TileTheme {
  id: number;
  name: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  symbolColor: string;
  hexColor: number;
}

export const TILE_THEMES: TileTheme[] = [
  { id: 0, name: '胡萝卜', emoji: '🥕', bgColor: '#fff7ed', borderColor: '#ea580c', symbolColor: '#f97316', hexColor: 0xf97316 },
  { id: 1, name: '鲜白菜', emoji: '🥬', bgColor: '#f0fdf4', borderColor: '#16a34a', symbolColor: '#22c55e', hexColor: 0x22c55e },
  { id: 2, name: '金铃铛', emoji: '🔔', bgColor: '#fefce8', borderColor: '#ca8a04', symbolColor: '#eab308', hexColor: 0xeab308 },
  { id: 3, name: '毛线球', emoji: '🧶', bgColor: '#fdf2f8', borderColor: '#db2777', symbolColor: '#ec4899', hexColor: 0xec4899 },
  { id: 4, name: '干草堆', emoji: '🌾', bgColor: '#fef3c7', borderColor: '#d97706', symbolColor: '#f59e0b', hexColor: 0xf59e0b },
  { id: 5, name: '羊毛剪', emoji: '✂️', bgColor: '#f1f5f9', borderColor: '#475569', symbolColor: '#64748b', hexColor: 0x64748b },
  { id: 6, name: '软毛刷', emoji: '🪥', bgColor: '#ecfeff', borderColor: '#0891b2', symbolColor: '#06b6d4', hexColor: 0x06b6d4 },
  { id: 7, name: '老树桩', emoji: '🪵', bgColor: '#fef7ee', borderColor: '#9a3412', symbolColor: '#b45309', hexColor: 0xb45309 },
  { id: 8, name: '温奶瓶', emoji: '🍼', bgColor: '#eff6ff', borderColor: '#2563eb', symbolColor: '#3b82f6', hexColor: 0x3b82f6 },
  { id: 9, name: '暖手套', emoji: '🧤', bgColor: '#fdf4ff', borderColor: '#9333ea', symbolColor: '#a855f7', hexColor: 0xa855f7 },
  { id: 10, name: '野篝火', emoji: '🔥', bgColor: '#fff1f2', borderColor: '#e11d48', symbolColor: '#f43f5e', hexColor: 0xf43f5e },
  { id: 11, name: '甜玉米', emoji: '🌽', bgColor: '#fefce8', borderColor: '#eab308', symbolColor: '#facc15', hexColor: 0xfacc15 },
  { id: 12, name: '干草叉', emoji: '🍴', bgColor: '#f8fafc', borderColor: '#334155', symbolColor: '#475569', hexColor: 0x475569 },
  { id: 13, name: '挤奶桶', emoji: '🪣', bgColor: '#f0f9ff', borderColor: '#0284c7', symbolColor: '#0ea5e9', hexColor: 0x0ea5e9 },
  { id: 14, name: '红苹果', emoji: '🍎', bgColor: '#fef2f2', borderColor: '#dc2626', symbolColor: '#ef4444', hexColor: 0xef4444 },
  { id: 15, name: '四叶草', emoji: '🍀', bgColor: '#f0fdf4', borderColor: '#15803d', symbolColor: '#16a34a', hexColor: 0x16a34a },
];

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * 《羊了个羊》专用资源与动态图集管理器
 * 继承自 alloy2d 的 BaseAssetManager
 */
export class YangAssetManager extends BaseAssetManager {
  private atlasBaseTexture: BaseTexture | null = null;
  private isAtlasReady = false;

  async initAtlas(): Promise<void> {
    if (this.isAtlasReady) return;

    let loadedFromImage = false;
    const isWx = typeof (globalThis as unknown as { wx?: unknown }).wx !== 'undefined';
    const atlasUrl = isWx ? 'assets/tiles/atlas.png' : '/assets/tiles/atlas.png';

    try {
      const img = await platform.loadImage(atlasUrl);
      this.atlasBaseTexture = BaseTexture.from(img);

      const cols = 4;
      const tileW = 110;
      const tileH = 130;
      const stepX = 118;
      const stepY = 138;

      for (let i = 0; i < TILE_TYPES_COUNT; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * stepX + 4;
        const y = row * stepY + 4;
        const tex = new Texture(
          this.atlasBaseTexture,
          new Rectangle(x, y, tileW, tileH)
        );
        this.cache.set(`tile_${i}`, tex);
      }
      loadedFromImage = true;
    } catch {
      loadedFromImage = false;
    }

    if (!loadedFromImage) {
      this.buildProceduralAtlas();
    }

    this.buildAuxiliaryTextures();
    this.isAtlasReady = true;
  }

  private buildProceduralAtlas(): void {
    const cols = 4;
    const rows = 4;
    const tileW = 110;
    const tileH = 130;
    const pad = 4;
    const canvasW = cols * (tileW + pad * 2);
    const canvasH = rows * (tileH + pad * 2);

    const g = globalThis as unknown as { wx?: { createCanvas?: () => HTMLCanvasElement } };
    const canvas =
      typeof g.wx !== 'undefined' && typeof g.wx.createCanvas === 'function'
        ? g.wx.createCanvas()
        : document.createElement('canvas');

    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (tileW + pad * 2) + pad;
      const y = row * (tileH + pad * 2) + pad;
      this.drawProceduralCard(ctx, x, y, tileW, tileH, TILE_THEMES[i]);
    }

    this.atlasBaseTexture = BaseTexture.from(canvas);
    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (tileW + pad * 2) + pad;
      const y = row * (tileH + pad * 2) + pad;
      const tex = new Texture(this.atlasBaseTexture, new Rectangle(x, y, tileW, tileH));
      this.cache.set(`tile_${i}`, tex);
    }
  }

  private drawProceduralCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    theme: TileTheme
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const r = 16;
    traceRoundedRect(ctx, 0, 8, w, h - 8, r);
    ctx.fillStyle = '#b7b4a8';
    ctx.fill();

    traceRoundedRect(ctx, 0, 0, w, h - 10, r);
    ctx.fillStyle = theme.bgColor;
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c8c4b7';
    ctx.stroke();

    traceRoundedRect(ctx, 4, 4, w - 8, h - 18, r - 4);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    ctx.font = '54px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.emoji, w / 2, (h - 10) / 2);

    ctx.restore();
  }

  private buildAuxiliaryTextures(): void {
    const g = globalThis as unknown as { wx?: { createCanvas?: () => HTMLCanvasElement } };
    const canvas =
      typeof g.wx !== 'undefined' && typeof g.wx.createCanvas === 'function'
        ? g.wx.createCanvas()
        : document.createElement('canvas');

    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 选中金黄发光边框
    traceRoundedRect(ctx, 6, 6, 116, 116, 18);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // 粒子金色闪光星星
    const cx = 192;
    const cy = 64;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * 36, -Math.sin(((18 + i * 72) * Math.PI) / 180) * 36);
      ctx.lineTo(Math.cos(((54 + i * 72) * Math.PI) / 180) * 16, -Math.sin(((54 + i * 72) * Math.PI) / 180) * 16);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const auxBase = BaseTexture.from(canvas);
    this.cache.set('tile_select', new Texture(auxBase, new Rectangle(0, 0, 128, 128)));
    this.cache.set('particle_star', new Texture(auxBase, new Rectangle(128, 0, 128, 128)));
  }

  getTileTexture(type: number): Texture {
    const tex = this.get(`tile_${type % TILE_TYPES_COUNT}`);
    if (!tex) {
      const fallback = this.get('tile_0');
      if (fallback) return fallback;
      throw new Error(`Tile texture tile_${type} not found. Please call initAtlas() first.`);
    }
    return tex;
  }

  public override destroy(): void {
    super.destroy();
    this.atlasBaseTexture = null;
    this.isAtlasReady = false;
  }
}

export const yangAssetManager = new YangAssetManager();
