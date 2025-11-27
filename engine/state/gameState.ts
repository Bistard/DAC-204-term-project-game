import { MAX_INVENTORY_SLOTS, STARTING_HP, TARGET_SCORE } from '../../common/constants';
import {
    Card,
    Enemy,
    EnvironmentCard,
    EnvironmentRuntimeState,
    GamePhase,
    GameSnapshot,
    GameState,
    Item,
    MetaState,
    PenaltyCard,
    PenaltyRuntimeState,
    RoundModifierState,
    RuntimeFlags,
    TurnOwner,
} from '../../common/types';
import { cloneEnvironmentRuntime, createEmptyEnvironmentRuntime } from '../rules/environmentRuleEngine';

export const createDefaultRoundModifiers = (): RoundModifierState => ({
    damageAdjustments: { PLAYER: 0, ENEMY: 0 },
    damageImmunity: { PLAYER: false, ENEMY: false },
    targetScoreOverride: null,
    loserDamageBonus: 0,
});

export const createDefaultPenaltyRuntime = (): PenaltyRuntimeState => ({
    lastWinner: null,
    consecutiveWins: { PLAYER: 0, ENEMY: 0 },
});

export interface RunState {
    phase: GamePhase;
    runLevel: number;
    message: string;
    rewardOptions: Item[];
    pickedRewardIndices: number[];
    goldEarnedThisLevel: number;
}

export interface BattleState {
    roundCount: number;
    activeEnvironment: EnvironmentCard[];
    environmentRuntime: EnvironmentRuntimeState;
    activePenalty: PenaltyCard | null;
    penaltyRuntime: PenaltyRuntimeState;
    player: GameState['player'];
    enemy: GameState['enemy'];
    deck: Card[];
    discardPile: Card[];
    environmentDisabledCards: Card[];
}

export interface RoundState {
    turnOwner: TurnOwner;
    playerStood: boolean;
    enemyStood: boolean;
    targetScore: number;
    baseTargetScore: number;
    roundModifiers: RoundModifierState;
}

const cloneCards = (cards: Card[]): Card[] => cards.map(card => ({ ...card }));
const cloneItems = (items: Item[]): Item[] => items.map(item => ({ ...item }));
const cloneEnvironmentCards = (cards: EnvironmentCard[]): EnvironmentCard[] => cards.map(card => ({ ...card }));

const cloneEntity = (entity: GameState['player']): GameState['player'] => ({
    ...entity,
    hand: cloneCards(entity.hand),
    inventory: cloneItems(entity.inventory),
});

const cloneEnemy = (enemy: GameState['enemy']): GameState['enemy'] =>
    enemy
        ? {
              ...enemy,
              hand: cloneCards(enemy.hand),
              inventory: cloneItems(enemy.inventory),
          }
        : null;

const cloneRunState = (state: RunState): RunState => ({
    ...state,
    rewardOptions: cloneItems(state.rewardOptions),
    pickedRewardIndices: [...state.pickedRewardIndices],
});

const cloneBattleOnly = (state: GameState): BattleState => ({
    roundCount: state.roundCount,
    activeEnvironment: cloneEnvironmentCards(state.activeEnvironment),
    environmentRuntime: cloneEnvironmentRuntime(state.environmentRuntime),
    activePenalty: state.activePenalty ? { ...state.activePenalty } : null,
    penaltyRuntime: {
        lastWinner: state.penaltyRuntime.lastWinner,
        consecutiveWins: { ...state.penaltyRuntime.consecutiveWins },
    },
    player: cloneEntity(state.player),
    enemy: cloneEnemy(state.enemy),
    deck: cloneCards(state.deck),
    discardPile: cloneCards(state.discardPile),
    environmentDisabledCards: cloneCards(state.environmentDisabledCards),
});

const cloneRoundOnly = (state: GameState): RoundState => ({
    turnOwner: state.turnOwner,
    playerStood: state.playerStood,
    enemyStood: state.enemyStood,
    targetScore: state.targetScore,
    baseTargetScore: state.baseTargetScore,
    roundModifiers: {
        damageAdjustments: { ...state.roundModifiers.damageAdjustments },
        damageImmunity: { ...state.roundModifiers.damageImmunity },
        targetScoreOverride: state.roundModifiers.targetScoreOverride,
        loserDamageBonus: state.roundModifiers.loserDamageBonus,
    },
});

