import { STARTING_HP } from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { createDefaultPenaltyRuntime, createInitialGameState } from '../state/gameState';
import {
    GamePhase,
    GameState,
    Item,
    MetaState,
    PenaltyCard,
    StoreUpdateMeta,
    TurnOwner,
} from '../../common/types';
import { applyEnvironmentRules, createDeck, getRandomEnemy, getRandomEnvironment, getRandomPenaltyCard } from '../utils';
import { IBattleService } from '../battle/IBattleService';
import { IRewardService } from '../battle/rewards/IRewardService';
import { IRunService } from './IRunService';
import { IBattleResult } from '../state/results';

interface RunServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    battleService: IBattleService;
    rewardService: IRewardService;
    getMetaState: () => MetaState;
}

interface BattleBootstrap {
    state: GameState;
    penaltyCard: PenaltyCard | null;
}

export class RunService implements IRunService {
    constructor(private deps: RunServiceDeps) {}

    startRun() {
        const bootstrap = this.createInitialBattleState(this.deps.getMetaState());
        this.deps.store.setState(
            bootstrap.state,
            this.createMeta('run.start', 'Initialize new run', { runLevel: bootstrap.state.runLevel })
        );
        if (bootstrap.penaltyCard) {
            this.emitPenaltyEvent(bootstrap.penaltyCard, 'DRAWN', 'Battle penalty selected.');
        }
        this.deps.battleService.startRound();
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

    private createInitialBattleState(meta: MetaState): BattleBootstrap {
        const deck = createDeck();
        const environment = getRandomEnvironment(3);
        const penaltyCard = getRandomPenaltyCard();
        const baseState = createInitialGameState(meta);
        const state = applyEnvironmentRules({
            ...baseState,
            phase: GamePhase.BATTLE,
            runLevel: 1,
            roundCount: 1,
            deck,
            discardPile: [],
            player: {
                ...baseState.player,
                hp: STARTING_HP + meta.upgrades.hpLevel,
                maxHp: STARTING_HP + meta.upgrades.hpLevel,
            },
            enemy: getRandomEnemy(1),
            activeEnvironment: environment,
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            message: 'Run started!',
        });
        return { state, penaltyCard };
    }

    private emitPenaltyEvent(card: PenaltyCard, state: 'DRAWN' | 'APPLIED', detail?: string) {
        this.deps.eventBus.emit({
            type: 'penalty.card',
            payload: { card, state, detail },
        });
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
