import React from 'react';
import { GameProvider } from './context/GameContext';
import { GameLayout } from './components/gameLayout';
import { DebugConsole } from './components/DebugConsole';

const App: React.FC = () => {
    return (
        <GameProvider>
            <GameLayout />
            <DebugConsole />
        </GameProvider>
    );
};

export default App;
