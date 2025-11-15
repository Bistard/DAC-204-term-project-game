import { Enemy } from '../Enemy';
import { ThresholdStrategy } from '../../blackjack/strategies/ThresholdStrategy';
import { getAbilityCardsById } from '../../../content/cards/abilityCards';

export class GreedyGhost extends Enemy {
  constructor() {
    super({
      name: 'Greedy Ghost',
      maxHp: 45,
      baseAttack: 12,
      description: 'Draws aggressively to chase 18+ totals and hits hard on busts.',
      strategy: new ThresholdStrategy(18, { cardPlayThreshold: 15 })
    });
    this.setAbilityLoadout(getAbilityCardsById(['hex-force-draw', 'tune-plus-one']));
  }
}
