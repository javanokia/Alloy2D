import React from 'react';
import { gameEvents, platform } from 'alloy2d';
import { useSuikaStore } from '../store/useSuikaStore';

export const PropToolBar: React.FC = () => {
  const props = useSuikaStore((s) => s.props);
  const activeItemMode = useSuikaStore((s) => s.activeItemMode);
  const useProp = useSuikaStore((s) => s.useProp);
  const setActiveItemMode = useSuikaStore((s) => s.setActiveItemMode);
  const setActiveModal = useSuikaStore((s) => s.setActiveModal);

  const handleShake = () => {
    if (useProp('shake')) {
      gameEvents.emit('suika-shake');
    } else {
      setActiveModal('shop');
    }
  };

  const handleBomb = () => {
    if (activeItemMode === 'bomb') {
      setActiveItemMode(null);
    } else if (useProp('bomb')) {
      setActiveItemMode('bomb');
      platform.playSound('click');
    } else {
      setActiveModal('shop');
    }
  };

  const handleUpgrade = () => {
    if (activeItemMode === 'upgrade') {
      setActiveItemMode(null);
    } else if (useProp('upgrade')) {
      setActiveItemMode('upgrade');
      platform.playSound('click');
    } else {
      setActiveModal('shop');
    }
  };

  return (
    <div className="prop-toolbar">
      {activeItemMode && (
        <div className="active-item-hint">
          {activeItemMode === 'bomb' ? '💣 请点击场上任意水果直接引爆！' : '⭐ 请点击场上任意水果直接升级！'}
          <button
            type="button"
            className="cancel-hint-btn"
            onClick={() => setActiveItemMode(null)}
          >
            取消
          </button>
        </div>
      )}

      <div className="prop-btn-group">
        <button
          type="button"
          className="prop-btn shake-btn"
          onClick={handleShake}
        >
          <span className="prop-icon">📳</span>
          <span className="prop-name">摇晃箱体</span>
          <span className="prop-count">{props.shake}</span>
        </button>

        <button
          type="button"
          className={`prop-btn bomb-btn ${activeItemMode === 'bomb' ? 'active' : ''}`}
          onClick={handleBomb}
        >
          <span className="prop-icon">💣</span>
          <span className="prop-name">炸弹消除</span>
          <span className="prop-count">{props.bomb}</span>
        </button>

        <button
          type="button"
          className={`prop-btn upgrade-btn ${activeItemMode === 'upgrade' ? 'active' : ''}`}
          onClick={handleUpgrade}
        >
          <span className="prop-icon">⭐</span>
          <span className="prop-name">魔法升级</span>
          <span className="prop-count">{props.upgrade}</span>
        </button>
      </div>
    </div>
  );
};
