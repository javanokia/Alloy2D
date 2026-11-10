/**
 * 微信小游戏通用启动模板 (v1.1 新增)
 * 统一处理：Pixi Application 创建、资源加载、设计分辨率适配、前后台生命周期、
 * WebGL 上下文丢失/恢复、主循环 (tweenManager + 业务 update)
 * 业务工程只需提供 loadAssets 与 setup 两个钩子。
 */
import { Application } from 'pixi.js';
import { gameEvents } from '../core/EventBus';
import { resizeStageToDesign } from '../core/screenResize';
import { tweenManager } from '../utils/tween';
import { LifecycleState, platform, PlatformAdapter } from './PlatformAdapter';

export interface WxGameHooks {
  /** 每帧调用 (在 tweenManager.update 之后) */
  update?(delta: number): void;
  /** 首次启动与每次回到前台时调用，用于重新计算安全区布局 */
  onLayout?(): void;
  /** 前后台切换 (引擎已自动暂停/恢复 ticker 与音频) */
  onLifecycle?(state: LifecycleState): void;
  onContextLost?(): void;
  /** WebGL 上下文恢复：资源已通过 reloadAssets 重建，业务在此重建场景对象 */
  onContextRestored?(): void | Promise<void>;
}

export interface WxBootstrapOptions {
  designWidth: number;
  designHeight: number;
  backgroundColor?: number;
  antialias?: boolean;
  /** 首次资源加载 (图集等)，在 setup 之前完成 */
  loadAssets?(): Promise<void>;
  /** WebGL 上下文恢复后重新加载资源；默认复用 loadAssets */
  reloadAssets?(): Promise<void>;
  /** 构建场景与系统，返回运行期钩子 */
  setup(app: Application): WxGameHooks | Promise<WxGameHooks>;
  /** 每 N 帧回调一次遥测数据 (FPS)，默认不启用 */
  telemetry?: { intervalFrames?: number; report(data: { fps: number }): void };
  /** 测试注入：自定义画布 (默认取全局 canvas) */
  view?: HTMLCanvasElement;
  /** 可选注入平台适配器 (默认自动根据当前运行环境选用) */
  platformAdapter?: PlatformAdapter;
  /** 可选注入 Application 工厂 (主要用于单元测试与特殊渲染器注入) */
  createApp?(options: Record<string, unknown>): Application;
}

export interface WxGameRuntime {
  app: Application;
  hooks: WxGameHooks;
  dispose(): void;
}

export async function bootstrapWxGame(options: WxBootstrapOptions): Promise<WxGameRuntime> {
  const currentPlatform = options.platformAdapter ?? platform;
  const { width, height, dpr } = currentPlatform.getScreenSize();
  const view =
    options.view ?? (globalThis as unknown as { canvas?: HTMLCanvasElement }).canvas;

  const app = options.createApp
    ? options.createApp({
        view,
        width,
        height,
        backgroundColor: options.backgroundColor ?? 0x000000,
        resolution: dpr,
        autoDensity: true,
        antialias: options.antialias ?? true,
      })
    : new Application({
        view,
        width,
        height,
        backgroundColor: options.backgroundColor ?? 0x000000,
        resolution: dpr,
        autoDensity: true,
        antialias: options.antialias ?? true,
      });

  await options.loadAssets?.();
  const hooks = await options.setup(app);

  resizeStageToDesign(app, options.designWidth, options.designHeight);
  hooks.onLayout?.();

  const disposers: Array<() => void> = [];

  disposers.push(
    currentPlatform.onLifecycleChange((state: LifecycleState) => {
      gameEvents.emit('app-lifecycle', { state });
      if (state === 'hide') {
        app.ticker.stop();
      } else {
        hooks.onLayout?.();
        app.ticker.start();
      }
      hooks.onLifecycle?.(state);
    })
  );

  const canvasEl = app.view as HTMLCanvasElement;
  if (canvasEl && typeof canvasEl.addEventListener === 'function') {
    const onLost = (e: Event) => {
      e.preventDefault();
      app.ticker.stop();
      hooks.onContextLost?.();
      gameEvents.emit('webgl-context', { status: 'lost' });
    };
    const onRestored = async () => {
      const reload = options.reloadAssets ?? options.loadAssets;
      await reload?.();
      await hooks.onContextRestored?.();
      app.ticker.start();
      gameEvents.emit('webgl-context', { status: 'restored' });
    };
    canvasEl.addEventListener('webglcontextlost', onLost);
    canvasEl.addEventListener('webglcontextrestored', onRestored);
    disposers.push(() => {
      canvasEl.removeEventListener('webglcontextlost', onLost);
      canvasEl.removeEventListener('webglcontextrestored', onRestored);
    });
  }

  const interval = Math.max(1, options.telemetry?.intervalFrames ?? 30);
  let frame = 0;
  const tick = (delta: number) => {
    tweenManager.update(delta);
    hooks.update?.(delta);
    if (options.telemetry) {
      frame++;
      if (frame >= interval) {
        frame = 0;
        options.telemetry.report({ fps: Math.round(app.ticker.FPS) });
      }
    }
  };
  app.ticker.add(tick);
  disposers.push(() => app.ticker.remove(tick));

  return {
    app,
    hooks,
    dispose: () => disposers.splice(0).forEach((d) => d()),
  };
}

/** 启动并在失败时输出错误，适合直接作为 wx-entry 的顶层调用 */
export function runWxGame(options: WxBootstrapOptions): void {
  bootstrapWxGame(options).catch((err) => {
    console.error('[@wegame/hybrid-engine] 微信小游戏启动失败:', err);
  });
}
