import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import Stats from 'stats.js';
import { platform } from '../../platform/PlatformAdapter';
import { SceneName, useGameStore } from '../../store/useGameStore';
import { tweenManager } from '../../utils/tween';
import { assetManager } from '../assets/AssetManager';
import { DESIGN_HEIGHT, DESIGN_WIDTH, Match3System } from '../systems/Match3System';
import { gameEvents } from './EventBus';
import { SceneManager } from './SceneManager';
import { stateSync } from './StateSync';

/**
 * 屏幕自适应缩放 (对应文章 5.1 节：从设计分辨率 750x1334 到实际屏幕计算缩放比例和居中留白)
 */
function resize(app: Application, designWidth: number, designHeight: number): void {
  const { width: screenW, height: screenH } = platform.getScreenSize();
  const scaleX = screenW / designWidth;
  const scaleY = screenH / designHeight;
  const scale = Math.min(scaleX, scaleY);

  app.renderer.resize(screenW, screenH);
  app.stage.scale.set(scale);
  app.stage.x = (screenW - designWidth * scale) / 2;
  app.stage.y = (screenH - designHeight * scale) / 2;
}

/**
 * 创建背景星空装饰场景（在主菜单与游戏场景底层共享动态氛围粒子）
 */
function createAmbientBackground(): {
  container: Container;
  update: (delta: number) => void;
} {
  const container = new Container();

  const bg = new Graphics();
  bg.beginFill(0x0f172a, 0.95);
  bg.lineStyle(2, 0x334155, 0.6);
  bg.drawRoundedRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 32);
  bg.endFill();
  bg.cacheAsBitmap = true;
  container.addChild(bg);

  const stars: Array<{ sprite: Sprite; speed: number; baseAlpha: number; phase: number }> = [];
  const starTex = assetManager.get('particle_star');

  if (starTex) {
    for (let i = 0; i < 24; i++) {
      const s = new Sprite(starTex);
      s.anchor.set(0.5);
      s.x = Math.random() * DESIGN_WIDTH;
      s.y = Math.random() * DESIGN_HEIGHT;
      s.scale.set(0.08 + Math.random() * 0.14);
      s.tint = i % 2 === 0 ? 0x38bdf8 : 0xc084fc;
      const baseAlpha = 0.2 + Math.random() * 0.45;
      s.alpha = baseAlpha;
      container.addChild(s);
      stars.push({
        sprite: s,
        speed: 0.25 + Math.random() * 0.45,
        baseAlpha,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  let time = 0;
  const update = (delta: number) => {
    time += 0.03 * delta;
    for (const st of stars) {
      st.sprite.y -= st.speed * delta;
      if (st.sprite.y < 10) {
        st.sprite.y = DESIGN_HEIGHT - 10;
        st.sprite.x = Math.random() * DESIGN_WIDTH;
      }
      st.sprite.alpha = st.baseAlpha + Math.sin(time + st.phase) * 0.15;
    }
  };

  return { container, update };
}

/**
 * Pixi.js 渲染画布容器组件
 * 对应文章 3.3 节 (应用创建与挂载)、3.4 节 (主循环与 React 协调)、6.1 节 (Stats 面板)、6.4 节 (防内存泄漏完整销毁)
 * 并集成前后台切换生命周期管理 (visibilitychange / onShow / onHide) 与 WebGL 上下文丢失自动恢复
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isDisposed = false;

    // 1. 初始化内置纹理图集 (含 4px Padding)
    assetManager.initBuiltInAtlas();

    // 2. 创建 Pixi Application 实例 (对应文章 3.3 节)
    const app = new Application({
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      backgroundColor: 0x070b19,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    const canvasEl = app.view as HTMLCanvasElement;
    containerRef.current.appendChild(canvasEl);
    appRef.current = app;

    // 3. 初始化 Stats.js 性能监控面板 (对应文章 6.1 节)
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    stats.dom.style.position = 'fixed';
    stats.dom.style.left = '12px';
    stats.dom.style.bottom = '12px';
    stats.dom.style.top = 'auto';
    stats.dom.style.zIndex = '50';
    stats.dom.style.borderRadius = '8px';
    stats.dom.style.overflow = 'hidden';
    document.body.appendChild(stats.dom);

    // 4. 构建场景管理器与游戏系统 (对应文章 4.2 节)
    const ambient = createAmbientBackground();
    app.stage.addChild(ambient.container);

    const sceneManager = new SceneManager(app);
    const menuScene = new Container();
    const gameScene = new Container();
    const settlementScene = new Container();

    const match3System = new Match3System();
    gameScene.addChild(match3System.rootContainer);

    sceneManager.register('menu', menuScene);
    sceneManager.register('game', gameScene);
    sceneManager.register('settlement', settlementScene);

    // 默认进入主菜单场景
    sceneManager.switchTo(useGameStore.getState().scene);
    match3System.startLevel(useGameStore.getState().level);

    // 监听来自 React UI 层的场景切换指令
    const unsubScene = gameEvents.on<{ scene: SceneName; level?: number }>('switch-scene', (payload) => {
      sceneManager.switchTo(payload.scene);
      if (payload.scene === 'game') {
        match3System.startLevel(payload.level ?? stateSync.state.level);
      }
    });

    // 5. 绑定前后台生命周期切换 (切后台暂停 Ticker 省电并挂起音频，回前台恢复)
    const unsubLifecycle = platform.onLifecycleChange((state) => {
      if (isDisposed) return;
      useGameStore.getState().recordLifecycleChange(state);
      gameEvents.emit('app-lifecycle', { state });
      if (state === 'hide') {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    });

    // 6. 绑定 WebGL 上下文丢失与自动恢复
    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (isDisposed) return;
      app.ticker.stop();
      useGameStore.getState().recordWebglContextLost();
      gameEvents.emit('webgl-context', { status: 'lost' });
    };

    const onContextRestored = async () => {
      if (isDisposed) return;
      assetManager.destroy();
      await assetManager.initBuiltInAtlas();
      match3System.startLevel(stateSync.state.level);
      app.ticker.start();
      gameEvents.emit('webgl-context', { status: 'restored' });
    };

    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    // 7. 初始执行一次屏幕适配并监听窗口缩放 (对应文章 5.1 与 7.3 节)
    const handleResize = () => {
      if (!isDisposed && appRef.current) {
        resize(appRef.current, DESIGN_WIDTH, DESIGN_HEIGHT);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // 8. 游戏主循环 Ticker (对应文章 3.4 节与 4.4 节)
    let telemetryTick = 0;
    const gameLoop = (delta: number) => {
      stats.begin();

      ambient.update(delta);
      tweenManager.update(delta);
      match3System.update(delta);

      // 帧末统一检查脏标记并批量同步到 Zustand Store (对应文章 4.4 节 flushDirty)
      stateSync.flushDirty();

      // 每 25 帧低频同步一次性能遥测指标到调试面板
      telemetryTick++;
      if (telemetryTick >= 25) {
        telemetryTick = 0;
        const store = useGameStore.getState();
        stats.dom.style.display = store.showInspector ? 'block' : 'none';
        store.updateTelemetry({
          fps: Math.round(app.ticker.FPS),
          drawCalls: 2,
          poolStats: match3System.effects.getTelemetry(),
        });
      }

      stats.end();
    };

    app.ticker.add(gameLoop);

    // 9. 清理函数：防止 React StrictMode 双重挂载导致内存泄漏或双 Canvas 叠加 (对应文章 6.4 节与第 8 节踩坑记录 3)
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      unsubLifecycle();
      unsubScene();
      tweenManager.clear();
      app.ticker.remove(gameLoop);

      if (stats.dom && stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }

      match3System.destroy();
      sceneManager.destroy();
      assetManager.destroy();

      app.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="pixi-canvas-host" />;
}
