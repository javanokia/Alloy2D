/**
 * 引擎统一音频管理器 (v1.1 新增)
 * - 音效：按名称注册，优先播放音频文件，未注册/无后端时回退到程序化合成音
 * - BGM：循环播放、淡入淡出、开关持久化由业务层决定
 * - 生命周期：切后台 / 音频中断时自动暂停，回到前台自动恢复
 */
import { AudioBackend, AudioClip, createDefaultAudioBackend } from './AudioBackend';
import {
  BUILTIN_SYNTH_PRESETS,
  DEFAULT_SYNTH_TONES,
  ProceduralSynth,
  ToneSpec,
} from './ProceduralSynth';

export interface SoundDefinition {
  /** 音频文件路径；为空时使用 synth 或同名内置合成音 */
  src?: string;
  /** 自定义合成音色 */
  synth?: readonly ToneSpec[];
  /** 0~1，默认 1 */
  volume?: number;
  /** 同一音效允许同时发声的数量 (文件音效)，默认 3 */
  voices?: number;
}

export interface PlayBgmOptions {
  /** 0~1，默认 0.6 */
  volume?: number;
  fadeInMs?: number;
}

export interface StopBgmOptions {
  fadeOutMs?: number;
}

export interface AudioManagerState {
  backend: string | null;
  unlocked: boolean;
  suspended: boolean;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  bgm: { src: string; playing: boolean; volume: number } | null;
}

export interface AudioManagerOptions {
  /** 传入 null 表示禁用文件播放，只使用合成音；不传则自动探测 */
  backend?: AudioBackend | null;
  synth?: ProceduralSynth;
  /** 淡入淡出的步进间隔 (ms)，默认 50 */
  fadeStepMs?: number;
}

interface VoiceGroup {
  clips: AudioClip[];
  cursor: number;
}

interface BgmTrack {
  src: string;
  clip: AudioClip | null;
  volume: number;
  playing: boolean;
  cancelFade: (() => void) | null;
}

const DEFAULT_BGM_VOLUME = 0.6;
const DEFAULT_VOICES = 3;

export class AudioManager {
  private readonly registry = new Map<string, SoundDefinition>();
  private readonly voices = new Map<string, VoiceGroup>();
  private readonly synth: ProceduralSynth;
  private readonly fadeStepMs: number;
  private backendResolved = false;
  private backendInstance: AudioBackend | null = null;

  private bgm: BgmTrack | null = null;
  private sfxEnabled = true;
  private bgmEnabled = true;
  private unlocked = false;
  private suspended = false;

  constructor(options: AudioManagerOptions = {}) {
    this.synth = options.synth ?? new ProceduralSynth();
    this.fadeStepMs = options.fadeStepMs ?? 50;
    if (options.backend !== undefined) {
      this.backendInstance = options.backend;
      this.backendResolved = true;
    }
  }

  private get backend(): AudioBackend | null {
    if (!this.backendResolved) {
      this.backendInstance = createDefaultAudioBackend();
      this.backendResolved = true;
    }
    return this.backendInstance;
  }

  // ---------------- 注册 ----------------

  register(name: string, def: SoundDefinition): this {
    this.registry.set(name, def);
    this.disposeVoices(name);
    return this;
  }

  registerAll(defs: Record<string, SoundDefinition>): this {
    for (const [name, def] of Object.entries(defs)) {
      this.register(name, def);
    }
    return this;
  }

  has(name: string): boolean {
    return this.registry.has(name) || name in BUILTIN_SYNTH_PRESETS;
  }

  /** 预创建文件音效的播放实例，减少首次播放延迟 */
  preload(names: string[] = Array.from(this.registry.keys())): void {
    for (const name of names) {
      const def = this.registry.get(name);
      if (def?.src) this.getVoiceGroup(name, def);
    }
  }

  // ---------------- 解锁与生命周期 ----------------

