import { BlackjackEventBus } from './BlackjackEventBus';
import { BlackjackRound, HandView } from './BlackjackRound';
import { BlackjackRules, HandScore, RoundOutcome } from './BlackjackRules';
import { Participant } from './Participant';
import { Deck } from './Deck';

export type Decision = 'hit' | 'stand';

export type RoundContext = {
  self: HandView;
  opponent: HandView;
  deckRemaining: number;
};

export interface ActorStrategy {
  decide(participant: Participant, context: RoundContext): Decision;
}

export type RoundResult = {
  outcome: RoundOutcome;
  player: HandScore;
  enemy: HandScore;
};

export type RunOptions = {
  deck?: Deck;
};

export class TurnController {
  constructor(
    private readonly round: BlackjackRound,
    private readonly rules: BlackjackRules,
    private readonly events: BlackjackEventBus
  ) {}

  run(playerStrategy: ActorStrategy, enemyStrategy: ActorStrategy, options: RunOptions = {}): RoundResult {
    this.round.start(options.deck);

    this.executePhase('player', playerStrategy);
    const playerScore = this.round.getHandScore('player');

    if (playerScore.busted) {
      this.events.emit('bust', { actor: 'player', score: playerScore });
      return this.finishRound();
    }

    this.executePhase('enemy', enemyStrategy);
    const enemyScore = this.round.getHandScore('enemy');
    if (enemyScore.busted) {
      this.events.emit('bust', { actor: 'enemy', score: enemyScore });
    }

    return this.finishRound();
  }

  private executePhase(participant: Participant, strategy: ActorStrategy): void {
    while (true) {
      const score = this.round.getHandScore(participant);
      if (score.busted || this.round.hasStood(participant)) {
        break;
      }

      const context = this.createContext(participant);
      const decision = strategy.decide(participant, context);

      if (decision === 'hit') {
        this.round.hit(participant);
      } else {
        this.round.stand(participant);
      }

      if (this.round.isBust(participant)) {
        break;
      }
      if (decision === 'stand') {
        break;
      }
    }
  }

  private finishRound(): RoundResult {
    const player = this.round.getHandScore('player');
    const enemy = this.round.getHandScore('enemy');
    const outcome = this.rules.determineOutcome(player, enemy);
    this.events.emit('roundEnd', { outcome, player, enemy });
    return { outcome, player, enemy };
  }

  private createContext(participant: Participant): RoundContext {
    const snapshot = this.round.getSnapshot();
    return {
      self: participant === 'player' ? snapshot.player : snapshot.enemy,
      opponent: participant === 'player' ? snapshot.enemy : snapshot.player,
      deckRemaining: snapshot.deckRemaining
    };
  }
}
