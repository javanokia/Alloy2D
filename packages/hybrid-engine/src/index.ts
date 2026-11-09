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
