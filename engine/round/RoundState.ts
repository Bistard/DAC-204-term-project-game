import { Card, RoundModifierState, TurnOwner } from '../../common/types';

export interface RoundState {
    turnOwner: TurnOwner;
    playerStood: boolean;
    enemyStood: boolean;
    targetScore: number;
    baseTargetScore: number;
    roundModifiers: RoundModifierState;
    playerHand: Card[];
    enemyHand: Card[];
}
