import { SceneManager } from '../core/SceneManager.js';
import { MainMenuScene } from '../scenes/MainMenuScene.js';

export class GameEntry {
  private sceneManager: SceneManager | null = null;

  bootstrap(): void {
    const host = document.querySelector<HTMLElement>('[data-app-root]');

    if (!host) {
      throw new Error('Missing [data-app-root] element. Cannot bootstrap game.');
    }

    this.sceneManager = new SceneManager(host);
    this.registerScenes();

    this.sceneManager.start('main-menu');
  }

  private registerScenes(): void {
    if (!this.sceneManager) {
      throw new Error('Scene manager not initialised.');
    }

    const mainMenu = new MainMenuScene({
      onStartNewRun: () => this.handleStartNewRun(),
      onOpenSettings: () => this.handleOpenSettings()
    });

    this.sceneManager.register(mainMenu);
  }

  private handleStartNewRun(): void {
    // Placeholder for future Run Setup or gameplay scene.
    console.info('Run setup scene is not implemented yet.');
  }

  private handleOpenSettings(): void {
    console.info('Settings scene is not implemented yet.');
  }
}
