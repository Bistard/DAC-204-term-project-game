import { describe, expect, it } from 'vitest';
import { MetaState } from '../../../common/types';
import {
    createInitialGameState,
    extractBattleState,
    withBattleState,
    withRoundState,
    withRunState,
} from '../gameState';

const createMetaState = (overrides: Partial<MetaState> = {}): MetaState => ({
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
    ...overrides,
});

describe('gameState helpers', () => {
    it('updates only run-level fields through withRunState', () => {
        const base = createInitialGameState(createMetaState());
        const updated = withRunState(base, run => ({
            ...run,
            runLevel: run.runLevel + 1,
            message: 'Level up',
        }));

        expect(updated.runLevel).toBe(base.runLevel + 1);
        expect(updated.message).toBe('Level up');
        expect(updated.roundCount).toBe(base.roundCount);
        expect(base.runLevel).toBe(1);
    });

    it('clones nested entities when writing battle state', () => {
        const base = createInitialGameState(createMetaState());
        const updated = withBattleState(base, battle => {
            battle.player.hp = 5;
            battle.activeEnvironment.push({
                id: 'test_env',
                name: 'Test',
                description: 'Smoke',
                rules: [],
            });
            return battle;
        });

        expect(updated.player.hp).toBe(5);
        expect(updated.activeEnvironment).toHaveLength(1);
        expect(base.player.hp).toBeGreaterThan(5);
        expect(base.activeEnvironment).toHaveLength(0);
    });

    it('returns deep clones from extractBattleState', () => {
        const base = createInitialGameState(createMetaState());
        const snapshot = extractBattleState(base);
        snapshot.player.hp = 2;
        snapshot.deck.push({ ...base.deck[0], id: 'cloned' });

        expect(base.player.hp).not.toBe(2);
        expect(base.deck.find(card => card.id === 'cloned')).toBeUndefined();
    });

    it('updates round-only data with withRoundState', () => {
        const base = createInitialGameState(createMetaState());
        const updated = withRoundState(base, round => ({
            ...round,
            turnOwner: 'ENEMY',
            playerStood: true,
            targetScore: round.targetScore + 1,
        }));

        expect(updated.turnOwner).toBe('ENEMY');
        expect(updated.playerStood).toBe(true);
        expect(updated.targetScore).toBe(base.targetScore + 1);
        expect(base.turnOwner).toBe('PLAYER');
        expect(base.playerStood).toBe(false);
    });
});
