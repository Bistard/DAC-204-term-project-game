
import React, { useState, useMemo, useEffect } from 'react';
import { GamePhase, Card, Suit, Item } from '../types';
import { CardComponent } from './CardComponent';
import { Button } from './Button';
import { HealthBar } from './HealthBar';
import { ItemCard } from './ItemCard';
import { EnvironmentCardDisplay } from './EnvironmentCardDisplay';
import { PlayerHand } from './PlayerHand';
import { useGame } from '../context/GameContext';
import { Trophy, Skull, Zap, Gift, Play, RotateCcw, Heart, ArrowRight, EyeOff, CheckCircle, Layers, Search, X, Swords, Book, Globe, Coins, Briefcase } from 'lucide-react';
import { ITEMS } from '../content/items';
import { ENEMIES } from '../content/enemies';
import { ENVIRONMENT_CARDS } from '../content/environments';
import { VISUAL_WARN_OFFSET, VISUAL_SAFE_OFFSET, VISUAL_EARLY_OFFSET, COST_UPGRADE_HP, COST_UPGRADE_INVENTORY, MAX_UPGRADE_HP, MAX_UPGRADE_INVENTORY, REWARD_PICK_LIMIT } from '../constants';

// --- Helper Styles ---

const getFanStyle = (index: number, total: number, isPlayer: boolean, isHovered: boolean): React.CSSProperties => {
    const center = (total - 1) / 2;
    const offset = index - center;
    const rotate = offset * 6; 
    const x = offset * 50; 
    const y = Math.abs(offset) * 8; 

    return {
        position: 'absolute',
        left: '50%',
        transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${isPlayer ? rotate : -rotate}deg) ${isHovered ? 'scale(1.15) translateY(-20px)' : ''}`,
        transformOrigin: isPlayer ? 'center 120%' : 'center -120%',
        zIndex: isHovered ? 100 : index,
        bottom: isPlayer ? '0px' : 'auto',
        top: isPlayer ? 'auto' : '0px',
        transition: 'transform 0.2s ease-out, z-index 0s'
    };
};

const getScoreStyles = (score: number, target: number) => {
    if (score > target) return "bg-red-950/90 border-red-600 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)]";
    if (score === target) return "bg-gradient-to-r from-amber-800 to-yellow-900 border-yellow-400 text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.5)]";
    if (score === target - VISUAL_WARN_OFFSET) return "bg-purple-950/90 border-purple-400 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.7)] animate-subtle-pulse";
    if (score >= target - VISUAL_SAFE_OFFSET) return "bg-indigo-950/90 border-indigo-400 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]";
    if (score >= target - VISUAL_EARLY_OFFSET) return "bg-[#3e2723]/90 border-stone-500 text-stone-300 shadow-[0_0_10px_rgba(0,0,0,0.4)]";
    return "bg-[#3e2723]/80 border-[#5d4037] text-[#a1887f] shadow-lg";
};

// --- Text Effect Component ---

const JitterText: React.FC<{ text: string }> = ({ text }) => {
    const letters = useMemo(() => {
        return text.split('').map((char) => ({
            char,
            delay: Math.random() * -5,
            duration: 2 + Math.random() * 2
        }));
    }, [text]);

    return (
        <div className="text-[#f3e5ab] text-3xl sm:text-5xl font-black tracking-wider drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)] mb-4 text-center animate-fade-in leading-snug whitespace-nowrap western-font">
            {letters.map((item, idx) => (
                <span 
                    key={idx} 
                    className="inline-block animate-letter-jitter whitespace-pre"
                    style={{ animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s` }}
                >
                    {item.char}
                </span>
            ))}
        </div>
    );
};

