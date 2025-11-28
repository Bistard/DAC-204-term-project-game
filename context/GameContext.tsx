
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
import { SfxService, registerDefaultSfxPresets } from '../engine/services/sfxService';
import { GameEngine } from '../engine/gameEngine';
import {
    ClashState,
    DamageNumber,
    EnvironmentCard,
    GameLogEntry,
    GameMode,
    GameState,
    HandAction,
    Item,
    MetaState,
    SaveSlotId,
    SaveSlotState,
    SaveSystemState,
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
    isBattleExiting: boolean;
    saveSlots: SaveSlotState[];
    activeSlotId: SaveSlotId;
    startRun: (mode: GameMode) => void;
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
    selectSaveSlot: (slotId: SaveSlotId) => void;
}

const defaultClashState: ClashState = {
    active: false,
    playerScore: 0,
    enemyScore: 0,
    result: null,
};

const META_STORAGE_KEY = 'last_hand_meta';
const PRIMARY_SLOT_ID: SaveSlotId = 'slot-1';
const SAVE_SLOT_IDS: SaveSlotId[] = ['slot-1', 'slot-2', 'slot-3'];
const SAVE_SLOT_LABELS: Record<SaveSlotId, string> = {
    'slot-1': 'Slot 1',
    'slot-2': 'Slot 2',
    'slot-3': 'Slot 3',
};

const createEmptyMetaState = (): MetaState => ({
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
});

const cloneMetaState = (meta: MetaState): MetaState => ({
    gold: typeof meta.gold === 'number' ? meta.gold : 0,
    upgrades: {
        hpLevel: meta.upgrades?.hpLevel ?? 0,
        inventoryLevel: meta.upgrades?.inventoryLevel ?? 0,
    },
});

const createSlotState = (id: SaveSlotId, meta?: MetaState): SaveSlotState => {
    const now = Date.now();
    return {
        id,
        label: SAVE_SLOT_LABELS[id],
        meta: cloneMetaState(meta ?? createEmptyMetaState()),
        createdAt: now,
        lastUpdated: meta ? now : null,
    };
};

const createDefaultSaveData = (): SaveSystemState => {
    const slots = SAVE_SLOT_IDS.reduce((acc, id) => {
        acc[id] = createSlotState(id);
        return acc;
    }, {} as Record<SaveSlotId, SaveSlotState>);
    return { activeSlotId: PRIMARY_SLOT_ID, slots };
};

const isMetaStatePayload = (value: unknown): value is MetaState => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as MetaState;
    const upgrades = candidate.upgrades;
    return (
        typeof candidate.gold === 'number' &&
        !!upgrades &&
        typeof upgrades === 'object' &&
        typeof upgrades.hpLevel === 'number' &&
        typeof upgrades.inventoryLevel === 'number'
    );
};

const isSaveSystemStatePayload = (value: unknown): value is SaveSystemState => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as SaveSystemState;
    if (!candidate.slots || typeof candidate.slots !== 'object') return false;
    return typeof candidate.activeSlotId === 'string';
};

const normalizeSaveData = (raw: SaveSystemState): SaveSystemState => {
    const now = Date.now();
    const slots = SAVE_SLOT_IDS.reduce((acc, id) => {
        const slot = raw.slots?.[id];
        acc[id] = {
            id,
            label: SAVE_SLOT_LABELS[id],
            meta: cloneMetaState(slot?.meta ?? createEmptyMetaState()),
            createdAt: typeof slot?.createdAt === 'number' ? slot.createdAt : now,
            lastUpdated: typeof slot?.lastUpdated === 'number' ? slot.lastUpdated : null,
        };
        return acc;
    }, {} as Record<SaveSlotId, SaveSlotState>);
    const activeSlotId = SAVE_SLOT_IDS.includes(raw.activeSlotId) ? raw.activeSlotId : PRIMARY_SLOT_ID;
    return { activeSlotId, slots };
};

