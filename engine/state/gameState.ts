import { MAX_INVENTORY_SLOTS, STARTING_HP, TARGET_SCORE } from '../../common/constants';
import {
    BattleState,
    Enemy,
    GamePhase,
    GameSnapshot,
    GameState,
    MetaState,
    PenaltyRuntimeState,
    PlayerBattleState,
    RoundModifierState,
    RoundParticipantState,
    RoundState,
    RunState,
    RuntimeFlags,
    TurnOwner,
} from '../../common/types';
import { cloneEnvironmentRuntime, createEmptyEnvironmentRuntime } from '../rules/environmentRuleEngine';

type GameStateBase = Pick<GameState, 'phase' | 'message' | 'run' | 'battle' | 'round'>;
type LegacyAwareState = GameStateBase & Partial<GameState>;

const legacyFallbackMeta: MetaState = {
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
};

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

const createRoundParticipantState = (
    overrides: Partial<RoundParticipantState> = {}
): RoundParticipantState => ({
    hand: [],
    score: 0,
    stood: false,
    ...overrides,
});

export const createInitialRoundState = (
    roundNumber = 1,
    hasEnemy = true
): RoundState => ({
    number: roundNumber,
    turnOwner: 'PLAYER',
    player: createRoundParticipantState(),
    enemy: hasEnemy ? createRoundParticipantState() : null,
    modifiers: createDefaultRoundModifiers(),
});

export const createInitialRunState = (): RunState => ({
    level: 0,
    status: 'IDLE',
    rewardOptions: [],
    pickedRewardIndices: [],
    goldEarnedThisLevel: 0,
});

export const createPlayerBattleState = (meta: MetaState): PlayerBattleState => {
    const hp = STARTING_HP + meta.upgrades.hpLevel;
    return {
        hp,
        maxHp: hp,
        shield: 0,
        hand: [],
        score: 0,
        inventory: [],
        maxInventory: MAX_INVENTORY_SLOTS,
        deckModifier: 0,
    };
};

