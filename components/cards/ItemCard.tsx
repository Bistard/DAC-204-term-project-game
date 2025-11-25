
import React from 'react';
import { Item } from '../../common/types';
import { Box, Lock } from 'lucide-react';

interface ItemCardProps {
  item: Item;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  isHidden?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, disabled, style, className = '', isHidden = false }) => {
  // Styles for the card container
  const baseCardStyle = "w-32 h-48 sm:w-36 sm:h-52 shrink-0 pixel-corners flex flex-col relative transition-all duration-300";
  const shadowStyle = "shadow-[0_6px_0_rgba(0,0,0,0.4)] hover:shadow-[0_10px_0_rgba(0,0,0,0.3)]";
  
  if (isHidden) {
      return (
        <div 
            style={style}
            className={`${baseCardStyle} bg-[#2c1810] border-4 border-[#3e2723] items-center justify-center ${className} opacity-80`}
        >
             {/* Cross hatching pattern for hidden */}
            <div className="absolute inset-2 border-2 border-dashed border-[#5d4037] opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[length:20px_20px]"></div>
            <Lock className="w-12 h-12 text-[#5d4037]" />
            <div className="mt-2 text-[#5d4037] font-bold western-font tracking-widest text-sm">LOCKED</div>
        </div>
      );
  }

  return (
    <div 
        className={`group relative ${className}`}
        style={style}
    >
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`
                ${baseCardStyle}
                bg-[#e3dac9] border-4 border-[#5d4037]
                text-center select-none overflow-hidden
                ${shadowStyle}
                ${!disabled ? 'hover:-translate-y-2 hover:brightness-105 cursor-pointer' : 'opacity-60 cursor-not-allowed grayscale-[0.8]'}
            `}
        >
            {/* 1. Header - Name Plate */}
            <div className="w-full bg-[#3e2723] h-10 flex items-center justify-center px-2 z-10 border-b-2 border-[#8d6e63]">
                <h4 className="text-[#f3e5ab] western-font font-bold text-xs sm:text-sm leading-tight uppercase tracking-wide line-clamp-2">
                    {item.name}
                </h4>
            </div>

            {/* 2. Image Area - "The Item" */}
            <div className="flex-1 w-full bg-[#cbbfa8] relative flex items-center justify-center overflow-hidden p-4">
                 {/* Radial gradient background for item spotlight */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,rgba(0,0,0,0.1)_100%)]"></div>
                
                {/* Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIi8+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiLz4KPC9zdmc+')]"></div>

                {/* Icon Container */}
                <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300">
                    <div className="bg-[#5d4037] p-3 rounded-md border-2 border-[#8d6e63] shadow-[0_4px_8px_rgba(0,0,0,0.4)] rotate-3 group-hover:rotate-0 transition-all">
                        <Box className="w-8 h-8 text-[#ffb74d] drop-shadow-sm" />
                    </div>
                </div>
            </div>

            {/* 3. Footer / Type Indicator */}
            <div className="w-full bg-[#5d4037] h-6 flex items-center justify-center border-t-2 border-[#8d6e63] z-10">
                 <span className="text-[10px] text-[#a1887f] uppercase tracking-widest font-bold">Consumable</span>
            </div>

        </button>

        {/* 4. Tooltip - Paper Scroll Style */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-52 bg-[#f3e5ab] text-[#3e2723] p-4 pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col items-center border-2 border-[#5d4037]">
            {/* Paper Texture Overlay */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>
            <p className="relative z-10 text-sm leading-snug font-serif font-bold text-center">
                {item.description}
            </p>
            {/* Triangle Pointer */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-[#5d4037]"></div>
        </div>
    </div>
  );
};
