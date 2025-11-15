import { Enemy } from './Enemy';
import { enemyDefinitions, EnemyDefinition, EnemyStrategyDefinition, EnemyBehaviorDefinition } from '../../content/enemies/enemyDefinitions';
import { AbilityCardDefinition } from '../cards/CardTypes';
import { getAbilityCardsById } from '../../content/cards/abilityCards';
import { ThresholdStrategy } from '../blackjack/strategies/ThresholdStrategy';
import { CorruptCardBehavior, EnemyBehavior, SwapFirstCardBehavior } from './EnemyBehavior';

export type EnemyFactoryOptions = {
  waveNumber?: number;
};

const DEFAULT_DEFINITIONS: EnemyDefinition[] = enemyDefinitions;

export class EnemyFactory {
  constructor(private readonly definitions: EnemyDefinition[] = DEFAULT_DEFINITIONS) {}

  create(id: string, options: EnemyFactoryOptions = {}): Enemy {
    const definition = this.getDefinition(id);
    if (!definition) {
      throw new Error(`Enemy definition "${id}" not found.`);
    }

    const scale = this.getScaleFactor(definition, options.waveNumber);
    const maxHp = Math.round(definition.maxHp * scale.hp);
    const baseAttack = Math.round(definition.baseAttack * scale.attack);
    const strategy = this.createStrategy(definition.strategy);

    const enemy = new Enemy({
      name: definition.name,
      maxHp,
      baseAttack,
      description: definition.description,
      strategy
    });

    const loadout = this.getAbilityCards(definition.abilityCardIds);
    enemy.setAbilityLoadout(loadout);
    enemy.setBehaviors(this.createBehaviors(definition.behaviors));

    return enemy;
  }

  pickForWave(waveNumber: number): EnemyDefinition {
    const available = this.getUnlockedDefinitions(waveNumber);
    if (available.length === 0) {
      throw new Error(`No enemies unlocked for wave ${waveNumber}`);
    }
    const index = (waveNumber - 1) % available.length;
    return available[index];
  }

  getUnlockedDefinitions(waveNumber: number): EnemyDefinition[] {
    return this.definitions.filter((def) => def.unlockWave <= waveNumber);
  }

  getDefinition(id: string): EnemyDefinition | undefined {
    return this.definitions.find((def) => def.id === id);
  }

  listDefinitions(): EnemyDefinition[] {
    return [...this.definitions];
  }

  private getAbilityCards(ids: string[]): AbilityCardDefinition[] {
    return getAbilityCardsById(ids);
  }

  private getScaleFactor(definition: EnemyDefinition, waveNumber?: number): { hp: number; attack: number } {
    if (!waveNumber || waveNumber <= definition.unlockWave) {
      return { hp: 1, attack: 1 };
    }
    const extraWaves = waveNumber - definition.unlockWave;
    const hpScale = 1 + extraWaves * 0.08;
    const attackScale = 1 + extraWaves * 0.05;
    return { hp: hpScale, attack: attackScale };
  }

  private createStrategy(definition: EnemyStrategyDefinition) {
    switch (definition.type) {
      case 'threshold':
        return new ThresholdStrategy(definition.standThreshold, {
          cardPlayThreshold: definition.cardPlayThreshold
        });
      default:
        throw new Error(`Unknown strategy type: ${definition.type}`);
    }
  }

  private createBehaviors(definitions?: EnemyBehaviorDefinition[]): EnemyBehavior[] {
    if (!definitions || definitions.length === 0) {
      return [];
    }
    return definitions.map((def) => {
      switch (def.kind) {
        case 'corruptCard':
          return new CorruptCardBehavior();
        case 'swapFirstCard':
          return new SwapFirstCardBehavior();
        default:
          return {
            onRoundStart: () => {}
          };
      }
    });
  }
}
