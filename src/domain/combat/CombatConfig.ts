export type CombatConfig = {
  bustDamageMultiplier: number;
  pushDamage: number;
};

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  bustDamageMultiplier: 2,
  pushDamage: 0
};
