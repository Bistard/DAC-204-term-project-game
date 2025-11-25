
import React from 'react';
import { GamePhase } from '../common/types';
import { useGame } from '../context/GameContext';
import { MenuScreen } from './gameLayout/MenuScreen';
import { GameOverScreen } from './gameLayout/GameOverScreen';
import { VictoryScreen } from './gameLayout/VictoryScreen';
import { RewardScreen } from './gameLayout/RewardScreen';
import { Battlefield } from './gameLayout/Battlefield';

export const GameLayout: React.FC = () => {
    const { gameState } = useGame();

    switch (gameState.phase) {
        case GamePhase.MENU:
            return <MenuScreen />;
        case GamePhase.GAME_OVER:
            return <GameOverScreen />;
        case GamePhase.VICTORY:
            return <VictoryScreen />;
        case GamePhase.REWARD:
            return <RewardScreen />;
        default:
            return <Battlefield />;
    }
};
