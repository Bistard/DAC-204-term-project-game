
import React from 'react';

interface HealthBarProps {
  current: number;
  max: number;
  shield?: number;
  label: string;
}

export const HealthBar: React.FC<HealthBarProps> = ({ current, max, shield = 0, label }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const isLow = current > 0 && current <= max / 2;
  
  return (
    <div className="w-full max-w-[240px]">
      <div className="flex justify-between text-xl mb-1 uppercase tracking-wider font-bold western-font drop-shadow-md">
        <span className={`transition-colors duration-300 ${isLow ? 'text-red-400 animate-pulse' : 'text-[#f3e5ab]'}`}>
            {label}
        </span>
        <span className="text-[#f3e5ab]">
            {current}/{max} 
            {shield > 0 && <span className="text-stone-400 ml-1">({shield})</span>}
        </span>
      </div>
      <div className={`h-6 bg-[#271c19] border-2 pixel-corners relative transition-colors duration-300 box-content ${isLow ? 'border-red-800 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'border-[#8d6e63]'}`}>
        <div 
          className={`h-full transition-all duration-300 border-r-2 border-black/30 ${isLow ? 'animate-danger-pulse' : 'bg-red-700'}`} 
          style={{ width: `${percentage}%` }}
        ></div>
        {shield > 0 && (
            <div className="absolute top-0 left-0 h-full border-2 border-stone-400 w-full opacity-30 animate-pulse bg-stone-500/20"></div>
        )}
      </div>
    </div>
  );
};
