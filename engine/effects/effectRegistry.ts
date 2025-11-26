import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { Card, GameSnapshot, Item, LogicEffectConfig, LogicEffectType, TurnOwner } from '../../common/types';
import { calculateScore, getRandomItems, sleep } from '../utils';
import { RoundService } from '../services/roundService';
import { DamageService } from '../services/damageService';
import { CreateMetaFn } from '../services/commonService';
import { MetaUpdater } from '../../common/types';

export type EffectSourceType = 'ITEM' | 'EVENT' | 'ENVIRONMENT' | 'PENALTY';

export interface EffectSourceInfo {
    type: EffectSourceType;
    id?: string;
    label?: string;
}

export interface EffectContextMetaOps {
    updateMetaState?: MetaUpdater;
}

export interface EffectContext {
    actor: TurnOwner;
    source: EffectSourceInfo;
    snapshot: GameSnapshot;
    originItem?: Item;
    effectIndex?: number;
    meta?: EffectContextMetaOps;
    extra?: Record<string, unknown>;
}

export type EffectInvocationContext = Omit<EffectContext, 'snapshot'> & {
    snapshot?: GameSnapshot;
};

type EffectHandler = (effect: LogicEffectConfig, context: EffectContext) => Promise<void> | void;

interface EffectRegistryDeps {
    store: GameStore;
    eventBus: EventBus;
    roundService: RoundService;
    damageService: DamageService;
    createMeta: CreateMetaFn;
}

export class EffectRegistry {
    private handlers: Partial<Record<LogicEffectType, EffectHandler[]>> = {};

    constructor(private deps: EffectRegistryDeps) {
        this.registerDefaultHandlers();
    }

    registerEffect(type: LogicEffectType, handler: EffectHandler, options?: { replace?: boolean }) {
        if (options?.replace || !this.handlers[type]) {
            this.handlers[type] = [handler];
        } else {
            this.handlers[type]!.push(handler);
        }
    }

    async executeEffects(effects: LogicEffectConfig[], context: EffectInvocationContext) {
        for (let index = 0; index < effects.length; index++) {
            await this.executeEffect(effects[index], { ...context, effectIndex: index });
        }
    }

    async executeEffect(effect: LogicEffectConfig, context: EffectInvocationContext) {
        const handlers = this.handlers[effect.type];
        if (!handlers || handlers.length === 0) return;
        const enriched = this.withSnapshot(context);
        for (const handler of handlers) {
            await handler(effect, enriched);
        }
    }

    private withSnapshot(context: EffectInvocationContext): EffectContext {
        return {
            ...context,
            snapshot: context.snapshot ?? this.deps.store.snapshot,
        };
    }

    private registerDefaultHandlers() {
        this.registerEffect('HEAL', (effect, ctx) => this.applyHeal(effect, ctx));
        this.registerEffect('SHIELD', (effect, ctx) => this.applyShield(effect, ctx));
        this.registerEffect('DRAW', (effect, ctx) => this.applyDraw(effect, ctx));
        this.registerEffect('RESOLUTION_DAMAGE_BUFFER', (effect, ctx) =>
            this.applyResolutionDamageBuffer(effect, ctx)
        );
        this.registerEffect('RESOLUTION_DAMAGE_BOOST', (effect, ctx) =>
            this.applyResolutionDamageBoost(effect, ctx)
        );
        this.registerEffect('RESOLUTION_DAMAGE_IMMUNITY', (effect, ctx) =>
            this.applyResolutionDamageImmunity(effect, ctx)
        );
        this.registerEffect('DRAW_OPTIMAL', (_effect, ctx) => this.applyDrawOptimal(ctx));
        this.registerEffect('DRAW_VALUE', (effect, ctx) => this.applyDrawSpecificValue(effect, ctx));
        this.registerEffect('SWAP_LAST_CARD', (_effect, ctx) => this.swapLastCards(ctx));
        this.registerEffect('UNDO_LAST_DRAW', (effect, ctx) => this.undoLastDrawEffect(effect, ctx));
        this.registerEffect('REPLACE_LAST_CARD', (effect, ctx) => this.replaceLastCardEffect(effect, ctx));
        this.registerEffect('FORCE_DRAW', (effect, ctx) => this.forceDrawEffect(effect, ctx));
        this.registerEffect('GAIN_RANDOM_ITEMS', (effect, ctx) => this.grantRandomItems(effect, ctx));
        this.registerEffect('SELF_DAMAGE', (effect, ctx) => this.applySelfInflictedDamage(effect, ctx));
        this.registerEffect('SET_TEMP_TARGET_SCORE', (effect, ctx) => this.setTemporaryTargetScore(effect, ctx));
        this.registerEffect('SET_TARGET_SCORE', (effect, ctx) => this.setTemporaryTargetScore(effect, ctx));
        this.registerEffect('RANDOM_ITEM_EFFECT', (effect, ctx) => this.applyRandomItemEffect(effect, ctx));
        this.registerEffect('PENDING_LOSER_DAMAGE', (effect, ctx) => this.applyPendingLoserDamage(effect, ctx));
        this.registerEffect('LIFE_DRAIN', (effect, ctx) => this.applyLifeDrain(effect, ctx));
        this.registerEffect('HEAL_PER_INVENTORY', (effect, ctx) => this.applyInventoryHeal(effect, ctx));
        this.registerEffect('GOLD', (effect, ctx) => this.applyGold(effect, ctx));
    }

