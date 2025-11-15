export type AbilityCardType = 'skill' | 'item' | 'rule';

export type CardRarity = 'common' | 'rare' | 'epic';

export type CardTargetSingle = 'self' | 'opponent';

export type CardTarget = CardTargetSingle | 'both';

export type CardEffectDefinition =
  | {
      kind: 'adjustTotal';
      amount: number;
      target?: CardTargetSingle;
    }
  | {
      kind: 'setTotal';
      value: number;
      target?: CardTargetSingle;
    }
  | {
      kind: 'convertToAce';
      target?: CardTargetSingle;
    }
  | {
      kind: 'peekNext';
      count?: number;
    }
  | {
      kind: 'forceDraw';
      target: CardTargetSingle;
    }
  | {
      kind: 'swapFirstCard';
    }
  | {
      kind: 'directDamage';
      amount: number;
      target?: CardTargetSingle;
    }
  | {
      kind: 'addShield';
      amount: number;
    }
  | {
      kind: 'setTargetLimit';
      limit: number;
    }
  | {
      kind: 'restrictCardType';
      cardType: AbilityCardType;
      target: CardTarget;
    };

export type AbilityCardDefinition = {
  id: string;
  name: string;
  type: AbilityCardType;
  rarity: CardRarity;
  description: string;
  effects: CardEffectDefinition[];
  tags?: string[];
};

export type AbilityCardInstance = {
  instanceId: string;
  definition: AbilityCardDefinition;
};

export type AbilityCardState = {
  instanceId: string;
  cardId: string;
  name: string;
  type: AbilityCardType;
  rarity: CardRarity;
  description: string;
};
