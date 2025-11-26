
import React from 'react';
import { Skull } from 'lucide-react';
import { PenaltyCard, PenaltyRuntimeState } from '../../common/types';

interface Props {
  card: PenaltyCard;
  runtime?: PenaltyRuntimeState;
  className?: string;
  style?: React.CSSProperties;
  isAnimating?: boolean; 
}

export const PenaltyCardDisplay: React.FC<Props> = ({ card, runtime, className = '', style, isAnimating }) => {
  // Determine streak info
  let streak = 0;

  if (runtime) {
      if (runtime.consecutiveWins.PLAYER > 1) {
          streak = runtime.consecutiveWins.PLAYER;
      } else if (runtime.consecutiveWins.ENEMY > 1) {
          streak = runtime.consecutiveWins.ENEMY;
      }
  }

  return (
    <div
        className={`group relative cursor-help ${className} ${isAnimating ? 'animate-danger-pulse' : ''}`}
        style={style}
    >
        {/* Card Body - Dark Ominous Warrant */}
        <div className="w-24 h-32 sm:w-28 sm:h-36 bg-[#1a0505] border-4 border-[#450a0a] rounded-sm pixel-corners flex flex-col items-center relative shadow-[0_0_15px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform overflow-hidden">
            
            {/* Background Texture - Blood Stain/Dark */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.2)_0%,rgba(0,0,0,0.8)_100%)]"></div>

            {/* Header */}
            <div className="w-full py-1 bg-[#450a0a] border-b border-[#7f1d1d] z-10 text-center">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#fecaca] font-bold western-font drop-shadow-sm">PENALTY</span>
            </div>

            {/* Icon Area */}
            <div className="flex-1 flex items-center justify-center w-full relative z-10">
                <div className={`relative p-2 border-2 border-[#7f1d1d] rounded-full bg-[#2a0a0a] ${isAnimating ? 'animate-shake' : ''}`}>
                     <Skull className="w-8 h-8 text-[#ef4444]" />
                </div>
                {/* Decorative Chains (CSS borders) */}
                <div className="absolute top-0 left-2 w-px h-8 bg-[#450a0a]"></div>
                <div className="absolute top-0 right-2 w-px h-8 bg-[#450a0a]"></div>
            </div>

            {/* Name Section */}
            <div className="w-full bg-[#2a0a0a] border-t-2 border-[#450a0a] p-1 z-10 min-h-[2.5rem] flex items-center justify-center">
                 <p className="text-[10px] sm:text-xs text-center leading-none text-[#ef4444] font-bold uppercase western-font px-1">
                    {card.name}
                </p>
            </div>

             {/* Streak Badge */}
            {streak > 0 && (
                <div className="absolute top-8 right-0 z-20 bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-l-md shadow-md border border-red-800 animate-bounce">
                    x{streak}
                </div>
            )}
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-60 bg-[#1a0505] border-2 border-[#ef4444] p-4 pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] shadow-[0_0_30px_rgba(220,38,38,0.2)]">
             <h3 className="text-lg font-bold uppercase text-[#ef4444] western-font mb-2 border-b border-[#7f1d1d] pb-1">{card.name}</h3>
             <p className="text-[20px] text-[#fecaca] font-serif leading-relaxed mb-3">{card.description}</p>
             
             {streak > 0 && (
                 <div className="bg-[#2a0a0a] border border-[#7f1d1d] p-2 rounded text-center">
                     <span className="text-[16px] text-amber-500 uppercase font-bold tracking-wider">Winning Streak</span>
                     <div className="text-[16px] text-[#fecaca] font-mono">{streak} Rounds</div>
                 </div>
             )}
        </div>
    </div>
  );
};
