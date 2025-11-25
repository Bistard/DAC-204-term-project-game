import React from 'react';
import { Skull } from 'lucide-react';
import { PenaltyCard, PenaltyRuntimeState } from '../common/types';

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
  let leader: 'PLAYER' | 'ENEMY' | null = null;

  if (runtime) {
      if (runtime.consecutiveWins.PLAYER > 1) {
          streak = runtime.consecutiveWins.PLAYER;
          leader = 'PLAYER';
      } else if (runtime.consecutiveWins.ENEMY > 1) {
          streak = runtime.consecutiveWins.ENEMY;
          leader = 'ENEMY';
      }
  }

  return (
    <div
        className={`group relative cursor-help ${className} ${isAnimating ? 'animate-danger-pulse scale-110' : ''}`}
        style={style}
    >
        {/* Card Body - Wanted Poster / Decree Theme (Darker/Red) */}
        <div className="w-24 h-32 sm:w-28 sm:h-36 bg-[#2a1a1a] border-4 border-[#7f1d1d] rounded-sm pixel-corners flex flex-col items-center justify-between p-1 shadow-[0_4px_8px_rgba(0,0,0,0.8)] group-hover:shadow-[0_8px_16px_rgba(127,29,29,0.4)] group-hover:scale-105 transition-transform overflow-hidden">

            {/* Top Title Section */}
            <div className="w-full border-b-2 border-[#7f1d1d] pb-1 mb-1 bg-[#450a0a]">
                 <p className="text-[10px] sm:text-[10px] text-center font-bold text-[#fecaca] western-font uppercase tracking-widest leading-none">
                     PENALTY
                 </p>
            </div>

            {/* Icon Section */}
            <div className="flex-1 flex items-center justify-center relative z-10 w-full bg-[#1a0505] border-2 border-[#450a0a]">
                <Skull className={`w-10 h-10 text-[#7f1d1d] ${isAnimating ? 'animate-shake' : ''}`} />
            </div>

            {/* Streak Badge (if applicable) */}
            {streak > 0 && (
                <div className="absolute top-8 right-1 z-20 bg-amber-500 text-black font-bold text-xs px-1 rounded pixel-corners border border-amber-700 shadow-md animate-bounce">
                    x{streak}
                </div>
            )}

            {/* Name Footer */}
            <div className="w-full pt-1 flex items-center justify-center min-h-[1.75rem] bg-[#450a0a] border-t-2 border-[#7f1d1d]">
                <p className="text-[10px] sm:text-xs text-center leading-tight text-[#fecaca] font-bold uppercase line-clamp-2 western-font px-1">
                    {card.name}
                </p>
            </div>
        </div>

        {/* Tooltip */}
        <div className="absolute top-0 left-full ml-4 w-64 bg-[#2a1a1a] border-4 border-[#7f1d1d] p-4 rounded-md pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] text-center shadow-[0_10px_30px_rgba(0,0,0,1)] flex flex-col gap-2">
            <div className="border-b-2 border-[#7f1d1d] pb-2">
                <p className="text-xl font-bold uppercase text-red-500 western-font tracking-widest">{card.name}</p>
            </div>
            <p className="text-lg text-[#fecaca] leading-relaxed font-serif">{card.description}</p>
            {streak > 0 && (
                 <div className="mt-2 text-amber-400 font-bold border-t border-red-900 pt-2">
                     Current Streak: {leader} ({streak})
                 </div>
            )}
            
            {/* Arrow */}
            <div className="absolute top-8 right-full w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-[#7f1d1d]"></div>
        </div>
    </div>
  );
};