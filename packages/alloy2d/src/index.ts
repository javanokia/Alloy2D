// 核心通信、场景管理、脏标记同步与屏幕适配
export { EventBus, gameEvents } from './core/EventBus';
export type { Handler, EventLogger } from './core/EventBus';

export { SceneManager } from './core/SceneManager';

export { DirtyStateSync } from './core/DirtyStateSync';
export type { DirtySyncStats, DirtyFlushHandler } from './core/DirtyStateSync';

export {
  resizeStageToDesign,
  computeSafeAreaDesignOffsets,
} from './core/screenResize';

// 多平台适配层 (Web / 微信小游戏 wx / Electron)
export {
  platform,
  WxMiniGamePlatformAdapter,
  WebPlatformAdapter,
} from './platform/PlatformAdapter';
export type {
  PlatformAdapter,
  PlatformType,
  LifecycleState,
  SoundEffectType,
  SafeAreaInsets,
} from './platform/PlatformAdapter';

export { getWx } from './platform/wx';
export type { WxMiniGameGlobal, WxInnerAudioContext } from './platform/wx';

// 微信小游戏通用启动模板 (v1.1)
export { bootstrapWxGame, runWxGame } from './platform/bootstrapWxGame';
export type {
  WxBootstrapOptions,
  WxGameHooks,
  WxGameRuntime,
} from './platform/bootstrapWxGame';

// 统一音频系统 (v1.1)
export { AudioManager, audioManager } from './audio/AudioManager';
export type {
  SoundDefinition,
  PlayBgmOptions,
  StopBgmOptions,
  AudioManagerState,
  AudioManagerOptions,
} from './audio/AudioManager';
export {
  HtmlAudioBackend,
  WxInnerAudioBackend,
  createDefaultAudioBackend,
} from './audio/AudioBackend';
export type { AudioBackend, AudioClip } from './audio/AudioBackend';
export {
  ProceduralSynth,
  BUILTIN_SYNTH_PRESETS,
  DEFAULT_SYNTH_TONES,
} from './audio/ProceduralSynth';
export type { ToneSpec, AudioContextFactory } from './audio/ProceduralSynth';

// 通用特效 (v1.1)
export {
  EffectManager,
  DEFAULT_BURST_OPTIONS,
  DEFAULT_FLOATING_TEXT_OPTIONS,
  DEFAULT_FLOATING_TEXT_STYLE,
} from './effects/EffectManager';
export type {
  EffectManagerOptions,
  EffectTelemetry,
  BurstOptions,
  FloatingTextOptions,
} from './effects/EffectManager';

// 通用输入与手势识别 (v1.1)
export { InputManager } from './input/InputManager';
export type {
  ScreenTransform,
  PointerPoint,
  SwipeDirection,
  SwipeEvent,
  DragEvent,
  GestureCallbacks,
  InputManagerOptions,
} from './input/InputManager';

// 持久化存储与版本迁移 (v1.1)
export {
  SaveManager,
  DefaultPlatformSaveDriver,
  MemorySaveDriver,
} from './storage/SaveManager';
export type {
  SaveDriver,
  SaveEnvelope,
  MigrationFn,
  SaveManagerOptions,
} from './storage/SaveManager';

// Canvas 原生 UI 组件库 (v1.1 新增：微信小游戏端专用)
export {
  CanvasButton,
  CanvasPanel,
  CanvasModal,
} from './ui';
export type {
  CanvasButtonOptions,
  CanvasPanelOptions,
  CanvasModalOptions,
} from './ui';

// 跨平台资源与动态图集管理
export {
  BaseAssetManager,
  ATLAS_PADDING,
  traceRoundedRect,
} from './assets/BaseAssetManager';

// 对象池与补间动画工具
export { Pool } from './utils/Pool';
export type { PoolStats } from './utils/Pool';

export {
  TweenManager,
  tweenManager,
  animateTo,
  animateTransform,
  Easing,
} from './utils/tween';
export type { EaseFn } from './utils/tween';

// React 宿主与通用 UI 组件
export { HybridCanvasHost } from './react/HybridCanvasHost';
export type {
  HybridGameInstance,
  HybridCanvasHostProps,
} from './react/HybridCanvasHost';

export { ModalDialog } from './react/ModalDialog';
export type { ModalDialogProps } from './react/ModalDialog';

export { EngineInspectorDock } from './react/EngineInspectorDock';
export type {
  InspectorPoolTelemetry,
  InspectorEventLogEntry,
  EngineInspectorDockProps,
} from './react/EngineInspectorDock';
