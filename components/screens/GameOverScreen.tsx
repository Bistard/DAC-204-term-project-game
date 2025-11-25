import React from 'react';
import { Skull, RotateCcw, Coins } from 'lucide-react';
import { Button } from '../ui/Button';
import { GamePhase } from '../../common/types';
import { useGame } from '../../context/GameContext';

export const GameOverScreen: React.FC = () => {
    const { gameState, metaState, setGameState } = useGame();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#271c19] text-[#f3e5ab] p-4 text-center border-[20px] border-[#3e2723]">
            <Skull className="w-32 h-32 text-[#a1887f] mb-6 animate-bounce" />
            <h2 className="text-7xl sm:text-9xl font-bold mb-4 western-font text-[#8d6e63]">BUSTED</h2>
            <p className="text-4xl mb-8 font-serif">You made it to Level {gameState.runLevel}</p>
            <div className="mb-12 bg-black/30 p-4 rounded pixel-corners border border-[#5d4037] flex items-center gap-3 text-2xl text-amber-500">
                <Coins className="w-8 h-8" /> Winnings: {metaState.gold}
            </div>
            <Button
                onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.MENU }))}
                variant="secondary"
                className="text-3xl py-4 px-8 western-font"
            >
                <RotateCcw className="inline-block mr-3 w-6 h-6" /> RETURN TO TOWN
            </Button>
        </div>
    );
};
