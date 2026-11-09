import { Application, Container } from 'pixi.js';
import { SceneName } from '../../store/useGameStore';
import { stateSync } from './StateSync';

/**
 * 场景管理器 (对应文章 4.2 节：每个场景是一个 Container，切换时仅改 visible 属性，不销毁重建)
 */
export class SceneManager {
  private app: Application;
  private scenes: Map<SceneName, Container> = new Map();
  private current: SceneName | null = null;

  constructor(app: Application) {
    this.app = app;
  }

  register(name: SceneName, scene: Container): void {
    this.scenes.set(name, scene);
    scene.visible = false;
    this.app.stage.addChild(scene);
  }

  switchTo(name: SceneName): void {
    if (this.current) {
      const prev = this.scenes.get(this.current);
      if (prev) prev.visible = false;
    }
    const next = this.scenes.get(name);
    if (next) {
      next.visible = true;
      this.current = name;
    }
    stateSync.state.scene = name;
    stateSync.markDirty('scene');
  }

  getCurrentScene(): SceneName | null {
    return this.current;
  }

  destroy(): void {
    this.scenes.forEach((scene) => {
      scene.destroy({ children: true });
    });
    this.scenes.clear();
    this.current = null;
  }
}
