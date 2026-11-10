import React from 'react';
import { gameEvents, platform } from 'alloy2d';
import { FRUIT_CONFIGS } from '../assets/SuikaAssetManager';
import { useSuikaStore } from '../store/useSuikaStore';

export const GameHeader: React.FC = () => {
  const score = useSuikaStore((s) => s.score);
  const highScore = useSuikaStore((s) => s.highScore);
  const coins = useSuikaStore((s) => s.coins);
  const nextTier = useSuikaStore((s) => s.nextTier);
  const isDanger = useSuikaStore((s) => s.isDanger);
  const setActiveModal = useSuikaStore((s) => s.setActiveModal);

  const nextFruit = FRUIT_CONFIGS[nextTier] || FRUIT_CONFIGS[0];

  return (
    <header className={`suika-header ${isDanger ? 'danger-pulse' : ''}`}>
      <div className="header-left">
        <div className="stat-pill score-pill">
          <span className="stat-label">得分</span>
          <span className="stat-value">{score}</span>
        </div>
        <div className="stat-pill high-pill">
          <span className="stat-label">最高分</span>
          <span className="stat-value">{highScore}</span>
        </div>
      </div>

      <div className="header-center">
        <div className="next-fruit-badge" title="下一个水果">
          <span className="next-label">NEXT</span>
          <span className="next-emoji" style={{ color: nextFruit.primaryColor }}>
            {nextFruit.emoji}
          </span>
        </div>
      </div>

      <div className="header-right">
        <button
          type="button"
          className="header-btn restart-btn"
          onClick={() => {
            platform.playSound('click');
            gameEvents.emit('suika-restart');
          }}
          title="重新开始"
        >
          🔄
        </button>
        <button
          type="button"
          className="header-btn coin-btn"
          onClick={() => setActiveModal('shop')}
        >
          🪙 {coins}
        </button>
        <button
          type="button"
          className="header-btn"
          onClick={() => setActiveModal('leaderboard')}
          title="排行榜"
        >
          🏆
        </button>
        <button
          type="button"
          className="header-btn"
          onClick={() => setActiveModal('settings')}
          title="设置"
        >
          ⚙️
        </button>
      </div>

      {isDanger && (
        <div className="danger-warning-banner">
          ⚠️ 水果触碰警戒线！请及时清理或摇晃！
        </div>
      )}
    </header>
  );
};
