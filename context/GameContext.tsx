
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
    GameState, GamePhase, Enemy, Item, EnvironmentCard, 
    DamageNumber, HandAction, ClashState, MetaState, MetaUpgrades 
} from '../types';
import { 
    createDeck, calculateScore, sleep, getRandomEnemy, getRandomEnvironment, getRandomItems 
} from '../engine/utils';
import { 
    STARTING_HP, MAX_INVENTORY_SLOTS, TARGET_SCORE, 
    INIT_ITEM_CARD,
    DAMAGE_BUST_PLAYER, DAMAGE_BUST_ENEMY,
    AI_GREEDY_LIMIT, AI_DEFENSIVE_LIMIT, AI_RANDOM_OFFSET,
    DELAY_SHORT, DELAY_MEDIUM, DELAY_STANDARD, DELAY_LONG, DELAY_XL, DELAY_TURN_END, DELAY_ITEM_USE,
    GOLD_REWARD_BASE, GOLD_REWARD_PERFECT, COST_UPGRADE_HP, COST_UPGRADE_INVENTORY,
    REWARD_POOL_SIZE, REWARD_PICK_LIMIT
} from '../constants';

interface GameContextType {
    gameState: GameState;
    rewardOptions: Item[];
    pickedIndices: number[];
    visualEffect: string;
    damageNumbers: DamageNumber[];
    isDealing: boolean;
    handAction: HandAction;
    enemyHandAction: HandAction;
    scoreAnimating: boolean;
    activeItemEffect: { item: Item, actor: 'PLAYER' | 'ENEMY' } | null;
    activeItemIndex: number | null;
    animatingEnvCard: { card: EnvironmentCard, state: 'entering' | 'holding' | 'exiting' } | null;
    clashState: ClashState;
    visibleEnvCount: number;
    metaState: MetaState;
    goldEarnedThisLevel: number;
    
    // Actions
    startRun: () => void;
    hit: (actor: 'PLAYER' | 'ENEMY') => Promise<void>;
    stand: (actor: 'PLAYER' | 'ENEMY') => void;
    useItem: (index: number, actor: 'PLAYER' | 'ENEMY') => Promise<void>;
    nextLevel: () => void;
    pickReward: (item: Item, index: number) => void;
    proceedToRewards: () => void; // Manual transition
    setGameState: React.Dispatch<React.SetStateAction<GameState>>; // Direct access if needed for cleanup
    triggerEffect: (effectClass: string) => void;
    spawnFloatingText: (value: number | string, target: 'PLAYER' | 'ENEMY', type: 'DAMAGE' | 'HEAL' | 'GOLD') => void;
    buyUpgrade: (type: 'HP' | 'INVENTORY') => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("useGame must be used within a GameProvider");
    return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>({
        phase: GamePhase.MENU,
        turnOwner: 'PLAYER',
        playerStood: false,
        enemyStood: false,
        roundCount: 0,
        runLevel: 1,
        targetScore: TARGET_SCORE,
        player: {
            hp: STARTING_HP,
            maxHp: STARTING_HP,
            hand: [],
            score: 0,
            shield: 0,
            inventory: [],
            maxInventory: MAX_INVENTORY_SLOTS,
            deckModifier: 0,
        },
        enemy: null,
        deck: [],
        discardPile: [],
        activeEnvironment: [],
        message: 'Welcome to Last Hand',
    });

