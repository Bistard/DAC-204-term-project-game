export type WaveUnlockRule = {
  wave: number;
  enemyId?: string;
  cardId?: string;
};

export type EnemyDefeatUnlockRule = {
  enemyId: string;
  cardId?: string;
};

export const waveUnlockRules: WaveUnlockRule[] = [
  { wave: 2, enemyId: 'corruptor' },
  { wave: 3, enemyId: 'judge-of-void' },
  { wave: 3, cardId: 'hex-force-draw' }
];

export const enemyDefeatUnlockRules: EnemyDefeatUnlockRule[] = [
  { enemyId: 'corruptor', cardId: 'silence-items' },
  { enemyId: 'judge-of-void', cardId: 'mirror-swap' }
];
