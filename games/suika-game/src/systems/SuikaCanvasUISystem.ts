import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  CanvasButton,
  CanvasModal,
  computeSafeAreaDesignOffsets,
  gameEvents,
  platform,
} from 'alloy2d';
import { FRUIT_CONFIGS } from '../assets/SuikaAssetManager';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './SuikaGameSystem';
import { ModalType, useSuikaStore } from '../store/useSuikaStore';

export class SuikaCanvasUISystem {
  public readonly uiContainer: Container;
  public readonly modalLayer: Container;

  private topHud: Container;
  private bottomHud: Container;
  private scoreText: Text;
  private highScoreText: Text;
  private coinsBtn: CanvasButton;
  private nextEmojiText: Text;
  private warningBanner: Container;

  private shakeBtn: CanvasButton;
  private bombBtn: CanvasButton;
  private upgradeBtn: CanvasButton;

  private gameOverModal: CanvasModal;
  private gameOverScoreText: Text;
  private gameOverHighText: Text;
  private gameOverComboText: Text;

  private shopModal: CanvasModal;
  private leaderboardModal: CanvasModal;
  private settingsModal: CanvasModal;

  private unsubStore: (() => void) | null = null;

  constructor() {
    this.uiContainer = new Container();
    this.modalLayer = new Container();

    this.topHud = new Container();
    this.bottomHud = new Container();
    this.uiContainer.addChild(this.topHud);
    this.uiContainer.addChild(this.bottomHud);

    // 1. 构建顶部 HUD
    const topBg = new Graphics();
    topBg.rect(0, 0, DESIGN_WIDTH, 140);
    topBg.fill({ color: 0xfed7aa, alpha: 0.92 });
    topBg.stroke({ width: 2, color: 0xfdba74, alpha: 0.8 });
    this.topHud.addChild(topBg);

    // 得分标签
    this.scoreText = new Text('0', {
      fontFamily: 'sans-serif',
      fontSize: 32,
      fontWeight: '900',
      fill: '#c2410c',
    });
    this.scoreText.x = 28;
    this.scoreText.y = 52;
    this.topHud.addChild(this.scoreText);

    const scoreLbl = new Text('得分', {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#78350f',
    });
    scoreLbl.x = 28;
    scoreLbl.y = 28;
    this.topHud.addChild(scoreLbl);

    // 最高分标签
    this.highScoreText = new Text('0', {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#78350f',
    });
    this.highScoreText.x = 160;
    this.highScoreText.y = 58;
    this.topHud.addChild(this.highScoreText);

    const highLbl = new Text('最高分', {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#9a3412',
    });
    highLbl.x = 160;
    highLbl.y = 28;
    this.topHud.addChild(highLbl);

    // Next 水果展示
    const nextBox = new Graphics();
    nextBox.roundRect(320, 22, 100, 96, 16);
    nextBox.fill({ color: 0xffffff, alpha: 0.95 });
    nextBox.stroke({ width: 2, color: 0xf97316, alpha: 0.8 });
    this.topHud.addChild(nextBox);

    const nextLbl = new Text('NEXT', {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: '900',
      fill: '#ea580c',
    });
    nextLbl.anchor.set(0.5);
    nextLbl.x = 370;
    nextLbl.y = 42;
    this.topHud.addChild(nextLbl);

    this.nextEmojiText = new Text('🫐', { fontSize: 38 });
    this.nextEmojiText.anchor.set(0.5);
    this.nextEmojiText.x = 370;
    this.nextEmojiText.y = 78;
    this.topHud.addChild(this.nextEmojiText);

    // 金币与菜单按钮
    this.coinsBtn = new CanvasButton({
      width: 140,
      height: 52,
      radius: 14,
      backgroundColor: 0xffffff,
      borderColor: 0xfdba74,
      label: '🪙 100',
      textStyle: { fontSize: 18, fill: '#b45309', fontWeight: 'bold' },
      onClick: () => this.openModal('shop'),
    });
    this.coinsBtn.x = 445;
    this.coinsBtn.y = 44;
    this.topHud.addChild(this.coinsBtn);

    const rankBtn = new CanvasButton({
      width: 60,
      height: 52,
      radius: 14,
      backgroundColor: 0xffffff,
      borderColor: 0xfdba74,
      label: '🏆',
      textStyle: { fontSize: 24 },
      onClick: () => this.openModal('leaderboard'),
    });
    rankBtn.x = 600;
    rankBtn.y = 44;
    this.topHud.addChild(rankBtn);

    const settingBtn = new CanvasButton({
      width: 60,
      height: 52,
      radius: 14,
      backgroundColor: 0xffffff,
      borderColor: 0xfdba74,
      label: '⚙️',
      textStyle: { fontSize: 24 },
      onClick: () => this.openModal('settings'),
    });
    settingBtn.x = 670;
    settingBtn.y = 44;
    this.topHud.addChild(settingBtn);

    // 危险警告条
    this.warningBanner = new Container();
    const warnBg = new Graphics();
    warnBg.rect(0, 140, DESIGN_WIDTH, 40);
    warnBg.fill({ color: 0xef4444, alpha: 0.95 });
    this.warningBanner.addChild(warnBg);
    const warnText = new Text('⚠️ 水果堆积超过警戒线！即将结束！', {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: '#ffffff',
      fontWeight: 'bold',
    });
    warnText.anchor.set(0.5);
    warnText.x = DESIGN_WIDTH / 2;
    warnText.y = 160;
    this.warningBanner.addChild(warnText);
    this.warningBanner.visible = false;
    this.topHud.addChild(this.warningBanner);

    // 2. 构建底部道具栏
    const bottomBg = new Graphics();
    bottomBg.rect(0, DESIGN_HEIGHT - 120, DESIGN_WIDTH, 120);
    bottomBg.fill({ color: 0x78350f, alpha: 0.95 });
    bottomBg.stroke({ width: 2, color: 0x9a3412, alpha: 0.8 });
    this.bottomHud.addChild(bottomBg);

    this.shakeBtn = new CanvasButton({
      width: 210,
      height: 76,
      radius: 18,
      backgroundColor: 0xfff7ed,
      borderColor: 0xfdba74,
      label: '📳 摇晃 (2)',
      textStyle: { fontSize: 22, fill: '#78350f', fontWeight: 'bold' },
      onClick: () => {
        if (useSuikaStore.getState().useProp('shake')) {
          gameEvents.emit('suika-shake');
        } else {
          this.openModal('shop');
        }
      },
    });
    this.shakeBtn.x = 130;
    this.shakeBtn.y = DESIGN_HEIGHT - 60;
    this.bottomHud.addChild(this.shakeBtn);

    this.bombBtn = new CanvasButton({
      width: 210,
      height: 76,
      radius: 18,
      backgroundColor: 0xfff7ed,
      borderColor: 0xfdba74,
      label: '💣 炸弹 (1)',
      textStyle: { fontSize: 22, fill: '#78350f', fontWeight: 'bold' },
      onClick: () => {
        const s = useSuikaStore.getState();
        if (s.activeItemMode === 'bomb') {
          s.setActiveItemMode(null);
        } else if (s.useProp('bomb')) {
          s.setActiveItemMode('bomb');
          platform.playSound('click');
        } else {
          this.openModal('shop');
        }
      },
    });
    this.bombBtn.x = 375;
    this.bombBtn.y = DESIGN_HEIGHT - 60;
    this.bottomHud.addChild(this.bombBtn);

    this.upgradeBtn = new CanvasButton({
      width: 210,
      height: 76,
      radius: 18,
      backgroundColor: 0xfff7ed,
      borderColor: 0xfdba74,
      label: '⭐ 升级 (1)',
      textStyle: { fontSize: 22, fill: '#78350f', fontWeight: 'bold' },
      onClick: () => {
        const s = useSuikaStore.getState();
        if (s.activeItemMode === 'upgrade') {
          s.setActiveItemMode(null);
        } else if (s.useProp('upgrade')) {
          s.setActiveItemMode('upgrade');
          platform.playSound('click');
        } else {
          this.openModal('shop');
        }
      },
    });
    this.upgradeBtn.x = 620;
    this.upgradeBtn.y = DESIGN_HEIGHT - 60;
    this.bottomHud.addChild(this.upgradeBtn);

    // 3. 构建 GameOver 弹窗
    this.gameOverModal = new CanvasModal({
      cardWidth: 580,
      cardHeight: 620,
      title: '🍉 游戏结束 · 战报结算',
      closeOnBackdropClick: false,
    });
    this.modalLayer.addChild(this.gameOverModal);

    const statCard = new Graphics();
    statCard.roundRect(-240, -140, 480, 260, 20);
    statCard.fill({ color: 0xffedd5, alpha: 0.95 });
    statCard.stroke({ width: 2, color: 0xfdba74, alpha: 0.8 });
    this.gameOverModal.contentContainer.addChild(statCard);

    this.gameOverScoreText = new Text('最终得分: 0', {
      fontFamily: 'sans-serif',
      fontSize: 34,
      fontWeight: '900',
      fill: '#ea580c',
    });
    this.gameOverScoreText.anchor.set(0.5);
    this.gameOverScoreText.y = -80;
    this.gameOverModal.contentContainer.addChild(this.gameOverScoreText);

    this.gameOverHighText = new Text('历史最高分: 0', {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#78350f',
    });
    this.gameOverHighText.anchor.set(0.5);
    this.gameOverHighText.y = -20;
    this.gameOverModal.contentContainer.addChild(this.gameOverHighText);

    this.gameOverComboText = new Text('最高连击: x0 · 消除水果: 0', {
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#9a3412',
    });
    this.gameOverComboText.anchor.set(0.5);
    this.gameOverComboText.y = 40;
    this.gameOverModal.contentContainer.addChild(this.gameOverComboText);

    const restartBtn = new CanvasButton({
      width: 480,
      height: 84,
      radius: 20,
      backgroundColor: 0xea580c,
      borderColor: 0xf97316,
      label: '▶ 再来一局',
      textStyle: { fontSize: 30, fill: '#ffffff', fontWeight: '900' },
      onClick: () => {
        platform.playSound('click');
        this.gameOverModal.close();
        gameEvents.emit('suika-restart');
      },
    });
    restartBtn.y = 190;
    this.gameOverModal.contentContainer.addChild(restartBtn);

    // 4. 构建商城 / 排行榜 / 设置弹窗
    this.shopModal = this.createShopModal();
    this.leaderboardModal = this.createLeaderboardModal();
    this.settingsModal = this.createSettingsModal();
    this.modalLayer.addChild(this.shopModal);
    this.modalLayer.addChild(this.leaderboardModal);
    this.modalLayer.addChild(this.settingsModal);

    // 状态订阅与自动同步
    this.unsubStore = useSuikaStore.subscribe(() => {
      this.syncFromStore();
    });
    this.syncFromStore();
  }

