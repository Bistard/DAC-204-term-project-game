import { Item, TurnOwner } from '../../common/types';
import { IBattleResult } from '../state/results';

/**
 * High-level entry points exposed to the UI or game engine for interacting
 * with the ongoing run. Orchestrates battles via IBattleService while keeping
 * run-level concerns (progression, rewards) isolated from battle/round logic.
 */
export interface IRunService {
    startRun(): void;
    hit(actor: TurnOwner): Promise<void> | void;
    stand(actor: TurnOwner): void;
    useItem(index: number, actor: TurnOwner): Promise<void> | void;
    proceedToRewards(): void;
    pickReward(item: Item, index: number): void;
    startNextLevel(): Promise<void> | void;
    buyUpgrade(type: 'HP' | 'INVENTORY'): void;
    resumeBattleFlow(): void;
    handleBattleResult(result: IBattleResult): void;
}
