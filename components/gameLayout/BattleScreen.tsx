import React, { useEffect, useMemo, useState } from 'react';
import { EyeOff, Zap, CheckCircle, Search, X, Swords, Book, Coins } from 'lucide-react';
import { PlayerHand } from '../PlayerHand';
import { ItemCard } from '../ItemCard';
import { HealthBar } from '../HealthBar';
import { Button } from '../Button';
import { CardComponent } from '../CardComponent';
import { EnvironmentCardDisplay } from '../EnvironmentCardDisplay';
import { PenaltyCardDisplay } from '../penaltyCardDisplay';
import { useGame } from '../../context/GameContext';
import { ITEMS } from '../../content/items';
import { ENVIRONMENT_CARDS } from '../../content/environments';
import { VISUAL_WARN_OFFSET, VISUAL_SAFE_OFFSET, VISUAL_EARLY_OFFSET } from '../../common/constants';
import { Card, DamageNumber, EnvironmentCard, Item, PenaltyCard, Suit, TurnOwner } from '../../common/types';

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
        transition: 'transform 0.2s ease-out, z-index 0s',
    };
};

const getScoreStyles = (score: number, target: number) => {
    if (score > target) return 'bg-red-950/90 border-red-600 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.6)]';
    if (score === target) return 'bg-gradient-to-r from-amber-800 to-yellow-900 border-yellow-400 text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.5)]';
    if (score === target - VISUAL_WARN_OFFSET) return 'bg-purple-950/90 border-purple-400 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.7)] animate-subtle-pulse';
    if (score >= target - VISUAL_SAFE_OFFSET) return 'bg-indigo-950/90 border-indigo-400 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]';
    if (score >= target - VISUAL_EARLY_OFFSET) return "bg-[#3e2723]/90 border-stone-500 text-stone-300 shadow-[0_0_10px_rgba(0,0,0,0.4)]";
    return "bg-[#3e2723]/80 border-[#5d4037] text-[#a1887f] shadow-lg";
};

