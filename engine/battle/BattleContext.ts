import { Card, Enemy, EnvironmentCard, PenaltyCard } from '../../common/types';

export interface BattleContext {
    runLevel: number;
    deck: Card[];
    environment: EnvironmentCard[];
    penalty: PenaltyCard | null;
    enemy: Enemy;
    playerHp: number;
    playerMaxHp: number;
    message: string;
}
