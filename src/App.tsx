import { useState } from 'react';
import { GameCanvas } from './game/core/GameCanvas';
import { gameEvents } from './game/core/EventBus';
import { platform } from './platform/PlatformAdapter';
import { LeaderboardEntry, useGameStore } from './store/useGameStore';
import { ModalDialog } from './ui/components/ModalDialog';
import { EngineInspectorPanel } from './ui/panels/EngineInspectorPanel';
import { GameHUDPanel } from './ui/panels/GameHUDPanel';
import { SettlementPanel } from './ui/panels/SettlementPanel';
import { StartPanel } from './ui/panels/StartPanel';
import './App.css';

export function App() {
  const scene = useGameStore((s) => s.scene);
  const level = useGameStore((s) => s.level);
  const highScore = useGameStore((s) => s.highScore);
  const coins = useGameStore((s) => s.coins);
  const items = useGameStore((s) => s.items);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const showInspector = useGameStore((s) => s.showInspector);
  const buyItem = useGameStore((s) => s.buyItem);
  const addCoins = useGameStore((s) => s.addCoins);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const toggleInspector = useGameStore((s) => s.toggleInspector);

  const [activeModal, setActiveModal] = useState<'shop' | 'leaderboard' | 'settings' | null>(null);

  const leaderboardData: LeaderboardEntry[] = [
    { rank: 1, name: 'PixiMaster_WebGL', score: 12850, level: 12 },
    { rank: 2, name: 'ReactHooks_Pro', score: 9420, level: 9 },
    { rank: 3, name: 'ZustandRunner', score: 6800, level: 7 },
    { rank: 4, name: '你 (当前玩家)', score: highScore, level },
    { rank: 5, name: 'CanvasRefactor', score: 2450, level: 3 },
  ].sort((a, b) => b.score - a.score).map((item, idx) => ({ ...item, rank: idx + 1 }));

  return (
    <div className="hybrid-game-root">
      {/* Pixi.js 高性能 WebGL 渲染层 */}
      <GameCanvas />

      {/* React 声明式外围 UI 层 */}
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

      {/* 混合架构实时遥测与监控面板 */}
      <EngineInspectorPanel />

      {/* 道具商城模态弹窗 */}
      <ModalDialog
        open={activeModal === 'shop'}
        onClose={() => setActiveModal(null)}
        title="🛒 道具商城"
      >
        <div className="modal-coin-bar">
          <span>当前持有金币：🪙 <strong>{coins}</strong></span>
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

      {/* 排行榜模态弹窗 */}
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

      {/* 设置面板模态弹窗 */}
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