const loadSaveData = (): SaveSystemState => {
    if (typeof window === 'undefined') {
        return createDefaultSaveData();
    }
    const stored = localStorage.getItem(META_STORAGE_KEY);
    if (!stored) return createDefaultSaveData();
    try {
        const parsed = JSON.parse(stored);
        if (isSaveSystemStatePayload(parsed)) {
            return normalizeSaveData(parsed);
        }
        if (isMetaStatePayload(parsed)) {
            const defaults = createDefaultSaveData();
            defaults.slots[PRIMARY_SLOT_ID] = {
                ...defaults.slots[PRIMARY_SLOT_ID],
                meta: cloneMetaState(parsed),
                lastUpdated: Date.now(),
            };
            defaults.activeSlotId = PRIMARY_SLOT_ID;
            return defaults;
        }
    } catch (error) {
        console.warn('[GameContext] Failed to parse save data', error);
    }
    return createDefaultSaveData();
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [saveData, setSaveData] = useState<SaveSystemState>(() => loadSaveData());
    const activeSlotId = saveData.activeSlotId;
    const activeSlot = saveData.slots[activeSlotId] ?? createSlotState(activeSlotId);
    const metaState = activeSlot.meta;
    const metaStateRef = useRef(metaState);

    useEffect(() => {
        metaStateRef.current = metaState;
    }, [metaState]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(saveData));
    }, [saveData]);

    const updateActiveSlotMeta = useCallback((updater: (prev: MetaState) => MetaState) => {
        setSaveData(prev => {
            const slot = prev.slots[prev.activeSlotId];
            if (!slot) return prev;
            const updatedMeta = cloneMetaState(updater(slot.meta));
            const hasChanged =
                updatedMeta.gold !== slot.meta.gold ||
                updatedMeta.upgrades.hpLevel !== slot.meta.upgrades.hpLevel ||
                updatedMeta.upgrades.inventoryLevel !== slot.meta.upgrades.inventoryLevel;
            if (!hasChanged) return prev;
            return {
                ...prev,
                slots: {
                    ...prev.slots,
                    [slot.id]: {
                        ...slot,
                        meta: updatedMeta,
                        lastUpdated: Date.now(),
                    },
                },
            };
        });
    }, []);

    const selectSaveSlot = useCallback((slotId: SaveSlotId) => {
        if (!SAVE_SLOT_IDS.includes(slotId)) return;
        setSaveData(prev => {
            if (prev.activeSlotId === slotId) return prev;
            return { ...prev, activeSlotId: slotId };
        });
    }, []);

    const saveSlots = useMemo(
        () => SAVE_SLOT_IDS.map(id => saveData.slots[id] ?? createSlotState(id)),
        [saveData]
    );

    const busRef = useRef<EventBus | null>(null);
    const sfxRef = useRef<SfxService | null>(null);
    if (!busRef.current) {
        busRef.current = new EventBus();
    }

    useEffect(() => {
        if (!busRef.current || sfxRef.current) return;
        const sfx = new SfxService({
            bus: busRef.current,
            isEnabled: () => true,
        });
        registerDefaultSfxPresets(sfx);
        sfxRef.current = sfx;
        return () => {
            sfx.dispose();
            sfxRef.current = null;
        };
    }, []);

    const instantiateEngine = useCallback(
        () =>
            new GameEngine({
                eventBus: busRef.current!,
                getMetaState: () => metaStateRef.current,
                updateMetaState: updateActiveSlotMeta,
            }),
        [updateActiveSlotMeta]
    );

    const [engine, setEngine] = useState<GameEngine>(() => instantiateEngine());
    const engineBootstrappedRef = useRef(false);
    useEffect(() => {
        if (!engineBootstrappedRef.current) {
            engineBootstrappedRef.current = true;
            return;
        }
        setEngine(instantiateEngine());
    }, [instantiateEngine, activeSlotId]);

    const [snapshot, setSnapshot] = useState(engine.snapshot);
    const [storeDiagnostics, setStoreDiagnostics] = useState(() => ({
        actionLog: engine.getActionLog(50),
        canUndo: engine.canUndo(),
        canRedo: engine.canRedo(),
        isRecording: engine.isRecording(),
    }));
    useEffect(() => {
        setSnapshot(engine.snapshot);
        setStoreDiagnostics({
            actionLog: engine.getActionLog(50),
            canUndo: engine.canUndo(),
            canRedo: engine.canRedo(),
            isRecording: engine.isRecording(),
        });
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
    const [visiblePenaltyId, setVisiblePenaltyId] = useState<string | null>(
        () => snapshot.state.activePenalty?.id ?? null
    );
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
                        setVisiblePenaltyId(null);
                    }
                    if (event.payload.state === 'exiting') {
                        window.setTimeout(() => {
                            setVisiblePenaltyId(event.payload.card.id);
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
                    if (event.payload.state === 'DRAWN') {
                        setVisiblePenaltyId(null);
                    }
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

    useEffect(() => {
        if (!snapshot.state.activePenalty) {
            setVisiblePenaltyId(null);
        }
    }, [snapshot.state.activePenalty]);

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

    const startRun = useCallback((mode: GameMode) => engine.startRun(mode), [engine]);
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

    const currentPenaltyId = snapshot.state.activePenalty?.id ?? null;
    const penaltyRevealed = Boolean(currentPenaltyId && visiblePenaltyId === currentPenaltyId);

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
            saveSlots,
            activeSlotId,
            goldEarnedThisLevel: gameState.goldEarnedThisLevel,
            lastPenaltyEvent,
            isBattleExiting: snapshot.flags.isBattleExiting,
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
            selectSaveSlot,
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
        saveSlots,
        activeSlotId,
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
        selectSaveSlot,
    ]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
