export type UpgradeKind = 'maxHp' | 'baseAttack' | 'startingCard' | 'unlockCard' | 'unlockEnemy';

export type UpgradeDefinition = {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: UpgradeKind;
  amount?: number;
  cardId?: string;
  enemyId?: string;
  requires?: string[];
};

export const upgradeDefinitions: UpgradeDefinition[] = [
  {
    id: 'maxhp-1',
    name: 'Conditioning I',
    description: 'Increase max HP by 10.',
    cost: 120,
    kind: 'maxHp',
    amount: 10
  },
  {
    id: 'maxhp-2',
    name: 'Conditioning II',
    description: 'Increase max HP by another 10.',
    cost: 220,
    kind: 'maxHp',
    amount: 10,
    requires: ['maxhp-1']
  },
  {
    id: 'attack-1',
    name: 'Sharp Instincts',
    description: 'Increase base attack by 3.',
    cost: 150,
    kind: 'baseAttack',
    amount: 3
  },
  {
    id: 'startcard-rupture',
    name: 'Carry: Rupture Strike',
    description: 'Start each run with Rupture Strike.',
    cost: 180,
    kind: 'startingCard',
    cardId: 'rupture-strike'
  },
  {
    id: 'unlock-card-void',
    name: 'Unlock: Void Threshold',
    description: 'Unlock the Void Threshold card for drops.',
    cost: 250,
    kind: 'unlockCard',
    cardId: 'void-limit'
  },
  {
    id: 'unlock-enemy-corruptor',
    name: 'Unlock: Corruptor',
    description: 'Allow Corruptor to appear in runs.',
    cost: 0,
    kind: 'unlockEnemy',
    enemyId: 'corruptor',
    requires: []
  }
];

export const getUpgradeDefinition = (id: string): UpgradeDefinition | undefined =>
  upgradeDefinitions.find((upgrade) => upgrade.id === id);
