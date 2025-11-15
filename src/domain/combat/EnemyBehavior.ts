import { BlackjackRound } from '../blackjack/BlackjackRound';
import { Player } from './Player';
import { Enemy } from './Enemy';

export type EnemyBehaviorContext = {
  round: BlackjackRound;
  player: Player;
  enemy: Enemy;
};

export interface EnemyBehavior {
  onRoundStart?(context: EnemyBehaviorContext): void;
  onBeforeEnemyTurn?(context: EnemyBehaviorContext): void;
}

export class CorruptCardBehavior implements EnemyBehavior {
  constructor(private readonly logLabel = 'Corruptor') {}

  onRoundStart(context: EnemyBehaviorContext): void {
    this.corrupt(context);
  }

  onBeforeEnemyTurn(context: EnemyBehaviorContext): void {
    this.corrupt(context);
  }

  private corrupt(context: EnemyBehaviorContext): void {
    const success = context.round.downgradeHighestCard('player');
    if (success) {
      console.info(`[EnemyBehavior:${this.logLabel}] Corrupted one of the player's cards.`);
    }
  }
}

export class SwapFirstCardBehavior implements EnemyBehavior {
  constructor(private readonly logLabel = 'JudgeOfVoid') {}

  onRoundStart(context: EnemyBehaviorContext): void {
    const swapped = context.round.swapFirstCards();
    if (swapped) {
      console.info(`[EnemyBehavior:${this.logLabel}] Swapped the first visible card with the player.`);
    }
  }
}
