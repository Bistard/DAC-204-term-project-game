import { Item } from '../../../common/types';

export interface IRewardService {
    handleVictory(): Promise<void> | void;
    proceedToRewards(): void;
    pickReward(item: Item, index: number): void;
    prepareNextLevel(): void;
    buyUpgrade(type: 'HP' | 'INVENTORY'): void;
}
