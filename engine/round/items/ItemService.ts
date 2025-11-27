import { EventBus } from '../../eventBus';
import { GameStore } from '../../state/gameStore';
import { Card, Item, LogicEffectConfig, LogicEffectType, TurnOwner } from '../../../common/types';
import { calculateScore, getRandomItems, sleep } from '../../utils';
import { RoundService, CreateMetaFn } from '../RoundService';

interface ItemEffectServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    roundService: RoundService;
    createMeta: CreateMetaFn;
}

type EffectHandler = (effect: LogicEffectConfig, actor: TurnOwner, source?: Item) => Promise<void>;

export class ItemEffectService {
    private effectHandlers: Partial<Record<LogicEffectType, EffectHandler>> = {};

    constructor(private deps: ItemEffectServiceDeps) {
        this.effectHandlers = {
            HEAL: async (effect, actor) => this.applyHeal(effect, actor),
            SHIELD: async (effect, actor) => this.applyShield(effect, actor),
            DRAW: async (effect, actor) => this.applyDraw(effect, actor),
            RESOLUTION_DAMAGE_BUFFER: async (effect, actor) => this.applyResolutionDamageBuffer(effect, actor),
            RESOLUTION_DAMAGE_BOOST: async (effect, actor) => this.applyResolutionDamageBoost(effect, actor),
            RESOLUTION_DAMAGE_IMMUNITY: async (effect, actor) => this.applyResolutionDamageImmunity(effect, actor),
            DRAW_OPTIMAL: async (_effect, actor) => this.applyDrawOptimal(actor),
            DRAW_VALUE: async (effect, actor) => this.applyDrawSpecificValue(effect, actor),
            SWAP_LAST_CARD: async () => this.swapLastCards(),
            UNDO_LAST_DRAW: async (effect, actor) => this.undoLastDrawEffect(effect, actor),
            REPLACE_LAST_CARD: async (effect, actor) => this.replaceLastCardEffect(effect, actor),
            FORCE_DRAW: async (effect, actor) => this.forceDrawEffect(effect, actor),
            GAIN_RANDOM_ITEMS: async (effect, actor) => this.grantRandomItems(effect, actor),
            SELF_DAMAGE: async (effect, actor) => this.applySelfInflictedDamage(effect, actor),
            SET_TEMP_TARGET_SCORE: async (effect, _actor) => this.setTemporaryTargetScore(effect),
            RANDOM_ITEM_EFFECT: async (effect, actor, source) => this.applyRandomItemEffect(effect, actor, source),
            PENDING_LOSER_DAMAGE: async (effect, actor) => this.applyPendingLoserDamage(effect, actor),
            LIFE_DRAIN: async (effect, actor) => this.applyLifeDrain(effect, actor),
            HEAL_PER_INVENTORY: async (effect, actor) => this.applyInventoryHeal(effect, actor),
        };
    }

    async applyItemEffects(item: Item, actor: TurnOwner) {
        for (const effect of item.effects) {
            const handler = this.effectHandlers[effect.type];
            if (!handler) continue;
            await handler(effect, actor, item);
        }
    }

