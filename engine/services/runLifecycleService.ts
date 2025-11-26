import { TARGET_SCORE } from '../../common/constants';
import { GamePhase, GameState, MetaState } from '../../common/types';
import {
    attachLegacyState,
    createDefaultPenaltyRuntime,
    createInitialGameState,
    createInitialRoundState,
    createPlayerBattleState,
} from '../state/gameState';
import {
    applyEnvironmentRulesToBattle,
    createDeck,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomPenaltyCard,
} from '../utils';
import { createEmptyEnvironmentRuntime } from '../rules/environmentRuleEngine';

export class RunLifecycleService {
    startNewRun(meta: MetaState): GameState {
        const baseState = createInitialGameState(meta);
        const envCards = getRandomEnvironment(this.getEnvironmentCount(1));
        const penaltyCard = getRandomPenaltyCard();
        const deck = createDeck();
        const enemy = getRandomEnemy(1);

        const battle = applyEnvironmentRulesToBattle({
            targetScore: TARGET_SCORE,
            baseTargetScore: TARGET_SCORE,
            activeEnvironment: envCards,
            environmentRuntime: createEmptyEnvironmentRuntime(),
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            deck,
            discardPile: [],
            environmentDisabledCards: [],
            player: createPlayerBattleState(meta),
            enemy,
        });
        const round = createInitialRoundState(1, Boolean(enemy));

        return attachLegacyState({
            ...baseState,
            phase: GamePhase.BATTLE,
            message: 'Run started!',
            run: {
                level: 1,
                status: 'IN_PROGRESS',
                rewardOptions: [],
                pickedRewardIndices: [],
                goldEarnedThisLevel: 0,
            },
            battle,
            round,
        });
    }

    prepareNextLevel(currentState: GameState, meta: MetaState): GameState {
        const nextLevel = currentState.run.level + 1;
        const envCards = getRandomEnvironment(this.getEnvironmentCount(nextLevel));
        const penaltyCard = getRandomPenaltyCard();
        const deck = createDeck();
        const enemy = getRandomEnemy(nextLevel);

        const battle = applyEnvironmentRulesToBattle({
            targetScore: TARGET_SCORE,
            baseTargetScore: TARGET_SCORE,
            activeEnvironment: envCards,
            environmentRuntime: createEmptyEnvironmentRuntime(),
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            deck,
            discardPile: [],
            environmentDisabledCards: [],
            player: createPlayerBattleState(meta),
            enemy,
        });
        const round = createInitialRoundState(1, Boolean(enemy));

        return attachLegacyState({
            ...currentState,
            phase: GamePhase.BATTLE,
            message: `Level ${nextLevel} Started.`,
            run: {
                ...currentState.run,
                level: nextLevel,
                status: 'IN_PROGRESS',
                rewardOptions: [],
                pickedRewardIndices: [],
                goldEarnedThisLevel: 0,
            },
            battle,
            round,
        });
    }

    private getEnvironmentCount(level: number) {
        if (level <= 1) return 0;
        return Math.min(3, level - 1);
    }
}
