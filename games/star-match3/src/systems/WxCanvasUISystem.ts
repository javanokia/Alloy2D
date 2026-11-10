import { Container, FederatedPointerEvent, Graphics, Text, TextStyle } from 'pixi.js';
import {
  animateTransform,
  CanvasButton,
  computeSafeAreaDesignOffsets,
  Easing,
  gameEvents,
  platform,
} from '@wegame/hybrid-engine';
import { LeaderboardEntry, ModalType, useGameStore } from '../store/useGameStore';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './Match3System';

export class WxCanvasUISystem {
  private unsubStore: (() => void) | null = null;
  public readonly modalLayer: Container;

  private topHudContainer!: Container;
  private bottomHudContainer!: Container;

  private menuLevelText!: Text;
  private menuHighScoreText!: Text;
  private menuCoinsText!: Text;
  private menuStartBtnText!: Text;

  private hudLevelText!: Text;
  private hudComboText!: Text;
  private hudCoinsBtnText!: Text;
  private hudMovesText!: Text;
  private hudScoreText!: Text;
  private hudProgressFill!: Graphics;
  private hammerTipText!: Text;
  private hammerBtnBg!: Graphics;
  private hammerCountText!: Text;
  private shuffleCountText!: Text;
  private extraMovesCountText!: Text;

  private settleBadgeText!: Text;
  private settleTitleText!: Text;
  private settleScoreText!: Text;
  private settleTargetText!: Text;
  private settleComboText!: Text;
  private settleActionBtnText!: Text;

  private modalCard!: Container;
  private modalTitleText!: Text;
  private shopContent!: Container;
  private leaderboardContent!: Container;
  private settingsContent!: Container;
  private lastOpenModal: ModalType = null;

  private shopCoinsText!: Text;
  private shopHammerTitle!: Text;
  private shopShuffleTitle!: Text;
  private shopExtraMovesTitle!: Text;
  private shopHammerBuyBg!: Graphics;
  private shopShuffleBuyBg!: Graphics;
  private shopExtraBuyBg!: Graphics;

  private lbRowBgs: Graphics[] = [];
  private lbRankTexts: Text[] = [];
  private lbNameTexts: Text[] = [];
  private lbLevelTexts: Text[] = [];
  private lbScoreTexts: Text[] = [];

  private settingSoundBtnText!: Text;
  private settingSoundBtnBg!: Graphics;
  private settingSafeAreaText!: Text;
  private settingLifecycleText!: Text;

  constructor(
    menuScene: Container,
    gameScene: Container,
    settlementScene: Container
  ) {
    this.modalLayer = new Container();
    this.modalLayer.visible = false;

    this.buildMenuScene(menuScene);
    this.buildGameHUD(gameScene);
    this.buildSettlementScene(settlementScene);
    this.buildModalLayer();

    this.applySafeAreaLayout();

    this.unsubStore = useGameStore.subscribe(() => {
      this.syncFromStore();
    });
    this.syncFromStore();
  }

  public applySafeAreaLayout(): void {
    const { safeTopDesign, safeBottomDesign } = computeSafeAreaDesignOffsets(
      DESIGN_WIDTH,
      DESIGN_HEIGHT
    );

    if (this.topHudContainer) {
      this.topHudContainer.y = Math.max(165, safeTopDesign + 125);
    }

    if (this.bottomHudContainer) {
      this.bottomHudContainer.y = Math.min(1130, DESIGN_HEIGHT - safeBottomDesign - 110);
    }
  }

  private createButton(
    width: number,
    height: number,
    bgColor: number,
    borderColor: number,
    label: string,
    fontSize: number,
    onClick: () => void,
    radius = 20
  ): { container: CanvasButton; bg: Graphics; textObj: Text } {
    const btn = new CanvasButton({
      width,
      height,
      radius,
      backgroundColor: bgColor,
      borderColor,
      label,
      textStyle: { fontSize },
      onClick,
    });
    return { container: btn, bg: btn.background, textObj: btn.labelText };
  }

