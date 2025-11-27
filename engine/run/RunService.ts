import { Item, TurnOwner } from '../../common/types';
import { IBattleService } from '../battle/IBattleService';
import { IRewardService } from '../battle/rewards/IRewardService';
import { IRunService } from './IRunService';

interface RunServiceDeps {
    battleService: IBattleService;
    rewardService: IRewardService;
}

/**
 * Thin adapter that currently forwards calls to the legacy CombatService +
 * RewardService combo. Future phases will move real run logic here.
 */
export class RunService implements IRunService {
    constructor(private deps: RunServiceDeps) {}

    startRun() {
        this.deps.battleService.startRun();
    }

    startRound() {
        return this.deps.battleService.startRound();
    }

    hit(actor: TurnOwner) {
        return this.deps.battleService.hit(actor);
    }

    stand(actor: TurnOwner) {
        this.deps.battleService.stand(actor);
    }

    useItem(index: number, actor: TurnOwner) {
        return this.deps.battleService.useItem(index, actor);
    }

    proceedToRewards() {
        this.deps.rewardService.proceedToRewards();
    }

    pickReward(item: Item, index: number) {
        this.deps.rewardService.pickReward(item, index);
    }

    startNextLevel() {
        this.deps.rewardService.prepareNextLevel();
        return this.deps.battleService.startRound();
    }

    buyUpgrade(type: 'HP' | 'INVENTORY') {
        this.deps.rewardService.buyUpgrade(type);
    }

    resumeBattleFlow() {
        this.deps.battleService.evaluateFlow();
    }
}
