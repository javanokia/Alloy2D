import { Application, Container } from 'pixi.js';

/**
 * 引擎内置泛型场景管理器 (对应文章 4.2 节：每个场景是一个 Container，切换时仅改 visible 属性，不销毁重建)
 */
export class SceneManager<TScene extends string = string> {
  private app: Application;
  private scenes: Map<TScene, Container> = new Map();
  private current: TScene | null = null;
  private onSwitchCallback?: (scene: TScene) => void;

  constructor(app: Application, onSwitchCallback?: (scene: TScene) => void) {
    this.app = app;
    this.onSwitchCallback = onSwitchCallback;
  }

  public register(name: TScene, scene: Container): void {
    this.scenes.set(name, scene);
    scene.visible = false;
    this.app.stage.addChild(scene);
  }

  public switchTo(name: TScene): void {
    if (this.current) {
      const prev = this.scenes.get(this.current);
      if (prev) prev.visible = false;
    }
    const next = this.scenes.get(name);
    if (next) {
      next.visible = true;
      this.current = name;
    }
    if (this.onSwitchCallback) {
      this.onSwitchCallback(name);
    }
  }

  public getCurrentScene(): TScene | null {
    return this.current;
  }

  public destroy(): void {
    this.scenes.forEach((scene) => {
      scene.destroy({ children: true });
    });
    this.scenes.clear();
    this.current = null;
  }
}
