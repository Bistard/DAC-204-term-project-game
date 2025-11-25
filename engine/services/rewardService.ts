import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    REWARD_PICK_LIMIT,
    REWARD_POOL_SIZE,
    STARTING_HP,
    TARGET_SCORE,
} from '../../common/constants';
import { EVENT_EFFECTS, GameEventTrigger } from '../../content/events';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { GamePhase, Item, LogicEffectConfig, MetaState, StoreUpdateMeta } from '../../common/types';
import {
    getRandomEnemy,
    getRandomEnvironment,
    getRandomItems,
    createDeck,
    applyEnvironmentRules,
    getRandomPenaltyCard,
} from '../utils';
import { createDefaultPenaltyRuntime, createDefaultRoundModifiers } from '../state/gameState';
import { MetaUpdater } from '../../common/types';

interface RewardServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    updateMetaState: MetaUpdater;
}

export class RewardService {
    private store: GameStore;
    private eventBus: EventBus;

    constructor(private deps: RewardServiceDeps) {
        this.store = deps.store;
        this.eventBus = deps.eventBus;
    }

    async handleVictory() {
        this.store.updateState(
            prev => ({
                ...prev,
                phase: GamePhase.VICTORY,
                enemy: prev.enemy ? { ...prev.enemy, hp: 0 } : prev.enemy,
            }),
            this.meta('victory', 'Enemy defeated')
        );

        this.applyEventTrigger('ENEMY_DEFEATED');
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
        const nextLevel = snapshot.state.runLevel + 1;
        const envCount = nextLevel <= 1 ? 0 : Math.min(3, nextLevel - 1);
        const envCards = getRandomEnvironment(envCount);
        const penaltyCard = getRandomPenaltyCard();

        const meta = this.deps.getMetaState();

        this.store.updateState(
            prev =>
                applyEnvironmentRules({
                    ...prev,
                    runLevel: nextLevel,
                    roundCount: 1,
                    targetScore: TARGET_SCORE,
                    baseTargetScore: TARGET_SCORE,
                    phase: GamePhase.BATTLE,
                    player: {
                        ...prev.player,
                        hp: STARTING_HP + meta.upgrades.hpLevel,
                        hand: [],
                        score: 0,
                        shield: 0,
                    },
                    enemy: getRandomEnemy(nextLevel),
                    activeEnvironment: envCards,
                    activePenalty: penaltyCard,
                    penaltyRuntime: createDefaultPenaltyRuntime(),
                    deck: createDeck(),
                    discardPile: [],
                    turnOwner: 'PLAYER',
                    playerStood: false,
                    enemyStood: false,
                    message: `Level ${nextLevel} Started.`,
                    goldEarnedThisLevel: 0,
                    rewardOptions: [],
                    pickedRewardIndices: [],
                    roundModifiers: createDefaultRoundModifiers(),
                }),
            this.meta('next-level', 'Prepare next level', { level: nextLevel })
        );
        this.eventBus.emit({
            type: 'penalty.card',
            payload: { card: penaltyCard, state: 'DRAWN', detail: `Level ${nextLevel} penalty selected.` },
        });
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

    applyEventTrigger(trigger: GameEventTrigger) {
        EVENT_EFFECTS.filter(evt => evt.trigger === trigger).forEach(evt => {
            evt.effects.forEach(effect => this.applyEventEffect(effect));
        });
    }

    private applyEventEffect(effect: LogicEffectConfig) {
        if (effect.type === 'GOLD') {
            const bonus = this.resolveGoldEffect(effect);
            if (bonus <= 0) return;
            this.deps.updateMetaState(prev => ({ ...prev, gold: prev.gold + bonus }));
            this.store.updateState(
                prev => ({
                    ...prev,
                    goldEarnedThisLevel: prev.goldEarnedThisLevel + bonus,
                }),
                this.meta('gold', 'Awarded gold bonus', { amount: bonus })
            );
            this.eventBus.emit({
                type: 'damage.number',
                payload: { value: `+${bonus} Gold`, target: 'PLAYER', variant: 'GOLD' },
            });
        }
    }

    private resolveGoldEffect(effect: LogicEffectConfig) {
        const base = effect.amount ?? 0;
        if (!effect.metadata || !('perLevelOffset' in effect.metadata)) {
            return base;
        }
        const offset = Number(effect.metadata.perLevelOffset) || 0;
        const runLevel = this.store.snapshot.state.runLevel;
        return Math.max(0, runLevel - offset) * base;
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
