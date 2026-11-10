/**
 * 引擎通用 Canvas 模态弹窗容器组件 (v1.1 新增)
 * 提供全屏半透明遮罩、居中卡片容器、标题栏、关闭按钮及入场弹性回弹缓动动画
 */
import { Container, FederatedPointerEvent, Graphics, Text, TextStyle, type TextStyleOptions } from 'pixi.js';
import { animateTransform, Easing } from '../utils/tween';
import { CanvasButton } from './CanvasButton';
import { CanvasPanel } from './CanvasPanel';

export interface CanvasModalOptions {
  designWidth?: number;
  designHeight?: number;
  cardWidth?: number;
  cardHeight?: number;
  title?: string;
  titleTextStyle?: TextStyleOptions;
  backdropAlpha?: number;
  backdropColor?: number;
  closeOnBackdropClick?: boolean;
  onClose?: () => void;
}

export class CanvasModal extends Container {
  public readonly backdrop: Graphics;
  public readonly card: CanvasPanel;
  public readonly titleText: Text;
  public readonly closeButton: CanvasButton;
  public readonly contentContainer: Container;

  private _onClose?: () => void;
  private _isOpen = false;

  constructor(options: CanvasModalOptions = {}) {
    super();

    const dw = options.designWidth ?? 750;
    const dh = options.designHeight ?? 1334;
    const cardW = options.cardWidth ?? 560;
    const cardH = options.cardHeight ?? 680;
    this._onClose = options.onClose;

    // 1. 全屏半透明遮罩
    this.backdrop = new Graphics();
    this.backdrop
      .rect(-500, -500, dw + 1000, dh + 1000)
      .fill({ color: options.backdropColor ?? 0x030712, alpha: options.backdropAlpha ?? 0.75 });
    this.backdrop.eventMode = 'static';

    this.backdrop.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
    });

    if (options.closeOnBackdropClick !== false) {
      this.backdrop.on('pointerup', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.close();
      });
    }
    this.addChild(this.backdrop);

    // 2. 居中卡片
    this.card = new CanvasPanel({
      width: cardW,
      height: cardH,
      radius: 32,
      backgroundColor: 0x0f172a,
      borderColor: 0x38bdf8,
      borderWidth: 3,
    });
    this.card.x = dw / 2;
    this.card.y = dh / 2;
    this.card.eventMode = 'static';
    this.card.on('pointerdown', (e: FederatedPointerEvent) => e.stopPropagation());
    this.card.on('pointerup', (e: FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this.card);

    // 3. 标题文本
    const defaultTitleStyle: TextStyleOptions = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 30,
      fontWeight: 'bold',
      fill: '#ffffff',
    };
    this.titleText = new Text({
      text: options.title ?? '',
      style: new TextStyle({ ...defaultTitleStyle, ...options.titleTextStyle }),
    });
    this.titleText.anchor.set(0.5);
    this.titleText.y = -cardH / 2 + 50;
    this.card.addChild(this.titleText);

    // 4. 右上角关闭按钮
    this.closeButton = new CanvasButton({
      width: 44,
      height: 44,
      radius: 22,
      backgroundColor: 0x1e293b,
      borderColor: 0xef4444,
      borderWidth: 2,
      label: '✕',
      textStyle: { fontSize: 20, fill: '#ef4444' },
      onClick: () => this.close(),
    });
    this.closeButton.x = cardW / 2 - 40;
    this.closeButton.y = -cardH / 2 + 45;
    this.card.addChild(this.closeButton);

    // 5. 业务内容容器
    this.contentContainer = new Container();
    this.card.addChild(this.contentContainer);

    this.visible = false;
  }

  public open(title?: string): void {
    if (title !== undefined) {
      this.titleText.text = title;
    }
    this.visible = true;
    this._isOpen = true;

    // 弹性入场动画
    this.card.scale.set(0.85);
    this.card.alpha = 0.2;
    animateTransform(this.card, {
      toScaleX: 1,
      toScaleY: 1,
      toAlpha: 1,
      durationMS: 240,
      ease: Easing.easeOutBack,
    });
  }

  public close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.visible = false;
    this._onClose?.();
  }

  public setTitle(title: string): this {
    this.titleText.text = title;
    return this;
  }

  public setOnClose(cb?: () => void): this {
    this._onClose = cb;
    return this;
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }
}
