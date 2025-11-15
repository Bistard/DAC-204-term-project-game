import { AbilityCardEngine } from './AbilityCardEngine';
import { AbilityCardState } from './CardTypes';
import { Participant } from '../blackjack/Participant';
import { RuleModifierSnapshot } from '../blackjack/RoundModifierState';

const emptyRuleSnapshot: RuleModifierSnapshot = {
  targetLimit: 21,
  blockedCardTypes: {
    player: [],
    enemy: []
  }
};

export class NoAbilityCardEngine implements AbilityCardEngine {
  private static _instance: NoAbilityCardEngine | null = null;

  static get instance(): NoAbilityCardEngine {
    if (!this._instance) {
      this._instance = new NoAbilityCardEngine();
    }
    return this._instance;
  }

  private constructor() {}

  getHand(_: Participant): readonly AbilityCardState[] {
    return [];
  }

  playCard(): boolean {
    return false;
  }

  getRuleSnapshot(): RuleModifierSnapshot {
    return emptyRuleSnapshot;
  }
}
