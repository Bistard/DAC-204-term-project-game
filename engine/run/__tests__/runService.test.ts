import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GamePhase, ItemType, MetaState, TurnOwner } from '../../../common/types';
import { GameStore } from '../../state/gameStore';
import { createInitialGameState } from '../../state/gameState';
import { EventBus } from '../../eventBus';
import { IBattleService } from '../../battle/IBattleService';
import { IRewardService } from '../../battle/rewards/IRewardService';
import { RunService } from '../RunService';
import { IBattleResult } from '../../state/results';

const baseMeta: MetaState = {
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
};

const createBattleService = () =>
    ({
        startRound: vi.fn(),
        hit: vi.fn(),
        stand: vi.fn(),
        useItem: vi.fn(),
        evaluateFlow: vi.fn(),
    }) as IBattleService;

const createRewardService = () =>
    ({
        handleVictory: vi.fn(),
        proceedToRewards: vi.fn(),
        pickReward: vi.fn(),
        prepareNextLevel: vi.fn(),
        buyUpgrade: vi.fn(),
        applyEventTrigger: vi.fn(),
        applyEnvironmentPerfectReward: vi.fn(),
    }) as IRewardService;

const createRunService = () => {
    const store = new GameStore(createInitialGameState(baseMeta));
    const eventBus = new EventBus();
    const battleService = createBattleService();
    const rewardService = createRewardService();
    const service = new RunService({
        store,
        eventBus,
        battleService,
        rewardService,
        getMetaState: () => baseMeta,
    });
    return { service, store, eventBus, battleService, rewardService };
};

describe('RunService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes a new run and triggers the first round', () => {
        const { service, store, battleService } = createRunService();
        service.startRun();
        expect(store.snapshot.state.phase).toBe(GamePhase.BATTLE);
        expect(store.snapshot.state.roundCount).toBe(1);
        expect(battleService.startRound).toHaveBeenCalledTimes(1);
    });

    it('delegates combat actions to the battle service', async () => {
        const { service, battleService } = createRunService();
        await service.startRound();
        await service.hit('PLAYER' as TurnOwner);
        service.stand('ENEMY');
        await service.useItem(0, 'PLAYER');

        expect(battleService.startRound).toHaveBeenCalled();
        expect(battleService.hit).toHaveBeenCalledWith('PLAYER');
        expect(battleService.stand).toHaveBeenCalledWith('ENEMY');
        expect(battleService.useItem).toHaveBeenCalledWith(0, 'PLAYER');
    });

    it('routes reward operations through the reward service', () => {
        const { service, rewardService } = createRunService();
        const item = { id: 'i', name: 'Item', description: '', type: ItemType.CONSUMABLE, effects: [], instanceId: 'i-1' };

        service.proceedToRewards();
        service.pickReward(item, 1);
        service.buyUpgrade('HP');

        expect(rewardService.proceedToRewards).toHaveBeenCalled();
        expect(rewardService.pickReward).toHaveBeenCalledWith(item, 1);
        expect(rewardService.buyUpgrade).toHaveBeenCalledWith('HP');
    });

    it('prepares the next level before starting a new battle', async () => {
        const { service, rewardService, battleService } = createRunService();
        await service.startNextLevel();

        expect(rewardService.prepareNextLevel).toHaveBeenCalledTimes(1);
        expect(battleService.startRound).toHaveBeenCalledTimes(1);
    });

    it('resumes battle flow through the battle service', () => {
        const { service, battleService } = createRunService();
        service.resumeBattleFlow();
        expect(battleService.evaluateFlow).toHaveBeenCalledTimes(1);
    });

    it('updates run state when handling a battle result', () => {
        const { service, store } = createRunService();
        const result: IBattleResult = {
            winner: 'PLAYER',
            roundsPlayed: 3,
            playerHpDelta: 0,
            enemyHpDelta: -10,
            suddenDeath: false,
            rewards: [],
            roundResults: [],
        };

        service.handleBattleResult(result);

        const snapshot = store.snapshot.state;
        expect(snapshot.message).toBe('Battle won!');
        expect(snapshot.goldEarnedThisLevel).toBe(0);
    });
});
