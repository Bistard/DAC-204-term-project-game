
import React from 'react';
import { Globe } from 'lucide-react';
import { EnvironmentCard } from '../types';

interface Props {
  card: EnvironmentCard;
  className?: string;
  style?: React.CSSProperties;
}

export const EnvironmentCardDisplay: React.FC<Props> = ({ card, className = '', style }) => {
  return (
    <div 
        className={`group relative cursor-help ${className}`}
        style={style}
    >
        {/* Card Body - Wanted Poster Theme */}
        <div className="w-20 h-28 sm:w-24 sm:h-32 bg-[#e3dac9] border-4 border-[#3e2723] rounded-sm pixel-corners flex flex-col items-center justify-between p-1 shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.7)] group-hover:scale-105 transition-transform overflow-hidden">
            
            {/* Top "WANTED" or Title Section */}
            <div className="w-full border-b-2 border-[#3e2723] pb-1 mb-1">
                 <p className="text-[10px] sm:text-[10px] text-center font-bold text-[#3e2723] western-font uppercase tracking-widest leading-none">
                     WARNING
                 </p>
            </div>

            {/* Icon Section */}
            <div className="flex-1 flex items-center justify-center relative z-10 w-full bg-[#d7ccc8] border-2 border-[#5d4037]">
                <Globe className="w-8 h-8 text-[#3e2723] opacity-80" />
            </div>

            {/* Name Footer */}
            <div className="w-full pt-1 flex items-center justify-center min-h-[1.5rem]">
                <p className="text-[10px] sm:text-xs text-center leading-tight text-[#3e2723] font-bold uppercase line-clamp-2 western-font">
                    {card.name}
                </p>
            </div>
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-[#f3e5ab] border-4 border-[#3e2723] p-4 rounded-md pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] text-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2">
            <div className="border-b-2 border-[#3e2723] pb-2">
                <p className="text-xl font-bold uppercase text-[#8b0000] western-font tracking-widest">{card.name}</p>
            </div>
            <p className="text-lg text-[#3e2723] leading-relaxed font-serif font-bold">{card.description}</p>
            
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#3e2723]"></div>
        </div>
    </div>
  );
};
