import { Enemy } from '../Enemy';
import { ThresholdStrategy } from '../../blackjack/strategies/ThresholdStrategy';

export class DefensiveEnemy extends Enemy {
  constructor() {
    super({
      name: 'Defensive Warden',
      maxHp: 55,
      baseAttack: 9,
      description: 'Plays safe and stands on lower totals to avoid busts.',
      strategy: new ThresholdStrategy(16)
    });
  }
}