    private applyHeal(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => {
            this.deps.store.updateState(
                prev => {
                    const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                    if (!entity) return prev;
                    const nextHp = Math.min(entity.maxHp, entity.hp + amount);
                    return {
                        ...prev,
                        [target === 'PLAYER' ? 'player' : 'enemy']: {
                            ...entity,
                            hp: nextHp,
                        },
                    };
                },
                this.deps.createMeta('effect.heal', `Heal applied to ${target}`, { target, amount })
            );
            this.deps.eventBus.emit({
                type: 'damage.number',
                payload: { value: amount, target, variant: 'HEAL' },
            });
        });
    }

    private applyShield(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => {
            this.deps.store.updateState(
                prev => {
                    const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                    if (!entity) return prev;
                    return {
                        ...prev,
                        [target === 'PLAYER' ? 'player' : 'enemy']: {
                            ...entity,
                            shield: entity.shield + amount,
                        },
                    };
                },
                this.deps.createMeta('effect.shield', `Shield applied to ${target}`, { target, amount })
            );
        });
    }

    private async applyDraw(effect: LogicEffectConfig, actor: TurnOwner) {
        const cards = effect.cards ?? 0;
        for (let i = 0; i < cards; i++) {
            const drawn = await this.deps.roundService.drawCard(actor, { faceDown: true, shiftTurn: false });
            if (!drawn) break;
            this.deps.roundService.setDealing(true);
            await sleep(1200);
            this.deps.roundService.revealCard(actor, drawn.cardId, { shiftTurn: false });
            this.deps.roundService.setDealing(false);
        }
    }

    private applyResolutionDamageBuffer(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.deps.roundService.updateRoundDamageAdjustments(targets, -amount, 'Applied round damage buffer');
    }

    private applyResolutionDamageBoost(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.deps.roundService.updateRoundDamageAdjustments(targets, amount, 'Applied round damage boost');
    }

    private applyResolutionDamageImmunity(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        if (!targets.length) return;
        this.deps.store.updateState(
            prev => {
                let changed = false;
                const immunity = { ...prev.roundModifiers.damageImmunity };
                targets.forEach(target => {
                    if (!immunity[target]) {
                        immunity[target] = true;
                        changed = true;
                    }
                });
                if (!changed) return prev;
                return {
                    ...prev,
                    roundModifiers: {
                        ...prev.roundModifiers,
                        damageImmunity: immunity,
                    },
                    message: 'Resolution damage immunity engaged.',
                };
            },
            this.deps.createMeta('effect.damageImmunity', 'Applied round damage immunity', { targets })
        );
    }

    private async applyDrawOptimal(actor: TurnOwner) {
        const snapshot = this.deps.store.snapshot.state;
        const entity = actor === 'PLAYER' ? snapshot.player : snapshot.enemy;
        if (!entity || snapshot.deck.length === 0) return;
        this.deps.store.updateState(
            prev => {
                const currentEntity = actor === 'PLAYER' ? prev.player : prev.enemy;
                if (!currentEntity || prev.deck.length === 0) return prev;
                const deck = [...prev.deck];
                const scoreOptions = prev.environmentRuntime.scoreOptions;
                let bestIndex = -1;
                let bestDiff = Number.POSITIVE_INFINITY;
                let bestScore = -Infinity;
                deck.forEach((card, index) => {
                    const simulatedHand = [...currentEntity.hand, card];
                    const simulatedScore = calculateScore(simulatedHand, prev.targetScore, scoreOptions);
                    const diff = Math.abs(prev.targetScore - simulatedScore);
                    const candidateIsBust = simulatedScore > prev.targetScore;
                    const bestIsBust = bestScore > prev.targetScore;
                    const shouldTake =
                        bestIndex === -1 ||
                        (!candidateIsBust && bestIsBust) ||
                        (candidateIsBust === bestIsBust && (diff < bestDiff || (diff === bestDiff && simulatedScore > bestScore)));
                    if (shouldTake) {
                        bestIndex = index;
                        bestDiff = diff;
                        bestScore = simulatedScore;
                    }
                });
                if (bestIndex === -1) return prev;
                const [picked] = deck.splice(bestIndex, 1);
                const nextCard: Card = { ...picked, isFaceUp: true };
                const hand = [...currentEntity.hand, nextCard];
                const score = calculateScore(hand, prev.targetScore, scoreOptions);
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const updatedEntity = { ...currentEntity, hand, score };
                return {
                    ...prev,
                    deck,
                    [entityKey]: updatedEntity,
                    message: `${actor === 'PLAYER' ? 'Optimal' : 'Enemy optimal'} draw retrieved.`,
                };
            },
            this.deps.createMeta('effect.drawOptimal', 'Drew optimal card', { actor })
        );
    }

    private async applyDrawSpecificValue(effect: LogicEffectConfig, actor: TurnOwner) {
        const desired = Number(effect.metadata?.targetValue ?? effect.amount);
        if (!desired || Number.isNaN(desired)) return;
        this.deps.store.updateState(
            prev => {
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey];
                if (!entity || prev.deck.length === 0) return prev;
                const deck = [...prev.deck];
                const index = deck.findIndex(card => card.value === desired);
                if (index === -1) return prev;
                const [picked] = deck.splice(index, 1);
                const nextCard: Card = { ...picked, isFaceUp: true };
                const hand = [...entity.hand, nextCard];
                const score = calculateScore(hand, prev.targetScore, prev.environmentRuntime.scoreOptions);
                return {
                    ...prev,
                    deck,
                    [entityKey]: { ...entity, hand, score },
                    message: `${actor === 'PLAYER' ? 'You' : 'Enemy'} drew target value ${desired}.`,
                };
            },
            this.deps.createMeta('effect.drawValue', 'Drew specific card value', { actor, desired })
        );
    }

    private swapLastCards() {
        this.deps.store.updateState(
            prev => {
                if (!prev.enemy) return prev;
                if (prev.player.hand.length === 0 || prev.enemy.hand.length === 0) return prev;
                const playerHand = [...prev.player.hand];
                const enemyHand = [...prev.enemy.hand];
                const playerCard = playerHand.pop();
                const enemyCard = enemyHand.pop();
                if (!playerCard || !enemyCard) return prev;
                playerHand.push(enemyCard);
                enemyHand.push(playerCard);
                const scoreOptions = prev.environmentRuntime.scoreOptions;
                const playerScore = calculateScore(playerHand, prev.targetScore, scoreOptions);
                const enemyScore = calculateScore(enemyHand, prev.targetScore, scoreOptions);
                return {
                    ...prev,
                    player: { ...prev.player, hand: playerHand, score: playerScore },
                    enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
                    message: 'Swapped the last drawn cards.',
                };
            },
            this.deps.createMeta('effect.swapLast', 'Swapped last drawn cards')
        );
    }

    private undoLastDrawEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.undoLastDraw(target));
    }

    private undoLastDraw(target: TurnOwner) {
        this.deps.store.updateState(
            prev => {
                const entityKey = target === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey];
                if (!entity || entity.hand.length === 0) return prev;
                const hand = [...entity.hand];
                const removed = hand.pop()!;
                const deck = this.insertCardRandomly(prev.deck, { ...removed, isFaceUp: false });
                const score = calculateScore(hand, prev.targetScore, prev.environmentRuntime.scoreOptions);
                return {
                    ...prev,
                    deck,
                    [entityKey]: { ...entity, hand, score },
                    message: `${target === 'PLAYER' ? 'Your' : 'Enemy'} last draw was undone.`,
                };
            },
            this.deps.createMeta('effect.undoDraw', 'Removed last drawn card', { target })
        );
    }

    private replaceLastCardEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.replaceLastCard(target));
    }

    private replaceLastCard(target: TurnOwner) {
        this.deps.store.updateState(
            prev => {
                if (prev.deck.length === 0) return prev;
                const entityKey = target === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey];
                if (!entity || entity.hand.length === 0) return prev;
                const hand = [...entity.hand];
                const removed = hand.pop()!;
                const discardPile = [...prev.discardPile, { ...removed, isFaceUp: true }];
                const deck = [...prev.deck];
                const newCard = deck.pop();
                if (!newCard) return prev;
                const nextCard: Card = { ...newCard, isFaceUp: true };
                hand.push(nextCard);
                const score = calculateScore(hand, prev.targetScore, prev.environmentRuntime.scoreOptions);
                return {
                    ...prev,
                    deck,
                    discardPile,
                    [entityKey]: { ...entity, hand, score },
                    message: `${target === 'PLAYER' ? 'Your' : 'Enemy'} last card was replaced.`,
                };
            },
            this.deps.createMeta('effect.replaceLast', 'Replaced last card', { target })
        );
    }

    private async forceDrawEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        for (const target of targets) {
            const drawn = await this.deps.roundService.drawCard(target, {
                faceDown: true,
                shiftTurn: false,
                preserveStandState: true,
            });
            if (!drawn) continue;
            this.deps.roundService.setDealing(true);
            await sleep(1200);
            this.deps.roundService.revealCard(target, drawn.cardId, { shiftTurn: false });
            this.deps.roundService.setDealing(false);
        }
    }

    private grantRandomItems(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.deps.store.updateState(
            prev => {
                let player = prev.player;
                let enemy = prev.enemy;
                let changed = false;
                targets.forEach(target => {
                    const source = target === 'PLAYER' ? player : enemy;
                    if (!source) return;
                    const slots = source.maxInventory - source.inventory.length;
                    if (slots <= 0) return;
                    const grantCount = Math.min(amount, slots);
                    if (grantCount <= 0) return;
                    const newItems = getRandomItems(grantCount);
                    if (target === 'PLAYER') {
                        player = { ...player, inventory: [...player.inventory, ...newItems] };
                    } else if (enemy) {
                        enemy = { ...enemy, inventory: [...enemy.inventory, ...newItems] };
                    }
                    changed = true;
                });
                if (!changed) return prev;
                return {
                    ...prev,
                    player,
                    enemy,
                    message: 'New item cards acquired.',
                };
            },
            this.deps.createMeta('effect.gainItems', 'Granted random items', { amount, targets })
        );
    }

    private applySelfInflictedDamage(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.deps.roundService.applyDamage(target, amount));
    }

    private setTemporaryTargetScore(effect: LogicEffectConfig) {
        const override = Number(effect.amount ?? effect.metadata?.targetScore);
        if (!override || Number.isNaN(override)) return;
        this.deps.store.updateState(
            prev => ({
                ...prev,
                targetScore: override,
                roundModifiers: {
                    ...prev.roundModifiers,
                    targetScoreOverride: override,
                },
                message: `Target score recalibrated to ${override}.`,
            }),
            this.deps.createMeta('effect.tempTarget', 'Applied temporary target score', { override })
        );
    }

    private async applyRandomItemEffect(effect: LogicEffectConfig, actor: TurnOwner, sourceItem?: Item) {
        const rawMax = Number(effect.metadata?.maxRolls ?? 10);
        const maxAttempts = Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : 10;
        let rolled: Item | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const [candidate] = getRandomItems(1);
            if (sourceItem && candidate.id === sourceItem.id) continue;
            if (candidate.effects.length === 0) continue;
            rolled = candidate;
            break;
        }

        if (!rolled) return;

        const effectIndex = Math.floor(Math.random() * rolled.effects.length);
        const sourceEffect = rolled.effects[effectIndex];
        const borrowedEffect: LogicEffectConfig = {
            ...sourceEffect,
            metadata: sourceEffect.metadata ? { ...sourceEffect.metadata } : undefined,
        };
        const handler = this.effectHandlers[borrowedEffect.type];
        if (!handler) return;

        this.deps.store.updateState(
            prev => ({
                ...prev,
                message: `Random effect borrowed from ${rolled.name}.`,
            }),
            this.deps.createMeta('effect.randomItem', 'Triggered random item effect', {
                actor,
                sourceItem: sourceItem?.id ?? null,
                borrowedItem: rolled.id,
                effectType: borrowedEffect.type,
            })
        );

        await handler(borrowedEffect, actor, rolled);
    }

    private applyPendingLoserDamage(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const requireSafeScore = effect.metadata?.requireSafeScore !== false;
        const snapshot = this.deps.store.snapshot;
        const entity = actor === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
        if (!entity) return;
        const withinTarget = entity.score <= snapshot.state.targetScore;
        if (requireSafeScore && !withinTarget) return;

        this.deps.store.updateState(
            prev => ({
                ...prev,
                roundModifiers: {
                    ...prev.roundModifiers,
                    loserDamageBonus: prev.roundModifiers.loserDamageBonus + amount,
                },
                message: `Round loser suffers +${amount} damage.`,
            }),
            this.deps.createMeta('effect.pendingLoserDamage', 'Queued loser damage bonus', { actor, amount })
        );
    }

    private applyLifeDrain(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope ?? 'OPPONENT').filter(target => target !== actor);
        if (!targets.length) return;
        let drainedTotal = 0;
        targets.forEach(target => {
            drainedTotal += this.deps.roundService.applyDamage(target, amount);
        });
        if (drainedTotal <= 0) return;
        this.applyHeal(
            {
                type: 'HEAL',
                amount: drainedTotal,
                scope: 'SELF',
            },
            actor
        );
    }

    private applyInventoryHeal(effect: LogicEffectConfig, actor: TurnOwner) {
        const perItemRaw = Number(effect.metadata?.perItem ?? 1);
        const perItem = Number.isFinite(perItemRaw) ? perItemRaw : 1;
        const baseRaw = Number(effect.metadata?.baseDamage ?? 0);
        const baseDamage = Number.isFinite(baseRaw) ? baseRaw : 0;
        const targets = this.resolveTargets(actor, effect.scope);
        const snapshot = this.deps.store.snapshot;
        targets.forEach(target => {
            const entity = target === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
            if (!entity) return;
            const amount = Math.floor(entity.inventory.length * perItem + baseDamage);
            if (amount <= 0) return;
            this.applyHeal(
                {
                    type: 'HEAL',
                    amount,
                    scope: 'SELF',
                },
                target
            );
        });
    }

    private resolveTargets(actor: TurnOwner, scope: LogicEffectConfig['scope']): TurnOwner[] {
        if (scope === 'BOTH') return ['PLAYER', 'ENEMY'] as TurnOwner[];
        if (scope === 'OPPONENT') return [actor === 'PLAYER' ? 'ENEMY' : 'PLAYER'];
        return [actor];
    }

    private insertCardRandomly(deck: Card[], card: Card) {
        const nextDeck = [...deck];
        const index = Math.floor(Math.random() * (nextDeck.length + 1));
        nextDeck.splice(index, 0, card);
        return nextDeck;
    }
}
