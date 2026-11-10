import { Container, FederatedPointerEvent, Graphics, Text, TextStyle } from 'pixi.js';
import {
  CanvasButton,
  computeSafeAreaDesignOffsets,
  gameEvents,
  platform,
} from '@wegame/hybrid-engine';
import { ModalType, useYangStore } from '../store/useYangStore';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './YangGameSystem';

/**
 * 微信小游戏专属 Canvas 渲染 UI 系统
 * 抹平微信无 DOM 环境下的主菜单、HUD 顶栏、底部三大道具栏、结算弹窗与模态框
 */
export class YangCanvasUISystem {
  private unsubStore: (() => void) | null = null;
  public readonly modalLayer: Container;

  private topHudContainer!: Container;
  private bottomHudContainer!: Container;

  private menuScoreText!: Text;
  private hudLevelText!: Text;
  private hudScoreText!: Text;
  private hudBgmText!: Text;
  private propMoveOutText!: Text;
  private propUndoText!: Text;
  private propShuffleText!: Text;

  private settleTitleText!: Text;
  private settleScoreText!: Text;
  private settleBadgeText!: Text;
  private settleReviveBtn!: Container;

  private modalCard!: Container;
  private modalTitleText!: Text;
  private shopContent!: Container;
  private leaderboardContent!: Container;
  private settingsContent!: Container;
  private lastOpenModal: ModalType = null;

  constructor(
    menuScene: Container,
    gameScene: Container,
    settlementScene: Container
  ) {
    this.modalLayer = new Container();
    this.modalLayer.visible = false;

    this.buildMenuUI(menuScene);
    this.buildGameHUD(gameScene);
    this.buildSettlementUI(settlementScene);
    this.buildModalSystem();

    this.subscribeStore();
    this.applySafeAreaLayout();
  }

