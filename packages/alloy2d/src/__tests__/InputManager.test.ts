import { describe, expect, it, vi } from 'vitest';
import { DragEvent, InputManager, SwipeEvent } from '../input/InputManager';

describe('InputManager (通用输入与手势识别)', () => {
  it('屏幕像素坐标与设计分辨率坐标双向映射 (带 scale 与居中 offset)', () => {
    // 假设设计分辨率 750x1334，实际屏幕 375x667，scale=0.5，offsetX=0，offsetY=0
    const input = new InputManager({
      getTransform: () => ({ scale: 0.5, offsetX: 0, offsetY: 0 }),
    });

    const design = input.screenToDesign(100, 200);
    expect(design.x).toBe(200);
    expect(design.y).toBe(400);

    const screen = input.designToScreen(200, 400);
    expect(screen.x).toBe(100);
    expect(screen.y).toBe(200);
  });

  it('点击识别 (Tap)：在阈值范围内抬起触发 onTap', () => {
    const input = new InputManager({
      getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
    });

    const onTap = vi.fn();
    input.setCallbacks({ onTap });

    input.handlePointerDown(100, 100, 1);
    input.handlePointerUp(102, 101, 1);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap.mock.calls[0][0].designX).toBe(102);
    expect(onTap.mock.calls[0][0].designY).toBe(101);
  });

  it('双击识别 (Double Tap)：短间隔内两次点击触发 onDoubleTap', () => {
    const input = new InputManager({
      getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
      thresholds: { doubleTapIntervalMs: 250 },
    });

    const onTap = vi.fn();
    const onDoubleTap = vi.fn();
    input.setCallbacks({ onTap, onDoubleTap });

    // 第一次点击
    input.handlePointerDown(100, 100, 1);
    input.handlePointerUp(100, 100, 1);
    expect(onTap).toHaveBeenCalledTimes(1);

    // 快速进行第二次点击
    input.handlePointerDown(102, 101, 1);
    input.handlePointerUp(102, 101, 1);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('滑动手势识别 (Swipe)：快速大跨度位移识别方向', () => {
    const input = new InputManager({
      getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
      thresholds: { swipeMinDistance: 40 },
    });

    let detectedSwipe: SwipeEvent | null = null;
    input.setCallbacks({
      onSwipe: (e) => {
        detectedSwipe = e;
      },
    });

    // 从 (100, 100) 向右大幅滑动到 (200, 105)
    input.handlePointerDown(100, 100, 1);
    input.handlePointerMove(150, 102, 1);
    input.handlePointerUp(200, 105, 1);

    expect(detectedSwipe).not.toBeNull();
    expect(detectedSwipe!.direction).toBe('right');
    expect(detectedSwipe!.distance).toBeGreaterThan(90);
  });

  it('拖拽识别 (Drag)：位移超出 tapMaxDist 触发 start、move、end', () => {
    const input = new InputManager({
      getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
      thresholds: { tapMaxDistance: 10 },
    });

    const dragEvents: DragEvent[] = [];
    input.setCallbacks({
      onDrag: (e) => dragEvents.push(e),
    });

    input.handlePointerDown(50, 50, 1);
    // 小幅度移动未超过 10px，不触发 drag
    input.handlePointerMove(52, 53, 1);
    expect(dragEvents.length).toBe(0);

    // 大幅度移动超过 10px，触发 start 与后续 move
    input.handlePointerMove(80, 50, 1);
    expect(dragEvents.some((e) => e.state === 'start')).toBe(true);

    input.handlePointerMove(90, 50, 1);
    expect(dragEvents.some((e) => e.state === 'move')).toBe(true);

    input.handlePointerUp(95, 50, 1);
    expect(dragEvents.some((e) => e.state === 'end')).toBe(true);
  });

  it('长按识别 (Long Press)：按住不动超时后触发 onLongPress', async () => {
    vi.useFakeTimers();

    const input = new InputManager({
      getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
      thresholds: { longPressDurationMs: 300 },
    });

    const onLongPress = vi.fn();
    input.setCallbacks({ onLongPress });

    input.handlePointerDown(200, 300, 1);
    expect(onLongPress).not.toHaveBeenCalled();

    // 时间推进 300ms
    vi.advanceTimersByTime(300);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress.mock.calls[0][0].designX).toBe(200);

    input.handlePointerUp(200, 300, 1);
    vi.useRealTimers();
  });
});
