/**
 * 引擎通用 Canvas 面板/卡片容器组件 (v1.1 新增)
 * 基于 Pixi.js v7 Container 实现，支持居中原点或左上角原点、圆角、背景色、描边及阴影风格
 */
import { Container, Graphics } from 'pixi.js';

export interface CanvasPanelOptions {
  width?: number;
  height?: number;
  radius?: number;
  backgroundColor?: number;
  backgroundAlpha?: number;
  borderColor?: number;
  borderWidth?: number;
  borderAlpha?: number;
  /** 原点是否在中心 (true 则 [-w/2, -h/2] 到 [w/2, h/2]，false 则从 [0, 0] 开始)，默认 true */
  centered?: boolean;
}

export class CanvasPanel extends Container {
  public readonly background: Graphics;

  private _panelWidth: number;
  private _panelHeight: number;
  private _radius: number;
  private _bgColor: number;
  private _bgAlpha: number;
  private _borderColor: number;
  private _borderWidth: number;
  private _borderAlpha: number;
  private _centered: boolean;

  constructor(options: CanvasPanelOptions = {}) {
    super();

    this._panelWidth = options.width ?? 400;
    this._panelHeight = options.height ?? 300;
    this._radius = options.radius ?? 24;
    this._bgColor = options.backgroundColor ?? 0x0f172a;
    this._bgAlpha = options.backgroundAlpha ?? 0.96;
    this._borderColor = options.borderColor ?? 0x38bdf8;
    this._borderWidth = options.borderWidth ?? 3;
    this._borderAlpha = options.borderAlpha ?? 0.6;
    this._centered = options.centered ?? true;

    this.background = new Graphics();
    this.addChild(this.background);

    this.redraw();
  }

  public redraw(): void {
    const bg = this.background;
    bg.clear();

    bg.beginFill(this._bgColor, this._bgAlpha);
    if (this._borderWidth > 0) {
      bg.lineStyle(this._borderWidth, this._borderColor, this._borderAlpha);
    }

    const startX = this._centered ? -this._panelWidth / 2 : 0;
    const startY = this._centered ? -this._panelHeight / 2 : 0;

    bg.drawRoundedRect(startX, startY, this._panelWidth, this._panelHeight, this._radius);
    bg.endFill();
  }

  public resize(width: number, height: number): this {
    this._panelWidth = width;
    this._panelHeight = height;
    this.redraw();
    return this;
  }

  public setColors(bgColor: number, borderColor = this._borderColor): this {
    this._bgColor = bgColor;
    this._borderColor = borderColor;
    this.redraw();
    return this;
  }

  public get panelWidth(): number {
    return this._panelWidth;
  }

  public get panelHeight(): number {
    return this._panelHeight;
  }
}
