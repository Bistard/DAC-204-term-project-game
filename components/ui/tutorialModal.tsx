
import React, { useState } from 'react';
import { X, HelpCircle, ArrowRight, ArrowLeft, Skull, Box, Globe } from 'lucide-react';
import { Button } from './Button';

export const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [page, setPage] = useState(1);

    return (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                className="relative max-w-2xl w-full bg-[#2a1d18] border-[8px] border-[#3e2723] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pixel-corners"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 text-[#a1887f] hover:text-[#f3e5ab] transition-colors bg-[#271c19] p-1.5 rounded border border-[#5d4037] shadow-lg hover:border-[#8d6e63]"
                >
                    <X size={28} />
                </button>

                <div className="bg-[#271c19] p-6 border-b-4 border-[#1a110d] flex flex-col items-center justify-center relative shadow-lg bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]">
                    <h2 className="text-4xl sm:text-5xl text-[#f3e5ab] font-black tracking-widest western-font drop-shadow-[2px_2px_0_#000] mb-2 uppercase flex items-center gap-3">
                        <HelpCircle className="w-10 h-10 text-[#8d6e63]" /> Rules <span className="text-2xl text-[#8d6e63] ml-2">({page}/2)</span>
                    </h2>
                </div>

                <div className="bg-[#1b2e1f] p-8 text-[#d7ccc8] font-serif text-lg leading-relaxed space-y-6 overflow-y-auto max-h-[60vh] relative shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] debug-console-scroll h-[400px]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#5d4037 #1b2e1f' }}>
                     {page === 1 ? (
                         <>
                            <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest">The Objective</h3>
                                <p>Draw cards to get your score as close to <span className="text-amber-400 font-bold text-xl">21</span> as possible. If you exceed 21, you <span className="text-red-400 font-bold">BUST</span> and lose the round immediately.</p>
                            </section>

                            <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest">Card Values</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-[#8d6e63]">
                                    <li>Number cards (1-10) are worth their face value.</li>
                                    <li><span className="text-[#f3e5ab] font-bold">Aces (A)</span> are worth 11, but drop to 1 if you would bust.</li>
                                    <li>There are no Face cards (J, Q, K) in this deck.</li>
                                </ul>
                            </section>

                            <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest">Controls</h3>
                                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline">
                                    <strong className="text-emerald-400 font-bold western-font tracking-wider text-right">HIT</strong>
                                    <span>Draw another card from the deck.</span>
                                    
                                    <strong className="text-red-400 font-bold western-font tracking-wider text-right">STAND</strong>
                                    <span>End your turn and lock in your current score.</span>
                                </div>
                            </section>
                         </>
                     ) : (
                         <>
                             <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest flex items-center gap-2">
                                     <Skull size={20} className="text-red-500"/> Penalty Cards
                                </h3>
                                <p>These define the consequences of losing a round.</p>
                             </section>

                             <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest flex items-center gap-2">
                                    <Box size={20} className="text-blue-400"/> Item Cards
                                </h3>
                                <p>Found in your saddlebag (bottom left). They can be used to win the game. Use them wisely!</p>
                             </section>
                             
                             <section className="relative z-10 animate-fade-in">
                                <h3 className="text-[#f3e5ab] font-bold text-xl uppercase mb-2 western-font border-b border-[#5d4037] inline-block tracking-widest flex items-center gap-2">
                                    <Globe size={20} className="text-amber-600"/> Notices (Environment)
                                </h3>
                                <p>These global rules change how the game is played for the entire level. Affects both players.</p>
                             </section>
                         </>
                     )}
                </div>
                
                <div className="bg-[#271c19] p-4 border-t-4 border-[#1a110d] flex justify-between shrink-0">
                     {page === 1 ? (
                         <>
                             <div className="w-4"></div> {/* Spacer */}
                             <Button onClick={() => setPage(2)} variant="primary" className="px-8 shadow-lg">Next Page <ArrowRight className="inline ml-2" size={20}/></Button>
                         </>
                     ) : (
                         <>
                             <Button onClick={() => setPage(1)} variant="secondary" className="px-8 shadow-lg"><ArrowLeft className="inline mr-2" size={20}/> Back</Button>
                             <Button onClick={onClose} variant="success" className="px-8 shadow-lg">Close Guide</Button>
                         </>
                     )}
                </div>
            </div>
        </div>
    );
};