  private createShopModal(): CanvasModal {
    const modal = new CanvasModal({
      cardWidth: 600,
      cardHeight: 700,
      title: '🛒 奇幻果园道具商城',
      onClose: () => this.closeModal(),
    });

    const addCoinBtn = new CanvasButton({
      width: 500,
      height: 64,
      radius: 14,
      backgroundColor: 0xf59e0b,
      borderColor: 0xfbbf24,
      label: '+ 免费领取 100 测试金币',
      textStyle: { fontSize: 20, fill: '#ffffff', fontWeight: 'bold' },
      onClick: () => {
        platform.playSound('match');
        useSuikaStore.getState().addCoins(100);
      },
    });
    addCoinBtn.y = -180;
    modal.contentContainer.addChild(addCoinBtn);

    const items = [
      { key: 'shake' as const, name: '📳 摇晃箱体', cost: 30, y: -70 },
      { key: 'bomb' as const, name: '💣 炸弹消除', cost: 50, y: 30 },
      { key: 'upgrade' as const, name: '⭐ 魔法升级', cost: 60, y: 130 },
    ];

    items.forEach((item) => {
      const card = new Graphics();
      card.roundRect(-250, item.y - 36, 500, 72, 14);
      card.fill({ color: 0xffedd5, alpha: 0.95 });
      card.stroke({ width: 1.5, color: 0xfdba74, alpha: 0.8 });
      modal.contentContainer.addChild(card);

      const name = new Text(item.name, {
        fontFamily: 'sans-serif',
        fontSize: 22,
        fontWeight: 'bold',
        fill: '#78350f',
      });
      name.anchor.set(0, 0.5);
      name.x = -220;
      name.y = item.y;
      modal.contentContainer.addChild(name);

      const buyBtn = new CanvasButton({
        width: 140,
        height: 50,
        radius: 12,
        backgroundColor: 0x0284c7,
        borderColor: 0x38bdf8,
        label: `🪙 ${item.cost}`,
        textStyle: { fontSize: 18, fill: '#ffffff', fontWeight: 'bold' },
        onClick: () => {
          if (useSuikaStore.getState().buyProp(item.key, item.cost)) {
            platform.playSound('match');
          } else {
            platform.playSound('invalid');
          }
        },
      });
      buyBtn.x = 160;
      buyBtn.y = item.y;
      modal.contentContainer.addChild(buyBtn);
    });

    return modal;
  }

