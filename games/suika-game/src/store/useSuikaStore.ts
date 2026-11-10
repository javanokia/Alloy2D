import { create } from 'zustand';
import { DirtyStateSync, platform, SaveManager } from 'alloy2d';

export type PropType = 'shake' | 'bomb' | 'upgrade';
export type ModalType = 'shop' | 'leaderboard' | 'settings' | null;

export interface SuikaState {
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  nextTier: number;
  isGameOver: boolean;
  isDanger: boolean;
  activeItemMode: 'bomb' | 'upgrade' | null;
  activeModal: ModalType;
  soundEnabled: boolean;
  showInspector: boolean;

  props: {
    shake: number;
    bomb: number;
    upgrade: number;
  };

  coins: number;
  fruitsMergedTotal: number;

  // Actions
  addScore: (points: number, comboIncrement?: boolean) => void;
  resetCombo: () => void;
  setNextTier: (tier: number) => void;
  setDanger: (danger: boolean) => void;
  setGameOver: (isOver: boolean) => void;
  setActiveItemMode: (mode: 'bomb' | 'upgrade' | null) => void;
  setActiveModal: (modal: ModalType) => void;
  useProp: (type: PropType) => boolean;
  buyProp: (type: PropType, cost: number) => boolean;
  addCoins: (amount: number) => void;
  toggleSound: () => void;
  toggleInspector: () => void;
  resetGame: () => void;
}

export interface SavedData {
  highScore: number;
  coins: number;
  props: { shake: number; bomb: number; upgrade: number };
  soundEnabled: boolean;
}

const saveManager = new SaveManager<SavedData>({
  key: 'alloy2d_suika_save',
  version: 1,
  defaultData: {
    highScore: 0,
    coins: 100,
    props: { shake: 2, bomb: 1, upgrade: 1 },
    soundEnabled: true,
  },
});

const initialSaved = saveManager.get();

export const useSuikaStore = create<SuikaState>((set, get) => ({
  score: 0,
  highScore: initialSaved.highScore,
  combo: 0,
  maxCombo: 0,
  nextTier: 0,
  isGameOver: false,
  isDanger: false,
  activeItemMode: null,
  activeModal: null,
  soundEnabled: initialSaved.soundEnabled,
  showInspector: false,
  props: { ...initialSaved.props },
  coins: initialSaved.coins,
  fruitsMergedTotal: 0,

  addScore: (points: number, comboIncrement = false) => {
    set((state) => {
      const nextCombo = comboIncrement ? state.combo + 1 : state.combo;
      const bonus = nextCombo > 1 ? Math.floor(points * (nextCombo - 1) * 0.2) : 0;
      const newScore = state.score + points + bonus;
      const newHigh = Math.max(state.highScore, newScore);
      const newMaxCombo = Math.max(state.maxCombo, nextCombo);
      const newMerged = state.fruitsMergedTotal + 1;

      saveManager.save({
        highScore: newHigh,
        coins: state.coins,
        props: state.props,
        soundEnabled: state.soundEnabled,
      });

      return {
        score: newScore,
        highScore: newHigh,
        combo: nextCombo,
        maxCombo: newMaxCombo,
        fruitsMergedTotal: newMerged,
      };
    });
  },

  resetCombo: () => set({ combo: 0 }),

  setNextTier: (tier: number) => set({ nextTier: tier }),

  setDanger: (isDanger: boolean) => set({ isDanger }),

  setGameOver: (isGameOver: boolean) => {
    set({ isGameOver, isDanger: false, activeItemMode: null });
  },

  setActiveItemMode: (mode) => set({ activeItemMode: mode }),

  setActiveModal: (activeModal) => set({ activeModal }),

  useProp: (type: PropType) => {
    const state = get();
    if (state.props[type] > 0) {
      set((prev) => {
        const nextProps = { ...prev.props, [type]: prev.props[type] - 1 };
        saveManager.save({
          highScore: prev.highScore,
          coins: prev.coins,
          props: nextProps,
          soundEnabled: prev.soundEnabled,
        });
        return { props: nextProps };
      });
      return true;
    }
    return false;
  },

  buyProp: (type: PropType, cost: number) => {
    const state = get();
    if (state.coins >= cost) {
      set((prev) => {
        const nextCoins = prev.coins - cost;
        const nextProps = { ...prev.props, [type]: prev.props[type] + 1 };
        saveManager.save({
          highScore: prev.highScore,
          coins: nextCoins,
          props: nextProps,
          soundEnabled: prev.soundEnabled,
        });
        return { coins: nextCoins, props: nextProps };
      });
      return true;
    }
    return false;
  },

  addCoins: (amount: number) => {
    set((prev) => {
      const nextCoins = Math.max(0, prev.coins + amount);
      saveManager.save({
        highScore: prev.highScore,
        coins: nextCoins,
        props: prev.props,
        soundEnabled: prev.soundEnabled,
      });
      return { coins: nextCoins };
    });
  },

  toggleSound: () => {
    set((prev) => {
      const nextVal = !prev.soundEnabled;
      platform.setSoundEnabled(nextVal);
      saveManager.save({
        highScore: prev.highScore,
        coins: prev.coins,
        props: prev.props,
        soundEnabled: nextVal,
      });
      return { soundEnabled: nextVal };
    });
  },

  toggleInspector: () => set((prev) => ({ showInspector: !prev.showInspector })),

  resetGame: () => {
    set({
      score: 0,
      combo: 0,
      isGameOver: false,
      isDanger: false,
      activeItemMode: null,
      activeModal: null,
    });
  },
}));

export const suikaStateSync = new DirtyStateSync<SuikaState>(
  useSuikaStore.getState(),
  (dirtyKeys, nextState) => {
    useSuikaStore.setState(nextState);
  }
);
