import { describe, expect, it } from 'vitest';
import { ItemType } from '../../../common/types';
import {
    IBattleResult,
    IRoundResult,
    createDefaultBattleResult,
    createDefaultRoundResult,
} from '../results';

const createItem = () => ({
    id: 'test',
    name: 'Test',
    description: 'Item',
    type: ItemType.CONSUMABLE,
    effects: [],
    instanceId: 'test-1',
});

const createRoundResult = (): IRoundResult => ({
    ...createDefaultRoundResult(),
    winner: 'PLAYER',
    playerScore: 21,
});

describe('result DTO factories', () => {
    it('creates independent round result snapshots', () => {
        const result = createDefaultRoundResult({
            roundNumber: 2,
            winner: 'PLAYER',
            damageAdjustments: { PLAYER: 1, ENEMY: -1 },
        });

        expect(result.roundNumber).toBe(2);
        expect(result.winner).toBe('PLAYER');
        expect(result.damageAdjustments.PLAYER).toBe(1);

        result.damageAdjustments.PLAYER = 5;
        const second = createDefaultRoundResult();
        expect(second.damageAdjustments.PLAYER).toBe(0);
    });

    it('creates battle result with cloned rewards and rounds', () => {
        const rewards = [createItem()];
        const rounds = [createRoundResult()];
        const battle: IBattleResult = createDefaultBattleResult({
            winner: 'PLAYER',
            rewards,
            roundResults: rounds,
        });

        expect(battle.winner).toBe('PLAYER');
        expect(battle.rewards).toHaveLength(1);
        expect(battle.roundResults[0].playerScore).toBe(21);

        battle.rewards[0].name = 'Mutated';
        expect(rewards[0].name).toBe('Test');
        battle.roundResults[0].playerScore = 10;
        expect(rounds[0].playerScore).toBe(21);
    });
});
