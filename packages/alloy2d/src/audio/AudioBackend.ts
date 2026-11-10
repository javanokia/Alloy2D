/**
 * 音频播放后端：抹平 Web (HTMLAudioElement) 与微信小游戏 (InnerAudioContext) 的差异
 */
import { getWx, WxInnerAudioContext } from '../platform/wx';

export interface AudioClip {
  play(): void;
  pause(): void;
  /** 停止并回到开头 */
  stop(): void;
  setVolume(volume: number): void;
  setLoop(loop: boolean): void;
  destroy(): void;
}

export interface AudioBackend {
  readonly name: string;
  createClip(src: string): AudioClip;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export class HtmlAudioBackend implements AudioBackend {
  readonly name = 'html-audio';

  createClip(src: string): AudioClip {
    const el = new Audio(src);
    el.preload = 'auto';
    return {
      play: () => {
        el.play()?.catch?.(() => {});
      },
      pause: () => el.pause(),
      stop: () => {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          // ignore
        }
      },
      setVolume: (v) => {
        el.volume = clamp01(v);
      },
      setLoop: (loop) => {
        el.loop = loop;
      },
      destroy: () => {
        el.pause();
        el.removeAttribute('src');
      },
    };
  }
}

export class WxInnerAudioBackend implements AudioBackend {
  readonly name = 'wx-inner-audio';

  constructor(private readonly create: () => WxInnerAudioContext) {}

  createClip(src: string): AudioClip {
    const ctx = this.create();
    ctx.src = src;
    return {
      play: () => ctx.play(),
      pause: () => ctx.pause(),
      stop: () => ctx.stop(),
      setVolume: (v) => {
        ctx.volume = clamp01(v);
      },
      setLoop: (loop) => {
        ctx.loop = loop;
      },
      destroy: () => ctx.destroy(),
    };
  }
}

/** 根据运行环境自动选择后端；无可用后端 (如 Node 测试环境) 时返回 null */
export function createDefaultAudioBackend(): AudioBackend | null {
  const wxObj = getWx();
  if (wxObj && typeof wxObj.createInnerAudioContext === 'function') {
    const create = wxObj.createInnerAudioContext.bind(wxObj);
    return new WxInnerAudioBackend(create);
  }
  if (typeof Audio !== 'undefined') {
    return new HtmlAudioBackend();
  }
  return null;
}
