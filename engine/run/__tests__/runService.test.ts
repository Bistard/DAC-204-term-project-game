import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GamePhase, MetaState, TurnOwner } from '../../../common/types';
import { GameStore } from '../../state/gameStore';
import { createInitialGameState } from '../../state/gameState';
import { EventBus } from '../../eventBus';
import { IBattleService } from '../../battle/IBattleService';
import { RunService } from '../RunService';
import { IBattleResult } from '../../state/results';

const baseMeta: MetaState = {
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
};

const createBattleService = (store: GameStore) =>
    ({
        startBattle: vi.fn(context => {
            store.setState(
                {
                    ...store.snapshot.state,
                    phase: GamePhase.BATTLE,
                    runLevel: context.runLevel,
                    roundCount: 1,
                },
                { tag: 'test:battle.start' }
            );
        }),
        startRound: vi.fn(),
        hit: vi.fn(),
        stand: vi.fn(),
        useItem: vi.fn(),
        evaluateFlow: vi.fn(),
        getRoundResults: vi.fn(() => []),
        setBattleResultHandler: vi.fn(),
    }) as IBattleService;

const createRunService = () => {
    const store = new GameStore(createInitialGameState(baseMeta));
    const eventBus = new EventBus();
    const battleService = createBattleService(store);
    const service = new RunService({
        store,
        eventBus,
        battleService,
        getMetaState: () => baseMeta,
    });
    return { service, store, eventBus, battleService };
};

describe('RunService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes a new run and triggers the first battle', () => {
        const { service, store, battleService } = createRunService();
        service.startRun();
        expect(battleService.startBattle).toHaveBeenCalledTimes(1);
        expect(store.snapshot.state.phase).toBe(GamePhase.BATTLE);
    });

    it('registers battle result handler with the battle service', () => {
        const { battleService } = createRunService();
        expect(battleService.setBattleResultHandler).toHaveBeenCalledTimes(1);
    });

    it('delegates combat actions to the battle service', async () => {
        const { service, battleService } = createRunService();
        service.startRun();
        await service.hit('PLAYER' as TurnOwner);
        service.stand('ENEMY');
        await service.useItem(0, 'PLAYER');

        expect(battleService.hit).toHaveBeenCalledWith('PLAYER');
        expect(battleService.stand).toHaveBeenCalledWith('ENEMY');
        expect(battleService.useItem).toHaveBeenCalledWith(0, 'PLAYER');
    });

    it('enters reward phase after a player victory', () => {
        const { service, store } = createRunService();
        const result: IBattleResult = {
            winner: 'PLAYER',
            roundsPlayed: 2,
            playerHpDelta: -1,
            enemyHpDelta: -10,
            suddenDeath: false,
            rewards: [],
            roundResults: [],
        };
        service.handleBattleResult(result);
        expect(store.snapshot.state.phase).toBe(GamePhase.REWARD);
        expect(store.snapshot.state.rewardOptions.length).toBeGreaterThan(0);
    });

    it('transitions to game over after a defeat', () => {
        const { service, store } = createRunService();
        const result: IBattleResult = {
            winner: 'ENEMY',
            roundsPlayed: 2,
            playerHpDelta: -10,
            enemyHpDelta: 0,
            suddenDeath: false,
            rewards: [],
            roundResults: [],
        };
        service.handleBattleResult(result);
        expect(store.snapshot.state.phase).toBe(GamePhase.GAME_OVER);
    });
});
