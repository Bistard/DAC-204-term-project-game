import React from 'react';
import { Gift, Coins, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '../Button';
import { ItemCard } from '../ItemCard';
import { useGame } from '../../context/GameContext';
import { REWARD_PICK_LIMIT } from '../../common/constants';

export const RewardScreen: React.FC = () => {
    const { gameState, rewardOptions, pickedIndices, goldEarnedThisLevel, pickReward, nextLevel } = useGame();
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
                        {Array.from({ length: Math.max(0, gameState.player.maxInventory - inventoryCount) }).map((_, i) => (
                            <div
                                key={`empty-${i}`}
                                className="w-24 h-36 border-4 border-dashed border-[#5d4037] bg-[#271c19]/50 pixel-corners flex items-center justify-center opacity-50"
                            >
                                <span className="text-[#8d6e63] text-xs font-mono">EMPTY</span>
                            </div>
                        ))}
                    </div>
                </div>

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
                                            className={isPicked ? 'border-emerald-500 bg-emerald-900/20' : ''}
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
                    <Button onClick={nextLevel} className="w-full md:w-1/2 py-6 text-3xl shadow-lg" variant="success">
                        {picksLeft < 3 ? 'RIDE OUT' : 'LEAVE IT & RIDE'} <ArrowRight className="inline-block ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
