import { ActorStrategy, ActorDecision, RoundContext } from '../TurnController';
import { Participant } from '../Participant';

type ThresholdStrategyOptions = {
  cardPlayThreshold?: number;
};

export class ThresholdStrategy implements ActorStrategy {
  constructor(private readonly standThreshold: number, private readonly options: ThresholdStrategyOptions = {}) {}

  decide(participant: Participant, context: RoundContext): ActorDecision {
    if (context.self.score.busted) {
      return { type: 'stand' };
    }

    if (this.shouldPlayCard(participant, context)) {
      return { type: 'playCard', cardId: context.abilityHand[0].instanceId };
    }

    const total = context.self.score.total;
    return total >= this.standThreshold ? { type: 'stand' } : { type: 'hit' };
  }

  private shouldPlayCard(participant: Participant, context: RoundContext): boolean {
    if (context.abilityHand.length === 0) {
      return false;
    }
    const threshold = this.options.cardPlayThreshold;
    if (typeof threshold !== 'number') {
      return false;
    }
    if (context.self.score.total > threshold) {
      return false;
    }
    const candidate = context.abilityHand[0];
    const blocked = context.ruleSnapshot.blockedCardTypes[participant].includes(candidate.type);
    return !blocked;
  }
}
