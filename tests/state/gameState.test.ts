import { describe, expect, it } from 'vitest';
import {
    attachLegacyState,
    createDefaultPenaltyRuntime,
    createInitialGameState,
    createInitialRoundState,
    createPlayerBattleState,
} from '../../engine/state/gameState';
import {
    BattleState,
    Card,
    Enemy,
    GamePhase,
    MetaState,
    Suit,
    TurnOwner,
} from '../../common/types';
import { createEmptyEnvironmentRuntime } from '../../engine/rules/environmentRuleEngine';

const meta: MetaState = {
    gold: 0,
    upgrades: { hpLevel: 1, inventoryLevel: 0 },
};

const sampleCard: Card = {
    suit: Suit.Spades,
    rank: 'A',
    value: 11,
    id: 'card-1',
    isFaceUp: true,
    isAce: true,
};

const baseEnemy: Enemy = {
    name: 'Dummy',
    id: 'enemy-1',
    templateId: 'template',
    difficulty: 1,
    aiType: 'GREEDY',
    description: 'Test enemy',
    hp: 10,
    maxHp: 10,
    shield: 0,
    hand: [],
    score: 0,
    inventory: [],
    maxInventory: 3,
};

const createBattleState = (overrides: Partial<BattleState> = {}): BattleState => ({
    targetScore: overrides.targetScore ?? 21,
    baseTargetScore: overrides.baseTargetScore ?? 21,
    activeEnvironment: overrides.activeEnvironment ?? [],
    environmentRuntime: overrides.environmentRuntime ?? createEmptyEnvironmentRuntime(),
    activePenalty: overrides.activePenalty ?? null,
    penaltyRuntime: overrides.penaltyRuntime ?? createDefaultPenaltyRuntime(),
    deck: overrides.deck ?? [],
    discardPile: overrides.discardPile ?? [],
    environmentDisabledCards: overrides.environmentDisabledCards ?? [],
    player: overrides.player ?? createPlayerBattleState(meta),
    enemy: overrides.enemy ?? { ...baseEnemy },
});

describe('attachLegacyState', () => {
    it('mirrors round slice data into legacy fields', () => {
        const roundSlice = createInitialRoundState(2, true);
        const customRound = {
            ...roundSlice,
            number: 2,
            turnOwner: 'ENEMY' as TurnOwner,
            player: {
                ...roundSlice.player,
                stood: true,
                hand: [sampleCard],
                score: 18,
            },
            enemy: roundSlice.enemy
                ? {
                      ...roundSlice.enemy,
                      stood: false,
                      hand: [sampleCard],
                      score: 19,
                  }
                : null,
        };
        const battleState = createBattleState({
            player: {
                ...createPlayerBattleState(meta),
                hand: customRound.player.hand,
                score: customRound.player.score,
            },
            enemy: customRound.enemy
                ? {
                      ...baseEnemy,
                      hand: customRound.enemy.hand,
                      score: customRound.enemy.score,
                  }
                : { ...baseEnemy },
        });

        const normalized = attachLegacyState({
            phase: GamePhase.BATTLE,
            message: 'round-sync',
            run: {
                level: 3,
                status: 'IN_PROGRESS',
                rewardOptions: [],
                pickedRewardIndices: [0],
                goldEarnedThisLevel: 7,
            },
            battle: battleState,
            round: customRound,
        });

        expect(normalized.turnOwner).toBe('ENEMY');
        expect(normalized.playerStood).toBe(true);
        expect(normalized.enemyStood).toBe(false);
        expect(normalized.round?.number).toBe(2);
        expect(normalized.round?.player.hand[0].id).toBe(sampleCard.id);
        expect(normalized.player.hand[0].id).toBe(sampleCard.id);
        expect(normalized.battle?.player.hand[0].id).toBe(sampleCard.id);
        expect(normalized.run.rewardOptions).toHaveLength(0);
        expect(normalized.goldEarnedThisLevel).toBe(7);
    });

    it('reconstructs round and battle slices from legacy fields when missing', () => {
        const base = createInitialGameState(meta);
        const mutated = {
            ...base,
            phase: GamePhase.BATTLE,
            message: 'legacy-only',
            battle: null,
            round: null,
            turnOwner: 'PLAYER' as TurnOwner,
            playerStood: true,
            enemyStood: false,
            roundCount: 4,
            runLevel: 2,
            targetScore: 30,
            baseTargetScore: 28,
            activeEnvironment: [],
            environmentRuntime: createEmptyEnvironmentRuntime(),
            activePenalty: null,
            player: {
                ...base.player,
                hand: [sampleCard],
                score: 17,
            },
            enemy: {
                ...baseEnemy,
                hand: [sampleCard],
                score: 15,
            },
            penaltyRuntime: createDefaultPenaltyRuntime(),
            deck: [],
            discardPile: [],
            environmentDisabledCards: [],
        };

        const normalized = attachLegacyState(mutated);

        expect(normalized.round).not.toBeNull();
        expect(normalized.round?.number).toBe(4);
        expect(normalized.round?.player.stood).toBe(true);
        expect(normalized.round?.enemy?.stood).toBe(false);
        expect(normalized.battle).toBeNull();
        expect(normalized.run.level).toBe(base.run.level);
    });
});
