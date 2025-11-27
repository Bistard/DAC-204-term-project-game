import { HandAction, TurnOwner } from '../../common/types';

export interface DrawCardOptions {
    faceDown?: boolean;
    shiftTurn?: boolean;
    preserveStandState?: boolean;
}

export interface RevealCardOptions {
    shiftTurn?: boolean;
}

export interface IRoundService {
    startRun(): void;
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
}
