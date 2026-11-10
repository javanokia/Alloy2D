/**
 * 引擎通用 Canvas 交互按钮组件 (v1.1 新增)
 * 基于 Pixi.js v7 Container 实现，支持圆角背景、边框、文本排版、
 * 按压回弹缓动动画 (pointerdown / pointerup / pointerupoutside)、音效联动及禁用态
 */
import { Container, FederatedPointerEvent, Graphics, ITextStyle, Text, TextStyle } from 'pixi.js';
import { audioManager } from '../audio/AudioManager';

export interface CanvasButtonOptions {
  width?: number;
  height?: number;
  radius?: number;
  backgroundColor?: number;
  backgroundAlpha?: number;
  borderColor?: number;
  borderWidth?: number;
  borderAlpha?: number;
  label?: string;
  textStyle?: Partial<ITextStyle>;
  /** 点击触发的音效名，默认 'click'；传 null 则不发声 */
  sound?: string | null;
  /** 按压状态缩放比例，默认 0.95 */
  pressedScale?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export class CanvasButton extends Container {
  public readonly background: Graphics;
  public readonly labelText: Text;

  private _btnWidth: number;
  private _btnHeight: number;
  private _radius: number;
  private _bgColor: number;
  private _bgAlpha: number;
  private _borderColor: number;
  private _borderWidth: number;
  private _borderAlpha: number;
  private _sound: string | null;
  private _pressedScale: number;
  private _disabled = false;
  private _clickHandler?: () => void;

  constructor(options: CanvasButtonOptions = {}) {
    super();

    this._btnWidth = options.width ?? 180;
    this._btnHeight = options.height ?? 60;
    this._radius = options.radius ?? 16;
    this._bgColor = options.backgroundColor ?? 0x2563eb;
    this._bgAlpha = options.backgroundAlpha ?? 0.95;
    this._borderColor = options.borderColor ?? 0x60a5fa;
    this._borderWidth = options.borderWidth ?? 2;
    this._borderAlpha = options.borderAlpha ?? 0.8;
    this._sound = options.sound !== undefined ? options.sound : 'click';
    this._pressedScale = options.pressedScale ?? 0.95;
    this._disabled = options.disabled ?? false;
    this._clickHandler = options.onClick;

    this.background = new Graphics();
    this.addChild(this.background);

    const defaultTextStyle: Partial<ITextStyle> = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: '#ffffff',
    };
    this.labelText = new Text(options.label ?? '', new TextStyle({ ...defaultTextStyle, ...options.textStyle }));
    this.labelText.anchor.set(0.5);
    this.addChild(this.labelText);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.setupInteractivity();
    this.redraw();
  }

  public redraw(): void {
    const bg = this.background;
    bg.clear();

    const alpha = this._disabled ? this._bgAlpha * 0.5 : this._bgAlpha;
    bg.beginFill(this._bgColor, alpha);

    if (this._borderWidth > 0) {
      bg.lineStyle(this._borderWidth, this._borderColor, this._disabled ? this._borderAlpha * 0.5 : this._borderAlpha);
    }

    bg.drawRoundedRect(
      -this._btnWidth / 2,
      -this._btnHeight / 2,
      this._btnWidth,
      this._btnHeight,
      this._radius
    );
    bg.endFill();

    this.labelText.alpha = this._disabled ? 0.5 : 1;
  }

  private setupInteractivity(): void {
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._disabled) return;
      this.scale.set(this._pressedScale);
    });

    this.on('pointerup', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._disabled) return;
      this.scale.set(1);
      if (this._sound) {
        audioManager.play(this._sound);
      }
      this._clickHandler?.();
    });

    this.on('pointerupoutside', () => {
      this.scale.set(1);
    });
  }

  public setLabel(text: string): this {
    this.labelText.text = text;
    return this;
  }

  public setColors(bgColor: number, borderColor = this._borderColor): this {
    this._bgColor = bgColor;
    this._borderColor = borderColor;
    this.redraw();
    return this;
  }

  public setDisabled(disabled: boolean): this {
    this._disabled = disabled;
    this.cursor = disabled ? 'default' : 'pointer';
    this.redraw();
    return this;
  }

  public get isDisabled(): boolean {
    return this._disabled;
  }

  public setOnClick(cb?: () => void): this {
    this._clickHandler = cb;
    return this;
  }

  public resize(width: number, height: number): this {
    this._btnWidth = width;
    this._btnHeight = height;
    this.redraw();
    return this;
  }
}