  /** 需在用户手势回调内调用 (iOS / 浏览器自动播放策略) */
  unlock(): void {
    this.synth.ensureContext();
    this.unlocked = true;
    this.suspended = false;
    const bgm = this.bgm;
    if (bgm && this.bgmEnabled) {
      // Web 端首次 play() 可能被自动播放策略拦截，用户手势内再次调用 play() 以真正出声
      if (bgm.playing) bgm.clip?.play();
      else this.startBgm(bgm, 0);
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  suspend(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.synth.suspend();
    const bgm = this.bgm;
    if (bgm && bgm.playing && bgm.clip) {
      bgm.cancelFade?.();
      bgm.cancelFade = null;
      bgm.clip.pause();
      bgm.playing = false;
    }
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    if (this.unlocked) this.synth.resume();
    const bgm = this.bgm;
    if (bgm && this.bgmEnabled && !bgm.playing) {
      this.startBgm(bgm, 0);
    }
  }

  // ---------------- 音效 ----------------

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  play(name: string, volume = 1): void {
    if (!this.sfxEnabled || this.suspended) return;
    if (!this.unlocked) this.unlock();

    const def = this.registry.get(name);
    const vol = (def?.volume ?? 1) * volume;

    if (def?.src && this.backend) {
      const group = this.getVoiceGroup(name, def);
      const clip = group.clips[group.cursor];
      group.cursor = (group.cursor + 1) % group.clips.length;
      clip.stop();
      clip.setVolume(vol);
      clip.play();
      return;
    }

    const tones = def?.synth ?? BUILTIN_SYNTH_PRESETS[name] ?? DEFAULT_SYNTH_TONES;
    this.synth.play(tones, vol);
  }

  private getVoiceGroup(name: string, def: SoundDefinition): VoiceGroup {
    let group = this.voices.get(name);
    if (!group) {
      const count = Math.max(1, def.voices ?? DEFAULT_VOICES);
      const clips: AudioClip[] = [];
      for (let i = 0; i < count; i++) {
        const clip = this.backend!.createClip(def.src!);
        clip.setLoop(false);
        clips.push(clip);
      }
      group = { clips, cursor: 0 };
      this.voices.set(name, group);
    }
    return group;
  }

  private disposeVoices(name: string): void {
    const group = this.voices.get(name);
    if (group) {
      group.clips.forEach((c) => c.destroy());
      this.voices.delete(name);
    }
  }

  // ---------------- BGM ----------------

  setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    const bgm = this.bgm;
    if (!bgm) return;
    if (!enabled && bgm.playing) {
      bgm.cancelFade?.();
      bgm.cancelFade = null;
      bgm.clip?.pause();
      bgm.playing = false;
    } else if (enabled && !bgm.playing && !this.suspended) {
      this.startBgm(bgm, 0);
    }
  }

  /**
   * 播放背景音乐。BGM 被关闭或处于后台时只记录曲目，开启/回到前台后自动播放。
   * 重复调用同一曲目不会重新开始。
   */
  playBgm(src: string, options: PlayBgmOptions = {}): void {
    const volume = options.volume ?? DEFAULT_BGM_VOLUME;
    const current = this.bgm;
    if (current && current.src === src) {
      current.volume = volume;
      if (current.playing) {
        current.clip?.setVolume(volume);
      } else if (this.bgmEnabled && !this.suspended) {
        this.startBgm(current, options.fadeInMs ?? 0);
      }
      return;
    }

    if (current) this.releaseTrack(current, 0);

    const backend = this.backend;
    const clip = backend ? backend.createClip(src) : null;
    clip?.setLoop(true);
    const track: BgmTrack = { src, clip, volume, playing: false, cancelFade: null };
    this.bgm = track;

    if (this.bgmEnabled && !this.suspended) {
      this.startBgm(track, options.fadeInMs ?? 0);
    }
  }

  stopBgm(options: StopBgmOptions = {}): void {
    const track = this.bgm;
    if (!track) return;
    this.bgm = null;
    this.releaseTrack(track, options.fadeOutMs ?? 0);
  }

  private startBgm(track: BgmTrack, fadeInMs: number): void {
    if (!track.clip) return;
    track.cancelFade?.();
    track.cancelFade = null;
    if (fadeInMs > 0) {
      track.clip.setVolume(0);
      track.clip.play();
      track.cancelFade = this.fade(track.clip, 0, track.volume, fadeInMs, () => {
        track.cancelFade = null;
      });
    } else {
      track.clip.setVolume(track.volume);
      track.clip.play();
    }
    track.playing = true;
  }

  private releaseTrack(track: BgmTrack, fadeOutMs: number): void {
    track.cancelFade?.();
    track.cancelFade = null;
    const clip = track.clip;
    if (!clip) return;
    if (fadeOutMs > 0 && track.playing) {
      this.fade(clip, track.volume, 0, fadeOutMs, () => {
        clip.stop();
        clip.destroy();
      });
    } else {
      clip.stop();
      clip.destroy();
    }
    track.playing = false;
  }

  private fade(
    clip: AudioClip,
    from: number,
    to: number,
    durationMs: number,
    onDone: () => void
  ): () => void {
    const steps = Math.max(1, Math.round(durationMs / this.fadeStepMs));
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const k = step / steps;
      clip.setVolume(from + (to - from) * k);
      if (step >= steps) {
        clearInterval(timer);
        onDone();
      }
    }, this.fadeStepMs);
    return () => clearInterval(timer);
  }

  // ---------------- 调试与销毁 ----------------

  getState(): AudioManagerState {
    return {
      backend: this.backend ? this.backend.name : null,
      unlocked: this.unlocked,
      suspended: this.suspended,
      sfxEnabled: this.sfxEnabled,
      bgmEnabled: this.bgmEnabled,
      bgm: this.bgm
        ? { src: this.bgm.src, playing: this.bgm.playing, volume: this.bgm.volume }
        : null,
    };
  }

  dispose(): void {
    this.stopBgm();
    for (const name of Array.from(this.voices.keys())) this.disposeVoices(name);
    this.registry.clear();
  }
}

/** 引擎全局音频管理器单例 */
export const audioManager = new AudioManager();
