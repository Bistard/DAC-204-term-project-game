import { Scene, SceneId } from './Scene.js';

export class SceneManager {
  private readonly scenes = new Map<SceneId, Scene>();
  private currentScene: Scene | null = null;

  constructor(private readonly host: HTMLElement) {}

  register(scene: Scene): void {
    if (this.scenes.has(scene.id)) {
      throw new Error(`Scene "${scene.id}" is already registered.`);
    }
    this.scenes.set(scene.id, scene);
  }

  hasScene(id: SceneId): boolean {
    return this.scenes.has(id);
  }

  start(sceneId: SceneId): void {
    if (!this.scenes.has(sceneId)) {
      throw new Error(`Scene "${sceneId}" is not registered.`);
    }
    this.switchTo(sceneId);
  }

  switchTo(sceneId: SceneId): void {
    const nextScene = this.scenes.get(sceneId);
    if (!nextScene) {
      throw new Error(`Scene "${sceneId}" is not registered.`);
    }

    if (this.currentScene?.id === sceneId) {
      return;
    }

    this.teardownCurrentScene();
    this.mountScene(nextScene);
    this.currentScene = nextScene;
  }

  private teardownCurrentScene(): void {
    if (!this.currentScene) {
      return;
    }
    this.currentScene.unmount();
    // Ensure host is cleared even if unmount implementation forgot.
    while (this.host.firstChild) {
      this.host.removeChild(this.host.firstChild);
    }
    this.currentScene = null;
  }

  private mountScene(scene: Scene): void {
    scene.mount(this.host);
  }
}
