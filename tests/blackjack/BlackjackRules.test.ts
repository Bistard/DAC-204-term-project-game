import assert from 'node:assert/strict';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { Card, createCard, Rank, Suit } from '../../src/domain/blackjack/Card';

const rules = new BlackjackRules();

const card = (rank: Rank, suit: Suit = 'hearts'): Card => createCard(rank, suit);

(() => {
  const score = rules.calculateScore([card('A'), card('9')]);
  assert.equal(score.total, 20);
  assert.equal(score.soft, true);
  assert.equal(score.busted, false);
})();

(() => {
  const score = rules.calculateScore([card('A'), card('9'), card('5')]);
  assert.equal(score.total, 15);
  assert.equal(score.soft, false);
  assert.equal(score.busted, false);
})();

(() => {
  const score = rules.calculateScore([card('A'), card('A'), card('9')]);
  assert.equal(score.total, 21);
  assert.equal(score.soft, true);
  assert.equal(score.busted, false);
})();

(() => {
  const score = rules.calculateScore([card('K'), card('Q'), card('5')]);
  assert.equal(score.total, 25);
  assert.equal(score.soft, false);
  assert.equal(score.busted, true);
})();

(() => {
  const player = { total: 20, soft: false, busted: false };
  const enemy = { total: 18, soft: false, busted: false };
  assert.equal(rules.determineOutcome(player, enemy), 'playerWin');
})();

(() => {
  const player = { total: 22, soft: false, busted: true };
  const enemy = { total: 19, soft: false, busted: false };
  assert.equal(rules.determineOutcome(player, enemy), 'enemyWin');
})();

(() => {
  const player = { total: 18, soft: false, busted: false };
  const enemy = { total: 22, soft: false, busted: true };
  assert.equal(rules.determineOutcome(player, enemy), 'playerWin');
})();

(() => {
  const player = { total: 19, soft: false, busted: false };
  const enemy = { total: 19, soft: false, busted: false };
  assert.equal(rules.determineOutcome(player, enemy), 'push');
})();

console.log('BlackjackRules tests passed.');
