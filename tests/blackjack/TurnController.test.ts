import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { Deck } from '../../src/domain/blackjack/Deck';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { BlackjackEventBus } from '../../src/domain/blackjack/BlackjackEventBus';
import { TurnController } from '../../src/domain/blackjack/TurnController';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';
import { Card, createCard, Rank, Suit } from '../../src/domain/blackjack/Card';

const card = (rank: Rank, suit: Suit): Card => createCard(rank, suit);

const createController = () => {
  const rules = new BlackjackRules();
  const round = new BlackjackRound(undefined, rules);
  const bus = new BlackjackEventBus();
  const controller = new TurnController(round, rules, bus);
  return { rules, round, bus, controller };
};

(() => {
  const { controller, bus } = createController();
  const events: string[] = [];
  bus.on('bust', (payload) => events.push(`bust:${payload.actor}`));
  bus.on('roundEnd', (payload) => events.push(`round:${payload.outcome}`));

  const deck = Deck.fromTopDown([
    card('10', 'hearts'), // player first
    card('9', 'spades'), // enemy first
    card('7', 'clubs'), // player second -> 17 stands
    card('6', 'diamonds'), // enemy second -> 15 hits
    card('5', 'hearts') // enemy hit -> 20
  ]);

  const result = controller.run(new ThresholdStrategy(17), new ThresholdStrategy(17), { deck });
  assert.equal(result.outcome, 'enemyWin');
  assert.equal(events.length, 1);
  assert.equal(events[0], 'round:enemyWin');
})();

(() => {
  const { controller, bus } = createController();
  const events: string[] = [];
  bus.on('bust', (payload) => events.push(`bust:${payload.actor}`));
  bus.on('roundEnd', (payload) => events.push(`round:${payload.outcome}`));

  const deck = Deck.fromTopDown([
    card('9', 'hearts'), // player first
    card('5', 'spades'), // enemy first
    card('7', 'clubs'), // player second -> 16, hits
    card('6', 'diamonds'), // enemy second -> 11
    card('8', 'hearts'), // player hit -> bust at 24
    card('9', 'diamonds') // enemy card unused
  ]);

  const result = controller.run(new ThresholdStrategy(18), new ThresholdStrategy(17), { deck });
  assert.equal(result.outcome, 'enemyWin');
  assert.ok(events.includes('bust:player'));
  assert.ok(events.includes('round:enemyWin'));
})();

console.log('TurnController tests passed.');
