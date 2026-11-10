import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gameEvents, platform } from 'alloy2d';
import { yangAssetManager } from '../assets/YangAssetManager';
import { CARD_HEIGHT, CARD_WIDTH, YangCard } from '../entities/YangCard';
import { YangEffectManager } from '../entities/YangEffectManager';
import { useYangStore, yangStateSync } from '../store/useYangStore';

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;
export const MAX_SLOTS = 7;

interface MoveHistory {
  card: YangCard;
  prevLayer: number;
  prevX: number;
  prevY: number;
  fromHeld: boolean;
}

/**
 * 《羊了个羊》核心玩法与规则系统
 * 基于 alloy2d 构建
 */
export class YangGameSystem {
  public readonly rootContainer: Container;
  public readonly effects: YangEffectManager;

  private bgContainer: Container;
  private cardsContainer: Container;
  private heldContainer: Container;
  private slotContainer: Container;

  private cards: YangCard[] = [];
  private slotCards: YangCard[] = [];
  private heldCards: YangCard[] = [];
  private history: MoveHistory[] = [];

  private isProcessing = false;
  private unsubscribers: Array<() => void> = [];

  private readonly slotStartX: number;
  private readonly slotY = 1040;
  private readonly slotSpacing = 6;

  private readonly heldStartX: number;
  private readonly heldY = 918;

  constructor() {
    this.rootContainer = new Container();
    this.bgContainer = new Container();
    this.cardsContainer = new Container();
    this.heldContainer = new Container();
    this.slotContainer = new Container();
    this.effects = new YangEffectManager();

    const totalSlotW = MAX_SLOTS * CARD_WIDTH + (MAX_SLOTS - 1) * this.slotSpacing;
    this.slotStartX = (DESIGN_WIDTH - totalSlotW) / 2 + CARD_WIDTH / 2;

    const totalHeldW = 3 * CARD_WIDTH + 2 * this.slotSpacing;
    this.heldStartX = (DESIGN_WIDTH - totalHeldW) / 2 + CARD_WIDTH / 2;

    this.rootContainer.addChild(this.bgContainer);
    this.rootContainer.addChild(this.cardsContainer);
    this.rootContainer.addChild(this.heldContainer);
    this.rootContainer.addChild(this.slotContainer);
    this.rootContainer.addChild(this.effects.particleContainer);
    this.rootContainer.addChild(this.effects.textContainer);

    this.createMeadowBackground();
    this.createSlotTrayGraphics();
    this.createHeldTrayGraphics();

    this.bindEvents();
  }

  private createMeadowBackground(): void {
    const bg = new Graphics();

    bg.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    bg.fill({ color: 0x84cc16, alpha: 0.98 });

    bg.rect(0, 800, DESIGN_WIDTH, 534);
    bg.fill({ color: 0x65a30d, alpha: 0.45 });

    const fenceY = 240;
    bg.moveTo(20, fenceY);
    bg.lineTo(DESIGN_WIDTH - 20, fenceY);
    bg.moveTo(20, fenceY + 36);
    bg.lineTo(DESIGN_WIDTH - 20, fenceY + 36);
    bg.stroke({ width: 6, color: 0x78350f, alpha: 0.65 });

    for (let x = 40; x < DESIGN_WIDTH - 20; x += 60) {
      bg.moveTo(x, fenceY - 18);
      bg.lineTo(x, fenceY + 54);
      bg.stroke({ width: 8, color: 0x92400e, alpha: 0.7 });
    }

    bg.circle(120, 150, 40);
    bg.circle(160, 140, 50);
    bg.circle(200, 150, 36);

    bg.circle(540, 120, 35);
    bg.circle(580, 110, 45);
    bg.circle(620, 120, 32);
    bg.fill({ color: 0xffffff, alpha: 0.35 });

    bg.cacheAsBitmap = true;
    this.bgContainer.addChild(bg);
  }

