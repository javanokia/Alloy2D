import { create } from 'zustand';
import { LifecycleState, platform } from '../platform/PlatformAdapter';

export type SceneName = 'loading' | 'menu' | 'game' | 'settlement';
export type ModalType = 'shop' | 'leaderboard' | 'settings' | null;

export interface PoolTelemetry {
  particleActive: number;
  particleAvailable: number;
  textActive: number;
  textAvailable: number;
  totalHits: number;
  totalCreated: number;
}

export interface EventLogEntry {
  id: number;
  time: string;
  event: string;
  payload: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  level: number;
}

export interface GameStoreState {
  // 游戏核心状态
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

  // 跨端统一模态弹窗状态 (商城 / 排行榜 / 设置)
  activeModal: ModalType;

  // 道具与交互状态
  items: {
    hammer: number;
    shuffle: number;
    extraMoves: number;
  };
  activeItemMode: 'hammer' | null;

  // 系统设置与调试面板开关
  soundEnabled: boolean;
  showInspector: boolean;
  antialiasEnabled: boolean;

  // 前后台生命周期与刘海屏安全区状态
  lifecycleState: LifecycleState;
  lifecycleSwitchCount: number;
  webglContextLostCount: number;

  // 引擎遥测数据
  fps: number;
  drawCalls: number;
  dirtyFlushCount: number;
  dirtyMergedCount: number;
  poolStats: PoolTelemetry;
  eventLogs: EventLogEntry[];

  // Actions
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
    poolStats?: PoolTelemetry;
  }) => void;
  appendEventLog: (event: string, payload?: unknown) => void;
}

const savedHighScore = Number(platform.getStorage('highScore') || '0');
const savedCoins = Number(platform.getStorage('coins') || '200');
const savedSound = platform.getStorage('soundEnabled') !== 'false';

let logIdCounter = 1;

export const useGameStore = create<GameStoreState>((set, get) => ({
  scene: 'menu',
  level: 1,
  score: 0,
  targetScore: 900,
  movesLeft: 20,
  combo: 0,
  maxCombo: 0,
  coins: savedCoins,
  highScore: savedHighScore,
  isLevelWon: false,

  activeModal: null,

  items: {
    hammer: 2,
    shuffle: 2,
    extraMoves: 1,
  },
  activeItemMode: null,

  soundEnabled: savedSound,
  showInspector: true,
  antialiasEnabled: true,

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
        platform.setStorage('highScore', String(nextHigh));
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
      platform.setStorage('coins', String(nextCoins));
      return { coins: nextCoins };
    }),

  buyItem: (item, cost) => {
    const state = get();
    if (state.coins < cost) return false;
    const nextCoins = state.coins - cost;
    platform.setStorage('coins', String(nextCoins));
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
      platform.setStorage('soundEnabled', String(next));
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
      const entry: EventLogEntry = {
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
