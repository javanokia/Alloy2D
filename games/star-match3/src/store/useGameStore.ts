import { create } from 'zustand';
import {
  DirtyStateSync,
  gameEvents,
  InspectorEventLogEntry,
  InspectorPoolTelemetry,
  LifecycleState,
  platform,
  SaveManager,
} from 'alloy2d';

export type SceneName = 'loading' | 'menu' | 'game' | 'settlement';
export type ModalType = 'shop' | 'leaderboard' | 'settings' | null;

export interface Match3SaveData {
  highScore: number;
  coins: number;
  soundEnabled: boolean;
}

export const match3SaveManager = new SaveManager<Match3SaveData>({
  key: 'match3_save',
  version: 1,
  defaultData: () => ({
    highScore: Number(platform.getStorage('highScore') || '0'),
    coins: Number(platform.getStorage('coins') || '200'),
    soundEnabled: platform.getStorage('soundEnabled') !== 'false',
  }),
});

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  level: number;
}

export interface GameStoreState {
  scene: SceneName;
  level: number;
  score: number;
  targetScore: number;
  movesLeft: number;
  combo: number;
  maxCombo: number;
  coins: number;
  highScore: number;
  isLevelWon: boolean;

  activeModal: ModalType;

  items: {
    hammer: number;
    shuffle: number;
    extraMoves: number;
  };
  activeItemMode: 'hammer' | null;

  soundEnabled: boolean;
  showInspector: boolean;

  lifecycleState: LifecycleState;
  lifecycleSwitchCount: number;
  webglContextLostCount: number;

  fps: number;
  drawCalls: number;
  dirtyFlushCount: number;
  dirtyMergedCount: number;
  poolStats: InspectorPoolTelemetry;
  eventLogs: InspectorEventLogEntry[];

  setScene: (scene: SceneName) => void;
  setActiveModal: (modal: ModalType) => void;
  setScore: (score: number) => void;
  setLevel: (level: number) => void;
  setTargetScore: (targetScore: number) => void;
  setMovesLeft: (movesLeft: number) => void;
  setCombo: (combo: number) => void;
  setLevelResult: (won: boolean) => void;
  addCoins: (amount: number) => void;
  buyItem: (item: 'hammer' | 'shuffle' | 'extraMoves', cost: number) => boolean;
  consumeItem: (item: 'hammer' | 'shuffle' | 'extraMoves') => boolean;
  setActiveItemMode: (mode: 'hammer' | null) => void;
  toggleSound: () => void;
  toggleInspector: () => void;
  recordLifecycleChange: (state: LifecycleState) => void;
  recordWebglContextLost: () => void;
  updateTelemetry: (data: {
    fps?: number;
    drawCalls?: number;
    dirtyFlushCount?: number;
    dirtyMergedCount?: number;
    poolStats?: InspectorPoolTelemetry;
  }) => void;
  appendEventLog: (event: string, payload?: unknown) => void;
}

const initialSave = match3SaveManager.get();

let logIdCounter = 1;

