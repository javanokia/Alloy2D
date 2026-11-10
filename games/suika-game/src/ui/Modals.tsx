import React from 'react';
import { ModalDialog, platform } from 'alloy2d';
import { useSuikaStore } from '../store/useSuikaStore';

export const Modals: React.FC = () => {
  const activeModal = useSuikaStore((s) => s.activeModal);
  const coins = useSuikaStore((s) => s.coins);
  const props = useSuikaStore((s) => s.props);
  const soundEnabled = useSuikaStore((s) => s.soundEnabled);
  const showInspector = useSuikaStore((s) => s.showInspector);
  const highScore = useSuikaStore((s) => s.highScore);

  const setActiveModal = useSuikaStore((s) => s.setActiveModal);
  const buyProp = useSuikaStore((s) => s.buyProp);
  const addCoins = useSuikaStore((s) => s.addCoins);
  const toggleSound = useSuikaStore((s) => s.toggleSound);
  const toggleInspector = useSuikaStore((s) => s.toggleInspector);

  const handleClose = () => setActiveModal(null);

  return (
    <>
      {/* 道具商城 */}
      <ModalDialog
        open={activeModal === 'shop'}
        onClose={handleClose}
        title="🛒 奇幻果园道具商城"
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
              <span className="shop-icon">📳</span>
              <div>
                <div className="shop-name">摇晃箱体 (持有: {props.shake})</div>
                <div className="shop-desc">震动整个果汁箱，打散卡在缝隙中的水果</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 30}
              onClick={() => buyProp('shake', 30) && platform.playSound('match')}
            >
              🪙 30 购买
            </button>
          </div>

          <div className="shop-item">
            <div className="shop-info">
              <span className="shop-icon">💣</span>
              <div>
                <div className="shop-name">炸弹消除 (持有: {props.bomb})</div>
                <div className="shop-desc">点击任意水果直接引爆消除，并产生扩散推力</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 50}
              onClick={() => buyProp('bomb', 50) && platform.playSound('match')}
            >
              🪙 50 购买
            </button>
          </div>

          <div className="shop-item">
            <div className="shop-info">
              <span className="shop-icon">⭐</span>
              <div>
                <div className="shop-name">魔法升级 (持有: {props.upgrade})</div>
                <div className="shop-desc">点化指定水果，直接升级为下一个更大品种</div>
              </div>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={coins < 60}
              onClick={() => buyProp('upgrade', 60) && platform.playSound('match')}
            >
              🪙 60 购买
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* 排行榜 */}
      <ModalDialog
        open={activeModal === 'leaderboard'}
        onClose={handleClose}
        title="🏆 西瓜合成全球排行榜"
      >
        <div className="leaderboard-list">
          {[
            { rank: 1, name: 'SuikaMaster_99', score: 8420, melons: 4 },
            { rank: 2, name: 'WatermelonGod', score: 6250, melons: 3 },
            { rank: 3, name: 'PhysicsKing', score: 4890, melons: 2 },
            { rank: 4, name: '你 (当前玩家)', score: highScore, melons: 1 },
            { rank: 5, name: 'FruitNinjaPro', score: 2340, melons: 0 },
          ]
            .sort((a, b) => b.score - a.score)
            .map((item, idx) => (
              <div
                key={item.name}
                className={`leaderboard-row ${item.name.includes('你') ? 'me' : ''}`}
              >
                <span className="lb-rank">#{idx + 1}</span>
                <span className="lb-name">{item.name}</span>
                <span className="lb-score">{item.score} 分</span>
              </div>
            ))}
        </div>
      </ModalDialog>

      {/* 设置 */}
      <ModalDialog
        open={activeModal === 'settings'}
        onClose={handleClose}
        title="⚙️ 游戏与引擎设置"
      >
        <div className="settings-list">
          <div className="setting-row">
            <span>合成音效 (ProceduralSynth)</span>
            <button
              type="button"
              className={`toggle-btn ${soundEnabled ? 'on' : ''}`}
              onClick={toggleSound}
            >
              {soundEnabled ? '🔊 已开启' : '🔇 已静音'}
            </button>
          </div>

          <div className="setting-row">
            <span>Alloy2D 引擎遥测面板</span>
            <button
              type="button"
              className={`toggle-btn ${showInspector ? 'on' : ''}`}
              onClick={toggleInspector}
            >
              {showInspector ? '📊 显示中' : '隐藏'}
            </button>
          </div>

          <div className="setting-row">
            <span>当前运行平台</span>
            <span className="platform-tag">{platform.platformName}</span>
          </div>
        </div>
      </ModalDialog>
    </>
  );
};
