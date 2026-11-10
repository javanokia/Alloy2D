import { useEffect, useRef } from 'react';
import { Application, Ticker } from 'pixi.js';
import Stats from 'stats.js';
import { gameEvents } from '../core/EventBus';
import { resizeStageToDesign } from '../core/screenResize';
import { LifecycleState, platform } from '../platform/PlatformAdapter';
import { tweenManager } from '../utils/tween';

export interface HybridGameInstance {
  /** 每帧主循环逻辑更新 */
  onTick: (delta: number, app: Application) => void;
  /** WebGL 上下文恢复时重建纹理与场景 */
  onContextRestored?: (app: Application) => Promise<void> | void;
  /** 组件卸载或 StrictMode 重挂载时的清理回调 */
  onDestroy: () => void;
}

export interface HybridCanvasHostProps {
  designWidth?: number;
  designHeight?: number;
  backgroundColor?: number;
  className?: string;
  /** 初始化并挂载业务游戏系统的钩子 */
  onBootstrap: (app: Application) => HybridGameInstance;
  /** 前后台切换回调 */
  onLifecycleChange?: (state: LifecycleState) => void;
  /** WebGL 上下文丢失回调 */
  onWebglContextLost?: () => void;
  /** 是否显示左下角 Stats.js 面板 */
  isInspectorVisible?: () => boolean;
}

/**
 * 引擎内置 React 宿主组件：负责 Pixi.js Application 创建、750x1334 缩放、
 * Stats.js 面板、前后台生命周期、WebGL 上下文恢复以及 React StrictMode 安全销毁
 */
export function HybridCanvasHost({
  designWidth = 750,
  designHeight = 1334,
  backgroundColor = 0x070b19,
  className = 'pixi-canvas-host',
  onBootstrap,
  onLifecycleChange,
  onWebglContextLost,
  isInspectorVisible,
}: HybridCanvasHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let isDisposed = false;
    let stats: Stats | null = null;
    let unsubLifecycle: (() => void) | null = null;
    let handleResize: (() => void) | null = null;
    let handleContextLost: ((e: Event) => void) | null = null;
    let handleContextRestored: (() => void) | null = null;
    let gameLoop: ((tickerOrDelta: Ticker | number) => void) | null = null;
    let gameInstance: HybridGameInstance | null = null;
    let canvasEl: HTMLCanvasElement | null = null;

    const app = new Application();

    (async () => {
      try {
        await app.init({
          width: designWidth,
          height: designHeight,
          backgroundColor,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          antialias: true,
          preference: 'webgl',
        });
      } catch (err) {
        console.error('[alloy2d] Application init error:', err);
        return;
      }

      if (isDisposed) {
        try {
          app.destroy(true, { children: true, texture: true });
        } catch {}
        return;
      }

      canvasEl = (app.canvas ?? (app as unknown as { view?: HTMLCanvasElement }).view) as HTMLCanvasElement;
      if (containerRef.current && canvasEl) {
        containerRef.current.appendChild(canvasEl);
      }
      appRef.current = app;

      // Stats.js 性能监控面板
      stats = new Stats();
      stats.showPanel(0);
      stats.dom.style.position = 'fixed';
      stats.dom.style.left = '12px';
      stats.dom.style.bottom = '12px';
      stats.dom.style.top = 'auto';
      stats.dom.style.zIndex = '50';
      stats.dom.style.borderRadius = '8px';
      stats.dom.style.overflow = 'hidden';
      document.body.appendChild(stats.dom);

      // 挂载游戏业务实例
      gameInstance = onBootstrap(app);

      // 绑定前后台生命周期切换
      unsubLifecycle = platform.onLifecycleChange((state) => {
        if (isDisposed) return;
        onLifecycleChange?.(state);
        gameEvents.emit('app-lifecycle', { state });
        if (state === 'hide') {
          app.ticker.stop();
        } else {
          app.ticker.start();
        }
      });

      // 绑定 WebGL 上下文丢失与自动恢复
      handleContextLost = (e: Event) => {
        e.preventDefault();
        if (isDisposed) return;
        app.ticker.stop();
        onWebglContextLost?.();
        gameEvents.emit('webgl-context', { status: 'lost' });
      };

      handleContextRestored = async () => {
        if (isDisposed) return;
        await gameInstance?.onContextRestored?.(app);
        app.ticker.start();
        gameEvents.emit('webgl-context', { status: 'restored' });
      };

      if (canvasEl) {
        canvasEl.addEventListener('webglcontextlost', handleContextLost);
        canvasEl.addEventListener('webglcontextrestored', handleContextRestored);
      }

      // 屏幕自适应缩放
      handleResize = () => {
        if (!isDisposed && appRef.current) {
          resizeStageToDesign(appRef.current, designWidth, designHeight);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      // 主循环 Ticker
      gameLoop = (tickerOrDelta: Ticker | number) => {
        const delta = typeof tickerOrDelta === 'number' ? tickerOrDelta : (tickerOrDelta?.deltaTime ?? 1);
        stats?.begin();
        tweenManager.update(delta);
        gameInstance?.onTick(delta, app);
        if (isInspectorVisible && stats) {
          stats.dom.style.display = isInspectorVisible() ? 'block' : 'none';
        }
        stats?.end();
      };

      app.ticker.add(gameLoop);
    })();

    return () => {
      isDisposed = true;
      if (handleResize) window.removeEventListener('resize', handleResize);
      if (canvasEl) {
        if (handleContextLost) canvasEl.removeEventListener('webglcontextlost', handleContextLost);
        if (handleContextRestored) canvasEl.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      if (unsubLifecycle) unsubLifecycle();
      tweenManager.clear();
      if (gameLoop) app.ticker.remove(gameLoop);

      if (stats?.dom && stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }

      if (gameInstance) {
        gameInstance.onDestroy();
      }
      try {
        app.destroy(true, { children: true, texture: true });
      } catch {}
      appRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
