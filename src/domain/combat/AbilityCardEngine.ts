import { AbilityCardEngine } from '../cards/AbilityCardEngine';
import { AbilityCardState } from '../cards/CardTypes';
import { Participant, getOpponent } from '../blackjack/Participant';
import { BlackjackRound } from '../blackjack/BlackjackRound';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';
import { AbilityCardInstance } from '../cards/CardTypes';

const toState = (instance: AbilityCardInstance): AbilityCardState => ({
  instanceId: instance.instanceId,
  cardId: instance.definition.id,
  name: instance.definition.name,
  type: instance.definition.type,
  rarity: instance.definition.rarity,
  description: instance.definition.description
});

export class CombatAbilityCardEngine implements AbilityCardEngine {
  constructor(
    private readonly round: BlackjackRound,
    private readonly player: Player,
    private readonly enemy: Enemy,
    private readonly executor: CardEffectExecutor
  ) {}

  getHand(participant: Participant): readonly AbilityCardState[] {
    return this.getCombatant(participant)
      .getAbilityCards()
      .map((instance) => toState(instance));
  }

  playCard(participant: Participant, cardInstanceId: string): boolean {
    const combatant = this.getCombatant(participant);
    const card = combatant.useAbilityCard(cardInstanceId);
    if (!card) {
      return false;
    }

    if (this.round.getModifiers().isCardTypeBlocked(participant, card.definition.type)) {
      combatant.returnAbilityCard(card);
      return false;
    }

    const opponent = this.getCombatant(getOpponent(participant));
    const result = this.executor.execute(card.definition, {
      round: this.round,
      user: combatant,
      opponent,
      modifiers: this.round.getModifiers()
    });

    if (!result.success) {
      combatant.returnAbilityCard(card);
      return false;
    }

    return true;
  }

  getRuleSnapshot() {
    return this.round.getModifiers().getSnapshot();
  }

  private getCombatant(participant: Participant): Player | Enemy {
    return participant === 'player' ? this.player : this.enemy;
  }
}
