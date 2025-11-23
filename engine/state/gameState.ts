import { MAX_INVENTORY_SLOTS, STARTING_HP, TARGET_SCORE } from '../../constants';
import { Enemy, GamePhase, GameSnapshot, GameState, MetaState, RuntimeFlags } from '../../types';

export const createInitialGameState = (metaState: MetaState): GameState => ({
    phase: GamePhase.MENU,
    turnOwner: 'PLAYER',
    playerStood: false,
    enemyStood: false,
    targetScore: TARGET_SCORE,
    roundCount: 0,
    runLevel: 1,
    activeEnvironment: [],
    player: {
        hp: STARTING_HP + metaState.upgrades.hpLevel,
        maxHp: STARTING_HP + metaState.upgrades.hpLevel,
        hand: [],
        score: 0,
        shield: 0,
        inventory: [],
        maxInventory: MAX_INVENTORY_SLOTS,
        deckModifier: 0,
    },
    enemy: null,
    deck: [],
    discardPile: [],
    message: 'Welcome to Last Hand',
    rewardOptions: [],
    pickedRewardIndices: [],
    goldEarnedThisLevel: 0,
});

export const defaultRuntimeFlags: RuntimeFlags = {
    isDealing: false,
    isProcessingAI: false,
    isResolvingRound: false,
};

export const createSnapshot = (
    state: GameState,
    flags: Partial<RuntimeFlags> = {}
): GameSnapshot => ({
    state,
    flags: {
        ...defaultRuntimeFlags,
        ...flags,
    },
});

export const cloneGameState = (state: GameState): GameState => ({
    ...state,
    activeEnvironment: [...state.activeEnvironment],
    player: {
        ...state.player,
        hand: state.player.hand.map(card => ({ ...card })),
        inventory: state.player.inventory.map(item => ({ ...item })),
    },
    enemy: state.enemy
        ? {
              ...state.enemy,
              hand: state.enemy.hand.map(card => ({ ...card })),
              inventory: state.enemy.inventory.map(item => ({ ...item })),
          }
        : null,
    deck: state.deck.map(card => ({ ...card })),
    discardPile: state.discardPile.map(card => ({ ...card })),
});

export const applyEnemyUpdate = (
    state: GameState,
    enemyUpdater: (enemy: Enemy) => Enemy
): GameState => {
    if (!state.enemy) return state;
    return {
        ...state,
        enemy: enemyUpdater(state.enemy),
    };
};
