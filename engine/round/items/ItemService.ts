import { Item, LogicEffectConfig, LogicEffectType, TurnOwner } from '../../../common/types';
import { sleep, getRandomItems } from '../../utils';
import { RoundService } from '../RoundService';

interface ItemEffectServiceDeps {
    roundService: RoundService;
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
            DRAW_OPTIMAL: async (_effect, actor) => this.deps.roundService.drawOptimalCard(actor),
            DRAW_VALUE: async (effect, actor) => this.applyDrawSpecificValue(effect, actor),
            SWAP_LAST_CARD: async () => this.deps.roundService.swapLastCards(),
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
        targets.forEach(target => this.deps.roundService.heal(target, amount));
    }

    private applyShield(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.deps.roundService.addShield(targets, amount);
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
        this.deps.roundService.enableDamageImmunity(targets);
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
        this.deps.roundService.grantRandomItems(targets, amount);
    }

    private applySelfInflictedDamage(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.deps.roundService.applyDamage(target, amount));
    }

    private setTemporaryTargetScore(effect: LogicEffectConfig) {
        const override = Number(effect.amount ?? effect.metadata?.targetScore);
        this.deps.roundService.setTemporaryTargetScore(override);
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

        this.deps.roundService.setRoundMessage(`Random effect borrowed from ${rolled.name}.`, {
            tag: 'effect.randomItem',
            description: 'Triggered random item effect',
            payload: {
                actor,
                sourceItem: sourceItem?.id ?? null,
                borrowedItem: rolled.id,
                effectType: borrowedEffect.type,
            },
        });

        await handler(borrowedEffect, actor, rolled);
    }

    private applyPendingLoserDamage(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const requireSafeScore = effect.metadata?.requireSafeScore !== false;
        const state = this.deps.roundService.getState();
        const entity = actor === 'PLAYER' ? state.player : state.enemy;
        if (!entity) return;
        const withinTarget = entity.score <= state.targetScore;
        if (requireSafeScore && !withinTarget) return;
        this.deps.roundService.queueLoserDamageBonus(amount);
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
        const baseAmount = Number.isFinite(baseRaw) ? baseRaw : 0;
        const targets = this.resolveTargets(actor, effect.scope);
        const state = this.deps.roundService.getState();
        targets.forEach(target => {
            const entity = target === 'PLAYER' ? state.player : state.enemy;
            if (!entity) return;
            const amount = Math.floor(entity.inventory.length * perItem + baseAmount);
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

    private undoLastDrawEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.deps.roundService.undoLastDraw(target));
    }

    private replaceLastCardEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.deps.roundService.replaceLastCard(target));
    }

    private async applyDrawSpecificValue(effect: LogicEffectConfig, actor: TurnOwner) {
        const desired = Number(effect.metadata?.targetValue ?? effect.amount);
        if (!desired || Number.isNaN(desired)) return;
        await this.deps.roundService.drawCardWithValue(actor, desired);
    }

    private resolveTargets(actor: TurnOwner, scope: LogicEffectConfig['scope']): TurnOwner[] {
        if (scope === 'BOTH') return ['PLAYER', 'ENEMY'] as TurnOwner[];
        if (scope === 'OPPONENT') return [actor === 'PLAYER' ? 'ENEMY' : 'PLAYER'];
        return [actor];
    }
}