  private createSlotTrayGraphics(): void {
    const totalSlotW = MAX_SLOTS * CARD_WIDTH + (MAX_SLOTS - 1) * this.slotSpacing;
    const tray = new Graphics();

    tray.roundRect(
      this.slotStartX - CARD_WIDTH / 2 - 14,
      this.slotY - CARD_HEIGHT / 2 - 10 + 6,
      totalSlotW + 28,
      CARD_HEIGHT + 20,
      18
    );
    tray.fill({ color: 0x451a03, alpha: 0.85 });

    tray.roundRect(
      this.slotStartX - CARD_WIDTH / 2 - 14,
      this.slotY - CARD_HEIGHT / 2 - 10,
      totalSlotW + 28,
      CARD_HEIGHT + 20,
      18
    );
    tray.fill({ color: 0x78350f, alpha: 0.95 });
    tray.stroke({ width: 4, color: 0xb45309, alpha: 0.9 });

    for (let i = 0; i < MAX_SLOTS; i++) {
      const sx = this.slotStartX + i * (CARD_WIDTH + this.slotSpacing);
      tray.roundRect(
        sx - CARD_WIDTH / 2,
        this.slotY - CARD_HEIGHT / 2,
        CARD_WIDTH,
        CARD_HEIGHT,
        10
      );
      tray.fill({ color: 0x291404, alpha: 0.4 });
      tray.stroke({ width: 2, color: 0x451a03, alpha: 0.6 });
    }

    tray.cacheAsBitmap = true;
    this.slotContainer.addChild(tray);
  }

  private createHeldTrayGraphics(): void {
    const totalHeldW = 3 * CARD_WIDTH + 2 * this.slotSpacing;
    const tray = new Graphics();

    tray.roundRect(
      this.heldStartX - CARD_WIDTH / 2 - 8,
      this.heldY - CARD_HEIGHT / 2 - 6,
      totalHeldW + 16,
      CARD_HEIGHT + 12,
      14
    );
    tray.fill({ color: 0x3f6212, alpha: 0.55 });
    tray.stroke({ width: 2, color: 0xa3e635, alpha: 0.5 });

    for (let i = 0; i < 3; i++) {
      const hx = this.heldStartX + i * (CARD_WIDTH + this.slotSpacing);
      tray.roundRect(
        hx - CARD_WIDTH / 2,
        this.heldY - CARD_HEIGHT / 2,
        CARD_WIDTH,
        CARD_HEIGHT,
        8
      );
      tray.fill({ color: 0x1a2e05, alpha: 0.35 });
      tray.stroke({ width: 1.5, color: 0x4d7c0f, alpha: 0.7 });
    }

    const tipStyle = new TextStyle({
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16,
      fill: '#f7fee7',
      fontWeight: 'bold',
      dropShadow: {
        color: '#000000',
        blur: 2,
      },
    });
    const tipText = new Text('移出暂存区', tipStyle);
    tipText.anchor.set(0.5);
    tipText.x = DESIGN_WIDTH / 2;
    tipText.y = this.heldY - CARD_HEIGHT / 2 - 16;
    tray.addChild(tipText);

    tray.cacheAsBitmap = true;
    this.heldContainer.addChild(tray);
  }

  private bindEvents(): void {
    const unsubClick = gameEvents.on<{ card: YangCard }>('yang-card-clicked', ({ card }) => {
      this.handleCardClick(card);
    });
    this.unsubscribers.push(unsubClick);

    const unsubProp = gameEvents.on<{ propType: 'moveOut' | 'undo' | 'shuffle' | 'revive' }>(
      'yang-use-prop',
      ({ propType }) => {
        this.handleUseProp(propType);
      }
    );
    this.unsubscribers.push(unsubProp);

    const unsubRestart = gameEvents.on<{ level?: number }>('yang-restart-level', ({ level }) => {
      this.initLevel(level || 1);
    });
    this.unsubscribers.push(unsubRestart);
  }

  public initLevel(level = 1): void {
    this.clearAllCards();
    this.history = [];
    this.isProcessing = false;

    if (level === 1) {
      this.buildLevel1();
    } else {
      this.buildLevel2();
    }

    this.checkCoverage();
    this.syncGameState(level);
  }

  private clearAllCards(): void {
    this.cards.forEach((c) => c.container.destroy({ children: true }));
    this.cards = [];

    this.slotCards.forEach((c) => c.container.destroy({ children: true }));
    this.slotCards = [];

    this.heldCards.forEach((c) => c.container.destroy({ children: true }));
    this.heldCards = [];
  }

