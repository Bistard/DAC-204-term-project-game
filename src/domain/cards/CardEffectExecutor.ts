import { AbilityCardDefinition, CardEffectDefinition, CardTarget, CardTargetSingle } from './CardTypes';
import { BlackjackRound } from '../blackjack/BlackjackRound';
import { Combatant } from '../combat/Combatant';
import { RoundModifierState } from '../blackjack/RoundModifierState';
import { Participant, getOpponent } from '../blackjack/Participant';

export type CardEffectContext = {
  round: BlackjackRound;
  user: Combatant;
  opponent: Combatant;
  modifiers: RoundModifierState;
};

export type CardEffectResult = {
  success: boolean;
  messages: string[];
};

export class CardEffectExecutor {
  execute(card: AbilityCardDefinition, context: CardEffectContext): CardEffectResult {
    const messages: string[] = [];

    for (const effect of card.effects) {
      const applied = this.applyEffect(effect, card, context, messages);
      if (!applied) {
        return { success: false, messages };
      }
    }

    messages.forEach((msg) => console.info(`[CardEffect] ${msg}`));
    return { success: true, messages };
  }

  private applyEffect(
    effect: CardEffectDefinition,
    card: AbilityCardDefinition,
    context: CardEffectContext,
    messages: string[]
  ): boolean {
    switch (effect.kind) {
      case 'adjustTotal': {
        const target = this.resolveParticipant(effect.target, context);
        context.modifiers.adjustTotal(target, effect.amount);
        messages.push(`${card.name}: adjusted ${target} total by ${effect.amount}`);
        return true;
      }
      case 'setTotal': {
        const target = this.resolveParticipant(effect.target, context);
        context.modifiers.setTotalOverride(target, effect.value);
        messages.push(`${card.name}: set ${target} total to ${effect.value}`);
        return true;
      }
      case 'convertToAce': {
        const target = this.resolveParticipant(effect.target, context);
        const success = context.round.convertHighestCardToAce(target);
        messages.push(
          success ? `${card.name}: converted ${target}'s highest card to Ace` : `${card.name}: no non-Ace card to convert`
        );
        return true;
      }
      case 'peekNext': {
        const cards = context.round.peekUpcomingCards(effect.count ?? 1);
        messages.push(`${card.name}: peeked cards ${cards.map((c) => `${c.rank}${c.suit[0]}`).join(', ')}.`);
        return true;
      }
      case 'forceDraw': {
        const target = this.resolveParticipant(effect.target, context);
        context.round.forceDraw(target);
        messages.push(`${card.name}: forced ${target} to draw.`);
        return true;
      }
      case 'swapFirstCard': {
        const swapped = context.round.swapFirstCards();
        messages.push(swapped ? `${card.name}: swapped leading cards.` : `${card.name}: swap failed.`);
        return swapped;
      }
      case 'directDamage': {
        const target = this.resolveCombatant(effect.target ?? 'opponent', context);
        const actual = target.applyDamage(effect.amount);
        messages.push(`${card.name}: dealt ${actual} damage to ${target.name}.`);
        return true;
      }
      case 'addShield': {
        context.user.addShield(effect.amount);
        messages.push(`${card.name}: gained ${effect.amount} shield.`);
        return true;
      }
      case 'setTargetLimit': {
        context.modifiers.setTargetLimit(effect.limit);
        messages.push(`${card.name}: set target limit to ${effect.limit}.`);
        return true;
      }
      case 'restrictCardType': {
        const targets = this.resolveParticipantsForRestriction(effect.target, context);
        for (const target of targets) {
          context.modifiers.blockCardType(target, effect.cardType);
        }
        messages.push(
          `${card.name}: restricted ${effect.cardType} cards for ${targets.join(' & ')} for this round.`
        );
        return true;
      }
      default:
        return false;
    }
  }

  private resolveParticipant(target: CardTargetSingle | undefined, context: CardEffectContext): Participant {
    if (!target || target === 'self') {
      return context.user.id;
    }
    if (target === 'opponent') {
      return getOpponent(context.user.id);
    }
    return context.user.id;
  }

  private resolveCombatant(target: CardTargetSingle, context: CardEffectContext): Combatant {
    return target === 'self' ? context.user : context.opponent;
  }

  private resolveParticipantsForRestriction(target: CardTarget, context: CardEffectContext): Participant[] {
    if (target === 'both') {
      return [context.user.id, context.opponent.id];
    }
    if (target === 'self') {
      return [context.user.id];
    }
    if (target === 'opponent') {
      return [context.opponent.id];
    }
    return [context.user.id];
  }
}
