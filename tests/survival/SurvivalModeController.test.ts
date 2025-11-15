import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { BlackjackEventBus } from '../../src/domain/blackjack/BlackjackEventBus';
import { TurnController } from '../../src/domain/blackjack/TurnController';
import { CombatSystem } from '../../src/domain/combat/CombatSystem';
import { BattleRunner } from '../../src/domain/combat/BattleRunner';
import { EnemyFactory } from '../../src/domain/combat/EnemyFactory';
import { SurvivalModeController } from '../../src/domain/survival/SurvivalModeController';
import { Player } from '../../src/domain/combat/Player';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';
import { Deck } from '../../src/domain/blackjack/Deck';
import { createCard } from '../../src/domain/blackjack/Card';

const rules = new BlackjackRules();
const round = new BlackjackRound(undefined, rules);
const bus = new BlackjackEventBus();
const controller = new TurnController(round, rules, bus);
const combat = new CombatSystem(controller, round);
const runner = new BattleRunner(combat);
const factory = new EnemyFactory();
const survival = new SurvivalModeController(runner, factory);

const player = new Player({
  name: 'Survivor',
  maxHp: 80,
  baseAttack: 15,
  strategy: new ThresholdStrategy(17)
});

const deckA = Deck.fromTopDown([
  createCard('10', 'hearts'),
  createCard('9', 'spades'),
  createCard('9', 'diamonds'),
  createCard('7', 'clubs'),
  createCard('2', 'hearts'),
  createCard('4', 'clubs'),
  createCard('6', 'diamonds'),
  createCard('8', 'clubs'),
  createCard('5', 'spades'),
  createCard('3', 'diamonds'),
  createCard('7', 'hearts'),
  createCard('9', 'clubs')
]);

const deckB = Deck.fromTopDown([
  createCard('9', 'clubs'),
  createCard('8', 'diamonds'),
  createCard('7', 'hearts'),
  createCard('6', 'spades'),
  createCard('5', 'diamonds'),
  createCard('4', 'hearts'),
  createCard('8', 'spades'),
  createCard('6', 'clubs'),
  createCard('3', 'hearts'),
  createCard('2', 'diamonds'),
  createCard('10', 'clubs'),
  createCard('9', 'hearts')
]);

const deckC = Deck.fromTopDown([
  createCard('10', 'spades'),
  createCard('8', 'hearts'),
  createCard('9', 'clubs'),
  createCard('7', 'diamonds'),
  createCard('3', 'clubs'),
  createCard('6', 'hearts'),
  createCard('5', 'clubs'),
  createCard('4', 'diamonds'),
  createCard('8', 'clubs'),
  createCard('2', 'spades'),
  createCard('10', 'diamonds'),
  createCard('7', 'spades')
]);

(() => {
  const result = survival.run(player, {
    maxWaves: 2,
    battleDecks: [[deckA, deckB], [deckC]]
  });

  assert.equal(result.waves.length, 2);
  assert.equal(result.waves[0].victory, true);
  assert.equal(result.waves[1].victory, false);
  assert.equal(result.playerAlive, false);
})();

console.log('SurvivalModeController tests passed.');
