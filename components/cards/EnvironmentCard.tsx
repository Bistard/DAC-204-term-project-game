
import React from 'react';
import { Globe } from 'lucide-react';
import { EnvironmentCard } from '../../common/types';

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
        {/* Card Body - Nailed Note on Wood */}
        <div className="w-24 h-32 sm:w-28 sm:h-36 relative transition-transform group-hover:scale-105 group-hover:-translate-y-1 duration-300">
            
            {/* Wood Backing */}
            <div className="absolute inset-0 bg-[#3e2723] border-r-2 border-b-2 border-black/50 rounded-sm pixel-corners shadow-lg transform rotate-1"></div>

            {/* Paper Note */}
            <div className="absolute inset-1 bg-[#fff8dc] border border-[#d7ccc8] flex flex-col items-center shadow-sm pixel-corners transform -rotate-1 origin-top">
                
                {/* Nail */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#4a4a4a] shadow-sm z-20"></div>

                {/* Header */}
                <div className="w-full mt-3 border-b-2 border-black/80 pb-0.5 mb-1 px-1">
                     <p className="text-[10px] text-center font-black text-black western-font uppercase tracking-widest leading-none">
                         NOTICE
                     </p>
                </div>

                {/* Icon Section */}
                <div className="flex-1 flex flex-col items-center justify-center w-full bg-transparent p-1 relative">
                    <div className="absolute inset-2 border border-black/10"></div>
                    <Globe className="w-8 h-8 text-[#3e2723] opacity-80 mb-1" />
                    
                    {/* Name */}
                    <p className="text-[9px] sm:text-[10px] text-center leading-tight text-[#3e2723] font-serif font-bold uppercase line-clamp-3 px-1">
                        {card.name}
                    </p>
                </div>
            </div>
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-[#f3e5ab] border-4 border-[#3e2723] p-4 rounded-md pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] text-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2">
            <div className="border-b-2 border-[#3e2723] pb-2">
                <p className="text-xl font-bold uppercase text-[#8b0000] western-font tracking-widest">{card.name}</p>
            </div>
            <p className="text-[20px] text-[#3e2723] leading-relaxed font-serif font-bold">{card.description}</p>
            
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#3e2723]"></div>
        </div>
    </div>
  );
};
