import { DELAY_ITEM_USE } from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { GamePhase, Item, MetaState, StoreUpdateMeta, TurnOwner } from '../../common/types';
import { sleep } from '../utils';
import { RewardService } from './rewardService';
import { RoundService } from './roundService';
import { ItemEffectService } from './itemEffectService';
import { AiService } from './aiService';
import { RunLifecycleService } from './runLifecycleService';
import { DamageService } from './damageService';
import { PenaltyEngine } from './penaltyEngine';
import { CreateMetaFn } from './commonService';
import { EffectRegistry } from '../effects/effectRegistry';
import { withBattleState, withRoundState } from '../state/gameState';

interface CombatServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: RewardService;
    runLifecycleService: RunLifecycleService;
}

export class CombatService {
    private store: GameStore;
    private eventBus: EventBus;
    private roundService: RoundService;
    private itemEffects: ItemEffectService;
    private aiService: AiService;
    private damageService: DamageService;
    private penaltyEngine: PenaltyEngine;
    private effectRegistry: EffectRegistry;

    constructor(private deps: CombatServiceDeps) {
        this.store = deps.store;
        this.eventBus = deps.eventBus;

        const createMeta: CreateMetaFn = this.createMeta.bind(this);
        this.damageService = new DamageService({
            store: this.store,
            eventBus: this.eventBus,
            createMeta,
        });
        this.penaltyEngine = new PenaltyEngine({
            store: this.store,
            createMeta,
        });
        this.roundService = new RoundService({
            store: this.store,
            eventBus: this.eventBus,
            getMetaState: this.deps.getMetaState,
            rewardService: this.deps.rewardService,
            runLifecycleService: this.deps.runLifecycleService,
            damageService: this.damageService,
            penaltyEngine: this.penaltyEngine,
            createMeta,
            onRoundReady: () => this.evaluateFlow(),
        });
        this.effectRegistry = new EffectRegistry({
            store: this.store,
            eventBus: this.eventBus,
            roundService: this.roundService,
            damageService: this.damageService,
            createMeta,
        });
        this.itemEffects = new ItemEffectService({
            effectRegistry: this.effectRegistry,
        });
        this.deps.rewardService.bindEffectRegistry(this.effectRegistry);
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
        const round = snapshot.state.round;
        const battle = snapshot.state.battle;
        if (!round || !battle) return;
        if (actor === 'PLAYER' && round.turnOwner !== 'PLAYER') return;
        if (actor === 'ENEMY' && (!battle.enemy || round.turnOwner !== 'ENEMY')) return;

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
        if (!snapshot.state.round) return;

        this.roundService.emitHandAction(actor, 'STAND', 800);
        this.store.updateState(
            prev => {
                if (!prev.round) return prev;
                const nextTurnOwner: TurnOwner = actor === 'PLAYER' ? 'ENEMY' : 'PLAYER';

                return {
                    ...withRoundState(prev, round => ({
                        ...round,
                        turnOwner: nextTurnOwner,
                        player:
                            actor === 'PLAYER' ? { ...round.player, stood: true } : round.player,
                        enemy:
                            actor === 'ENEMY' && round.enemy
                                ? { ...round.enemy, stood: true }
                                : round.enemy,
                    })),
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
        const round = snapshot.state.round;
        const battle = snapshot.state.battle;
        if (!round || !battle) return;
        if (round.turnOwner !== actor) return;
        if (battle.environmentRuntime.itemLocks.disableUsage) return;
        const entity = actor === 'PLAYER' ? battle.player : battle.enemy;
        if (!entity || !entity.inventory[index]) return;
        const item = entity.inventory[index];

        this.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'START' } });
        await sleep(DELAY_ITEM_USE);
        this.roundService.emitHandAction(actor, 'USE', 800);

        this.store.updateState(
            prev => {
                if (!prev.battle || !prev.round) return prev;
                const hasItem =
                    actor === 'PLAYER'
                        ? Boolean(prev.battle.player.inventory[index])
                        : Boolean(prev.battle.enemy?.inventory[index]);
                if (!hasItem) return prev;

                const withoutItem = withBattleState(prev, battleState => {
                    const inventory =
                        actor === 'PLAYER'
                            ? battleState.player.inventory.filter((_, idx) => idx !== index)
                            : battleState.enemy
                            ? battleState.enemy.inventory.filter((_, idx) => idx !== index)
                            : [];
                    if (actor === 'PLAYER') {
                        return {
                            ...battleState,
                            player: {
                                ...battleState.player,
                                inventory,
                            },
                        };
                    }
                    return {
                        ...battleState,
                        enemy: battleState.enemy
                            ? { ...battleState.enemy, inventory }
                            : battleState.enemy,
                    };
                });

                return withRoundState(withoutItem, roundState => ({
                    ...roundState,
                    enemy:
                        actor === 'PLAYER' && roundState.enemy
                            ? { ...roundState.enemy, stood: false }
                            : roundState.enemy,
                    player:
                        actor === 'ENEMY'
                            ? { ...roundState.player, stood: false }
                            : roundState.player,
                }));
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
        const round = snapshot.state.round;
        if (!round) return;

        const playerStood = round.player.stood;
        const enemyStood = round.enemy ? round.enemy.stood : true;
        const turnOwner = round.turnOwner;

        if (
            snapshot.flags.isProcessingAI &&
            (turnOwner !== 'ENEMY' || enemyStood || snapshot.flags.isDealing)
        ) {
            this.aiService.cancelProcessing();
        }

        if (playerStood && enemyStood && !snapshot.flags.isResolvingRound) {
            this.roundService.resolveRound();
            return;
        }

        if (
            turnOwner === 'ENEMY' &&
            !snapshot.flags.isProcessingAI &&
            !snapshot.flags.isDealing &&
            !enemyStood
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
