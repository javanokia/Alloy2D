import { BaseTexture, Rectangle, Texture } from 'pixi.js';
import { platform } from '../platform/PlatformAdapter';

/**
 * 引擎内置跨平台资源与动态纹理图集基类
 * 对应文章 5.3 节 (AssetManager)、6.1/6.3 节 (Texture Atlas 合并批次降低 Draw Call)
 * 以及第 8 节踩坑记录 2 (纹理图集预留 4px Padding 防止缩放/旋转时相邻纹理边缘渗色)
 */

export const ATLAS_PADDING = 4;

/**
 * 兼容微信小游戏 Canvas 2D Context 与 Web 的圆角矩形路径绘制函数
 */
export function traceRoundedRect(
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

export class BaseAssetManager {
  protected cache: Map<string, Texture> = new Map();
  protected atlasBaseTextures: BaseTexture[] = [];

  /**
   * 创建跨平台离屏 2D Canvas（兼容微信小游戏 wx.createCanvas 与 Web）
   */
  public createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
    const g = globalThis as unknown as { wx?: { createCanvas?: () => HTMLCanvasElement } };
    const canvas =
      typeof g.wx !== 'undefined' && typeof g.wx.createCanvas === 'function'
        ? g.wx.createCanvas()
        : document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * 从共享 BaseTexture 切分出带 Padding 的子纹理并写入缓存
   */
  public registerSubTexture(
    baseTexture: BaseTexture,
    key: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Texture {
    const tex = new Texture(baseTexture, new Rectangle(x, y, width, height));
    this.cache.set(key, tex);
    return tex;
  }

  /**
   * 跨平台按需加载外部纹理 (对应文章 5.3 节 loadTextureByPlatform)
   */
  public async load(key: string, url: string): Promise<Texture> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const img = await platform.loadImage(url);
    const texture = Texture.from(img);
    this.cache.set(key, texture);
    return texture;
  }

  public get(key: string): Texture | undefined {
    return this.cache.get(key);
  }

  public destroy(): void {
    this.cache.forEach((tex) => tex.destroy(false));
    this.cache.clear();
    this.atlasBaseTextures.forEach((bt) => bt.destroy());
    this.atlasBaseTextures = [];
  }
}
