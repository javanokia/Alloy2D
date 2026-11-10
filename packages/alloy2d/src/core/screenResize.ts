import { Application } from 'pixi.js';
import { platform } from '../platform/PlatformAdapter';

/**
 * 引擎内置屏幕分辨率自适应缩放 (对应文章 5.1 节：从设计分辨率如 750x1334 到实际屏幕计算缩放比例和居中留白)
 */
export function resizeStageToDesign(
  app: Application,
  designWidth = 750,
  designHeight = 1334
): { scale: number; offsetX: number; offsetY: number } {
  const { width: screenW, height: screenH } = platform.getScreenSize();
  const scaleX = screenW / designWidth;
  const scaleY = screenH / designHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (screenW - designWidth * scale) / 2;
  const offsetY = (screenH - designHeight * scale) / 2;

  app.renderer.resize(screenW, screenH);
  app.stage.scale.set(scale);
  app.stage.x = offsetX;
  app.stage.y = offsetY;

  return { scale, offsetX, offsetY };
}

/**
 * 计算刘海屏/灵动岛及微信右上角胶囊按钮在设计分辨率坐标系下的安全区域边距
 */
export function computeSafeAreaDesignOffsets(
  designWidth = 750,
  designHeight = 1334
): { safeTopDesign: number; safeBottomDesign: number } {
  const { width: screenW, height: screenH } = platform.getScreenSize();
  const insets = platform.getSafeAreaInsets();

  const scale = Math.min(screenW / designWidth, screenH / designHeight);
  const stageOffsetY = (screenH - designHeight * scale) / 2;

  const unsafeTopPx = Math.max(
    insets.top,
    insets.capsuleBottom > 0 ? insets.capsuleBottom + 8 : 0
  );
  const safeTopDesign = Math.max(0, (unsafeTopPx - stageOffsetY) / scale);
  const safeBottomDesign = Math.max(0, (insets.bottom - stageOffsetY) / scale);

  return { safeTopDesign, safeBottomDesign };
}
