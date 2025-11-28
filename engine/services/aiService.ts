import { DELAY_XL } from '../../common/constants';
import {
    EnvironmentRuntimeState,
    GameState,
    Item,
    LogicEffectType,
    PenaltyCard,
    PenaltyDamageContext,
    TurnOwner,
} from '../../common/types';
import { GameStore } from '../state/gameStore';
import { calculateScore } from '../utils';
import { CreateMetaFn } from './commonService';

interface AiServiceDeps {
    store: GameStore;
    createMeta: CreateMetaFn;
    onHit: () => Promise<void>;
    onStand: () => void;
    onUseItem: (index: number) => Promise<void>;
}

type EnemyDecision = { type: 'HIT' } | { type: 'STAND' } | { type: 'USE_ITEM'; index: number };

type EnemyEntity = NonNullable<GameState['enemy']>;

interface EnemyAiContext {
    state: GameState;
    enemy: EnemyEntity;
    player: GameState['player'];
    targetScore: number;
    bustValues: number[];
    enemyScore: number;
    playerScore: number;
    enemyBust: boolean;
    playerBust: boolean;
    environment: EnvironmentRuntimeState;
    activePenalty: PenaltyCard | null;
    availableItems: Item[];
    isItemUsageLocked: boolean;
}

interface EnemyAiAssessment {
    bustRisk: number;
    standWinChance: number;
    suddenDeathPressure: number;
    penaltyPressure: number;
    healUrgency: number;
    itemSuggestion: { index: number; score: number } | null;
}

interface RoundOutcome {
    winner: TurnOwner | 'DRAW';
    loser: TurnOwner | null;
    scoreGap: number;
}

export class AiService {
    private aiTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private deps: AiServiceDeps) {}

    queueTurn() {
        this.clearTimer();
        this.deps.store.updateFlags(
            flags => ({ ...flags, isProcessingAI: true }),
            this.deps.createMeta('flag.ai', 'Start AI processing', undefined, { suppressHistory: true })
        );
        const scheduler = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
        this.aiTimer = scheduler(async () => {
            try {
                await this.takeTurn();
            } finally {
                this.deps.store.updateFlags(
                    flags => ({ ...flags, isProcessingAI: false }),
                    this.deps.createMeta('flag.ai', 'AI turn completed', undefined, { suppressHistory: true })
                );
                this.aiTimer = null;
            }
        }, DELAY_XL);
    }

    cancelProcessing() {
        this.clearTimer();
        this.deps.store.updateFlags(
            flags => ({ ...flags, isProcessingAI: false }),
            this.deps.createMeta('flag.ai', 'Stop AI processing', undefined, { suppressHistory: true })
        );
    }

    private async takeTurn() {
        const snapshot = this.deps.store.snapshot;
        const ctx = buildEnemyAiContext(snapshot.state);
        if (!ctx) return;

        const decision = decideAction(ctx);
        if (decision.type === 'HIT') {
            await this.deps.onHit();
            return;
        }
        if (decision.type === 'USE_ITEM') {
            await this.deps.onUseItem(decision.index);
            return;
        }
        this.deps.onStand();
    }

    private clearTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }
}

function decideAction(ctx: EnemyAiContext): EnemyDecision {
    const assessment = assessContext(ctx);
    const enemy = ctx.enemy;

    if (ctx.enemyBust) {
        return { type: 'STAND' };
    }
    if (ctx.playerBust && !ctx.enemyBust) {
        if (assessment.itemSuggestion && assessment.itemSuggestion.score > 0.85) {
            return { type: 'USE_ITEM', index: assessment.itemSuggestion.index };
        }
        return { type: 'STAND' };
    }

    const itemDecision = maybeUseItem(enemy.aiType, assessment);
    if (itemDecision) {
        return itemDecision;
    }

    const aggressionBias = getAggressionBias(enemy.aiType);
    const riskTolerance = clamp(
        0.55 + aggressionBias - assessment.suddenDeathPressure * 0.25,
        0.15,
        0.95
    );
    const needsToCatchUp = !ctx.playerBust && ctx.playerScore >= ctx.enemyScore;
    const adjustedStandValue =
        assessment.standWinChance -
        assessment.bustRisk * 0.25 +
        (ctx.state.playerStood ? 0.08 : -0.07);

    const shouldHit =
        (assessment.bustRisk < riskTolerance && (needsToCatchUp || adjustedStandValue < 0.65)) ||
        (needsToCatchUp && assessment.bustRisk < 0.85 && aggressionBias >= 0) ||
        (!ctx.state.enemyStood && ctx.state.playerStood === false && assessment.standWinChance < 0.45);

    return shouldHit ? { type: 'HIT' } : { type: 'STAND' };
}

