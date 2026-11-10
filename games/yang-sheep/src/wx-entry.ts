import { Container } from 'pixi.js';
import { gameEvents, runWxGame, SceneManager } from '@wegame/hybrid-engine';
import { yangAssetManager } from './assets/YangAssetManager';
import { playYangBgm, SceneName, useYangStore, yangStateSync } from './store/useYangStore';
import { YangCanvasUISystem } from './systems/YangCanvasUISystem';
import { DESIGN_HEIGHT, DESIGN_WIDTH, YangGameSystem } from './systems/YangGameSystem';

/**
 * 《羊了个羊》微信小游戏启动入口
 * 通用流程 (Application/适配/生命周期/上下文恢复/主循环) 由引擎 runWxGame 负责
 */
runWxGame({
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  backgroundColor: 0x4d7c0f,
  loadAssets: () => yangAssetManager.initAtlas(),
  reloadAssets: async () => {
    yangAssetManager.destroy();
    await yangAssetManager.initAtlas();
  },
  setup: (app) => {
    const sceneManager = new SceneManager<SceneName>(app, (nextScene) => {
      yangStateSync.state.scene = nextScene;
      yangStateSync.markDirty('scene');
    });
    const menuScene = new Container();
    const gameScene = new Container();
    const settlementScene = new Container();

    const yangGameSystem = new YangGameSystem();
    gameScene.addChild(yangGameSystem.rootContainer);
    // 微信纯 Canvas UI 渲染层 (菜单、HUD、道具栏、结算、模态框)
    const canvasUI = new YangCanvasUISystem(menuScene, gameScene, settlementScene);

    sceneManager.register('menu', menuScene);
    sceneManager.register('game', gameScene);
    sceneManager.register('settlement', settlementScene);
    app.stage.addChild(canvasUI.modalLayer);

    sceneManager.switchTo('menu');
    yangGameSystem.initLevel(useYangStore.getState().level);

    gameEvents.on<{ scene: SceneName; level?: number }>('switch-scene', (payload) => {
      sceneManager.switchTo(payload.scene);
      if (payload.scene === 'game') {
        yangGameSystem.initLevel(payload.level ?? yangStateSync.state.level);
      }
    });

    if (useYangStore.getState().bgmEnabled) {
      playYangBgm();
    }

    let telemetryTick = 0;
    return {
      onLayout: () => canvasUI.applySafeAreaLayout(),
      onContextRestored: () => yangGameSystem.initLevel(yangStateSync.state.level),
      update: (delta) => {
        yangGameSystem.update(delta);
        yangStateSync.flushDirty();
        if (++telemetryTick >= 30) {
          telemetryTick = 0;
          useYangStore.getState().updateTelemetry({
            fps: Math.round(app.ticker.FPS),
            drawCalls: 6,
            poolStats: yangGameSystem.effects.getTelemetry(),
          });
        }
      },
    };
  },
});