const JitterText: React.FC<{ text: string }> = ({ text }) => {
    const letters = useMemo(
        () =>
            text.split('').map(char => ({
                char,
                delay: Math.random() * -5,
                duration: 2 + Math.random() * 2,
            })),
        [text],
    );

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

    useEffect(() => {
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

const DamageNumbersDisplay: React.FC<{ target: TurnOwner; damageNumbers: DamageNumber[] }> = ({ target, damageNumbers }) => {
    const list = damageNumbers.filter(d => d.target === target);
    if (list.length === 0) return null;

    return (
        <div className="absolute top-0 right-0 w-0 h-full overflow-visible flex flex-col items-center justify-center pointer-events-none z-50">
            {list.map(dn => (
                <div
                    key={dn.id}
                    className={`absolute top-0 left-full ml-4 z-50 text-5xl sm:text-6xl font-black whitespace-nowrap pointer-events-none ${dn.color} ${
                        dn.isGlitch ? 'animate-glitch-text' : ''
                    } animate-float-damage-side drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] western-font`}
                    style={dn.style}
                >
                    {dn.value}
                </div>
            ))}
        </div>
    );
};

const ActiveItemOverlay: React.FC<{ effect: { item: Item; actor: TurnOwner } | null; fadeOut: boolean }> = ({ effect, fadeOut }) => {
    if (!effect) return null;
    return (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(255,215,0,0.1)_0%,transparent_70%)] animate-pulse"></div>
            <div
                className={`relative origin-center flex flex-col items-center justify-center ${
                    fadeOut ? 'animate-item-use-fade' : effect.actor === 'PLAYER' ? 'animate-item-fly-player' : 'animate-item-fly-enemy'
                }`}
            >
                <ItemCard item={effect.item} className="shadow-[0_0_60px_rgba(255,255,255,0.4)] !border-[#f3e5ab] scale-[1.2]" disabled />
            </div>
            <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-full animate-fade-in delay-500 z-[310]">
                <div className="bg-[#3e2723]/95 border-4 border-[#8d6e63] px-8 py-4 rounded-sm pixel-corners shadow-2xl flex flex-col items-center gap-2">
                    <h3 className="text-4xl text-[#f3e5ab] font-bold uppercase tracking-widest whitespace-nowrap western-font">{effect.item.name}</h3>
                    <div className="h-0.5 w-full bg-[#8d6e63]"></div>
                    <p className="text-2xl text-[#d7ccc8] font-serif">{effect.item.description}</p>
                </div>
            </div>
        </div>
    );
};

const PenaltyAnimation: React.FC<{
    animatingPenaltyCard: { card: PenaltyCard; state: 'entering' | 'holding' | 'exiting' } | null;
}> = ({ animatingPenaltyCard }) => {
    if (!animatingPenaltyCard) return null;
    return (
        <>
            <div className="fixed inset-0 z-[240] bg-black/40 backdrop-blur-sm animate-fade-in pointer-events-none transition-all duration-500"></div>
            <div className="fixed inset-0 z-[250] pointer-events-none flex items-center justify-center">
                <div
                    className={`${animatingPenaltyCard.state === 'entering' ? 'animate-env-enter' : ''} ${
                        animatingPenaltyCard.state === 'holding' ? 'animate-env-pulse scale-[1.5]' : ''
                    } ${animatingPenaltyCard.state === 'exiting' ? 'animate-env-exit' : ''}`}
                >
                    <PenaltyCardDisplay card={animatingPenaltyCard.card} className="scale-125 shadow-2xl" />
                </div>
            </div>
        </>
    );
};

const EnvironmentAnimation: React.FC<{
    animatingEnvCard: { card: EnvironmentCard; state: 'entering' | 'holding' | 'exiting' } | null;
}> = ({ animatingEnvCard }) => {
    if (!animatingEnvCard) return null;
    return (
        <>
            <div className="fixed inset-0 z-[240] bg-black/40 backdrop-blur-sm animate-fade-in pointer-events-none transition-all duration-500"></div>
            <div className="fixed inset-0 z-[250] pointer-events-none flex items-center justify-center">
                <div
                    className={`${animatingEnvCard.state === 'entering' ? 'animate-env-enter' : ''} ${
                        animatingEnvCard.state === 'holding' ? 'animate-env-pulse scale-[2.5]' : ''
                    } ${animatingEnvCard.state === 'exiting' ? 'animate-env-exit' : ''}`}
                >
                    <EnvironmentCardDisplay card={animatingEnvCard.card} />
                </div>
            </div>
        </>
    );
};

const ClashOverlay: React.FC<{ clashState: ReturnType<typeof useGame>['clashState'] }> = ({ clashState }) => {
    if (!clashState.active) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
            {/* VS Badge in background */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                    <div className="text-[20rem] font-black text-white/5 western-font animate-pulse">VS</div>
            </div>
            
            {/* Container */}
            <div className="relative w-full max-w-2xl h-[60vh] flex flex-col items-center justify-center">
                
                {/* Impact Effect (Shockwave) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-amber-500 animate-shockwave opacity-0"></div>
                
                {/* Enemy Score (Top) */}
                <div className="relative mb-4 flex flex-col items-center z-20 animate-clash-enter-top">
                        <div className="text-2xl text-red-300 font-bold tracking-widest uppercase mb-2 drop-shadow-md">Enemy</div>
                        <div className={`
                        text-9xl font-black western-font relative 
                        ${clashState.result === 'player_win' 
                            ? 'animate-loser-shake text-stone-500' 
                            : clashState.result === 'enemy_win' ? 'animate-winner-pulse-red text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'text-red-200'}
                        `}>
                        {clashState.enemyScore}
                        {clashState.enemyScore > clashState.targetScore && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-red-800 text-red-800 text-4xl font-black px-4 py-1 opacity-0 animate-stamp-pop bg-red-950/80 whitespace-nowrap">
                                BUSTED
                            </div>
                        )}
                        </div>
                </div>

                {/* VS Icon (Center) */}
                <div className="z-30 my-2 animate-vs-pop">
                    <div className="w-16 h-16 bg-[#3e2723] border-4 border-[#8d6e63] rotate-45 flex items-center justify-center shadow-lg">
                        <span className="text-[#f3e5ab] font-bold text-2xl -rotate-45 western-font">VS</span>
                    </div>
                </div>

                {/* Player Score (Bottom) */}
                <div className="relative mt-4 flex flex-col items-center z-20 animate-clash-enter-bottom">
                        <div className={`
                        text-9xl font-black western-font relative
                        ${clashState.result === 'enemy_win' 
                            ? 'animate-loser-shake text-stone-500' 
                            : clashState.result === 'player_win' ? 'animate-winner-pulse-amber text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]' : 'text-amber-200'}
                        `}>
                        {clashState.playerScore}
                        {clashState.playerScore > clashState.targetScore && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-red-800 text-red-800 text-4xl font-black px-4 py-1 opacity-0 animate-stamp-pop bg-red-950/80 whitespace-nowrap">
                                BUSTED
                            </div>
                        )}
                        </div>
                        <div className="text-2xl text-amber-200 font-bold tracking-widest uppercase mt-2 drop-shadow-md">You</div>
                </div>

            </div>
        </div>
    );
};

