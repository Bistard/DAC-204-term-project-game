
import React from 'react';
import { GamePhase } from '../common/types';
import { useGame } from '../context/GameContext';
import { MenuScreen } from './screens/MenuScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { RewardScreen } from './screens/RewardScreen';
import { Battlefield } from './screens/BattleScreen';

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