export const useGameStore = create<GameStoreState>((set, get) => ({
  scene: 'menu',
  level: 1,
  score: 0,
  targetScore: 900,
  movesLeft: 20,
  combo: 0,
  maxCombo: 0,
  coins: initialSave.coins,
  highScore: initialSave.highScore,
  isLevelWon: false,

  activeModal: null,

  items: {
    hammer: 2,
    shuffle: 2,
    extraMoves: 1,
  },
  activeItemMode: null,

  soundEnabled: initialSave.soundEnabled,
  showInspector: true,

  lifecycleState: 'show',
  lifecycleSwitchCount: 0,
  webglContextLostCount: 0,

  fps: 60,
  drawCalls: 1,
  dirtyFlushCount: 0,
  dirtyMergedCount: 0,
  poolStats: {
    particleActive: 0,
    particleAvailable: 40,
    textActive: 0,
    textAvailable: 12,
    totalHits: 0,
    totalCreated: 52,
  },
  eventLogs: [],

  setScene: (scene) => set({ scene, activeItemMode: null, activeModal: null }),

  setActiveModal: (activeModal) => set({ activeModal }),

  setScore: (score) =>
    set((state) => {
      const nextHigh = Math.max(state.highScore, score);
      if (nextHigh > state.highScore) {
        match3SaveManager.save({ highScore: nextHigh });
      }
      return { score, highScore: nextHigh };
    }),

  setLevel: (level) => set({ level }),

  setTargetScore: (targetScore) => set({ targetScore }),

  setMovesLeft: (movesLeft) => set({ movesLeft }),

  setCombo: (combo) =>
    set((state) => ({
      combo,
      maxCombo: Math.max(state.maxCombo, combo),
    })),

  setLevelResult: (isLevelWon) => set({ isLevelWon }),

  addCoins: (amount) =>
    set((state) => {
      const nextCoins = Math.max(0, state.coins + amount);
      match3SaveManager.save({ coins: nextCoins });
      return { coins: nextCoins };
    }),

  buyItem: (item, cost) => {
    const state = get();
    if (state.coins < cost) return false;
    const nextCoins = state.coins - cost;
    match3SaveManager.save({ coins: nextCoins });
    set({
      coins: nextCoins,
      items: {
        ...state.items,
        [item]: state.items[item] + 1,
      },
    });
    return true;
  },

  consumeItem: (item) => {
    const state = get();
    if (state.items[item] <= 0) return false;
    set({
      items: {
        ...state.items,
        [item]: state.items[item] - 1,
      },
    });
    return true;
  },

  setActiveItemMode: (activeItemMode) => set({ activeItemMode }),

  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled;
      platform.setSoundEnabled(next);
      match3SaveManager.save({ soundEnabled: next });
      return { soundEnabled: next };
    }),

  toggleInspector: () => set((state) => ({ showInspector: !state.showInspector })),

  recordLifecycleChange: (lifecycleState) =>
    set((state) => ({
      lifecycleState,
      lifecycleSwitchCount: state.lifecycleSwitchCount + 1,
    })),

  recordWebglContextLost: () =>
    set((state) => ({
      webglContextLostCount: state.webglContextLostCount + 1,
    })),

  updateTelemetry: (data) =>
    set((state) => ({
      fps: data.fps ?? state.fps,
      drawCalls: data.drawCalls ?? state.drawCalls,
      dirtyFlushCount: data.dirtyFlushCount ?? state.dirtyFlushCount,
      dirtyMergedCount: data.dirtyMergedCount ?? state.dirtyMergedCount,
      poolStats: data.poolStats ?? state.poolStats,
    })),

  appendEventLog: (event, payload) =>
    set((state) => {
      const now = new Date();
      const time = `${String(now.getMinutes()).padStart(2, '0')}:${String(
        now.getSeconds()
      ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      const payloadStr =
        payload === undefined
          ? ''
          : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
      const entry: InspectorEventLogEntry = {
        id: logIdCounter++,
        time,
        event,
        payload: payloadStr,
      };
      return {
        eventLogs: [entry, ...state.eventLogs.slice(0, 14)],
      };
    }),
}));

// 将引擎 EventBus 的事件流日志挂载到当前游戏 Store
gameEvents.setLogger((event, payload) => {
  useGameStore.getState().appendEventLog(event, payload);
});

export interface Match3DirtyState {
  score: number;
  level: number;
  targetScore: number;
  movesLeft: number;
  combo: number;
  scene: SceneName;
  coinsDelta: number;
}

/**
 * 实例化引擎提供的 DirtyStateSync 帧末批量状态同步控制器
 */
export const stateSync = new DirtyStateSync<Match3DirtyState>(
  {
    score: 0,
    level: 1,
    targetScore: 900,
    movesLeft: 20,
    combo: 0,
    scene: 'menu',
    coinsDelta: 0,
  },
  (dirtyKeys, state, stats) => {
    const store = useGameStore.getState();
    dirtyKeys.forEach((key) => {
      switch (key) {
        case 'score':
          store.setScore(state.score);
          break;
        case 'level':
          store.setLevel(state.level);
          break;
        case 'targetScore':
          store.setTargetScore(state.targetScore);
          break;
        case 'movesLeft':
          store.setMovesLeft(state.movesLeft);
          break;
        case 'combo':
          store.setCombo(state.combo);
          break;
        case 'scene':
          store.setScene(state.scene);
          break;
        case 'coinsDelta':
          if (state.coinsDelta !== 0) {
            store.addCoins(state.coinsDelta);
            state.coinsDelta = 0;
          }
          break;
      }
    });

    store.updateTelemetry({
      dirtyFlushCount: stats.flushCount,
      dirtyMergedCount: stats.mergedCount,
    });
  }
);
