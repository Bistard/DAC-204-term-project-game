export interface Scene {
  readonly id: string;
  mount(container: HTMLElement): void;
  unmount(): void;
}

export type SceneId = Scene['id'];
