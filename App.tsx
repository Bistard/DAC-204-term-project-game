import React from 'react';
import { GameProvider } from './context/GameContext';
import { GameLayout } from './components/GameLayout';

const App: React.FC = () => {
    return (
        <GameProvider>
            <GameLayout />
        </GameProvider>
    );
};

export default App;
