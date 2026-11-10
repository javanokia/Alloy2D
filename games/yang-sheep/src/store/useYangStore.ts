import { create } from 'zustand';
import { audioManager, DirtyStateSync, platform, SaveManager } from 'alloy2d';

export type SceneName = 'menu' | 'game' | 'settlement';
export type ModalType = 'shop' | 'leaderboard' | 'settings' | null;

export interface YangSaveData {
  highScore: number;
  coins: number;
  soundEnabled: boolean;
  bgmEnabled: boolean;
}

export const yangSaveManager = new SaveManager<YangSaveData>({
  key: 'yang_save',
  version: 1,
  defaultData: () => ({
    highScore: Number(platform.getStorage('yang_highScore') || '0'),
    coins: Number(platform.getStorage('yang_coins') || '200'),
    soundEnabled: platform.getStorage('yang_soundEnabled') !== 'false',
    bgmEnabled: platform.getStorage('yang_bgmEnabled') !== 'false',
  }),
});

export interface YangSyncState extends Record<string, any> {
  scene: SceneName;
  level: number;
  score: number;
  isLevelWon: boolean;
  activeModal: ModalType;
}

export interface YangStoreState {
  scene: SceneName;
  level: number;
  score: number;
  highScore: number;
  coins: number;
  isLevelWon: boolean;

  province: string;
  provinceRank: number;
  todayClearCount: number;

  yangProps: {
    moveOut: number;
    undo: number;
    shuffle: number;
    revive: number;
  };

  activeModal: ModalType;

  soundEnabled: boolean;
  bgmEnabled: boolean;
  showInspector: boolean;

  fps: number;
  drawCalls: number;
  dirtyFlushCount: number;
  dirtyMergedCount: number;
  poolStats: {
    particleActive: number;
    particleAvailable: number;
    textActive: number;
    textAvailable: number;
    totalHits: number;
    totalCreated: number;
  };
  lifecycleState: 'show' | 'hide';
  lifecycleSwitchCount: number;
  eventLogs: Array<{ id: number; time: string; event: string; payload: string }>;

  setScene: (scene: SceneName) => void;
  setLevel: (level: number) => void;
  setScore: (score: number) => void;
  setLevelResult: (won: boolean) => void;
  addCoins: (amount: number) => void;
  useYangProp: (prop: 'moveOut' | 'undo' | 'shuffle' | 'revive') => boolean;
  resetYangProps: () => void;
  setActiveModal: (modal: ModalType) => void;
  toggleBgm: () => void;
  toggleSound: () => void;
  toggleInspector: () => void;
  recordLifecycleChange: (state: 'show' | 'hide') => void;
  recordWebglContextLost: () => void;
  updateTelemetry: (data: {
    fps?: number;
    drawCalls?: number;
    dirtyFlushCount?: number;
    dirtyMergedCount?: number;
    poolStats?: any;
  }) => void;
  appendEventLog: (event: string, payload?: unknown) => void;
}

const initialSave = yangSaveManager.get();

const YANG_BGM_SRC = 'assets/audio/bgm-loop.mp3';
audioManager.setBgmEnabled(initialSave.bgmEnabled);
audioManager.setSfxEnabled(initialSave.soundEnabled);

/** 播放背景音乐 (Web / 微信小游戏由引擎 audioManager 统一处理) */
export function playYangBgm(): void {
  audioManager.setBgmEnabled(true);
  audioManager.playBgm(YANG_BGM_SRC, { volume: 0.6, fadeInMs: 400 });
}

export function stopYangBgm(): void {
  audioManager.setBgmEnabled(false);
}

let logIdCounter = 1;

export const useYangStore = create<YangStoreState>((set, get) => ({
  scene: 'menu',
  level: 1,
  score: 0,
  highScore: initialSave.highScore,
  coins: initialSave.coins,
  isLevelWon: false,

  province: '广东省',
  provinceRank: 68,
  todayClearCount: 1429,

  yangProps: {
    moveOut: 1,
    undo: 1,
    shuffle: 1,
    revive: 1,
  },

  activeModal: null,

  soundEnabled: initialSave.soundEnabled,
  bgmEnabled: initialSave.bgmEnabled,
  showInspector: true,

  fps: 60,
  drawCalls: 4,
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
  lifecycleState: 'show',
  lifecycleSwitchCount: 0,
  eventLogs: [],

  setScene: (scene) => set({ scene, activeModal: null }),
  setLevel: (level) => set({ level }),
  setScore: (score) =>
    set((state) => {
      const nextHigh = Math.max(state.highScore, score);
      if (nextHigh > state.highScore) {
        yangSaveManager.save({ highScore: nextHigh });
      }
      return { score, highScore: nextHigh };
    }),
  setLevelResult: (isLevelWon) => set({ isLevelWon }),

  addCoins: (amount) =>
    set((state) => {
      const nextCoins = Math.max(0, state.coins + amount);
      yangSaveManager.save({ coins: nextCoins });
      return { coins: nextCoins };
    }),

  useYangProp: (prop) => {
    const state = get();
    if (state.yangProps[prop] <= 0) return false;
    set({
      yangProps: {
        ...state.yangProps,
        [prop]: state.yangProps[prop] - 1,
      },
    });
    return true;
  },

  resetYangProps: () =>
    set({
      yangProps: {
        moveOut: 1,
        undo: 1,
        shuffle: 1,
        revive: 1,
      },
    }),

  setActiveModal: (activeModal) => set({ activeModal }),

  toggleBgm: () =>
    set((state) => {
      const next = !state.bgmEnabled;
      yangSaveManager.save({ bgmEnabled: next });
      if (next) {
        playYangBgm();
      } else {
        stopYangBgm();
      }
      return { bgmEnabled: next };
    }),

  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled;
      platform.setSoundEnabled(next);
      yangSaveManager.save({ soundEnabled: next });
      return { soundEnabled: next };
    }),

  toggleInspector: () => set((state) => ({ showInspector: !state.showInspector })),

  recordLifecycleChange: (lifecycleState) =>
    set((state) => ({
      lifecycleState,
      lifecycleSwitchCount: state.lifecycleSwitchCount + 1,
    })),

  recordWebglContextLost: () =>
    set((state) => {
      const now = new Date();
      const time = `${String(now.getMinutes()).padStart(2, '0')}:${String(
        now.getSeconds()
      ).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      return {
        eventLogs: [
          {
            id: logIdCounter++,
            time,
            event: 'WebGLContextLost',
            payload: 'WebGL 上下文丢失，等待恢复',
          },
          ...state.eventLogs.slice(0, 14),
        ],
      };
    }),

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
      const entry = {
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

/**
 * 引擎帧末脏标记批量状态同步控制器
 */
export const yangStateSync = new DirtyStateSync<YangSyncState>(
  {
    scene: 'menu',
    level: 1,
    score: 0,
    isLevelWon: false,
    activeModal: null,
  },
  (dirtyKeys, state, stats) => {
    const patch: Partial<YangStoreState> = {};
    if (dirtyKeys.has('scene')) patch.scene = state.scene;
    if (dirtyKeys.has('level')) patch.level = state.level;
    if (dirtyKeys.has('score')) patch.score = state.score;
    if (dirtyKeys.has('isLevelWon')) patch.isLevelWon = state.isLevelWon;
    if (dirtyKeys.has('activeModal')) patch.activeModal = state.activeModal;
    if (stats) {
      patch.dirtyFlushCount = stats.flushCount;
      patch.dirtyMergedCount = stats.mergedCount;
    }
    useYangStore.setState(patch);
  }
);
