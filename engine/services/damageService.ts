import { DELAY_MEDIUM } from '../../common/constants';
import {
    ClashState,
    GameState,
    HandAction,
    RoundModifierState,
    TurnOwner,
} from '../../common/types';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { CreateMetaFn } from './commonService';

interface DamageServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    createMeta: CreateMetaFn;
}

export interface ClashComputationArgs {
    playerScore: number;
    enemyScore: number;
    playerBust: boolean;
    enemyBust: boolean;
}

export interface ClashComputationResult {
    result: ClashState['result'];
    winner: TurnOwner | 'DRAW';
    loser: TurnOwner | null;
    message: string;
}

export interface DamageApplicationOptions {
    metaTag?: string;
    description?: string;
    handActionDuration?: number;
    suppressHandAction?: boolean;
    suppressPlayerShake?: boolean;
}

export interface RoundDamageContext {
    playerBaseDamage: number;
    enemyBaseDamage: number;
    roundModifiers: RoundModifierState;
}

export interface RoundDamageApplicationResult {
    playerResolved: number;
    enemyResolved: number;
    playerInflicted: number;
    enemyInflicted: number;
}

export class DamageService {
    constructor(private deps: DamageServiceDeps) {}

    computeClashResult(args: ClashComputationArgs): ClashComputationResult {
        const { playerScore, enemyScore, playerBust, enemyBust } = args;
        let result: ClashState['result'] = 'draw';
        if (playerBust && enemyBust) {
            result = 'draw';
        } else if (playerBust) {
            result = 'enemy_win';
        } else if (enemyBust) {
            result = 'player_win';
        } else if (playerScore > enemyScore) {
            result = 'player_win';
        } else if (enemyScore > playerScore) {
            result = 'enemy_win';
        }

        const winner: TurnOwner | 'DRAW' =
            result === 'player_win' ? 'PLAYER' : result === 'enemy_win' ? 'ENEMY' : 'DRAW';
        const loser: TurnOwner | null =
            winner === 'PLAYER' ? 'ENEMY' : winner === 'ENEMY' ? 'PLAYER' : null;

        let message = 'Draw.';
        if (playerBust && enemyBust) {
            message = 'Both Busted! Draw.';
        } else if (playerBust) {
            message = 'You Busted!';
        } else if (enemyBust) {
            message = 'Enemy Busted!';
        } else if (winner === 'PLAYER') {
            message = `You Win (${playerScore} vs ${enemyScore})`;
        } else if (winner === 'ENEMY') {
            message = `Enemy Wins (${enemyScore} vs ${playerScore})`;
        }

        return { result, winner, loser, message };
    }

    applyRoundDamage(context: RoundDamageContext): RoundDamageApplicationResult {
        let playerDamage = Math.max(0, Math.floor(context.playerBaseDamage));
        let enemyDamage = Math.max(0, Math.floor(context.enemyBaseDamage));
        const loserBonus = context.roundModifiers.loserDamageBonus ?? 0;

        if (loserBonus > 0) {
            if (playerDamage > 0 && enemyDamage === 0) {
                playerDamage += loserBonus;
            } else if (enemyDamage > 0 && playerDamage === 0) {
                enemyDamage += loserBonus;
            }
        }

        const playerResolved = this.resolveDamageWithRoundModifiers('PLAYER', playerDamage, context.roundModifiers);
        const enemyResolved = this.resolveDamageWithRoundModifiers('ENEMY', enemyDamage, context.roundModifiers);

        const playerInflicted =
            playerResolved > 0 ? this.applyDamageWithShieldAndEnv('PLAYER', playerResolved) : 0;
        const enemyInflicted =
            enemyResolved > 0 ? this.applyDamageWithShieldAndEnv('ENEMY', enemyResolved) : 0;

        return {
            playerResolved,
            enemyResolved,
            playerInflicted,
            enemyInflicted,
        };
    }

