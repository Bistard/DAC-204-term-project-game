
export const STARTING_HP = 10;
export const MAX_INVENTORY_SLOTS = 10;

// Game Rules
export const TARGET_SCORE = 21;

// Card Values
export const ACE_VALUE = 11;
export const ACE_ADJUSTMENT = 10; // Subtract this when Ace causes bust

// Item Cards
export const INIT_ITEM_CARD = 3;

// Economy & Rewards
export const GOLD_REWARD_BASE = 3;
export const GOLD_REWARD_PERFECT = 1;
export const REWARD_POOL_SIZE = 5;
export const REWARD_PICK_LIMIT = 3;

// Meta Progression Costs
export const MAX_UPGRADE_HP = 5;
export const MAX_UPGRADE_INVENTORY = 3;

// Costs for next level
export const COST_UPGRADE_HP = [5, 10, 15, 20, 25];
export const COST_UPGRADE_INVENTORY = [15, 30, 50];

// Damage & Scaling
export const DAMAGE_BUST_PLAYER = 3;
export const DAMAGE_BUST_ENEMY = 3;
export const HP_SCALING_PER_LEVEL = 2;

// AI Behavior Thresholds
export const AI_GREEDY_LIMIT = 18;     // Hit until < 18
export const AI_DEFENSIVE_LIMIT = 16;  // Stand if >= 16
export const AI_RANDOM_OFFSET = 6;     // Hit if score < Target - 6

// Visual Feedback Thresholds (Offsets from Target)
export const VISUAL_WARN_OFFSET = 1;   // Target - 1
export const VISUAL_SAFE_OFFSET = 3;   // Target - 3
export const VISUAL_EARLY_OFFSET = 6;  // Target - 6

// Animation & Game Flow Delays (ms)
export const DELAY_SHORT = 200;
export const DELAY_MEDIUM = 500;
export const DELAY_STANDARD = 1000;
export const DELAY_LONG = 1500;
export const DELAY_XL = 2500;
export const DELAY_TURN_END = 4500;
export const DELAY_ITEM_USE = 3000;

// Note: gameplay data (items, enemies, environments, events) now live in /content and should be imported directly there.
