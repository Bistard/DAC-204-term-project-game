import {
    DAMAGE_BUST_ENEMY,
    DAMAGE_BUST_PLAYER,
    DELAY_ITEM_USE,
    DELAY_LONG,
    DELAY_MEDIUM,
    DELAY_STANDARD,
    DELAY_TURN_END,
    DELAY_XL,
    INIT_ITEM_CARD,
    TARGET_SCORE,
    STARTING_HP,
} from '../../constants';
import { EventBus } from '../eventBus';
import { GameStore } from '../state/gameStore';
import { createDefaultRoundModifiers, createInitialGameState } from '../state/gameState';
import {
    Card,
    ClashState,
    Enemy,
    GamePhase,
    GameState,
    HandAction,
    Item,
    LogicEffectConfig,
    LogicEffectType,
    MetaState,
    StoreUpdateMeta,
    TurnOwner,
} from '../../types';
import {
    applyEnvironmentRules,
    calculateScore,
    createDeck,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomItems,
    sleep,
} from '../utils';
import { RewardService } from './rewardService';

interface CombatServiceDeps {
    store: GameStore;
    eventBus: EventBus;
    getMetaState: () => MetaState;
    rewardService: RewardService;
}

export class CombatService {
    private store: GameStore;
    private eventBus: EventBus;
    private aiTimer: ReturnType<typeof setTimeout> | null = null;
    private effectHandlers: Partial<Record<LogicEffectType, (effect: LogicEffectConfig, actor: TurnOwner) => Promise<void>>> = {};

