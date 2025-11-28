import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    REWARD_PICK_LIMIT,
    REWARD_POOL_SIZE,
} from '../../common/constants';
import { EVENT_EFFECTS, GameEventTrigger } from '../../content/events';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { GamePhase, Item, MetaState, StoreUpdateMeta, TurnOwner } from '../../common/types';
import { getRandomItems } from '../utils';
import { MetaUpdater } from '../../common/types';
import { RunLifecycleService } from './runLifecycleService';
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
        this.eventBus.emit({ type: 'battle.victory' });
        this.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.VICTORY,
                enemy: prev.enemy ? { ...prev.enemy, hp: 0 } : prev.enemy,
            }),
            this.meta('victory', 'Enemy defeated')
        );

        await this.applyEventTrigger('ENEMY_DEFEATED');
    }

    proceedToRewards() {
        this.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.REWARD,
                rewardOptions: getRandomItems(REWARD_POOL_SIZE),
                pickedRewardIndices: [],
                message: 'Enemy Defeated!',
            }),
            this.meta('phase.reward', 'Enter reward phase')
        );
    }

    pickReward(item: Item, index: number) {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.REWARD) return;
        if (snapshot.state.pickedRewardIndices.includes(index)) return;
        if (snapshot.state.pickedRewardIndices.length >= REWARD_PICK_LIMIT) return;

        this.store.updateState(
            prev => {
                const isFull = prev.player.inventory.length >= prev.player.maxInventory;
                if (isFull) return prev;

                return {
                    ...prev,
                    pickedRewardIndices: [...prev.pickedRewardIndices, index],
                    player: {
                        ...prev.player,
                        inventory: [...prev.player.inventory, item],
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
        const nextLevelState = {
            ...lifecycleState,
            goldEarnedThisLevel: 0,
            rewardOptions: [],
            pickedRewardIndices: [],
        };

        this.store.setState(
            nextLevelState,
            this.meta('next-level', 'Prepare next level', { level: nextLevelState.runLevel })
        );
        if (nextLevelState.activePenalty) {
            this.eventBus.emit({
                type: 'penalty.card',
                payload: {
                    card: nextLevelState.activePenalty,
                    state: 'DRAWN',
                    detail: `Level ${nextLevelState.runLevel} penalty selected.`,
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
        const drawCount = this.store.snapshot.state.environmentRuntime.rewardHooks.perfectItemDraw;
        if (drawCount <= 0) return;
        this.store.updateState(
            prev => {
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey];
                if (!entity) return prev;
                const slots = entity.maxInventory - entity.inventory.length;
                if (slots <= 0) return prev;
                const grant = Math.min(drawCount, slots);
                const newItems = getRandomItems(grant);
                return {
                    ...prev,
                    [entityKey]: {
                        ...entity,
                        inventory: [...entity.inventory, ...newItems],
                    },
                    message: `${actor === 'PLAYER' ? 'You' : 'Enemy'} gained ${grant} item card${grant > 1 ? 's' : ''} for a Perfect.`,
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
