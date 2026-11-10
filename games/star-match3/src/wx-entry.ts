import { Container, Graphics, Sprite } from 'pixi.js';
import { gameEvents, runWxGame, SceneManager } from 'alloy2d';
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
  bg.roundRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 32);
  bg.fill({ color: 0x0f172a, alpha: 0.96 });
  bg.stroke({ width: 2, color: 0x334155, alpha: 0.6 });
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
 * 微信小游戏端启动入口：通用流程 (Application/适配/生命周期/上下文恢复/主循环) 由引擎 runWxGame 负责
 */
runWxGame({
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  backgroundColor: 0x070b19,
  loadAssets: () => assetManager.initBuiltInAtlas(),
  reloadAssets: async () => {
    assetManager.destroy();
    await assetManager.initBuiltInAtlas();
  },
  setup: (app) => {
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

    return {
      onLayout: () => wxUI.applySafeAreaLayout(),
      onLifecycle: (state) => useGameStore.getState().recordLifecycleChange(state),
      onContextLost: () => useGameStore.getState().recordWebglContextLost(),
      onContextRestored: () => match3System.startLevel(stateSync.state.level),
      update: (delta) => {
        ambient.update(delta);
        match3System.update(delta);
        stateSync.flushDirty();
      },
    };
  },
});