    private applyHeal(effect: LogicEffectConfig, context: EffectContext) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
        targets.forEach(target => {
            this.deps.damageService.applyHealing(target, amount, {
                metaTag: 'effect.heal',
                description: `Heal applied to ${target}`,
            });
        });
    }

    private applyShield(effect: LogicEffectConfig, context: EffectContext) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private async applyDraw(effect: LogicEffectConfig, context: EffectContext) {
        const cards = effect.cards ?? 0;
        for (let i = 0; i < cards; i++) {
            const drawn = await this.deps.roundService.drawCard(context.actor, { faceDown: true, shiftTurn: false });
            if (!drawn) break;
            this.deps.roundService.setDealing(true);
            await sleep(1200);
            this.deps.roundService.revealCard(context.actor, drawn.cardId, { shiftTurn: false });
            this.deps.roundService.setDealing(false);
        }
    }

    private applyResolutionDamageBuffer(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
        this.deps.roundService.updateRoundDamageAdjustments(targets, -amount, 'Applied round damage buffer');
    }

    private applyResolutionDamageBoost(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
        this.deps.roundService.updateRoundDamageAdjustments(targets, amount, 'Applied round damage boost');
    }

    private applyResolutionDamageImmunity(effect: LogicEffectConfig, context: EffectContext) {
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private async applyDrawOptimal(context: EffectContext) {
        const snapshot = this.deps.store.snapshot.state;
        const entity = context.actor === 'PLAYER' ? snapshot.player : snapshot.enemy;
        if (!entity || snapshot.deck.length === 0) return;
        this.deps.store.updateState(
            prev => {
                const currentEntity = context.actor === 'PLAYER' ? prev.player : prev.enemy;
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
                        (candidateIsBust === bestIsBust &&
                            (diff < bestDiff || (diff === bestDiff && simulatedScore > bestScore)));
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
                const entityKey = context.actor === 'PLAYER' ? 'player' : 'enemy';
                const updatedEntity = { ...currentEntity, hand, score };
                return {
                    ...prev,
                    deck,
                    [entityKey]: updatedEntity,
                    message: `${context.actor === 'PLAYER' ? 'Optimal' : 'Enemy optimal'} draw retrieved.`,
                };
            },
            this.deps.createMeta('effect.drawOptimal', 'Drew optimal card', { actor: context.actor })
        );
    }

    private async applyDrawSpecificValue(effect: LogicEffectConfig, context: EffectContext) {
        const desired = Number(effect.metadata?.targetValue ?? effect.amount);
        if (!desired || Number.isNaN(desired)) return;
        this.deps.store.updateState(
            prev => {
                const entityKey = context.actor === 'PLAYER' ? 'player' : 'enemy';
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
                    message: `${context.actor === 'PLAYER' ? 'You' : 'Enemy'} drew target value ${desired}.`,
                };
            },
            this.deps.createMeta('effect.drawValue', 'Drew specific card value', {
                actor: context.actor,
                desired,
            })
        );
    }

    private swapLastCards(context: EffectContext) {
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

    private undoLastDrawEffect(effect: LogicEffectConfig, context: EffectContext) {
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private replaceLastCardEffect(effect: LogicEffectConfig, context: EffectContext) {
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private async forceDrawEffect(effect: LogicEffectConfig, context: EffectContext) {
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private grantRandomItems(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
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

    private applySelfInflictedDamage(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope);
        targets.forEach(target =>
            this.deps.damageService.applyDamageWithShieldAndEnv(target, amount, {
                metaTag: 'effect.selfDamage',
                description: `Self damage applied to ${target}`,
            })
        );
    }

    private setTemporaryTargetScore(effect: LogicEffectConfig, context: EffectContext) {
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
            this.deps.createMeta('effect.tempTarget', 'Applied temporary target score', {
                override,
                actor: context.actor,
            })
        );
    }

    private async applyRandomItemEffect(effect: LogicEffectConfig, context: EffectContext) {
        const rawMax = Number(effect.metadata?.maxRolls ?? 10);
        const maxAttempts = Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : 10;
        let rolled: Item | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const [candidate] = getRandomItems(1);
            if (context.originItem && candidate.id === context.originItem.id) continue;
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

        this.deps.store.updateState(
            prev => ({
                ...prev,
                message: `Random effect borrowed from ${rolled.name}.`,
            }),
            this.deps.createMeta('effect.randomItem', 'Triggered random item effect', {
                actor: context.actor,
                sourceItem: context.originItem?.id ?? null,
                borrowedItem: rolled.id,
                effectType: borrowedEffect.type,
            })
        );

        await this.executeEffect(borrowedEffect, {
            ...context,
            originItem: rolled,
            source: {
                type: context.source.type,
                id: rolled.id,
                label: `Borrowed: ${rolled.name}`,
            },
        });
    }

    private applyPendingLoserDamage(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const requireSafeScore = effect.metadata?.requireSafeScore !== false;
        const snapshot = this.deps.store.snapshot;
        const entity = context.actor === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
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
            this.deps.createMeta('effect.pendingLoserDamage', 'Queued loser damage bonus', {
                actor: context.actor,
                amount,
            })
        );
    }

    private applyLifeDrain(effect: LogicEffectConfig, context: EffectContext) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(context.actor, effect.scope ?? 'OPPONENT').filter(
            target => target !== context.actor
        );
        if (!targets.length) return;
        let drainedTotal = 0;
        targets.forEach(target => {
            drainedTotal += this.deps.damageService.applyDamageWithShieldAndEnv(target, amount, {
                metaTag: 'effect.lifeDrain',
                description: 'Life drain damage',
            });
        });
        if (drainedTotal <= 0) return;
        this.applyHeal(
            {
                type: 'HEAL',
                amount: drainedTotal,
                scope: 'SELF',
            },
            context
        );
    }

    private applyInventoryHeal(effect: LogicEffectConfig, context: EffectContext) {
        const perItemRaw = Number(effect.metadata?.perItem ?? 1);
        const perItem = Number.isFinite(perItemRaw) ? perItemRaw : 1;
        const baseRaw = Number(effect.metadata?.baseDamage ?? 0);
        const baseDamage = Number.isFinite(baseRaw) ? baseRaw : 0;
        const targets = this.resolveTargets(context.actor, effect.scope);
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
                { ...context, actor: target }
            );
        });
    }

    private applyGold(effect: LogicEffectConfig, context: EffectContext) {
        const bonus = this.resolveGoldAmount(effect, context.snapshot);
        if (bonus <= 0) return;
        if (context.meta?.updateMetaState) {
            context.meta.updateMetaState(prev => ({ ...prev, gold: prev.gold + bonus }));
        }

        this.deps.store.updateState(
            prev => ({
                ...prev,
                run:
                    context.actor === 'PLAYER'
                        ? {
                              ...prev.run,
                              goldEarnedThisLevel: prev.run.goldEarnedThisLevel + bonus,
                          }
                        : prev.run,
            }),
            this.deps.createMeta('effect.gold', 'Awarded gold bonus', { amount: bonus })
        );
        this.deps.eventBus.emit({
            type: 'damage.number',
            payload: { value: `+${bonus} Gold`, target: context.actor, variant: 'GOLD' },
        });
    }

    private resolveGoldAmount(effect: LogicEffectConfig, snapshot: GameSnapshot) {
        const base = effect.amount ?? 0;
        if (base === 0) return 0;
        if (!effect.metadata || !('perLevelOffset' in effect.metadata)) {
            return base;
        }
        const offset = Number(effect.metadata.perLevelOffset) || 0;
        const runLevel = snapshot.state.runLevel;
        return Math.max(0, runLevel - offset) * base;
    }

    private resolveTargets(actor: TurnOwner, scope: LogicEffectConfig['scope']): TurnOwner[] {
        if (scope === 'BOTH') return ['PLAYER', 'ENEMY'];
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
