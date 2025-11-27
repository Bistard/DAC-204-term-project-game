import { STARTING_HP } from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { createInitialGameState } from '../state/gameState';
import {
    GamePhase,
    Item,
    MetaState,
    PenaltyCard,
    StoreUpdateMeta,
    TurnOwner,
} from '../../common/types';
import { createDeck, getRandomEnemy, getRandomEnvironment, getRandomPenaltyCard } from '../utils';
import { IBattleService } from '../battle/IBattleService';
import { IRewardService } from '../battle/rewards/IRewardService';
import { IRunService } from './IRunService';
import { IBattleResult } from '../state/results';
import { BattleContext } from '../battle/BattleContext';

interface RunServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    battleService: IBattleService;
    rewardService: IRewardService;
    getMetaState: () => MetaState;
}

export class RunService implements IRunService {
    constructor(private deps: RunServiceDeps) {}

    startRun() {
        const meta = this.deps.getMetaState();
        const baseState = createInitialGameState(meta);
        this.deps.store.setState(
            baseState,
            this.createMeta('run.start', 'Initialize new run', { runLevel: baseState.runLevel })
        );
        const context = this.createBattleContext(1, meta, 'Run started!');
        this.deps.battleService.startBattle(context);
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
        const level = this.deps.store.snapshot.state.runLevel + 1;
        const meta = this.deps.getMetaState();
        const context = this.createBattleContext(level, meta, `Level ${level} Started.`);
        this.deps.battleService.startBattle(context);
    }

    buyUpgrade(type: 'HP' | 'INVENTORY') {
        this.deps.rewardService.buyUpgrade(type);
    }

    resumeBattleFlow() {
        this.deps.battleService.evaluateFlow();
    }

    handleBattleResult(result: IBattleResult) {
        this.deps.store.updateRunState(
            run => ({
                ...run,
                goldEarnedThisLevel: run.goldEarnedThisLevel + result.rewards.length,
                message: result.winner === 'PLAYER' ? 'Battle won!' : result.winner === 'ENEMY' ? 'Battle lost.' : 'Battle drawn.',
            }),
            this.createMeta('run.battleResult', 'Battle completed', {
                winner: result.winner,
                roundsPlayed: result.roundsPlayed,
            })
        );
    }

    private createBattleContext(level: number, meta: MetaState, message: string): BattleContext {
        const deck = createDeck();
        const envCount = level <= 1 ? 0 : Math.min(3, level - 1);
        const environment = getRandomEnvironment(envCount);
        const penalty = getRandomPenaltyCard();
        const enemy = getRandomEnemy(level);
        const playerHp = STARTING_HP + meta.upgrades.hpLevel;
        return {
            runLevel: level,
            deck,
            environment,
            penalty,
            enemy,
            playerHp,
            playerMaxHp: playerHp,
            message,
        };
    }

    private createMeta(
        tag: string,
        description: string,
        payload?: Record<string, unknown>,
        extra?: Partial<StoreUpdateMeta>
    ): StoreUpdateMeta {
        return {
            tag: `run:${tag}`,
            description,
            ...(payload ? { payload } : {}),
            ...extra,
        };
    }
}
