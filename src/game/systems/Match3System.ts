import { Container, Graphics, Sprite } from 'pixi.js';
import { platform } from '../../platform/PlatformAdapter';
import { useGameStore } from '../../store/useGameStore';
import { assetManager, TILE_TYPES_COUNT } from '../assets/AssetManager';
import { gameEvents } from '../core/EventBus';
import { stateSync } from '../core/StateSync';
import { EffectManager } from '../entities/EffectManager';
import { BOARD_COLS, BOARD_ROWS, Tile, TILE_SIZE } from '../entities/Tile';

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

/**
 * 三消核心玩法与关卡系统 (对应文章 3.2 节 systems/ 与 6.3 节渲染批次合并、cacheAsBitmap 静态缓存)
 */
export class Match3System {
  public readonly rootContainer: Container;
  private boardContainer: Container;
  private tilesContainer: Container;
  private selectionSprite: Sprite | null = null;
  public readonly effects: EffectManager;

  private grid: (Tile | null)[][] = [];
  private selectedTile: { row: number; col: number } | null = null;
  private isProcessing = false;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this.rootContainer = new Container();
    this.boardContainer = new Container();
    this.tilesContainer = new Container();
    this.effects = new EffectManager();

    // 棋盘在 750x1334 设计分辨率下居中偏下排布
    const boardPixelW = BOARD_COLS * TILE_SIZE;
    const boardPixelH = BOARD_ROWS * TILE_SIZE;
    this.boardContainer.x = (DESIGN_WIDTH - boardPixelW) / 2;
    this.boardContainer.y = 330;

    // 1. 静态棋盘网格底座：使用 Graphics 绘制并开启 cacheAsBitmap = true (对应文章 6.3 节)
    const boardBg = this.createCachedBoardBackground(boardPixelW, boardPixelH);
    this.boardContainer.addChild(boardBg);

    // 2. 同图集精灵层连续排布，保证 WebGL Batching 不被打断 (对应文章 6.3 节)
    this.boardContainer.addChild(this.tilesContainer);
    this.boardContainer.addChild(this.effects.particleContainer);
    this.boardContainer.addChild(this.effects.textContainer);

    this.rootContainer.addChild(this.boardContainer);

