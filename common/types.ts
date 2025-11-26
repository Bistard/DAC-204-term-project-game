import React from 'react';

export enum Suit {
    Hearts = '♥',
    Diamonds = '♦',
    Clubs = '♣',
    Spades = '♠',
}

export interface Card {
    suit: Suit;
    rank: string;
    value: number;
    id: string;
    isFaceUp: boolean;
    isAce: boolean;
}

export enum ItemType {
    CONSUMABLE = 'CONSUMABLE',
    PASSIVE = 'PASSIVE',
}

export type TargetScope = 'SELF' | 'OPPONENT' | 'BOTH';

export type LogicEffectType =
    | 'HEAL'
    | 'SHIELD'
    | 'DRAW'
    | 'RESOLUTION_DAMAGE_BUFFER'
    | 'RESOLUTION_DAMAGE_BOOST'
    | 'RESOLUTION_DAMAGE_IMMUNITY'
    | 'DRAW_OPTIMAL'
    | 'DRAW_VALUE'
    | 'SWAP_LAST_CARD'
    | 'UNDO_LAST_DRAW'
    | 'REPLACE_LAST_CARD'
    | 'FORCE_DRAW'
    | 'GAIN_RANDOM_ITEMS'
    | 'SELF_DAMAGE'
    | 'SET_TEMP_TARGET_SCORE'
    | 'DAMAGE_MULTIPLIER'
    | 'FORCE_REVEAL'
    | 'SET_TARGET_SCORE'
    | 'GOLD'
    | 'RANDOM_ITEM_EFFECT'
    | 'PENDING_LOSER_DAMAGE'
    | 'LIFE_DRAIN'
    | 'HEAL_PER_INVENTORY';

export interface LogicEffectConfig {
    type: LogicEffectType;
    scope?: TargetScope;
    amount?: number;
    cards?: number;
    metadata?: Record<string, number | string | boolean>;
    duration?: 'INSTANT' | 'ROUND' | 'RUN';
}

export interface ItemDefinition {
    id: string;
    name: string;
    description: string;
    type: ItemType;
    effects: LogicEffectConfig[];
}

export interface Item extends ItemDefinition {
    instanceId: string;
}

export type EnvironmentRuleType =
    | 'TARGET_RANDOMIZE'
    | 'DAMAGE_FLAT_MODIFIER'
    | 'SUDDEN_DEATH_THRESHOLD'
    | 'DECK_SHRINK'
    | 'PERFECT_REWARD_ITEM'
    | 'ROUND_START_AUTO_DRAW'
    | 'ACE_VALUE_MODE'
    | 'ITEM_USAGE_LOCK'
    | 'SPECIAL_BUST_VALUES';

export interface EnvironmentRule {
    id: string;
    type: EnvironmentRuleType;
    metadata?: Record<string, number | string | boolean | number[] | string[]>;
}

export interface EnvironmentCard {
    id: string;
    name: string;
    description: string;
    rules: EnvironmentRule[];
    incompatibleWith?: string[];
}

export interface ScoreOptions {
    aceMode: 'FLEXIBLE' | 'ALWAYS_HIGH';
    specialBustValues: number[];
}

export interface EnvironmentRuntimeState {
    appliedCardIds: string[];
    targetRule?: {
        value: number;
        sourceCardId: string;
        label?: string;
    };
    scoreOptions: ScoreOptions;
    deckMutators: {
        randomRemovalsPerRound: number;
    };
    drawHooks: {
        autoDrawPerActor: number;
    };
    rewardHooks: {
        perfectItemDraw: number;
    };
    damageModifiers: {
        baseDamage: number;
        multiplier: number; // unused
    };
    itemLocks: {
        disableUsage: boolean;
    };
    victoryHooks: {
        suddenDeathThreshold?: number;
    };
}

export interface PenaltyRuntimeState {
    lastWinner: TurnOwner | null;
    consecutiveWins: Record<TurnOwner, number>;
}

export interface PenaltyDamageContext {
    winner: TurnOwner | 'DRAW';
    loser: TurnOwner | null;
    playerScore: number;
    enemyScore: number;
    playerBust: boolean;
    enemyBust: boolean;
    roundNumber: number;
    runtime: PenaltyRuntimeState;
}

export interface PenaltyDamageResult {
    playerDamage: number;
    enemyDamage: number;
    playerHeal?: number;
    enemyHeal?: number;
    runtimePatch?: Partial<PenaltyRuntimeState>;
    messageFragment?: string;
}

export type PenaltyDamageFunction = (context: PenaltyDamageContext) => PenaltyDamageResult;

export interface PenaltyCard {
    id: string;
    name: string;
    description: string;
    damageFunction: PenaltyDamageFunction;
}

export interface Entity {
    hp: number;
    maxHp: number;
    hand: Card[];
    score: number;
    shield: number;
}

