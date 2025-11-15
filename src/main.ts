type FeatureCard = {
  title: string;
  description: string;
  action: string;
};

const featureCards: FeatureCard[] = [
  {
    title: 'Playable Prototype Ready',
    description: 'Start from a TypeScript entry file that wires up UI placeholders and event hooks so you can iterate quickly.',
    action: 'Open the project in your editor to begin iterating.'
  },
  {
    title: 'Zero Backend Dependencies',
    description: 'Everything compiles down to plain HTML, CSS, and JavaScript so it can be hosted anywhere, including GitHub Pages.',
    action: 'Deploy by pushing to the main branch - CI handles the rest.'
  },
  {
    title: 'Fast Local Loop',
    description: 'Use the dev script to rebuild TypeScript on save and preview the result through a lightweight static server.',
    action: 'Run the preview command after building for a static-site-like experience.'
  }
];

const shuffle = <T>(items: T[]): T[] => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const renderCards = (cards: FeatureCard[]): void => {
  const grid = document.querySelector<HTMLDivElement>('[data-feature-grid]');
  if (!grid) return;

  grid.innerHTML = cards
    .map((card) => `
      <article class="feature-card">
        <h3>${card.title}</h3>
        <p>${card.description}</p>
        <small>${card.action}</small>
      </article>
    `)
    .join('');
};

const updateStatus = (message: string): void => {
  const status = document.querySelector<HTMLSpanElement>('[data-status]');
  if (!status) return;
  status.textContent = message;
};

const main = (): void => {
  renderCards(featureCards);
  updateStatus('Ready to prototype');

  const refreshButton = document.querySelector<HTMLButtonElement>('[data-refresh]');
  refreshButton?.addEventListener('click', () => {
    const [first, second, third] = shuffle(featureCards);
    renderCards([first, second, third]);
    updateStatus('Layout refreshed');
  });
};

document.addEventListener('DOMContentLoaded', main);
