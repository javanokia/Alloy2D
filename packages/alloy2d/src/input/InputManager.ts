/**
 * 引擎通用输入与手势管理系统 (v1.1 新增)
 * - 统一 Pointer Down / Move / Up 事件
 * - 将实际屏幕物理坐标映射到设计分辨率坐标系 (Design Resolution Coordinates)
 * - 内置手势识别：Tap (点击)、Double Tap (双击)、Long Press (长按)、Swipe (滑动方向与速度)、Drag (拖拽)
 */

export interface ScreenTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PointerPoint {
  /** 屏幕物理像素坐标 */
  screenX: number;
  screenY: number;
  /** 映射到设计分辨率坐标系的坐标 */
  designX: number;
  designY: number;
  pointerId: number;
  timestamp: number;
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface SwipeEvent {
  direction: SwipeDirection;
  distance: number;
  velocity: number;
  startPoint: PointerPoint;
  endPoint: PointerPoint;
}

export interface DragEvent {
  state: 'start' | 'move' | 'end';
  point: PointerPoint;
  dx: number;
  dy: number;
  totalDx: number;
  totalDy: number;
}

export interface GestureCallbacks {
  onTap?: (point: PointerPoint) => void;
  onDoubleTap?: (point: PointerPoint) => void;
  onLongPress?: (point: PointerPoint) => void;
  onSwipe?: (event: SwipeEvent) => void;
  onDrag?: (event: DragEvent) => void;
  onPointerDown?: (point: PointerPoint) => void;
  onPointerMove?: (point: PointerPoint) => void;
  onPointerUp?: (point: PointerPoint) => void;
}

export interface InputManagerOptions {
  /** 屏幕转换参数获取函数 (通常来自 resizeStageToDesign 的计算结果) */
  getTransform: () => ScreenTransform;
  /** 手势阈值配置 */
  thresholds?: {
    tapMaxDistance?: number;
    tapMaxDurationMs?: number;
    doubleTapIntervalMs?: number;
    longPressDurationMs?: number;
    swipeMinDistance?: number;
  };
}

export class InputManager {
  private readonly getTransform: () => ScreenTransform;
  private readonly tapMaxDist: number;
  private readonly tapMaxDuration: number;
  private readonly doubleTapInterval: number;
  private readonly longPressDuration: number;
  private readonly swipeMinDistance: number;

  private listeners: GestureCallbacks = {};
  private activePointers = new Map<
    number,
    {
      startPoint: PointerPoint;
      lastPoint: PointerPoint;
      timer: ReturnType<typeof setTimeout> | null;
      isDragging: boolean;
      hasLongPressed: boolean;
    }
  >();

  private lastTapTime = 0;
  private lastTapPoint: PointerPoint | null = null;

  constructor(options: InputManagerOptions) {
    this.getTransform = options.getTransform;
    const th = options.thresholds || {};
    this.tapMaxDist = th.tapMaxDistance ?? 12;
    this.tapMaxDuration = th.tapMaxDurationMs ?? 280;
    this.doubleTapInterval = th.doubleTapIntervalMs ?? 300;
    this.longPressDuration = th.longPressDurationMs ?? 500;
    this.swipeMinDistance = th.swipeMinDistance ?? 30;
  }

  /**
   * 将屏幕实际物理像素转换为设计分辨率坐标
   */
  public screenToDesign(screenX: number, screenY: number): { x: number; y: number } {
    const { scale, offsetX, offsetY } = this.getTransform();
    const safeScale = scale > 0 ? scale : 1;
    return {
      x: (screenX - offsetX) / safeScale,
      y: (screenY - offsetY) / safeScale,
    };
  }

  /**
   * 将设计分辨率坐标反向转换为屏幕实际物理像素
   */
  public designToScreen(designX: number, designY: number): { x: number; y: number } {
    const { scale, offsetX, offsetY } = this.getTransform();
    return {
      x: designX * scale + offsetX,
      y: designY * scale + offsetY,
    };
  }

  public setCallbacks(callbacks: GestureCallbacks): this {
    this.listeners = { ...this.listeners, ...callbacks };
    return this;
  }

  /**
   * 绑定到 DOM 元素 (Canvas 或 Window)
   */
  public attach(target: EventTarget): () => void {
    const onDown = (e: Event) => {
      const pe = e as PointerEvent;
      this.handlePointerDown(pe.clientX, pe.clientY, pe.pointerId ?? 0);
    };

    const onMove = (e: Event) => {
      const pe = e as PointerEvent;
      this.handlePointerMove(pe.clientX, pe.clientY, pe.pointerId ?? 0);
    };

    const onUp = (e: Event) => {
      const pe = e as PointerEvent;
      this.handlePointerUp(pe.clientX, pe.clientY, pe.pointerId ?? 0);
    };

    const targetEl = target as {
      addEventListener: (type: string, listener: (e: Event) => void, options?: unknown) => void;
      removeEventListener: (type: string, listener: (e: Event) => void) => void;
    };

    targetEl.addEventListener('pointerdown', onDown, { passive: true });
    targetEl.addEventListener('pointermove', onMove, { passive: true });
    targetEl.addEventListener('pointerup', onUp, { passive: true });
    targetEl.addEventListener('pointercancel', onUp, { passive: true });

    return () => {
      targetEl.removeEventListener('pointerdown', onDown);
      targetEl.removeEventListener('pointermove', onMove);
      targetEl.removeEventListener('pointerup', onUp);
      targetEl.removeEventListener('pointercancel', onUp);
    };
  }

