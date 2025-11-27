import { describe, expect, it, vi } from 'vitest';
import { TurnOwner, ItemType } from '../../../common/types';
import { IBattleService } from '../../battle/IBattleService';
import { IRewardService } from '../../battle/rewards/IRewardService';
import { RunService } from '../RunService';

const createDeps = () => {
    const battleService: IBattleService = {
        startRun: vi.fn(),
        startRound: vi.fn(),
        hit: vi.fn(),
        stand: vi.fn(),
        useItem: vi.fn(),
        evaluateFlow: vi.fn(),
    };

    const rewardService: IRewardService = {
        handleVictory: vi.fn(),
        proceedToRewards: vi.fn(),
        pickReward: vi.fn(),
        prepareNextLevel: vi.fn(),
        buyUpgrade: vi.fn(),
    };

    return { battleService, rewardService };
};

const createService = () => {
    const deps = createDeps();
    return { service: new RunService(deps), ...deps };
};

describe('RunService adapter', () => {
    it('delegates combat actions to the battle service', async () => {
        const { service, battleService } = createService();
        service.startRun();
        await service.startRound();
        await service.hit('PLAYER' as TurnOwner);
        service.stand('ENEMY');
        await service.useItem(0, 'PLAYER');

        expect(battleService.startRun).toHaveBeenCalled();
        expect(battleService.startRound).toHaveBeenCalled();
        expect(battleService.hit).toHaveBeenCalledWith('PLAYER');
        expect(battleService.stand).toHaveBeenCalledWith('ENEMY');
        expect(battleService.useItem).toHaveBeenCalledWith(0, 'PLAYER');
    });

    it('routes reward operations through the reward service', () => {
        const { service, rewardService } = createService();
        const item = { id: 'i', name: 'Item', description: '', type: ItemType.CONSUMABLE, effects: [], instanceId: 'i-1' };

        service.proceedToRewards();
        service.pickReward(item, 1);
        service.buyUpgrade('HP');

        expect(rewardService.proceedToRewards).toHaveBeenCalled();
        expect(rewardService.pickReward).toHaveBeenCalledWith(item, 1);
        expect(rewardService.buyUpgrade).toHaveBeenCalledWith('HP');
    });

    it('prepares the next level before starting a new battle', async () => {
        const { service, rewardService, battleService } = createService();
        await service.startNextLevel();

        expect(rewardService.prepareNextLevel).toHaveBeenCalledTimes(1);
        expect(battleService.startRound).toHaveBeenCalledTimes(1);
    });

    it('resumes battle flow through the battle service', () => {
        const { service, battleService } = createService();
        service.resumeBattleFlow();
        expect(battleService.evaluateFlow).toHaveBeenCalledTimes(1);
    });
});
