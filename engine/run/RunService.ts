import { REWARD_PICK_LIMIT, REWARD_POOL_SIZE, STARTING_HP } from '../../common/constants';
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
import {
    createDeck,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomItems,
    getRandomPenaltyCard,
} from '../utils';
import { IBattleService } from '../battle/IBattleService';
import { IRunService } from './IRunService';
import { IBattleResult } from '../state/results';
import { BattleContext } from '../battle/BattleContext';

interface RunServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    battleService: IBattleService;
    getMetaState: () => MetaState;
}

type RunPhase = 'RUNNING' | 'REWARD' | 'COMPLETE' | 'GAME_OVER';

export class RunService implements IRunService {
    private pendingRewards: Item[] = [];

    constructor(private deps: RunServiceDeps) {
        this.deps.battleService.setBattleResultHandler(result => this.handleBattleResult(result));
    }

    startRun() {
        const meta = this.deps.getMetaState();
        const baseState = createInitialGameState(meta);
        this.deps.store.setState(
            baseState,
            this.createMeta('run.start', 'Initialize new run', { runLevel: baseState.runLevel })
        );
        this.beginBattle(meta, baseState.runLevel, 'Run started!');
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
        if (!this.pendingRewards.length) return;
        this.deps.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.REWARD,
                rewardOptions: this.pendingRewards,
                pickedRewardIndices: [],
                message: 'Choose your reward.',
            }),
            this.createMeta('run.rewards', 'Entering reward phase')
        );
    }

    pickReward(item: Item, index: number) {
        this.deps.store.updateState(
            prev => {
                if (prev.phase !== GamePhase.REWARD) return prev;
                if (prev.pickedRewardIndices.includes(index)) return prev;
                if (prev.pickedRewardIndices.length >= Math.min(REWARD_PICK_LIMIT, this.pendingRewards.length)) {
                    return prev;
                }
                const isFull = prev.player.inventory.length >= prev.player.maxInventory;
                if (isFull) return prev;
                const nextIndices = [...prev.pickedRewardIndices, index];
                return {
                    ...prev,
                    pickedRewardIndices: nextIndices,
                    player: {
                        ...prev.player,
                        inventory: [...prev.player.inventory, item],
                    },
                    message:
                        nextIndices.length >= Math.min(REWARD_PICK_LIMIT, this.pendingRewards.length)
                            ? 'Rewards collected. Continue when ready.'
                            : 'Reward collected.',
                };
            },
            this.createMeta('run.reward.pick', 'Picked run reward', { itemId: item.id, index })
        );
    }

    startNextLevel() {
        const meta = this.deps.getMetaState();
        const nextLevel = this.deps.store.snapshot.state.runLevel + 1;
        this.pendingRewards = [];
        this.beginBattle(meta, nextLevel, `Level ${nextLevel} Started.`);
    }

    buyUpgrade(_type: 'HP' | 'INVENTORY') {
        console.warn('buyUpgrade invoked without run-level implementation');
    }

    resumeBattleFlow() {
        this.deps.battleService.evaluateFlow();
    }

    handleBattleResult(result: IBattleResult) {
        const phase = this.resolveRunPhase(result);
        if (phase === 'REWARD') {
            this.pendingRewards = result.rewards.length ? result.rewards : this.generateRewards();
            this.proceedToRewards();
        } else if (phase === 'RUNNING') {
            this.pendingRewards = [];
            const meta = this.deps.getMetaState();
            const level = this.deps.store.snapshot.state.runLevel + (result.winner === 'PLAYER' ? 1 : 0);
            this.beginBattle(meta, level, 'Next battle begins...');
        } else if (phase === 'GAME_OVER') {
            this.pendingRewards = [];
            this.deps.store.updateState(
                prev => ({
                    ...prev,
                    phase: GamePhase.GAME_OVER,
                    message: 'You were defeated.',
                }),
                this.createMeta('run.gameOver', 'Run ended')
            );
        }
    }

    private resolveRunPhase(result: IBattleResult): RunPhase {
        if (result.winner === 'PLAYER') return 'REWARD';
        if (result.winner === 'ENEMY') return 'GAME_OVER';
        return 'RUNNING';
    }

    private beginBattle(meta: MetaState, level: number, message: string) {
        const context = this.createBattleContext(level, meta, message);
        this.deps.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.BATTLE,
                runLevel: level,
                message,
            }),
            this.createMeta('run.startBattle', 'Starting battle', { level })
        );
        this.deps.battleService.startBattle(context);
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

    private generateRewards(): Item[] {
        return getRandomItems(REWARD_POOL_SIZE);
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