    // Meta Progression State
    const [metaState, setMetaState] = useState<MetaState>(() => {
        const saved = localStorage.getItem('last_hand_meta');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse save data", e);
            }
        }
        return {
            gold: 0,
            upgrades: {
                hpLevel: 0,
                inventoryLevel: 0
            }
        };
    });

    // Sync Meta to LocalStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('last_hand_meta', JSON.stringify(metaState));
    }, [metaState]);

    const buyUpgrade = (type: 'HP' | 'INVENTORY') => {
        // Check affordability using current closure state for UI feedback
        const current = metaState;
        let cost = 0;
        let canAfford = false;

        if (type === 'HP') {
            cost = COST_UPGRADE_HP[current.upgrades.hpLevel];
        } else if (type === 'INVENTORY') {
            cost = COST_UPGRADE_INVENTORY[current.upgrades.inventoryLevel];
        }

        if (cost !== undefined && current.gold >= cost) {
            canAfford = true;
        }

        if (!canAfford) return;

        spawnFloatingText(`- ${cost} Gold`, 'PLAYER', 'DAMAGE');

        // Use functional update to ensure atomic changes
        setMetaState(prev => {
            const updates = { ...prev.upgrades };
            let newGold = prev.gold;
            let valid = false;
            
            // Re-check inside to be safe against race conditions
            if (type === 'HP') {
                const c = COST_UPGRADE_HP[updates.hpLevel];
                if (newGold >= c) {
                    updates.hpLevel += 1;
                    newGold -= c;
                    valid = true;
                }
            } else if (type === 'INVENTORY') {
                const c = COST_UPGRADE_INVENTORY[updates.inventoryLevel];
                if (newGold >= c) {
                    updates.inventoryLevel += 1;
                    newGold -= c;
                    valid = true;
                }
            }

            if (valid) return { gold: newGold, upgrades: updates };
            return prev;
        });
    };

    // Logic State
    const [rewardOptions, setRewardOptions] = useState<Item[]>([]);
    const [pickedIndices, setPickedIndices] = useState<number[]>([]);
    const [visualEffect, setVisualEffect] = useState<string>('');
    const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
    const [isDealing, setIsDealing] = useState(false);
    const [handAction, setHandAction] = useState<HandAction>('IDLE');
    const [enemyHandAction, setEnemyHandAction] = useState<HandAction>('IDLE');
    const [scoreAnimating, setScoreAnimating] = useState(false);
    const [activeItemEffect, setActiveItemEffect] = useState<{ item: Item, actor: 'PLAYER' | 'ENEMY' } | null>(null);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [animatingEnvCard, setAnimatingEnvCard] = useState<{ card: EnvironmentCard, state: 'entering' | 'holding' | 'exiting' } | null>(null);
    const [visibleEnvCount, setVisibleEnvCount] = useState(0);
    const [clashState, setClashState] = useState<ClashState>({
        active: false,
        playerScore: 0,
        enemyScore: 0,
        result: null
    });
    const [goldEarnedThisLevel, setGoldEarnedThisLevel] = useState(0);

    const processingAITurn = useRef(false);
    const resolvingRound = useRef(false);

    // --- Effects & Helpers ---

    const triggerEffect = (effectClass: string) => {
        setVisualEffect(prev => `${prev} ${effectClass}`);
        setTimeout(() => setVisualEffect(prev => prev.replace(effectClass, '').trim()), DELAY_MEDIUM);
    };

    const triggerHandAction = (action: HandAction, duration: number = 800) => {
        setHandAction(action);
        if (action !== 'LEAVE') {
            setTimeout(() => setHandAction('IDLE'), duration);
        }
    };

    const triggerEnemyHandAction = (action: HandAction, duration: number = 800) => {
        setEnemyHandAction(action);
        if (action !== 'LEAVE') {
            setTimeout(() => setEnemyHandAction('IDLE'), duration);
        }
    };

    const spawnFloatingText = (value: number | string, target: 'PLAYER' | 'ENEMY', type: 'DAMAGE' | 'HEAL' | 'GOLD') => {
        const id = Date.now().toString() + Math.random();
        const isPlayer = target === 'PLAYER';
        
        // Random offset for variety
        const randomX = (Math.random() * 40) - 20; 
        const randomY = (Math.random() * 20) - 10;

        let color = 'text-white';
        if (type === 'DAMAGE') color = isPlayer ? 'text-red-600' : 'text-yellow-400';
        if (type === 'HEAL') color = 'text-emerald-400';
        if (type === 'GOLD') color = 'text-amber-400 font-black text-3xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
        
        const prefix = type === 'HEAL' ? '+' : type === 'DAMAGE' && typeof value === 'number' ? '-' : '';
        
        const newItem: DamageNumber = {
            id,
            value: `${prefix}${value}`,
            target,
            style: {
                marginLeft: `${randomX}px`,
                marginTop: `${randomY}px`,
            },
            color,
            isGlitch: type === 'DAMAGE'
        };

        setDamageNumbers(prev => [...prev, newItem]);
        setTimeout(() => {
            setDamageNumbers(prev => prev.filter(p => p.id !== id));
        }, 4000); 
    };

    useEffect(() => {
        setScoreAnimating(true);
        const timer = setTimeout(() => setScoreAnimating(false), DELAY_SHORT);
        return () => clearTimeout(timer);
    }, [gameState.player.score]);

    // --- Core Logic ---

    const startRun = () => {
        const deck = createDeck();
        const envCards = getRandomEnvironment(0);
        setVisibleEnvCount(0);
        
        // Apply Upgrades
        const startingHp = STARTING_HP + metaState.upgrades.hpLevel;
        const maxInventory = MAX_INVENTORY_SLOTS;
        
        // Reset Hands
        setHandAction('IDLE');
        setEnemyHandAction('IDLE');

        setGameState({
            phase: GamePhase.BATTLE,
            turnOwner: 'PLAYER',
            playerStood: false,
            enemyStood: false,
            targetScore: TARGET_SCORE,
            roundCount: 1,
            runLevel: 1,
            player: {
                hp: startingHp,
                maxHp: startingHp,
                hand: [],
                score: 0,
                shield: 0,
                inventory: [], 
                maxInventory: maxInventory,
                deckModifier: 0,
            },
            enemy: getRandomEnemy(1),
            deck,
            discardPile: [],
            activeEnvironment: envCards,
            message: 'Run started!',
        });
    };

    const startRound = async () => {
        if (isDealing) return;
        setIsDealing(true);

        if (gameState.roundCount === 1 && visibleEnvCount < gameState.activeEnvironment.length) {
             const cardsToReveal = gameState.activeEnvironment;
             setGameState(prev => ({ ...prev, message: 'New Protocols Detected...' }));
             
             for (let i = visibleEnvCount; i < cardsToReveal.length; i++) {
                  const card = cardsToReveal[i];
                  setAnimatingEnvCard({ card, state: 'entering' });
                  await sleep(600); 
                  setAnimatingEnvCard({ card, state: 'holding' });
                  await sleep(DELAY_LONG); 
                  setAnimatingEnvCard({ card, state: 'exiting' });
                  await sleep(DELAY_MEDIUM); 
                  setVisibleEnvCount(prev => prev + 1);
                  setAnimatingEnvCard(null);
                  await sleep(DELAY_SHORT); 
             }
        }

        const deck = createDeck();
        
        setGameState(prev => ({
            ...prev,
            phase: GamePhase.BATTLE,
            deck,
            discardPile: [], 
            player: { ...prev.player, hand: [], score: 0, shield: 0 },
            enemy: prev.enemy ? { ...prev.enemy, hand: [], score: 0, shield: 0 } : null,
            turnOwner: 'PLAYER',
            playerStood: false,
            enemyStood: false,
            message: 'Dealing Hand...',
        }));

        await sleep(DELAY_LONG); 

        const targets: ('PLAYER' | 'ENEMY')[] = ['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY'];
        let currentDeck = [...deck];

        for (const target of targets) {
             if (currentDeck.length === 0) break;
             await sleep(DELAY_MEDIUM); 
             const card = currentDeck.pop()!;
             card.isFaceUp = false; 
             
             setGameState(prev => {
                 const pHand = [...prev.player.hand];
                 const eHand = [...(prev.enemy?.hand || [])];
                 if (target === 'PLAYER') pHand.push(card);
                 else eHand.push(card);
                 return {
                     ...prev,
                     deck: currentDeck,
                     player: { ...prev.player, hand: pHand },
                     enemy: prev.enemy ? { ...prev.enemy, hand: eHand } : null
                 };
             });
        }

        await sleep(DELAY_STANDARD); 

        setGameState(prev => {
            const pHand = prev.player.hand.map(c => ({ ...c, isFaceUp: true }));
            const eHand = prev.enemy!.hand.map((c, i) => i === 0 ? c : { ...c, isFaceUp: true }); 
            const pScore = calculateScore(pHand, prev.targetScore);
            const eScoreVisible = calculateScore(eHand.filter(c => c.isFaceUp), prev.targetScore);
            return {
                ...prev,
                player: { ...prev.player, hand: pHand, score: pScore },
                enemy: { ...prev.enemy!, hand: eHand, score: eScoreVisible },
                message: 'Loading Modules...'
            };
        });

        // Round=1. Deal item cards
        if (gameState.roundCount === 1) {
            // Enemy initial item cards
            if (gameState.enemy) {
                const enemyItemsToGrant = INIT_ITEM_CARD;
                for (let i = 0; i < enemyItemsToGrant; i++) {
                    await sleep(400);
                    const newItem = getRandomItems(1)[0];
                    setGameState(prev => {
                        if (!prev.enemy) return prev;
                        if (prev.enemy.inventory.length >= prev.enemy.maxInventory) return prev;
                        return {
                            ...prev,
                            enemy: {
                                ...prev.enemy,
                                inventory: [...prev.enemy.inventory, newItem]
                            }
                        };
                    });
                }
            }

            // Level=1, Round=1. Deal initial item cards to player
            if (gameState.runLevel === 1) {
                const baseItems = INIT_ITEM_CARD;
                const bonusItems = metaState.upgrades.inventoryLevel;
                const playerItemsToGrant = baseItems + bonusItems;

                for (let i = 0; i < playerItemsToGrant; i++) {
                    // Only grant if space available
                    if (gameState.player.inventory.length >= gameState.player.maxInventory) break;
                    
                    await sleep(400);
                    const newItem = getRandomItems(1)[0];
                    setGameState(prev => {
                         if (prev.player.inventory.length >= prev.player.maxInventory) return prev;
                         return {
                            ...prev,
                            player: {
                                ...prev.player,
                                inventory: [...prev.player.inventory, newItem]
                            }
                        };
                    });
                }
            }
        }

        await sleep(DELAY_MEDIUM);
        setGameState(prev => ({ ...prev, message: 'Your Turn.' }));
        setIsDealing(false);
    };

    const hit = async (actor: 'PLAYER' | 'ENEMY') => {
        if (isDealing) return;
        
        if (actor === 'PLAYER') triggerHandAction('HIT', 1000);
        else triggerEnemyHandAction('HIT', 1000);

        let drawnCardId: string | null = null;
        let deckEmpty = false;

        setGameState(prev => {
            const deck = [...prev.deck];
            if (deck.length === 0) {
                deckEmpty = true;
                return { ...prev, message: 'No cards left!' }; 
            }
            const card = deck.pop()!;
            card.isFaceUp = false; 
            drawnCardId = card.id;
            const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
            const entity = prev[entityKey]!;
            const newHand = [...entity.hand, card];
            let msg = actor === 'PLAYER' ? `You drew a card...` : `Enemy drew a card...`;
            const changes: Partial<GameState> = {};
            if (actor === 'PLAYER') changes.enemyStood = false;
            else changes.playerStood = false;

            return {
                ...prev,
                deck,
                [entityKey]: { ...entity, hand: newHand }, 
                message: msg,
                ...changes
            };
        });

        if (deckEmpty) return;

        setIsDealing(true);
        await sleep(1200); 

        setGameState(prev => {
             const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
             const entity = prev[entityKey]!;
             if (!entity) return prev;
             const hand = entity.hand.map(c => 
                 c.id === drawnCardId ? { ...c, isFaceUp: true } : c
             );
             const newScore = calculateScore(hand, prev.targetScore);
             const card = hand.find(c => c.id === drawnCardId);
             let msg = actor === 'PLAYER' ? `You drew ${card?.rank}${card?.suit}` : `Enemy drew ${card?.rank}${card?.suit}`;
             let nextTurnOwner: 'PLAYER' | 'ENEMY' = prev.turnOwner;
             if (actor === 'PLAYER') nextTurnOwner = prev.enemyStood ? 'PLAYER' : 'ENEMY';
             else nextTurnOwner = prev.playerStood ? 'ENEMY' : 'PLAYER';

             return {
                 ...prev,
                 [entityKey]: { ...entity, hand: hand, score: newScore },
                 turnOwner: nextTurnOwner,
                 message: msg
             };
        });
        
        setIsDealing(false);
    };

    const stand = (actor: 'PLAYER' | 'ENEMY') => {
        if (isDealing) return;
        if (actor === 'PLAYER') triggerHandAction('STAND');
        else triggerEnemyHandAction('STAND');

        setGameState(prev => {
            const isPlayer = actor === 'PLAYER';
            const nextTurnOwner = isPlayer ? 'ENEMY' : 'PLAYER';
            return {
                ...prev,
                playerStood: isPlayer ? true : prev.playerStood,
                enemyStood: !isPlayer ? true : prev.enemyStood,
                turnOwner: nextTurnOwner,
                message: `${actor} stands.`,
            };
        });
    };

    const useItem = async (index: number, actor: 'PLAYER' | 'ENEMY') => {
        if (isDealing || activeItemEffect || gameState.phase !== GamePhase.BATTLE) return;

        const entity = actor === 'PLAYER' ? gameState.player : gameState.enemy!;
        if (!entity || !entity.inventory[index]) return;
        const item = entity.inventory[index];

        setActiveItemIndex(index); // Hide card in inventory
        setActiveItemEffect({ item, actor });
        await sleep(DELAY_ITEM_USE);

        if (actor === 'PLAYER') triggerHandAction('USE');
        else triggerEnemyHandAction('USE');

        setGameState(prev => {
            const entityKey = actor === 'PLAYER' ? 'player' : 'enemy';
            const currentEntity = prev[entityKey]!;
            if (!currentEntity.inventory[index]) return prev;
            const itemToUse = currentEntity.inventory[index];
            const effectResult = itemToUse.effect(prev);
            
            if (effectResult[entityKey]?.hp !== undefined) {
                const diff = effectResult[entityKey]!.hp! - currentEntity.hp;
                if (diff > 0) spawnFloatingText(diff, actor, 'HEAL');
            }
            if (effectResult[entityKey]?.shield !== undefined) {
                const diff = effectResult[entityKey]!.shield! - currentEntity.shield;
                if (diff > 0) spawnFloatingText(`+${diff} Shield`, actor, 'HEAL');
            }

            const newInventory = [...currentEntity.inventory];
            newInventory.splice(index, 1);

            const changes: Partial<GameState> = {};
            if (actor === 'PLAYER') changes.enemyStood = false;
            else changes.playerStood = false;

            const nextState = {
                ...prev,
                ...effectResult,
                [entityKey]: {
                    ...prev[entityKey]!,
                    ...(effectResult[entityKey] || {}),
                    inventory: newInventory
                },
                ...(effectResult.player ? { player: { ...prev.player, ...effectResult.player, inventory: actor === 'PLAYER' ? newInventory : prev.player.inventory } } : {}),
                ...(effectResult.enemy ? { enemy: { ...prev.enemy!, ...effectResult.enemy, inventory: actor === 'ENEMY' ? newInventory : prev.enemy!.inventory } } : {}),
                ...changes 
            };

            nextState.player.score = calculateScore(nextState.player.hand, nextState.targetScore);
            if (nextState.enemy) nextState.enemy.score = calculateScore(nextState.enemy.hand, nextState.targetScore);

            return nextState;
        });
        setActiveItemIndex(null);
        setActiveItemEffect(null);
    };

    const processAITurn = async () => {
        const curr = gameState;
        if (!curr.enemy) {
            processingAITurn.current = false;
            return;
        }
        
        const trueScore = calculateScore(curr.enemy.hand, curr.targetScore);
        let shouldHit = false;

        switch (curr.enemy.aiType) {
            case 'GREEDY':
                if (trueScore < AI_GREEDY_LIMIT) shouldHit = true;
                break;
            case 'DEFENSIVE':
                if (trueScore < AI_DEFENSIVE_LIMIT) shouldHit = true;
                break;
            case 'RANDOM':
            default:
                if (trueScore < (curr.targetScore - AI_RANDOM_OFFSET)) {
                    shouldHit = true;
                } else if (trueScore >= curr.targetScore) {
                    shouldHit = false;
                } else {
                    shouldHit = Math.random() > 0.5;
                }
                break;
        }

        if (trueScore >= curr.targetScore) shouldHit = false;

        if (shouldHit) await hit('ENEMY');
        else stand('ENEMY');
        processingAITurn.current = false;
    };

    const resolveRound = async () => {
        processingAITurn.current = false;

        const pHand = gameState.player.hand.map(c => ({ ...c, isFaceUp: true }));
        const eHand = gameState.enemy!.hand.map(c => ({ ...c, isFaceUp: true }));
        const pScore = calculateScore(pHand, gameState.targetScore);
        const eScore = calculateScore(eHand, gameState.targetScore);

        setGameState(prev => ({
            ...prev,
            player: { ...prev.player, hand: pHand, score: pScore },
            enemy: { ...prev.enemy!, hand: eHand, score: eScore },
        }));

        let clashResult: 'player_win' | 'enemy_win' | 'draw' = 'draw';
        const pBust = pScore > gameState.targetScore;
        const eBust = eScore > gameState.targetScore;
        
        if (pBust && eBust) clashResult = 'draw';
        else if (pBust) clashResult = 'enemy_win';
        else if (eBust) clashResult = 'player_win';
        else {
            if (pScore > eScore) clashResult = 'player_win';
            else if (eScore > pScore) clashResult = 'enemy_win';
            else clashResult = 'draw';
        }

        setClashState({
            active: true,
            playerScore: pScore,
            enemyScore: eScore,
            result: clashResult
        });

        await sleep(DELAY_XL);
        setClashState(prev => ({ ...prev, active: false }));

        let damage = 0;
        let enemyDamage = 0;
        let winner: 'player' | 'enemy' | 'draw' = 'draw';
        let msg = '';

        if (pBust && eBust) {
            msg = "Both Busted! Draw.";
            winner = 'draw';
            triggerHandAction('HURT'); 
            triggerEnemyHandAction('HURT');
        } else if (pBust) {
            damage = DAMAGE_BUST_PLAYER;
            winner = 'enemy';
            msg = "You Busted!";
            triggerHandAction('HURT');
        } else if (eBust) {
            winner = 'player';
            enemyDamage = DAMAGE_BUST_ENEMY;
            msg = "Enemy Busted!";
            triggerEnemyHandAction('HURT');
        } else {
            if (pScore > eScore) {
                winner = 'player';
                enemyDamage = DAMAGE_BUST_ENEMY;
                msg = `You Win (${pScore} vs ${eScore})`;
                triggerEnemyHandAction('HURT');
            } else if (eScore > pScore) {
                winner = 'enemy';
                damage = DAMAGE_BUST_PLAYER;
                msg = `Enemy Wins (${eScore} vs ${pScore})`;
                triggerHandAction('HURT');
            } else {
                msg = "Draw.";
            }
        }

        let blocked = 0;
        let finalDamage = damage;
        
        if (finalDamage > 0) {
            if (gameState.player.shield > 0) {
                blocked = Math.min(finalDamage, gameState.player.shield);
                finalDamage -= blocked;
                if (blocked > 0) spawnFloatingText(`Blocked ${blocked}`, 'PLAYER', 'HEAL');
            }
            if (finalDamage > 0) {
                triggerEffect('animate-shake-hard animate-flash-red');
                spawnFloatingText(finalDamage, 'PLAYER', 'DAMAGE');
                triggerHandAction('HURT'); 
            }
        }
        if (winner === 'player') {
            spawnFloatingText(enemyDamage, 'ENEMY', 'DAMAGE');
            triggerEnemyHandAction('HURT');
            
            // Check for Perfect Score Bonus
            if (gameState.player.score === gameState.targetScore) {
                const bonus = GOLD_REWARD_PERFECT;
                setMetaState(prev => ({ ...prev, gold: prev.gold + bonus }));
                spawnFloatingText(`PERFECT! +${bonus} GOLD`, 'PLAYER', 'GOLD');
            }
        }

        const newHp = Math.max(0, gameState.player.hp - finalDamage);
        let newEnemyHp = gameState.enemy!.hp;
        if (winner === 'player') {
            newEnemyHp = Math.max(0, newEnemyHp - enemyDamage);
        }

        setGameState(prev => ({
             ...prev,
             player: { ...prev.player, hp: newHp },
             enemy: { ...prev.enemy!, hp: newEnemyHp },
             message: msg
        }));

        await sleep(DELAY_TURN_END);

        const enemyDied = newEnemyHp <= 0;
        let goldEarned = 0;

        if (enemyDied) {
            // --- RETREAT SEQUENCE ---
            // 1. Trigger "Leave" Animations for hands
            triggerHandAction('LEAVE', 2000);
            triggerEnemyHandAction('LEAVE', 2000);
            await sleep(1000); // Wait for slide out to happen

            // 2. Calculate Gold Rewards Early
            goldEarned += GOLD_REWARD_BASE;
            const levelBonus = Math.max(0, gameState.runLevel - 1);
            goldEarned += levelBonus;
            
            if (goldEarned > 0) {
                setMetaState(prev => ({
                    ...prev,
                    gold: prev.gold + goldEarned
                }));
            }
            setGoldEarnedThisLevel(goldEarned);

            // 3. Enter Victory Transition Phase (User must wait here)
            setGameState(prev => ({ ...prev, phase: GamePhase.VICTORY }));
            
            // NOTE: We do NOT transition to REWARD automatically anymore.
             
        } else {
            // --- NORMAL ROUND TRANSITION ---
            setGameState(prev => {
                if (prev.player.hp <= 0) return { ...prev, phase: GamePhase.GAME_OVER };
                
                return {
                    ...prev,
                    phase: GamePhase.BATTLE,
                    player: { ...prev.player, hand: [], score: 0, shield: 0 },
                    enemy: { ...prev.enemy!, hand: [], score: 0, shield: 0 },
                    discardPile: [],
                    playerStood: false,
                    enemyStood: false,
                    turnOwner: 'PLAYER',
                    roundCount: prev.roundCount + 1,
                    message: msg + " Next Round...",
                    deck: prev.deck
                };
            });
        }
        
        resolvingRound.current = false;
    };

    const proceedToRewards = () => {
        // 4. Prepare Rewards (5 items)
        setRewardOptions(getRandomItems(REWARD_POOL_SIZE));
        setPickedIndices([]);
        
        // 5. Transition to Reward UI
         setGameState(prev => ({
            ...prev,
            phase: GamePhase.REWARD,
            discardPile: [],
            deck: [],
            message: 'Enemy Defeated!',
            enemy: { ...prev.enemy!, hp: 0 }
         }));
    };

    const nextLevel = () => {
        const level = gameState.runLevel + 1;
        const deck = createDeck();

        let envCount = 0;
        if (level === 1) envCount = 0;
        else if (level === 2) envCount = 1;
        else if (level === 3) envCount = 2;
        else envCount = 3;
        
        const envCards = getRandomEnvironment(envCount);
        const startingHp = STARTING_HP + metaState.upgrades.hpLevel;

        setVisibleEnvCount(0);
        // Reset Hands to Idle for new level entry
        setHandAction('IDLE');
        setEnemyHandAction('IDLE');
        
        setGameState(prev => ({
            ...prev,
            runLevel: level,
            enemy: getRandomEnemy(level),
            deck: deck,
            discardPile: [],
            roundCount: 1,
            phase: GamePhase.BATTLE,
            turnOwner: 'PLAYER',
            playerStood: false,
            enemyStood: false,
            activeEnvironment: envCards,
            player: { ...prev.player, hp: startingHp, hand: [], score: 0, shield: 0 },
            message: `Level ${level} Started.`
        }));
    };
    
    const pickReward = (item: Item, index: number) => {
        if (pickedIndices.includes(index)) return;
        if (pickedIndices.length >= REWARD_PICK_LIMIT) return;

        if (gameState.player.inventory.length >= gameState.player.maxInventory) {
             spawnFloatingText("Inventory Full", "PLAYER", "DAMAGE");
             return;
        }
        const newPicked = [...pickedIndices, index];
        setPickedIndices(newPicked);
        setGameState(prev => ({
            ...prev,
            player: {
                ...prev.player,
                inventory: [...prev.player.inventory, item]
            }
        }));
    };

    useEffect(() => {
        if (gameState.phase !== GamePhase.BATTLE) return;

        if (gameState.playerStood && gameState.enemyStood && !resolvingRound.current) {
             resolvingRound.current = true;
             const timer = setTimeout(() => resolveRound(), DELAY_LONG);
             return () => clearTimeout(timer);
        }

        if (gameState.turnOwner === 'ENEMY' && !processingAITurn.current && !gameState.enemyStood && !isDealing) {
            processingAITurn.current = true;
            const timer = setTimeout(processAITurn, DELAY_XL); 
            return () => clearTimeout(timer);
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState.phase === GamePhase.BATTLE 
            && gameState.player.hand.length === 0 
            && !isDealing
            && gameState.roundCount > 0
            && !resolvingRound.current
        ) {
             setTimeout(() => startRound(), DELAY_STANDARD);
        }
    }, [gameState.phase, gameState.roundCount]);

    const value: GameContextType = {
        gameState, rewardOptions, pickedIndices, visualEffect, damageNumbers,
        isDealing, handAction, enemyHandAction, scoreAnimating, activeItemEffect, activeItemIndex,
        animatingEnvCard, clashState, visibleEnvCount, metaState, goldEarnedThisLevel,
        startRun, hit, stand, useItem, nextLevel, pickReward, setGameState,
        triggerEffect, spawnFloatingText, buyUpgrade, proceedToRewards
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