const MessageDisplay: React.FC<{ message: string }> = ({ message }) => {
    const [displayMsg, setDisplayMsg] = useState(message);
    const [opacity, setOpacity] = useState(1);

    React.useEffect(() => {
        if (message !== displayMsg) {
            setOpacity(0);
            const timer = setTimeout(() => {
                setDisplayMsg(message);
                setOpacity(1);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [message, displayMsg]);

    return (
        <div className="transition-opacity duration-500 ease-in-out flex flex-col items-center" style={{ opacity }}>
            <JitterText text={displayMsg} />
        </div>
    );
};

const DamageNumbersDisplay = ({ target }: { target: 'PLAYER' | 'ENEMY' }) => {
    const { damageNumbers } = useGame();
    const list = damageNumbers.filter(d => d.target === target);
    
    if (list.length === 0) return null;

    return (
        <div className="absolute top-0 right-0 w-0 h-full overflow-visible flex flex-col items-center justify-center pointer-events-none z-50">
            {list.map(dn => (
                <div 
                    key={dn.id} 
                    className={`absolute top-0 left-full ml-4 z-50 text-5xl sm:text-6xl font-black whitespace-nowrap pointer-events-none ${dn.color} ${dn.isGlitch ? 'animate-glitch-text' : ''} animate-float-damage-side drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] western-font`} 
                    style={dn.style}
                >
                    {dn.value}
                </div>
            ))}
        </div>
    );
}

// --- Main Layout Component ---

export const GameLayout: React.FC = () => {
    const { 
        gameState, rewardOptions, pickedIndices, visualEffect, damageNumbers,
        isDealing, handAction, enemyHandAction, scoreAnimating, activeItemEffect, activeItemIndex,
        animatingEnvCard, clashState, visibleEnvCount, metaState, goldEarnedThisLevel,
        startRun, hit, stand, useItem, nextLevel, pickReward, setGameState, buyUpgrade, proceedToRewards
    } = useGame();

    const [hoveredHandIndex, setHoveredHandIndex] = useState<number | null>(null);
    const [hoveredInventoryIndex, setHoveredInventoryIndex] = useState<number | null>(null);
    const [showDeckView, setShowDeckView] = useState(false);
    const [showItemCompendium, setShowItemCompendium] = useState(false);
    const [showUpgrades, setShowUpgrades] = useState(false);
    const [compendiumTab, setCompendiumTab] = useState<'ITEMS' | 'ENV'>('ITEMS');
    const [goldAnim, setGoldAnim] = useState('');
    const [fadeOutItem, setFadeOutItem] = useState(false);

    // Gold Animation Effect
    useEffect(() => {
        if (metaState.gold > 0) {
             setGoldAnim('scale-125 text-yellow-200 filter brightness-150 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]');
             const timer = setTimeout(() => setGoldAnim(''), 200);
             return () => clearTimeout(timer);
        }
    }, [metaState.gold]);

    // Trigger fade out of active item near end of animation
    useEffect(() => {
        if (activeItemEffect) {
            setFadeOutItem(false);
            const timer = setTimeout(() => setFadeOutItem(true), 2500);
            return () => clearTimeout(timer);
        }
    }, [activeItemEffect]);

    const calculateScoreLocal = (hand: Card[], target: number) => {
        let score = 0;
        let aces = 0;
        hand.forEach(card => {
            score += card.value;
            if (card.isAce) aces += 1;
        });
        while (score > target && aces > 0) {
            score -= 10;
            aces -= 1; 
        }
        return score;
    };

    // Dynamic margin for inventory items to prevent overflow with 10 items
    const playerInvOverlap = gameState.player.inventory.length > 5 ? '-100px' : '-80px';
    const enemyInvOverlap = gameState.enemy && gameState.enemy.inventory.length > 5 ? '-100px' : '-80px';

    // --- PHASE: MAIN MENU ---
    if (gameState.phase === GamePhase.MENU) {
        return (
             <div className="min-h-screen flex flex-col items-center justify-center bg-wood text-[#f3e5ab] p-4 font-vt323 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[#000000] opacity-40"></div>
                
                <div className="max-w-3xl w-full text-center z-10">
                    <h1 className="text-7xl sm:text-9xl text-[#f3e5ab] mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,1)] tracking-tighter western-font" style={{textShadow: "4px 4px 0px #3e2723"}}>LAST HAND</h1>
                    <h2 className="text-4xl text-amber-600 mb-8 font-bold tracking-widest western-font bg-black/40 inline-block px-4 py-1 rounded">FRONTIER</h2>
                    
                    <div className="p-8 border-4 border-[#3e2723] bg-[#5d4037] pixel-corners flex flex-col items-center justify-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                        {/* Decorative rivets */}
                        <div className="absolute top-2 left-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                        <div className="absolute top-2 right-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                        <div className="absolute bottom-2 left-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                        <div className="absolute bottom-2 right-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>

                        <p className="text-2xl text-[#d7ccc8] font-mono border-b-2 border-[#8d6e63] pb-4 w-full">11 Cards. {gameState.targetScore} Points. Survival.</p>
                        
                        <div className="flex flex-col gap-4 w-full max-w-md">
                             <Button onClick={startRun} className="w-full py-6 text-3xl hover:scale-105 transition-transform western-font">
                                <Play className="inline-block mr-3 w-8 h-8" /> SIT AT TABLE
                            </Button>
                            
                            <Button onClick={() => setShowUpgrades(true)} variant="secondary" className="w-full py-4 text-2xl western-font bg-[#3e2723] border-[#271c19] text-[#a1887f] hover:text-[#d7ccc8]">
                                <Briefcase className="inline-block mr-3 w-6 h-6" /> PROVISIONS
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Upgrades Modal */}
                {showUpgrades && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUpgrades(false)}>
                        <div className="bg-wood border-4 border-[#3e2723] p-6 sm:p-10 max-w-4xl w-full pixel-corners shadow-[0_0_50px_rgba(0,0,0,0.8)] relative" onClick={(e) => e.stopPropagation()}>
                             <button onClick={() => setShowUpgrades(false)} className="absolute top-2 right-2 text-[#d7ccc8] hover:text-white"><X size={32} /></button>
                             
                             <div className="text-center mb-8 border-b-4 border-[#3e2723] pb-4 bg-[#5d4037] p-4 rounded">
                                 <h2 className="text-5xl text-[#f3e5ab] font-black flex items-center justify-center gap-4 mb-2 western-font">
                                     <Briefcase className="w-10 h-10" /> GENERAL STORE
                                 </h2>
                                 <div className="flex items-center justify-center gap-2 text-3xl text-amber-400 bg-black/40 py-2 px-6 inline-block rounded pixel-corners border border-amber-900">
                                     <Coins className="w-6 h-6" /> <span>{metaState.gold}</span>
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 {/* HP Upgrade */}
                                 <div className="bg-[#3e2723] p-6 border-4 border-[#271c19] pixel-corners flex flex-col gap-4 shadow-inner">
                                     <div className="flex justify-between items-start">
                                         <h3 className="text-2xl text-red-400 font-bold flex items-center gap-2 western-font"><Heart className="fill-current" /> VITALITY</h3>
                                         <span className="text-[#a1887f] font-mono">LVL {metaState.upgrades.hpLevel} / {MAX_UPGRADE_HP}</span>
                                     </div>
                                     <p className="text-[#d7ccc8] text-lg min-h-[3rem]">Toughen up. Increases base HP by +1 per level.</p>
                                     
                                     {metaState.upgrades.hpLevel < MAX_UPGRADE_HP ? (
                                         <Button 
                                            variant="danger" 
                                            onClick={() => buyUpgrade('HP')}
                                            disabled={metaState.gold < COST_UPGRADE_HP[metaState.upgrades.hpLevel]}
                                            className="mt-auto flex justify-between items-center px-6"
                                         >
                                             <span>BUY</span>
                                             <span className="flex items-center gap-1 text-amber-200 bg-black/30 px-2 rounded"><Coins size={18} /> {COST_UPGRADE_HP[metaState.upgrades.hpLevel]}</span>
                                         </Button>
                                     ) : (
                                         <div className="mt-auto bg-[#271c19] text-center py-2 text-green-500 font-bold pixel-corners border border-green-800">MAXED OUT</div>
                                     )}
                                 </div>

                                 {/* Inventory Upgrade */}
                                 <div className="bg-[#3e2723] p-6 border-4 border-[#271c19] pixel-corners flex flex-col gap-4 shadow-inner">
                                     <div className="flex justify-between items-start">
                                         <h3 className="text-2xl text-blue-300 font-bold flex items-center gap-2 western-font"><Layers className="fill-current" /> EXTRA POCKETS</h3>
                                         <span className="text-[#a1887f] font-mono">LVL {metaState.upgrades.inventoryLevel} / {MAX_UPGRADE_INVENTORY}</span>
                                     </div>
                                     <p className="text-[#d7ccc8] text-lg min-h-[3rem]">Start the run with +1 extra item.</p>
                                     
                                     {metaState.upgrades.inventoryLevel < MAX_UPGRADE_INVENTORY ? (
                                         <Button 
                                            variant="primary" 
                                            onClick={() => buyUpgrade('INVENTORY')}
                                            disabled={metaState.gold < COST_UPGRADE_INVENTORY[metaState.upgrades.inventoryLevel]}
                                            className="mt-auto flex justify-between items-center px-6"
                                         >
                                             <span>BUY</span>
                                             <span className="flex items-center gap-1 text-amber-200 bg-black/30 px-2 rounded"><Coins size={18} /> {COST_UPGRADE_INVENTORY[metaState.upgrades.inventoryLevel]}</span>
                                         </Button>
                                     ) : (
                                         <div className="mt-auto bg-[#271c19] text-center py-2 text-green-500 font-bold pixel-corners border border-green-800">MAXED OUT</div>
                                     )}
                                 </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- PHASE: GAME OVER ---
    if (gameState.phase === GamePhase.GAME_OVER) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#271c19] text-[#f3e5ab] p-4 text-center border-[20px] border-[#3e2723]">
                <Skull className="w-32 h-32 text-[#a1887f] mb-6 animate-bounce" />
                <h2 className="text-7xl sm:text-9xl font-bold mb-4 western-font text-[#8d6e63]">BUSTED</h2>
                <p className="text-4xl mb-8 font-serif">You made it to Level {gameState.runLevel}</p>
                <div className="mb-12 bg-black/30 p-4 rounded pixel-corners border border-[#5d4037] flex items-center gap-3 text-2xl text-amber-500">
                     <Coins className="w-8 h-8" /> Winnings: {metaState.gold}
                </div>
                <Button onClick={() => setGameState(prev => ({ ...prev, phase: GamePhase.MENU }))} variant="secondary" className="text-3xl py-4 px-8 western-font">
                    <RotateCcw className="inline-block mr-3 w-6 h-6" /> RETURN TO TOWN
                </Button>
            </div>
        );
    }

    // --- PHASE: VICTORY TRANSITION ---
    if (gameState.phase === GamePhase.VICTORY) {
        return (
             <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center relative overflow-hidden animate-victory-bg-flash">
                 {/* Background Grid */}
                <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,#ffd700,#ffd700_10px,transparent_10px,transparent_20px)]"></div>
                
                <div className="z-10 flex flex-col items-center">
                    <Trophy className="w-40 h-40 text-amber-400 mb-6 animate-bounce drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
                    <h2 className="text-8xl sm:text-9xl font-black mb-8 text-[#f3e5ab] animate-victory-text-in tracking-tighter drop-shadow-2xl western-font">
                        HAND<br/><span className="text-amber-500">WON</span>
                    </h2>

                    {/* Continue Button */}
                    <div className="animate-fade-in delay-1000 opacity-0 fill-mode-forwards" style={{animationDelay: '1.5s', animationFillMode: 'forwards'}}>
                        <Button 
                            onClick={proceedToRewards} 
                            variant="success" 
                            className="text-4xl py-4 px-12 western-font shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse"
                        >
                            COLLECT BOUNTY <ArrowRight className="inline-block ml-3 w-8 h-8" />
                        </Button>
                    </div>
                </div>
             </div>
        );
    }

    // --- PHASE: REWARD SELECTION ---
    if (gameState.phase === GamePhase.REWARD) {
        const inventoryCount = gameState.player.inventory.length;
        const picksLeft = REWARD_PICK_LIMIT - pickedIndices.length;
        
        return (
            <div className="min-h-screen bg-felt text-[#f3e5ab] p-6 flex flex-col items-center overflow-y-auto border-[16px] border-[#3e2723] animate-fade-in">
                <div className="max-w-6xl w-full mt-4">
                    <h2 className="text-5xl text-amber-400 mb-2 text-center flex items-center justify-center gap-4 western-font drop-shadow-md">
                        <Gift /> LOOT THE TABLE
                    </h2>
                    <div className="text-center mb-8 flex flex-col items-center gap-2">
                        <div className="text-2xl text-amber-200 bg-black/40 border border-amber-900 px-6 py-2 rounded pixel-corners flex items-center gap-2">
                            <Coins size={24} /> POCKETED: {goldEarnedThisLevel} GOLD
                        </div>
                        <p className="text-3xl text-[#f3e5ab] font-bold mt-2 font-serif">
                            TAKE UP TO <span className="text-amber-400">{picksLeft}</span> ITEMS
                        </p>
                    </div>
                    
                    {/* Display Current Inventory */}
                    <div className="mb-8 bg-[#3e2723] p-4 rounded pixel-corners border-4 border-[#271c19] shadow-inner">
                        <div className="flex justify-between items-end border-b-2 border-[#5d4037] pb-2 mb-4">
                            <h3 className="text-2xl text-[#d7ccc8] western-font">SADDLEBAGS</h3>
                            <span className={`text-xl ${inventoryCount >= gameState.player.maxInventory ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                SPACE: {inventoryCount} / {gameState.player.maxInventory}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-4 justify-center min-h-[120px] items-center">
                            {gameState.player.inventory.map((item, idx) => (
                                <div key={idx} className="relative group transform scale-75 origin-center hover:scale-90 transition-transform">
                                    <ItemCard item={item} />
                                </div>
                            ))}
                            {/* Empty Slots */}
                            {Array.from({ length: Math.max(0, gameState.player.maxInventory - inventoryCount) }).map((_, i) => (
                                <div key={`empty-${i}`} className="w-24 h-36 border-4 border-dashed border-[#5d4037] bg-[#271c19]/50 pixel-corners flex items-center justify-center opacity-50">
                                    <span className="text-[#8d6e63] text-xs font-mono">EMPTY</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Display Reward Options */}
                    <div className="mb-12">
                        <h3 className="text-3xl text-center text-[#d7ccc8] mb-6 border-b border-[#5d4037] pb-2 uppercase tracking-widest western-font">
                             On The Table
                        </h3>
                        <div className="flex flex-wrap gap-8 justify-center">
                            {rewardOptions.map((item, idx) => {
                                const isPicked = pickedIndices.includes(idx);
                                const isInvFull = inventoryCount >= gameState.player.maxInventory;
                                const picksExhausted = picksLeft <= 0;
                                const isDisabled = isPicked || (isInvFull && !isPicked) || (picksExhausted && !isPicked);

                                return (
                                    <div key={idx} className="relative group">
                                        <div className={`relative transition-all duration-300 ${isPicked ? 'translate-y-4 grayscale opacity-50' : 'hover:-translate-y-2'}`}>
                                            <ItemCard 
                                                item={item}
                                                onClick={() => pickReward(item, idx)}
                                                disabled={isDisabled}
                                                className={isPicked ? "border-emerald-500 bg-emerald-900/20" : ""}
                                            />
                                            {isPicked && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                                                    <CheckCircle className="w-16 h-16 text-emerald-500 drop-shadow-lg" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="flex justify-center mt-4 pb-10">
                         <Button 
                            onClick={nextLevel} 
                            className="w-full md:w-1/2 py-6 text-3xl shadow-lg"
                            variant="success"
                        >
                            {picksLeft < 3 ? "RIDE OUT" : "LEAVE IT & RIDE"} <ArrowRight className="inline-block ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // --- PHASE: BATTLE (Main Game Loop) ---
    return (
        <div className={`min-h-screen bg-felt text-[#f3e5ab] flex flex-col overflow-hidden relative ${visualEffect}`}>
            
            {/* --- AVATAR HANDS (Background Layer) --- */}
            <PlayerHand side="PLAYER" action={handAction} className="fixed -bottom-2 -right-6 w-64 h-64 sm:w-96 sm:h-96 pointer-events-none z-[60]" />
            <PlayerHand side="ENEMY" action={enemyHandAction} className="fixed -top-6 -left-6 w-64 h-64 sm:w-96 sm:h-96 pointer-events-none z-[60] rotate-180" />

            {/* --- ITEM ACTIVATION OVERLAY --- */}
            {activeItemEffect && (
                <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(255,215,0,0.1)_0%,transparent_70%)] animate-pulse"></div>
                    
                    <div className={`relative origin-center flex flex-col items-center justify-center ${fadeOutItem ? 'animate-item-use-fade' : activeItemEffect.actor === 'PLAYER' ? 'animate-item-fly-player' : 'animate-item-fly-enemy'}`}>
                        {/* The Card Itself */}
                        <ItemCard 
                            item={activeItemEffect.item} 
                            className={`shadow-[0_0_60px_rgba(255,255,255,0.4)] !border-[#f3e5ab] scale-[1.2]`} 
                            disabled={true} 
                        />
                    </div>

                    {/* Active Item Name */}
                    <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-full animate-fade-in delay-500 z-[310]">
                         <div className="bg-[#3e2723]/95 border-4 border-[#8d6e63] px-8 py-4 rounded-sm pixel-corners shadow-2xl flex flex-col items-center gap-2">
                            <h3 className="text-4xl text-[#f3e5ab] font-bold uppercase tracking-widest whitespace-nowrap western-font">
                                {activeItemEffect.item.name}
                            </h3>
                            <div className="h-0.5 w-full bg-[#8d6e63]"></div>
                            <p className="text-2xl text-[#d7ccc8] font-serif">
                                {activeItemEffect.item.description}
                            </p>
                         </div>
                    </div>
                </div>
            )}

            {/* --- ENVIRONMENT CARD ANIMATION --- */}
            {animatingEnvCard && (
                <>
                    <div className="fixed inset-0 z-[240] bg-black/40 backdrop-blur-sm animate-fade-in pointer-events-none transition-all duration-500"></div>
                    <div className="fixed inset-0 z-[250] pointer-events-none flex items-center justify-center">
                        <div className={`${animatingEnvCard.state === 'entering' ? 'animate-env-enter' : ''} ${animatingEnvCard.state === 'holding' ? 'animate-env-pulse scale-[2.5]' : ''} ${animatingEnvCard.state === 'exiting' ? 'animate-env-exit' : ''}`}>
                            <EnvironmentCardDisplay card={animatingEnvCard.card} />
                        </div>
                    </div>
                </>
            )}

            {/* --- CLASH OVERLAY (End of Round) --- */}
            {clashState.active && (
                <div className="fixed inset-0 z-[150] pointer-events-none flex items-center justify-center">
                    <div className="relative w-full h-full max-w-4xl">
                        <div className="absolute inset-0 animate-clash-impact pointer-events-none"></div>
                        {/* Enemy Score */}
                        <div className="absolute w-32 h-32 flex items-center justify-center animate-clash-move-enemy">
                            <div className={`text-9xl font-black western-font text-white drop-shadow-[0_4px_0_#000] ${clashState.result === 'player_win' ? 'opacity-50 blur-sm transition-all delay-[1.5s] duration-500' : 'scale-110'}`}>{clashState.enemyScore}</div>
                        </div>
                        {/* Player Score */}
                        <div className="absolute w-32 h-32 flex items-center justify-center animate-clash-move-player">
                            <div className={`text-9xl font-black western-font text-white drop-shadow-[0_4px_0_#000] ${clashState.result === 'enemy_win' ? 'opacity-50 blur-sm transition-all delay-[1.5s] duration-500' : 'scale-110'}`}>{clashState.playerScore}</div>
                        </div>
                        {/* Swords Icon */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 animate-fade-in delay-[0.8s] duration-200">
                             <Swords className="w-32 h-32 text-white/40 animate-pulse" />
                        </div>
                    </div>
                </div>
            )}

            {/* --- DECK TRACKER --- */}
            {showDeckView && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowDeckView(false)}
                >
                    <div 
                        className="bg-[#3e2723] border-4 border-[#5d4037] p-6 sm:p-8 max-w-5xl w-full pixel-corners shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <button onClick={() => setShowDeckView(false)} className="absolute top-2 right-2 text-[#d7ccc8] hover:text-white"><X size={32} /></button>
                        
                        <div className="text-center mb-6">
                            <h2 className="text-4xl text-[#f3e5ab] font-bold flex items-center justify-center gap-2 western-font">
                                <Search /> REMAINING CARDS
                            </h2>
                            <p className="text-[#a1887f] mt-2 text-3xl">In Deck: {gameState.deck.length} / 11</p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map((rank) => {
                                const isPlayerCard = gameState.player.hand.some(c => c.rank === rank);
                                const isEnemyVisibleCard = gameState.enemy?.hand.some(c => c.rank === rank && c.isFaceUp);
                                const isRevealed = isPlayerCard || isEnemyVisibleCard;
                                const showAsAvailable = !isRevealed;

                                return (
                                    <div key={rank} className={`relative transition-all duration-300 ${!showAsAvailable ? 'opacity-20 grayscale scale-90' : 'scale-100 hover:scale-110 hover:z-10'}`}>
                                        <CardComponent card={{suit: Suit.Spades, rank: rank, value: 0, id: `tracker-${rank}`, isFaceUp: true, isAce: rank === 'A'}} className="sm:w-20 sm:h-28" />
                                        {!showAsAvailable && (
                                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                                <X className="text-red-800 w-12 h-12 opacity-80" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* --- ITEM COMPENDIUM --- */}
            {showItemCompendium && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowItemCompendium(false)}>
                     <div className="bg-[#3e2723] border-4 border-[#5d4037] p-6 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto pixel-corners shadow-2xl relative" onClick={(e) => e.stopPropagation()} >
                        <button onClick={() => setShowItemCompendium(false)} className="absolute top-2 right-2 text-[#d7ccc8] hover:text-white"><X size={32} /></button>
                        <div className="text-center mb-6"><h2 className="text-4xl text-[#f3e5ab] font-bold flex items-center justify-center gap-2 western-font"><Book /> LEDGER </h2></div>
                        <div className="flex justify-center gap-6 mb-8 border-b-2 border-[#5d4037] pb-4">
                            <button onClick={() => setCompendiumTab('ITEMS')} className={`px-6 py-2 text-3xl font-bold uppercase tracking-wider pixel-corners border-b-4 active:border-b-0 active:translate-y-1 transition-all ${compendiumTab === 'ITEMS' ? 'bg-[#d7ccc8] text-[#3e2723] border-[#a1887f]' : 'bg-[#271c19] text-[#8d6e63] border-[#3e2723] hover:bg-[#3e2723]'}`}>Goods</button>
                            <button onClick={() => setCompendiumTab('ENV')} className={`px-6 py-2 text-3xl font-bold uppercase tracking-wider pixel-corners border-b-4 active:border-b-0 active:translate-y-1 transition-all ${compendiumTab === 'ENV' ? 'bg-amber-600 text-[#271c19] border-amber-800' : 'bg-[#271c19] text-[#8d6e63] border-[#3e2723] hover:bg-[#3e2723]'}`}>Notices</button>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8 min-h-[300px]">
                            {compendiumTab === 'ITEMS' && ITEMS.map((item) => (
                                <div key={item.id} className="flex flex-col items-center"><ItemCard item={item} disabled={false} className="cursor-help" onClick={() => {}} /></div>
                            ))}
                            {compendiumTab === 'ENV' && ENVIRONMENT_CARDS.map((card) => (
                                <div key={card.id} className="flex flex-col items-center p-2"><EnvironmentCardDisplay card={card} className="scale-110" /></div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MAIN GAME UI GRID --- */}
            <div className="flex-1 relative flex flex-col justify-between p-2 sm:p-4 max-w-6xl mx-auto w-full">
                
                {/* --- LEFT SIDEBAR: Game Stats --- */}
                <div className="absolute left-2 sm:left-8 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col gap-6 items-center z-30">
                    <div className="flex flex-row gap-4 items-center">
                        <div className="flex flex-col gap-1 items-center">
                            {/* Target Score Widget */}
                            <div className="relative w-20 h-28 sm:w-24 sm:h-32 bg-[#3e2723] border-4 border-[#271c19] rounded pixel-corners flex flex-col items-center justify-center shadow-lg">
                                <span className="text-[14px] text-[#a1887f] uppercase mb-1 relative z-10 tracking-widest western-font">GOAL</span>
                                <span className="text-5xl font-black text-[#f3e5ab] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] relative z-10 western-font">{gameState.targetScore}</span>
                            </div>
                        </div>
                        {/* Level Info Widget */}
                        <div className="flex flex-col gap-1 items-center">
                            <div className="relative w-24 h-28 sm:w-28 sm:h-32 bg-[#271c19]/90 border-2 border-[#5d4037] rounded pixel-corners flex flex-col justify-between shadow-sm p-2 sm:p-3">
                                <div className="flex items-center justify-between w-full relative z-10">
                                    <span className="text-[16px] sm:text-lg text-[#8d6e63] font-bold tracking-wider uppercase">Lvl</span>
                                    <span className="text-lg sm:text-xl font-bold text-[#f3e5ab] leading-none">{gameState.runLevel}</span>
                                </div>
                                <div className="w-full h-px bg-[#5d4037] relative z-10"></div>
                                <div className="flex items-center justify-between w-full relative z-10">
                                    <span className="text-[16px] sm:text-lg text-[#8d6e63] font-bold tracking-wider uppercase">Rnd</span>
                                    <span className="text-lg sm:text-xl font-bold text-[#f3e5ab] leading-none">{gameState.roundCount}</span>
                                </div>
                                <div className="w-full h-px bg-[#5d4037] relative z-10"></div>
                                <div className={`flex items-center justify-between w-full relative z-10 transition-all duration-200 ${goldAnim}`}>
                                    <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
                                    <span className="text-lg sm:text-xl font-bold text-amber-400 leading-none">{metaState.gold}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Active Environment Cards Row */}
                    {gameState.activeEnvironment.length > 0 && (
                        <div className="flex items-center justify-center -mt-2 relative h-36 min-w-[120px]">
                            {gameState.activeEnvironment.slice(0, visibleEnvCount).map((card, index) => (
                                <EnvironmentCardDisplay key={card.id} card={card} className="transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-4 hover:z-[100] animate-fade-in" style={{ marginLeft: index === 0 ? '0px' : '-45px', zIndex: index * 10 }} />
                            ))}
                        </div>
                    )}
                </div>
                
                {/* --- RIGHT SIDEBAR: Tools --- */}
                <div className="absolute right-2 sm:right-8 translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col gap-6 items-center z-30">
                    <div className="flex flex-col gap-1 items-center">
                        <div className="relative w-20 h-28 sm:w-24 sm:h-32 group cursor-pointer" onClick={() => setShowDeckView(true)} title="View Remaining Cards">
                            <div className="absolute inset-0 w-full h-full bg-[#3e2723] border-4 border-[#271c19] rounded pixel-corners relative shadow-lg transition-transform group-hover:scale-105 group-hover:-translate-y-1 group-active:scale-95 flex items-center justify-center">
                                <Search className="text-[#a1887f] w-8 h-8 drop-shadow-md group-hover:text-[#f3e5ab] transition-colors" />
                            </div>
                            <div className="absolute -top-2 -right-2 bg-emerald-700 text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full border-2 border-emerald-900 z-50 shadow-md">{gameState.deck.length}</div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                        <div className="relative w-20 h-28 sm:w-24 sm:h-32 group cursor-pointer" onClick={() => setShowItemCompendium(true)} title="Item Compendium">
                            <div className="absolute inset-0 w-full h-full bg-[#3e2723] border-4 border-[#271c19] rounded pixel-corners relative shadow-lg transition-transform group-hover:scale-105 group-hover:-translate-y-1 group-active:scale-95 flex items-center justify-center">
                                <Book className="text-[#a1887f] w-8 h-8 drop-shadow-md group-hover:text-[#f3e5ab] transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- TOP SECTION: ENEMY AREA --- */}
                <div className={`flex flex-col w-full relative z-20 transition-all duration-500 rounded-xl p-4 ${gameState.turnOwner === 'ENEMY' ? 'bg-red-950/40 shadow-[0_0_50px_-12px_rgba(185,28,28,0.4)] border border-red-900/40' : 'opacity-80'}`}>
                    <div className="relative h-40 sm:h-56 w-full flex justify-center z-10 mb-2 mt-2">
                        {gameState.enemy && gameState.enemy.hand.map((card, i) => (
                            <div key={card.id} className="absolute top-0 origin-top transition-all duration-500 ease-out" style={getFanStyle(i, gameState.enemy!.hand.length, false, false)}><CardComponent card={card} className="animate-deal-enemy" /></div>
                        ))}
                    </div>
                     <div className="flex flex-wrap justify-center w-full gap-6 items-end relative z-20 pb-2">
                        <div className={`transition-all duration-300 px-4 py-1 rounded border-2 pixel-corners text-lg sm:text-xl uppercase tracking-widest font-bold flex items-center gap-2 western-font ${clashState.active ? 'opacity-0' : 'opacity-100'} ${gameState.enemyStood ? 'bg-red-900/90 border-red-500 text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.6)]' : gameState.turnOwner === 'ENEMY' ? 'bg-[#3e2723] border-[#a1887f] text-[#f3e5ab] animate-pulse' : 'bg-[#271c19]/80 border-[#3e2723] text-[#8d6e63]'}`}>
                            {gameState.enemyStood ? (<><EyeOff size={18} /> STOOD</>) : gameState.turnOwner === 'ENEMY' ? (<><Zap size={18} /> THINKING</>) : (<><CheckCircle size={18} /> WAITING</>)}
                        </div>
                        {gameState.enemy && (
                            <>
                                <div className={`bg-[#271c19]/90 px-4 py-1 rounded border-2 border-[#5d4037] text-xl font-mono text-red-300 shadow-lg pixel-corners backdrop-blur-sm transition-opacity duration-200 ${clashState.active ? 'opacity-0' : 'opacity-100'}`}>
                                    {gameState.enemy.hand.some(c => !c.isFaceUp) ? (<span>SCORE: <span className="font-bold text-white">? + {calculateScoreLocal(gameState.enemy.hand.filter(c => c.isFaceUp), gameState.targetScore)}</span></span>) : (<span>SCORE: <span className="font-bold text-white">{gameState.enemy.score}</span></span>)}
                                </div>
                                <div className="relative w-full max-w-[240px]">
                                    <HealthBar current={gameState.enemy.hp} max={gameState.enemy.maxHp} label={gameState.enemy.name} shield={gameState.enemy.shield} />
                                    <DamageNumbersDisplay target="ENEMY" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* --- CENTER: MESSAGE DISPLAY --- */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none z-30 flex flex-col items-center">
                    {gameState.message && <MessageDisplay message={gameState.message} />}
                </div>

                {/* --- BOTTOM SECTION: PLAYER AREA --- */}
                <div className={`flex flex-col w-full relative z-20 pb-2 transition-all duration-500 rounded-xl p-4 ${gameState.turnOwner === 'PLAYER' ? 'bg-[#3e2723]/60 shadow-[0_0_50px_-12px_rgba(251,191,36,0.3)] border border-[#a1887f]/40' : 'opacity-80'}`}>
                    <div className="flex flex-wrap justify-center w-full -mb-6 gap-6 items-end relative z-20">
                         <div className={`transition-all duration-300 px-4 py-1 rounded border-2 pixel-corners text-lg sm:text-xl uppercase tracking-widest font-bold flex items-center gap-2 western-font ${clashState.active ? 'opacity-0' : 'opacity-100'} ${gameState.playerStood ? 'bg-red-900/90 border-red-500 text-red-100' : gameState.turnOwner === 'PLAYER' ? 'bg-[#3e2723] border-[#a1887f] text-[#f3e5ab] animate-pulse' : 'bg-[#271c19]/80 border-[#3e2723] text-[#8d6e63]'}`}>
                            {gameState.playerStood ? (<><EyeOff size={18} /> STOOD</>) : gameState.turnOwner === 'PLAYER' ? (<><Zap size={18} /> YOUR DRAW</>) : (<><CheckCircle size={18} /> WAITING</>)}
                        </div>
                         <div className={`px-4 py-1 rounded border-2 text-xl font-mono pixel-corners backdrop-blur-sm transition-all duration-300 ${getScoreStyles(gameState.player.score, gameState.targetScore)} ${scoreAnimating ? 'animate-score-pop' : ''} ${clashState.active ? 'opacity-0' : 'opacity-100'}`}>
                             SCORE: <span className={`font-bold ${gameState.player.score === gameState.targetScore ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : 'text-white'}`}>{gameState.player.score}</span>
                             {gameState.player.score > gameState.targetScore && <span className="ml-2 font-bold text-red-500">BUST</span>}
                         </div>
                         <div className="relative w-full max-w-[240px]">
                            <HealthBar current={gameState.player.hp} max={gameState.player.maxHp} shield={gameState.player.shield} label="YOU" />
                            <DamageNumbersDisplay target="PLAYER" />
                         </div>
                    </div>
                    {/* Player Hand */}
                    <div className="relative h-44 sm:h-60 w-full flex justify-center items-end mb-4 sm:mb-10">
                        {gameState.player.hand.map((card, i) => (
                            <div key={card.id} className="absolute bottom-0 origin-bottom" style={getFanStyle(i, gameState.player.hand.length, true, hoveredHandIndex === i)} onMouseEnter={() => setHoveredHandIndex(i)} onMouseLeave={() => setHoveredHandIndex(null)}><CardComponent card={card} className="animate-deal-player" /></div>
                        ))}
                    </div>
                    {/* Buttons */}
                    <div className="w-full flex justify-center pb-2 relative z-30">
                        <div className="flex gap-4 justify-center">
                            <Button onClick={() => hit('PLAYER')} disabled={gameState.turnOwner !== 'PLAYER' || gameState.playerStood || gameState.player.score >= gameState.targetScore || isDealing || gameState.player.hand.length < 2 || clashState.active || !!activeItemEffect} variant="success" className="w-32 h-14 sm:w-40 sm:h-16 text-xl sm:text-2xl shadow-lg">HIT</Button>
                            <Button onClick={() => stand('PLAYER')} disabled={gameState.turnOwner !== 'PLAYER' || gameState.playerStood || isDealing || gameState.player.hand.length < 2 || clashState.active || !!activeItemEffect} variant="danger" className="w-32 h-14 sm:w-40 sm:h-16 text-xl sm:text-2xl shadow-lg">STAND</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- BOTTOM LEFT: PLAYER INVENTORY --- */}
            <div className="absolute bottom-4 left-4 z-50 flex items-end pl-2 pb-2">
                {gameState.player.inventory.map((item, idx) => {
                    const isFlying = activeItemIndex === idx && activeItemEffect?.actor === 'PLAYER';
                    return (
                        <div 
                            key={`${item.id}-${idx}`} 
                            className={`transition-all duration-300 ease-out origin-bottom-left animate-deal-item-player ${isFlying ? 'opacity-0' : 'opacity-100'}`} 
                            onMouseEnter={() => setHoveredInventoryIndex(idx)} 
                            onMouseLeave={() => setHoveredInventoryIndex(null)} 
                            style={{ marginLeft: idx === 0 ? 0 : playerInvOverlap, zIndex: hoveredInventoryIndex === idx ? 100 : 50 + idx, transform: hoveredInventoryIndex === idx ? 'translateY(-80px) scale(1.1)' : `translateY(${idx * -5}px)`, marginRight: hoveredInventoryIndex === idx ? '60px' : '0px' }}
                        >
                            <ItemCard item={item} onClick={() => useItem(idx, 'PLAYER')} disabled={gameState.turnOwner !== 'PLAYER' || gameState.playerStood || isDealing || clashState.active || !!activeItemEffect} />
                        </div>
                    );
                })}
            </div>

            {/* --- TOP RIGHT: ENEMY INVENTORY --- */}
            {gameState.enemy && (
                <div className="absolute top-16 right-4 z-50 flex flex-row-reverse items-start pr-2 pt-2 pointer-events-none">
                    {gameState.enemy.inventory.map((item, idx) => (
                        <div key={`enemy-item-${idx}`} className="transition-all duration-300 ease-out origin-top-right animate-deal-item-enemy" style={{ marginRight: idx === 0 ? 0 : enemyInvOverlap, zIndex: 50 + idx, transform: `translateY(${idx * 15}px)`, }}>
                            <ItemCard item={item} isHidden={true} className="scale-90 shadow-lg" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
