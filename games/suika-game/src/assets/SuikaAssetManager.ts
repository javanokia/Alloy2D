import { Rectangle, Texture, TextureSource } from 'pixi.js';
import { ATLAS_PADDING, BaseAssetManager, platform } from 'alloy2d';

export interface FruitConfig {
  tier: number;
  name: string;
  radius: number;
  score: number;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  emoji: string;
}

export const FRUIT_CONFIGS: FruitConfig[] = [
  { tier: 0, name: '蓝莓', radius: 24, score: 1, primaryColor: '#60a5fa', secondaryColor: '#2563eb', borderColor: '#1d4ed8', emoji: '🫐' },
  { tier: 1, name: '樱桃', radius: 32, score: 2, primaryColor: '#f87171', secondaryColor: '#dc2626', borderColor: '#b91c1c', emoji: '🍒' },
  { tier: 2, name: '奇异果', radius: 42, score: 4, primaryColor: '#a3e635', secondaryColor: '#65a30d', borderColor: '#4d7c0f', emoji: '🥝' },
  { tier: 3, name: '柠檬', radius: 52, score: 8, primaryColor: '#fde047', secondaryColor: '#ca8a04', borderColor: '#a16207', emoji: '🍋' },
  { tier: 4, name: '橙子', radius: 64, score: 16, primaryColor: '#fb923c', secondaryColor: '#ea580c', borderColor: '#c2410c', emoji: '🍊' },
  { tier: 5, name: '苹果', radius: 76, score: 32, primaryColor: '#ef4444', secondaryColor: '#b91c1c', borderColor: '#991b1b', emoji: '🍎' },
  { tier: 6, name: '香梨', radius: 88, score: 64, primaryColor: '#bef264', secondaryColor: '#84cc16', borderColor: '#4d7c0f', emoji: '🍐' },
  { tier: 7, name: '水蜜桃', radius: 102, score: 128, primaryColor: '#f472b6', secondaryColor: '#db2777', borderColor: '#be185d', emoji: '🍑' },
  { tier: 8, name: '菠萝', radius: 118, score: 256, primaryColor: '#facc15', secondaryColor: '#d97706', borderColor: '#b45309', emoji: '🍍' },
  { tier: 9, name: '椰子', radius: 136, score: 512, primaryColor: '#a8a29e', secondaryColor: '#57534e', borderColor: '#292524', emoji: '🥥' },
  { tier: 10, name: '大西瓜', radius: 156, score: 1024, primaryColor: '#22c55e', secondaryColor: '#15803d', borderColor: '#166534', emoji: '🍉' },
];

export class SuikaAssetManager extends BaseAssetManager {
  private isAtlasReady = false;

  public async initAtlas(): Promise<void> {
    const firstTex = this.get('fruit_0');
    if (
      this.isAtlasReady &&
      firstTex &&
      !firstTex.destroyed &&
      firstTex.source &&
      !firstTex.source.destroyed
    ) {
      return;
    }

    this.destroy();
    this.isAtlasReady = false;

    // 绘制包含 11 种水果纹理与粒子、瞄准虚线端点的图集
    // 最大的西瓜直径为 312px，留出充足 padding 拼成 2048x1024 大图
    const maxDiameter = 320;
    const pad = ATLAS_PADDING;
    const canvasW = 1024;
    const canvasH = 1024;

    const canvas = this.createOffscreenCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d')!;

    // 简单行内排布算法
    let currentX = pad;
    let currentY = pad;
    let rowMaxH = 0;

    const baseTex = TextureSource.from(canvas);
    this.atlasBaseTextures.push(baseTex);

    for (const fruit of FRUIT_CONFIGS) {
      const size = fruit.radius * 2 + 8; // 预留阴影与描边
      if (currentX + size + pad > canvasW) {
        currentX = pad;
        currentY += rowMaxH + pad;
        rowMaxH = 0;
      }

      this.drawFruit(ctx, currentX, currentY, size, fruit);
      this.registerSubTexture(baseTex, `fruit_${fruit.tier}`, currentX, currentY, size, size);

      currentX += size + pad;
      if (size > rowMaxH) rowMaxH = size;
    }

    // 绘制辅助纹理：金色光芒星星粒子
    const starSize = 64;
    if (currentX + starSize + pad > canvasW) {
      currentX = pad;
      currentY += rowMaxH + pad;
      rowMaxH = starSize;
    }
    this.drawStarParticle(ctx, currentX, currentY, starSize);
    this.registerSubTexture(baseTex, 'particle_star', currentX, currentY, starSize, starSize);

    // 绘制辅助纹理：准心光斑
    const aimSize = 32;
    currentX += starSize + pad;
    this.drawAimDot(ctx, currentX, currentY, aimSize);
    this.registerSubTexture(baseTex, 'aim_dot', currentX, currentY, aimSize, aimSize);

    this.isAtlasReady = true;
  }

  private drawFruit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    cfg: FruitConfig
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = cfg.radius;

    ctx.save();

    // 1. 底部柔和投影
    ctx.beginPath();
    ctx.arc(cx, cy + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    // 2. 主体球形渐变
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, cfg.primaryColor);
    grad.addColorStop(1, cfg.secondaryColor);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. 边框描边
    ctx.lineWidth = Math.max(2, Math.floor(r * 0.06));
    ctx.strokeStyle = cfg.borderColor;
    ctx.stroke();

    // 4. 高光弧线 (增加 Q 弹果冻感)
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, Math.PI * 1.1, Math.PI * 1.8);
    ctx.lineWidth = Math.max(2, Math.floor(r * 0.08));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 5. 居中可爱 Emoji 水果标识
    const fontSize = Math.max(16, Math.floor(r * 0.95));
    ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.emoji, cx, cy + 1);

    ctx.restore();
  }

  private drawStarParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const outerR = size * 0.44;
    const innerR = size * 0.18;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) * Math.PI) / 180) * outerR,
        -Math.sin(((18 + i * 72) * Math.PI) / 180) * outerR
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) * Math.PI) / 180) * innerR,
        -Math.sin(((54 + i * 72) * Math.PI) / 180) * innerR
      );
    }
    ctx.closePath();

    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();
    ctx.restore();
  }

  private drawAimDot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.35;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    ctx.restore();
  }

  public getFruitTexture(tier: number): Texture {
    const tex = this.get(`fruit_${Math.min(10, Math.max(0, tier))}`);
    if (!tex) {
      const fallback = this.get('fruit_0');
      if (fallback) return fallback;
      throw new Error(`Fruit texture for tier ${tier} not found. Please call initAtlas() first.`);
    }
    return tex;
  }

  public override destroy(): void {
    super.destroy();
    this.isAtlasReady = false;
  }
}

export const suikaAssetManager = new SuikaAssetManager();
