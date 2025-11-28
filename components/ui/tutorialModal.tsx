
import React, { useState } from 'react';
import { X, HelpCircle, ArrowRight, ArrowLeft, Skull, Box, Globe, Zap, ShieldAlert, Swords } from 'lucide-react';
import { Button } from './Button';

// Mini Card Component for Tutorial Visuals
const TutorialCard: React.FC<{ label: string; sub?: string; color?: string; rotate?: string }> = ({ label, sub, color = "text-[#3e2723]", rotate = "rotate-0" }) => (
    <div className={`w-16 h-24 bg-[#e3dac9] border-2 border-[#8d6e63] rounded-sm pixel-corners flex flex-col items-center justify-center shadow-md ${rotate}`}>
        <span className={`font-bold text-2xl western-font ${color}`}>{label}</span>
        {sub && <span className="text-xs sm:text-sm uppercase font-bold text-[#8d6e63] leading-tight">{sub}</span>}
    </div>
);

export const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [page, setPage] = useState(1);
    const totalPages = 4;

    const nextPage = () => setPage(p => Math.min(totalPages, p + 1));
    const prevPage = () => setPage(p => Math.max(1, p - 1));

    return (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                className="relative max-w-4xl w-full bg-[#2a1d18] border-[8px] border-[#3e2723] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pixel-corners"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-[#271c19] p-4 border-b-4 border-[#1a110d] flex items-center justify-between relative shadow-lg bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]">
                     <div className="flex items-center gap-3">
                        <HelpCircle className="w-8 h-8 text-[#8d6e63]" />
                        <h2 className="text-3xl text-[#f3e5ab] font-black tracking-widest western-font uppercase">
                            Field Manual <span className="text-xl text-[#5d4037] ml-2">Pg. {page}/{totalPages}</span>
                        </h2>
                     </div>
                     <button
                        onClick={onClose}
                        className="text-[#a1887f] hover:text-[#f3e5ab] transition-colors bg-[#3e2723] p-1.5 rounded border border-[#5d4037]"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="bg-[#1b2e1f] p-6 sm:p-8 text-base text-[24px] overflow-y-auto max-h-[70vh] relative shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] h-[500px]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#5d4037 #1b2e1f' }}>
                     
                     {/* Background Texture */}
                     <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] pointer-events-none"></div>

                     {page === 1 && (
                         <div className="flex flex-col gap-8 relative z-10 animate-fade-in h-full justify-center">
                            
                            {/* PAGE 1: THE GOAL */}
                            <div className="flex flex-col items-center">
                                <div className="bg-[#271c19]/80 border-2 border-[#5d4037] px-6 py-2 rounded-full mb-8">
                                    <span className="text-[#f3e5ab] text-[30px] font-bold uppercase tracking-widest">The Objective</span>
                                </div>
                                
                                <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 w-full">
                                    {/* Step 1 */}
                                    <div className="flex flex-col items-center gap-2 group">
                                        <div className="relative">
                                            <TutorialCard label="7" rotate="-rotate-6" />
                                            <div className="absolute top-0 left-4"><TutorialCard label="A" sub="ace" rotate="rotate-6" color="text-[#8b0000]" /></div>
                                        </div>
                                        <p className="text-[#a1887f] font-bold mt-2 uppercase text-base text-[24px]">Draw Cards</p>
                                    </div>

                                    <ArrowRight className="text-[#5d4037] w-8 h-8 animate-pulse" />

                                    {/* Step 2 */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-24 h-24 rounded-full border-4 border-amber-500 bg-[#3e2723] flex flex-col items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                                            <span className="text-4xl font-black text-[#f3e5ab] western-font">21</span>
                                            <span className="text-xs sm:text-sm text-amber-500 font-bold uppercase">Target</span>
                                        </div>
                                        <p className="text-amber-400 font-bold mt-2 uppercase text-base text-[24px]">Get Close</p>
                                    </div>

                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[#d7ccc8] font-serif italic text-base text-[24px]">But...</span>
                                        <ArrowRight className="text-[#5d4037] w-8 h-8" />
                                    </div>

                                    {/* Step 3 */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-24 h-24 relative flex items-center justify-center">
                                             <div className="absolute inset-0 border-4 border-red-900/50 bg-[#1a0505] rotate-3 pixel-corners"></div>
                                             <Skull className="w-12 h-12 text-red-500 relative z-10 animate-bounce" />
                                             <div className="absolute -bottom-2 bg-red-900 text-white text-sm sm:text-base px-2 py-0.5 font-bold uppercase">
                                                 &gt; 21
                                             </div>
                                        </div>
                                        <p className="text-red-400 font-bold mt-2 uppercase text-base text-[24px]">Don't Bust</p>
                                    </div>
                                </div>
                            </div>
                         </div>
                     )}

                     {page === 2 && (
                         <div className="flex flex-col gap-8 relative z-10 animate-fade-in h-full justify-center items-center">
                            
                            {/* PAGE 2: CARD VALUES & DECK */}
                            <div className="bg-[#271c19]/80 border-2 border-[#5d4037] px-6 py-2 rounded-full mb-4">
                                <span className="text-[#f3e5ab] text-[30px] font-bold uppercase tracking-widest">The Deck</span>
                            </div>

                            <div className="bg-[#271c19]/60 border border-[#3e2723] p-8 rounded pixel-corners flex flex-col gap-8 max-w-2xl w-full">
                                
                                {/* Value Rules */}
                                <div className="flex justify-around items-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-3">
                                            <TutorialCard label="1~10" />
                                            <span className="text-[#f3e5ab] font-bold text-3xl">= 1~10 Score</span>
                                        </div>
                                        <span className="text-[#8d6e63] text-[22px] font-bold uppercase tracking-wide">Number Cards</span>
                                    </div>
                                    
                                    <div className="w-px h-20 bg-[#3e2723]"></div>
                                    
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-3">
                                            <TutorialCard label="A" sub="Ace" />
                                            <div className="flex flex-col">
                                                <span className="text-[#f3e5ab] font-bold text-3xl">= 11 Score</span>
                                            </div>
                                        </div>
                                        <span className="text-[#8d6e63] text-[22px] font-bold uppercase tracking-wide">Or 1 if you bust</span>
                                    </div>
                                </div>

                                <div className="h-px w-full bg-[#3e2723]"></div>

                                {/* Deck Info */}
                                <div className="grid grid-cols-2 gap-6 text-center">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[#f3e5ab] font-bold text-[24px] uppercase">Shared Deck</span>
                                        <p className="text-[#a1887f] text-base text-[22px] leading-relaxed">
                                            You and the enemy draw from the same deck. Counting cards helps.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-red-400 font-bold text-[24px] uppercase">No Face Cards</span>
                                        <p className="text-[#a1887f] text-base text-[22px] leading-relaxed">
                                            The deck contains 1-10 and an A. <br/> J, Q, K are removed.
                                        </p>
                                    </div>
                                </div>
                            </div>
                         </div>
                     )}

                     {page === 3 && (
                         <div className="flex flex-col gap-8 relative z-10 animate-fade-in h-full justify-center items-center">
                            
                            {/* PAGE 3: CONTROLS */}
                            <div className="bg-[#271c19]/80 border-2 border-[#5d4037] px-6 py-2 rounded-full mb-4">
                                <span className="text-[#f3e5ab] text-[30px] font-bold uppercase tracking-widest">The Duel</span>
                            </div>

                            <div className="bg-[#271c19]/60 border border-[#3e2723] p-8 rounded pixel-corners flex flex-col gap-8 max-w-2xl w-full">
                                <p className="text-[#a1887f] text-center text-[24px] font-bold">
                                    You and the enemy take turns. <br/> When it's your turn, you must choose:
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                                    <div className="bg-emerald-900/30 border border-emerald-800 p-6 text-center rounded flex flex-col items-center gap-2 group hover:bg-emerald-900/40 transition-colors">
                                        <span className="block text-emerald-400 font-black text-4xl uppercase western-font drop-shadow-md group-hover:scale-110 transition-transform">HIT</span>
                                        <div className="h-px w-12 bg-emerald-800"></div>
                                        <span className="text-emerald-200/80 text-base text-[24px] uppercase font-bold">Draw a Card</span>
                                        <span className="text-emerald-200/50 text-sm sm:text-base italic">Risks busting</span>
                                    </div>
                                    
                                    <div className="bg-red-900/30 border border-red-800 p-6 text-center rounded flex flex-col items-center gap-2 group hover:bg-red-900/40 transition-colors">
                                        <span className="block text-red-400 font-black text-4xl uppercase western-font drop-shadow-md group-hover:scale-110 transition-transform">STAND</span>
                                        <div className="h-px w-12 bg-red-800"></div>
                                        <span className="text-red-200/80 text-base text-[24px] uppercase font-bold">End Turn</span>
                                        <span className="text-red-200/50 text-sm sm:text-base italic">Keeps current score</span>
                                    </div>
                                </div>

                                <p className="text-[#a1887f] text-center text-[24px] font-bold uppercase tracking-widest mt-2">
                                    If both stand, scores are compared.
                                </p>
                            </div>
                         </div>
                     )}

                     {page === 4 && (
                         <div className="flex flex-col gap-6 relative z-10 animate-fade-in h-full justify-center">
                             
                             {/* PAGE 4: SURVIVAL GUIDE */}
                             <div className="bg-[#271c19]/80 border-2 border-[#5d4037] px-6 py-2 rounded-full mx-auto mb-4">
                                <span className="text-[#f3e5ab] text-[30px] font-bold uppercase tracking-widest">Randomization</span>
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                 {/* ITEMS */}
                                 <div className="bg-[#2a1d18] border-2 border-[#5d4037] p-4 rounded pixel-corners flex flex-col items-center text-center group hover:-translate-y-1 transition-transform">
                                     <div className="w-16 h-16 bg-[#3e2723] rounded-full flex items-center justify-center mb-3 border-2 border-[#5d4037] group-hover:border-[#f3e5ab] transition-colors">
                                         <Box className="text-[#f3e5ab] w-8 h-8" />
                                     </div>
                                     <h3 className="text-[#f3e5ab] font-bold western-font text-xl uppercase mb-1">Items</h3>
                                     <p className="text-[#a1887f] text-base text-[24px] leading-relaxed">
                                         Consumables found in your saddlebag. Use them to <span className="text-emerald-400">Cheat</span> or <span className="text-emerald-400">Heal</span>.
                                     </p>
                                 </div>

                                 {/* NOTICES */}
                                 <div className="bg-[#2a1d18] border-2 border-[#5d4037] p-4 rounded pixel-corners flex flex-col items-center text-center group hover:-translate-y-1 transition-transform">
                                     <div className="w-16 h-16 bg-[#3e2723] rounded-full flex items-center justify-center mb-3 border-2 border-[#5d4037] group-hover:border-[#f3e5ab] transition-colors">
                                         <Globe className="text-amber-500 w-8 h-8" />
                                     </div>
                                     <h3 className="text-[#f3e5ab] font-bold western-font text-xl uppercase mb-1">Notices</h3>
                                     <p className="text-[#a1887f] text-base text-[24px] leading-relaxed">
                                         Global rules posted on the left wall. They change <span className="text-amber-400">every level</span>.
                                     </p>
                                 </div>

                                 {/* PENALTIES */}
                                 <div className="bg-[#2a1d18] border-2 border-[#5d4037] p-4 rounded pixel-corners flex flex-col items-center text-center group hover:-translate-y-1 transition-transform">
                                     <div className="w-16 h-16 bg-[#3e2723] rounded-full flex items-center justify-center mb-3 border-2 border-[#5d4037] group-hover:border-red-500 transition-colors">
                                         <Skull className="text-red-500 w-8 h-8" />
                                     </div>
                                     <h3 className="text-[#f3e5ab] font-bold western-font text-xl uppercase mb-1">Penalty</h3>
                                     <p className="text-[#a1887f] text-base text-[24px] leading-relaxed">
                                         The active threat. If you lose a round, you take this <span className="text-red-400">Damage</span>.
                                     </p>
                                 </div>
                             </div>
                         </div>
                     )}
                </div>
                
                {/* Footer Navigation */}
                <div className="bg-[#271c19] p-4 border-t-4 border-[#1a110d] flex justify-between shrink-0">
                     <div className="flex-1 flex justify-start">
                        {page > 1 && (
                            <Button onClick={prevPage} variant="secondary" className="px-6 shadow-lg text-lg">
                                <ArrowLeft className="inline mr-2" size={20}/> Back
                            </Button>
                        )}
                     </div>
                     
                     <div className="flex-1 flex justify-end">
                        {page < totalPages ? (
                            <Button onClick={nextPage} variant="primary" className="px-6 shadow-lg text-lg">
                                Next <ArrowRight className="inline ml-2" size={20}/>
                            </Button>
                        ) : (
                            <Button onClick={onClose} variant="success" className="px-8 shadow-lg">
                                Ready to Ride
                            </Button>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};
