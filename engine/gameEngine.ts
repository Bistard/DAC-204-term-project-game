import { EVENT_EFFECTS, GameEventTrigger } from '../content/events';
import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    DAMAGE_BUST_ENEMY,
    DAMAGE_BUST_PLAYER,
    DELAY_ITEM_USE,
    DELAY_LONG,
    DELAY_MEDIUM,
    DELAY_STANDARD,
    DELAY_TURN_END,
    DELAY_XL,
    INIT_ITEM_CARD,
    REWARD_PICK_LIMIT,
    REWARD_POOL_SIZE,
    STARTING_HP,
    TARGET_SCORE,
} from '../constants';
import { EventBus } from './eventBus';
import { GameStore } from './state/gameStore';
import { createInitialGameState } from './state/gameState';
import {
    ClashState,
    Enemy,
    GamePhase,
    GameSnapshot,
    GameState,
    HandAction,
    Item,
    LogicEffectConfig,
    MetaState,
    TurnOwner,
} from '../types';
import {
    calculateScore,
    createDeck,
    createItemById,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomItems,
    sleep,
} from './utils';

type MetaUpdater = (updater: (prev: MetaState) => MetaState) => void;

interface GameEngineDeps {
    eventBus: EventBus;
    getMetaState: () => MetaState;
    updateMetaState: MetaUpdater;
}

export class GameEngine {
    private store: GameStore;
    private aiTimer: number | NodeJS.Timeout | null = null;
    private resolvingPromise: Promise<void> | null = null;

    constructor(private deps: GameEngineDeps) {
        this.store = new GameStore(createInitialGameState(deps.getMetaState()));
    }

    subscribe(listener: (snapshot: GameSnapshot) => void) {
        return this.store.subscribe(listener);
    }

    get snapshot() {
        return this.store.snapshot;
    }

    updateState(mutator: (state: GameState) => GameState) {
        this.store.updateState(mutator);
    }

    startRun() {
        const meta = this.deps.getMetaState();
        const deck = createDeck();
        const envCards = getRandomEnvironment(0);
        const nextState = this.applyEnvironmentRules({
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
        this.store.setState(nextState);

        this.startRound();
    }

    async startRound() {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        this.setDealing(true);

        if (snapshot.state.roundCount === 1 && snapshot.state.activeEnvironment.length > 0) {
            await this.playEnvironmentSequence();
        }

        const deck = createDeck();
        this.store.updateState(prev => ({
            ...prev,
            deck,
            discardPile: [],
            player: { ...prev.player, hand: [], score: 0, shield: 0 },
            enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
            playerStood: false,
            enemyStood: false,
            turnOwner: 'PLAYER',
            message: 'Dealing hand...',
        }));

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
        this.store.updateState(prev => ({ ...prev, message: 'Your Turn.' }));
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
        this.store.updateState(prev => {
            const isPlayer = actor === 'PLAYER';
            const nextTurnOwner: TurnOwner = isPlayer ? 'ENEMY' : 'PLAYER';
            return {
                ...prev,
                playerStood: isPlayer ? true : prev.playerStood,
                enemyStood: !isPlayer ? true : prev.enemyStood,
                turnOwner: nextTurnOwner,
                message: `${actor} stands.`,
            };
        });
        this.evaluateFlow();
    }

    async useItem(index: number, actor: TurnOwner) {
        const snapshot = this.store.snapshot;
        if (snapshot.flags.isDealing || snapshot.state.phase !== GamePhase.BATTLE) return;
        if (snapshot.state.turnOwner !== actor) return;
        const entity = actor === 'PLAYER' ? snapshot.state.player : snapshot.state.enemy;
        if (!entity || !entity.inventory[index]) return;
        const item = entity.inventory[index];

        this.deps.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'START' } });
        await sleep(DELAY_ITEM_USE);
        this.emitHandAction(actor, 'USE', 800);

        this.store.updateState(prev => {
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
        });

        await this.applyItemEffects(item, actor);

