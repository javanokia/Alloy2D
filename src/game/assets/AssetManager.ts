import { BaseTexture, Rectangle, Texture } from 'pixi.js';
import { platform } from '../../platform/PlatformAdapter';

/**
 * 跨平台资源与纹理图集管理器
 * 对应文章 5.3 节 (AssetManager)、6.1/6.3 节 (Texture Atlas 合并批次降低 Draw Call)
 * 以及第 8 节踩坑记录 2 (纹理图集预留 4px Padding 防止缩放/旋转时相邻纹理边缘渗色)
 */

export const ATLAS_PADDING = 4; // 严格遵循文章第 8 节：4 像素安全边距
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
 * 兼容微信小游戏 Canvas 2D Context 与 Web 的圆角矩形路径绘制函数
 */
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

export class AssetManager {
  private cache: Map<string, Texture> = new Map();
  private atlasBaseTexture: BaseTexture | null = null;
  private initialized = false;

  /**
   * 初始化内置高分屏纹理图集 (Texture Atlas)
   * 所有棋子、选中框、粒子共享同一张 BaseTexture，确保 Pixi 自动 Batching
   */
  async initBuiltInAtlas(): Promise<void> {
    if (this.initialized) return;

    const cellSize = 96;
    const pad = ATLAS_PADDING;
    const cols = 4;
    const rows = 3;
    const canvasWidth = cols * (cellSize + pad * 2);
    const canvasHeight = rows * (cellSize + pad * 2);

    // 兼容微信小游戏离屏 Canvas 创建与 Web document.createElement('canvas')
    const g = globalThis as unknown as { wx?: { createCanvas?: () => HTMLCanvasElement } };
    const canvas =
      typeof g.wx !== 'undefined' && typeof g.wx.createCanvas === 'function'
        ? g.wx.createCanvas()
        : document.createElement('canvas');

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // 绘制 6 种三消宝石纹理 (索引 0 ~ 5)
    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawTileGem(ctx, x, y, cellSize, TILE_THEMES[i], i);
    }

    // 索引 6：选中高亮框纹理
    {
      const col = 6 % cols;
      const row = Math.floor(6 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawSelectionFrame(ctx, x, y, cellSize);
    }

    // 索引 7：通用发光粒子纹理（可通过 Sprite.tint 着色复用同一图集批次）
    {
      const col = 7 % cols;
      const row = Math.floor(7 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.drawParticleStar(ctx, x, y, cellSize);
    }

    this.atlasBaseTexture = BaseTexture.from(canvas);

    // 切分出共享同一 BaseTexture 的子纹理
    for (let i = 0; i < TILE_TYPES_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      const tex = new Texture(this.atlasBaseTexture, new Rectangle(x, y, cellSize, cellSize));
      this.cache.set(`tile_${i}`, tex);
    }

    // 选中框子纹理
    {
      const col = 6 % cols;
      const row = Math.floor(6 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.cache.set(
        'tile_select',
        new Texture(this.atlasBaseTexture, new Rectangle(x, y, cellSize, cellSize))
      );
    }

    // 粒子子纹理
    {
      const col = 7 % cols;
      const row = Math.floor(7 / cols);
      const x = col * (cellSize + pad * 2) + pad;
      const y = row * (cellSize + pad * 2) + pad;
      this.cache.set(
        'particle_star',
        new Texture(this.atlasBaseTexture, new Rectangle(x, y, cellSize, cellSize))
      );
    }

    this.initialized = true;
  }

  /**
   * 跨平台按需加载外部纹理 (对应文章 5.3 节 loadTextureByPlatform)
   */
  async load(key: string, url: string): Promise<Texture> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const img = await platform.loadImage(url);
    const texture = Texture.from(img);
    this.cache.set(key, texture);
    return texture;
  }

  get(key: string): Texture | undefined {
    return this.cache.get(key);
  }

  getTileTexture(type: number): Texture {
    const tex = this.cache.get(`tile_${type % TILE_TYPES_COUNT}`);
    if (!tex) {
      throw new Error(`Texture tile_${type} not initialized. Call initBuiltInAtlas() first.`);
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

    // 底部柔和阴影与圆角底座
    const grad = ctx.createLinearGradient(pad, pad, pad, pad + h);
    grad.addColorStop(0, theme.primaryColor);
    grad.addColorStop(1, theme.secondaryColor);

    traceRoundedRect(ctx, pad, pad, w, h, r);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();

    // 顶部玻璃高光
    traceRoundedRect(ctx, pad + 5, pad + 4, w - 10, h * 0.42, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();

    // 中心特色宝石徽记
    const cx = size / 2;
    const cy = size / 2 + 1;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    switch (shapeType) {
      case 0: {
        // 心形红宝石
        ctx.moveTo(cx, cy + 15);
        ctx.bezierCurveTo(cx - 22, cy + 2, cx - 20, cy - 18, cx, cy - 8);
        ctx.bezierCurveTo(cx + 20, cy - 18, cx + 22, cy + 2, cx, cy + 15);
        break;
      }
      case 1: {
        // 五角星海蓝宝石
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
        // 棱形翡翠
        ctx.moveTo(cx, cy - 17);
        ctx.lineTo(cx + 15, cy);
        ctx.lineTo(cx, cy + 17);
        ctx.lineTo(cx - 15, cy);
        ctx.closePath();
        break;
      }
      case 3: {
        // 闪电金琥珀
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
        // 六边形紫晶
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
        // 冰晶圆环钻
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

  destroy(): void {
    this.cache.forEach((tex) => tex.destroy(false));
    this.cache.clear();
    if (this.atlasBaseTexture) {
      this.atlasBaseTexture.destroy();
      this.atlasBaseTexture = null;
    }
    this.initialized = false;
  }
}

export const assetManager = new AssetManager();