export type EnemyAIProfile = 'GREEDY' | 'DEFENSIVE' | 'RANDOM';

export interface EnemyTemplate {
    id: string;
    name: string;
    description: string;
    difficulty: number;
    baseHp: number;
    baseShield?: number;
    aiProfile: EnemyAIProfile;
    maxInventory?: number;
}

export interface Enemy extends Entity {
    name: string;
    id: string;
    templateId: string;
    difficulty: number;
    aiType: EnemyAIProfile;
    description: string;
    inventory: Item[];
    maxInventory: number;
}

export enum GamePhase {
    MENU = 'MENU',
    BATTLE = 'BATTLE',
    VICTORY = 'VICTORY',
    REWARD = 'REWARD',
    GAME_OVER = 'GAME_OVER',
}

export type TurnOwner = 'PLAYER' | 'ENEMY';

export interface RoundModifierState {
    damageAdjustments: Record<TurnOwner, number>;
    damageImmunity: Record<TurnOwner, boolean>;
    targetScoreOverride: number | null;
    loserDamageBonus: number;
}

export interface GameState {
    phase: GamePhase;
    turnOwner: TurnOwner;
    playerStood: boolean;
    enemyStood: boolean;
    targetScore: number;
    baseTargetScore: number;
    roundCount: number;
    runLevel: number;
    activeEnvironment: EnvironmentCard[];
    environmentRuntime: EnvironmentRuntimeState;
    activePenalty: PenaltyCard | null;
    player: Entity & {
        inventory: Item[];
        maxInventory: number;
        deckModifier: number;
    };
    enemy: Enemy | null;
    deck: Card[];
    discardPile: Card[];
    environmentDisabledCards: Card[];
    roundModifiers: RoundModifierState;
    penaltyRuntime: PenaltyRuntimeState;
    message: string;
    rewardOptions: Item[];
    pickedRewardIndices: number[];
    goldEarnedThisLevel: number;
}

export interface RuntimeFlags {
    isDealing: boolean;
    isProcessingAI: boolean;
    isResolvingRound: boolean;
    isBattleExiting: boolean;
}

export interface GameSnapshot {
    state: GameState;
    flags: RuntimeFlags;
}

export interface StoreUpdateMeta {
    tag?: string;
    description?: string;
    payload?: Record<string, unknown>;
    suppressLog?: boolean;
    suppressHistory?: boolean;
}

export interface GameLogEntry {
    id: string;
    timestamp: number;
    tag?: string;
    description: string;
    round: number;
    phase: GamePhase;
    turnOwner: TurnOwner;
    payload?: Record<string, unknown>;
}

export interface ReplayFrame {
    snapshot: GameSnapshot;
    meta?: StoreUpdateMeta;
    timestamp: number;
}

export interface ReplayOptions {
    frames?: ReplayFrame[];
    delayMs?: number;
    loop?: boolean;
    loopCount?: number;
    onFrame?: (frame: ReplayFrame, index: number) => void;
}

export interface LoadHistoryOptions {
    applyState?: boolean;
}

export interface RecordingOptions {
    label?: string;
    includeCurrent?: boolean;
}

export interface MetaUpgrades {
    hpLevel: number;
    inventoryLevel: number;
}

export interface MetaState {
    gold: number;
    upgrades: MetaUpgrades;
}

export interface DamageNumber {
    id: string;
    value: string;
    target: 'PLAYER' | 'ENEMY';
    style: React.CSSProperties;
    color: string;
    isGlitch?: boolean;
}

export interface ClashState {
    active: boolean;
    playerScore: number;
    enemyScore: number;
    result: 'player_win' | 'enemy_win' | 'draw' | null;
}

export type HandAction = 'IDLE' | 'HIT' | 'STAND' | 'USE' | 'HURT' | 'LEAVE';

export type GameEvent =
    | { type: 'hand.action'; payload: { actor: TurnOwner; action: HandAction; duration?: number } }
    | { type: 'visual.effect'; payload: { effect: string; duration?: number } }
    | { type: 'damage.number'; payload: { value: number | string; target: TurnOwner; variant: 'DAMAGE' | 'HEAL' | 'GOLD' } }
    | { type: 'item.animation'; payload: { actor: TurnOwner; item: Item; index?: number; phase: 'START' | 'END' } }
    | { type: 'environment.animation'; payload: { card: EnvironmentCard; state: 'entering' | 'holding' | 'exiting' } }
    | { type: 'penalty.animation'; payload: { card: PenaltyCard; state: 'entering' | 'holding' | 'exiting' } }
    | { type: 'penalty.card'; payload: { card: PenaltyCard; state: 'DRAWN' | 'APPLIED'; detail?: string } }
    | { type: 'clash.state'; payload: ClashState };

export type GameEventListener = (event: GameEvent) => void;

export type MetaUpdater = (updater: (prev: MetaState) => MetaState) => void;
