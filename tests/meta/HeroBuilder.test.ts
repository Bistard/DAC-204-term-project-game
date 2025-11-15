import assert from 'node:assert/strict';
import { defaultHeroDefinition } from '../../src/content/player/heroes';
import { UpgradeEngine } from '../../src/domain/meta/UpgradeEngine';
import { HeroBuilder } from '../../src/domain/meta/HeroBuilder';
import { createDefaultMetaState } from '../../src/domain/meta/MetaProgressionState';

(() => {
  const engine = new UpgradeEngine();
  const builder = new HeroBuilder(defaultHeroDefinition, engine);
  const state = createDefaultMetaState();
  const player = builder.build(state);

  assert.equal(player.maxHp, defaultHeroDefinition.baseMaxHp);
  assert.equal(player.currentHp, defaultHeroDefinition.baseMaxHp);
  assert.ok(player.getAbilityCards().length >= defaultHeroDefinition.startingAbilityCardIds.length);
})();

console.log('HeroBuilder tests passed.');
