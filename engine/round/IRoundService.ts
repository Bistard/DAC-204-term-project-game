import { GameState, HandAction, TurnOwner } from '../../common/types';

export interface DrawCardOptions {
    faceDown?: boolean;
    shiftTurn?: boolean;
    preserveStandState?: boolean;
}

export interface RevealCardOptions {
    shiftTurn?: boolean;
}

export interface IRoundService {
    startRound(): Promise<void>;
    resolveRound(): Promise<void> | void;
    emitHandAction(actor: TurnOwner, action: HandAction, duration: number): void;
    setDealing(value: boolean): void;
    drawCard(actor: TurnOwner, options?: DrawCardOptions): Promise<{ cardId: string } | null>;
    revealCard(actor: TurnOwner, cardId: string, options?: RevealCardOptions): void;
    updateRoundDamageAdjustments(targets: TurnOwner[], delta: number, description: string): void;
    resolveRoundDamage(target: TurnOwner, baseAmount: number): number;
    applyDamage(target: TurnOwner, amount: number): number;
    clearRoundModifiers(reason: string, resetTargetScore: boolean): void;
    heal(actor: TurnOwner, amount: number): number;
    addShield(targets: TurnOwner[], amount: number): void;
    enableDamageImmunity(targets: TurnOwner[]): void;
    drawOptimalCard(actor: TurnOwner): Promise<void>;
    drawCardWithValue(actor: TurnOwner, value: number): Promise<void>;
    swapLastCards(): void;
    undoLastDraw(target: TurnOwner): void;
    replaceLastCard(target: TurnOwner): void;
    grantRandomItems(targets: TurnOwner[], amount: number): void;
    setTemporaryTargetScore(value: number): void;
    queueLoserDamageBonus(amount: number): void;
    setRoundMessage(message: string, meta?: { tag?: string; description?: string; payload?: Record<string, unknown> }): void;
    getState(): GameState;
}
