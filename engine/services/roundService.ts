import {
    DELAY_LONG,
    DELAY_MEDIUM,
    DELAY_SHORT,
    DELAY_STANDARD,
    DELAY_TURN_END,
    DELAY_XL,
    INIT_ITEM_CARD,
} from '../../common/constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { createDefaultRoundModifiers } from '../state/gameState';
import {
    Card,
    ClashState,
    GameMode,
    GamePhase,
    GameState,
    HandAction,
    MetaState,
    PenaltyCard,
    TurnOwner,
} from '../../common/types';
import {
    calculateScore,
    createDeck,
    getRandomItems,
    sleep,
} from '../utils';
import { RewardService } from './rewardService';
import { RunLifecycleService } from './runLifecycleService';
import { DamageService, ClashComputationResult } from './damageService';
import { PenaltyEngine } from './penaltyEngine';
import { CreateMetaFn } from './commonService';

interface RoundServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: RewardService;
    runLifecycleService: RunLifecycleService;
    damageService: DamageService;
    penaltyEngine: PenaltyEngine;
    createMeta: CreateMetaFn;
    onRoundReady: () => void | Promise<void>;
}

type ResolveDamageContext = ClashComputationResult & {
    playerScore: number;
    enemyScore: number;
    playerBust: boolean;
    enemyBust: boolean;
};

export class RoundService {
    constructor(private deps: RoundServiceDeps) {}

    startRun(mode: GameMode) {
        const meta = this.deps.getMetaState();
        const initialState = this.deps.runLifecycleService.startNewRun(meta, mode);
        this.deps.store.setState(
            initialState,
            this.deps.createMeta('start-run', 'Initialize new run', { runLevel: initialState.runLevel })
        );
        if (initialState.activePenalty) {
            this.emitPenaltyEvent(initialState.activePenalty, 'DRAWN', 'Battle penalty selected.');
        }

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

        if (snapshot.state.runLevel === 1 && snapshot.state.roundCount === 1) {
            await this.dealInitialItems(true);
        } else if (snapshot.state.roundCount === 1) {
            await this.dealInitialItems(false);
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

        const playerBust = this.isBust(playerScore, snapshot.state);
        const enemyBust = snapshot.state.enemy ? this.isBust(enemyScore, snapshot.state) : false;
        const clashComputation = this.deps.damageService.computeClashResult({
            playerScore,
            enemyScore,
            playerBust,
            enemyBust,
        });

        const clash: ClashState = {
            active: true,
            playerScore,
            enemyScore,
            result: clashComputation.result,
        };
        this.deps.eventBus.emit({ type: 'clash.state', payload: clash });

        await sleep(DELAY_XL);
        this.deps.eventBus.emit({
            type: 'clash.state',
            payload: { ...clash, active: false },
        });

        await this.resolveDamage({
            ...clashComputation,
            playerScore,
            enemyScore,
            playerBust,
            enemyBust,
        });
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

    private async dealInitialItems(firstLevel: boolean) {
        const snapshot = this.deps.store.snapshot;
        if (!snapshot.state.enemy) {
            return;
        }
        
        const enemyAdditionalItems = INIT_ITEM_CARD;
        const playerAdditionalItems = firstLevel 
            ? INIT_ITEM_CARD + this.deps.getMetaState().upgrades.inventoryLevel 
            : 0;
        
        const players = [
            { actor: 'ENEMY', count: enemyAdditionalItems },
            { actor: 'PLAYER', count: playerAdditionalItems },
        ];

        for (const player of players) {
            for (let i = 0; i < player.count; i++) {
                await sleep(DELAY_SHORT);
                this.deps.store.updateState(
                    prev => {
                        const entityKey = player.actor === 'PLAYER' ? 'player' : 'enemy';
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
                    this.deps.createMeta('item.grant', `Granted item to ${player.actor}`, { actor: player.actor })
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

    private async resolveDamage(context: ResolveDamageContext) {
        const snapshot = this.deps.store.snapshot;
        const { playerScore, enemyScore, playerBust, enemyBust } = context;

        const penaltyOutcome = this.deps.penaltyEngine.evaluateDamage({
            winner: context.winner,
            loser: context.loser,
            playerScore,
            enemyScore,
            playerBust,
            enemyBust,
            roundNumber: snapshot.state.roundCount,
        });

        const penaltyCard = this.deps.store.snapshot.state.activePenalty;
        if (penaltyCard) {
            const detail = penaltyOutcome.messageFragment
                ? `${penaltyCard.name} (${penaltyOutcome.messageFragment})`
                : penaltyCard.name;
            this.emitPenaltyEvent(penaltyCard, 'APPLIED', `Penalty: ${detail}`);
        }

        this.deps.damageService.applyRoundDamage({
            playerBaseDamage: penaltyOutcome.playerDamage ?? 0,
            enemyBaseDamage: penaltyOutcome.enemyDamage ?? 0,
            roundModifiers: snapshot.state.roundModifiers,
        });

        if (penaltyOutcome.playerHeal) {
            this.deps.damageService.applyHealing('PLAYER', penaltyOutcome.playerHeal, {
                metaTag: 'penalty.heal',
                description: 'Penalty heal applied',
            });
        }
        if (penaltyOutcome.enemyHeal) {
            this.deps.damageService.applyHealing('ENEMY', penaltyOutcome.enemyHeal, {
                metaTag: 'penalty.heal',
                description: 'Penalty heal applied',
            });
        }

        this.deps.damageService.enforceSuddenDeath();

        this.clearRoundModifiers('round.resolved', true);
        const playerDead = this.deps.store.snapshot.state.player.hp <= 0;
        const enemyDead = this.deps.store.snapshot.state.enemy?.hp <= 0;

        const playerPerfect = !playerBust && playerScore === snapshot.state.targetScore;
        const enemyPerfect = snapshot.state.enemy ? !enemyBust && enemyScore === snapshot.state.targetScore : false;

        if (context.result === 'player_win' && playerPerfect) {
            await this.deps.rewardService.applyEventTrigger('PERFECT_SCORE');
        }
        if (playerPerfect) {
            this.deps.rewardService.applyEnvironmentPerfectReward('PLAYER');
        }
        if (enemyPerfect) {
            this.deps.rewardService.applyEnvironmentPerfectReward('ENEMY');
        }

        const message = context.message;
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

    private emitPenaltyEvent(card: PenaltyCard, state: 'DRAWN' | 'APPLIED', detail?: string) {
        this.deps.eventBus.emit({
            type: 'penalty.card',
            payload: { card, state, detail },
        });
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

}

