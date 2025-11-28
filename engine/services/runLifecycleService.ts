import { STARTING_HP, TARGET_SCORE } from '../../common/constants';
import { GameMode, GamePhase, GameState, MetaState } from '../../common/types';
import { createDefaultPenaltyRuntime, createDefaultRoundModifiers, createInitialGameState } from '../state/gameState';
import {
    applyEnvironmentRules,
    createDeck,
    getRandomEnemy,
    getRandomEnvironment,
    getRandomPenaltyCard,
} from '../utils';

export class RunLifecycleService {
    startNewRun(meta: MetaState, mode: GameMode): GameState {
        const baseState = createInitialGameState(meta);
        const envCards = getRandomEnvironment(this.getEnvironmentCount(mode, 1));
        const penaltyCard = getRandomPenaltyCard();
        const deck = createDeck();
        const restoredHp = STARTING_HP + meta.upgrades.hpLevel;

        return applyEnvironmentRules({
            ...baseState,
            mode,
            phase: GamePhase.BATTLE,
            runLevel: 1,
            roundCount: 1,
            deck,
            discardPile: [],
            player: {
                ...baseState.player,
                hp: restoredHp,
                maxHp: restoredHp,
                hand: [],
                score: 0,
                shield: 0,
            },
            enemy: getRandomEnemy(1),
            activeEnvironment: envCards,
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            turnOwner: 'PLAYER',
            message: 'Run started!',
        });
    }

    prepareNextLevel(currentState: GameState, meta: MetaState): GameState {
        const nextLevel = currentState.runLevel + 1;
        const envCards = getRandomEnvironment(this.getEnvironmentCount(currentState.mode, nextLevel));
        const penaltyCard = getRandomPenaltyCard();
        const deck = createDeck();
        const restoredHp = STARTING_HP + meta.upgrades.hpLevel;

        return applyEnvironmentRules({
            ...currentState,
            phase: GamePhase.BATTLE,
            runLevel: nextLevel,
            roundCount: 1,
            targetScore: TARGET_SCORE,
            baseTargetScore: TARGET_SCORE,
            deck,
            discardPile: [],
            environmentDisabledCards: [],
            playerStood: false,
            enemyStood: false,
            turnOwner: 'PLAYER',
            mode: currentState.mode,
            player: {
                ...currentState.player,
                hp: restoredHp,
                maxHp: restoredHp,
                hand: [],
                score: 0,
                shield: 0,
            },
            enemy: getRandomEnemy(nextLevel),
            activeEnvironment: envCards,
            activePenalty: penaltyCard,
            penaltyRuntime: createDefaultPenaltyRuntime(),
            roundModifiers: createDefaultRoundModifiers(),
            message: `Level ${nextLevel} Started.`,
        });
    }

    private getEnvironmentCount(mode: GameMode, level: number) {
        if (mode === 'endless') {
            return 3;
        }
        if (level <= 1) return 0;
        return Math.min(3, level - 1);
    }
}
