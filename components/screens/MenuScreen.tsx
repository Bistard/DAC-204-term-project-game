
import React, { useMemo, useEffect, useState } from 'react';
import { Play, Briefcase, Coins, Heart, Layers, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useGame } from '../../context/GameContext';
import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    MAX_UPGRADE_HP,
    MAX_UPGRADE_INVENTORY,
} from '../../common/constants';

// Helper for the jittery title text
const JitterTitle: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
    const letters = useMemo(
        () =>
            text.split('').map((char, i) => ({
                char,
                delay: Math.random() * -2,
                duration: 2 + Math.random() * 1,
            })),
        [text],
    );

    return (
        <h1 className="flex justify-center gap-1 sm:gap-4 mb-4 select-none relative z-10 pointer-events-none">
            {letters.map((item, idx) => (
                <span
                    key={idx}
                    className={`inline-block animate-letter-jitter text-7xl sm:text-[9rem] leading-none font-bold transition-colors duration-[3000ms] ${className}`}
                    style={{ 
                        animationDelay: `${item.delay}s`, 
                        animationDuration: `${item.duration}s`,
                        fontFamily: "'VT323', monospace" 
                    }}
                >
                    {item.char === ' ' ? '\u00A0' : item.char}
                </span>
            ))}
        </h1>
    );
};

// --- ATMOSPHERIC COMPONENTS ---

const PixelCloud: React.FC<{ top: string; duration: string; delay: string; scale: number; isNight: boolean }> = ({ top, duration, delay, scale, isNight }) => (
    <div 
        className="absolute animate-cloud-drift opacity-60 pointer-events-none z-0" 
        style={{ 
            top, 
            animationDuration: duration, 
            animationDelay: delay,
            transform: `scale(${scale})` 
        }}
    >
        {/* Pixel Art Cloud Shape using simple divs */}
        <div className={`w-24 h-8 rounded-full transition-colors duration-[3000ms] ${isNight ? 'bg-[#4c1d95]' : 'bg-white'}`}></div>
        <div className={`absolute -top-4 left-4 w-12 h-12 rounded-full transition-colors duration-[3000ms] ${isNight ? 'bg-[#4c1d95]' : 'bg-white'}`}></div>
        <div className={`absolute -top-6 left-10 w-10 h-10 rounded-full transition-colors duration-[3000ms] ${isNight ? 'bg-[#4c1d95]' : 'bg-white'}`}></div>
    </div>
);

const Bird: React.FC<{ top: string; left: string; duration: string; delay: string; scale: number; isNight: boolean }> = ({ top, left, duration, delay, scale, isNight }) => (
    <div 
        className={`absolute pointer-events-none transition-opacity duration-[2000ms] ${isNight ? 'opacity-0' : 'opacity-40'}`}
        style={{ 
            top, 
            left, 
            transform: `scale(${scale})` 
        }}
    >
        <div 
            className="animate-bird-fly text-black" 
            style={{ 
                animationDuration: duration, 
                animationDelay: delay 
            }}
        >
            <svg viewBox="0 0 20 10" fill="currentColor" className="w-8 h-4">
                 <path d="M0 5 Q5 0 10 5 Q15 0 20 5 L20 6 Q15 2 10 6 Q5 2 0 6 Z" />
            </svg>
        </div>
    </div>
);

/**
 * @description CSS-generated pixel-art desert scene with a day/night cycle.
 * Updated with low-frequency animated elements
 */

