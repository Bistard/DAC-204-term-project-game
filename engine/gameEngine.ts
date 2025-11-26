import { EventBus } from './eventBus';
import { CombatService } from './services/combatService';
import { RewardService } from './services/rewardService';
import { RunLifecycleService } from './services/runLifecycleService';
import { GameStore } from './state/gameStore';
import { createInitialGameState } from './state/gameState';
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
    private combatService: CombatService;
    private rewardService: RewardService;
    private runLifecycleService: RunLifecycleService;

    constructor(private deps: GameEngineDeps) {
        this.store = new GameStore(createInitialGameState(deps.getMetaState()));
        this.runLifecycleService = new RunLifecycleService();

        this.rewardService = new RewardService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            updateMetaState: deps.updateMetaState,
            runLifecycleService: this.runLifecycleService,
        });

        this.combatService = new CombatService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            rewardService: this.rewardService,
            runLifecycleService: this.runLifecycleService,
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
        this.combatService.startRun();
    }

    startRound() {
        return this.combatService.startRound();
    }

    hit(actor: TurnOwner) {
        return this.combatService.hit(actor);
    }

    stand(actor: TurnOwner) {
        this.combatService.stand(actor);
    }

    useItem(index: number, actor: TurnOwner) {
        return this.combatService.useItem(index, actor);
    }

    proceedToRewards() {
        this.rewardService.proceedToRewards();
    }

    pickReward(item: Item, index: number) {
        this.rewardService.pickReward(item, index);
    }

    nextLevel() {
        this.rewardService.prepareNextLevel();
        this.combatService.startRound();
    }

    buyUpgrade(type: 'HP' | 'INVENTORY') {
        this.rewardService.buyUpgrade(type);
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
        this.combatService.evaluateFlow();
    }
}
