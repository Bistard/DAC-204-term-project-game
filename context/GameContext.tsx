
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { DELAY_SHORT } from '../common/constants';
import { EventBus } from '../engine/eventBus';
import { GameEngine } from '../engine/gameEngine';
import {
    ClashState,
    DamageNumber,
    EnvironmentCard,
    GameLogEntry,
    GameState,
    HandAction,
    Item,
    MetaState,
    LoadHistoryOptions,
    RecordingOptions,
    ReplayFrame,
    ReplayOptions,
    TurnOwner,
    PenaltyCard,
} from '../common/types';

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
    activeItemEffect: { item: Item; actor: TurnOwner } | null;
    activeItemIndex: number | null;
    animatingEnvCard: { card: EnvironmentCard; state: 'entering' | 'holding' | 'exiting' } | null;
    animatingPenaltyCard: { card: PenaltyCard; state: 'entering' | 'holding' | 'exiting' } | null;
    clashState: ClashState;
    visibleEnvCount: number;
    penaltyRevealed: boolean;
    metaState: MetaState;
    goldEarnedThisLevel: number;
    lastPenaltyEvent: { card: PenaltyCard; state: 'DRAWN' | 'APPLIED'; detail?: string } | null;
    startRun: () => void;
    hit: (actor: TurnOwner) => Promise<void> | void;
    stand: (actor: TurnOwner) => void;
    useItem: (index: number, actor: TurnOwner) => Promise<void> | void;
    nextLevel: () => void;
    pickReward: (item: Item, index: number) => void;
    proceedToRewards: () => void;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    buyUpgrade: (type: 'HP' | 'INVENTORY') => void;
    actionLog: GameLogEntry[];
    canUndo: boolean;
    canRedo: boolean;
    isRecording: boolean;
    undo: () => void;
    redo: () => void;
    startRecording: (options?: RecordingOptions) => void;
    stopRecording: () => ReplayFrame[];
    replayHistory: (options?: ReplayOptions) => Promise<void>;
    getRecording: () => ReplayFrame[];
    getHistory: () => ReplayFrame[];
    loadHistory: (frames: ReplayFrame[], options?: LoadHistoryOptions) => void;
    resumeGame: () => void;
}

const defaultClashState: ClashState = {
    active: false,
    playerScore: 0,
    enemyScore: 0,
    result: null,
};

const META_STORAGE_KEY = 'last_hand_meta';

