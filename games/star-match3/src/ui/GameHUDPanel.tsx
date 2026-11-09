import { gameEvents, platform } from '@wegame/hybrid-engine';
import { useGameStore } from '../store/useGameStore';

interface GameHUDPanelProps {
  onOpenShop: () => void;
  onOpenSettings: () => void;
}

export function GameHUDPanel({ onOpenShop, onOpenSettings }: GameHUDPanelProps) {
  const level = useGameStore((s) => s.level);
  const score = useGameStore((s) => s.score);
  const targetScore = useGameStore((s) => s.targetScore);
  const movesLeft = useGameStore((s) => s.movesLeft);
  const combo = useGameStore((s) => s.combo);
  const coins = useGameStore((s) => s.coins);
  const items = useGameStore((s) => s.items);
  const activeItemMode = useGameStore((s) => s.activeItemMode);
  const setActiveItemMode = useGameStore((s) => s.setActiveItemMode);

  const progressPct = Math.min(100, Math.round((score / Math.max(1, targetScore)) * 100));

  const handleToggleHammer = () => {
    platform.playSound('click');
    if (activeItemMode === 'hammer') {
      setActiveItemMode(null);
    } else if (items.hammer > 0) {
      setActiveItemMode('hammer');
    } else {
      onOpenShop();
    }
  };

  const handleShuffle = () => {
    platform.playSound('click');
    if (items.shuffle > 0) {
      gameEvents.emit('item-shuffle');
    } else {
      onOpenShop();
    }
  };

  const handleExtraMoves = () => {
    platform.playSound('click');
    if (items.extraMoves > 0) {
      gameEvents.emit('item-extra-moves');
    } else {
      onOpenShop();
    }
  };

  return (
    <div className="game-hud-layer">
      <div className="hud-top-bar">
        <div className="hud-header-row">
          <button
            type="button"
            className="hud-icon-btn"
            onClick={() => {
              platform.playSound('click');
              gameEvents.emit('switch-scene', { scene: 'menu' });
            }}
          >
            ⬅ 菜单
          </button>

          <div className="hud-level-pill">
            第 <strong>{level}</strong> 关
            {combo > 1 && <span className="combo-tag">Combo x{combo}</span>}
          </div>

          <div className="hud-right-actions">
            <button
              type="button"
              className="hud-coin-btn"
              onClick={() => {
                platform.playSound('click');
                onOpenShop();
              }}
            >
              🪙 {coins} +
            </button>
            <button
              type="button"
              className="hud-icon-btn"
              onClick={() => {
                platform.playSound('click');
                onOpenSettings();
              }}
              aria-label="打开设置"
            >
              ⚙️
            </button>
          </div>
        </div>

        <div className="hud-metrics-row">
          <div className="moves-card">
            <span className="moves-label">剩余步数</span>
            <span className={`moves-val ${movesLeft <= 5 ? 'danger' : ''}`}>{movesLeft}</span>
          </div>

          <div className="score-progress-card">
            <div className="score-text-row">
              <span>
                得分: <strong>{score}</strong>
              </span>
              <span>目标: {targetScore}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="hud-bottom-bar">
        {activeItemMode === 'hammer' && (
          <div className="hammer-tip-banner">
            🔨 请点击棋盘上任意棋子，爆破周围 3×3 区域（再次点击道具取消）
          </div>
        )}
        <div className="powerup-bar">
          <button
            type="button"
            className={`powerup-btn ${activeItemMode === 'hammer' ? 'active' : ''}`}
            onClick={handleToggleHammer}
          >
            <span className="powerup-icon">🔨</span>
            <span className="powerup-name">神锤爆破</span>
            <span className="powerup-badge">{items.hammer}</span>
          </button>

          <button type="button" className="powerup-btn" onClick={handleShuffle}>
            <span className="powerup-icon">🔀</span>
            <span className="powerup-name">全局重排</span>
            <span className="powerup-badge">{items.shuffle}</span>
          </button>

          <button type="button" className="powerup-btn" onClick={handleExtraMoves}>
            <span className="powerup-icon">⚡</span>
            <span className="powerup-name">步数 +5</span>
            <span className="powerup-badge">{items.extraMoves}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
