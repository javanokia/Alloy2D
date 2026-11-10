import { gameEvents, platform } from 'alloy2d';
import { useGameStore } from '../store/useGameStore';

interface StartPanelProps {
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
}

export function StartPanel({
  onOpenShop,
  onOpenLeaderboard,
  onOpenSettings,
}: StartPanelProps) {
  const level = useGameStore((s) => s.level);
  const highScore = useGameStore((s) => s.highScore);
  const coins = useGameStore((s) => s.coins);

  const handleStartGame = () => {
    platform.unlockAudio();
    platform.playSound('click');
    gameEvents.emit('switch-scene', { scene: 'game', level });
  };

  return (
    <div className="overlay-screen start-panel">
      <div className="start-card">
        <div className="badge-row">
          <span className="arch-badge">alloy2d</span>
          <span className="arch-badge pixi">Pixi.js v8 WebGL</span>
          <span className="arch-badge zustand">Zustand + DirtyFlags</span>
        </div>

        <h1 className="game-logo">星耀三消 · 混合引擎</h1>
        <p className="game-subtitle">
          通过依赖包 <code>alloy2d</code> 驱动游戏工程与多端小游戏构建
        </p>

        <div className="stats-summary-grid">
          <div className="stat-box">
            <span className="stat-label">当前关卡</span>
            <span className="stat-val">第 {level} 关</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">历史最高分</span>
            <span className="stat-val highlight">{highScore}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">持有金币</span>
            <span className="stat-val coin">🪙 {coins}</span>
          </div>
        </div>

        <button type="button" className="primary-play-btn" onClick={handleStartGame}>
          ▶ 立即开始第 {level} 关
        </button>

        <div className="secondary-btn-row">
          <button
            type="button"
            className="sec-btn"
            onClick={() => {
              platform.unlockAudio();
              platform.playSound('click');
              onOpenShop();
            }}
          >
            🛒 道具商城
          </button>
          <button
            type="button"
            className="sec-btn"
            onClick={() => {
              platform.unlockAudio();
              platform.playSound('click');
              onOpenLeaderboard();
            }}
          >
            🏆 排行榜
          </button>
          <button
            type="button"
            className="sec-btn"
            onClick={() => {
              platform.unlockAudio();
              platform.playSound('click');
              onOpenSettings();
            }}
          >
            ⚙️ 设置
          </button>
        </div>
      </div>
    </div>
  );
}