const loadMetaState = (): MetaState => {
    if (typeof window === 'undefined') {
        return { gold: 0, upgrades: { hpLevel: 0, inventoryLevel: 0 } };
    }
    const stored = localStorage.getItem(META_STORAGE_KEY);
    if (!stored) return { gold: 0, upgrades: { hpLevel: 0, inventoryLevel: 0 } };
    try {
        return JSON.parse(stored) as MetaState;
    } catch {
        return { gold: 0, upgrades: { hpLevel: 0, inventoryLevel: 0 } };
    }
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [metaState, setMetaState] = useState<MetaState>(() => loadMetaState());
    const metaStateRef = useRef(metaState);
    useEffect(() => {
        metaStateRef.current = metaState;
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metaState));
    }, [metaState]);

    const busRef = useRef<EventBus | null>(null);
    if (!busRef.current) {
        busRef.current = new EventBus();
    }

    const engineRef = useRef<GameEngine | null>(null);
    if (!engineRef.current) {
        engineRef.current = new GameEngine({
            eventBus: busRef.current!,
            getMetaState: () => metaStateRef.current,
            updateMetaState: updater => {
                setMetaState(prev => {
                    const next = updater(prev);
                    metaStateRef.current = next;
                    return next;
                });
            },
        });
    }
    const engine = engineRef.current!;

    const [snapshot, setSnapshot] = useState(engine.snapshot);
    const [storeDiagnostics, setStoreDiagnostics] = useState(() => ({
        actionLog: engine.getActionLog(50),
        canUndo: engine.canUndo(),
        canRedo: engine.canRedo(),
        isRecording: engine.isRecording(),
    }));
    useEffect(() => {
        const unsubscribe = engine.subscribe(nextSnapshot => {
            setSnapshot(nextSnapshot);
            setStoreDiagnostics({
                actionLog: engine.getActionLog(50),
                canUndo: engine.canUndo(),
                canRedo: engine.canRedo(),
                isRecording: engine.isRecording(),
            });
        });
        return unsubscribe;
    }, [engine]);

    const [visualEffect, setVisualEffect] = useState('');
    const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
    const [handAction, setHandAction] = useState<HandAction>('IDLE');
    const [enemyHandAction, setEnemyHandAction] = useState<HandAction>('IDLE');
    const [activeItemEffect, setActiveItemEffect] = useState<{ item: Item; actor: TurnOwner } | null>(null);
    const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
    const [animatingEnvCard, setAnimatingEnvCard] =
        useState<{ card: EnvironmentCard; state: 'entering' | 'holding' | 'exiting' } | null>(null);
    const [animatingPenaltyCard, setAnimatingPenaltyCard] =
        useState<{ card: PenaltyCard; state: 'entering' | 'holding' | 'exiting' } | null>(null);
    const [visibleEnvCount, setVisibleEnvCount] = useState(0);
    const [penaltyRevealed, setPenaltyRevealed] = useState(true);
    const [clashState, setClashState] = useState<ClashState>(defaultClashState);
    const [scoreAnimating, setScoreAnimating] = useState(false);
    const [lastPenaltyEvent, setLastPenaltyEvent] = useState<{ card: PenaltyCard; state: 'DRAWN' | 'APPLIED'; detail?: string } | null>(null);

    const pushDamageNumber = useCallback((value: number | string, target: TurnOwner, variant: 'DAMAGE' | 'HEAL' | 'GOLD') => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const randomX = Math.floor(Math.random() * 60) - 30;
        const randomY = Math.floor(Math.random() * 40) - 20;
        const color =
            variant === 'DAMAGE'
                ? 'text-red-500'
                : variant === 'GOLD'
                ? 'text-amber-300'
                : 'text-emerald-300';

        const entry: DamageNumber = {
            id,
            value: typeof value === 'number' ? value.toString() : value,
            target,
            style: { marginLeft: `${randomX}px`, marginTop: `${randomY}px` },
            color,
            isGlitch: variant === 'DAMAGE',
        };

        setDamageNumbers(prev => [...prev, entry]);
        window.setTimeout(() => {
            setDamageNumbers(prev => prev.filter(item => item.id !== id));
        }, 4000);
    }, []);

    const playerActionTimer = useRef<number | null>(null);
    const enemyActionTimer = useRef<number | null>(null);

    useEffect(() => {
        const bus = busRef.current!;
        return bus.subscribe(event => {
            switch (event.type) {
                case 'hand.action': {
                    const setter = event.payload.actor === 'PLAYER' ? setHandAction : setEnemyHandAction;
                    const timerRef = event.payload.actor === 'PLAYER' ? playerActionTimer : enemyActionTimer;
                    setter(event.payload.action);
                    if (timerRef.current) clearTimeout(timerRef.current);
                    timerRef.current = window.setTimeout(
                        () => setter('IDLE'),
                        event.payload.duration ?? 800
                    );
                    break;
                }
                case 'visual.effect': {
                    setVisualEffect(event.payload.effect);
                    window.setTimeout(() => setVisualEffect(''), event.payload.duration ?? 500);
                    break;
                }
                case 'damage.number': {
                    pushDamageNumber(event.payload.value, event.payload.target, event.payload.variant);
                    break;
                }
                case 'item.animation': {
                    if (event.payload.phase === 'START') {
                        setActiveItemEffect({ item: event.payload.item, actor: event.payload.actor });
                        setActiveItemIndex(event.payload.index ?? null);
                    } else {
                        setActiveItemEffect(null);
                        setActiveItemIndex(null);
                    }
                    break;
                }
                case 'environment.animation': {
                    setAnimatingEnvCard(event.payload);
                    if (event.payload.state === 'exiting') {
                        window.setTimeout(() => {
                            setVisibleEnvCount(prev => prev + 1);
                            setAnimatingEnvCard(null);
                        }, 200);
                    }
                    break;
                }
                case 'penalty.animation': {
                    setAnimatingPenaltyCard(event.payload);
                    if (event.payload.state === 'entering') {
                         setPenaltyRevealed(false);
                    }
                    if (event.payload.state === 'exiting') {
                        window.setTimeout(() => {
                            setPenaltyRevealed(true);
                            setAnimatingPenaltyCard(null);
                        }, 200);
                    }
                    break;
                }
                case 'clash.state': {
                    setClashState(event.payload);
                    break;
                }
                case 'penalty.card': {
                    setLastPenaltyEvent(event.payload);
                    if (event.payload.state === 'APPLIED') {
                        setTimeout(() => setLastPenaltyEvent(null), 1500);
                    }
                    break;
                }
                default:
                    break;
            }
        });
    }, [pushDamageNumber]);

    useEffect(() => {
        setScoreAnimating(true);
        const timer = window.setTimeout(() => setScoreAnimating(false), DELAY_SHORT);
        return () => clearTimeout(timer);
    }, [snapshot.state.player.score]);

    useEffect(() => {
        if (snapshot.state.roundCount === 1 && snapshot.state.player.hand.length === 0) {
            setVisibleEnvCount(0);
        }
    }, [snapshot.state.roundCount, snapshot.state.player.hand.length]);

    const setGameState = useCallback<React.Dispatch<React.SetStateAction<GameState>>>(
        updater => {
            if (typeof updater === 'function') {
                engine.updateState(prev => (updater as (prev: GameState) => GameState)(prev));
            } else {
                engine.updateState(() => updater);
            }
        },
        [engine]
    );

    const startRun = useCallback(() => engine.startRun(), [engine]);
    const hit = useCallback((actor: TurnOwner) => engine.hit(actor), [engine]);
    const stand = useCallback((actor: TurnOwner) => engine.stand(actor), [engine]);
    const useItem = useCallback((index: number, actor: TurnOwner) => engine.useItem(index, actor), [engine]);
    const nextLevel = useCallback(() => engine.nextLevel(), [engine]);
    const pickReward = useCallback((item: Item, index: number) => engine.pickReward(item, index), [engine]);
    const proceedToRewards = useCallback(() => engine.proceedToRewards(), [engine]);
    const buyUpgrade = useCallback((type: 'HP' | 'INVENTORY') => engine.buyUpgrade(type), [engine]);
    const undo = useCallback(() => engine.undo(), [engine]);
    const redo = useCallback(() => engine.redo(), [engine]);
    const startRecording = useCallback((options?: RecordingOptions) => engine.startRecording(options), [engine]);
    const stopRecording = useCallback(() => engine.stopRecording(), [engine]);
    const replayHistory = useCallback((options?: ReplayOptions) => engine.replay(options), [engine]);
    const getRecording = useCallback(() => engine.getRecording(), [engine]);
    const getHistory = useCallback(() => engine.getHistory(), [engine]);
    const loadHistory = useCallback(
        (frames: ReplayFrame[], options?: LoadHistoryOptions) => engine.loadHistory(frames, options),
        [engine]
    );
    const resumeGame = useCallback(() => engine.resumeGame(), [engine]);

    const value = useMemo<GameContextType>(() => {
        const gameState = snapshot.state;
        return {
            gameState,
            rewardOptions: gameState.rewardOptions,
            pickedIndices: gameState.pickedRewardIndices,
            visualEffect,
            damageNumbers,
            isDealing: snapshot.flags.isDealing,
            handAction,
            enemyHandAction,
            scoreAnimating,
            activeItemEffect,
            activeItemIndex,
            animatingEnvCard,
            animatingPenaltyCard,
            clashState,
            visibleEnvCount,
            penaltyRevealed,
            metaState,
            goldEarnedThisLevel: gameState.goldEarnedThisLevel,
            lastPenaltyEvent,
            startRun,
            hit,
            stand,
            useItem,
            nextLevel,
            pickReward,
            proceedToRewards,
            setGameState,
            buyUpgrade,
            actionLog: storeDiagnostics.actionLog,
            canUndo: storeDiagnostics.canUndo,
            canRedo: storeDiagnostics.canRedo,
            isRecording: storeDiagnostics.isRecording,
            undo,
            redo,
            startRecording,
            stopRecording,
            replayHistory,
            getRecording,
            getHistory,
            loadHistory,
            resumeGame,
        };
    }, [
        snapshot,
        visualEffect,
        damageNumbers,
        handAction,
        enemyHandAction,
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
        startRun,
        hit,
        stand,
        useItem,
        nextLevel,
        pickReward,
        proceedToRewards,
        setGameState,
        buyUpgrade,
        storeDiagnostics,
        undo,
        redo,
        startRecording,
        stopRecording,
        replayHistory,
        getRecording,
        getHistory,
        loadHistory,
        resumeGame,
    ]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
