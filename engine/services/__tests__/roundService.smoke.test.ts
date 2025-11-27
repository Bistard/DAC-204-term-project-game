import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../common/types';
import { createStoreBundle } from './serviceTestUtils';
import { RoundService } from '../roundService';

const createRoundService = () => {
    const bundle = createStoreBundle();
    const roundService = new RoundService({
        store: bundle.store,
        eventBus: bundle.eventBus,
        getMetaState: bundle.getMetaState,
        rewardService: bundle.rewardService,
        createMeta: bundle.createMeta,
        onRoundReady: () => {},
    });
    bundle.store.updateState(state => ({ ...state, phase: GamePhase.BATTLE }));
    return { ...bundle, roundService };
};

describe('RoundService smoke tests', () => {
    it('updates round damage adjustments for multiple targets', () => {
        const { roundService, store } = createRoundService();
        roundService.updateRoundDamageAdjustments(['PLAYER', 'ENEMY'], 3, 'Boost');

        const state = store.snapshot.state;
        expect(state.roundModifiers.damageAdjustments.PLAYER).toBe(3);
        expect(state.roundModifiers.damageAdjustments.ENEMY).toBe(3);
        expect(state.message).toContain('Boost');
    });

    it('respects immunity flags when resolving round damage', () => {
        const { roundService, store } = createRoundService();
        store.updateState(prev => ({
            ...prev,
            roundModifiers: {
                ...prev.roundModifiers,
                damageImmunity: { ...prev.roundModifiers.damageImmunity, PLAYER: true },
                damageAdjustments: { ...prev.roundModifiers.damageAdjustments, PLAYER: 2 },
            },
        }));

        expect(roundService.resolveRoundDamage('PLAYER', 10)).toBe(0);

        store.updateState(prev => ({
            ...prev,
            roundModifiers: {
                ...prev.roundModifiers,
                damageImmunity: { ...prev.roundModifiers.damageImmunity, PLAYER: false },
            },
        }));
        expect(roundService.resolveRoundDamage('PLAYER', 10)).toBe(12);
    });

    it('clears modifiers and target score when requested', () => {
        const { roundService, store } = createRoundService();
        store.updateState(prev => ({
            ...prev,
            targetScore: 25,
            roundModifiers: {
                damageAdjustments: { PLAYER: 2, ENEMY: -1 },
                damageImmunity: { PLAYER: true, ENEMY: true },
                targetScoreOverride: 25,
                loserDamageBonus: 3,
            },
        }));

        roundService.clearRoundModifiers('reset', true);
        const state = store.snapshot.state;
        expect(state.roundModifiers.damageAdjustments.PLAYER).toBe(0);
        expect(state.roundModifiers.damageImmunity.PLAYER).toBe(false);
        expect(state.targetScore).toBe(state.baseTargetScore);
    });
});
