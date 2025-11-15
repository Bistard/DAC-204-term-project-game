import { BlackjackEventBus } from './BlackjackEventBus';
import { BlackjackRound, HandView } from './BlackjackRound';
import { BlackjackRules, HandScore, RoundOutcome } from './BlackjackRules';
import { Participant } from './Participant';
import { Deck } from './Deck';
import { AbilityCardEngine } from '../cards/AbilityCardEngine';
import { NoAbilityCardEngine } from '../cards/NoAbilityCardEngine';
import { AbilityCardState } from '../cards/CardTypes';
import { RuleModifierSnapshot } from './RoundModifierState';

export type ActorDecision =
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'playCard'; cardId: string };

export type RoundContext = {
  self: HandView;
  opponent: HandView;
  deckRemaining: number;
  abilityHand: readonly AbilityCardState[];
  ruleSnapshot: RuleModifierSnapshot;
};

export interface ActorStrategy {
  decide(participant: Participant, context: RoundContext): ActorDecision;
}

export type RoundResult = {
  outcome: RoundOutcome;
  player: HandScore;
  enemy: HandScore;
};

export type RunOptions = {
  deck?: Deck;
  abilityEngine?: AbilityCardEngine;
};

export class TurnController {
  constructor(
    private readonly round: BlackjackRound,
    private readonly rules: BlackjackRules,
    private readonly events: BlackjackEventBus
  ) {}

  run(playerStrategy: ActorStrategy, enemyStrategy: ActorStrategy, options: RunOptions = {}): RoundResult {
    this.round.start(options.deck);
    const abilityEngine = options.abilityEngine ?? NoAbilityCardEngine.instance;

    this.executePhase('player', playerStrategy, abilityEngine);
    const playerScore = this.round.getHandScore('player');

    if (playerScore.busted) {
      this.events.emit('bust', { actor: 'player', score: playerScore });
      return this.finishRound();
    }

    this.executePhase('enemy', enemyStrategy, abilityEngine);
    const enemyScore = this.round.getHandScore('enemy');
    if (enemyScore.busted) {
      this.events.emit('bust', { actor: 'enemy', score: enemyScore });
    }

    return this.finishRound();
  }

  private executePhase(participant: Participant, strategy: ActorStrategy, abilityEngine: AbilityCardEngine): void {
    while (true) {
      const score = this.round.getHandScore(participant);
      if (score.busted || this.round.hasStood(participant)) {
        break;
      }

      const context = this.createContext(participant, abilityEngine);
      const decision = strategy.decide(participant, context);

      if (decision.type === 'playCard') {
        const played = abilityEngine.playCard(participant, decision.cardId);
        if (!played) {
          break;
        }
        continue;
      }

      if (decision.type === 'hit') {
        this.round.hit(participant);
      } else {
        this.round.stand(participant);
      }

      if (this.round.isBust(participant)) {
        break;
      }
      if (decision.type === 'stand') {
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

  private createContext(participant: Participant, abilityEngine: AbilityCardEngine): RoundContext {
    const snapshot = this.round.getSnapshot();
    return {
      self: participant === 'player' ? snapshot.player : snapshot.enemy,
      opponent: participant === 'player' ? snapshot.enemy : snapshot.player,
      deckRemaining: snapshot.deckRemaining,
      abilityHand: abilityEngine.getHand(participant),
      ruleSnapshot: abilityEngine.getRuleSnapshot()
    };
  }
}
