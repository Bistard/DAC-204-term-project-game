import { DELAY_ITEM_USE } from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { GamePhase, Item, MetaState, StoreUpdateMeta, TurnOwner } from '../../common/types';
import { sleep } from '../utils';
import { RewardService } from './rewardService';
import { RoundService, CreateMetaFn } from './roundService';
import { ItemEffectService } from './itemEffectService';
import { AiService } from './aiService';

interface CombatServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: RewardService;
}

export class CombatService {
    private store: GameStore;
    private eventBus: EventBus;
    private roundService: RoundService;
    private itemEffects: ItemEffectService;
    private aiService: AiService;

    constructor(private deps: CombatServiceDeps) {
        this.store = deps.store;
        this.eventBus = deps.eventBus;

        const createMeta: CreateMetaFn = this.createMeta.bind(this);
        this.roundService = new RoundService({
            store: this.store,
            eventBus: this.eventBus,
            getMetaState: this.deps.getMetaState,
            rewardService: this.deps.rewardService,
            createMeta,
            onRoundReady: () => this.evaluateFlow(),
        });
        this.itemEffects = new ItemEffectService({
            store: this.store,
            eventBus: this.eventBus,
            roundService: this.roundService,
            createMeta,
        });
        this.aiService = new AiService({
            store: this.store,
            createMeta,
            onHit: () => this.hit('ENEMY'),
            onStand: () => this.stand('ENEMY'),
        });
    }

    startRun() {
        this.roundService.startRun();
    }

    startRound() {
        return this.roundService.startRound();
    }

    async hit(actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        if (actor === 'PLAYER' && snapshot.state.turnOwner !== 'PLAYER') return;
        if (actor === 'ENEMY' && (!snapshot.state.enemy || snapshot.state.turnOwner !== 'ENEMY')) return;

        this.roundService.emitHandAction(actor, 'HIT', 1000);

        const drawn = await this.roundService.drawCard(actor, { faceDown: true });
        if (!drawn) return;

        this.roundService.setDealing(true);
        await sleep(1200);
        this.roundService.revealCard(actor, drawn.cardId);
        this.roundService.setDealing(false);
        this.evaluateFlow();
    }

    stand(actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.BATTLE) return;

        this.roundService.emitHandAction(actor, 'STAND', 800);
        this.store.updateState(
            prev => {
                const isPlayer = actor === 'PLAYER';
                const nextTurnOwner: TurnOwner = isPlayer ? 'ENEMY' : 'PLAYER';
                return {
                    ...prev,
                    playerStood: isPlayer ? true : prev.playerStood,
                    enemyStood: !isPlayer ? true : prev.enemyStood,
                    turnOwner: nextTurnOwner,
                    message: `${actor} stands.`,
                };
            },
            this.createMeta('turn.stand', `${actor} stands`, { actor })
        );
        this.evaluateFlow();
    }

    async useItem(index: number, actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        if (snapshot.state.turnOwner !== actor) return;
        const entity = actor === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
        if (!entity || !entity.inventory[index]) return;
        const item = entity.inventory[index];

        this.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'START' } });
        await sleep(DELAY_ITEM_USE);
        this.roundService.emitHandAction(actor, 'USE', 800);

        this.store.updateState(
            prev => {
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const current = prev[entityKey]!;
                if (!current.inventory[index]) return prev;
                const newInventory = current.inventory.filter((_, idx) => idx !== index);

                return {
                    ...prev,
                    [entityKey]: {
                        ...current,
                        inventory: newInventory,
                    },
                    ...(actor === 'PLAYER' ? { enemyStood: false } : { playerStood: false }),
                };
            },
            this.createMeta('item.consume', `${actor} used ${item.name}`, { actor, itemId: item.id })
        );

        await this.itemEffects.applyItemEffects(item, actor);

        this.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'END' } });
        this.evaluateFlow();
    }

    evaluateFlow() {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.BATTLE) {
            return;
        }

        if (
            snapshot.flags.isProcessingAI &&
            (snapshot.state.turnOwner !== 'ENEMY' || snapshot.state.enemyStood || snapshot.flags.isDealing)
        ) {
            this.aiService.cancelProcessing();
        }

        if (
            snapshot.state.playerStood &&
            snapshot.state.enemyStood &&
            !snapshot.flags.isResolvingRound
        ) {
            this.roundService.resolveRound();
            return;
        }

        if (
            snapshot.state.turnOwner === 'ENEMY' &&
            !snapshot.flags.isProcessingAI &&
            !snapshot.flags.isDealing &&
            !snapshot.state.enemyStood
        ) {
            this.aiService.queueTurn();
        }
    }

    private createMeta(
        tag: string,
        description: string,
        payload?: Record<string, unknown>,
        extra?: Partial<StoreUpdateMeta>
    ): StoreUpdateMeta {
        return {
            tag: `combat:${tag}`,
            description,
            ...(payload ? { payload } : {}),
            ...extra,
        };
    }
}
