import { Application, Container } from 'pixi.js';
import {
  gameEvents,
  platform,
  resizeStageToDesign,
  SceneManager,
  tweenManager,
} from '@wegame/hybrid-engine';
import { yangAssetManager } from './assets/YangAssetManager';
import {
  playYangBgm,
  SceneName,
  useYangStore,
  yangStateSync,
} from './store/useYangStore';
import { YangCanvasUISystem } from './systems/YangCanvasUISystem';
import { DESIGN_HEIGHT, DESIGN_WIDTH, YangGameSystem } from './systems/YangGameSystem';

/**
 * 《羊了个羊》微信小游戏启动入口
 * 遵循 @wegame/hybrid-engine 规范：纯 Pixi.js Canvas 双层交互架构
 */
async function bootstrapWeChatMiniGame(): Promise<void> {
  const { width: screenW, height: screenH, dpr } = platform.getScreenSize();
  const mainCanvas = (globalThis as unknown as { canvas?: HTMLCanvasElement }).canvas;

  const app = new Application({
    view: mainCanvas,
    width: screenW,
    height: screenH,
    backgroundColor: 0x4d7c0f,
    resolution: dpr,
    autoDensity: true,
    antialias: true,
  });

  // 1. 初始化纹理图集与牌面素材
  await yangAssetManager.initAtlas();

  // 2. 初始化跨场景管理器
  const sceneManager = new SceneManager<SceneName>(app, (nextScene) => {
    yangStateSync.state.scene = nextScene;
    yangStateSync.markDirty('scene');
  });

  const menuScene = new Container();
  const gameScene = new Container();
  const settlementScene = new Container();

  // 3. 核心游戏系统
  const yangGameSystem = new YangGameSystem();
  gameScene.addChild(yangGameSystem.rootContainer);

  // 4. 微信纯 Canvas UI 渲染层 (菜单、HUD、道具栏、结算、模态框)
  const canvasUI = new YangCanvasUISystem(menuScene, gameScene, settlementScene);

  sceneManager.register('menu', menuScene);
  sceneManager.register('game', gameScene);
  sceneManager.register('settlement', settlementScene);

  // 5. 模态层挂载至最顶层
  app.stage.addChild(canvasUI.modalLayer);

  // 6. 切换至初始主菜单场景
  sceneManager.switchTo('menu');
  yangGameSystem.initLevel(useYangStore.getState().level);

  // 7. 监听场景切换事件
  gameEvents.on<{ scene: SceneName; level?: number }>('switch-scene', (payload) => {
    sceneManager.switchTo(payload.scene);
    if (payload.scene === 'game') {
      yangGameSystem.initLevel(payload.level ?? yangStateSync.state.level);
    }
  });

  // 8. 响应屏幕安全区与尺寸适配
  resizeStageToDesign(app, DESIGN_WIDTH, DESIGN_HEIGHT);
  canvasUI.applySafeAreaLayout();

  // 9. 生命周期管理 (onShow / onHide)
  platform.onLifecycleChange((state) => {
    gameEvents.emit('app-lifecycle', { state });
    if (state === 'hide') {
      app.ticker.stop();
    } else {
      canvasUI.applySafeAreaLayout();
      app.ticker.start();
    }
  });

  // 10. WebGL 上下文丢失与恢复
  const canvasEl = app.view as HTMLCanvasElement;
  if (canvasEl && typeof canvasEl.addEventListener === 'function') {
    canvasEl.addEventListener('webglcontextlost', (e: Event) => {
      e.preventDefault();
      app.ticker.stop();
      gameEvents.emit('webgl-context', { status: 'lost' });
    });
    canvasEl.addEventListener('webglcontextrestored', async () => {
      yangAssetManager.destroy();
      await yangAssetManager.initAtlas();
      yangGameSystem.initLevel(yangStateSync.state.level);
      app.ticker.start();
      gameEvents.emit('webgl-context', { status: 'restored' });
    });
  }

  // 11. 主循环帧更新
  let telemetryTick = 0;
  app.ticker.add((delta) => {
    tweenManager.update(delta);
    yangGameSystem.update(delta);
    yangStateSync.flushDirty();

    telemetryTick++;
    if (telemetryTick >= 30) {
      telemetryTick = 0;
      useYangStore.getState().updateTelemetry({
        fps: Math.round(app.ticker.FPS),
        drawCalls: 6,
        poolStats: yangGameSystem.effects.getTelemetry(),
      });
    }
  });

  // 12. 播放背景音乐（若开启）
  if (useYangStore.getState().bgmEnabled) {
    playYangBgm();
  }
}

bootstrapWeChatMiniGame();