  private buildMenuScene(menuScene: Container): void {
    const card = new Container();
    card.x = DESIGN_WIDTH / 2;
    card.y = DESIGN_HEIGHT / 2;
    menuScene.addChild(card);

    const cardBg = new Graphics();
    cardBg.beginFill(0x0f172a, 0.94);
    cardBg.lineStyle(4, 0x38bdf8, 0.55);
    cardBg.drawRoundedRect(-320, -370, 640, 740, 36);
    cardBg.endFill();
    card.addChild(cardBg);

    const badge = new Text(
      'Powered by @wegame/hybrid-engine SDK',
      new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 19,
        fontWeight: 'bold',
        fill: '#38bdf8',
      })
    );
    badge.anchor.set(0.5);
    badge.y = -295;
    card.addChild(badge);

    const title = new Text(
      '星耀三消 · 混合引擎',
      new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 48,
        fontWeight: '900',
        fill: ['#38bdf8', '#c084fc', '#f472b6'],
      })
    );
    title.anchor.set(0.5);
    title.y = -220;
    card.addChild(title);

    const subtitle = new Text(
      'React 状态驱动 + Pixi.js v7 高性能渲染管线',
      new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 22,
        fill: '#94a3b8',
      })
    );
    subtitle.anchor.set(0.5);
    subtitle.y = -155;
    card.addChild(subtitle);

    const statPositions = [-190, 0, 190];
    const statLabels = ['当前关卡', '历史最高分', '持有金币'];
    statPositions.forEach((posX, idx) => {
      const box = new Graphics();
      box.beginFill(0x1e293b, 0.9);
      box.lineStyle(2, 0x334155, 0.8);
      box.drawRoundedRect(posX - 85, -90, 170, 120, 20);
      box.endFill();
      card.addChild(box);

      const lbl = new Text(
        statLabels[idx],
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 20, fill: '#94a3b8' })
      );
      lbl.anchor.set(0.5);
      lbl.x = posX;
      lbl.y = -56;
      card.addChild(lbl);
    });

    this.menuLevelText = new Text(
      '第 1 关',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 30, fontWeight: 'bold', fill: '#f8fafc' })
    );
    this.menuLevelText.anchor.set(0.5);
    this.menuLevelText.x = -190;
    this.menuLevelText.y = -6;
    card.addChild(this.menuLevelText);

    this.menuHighScoreText = new Text(
      '0',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 30, fontWeight: 'bold', fill: '#38bdf8' })
    );
    this.menuHighScoreText.anchor.set(0.5);
    this.menuHighScoreText.x = 0;
    this.menuHighScoreText.y = -6;
    card.addChild(this.menuHighScoreText);

    this.menuCoinsText = new Text(
      '200',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 30, fontWeight: 'bold', fill: '#fbbf24' })
    );
    this.menuCoinsText.anchor.set(0.5);
    this.menuCoinsText.x = 190;
    this.menuCoinsText.y = -6;
    card.addChild(this.menuCoinsText);

    const startBtn = this.createButton(550, 94, 0x0284c7, 0x38bdf8, '▶ 立即开始第 1 关', 32, () => {
      platform.unlockAudio();
      platform.playSound('click');
      const level = useGameStore.getState().level;
      gameEvents.emit('switch-scene', { scene: 'game', level });
    });
    startBtn.container.y = 115;
    this.menuStartBtnText = startBtn.textObj;
    card.addChild(startBtn.container);

    const shopBtn = this.createButton(172, 74, 0x1e293b, 0x475569, '🛒 道具商城', 22, () => {
      platform.unlockAudio();
      platform.playSound('click');
      this.openModal('shop');
    });
    shopBtn.container.x = -190;
    shopBtn.container.y = 240;
    card.addChild(shopBtn.container);

    const rankBtn = this.createButton(172, 74, 0x1e293b, 0x475569, '🏆 排行榜', 22, () => {
      platform.unlockAudio();
      platform.playSound('click');
      this.openModal('leaderboard');
    });
    rankBtn.container.x = 0;
    rankBtn.container.y = 240;
    card.addChild(rankBtn.container);

    const settingBtn = this.createButton(172, 74, 0x1e293b, 0x475569, '⚙️ 设置', 22, () => {
      platform.unlockAudio();
      platform.playSound('click');
      this.openModal('settings');
    });
    settingBtn.container.x = 190;
    settingBtn.container.y = 240;
    card.addChild(settingBtn.container);
  }

  private buildGameHUD(gameScene: Container): void {
    const topBar = new Container();
    topBar.x = DESIGN_WIDTH / 2;
    topBar.y = 165;
    this.topHudContainer = topBar;
    gameScene.addChild(topBar);

    const topBg = new Graphics();
    topBg.beginFill(0x0f172a, 0.92);
    topBg.lineStyle(3, 0x38bdf8, 0.45);
    topBg.drawRoundedRect(-335, -115, 670, 230, 28);
    topBg.endFill();
    topBar.addChild(topBg);

    const backBtn = this.createButton(125, 54, 0x1e293b, 0x475569, '⬅ 菜单', 21, () => {
      platform.playSound('click');
      gameEvents.emit('switch-scene', { scene: 'menu' });
    }, 14);
    backBtn.container.x = -250;
    backBtn.container.y = -62;
    topBar.addChild(backBtn.container);

    this.hudLevelText = new Text(
      '第 1 关',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold', fill: '#f8fafc' })
    );
    this.hudLevelText.anchor.set(0.5);
    this.hudLevelText.x = -65;
    this.hudLevelText.y = -62;
    topBar.addChild(this.hudLevelText);

    this.hudComboText = new Text(
      '',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#fb923c' })
    );
    this.hudComboText.anchor.set(0, 0.5);
    this.hudComboText.x = 5;
    this.hudComboText.y = -62;
    topBar.addChild(this.hudComboText);

    const coinShopBtn = this.createButton(145, 54, 0x1e293b, 0xfbbf24, '🪙 200 +', 20, () => {
      platform.playSound('click');
      this.openModal('shop');
    }, 14);
    coinShopBtn.container.x = 165;
    coinShopBtn.container.y = -62;
    this.hudCoinsBtnText = coinShopBtn.textObj;
    this.hudCoinsBtnText.style.fill = '#fbbf24';
    topBar.addChild(coinShopBtn.container);

    const settingIconBtn = this.createButton(64, 54, 0x1e293b, 0x475569, '⚙️', 24, () => {
      platform.playSound('click');
      this.openModal('settings');
    }, 14);
    settingIconBtn.container.x = 282;
    settingIconBtn.container.y = -62;
    topBar.addChild(settingIconBtn.container);

    const movesBox = new Graphics();
    movesBox.beginFill(0x1e293b, 0.95);
    movesBox.lineStyle(2, 0x38bdf8, 0.45);
    movesBox.drawRoundedRect(-310, -10, 150, 100, 18);
    movesBox.endFill();
    topBar.addChild(movesBox);

    const movesLabel = new Text(
      '剩余步数',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 18, fill: '#94a3b8' })
    );
    movesLabel.anchor.set(0.5);
    movesLabel.x = -235;
    movesLabel.y = 14;
    topBar.addChild(movesLabel);

    this.hudMovesText = new Text(
      '20',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 38, fontWeight: '900', fill: '#38bdf8' })
    );
    this.hudMovesText.anchor.set(0.5);
    this.hudMovesText.x = -235;
    this.hudMovesText.y = 58;
    topBar.addChild(this.hudMovesText);

    this.hudScoreText = new Text(
      '得分: 0 / 目标: 900',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#e2e8f0' })
    );
    this.hudScoreText.anchor.set(0, 0.5);
    this.hudScoreText.x = -130;
    this.hudScoreText.y = 16;
    topBar.addChild(this.hudScoreText);

    const progressTrack = new Graphics();
    progressTrack.beginFill(0x1e293b, 1);
    progressTrack.lineStyle(2, 0x334155, 0.8);
    progressTrack.drawRoundedRect(-130, 48, 435, 28, 14);
    progressTrack.endFill();
    topBar.addChild(progressTrack);

    this.hudProgressFill = new Graphics();
    topBar.addChild(this.hudProgressFill);

    const bottomBar = new Container();
    bottomBar.x = DESIGN_WIDTH / 2;
    bottomBar.y = 1130;
    this.bottomHudContainer = bottomBar;
    gameScene.addChild(bottomBar);

    this.hammerTipText = new Text(
      '',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#fbbf24' })
    );
    this.hammerTipText.anchor.set(0.5);
    this.hammerTipText.y = -95;
    bottomBar.addChild(this.hammerTipText);

    const hammerBtn = this.createButton(205, 92, 0x1e293b, 0x38bdf8, '🔨 神锤爆破', 24, () => {
      platform.playSound('click');
      const store = useGameStore.getState();
      if (store.activeItemMode === 'hammer') {
        store.setActiveItemMode(null);
      } else if (store.items.hammer > 0) {
        store.setActiveItemMode('hammer');
      } else {
        this.openModal('shop');
      }
    });
    hammerBtn.container.x = -225;
    this.hammerBtnBg = hammerBtn.bg;
    this.hammerCountText = hammerBtn.textObj;
    bottomBar.addChild(hammerBtn.container);

    const shuffleBtn = this.createButton(205, 92, 0x1e293b, 0x38bdf8, '🔀 全局重排', 24, () => {
      platform.playSound('click');
      const store = useGameStore.getState();
      if (store.items.shuffle > 0) {
        gameEvents.emit('item-shuffle');
      } else {
        this.openModal('shop');
      }
    });
    shuffleBtn.container.x = 0;
    this.shuffleCountText = shuffleBtn.textObj;
    bottomBar.addChild(shuffleBtn.container);

    const movesBtn = this.createButton(205, 92, 0x1e293b, 0x38bdf8, '⚡ 步数 +5', 24, () => {
      platform.playSound('click');
      const store = useGameStore.getState();
      if (store.items.extraMoves > 0) {
        gameEvents.emit('item-extra-moves');
      } else {
        this.openModal('shop');
      }
    });
    movesBtn.container.x = 225;
    this.extraMovesCountText = movesBtn.textObj;
    bottomBar.addChild(movesBtn.container);
  }

  private buildSettlementScene(settlementScene: Container): void {
    const card = new Container();
    card.x = DESIGN_WIDTH / 2;
    card.y = DESIGN_HEIGHT / 2;
    settlementScene.addChild(card);

    const cardBg = new Graphics();
    cardBg.beginFill(0x0f172a, 0.95);
    cardBg.lineStyle(4, 0x38bdf8, 0.55);
    cardBg.drawRoundedRect(-310, -320, 620, 640, 36);
    cardBg.endFill();
    card.addChild(cardBg);

    this.settleBadgeText = new Text(
      '🎉 恭喜通关',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold', fill: '#38bdf8' })
    );
    this.settleBadgeText.anchor.set(0.5);
    this.settleBadgeText.y = -230;
    card.addChild(this.settleBadgeText);

    this.settleTitleText = new Text(
      '第 1 关 挑战成功!',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 44, fontWeight: '900', fill: '#ffffff' })
    );
    this.settleTitleText.anchor.set(0.5);
    this.settleTitleText.y = -155;
    card.addChild(this.settleTitleText);

    this.settleScoreText = new Text(
      '本局得分: 0',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 32, fontWeight: 'bold', fill: '#34d399' })
    );
    this.settleScoreText.anchor.set(0.5);
    this.settleScoreText.y = -60;
    card.addChild(this.settleScoreText);

    this.settleTargetText = new Text(
      '目标分数: 900',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 26, fill: '#94a3b8' })
    );
    this.settleTargetText.anchor.set(0.5);
    this.settleTargetText.y = -5;
    card.addChild(this.settleTargetText);

    this.settleComboText = new Text(
      '最高连击: x1',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 26, fill: '#fbbf24' })
    );
    this.settleComboText.anchor.set(0.5);
    this.settleComboText.y = 45;
    card.addChild(this.settleComboText);

    const nextBtn = this.createButton(480, 88, 0x0284c7, 0x38bdf8, '▶ 挑战下一关', 30, () => {
      platform.playSound('click');
      const s = useGameStore.getState();
      const targetLevel = s.isLevelWon ? s.level + 1 : s.level;
      gameEvents.emit('switch-scene', { scene: 'game', level: targetLevel });
    });
    nextBtn.container.y = 145;
    this.settleActionBtnText = nextBtn.textObj;
    card.addChild(nextBtn.container);

    const menuBtn = this.createButton(480, 72, 0x1e293b, 0x475569, '返回主菜单', 24, () => {
      platform.playSound('click');
      const s = useGameStore.getState();
      if (s.isLevelWon) {
        s.setLevel(s.level + 1);
      }
      gameEvents.emit('switch-scene', { scene: 'menu' });
    });
    menuBtn.container.y = 245;
    card.addChild(menuBtn.container);
  }

  private buildModalLayer(): void {
    const backdrop = new Graphics();
    backdrop.beginFill(0x030712, 0.78);
    backdrop.drawRect(-500, -500, DESIGN_WIDTH + 1000, DESIGN_HEIGHT + 1000);
    backdrop.endFill();
    backdrop.eventMode = 'static';
    backdrop.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
    });
    backdrop.on('pointerup', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      platform.playSound('click');
      this.closeModal();
    });
    this.modalLayer.addChild(backdrop);

    const card = new Container();
    card.x = DESIGN_WIDTH / 2;
    card.y = DESIGN_HEIGHT / 2;
    card.eventMode = 'static';
    card.on('pointerdown', (e: FederatedPointerEvent) => e.stopPropagation());
    card.on('pointerup', (e: FederatedPointerEvent) => e.stopPropagation());
    this.modalCard = card;
    this.modalLayer.addChild(card);

    const cardBg = new Graphics();
    cardBg.beginFill(0x0f172a, 0.98);
    cardBg.lineStyle(4, 0x38bdf8, 0.65);
    cardBg.drawRoundedRect(-320, -370, 640, 740, 32);
    cardBg.endFill();
    card.addChild(cardBg);

    this.modalTitleText = new Text(
      '弹窗标题',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 32, fontWeight: '900', fill: '#f8fafc' })
    );
    this.modalTitleText.anchor.set(0, 0.5);
    this.modalTitleText.x = -275;
    this.modalTitleText.y = -305;
    card.addChild(this.modalTitleText);

    const closeBtn = this.createButton(60, 60, 0x1e293b, 0x475569, '✕', 26, () => {
      platform.playSound('click');
      this.closeModal();
    }, 16);
    closeBtn.container.x = 250;
    closeBtn.container.y = -305;
    card.addChild(closeBtn.container);

    const divider = new Graphics();
    divider.lineStyle(2, 0x334155, 0.8);
    divider.moveTo(-280, -255);
    divider.lineTo(280, -255);
    card.addChild(divider);

    this.shopContent = new Container();
    this.leaderboardContent = new Container();
    this.settingsContent = new Container();

    this.buildShopModalContent(this.shopContent);
    this.buildLeaderboardModalContent(this.leaderboardContent);
    this.buildSettingsModalContent(this.settingsContent);

    card.addChild(this.shopContent);
    card.addChild(this.leaderboardContent);
    card.addChild(this.settingsContent);
  }

  private buildShopModalContent(container: Container): void {
    const coinBar = new Graphics();
    coinBar.beginFill(0x1e293b, 0.9);
    coinBar.drawRoundedRect(-280, -230, 560, 84, 18);
    coinBar.endFill();
    container.addChild(coinBar);

    this.shopCoinsText = new Text(
      '当前金币: 🪙 200',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 25, fontWeight: 'bold', fill: '#fbbf24' })
    );
    this.shopCoinsText.anchor.set(0, 0.5);
    this.shopCoinsText.x = -250;
    this.shopCoinsText.y = -188;
    container.addChild(this.shopCoinsText);

    const freeCoinBtn = this.createButton(220, 56, 0x78350f, 0xfbbf24, '+ 领 100 测试金币', 20, () => {
      platform.playSound('match');
      useGameStore.getState().addCoins(100);
    }, 14);
    freeCoinBtn.container.x = 145;
    freeCoinBtn.container.y = -188;
    container.addChild(freeCoinBtn.container);

    const itemsMeta = [
      {
        key: 'hammer' as const,
        icon: '🔨',
        name: '神锤爆破',
        desc: '点击任意棋子，直接消除周围 3×3 区域',
        cost: 50,
        y: -65,
      },
      {
        key: 'shuffle' as const,
        icon: '🔀',
        name: '全局重排',
        desc: '不消耗步数，重新洗牌当前所有棋子',
        cost: 40,
        y: 85,
      },
      {
        key: 'extraMoves' as const,
        icon: '⚡',
        name: '步数 +5',
        desc: '立即为当前关卡增加 5 步可用步数',
        cost: 60,
        y: 235,
      },
    ];

    itemsMeta.forEach((meta) => {
      const rowBg = new Graphics();
      rowBg.beginFill(0x1e293b, 0.78);
      rowBg.lineStyle(2, 0x334155, 0.8);
      rowBg.drawRoundedRect(-280, meta.y - 60, 560, 125, 20);
      rowBg.endFill();
      container.addChild(rowBg);

      const iconTxt = new Text(meta.icon, new TextStyle({ fontSize: 42 }));
      iconTxt.anchor.set(0.5);
      iconTxt.x = -230;
      iconTxt.y = meta.y;
      container.addChild(iconTxt);

      const titleTxt = new Text(
        `${meta.name} (持有: 0)`,
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#f8fafc' })
      );
      titleTxt.anchor.set(0, 0.5);
      titleTxt.x = -180;
      titleTxt.y = meta.y - 20;
      container.addChild(titleTxt);

      const descTxt = new Text(
        meta.desc,
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 18, fill: '#94a3b8' })
      );
      descTxt.anchor.set(0, 0.5);
      descTxt.x = -180;
      descTxt.y = meta.y + 20;
      container.addChild(descTxt);

      const buyBtn = this.createButton(
        145,
        64,
        0x0284c7,
        0x38bdf8,
        `🪙 ${meta.cost} 购买`,
        20,
        () => {
          if (useGameStore.getState().buyItem(meta.key, meta.cost)) {
            platform.playSound('match');
          } else {
            platform.playSound('invalid');
          }
        },
        16
      );
      buyBtn.container.x = 185;
      buyBtn.container.y = meta.y;
      container.addChild(buyBtn.container);

      if (meta.key === 'hammer') {
        this.shopHammerTitle = titleTxt;
        this.shopHammerBuyBg = buyBtn.bg;
      } else if (meta.key === 'shuffle') {
        this.shopShuffleTitle = titleTxt;
        this.shopShuffleBuyBg = buyBtn.bg;
      } else {
        this.shopExtraMovesTitle = titleTxt;
        this.shopExtraBuyBg = buyBtn.bg;
      }
    });
  }

  private buildLeaderboardModalContent(container: Container): void {
    for (let i = 0; i < 5; i++) {
      const y = -180 + i * 115;
      const rowBg = new Graphics();
      container.addChild(rowBg);
      this.lbRowBgs.push(rowBg);

      const rankTxt = new Text(
        `#${i + 1}`,
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 26, fontWeight: 'bold', fill: '#fbbf24' })
      );
      rankTxt.anchor.set(0, 0.5);
      rankTxt.x = -250;
      rankTxt.y = y;
      container.addChild(rankTxt);
      this.lbRankTexts.push(rankTxt);

      const nameTxt = new Text(
        '',
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#f8fafc' })
      );
      nameTxt.anchor.set(0, 0.5);
      nameTxt.x = -175;
      nameTxt.y = y;
      container.addChild(nameTxt);
      this.lbNameTexts.push(nameTxt);

      const lvlTxt = new Text(
        '',
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 20, fill: '#94a3b8' })
      );
      lvlTxt.anchor.set(1, 0.5);
      lvlTxt.x = 100;
      lvlTxt.y = y;
      container.addChild(lvlTxt);
      this.lbLevelTexts.push(lvlTxt);

      const scoreTxt = new Text(
        '',
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 25, fontWeight: 'bold', fill: '#38bdf8' })
      );
      scoreTxt.anchor.set(1, 0.5);
      scoreTxt.x = 255;
      scoreTxt.y = y;
      container.addChild(scoreTxt);
      this.lbScoreTexts.push(scoreTxt);
    }
  }

  private buildSettingsModalContent(container: Container): void {
    const drawRowCard = (y: number, label: string) => {
      const bg = new Graphics();
      bg.beginFill(0x1e293b, 0.85);
      bg.lineStyle(2, 0x334155, 0.8);
      bg.drawRoundedRect(-280, y - 48, 560, 96, 18);
      bg.endFill();
      container.addChild(bg);

      const lbl = new Text(
        label,
        new TextStyle({ fontFamily: 'sans-serif', fontSize: 23, fontWeight: 'bold', fill: '#e2e8f0' })
      );
      lbl.anchor.set(0, 0.5);
      lbl.x = -250;
      lbl.y = y;
      container.addChild(lbl);
    };

    drawRowCard(-175, '合成音效 (WebAudio)');
    const soundToggleBtn = this.createButton(175, 58, 0x059669, 0x34d399, '🔊 已开启', 21, () => {
      useGameStore.getState().toggleSound();
      platform.playSound('click');
    }, 14);
    soundToggleBtn.container.x = 165;
    soundToggleBtn.container.y = -175;
    this.settingSoundBtnText = soundToggleBtn.textObj;
    this.settingSoundBtnBg = soundToggleBtn.bg;
    container.addChild(soundToggleBtn.container);

    drawRowCard(-55, '刘海/胶囊安全区');
    this.settingSafeAreaText = new Text(
      'Top: 0px / Bottom: 0px',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#38bdf8' })
    );
    this.settingSafeAreaText.anchor.set(1, 0.5);
    this.settingSafeAreaText.x = 255;
    this.settingSafeAreaText.y = -55;
    container.addChild(this.settingSafeAreaText);

    drawRowCard(65, '前后台生命周期');
    this.settingLifecycleText = new Text(
      '前台运行中 (切换 0 次)',
      new TextStyle({ fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#34d399' })
    );
    this.settingLifecycleText.anchor.set(1, 0.5);
    this.settingLifecycleText.x = 255;
    this.settingLifecycleText.y = 65;
    container.addChild(this.settingLifecycleText);

    const restartBtn = this.createButton(560, 82, 0x0284c7, 0x38bdf8, '↻ 重新开始当前关卡', 26, () => {
      platform.playSound('click');
      const lvl = useGameStore.getState().level;
      this.closeModal();
      gameEvents.emit('switch-scene', { scene: 'game', level: lvl });
    }, 18);
    restartBtn.container.y = 215;
    container.addChild(restartBtn.container);
  }

  public openModal(modal: ModalType): void {
    useGameStore.getState().setActiveModal(modal);
  }

  public closeModal(): void {
    useGameStore.getState().setActiveModal(null);
  }

  private syncFromStore(): void {
    const s = useGameStore.getState();

    this.menuLevelText.text = `第 ${s.level} 关`;
    this.menuHighScoreText.text = `${s.highScore}`;
    this.menuCoinsText.text = `🪙 ${s.coins}`;
    this.menuStartBtnText.text = `▶ 立即开始第 ${s.level} 关`;

    this.hudLevelText.text = `第 ${s.level} 关`;
    this.hudComboText.text = s.combo > 1 ? `Combo x${s.combo}` : '';
    this.hudCoinsBtnText.text = `🪙 ${s.coins} +`;
    this.hudMovesText.text = `${s.movesLeft}`;
    this.hudMovesText.style.fill = s.movesLeft <= 5 ? '#f43f5e' : '#38bdf8';
    this.hudScoreText.text = `得分: ${s.score} / 目标: ${s.targetScore}`;

    const pct = Math.min(1, Math.max(0, s.score / Math.max(1, s.targetScore)));
    this.hudProgressFill.clear();
    if (pct > 0) {
      this.hudProgressFill.beginFill(0x34d399, 1);
      this.hudProgressFill.drawRoundedRect(-128, 50, Math.max(24, 431 * pct), 24, 12);
      this.hudProgressFill.endFill();
    }

    this.hammerTipText.text =
      s.activeItemMode === 'hammer' ? '🔨 点击任意棋子爆破 3×3 区域 (再次点击取消)' : '';

    this.hammerBtnBg.clear();
    this.hammerBtnBg.beginFill(s.activeItemMode === 'hammer' ? 0xd97706 : 0x1e293b, 0.95);
    this.hammerBtnBg.lineStyle(3, s.activeItemMode === 'hammer' ? 0xfbbf24 : 0x38bdf8, 0.9);
    this.hammerBtnBg.drawRoundedRect(-205 / 2, -92 / 2, 205, 92, 20);
    this.hammerBtnBg.endFill();

    this.hammerCountText.text = `🔨 神锤 (${s.items.hammer})`;
    this.shuffleCountText.text = `🔀 重排 (${s.items.shuffle})`;
    this.extraMovesCountText.text = `⚡ +5步 (${s.items.extraMoves})`;

    this.settleBadgeText.text = s.isLevelWon ? '🎉 恭喜通关' : '💥 步数耗尽';
    this.settleTitleText.text = `第 ${s.level} 关 ${s.isLevelWon ? '挑战成功!' : '挑战失败'}`;
    this.settleScoreText.text = `本局得分: ${s.score}`;
    this.settleTargetText.text = `目标分数: ${s.targetScore}`;
    this.settleComboText.text = `最高连击: x${s.maxCombo} · 金币: ${s.coins}`;
    this.settleActionBtnText.text = s.isLevelWon
      ? `▶ 挑战第 ${s.level + 1} 关`
      : `↻ 重新挑战第 ${s.level} 关`;

    if (s.activeModal !== this.lastOpenModal) {
      this.lastOpenModal = s.activeModal;
      if (s.activeModal) {
        this.modalLayer.visible = true;
        this.modalCard.scale.set(0.85);
        this.modalCard.alpha = 0;
        animateTransform(this.modalCard, {
          toScaleX: 1,
          toScaleY: 1,
          toAlpha: 1,
          durationMS: 180,
          ease: Easing.easeOutBack,
        });
      } else {
        this.modalLayer.visible = false;
      }
    }

    this.shopContent.visible = s.activeModal === 'shop';
    this.leaderboardContent.visible = s.activeModal === 'leaderboard';
    this.settingsContent.visible = s.activeModal === 'settings';

    if (s.activeModal === 'shop') {
      this.modalTitleText.text = '🛒 道具商城';
      this.shopCoinsText.text = `当前金币: 🪙 ${s.coins}`;
      this.shopHammerTitle.text = `神锤爆破 (持有: ${s.items.hammer})`;
      this.shopShuffleTitle.text = `全局重排 (持有: ${s.items.shuffle})`;
      this.shopExtraMovesTitle.text = `步数 +5 (持有: ${s.items.extraMoves})`;

      const updateBuyBtnStyle = (bg: Graphics, canAfford: boolean) => {
        bg.clear();
        bg.beginFill(canAfford ? 0x0284c7 : 0x334155, 0.95);
        bg.lineStyle(3, canAfford ? 0x38bdf8 : 0x475569, 0.85);
        bg.drawRoundedRect(-145 / 2, -64 / 2, 145, 64, 16);
        bg.endFill();
      };
      updateBuyBtnStyle(this.shopHammerBuyBg, s.coins >= 50);
      updateBuyBtnStyle(this.shopShuffleBuyBg, s.coins >= 40);
      updateBuyBtnStyle(this.shopExtraBuyBg, s.coins >= 60);
    } else if (s.activeModal === 'leaderboard') {
      this.modalTitleText.text = '🏆 多端玩家排行榜';
      const list: LeaderboardEntry[] = [
        { rank: 1, name: 'PixiMaster_WebGL', score: 12850, level: 12 },
        { rank: 2, name: 'ReactHooks_Pro', score: 9420, level: 9 },
        { rank: 3, name: 'ZustandRunner', score: 6800, level: 7 },
        { rank: 4, name: '你 (当前玩家)', score: s.highScore, level: s.level },
        { rank: 5, name: 'CanvasRefactor', score: 2450, level: 3 },
      ]
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));

      list.forEach((entry, idx) => {
        const y = -180 + idx * 115;
        const isMe = entry.name.includes('你');
        const bg = this.lbRowBgs[idx];
        bg.clear();
        bg.beginFill(isMe ? 0x0c4a6e : 0x1e293b, 0.88);
        bg.lineStyle(2, isMe ? 0x38bdf8 : 0x334155, 0.9);
        bg.drawRoundedRect(-280, y - 42, 560, 84, 18);
        bg.endFill();

        this.lbRankTexts[idx].text = `#${entry.rank}`;
        this.lbNameTexts[idx].text = entry.name;
        this.lbLevelTexts[idx].text = `第 ${entry.level} 关`;
        this.lbScoreTexts[idx].text = `${entry.score} 分`;
      });
    } else if (s.activeModal === 'settings') {
      this.modalTitleText.text = '⚙️ 游戏与引擎设置';
      this.settingSoundBtnText.text = s.soundEnabled ? '🔊 已开启' : '🔇 已静音';
      this.settingSoundBtnBg.clear();
      this.settingSoundBtnBg.beginFill(s.soundEnabled ? 0x059669 : 0x334155, 0.95);
      this.settingSoundBtnBg.lineStyle(3, s.soundEnabled ? 0x34d399 : 0x64748b, 0.85);
      this.settingSoundBtnBg.drawRoundedRect(-175 / 2, -58 / 2, 175, 58, 14);
      this.settingSoundBtnBg.endFill();

      const insets = platform.getSafeAreaInsets();
      this.settingSafeAreaText.text = `Top ${insets.top}px · 胶囊 ${insets.capsuleBottom}px`;
      this.settingLifecycleText.text = `${
        s.lifecycleState === 'show' ? '前台运行' : '后台挂起'
      } (切换 ${s.lifecycleSwitchCount} 次)`;
    }
  }

  public destroy(): void {
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }
    this.modalLayer.destroy({ children: true });
  }
}
