import { AbilityCardDefinition } from '../../domain/cards/CardTypes';
import { getAbilityCardsById } from '../cards/abilityCards';

export type HeroDefinition = {
  id: string;
  name: string;
  baseMaxHp: number;
  baseAttack: number;
  baseStrategy: {
    type: 'threshold';
    standThreshold: number;
  };
  startingAbilityCardIds: string[];
};

export const defaultHeroDefinition: HeroDefinition = {
  id: 'default-analyst',
  name: 'Data Analyst',
  baseMaxHp: 60,
  baseAttack: 12,
  baseStrategy: {
    type: 'threshold',
    standThreshold: 17
  },
  startingAbilityCardIds: ['tune-plus-one', 'tune-minus-one', 'guardian-wall']
};

export const getStartingAbilityCards = (definition: HeroDefinition): AbilityCardDefinition[] =>
  getAbilityCardsById(definition.startingAbilityCardIds);