    constructor(private deps: CombatServiceDeps) {
        this.store = deps.store;
        this.eventBus = deps.eventBus;
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
        };
    }

    startRun() {
        const meta = this.deps.getMetaState();
        const deck = createDeck();
        const envCards = getRandomEnvironment(0);
        const initialState = applyEnvironmentRules({
            ...createInitialGameState(meta),
            phase: GamePhase.BATTLE,
            runLevel: 1,
            roundCount: 1,
            deck,
            discardPile: [],
            player: {
                ...createInitialGameState(meta).player,
                hp: STARTING_HP + meta.upgrades.hpLevel,
                maxHp: STARTING_HP + meta.upgrades.hpLevel,
            },
            enemy: getRandomEnemy(1),
            activeEnvironment: envCards,
            message: 'Run started!',
        });
        this.store.setState(
            initialState,
            this.createMeta('start-run', 'Initialize new run', { runLevel: initialState.runLevel })
        );

        this.startRound();
    }

    async startRound() {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        this.setDealing(true);
        this.clearRoundModifiers('round.start', true);

        if (snapshot.state.roundCount === 1 && snapshot.state.activeEnvironment.length > 0) {
            await this.playEnvironmentSequence();
        }

        const deck = createDeck();
        this.store.updateState(
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
            this.createMeta('round.setup', 'Prepare new round', { round: snapshot.state.roundCount })
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
        this.store.updateState(
            prev => ({ ...prev, message: 'Your Turn.' }),
            this.createMeta('round.ready', 'Player turn begins')
        );
        this.setDealing(false);
        this.evaluateFlow();
    }

    async hit(actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        if (actor === 'PLAYER' && snapshot.state.turnOwner !== 'PLAYER') return;
        if (actor === 'ENEMY' && (!snapshot.state.enemy || snapshot.state.turnOwner !== 'ENEMY')) return;

        this.emitHandAction(actor, 'HIT', 1000);

        const drawn = await this.drawCard(actor, { faceDown: true });
        if (!drawn) return;

        this.setDealing(true);
        await sleep(1200);
        this.revealCard(actor, drawn.cardId);
        this.setDealing(false);
        this.evaluateFlow();
    }

    stand(actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.BATTLE) return;

        this.emitHandAction(actor, 'STAND', 800);
        this.store.updateState(
            prev => {
                const isPlayer = actor === 'PLAYER';
                const nextTurnOwner: TurnOwner = isPlayer ? 'ENEMY' : 'PLAYER';
                return {
                    ...prev,
                    playerStood: isPlayer ? true : prev.playerStood,
                    enemyStood: !isPlayer ? true : prev.enemyStood,
                    turnOwner: nextTurnOwner,
                    message: `${actor} stands.`,
                };
            },
            this.createMeta('turn.stand', `${actor} stands`, { actor })
        );
        this.evaluateFlow();
    }

    async useItem(index: number, actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        if (snapshot.state.turnOwner !== actor) return;
        const entity = actor === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
        if (!entity || !entity.inventory[index]) return;
        const item = entity.inventory[index];

        this.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'START' } });
        await sleep(DELAY_ITEM_USE);
        this.emitHandAction(actor, 'USE', 800);

        this.store.updateState(
            prev => {
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const current = prev[entityKey]!;
                if (!current.inventory[index]) return prev;
                const newInventory = current.inventory.filter((_, idx) => idx !== index);

                return {
                    ...prev,
                    [entityKey]: {
                        ...current,
                        inventory: newInventory,
                    },
                    ...(actor === 'PLAYER' ? { enemyStood: false } : { playerStood: false }),
                };
            },
            this.createMeta('item.consume', `${actor} used ${item.name}`, { actor, itemId: item.id })
        );

        await this.applyItemEffects(item, actor);

        this.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'END' } });
        this.evaluateFlow();
    }

    evaluateFlow() {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.BATTLE) {
            return;
        }

        if (
            snapshot.flags.isProcessingAI &&
            (snapshot.state.turnOwner !== 'ENEMY' || snapshot.state.enemyStood || snapshot.flags.isDealing)
        ) {
            this.clearAiTimer();
            this.store.updateFlags(
                flags => ({ ...flags, isProcessingAI: false }),
                this.createMeta('flag.ai', 'Stop AI processing', undefined, { suppressHistory: true })
            );
        }

        if (
            snapshot.state.playerStood &&
            snapshot.state.enemyStood &&
            !snapshot.flags.isResolvingRound
        ) {
            this.resolveRound();
            return;
        }

        if (
            snapshot.state.turnOwner === 'ENEMY' &&
            !snapshot.flags.isProcessingAI &&
            !snapshot.flags.isDealing &&
            !snapshot.state.enemyStood
        ) {
            this.queueAiTurn();
        }
    }

    private async drawCard(
        actor: TurnOwner,
        options: { faceDown?: boolean; shiftTurn?: boolean; preserveStandState?: boolean } = {}
    ) {
        let drawnCardId: string | null = null;
        this.store.updateState(
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
            this.createMeta('card.draw', `${actor} drew a card`, { actor })
        );
        return drawnCardId ? { cardId: drawnCardId } : null;
    }

    private revealCard(actor: TurnOwner, cardId: string, options: { shiftTurn?: boolean } = {}) {
        this.store.updateState(
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
            this.createMeta('card.reveal', `${actor} revealed a card`, { actor, cardId })
        );
    }

    private revealInitialHands() {
        this.store.updateState(
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
                    message: 'Loading Modules...',
                };
            },
            this.createMeta('round.reveal', 'Reveal opening hands')
        );
    }

    private async grantInitialItems() {
        const snapshot = this.store.snapshot;
        if (!snapshot.state.enemy) return;
        const playerItems = INIT_ITEM_CARD + this.deps.getMetaState().upgrades.inventoryLevel;
        const sequences: Array<{ actor: TurnOwner; count: number }> = [
            { actor: 'ENEMY', count: INIT_ITEM_CARD },
            { actor: 'PLAYER', count: playerItems },
        ];

        for (const seq of sequences) {
            for (let i = 0; i < seq.count; i++) {
                await sleep(400);
                this.store.updateState(
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
                    this.createMeta('item.grant', `Granted item to ${seq.actor}`, { actor: seq.actor })
                );
            }
        }
    }

    private async playEnvironmentSequence() {
        const cards = this.store.snapshot.state.activeEnvironment;
        for (const card of cards) {
            this.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'entering' },
            });
            await sleep(600);
            this.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'holding' },
            });
            await sleep(DELAY_LONG);
            this.eventBus.emit({
                type: 'environment.animation',
                payload: { card, state: 'exiting' },
            });
            await sleep(DELAY_MEDIUM);
        }
    }

    private emitHandAction(actor: TurnOwner, action: HandAction, duration: number) {
        this.eventBus.emit({
            type: 'hand.action',
            payload: { actor, action, duration },
        });
    }

    private setDealing(value: boolean) {
        this.store.updateFlags(
            flags => ({ ...flags, isDealing: value }),
            this.createMeta('flag.dealing', value ? 'Dealing started' : 'Dealing finished', { value }, { suppressHistory: true })
        );
    }

    private async applyItemEffects(item: Item, actor: TurnOwner) {
        for (const effect of item.effects) {
            const handler = this.effectHandlers[effect.type];
            if (!handler) continue;
            await handler(effect, actor);
        }
    }

    private applyHeal(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => {
            this.store.updateState(
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
                this.createMeta('effect.heal', `Heal applied to ${target}`, { target, amount })
            );
            this.eventBus.emit({
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
            this.store.updateState(
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
                this.createMeta('effect.shield', `Shield applied to ${target}`, { target, amount })
            );
        });
    }

    private async applyDraw(effect: LogicEffectConfig, actor: TurnOwner) {
        const cards = effect.cards ?? 0;
        for (let i = 0; i < cards; i++) {
            const drawn = await this.drawCard(actor, { faceDown: true, shiftTurn: false });
            if (!drawn) break;
            this.setDealing(true);
            await sleep(1200);
            this.revealCard(actor, drawn.cardId, { shiftTurn: false });
            this.setDealing(false);
        }
    }

    private applyResolutionDamageBuffer(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.updateRoundDamageAdjustments(targets, -amount, 'Applied round damage buffer');
    }

    private applyResolutionDamageBoost(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.abs(effect.amount ?? 0);
        if (amount === 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.updateRoundDamageAdjustments(targets, amount, 'Applied round damage boost');
    }

    private applyResolutionDamageImmunity(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        if (!targets.length) return;
        this.store.updateState(
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
            this.createMeta('effect.damageImmunity', 'Applied round damage immunity', { targets })
        );
    }

    private async applyDrawOptimal(actor: TurnOwner) {
        const snapshot = this.store.snapshot.state;
        const entity = actor === 'PLAYER' ? snapshot.player : snapshot.enemy;
        if (!entity || snapshot.deck.length === 0) return;
        this.store.updateState(
            prev => {
                const currentEntity = actor === 'PLAYER' ? prev.player : prev.enemy;
                if (!currentEntity || prev.deck.length === 0) return prev;
                const deck = [...prev.deck];
                let bestIndex = -1;
                let bestDiff = Number.POSITIVE_INFINITY;
                let bestScore = -Infinity;
                deck.forEach((card, index) => {
                    const simulatedHand = [...currentEntity.hand, card];
                    const simulatedScore = calculateScore(simulatedHand, prev.targetScore);
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
                const score = calculateScore(hand, prev.targetScore);
                const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
                const updatedEntity = { ...currentEntity, hand, score };
                return {
                    ...prev,
                    deck,
                    [entityKey]: updatedEntity,
                    message: `${actor === 'PLAYER' ? 'Optimal' : 'Enemy optimal'} draw retrieved.`,
                };
            },
            this.createMeta('effect.drawOptimal', 'Drew optimal card', { actor })
        );
    }

    private async applyDrawSpecificValue(effect: LogicEffectConfig, actor: TurnOwner) {
        const desired = Number(effect.metadata?.targetValue ?? effect.amount);
        if (!desired || Number.isNaN(desired)) return;
        this.store.updateState(
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
                const score = calculateScore(hand, prev.targetScore);
                return {
                    ...prev,
                    deck,
                    [entityKey]: { ...entity, hand, score },
                    message: `${actor === 'PLAYER' ? 'You' : 'Enemy'} drew target value ${desired}.`,
                };
            },
            this.createMeta('effect.drawValue', 'Drew specific card value', { actor, desired })
        );
    }

    private swapLastCards() {
        this.store.updateState(
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
                const playerScore = calculateScore(playerHand, prev.targetScore);
                const enemyScore = calculateScore(enemyHand, prev.targetScore);
                return {
                    ...prev,
                    player: { ...prev.player, hand: playerHand, score: playerScore },
                    enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
                    message: 'Swapped the last drawn cards.',
                };
            },
            this.createMeta('effect.swapLast', 'Swapped last drawn cards')
        );
    }

    private undoLastDrawEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.undoLastDraw(target));
    }

    private undoLastDraw(target: TurnOwner) {
        this.store.updateState(
            prev => {
                const entityKey = target === 'PLAYER' ? 'player' : 'enemy';
                const entity = prev[entityKey];
                if (!entity || entity.hand.length === 0) return prev;
                const hand = [...entity.hand];
                const removed = hand.pop()!;
                const deck = this.insertCardRandomly(prev.deck, { ...removed, isFaceUp: false });
                const score = calculateScore(hand, prev.targetScore);
                return {
                    ...prev,
                    deck,
                    [entityKey]: { ...entity, hand, score },
                    message: `${target === 'PLAYER' ? 'Your' : 'Enemy'} last draw was undone.`,
                };
            },
            this.createMeta('effect.undoDraw', 'Removed last drawn card', { target })
        );
    }

    private replaceLastCardEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.replaceLastCard(target));
    }

    private replaceLastCard(target: TurnOwner) {
        this.store.updateState(
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
                const score = calculateScore(hand, prev.targetScore);
                return {
                    ...prev,
                    deck,
                    discardPile,
                    [entityKey]: { ...entity, hand, score },
                    message: `${target === 'PLAYER' ? 'Your' : 'Enemy'} last card was replaced.`,
                };
            },
            this.createMeta('effect.replaceLast', 'Replaced last card', { target })
        );
    }

    private async forceDrawEffect(effect: LogicEffectConfig, actor: TurnOwner) {
        const targets = this.resolveTargets(actor, effect.scope);
        for (const target of targets) {
            const drawn = await this.drawCard(target, { faceDown: true, shiftTurn: false, preserveStandState: true });
            if (!drawn) continue;
            this.setDealing(true);
            await sleep(1200);
            this.revealCard(target, drawn.cardId, { shiftTurn: false });
            this.setDealing(false);
        }
    }

    private grantRandomItems(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        this.store.updateState(
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
            this.createMeta('effect.gainItems', 'Granted random items', { amount, targets })
        );
    }

    private applySelfInflictedDamage(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = Math.floor(effect.amount ?? 0);
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => this.applyDamage(target, amount));
    }

    private setTemporaryTargetScore(effect: LogicEffectConfig) {
        const override = Number(effect.amount ?? effect.metadata?.targetScore);
        if (!override || Number.isNaN(override)) return;
        this.store.updateState(
            prev => ({
                ...prev,
                targetScore: override,
                roundModifiers: {
                    ...prev.roundModifiers,
                    targetScoreOverride: override,
                },
                message: `Target score recalibrated to ${override}.`,
            }),
            this.createMeta('effect.tempTarget', 'Applied temporary target score', { override })
        );
    }

    private resolveTargets(actor: TurnOwner, scope: LogicEffectConfig['scope']): TurnOwner[] {
        if (scope === 'BOTH') return ['PLAYER', 'ENEMY'] as TurnOwner[];
        if (scope === 'OPPONENT') return [actor === 'PLAYER' ? 'ENEMY' : 'PLAYER'];
        return [actor];
    }

    private updateRoundDamageAdjustments(targets: TurnOwner[], delta: number, description: string) {
        if (!targets.length || delta === 0) return;
        this.store.updateState(
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
            this.createMeta('effect.roundDamageAdjust', description, { targets, delta })
        );
    }

    private insertCardRandomly(deck: Card[], card: Card) {
        const nextDeck = [...deck];
        const index = Math.floor(Math.random() * (nextDeck.length + 1));
        nextDeck.splice(index, 0, card);
        return nextDeck;
    }

    private resolveRoundDamage(target: TurnOwner, baseAmount: number) {
        if (baseAmount <= 0) return 0;
        const { roundModifiers } = this.store.snapshot.state;
        if (roundModifiers.damageImmunity[target]) return 0;
        const adjustment = roundModifiers.damageAdjustments[target] ?? 0;
        return Math.max(0, baseAmount + adjustment);
    }

    private clearRoundModifiers(reason: string, resetTargetScore: boolean) {
        this.store.updateState(
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
                    prev.roundModifiers.targetScoreOverride !== null;
                if (!needsReset) return prev;
                return {
                    ...prev,
                    targetScore: shouldResetTarget ? prev.baseTargetScore : prev.targetScore,
                    roundModifiers: createDefaultRoundModifiers(),
                };
            },
            this.createMeta('round.modifiers.clear', reason, undefined, { suppressHistory: true, suppressLog: true })
        );
    }

    private queueAiTurn() {
        this.clearAiTimer();
        this.store.updateFlags(
            flags => ({ ...flags, isProcessingAI: true }),
            this.createMeta('flag.ai', 'Start AI processing', undefined, { suppressHistory: true })
        );
        const scheduler = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
        this.aiTimer = scheduler(async () => {
            await this.processAiTurn();
            this.store.updateFlags(
                flags => ({ ...flags, isProcessingAI: false }),
                this.createMeta('flag.ai', 'AI turn completed', undefined, { suppressHistory: true })
            );
            this.aiTimer = null;
        }, DELAY_XL);
    }

    private async processAiTurn() {
        const snapshot = this.store.snapshot;
        const enemy = snapshot.state.enemy;
        if (!enemy) return;
        const trueScore = calculateScore(enemy.hand, snapshot.state.targetScore);
        let shouldHit = false;
        switch (enemy.aiType) {
            case 'GREEDY':
                shouldHit = trueScore < 18;
                break;
            case 'DEFENSIVE':
                shouldHit = trueScore < 16;
                break;
            case 'RANDOM':
            default:
                shouldHit = trueScore < snapshot.state.targetScore - 6 ? true : Math.random() > 0.5;
                break;
        }
        if (trueScore >= snapshot.state.targetScore) shouldHit = false;
        if (shouldHit) await this.hit('ENEMY');
        else this.stand('ENEMY');
    }

    private async resolveRound() {
        this.store.updateFlags(
            flags => ({ ...flags, isResolvingRound: true }),
            this.createMeta('flag.resolve', 'Begin round resolution', undefined, { suppressHistory: true })
        );
        const snapshot = this.store.snapshot;
        const playerHand = snapshot.state.player.hand.map(card => ({ ...card, isFaceUp: true }));
        const enemyHand = snapshot.state.enemy
            ? snapshot.state.enemy.hand.map(card => ({ ...card, isFaceUp: true }))
            : [];
        const playerScore = calculateScore(playerHand, snapshot.state.targetScore);
        const enemyScore = snapshot.state.enemy ? calculateScore(enemyHand, snapshot.state.targetScore) : 0;

        this.store.updateState(
            prev => ({
                ...prev,
                player: { ...prev.player, hand: playerHand, score: playerScore },
                enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
            }),
            this.createMeta('round.revealFinal', 'Reveal full hands before clash', { playerScore, enemyScore })
        );

        const clash: ClashState = {
            active: true,
            playerScore,
            enemyScore,
            result: this.evaluateClashResult(playerScore, enemyScore, snapshot.state.targetScore),
        };
        this.eventBus.emit({ type: 'clash.state', payload: clash });

        await sleep(DELAY_XL);
        this.eventBus.emit({
            type: 'clash.state',
            payload: { ...clash, active: false },
        });

        await this.resolveDamage(clash.result);
        this.store.updateFlags(
            flags => ({ ...flags, isResolvingRound: false }),
            this.createMeta('flag.resolve', 'Finish round resolution', undefined, { suppressHistory: true })
        );
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
        const snapshot = this.store.snapshot;
        let playerDamage = 0;
        let enemyDamage = 0;
        let message = 'Draw.';
        const playerBust = snapshot.state.player.score > snapshot.state.targetScore;
        const enemyBust = snapshot.state.enemy ? snapshot.state.enemy.score > snapshot.state.targetScore : false;

        if (playerBust && enemyBust) {
            message = 'Both Busted! Draw.';
        } else if (playerBust) {
            playerDamage = DAMAGE_BUST_PLAYER;
            message = 'You Busted!';
        } else if (enemyBust) {
            enemyDamage = DAMAGE_BUST_ENEMY;
            message = 'Enemy Busted!';
        } else if (result === 'player_win') {
            enemyDamage = DAMAGE_BUST_ENEMY;
            message = `You Win (${snapshot.state.player.score} vs ${snapshot.state.enemy?.score ?? 0})`;
        } else if (result === 'enemy_win') {
            playerDamage = DAMAGE_BUST_PLAYER;
            message = `Enemy Wins (${snapshot.state.enemy?.score ?? 0} vs ${snapshot.state.player.score})`;
        }

        const resolvedPlayerDamage = this.resolveRoundDamage('PLAYER', playerDamage);
        const resolvedEnemyDamage = this.resolveRoundDamage('ENEMY', enemyDamage);
        if (resolvedPlayerDamage > 0) {
            this.applyDamage('PLAYER', resolvedPlayerDamage);
        }
        if (resolvedEnemyDamage > 0) {
            this.applyDamage('ENEMY', resolvedEnemyDamage);
        }

        this.clearRoundModifiers('round.resolved', true);
        const playerDead = this.store.snapshot.state.player.hp <= 0;
        const enemyDeadAfterDamage = this.store.snapshot.state.enemy?.hp === 0;

        if (
            result === 'player_win' &&
            snapshot.state.player.score === snapshot.state.targetScore
        ) {
            this.deps.rewardService.applyEventTrigger('PERFECT_SCORE');
        }

        this.store.updateState(
            prev => ({
                ...prev,
                message,
            }),
            this.createMeta('round.result', 'Round result message', { message })
        );

        await sleep(DELAY_TURN_END);
        if (playerDead) {
            this.store.updateState(
                prev => ({
                    ...prev,
                    phase: GamePhase.GAME_OVER,
                    player: { ...prev.player, hp: 0 },
                    message: 'You were defeated.',
                }),
                this.createMeta('round.gameOver', 'Player defeated')
            );
            return;
        }

        const enemyDead = enemyDeadAfterDamage || this.store.snapshot.state.enemy?.hp === 0;
        if (enemyDead) {
            await this.deps.rewardService.handleVictory();
        } else {
            const nextRound = this.store.snapshot.state.roundCount + 1;
            this.store.updateState(
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
                this.createMeta('round.advance', 'Advance to next round', { nextRound })
            );
            this.startRound();
        }
    }

    private applyDamage(target: TurnOwner, amount: number) {
        const multiplier = this.getDamageMultiplier(target);
        const finalAmount = Math.ceil(amount * multiplier);
        let blocked = 0;
        this.store.updateState(
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
                const updated = { ...entity, hp, shield };
                if (target === 'PLAYER') {
                    return { ...prev, player: updated } as GameState;
                } else {
                    return { ...prev, enemy: updated } as GameState;
                }
            },
            this.createMeta('damage.apply', `Damage applied to ${target}`, {
                target,
                amount: amount,
                finalAmount,
                blocked,
            })
        );

        this.eventBus.emit({
            type: 'damage.number',
            payload: { value: finalAmount, target, variant: 'DAMAGE' },
        });
        if (blocked > 0) {
            this.eventBus.emit({
                type: 'damage.number',
                payload: { value: `Blocked ${blocked}`, target, variant: 'HEAL' },
            });
        }
        this.emitHandAction(target, 'HURT', 800);
        if (target === 'PLAYER') {
            this.eventBus.emit({
                type: 'visual.effect',
                payload: { effect: 'animate-shake-hard animate-flash-red', duration: DELAY_MEDIUM },
            });
        }
    }

    private getForcedRevealCount() {
        let forced = 0;
        this.store.snapshot.state.activeEnvironment.forEach(card => {
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
        this.store.snapshot.state.activeEnvironment.forEach(card => {
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

    private createMeta(
        tag: string,
        description: string,
        payload?: Record<string, unknown>,
        extra?: Partial<StoreUpdateMeta>
    ): StoreUpdateMeta {
        return {
            tag: `combat:${tag}`,
            description,
            ...(payload ? { payload } : {}),
            ...extra,
        };
    }

    private clearAiTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }
}
