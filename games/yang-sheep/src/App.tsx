import { useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import {
  EngineInspectorDock,
  gameEvents,
  HybridCanvasHost,
  HybridGameInstance,
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
import './App.css';

export function App() {
  const showInspector = useYangStore((s) => s.showInspector);
  const fps = useYangStore((s) => s.fps);
  const drawCalls = useYangStore((s) => s.drawCalls);
  const dirtyFlushCount = useYangStore((s) => s.dirtyFlushCount);
  const dirtyMergedCount = useYangStore((s) => s.dirtyMergedCount);
  const poolStats = useYangStore((s) => s.poolStats);
  const lifecycleState = useYangStore((s) => s.lifecycleState);
  const lifecycleSwitchCount = useYangStore((s) => s.lifecycleSwitchCount);
  const eventLogs = useYangStore((s) => s.eventLogs);
  const toggleInspector = useYangStore((s) => s.toggleInspector);

  const handleBootstrap = useCallback((app: Application): HybridGameInstance => {
    yangAssetManager.initAtlas();

    const sceneManager = new SceneManager<SceneName>(app, (nextScene) => {
      yangStateSync.state.scene = nextScene;
      yangStateSync.markDirty('scene');
    });

    const menuScene = new Container();
    const gameScene = new Container();
    const settlementScene = new Container();

    const yangGameSystem = new YangGameSystem();
    gameScene.addChild(yangGameSystem.rootContainer);

    const canvasUI = new YangCanvasUISystem(menuScene, gameScene, settlementScene);

    sceneManager.register('menu', menuScene);
    sceneManager.register('game', gameScene);
    sceneManager.register('settlement', settlementScene);

    app.stage.addChild(canvasUI.modalLayer);

    const initialScene = useYangStore.getState().scene;
    sceneManager.switchTo(initialScene);
    yangGameSystem.initLevel(useYangStore.getState().level);

    canvasUI.applySafeAreaLayout();

    const unsubScene = gameEvents.on<{ scene: SceneName; level?: number }>(
      'switch-scene',
      (payload) => {
        sceneManager.switchTo(payload.scene);
        if (payload.scene === 'game') {
          yangGameSystem.initLevel(payload.level ?? yangStateSync.state.level);
        }
      }
    );

    let telemetryTick = 0;

    if (useYangStore.getState().bgmEnabled) {
      playYangBgm();
    }

    return {
      onTick: (delta, pixiApp) => {
        tweenManager.update(delta);
        yangGameSystem.update(delta);
        yangStateSync.flushDirty();

        telemetryTick++;
        if (telemetryTick >= 25) {
          telemetryTick = 0;
          useYangStore.getState().updateTelemetry({
            fps: Math.round(pixiApp.ticker.FPS),
            drawCalls: 6,
            poolStats: yangGameSystem.effects.getTelemetry(),
          });
        }
      },
      onContextRestored: async () => {
        yangAssetManager.destroy();
        await yangAssetManager.initAtlas();
        yangGameSystem.initLevel(yangStateSync.state.level);
      },
      onDestroy: () => {
        unsubScene();
        yangGameSystem.destroy();
        sceneManager.destroy();
        yangAssetManager.destroy();
      },
    };
  }, []);

  return (
    <div className="hybrid-game-root">
      <HybridCanvasHost
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        onBootstrap={handleBootstrap}
        onLifecycleChange={(st) => useYangStore.getState().recordLifecycleChange(st)}
        onWebglContextLost={() => useYangStore.getState().recordWebglContextLost()}
        isInspectorVisible={() => useYangStore.getState().showInspector}
      />

      <EngineInspectorDock
        showInspector={showInspector}
        onToggleInspector={toggleInspector}
        fps={fps}
        drawCalls={drawCalls}
        dirtyFlushCount={dirtyFlushCount}
        dirtyMergedCount={dirtyMergedCount}
        poolStats={poolStats}
        lifecycleState={lifecycleState}
        lifecycleSwitchCount={lifecycleSwitchCount}
        eventLogs={eventLogs}
      />
    </div>
  );
}
