import { Player } from '../combat/Player';
import { EnemyFactory } from '../combat/EnemyFactory';
import { BattleRunner } from '../combat/BattleRunner';
import { Deck } from '../blackjack/Deck';

export type SurvivalWaveLog = {
  wave: number;
  enemyId: string;
  enemyName: string;
  difficulty: number;
  rounds: number;
  victory: boolean;
  playerHp: number;
};

export type SurvivalRunResult = {
  completedWaves: number;
  playerAlive: boolean;
  waves: SurvivalWaveLog[];
};

export type SurvivalOptions = {
  maxWaves?: number;
  battleDecks?: Deck[][];
};

export class SurvivalModeController {
  constructor(private readonly battleRunner: BattleRunner, private readonly enemyFactory: EnemyFactory) {}

  run(player: Player, options: SurvivalOptions = {}): SurvivalRunResult {
    const maxWaves = options.maxWaves ?? Number.POSITIVE_INFINITY;
    const waves: SurvivalWaveLog[] = [];

    player.reset();

    for (let wave = 1; wave <= maxWaves; wave += 1) {
      if (player.isDefeated()) {
        break;
      }

      const definition = this.enemyFactory.pickForWave(wave);
      const enemy = this.enemyFactory.create(definition.id, { waveNumber: wave });

      const deckSequence = options.battleDecks?.[wave - 1];

      const battle = this.battleRunner.fight(player, enemy, {
        resetPlayer: wave === 1,
        resetEnemy: true,
        deckSequence
      });

      const victory = battle.winner === 'player';
      waves.push({
        wave,
        enemyId: definition.id,
        enemyName: definition.name,
        difficulty: definition.difficulty,
        rounds: battle.rounds,
        victory,
        playerHp: player.currentHp
      });

      if (!victory) {
        break;
      }
    }

    return {
      completedWaves: waves.filter((wave) => wave.victory).length,
      playerAlive: !player.isDefeated(),
      waves
    };
  }
}