export const createInitialGameState = (metaState: MetaState): GameState =>
    attachLegacyState({
        phase: GamePhase.MENU,
        message: 'Welcome to Last Hand',
        run: createInitialRunState(),
        battle: null,
        round: null,
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

const cloneRoundParticipant = (participant: RoundParticipantState): RoundParticipantState => ({
    hand: participant.hand.map(card => ({ ...card })),
    score: participant.score,
    stood: participant.stood,
});

const cloneRoundState = (round: RoundState): RoundState => ({
    number: round.number,
    turnOwner: round.turnOwner,
    player: cloneRoundParticipant(round.player),
    enemy: round.enemy ? cloneRoundParticipant(round.enemy) : null,
    modifiers: {
        damageAdjustments: { ...round.modifiers.damageAdjustments },
        damageImmunity: { ...round.modifiers.damageImmunity },
        targetScoreOverride: round.modifiers.targetScoreOverride,
        loserDamageBonus: round.modifiers.loserDamageBonus,
    },
});

const cloneBattleState = (battle: BattleState): BattleState => ({
    targetScore: battle.targetScore,
    baseTargetScore: battle.baseTargetScore,
    activeEnvironment: [...battle.activeEnvironment],
    environmentRuntime: cloneEnvironmentRuntime(battle.environmentRuntime),
    activePenalty: battle.activePenalty,
    penaltyRuntime: {
        lastWinner: battle.penaltyRuntime.lastWinner,
        consecutiveWins: { ...battle.penaltyRuntime.consecutiveWins },
    },
    deck: battle.deck.map(card => ({ ...card })),
    discardPile: battle.discardPile.map(card => ({ ...card })),
    environmentDisabledCards: battle.environmentDisabledCards.map(card => ({ ...card })),
    player: {
        ...battle.player,
        inventory: battle.player.inventory.map(item => ({ ...item })),
    },
    enemy: battle.enemy
        ? {
              ...battle.enemy,
              inventory: battle.enemy.inventory.map(item => ({ ...item })),
          }
        : null,
});

export const cloneGameState = (state: GameState): GameState =>
    attachLegacyState({
        phase: state.phase,
        message: state.message,
        run: {
            ...state.run,
            rewardOptions: state.run.rewardOptions.map(item => ({ ...item })),
            pickedRewardIndices: [...state.run.pickedRewardIndices],
        },
        battle: state.battle ? cloneBattleState(state.battle) : null,
        round: state.round ? cloneRoundState(state.round) : null,
    });

export const applyEnemyUpdate = (
    state: GameState,
    enemyUpdater: (enemy: Enemy) => Enemy
): GameState => {
    if (!state.battle || !state.battle.enemy) return state;
    return attachLegacyState({
        ...state,
        battle: {
            ...state.battle,
            enemy: enemyUpdater(state.battle.enemy),
        },
    });
};

export const getRunState = (state: GameState): RunState => state.run;

export const withRunState = (state: GameState, updater: (run: RunState) => RunState): GameState => ({
    ...state,
    run: updater(state.run),
});

export const getBattleState = (state: GameState): BattleState | null => state.battle;

export const withBattleState = (
    state: GameState,
    updater: (battle: BattleState) => BattleState
): GameState => {
    if (!state.battle) {
        return state;
    }
    return {
        ...state,
        battle: updater(state.battle),
    };
};

export const getRoundState = (state: GameState): RoundState | null => state.round;

export const withRoundState = (
    state: GameState,
    updater: (round: RoundState) => RoundState
): GameState => {
    if (!state.round) {
        return state;
    }
    return {
        ...state,
        round: updater(state.round),
    };
};

export const syncRoundState = (state: GameState, round: RoundState | null): GameState => ({
    ...state,
    round,
});

const resolvePlayerSource = (input: LegacyAwareState, battle: BattleState | null): PlayerBattleState => {
    if (battle?.player) return battle.player;
    if (input.player) return input.player;
    return createPlayerBattleState(legacyFallbackMeta);
};

const resolveEnemySource = (input: LegacyAwareState, battle: BattleState | null): Enemy | null => {
    if (battle?.enemy) return battle.enemy;
    if (input.enemy) return input.enemy;
    return null;
};

const resolveRoundState = (
    input: LegacyAwareState,
    battle: BattleState | null,
    player: PlayerBattleState,
    enemy: Enemy | null
): RoundState => {
    if (input.round) {
        return input.round;
    }
    const inferredEnemy = enemy
        ? {
              hand: [...enemy.hand],
              score: enemy.score,
              stood: input.enemyStood ?? false,
          }
        : null;
    return {
        number: input.roundCount ?? 0,
        turnOwner: input.turnOwner ?? 'PLAYER',
        player: {
            hand: [...player.hand],
            score: player.score,
            stood: input.playerStood ?? false,
        },
        enemy: inferredEnemy,
        modifiers: input.roundModifiers ?? createDefaultRoundModifiers(),
    };
};

const normalizeBattle = (
    battle: BattleState | null,
    player: PlayerBattleState,
    enemy: Enemy | null,
    round: RoundState
): BattleState | null => {
    if (!battle) return null;
    return {
        ...battle,
        player: {
            ...player,
            hand: round.player.hand,
            score: round.player.score,
        },
        enemy: enemy
            ? {
                  ...enemy,
                  hand: round.enemy?.hand ?? enemy.hand,
                  score: round.enemy?.score ?? enemy.score,
              }
            : null,
    };
};

export const attachLegacyState = (state: LegacyAwareState): GameState => {
    const run = state.run;
    const battleSource = state.battle ?? null;
    const playerSource = resolvePlayerSource(state, battleSource);
    const enemySource = resolveEnemySource(state, battleSource);
    const round = resolveRoundState(state, battleSource, playerSource, enemySource);
    const normalizedBattle = normalizeBattle(battleSource, playerSource, enemySource, round);

    const legacy: Omit<
        GameState,
        'phase' | 'message' | 'run' | 'battle' | 'round'
    > = {
        turnOwner: round.turnOwner,
        playerStood: round.player.stood,
        enemyStood: round.enemy?.stood ?? false,
        targetScore: normalizedBattle?.targetScore ?? state.targetScore ?? TARGET_SCORE,
        baseTargetScore: normalizedBattle?.baseTargetScore ?? state.baseTargetScore ?? TARGET_SCORE,
        roundCount: round.number,
        runLevel: run.level,
        activeEnvironment: normalizedBattle?.activeEnvironment ?? state.activeEnvironment ?? [],
        environmentRuntime:
            normalizedBattle?.environmentRuntime ?? state.environmentRuntime ?? createEmptyEnvironmentRuntime(),
        activePenalty: normalizedBattle?.activePenalty ?? state.activePenalty ?? null,
        player: normalizedBattle?.player ?? playerSource,
        enemy: normalizedBattle?.enemy ?? enemySource,
        deck: normalizedBattle?.deck ?? state.deck ?? [],
        discardPile: normalizedBattle?.discardPile ?? state.discardPile ?? [],
        environmentDisabledCards:
            normalizedBattle?.environmentDisabledCards ?? state.environmentDisabledCards ?? [],
        roundModifiers: round.modifiers ?? createDefaultRoundModifiers(),
        penaltyRuntime:
            normalizedBattle?.penaltyRuntime ?? state.penaltyRuntime ?? createDefaultPenaltyRuntime(),
        rewardOptions: run.rewardOptions,
        pickedRewardIndices: run.pickedRewardIndices,
        goldEarnedThisLevel: run.goldEarnedThisLevel,
    };

    return {
        ...state,
        battle: normalizedBattle,
        round,
        ...legacy,
    } as GameState;
};
