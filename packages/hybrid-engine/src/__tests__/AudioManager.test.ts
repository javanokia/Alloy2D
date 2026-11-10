import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioClip,
  AudioBackend,
} from '../audio/AudioBackend';
import {
  AudioManager,
  SoundDefinition,
} from '../audio/AudioManager';
import { ProceduralSynth } from '../audio/ProceduralSynth';

class MockAudioClip implements AudioClip {
  public playing = false;
  public volume = 1;
  public loop = false;
  public destroyed = false;

  play = vi.fn(() => {
    this.playing = true;
  });
  pause = vi.fn(() => {
    this.playing = false;
  });
  stop = vi.fn(() => {
    this.playing = false;
  });
  setVolume = vi.fn((v: number) => {
    this.volume = v;
  });
  setLoop = vi.fn((l: boolean) => {
    this.loop = l;
  });
  destroy = vi.fn(() => {
    this.destroyed = true;
  });
}

class MockBackend implements AudioBackend {
  readonly name = 'mock-backend';
  public clips: MockAudioClip[] = [];

  createClip(src: string): AudioClip {
    const clip = new MockAudioClip();
    this.clips.push(clip);
    return clip;
  }
}

describe('AudioManager (音频管理器)', () => {
  let backend: MockBackend;
  let synth: ProceduralSynth;
  let synthPlaySpy: ReturnType<typeof vi.fn>;
  let synthEnsureSpy: ReturnType<typeof vi.fn>;
  let audio: AudioManager;

  beforeEach(() => {
    backend = new MockBackend();
    synth = new ProceduralSynth(() => null);
    synthPlaySpy = vi.spyOn(synth, 'play').mockImplementation(() => {});
    synthEnsureSpy = vi.spyOn(synth, 'ensureContext').mockImplementation(() => null);

    audio = new AudioManager({
      backend,
      synth,
      fadeStepMs: 10,
    });
  });

  it('音效注册与存在性检测', () => {
    expect(audio.has('click')).toBe(true); // 内置预设
    expect(audio.has('custom_boom')).toBe(false);

    audio.register('custom_boom', { src: 'audio/boom.mp3', volume: 0.8 });
    expect(audio.has('custom_boom')).toBe(true);
  });

  it('播放未注册或无 src 的音效时回退到合成音', () => {
    audio.play('click');
    expect(audio.isUnlocked()).toBe(true);
    expect(synthEnsureSpy).toHaveBeenCalled();
    expect(synthPlaySpy).toHaveBeenCalled();
  });

  it('播放带有 src 的音效时通过后端 AudioClip 播放并支持多声部轮转', () => {
    audio.register('hit', { src: 'audio/hit.mp3', voices: 2, volume: 0.5 });
    audio.play('hit');

    expect(backend.clips.length).toBe(2);
    expect(backend.clips[0].play).toHaveBeenCalledTimes(1);
    expect(backend.clips[0].setVolume).toHaveBeenCalledWith(0.5);

    audio.play('hit');
    expect(backend.clips[1].play).toHaveBeenCalledTimes(1);

    audio.play('hit');
    expect(backend.clips[0].play).toHaveBeenCalledTimes(2);
  });

  it('音效开关 setSfxEnabled 控制是否出声', () => {
    audio.setSfxEnabled(false);
    audio.play('click');
    expect(synthPlaySpy).not.toHaveBeenCalled();

    audio.setSfxEnabled(true);
    audio.play('click');
    expect(synthPlaySpy).toHaveBeenCalled();
  });

  it('BGM 播放、循环设置与状态获取', () => {
    audio.playBgm('audio/bgm.mp3', { volume: 0.7 });

    const state = audio.getState();
    expect(state.bgm?.src).toBe('audio/bgm.mp3');
    expect(state.bgm?.volume).toBe(0.7);
    expect(state.bgm?.playing).toBe(true);

    expect(backend.clips.length).toBe(1);
    expect(backend.clips[0].loop).toBe(true);
    expect(backend.clips[0].play).toHaveBeenCalled();
  });

  it('BGM 开关 setBgmEnabled 暂停与恢复', () => {
    audio.playBgm('audio/bgm.mp3');
    const bgmClip = backend.clips[0];

    audio.setBgmEnabled(false);
    expect(bgmClip.pause).toHaveBeenCalled();
    expect(audio.getState().bgm?.playing).toBe(false);

    audio.setBgmEnabled(true);
    expect(bgmClip.play).toHaveBeenCalledTimes(2);
    expect(audio.getState().bgm?.playing).toBe(true);
  });

  it('前后台切换挂起与恢复：suspend / resume', () => {
    audio.playBgm('audio/bgm.mp3');
    const bgmClip = backend.clips[0];

    audio.suspend();
    expect(audio.getState().suspended).toBe(true);
    expect(bgmClip.pause).toHaveBeenCalled();

    audio.resume();
    expect(audio.getState().suspended).toBe(false);
    expect(bgmClip.play).toHaveBeenCalledTimes(2);
  });

  it('stopBgm 停止并销毁当前曲目', () => {
    audio.playBgm('audio/bgm.mp3');
    const bgmClip = backend.clips[0];

    audio.stopBgm();
    expect(bgmClip.stop).toHaveBeenCalled();
    expect(bgmClip.destroy).toHaveBeenCalled();
    expect(audio.getState().bgm).toBeNull();
  });
});
