import { Enemy } from '../Enemy';
import { ThresholdStrategy } from '../../blackjack/strategies/ThresholdStrategy';

export class GreedyGhost extends Enemy {
  constructor() {
    super({
      name: 'Greedy Ghost',
      maxHp: 45,
      baseAttack: 12,
      description: 'Draws aggressively to chase 18+ totals and hits hard on busts.',
      strategy: new ThresholdStrategy(18)
    });
  }
}
