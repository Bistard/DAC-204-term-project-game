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
        const envCards = getRandomEnvironment(3);
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
        
        this.deps.store.updateFlags(f => ({ ...f, isBattleExiting: false }));
        
        this.setDealing(true);
        this.clearRoundModifiers('round.start', true);

        // wait for intro animation complete
        await sleep(DELAY_STANDARD);
        
        const isIntroRound = snapshot.state.roundCount === 1;
        if (isIntroRound) {
            if (snapshot.state.activePenalty) {
                await this.playPenaltySequence();
            }
            if (snapshot.state.activeEnvironment.length > 0) {
                await this.playEnvironmentSequence();
            }
        }

        const baseDeck = createDeck();
        const { deck, removed } = this.applyEnvironmentDeckMutators(baseDeck);
        this.deps.store.updateState(
            prev => ({
                ...prev,
                deck,
                discardPile: removed,
                environmentDisabledCards: removed,
                player: { ...prev.player, hand: [], score: 0, shield: 0 },
                enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
                playerStood: false,
                enemyStood: false,
                turnOwner: 'PLAYER',
                message: 'Dealing hand...',
            }),
            this.deps.createMeta('round.setup', 'Prepare new round', {
                round: snapshot.state.roundCount,
                deckShrink: removed.length,
            })
        );

        await sleep(DELAY_LONG);

        const dealOrder: TurnOwner[] = ['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY'];
        for (const owner of dealOrder) {
            await this.drawCard(owner, { faceDown: true });
            await sleep(DELAY_MEDIUM);
        }

        await sleep(DELAY_STANDARD);
        this.revealInitialHands();

        await this.applyEnvironmentAutoDraws();

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
        const scoreOptions = snapshot.state.environmentRuntime.scoreOptions;
        const playerScore = calculateScore(playerHand, snapshot.state.targetScore, scoreOptions);
        const enemyScore = snapshot.state.enemy
            ? calculateScore(enemyHand, snapshot.state.targetScore, scoreOptions)
            : 0;

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
            result: this.evaluateClashResult(playerScore, enemyScore, snapshot.state),
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
                const score = calculateScore(hand, prev.targetScore, prev.environmentRuntime.scoreOptions);
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
                const enemyHand = prev.enemy
                    ? prev.enemy.hand.map((card, idx) => {
                          const shouldReveal = idx !== 0;
                          return shouldReveal ? { ...card, isFaceUp: true } : card;
                      })
                    : [];
                const scoreOptions = prev.environmentRuntime.scoreOptions;
                const playerScore = calculateScore(playerHand, prev.targetScore, scoreOptions);
                const enemyScore = prev.enemy
                    ? calculateScore(
                          enemyHand.filter(c => c.isFaceUp),
                          prev.targetScore,
                          scoreOptions
                      )
                    : 0;
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

    private evaluateClashResult(playerScore: number, enemyScore: number, state: GameState) {
        const playerBust = this.isBust(playerScore, state);
        const enemyBust = this.isBust(enemyScore, state);
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
        const playerBust = this.isBust(playerScore, snapshot.state);
        const enemyBust = snapshot.state.enemy ? this.isBust(enemyScore, snapshot.state) : false;

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

        this.enforceSuddenDeath();

        this.clearRoundModifiers('round.resolved', true);
        const playerDead = this.deps.store.snapshot.state.player.hp <= 0;
        const enemyDead = this.deps.store.snapshot.state.enemy?.hp <= 0;

        const playerPerfect = !playerBust && playerScore === snapshot.state.targetScore;
        const enemyPerfect = snapshot.state.enemy ? !enemyBust && enemyScore === snapshot.state.targetScore : false;

        if (result === 'player_win' && playerPerfect) {
            this.deps.rewardService.applyEventTrigger('PERFECT_SCORE');
        }
        if (playerPerfect) {
            this.deps.rewardService.applyEnvironmentPerfectReward('PLAYER');
        }
        if (enemyPerfect) {
            this.deps.rewardService.applyEnvironmentPerfectReward('ENEMY');
        }

        this.deps.store.updateState(
            prev => ({
                ...prev,
                message,
            }),
            this.deps.createMeta('round.result', 'Round result message', { message })
        );

        await sleep(DELAY_TURN_END);
        
        // exit animations
        if (playerDead || enemyDead) {
            this.deps.store.updateFlags(
                flags => ({ ...flags, isBattleExiting: true }),
                this.deps.createMeta('flag.exit', 'Battle exiting animation', undefined, { suppressHistory: true })
            );
            await sleep(DELAY_STANDARD);
        }

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
        const runtime = this.deps.store.snapshot.state.environmentRuntime;
        const baseDamage = amount > 0 ? runtime.damageModifiers.baseDamage : 0;
        const scaledAmount = (amount + baseDamage) * (runtime.damageModifiers.multiplier || 1);
        const finalAmount = Math.max(0, Math.ceil(scaledAmount));
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

    private isBust(score: number, state: GameState) {
        const specialBustValues = state.environmentRuntime.scoreOptions.specialBustValues;
        if (specialBustValues.includes(score)) {
            return true;
        }
        return score > state.targetScore;
    }

    private applyEnvironmentDeckMutators(deck: Card[]) {
        const removals = this.deps.store.snapshot.state.environmentRuntime.deckMutators.randomRemovalsPerRound;
        if (removals <= 0) {
            return { deck, removed: [] as Card[] };
        }
        const nextDeck = [...deck];
        const removed: Card[] = [];
        for (let i = 0; i < removals && nextDeck.length > 0; i++) {
            const index = Math.floor(Math.random() * nextDeck.length);
            const [card] = nextDeck.splice(index, 1);
            if (card) removed.push(card);
        }
        return { deck: nextDeck, removed };
    }

    private async applyEnvironmentAutoDraws() {
        const autoDraw = this.deps.store.snapshot.state.environmentRuntime.drawHooks.autoDrawPerActor;
        if (autoDraw <= 0) return;
        const actors: TurnOwner[] = ['PLAYER', 'ENEMY'];
        for (let cycle = 0; cycle < autoDraw; cycle++) {
            for (const actor of actors) {
                const drawn = await this.drawCard(actor, {
                    faceDown: true,
                    shiftTurn: false,
                    preserveStandState: true,
                });
                if (!drawn) continue;
                this.setDealing(true);
                await sleep(DELAY_MEDIUM);
                this.revealCard(actor, drawn.cardId, { shiftTurn: false });
                this.setDealing(false);
            }
        }
        this.deps.store.updateState(
            prev => ({ ...prev }),
            this.deps.createMeta('round.autoDraw', 'Environment auto hits applied', { count: autoDraw })
        );
    }

    private enforceSuddenDeath() {
        const threshold = this.deps.store.snapshot.state.environmentRuntime.victoryHooks.suddenDeathThreshold;
        if (!threshold) return;
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
    }
}
