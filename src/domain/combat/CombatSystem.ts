import { TurnController, RunOptions, RoundResult } from '../blackjack/TurnController';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { CombatConfig, DEFAULT_COMBAT_CONFIG } from './CombatConfig';
import { RoundOutcome, HandScore } from '../blackjack/BlackjackRules';
import { Participant } from '../blackjack/Participant';

export type CombatRoundSummary = {
  outcome: RoundOutcome;
  reason: 'standard' | 'bust' | 'push';
  targetId: Participant | null;
  damage: number;
  playerScore: HandScore;
  enemyScore: HandScore;
  playerHp: number;
  enemyHp: number;
};

export class CombatSystem {
  constructor(private readonly controller: TurnController, private readonly config: CombatConfig = DEFAULT_COMBAT_CONFIG) {}

  executeRound(player: Player, enemy: Enemy, options?: RunOptions): CombatRoundSummary {
    const result = this.controller.run(player.strategy, enemy.strategy, options);
    return this.resolveDamage(result, player, enemy);
  }

  private resolveDamage(result: RoundResult, player: Player, enemy: Enemy): CombatRoundSummary {
    const { outcome, player: playerScore, enemy: enemyScore } = result;

    let reason: CombatRoundSummary['reason'] = 'standard';
    let target: Player | Enemy | null = null;
    let attackerBaseAttack = 0;

    switch (outcome) {
      case 'playerWin':
        target = enemy;
        attackerBaseAttack = player.baseAttack;
        reason = enemyScore.busted ? 'bust' : 'standard';
        break;
      case 'enemyWin':
        target = player;
        attackerBaseAttack = enemy.baseAttack;
        reason = playerScore.busted ? 'bust' : 'standard';
        break;
      case 'push':
        reason = 'push';
        target = null;
        attackerBaseAttack = 0;
        break;
    }

    let damage = 0;
    if (target && attackerBaseAttack > 0) {
      const multiplier = reason === 'bust' ? this.config.bustDamageMultiplier : 1;
      damage = Math.round(attackerBaseAttack * multiplier);
      const applied = target.applyDamage(damage);
      console.info(
        `[Combat] ${reason === 'bust' ? 'Bust penalty' : 'Hit'}: ${target.name} takes ${applied} damage (${target.currentHp}/${target.maxHp} HP left)`
      );
    }

    return {
      outcome,
      reason,
      targetId: target?.id ?? null,
      damage,
      playerScore,
      enemyScore,
      playerHp: player.currentHp,
      enemyHp: enemy.currentHp
    };
  }
}
