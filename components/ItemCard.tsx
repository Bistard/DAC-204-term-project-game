
import React from 'react';
import { Item } from '../types';
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
  
  // Shadow for depth
  const shadowClass = "shadow-[0_8px_0_rgba(0,0,0,0.4)]";

  if (isHidden) {
      return (
        <div 
            style={style}
            className={`
                relative w-32 h-48 sm:w-36 sm:h-52 shrink-0
                bg-[#3e2723] border-4 border-[#271c19]
                flex items-center justify-center
                pixel-corners text-center select-none
                ${shadowClass} ${className}
            `}
        >
            <div className="absolute inset-2 border-2 border-dashed border-[#5d4037] opacity-30"></div>
            <Lock className="w-10 h-10 text-[#8d6e63] relative z-10" />
        </div>
      );
  }

  return (
    <div 
        className={`
            relative group
            w-32 h-48 sm:w-36 sm:h-52 shrink-0
            transition-transform duration-200
            ${!disabled ? 'hover:-translate-y-2 hover:z-50' : ''}
            ${className}
        `}
        style={style}
    >
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full h-full
                bg-wood
                flex flex-col items-stretch justify-start p-0
                pixel-corners transition-colors duration-200
                text-center select-none overflow-hidden
                ${shadowClass}
                ${!disabled ? 'hover:brightness-110 cursor-pointer' : 'opacity-80 cursor-not-allowed grayscale-[0.5]'}
            `}
        >
            {/* 1. Title on Top - Wooden Sign */}
            <div className="w-full bg-[#271c19] border-b-4 border-[#3e2723] h-12 flex items-center justify-center px-1 z-10 relative shrink-0">
                <h4 className="text-[#f3e5ab] western-font font-bold text-sm sm:text-base leading-tight uppercase line-clamp-2 drop-shadow-md">
                    {item.name}
                </h4>
            </div>

            {/* 2. Image Placeholder (Main Body) */}
            <div className="relative flex-1 w-full bg-[#5d4037] flex items-center justify-center overflow-hidden">
                
                {/* Background Pattern - Canvas/Burlap */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:4px_4px]"></div>
                
                {/* Placeholder Icon - Golden/Brass Look */}
                <div className="relative z-0 transform group-hover:scale-110 transition-transform duration-300">
                     <div className="bg-[#3e2723] p-3 rounded-full border-4 border-[#8d6e63] shadow-lg">
                        <Box className="w-8 h-8 text-[#ffca28]" />
                     </div>
                </div>
            </div>
        </button>

        {/* 3. External Tooltip (Hover) - Old Paper Look */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-[#f3e5ab] border-4 border-[#3e2723] p-3 rounded pixel-corners opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[200] shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center">
             <p className="text-[#3e2723] text-sm leading-snug font-serif font-bold text-center w-full">
                {item.description}
            </p>
            
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#3e2723]"></div>
        </div>
    </div>
  );
};
