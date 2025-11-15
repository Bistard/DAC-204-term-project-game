import { AbilityCardState } from './CardTypes';
import { Participant } from '../blackjack/Participant';
import { RuleModifierSnapshot } from '../blackjack/RoundModifierState';

export interface AbilityCardEngine {
  getHand(participant: Participant): readonly AbilityCardState[];
  playCard(participant: Participant, cardInstanceId: string): boolean;
  getRuleSnapshot(): RuleModifierSnapshot;
}