export const MenuScreen: React.FC = () => {
    const { startRun, buyUpgrade, metaState } = useGame();
    const [showUpgrades, setShowUpgrades] = useState(false);
    const [isNight, setIsNight] = useState(false); // default day

    // Day/Night Cycle Timer (10 seconds per phase)
    useEffect(() => {
        const interval = setInterval(() => {
            setIsNight(prev => !prev);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Generate Stars
    const stars = useMemo(() => {
        return Array.from({ length: 60 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 60}%`, // Mostly upper sky
            left: `${Math.random() * 100}%`,
            size: Math.random() * 2 + 1, // 1-3px
            delay: `${Math.random() * 5}s`,
            duration: `${Math.random() * 3 + 1.5}s`
        }));
    }, []);

    // Generate Birds
    const birds = useMemo(() => {
        return Array.from({ length: 6 }).map((_, i) => ({
            id: i,
            top: `${10 + Math.random() * 30}%`, // 10-40% from top
            left: `${10 + Math.random() * 80}%`, // 10-90% from left
            scale: 0.3 + Math.random() * 0.5,
            delay: `${Math.random() * -10}s`,
            duration: `${4 + Math.random() * 4}s`
        }));
    }, []);

    // Generate Clouds
    const clouds = useMemo(() => {
        return Array.from({ length: 4 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 50}%`, // Upper half
            scale: 0.5 + Math.random(),
            delay: `${Math.random() * -20}s`,
            duration: `${40 + Math.random() * 40}s`
        }));
    }, []);

    // Derived styles for smooth transitions
    const transitionClass = "transition-all duration-[3000ms] ease-in-out";
    
    // Wood grain pattern using repeating linear gradient
    const woodTexture = "repeating-linear-gradient(45deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 2px, transparent 2px, transparent 4px)";

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-['VT323'] bg-[#0c0a16]`}>
            {/* Custom Styles for Twinkle */}
            <style>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.3); box-shadow: 0 0 4px rgba(255,255,255,0.8); }
                }
                .animate-twinkle {
                    animation: twinkle infinite ease-in-out;
                }
            `}</style>
            
            {/* --- SKY LAYERS --- */}
            
            {/* 1a. Day Sky (Base Layer) - Visible when Night layer fades out */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#38bdf8] via-[#818cf8] to-[#fdba74]"></div>

            {/* 1b. Night Sky (Overlay) - Fades opacity */}
            <div className={`absolute inset-0 bg-gradient-to-b from-[#0f0518] to-[#2d1b4e] ${transitionClass} ${isNight ? 'opacity-100' : 'opacity-0'}`}>
                {/* Generated Stars */}
                {stars.map((star) => (
                    <div 
                        key={star.id}
                        className="absolute bg-white rounded-full animate-twinkle"
                        style={{
                            top: star.top,
                            left: star.left,
                            width: `${star.size}px`,
                            height: `${star.size}px`,
                            animationDelay: star.delay,
                            animationDuration: star.duration
                        }}
                    ></div>
                ))}
            </div>

            {/* --- CELESTIAL BODIES --- */}

            {/* 2a. The Moon (White/Grey) - Top Right at Night, Sets Down at Day */}
            <div 
                className={`absolute right-[15%] w-16 h-16 sm:w-24 sm:h-24 bg-[#e2e8f0] shadow-[0_0_40px_rgba(255,255,255,0.2)] ${transitionClass}`}
                style={{ top: isNight ? '10%' : '-20%' }} // Sets upwards/out
            >
                 {/* Pixel corners */}
                 <div className="absolute -top-2 left-2 right-2 h-2 bg-[#e2e8f0]"></div>
                 <div className="absolute -bottom-2 left-2 right-2 h-2 bg-[#e2e8f0]"></div>
                 <div className="absolute top-2 -left-2 bottom-2 w-2 bg-[#e2e8f0]"></div>
                 <div className="absolute top-2 -right-2 bottom-2 w-2 bg-[#e2e8f0]"></div>
                 {/* Craters */}
                 <div className="absolute top-3 right-3 w-2 h-2 bg-[#94a3b8]"></div>
                 <div className="absolute bottom-4 left-4 w-4 h-2 bg-[#94a3b8]"></div>
                 <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#94a3b8] opacity-50"></div>
            </div>

            {/* 2b. The Sun (Yellow/Orange) - Top Left at Day, Sinks Down at Night */}
            <div 
                className={`absolute right-[15%] w-16 h-16 sm:w-24 sm:h-24 bg-[#facc15] shadow-[0_0_60px_rgba(253,186,116,0.8)] animate-pulse-slow ${transitionClass}`}
                style={{ top: isNight ? '120%' : '10%' }} // Rises from bottom
            >
                 {/* Pixel corners */}
                 <div className="absolute -top-2 left-2 right-2 h-2 bg-[#facc15]"></div>
                 <div className="absolute -bottom-2 left-2 right-2 h-2 bg-[#facc15]"></div>
                 <div className="absolute top-2 -left-2 bottom-2 w-2 bg-[#facc15]"></div>
                 <div className="absolute top-2 -right-2 bottom-2 w-2 bg-[#facc15]"></div>
                 {/* Heat details */}
                 <div className="absolute inset-2 bg-[#fbbf24]"></div>
            </div>

            {/* --- ATMOSPHERE (Clouds & Birds) --- */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 {/* Random Clouds */}
                 {clouds.map(cloud => (
                     <PixelCloud 
                        key={cloud.id}
                        top={cloud.top}
                        duration={cloud.duration}
                        delay={cloud.delay}
                        scale={cloud.scale}
                        isNight={isNight}
                     />
                 ))}
                 
                 {/* Random Birds */}
                 {birds.map(bird => (
                     <Bird 
                        key={bird.id}
                        top={bird.top}
                        left={bird.left}
                        duration={bird.duration}
                        delay={bird.delay}
                        scale={bird.scale}
                        isNight={isNight}
                     />
                 ))}
            </div>

            {/* 3. Distant Mountains (Parallax Layer 1) */}
            <div 
                className={`absolute bottom-[20%] left-0 right-0 h-48 ${transitionClass} ${isNight ? 'bg-[#1e1b4b]' : 'bg-[#9a3412]'}`}
                style={{ clipPath: 'polygon(0% 100%, 0% 40%, 15% 70%, 30% 20%, 50% 60%, 70% 30%, 85% 50%, 100% 10%, 100% 100%)' }}
            ></div>

            {/* 4. Closer Dunes/Ground (Parallax Layer 2) */}
            <div className={`absolute bottom-0 left-0 right-0 h-[25%] border-t-4 border-[#271c19] ${transitionClass} ${isNight ? 'bg-[#3e2723]' : 'bg-[#d97706]'}`}>
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4=')]"></div>
                {/* Cacti - Silhouette is always dark/blackish */}
                <div className="absolute bottom-full left-[10%] w-4 h-12 bg-[#271c19]">
                    <div className="absolute bottom-4 -left-3 w-3 h-1 bg-[#271c19]"></div>
                    <div className="absolute bottom-4 -left-3 w-1 h-3 bg-[#271c19]"></div>
                    <div className="absolute bottom-6 -right-3 w-3 h-1 bg-[#271c19]"></div>
                    <div className="absolute bottom-6 -right-3 w-1 h-4 bg-[#271c19]"></div>
                </div>
                <div className="absolute bottom-full right-[20%] w-3 h-8 bg-[#271c19]"></div>
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"></div>
            <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#000_3px)] opacity-10"></div>


            {/* --- MAIN CONTENT --- */}

            <div className="w-full max-w-xl z-20 relative flex flex-col items-center">
                
                {/* Title Section */}
                <div className="mb-4 relative animate-fade-in z-30">
                    {/* Glow behind title depends on time of day */}
                    <div className={`absolute -inset-4 blur-xl rounded-full ${transitionClass} ${isNight ? 'bg-black/40' : 'bg-orange-500/20'}`}></div>
                    
                    <JitterTitle 
                        text="LAST HAND" 
                        className={isNight 
                            ? "text-[#fcd34d] drop-shadow-[4px_4px_0_#3e2723]" 
                            : "text-[#451a03] drop-shadow-[4px_4px_0_#d97706]"}
                    />
                </div>

                {/* HANGING SIGN BOARD */}
                <div className="relative animate-sign-sway origin-top w-full flex flex-col items-center">
                    
                    {/* Chains Holding the Sign */}
                    <div className="absolute -top-32 left-8 sm:left-12 w-1.5 h-36 bg-[#1a110d] z-0"></div>
                    <div className="absolute -top-32 right-8 sm:right-12 w-1.5 h-36 bg-[#1a110d] z-0"></div>
                    
                    {/* The Sign Body */}
                    <div className="relative w-full px-4 sm:px-8">
                        {/* Shadow of the sign */}
                        <div className="absolute inset-0 bg-black/60 translate-y-8 blur-sm rounded-lg transform scale-[0.9]"></div>

                        <div className="relative bg-[#271c19] border-[6px] border-[#3e2723] rounded-sm pixel-corners p-1 shadow-2xl">
                             {/* Inner Wood Face */}
                             <div 
                                className="bg-[#3e2723] p-6 sm:p-8 flex flex-col gap-6 relative border-2 border-[#1a110d]"
                                style={{ backgroundImage: woodTexture }}
                             >
                                {/* Corner Bolts */}
                                <div className="absolute top-2 left-2 w-2 h-2 bg-[#1a110d] shadow-sm"></div>
                                <div className="absolute top-2 right-2 w-2 h-2 bg-[#1a110d] shadow-sm"></div>
                                <div className="absolute bottom-2 left-2 w-2 h-2 bg-[#1a110d] shadow-sm"></div>
                                <div className="absolute bottom-2 right-2 w-2 h-2 bg-[#1a110d] shadow-sm"></div>

                                {/* Header Decoration */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#271c19] px-4 py-1 border-2 border-[#5d4037] shadow-md pixel-corners">
                                    <span className="text-[#a1887f] text-xs font-bold tracking-[0.3em] uppercase western-font">Blackjack</span>
                                </div>

                                {/* --- BUTTONS --- */}
                                <div className="flex flex-col gap-5 w-full relative z-10 pt-2">
                                    {/* Play Button - Light Wood Plank */}
                                    <button 
                                        onClick={startRun}
                                        className="group relative w-full h-20 bg-[#d97706] border-b-8 border-r-8 border-[#92400e] active:border-b-0 active:border-r-0 active:translate-y-2 active:translate-x-2 transition-all pixel-corners shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
                                    >
                                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] opacity-50"></div>
                                        <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#78350f] rounded-full opacity-70"></div>
                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#78350f] rounded-full opacity-70"></div>
                                        <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-[#78350f] rounded-full opacity-70"></div>
                                        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-[#78350f] rounded-full opacity-70"></div>
                                        
                                        <div className="relative flex items-center justify-center gap-4 h-full">
                                            <Play className="fill-[#3e2723] text-[#3e2723] w-8 h-8 group-hover:scale-110 transition-transform" /> 
                                            <span className="text-[#3e2723] text-4xl sm:text-5xl font-black tracking-wide western-font drop-shadow-sm">PLAY</span>
                                        </div>
                                    </button>

                                    {/* Store Button - Dark Leather/Wood */}
                                    <button
                                        onClick={() => setShowUpgrades(true)}
                                        className="group relative w-full h-20 bg-[#2a1d18] border-b-8 border-r-8 border-[#1a110d] active:border-b-0 active:border-r-0 active:translate-y-2 active:translate-x-2 transition-all pixel-corners shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
                                    >
                                        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#000_120%)] opacity-40"></div>
                                        
                                        <div className="relative flex items-center justify-center gap-4 h-full">
                                            <Briefcase className="text-[#a1887f] w-8 h-8 group-hover:text-[#d7ccc8] transition-colors" /> 
                                            <span className="text-[#a1887f] group-hover:text-[#d7ccc8] text-4xl sm:text-5xl font-black tracking-wide western-font transition-colors">STORE</span>
                                        </div>
                                    </button>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Store Modal */}
            {showUpgrades && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowUpgrades(false)}
                >
                    <div
                        className="bg-[#3e2723] border-[6px] border-[#271c19] p-6 sm:p-8 max-w-4xl w-full pixel-corners shadow-[0_0_50px_rgba(0,0,0,1)] relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Bolts */}
                        <div className="absolute top-2 left-2 w-2 h-2 bg-[#1a110d]"></div>
                        <div className="absolute top-2 right-2 w-2 h-2 bg-[#1a110d]"></div>
                        <div className="absolute bottom-2 left-2 w-2 h-2 bg-[#1a110d]"></div>
                        <div className="absolute bottom-2 right-2 w-2 h-2 bg-[#1a110d]"></div>

                        <button
                            onClick={() => setShowUpgrades(false)}
                            className="absolute top-4 right-4 text-[#8d6e63] hover:text-[#f3e5ab] transition-colors bg-black/40 p-1.5 rounded border border-[#5d4037]"
                        >
                            <X size={24} />
                        </button>

                        <div className="text-center mb-8 border-b-4 border-[#271c19] pb-6 bg-[#2a1810] p-4 shadow-inner relative overflow-hidden">
                             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,transparent_50%,#000_150%)]"></div>
                            <h2 className="text-5xl text-[#f3e5ab] font-bold flex items-center justify-center gap-4 mb-2 drop-shadow-md">
                                <Briefcase className="w-10 h-10 text-[#8d6e63]" /> STORE
                            </h2>
                            <div className="flex items-center justify-center gap-2 text-3xl text-amber-400 bg-black/40 py-2 px-8 inline-block pixel-corners border border-[#5d4037] shadow-lg">
                                <Coins className="w-6 h-6" /> <span>{metaState.gold}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* HP Upgrade */}
                            <div className="bg-[#2a1810] p-6 border-4 border-[#1a110d] pixel-corners flex flex-col gap-4 shadow-lg group hover:border-[#5d4037] transition-colors relative">
                                <div className="absolute top-2 right-2 opacity-10"><Heart size={64}/></div>
                                <div className="flex justify-between items-start relative z-10">
                                    <h3 className="text-3xl text-red-400 font-bold flex items-center gap-2">
                                        <Heart className="fill-current" /> Health
                                    </h3>
                                    <span className="text-[#8d6e63] font-mono bg-black/40 px-2 py-0.5 text-lg">
                                        LVL {metaState.upgrades.hpLevel} / {MAX_UPGRADE_HP}
                                    </span>
                                </div>
                                <p className="text-[#d7ccc8] text-xl min-h-[3rem] leading-relaxed opacity-80 relative z-10">
                                    Toughen up, partner. <br/> <span className="text-red-300">+1 Starting HP.</span>
                                </p>

                                {metaState.upgrades.hpLevel < MAX_UPGRADE_HP ? (
                                    <Button
                                        variant="danger"
                                        onClick={() => buyUpgrade('HP')}
                                        disabled={metaState.gold < COST_UPGRADE_HP[metaState.upgrades.hpLevel]}
                                        className="mt-auto flex justify-between items-center px-6 py-3"
                                    >
                                        <span>BUY</span>
                                        <span className="flex items-center gap-1 text-amber-100 bg-black/30 px-2 border border-red-900">
                                            <Coins size={20} className="text-amber-400" /> {COST_UPGRADE_HP[metaState.upgrades.hpLevel]}
                                        </span>
                                    </Button>
                                ) : (
                                    <div className="mt-auto bg-[#1a110d] text-center py-3 text-[#4ade80] font-bold pixel-corners border border-green-900/30 uppercase tracking-widest text-xl">
                                        Max Level
                                    </div>
                                )}
                            </div>

                            {/* Inventory Upgrade */}
                            <div className="bg-[#2a1810] p-6 border-4 border-[#1a110d] pixel-corners flex flex-col gap-4 shadow-lg group hover:border-[#5d4037] transition-colors relative">
                                <div className="absolute top-2 right-2 opacity-10"><Layers size={64}/></div>
                                <div className="flex justify-between items-start relative z-10">
                                    <h3 className="text-3xl text-blue-300 font-bold flex items-center gap-2">
                                        <Layers className="fill-current" /> POCKETS
                                    </h3>
                                    <span className="text-[#8d6e63] font-mono bg-black/40 px-2 py-0.5 text-lg">
                                        LVL {metaState.upgrades.inventoryLevel} / {MAX_UPGRADE_INVENTORY}
                                    </span>
                                </div>
                                <p className="text-[#d7ccc8] text-xl min-h-[3rem] leading-relaxed opacity-80 relative z-10">
                                    More room for tricks. <br/> <span className="text-blue-200">+1 Starting Item.</span>
                                </p>

                                {metaState.upgrades.inventoryLevel < MAX_UPGRADE_INVENTORY ? (
                                    <Button
                                        variant="primary"
                                        onClick={() => buyUpgrade('INVENTORY')}
                                        disabled={metaState.gold < COST_UPGRADE_INVENTORY[metaState.upgrades.inventoryLevel]}
                                        className="mt-auto flex justify-between items-center px-6 py-3"
                                    >
                                        <span>BUY</span>
                                        <span className="flex items-center gap-1 text-amber-100 bg-black/30 px-2 border border-amber-900">
                                            <Coins size={20} className="text-amber-400" /> {COST_UPGRADE_INVENTORY[metaState.upgrades.inventoryLevel]}
                                        </span>
                                    </Button>
                                ) : (
                                    <div className="mt-auto bg-[#1a110d] text-center py-3 text-[#4ade80] font-bold pixel-corners border border-green-900/30 uppercase tracking-widest text-xl">
                                        Max Level
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
