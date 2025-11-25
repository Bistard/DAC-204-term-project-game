import React from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { Button } from '../Button';
import { useGame } from '../../context/GameContext';

export const VictoryScreen: React.FC = () => {
    const { proceedToRewards } = useGame();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center relative overflow-hidden animate-victory-bg-flash">
            <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,#ffd700,#ffd700_10px,transparent_10px,transparent_20px)]"></div>

            <div className="z-10 flex flex-col items-center">
                <Trophy className="w-40 h-40 text-amber-400 mb-6 animate-bounce drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
                <h2 className="text-8xl sm:text-9xl font-black mb-8 text-[#f3e5ab] animate-victory-text-in tracking-tighter drop-shadow-2xl western-font">
                    HAND
                    <br />
                    <span className="text-amber-500">WON</span>
                </h2>

                <div className="animate-fade-in delay-1000 opacity-0 fill-mode-forwards" style={{ animationDelay: '1.5s', animationFillMode: 'forwards' }}>
                    <Button
                        onClick={proceedToRewards}
                        variant="success"
                        className="text-4xl py-4 px-12 western-font shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse"
                    >
                        COLLECT BOUNTY <ArrowRight className="inline-block ml-3 w-8 h-8" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
