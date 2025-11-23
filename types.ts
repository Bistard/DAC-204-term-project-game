
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
  value: number; // 1-11
  id: string;
  isFaceUp: boolean;
  isAce: boolean;
}

export enum ItemType {
  CONSUMABLE = 'CONSUMABLE',
  PASSIVE = 'PASSIVE',
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effect: (gameState: GameState) => Partial<GameState>;
  type: ItemType;
}

export interface EnvironmentCard {
  id: string;
  name: string;
  description: string;
}

export interface Entity {
  hp: number;
  maxHp: number;
  hand: Card[];
  score: number; // Hand value
  shield: number;
}

export interface Enemy extends Entity {
  name: string;
  id: string;
  difficulty: number;
  aiType: 'GREEDY' | 'DEFENSIVE' | 'RANDOM';
  description: string;
  inventory: Item[];
  maxInventory: number;
}

export enum GamePhase {
  MENU = 'MENU',
  BATTLE = 'BATTLE', // Alternating turns
  VICTORY = 'VICTORY', // Transition phase after killing enemy
  REWARD = 'REWARD', // End of level reward
  GAME_OVER = 'GAME_OVER',
}

export type TurnOwner = 'PLAYER' | 'ENEMY';

export interface GameState {
  phase: GamePhase;
  // Battle State
  turnOwner: TurnOwner;
  playerStood: boolean;
  enemyStood: boolean;
  
  // Global State
  targetScore: number; // The score to hit (usually 21)
  roundCount: number; // Rounds within current fight
  runLevel: number;
  activeEnvironment: EnvironmentCard[];
  
  player: Entity & {
    inventory: Item[];
    maxInventory: number;
    deckModifier: number;
  };
  enemy: Enemy | null;
  deck: Card[]; // Shared 13 card deck
  discardPile: Card[]; // Needed for reshuffling small deck
  
  // UI
  message: string;
}

// --- Meta Progression ---

export interface MetaUpgrades {
    hpLevel: number; // 0 to 5
    inventoryLevel: number; // 0 to 3
}

export interface MetaState {
    gold: number;
    upgrades: MetaUpgrades;
}

// --- UI State Types ---

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