  private createLeaderboardModal(): CanvasModal {
    const modal = new CanvasModal({
      cardWidth: 600,
      cardHeight: 650,
      title: '🏆 西瓜合成全球榜',
      onClose: () => this.closeModal(),
    });

    const ranks = [
      { rank: 1, name: 'SuikaMaster_99', score: 8420 },
      { rank: 2, name: 'WatermelonGod', score: 6250 },
      { rank: 3, name: 'PhysicsKing', score: 4890 },
      { rank: 4, name: '你 (当前玩家)', score: 0 },
      { rank: 5, name: 'FruitNinjaPro', score: 2340 },
    ];

    ranks.forEach((r, idx) => {
      const y = -160 + idx * 72;
      const row = new Graphics();
      row.roundRect(-250, y - 28, 500, 58, 12);
      row.fill({ color: idx === 3 ? 0xfef08a : 0xffedd5, alpha: 0.95 });
      row.stroke({ width: 1.5, color: 0xfdba74, alpha: 0.8 });
      modal.contentContainer.addChild(row);

      const txt = new Text(`#${idx + 1}  ${r.name}`, {
        fontFamily: 'sans-serif',
        fontSize: 20,
        fontWeight: 'bold',
        fill: '#78350f',
      });
      txt.anchor.set(0, 0.5);
      txt.x = -220;
      txt.y = y;
      modal.contentContainer.addChild(txt);

      const sc = new Text(`${r.score} 分`, {
        fontFamily: 'sans-serif',
        fontSize: 20,
        fontWeight: '900',
        fill: '#ea580c',
      });
      sc.anchor.set(1, 0.5);
      sc.x = 220;
      sc.y = y;
      modal.contentContainer.addChild(sc);
    });

    return modal;
  }