        this.deps.eventBus.emit({ type: 'item.animation', payload: { actor, item, index, phase: 'END' } });
        this.evaluateFlow();
    }

    nextLevel() {
        const snapshot = this.store.snapshot;
        const nextLevel = snapshot.state.runLevel + 1;
        const envCount = nextLevel <= 1 ? 0 : Math.min(3, nextLevel - 1);
        const envCards = getRandomEnvironment(envCount);

        const meta = this.deps.getMetaState();

        this.store.updateState(prev => this.applyEnvironmentRules({
            ...prev,
            runLevel: nextLevel,
            roundCount: 1,
            targetScore: TARGET_SCORE,
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
            deck: createDeck(),
            discardPile: [],
            turnOwner: 'PLAYER',
            playerStood: false,
            enemyStood: false,
            message: `Level ${nextLevel} Started.`,
            goldEarnedThisLevel: 0,
            rewardOptions: [],
            pickedRewardIndices: [],
        }));

        this.startRound();
    }

    pickReward(item: Item, index: number) {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.REWARD) return;
        if (snapshot.state.pickedRewardIndices.includes(index)) return;
        if (snapshot.state.pickedRewardIndices.length >= REWARD_PICK_LIMIT) return;

        this.store.updateState(prev => {
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
        });
    }

    private applyEnvironmentRules(state: GameState): GameState {
        let targetScore = state.targetScore ?? TARGET_SCORE;
        if (state.activeEnvironment.length > 0) {
            state.activeEnvironment.forEach(card => {
                card.effects.forEach(effect => {
                    if (effect.type === 'SET_TARGET_SCORE' && typeof effect.amount === 'number') {
                        targetScore = effect.amount;
                    }
                });
            });
        }
        return {
            ...state,
            targetScore,
        };
    }

    proceedToRewards() {
        this.store.updateState(prev => ({
            ...prev,
            phase: GamePhase.REWARD,
            rewardOptions: getRandomItems(REWARD_POOL_SIZE),
            pickedRewardIndices: [],
            message: 'Enemy Defeated!',
        }));
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
            this.deps.eventBus.emit({
                type: 'damage.number',
                payload: { value: `- ${spent} Gold`, target: 'PLAYER', variant: 'GOLD' },
            });
        }
    }

    private async drawCard(actor: TurnOwner, options: { faceDown?: boolean; shiftTurn?: boolean } = {}) {
        let drawnCardId: string | null = null;
        this.store.updateState(prev => {
            const deck = [...prev.deck];
            if (deck.length === 0) return prev;
            const card = deck.pop()!;
            card.isFaceUp = !options.faceDown;
            drawnCardId = card.id;
            const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
            const entity = prev[entityKey]!;
            const newHand = [...entity.hand, card];
            const message = actor === 'PLAYER' ? 'You drew a card...' : 'Enemy drew a card...';
            return {
                ...prev,
                deck,
                [entityKey]: { ...entity, hand: newHand },
                message,
                ...(actor === 'PLAYER' ? { enemyStood: false } : { playerStood: false }),
            };
        });
        return drawnCardId ? { cardId: drawnCardId } : null;
    }

    private revealCard(actor: TurnOwner, cardId: string, options: { shiftTurn?: boolean } = {}) {
        this.store.updateState(prev => {
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
        });
    }

    private revealInitialHands() {
        this.store.updateState(prev => {
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
        });
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
                this.store.updateState(prev => {
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
                });
            }
        }
    }

    private async playEnvironmentSequence() {
        const cards = this.store.snapshot.state.activeEnvironment;
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

    private emitHandAction(actor: TurnOwner, action: HandAction, duration: number) {
        this.deps.eventBus.emit({
            type: 'hand.action',
            payload: { actor, action, duration },
        });
    }

    private setDealing(value: boolean) {
        this.store.updateFlags(flags => ({ ...flags, isDealing: value }));
    }

    private async applyItemEffects(item: Item, actor: TurnOwner) {
        for (const effect of item.effects) {
            switch (effect.type) {
                case 'HEAL':
                    this.applyHeal(effect, actor);
                    break;
                case 'SHIELD':
                    this.applyShield(effect, actor);
                    break;
                case 'DRAW':
                    await this.applyDraw(effect, actor);
                    break;
                default:
                    break;
            }
        }
    }

    private applyHeal(effect: LogicEffectConfig, actor: TurnOwner) {
        const amount = effect.amount ?? 0;
        if (amount <= 0) return;
        const targets = this.resolveTargets(actor, effect.scope);
        targets.forEach(target => {
            this.store.updateState(prev => {
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
            });
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
            this.store.updateState(prev => {
                const entity = target === 'PLAYER' ? prev.player : prev.enemy;
                if (!entity) return prev;
                return {
                    ...prev,
                    [target === 'PLAYER' ? 'player' : 'enemy']: {
                        ...entity,
                        shield: entity.shield + amount,
                    },
                };
            });
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

    private resolveTargets(actor: TurnOwner, scope: LogicEffectConfig['scope']): TurnOwner[] {
        if (scope === 'BOTH') return ['PLAYER', 'ENEMY'] as TurnOwner[];
        if (scope === 'OPPONENT') return [actor === 'PLAYER' ? 'ENEMY' : 'PLAYER'];
        return [actor];
    }

    private evaluateFlow() {
        const snapshot = this.store.snapshot;
        if (snapshot.state.phase !== GamePhase.BATTLE) return;

        if (
            snapshot.flags.isProcessingAI &&
            (snapshot.state.turnOwner !== 'ENEMY' || snapshot.state.enemyStood || snapshot.flags.isDealing)
        ) {
            this.clearAiTimer();
            this.store.updateFlags(flags => ({ ...flags, isProcessingAI: false }));
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

    private queueAiTurn() {
        this.clearAiTimer();
        this.store.updateFlags(flags => ({ ...flags, isProcessingAI: true }));
        const scheduler = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
        this.aiTimer = scheduler(async () => {
            await this.processAiTurn();
            this.store.updateFlags(flags => ({ ...flags, isProcessingAI: false }));
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
        this.store.updateFlags(flags => ({ ...flags, isResolvingRound: true }));
        const snapshot = this.store.snapshot;
        const playerHand = snapshot.state.player.hand.map(card => ({ ...card, isFaceUp: true }));
        const enemyHand = snapshot.state.enemy
            ? snapshot.state.enemy.hand.map(card => ({ ...card, isFaceUp: true }))
            : [];
        const playerScore = calculateScore(playerHand, snapshot.state.targetScore);
        const enemyScore = snapshot.state.enemy ? calculateScore(enemyHand, snapshot.state.targetScore) : 0;

        this.store.updateState(prev => ({
            ...prev,
            player: { ...prev.player, hand: playerHand, score: playerScore },
            enemy: prev.enemy ? { ...prev.enemy, hand: enemyHand, score: enemyScore } : null,
        }));

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
        this.store.updateFlags(flags => ({ ...flags, isResolvingRound: false }));
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

        if (playerDamage > 0) {
            this.applyDamage('PLAYER', playerDamage);
        }
        if (enemyDamage > 0) {
            this.applyDamage('ENEMY', enemyDamage);
        }

        const playerDead = this.store.snapshot.state.player.hp <= 0;
        const enemyDeadAfterDamage = this.store.snapshot.state.enemy?.hp === 0;

        if (
            result === 'player_win' &&
            snapshot.state.player.score === snapshot.state.targetScore
        ) {
            this.applyEventTrigger('PERFECT_SCORE');
        }

        this.store.updateState(prev => ({
            ...prev,
            message,
        }));

        await sleep(DELAY_TURN_END);
        if (playerDead) {
            this.store.updateState(prev => ({
                ...prev,
                phase: GamePhase.GAME_OVER,
                player: { ...prev.player, hp: 0 },
                message: 'You were defeated.',
            }));
            return;
        }

        const enemyDead = enemyDeadAfterDamage || this.store.snapshot.state.enemy?.hp === 0;
        if (enemyDead) {
            await this.handleVictory();
        } else {
            this.store.updateState(prev => ({
                ...prev,
                player: { ...prev.player, hand: [], score: 0, shield: 0 },
                enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
                discardPile: [],
                playerStood: false,
                enemyStood: false,
                turnOwner: 'PLAYER',
                roundCount: prev.roundCount + 1,
                message: `${message} Next Round...`,
            }));
            this.startRound();
        }
    }

    private applyDamage(target: TurnOwner, amount: number) {
        const multiplier = this.getDamageMultiplier(target);
        const finalAmount = Math.ceil(amount * multiplier);
        let blocked = 0;
        this.store.updateState((prev: GameState) => {
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
        });

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
    }

    private async handleVictory() {
        this.store.updateState(prev => ({
            ...prev,
            phase: GamePhase.VICTORY,
            enemy: prev.enemy ? { ...prev.enemy, hp: 0 } : prev.enemy,
        }));

        this.applyEventTrigger('ENEMY_DEFEATED');
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

    private clearAiTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }

    private applyEventTrigger(trigger: GameEventTrigger) {
        EVENT_EFFECTS.filter(evt => evt.trigger === trigger).forEach(evt => {
            evt.effects.forEach(effect => this.applyEventEffect(effect));
        });
    }

    private applyEventEffect(effect: LogicEffectConfig) {
        if (effect.type === 'GOLD') {
            const bonus = this.resolveGoldEffect(effect);
            if (bonus <= 0) return;
            this.deps.updateMetaState(prev => ({ ...prev, gold: prev.gold + bonus }));
            this.store.updateState(prev => ({
                ...prev,
                goldEarnedThisLevel: prev.goldEarnedThisLevel + bonus,
            }));
            this.deps.eventBus.emit({
                type: 'damage.number',
                payload: { value: `+${bonus} Gold`, target: 'PLAYER', variant: 'GOLD' },
            });
        }
    }
}
