import React, { useState } from 'react';
import { Play, Briefcase, Coins, Heart, Layers, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useGame } from '../../context/GameContext';
import {
    COST_UPGRADE_HP,
    COST_UPGRADE_INVENTORY,
    MAX_UPGRADE_HP,
    MAX_UPGRADE_INVENTORY,
} from '../../common/constants';

export const MenuScreen: React.FC = () => {
    const { gameState, metaState, startRun, buyUpgrade } = useGame();
    const [showUpgrades, setShowUpgrades] = useState(false);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-wood text-[#f3e5ab] p-4 font-vt323 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#000000] opacity-40"></div>

            <div className="max-w-3xl w-full text-center z-10">
                <h1
                    className="text-7xl sm:text-9xl text-[#f3e5ab] mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,1)] tracking-tighter western-font"
                    style={{ textShadow: '4px 4px 0px #3e2723' }}
                >
                    LAST HAND
                </h1>
                <h2 className="text-4xl text-amber-600 mb-8 font-bold tracking-widest western-font bg-black/40 inline-block px-4 py-1 rounded">
                    FRONTIER
                </h2>

                <div className="p-8 border-4 border-[#3e2723] bg-[#5d4037] pixel-corners flex flex-col items-center justify-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                    <div className="absolute top-2 left-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                    <div className="absolute top-2 right-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                    <div className="absolute bottom-2 left-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>
                    <div className="absolute bottom-2 right-2 w-3 h-3 bg-[#8d6e63] rounded-full shadow-inner"></div>

                    <p className="text-2xl text-[#d7ccc8] font-mono border-b-2 border-[#8d6e63] pb-4 w-full">
                        11 Cards. {gameState.targetScore} Points. Survival.
                    </p>

                    <div className="flex flex-col gap-4 w-full max-w-md">
                        <Button onClick={startRun} className="w-full py-6 text-3xl hover:scale-105 transition-transform western-font">
                            <Play className="inline-block mr-3 w-8 h-8" /> SIT AT TABLE
                        </Button>

                        <Button
                            onClick={() => setShowUpgrades(true)}
                            variant="secondary"
                            className="w-full py-4 text-2xl western-font bg-[#3e2723] border-[#271c19] text-[#a1887f] hover:text-[#d7ccc8]"
                        >
                            <Briefcase className="inline-block mr-3 w-6 h-6" /> PROVISIONS
                        </Button>
                    </div>
                </div>
            </div>

            {showUpgrades && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowUpgrades(false)}
                >
                    <div
                        className="bg-wood border-4 border-[#3e2723] p-6 sm:p-10 max-w-4xl w-full pixel-corners shadow-[0_0_50px_rgba(0,0,0,0.8)] relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowUpgrades(false)}
                            className="absolute top-2 right-2 text-[#d7ccc8] hover:text-white"
                        >
                            <X size={32} />
                        </button>

                        <div className="text-center mb-8 border-b-4 border-[#3e2723] pb-4 bg-[#5d4037] p-4 rounded">
                            <h2 className="text-5xl text-[#f3e5ab] font-black flex items-center justify-center gap-4 mb-2 western-font">
                                <Briefcase className="w-10 h-10" /> GENERAL STORE
                            </h2>
                            <div className="flex items-center justify-center gap-2 text-3xl text-amber-400 bg-black/40 py-2 px-6 inline-block rounded pixel-corners border border-amber-900">
                                <Coins className="w-6 h-6" /> <span>{metaState.gold}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#3e2723] p-6 border-4 border-[#271c19] pixel-corners flex flex-col gap-4 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-2xl text-red-400 font-bold flex items-center gap-2 western-font">
                                        <Heart className="fill-current" /> VITALITY
                                    </h3>
                                    <span className="text-[#a1887f] font-mono">
                                        LVL {metaState.upgrades.hpLevel} / {MAX_UPGRADE_HP}
                                    </span>
                                </div>
                                <p className="text-[#d7ccc8] text-lg min-h-[3rem]">
                                    Toughen up. Increases base HP by +1 per level.
                                </p>

                                {metaState.upgrades.hpLevel < MAX_UPGRADE_HP ? (
                                    <Button
                                        variant="danger"
                                        onClick={() => buyUpgrade('HP')}
                                        disabled={metaState.gold < COST_UPGRADE_HP[metaState.upgrades.hpLevel]}
                                        className="mt-auto flex justify-between items-center px-6"
                                    >
                                        <span>BUY</span>
                                        <span className="flex items-center gap-1 text-amber-200 bg-black/30 px-2 rounded">
                                            <Coins size={18} /> {COST_UPGRADE_HP[metaState.upgrades.hpLevel]}
                                        </span>
                                    </Button>
                                ) : (
                                    <div className="mt-auto bg-[#271c19] text-center py-2 text-green-500 font-bold pixel-corners border border-green-800">
                                        MAXED OUT
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#3e2723] p-6 border-4 border-[#271c19] pixel-corners flex flex-col gap-4 shadow-inner">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-2xl text-blue-300 font-bold flex items-center gap-2 western-font">
                                        <Layers className="fill-current" /> EXTRA POCKETS
                                    </h3>
                                    <span className="text-[#a1887f] font-mono">
                                        LVL {metaState.upgrades.inventoryLevel} / {MAX_UPGRADE_INVENTORY}
                                    </span>
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
                                        <span className="flex items-center gap-1 text-amber-200 bg-black/30 px-2 rounded">
                                            <Coins size={18} /> {COST_UPGRADE_INVENTORY[metaState.upgrades.inventoryLevel]}
                                        </span>
                                    </Button>
                                ) : (
                                    <div className="mt-auto bg-[#271c19] text-center py-2 text-green-500 font-bold pixel-corners border border-green-800">
                                        MAXED OUT
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
