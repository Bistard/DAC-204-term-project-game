import { DELAY_ITEM_USE } from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import {
    GamePhase,
    Item,
    MetaState,
    PenaltyCard,
    StoreUpdateMeta,
    TurnOwner,
} from '../../common/types';
import { sleep, applyEnvironmentRules } from '../utils';
import { RoundService, CreateMetaFn } from '../round/RoundService';
import { ItemEffectService } from '../round/items/ItemService';
import { IBattleService } from './IBattleService';
import { IRewardService } from './rewards/IRewardService';
import { IAiService } from './ai/IAiService';
import { AiService } from './ai/AiService';
import { BattleContext } from './BattleContext';
import { createDefaultPenaltyRuntime, createDefaultRoundModifiers } from '../state/gameState';

interface BattleServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: IRewardService;
}

export class BattleService implements IBattleService {
    private store: GameStore;
    private eventBus: EventBus;
    private roundService: RoundService;
    private itemEffects: ItemEffectService;
    private aiService: IAiService;

    constructor(private deps: BattleServiceDeps) {
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

    startBattle(context: BattleContext) {
        const baseState = this.store.snapshot.state;
        const applied = applyEnvironmentRules({
            ...baseState,
            phase: GamePhase.BATTLE,
            runLevel: context.runLevel,
            roundCount: 1,
            deck: context.deck,
            discardPile: [],
            activeEnvironment: context.environment,
            activePenalty: context.penalty,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            player: {
                ...baseState.player,
                hp: context.playerHp,
                maxHp: context.playerMaxHp,
                hand: [],
                score: 0,
                shield: 0,
            },
            enemy: {
                ...context.enemy,
                hand: [],
                score: 0,
                shield: context.enemy.shield ?? 0,
            },
            playerStood: false,
            enemyStood: false,
            turnOwner: 'PLAYER',
            message: context.message,
            rewardOptions: [],
            pickedRewardIndices: [],
            roundModifiers: createDefaultRoundModifiers(),
            goldEarnedThisLevel: 0,
        });
        this.store.setState(
            applied,
            this.createMeta('battle.start', 'Battle initialized', { runLevel: context.runLevel })
        );
        if (context.penalty) {
            this.emitPenaltyEvent(context.penalty, 'DRAWN', 'Battle penalty selected.');
        }
        this.startRound();
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
        if (snapshot.state.environmentRuntime.itemLocks.disableUsage) return;
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

    private emitPenaltyEvent(card: PenaltyCard, state: 'DRAWN' | 'APPLIED', detail?: string) {
        this.eventBus.emit({
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
            tag: `combat:${tag}`,
            description,
            ...(payload ? { payload } : {}),
            ...extra,
        };
    }
}
