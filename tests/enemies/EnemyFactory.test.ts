import assert from 'node:assert/strict';
import { EnemyFactory } from '../../src/domain/combat/EnemyFactory';
import { BlackjackRules } from '../../src/domain/blackjack/BlackjackRules';
import { BlackjackRound } from '../../src/domain/blackjack/BlackjackRound';
import { Deck } from '../../src/domain/blackjack/Deck';
import { createCard } from '../../src/domain/blackjack/Card';
import { Player } from '../../src/domain/combat/Player';
import { ThresholdStrategy } from '../../src/domain/blackjack/strategies/ThresholdStrategy';

const factory = new EnemyFactory();

(() => {
  const greedy = factory.create('greedy-ghost');
  assert.equal(greedy.name, 'Greedy Ghost');
  assert.equal(greedy.baseAttack >= 12, true);
  assert.ok(greedy.getBehaviors().length === 0);
})();

(() => {
  const corruptor = factory.create('corruptor');
  const behaviors = corruptor.getBehaviors();
  assert.ok(behaviors.length > 0);

  const rules = new BlackjackRules();
  const round = new BlackjackRound(undefined, rules);
  const deck = Deck.fromTopDown([
    createCard('K', 'hearts'),
    createCard('5', 'clubs'),
    createCard('9', 'spades'),
    createCard('6', 'diamonds')
  ]);
  round.start(deck);

  const player = new Player({ strategy: new ThresholdStrategy(17) });

  behaviors.forEach((behavior) =>
    behavior.onRoundStart?.({
      round,
      player,
      enemy: corruptor
    })
  );

  const snapshot = round.getSnapshot().player;
  assert.equal(snapshot.cards[0].rank, '2');
})();

(() => {
  const wave3Enemy = factory.pickForWave(3);
  assert.equal(wave3Enemy.id, 'judge-of-void');
})();

console.log('EnemyFactory tests passed.');
