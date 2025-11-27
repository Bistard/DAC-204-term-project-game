import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Enemy, EnvironmentRuntimeState, EnemyAIProfile, StoreUpdateMeta } from '../../../common/types';
import { AiService } from '../aiService';
import { createEmptyEnvironmentRuntime } from '../../battle/rules/environmentRuleEngine';

const createEnemy = (aiType: EnemyAIProfile, score: number): Enemy =>
    ({
        id: 'enemy-1',
        templateId: 'template-1',
        name: 'Test Enemy',
        description: 'Test',
        difficulty: 1,
        aiType,
        hp: 10,
        maxHp: 10,
        shield: 0,
        hand: [
            {
                suit: 'TEST' as any,
                rank: 'X',
                value: score,
                id: 'card-1',
                isFaceUp: true,
                isAce: false,
            },
        ],
        score,
        inventory: [],
        maxInventory: 3,
    }) as Enemy;

const createRuntime = (overrides: Partial<EnvironmentRuntimeState> = {}): EnvironmentRuntimeState => ({
    ...createEmptyEnvironmentRuntime(),
    ...overrides,
    scoreOptions: {
        ...createEmptyEnvironmentRuntime().scoreOptions,
        ...(overrides.scoreOptions ?? {}),
    },
});

describe('AiService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('greedy AI hits when score is well below threshold', async () => {
        const enemy = createEnemy('GREEDY', 10);
        const runtime = createRuntime();
        const updateProcessingFlag = vi.fn();
        const onHit = vi.fn().mockResolvedValue(undefined);
        const onStand = vi.fn();

        const service = new AiService({
            getBattleView: () => ({
                turnOwner: 'ENEMY',
                enemy,
                targetScore: 21,
                environmentRuntime: runtime,
            }),
            updateProcessingFlag,
            createMeta: (tag: string, description: string, _payload?: Record<string, unknown>, extra?: Partial<StoreUpdateMeta>) => ({
                tag,
                description,
                ...(extra ?? {}),
            }),
            onHit,
            onStand,
        });

        service.queueTurn();
        await vi.runAllTimersAsync();

        expect(onHit).toHaveBeenCalledTimes(1);
        expect(onStand).not.toHaveBeenCalled();
        expect(updateProcessingFlag).toHaveBeenCalledWith(true, expect.any(Object));
        expect(updateProcessingFlag).toHaveBeenCalledWith(false, expect.any(Object));
    });

    it('greedy AI stands when score would bust due to special bust values', async () => {
        const enemy = createEnemy('GREEDY', 16);
        const runtime = createRuntime({
            scoreOptions: {
                aceMode: 'FLEXIBLE',
                specialBustValues: [16],
            },
        });
        const updateProcessingFlag = vi.fn();
        const onHit = vi.fn().mockResolvedValue(undefined);
        const onStand = vi.fn();

        const service = new AiService({
            getBattleView: () => ({
                turnOwner: 'ENEMY',
                enemy,
                targetScore: 21,
                environmentRuntime: runtime,
            }),
            updateProcessingFlag,
            createMeta: (tag: string, description: string, _payload?: Record<string, unknown>, extra?: Partial<StoreUpdateMeta>) => ({
                tag,
                description,
                ...(extra ?? {}),
            }),
            onHit,
            onStand,
        });

        service.queueTurn();
        await vi.runAllTimersAsync();

        expect(onHit).not.toHaveBeenCalled();
        expect(onStand).toHaveBeenCalledTimes(1);
    });

    it('cancelProcessing clears the scheduled AI turn', () => {
        const enemy = createEnemy('GREEDY', 10);
        const runtime = createRuntime();
        const updateProcessingFlag = vi.fn();
        const onHit = vi.fn().mockResolvedValue(undefined);
        const onStand = vi.fn();

        const service = new AiService({
            getBattleView: () => ({
                turnOwner: 'ENEMY',
                enemy,
                targetScore: 21,
                environmentRuntime: runtime,
            }),
            updateProcessingFlag,
            createMeta: (tag: string, description: string, _payload?: Record<string, unknown>, extra?: Partial<StoreUpdateMeta>) => ({
                tag,
                description,
                ...(extra ?? {}),
            }),
            onHit,
            onStand,
        });

        service.queueTurn();
        service.cancelProcessing();
        vi.runAllTimers();

        expect(onHit).not.toHaveBeenCalled();
        expect(onStand).not.toHaveBeenCalled();
    });
});
