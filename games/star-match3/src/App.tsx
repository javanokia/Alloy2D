import { useCallback, useState } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import {
  EngineInspectorDock,
  gameEvents,
  HybridCanvasHost,
  HybridGameInstance,
  ModalDialog,
  platform,
  SceneManager,
} from 'alloy2d';
import { assetManager } from './assets/Match3AssetManager';
import { DESIGN_HEIGHT, DESIGN_WIDTH, Match3System } from './systems/Match3System';
import { LeaderboardEntry, SceneName, stateSync, useGameStore } from './store/useGameStore';
import { GameHUDPanel } from './ui/GameHUDPanel';
import { SettlementPanel } from './ui/SettlementPanel';
import { StartPanel } from './ui/StartPanel';
import './App.css';

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

export function App() {
  const scene = useGameStore((s) => s.scene);
  const level = useGameStore((s) => s.level);
  const highScore = useGameStore((s) => s.highScore);
  const coins = useGameStore((s) => s.coins);
  const items = useGameStore((s) => s.items);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const showInspector = useGameStore((s) => s.showInspector);
  const fps = useGameStore((s) => s.fps);
  const drawCalls = useGameStore((s) => s.drawCalls);
  const dirtyFlushCount = useGameStore((s) => s.dirtyFlushCount);
  const dirtyMergedCount = useGameStore((s) => s.dirtyMergedCount);
  const poolStats = useGameStore((s) => s.poolStats);
  const lifecycleState = useGameStore((s) => s.lifecycleState);
  const lifecycleSwitchCount = useGameStore((s) => s.lifecycleSwitchCount);
  const eventLogs = useGameStore((s) => s.eventLogs);

  const buyItem = useGameStore((s) => s.buyItem);
  const addCoins = useGameStore((s) => s.addCoins);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const toggleInspector = useGameStore((s) => s.toggleInspector);

  const [activeModal, setActiveModal] = useState<'shop' | 'leaderboard' | 'settings' | null>(null);

  /**
   * 通过 alloy2d 的 HybridCanvasHost 引导挂载三消游戏系统
   */
  const handleBootstrap = useCallback((app: Application): HybridGameInstance => {
    assetManager.initBuiltInAtlas();

    const ambient = createAmbientBackground();
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

    sceneManager.register('menu', menuScene);
    sceneManager.register('game', gameScene);
    sceneManager.register('settlement', settlementScene);

    sceneManager.switchTo(useGameStore.getState().scene);
    match3System.startLevel(useGameStore.getState().level);

    const unsubScene = gameEvents.on<{ scene: SceneName; level?: number }>(
      'switch-scene',
      (payload) => {
        sceneManager.switchTo(payload.scene);
        if (payload.scene === 'game') {
          match3System.startLevel(payload.level ?? stateSync.state.level);
        }
      }
    );

    let telemetryTick = 0;

    return {
      onTick: (delta, pixiApp) => {
        ambient.update(delta);
        match3System.update(delta);
        stateSync.flushDirty();

        telemetryTick++;
        if (telemetryTick >= 25) {
          telemetryTick = 0;
          useGameStore.getState().updateTelemetry({
            fps: Math.round(pixiApp.ticker.FPS),
            drawCalls: 2,
            poolStats: match3System.effects.getTelemetry(),
          });
        }
      },
      onContextRestored: async () => {
        assetManager.destroy();
        await assetManager.initBuiltInAtlas();
        match3System.startLevel(stateSync.state.level);
      },
      onDestroy: () => {
        unsubScene();
        match3System.destroy();
        sceneManager.destroy();
        assetManager.destroy();
      },
    };
  }, []);

  const leaderboardData: LeaderboardEntry[] = [
    { rank: 1, name: 'PixiMaster_WebGL', score: 12850, level: 12 },
    { rank: 2, name: 'ReactHooks_Pro', score: 9420, level: 9 },
    { rank: 3, name: 'ZustandRunner', score: 6800, level: 7 },
    { rank: 4, name: '你 (当前玩家)', score: highScore, level },
    { rank: 5, name: 'CanvasRefactor', score: 2450, level: 3 },
  ]
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return (
    <div className="hybrid-game-root">
      {/* 1. 引入 alloy2d 宿主画布组件 */}
      <HybridCanvasHost
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        onBootstrap={handleBootstrap}
        onLifecycleChange={(st) => useGameStore.getState().recordLifecycleChange(st)}
        onWebglContextLost={() => useGameStore.getState().recordWebglContextLost()}
        isInspectorVisible={() => useGameStore.getState().showInspector}
      />

      {/* 2. 游戏业务外围 React UI */}
      {scene === 'menu' && (
        <StartPanel
          onOpenShop={() => setActiveModal('shop')}
          onOpenLeaderboard={() => setActiveModal('leaderboard')}
          onOpenSettings={() => setActiveModal('settings')}
        />
      )}

      {scene === 'game' && (
        <GameHUDPanel
          onOpenShop={() => setActiveModal('shop')}
          onOpenSettings={() => setActiveModal('settings')}
        />
      )}

      {scene === 'settlement' && <SettlementPanel />}

      {/* 3. 引入 alloy2d 实时遥测监控面板 */}
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

      {/* 4. 引入 alloy2d 原生 <dialog> 模态弹窗组件 */}
      <ModalDialog
        open={activeModal === 'shop'}
        onClose={() => setActiveModal(null)}
        title="🛒 道具商城"
      >
        <div className="modal-coin-bar">
          <span>
            当前持有金币：🪙 <strong>{coins}</strong>
          </span>
          <button
            type="button"
            className="free-coin-btn"
            onClick={() => {
              platform.playSound('match');
              addCoins(100);
            }}
          >
            + 领取 100 测试金币
          </button>
        </div>

        <div className="shop-list">
          <div className="shop-item">
            <div className="shop-info">
              <span className="shop-icon">🔨</span>
              <div>
                <div className="shop-name">神锤爆破 (持有: {items.hammer})</div>
                <div className="shop-desc">点击任意棋子，直接消除周围 3×3 区域</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 50}
              onClick={() => {
                if (buyItem('hammer', 50)) platform.playSound('match');
              }}
            >
              🪙 50 购买
            </button>
          </div>

          <div className="shop-item">
            <div className="shop-info">
              <span className="shop-icon">🔀</span>
              <div>
                <div className="shop-name">全局重排 (持有: {items.shuffle})</div>
                <div className="shop-desc">不消耗步数，重新随机洗牌当前所有棋子</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 40}
              onClick={() => {
                if (buyItem('shuffle', 40)) platform.playSound('match');
              }}
            >
              🪙 40 购买
            </button>
          </div>

          <div className="shop-item">
            <div className="shop-info">
              <span className="shop-icon">⚡</span>
              <div>
                <div className="shop-name">步数 +5 (持有: {items.extraMoves})</div>
                <div className="shop-desc">立即为当前关卡增加 5 步可用移动步数</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 60}
              onClick={() => {
                if (buyItem('extraMoves', 60)) platform.playSound('match');
              }}
            >
              🪙 60 购买
            </button>
          </div>
        </div>
      </ModalDialog>

      <ModalDialog
        open={activeModal === 'leaderboard'}
        onClose={() => setActiveModal(null)}
        title="🏆 多端玩家排行榜"
      >
        <div className="leaderboard-list">
          {leaderboardData.map((entry) => (
            <div
              key={entry.name}
              className={`leaderboard-row ${entry.name.includes('你') ? 'me' : ''}`}
            >
              <span className="lb-rank">#{entry.rank}</span>
              <span className="lb-name">{entry.name}</span>
              <span className="lb-level">第 {entry.level} 关</span>
              <span className="lb-score">{entry.score} 分</span>
            </div>
          ))}
        </div>
      </ModalDialog>

      <ModalDialog
        open={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        title="⚙️ 游戏与引擎设置"
      >
        <div className="settings-list">
          <div className="setting-row">
            <span>合成音效开关 (Web Audio API)</span>
            <button
              type="button"
              className={`toggle-btn ${soundEnabled ? 'on' : ''}`}
              onClick={toggleSound}
            >
              {soundEnabled ? '🔊 已开启' : '🔇 已静音'}
            </button>
          </div>

          <div className="setting-row">
            <span>Stats.js 与引擎遥测面板</span>
            <button
              type="button"
              className={`toggle-btn ${showInspector ? 'on' : ''}`}
              onClick={toggleInspector}
            >
              {showInspector ? '📊 显示中' : '隐藏'}
            </button>
          </div>

          <div className="setting-row">
            <span>当前运行平台适配器</span>
            <span className="platform-tag">{platform.platformName}</span>
          </div>

          {scene === 'game' && (
            <button
              type="button"
              className="sec-btn full-width-btn"
              onClick={() => {
                platform.playSound('click');
                setActiveModal(null);
                gameEvents.emit('start-level', { level });
              }}
            >
              ↻ 重新开始本关
            </button>
          )}
        </div>
      </ModalDialog>
    </div>
  );
}
