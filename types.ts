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
    | 'DAMAGE_MULTIPLIER'
    | 'FORCE_REVEAL'
    | 'SET_TARGET_SCORE'
    | 'GOLD';

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

export interface EnvironmentCard {
    id: string;
    name: string;
    description: string;
    effects: LogicEffectConfig[];
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

export interface GameState {
    phase: GamePhase;
    turnOwner: TurnOwner;
    playerStood: boolean;
    enemyStood: boolean;
    targetScore: number;
    roundCount: number;
    runLevel: number;
    activeEnvironment: EnvironmentCard[];
    player: Entity & {
        inventory: Item[];
        maxInventory: number;
        deckModifier: number;
    };
    enemy: Enemy | null;
    deck: Card[];
    discardPile: Card[];
    message: string;
    rewardOptions: Item[];
    pickedRewardIndices: number[];
    goldEarnedThisLevel: number;
}

export interface RuntimeFlags {
    isDealing: boolean;
    isProcessingAI: boolean;
    isResolvingRound: boolean;
}

export interface GameSnapshot {
    state: GameState;
    flags: RuntimeFlags;
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
    | { type: 'clash.state'; payload: ClashState };

export type GameEventListener = (event: GameEvent) => void;

export type MetaUpdater = (updater: (prev: MetaState) => MetaState) => void;