    this.initSelectionSprite();
    this.bindEvents();
  }

  /**
   * 创建静态棋盘背景并开启 cacheAsBitmap = true 缓存为纹理 (对应文章 6.3 节代码范式)
   */
  private createCachedBoardBackground(width: number, height: number): Graphics {
    const graphics = new Graphics();

    // 外框底板
    graphics.beginFill(0x0f172a, 0.88);
    graphics.lineStyle(4, 0x38bdf8, 0.45);
    graphics.drawRoundedRect(-14, -14, width + 28, height + 28, 26);
    graphics.endFill();

    // 棋盘交替格纹
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const isEven = (r + c) % 2 === 0;
        graphics.beginFill(isEven ? 0x1e293b : 0x172033, 0.92);
        graphics.drawRoundedRect(
          c * TILE_SIZE + 3,
          r * TILE_SIZE + 3,
          TILE_SIZE - 6,
          TILE_SIZE - 6,
          14
        );
        graphics.endFill();
      }
    }

    // 关键优化：静态 Graphics 开启位图缓存，避免每帧重新生成几何数据
    graphics.cacheAsBitmap = true;
    return graphics;
  }

  private initSelectionSprite(): void {
    const tex = assetManager.get('tile_select');
    if (tex) {
      this.selectionSprite = new Sprite(tex);
      this.selectionSprite.anchor.set(0.5);
      this.selectionSprite.width = TILE_SIZE + 2;
      this.selectionSprite.height = TILE_SIZE + 2;
      this.selectionSprite.visible = false;
      this.tilesContainer.addChild(this.selectionSprite);
    }
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      gameEvents.on<{ row: number; col: number }>('tile-clicked', (pos) => {
        this.onTileClicked(pos.row, pos.col);
      }),
      gameEvents.on<{ fromRow: number; fromCol: number; toRow: number; toCol: number }>(
        'tile-swipe',
        (data) => {
          this.onTileSwipe(data.fromRow, data.fromCol, data.toRow, data.toCol);
        }
      ),
      gameEvents.on<{ level?: number }>('start-level', (data) => {
        const targetLevel = data?.level ?? stateSync.state.level;
        this.startLevel(targetLevel);
      }),
      gameEvents.on('item-shuffle', () => {
        this.useShuffleItem();
      }),
      gameEvents.on('item-extra-moves', () => {
        this.useExtraMovesItem();
      })
    );
  }

  /**
   * 初始化指定关卡
   */
  public startLevel(level: number): void {
    this.isProcessing = false;
    this.clearSelection();

    const targetScore = 900 + (level - 1) * 450;
    const movesLeft = Math.max(14, 22 - Math.floor((level - 1) / 2));

    stateSync.state.level = level;
    stateSync.state.score = 0;
    stateSync.state.targetScore = targetScore;
    stateSync.state.movesLeft = movesLeft;
    stateSync.state.combo = 0;

    stateSync.markDirty('level');
    stateSync.markDirty('score');
    stateSync.markDirty('targetScore');
    stateSync.markDirty('movesLeft');
    stateSync.markDirty('combo');

    this.buildInitialBoard();
  }

  private buildInitialBoard(): void {
    // 清理旧棋子
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < (this.grid[r]?.length || 0); c++) {
        this.grid[r][c]?.destroy();
      }
    }

    this.grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        let type = Math.floor(Math.random() * TILE_TYPES_COUNT);
        // 避免初始棋盘直接出现三连
        while (
          (c >= 2 &&
            this.grid[r][c - 1]?.type === type &&
            this.grid[r][c - 2]?.type === type) ||
          (r >= 2 &&
            this.grid[r - 1][c]?.type === type &&
            this.grid[r - 2][c]?.type === type)
        ) {
          type = (type + 1) % TILE_TYPES_COUNT;
        }

        const tile = new Tile(assetManager.getTileTexture(type), r, c, type);
        this.grid[r][c] = tile;
        this.tilesContainer.addChild(tile.sprite);
        tile.playSpawnAnimation();
      }
    }

    // 确保选中框保持在最上层
    if (this.selectionSprite) {
      this.tilesContainer.setChildIndex(
        this.selectionSprite,
        this.tilesContainer.children.length - 1
      );
    }
  }

  private selectTile(row: number, col: number): void {
    this.selectedTile = { row, col };
    if (this.selectionSprite) {
      this.selectionSprite.x = col * TILE_SIZE + TILE_SIZE / 2;
      this.selectionSprite.y = row * TILE_SIZE + TILE_SIZE / 2;
      this.selectionSprite.visible = true;
      this.tilesContainer.setChildIndex(
        this.selectionSprite,
        this.tilesContainer.children.length - 1
      );
    }
  }

  private clearSelection(): void {
    this.selectedTile = null;
    if (this.selectionSprite) {
      this.selectionSprite.visible = false;
    }
  }

  private async onTileClicked(row: number, col: number): Promise<void> {
    if (this.isProcessing) return;
    const clicked = this.grid[row]?.[col];
    if (!clicked) return;

    // 检查是否处于神锤道具模式
    const store = useGameStore.getState();
    if (store.activeItemMode === 'hammer') {
      if (store.consumeItem('hammer')) {
        store.setActiveItemMode(null);
        await this.executeHammerStrike(row, col);
      }
      return;
    }

    platform.playSound('click');

    if (!this.selectedTile) {
      this.selectTile(row, col);
      return;
    }

    if (this.selectedTile.row === row && this.selectedTile.col === col) {
      this.clearSelection();
      return;
    }

    const dr = Math.abs(this.selectedTile.row - row);
    const dc = Math.abs(this.selectedTile.col - col);

    if (dr + dc === 1) {
      const from = { ...this.selectedTile };
      this.clearSelection();
      await this.trySwap(from.row, from.col, row, col);
    } else {
      this.selectTile(row, col);
    }
  }

  private async onTileSwipe(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number
  ): Promise<void> {
    if (this.isProcessing) return;
    if (toRow < 0 || toRow >= BOARD_ROWS || toCol < 0 || toCol >= BOARD_COLS) return;
    if (useGameStore.getState().activeItemMode === 'hammer') return;

    this.clearSelection();
    await this.trySwap(fromRow, fromCol, toRow, toCol);
  }

  private async trySwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
    const tileA = this.grid[r1]?.[c1];
    const tileB = this.grid[r2]?.[c2];
    if (!tileA || !tileB) return;

    this.isProcessing = true;
    platform.playSound('swap');

    // 交换引用与移动动画
    this.grid[r1][c1] = tileB;
    this.grid[r2][c2] = tileA;
    await Promise.all([tileA.moveTo(r2, c2, 165), tileB.moveTo(r1, c1, 165)]);

    const matches = this.findMatches();
    if (matches.length === 0) {
      // 无消除：回退交换
      platform.playSound('invalid');
      this.grid[r1][c1] = tileA;
      this.grid[r2][c2] = tileB;
      await Promise.all([tileA.moveTo(r1, c1, 165), tileB.moveTo(r2, c2, 165)]);
      this.isProcessing = false;
      return;
    }

    // 有效交换：扣减步数（使用脏标记在帧末同步）
    stateSync.state.movesLeft = Math.max(0, stateSync.state.movesLeft - 1);
    stateSync.state.combo = 0;
    stateSync.markDirty('movesLeft');
    stateSync.markDirty('combo');

    await this.resolveCascades(matches);
    this.checkEndCondition();
    this.isProcessing = false;
  }

  /**
   * 递归处理连锁消除、重力下落与新棋子补充
   */
  private async resolveCascades(initialMatches: Array<{ row: number; col: number }>): Promise<void> {
    let currentMatches = initialMatches;
    let cascadeStep = 0;

    while (currentMatches.length > 0) {
      cascadeStep++;
      stateSync.state.combo = cascadeStep;
      stateSync.markDirty('combo');

      if (cascadeStep === 1) {
        platform.playSound('match');
      } else {
        platform.playSound('combo');
      }

      // 计算本次消除每个棋子得分，演示同一帧内多次修改状态但仅触发一次帧末脏标记同步 (文章 4.4 节)
      const basePoints = 30 * cascadeStep;
      let centerSumX = 0;
      let centerSumY = 0;

      const elimPromises: Promise<void>[] = [];

      for (const pos of currentMatches) {
        const tile = this.grid[pos.row][pos.col];
        if (!tile) continue;

        const px = pos.col * TILE_SIZE + TILE_SIZE / 2;
        const py = pos.row * TILE_SIZE + TILE_SIZE / 2;
        centerSumX += px;
        centerSumY += py;

        // 每个消除的棋子单独累加分数并打脏标记（一帧内变多次，React 只在帧末收到一次更新）
        stateSync.state.score += basePoints;
        stateSync.markDirty('score');

        // 触发对象池粒子爆炸
        this.effects.spawnTileExplosion(px, py, tile.type, 7);

        this.grid[pos.row][pos.col] = null;
        elimPromises.push(
          tile.playEliminateAnimation().then(() => {
            tile.destroy();
          })
        );
      }

      // 奖励金币
      const earnedCoins = Math.max(1, Math.floor(currentMatches.length * cascadeStep * 0.8));
      stateSync.state.coinsDelta += earnedCoins;
      stateSync.markDirty('coins');

      // 浮动得分与连击飘字（复用对象池）
      const avgX = centerSumX / currentMatches.length;
      const avgY = centerSumY / currentMatches.length;
      const totalGain = basePoints * currentMatches.length;
      const label =
        cascadeStep > 1 ? `Combo x${cascadeStep}! +${totalGain}` : `+${totalGain}`;
      this.effects.spawnFloatingText(avgX, avgY, label);

      await Promise.all(elimPromises);

      // 重力下落与顶部生成新棋子
      await this.applyGravityAndRefill();

      currentMatches = this.findMatches();
    }

    // 检查是否陷入死局，若无解则自动洗牌
    if (!this.hasPossibleMoves()) {
      this.effects.spawnFloatingText(
        (BOARD_COLS * TILE_SIZE) / 2,
        (BOARD_ROWS * TILE_SIZE) / 2,
        '无可用步数，自动重排!'
      );
      await this.shuffleBoardInternal();
    }
  }

  /**
   * 扫描棋盘上的横向与纵向 >= 3 连消
   */
  private findMatches(): Array<{ row: number; col: number }> {
    const matched = new Set<string>();

    // 横向扫描
    for (let r = 0; r < BOARD_ROWS; r++) {
      let matchLen = 1;
      for (let c = 1; c <= BOARD_COLS; c++) {
        const prev = this.grid[r][c - 1];
        const curr = c < BOARD_COLS ? this.grid[r][c] : null;
        if (prev && curr && prev.type === curr.type) {
          matchLen++;
        } else {
          if (matchLen >= 3) {
            for (let k = c - matchLen; k < c; k++) {
              matched.add(`${r},${k}`);
            }
          }
          matchLen = 1;
        }
      }
    }

    // 纵向扫描
    for (let c = 0; c < BOARD_COLS; c++) {
      let matchLen = 1;
      for (let r = 1; r <= BOARD_ROWS; r++) {
        const prev = this.grid[r - 1][c];
        const curr = r < BOARD_ROWS ? this.grid[r][c] : null;
        if (prev && curr && prev.type === curr.type) {
          matchLen++;
        } else {
          if (matchLen >= 3) {
            for (let k = r - matchLen; k < r; k++) {
              matched.add(`${k},${c}`);
            }
          }
          matchLen = 1;
        }
      }
    }

    return Array.from(matched).map((key) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }

  private async applyGravityAndRefill(): Promise<void> {
    const movePromises: Promise<void>[] = [];

    for (let c = 0; c < BOARD_COLS; c++) {
      let emptyRow = BOARD_ROWS - 1;

      // 现有棋子下落
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        const tile = this.grid[r][c];
        if (tile) {
          if (r !== emptyRow) {
            this.grid[emptyRow][c] = tile;
            this.grid[r][c] = null;
            movePromises.push(tile.moveTo(emptyRow, c, 175));
          }
          emptyRow--;
        }
      }

      // 顶部补充新棋子
      let spawnOffset = 1;
      for (let r = emptyRow; r >= 0; r--) {
        const type = Math.floor(Math.random() * TILE_TYPES_COUNT);
        const tile = new Tile(assetManager.getTileTexture(type), r, c, type);
        tile.sprite.y = -spawnOffset * TILE_SIZE + TILE_SIZE / 2;
        spawnOffset++;

        this.grid[r][c] = tile;
        this.tilesContainer.addChild(tile.sprite);
        movePromises.push(tile.moveTo(r, c, 210));
      }
    }

    if (this.selectionSprite) {
      this.tilesContainer.setChildIndex(
        this.selectionSprite,
        this.tilesContainer.children.length - 1
      );
    }

    await Promise.all(movePromises);
  }

  /**
   * 检测当前棋盘是否至少存在一步合法消除
   */
  private hasPossibleMoves(): boolean {
    const swapAndCheck = (r1: number, c1: number, r2: number, c2: number): boolean => {
      const t1 = this.grid[r1][c1];
      const t2 = this.grid[r2][c2];
      if (!t1 || !t2) return false;
      this.grid[r1][c1] = t2;
      this.grid[r2][c2] = t1;
      const hasMatch = this.findMatches().length > 0;
      this.grid[r1][c1] = t1;
      this.grid[r2][c2] = t2;
      return hasMatch;
    };

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c + 1 < BOARD_COLS && swapAndCheck(r, c, r, c + 1)) return true;
        if (r + 1 < BOARD_ROWS && swapAndCheck(r, c, r + 1, c)) return true;
      }
    }
    return false;
  }

  /**
   * 道具 1：神锤爆破 (消除 3x3 区域)
   */
  private async executeHammerStrike(centerRow: number, centerCol: number): Promise<void> {
    this.isProcessing = true;
    this.clearSelection();
    platform.playSound('powerup');

    const targets: Array<{ row: number; col: number }> = [];
    for (let r = Math.max(0, centerRow - 1); r <= Math.min(BOARD_ROWS - 1, centerRow + 1); r++) {
      for (let c = Math.max(0, centerCol - 1); c <= Math.min(BOARD_COLS - 1, centerCol + 1); c++) {
        if (this.grid[r][c]) {
          targets.push({ row: r, col: c });
        }
      }
    }

    await this.resolveCascades(targets);
    this.checkEndCondition();
    this.isProcessing = false;
  }

  /**
   * 道具 2：全局重排棋盘
   */
  private async useShuffleItem(): Promise<void> {
    if (this.isProcessing) return;
    const store = useGameStore.getState();
    if (!store.consumeItem('shuffle')) return;

    this.isProcessing = true;
    this.clearSelection();
    platform.playSound('powerup');

    this.effects.spawnFloatingText(
      (BOARD_COLS * TILE_SIZE) / 2,
      (BOARD_ROWS * TILE_SIZE) / 2,
      '棋盘重排!'
    );

    await this.shuffleBoardInternal();
    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.resolveCascades(matches);
      this.checkEndCondition();
    }
    this.isProcessing = false;
  }

  private async shuffleBoardInternal(): Promise<void> {
    const allTiles: Tile[] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (this.grid[r][c]) {
          allTiles.push(this.grid[r][c]!);
        }
      }
    }

    for (let i = allTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
    }

    const promises: Promise<void>[] = [];
    let idx = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const tile = allTiles[idx++];
        this.grid[r][c] = tile;
        promises.push(tile.moveTo(r, c, 240));
      }
    }

    await Promise.all(promises);
  }

  /**
   * 道具 3：增加 +5 步数
   */
  private useExtraMovesItem(): void {
    if (this.isProcessing) return;
    const store = useGameStore.getState();
    if (!store.consumeItem('extraMoves')) return;

    platform.playSound('powerup');
    stateSync.state.movesLeft += 5;
    stateSync.markDirty('movesLeft');

    this.effects.spawnFloatingText(
      (BOARD_COLS * TILE_SIZE) / 2,
      (BOARD_ROWS * TILE_SIZE) / 2,
      '步数 +5!'
    );
  }

  /**
   * 检查过关或失败条件
   */
  private checkEndCondition(): void {
    const { score, targetScore, movesLeft } = stateSync.state;
    const store = useGameStore.getState();

    if (score >= targetScore) {
      // 过关：剩余步数转化为额外奖励分与金币
      const bonusScore = movesLeft * 50;
      const bonusCoins = 30 + movesLeft * 5;
      stateSync.state.score += bonusScore;
      stateSync.state.coinsDelta += bonusCoins;
      stateSync.state.scene = 'settlement';

      stateSync.markDirty('score');
      stateSync.markDirty('coins');
      stateSync.markDirty('scene');

      store.setLevelResult(true);
      platform.playSound('win');
      gameEvents.emit('level-complete', {
        level: stateSync.state.level,
        score: stateSync.state.score,
        won: true,
      });
    } else if (movesLeft <= 0) {
      stateSync.state.scene = 'settlement';
      stateSync.markDirty('scene');

      store.setLevelResult(false);
      platform.playSound('lose');
      gameEvents.emit('level-complete', {
        level: stateSync.state.level,
        score: stateSync.state.score,
        won: false,
      });
    }
  }

  public update(delta: number): void {
    this.effects.update(delta);
  }

  public destroy(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < (this.grid[r]?.length || 0); c++) {
        this.grid[r][c]?.destroy();
      }
    }
    this.grid = [];
    this.effects.destroy();
    this.rootContainer.destroy({ children: true });
  }
}
