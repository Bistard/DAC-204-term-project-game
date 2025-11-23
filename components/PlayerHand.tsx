
import React, { useEffect, useState } from 'react';

export type HandAction = 'IDLE' | 'HIT' | 'STAND' | 'USE' | 'HURT' | 'LEAVE';

interface PlayerHandProps {
  action: HandAction;
  className?: string;
  side?: 'PLAYER' | 'ENEMY';
}

export const PlayerHand: React.FC<PlayerHandProps> = ({ action, className = '', side = 'PLAYER' }) => {
  const [animClass, setAnimClass] = useState('anim-hand-idle');
  const isEnemy = side === 'ENEMY';

  useEffect(() => {
    switch (action) {
      case 'HIT':
        setAnimClass(isEnemy ? 'anim-hand-hit-enemy' : 'anim-hand-hit');
        break;
      case 'STAND':
        setAnimClass('anim-hand-stand');
        break;
      case 'USE':
        setAnimClass('anim-hand-use');
        break;
      case 'HURT':
        setAnimClass('anim-hand-hurt');
        break;
      case 'LEAVE':
        setAnimClass(isEnemy ? 'anim-hand-leave-enemy' : 'anim-hand-leave');
        break;
      default:
        setAnimClass('anim-hand-idle');
        break;
    }
  }, [action, isEnemy]);

  // Pixel Art Hand Colors - WESTERN THEME
  // Player: Cowboy (Tan skin, Brown Leather Jacket, White Cuff)
  // Enemy: Gambler (Pale skin, Black Suit, Red Undershirt)
  const colors = isEnemy ? {
      outline: "#0f0f0f",
      skinBase: "#e0c0a8", // Pale
      skinShadow: "#a68a76",
      skinLight: "#f5decb",
      skinHighlight: "#fff5eb",
      sleeve: "#1a1a1a", // Black Suit
      sleeveShadow: "#000000"
  } : {
      outline: "#2e1a0f",
      skinBase: "#dca87e", // Tan
      skinShadow: "#a87652",
      skinLight: "#f4cba6",
      skinHighlight: "#ffe4c9",
      sleeve: "#5d4037", // Brown Leather
      sleeveShadow: "#3e2723"
  };

  return (
    <div className={`pointer-events-none select-none z-[60] ${className}`}>
      <div className={`w-full h-full ${animClass} origin-bottom`}>
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" className="w-full h-full drop-shadow-2xl">
           
           {/* --- FOREARM --- */}
           {/* Skin part */}
           <rect x="12" y="26" width="9" height="3" fill={colors.skinBase} />
           <rect x="11" y="26" width="1" height="3" fill={colors.outline} />
           <rect x="21" y="26" width="1" height="3" fill={colors.outline} />
           <rect x="13" y="26" width="2" height="3" fill={colors.skinShadow} opacity="0.3" />
           <rect x="18" y="26" width="2" height="3" fill={colors.skinShadow} opacity="0.3" />

           {/* Wristband/Sleeve part (Bottom 3px) */}
           <rect x="12" y="29" width="9" height="3" fill={colors.sleeve} />
           <rect x="11" y="29" width="1" height="3" fill={colors.outline} />
           <rect x="21" y="29" width="1" height="3" fill={colors.outline} />
           {/* Band shading */}
           <rect x="12" y="29" width="2" height="3" fill={colors.sleeveShadow} opacity="0.5" />
           <rect x="19" y="29" width="2" height="3" fill={colors.sleeveShadow} opacity="0.5" />


           {/* --- PALM / BACK OF HAND --- */}
           <rect x="11" y="17" width="11" height="10" fill={colors.skinLight} />
           <rect x="10" y="19" width="1" height="7" fill={colors.outline} /> 
           <rect x="22" y="18" width="1" height="8" fill={colors.outline} /> 
           
           {/* Knuckles / Metacarpals shading */}
           <rect x="12" y="18" width="1" height="3" fill={colors.skinShadow} opacity="0.5" />
           <rect x="15" y="17" width="1" height="3" fill={colors.skinShadow} opacity="0.5" />
           <rect x="18" y="18" width="1" height="3" fill={colors.skinShadow} opacity="0.5" />
           <rect x="21" y="19" width="1" height="2" fill={colors.skinShadow} opacity="0.5" />

           {/* --- THUMB (Left) --- */}
           {/* Joint connection */}
           <rect x="8" y="19" width="3" height="4" fill={colors.skinBase} />
           <rect x="8" y="19" width="1" height="1" fill={colors.outline} /> 
           <rect x="7" y="20" width="1" height="3" fill={colors.outline} />
           
           {/* Thumb Tip */}
           <rect x="6" y="15" width="3" height="5" fill={colors.skinLight} />
           <rect x="6" y="14" width="2" height="1" fill={colors.outline} />
           <rect x="5" y="15" width="1" height="4" fill={colors.outline} />
           <rect x="9" y="15" width="1" height="4" fill={colors.outline} />
           
           {/* Highlight */}
           <rect x="7" y="15" width="1" height="3" fill={colors.skinHighlight} />
           
           {/* --- INDEX FINGER --- */}
           {/* Base x=12 */}
           <rect x="12" y="5" width="2" height="12" fill={colors.skinLight} />
           <rect x="11" y="6" width="1" height="11" fill={colors.outline} />
           <rect x="14" y="6" width="1" height="12" fill={colors.outline} />
           <rect x="12" y="5" width="2" height="1" fill={colors.outline} />
           {/* Details */}
           <rect x="12" y="6" width="1" height="10" fill={colors.skinHighlight} />
           <rect x="12" y="10" width="2" height="1" fill={colors.skinShadow} opacity="0.4" /> 

           {/* --- MIDDLE FINGER --- */}
           {/* Base x=15 */}
           <rect x="15" y="3" width="2" height="14" fill={colors.skinLight} />
           <rect x="14" y="4" width="1" height="13" fill={colors.outline} />
           <rect x="17" y="4" width="1" height="13" fill={colors.outline} />
           <rect x="15" y="3" width="2" height="1" fill={colors.outline} />
           {/* Details */}
           <rect x="15" y="4" width="1" height="12" fill={colors.skinHighlight} />
           <rect x="15" y="9" width="2" height="1" fill={colors.skinShadow} opacity="0.4" />

           {/* --- RING FINGER --- */}
           {/* Base x=18 */}
           <rect x="18" y="5" width="2" height="12" fill={colors.skinLight} />
           <rect x="17" y="6" width="1" height="11" fill={colors.outline} />
           <rect x="20" y="6" width="1" height="11" fill={colors.outline} />
           <rect x="18" y="5" width="2" height="1" fill={colors.outline} />
           {/* Details */}
           <rect x="18" y="6" width="1" height="10" fill={colors.skinHighlight} />
           <rect x="18" y="10" width="2" height="1" fill={colors.skinShadow} opacity="0.4" />

           {/* --- PINKY --- */}
           {/* Base x=21 */}
           <rect x="21" y="8" width="2" height="10" fill={colors.skinLight} />
           <rect x="20" y="9" width="1" height="9" fill={colors.outline} />
           <rect x="23" y="9" width="1" height="9" fill={colors.outline} />
           <rect x="21" y="8" width="2" height="1" fill={colors.outline} />
           {/* Details */}
           <rect x="21" y="9" width="1" height="8" fill={colors.skinHighlight} />
           <rect x="21" y="12" width="2" height="1" fill={colors.skinShadow} opacity="0.4" />

        </svg>
      </div>
    </div>
  );
};
