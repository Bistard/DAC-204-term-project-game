import {
    DAMAGE_BUST_ENEMY,
    DAMAGE_BUST_PLAYER,
    DELAY_LONG,
    DELAY_MEDIUM,
    DELAY_STANDARD,
    DELAY_TURN_END,
    DELAY_XL,
    INIT_ITEM_CARD,
    STARTING_HP,
} from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { createDefaultPenaltyRuntime, createDefaultRoundModifiers, createInitialGameState } from '../state/gameState';
import {
    Card,
    ClashState,
    GamePhase,
    GameState,
    HandAction,
    MetaState,
    PenaltyCard,
    PenaltyDamageContext,
    PenaltyDamageResult,
    StoreUpdateMeta,
    TurnOwner,
} from '../../common/types';
import {
    applyEnvironmentRules,
    calculateScore,
    createDeck,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomPenaltyCard,
    getRandomItems,
    sleep,
} from '../utils';
import { RewardService } from './rewardService';

export type CreateMetaFn = (
    tag: string,
    description: string,
    payload?: Record<string, unknown>,
    extra?: Partial<StoreUpdateMeta>
) => StoreUpdateMeta;

interface RoundServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: RewardService;
    createMeta: CreateMetaFn;
    onRoundReady: () => void | Promise<void>;
}

export class RoundService {
    constructor(private deps: RoundServiceDeps) {}

    startRun() {
        const meta = this.deps.getMetaState();
        const deck = createDeck();
        const envCards = getRandomEnvironment(0);
        const penaltyCard = getRandomPenaltyCard();
        const baseState = createInitialGameState(meta);
        const initialState = applyEnvironmentRules({
            ...baseState,
            phase: GamePhase.BATTLE,
            runLevel: 1,
            roundCount: 1,
            deck,
            discardPile: [],
            player: {
                ...baseState.player,
                hp: STARTING_HP + meta.upgrades.hpLevel,
                maxHp: STARTING_HP + meta.upgrades.hpLevel,
            },
            enemy: getRandomEnemy(1),
            activeEnvironment: envCards,
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            message: `Run started!`,
        });
        this.deps.store.setState(
            initialState,
            this.deps.createMeta('start-run', 'Initialize new run', { runLevel: initialState.runLevel })
        );
        this.emitPenaltyEvent(penaltyCard, 'DRAWN', 'Battle penalty selected.');

        this.startRound();
    }

    async startRound() {
        const snapshot = this.deps.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        this.setDealing(true);
        this.clearRoundModifiers('round.start', true);

        if (snapshot.state.roundCount === 1) {
            if (snapshot.state.activePenalty) {
                await this.playPenaltySequence();
            }
            if (snapshot.state.activeEnvironment.length > 0) {
                await this.playEnvironmentSequence();
            }
        }

        const deck = createDeck();
        this.deps.store.updateState(
            prev => ({
                ...prev,
                deck,
                discardPile: [],
                player: { ...prev.player, hand: [], score: 0, shield: 0 },
                enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
                playerStood: false,
                enemyStood: false,
                turnOwner: 'PLAYER',
                message: 'Dealing hand...',
            }),
            this.deps.createMeta('round.setup', 'Prepare new round', { round: snapshot.state.roundCount })
        );

        await sleep(DELAY_LONG);

        const dealOrder: TurnOwner[] = ['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY'];
        for (const owner of dealOrder) {
            await this.drawCard(owner, { faceDown: true });
            await sleep(DELAY_MEDIUM);
        }

        await sleep(DELAY_STANDARD);
        this.revealInitialHands();

        if (snapshot.state.roundCount === 1) {
            await this.grantInitialItems();
        }

        await sleep(DELAY_MEDIUM);
        this.deps.store.updateState(
            prev => ({ ...prev, message: 'Your Turn.' }),
            this.deps.createMeta('round.ready', 'Player turn begins')
        );
        this.setDealing(false);
        await this.deps.onRoundReady();
    }