  private buildMenuUI(parent: Container): void {
    const card = new Container();
    card.x = DESIGN_WIDTH / 2;
    card.y = DESIGN_HEIGHT / 2;

    const bg = new Graphics();
    bg.beginFill(0x0f172a, 0.9);
    bg.lineStyle(3, 0xa3e635, 0.6);
    bg.drawRoundedRect(-240, -320, 480, 640, 24);
    bg.endFill();
    card.addChild(bg);

    const titleStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 48,
      fontWeight: '900',
      fill: ['#a3e635', '#facc15'],
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
    });
    const title = new Text('🐑 羊了个羊', titleStyle);
    title.anchor.set(0.5);
    title.y = -220;
    card.addChild(title);

    const subStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 18,
      fill: '#cbd5e1',
      fontWeight: '600',
    });
    const sub = new Text('微信爆款复刻 · 今日通关率 0.12%', subStyle);
    sub.anchor.set(0.5);
    sub.y = -160;
    card.addChild(sub);

    // 战报
    const banner = new Graphics();
    banner.beginFill(0x1e293b, 0.85);
    banner.lineStyle(1.5, 0x84cc16, 0.5);
    banner.drawRoundedRect(-210, -120, 420, 70, 12);
    banner.endFill();
    card.addChild(banner);

    const bannerStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16,
      fill: '#fef08a',
      fontWeight: 'bold',
    });
    const bannerText = new Text('🏆 今日领跑：广东省羊群 (12,482 只羊)', bannerStyle);
    bannerText.anchor.set(0.5);
    bannerText.y = -85;
    card.addChild(bannerText);

    // 历史最高分
    const scoreStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 20,
      fill: '#38bdf8',
      fontWeight: 'bold',
    });
    this.menuScoreText = new Text('最高积分: 0', scoreStyle);
    this.menuScoreText.anchor.set(0.5);
    this.menuScoreText.y = -20;
    card.addChild(this.menuScoreText);

    // 开始按钮
    const btnL1 = this.createButton(
      '🌱 第一关 · 新手体验',
      0x4d7c0f,
      0x84cc16,
      420,
      64,
      () => {
        platform.playSound('click');
        useYangStore.getState().setLevel(1);
        useYangStore.getState().resetYangProps();
        gameEvents.emit('switch-scene', { scene: 'game', level: 1 });
      }
    );
    btnL1.y = 50;
    card.addChild(btnL1);

    const btnL2 = this.createButton(
      '🔥 第二关 · 加入今日羊群 (0.1%)',
      0xb91c1c,
      0xef4444,
      420,
      64,
      () => {
        platform.playSound('click');
        useYangStore.getState().setLevel(2);
        useYangStore.getState().resetYangProps();
        gameEvents.emit('switch-scene', { scene: 'game', level: 2 });
      }
    );
    btnL2.y = 134;
    card.addChild(btnL2);

    // 排行榜 & 设置小按钮
    const btnLb = this.createButton('🏆 羊群榜', 0x1e293b, 0x38bdf8, 196, 52, () => {
      platform.playSound('click');
      useYangStore.getState().setActiveModal('leaderboard');
    });
    btnLb.x = -110;
    btnLb.y = 224;
    card.addChild(btnLb);

    const btnSet = this.createButton('⚙️ 设置', 0x1e293b, 0x94a3b8, 196, 52, () => {
      platform.playSound('click');
      useYangStore.getState().setActiveModal('settings');
    });
    btnSet.x = 110;
    btnSet.y = 224;
    card.addChild(btnSet);

    parent.addChild(card);
  }

  private buildGameHUD(parent: Container): void {
    this.topHudContainer = new Container();
    this.bottomHudContainer = new Container();

    // 顶部条背景
    const topBg = new Graphics();
    topBg.beginFill(0x0f172a, 0.9);
    topBg.lineStyle(2, 0x84cc16, 0.4);
    topBg.drawRoundedRect(16, 0, DESIGN_WIDTH - 32, 88, 16);
    topBg.endFill();
    this.topHudContainer.addChild(topBg);

    // 退出按钮
    const backBtn = this.createButton('⬅ 退出', 0x334155, 0x64748b, 90, 44, () => {
      platform.playSound('click');
      gameEvents.emit('switch-scene', { scene: 'menu' });
    });
    backBtn.x = 75;
    backBtn.y = 44;
    this.topHudContainer.addChild(backBtn);

    // 关卡标签
    const levelStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: '#facc15',
    });
    this.hudLevelText = new Text('第 1 关', levelStyle);
    this.hudLevelText.anchor.set(0.5);
    this.hudLevelText.x = DESIGN_WIDTH / 2;
    this.hudLevelText.y = 32;
    this.topHudContainer.addChild(this.hudLevelText);

    // 得分标签
    const scoreStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16,
      fill: '#86efac',
    });
    this.hudScoreText = new Text('得分: 0', scoreStyle);
    this.hudScoreText.anchor.set(0.5);
    this.hudScoreText.x = DESIGN_WIDTH / 2;
    this.hudScoreText.y = 60;
    this.topHudContainer.addChild(this.hudScoreText);

    // BGM 按钮
    const bgmBtn = this.createButton('🎵', 0x334155, 0xfacc15, 52, 44, () => {
      useYangStore.getState().toggleBgm();
    });
    bgmBtn.x = DESIGN_WIDTH - 150;
    bgmBtn.y = 44;
    this.topHudContainer.addChild(bgmBtn);

    // 重来按钮
    const restartBtn = this.createButton('🔄', 0x334155, 0x38bdf8, 52, 44, () => {
      platform.playSound('click');
      gameEvents.emit('yang-restart-level', { level: useYangStore.getState().level });
    });
    restartBtn.x = DESIGN_WIDTH - 80;
    restartBtn.y = 44;
    this.topHudContainer.addChild(restartBtn);

    // 底部三大道具栏
    const propConfigs = [
      { key: 'moveOut', name: '移出', icon: '📦', x: DESIGN_WIDTH / 2 - 120 },
      { key: 'undo', name: '撤回', icon: '↩️', x: DESIGN_WIDTH / 2 },
      { key: 'shuffle', name: '洗牌', icon: '🔀', x: DESIGN_WIDTH / 2 + 120 },
    ];

    propConfigs.forEach((cfg) => {
      const btn = new Container();
      btn.x = cfg.x;
      btn.y = DESIGN_HEIGHT - 70;
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const circle = new Graphics();
      circle.beginFill(0x1e293b, 0.95);
      circle.lineStyle(3, 0xa3e635, 0.8);
      circle.drawCircle(0, 0, 36);
      circle.endFill();
      btn.addChild(circle);

      const iconStyle = new TextStyle({ fontSize: 24 });
      const icon = new Text(cfg.icon, iconStyle);
      icon.anchor.set(0.5);
      icon.y = -4;
      btn.addChild(icon);

      const nameStyle = new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fill: '#f8fafc',
        fontWeight: 'bold',
      });
      const name = new Text(cfg.name, nameStyle);
      name.anchor.set(0.5);
      name.y = 48;
      btn.addChild(name);

      const badge = new Graphics();
      badge.beginFill(0xef4444);
      badge.drawCircle(24, -24, 12);
      badge.endFill();
      btn.addChild(badge);

      const countStyle = new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fill: '#ffffff',
        fontWeight: 'bold',
      });
      const count = new Text('1', countStyle);
      count.anchor.set(0.5);
      count.x = 24;
      count.y = -24;
      btn.addChild(count);

      if (cfg.key === 'moveOut') this.propMoveOutText = count;
      if (cfg.key === 'undo') this.propUndoText = count;
      if (cfg.key === 'shuffle') this.propShuffleText = count;

      btn.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        platform.playSound('click');
        const store = useYangStore.getState();
        if (store.useYangProp(cfg.key as any)) {
          gameEvents.emit('yang-use-prop', { propType: cfg.key });
        }
      });

      this.bottomHudContainer.addChild(btn);
    });

    parent.addChild(this.topHudContainer);
    parent.addChild(this.bottomHudContainer);
  }

  private buildSettlementUI(parent: Container): void {
    const card = new Container();
    card.x = DESIGN_WIDTH / 2;
    card.y = DESIGN_HEIGHT / 2;

    const bg = new Graphics();
    bg.beginFill(0x0f172a, 0.94);
    bg.lineStyle(3, 0x38bdf8, 0.6);
    bg.drawRoundedRect(-240, -280, 480, 560, 24);
    bg.endFill();
    card.addChild(bg);

    const badgeStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 18,
      fill: '#a3e635',
      fontWeight: 'bold',
    });
    this.settleBadgeText = new Text('🎉 恭喜通过考核', badgeStyle);
    this.settleBadgeText.anchor.set(0.5);
    this.settleBadgeText.y = -200;
    card.addChild(this.settleBadgeText);

    const titleStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 34,
      fill: '#ffffff',
      fontWeight: '900',
    });
    this.settleTitleText = new Text('通关成功！', titleStyle);
    this.settleTitleText.anchor.set(0.5);
    this.settleTitleText.y = -140;
    card.addChild(this.settleTitleText);

    const scoreStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 24,
      fill: '#facc15',
      fontWeight: 'bold',
    });
    this.settleScoreText = new Text('本局得分: 0', scoreStyle);
    this.settleScoreText.anchor.set(0.5);
    this.settleScoreText.y = -70;
    card.addChild(this.settleScoreText);

    // 复活按钮
    this.settleReviveBtn = this.createButton(
      '💊 立即复活 (移出 3 张手牌)',
      0x0284c7,
      0x38bdf8,
      400,
      60,
      () => {
        platform.playSound('powerup');
        useYangStore.getState().setScene('game');
        gameEvents.emit('switch-scene', { scene: 'game' });
        gameEvents.emit('yang-use-prop', { propType: 'revive' });
      }
    );
    this.settleReviveBtn.y = 20;
    card.addChild(this.settleReviveBtn);

    // 重新挑战 / 下一关
    const actionBtn = this.createButton(
      '↻ 重新挑战本关',
      0xb91c1c,
      0xef4444,
      400,
      60,
      () => {
        platform.playSound('click');
        const st = useYangStore.getState();
        const nextLevel = st.isLevelWon ? (st.level === 1 ? 2 : 2) : st.level;
        st.setLevel(nextLevel);
        st.resetYangProps();
        st.setScene('game');
        gameEvents.emit('switch-scene', { scene: 'game', level: nextLevel });
      }
    );
    actionBtn.y = 100;
    card.addChild(actionBtn);

    // 返回菜单
    const menuBtn = this.createButton(
      '返回主菜单',
      0x334155,
      0x94a3b8,
      400,
      52,
      () => {
        platform.playSound('click');
        useYangStore.getState().setScene('menu');
        gameEvents.emit('switch-scene', { scene: 'menu' });
      }
    );
    menuBtn.y = 176;
    card.addChild(menuBtn);

    parent.addChild(card);
  }

  private buildModalSystem(): void {
    const backdrop = new Graphics();
    backdrop.beginFill(0x000000, 0.65);
    backdrop.drawRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    backdrop.endFill();
    backdrop.eventMode = 'static';
    backdrop.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      useYangStore.getState().setActiveModal(null);
    });
    this.modalLayer.addChild(backdrop);

    this.modalCard = new Container();
    this.modalCard.x = DESIGN_WIDTH / 2;
    this.modalCard.y = DESIGN_HEIGHT / 2;

    const bg = new Graphics();
    bg.beginFill(0x0f172a, 0.96);
    bg.lineStyle(2, 0xa3e635, 0.5);
    bg.drawRoundedRect(-250, -280, 500, 560, 24);
    bg.endFill();
    this.modalCard.addChild(bg);

    const titleStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 26,
      fill: '#facc15',
      fontWeight: 'bold',
    });
    this.modalTitleText = new Text('弹窗标题', titleStyle);
    this.modalTitleText.anchor.set(0.5);
    this.modalTitleText.y = -225;
    this.modalCard.addChild(this.modalTitleText);

    // 关闭按钮
    const closeBtn = this.createButton('✕', 0x334155, 0xef4444, 44, 44, () => {
      useYangStore.getState().setActiveModal(null);
    });
    closeBtn.x = 200;
    closeBtn.y = -225;
    this.modalCard.addChild(closeBtn);

    this.shopContent = new Container();
    this.leaderboardContent = new Container();
    this.settingsContent = new Container();

    this.modalCard.addChild(this.shopContent);
    this.modalCard.addChild(this.leaderboardContent);
    this.modalCard.addChild(this.settingsContent);

    this.buildShopModal();
    this.buildLeaderboardModal();
    this.buildSettingsModal();

    this.modalLayer.addChild(this.modalCard);
  }

  private buildShopModal(): void {
    const tipStyle = new TextStyle({ fontSize: 16, fill: '#86efac' });
    const tip = new Text('🪙 每日赠送 100 助战金币', tipStyle);
    tip.anchor.set(0.5);
    tip.y = -160;
    this.shopContent.addChild(tip);

    const buyMoveOut = this.createButton(
      '📦 移出道具 (🪙 30 购买)',
      0x1e293b,
      0xa3e635,
      400,
      56,
      () => {
        const s = useYangStore.getState();
        if (s.coins >= 30) {
          platform.playSound('match');
          s.addCoins(-30);
          useYangStore.setState((prev) => ({
            yangProps: { ...prev.yangProps, moveOut: prev.yangProps.moveOut + 1 },
          }));
        }
      }
    );
    buyMoveOut.y = -80;
    this.shopContent.addChild(buyMoveOut);

    const buyUndo = this.createButton(
      '↩️ 撤回道具 (🪙 25 购买)',
      0x1e293b,
      0x38bdf8,
      400,
      56,
      () => {
        const s = useYangStore.getState();
        if (s.coins >= 25) {
          platform.playSound('match');
          s.addCoins(-25);
          useYangStore.setState((prev) => ({
            yangProps: { ...prev.yangProps, undo: prev.yangProps.undo + 1 },
          }));
        }
      }
    );
    buyUndo.y = -10;
    this.shopContent.addChild(buyUndo);

    const buyShuffle = this.createButton(
      '🔀 洗牌道具 (🪙 40 购买)',
      0x1e293b,
      0xf472b6,
      400,
      56,
      () => {
        const s = useYangStore.getState();
        if (s.coins >= 40) {
          platform.playSound('match');
          s.addCoins(-40);
          useYangStore.setState((prev) => ({
            yangProps: { ...prev.yangProps, shuffle: prev.yangProps.shuffle + 1 },
          }));
        }
      }
    );
    buyShuffle.y = 60;
    this.shopContent.addChild(buyShuffle);
  }

  private buildLeaderboardModal(): void {
    const list = [
      '#1 广东省羊群 · 12,482 只羊 👑',
      '#2 山东省羊群 · 10,920 只羊 🥈',
      '#3 江苏省羊群 · 9,831 只羊 🥉',
      '#4 浙江省羊群 · 8,719 只羊',
      '#5 河南省羊群 · 7,842 只羊',
      '#6 四川省羊群 · 6,950 只羊',
      '#7 北京市羊群 · 6,321 只羊',
    ];

    list.forEach((txt, idx) => {
      const rowStyle = new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fill: idx === 0 ? '#facc15' : '#e2e8f0',
        fontWeight: idx < 3 ? 'bold' : 'normal',
      });
      const row = new Text(txt, rowStyle);
      row.anchor.set(0.5);
      row.y = -150 + idx * 46;
      this.leaderboardContent.addChild(row);
    });
  }

  private buildSettingsModal(): void {
    const bgmToggle = this.createButton(
      '魔性神曲 BGM: 切换开/关',
      0x1e293b,
      0xfacc15,
      400,
      60,
      () => {
        useYangStore.getState().toggleBgm();
      }
    );
    bgmToggle.y = -100;
    this.settingsContent.addChild(bgmToggle);

    const soundToggle = this.createButton(
      '消除音效: 切换开/关',
      0x1e293b,
      0x38bdf8,
      400,
      60,
      () => {
        useYangStore.getState().toggleSound();
      }
    );
    soundToggle.y = -20;
    this.settingsContent.addChild(soundToggle);

    const inspectorToggle = this.createButton(
      '性能面板: 切换显示/隐藏',
      0x1e293b,
      0xa3e635,
      400,
      60,
      () => {
        useYangStore.getState().toggleInspector();
      }
    );
    inspectorToggle.y = 60;
    this.settingsContent.addChild(inspectorToggle);
  }

  private createButton(
    text: string,
    bgColor: number,
    borderColor: number,
    w: number,
    h: number,
    onClick: () => void
  ): CanvasButton {
    return new CanvasButton({
      width: w,
      height: h,
      radius: 14,
      backgroundColor: bgColor,
      borderColor,
      label: text,
      textStyle: { fontSize: 16 },
      onClick,
    });
  }

  public applySafeAreaLayout(): void {
    const { safeTopDesign, safeBottomDesign } = computeSafeAreaDesignOffsets(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.topHudContainer.y = Math.max(16, safeTopDesign);
    this.bottomHudContainer.y = -Math.max(0, safeBottomDesign);
  }

  private subscribeStore(): void {
    this.unsubStore = useYangStore.subscribe((state) => {
      // 场景状态更新
      this.menuScoreText.text = `最高积分: ${state.highScore}`;
      this.hudLevelText.text = `第 ${state.level} 关`;
      this.hudScoreText.text = `得分: ${state.score}`;

      this.propMoveOutText.text = String(state.yangProps.moveOut);
      this.propUndoText.text = String(state.yangProps.undo);
      this.propShuffleText.text = String(state.yangProps.shuffle);

      this.settleScoreText.text = `本局得分: ${state.score}`;
      if (state.isLevelWon) {
        this.settleBadgeText.text = state.level === 1 ? '🎉 新手入群考核通过' : '👑 恭喜加入羊群！';
        this.settleTitleText.text = state.level === 1 ? '第 1 关 通过！' : '加冕领头羊！';
        this.settleReviveBtn.visible = false;
      } else {
        this.settleBadgeText.text = '💥 卡槽已满 · 挑战失败';
        this.settleTitleText.text = '未能加入羊群！';
        this.settleReviveBtn.visible = true;
      }

      // 模态弹窗切换
      if (state.activeModal !== this.lastOpenModal) {
        this.lastOpenModal = state.activeModal;
        this.modalLayer.visible = state.activeModal !== null;
        this.shopContent.visible = state.activeModal === 'shop';
        this.leaderboardContent.visible = state.activeModal === 'leaderboard';
        this.settingsContent.visible = state.activeModal === 'settings';

        if (state.activeModal === 'shop') this.modalTitleText.text = '🛒 道具商城';
        if (state.activeModal === 'leaderboard') this.modalTitleText.text = '🏆 今日全国羊群榜';
        if (state.activeModal === 'settings') this.modalTitleText.text = '⚙️ 游戏设置';
      }
    });
  }

  public destroy(): void {
    if (this.unsubStore) this.unsubStore();
    this.modalLayer.destroy({ children: true });
  }
}