  public handlePointerDown(screenX: number, screenY: number, pointerId = 0): void {
    const now = Date.now();
    const { x: designX, y: designY } = this.screenToDesign(screenX, screenY);
    const point: PointerPoint = {
      screenX,
      screenY,
      designX,
      designY,
      pointerId,
      timestamp: now,
    };

    const timer = setTimeout(() => {
      const entry = this.activePointers.get(pointerId);
      if (entry && !entry.isDragging) {
        entry.hasLongPressed = true;
        this.listeners.onLongPress?.(entry.lastPoint);
      }
    }, this.longPressDuration);

    this.activePointers.set(pointerId, {
      startPoint: point,
      lastPoint: point,
      timer,
      isDragging: false,
      hasLongPressed: false,
    });

    this.listeners.onPointerDown?.(point);
  }

  public handlePointerMove(screenX: number, screenY: number, pointerId = 0): void {
    const entry = this.activePointers.get(pointerId);
    if (!entry) return;

    const { x: designX, y: designY } = this.screenToDesign(screenX, screenY);
    const point: PointerPoint = {
      screenX,
      screenY,
      designX,
      designY,
      pointerId,
      timestamp: Date.now(),
    };

    const dx = point.designX - entry.lastPoint.designX;
    const dy = point.designY - entry.lastPoint.designY;
    const totalDx = point.designX - entry.startPoint.designX;
    const totalDy = point.designY - entry.startPoint.designY;
    const dist = Math.hypot(totalDx, totalDy);

    if (!entry.isDragging && dist > this.tapMaxDist) {
      entry.isDragging = true;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      this.listeners.onDrag?.({
        state: 'start',
        point,
        dx,
        dy,
        totalDx,
        totalDy,
      });
    } else if (entry.isDragging) {
      this.listeners.onDrag?.({
        state: 'move',
        point,
        dx,
        dy,
        totalDx,
        totalDy,
      });
    }

    entry.lastPoint = point;
    this.listeners.onPointerMove?.(point);
  }

  public handlePointerUp(screenX: number, screenY: number, pointerId = 0): void {
    const entry = this.activePointers.get(pointerId);
    if (!entry) return;

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const { x: designX, y: designY } = this.screenToDesign(screenX, screenY);
    const point: PointerPoint = {
      screenX,
      screenY,
      designX,
      designY,
      pointerId,
      timestamp: Date.now(),
    };

    const totalDx = point.designX - entry.startPoint.designX;
    const totalDy = point.designY - entry.startPoint.designY;
    const dist = Math.hypot(totalDx, totalDy);
    const duration = point.timestamp - entry.startPoint.timestamp;

    if (entry.isDragging) {
      this.listeners.onDrag?.({
        state: 'end',
        point,
        dx: point.designX - entry.lastPoint.designX,
        dy: point.designY - entry.lastPoint.designY,
        totalDx,
        totalDy,
      });
    }

    // 手势判断：Swipe vs Tap
    if (dist >= this.swipeMinDistance && duration < 600) {
      let direction: SwipeDirection;
      if (Math.abs(totalDx) >= Math.abs(totalDy)) {
        direction = totalDx > 0 ? 'right' : 'left';
      } else {
        direction = totalDy > 0 ? 'down' : 'up';
      }
      const velocity = dist / Math.max(1, duration);
      this.listeners.onSwipe?.({
        direction,
        distance: dist,
        velocity,
        startPoint: entry.startPoint,
        endPoint: point,
      });
    } else if (!entry.isDragging && !entry.hasLongPressed && dist <= this.tapMaxDist && duration <= this.tapMaxDuration) {
      const now = point.timestamp;
      const isDoubleTap =
        this.lastTapPoint &&
        now - this.lastTapTime <= this.doubleTapInterval &&
        Math.hypot(
          point.designX - this.lastTapPoint.designX,
          point.designY - this.lastTapPoint.designY
        ) <= this.tapMaxDist * 1.5;

      if (isDoubleTap) {
        this.listeners.onDoubleTap?.(point);
        this.lastTapTime = 0;
        this.lastTapPoint = null;
      } else {
        this.listeners.onTap?.(point);
        this.lastTapTime = now;
        this.lastTapPoint = point;
      }
    }

    this.activePointers.delete(pointerId);
    this.listeners.onPointerUp?.(point);
  }

  public destroy(): void {
    for (const entry of this.activePointers.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.activePointers.clear();
    this.listeners = {};
  }
}
