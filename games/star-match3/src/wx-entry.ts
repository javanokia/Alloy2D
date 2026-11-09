import { Application, Container, Graphics, Sprite } from 'pixi.js';
import {
  gameEvents,
  platform,
  resizeStageToDesign,
  SceneManager,
  tweenManager,
} from '@wegame/hybrid-engine';
import { assetManager } from './assets/Match3AssetManager';
import { SceneName, stateSync, useGameStore } from './store/useGameStore';
import { DESIGN_HEIGHT, DESIGN_WIDTH, Match3System } from './systems/Match3System';
import { WxCanvasUISystem } from './systems/WxCanvasUISystem';

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
 * 微信小游戏端启动入口：通过依赖引入 @wegame/hybrid-engine 引擎模块启动游戏
 */
async function bootstrapWeChatMiniGame() {
  const { width: screenW, height: screenH, dpr } = platform.getScreenSize();
  const mainCanvas = (globalThis as unknown as { canvas?: HTMLCanvasElement }).canvas;

  const app = new Application({
    view: mainCanvas,
    width: screenW,
    height: screenH,
    backgroundColor: 0x070b19,
    resolution: dpr,
    autoDensity: true,
    antialias: true,
  });

  await assetManager.initBuiltInAtlas();

  const ambient = createWxAmbientBackground();
  app.stage.addChild(ambient.container);

  const sceneManager = new SceneManager<SceneName>(app, (nextScene) => {
    stateSync.state.scene = nextScene;
    stateSync.markDirty('scene');
  });

  const menuScene = new Container();
  const gameScene = new Container();
  const settlementScene = new Container();

  const match3System = new Match3System();
  gameScene.addChild(match3System.rootContainer);

  const wxUI = new WxCanvasUISystem(menuScene, gameScene, settlementScene);

  sceneManager.register('menu', menuScene);
  sceneManager.register('game', gameScene);
  sceneManager.register('settlement', settlementScene);

  app.stage.addChild(wxUI.modalLayer);

  sceneManager.switchTo('menu');
  match3System.startLevel(useGameStore.getState().level);

  gameEvents.on<{ scene: SceneName; level?: number }>('switch-scene', (payload) => {
    sceneManager.switchTo(payload.scene);
    if (payload.scene === 'game') {
      match3System.startLevel(payload.level ?? stateSync.state.level);
    }
  });

  resizeStageToDesign(app, DESIGN_WIDTH, DESIGN_HEIGHT);
  wxUI.applySafeAreaLayout();

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

  app.ticker.add((delta) => {
    ambient.update(delta);
    tweenManager.update(delta);
    match3System.update(delta);
    stateSync.flushDirty();
  });
}

bootstrapWeChatMiniGame();
