import { beforeAll, describe, expect, it, vi } from 'vitest';
import { settings } from 'pixi.js';
import { CanvasButton, CanvasModal, CanvasPanel } from '../ui';

describe('Canvas UI Kit (微信小游戏端 Canvas 组件库)', () => {
  beforeAll(() => {
    class FakeCanvas {
      width = 1;
      height = 1;
      style = {};
      getContext() {
        return {
          font: '',
          fillText: () => {},
          measureText: () => ({ width: 10 }),
          fillRect: () => {},
          clearRect: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: [] }),
        };
      }
    }
    (globalThis as unknown as { HTMLCanvasElement: unknown }).HTMLCanvasElement = FakeCanvas;
    settings.ADAPTER.createCanvas = () => new FakeCanvas() as unknown as HTMLCanvasElement;
  });

  describe('CanvasButton (交互按钮)', () => {
    it('正确初始化文本、尺寸与默认属性', () => {
      const btn = new CanvasButton({
        width: 200,
        height: 60,
        label: '开始游戏',
      });

      expect(btn.labelText.text).toBe('开始游戏');
      expect(btn.cursor).toBe('pointer');
      expect(btn.isDisabled).toBe(false);
    });

    it('setLabel 与 setDisabled 更新按钮状态并调整透明度与光标', () => {
      const btn = new CanvasButton({ label: '确定' });

      btn.setLabel('完成');
      expect(btn.labelText.text).toBe('完成');

      btn.setDisabled(true);
      expect(btn.isDisabled).toBe(true);
      expect(btn.cursor).toBe('default');
    });

    it('点击事件派发与按压缩放', () => {
      const onClick = vi.fn();
      const btn = new CanvasButton({
        label: '点击',
        sound: null, // 单测环境不发声
        pressedScale: 0.9,
        onClick,
      });

      // 模拟 pointerdown
      btn.emit('pointerdown', { stopPropagation: vi.fn() });
      expect(btn.scale.x).toBe(0.9);

      // 模拟 pointerup 触发回调并恢复尺寸
      btn.emit('pointerup', { stopPropagation: vi.fn() });
      expect(btn.scale.x).toBe(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('禁用态下不触发 onClick 回调', () => {
      const onClick = vi.fn();
      const btn = new CanvasButton({
        label: '禁用',
        disabled: true,
        onClick,
      });

      btn.emit('pointerdown', { stopPropagation: vi.fn() });
      btn.emit('pointerup', { stopPropagation: vi.fn() });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('CanvasPanel (背景面板与卡片)', () => {
    it('支持初始化与 resize 重新绘制', () => {
      const panel = new CanvasPanel({
        width: 300,
        height: 200,
        radius: 16,
      });

      expect(panel.panelWidth).toBe(300);
      expect(panel.panelHeight).toBe(200);

      panel.resize(500, 400);
      expect(panel.panelWidth).toBe(500);
      expect(panel.panelHeight).toBe(400);
    });
  });

  describe('CanvasModal (通用模态弹窗)', () => {
    it('初始化处于隐藏状态，open 后显示并支持关闭', () => {
      const onClose = vi.fn();
      const modal = new CanvasModal({
        designWidth: 750,
        designHeight: 1334,
        title: '测试弹窗',
        onClose,
      });

      expect(modal.visible).toBe(false);
      expect(modal.isOpen).toBe(false);
      expect(modal.titleText.text).toBe('测试弹窗');

      modal.open('新标题');
      expect(modal.visible).toBe(true);
      expect(modal.isOpen).toBe(true);
      expect(modal.titleText.text).toBe('新标题');

      modal.close();
      expect(modal.visible).toBe(false);
      expect(modal.isOpen).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('点击全屏半透明遮罩自动触发 close', () => {
      const onClose = vi.fn();
      const modal = new CanvasModal({ onClose });

      modal.open();
      modal.backdrop.emit('pointerup', { stopPropagation: vi.fn() });

      expect(modal.isOpen).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