    async resolveRound() {
        this.deps.store.updateFlags(
            flags => ({ ...flags, isResolvingRound: true }),
            this.deps.createMeta('flag.resolve', 'Begin round resolution', undefined, { suppressHistory: true })
        );
        const snapshot = this.deps.store.snapshot;
        const playerHand = snapshot.state.player.hand.map(card => ({ ...card, isFaceUp: true }));
        const enemyHand = snapshot.state.enemy ? snapshot.state.enemy.hand.map(card => ({ ...card, isFaceUp: true })) : [];
        const playerScore = calculateScore(playerHand, snapshot.state.targetScore);
        const enemyScore = snapshot.state.enemy ? calculateScore(enemyHand, snapshot.state.targetScore) : 0;

        this.deps.store.updateState(
            prev => ({
                ...prev,
                player: { ...prev.player, hand: playerHand, score: playerScore },
                enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
            }),
            this.deps.createMeta('round.revealFinal', 'Reveal full hands before clash', { playerScore, enemyScore })
        );

        const clash: ClashState = {
            active: true,
            playerScore,
            enemyScore,
            result: this.evaluateClashResult(playerScore, enemyScore, snapshot.state.targetScore),
        };
        this.deps.eventBus.emit({ type: 'clash.state', payload: clash });

        await sleep(DELAY_XL);
        this.deps.eventBus.emit({
            type: 'clash.state',
            payload: { ...clash, active: false },
        });

        await this.resolveDamage(clash.result);
        this.deps.store.updateFlags(
            flags => ({ ...flags, isResolvingRound: false }),
            this.deps.createMeta('flag.resolve', 'Finish round resolution', undefined, { suppressHistory: true })
        );
    }

    emitHandAction(actor: TurnOwner, action: HandAction, duration: number) {
        this.deps.eventBus.emit({
            type: 'hand.action',
            payload: { actor, action, duration },
        });
    }

    setDealing(value: boolean) {
        this.deps.store.updateFlags(
            flags => ({ ...flags, isDealing: value }),
            this.deps.createMeta('flag.dealing', value ? 'Dealing started' : 'Dealing finished', { value }, { suppressHistory: true })
        );
    }

