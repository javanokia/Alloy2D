import { gameEvents, platform } from '@wegame/hybrid-engine';
import { useGameStore } from '../store/useGameStore';

export function SettlementPanel() {
  const level = useGameStore((s) => s.level);
  const score = useGameStore((s) => s.score);
  const targetScore = useGameStore((s) => s.targetScore);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const isLevelWon = useGameStore((s) => s.isLevelWon);
  const coins = useGameStore((s) => s.coins);

  const handleNextOrRetry = () => {
    platform.playSound('click');
    const nextLevel = isLevelWon ? level + 1 : level;
    gameEvents.emit('switch-scene', { scene: 'game', level: nextLevel });
  };

  const handleBackToMenu = () => {
    platform.playSound('click');
    const nextLevel = isLevelWon ? level + 1 : level;
    useGameStore.getState().setLevel(nextLevel);
    gameEvents.emit('switch-scene', { scene: 'menu' });
  };

  return (
    <div className="overlay-screen settlement-panel">
      <div className="start-card settlement-card">
        <div className="settlement-badge">{isLevelWon ? '🎉 恭喜通关' : '💥 步数耗尽'}</div>
        <h2 className="settlement-title">
          第 {level} 关 {isLevelWon ? '挑战成功!' : '挑战失败'}
        </h2>

        <div className="stats-summary-grid">
          <div className="stat-box">
            <span className="stat-label">本局得分</span>
            <span className="stat-val highlight">{score}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">目标分数</span>
            <span className="stat-val">{targetScore}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">最高连击</span>
            <span className="stat-val">x{maxCombo}</span>
          </div>
        </div>

        <p className="settlement-coins-tip">当前总金币：🪙 {coins}</p>

        <button type="button" className="primary-play-btn" onClick={handleNextOrRetry}>
          {isLevelWon ? `▶ 挑战第 ${level + 1} 关` : `↻ 重新挑战第 ${level} 关`}
        </button>

        <button
          type="button"
          className="sec-btn full-width-btn"
          onClick={handleBackToMenu}
        >
          返回主菜单
        </button>
      </div>
    </div>
  );
}
