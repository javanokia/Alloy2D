/**
 * 程序化合成音效 (WebAudio 振荡器)
 * 作为音效文件缺失或未注册时的兜底方案，零资源体积
 */
import { getWx } from '../platform/wx';

export interface ToneSpec {
  /** 起始频率 (Hz) */
  from: number;
  /** 结束频率 (Hz) */
  to: number;
  /** 持续时长 (秒) */
  duration: number;
  wave?: OscillatorType;
  gain?: number;
  /** 相对触发时刻的延迟 (秒) */
  delay?: number;
}

const t = (
  from: number,
  to: number,
  duration: number,
  wave: OscillatorType = 'sine',
  gain = 0.14,
  delay = 0
): ToneSpec => ({ from, to, duration, wave, gain, delay });

/** 引擎内置合成音色预设 (兼容 v1.0 的 SoundEffectType 名称) */
export const BUILTIN_SYNTH_PRESETS: Readonly<Record<string, readonly ToneSpec[]>> = {
  click: [t(520, 680, 0.06, 'triangle', 0.12)],
  swap: [t(340, 520, 0.1, 'sine', 0.12)],
  invalid: [t(220, 150, 0.16, 'sawtooth', 0.1)],
  match: [t(523.25, 659.25, 0.12, 'sine', 0.15, 0), t(659.25, 783.99, 0.15, 'sine', 0.15, 0.06)],
  combo: [
    t(587.33, 783.99, 0.12, 'triangle', 0.16, 0),
    t(783.99, 987.77, 0.14, 'triangle', 0.16, 0.06),
    t(987.77, 1174.66, 0.18, 'triangle', 0.18, 0.12),
  ],
  powerup: [t(180, 880, 0.25, 'sawtooth', 0.16, 0)],
  win: [
    t(523.25, 523.25, 0.12, 'triangle', 0.16, 0),
    t(659.25, 659.25, 0.12, 'triangle', 0.16, 0.11),
    t(783.99, 783.99, 0.12, 'triangle', 0.16, 0.22),
    t(1046.5, 1046.5, 0.3, 'triangle', 0.2, 0.33),
  ],
  lose: [
    t(392.0, 349.23, 0.18, 'sawtooth', 0.12, 0),
    t(349.23, 293.66, 0.22, 'sawtooth', 0.12, 0.18),
    t(293.66, 220.0, 0.32, 'sawtooth', 0.14, 0.38),
  ],
};

export const DEFAULT_SYNTH_TONES: readonly ToneSpec[] = [t(440, 660, 0.08, 'sine', 0.1)];

export type AudioContextFactory = () => AudioContext | null;

export function defaultAudioContextFactory(): AudioContext | null {
  const wxObj = getWx();
  if (wxObj && typeof wxObj.createWebAudioContext === 'function') {
    try {
      return wxObj.createWebAudioContext();
    } catch {
      return null;
    }
  }
  if (typeof window !== 'undefined') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      try {
        return new AudioCtx();
      } catch {
        return null;
      }
    }
  }
  return null;
}

export class ProceduralSynth {
  private ctx: AudioContext | null = null;

  constructor(private readonly factory: AudioContextFactory = defaultAudioContextFactory) {}

  /** 需在用户手势回调内调用，创建/恢复 AudioContext */
  ensureContext(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = this.factory();
    }
    this.resume();
    return this.ctx;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
      try {
        void this.ctx.suspend();
      } catch {
        // ignore
      }
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      try {
        void this.ctx.resume();
      } catch {
        // ignore
      }
    }
  }

  play(tones: readonly ToneSpec[], volume = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime || 0;
    for (const tone of tones) {
      try {
        const delay = tone.delay ?? 0;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone.wave ?? 'sine';
        osc.frequency.setValueAtTime(tone.from, now + delay);
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, tone.to),
          now + delay + tone.duration
        );
        gain.gain.setValueAtTime((tone.gain ?? 0.14) * volume, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + tone.duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + tone.duration);
      } catch {
        // ignore
      }
    }
  }
}
