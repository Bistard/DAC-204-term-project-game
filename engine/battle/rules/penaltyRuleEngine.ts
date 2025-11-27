import { PenaltyCard, PenaltyRuntimeState, PenaltyDamageResult, PenaltyDamageContext } from '../../../common/types';

/**
 * Placeholder adapter for future penalty calculations. The legacy penalty
 * helpers still live inside roundService; this file exists so that later
 * phases have a dedicated home for the functionality.
 */
export const evaluatePenaltyDamage = (
    _card: PenaltyCard | null,
    context: PenaltyDamageContext
): PenaltyDamageResult => ({
    playerDamage: 0,
    enemyDamage: 0,
    runtimePatch: context.runtime as PenaltyRuntimeState,
});
