import React from 'react';
import { gameEvents, platform } from 'alloy2d';
import { useSuikaStore } from '../store/useSuikaStore';

export const GameOverDialog: React.FC = () => {
  const isGameOver = useSuikaStore((s) => s.isGameOver);
  const score = useSuikaStore((s) => s.score);
  const highScore = useSuikaStore((s) => s.highScore);
  const maxCombo = useSuikaStore((s) => s.maxCombo);
  const fruitsMergedTotal = useSuikaStore((s) => s.fruitsMergedTotal);

  if (!isGameOver) return null;

  const isNewRecord = score >= highScore && score > 0;

  const handleRestart = () => {
    platform.playSound('click');
    gameEvents.emit('suika-restart');
  };

  return (
    <div className="gameover-overlay">
      <div className="gameover-card">
        <div className="gameover-header">
          <span className="gameover-badge">🍉 GAME OVER</span>
          <h2 className="gameover-title">
            {isNewRecord ? '🎉 恭喜刷新历史纪录！' : '游戏结束 · 战报结算'}
          </h2>
        </div>

        <div className="gameover-stats">
          <div className="stat-row highlight-row">
            <span>最终得分</span>
            <span className="stat-score-val">{score}</span>
          </div>
          <div className="stat-row">
            <span>历史最高分</span>
            <span>{highScore}</span>
          </div>
          <div className="stat-row">
            <span>最高连击</span>
            <span>x{maxCombo}</span>
          </div>
          <div className="stat-row">
            <span>累计成功合成</span>
            <span>{fruitsMergedTotal} 次</span>
          </div>
        </div>

        <button
          type="button"
          className="restart-play-btn"
          onClick={handleRestart}
        >
          ▶ 再来一局
        </button>
      </div>
    </div>
  );
};
