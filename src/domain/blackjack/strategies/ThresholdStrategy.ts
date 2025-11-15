import { ActorStrategy, Decision, RoundContext } from '../TurnController';
import { Participant } from '../Participant';

export class ThresholdStrategy implements ActorStrategy {
  constructor(private readonly standThreshold: number) {}

  decide(_: Participant, context: RoundContext): Decision {
    const total = context.self.score.total;
    if (context.self.score.busted) {
      return 'stand';
    }
    return total >= this.standThreshold ? 'stand' : 'hit';
  }
}
