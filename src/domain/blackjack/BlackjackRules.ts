import { Card, getRankValue } from './Card';

export type HandScore = {
  total: number;
  soft: boolean;
  busted: boolean;
};

export type RoundOutcome = 'playerWin' | 'enemyWin' | 'push';

export class BlackjackRules {
  calculateScore(cards: readonly Card[], targetLimit = 21): HandScore {
    let total = 0;
    let aceCount = 0;

    for (const card of cards) {
      total += getRankValue(card.rank);
      if (card.rank === 'A') {
        aceCount += 1;
      }
    }

    let soft = aceCount > 0;
    while (total > targetLimit && aceCount > 0) {
      total -= 10;
      aceCount -= 1;
      if (aceCount === 0) {
        soft = false;
      }
    }

    const busted = total > targetLimit;
    if (busted) {
      soft = false;
    }

    return { total, soft, busted };
  }

  determineOutcome(player: HandScore, enemy: HandScore): RoundOutcome {
    if (player.busted && enemy.busted) {
      return 'push';
    }
    if (player.busted) {
      return 'enemyWin';
    }
    if (enemy.busted) {
      return 'playerWin';
    }
    if (player.total === enemy.total) {
      return 'push';
    }
    return player.total > enemy.total ? 'playerWin' : 'enemyWin';
  }
}
