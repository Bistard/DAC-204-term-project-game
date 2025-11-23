
import React from 'react';
import { Card, Suit } from '../types';

interface CardProps {
  card: Card;
  className?: string;
}

export const CardComponent: React.FC<CardProps> = ({ card, className = '' }) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;
  
  // Stronger shadow for better separation against dark background and other cards
  const cardStyles = "shadow-[0_10px_20px_rgba(0,0,0,0.6)]";

  return (
    <div className={`w-24 h-36 sm:w-32 sm:h-48 perspective-1000 ${className}`}>
      <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${card.isFaceUp ? 'rotate-y-0' : 'rotate-y-180'}`}>
        
        {/* Front Face - Parchment Style */}
        <div className={`absolute inset-0 w-full h-full backface-hidden bg-[#e3dac9] border-2 border-[#8d6e63] rounded-sm flex flex-col justify-between p-2 pixel-corners select-none ${cardStyles}`}>
          {/* Subtle paper grain texture overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>

          <div className={`text-3xl font-bold leading-none z-10 ${isRed ? 'text-[#8b0000]' : 'text-[#212121]'} western-font`}>
            {card.rank}
            <span className="block text-lg">{card.suit}</span>
          </div>
          
          <div className={`absolute inset-0 flex items-center justify-center text-6xl opacity-10 ${isRed ? 'text-[#8b0000]' : 'text-[#212121]'}`}>
            {card.suit}
          </div>

          <div className={`text-3xl font-bold leading-none self-end rotate-180 z-10 ${isRed ? 'text-[#8b0000]' : 'text-[#212121]'} western-font`}>
            {card.rank}
            <span className="block text-lg">{card.suit}</span>
          </div>
        </div>

        {/* Back Face - Western Pattern */}
        <div className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-[#3e2723] border-4 border-[#e3dac9] rounded-sm flex items-center justify-center pixel-corners ${cardStyles}`}>
            <div className="w-full h-full border-2 border-[#3e2723] bg-[repeating-linear-gradient(45deg,#5d4037,#5d4037_10px,#3e2723_10px,#3e2723_20px)] opacity-80 flex items-center justify-center">
                 <div className="w-12 h-12 border-2 border-[#e3dac9] rotate-45 bg-[#3e2723]"></div>
            </div>
        </div>

      </div>
    </div>
  );
};
