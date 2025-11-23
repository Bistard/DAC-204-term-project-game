import { EventBus } from './eventBus';
import { CombatService } from './services/combatService';
import { RewardService } from './services/rewardService';
import { GameStore } from './state/gameStore';
import { createInitialGameState } from './state/gameState';
import { GameSnapshot, GameState, Item, MetaState, TurnOwner } from '../types';
import { MetaUpdater } from '../types';

interface GameEngineDeps {
    eventBus: EventBus;
    getMetaState: () => MetaState;
    updateMetaState: MetaUpdater;
}

export class GameEngine {
    private store: GameStore;
    private combatService: CombatService;
    private rewardService: RewardService;

    constructor(private deps: GameEngineDeps) {
        this.store = new GameStore(createInitialGameState(deps.getMetaState()));

        this.rewardService = new RewardService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            updateMetaState: deps.updateMetaState,
        });

        this.combatService = new CombatService({
            store: this.store,
            eventBus: deps.eventBus,
            getMetaState: deps.getMetaState,
            rewardService: this.rewardService,
        });
    }

    subscribe(listener: (snapshot: GameSnapshot) => void) {
        return this.store.subscribe(listener);
    }

    get snapshot() {
        return this.store.snapshot;
    }

    updateState(mutator: (state: GameState) => GameState) {
        this.store.updateState(mutator);
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
}