function maybeUseItem(aiType: EnemyEntity['aiType'], assessment: EnemyAiAssessment): EnemyDecision | null {
    const suggestion = assessment.itemSuggestion;
    if (!suggestion) return null;
    const baseThreshold = aiType === 'DEFENSIVE' ? 0.35 : aiType === 'GREEDY' ? 0.55 : 0.45;
    if (suggestion.score >= baseThreshold) {
        return { type: 'USE_ITEM', index: suggestion.index };
    }
    return null;
}

function assessContext(ctx: EnemyAiContext): EnemyAiAssessment {
    const roundOutcome = calculateRoundOutcome(ctx);
    const penaltyPressure = estimatePenaltyPressure(ctx, roundOutcome);
    const bustRisk = estimateBustRisk(ctx);
    const standWinChance = estimateStandWinChance(ctx, roundOutcome, penaltyPressure);
    const suddenDeathPressure = estimateSuddenDeathPressure(ctx);
    const healUrgency = calculateHealUrgency(ctx, suddenDeathPressure, penaltyPressure);
    const itemSuggestion = chooseBestItem(ctx, {
        healUrgency,
        bustRisk,
        standWinChance,
        suddenDeathPressure,
    });

    return {
        bustRisk,
        standWinChance,
        suddenDeathPressure,
        penaltyPressure,
        healUrgency,
        itemSuggestion,
    };
}

function buildEnemyAiContext(state: GameState): EnemyAiContext | null {
    const enemy = state.enemy;
    if (!enemy) return null;
    const scoreOptions = state.environmentRuntime.scoreOptions;
    const enemyScore = calculateScore(enemy.hand, state.targetScore, scoreOptions);
    const playerScore = calculateScore(state.player.hand, state.targetScore, scoreOptions);
    const bustValues = scoreOptions.specialBustValues;
    const enemyBust = enemyScore > state.targetScore || bustValues.includes(enemyScore);
    const playerBust = playerScore > state.targetScore || bustValues.includes(playerScore);

    return {
        state,
        enemy,
        player: state.player,
        targetScore: state.targetScore,
        bustValues,
        enemyScore,
        playerScore,
        enemyBust,
        playerBust,
        environment: state.environmentRuntime,
        activePenalty: state.activePenalty,
        availableItems: enemy.inventory,
        isItemUsageLocked: state.environmentRuntime.itemLocks.disableUsage,
    };
}

function estimateBustRisk(ctx: EnemyAiContext): number {
    if (ctx.enemyBust) return 1;
    const distance = Math.max(0, ctx.targetScore - ctx.enemyScore);
    let risk: number;
    if (distance >= 8) risk = 0.05;
    else if (distance >= 6) risk = 0.15;
    else if (distance >= 4) risk = 0.35;
    else if (distance >= 2) risk = 0.65;
    else risk = 0.85;

    const specialDistance = ctx.bustValues
        .map(value => (value > ctx.enemyScore ? value - ctx.enemyScore : Number.POSITIVE_INFINITY))
        .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
    if (specialDistance <= 2) {
        risk = clamp(risk + 0.15, 0, 1);
    }
    if (!Number.isFinite(specialDistance)) {
        return risk;
    }
    return clamp(risk, 0, 1);
}

function calculateRoundOutcome(ctx: EnemyAiContext): RoundOutcome {
    if (ctx.enemyBust && ctx.playerBust) {
        return { winner: 'DRAW', loser: null, scoreGap: 0 };
    }
    if (ctx.enemyBust) {
        return { winner: 'PLAYER', loser: 'ENEMY', scoreGap: ctx.enemyScore - ctx.playerScore };
    }
    if (ctx.playerBust) {
        return { winner: 'ENEMY', loser: 'PLAYER', scoreGap: ctx.enemyScore - ctx.playerScore };
    }
    if (ctx.enemyScore === ctx.playerScore) {
        return { winner: 'DRAW', loser: null, scoreGap: 0 };
    }
    const winner: TurnOwner = ctx.enemyScore > ctx.playerScore ? 'ENEMY' : 'PLAYER';
    const loser: TurnOwner = winner === 'ENEMY' ? 'PLAYER' : 'ENEMY';
    return { winner, loser, scoreGap: ctx.enemyScore - ctx.playerScore };
}

function estimateStandWinChance(
    ctx: EnemyAiContext,
    outcome: RoundOutcome,
    penaltyPressure: number
): number {
    if (ctx.enemyBust) return 0;
    if (ctx.playerBust) return 1;
    let base = 0.5 + clamp(outcome.scoreGap / 20, -0.4, 0.4);
    if (!ctx.state.playerStood) base -= 0.12;
    if (ctx.state.enemyStood) base += 0.05;
    base -= penaltyPressure * 0.5;
    return clamp(base, 0, 1);
}

