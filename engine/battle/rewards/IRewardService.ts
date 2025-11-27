import { Item, TurnOwner } from '../../../common/types';
import { GameEventTrigger } from '../../../content/events';

export interface IRewardService {
    handleVictory(): Promise<void> | void;
    proceedToRewards(): void;
    pickReward(item: Item, index: number): void;
    prepareNextLevel(): void;
    buyUpgrade(type: 'HP' | 'INVENTORY'): void;
    applyEventTrigger(trigger: GameEventTrigger): void;
    applyEnvironmentPerfectReward(actor: TurnOwner): void;
}
