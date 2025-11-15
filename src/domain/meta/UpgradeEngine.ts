import { UpgradeDefinition, upgradeDefinitions } from '../../content/meta/upgradeDefinitions';
import { MetaProgressionState } from './MetaProgressionState';
import { HeroDefinition } from '../../content/player/heroes';

export type AppliedHeroStats = {
  maxHp: number;
  baseAttack: number;
  abilityCardIds: string[];
};

export class UpgradeEngine {
  constructor(private readonly upgrades: UpgradeDefinition[] = upgradeDefinitions) {}

  getOwnedUpgrades(state: MetaProgressionState): UpgradeDefinition[] {
    return this.upgrades.filter((upgrade) => state.purchasedUpgradeIds.includes(upgrade.id));
  }

  applyToHero(definition: HeroDefinition, state: MetaProgressionState): AppliedHeroStats {
    let maxHp = definition.baseMaxHp;
    let baseAttack = definition.baseAttack;
    const abilityCardIds = new Set(definition.startingAbilityCardIds);

    for (const upgrade of this.getOwnedUpgrades(state)) {
      switch (upgrade.kind) {
        case 'maxHp':
          maxHp += upgrade.amount ?? 0;
          break;
        case 'baseAttack':
          baseAttack += upgrade.amount ?? 0;
          break;
        case 'startingCard':
          if (upgrade.cardId) {
            abilityCardIds.add(upgrade.cardId);
          }
          break;
        case 'unlockCard':
        case 'unlockEnemy':
          // handled elsewhere
          break;
      }
    }

    return {
      maxHp,
      baseAttack,
      abilityCardIds: Array.from(abilityCardIds)
    };
  }

  canPurchase(state: MetaProgressionState, upgradeId: string): boolean {
    const upgrade = this.upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) return false;
    if (state.purchasedUpgradeIds.includes(upgradeId)) return false;
    if ((upgrade.requires ?? []).some((req) => !state.purchasedUpgradeIds.includes(req))) {
      return false;
    }
    return state.currency >= upgrade.cost;
  }

  purchase(state: MetaProgressionState, upgradeId: string): MetaProgressionState {
    const upgrade = this.upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) {
      throw new Error(`Unknown upgrade ${upgradeId}`);
    }
    if (!this.canPurchase(state, upgradeId)) {
      throw new Error(`Cannot purchase upgrade ${upgradeId}`);
    }
    const newCurrency = state.currency - upgrade.cost;
    const newPurchased = [...state.purchasedUpgradeIds, upgradeId];

    let unlockedCards = [...state.unlockedCardIds];
    let unlockedEnemies = [...state.unlockedEnemyIds];

    if (upgrade.kind === 'unlockCard' && upgrade.cardId && !unlockedCards.includes(upgrade.cardId)) {
      unlockedCards = [...unlockedCards, upgrade.cardId];
    }

    if (upgrade.kind === 'unlockEnemy' && upgrade.enemyId && !unlockedEnemies.includes(upgrade.enemyId)) {
      unlockedEnemies = [...unlockedEnemies, upgrade.enemyId];
    }

    return {
      ...state,
      currency: newCurrency,
      purchasedUpgradeIds: newPurchased,
      unlockedCardIds: unlockedCards,
      unlockedEnemyIds: unlockedEnemies
    };
  }
}
