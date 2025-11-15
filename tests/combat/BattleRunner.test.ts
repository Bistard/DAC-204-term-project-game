import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { BlackjackEventBus } from '../../src/domain/blackjack/BlackjackEventBus';
import { TurnController } from '../../src/domain/blackjack/TurnController';
import { CombatSystem } from '../../src/domain/combat/CombatSystem';
import { BattleRunner } from '../../src/domain/combat/BattleRunner';
import { Player } from '../../src/domain/combat/Player';
import { GreedyGhost } from '../../src/domain/combat/enemies/GreedyGhost';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';
import { Deck } from '../../src/domain/blackjack/Deck';
import { createCard } from '../../src/domain/blackjack/Card';

const createRunner = () => {
  const rules = new BlackjackRules();
  const round = new BlackjackRound(undefined, rules);
  const bus = new BlackjackEventBus();
  const controller = new TurnController(round, rules, bus);
  const combat = new CombatSystem(controller, round);
  const runner = new BattleRunner(combat);
  return runner;
};

const player = new Player({
  name: 'Simulated Hero',
  maxHp: 70,
  baseAttack: 15,
  strategy: new ThresholdStrategy(17)
});

const decks: Deck[] = [
  Deck.fromTopDown([
    createCard('10', 'hearts'),
    createCard('9', 'spades'),
    createCard('9', 'diamonds'),
    createCard('7', 'clubs'),
    createCard('2', 'hearts'),
    createCard('5', 'clubs')
  ]),
  Deck.fromTopDown([
    createCard('9', 'clubs'),
    createCard('8', 'diamonds'),
    createCard('6', 'hearts'),
    createCard('7', 'spades'),
    createCard('8', 'hearts'),
    createCard('9', 'diamonds'),
    createCard('4', 'clubs')
  ]),
  Deck.fromTopDown([
    createCard('10', 'clubs'),
    createCard('8', 'hearts'),
    createCard('9', 'spades'),
    createCard('7', 'diamonds'),
    createCard('10', 'hearts'),
    createCard('6', 'diamonds')
  ]),
  Deck.fromTopDown([
    createCard('10', 'spades'),
    createCard('9', 'clubs'),
    createCard('8', 'diamonds'),
    createCard('7', 'hearts'),
    createCard('3', 'clubs'),
    createCard('4', 'hearts')
  ])
];

(() => {
  const runner = createRunner();
  const enemy = new GreedyGhost();
  const result = runner.fight(player, enemy, { deckSequence: decks });

  assert.equal(result.winner, 'player');
  assert.ok(result.log.length >= 2);
  assert.ok(result.log.some((entry) => entry.reason === 'bust'));
  assert.ok(enemy.isDefeated());
})();

console.log('BattleRunner tests passed.');