  private buildLevel1(): void {
    const typesCount = 3;
    const sets = 7;
    const totalCards = sets * 3;

    const typesPool: number[] = [];
    for (let i = 0; i < sets; i++) {
      typesPool.push(i % typesCount);
      typesPool.push(i % typesCount);
      typesPool.push(i % typesCount);
    }
    this.shuffleArray(typesPool);

    const centerX = DESIGN_WIDTH / 2;
    const centerY = 560;
    let cardIdx = 0;

    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX + c * (CARD_WIDTH + 14);
        const y = centerY + r * (CARD_HEIGHT + 14);
        this.createCard(typesPool[cardIdx++], 0, x, y);
      }
    }

    for (let r = 0; r <= 1; r++) {
      for (let c = 0; c <= 1; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX - (CARD_WIDTH + 14) / 2 + c * (CARD_WIDTH + 14);
        const y = centerY - (CARD_HEIGHT + 14) / 2 + r * (CARD_HEIGHT + 14);
        this.createCard(typesPool[cardIdx++], 1, x, y);
      }
    }

    const topPositions = [
      { x: centerX, y: centerY },
      { x: centerX - (CARD_WIDTH + 14), y: centerY },
      { x: centerX + (CARD_WIDTH + 14), y: centerY },
      { x: centerX, y: centerY - (CARD_HEIGHT + 14) },
      { x: centerX, y: centerY + (CARD_HEIGHT + 14) },
    ];
    for (const pos of topPositions) {
      if (cardIdx >= totalCards) break;
      this.createCard(typesPool[cardIdx++], 2, pos.x, pos.y);
    }

    while (cardIdx < totalCards) {
      this.createCard(typesPool[cardIdx++], 3, centerX, centerY);
    }

    this.sortCardsByLayer();
  }

  private buildLevel2(): void {
    const typesCount = 14;
    const sets = 38;
    const totalCards = sets * 3;

    const typesPool: number[] = [];
    for (let i = 0; i < sets; i++) {
      const t = i % typesCount;
      typesPool.push(t, t, t);
    }
    this.shuffleArray(typesPool);

    const centerX = DESIGN_WIDTH / 2;
    const centerY = 520;
    let cardIdx = 0;

    const leftBaseX = 130;
    const leftBaseY = 740;
    for (let i = 0; i < 16; i++) {
      if (cardIdx >= totalCards) break;
      this.createCard(typesPool[cardIdx++], i, leftBaseX, leftBaseY + (i % 4) * 6);
    }

    const rightBaseX = DESIGN_WIDTH - 130;
    const rightBaseY = 740;
    for (let i = 0; i < 16; i++) {
      if (cardIdx >= totalCards) break;
      this.createCard(typesPool[cardIdx++], i, rightBaseX, rightBaseY + (i % 4) * 6);
    }

    for (let r = -2.5; r <= 2.5; r++) {
      for (let c = -2.5; c <= 2.5; c++) {
        if (cardIdx >= totalCards) break;
        if (Math.abs(r) + Math.abs(c) <= 4) {
          const x = centerX + c * (CARD_WIDTH * 0.76);
          const y = centerY + r * (CARD_HEIGHT * 0.76);
          this.createCard(typesPool[cardIdx++], 0, x, y);
        }
      }
    }

    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX + c * (CARD_WIDTH * 0.72) + 12;
        const y = centerY + r * (CARD_HEIGHT * 0.72) + 12;
        this.createCard(typesPool[cardIdx++], 1, x, y);
      }
    }

    for (let r = -1.5; r <= 1.5; r++) {
      for (let c = -1.5; c <= 1.5; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX + c * (CARD_WIDTH * 0.68) - 10;
        const y = centerY + r * (CARD_HEIGHT * 0.68) - 10;
        this.createCard(typesPool[cardIdx++], 2, x, y);
      }
    }

    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX + c * (CARD_WIDTH * 0.62) + 6;
        const y = centerY + r * (CARD_HEIGHT * 0.62) + 6;
        this.createCard(typesPool[cardIdx++], 3, x, y);
      }
    }

    for (let r = 0; r <= 1; r++) {
      for (let c = 0; c <= 1; c++) {
        if (cardIdx >= totalCards) break;
        const x = centerX - (CARD_WIDTH * 0.5) / 2 + c * (CARD_WIDTH * 0.5);
        const y = centerY - (CARD_HEIGHT * 0.5) / 2 + r * (CARD_HEIGHT * 0.5);
        this.createCard(typesPool[cardIdx++], 4, x, y);
      }
    }

    while (cardIdx < totalCards) {
      this.createCard(typesPool[cardIdx++], 5 + (cardIdx % 3), centerX + (Math.random() - 0.5) * 40, centerY + (Math.random() - 0.5) * 40);
    }

    this.sortCardsByLayer();
  }

  private createCard(type: number, layer: number, x: number, y: number): YangCard {
    const id = `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tex = yangAssetManager.getTileTexture(type);
    const card = new YangCard(id, type, layer, x, y, tex);

    this.cards.push(card);
    this.cardsContainer.addChild(card.container);
    return card;
  }

  private sortCardsByLayer(): void {
    this.cards.sort((a, b) => a.layer - b.layer);
    this.cards.forEach((c) => {
      this.cardsContainer.addChild(c.container);
    });
  }

  public checkCoverage(): void {
    const margin = 8;
    for (let i = 0; i < this.cards.length; i++) {
      const a = this.cards[i];
      let covered = false;

      for (let j = 0; j < this.cards.length; j++) {
        const b = this.cards[j];
        if (b.layer > a.layer) {
          const overlapX = Math.abs(b.x - a.x) < CARD_WIDTH - margin;
          const overlapY = Math.abs(b.y - a.y) < CARD_HEIGHT - margin;
          if (overlapX && overlapY) {
            covered = true;
            break;
          }
        }
      }

      a.setCovered(covered);
    }
  }

  private async handleCardClick(card: YangCard): Promise<void> {
    if (this.isProcessing) return;

    if (card.isCovered) {
      platform.playSound('click');
      await card.shakeForbidden();
      return;
    }

    if (this.slotCards.length >= MAX_SLOTS) {
      return;
    }

    this.isProcessing = true;
    platform.playSound('click');

    const fromHeld = this.heldCards.includes(card);
    this.history.push({
      card,
      prevLayer: card.layer,
      prevX: card.x,
      prevY: card.y,
      fromHeld,
    });

    if (fromHeld) {
      const hIdx = this.heldCards.indexOf(card);
      if (hIdx >= 0) this.heldCards.splice(hIdx, 1);
      this.rearrangeHeldCards();
    } else {
      const cIdx = this.cards.indexOf(card);
      if (cIdx >= 0) this.cards.splice(cIdx, 1);
      this.checkCoverage();
    }

    this.slotContainer.addChild(card.container);

    let insertIndex = this.slotCards.length;
    let foundSame = false;
    for (let i = this.slotCards.length - 1; i >= 0; i--) {
      if (this.slotCards[i].type === card.type) {
        insertIndex = i + 1;
        foundSame = true;
        break;
      }
    }

    if (foundSame) {
      this.slotCards.splice(insertIndex, 0, card);
    } else {
      this.slotCards.push(card);
    }

    await this.rearrangeSlotCards();
    await this.checkSlotMatch();

    this.isProcessing = false;
    this.syncGameState();
  }

  private async rearrangeSlotCards(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.slotCards.length; i++) {
      const c = this.slotCards[i];
      const targetX = this.slotStartX + i * (CARD_WIDTH + this.slotSpacing);
      promises.push(c.flyToSlot(targetX, this.slotY, 200));
    }
    await Promise.all(promises);
  }

  private async rearrangeHeldCards(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.heldCards.length; i++) {
      const c = this.heldCards[i];
      const targetX = this.heldStartX + i * (CARD_WIDTH + this.slotSpacing);
      promises.push(c.moveTo(targetX, this.heldY, 180));
    }
    await Promise.all(promises);
  }

  private async checkSlotMatch(): Promise<void> {
    const counts: { [type: number]: YangCard[] } = {};
    for (const card of this.slotCards) {
      if (!counts[card.type]) counts[card.type] = [];
      counts[card.type].push(card);
    }

    let hasMatch = false;
    for (const typeStr in counts) {
      const matched = counts[typeStr];
      if (matched.length >= 3) {
        hasMatch = true;
        const tri = matched.slice(0, 3);

        platform.playSound('match');

        const midCard = tri[1];
        this.effects.spawnTileExplosion(midCard.x, midCard.y, Number(typeStr), 14);
        this.effects.spawnFloatingText(midCard.x, midCard.y - 40, '+300 消除！');

        for (const c of tri) {
          const idx = this.slotCards.indexOf(c);
          if (idx >= 0) this.slotCards.splice(idx, 1);
        }

        await Promise.all(tri.map((c) => c.eliminate()));
        break;
      }
    }

    if (hasMatch) {
      await this.rearrangeSlotCards();

      const currentScore = useYangStore.getState().score;
      yangStateSync.state.score = currentScore + 300;
      yangStateSync.markDirty('score');

      if (this.cards.length === 0 && this.slotCards.length === 0 && this.heldCards.length === 0) {
        platform.playSound('win');
        yangStateSync.state.isLevelWon = true;
        yangStateSync.state.scene = 'settlement';
        yangStateSync.markDirty('isLevelWon');
        yangStateSync.markDirty('scene');
        yangStateSync.flushDirty();
        return;
      }

      await this.checkSlotMatch();
      return;
    }

    if (this.slotCards.length >= MAX_SLOTS) {
      platform.playSound('lose');
      yangStateSync.state.isLevelWon = false;
      yangStateSync.state.scene = 'settlement';
      yangStateSync.markDirty('isLevelWon');
      yangStateSync.markDirty('scene');
      yangStateSync.flushDirty();
    }
  }

  public async handleUseProp(propType: 'moveOut' | 'undo' | 'shuffle' | 'revive'): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    platform.playSound('powerup');

    switch (propType) {
      case 'moveOut':
      case 'revive': {
        const numToMove = Math.min(3, this.slotCards.length);
        if (numToMove > 0) {
          const toMove = this.slotCards.splice(0, numToMove);
          for (const c of toMove) {
            this.heldContainer.addChild(c.container);
            this.heldCards.push(c);
          }
          await Promise.all([this.rearrangeSlotCards(), this.rearrangeHeldCards()]);
          this.effects.spawnFloatingText(DESIGN_WIDTH / 2, this.heldY, '已移出 3 张手牌！');
        }
        break;
      }
      case 'undo': {
        const lastAction = this.history.pop();
        if (lastAction) {
          const { card, prevLayer, prevX, prevY, fromHeld } = lastAction;
          const sIdx = this.slotCards.indexOf(card);
          if (sIdx >= 0) {
            this.slotCards.splice(sIdx, 1);
            await this.rearrangeSlotCards();

            card.layer = prevLayer;
            if (fromHeld) {
              this.heldContainer.addChild(card.container);
              this.heldCards.push(card);
              await this.rearrangeHeldCards();
            } else {
              this.cardsContainer.addChild(card.container);
              this.cards.push(card);
              await card.moveTo(prevX, prevY, 200);
              this.checkCoverage();
            }
            this.effects.spawnFloatingText(DESIGN_WIDTH / 2, 700, '撤回成功！');
          }
        }
        break;
      }
      case 'shuffle': {
        if (this.cards.length > 0) {
          const currentTypes = this.cards.map((c) => c.type);
          this.shuffleArray(currentTypes);

          for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            const newType = currentTypes[i];
            const tex = yangAssetManager.getTileTexture(newType);
            c.cardSprite.texture = tex;
            (c as { type: number }).type = newType;
          }

          this.effects.spawnFloatingText(DESIGN_WIDTH / 2, 540, '洗牌完成！');
        }
        break;
      }
    }

    this.isProcessing = false;
    this.syncGameState();
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private syncGameState(level?: number): void {
    const curLevel = level !== undefined ? level : useYangStore.getState().level;
    yangStateSync.state.level = curLevel;
    yangStateSync.markDirty('level');
    yangStateSync.flushDirty();

    useYangStore.getState().updateTelemetry({
      drawCalls: 6,
      fps: 60,
    });
  }

  public update(delta: number): void {
    this.effects.update(delta);
  }

  public destroy(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
    this.clearAllCards();
    this.rootContainer.destroy({ children: true });
  }
}
