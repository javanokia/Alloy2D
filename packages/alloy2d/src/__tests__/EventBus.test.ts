import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../core/EventBus';

describe('EventBus (跨层双向通信事件总线)', () => {
  it('能够正常注册监听并接收强类型事件载荷', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on<{ row: number; col: number }>('tile-clicked', handler);
    bus.emit('tile-clicked', { row: 3, col: 5 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ row: 3, col: 5 });
  });

  it('支持同一事件挂载多个监听器并按注册顺序触发', () => {
    const bus = new EventBus();
    const callOrder: string[] = [];

    bus.on('combo', () => callOrder.push('first'));
    bus.on('combo', () => callOrder.push('second'));

    bus.emit('combo', 4);
    expect(callOrder).toEqual(['first', 'second']);
  });

  it('支持通过 on 返回的清理函数或 off 显式解绑监听', () => {
    const bus = new EventBus();
    const fnA = vi.fn();
    const fnB = vi.fn();

    const unsubA = bus.on('evt', fnA);
    bus.on('evt', fnB);

    unsubA();
    bus.off('evt', fnB);

    bus.emit('evt', 'payload');
    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).not.toHaveBeenCalled();
  });

  it('在事件触发过程中某个监听器自解绑时，不会跳过后续监听器', () => {
    const bus = new EventBus();
    const secondHandler = vi.fn();

    const selfUnsub = bus.on('once-evt', () => {
      selfUnsub();
    });
    bus.on('once-evt', secondHandler);

    bus.emit('once-evt');
    expect(secondHandler).toHaveBeenCalledTimes(1);

    bus.emit('once-evt');
    expect(secondHandler).toHaveBeenCalledTimes(2);
  });

  it('支持配置全局事件日志记录器 setLogger 及 clear 清空所有事件', () => {
    const bus = new EventBus();
    const logger = vi.fn();
    const handler = vi.fn();

    bus.setLogger(logger);
    bus.on('switch-scene', handler);
    bus.emit('switch-scene', { scene: 'game', level: 2 });

    expect(logger).toHaveBeenCalledWith('switch-scene', { scene: 'game', level: 2 });
    expect(handler).toHaveBeenCalledTimes(1);

    bus.clear();
    bus.emit('switch-scene', { scene: 'menu' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