  private createSettingsModal(): CanvasModal {
    const modal = new CanvasModal({
      cardWidth: 580,
      cardHeight: 520,
      title: '⚙️ 游戏与引擎设置',
      onClose: () => this.closeModal(),
    });

    const soundToggle = new CanvasButton({
      width: 480,
      height: 72,
      radius: 14,
      backgroundColor: 0x059669,
      borderColor: 0x34d399,
      label: '🔊 合成音效: 已开启',
      textStyle: { fontSize: 22, fill: '#ffffff', fontWeight: 'bold' },
      onClick: () => {
        useSuikaStore.getState().toggleSound();
        platform.playSound('click');
      },
    });
    soundToggle.y = -80;
    modal.contentContainer.addChild(soundToggle);

    const platformLbl = new Text(`运行平台: ${platform.platformName} (Alloy2D v1.1)`, {
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#78350f',
    });
    platformLbl.anchor.set(0.5);
    platformLbl.y = 20;
    modal.contentContainer.addChild(platformLbl);

    return modal;
  }

  private openModal(type: ModalType): void {
    platform.playSound('click');
    useSuikaStore.getState().setActiveModal(type);
  }

  private closeModal(): void {
    platform.playSound('click');
    useSuikaStore.getState().setActiveModal(null);
  }

  private syncFromStore(): void {
    const s = useSuikaStore.getState();

    this.scoreText.text = `${s.score}`;
    this.highScoreText.text = `${s.highScore}`;
    this.coinsBtn.setLabel(`🪙 ${s.coins}`);
    this.nextEmojiText.text = FRUIT_CONFIGS[s.nextTier]?.emoji || '🫐';

    this.shakeBtn.setLabel(`📳 摇晃 (${s.props.shake})`);
    this.bombBtn.setLabel(`💣 炸弹 (${s.props.bomb})`);
    this.upgradeBtn.setLabel(`⭐ 升级 (${s.props.upgrade})`);

    this.warningBanner.visible = s.isDanger && !s.isGameOver;

    // GameOver 弹窗联动
    if (s.isGameOver && !this.gameOverModal.visible) {
      this.gameOverScoreText.text = `最终得分: ${s.score}`;
      this.gameOverHighText.text = `历史最高分: ${s.highScore}`;
      this.gameOverComboText.text = `最高连击: x${s.maxCombo} · 合成次数: ${s.fruitsMergedTotal}`;
      this.gameOverModal.open();
    } else if (!s.isGameOver && this.gameOverModal.visible) {
      this.gameOverModal.close();
    }

    // 商城/排行/设置联动
    if (s.activeModal === 'shop') this.shopModal.open();
    else this.shopModal.close();

    if (s.activeModal === 'leaderboard') this.leaderboardModal.open();
    else this.leaderboardModal.close();

    if (s.activeModal === 'settings') this.settingsModal.open();
    else this.settingsModal.close();
  }

  public applySafeAreaLayout(): void {
    const { safeTopDesign, safeBottomDesign } = computeSafeAreaDesignOffsets(
      DESIGN_WIDTH,
      DESIGN_HEIGHT
    );
    this.topHud.y = Math.max(0, safeTopDesign);
    this.bottomHud.y = -Math.max(0, safeBottomDesign);
  }

  public destroy(): void {
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }
    this.uiContainer.destroy({ children: true });
    this.modalLayer.destroy({ children: true });
  }
}
