/**
 * 引擎内置事件总线：Pixi 渲染层与 React UI 层的双向解耦通信桥接 (对应文章 4.3 节)
 */
export type Handler<T = any> = (data: T) => void;
export type EventLogger = (event: string, payload?: unknown) => void;

export class EventBus {
  private handlers: Map<string, Handler[]> = new Map();
  private logger: EventLogger | null = null;

  public setLogger(logger: EventLogger | null): void {
    this.logger = logger;
  }

  public on<T = any>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return () => this.off(event, handler);
  }

  public emit<T = any>(event: string, data?: T): void {
    if (this.logger) {
      this.logger(event, data);
    }
    const list = this.handlers.get(event);
    if (list) {
      [...list].forEach((h) => h(data));
    }
  }

  public off<T = any>(event: string, handler: Handler<T>): void {
    const list = this.handlers.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    }
  }

  public clear(): void {
    this.handlers.clear();
  }
}

export const gameEvents = new EventBus();