const DeckTrackerModal: React.FC<{
    onClose: () => void;
    deckLength: number;
    playerHand: Card[];
    enemyHand?: Card[];
}> = ({ onClose, deckLength, playerHand, enemyHand }) => (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div
            className="relative max-w-5xl w-full bg-[#2a1d18] border-[8px] border-[#3e2723] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pixel-corners"
            onClick={e => e.stopPropagation()}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 text-[#a1887f] hover:text-[#f3e5ab] transition-colors bg-[#271c19] p-1.5 rounded border border-[#5d4037] shadow-lg hover:border-[#8d6e63]"
            >
                <X size={28} />
            </button>

            <div className="bg-[#271c19] p-6 border-b-4 border-[#1a110d] flex flex-col items-center justify-center relative shadow-lg bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]">
                <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>

                <h2 className="text-4xl sm:text-5xl text-[#f3e5ab] font-black tracking-widest western-font drop-shadow-[2px_2px_0_#000] mb-2 uppercase">Dealer's Shoe</h2>
                <div className="flex items-center gap-6 text-[#8d6e63] font-mono text-xl sm:text-2xl uppercase tracking-wider bg-black/30 px-6 py-1 rounded-full border border-[#3e2723]">
                    <span>Total: 11</span>
                    <span className="text-[#5d4037]">|</span>
                    <span>
                        Remaining: <span className="text-[#f3e5ab] font-bold">{deckLength}</span>
                    </span>
                </div>
            </div>

            <div className="bg-[#1b2e1f] p-8 sm:p-12 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] relative min-h-[400px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] pointer-events-none"></div>
                <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>

                <div className="relative z-10 flex flex-wrap justify-center gap-6 sm:gap-8 max-w-4xl">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map(rank => {
                        const isPlayerCard = playerHand.some(c => c.rank === rank);
                        const isEnemyVisibleCard = enemyHand?.some(c => c.rank === rank && c.isFaceUp);
                        const isRevealed = isPlayerCard || isEnemyVisibleCard;
                        const showAsAvailable = !isRevealed;

                        return (
                            <div key={rank} className="relative group">
                                <div
                                    className={`transition-all duration-500 transform ${
                                        showAsAvailable
                                            ? 'hover:-translate-y-4 hover:scale-110 hover:rotate-1 hover:z-20 cursor-help shadow-xl'
                                            : 'opacity-60 grayscale-[0.8] scale-95 rotate-1 blur-[0.5px]'
                                    }`}
                                >
                                    <CardComponent
                                        card={{ suit: Suit.Spades, rank, value: 0, id: `tracker-${rank}`, isFaceUp: true, isAce: rank === 'A' }}
                                        className="w-20 h-28 sm:w-24 sm:h-36 shadow-lg"
                                    />
                                </div>
                                {!showAsAvailable && (
                                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                        <svg viewBox="0 0 100 100" className="w-[120%] h-[120%] drop-shadow-md opacity-80 animate-fade-in">
                                            <path d="M 20 20 L 80 80" stroke="#7f1d1d" strokeWidth="12" strokeLinecap="round" />
                                            <path d="M 80 20 L 20 80" stroke="#7f1d1d" strokeWidth="12" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-[#271c19] p-3 border-t-4 border-[#1a110d] text-[#5d4037] font-bold font-mono text-xs sm:text-sm px-6 flex justify-between">
                <span className="uppercase tracking-widest">Only 1 suit in play</span>
                <span className="uppercase tracking-widest">Aces = 1 or 11</span>
            </div>
        </div>
    </div>
);

const ItemCompendiumModal: React.FC<{
    onClose: () => void;
    tab: 'ITEMS' | 'ENV';
    setTab: (tab: 'ITEMS' | 'ENV') => void;
}> = ({ onClose, tab, setTab }) => (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div
            className="relative max-w-6xl w-full h-[85vh] bg-[#2a1d18] border-[8px] border-[#3e2723] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pixel-corners"
            onClick={e => e.stopPropagation()}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 text-[#a1887f] hover:text-[#f3e5ab] transition-colors bg-[#271c19] p-1.5 rounded border border-[#5d4037] shadow-lg hover:border-[#8d6e63]"
            >
                <X size={28} />
            </button>

            <div className="bg-[#271c19] p-6 border-b-4 border-[#1a110d] flex flex-col items-center justify-center relative shadow-lg bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] shrink-0">
                <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>
                <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-[#1a110d] border border-[#3e2723] shadow-inner"></div>

                <h2 className="text-4xl sm:text-5xl text-[#f3e5ab] font-black tracking-widest western-font drop-shadow-[2px_2px_0_#000] mb-4 uppercase flex items-center gap-3">
                    <Book className="w-10 h-10 text-[#8d6e63]" /> Ledger
                </h2>

                <div className="flex gap-4 bg-black/30 p-1.5 rounded-lg border border-[#3e2723]">
                    <button
                        onClick={() => setTab('ITEMS')}
                        className={`px-8 py-2 text-xl sm:text-2xl font-bold uppercase tracking-widest western-font rounded transition-all duration-200 ${
                            tab === 'ITEMS' ? 'bg-[#8d6e63] text-[#271c19] shadow-inner' : 'text-[#8d6e63] hover:bg-[#3e2723] hover:text-[#d7ccc8]'
                        }`}
                    >
                        Items
                    </button>
                    <div className="w-px bg-[#5d4037] my-1"></div>
                    <button
                        onClick={() => setTab('ENV')}
                        className={`px-8 py-2 text-xl sm:text-2xl font-bold uppercase tracking-widest western-font rounded transition-all duration-200 ${
                            tab === 'ENV' ? 'bg-[#8d6e63] text-[#271c19] shadow-inner' : 'text-[#8d6e63] hover:bg-[#3e2723] hover:text-[#d7ccc8]'
                        }`}
                    >
                        Notices
                    </button>
                </div>
            </div>

            <div
                className="flex-1 bg-[#1b2e1f] relative shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] overflow-y-auto overflow-x-hidden debug-console-scroll"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#5d4037 #1b2e1f' }}
            >
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] pointer-events-none fixed"></div>
                <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] fixed pointer-events-none"></div>

                <div className="relative z-10 p-8 sm:p-12">
                    <div className="flex flex-wrap justify-center gap-8 sm:gap-12 pt-24 pb-20 sm:pt-32 sm:pb-28">
                        {tab === 'ITEMS' &&
                            ITEMS.map(item => (
                                <div key={item.id} className="flex flex-col items-center group">
                                    <ItemCard item={item} disabled={false} className="cursor-help shadow-[0_10px_20px_rgba(0,0,0,0.5)]" onClick={() => {}} />
                                    <div className="mt-4 bg-[#271c19]/80 px-3 py-1 rounded border border-[#5d4037] text-[#a1887f] text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                        ID: {item.name}
                                    </div>
                                </div>
                            ))}
                        {tab === 'ENV' &&
                            ENVIRONMENT_CARDS.map(card => (
                                <div key={card.id} className="flex flex-col items-center p-4">
                                    <EnvironmentCardDisplay card={card} className="scale-125" />
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <div className="bg-[#271c19] p-3 border-t-4 border-[#1a110d] flex justify-between items-center text-[#5d4037] font-bold font-mono text-xs sm:text-sm px-6 shrink-0">
                <span className="uppercase tracking-widest">Last Hand Trading Co.</span>
                <span className="uppercase tracking-widest">Est. 18XX</span>
            </div>
        </div>
    </div>
);

export const Battlefield: React.FC = () => {
    const {
        gameState,
        visualEffect,
        handAction,
        enemyHandAction,
        damageNumbers,
        isDealing,
        scoreAnimating,
        activeItemEffect,
        activeItemIndex,
        animatingEnvCard,
        animatingPenaltyCard,
        clashState,
        visibleEnvCount,
        penaltyRevealed,
        metaState,
        lastPenaltyEvent,
        isBattleExiting,
        hit,
        stand,
        useItem,
    } = useGame();

    const [hoveredHandIndex, setHoveredHandIndex] = useState<number | null>(null);
    const [hoveredInventoryIndex, setHoveredInventoryIndex] = useState<number | null>(null);
    const [showDeckView, setShowDeckView] = useState(false);
    const [showItemCompendium, setShowItemCompendium] = useState(false);
    const [compendiumTab, setCompendiumTab] = useState<'ITEMS' | 'ENV'>('ITEMS');
    const [goldAnim, setGoldAnim] = useState('');
    const [fadeOutItem, setFadeOutItem] = useState(false);

    useEffect(() => {
        if (metaState.gold > 0) {
            setGoldAnim('scale-125 text-yellow-200 filter brightness-150 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]');
            const timer = setTimeout(() => setGoldAnim(''), 200);
            return () => clearTimeout(timer);
        }
    }, [metaState.gold]);

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

    const playerInvOverlap = gameState.player.inventory.length > 5 ? '-100px' : '-80px';
    const enemyInvOverlap = gameState.enemy && gameState.enemy.inventory.length > 5 ? '-100px' : '-80px';
    const widgetClass =
        'relative w-24 h-28 sm:w-26 sm:h-32 bg-[#271c19]/90 border-2 border-[#5d4037] rounded pixel-corners flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-105';

    const animClassTop = isBattleExiting ? 'slide-out-top' : 'slide-in-top';
    const animClassBottom = isBattleExiting ? 'slide-out-bottom' : 'slide-in-bottom';
    const animClassLeft = isBattleExiting ? 'slide-out-left' : 'slide-in-left';
    const animClassRight = isBattleExiting ? 'slide-out-right' : 'slide-in-right';

    return (
        <div className={`min-h-screen bg-felt text-[#f3e5ab] flex flex-col overflow-hidden relative ${visualEffect}`}>
            <PlayerHand side="PLAYER" action={handAction} className={`fixed -bottom-2 -right-6 w-64 h-64 sm:w-96 sm:h-96 pointer-events-none z-[60] ${animClassBottom}`} />
            <div className={`fixed -top-6 -left-6 w-64 h-64 sm:w-96 sm:h-96 pointer-events-none z-[60] ${animClassTop}`}>
                <div className="w-full h-full rotate-180">
                    <PlayerHand side="ENEMY" action={enemyHandAction} className="w-full h-full" />
                </div>
            </div>

            <ActiveItemOverlay effect={activeItemEffect} fadeOut={fadeOutItem} />
            <PenaltyAnimation animatingPenaltyCard={animatingPenaltyCard} />
            <EnvironmentAnimation animatingEnvCard={animatingEnvCard} />
            <ClashOverlay clashState={clashState} />

            {showDeckView && (
                <DeckTrackerModal
                    onClose={() => setShowDeckView(false)}
                    deckLength={gameState.deck.length}
                    playerHand={gameState.player.hand}
                    enemyHand={gameState.enemy?.hand}
                />
            )}

            {showItemCompendium && (
                <ItemCompendiumModal onClose={() => setShowItemCompendium(false)} tab={compendiumTab} setTab={setCompendiumTab} />
            )}

            <div className="flex-1 relative flex flex-col justify-between p-2 sm:p-4 max-w-6xl mx-auto w-full">
                <div className={`absolute left-2 sm:left-8 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-8 items-center z-40 ${animClassLeft}`}>
                    {gameState.activePenalty && penaltyRevealed && (
                        <div className="animate-fade-in relative z-20">
                            <PenaltyCardDisplay
                                card={gameState.activePenalty}
                                runtime={gameState.penaltyRuntime}
                                isAnimating={lastPenaltyEvent?.state === 'APPLIED'}
                                className="shadow-2xl"
                            />
                        </div>
                    )}
                    {gameState.activeEnvironment.length > 0 && (
                        <div className="flex flex-row relative z-10 hover:z-50">
                            {gameState.activeEnvironment.slice(0, visibleEnvCount).map((card, idx) => (
                                <EnvironmentCardDisplay
                                    key={card.id}
                                    card={card}
                                    style={{ marginLeft: idx === 0 ? 0 : '-60px' }}
                                    className="animate-fade-in shadow-xl hover:z-30 transition-all duration-300 hover:-translate-y-4"
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className={`absolute right-2 sm:right-8 translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center z-30 ${animClassRight}`}>
                    <div className="flex gap-4">
                        <div className={widgetClass} style={{ backgroundColor: '#3e2723' }}>
                            <span className="text-[12px] text-[#a1887f] uppercase mb-1 relative z-10 tracking-widest western-font">GOAL</span>
                            <span className="text-[20px] sm:text-5xl font-black text-[#f3e5ab] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] relative z-10 western-font">
                                {gameState.targetScore}
                            </span>
                        </div>

                        <div className={`${widgetClass} p-1`}>
                            <div className="flex items-center justify-between w-full relative z-10 px-2">
                                <span className="text-[16px] text-[#8d6e63] font-bold tracking-wider uppercase">Level</span>
                                <span className="text-lg font-bold text-[#f3e5ab] leading-none">{gameState.runLevel}</span>
                            </div>
                            <div className="w-full h-px bg-[#5d4037] relative z-10 my-1"></div>
                            <div className="flex items-center justify-between w-full relative z-10 px-2">
                                <span className="text-[16px] text-[#8d6e63] font-bold tracking-wider uppercase">Round</span>
                                <span className="text-lg font-bold text-[#f3e5ab] leading-none">{gameState.roundCount}</span>
                            </div>
                            <div className="w-full h-px bg-[#5d4037] relative z-10 my-1"></div>
                            <div className={`flex items-center justify-between w-full relative z-10 px-2 transition-all duration-200 ${goldAnim}`}>
                                <Coins className="w-4 h-4 text-amber-500" />
                                <span className="text-lg font-bold text-amber-400 leading-none">{metaState.gold}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div
                            className="relative w-24 h-28 sm:w-26 sm:h-32 group cursor-pointer transition-transform hover:scale-105"
                            onClick={() => setShowDeckView(true)}
                            title="View Remaining Cards"
                        >
                            <div className="w-full h-full bg-[#271c19]/90 border-2 border-[#5d4037] rounded pixel-corners flex flex-col items-center justify-center shadow-lg">
                                <Search className="text-[#a1887f] w-8 h-8 drop-shadow-md group-hover:text-[#f3e5ab] transition-colors mb-1" />
                                <span className="text-[16px] text-[#8d6e63] uppercase font-bold">DECK</span>
                            </div>
                            <div className="absolute -top-2 -right-2 bg-emerald-700 text-white text-[16px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-emerald-900 z-50 shadow-md pointer-events-none">
                                {gameState.deck.length}
                            </div>
                        </div>

                        <div className={`${widgetClass} group cursor-pointer`} onClick={() => setShowItemCompendium(true)} title="Item Compendium">
                            <Book className="text-[#a1887f] w-8 h-8 drop-shadow-md group-hover:text-[#f3e5ab] transition-colors mb-1" />
                            <span className="text-[16px] text-[#8d6e63] uppercase font-bold">REFERENCE</span>
                        </div>
                    </div>
                </div>

                <div
                    className={`flex flex-col w-full relative z-20 transition-all duration-500 rounded-xl p-4 ${animClassTop} ${
                        gameState.turnOwner === 'ENEMY' ? 'bg-red-950/40 shadow-[0_0_50px_-12px_rgba(185,28,28,0.4)] border border-red-900/40' : 'opacity-80'
                    }`}
                >
                    <div className="relative h-40 sm:h-56 w-full flex justify-center z-10 mb-2 mt-2">
                        {gameState.enemy &&
                            gameState.enemy.hand.map((card, i) => (
                                <div key={card.id} className="absolute top-0 origin-top transition-all duration-500 ease-out" style={getFanStyle(i, gameState.enemy!.hand.length, false, false)}>
                                    <CardComponent card={card} className="animate-deal-enemy" />
                                </div>
                            ))}
                    </div>
                    <div className="flex flex-wrap justify-center w-full gap-6 items-end relative z-20 pb-2">
                        <div
                            className={`transition-all duration-300 px-4 py-1 rounded border-2 pixel-corners text-lg sm:text-xl uppercase tracking-widest font-bold flex items-center gap-2 western-font ${
                                clashState.active ? 'opacity-0' : 'opacity-100'
                            } ${
                                gameState.enemyStood
                                    ? 'bg-red-900/90 border-red-500 text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.6)]'
                                    : gameState.turnOwner === 'ENEMY'
                                    ? 'bg-[#3e2723] border-[#a1887f] text-[#f3e5ab] animate-pulse'
                                    : 'bg-[#271c19]/80 border-[#3e2723] text-[#8d6e63]'
                            }`}
                        >
                            {gameState.enemyStood ? (
                                <>
                                    <EyeOff size={18} /> STOOD
                                </>
                            ) : gameState.turnOwner === 'ENEMY' ? (
                                <>
                                    <Zap size={18} /> THINKING
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} /> WAITING
                                </>
                            )}
                        </div>
                        {gameState.enemy && (
                            <>
                                <div
                                    className={`bg-[#271c19]/90 px-4 py-1 rounded border-2 border-[#5d4037] text-xl font-mono text-red-300 shadow-lg pixel-corners backdrop-blur-sm transition-opacity duration-200 ${
                                        clashState.active ? 'opacity-0' : 'opacity-100'
                                    }`}
                                >
                                    {gameState.enemy.hand.some(c => !c.isFaceUp) ? (
                                        <span>
                                            SCORE:{' '}
                                            <span className="font-bold text-white">
                                                ? + {calculateScoreLocal(gameState.enemy.hand.filter(c => c.isFaceUp), gameState.targetScore)}
                                            </span>
                                        </span>
                                    ) : (
                                        <span>
                                            SCORE: <span className="font-bold text-white">{gameState.enemy.score}</span>
                                        </span>
                                    )}
                                </div>
                                <div className="relative w-full max-w-[240px]">
                                    <HealthBar current={gameState.enemy.hp} max={gameState.enemy.maxHp} label={gameState.enemy.name} shield={gameState.enemy.shield} />
                                    <DamageNumbersDisplay target="ENEMY" damageNumbers={damageNumbers} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none z-30 flex flex-col items-center">
                    {gameState.message && <MessageDisplay message={gameState.message} />}
                </div>

                <div
                    className={`flex flex-col w-full relative z-20 pb-2 transition-all duration-500 rounded-xl p-4 ${animClassBottom} ${
                        gameState.turnOwner === 'PLAYER' ? 'bg-[#3e2723]/60 shadow-[0_0_50px_-12px_rgba(251,191,36,0.3)] border border-[#a1887f]/40' : 'opacity-80'
                    }`}
                >
                    <div className="flex flex-wrap justify-center w-full -mb-6 gap-6 items-end relative z-20">
                        <div
                            className={`transition-all duration-300 px-4 py-1 rounded border-2 pixel-corners text-lg sm:text-xl uppercase tracking-widest font-bold flex items-center gap-2 western-font ${
                                clashState.active ? 'opacity-0' : 'opacity-100'
                            } ${
                                gameState.playerStood
                                    ? 'bg-red-900/90 border-red-500 text-red-100'
                                    : gameState.turnOwner === 'PLAYER'
                                    ? 'bg-[#3e2723] border-[#a1887f] text-[#f3e5ab] animate-pulse'
                                    : 'bg-[#271c19]/80 border-[#3e2723] text-[#8d6e63]'
                            }`}
                        >
                            {gameState.playerStood ? (
                                <>
                                    <EyeOff size={18} /> STOOD
                                </>
                            ) : gameState.turnOwner === 'PLAYER' ? (
                                <>
                                    <Zap size={18} /> YOUR DRAW
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} /> WAITING
                                </>
                            )}
                        </div>
                        <div
                            className={`px-4 py-1 rounded border-2 text-xl font-mono pixel-corners backdrop-blur-sm transition-all duration-300 ${getScoreStyles(
                                gameState.player.score,
                                gameState.targetScore,
                            )} ${scoreAnimating ? 'animate-score-pop' : ''} ${clashState.active ? 'opacity-0' : 'opacity-100'}`}
                        >
                            SCORE:{' '}
                            <span
                                className={`font-bold ${
                                    gameState.player.score === gameState.targetScore ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]' : 'text-white'
                                }`}
                            >
                                {gameState.player.score}
                            </span>
                            {gameState.player.score > gameState.targetScore && <span className="ml-2 font-bold text-red-500">BUST</span>}
                        </div>
                        <div className="relative w-full max-w-[240px]">
                            <HealthBar current={gameState.player.hp} max={gameState.player.maxHp} shield={gameState.player.shield} label="YOU" />
                            <DamageNumbersDisplay target="PLAYER" damageNumbers={damageNumbers} />
                        </div>
                    </div>
                    <div className="relative h-44 sm:h-60 w-full flex justify-center items-end mb-4 sm:mb-10">
                        {gameState.player.hand.map((card, i) => (
                            <div
                                key={card.id}
                                className="absolute bottom-0 origin-bottom"
                                style={getFanStyle(i, gameState.player.hand.length, true, hoveredHandIndex === i)}
                                onMouseEnter={() => setHoveredHandIndex(i)}
                                onMouseLeave={() => setHoveredHandIndex(null)}
                            >
                                <CardComponent card={card} className="animate-deal-player" />
                            </div>
                        ))}
                    </div>
                    <div className="w-full flex justify-center pb-2 relative z-30">
                        <div className="flex gap-4 justify-center">
                            <Button
                                onClick={() => hit('PLAYER')}
                                disabled={
                                    gameState.turnOwner !== 'PLAYER' ||
                                    gameState.playerStood ||
                                    gameState.player.score >= gameState.targetScore ||
                                    isDealing ||
                                    gameState.player.hand.length < 2 ||
                                    clashState.active ||
                                    !!activeItemEffect
                                }
                                variant="success"
                                className="w-32 h-14 sm:w-40 sm:h-16 text-xl sm:text-2xl shadow-lg"
                            >
                                HIT
                            </Button>
                            <Button
                                onClick={() => stand('PLAYER')}
                                disabled={
                                    gameState.turnOwner !== 'PLAYER' ||
                                    gameState.playerStood ||
                                    isDealing ||
                                    gameState.player.hand.length < 2 ||
                                    clashState.active ||
                                    !!activeItemEffect
                                }
                                variant="danger"
                                className="w-32 h-14 sm:w-40 sm:h-16 text-xl sm:text-2xl shadow-lg"
                            >
                                STAND
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`absolute bottom-4 left-4 z-50 flex items-end pl-2 pb-2 ${animClassBottom}`}>
                {gameState.player.inventory.map((item, idx) => {
                    const isFlying = activeItemIndex === idx && activeItemEffect?.actor === 'PLAYER';
                    return (
                        <div
                            key={`${item.id}-${idx}`}
                            className={`transition-all duration-300 ease-out origin-bottom-left animate-deal-item-player ${isFlying ? 'opacity-0' : 'opacity-100'}`}
                            onMouseEnter={() => setHoveredInventoryIndex(idx)}
                            onMouseLeave={() => setHoveredInventoryIndex(null)}
                            style={{
                                marginLeft: idx === 0 ? 0 : playerInvOverlap,
                                zIndex: hoveredInventoryIndex === idx ? 100 : 50 + idx,
                                transform: hoveredInventoryIndex === idx ? 'translateY(-80px) scale(1.1)' : `translateY(${idx * -5}px)`,
                                marginRight: hoveredInventoryIndex === idx ? '60px' : '0px',
                            }}
                        >
                            <ItemCard
                                item={item}
                                onClick={() => useItem(idx, 'PLAYER')}
                                disabled={
                                    gameState.turnOwner !== 'PLAYER' || gameState.playerStood || isDealing || clashState.active || !!activeItemEffect
                                }
                            />
                        </div>
                    );
                })}
            </div>

            {gameState.enemy && (
                <div className={`absolute top-16 right-4 z-50 flex flex-row-reverse items-start pr-2 pt-2 pointer-events-none ${animClassTop}`}>
                    {gameState.enemy.inventory.map((item, idx) => (
                        <div
                            key={`enemy-item-${idx}`}
                            className="transition-all duration-300 ease-out origin-top-right animate-deal-item-enemy"
                            style={{ marginRight: idx === 0 ? 0 : enemyInvOverlap, zIndex: 50 + idx, transform: `translateY(${idx * 15}px)` }}
                        >
                            <ItemCard item={item} isHidden className="scale-90 shadow-lg" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
