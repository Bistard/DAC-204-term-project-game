import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { BlackjackEventBus } from '../../src/domain/blackjack/BlackjackEventBus';
import { TurnController, ActorStrategy, ActorDecision, RoundContext } from '../../src/domain/blackjack/TurnController';
import { CardEffectExecutor } from '../../src/domain/cards/CardEffectExecutor';
import { CombatAbilityCardEngine } from '../../src/domain/combat/AbilityCardEngine';
import { Player } from '../../src/domain/combat/Player';
import { Enemy } from '../../src/domain/combat/Enemy';
import { getAbilityCardsById } from '../../src/content/cards/abilityCards';
import { Deck } from '../../src/domain/blackjack/Deck';
import { createCard } from '../../src/domain/blackjack/Card';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';

class CardFirstStrategy implements ActorStrategy {
  private cardPlayed = false;
  decide(_: 'player' | 'enemy', context: RoundContext): ActorDecision {
    if (!this.cardPlayed && context.abilityHand.length > 0) {
      this.cardPlayed = true;
      return { type: 'playCard', cardId: context.abilityHand[0].instanceId };
    }
    return { type: 'stand' };
  }
}

class CardThenHitStrategy implements ActorStrategy {
  private phase: 'card' | 'hit' | 'stand' = 'card';
  decide(_: 'player' | 'enemy', context: RoundContext): ActorDecision {
    if (this.phase === 'card' && context.abilityHand.length > 0) {
      this.phase = 'hit';
      return { type: 'playCard', cardId: context.abilityHand[0].instanceId };
    }
    if (this.phase === 'hit') {
      this.phase = 'stand';
      return { type: 'hit' };
    }
    return { type: 'stand' };
  }
}

const createCore = () => {
  const rules = new BlackjackRules();
  const round = new BlackjackRound(undefined, rules);
  const bus = new BlackjackEventBus();
  const controller = new TurnController(round, rules, bus);
  const executor = new CardEffectExecutor();
  return { round, controller, executor };
};

(() => {
  // Force draw causes enemy bust during player phase.
  const { round, controller, executor } = createCore();
  const player = new Player({
    maxHp: 30,
    baseAttack: 0,
    strategy: new CardFirstStrategy()
  });
  player.setAbilityLoadout(getAbilityCardsById(['hex-force-draw']));

  const enemy = new Enemy({
    name: 'Dummy',
    maxHp: 30,
    baseAttack: 0,
    strategy: new ThresholdStrategy(17)
  });

  const abilityEngine = new CombatAbilityCardEngine(round, player, enemy, executor);
  const deck = Deck.fromTopDown([
    createCard('10', 'hearts'),
    createCard('9', 'spades'),
    createCard('7', 'diamonds'),
    createCard('6', 'hearts'),
    createCard('10', 'clubs')
  ]);

  const result = controller.run(player.strategy, enemy.strategy, {
    deck,
    abilityEngine
  });

  assert.equal(result.outcome, 'playerWin');
  assert.equal(result.enemy.busted, true);
})();

(() => {
  // Void limit increases target threshold allowing player to hit 23 safely.
  const { round, controller, executor } = createCore();
  const player = new Player({
    maxHp: 30,
    baseAttack: 0,
    strategy: new CardThenHitStrategy()
  });
  player.setAbilityLoadout(getAbilityCardsById(['void-limit']));

  const enemy = new Enemy({
    name: 'Dummy',
    maxHp: 30,
    baseAttack: 0,
    strategy: new ThresholdStrategy(17)
  });

  const abilityEngine = new CombatAbilityCardEngine(round, player, enemy, executor);
  const deck = Deck.fromTopDown([
    createCard('10', 'hearts'),
    createCard('9', 'spades'),
    createCard('7', 'diamonds'),
    createCard('10', 'hearts'),
    createCard('6', 'clubs')
  ]);

  const result = controller.run(player.strategy, enemy.strategy, {
    deck,
    abilityEngine
  });

  assert.equal(result.outcome, 'playerWin');
  assert.equal(result.player.total, 23);
  assert.equal(result.player.busted, false);
})();

(() => {
  // Direct damage card applies immediately.
  const { round, controller, executor } = createCore();
  const player = new Player({
    maxHp: 30,
    baseAttack: 0,
    strategy: new CardFirstStrategy()
  });
  player.setAbilityLoadout(getAbilityCardsById(['rupture-strike']));

  const enemy = new Enemy({
    name: 'Dummy',
    maxHp: 30,
    baseAttack: 0,
    strategy: new ThresholdStrategy(17)
  });

  const abilityEngine = new CombatAbilityCardEngine(round, player, enemy, executor);
  const deck = Deck.fromTopDown([
    createCard('9', 'hearts'),
    createCard('8', 'spades'),
    createCard('7', 'diamonds'),
    createCard('7', 'clubs'),
    createCard('6', 'hearts')
  ]);

  controller.run(player.strategy, enemy.strategy, {
    deck,
    abilityEngine
  });

  assert.equal(enemy.currentHp, enemy.maxHp - 6);
})();

console.log('CardSystem tests passed.');
