import { platform } from '../../platform/PlatformAdapter';
import { useGameStore } from '../../store/useGameStore';
import { gameEvents } from '../../game/core/EventBus';

interface StartPanelProps {
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
}

/**
 * 游戏开始主菜单面板 (对应文章 2.3 节 React 负责开始界面与外围 UI，以及第 8 节踩坑记录 5：开始按钮点击时初始化音频上下文)
 */
export function StartPanel({
  onOpenShop,
  onOpenLeaderboard,
  onOpenSettings,
}: StartPanelProps) {
  const level = useGameStore((s) => s.level);
  const highScore = useGameStore((s) => s.highScore);
  const coins = useGameStore((s) => s.coins);

  const handleStartGame = () => {
    // 关键踩坑修复 (文章第 8 节第 5 点)：在用户首次点击开始按钮回调中解锁 AudioContext
    platform.unlockAudio();
    platform.playSound('click');
    gameEvents.emit('switch-scene', { scene: 'game', level });
  };

  return (
    <div className="overlay-screen start-panel">
      <div className="start-card">
        <div className="badge-row">
          <span className="arch-badge">React 18 UI Layer</span>
          <span className="arch-badge pixi">Pixi.js v7 WebGL</span>
          <span className="arch-badge zustand">Zustand + DirtyFlags</span>
        </div>

        <h1 className="game-logo">星耀三消 · 混合引擎</h1>
        <p className="game-subtitle">
          React 管“是什么” (UI与状态) · Pixi.js 管“怎么画” (60FPS WebGL 批处理渲染)
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