export const extractRunState = (state: GameState): RunState =>
    cloneRunState({
        phase: state.phase,
        runLevel: state.runLevel,
        message: state.message,
        rewardOptions: state.rewardOptions,
        pickedRewardIndices: state.pickedRewardIndices,
        goldEarnedThisLevel: state.goldEarnedThisLevel,
    });

export const extractBattleState = (state: GameState): BattleState => cloneBattleOnly(state);

export const extractRoundState = (state: GameState): RoundState => cloneRoundOnly(state);

export const createInitialRunState = (): RunState => ({
    phase: GamePhase.MENU,
    runLevel: 1,
    message: 'Welcome to Last Hand',
    rewardOptions: [],
    pickedRewardIndices: [],
    goldEarnedThisLevel: 0,
});

export const createInitialBattleState = (metaState: MetaState): BattleState => ({
    roundCount: 0,
    activeEnvironment: [],
    environmentRuntime: createEmptyEnvironmentRuntime(),
    activePenalty: null,
    penaltyRuntime: createDefaultPenaltyRuntime(),
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
    environmentDisabledCards: [],
});

export const createInitialRoundState = (): RoundState => ({
    turnOwner: 'PLAYER',
    playerStood: false,
    enemyStood: false,
    targetScore: TARGET_SCORE,
    baseTargetScore: TARGET_SCORE,
    roundModifiers: createDefaultRoundModifiers(),
});

export const createInitialGameState = (metaState: MetaState): GameState => ({
    ...createInitialRunState(),
    ...createInitialBattleState(metaState),
    ...createInitialRoundState(),
});

export const defaultRuntimeFlags: RuntimeFlags = {
    isDealing: false,
    isProcessingAI: false,
    isResolvingRound: false,
    isBattleExiting: false,
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
    ...extractRunState(state),
    ...extractBattleState(state),
    ...extractRoundState(state),
});

const writeRunState = (state: GameState, next: RunState): GameState => ({
    ...state,
    phase: next.phase,
    runLevel: next.runLevel,
    message: next.message,
    rewardOptions: cloneItems(next.rewardOptions),
    pickedRewardIndices: [...next.pickedRewardIndices],
    goldEarnedThisLevel: next.goldEarnedThisLevel,
});

const writeBattleState = (state: GameState, next: BattleState): GameState => ({
    ...state,
    roundCount: next.roundCount,
    activeEnvironment: cloneEnvironmentCards(next.activeEnvironment),
    environmentRuntime: cloneEnvironmentRuntime(next.environmentRuntime),
    activePenalty: next.activePenalty ? { ...next.activePenalty } : null,
    penaltyRuntime: {
        lastWinner: next.penaltyRuntime.lastWinner,
        consecutiveWins: { ...next.penaltyRuntime.consecutiveWins },
    },
    player: cloneEntity(next.player),
    enemy: cloneEnemy(next.enemy),
    deck: cloneCards(next.deck),
    discardPile: cloneCards(next.discardPile),
    environmentDisabledCards: cloneCards(next.environmentDisabledCards),
});

const writeRoundState = (state: GameState, next: RoundState): GameState => ({
    ...state,
    turnOwner: next.turnOwner,
    playerStood: next.playerStood,
    enemyStood: next.enemyStood,
    targetScore: next.targetScore,
    baseTargetScore: next.baseTargetScore,
    roundModifiers: {
        damageAdjustments: { ...next.roundModifiers.damageAdjustments },
        damageImmunity: { ...next.roundModifiers.damageImmunity },
        targetScoreOverride: next.roundModifiers.targetScoreOverride,
        loserDamageBonus: next.roundModifiers.loserDamageBonus,
    },
});

export const withRunState = (state: GameState, mutator: (run: RunState) => RunState): GameState => {
    const current = extractRunState(state);
    const next = mutator(current);
    return writeRunState(state, next);
};

export const withBattleState = (state: GameState, mutator: (battle: BattleState) => BattleState): GameState => {
    const current = extractBattleState(state);
    const next = mutator(current);
    return writeBattleState(state, next);
};

export const withRoundState = (state: GameState, mutator: (round: RoundState) => RoundState): GameState => {
    const current = extractRoundState(state);
    const next = mutator(current);
    return writeRoundState(state, next);
};

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
