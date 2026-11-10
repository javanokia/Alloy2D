import { ATLAS_PADDING } from '../assets/BaseAssetManager';
import { LifecycleState, platform } from '../platform/PlatformAdapter';

export interface InspectorPoolTelemetry {
  particleActive: number;
  particleAvailable: number;
  textActive: number;
  textAvailable: number;
  totalHits: number;
  totalCreated: number;
}

export interface InspectorEventLogEntry {
  id: number;
  time: string;
  event: string;
  payload: string;
}

export interface EngineInspectorDockProps {
  showInspector: boolean;
  onToggleInspector: () => void;
  fps: number;
  drawCalls: number;
  dirtyFlushCount: number;
  dirtyMergedCount: number;
  poolStats: InspectorPoolTelemetry;
  lifecycleState: LifecycleState;
  lifecycleSwitchCount: number;
  eventLogs: InspectorEventLogEntry[];
}

/**
 * 引擎内置架构实时遥测与调试面板组件
 */
export function EngineInspectorDock({
  showInspector,
  onToggleInspector,
  fps,
  drawCalls,
  dirtyFlushCount,
  dirtyMergedCount,
  poolStats,
  lifecycleState,
  lifecycleSwitchCount,
  eventLogs,
}: EngineInspectorDockProps) {
  if (!showInspector) {
    return (
      <button
        type="button"
        className="inspector-toggle-fab"
        onClick={onToggleInspector}
        title="展开混合引擎架构监控面板"
      >
        📊 引擎监控 ({fps} FPS)
      </button>
    );
  }

  return (
    <aside className="engine-inspector-dock" aria-label="引擎架构实时遥测面板">
      <div className="inspector-header">
        <span className="inspector-title">⚡ alloy2d 遥测</span>
        <button
          type="button"
          className="inspector-close"
          onClick={onToggleInspector}
          aria-label="收起监控面板"
        >
          收起
        </button>
      </div>

      <div className="inspector-grid">
        <div className="inspector-metric">
          <span className="m-label">WebGL 帧率</span>
          <span className="m-value good">{fps} FPS</span>
        </div>
        <div className="inspector-metric">
          <span className="m-label">Draw Calls (图集批处理)</span>
          <span className="m-value good">{drawCalls} calls</span>
        </div>
        <div className="inspector-metric">
          <span className="m-label">DirtyFlag 帧末同步</span>
          <span className="m-value">
            {dirtyFlushCount} 次 (合并 {dirtyMergedCount} 次)
          </span>
        </div>
        <div className="inspector-metric">
          <span className="m-label">对象池复用 (粒子/飘字)</span>
          <span className="m-value">
            活跃 {poolStats.particleActive + poolStats.textActive} / 闲置{' '}
            {poolStats.particleAvailable + poolStats.textAvailable} (命中 {poolStats.totalHits} 次)
          </span>
        </div>
        <div className="inspector-metric">
          <span className="m-label">图集防渗色 / 静态缓存</span>
          <span className="m-value">Padding {ATLAS_PADDING}px · cacheAsBitmap ✓</span>
        </div>
        <div className="inspector-metric">
          <span className="m-label">前后台生命周期 / 音频</span>
          <span className="m-value">
            {lifecycleState === 'show' ? '前台' : '后台'} (切换 {lifecycleSwitchCount} 次) ·{' '}
            {platform.isAudioUnlocked() ? 'Audio✓' : '待解锁'}
          </span>
        </div>
      </div>

      <div className="inspector-logs">
        <div className="logs-title">EventBus 双向事件流 (最近触发)</div>
        {eventLogs.length === 0 ? (
          <div className="log-empty">点击或滑动棋子查看 Pixi ↔ React 通信事件...</div>
        ) : (
          <ul className="log-list">
            {eventLogs.slice(0, 5).map((item) => (
              <li key={item.id} className="log-item">
                <span className="log-time">{item.time}</span>
                <span className="log-evt">{item.event}</span>
                <span className="log-payload">{item.payload}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
