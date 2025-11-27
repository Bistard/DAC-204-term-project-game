/**
 * Aggregated rule snapshot derived from the active Environment and Penalty
 * cards. BattleService consults this structure when translating round results
 * into HP changes or control flow mutations.
 */
export interface BattleRuleState {
    targetScoreOverride?: number;
    suddenDeathThreshold?: number;
    damage: {
        flatModifier: number;
        multiplier: number;
    };
    autoDrawPerActor: number;
    itemUsageLocked: boolean;
}

export const createDefaultBattleRuleState = (): BattleRuleState => ({
    damage: {
        flatModifier: 0,
        multiplier: 1,
    },
    autoDrawPerActor: 0,
    itemUsageLocked: false,
});
