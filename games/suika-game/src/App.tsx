import React, { useCallback, useRef } from 'react';
import { Application } from 'pixi.js';
import {
  EngineInspectorDock,
  gameEvents,
  HybridCanvasHost,
  HybridGameInstance,
} from 'alloy2d';
import { suikaAssetManager } from './assets/SuikaAssetManager';
import { DESIGN_HEIGHT, DESIGN_WIDTH, SuikaGameSystem } from './systems/SuikaGameSystem';
import { useSuikaStore } from './store/useSuikaStore';
import { GameHeader } from './ui/GameHeader';
import { GameOverDialog } from './ui/GameOverDialog';
import { Modals } from './ui/Modals';
import { PropToolBar } from './ui/PropToolBar';
import './App.css';

export const App: React.FC = () => {
  const showInspector = useSuikaStore((s) => s.showInspector);
  const toggleInspector = useSuikaStore((s) => s.toggleInspector);
  const systemRef = useRef<SuikaGameSystem | null>(null);

  const handleBootstrap = useCallback((app: Application): HybridGameInstance => {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    const system = new SuikaGameSystem();
    systemRef.current = system;
    app.stage.addChild(system.rootContainer);

    // 预加载离屏图集并开启新局
    suikaAssetManager.initAtlas().then(() => {
      system.initGame();
    });

    // 监听重新开始事件
    const unsubRestart = gameEvents.on('suika-restart', () => {
      system.initGame();
    });

    return {
      onTick: (delta: number) => {
        system.update(delta);
      },
      onDestroy: () => {
        unsubRestart();
        system.destroy();
        systemRef.current = null;
      },
    };
  }, []);

  return (
    <div className="suika-app-container">
      <HybridCanvasHost
        className="suika-canvas-host"
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        backgroundColor={0x18181b}
        onBootstrap={handleBootstrap}
        isInspectorVisible={() => useSuikaStore.getState().showInspector}
      />

      <div className="suika-ui-overlay">
        <GameHeader />
        <PropToolBar />
      </div>

      <GameOverDialog />
      <Modals />

      <EngineInspectorDock
        showInspector={showInspector}
        onToggleInspector={toggleInspector}
        fps={60}
        drawCalls={14}
        dirtyFlushCount={0}
        dirtyMergedCount={0}
        poolStats={{
          particleActive: 0,
          particleAvailable: 60,
          textActive: 0,
          textAvailable: 20,
          totalHits: 0,
          totalCreated: 80,
        }}
        lifecycleState="show"
        lifecycleSwitchCount={0}
        eventLogs={[]}
      />
    </div>
  );
};
export default App;
