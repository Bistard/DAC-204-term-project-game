import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { BlackjackEventBus } from '../../src/domain/blackjack/BlackjackEventBus';
import { TurnController } from '../../src/domain/blackjack/TurnController';
import { CombatSystem } from '../../src/domain/combat/CombatSystem';
import { Player } from '../../src/domain/combat/Player';
import { Enemy } from '../../src/domain/combat/Enemy';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';
import { Deck } from '../../src/domain/blackjack/Deck';
import { Card, createCard, Rank, Suit } from '../../src/domain/blackjack/Card';

const card = (rank: Rank, suit: Suit): Card => createCard(rank, suit);

const createCombatSetup = () => {
  const rules = new BlackjackRules();
  const round = new BlackjackRound(undefined, rules);
  const bus = new BlackjackEventBus();
  const controller = new TurnController(round, rules, bus);
  const combat = new CombatSystem(controller);

  const player = new Player({
    name: 'Tester',
    maxHp: 50,
    baseAttack: 10,
    strategy: new ThresholdStrategy(17)
  });

  const enemy = new Enemy({
    name: 'Dummy',
    maxHp: 40,
    baseAttack: 8,
    strategy: new ThresholdStrategy(17)
  });

  return { combat, player, enemy };
};

(() => {
  const { combat, player, enemy } = createCombatSetup();
  const deck = Deck.fromTopDown([
    card('10', 'hearts'), // player 1
    card('9', 'diamonds'), // enemy 1
    card('9', 'clubs'), // player 2 -> 19 stand
    card('7', 'spades'), // enemy 2 -> 16 hit
    card('2', 'hearts') // enemy hit -> 18 stand
  ]);

  const summary = combat.executeRound(player, enemy, { deck });
  assert.equal(summary.outcome, 'playerWin');
  assert.equal(summary.damage, player.baseAttack);
  assert.equal(summary.reason, 'standard');
  assert.equal(enemy.currentHp, enemy.maxHp - player.baseAttack);
})();

(() => {
  const { combat, player, enemy } = createCombatSetup();
  const deck = Deck.fromTopDown([
    card('10', 'hearts'), // player 1
    card('9', 'diamonds'), // enemy 1
    card('9', 'clubs'), // player 2 -> 19 stand
    card('7', 'spades'), // enemy 2 -> 16 hit
    card('10', 'clubs') // enemy hit -> bust
  ]);

  const summary = combat.executeRound(player, enemy, { deck });
  assert.equal(summary.outcome, 'playerWin');
  assert.equal(summary.reason, 'bust');
  assert.equal(summary.damage, player.baseAttack * 2);
  assert.equal(enemy.currentHp, enemy.maxHp - summary.damage);
})();

(() => {
  const { combat, player, enemy } = createCombatSetup();
  const deck = Deck.fromTopDown([
    card('9', 'hearts'),
    card('8', 'diamonds'),
    card('6', 'clubs'),
    card('7', 'spades'),
    card('9', 'clubs'),
    card('6', 'hearts')
  ]);

  const summary = combat.executeRound(player, enemy, { deck });
  assert.equal(summary.outcome, 'enemyWin');
  assert.equal(summary.targetId, 'player');
  assert.ok(player.currentHp < player.maxHp);
})();

console.log('CombatSystem tests passed.');
