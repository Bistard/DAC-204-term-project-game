const { resolve } = require('path');

const tests = [
  'tests/blackjack/BlackjackRules.test.js',
  'tests/blackjack/TurnController.test.js',
  'tests/cards/CardSystem.test.js',
  'tests/enemies/EnemyFactory.test.js',
  'tests/combat/CombatSystem.test.js',
  'tests/combat/BattleRunner.test.js',
  'tests/meta/RewardCalculator.test.js',
  'tests/meta/MetaProgressionService.test.js',
  'tests/meta/HeroBuilder.test.js',
  'tests/survival/SurvivalModeController.test.js'
];

for (const test of tests) {
  require(resolve(__dirname, '..', 'dist-tests', test));
}
