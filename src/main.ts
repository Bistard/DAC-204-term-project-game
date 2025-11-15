import { GameEntry } from './game/GameEntry.js';

const run = (): void => {
  const gameEntry = new GameEntry();

  try {
    gameEntry.bootstrap();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GameEntry] Bootstrap failed:', message);
  }
};

document.addEventListener('DOMContentLoaded', run);
