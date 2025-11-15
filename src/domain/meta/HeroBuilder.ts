import { HeroDefinition, getStartingAbilityCards } from '../../content/player/heroes';
import { MetaProgressionState } from './MetaProgressionState';
import { UpgradeEngine } from './UpgradeEngine';
import { Player } from '../combat/Player';
import { ThresholdStrategy } from '../blackjack/strategies/ThresholdStrategy';
import { getAbilityCardsById } from '../../content/cards/abilityCards';

export class HeroBuilder {
  constructor(private readonly definition: HeroDefinition, private readonly upgradeEngine: UpgradeEngine) {}

  build(metaState: MetaProgressionState): Player {
    const heroStats = this.upgradeEngine.applyToHero(this.definition, metaState);
    const strategy = new ThresholdStrategy(this.definition.baseStrategy.standThreshold, { cardPlayThreshold: 15 });
    const player = new Player({
      name: this.definition.name,
      maxHp: heroStats.maxHp,
      baseAttack: heroStats.baseAttack,
      strategy
    });

    const startingCards = getAbilityCardsById(heroStats.abilityCardIds);
    player.setAbilityLoadout(startingCards);

    return player;
  }
}
