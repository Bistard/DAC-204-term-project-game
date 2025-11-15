import { Scene } from '../core/Scene.js';

type MainMenuSceneOptions = {
  onStartNewRun?: () => void;
  onOpenSettings?: () => void;
};

export class MainMenuScene implements Scene {
  readonly id = 'main-menu';

  private root: HTMLElement | null = null;

  constructor(private readonly options: MainMenuSceneOptions = {}) {}

  mount(container: HTMLElement): void {
    this.root = this.createView();
    container.appendChild(this.root);
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
  }

  private createView(): HTMLElement {
    const wrapper = document.createElement('section');
    wrapper.className = 'scene scene--main-menu';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'main-menu__title-block';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Prototype Build';

    const title = document.createElement('h1');
    title.textContent = 'LAST HAND';

    const subtitle = document.createElement('p');
    subtitle.className = 'lede';
    subtitle.textContent = 'Blackjack-inspired survival roguelike. Choose your action and chase wave records.';

    titleBlock.append(eyebrow, title, subtitle);

    const actions = document.createElement('div');
    actions.className = 'main-menu__actions';

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'primary';
    startButton.textContent = 'Start Survival Run';
    startButton.addEventListener('click', () => {
      this.options.onStartNewRun?.();
    });

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'secondary';
    settingsButton.textContent = 'Settings (soon)';
    settingsButton.disabled = !this.options.onOpenSettings;
    settingsButton.addEventListener('click', () => {
      this.options.onOpenSettings?.();
    });

    actions.append(startButton, settingsButton);

    wrapper.append(titleBlock, actions);
    return wrapper;
  }
}