function estimatePenaltyPressure(ctx: EnemyAiContext, outcome: RoundOutcome): number {
    if (!ctx.activePenalty) return 0;
    try {
        const penaltyContext: PenaltyDamageContext = {
            winner: outcome.winner,
            loser: outcome.loser,
            playerScore: ctx.playerScore,
            enemyScore: ctx.enemyScore,
            playerBust: ctx.playerBust,
            enemyBust: ctx.enemyBust,
            roundNumber: ctx.state.roundCount,
            runtime: ctx.state.penaltyRuntime,
        };
        const result = ctx.activePenalty.damageFunction(penaltyContext);
        const enemyNet = result.enemyDamage - (result.enemyHeal ?? 0);
        const playerNet = result.playerDamage - (result.playerHeal ?? 0);
        const diff = enemyNet - playerNet;
        const normalized = diff / Math.max(ctx.enemy.maxHp, 1);
        return clamp(normalized, 0, 1);
    } catch {
        return 0;
    }
}

function estimateSuddenDeathPressure(ctx: EnemyAiContext): number {
    const threshold = ctx.environment.victoryHooks.suddenDeathThreshold;
    if (typeof threshold !== 'number') return 0;
    const hpDistance = ctx.enemy.hp - threshold;
    if (hpDistance <= 0) return 1;
    const maxWindow = Math.max(ctx.enemy.maxHp * 0.5, 1);
    return clamp(1 - hpDistance / maxWindow, 0, 1);
}

function calculateHealUrgency(
    ctx: EnemyAiContext,
    suddenDeathPressure: number,
    penaltyPressure: number
): number {
    const hpRatio = ctx.enemy.hp / Math.max(ctx.enemy.maxHp, 1);
    let urgency = clamp(1 - hpRatio, 0, 1);
    if (ctx.enemy.shield < ctx.player.shield) {
        urgency += 0.1;
    }
    urgency += suddenDeathPressure * 0.3 + penaltyPressure * 0.2;
    return clamp(urgency, 0, 1);
}

const HEAL_EFFECTS: LogicEffectType[] = ['HEAL', 'LIFE_DRAIN', 'HEAL_PER_INVENTORY'];
const SHIELD_EFFECTS: LogicEffectType[] = ['SHIELD', 'RESOLUTION_DAMAGE_IMMUNITY', 'RESOLUTION_DAMAGE_BUFFER'];
const DRAW_EFFECTS: LogicEffectType[] = [
    'DRAW',
    'DRAW_OPTIMAL',
    'DRAW_VALUE',
    'SWAP_LAST_CARD',
    'UNDO_LAST_DRAW',
    'REPLACE_LAST_CARD',
    'FORCE_DRAW',
];
const OFFENSE_EFFECTS: LogicEffectType[] = [
    'DAMAGE_MULTIPLIER',
    'PENDING_LOSER_DAMAGE',
    'LIFE_DRAIN',
    'FORCE_REVEAL',
];

interface ItemScoringInput {
    healUrgency: number;
    bustRisk: number;
    standWinChance: number;
    suddenDeathPressure: number;
}

function chooseBestItem(
    ctx: EnemyAiContext,
    input: ItemScoringInput
): { index: number; score: number } | null {
    if (ctx.isItemUsageLocked || !ctx.availableItems.length) {
        return null;
    }
    let bestIndex: number | null = null;
    let bestScore = 0;

    ctx.availableItems.forEach((item, index) => {
        const score = scoreItem(item, ctx, input);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    });

    if (bestIndex === null || bestScore <= 0.2) {
        return null;
    }
    return { index: bestIndex, score: clamp(bestScore, 0, 1) };
}

function scoreItem(item: Item, ctx: EnemyAiContext, input: ItemScoringInput): number {
    let score = 0;
    for (const effect of item.effects) {
        if (HEAL_EFFECTS.includes(effect.type)) {
            score += 0.9 * input.healUrgency;
        } else if (SHIELD_EFFECTS.includes(effect.type)) {
            score += 0.5 + input.suddenDeathPressure * 0.4;
        } else if (DRAW_EFFECTS.includes(effect.type)) {
            const distance = Math.max(0, ctx.targetScore - ctx.enemyScore);
            const drawNeed = clamp(distance / 10, 0, 1);
            score += 0.6 * (drawNeed + (1 - input.bustRisk));
        } else if (OFFENSE_EFFECTS.includes(effect.type)) {
            score += clamp(input.standWinChance, 0, 1) * 0.6;
        } else if (effect.type === 'GAIN_RANDOM_ITEMS' || effect.type === 'GOLD') {
            score += 0.2;
        } else if (effect.type === 'SET_TEMP_TARGET_SCORE' || effect.type === 'SET_TARGET_SCORE') {
            const distance = Math.max(0, ctx.targetScore - ctx.enemyScore);
            score += distance <= 2 ? 0.7 : 0.4;
        }
    }
    if (item.effects.length > 1) {
        score += 0.05 * (item.effects.length - 1);
    }
    return clamp(score, 0, 1.2);
}

function getAggressionBias(aiType: EnemyEntity['aiType']): number {
    switch (aiType) {
        case 'GREEDY':
            return 0.2;
        case 'DEFENSIVE':
            return -0.15;
        default:
            return 0;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