    async drawCard(
        actor: TurnOwner,
        options: { faceDown?: boolean; shiftTurn?: boolean; preserveStandState?: boolean } = {}
    ) {
        let drawnCardId: string | null = null;
        this.deps.store.updateState(
            prev => {
                const deck = [...prev.deck];
                if (deck.length === 0) return prev;
                const card = deck.pop()!;
                card.isFaceUp = !options.faceDown;
                drawnCardId = card.id;
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey]!;
                const newHand = [...entity.hand, card];
                const message = actor === 'PLAYER' ? 'You drew a card...' : 'Enemy drew a card...';
                const nextState: Partial<GameState> = {
                    ...prev,
                    deck,
                    [entityKey]: { ...entity, hand: newHand },
                    message,
                };
                if (!options.preserveStandState) {
                    Object.assign(
                        nextState,
                        actor === 'PLAYER' ? { enemyStood: false } : { playerStood: false }
                    );
                }
                return nextState as GameState;
            },
            this.deps.createMeta('card.draw', `${actor} drew a card`, { actor })
        );
        return drawnCardId ? { cardId: drawnCardId } : null;
    }

    revealCard(actor: TurnOwner, cardId: string, options: { shiftTurn?: boolean } = {}) {
        this.deps.store.updateState(
            prev => {
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey]!;
                const hand = entity.hand.map(card =>
                    card.id === cardId ? { ...card, isFaceUp: true } : card
                );
                const score = calculateScore(hand, prev.targetScore);
                const card = hand.find(c => c.id === cardId);
                const message =
                    actor === 'PLAYER'
                        ? `You drew ${card?.rank ?? ''}${card?.suit ?? ''}`
                        : `Enemy drew ${card?.rank ?? ''}${card?.suit ?? ''}`;
                const shiftTurn = options.shiftTurn !== false;
                const nextTurnOwner: TurnOwner = shiftTurn
                    ? actor === 'PLAYER'
                        ? prev.enemyStood
                            ? 'PLAYER'
                            : 'ENEMY'
                        : prev.playerStood
                        ? 'ENEMY'
                        : 'PLAYER'
                    : prev.turnOwner;
                return {
                    ...prev,
                    [entityKey]: { ...entity, hand, score },
                    turnOwner: nextTurnOwner,
                    message,
                };
            },
            this.deps.createMeta('card.reveal', `${actor} revealed a card`, { actor, cardId })
        );
    }

    revealInitialHands() {
        this.deps.store.updateState(
            prev => {
                const playerHand = prev.player.hand.map(card => ({ ...card, isFaceUp: true }));
                const forcedReveal = this.getForcedRevealCount();
                const enemyHand = prev.enemy
                    ? prev.enemy.hand.map((card, idx) => {
                          const shouldReveal = forcedReveal > 0 ? idx < forcedReveal : idx !== 0;
                          return shouldReveal ? { ...card, isFaceUp: true } : card;
                      })
                    : [];
                const playerScore = calculateScore(playerHand, prev.targetScore);
                const enemyScore = prev.enemy ? calculateScore(enemyHand.filter(c => c.isFaceUp), prev.targetScore) : 0;
                return {
                    ...prev,
                    player: { ...prev.player, hand: playerHand, score: playerScore },
                    enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
                    message: 'Dealing Items...',
                };
            },
            this.deps.createMeta('round.reveal', 'Reveal opening hands')
        );
    }

    private async grantInitialItems() {
        const snapshot = this.deps.store.snapshot;
        if (!snapshot.state.enemy) return;
        const playerItems = INIT_ITEM_CARD + this.deps.getMetaState().upgrades.inventoryLevel;
        const sequences: Array<{ actor: TurnOwner; count: number }> = [
            { actor: 'ENEMY', count: INIT_ITEM_CARD },
            { actor: 'PLAYER', count: playerItems },
        ];

        for (const seq of sequences) {
            for (let i = 0; i < seq.count; i++) {
                await sleep(400);
                this.deps.store.updateState(
                    prev => {
                        const entityKey = seq.actor === 'PLAYER' ? 'player' : 'enemy';
                        const entity = prev[entityKey]!;
                        if (entity.inventory.length >= entity.maxInventory) return prev;
                        return {
                            ...prev,
                            [entityKey]: {
                                ...entity,
                                inventory: [...entity.inventory, getRandomItems(1)[0]],
                            },
                        };
                    },
                    this.deps.createMeta('item.grant', `Granted item to ${seq.actor}`, { actor: seq.actor })
                );
            }
        }
    }

    private async playPenaltySequence() {
        const card = this.deps.store.snapshot.state.activePenalty;
        if (!card) return;
        
        this.deps.eventBus.emit({
            type: 'penalty.animation',
            payload: { card, state: 'entering' },
        });
        await sleep(DELAY_MEDIUM);
        this.deps.eventBus.emit({
            type: 'penalty.animation',
            payload: { card, state: 'holding' },
        });
        await sleep(DELAY_LONG);
        this.deps.eventBus.emit({
            type: 'penalty.animation',
            payload: { card, state: 'exiting' },
        });
        await sleep(DELAY_MEDIUM);
    }

    private async playEnvironmentSequence() {
        const cards = this.deps.store.snapshot.state.activeEnvironment;
        for (const card of cards) {
            this.deps.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'entering' },
            });
            await sleep(DELAY_MEDIUM);
            this.deps.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'holding' },
            });
            await sleep(DELAY_LONG);
            this.deps.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'exiting' },
            });
            await sleep(DELAY_MEDIUM);
        }
    }

    private evaluateClashResult(playerScore: number, enemyScore: number, target: number) {
        const playerBust = playerScore > target;
        const enemyBust = enemyScore > target;
        if (playerBust && enemyBust) return 'draw';
        if (playerBust) return 'enemy_win';
        if (enemyBust) return 'player_win';
        if (playerScore > enemyScore) return 'player_win';
        if (enemyScore > playerScore) return 'enemy_win';
        return 'draw';
    }

    private async resolveDamage(result: ClashState['result']) {
        const snapshot = this.deps.store.snapshot;
        const playerScore = snapshot.state.player.score;
        const enemyScore = snapshot.state.enemy?.score ?? 0;
        const playerBust = playerScore > snapshot.state.targetScore;
        const enemyBust = snapshot.state.enemy ? enemyScore > snapshot.state.targetScore : false;

        const winner: TurnOwner | 'DRAW' =
            playerBust && enemyBust
                ? 'DRAW'
                : playerBust
                ? 'ENEMY'
                : enemyBust
                ? 'PLAYER'
                : result === 'player_win'
                ? 'PLAYER'
                : result === 'enemy_win'
                ? 'ENEMY'
                : 'DRAW';

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

        const penaltyOutcome = this.evaluatePenaltyDamage({
            winner,
            loser,
            playerScore,
            enemyScore,
            playerBust,
            enemyBust,
            roundNumber: snapshot.state.roundCount,
        });

        if (penaltyOutcome.runtimePatch) {
            this.patchPenaltyRuntime(penaltyOutcome.runtimePatch);
        }

        const penaltyCard = this.deps.store.snapshot.state.activePenalty;
        if (penaltyCard) {
            const detail = penaltyOutcome.messageFragment
                ? `${penaltyCard.name} (${penaltyOutcome.messageFragment})`
                : penaltyCard.name;
            this.emitPenaltyEvent(penaltyCard, 'APPLIED', `Penalty: ${detail}`);
        }

        let playerDamage = penaltyOutcome.playerDamage ?? 0;
        let enemyDamage = penaltyOutcome.enemyDamage ?? 0;

        const loserBonus = snapshot.state.roundModifiers.loserDamageBonus ?? 0;
        if (loserBonus > 0) {
            if (playerDamage > 0 && enemyDamage === 0) {
                playerDamage += loserBonus;
            } else if (enemyDamage > 0 && playerDamage === 0) {
                enemyDamage += loserBonus;
            }
        }

        const resolvedPlayerDamage = this.resolveRoundDamage('PLAYER', playerDamage);
        const resolvedEnemyDamage = this.resolveRoundDamage('ENEMY', enemyDamage);
        if (resolvedPlayerDamage > 0) {
            this.applyDamage('PLAYER', resolvedPlayerDamage);
        }
        if (resolvedEnemyDamage > 0) {
            this.applyDamage('ENEMY', resolvedEnemyDamage);
        }

        if (penaltyOutcome.playerHeal) {
            this.applyHealing('PLAYER', penaltyOutcome.playerHeal);
        }
        if (penaltyOutcome.enemyHeal) {
            this.applyHealing('ENEMY', penaltyOutcome.enemyHeal);
        }

        this.clearRoundModifiers('round.resolved', true);
        const playerDead = this.deps.store.snapshot.state.player.hp <= 0;
        const enemyDeadAfterDamage = this.deps.store.snapshot.state.enemy?.hp === 0;

        if (
            result === 'player_win' &&
            snapshot.state.player.score === snapshot.state.targetScore
        ) {
            this.deps.rewardService.applyEventTrigger('PERFECT_SCORE');
        }

        this.deps.store.updateState(
            prev => ({
                ...prev,
                message,
            }),
            this.deps.createMeta('round.result', 'Round result message', { message })
        );

        await sleep(DELAY_TURN_END);
        if (playerDead) {
            this.deps.store.updateState(
                prev => ({
                    ...prev,
                    phase: GamePhase.GAME_OVER,
                    message: 'You were defeated.',
                }),
                this.deps.createMeta('round.gameOver', 'Player defeated')
            );
            return;
        }

        const enemyDead = enemyDeadAfterDamage || this.deps.store.snapshot.state.enemy?.hp === 0;
        if (enemyDead) {
            await this.deps.rewardService.handleVictory();
        } else {
            const nextRound = this.deps.store.snapshot.state.roundCount + 1;
            this.deps.store.updateState(
                prev => ({
                    ...prev,
                    player: { ...prev.player, hand: [], score: 0, shield: 0 },
                    enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
                    discardPile: [],
                    playerStood: false,
                    enemyStood: false,
                    turnOwner: 'PLAYER',
                    roundCount: prev.roundCount + 1,
                    message: `${message} Next Round...`,
                }),
                this.deps.createMeta('round.advance', 'Advance to next round', { nextRound })
            );
            this.startRound();
        }
    }

    private evaluatePenaltyDamage(context: Omit<PenaltyDamageContext, 'runtime'>): PenaltyDamageResult {
        const state = this.deps.store.snapshot.state;
        const penalty = state.activePenalty;
        const payload: PenaltyDamageContext = {
            ...context,
            runtime: state.penaltyRuntime,
        };
        if (!penalty) {
            return this.computeLegacyDamage(payload);
        }
        try {
            return penalty.damageFunction(payload);
        } catch (error) {
            return this.computeLegacyDamage(payload);
        }
    }

    private computeLegacyDamage(context: PenaltyDamageContext): PenaltyDamageResult {
        if (context.winner === 'DRAW') {
            return { playerDamage: 0, enemyDamage: 0 };
        }
        let playerDamage = 0;
        let enemyDamage = 0;
        if (context.playerBust && !context.enemyBust) {
            playerDamage = DAMAGE_BUST_PLAYER;
        } else if (context.enemyBust && !context.playerBust) {
            enemyDamage = DAMAGE_BUST_ENEMY;
        } else if (context.winner === 'PLAYER') {
            enemyDamage = DAMAGE_BUST_ENEMY;
        } else if (context.winner === 'ENEMY') {
            playerDamage = DAMAGE_BUST_PLAYER;
        }
        return { playerDamage, enemyDamage };
    }

    private patchPenaltyRuntime(patch?: PenaltyDamageResult['runtimePatch']) {
        if (!patch) return;
        this.deps.store.updateState(
            prev => {
                const current = prev.penaltyRuntime;
                const next = {
                    lastWinner: patch.lastWinner ?? current.lastWinner,
                    consecutiveWins: {
                        PLAYER: patch.consecutiveWins?.PLAYER ?? current.consecutiveWins.PLAYER,
                        ENEMY: patch.consecutiveWins?.ENEMY ?? current.consecutiveWins.ENEMY,
                    },
                };
                if (
                    next.lastWinner === current.lastWinner &&
                    next.consecutiveWins.PLAYER === current.consecutiveWins.PLAYER &&
                    next.consecutiveWins.ENEMY === current.consecutiveWins.ENEMY
                ) {
                    return prev;
                }
                return {
                    ...prev,
                    penaltyRuntime: next,
                };
            },
            this.deps.createMeta('penalty.runtime', 'Penalty runtime updated', undefined, {
                suppressHistory: true,
                suppressLog: true,
            })
        );
    }

    private applyHealing(target: TurnOwner, amount: number) {
        const healAmount = Math.floor(amount);
        if (healAmount <= 0) return;
        this.deps.store.updateState(
            prev => {
                if (target === 'PLAYER') {
                    const entity = prev.player;
                    const nextHp = Math.min(entity.maxHp, entity.hp + healAmount);
                    if (nextHp === entity.hp) return prev;
                    return {
                        ...prev,
                        player: { ...entity, hp: nextHp },
                    };
                }
                if (!prev.enemy) return prev;
                const enemy = prev.enemy;
                const nextHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
                if (nextHp === enemy.hp) return prev;
                return {
                    ...prev,
                    enemy: { ...enemy, hp: nextHp },
                };
            },
            this.deps.createMeta('penalty.heal', 'Penalty heal applied', { target, amount: healAmount })
        );
        this.deps.eventBus.emit({
            type: 'damage.number',
            payload: { value: healAmount, target, variant: 'HEAL' },
        });
    }

    private emitPenaltyEvent(card: PenaltyCard, state: 'DRAWN' | 'APPLIED', detail?: string) {
        this.deps.eventBus.emit({
            type: 'penalty.card',
            payload: { card, state, detail },
        });
    }

    applyDamage(target: TurnOwner, amount: number): number {
        const multiplier = this.getDamageMultiplier(target);
        const finalAmount = Math.ceil(amount * multiplier);
        let blocked = 0;
        let inflicted = 0;
        this.deps.store.updateState(
            (prev: GameState) => {
                const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                if (!entity) {
                    return prev;
                }
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
                    return { ...prev, player: updated } as GameState;
                } else {
                    return { ...prev, enemy: updated } as GameState;
                }
            },
            this.deps.createMeta('damage.apply', `Damage applied to ${target}`, {
                target,
                amount: amount,
                finalAmount,
                blocked,
                inflicted,
            })
        );

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
        this.emitHandAction(target, 'HURT', 800);
        if (target === 'PLAYER') {
            this.deps.eventBus.emit({
                type: 'visual.effect',
                payload: { effect: 'animate-shake-hard animate-flash-red', duration: DELAY_MEDIUM },
            });
        }
        return inflicted;
    }

    updateRoundDamageAdjustments(targets: TurnOwner[], delta: number, description: string) {
        if (delta === 0) return;
        this.deps.store.updateState(
            prev => {
                const adjustments = { ...prev.roundModifiers.damageAdjustments };
                let changed = false;
                targets.forEach(target => {
                    adjustments[target] = (adjustments[target] ?? 0) + delta;
                    changed = true;
                });
                if (!changed) return prev;
                return {
                    ...prev,
                    roundModifiers: {
                        ...prev.roundModifiers,
                        damageAdjustments: adjustments,
                    },
                    message: description,
                };
            },
            this.deps.createMeta('effect.roundDamageAdjust', description, { targets, delta })
        );
    }

    resolveRoundDamage(target: TurnOwner, baseAmount: number) {
        if (baseAmount <= 0) return 0;
        const { roundModifiers } = this.deps.store.snapshot.state;
        if (roundModifiers.damageImmunity[target]) return 0;
        const adjustment = roundModifiers.damageAdjustments[target] ?? 0;
        return Math.max(0, baseAmount + adjustment);
    }

    clearRoundModifiers(reason: string, resetTargetScore: boolean) {
        this.deps.store.updateState(
            prev => {
                const adjustments = prev.roundModifiers.damageAdjustments;
                const immunity = prev.roundModifiers.damageImmunity;
                const shouldResetTarget =
                    resetTargetScore &&
                    (prev.roundModifiers.targetScoreOverride !== null || prev.targetScore !== prev.baseTargetScore);
                const needsReset =
                    shouldResetTarget ||
                    adjustments.PLAYER !== 0 ||
                    adjustments.ENEMY !== 0 ||
                    immunity.PLAYER ||
                    immunity.ENEMY ||
                    prev.roundModifiers.targetScoreOverride !== null ||
                    prev.roundModifiers.loserDamageBonus !== 0;
                if (!needsReset) return prev;
                return {
                    ...prev,
                    targetScore: shouldResetTarget ? prev.baseTargetScore : prev.targetScore,
                    roundModifiers: createDefaultRoundModifiers(),
                };
            },
            this.deps.createMeta('round.modifiers.clear', reason, undefined, { suppressHistory: true, suppressLog: true })
        );
    }

    private getForcedRevealCount() {
        let forced = 0;
        this.deps.store.snapshot.state.activeEnvironment.forEach(card => {
            card.effects.forEach(effect => {
                if (effect.type === 'FORCE_REVEAL') {
                    const visible = Number(effect.metadata?.visibleCards ?? effect.amount ?? 0);
                    forced = Math.max(forced, visible);
                }
            });
        });
        return forced;
    }

    private getDamageMultiplier(target: TurnOwner) {
        let multiplier = 1;
        this.deps.store.snapshot.state.activeEnvironment.forEach(card => {
            card.effects.forEach(effect => {
                if (effect.type !== 'DAMAGE_MULTIPLIER') return;
                if (effect.scope === 'BOTH') {
                    multiplier *= effect.amount ?? 1;
                } else if (effect.scope === 'SELF' && target === 'PLAYER') {
                    multiplier *= effect.amount ?? 1;
                } else if (effect.scope === 'OPPONENT' && target === 'ENEMY') {
                    multiplier *= effect.amount ?? 1;
                }
            });
        });
        return multiplier;
    }
}
