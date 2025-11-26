import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    REWARD_PICK_LIMIT,
    REWARD_POOL_SIZE,
} from '../../common/constants';
import { EVENT_EFFECTS, GameEventTrigger } from '../../content/events';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { Enemy, GamePhase, Item, MetaState, PlayerBattleState, StoreUpdateMeta, TurnOwner } from '../../common/types';
import { getRandomItems } from '../utils';
import { MetaUpdater } from '../../common/types';
import { RunLifecycleService } from './runLifecycleService';
import { withBattleState } from '../state/gameState';
import { EffectRegistry } from '../effects/effectRegistry';

interface RewardServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    updateMetaState: MetaUpdater;
    runLifecycleService: RunLifecycleService;
}

export class RewardService {
    private store: GameStore;
    private eventBus: EventBus;
    private runLifecycle: RunLifecycleService;
    private effectRegistry: EffectRegistry | null = null;

    constructor(private deps: RewardServiceDeps) {
        this.store = deps.store;
        this.eventBus = deps.eventBus;
        this.runLifecycle = deps.runLifecycleService;
    }

    async handleVictory() {
        this.store.updateState(
            prev => {
                if (!prev.battle) return prev;
                const nextState = withBattleState(prev, battle => ({
                    ...battle,
                    enemy: battle.enemy ? { ...battle.enemy, hp: 0 } : battle.enemy,
                }));
                return {
                    ...nextState,
                    phase: GamePhase.VICTORY,
                };
            },
            this.meta('victory', 'Enemy defeated')
        );

        await this.applyEventTrigger('ENEMY_DEFEATED');
    }

    proceedToRewards() {
        this.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.REWARD,
                run: {
                    ...prev.run,
                    status: 'AWAITING_REWARD',
                    rewardOptions: getRandomItems(REWARD_POOL_SIZE),
                    pickedRewardIndices: [],
                },
                message: 'Enemy Defeated!',
            }),
            this.meta('phase.reward', 'Enter reward phase')
        );
    }

    pickReward(item: Item, index: number) {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.REWARD) return;
        if (snapshot.state.run.pickedRewardIndices.includes(index)) return;
        if (snapshot.state.run.pickedRewardIndices.length >= REWARD_PICK_LIMIT) return;

        this.store.updateState(
            prev => {
                if (prev.phase !== GamePhase.REWARD || !prev.battle) return prev;
                const run = prev.run;
                if (run.pickedRewardIndices.includes(index)) return prev;
                if (run.pickedRewardIndices.length >= REWARD_PICK_LIMIT) return prev;

                const player = prev.battle.player;
                if (player.inventory.length >= player.maxInventory) return prev;

                const withItem = withBattleState(prev, battle => ({
                    ...battle,
                    player: {
                        ...battle.player,
                        inventory: [...battle.player.inventory, item],
                    },
                }));

                return {
                    ...withItem,
                    run: {
                        ...withItem.run,
                        pickedRewardIndices: [...withItem.run.pickedRewardIndices, index],
                    },
                };
            },
            this.meta('reward.pick', 'Player picked reward', { index, itemId: item.id })
        );
    }

    prepareNextLevel() {
        const snapshot = this.store.snapshot;
        const meta = this.deps.getMetaState();
        const lifecycleState = this.runLifecycle.prepareNextLevel(snapshot.state, meta);
        this.store.setState(
            lifecycleState,
            this.meta('next-level', 'Prepare next level', { level: lifecycleState.run.level })
        );
        if (lifecycleState.battle?.activePenalty) {
            this.eventBus.emit({
                type: 'penalty.card',
                payload: {
                    card: lifecycleState.battle.activePenalty,
                    state: 'DRAWN',
                    detail: `Level ${lifecycleState.run.level} penalty selected.`,
                },
            });
        }
    }

    buyUpgrade(type: 'HP' | 'INVENTORY') {
        const costTable = type === 'HP' ? COST_UPGRADE_HP : COST_UPGRADE_INVENTORY;
        let spent = 0;
        this.deps.updateMetaState(prev => {
            const level = type === 'HP' ? prev.upgrades.hpLevel : prev.upgrades.inventoryLevel;
            const cost = costTable[level];
            if (cost === undefined || prev.gold < cost) return prev;
            spent = cost;

            const nextUpgrades = { ...prev.upgrades };
            if (type === 'HP') nextUpgrades.hpLevel += 1;
            else nextUpgrades.inventoryLevel += 1;

            return {
                ...prev,
                gold: prev.gold - cost,
                upgrades: nextUpgrades,
            };
        });
        if (spent > 0) {
            this.eventBus.emit({
                type: 'damage.number',
                payload: { value: `- ${spent} Gold`, target: 'PLAYER', variant: 'GOLD' },
            });
        }
    }

    async applyEventTrigger(trigger: GameEventTrigger) {
        if (!this.effectRegistry) {
            console.warn(`[RewardService] Effect registry not bound. Skipping trigger ${trigger}.`);
            return;
        }
        const matching = EVENT_EFFECTS.filter(evt => evt.trigger === trigger);
        for (const evt of matching) {
            await this.effectRegistry.executeEffects(evt.effects, {
                actor: 'PLAYER',
                source: { type: 'EVENT', id: evt.id, label: evt.description },
                meta: { updateMetaState: this.deps.updateMetaState },
                extra: { trigger },
            });
        }
    }

    applyEnvironmentPerfectReward(actor: TurnOwner) {
        const battle = this.store.snapshot.state.battle;
        const drawCount = battle?.environmentRuntime.rewardHooks.perfectItemDraw ?? 0;
        if (drawCount <= 0) return;
        this.store.updateState(
            prev => {
                if (!prev.battle) return prev;
                const battle = prev.battle;
                const entity = actor === 'PLAYER' ? battle.player : battle.enemy;
                if (!entity) return prev;
                const slots = entity.maxInventory - entity.inventory.length;
                if (slots <= 0) return prev;
                const grant = Math.min(drawCount, slots);
                const newItems = getRandomItems(grant);
                const withRewards = withBattleState(prev, current => {
                    if (actor === 'PLAYER') {
                        const playerEntity = entity as PlayerBattleState;
                        return {
                            ...current,
                            player: {
                                ...playerEntity,
                                inventory: [...playerEntity.inventory, ...newItems],
                            },
                        };
                    }
                    const enemyEntity = entity as Enemy;
                    return {
                        ...current,
                        enemy: enemyEntity
                            ? {
                                  ...enemyEntity,
                                  inventory: [...enemyEntity.inventory, ...newItems],
                              }
                            : null,
                    };
                });

                return {
                    ...withRewards,
                    message: `${
                        actor === 'PLAYER' ? 'You' : 'Enemy'
                    } gained ${grant} item card${grant > 1 ? 's' : ''} for a Perfect.`,
                };
            },
            this.meta('reward.envPerfect', 'Environment perfect reward granted', { actor, amount: drawCount })
        );
    }

    bindEffectRegistry(registry: EffectRegistry) {
        this.effectRegistry = registry;
    }

    private meta(
        tag: string,
        description: string,
        payload?: Record<string, unknown>,
        extra?: Partial<StoreUpdateMeta>
    ): StoreUpdateMeta {
        return {
            tag: `reward:${tag}`,
            description,
            ...(payload ? { payload } : {}),
            ...extra,
        };
    }
}
