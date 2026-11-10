import { gameEvents, runWxGame } from 'alloy2d';
import { suikaAssetManager } from './assets/SuikaAssetManager';
import { DESIGN_HEIGHT, DESIGN_WIDTH, SuikaGameSystem } from './systems/SuikaGameSystem';
import { SuikaCanvasUISystem } from './systems/SuikaCanvasUISystem';

runWxGame({
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  backgroundColor: 0xffedd5,
  loadAssets: () => suikaAssetManager.initAtlas(),
  reloadAssets: async () => {
    suikaAssetManager.destroy();
    await suikaAssetManager.initAtlas();
  },
  setup: (app) => {
    const gameSystem = new SuikaGameSystem();
    const uiSystem = new SuikaCanvasUISystem();

    app.stage.addChild(gameSystem.rootContainer);
    app.stage.addChild(uiSystem.uiContainer);
    app.stage.addChild(uiSystem.modalLayer);

    gameSystem.initGame();

    const unsubRestart = gameEvents.on('suika-restart', () => {
      gameSystem.initGame();
    });

    return {
      update: (delta) => {
        gameSystem.update(delta);
      },
      onLayout: () => {
        uiSystem.applySafeAreaLayout();
      },
    };
  },
});
