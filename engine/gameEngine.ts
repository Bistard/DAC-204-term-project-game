import { EventBus } from './eventBus';
import { GameStore } from './state/gameStore';
import { createInitialGameState } from './state/gameState';
import { BattleService } from './battle/BattleService';
import { RewardService } from './battle/rewards/RewardService';
import { RunService } from './run/RunService';
import { IRunService } from './run/IRunService';
import {
    GameLogEntry,
    GameSnapshot,
    GameState,
    Item,
    MetaState,
    LoadHistoryOptions,
    RecordingOptions,
    ReplayFrame,
    ReplayOptions,
    StoreUpdateMeta,
    TurnOwner,
} from '../common/types';
import { MetaUpdater } from '../common/types';

interface GameEngineDeps {
    eventBus: EventBus;
    getMetaState: () => MetaState;
    updateMetaState: MetaUpdater;
}

export class GameEngine {
    private store: GameStore;
    private battleService: BattleService;
    private rewardService: RewardService;
    private runService: IRunService;

    constructor(private deps: GameEngineDeps) {
        this.store = new GameStore(createInitialGameState(deps.getMetaState()));

        this.rewardService = new RewardService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            updateMetaState: deps.updateMetaState,
        });

        this.battleService = new BattleService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            rewardService: this.rewardService,
        });

        this.runService = new RunService({
            store: this.store,
            eventBus: deps.eventBus,
            battleService: this.battleService,
            rewardService: this.rewardService,
            getMetaState: deps.getMetaState,
        });
    }

    subscribe(listener: (snapshot: GameSnapshot) => void) {
        return this.store.subscribe(listener);
    }

    get snapshot() {
        return this.store.snapshot;
    }

    updateState(mutator: (state: GameState) => GameState, meta?: StoreUpdateMeta) {
        this.store.updateState(mutator, meta);
    }

    startRun() {
        this.runService.startRun();
    }

    hit(actor: TurnOwner) {
        return this.runService.hit(actor);
    }

    stand(actor: TurnOwner) {
        this.runService.stand(actor);
    }

    useItem(index: number, actor: TurnOwner) {
        return this.runService.useItem(index, actor);
    }

    proceedToRewards() {
        this.runService.proceedToRewards();
    }

    pickReward(item: Item, index: number) {
        this.runService.pickReward(item, index);
    }

    nextLevel() {
        this.runService.startNextLevel();
    }

    buyUpgrade(type: 'HP' | 'INVENTORY') {
        this.runService.buyUpgrade(type);
    }

    getActionLog(limit?: number): GameLogEntry[] {
        return this.store.getLogs(limit);
    }

    getHistory(): ReplayFrame[] {
        return this.store.getHistory();
    }

    loadHistory(frames: ReplayFrame[], options?: LoadHistoryOptions) {
        this.store.loadHistory(frames, options);
    }

    undo() {
        return this.store.undo();
    }

    redo() {
        return this.store.redo();
    }

    canUndo() {
        return this.store.canUndo();
    }

    canRedo() {
        return this.store.canRedo();
    }

    startRecording(options?: RecordingOptions) {
        this.store.startRecording(options);
    }

    stopRecording(): ReplayFrame[] {
        return this.store.stopRecording();
    }

    isRecording() {
        return this.store.isRecording();
    }

    getRecording() {
        return this.store.getRecording();
    }

    replay(options?: ReplayOptions) {
        return this.store.replay(options);
    }

    resumeGame(options: { resetFlags?: boolean } = {}) {
        if (options.resetFlags !== false) {
            this.store.resetFlags({
                tag: 'debug:resume',
                description: 'Runtime flags reset before resuming',
                suppressHistory: true,
                suppressLog: true,
            });
        }
        this.runService.resumeBattleFlow();
    }
}
