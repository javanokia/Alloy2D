import { useGameStore } from '../../store/useGameStore';

/**
 * 事件总线：Pixi 渲染层与 React UI 层的双向通信桥接 (对应文章 4.3 节)
 */
export type Handler<T = any> = (data: T) => void;

export class EventBus {
  private handlers: Map<string, Handler[]> = new Map();

  on<T = any>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  emit<T = any>(event: string, data?: T): void {
    // 同步记录到架构监控日志
    useGameStore.getState().appendEventLog(event, data);

    const list = this.handlers.get(event);
    if (list) {
      // 拷贝一份防止回调中解绑导致遍历跳过
      [...list].forEach((h) => h(data));
    }
  }

  off<T = any>(event: string, handler: Handler<T>): void {
    const list = this.handlers.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const gameEvents = new EventBus();