    applyDamageWithShieldAndEnv(
        target: TurnOwner,
        amount: number,
        options: DamageApplicationOptions = {}
    ): number {
        const baseAmount = Math.floor(amount);
        if (baseAmount <= 0) return 0;

        const runtime = this.deps.store.snapshot.state.environmentRuntime;
        const baseDamageBonus = baseAmount > 0 ? runtime.damageModifiers.baseDamage : 0;
        const scaledAmount = (baseAmount + baseDamageBonus) * (runtime.damageModifiers.multiplier || 1);
        const finalAmount = Math.max(0, Math.ceil(scaledAmount));

        let blocked = 0;
        let inflicted = 0;
        let entityExists = false;
        this.deps.store.updateState(
            (prev: GameState) => {
                const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                if (!entity) {
                    return prev;
                }
                entityExists = true;
                let remaining = finalAmount;
                let shield = entity.shield;
                if (shield > 0) {
                    blocked = Math.min(shield, remaining);
                    shield -= blocked;
                    remaining -= blocked;
                }
                const hp = Math.max(0, entity.hp - remaining);
                inflicted = entity.hp - hp;
                const updated = { ...entity, hp, shield };
                if (target === 'PLAYER') {
                    return <GameState>{ ...prev, player: updated };
                }
                return <GameState>{ ...prev, enemy: updated };
            },
            this.deps.createMeta(
                options.metaTag ?? 'damage.apply',
                options.description ?? `Damage applied to ${target}`,
                {
                    target,
                    amount: baseAmount,
                    finalAmount,
                    blocked,
                    inflicted,
                }
            )
        );

        if (!entityExists) {
            return 0;
        }

        this.deps.eventBus.emit({
            type: 'damage.number',
            payload: { value: finalAmount, target, variant: 'DAMAGE' },
        });
        if (blocked > 0) {
            this.deps.eventBus.emit({
                type: 'damage.number',
                payload: { value: `Blocked ${blocked}`, target, variant: 'HEAL' },
            });
        }

        if (!options.suppressHandAction) {
            this.emitHandAction(target, 'HURT', options.handActionDuration ?? 800);
        }
        if (target === 'PLAYER' && !options.suppressPlayerShake) {
            this.deps.eventBus.emit({
                type: 'visual.effect',
                payload: { effect: 'animate-shake-hard animate-flash-red', duration: DELAY_MEDIUM },
            });
        }
        return inflicted;
    }

    applyHealing(
        target: TurnOwner,
        amount: number,
        options: DamageApplicationOptions = {}
    ): number {
        const healAmount = Math.floor(amount);
        if (healAmount <= 0) return 0;
        let actualHeal = 0;
        let entityExists = false;
        this.deps.store.updateState(
            prev => {
                const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                if (!entity) return prev;
                entityExists = true;
                const nextHp = Math.min(entity.maxHp, entity.hp + healAmount);
                actualHeal = nextHp - entity.hp;
                if (actualHeal === 0) return prev;
                const updated = { ...entity, hp: nextHp };
                if (target === 'PLAYER') {
                    return <GameState>{ ...prev, player: updated };
                }
                return <GameState>{ ...prev, enemy: updated };
            },
            this.deps.createMeta(
                options.metaTag ?? 'damage.heal',
                options.description ?? `Healing applied to ${target}`,
                { target, amount: healAmount, actualHeal }
            )
        );

        if (!entityExists || actualHeal <= 0) return 0;

        this.deps.eventBus.emit({
            type: 'damage.number',
            payload: { value: actualHeal, target, variant: 'HEAL' },
        });
        return actualHeal;
    }

    enforceSuddenDeath(): TurnOwner[] {
        const threshold = this.deps.store.snapshot.state.environmentRuntime.victoryHooks.suddenDeathThreshold;
        if (!threshold) return [];

        const victims: TurnOwner[] = [];
        this.deps.store.updateState(
            prev => {
                let player = prev.player;
                let enemy = prev.enemy;
                let changed = false;
                if (player.hp > 0 && player.hp <= threshold) {
                    player = { ...player, hp: 0 };
                    victims.push('PLAYER');
                    changed = true;
                }
                if (enemy && enemy.hp > 0 && enemy.hp <= threshold) {
                    enemy = { ...enemy, hp: 0 };
                    victims.push('ENEMY');
                    changed = true;
                }
                if (!changed) return prev;
                return {
                    ...prev,
                    player,
                    enemy,
                    message: `Sudden death triggered (<=${threshold} HP).`,
                };
            },
            this.deps.createMeta('env.suddenDeath', 'Sudden death enforced', { victims, threshold })
        );
        return victims;
    }

    private resolveDamageWithRoundModifiers(
        target: TurnOwner,
        baseAmount: number,
        modifiers: RoundModifierState
    ): number {
        if (baseAmount <= 0) return 0;
        if (modifiers.damageImmunity[target]) return 0;
        const adjustment = modifiers.damageAdjustments[target] ?? 0;
        return Math.max(0, baseAmount + adjustment);
    }

    private emitHandAction(actor: TurnOwner, action: HandAction, duration: number) {
        this.deps.eventBus.emit({
            type: 'hand.action',
            payload: { actor, action, duration },
        });
    }
}
