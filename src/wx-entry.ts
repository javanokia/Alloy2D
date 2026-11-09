import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { assetManager } from './game/assets/AssetManager';
import { gameEvents } from './game/core/EventBus';
import { SceneManager } from './game/core/SceneManager';
import { stateSync } from './game/core/StateSync';
import { DESIGN_HEIGHT, DESIGN_WIDTH, Match3System } from './game/systems/Match3System';
import { WxCanvasUISystem } from './game/systems/WxCanvasUISystem';
import { platform } from './platform/PlatformAdapter';
import { SceneName, useGameStore } from './store/useGameStore';
import { tweenManager } from './utils/tween';

function resizeStage(app: Application, designWidth: number, designHeight: number): void {
  const { width: screenW, height: screenH } = platform.getScreenSize();
  const scaleX = screenW / designWidth;
  const scaleY = screenH / designHeight;
  const scale = Math.min(scaleX, scaleY);

  app.renderer.resize(screenW, screenH);
  app.stage.scale.set(scale);
  app.stage.x = (screenW - designWidth * scale) / 2;
  app.stage.y = (screenH - designHeight * scale) / 2;
}

function createWxAmbientBackground(): {
  container: Container;
  update: (delta: number) => void;
} {
  const container = new Container();

  const bg = new Graphics();
  bg.beginFill(0x0f172a, 0.96);
  bg.lineStyle(2, 0x334155, 0.6);
  bg.drawRoundedRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 32);
  bg.endFill();
  bg.cacheAsBitmap = true;
  container.addChild(bg);

  const stars: Array<{ sprite: Sprite; speed: number; baseAlpha: number; phase: number }> = [];
  const starTex = assetManager.get('particle_star');

  if (starTex) {
    for (let i = 0; i < 20; i++) {
      const s = new Sprite(starTex);
      s.anchor.set(0.5);
      s.x = Math.random() * DESIGN_WIDTH;
      s.y = Math.random() * DESIGN_HEIGHT;
      s.scale.set(0.08 + Math.random() * 0.14);
      s.tint = i % 2 === 0 ? 0x38bdf8 : 0xc084fc;
      const baseAlpha = 0.2 + Math.random() * 0.4;
      s.alpha = baseAlpha;
      container.addChild(s);
      stars.push({
        sprite: s,
        speed: 0.25 + Math.random() * 0.4,
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
 * 微信小游戏端启动入口 (对应文章 7.2 节：小游戏平台适配入口)
 */
async function bootstrapWeChatMiniGame() {
  const { width: screenW, height: screenH, dpr } = platform.getScreenSize();
  const mainCanvas = (globalThis as unknown as { canvas?: HTMLCanvasElement }).canvas;

  // 1. 先创建并绑定主屏 WebGL Canvas，再创建离屏 2D 图集 Canvas
  const app = new Application({
    view: mainCanvas,
    width: screenW,
    height: screenH,
    backgroundColor: 0x070b19,
    resolution: dpr,
    autoDensity: true,
    antialias: true,
  });

  // 2. 初始化带 4px Padding 的内置高分屏纹理图集
  await assetManager.initBuiltInAtlas();

  // 3. 构建背景与场景管理器
  const ambient = createWxAmbientBackground();
  app.stage.addChild(ambient.container);

  const sceneManager = new SceneManager(app);
  const menuScene = new Container();
  const gameScene = new Container();
  const settlementScene = new Container();

  const match3System = new Match3System();
  gameScene.addChild(match3System.rootContainer);

  // 4. 挂载微信小游戏 Canvas UI 视图与模态弹窗系统
  const wxUI = new WxCanvasUISystem(menuScene, gameScene, settlementScene);

  sceneManager.register('menu', menuScene);
  sceneManager.register('game', gameScene);
  sceneManager.register('settlement', settlementScene);

  // 将模态弹窗层挂载在 stage 最顶层，确保覆盖所有场景并拦截穿透点击
  app.stage.addChild(wxUI.modalLayer);

  sceneManager.switchTo('menu');
  match3System.startLevel(useGameStore.getState().level);

  gameEvents.on<{ scene: SceneName; level?: number }>('switch-scene', (payload) => {
    sceneManager.switchTo(payload.scene);
    if (payload.scene === 'game') {
      match3System.startLevel(payload.level ?? stateSync.state.level);
    }
  });

  // 5. 执行 750x1334 设计分辨率与刘海屏/胶囊安全区适配
  resizeStage(app, DESIGN_WIDTH, DESIGN_HEIGHT);
  wxUI.applySafeAreaLayout();

  // 6. 绑定微信小游戏前后台生命周期 (wx.onShow / wx.onHide)
  platform.onLifecycleChange((state) => {
    useGameStore.getState().recordLifecycleChange(state);
    gameEvents.emit('app-lifecycle', { state });
    if (state === 'hide') {
      app.ticker.stop();
    } else {
      wxUI.applySafeAreaLayout();
      app.ticker.start();
    }
  });

  // 7. 绑定 WebGL 上下文丢失与自动恢复监听
  const canvasEl = app.view as HTMLCanvasElement;
  if (canvasEl && typeof canvasEl.addEventListener === 'function') {
    canvasEl.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault();
      app.ticker.stop();
      useGameStore.getState().recordWebglContextLost();
      gameEvents.emit('webgl-context', { status: 'lost' });
    });
    canvasEl.addEventListener('webglcontextrestored', async () => {
      assetManager.destroy();
      await assetManager.initBuiltInAtlas();
      match3System.startLevel(stateSync.state.level);
      app.ticker.start();
      gameEvents.emit('webgl-context', { status: 'restored' });
    });
  }

  // 8. 启动主循环 Ticker 与帧末 DirtyFlag 同步
  app.ticker.add((delta) => {
    ambient.update(delta);
    tweenManager.update(delta);
    match3System.update(delta);
    stateSync.flushDirty();
  });
}

bootstrapWeChatMiniGame();
