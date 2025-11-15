import { CombatSystem, CombatRoundSummary } from './CombatSystem';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { Deck } from '../blackjack/Deck';

export type BattleLogEntry = CombatRoundSummary & {
  round: number;
};

export type BattleResult = {
  winner: 'player' | 'enemy' | 'none';
  rounds: number;
  log: BattleLogEntry[];
};

export type BattleOptions = {
  maxRounds?: number;
  deckSequence?: Deck[];
};

export class BattleRunner {
  constructor(private readonly combatSystem: CombatSystem) {}

  fight(player: Player, enemy: Enemy, options: BattleOptions = {}): BattleResult {
    player.reset();
    enemy.reset();

    const battleLog: BattleLogEntry[] = [];
    const maxRounds = options.maxRounds ?? 50;
    const deckSequence = options.deckSequence ? [...options.deckSequence] : [];

    for (let roundIndex = 1; roundIndex <= maxRounds; roundIndex += 1) {
      if (player.isDefeated() || enemy.isDefeated()) {
        break;
      }

      const deckOverride = deckSequence.shift();
      const summary = this.combatSystem.executeRound(player, enemy, deckOverride ? { deck: deckOverride } : undefined);
      battleLog.push({ round: roundIndex, ...summary });

      if (player.isDefeated() || enemy.isDefeated()) {
        break;
      }
    }

    const winner = player.isDefeated() ? (enemy.isDefeated() ? 'none' : 'enemy') : enemy.isDefeated() ? 'player' : 'none';

    return {
      winner,
      rounds: battleLog.length,
      log: battleLog
    };
  }
}
