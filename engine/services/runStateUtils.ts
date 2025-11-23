import { TARGET_SCORE } from '../../constants';
import { GameState } from '../../types';

/**
 * Apply persistent environment card effects onto the provided state snapshot.
 * Currently only adjusts the target score, but centralized here so both
 * CombatService and RewardService can stay in sync.
 */
export const applyEnvironmentRules = (state: GameState): GameState => {
    let targetScore = state.targetScore ?? TARGET_SCORE;
    if (state.activeEnvironment.length > 0) {
        state.activeEnvironment.forEach(card => {
            card.effects.forEach(effect => {
                if (effect.type === 'SET_TARGET_SCORE' && typeof effect.amount === 'number') {
                    targetScore = effect.amount;
                }
            });
        });
    }
    return {
        ...state,
        targetScore,
    };
};
