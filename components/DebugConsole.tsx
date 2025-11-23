import React, { useEffect, useMemo, useState } from 'react';
import { ReplayFrame } from '../types';
import { useGame } from '../context/GameContext';

const HOTKEY_LABEL = 'Ctrl + Shift + D';
const SCROLL_STYLE_ID = 'debug-console-scroll-style';

const ensureScrollStyles = () => {
    if (typeof document === 'undefined' || document.getElementById(SCROLL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SCROLL_STYLE_ID;
    style.innerHTML = `
        .debug-console-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .debug-console-scroll::-webkit-scrollbar-track { background: #0f172a; border-radius: 6px; }
        .debug-console-scroll::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 6px; border: 1px solid #0f172a; }
        .debug-console-scroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    `;
    document.head.appendChild(style);
};

export const DebugConsole: React.FC = () => {
    const {
        actionLog,
        undo,
        redo,
        canUndo,
        canRedo,
        getHistory,
        loadHistory,
        replayHistory,
        resumeGame,
    } = useGame();

    const [open, setOpen] = useState(false);
    const [historyText, setHistoryText] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [delayMs, setDelayMs] = useState(350);
    const [isReplaying, setIsReplaying] = useState(false);

    useEffect(() => {
        ensureScrollStyles();
    }, []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
                event.preventDefault();
                setOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const latestLogs = useMemo(() => actionLog.slice().reverse().slice(0, 30), [actionLog]);

    const updateStatus = (message: string) => {
        setStatus(message);
        window.setTimeout(() => setStatus(null), 4000);
    };

    const saveHistory = () => {
        const frames = getHistory();
        setHistoryText(JSON.stringify(frames, null, 2));
        updateStatus(`Saved ${frames.length} frames to buffer`);
    };

    const parseHistoryPayload = (): ReplayFrame[] | null => {
        if (!historyText.trim()) {
            updateStatus('History buffer is empty');
            return null;
        }
        try {
            const parsed = JSON.parse(historyText) as ReplayFrame[];
            if (!Array.isArray(parsed) || parsed.length === 0) {
                updateStatus('History payload must be a non-empty array');
                return null;
            }
            return parsed;
        } catch (error) {
            updateStatus(`Parse failed: ${(error as Error).message}`);
            return null;
        }
    };

    const handleLoadHistory = () => {
        const frames = parseHistoryPayload();
        if (!frames) return;
        loadHistory(frames, { applyState: true });
        updateStatus(`Loaded ${frames.length} frames`);
    };

    const handleReplay = async () => {
        let frames: ReplayFrame[] | null = null;
        if (historyText.trim()) {
            frames = parseHistoryPayload();
            if (!frames) return;
        } else {
            frames = getHistory();
        }

        if (!frames || frames.length === 0) {
            updateStatus('No frames available for replay');
            return;
        }

        setIsReplaying(true);
        try {
            await replayHistory({ frames, delayMs: Math.max(0, delayMs) });
            updateStatus(`Replayed ${frames.length} frames`);
        } catch (error) {
            updateStatus(`Replay failed: ${(error as Error).message}`);
        } finally {
            setIsReplaying(false);
        }
    };

    const handleUndo = () => {
        undo();
        updateStatus('Moved one step backward');
    };

    const handleRedo = () => {
        redo();
        updateStatus('Moved one step forward');
    };

    const handleResume = () => {
        resumeGame();
        updateStatus('Runtime resumed from current frame');
    };

    if (!open) {
        return (
            <button
                className="fixed bottom-5 right-5 z-[200] px-4 py-2 text-sm bg-black/80 text-white rounded shadow-lg hover:bg-black/90 transition"
                onClick={() => setOpen(true)}
            >
                Debug Panel ({HOTKEY_LABEL})
            </button>
        );
    }

    return (
        <div className="fixed bottom-5 right-5 z-[999] w-[460px] max-h-[92vh] bg-[#0b1120] text-[#f3f4f6] border border-[#1f2937] rounded-xl shadow-2xl flex flex-col text-base">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2937] text-lg font-semibold">
                <span>Debug Console</span>
                <button onClick={() => setOpen(false)} className="text-[#9ca3af] hover:text-white text-xl leading-none">
                    ×
                </button>
            </div>

            <div className="p-4 flex flex-col gap-4 text-[0.95rem] overflow-y-auto debug-console-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #0b1120' }}>
                <div>
                    <div className="font-semibold mb-2 text-sm text-[#9ca3af]">Controls</div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleUndo}
                            disabled={!canUndo}
                            className={`px-4 py-1.5 rounded-lg border text-sm font-semibold ${
                                canUndo ? 'border-[#6ee7b7] text-[#6ee7b7]' : 'border-[#374151] text-[#4b5563] cursor-not-allowed'
                            }`}
                        >
                            Undo
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={!canRedo}
                            className={`px-4 py-1.5 rounded-lg border text-sm font-semibold ${
                                canRedo ? 'border-[#fcd34d] text-[#fcd34d]' : 'border-[#374151] text-[#4b5563] cursor-not-allowed'
                            }`}
                        >
                            Redo
                        </button>
                        <button onClick={saveHistory} className="px-4 py-1.5 rounded-lg border text-sm font-semibold border-[#60a5fa] text-[#60a5fa]">
                            Save History
                        </button>
                        <button onClick={handleLoadHistory} className="px-4 py-1.5 rounded-lg border text-sm font-semibold border-[#a78bfa] text-[#a78bfa]">
                            Load History
                        </button>
                        <button
                            onClick={handleReplay}
                            disabled={isReplaying}
                            className={`px-4 py-1.5 rounded-lg border text-sm font-semibold ${
                                isReplaying ? 'border-[#374151] text-[#4b5563] cursor-wait' : 'border-[#34d399] text-[#34d399]'
                            }`}
                        >
                            {isReplaying ? 'Replaying...' : 'Replay'}
                        </button>
                        <button onClick={handleResume} className="px-4 py-1.5 rounded-lg border text-sm font-semibold border-[#f87171] text-[#f87171]">
                            Continue Run
                        </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-[#9ca3af]">
                        <label htmlFor="delay-input" className="whitespace-nowrap">
                            Replay delay (ms)
                        </label>
                        <input
                            id="delay-input"
                            type="number"
                            min={0}
                            value={delayMs}
                            onChange={event => setDelayMs(Number(event.target.value) || 0)}
                            className="w-24 bg-[#111827] border border-[#374151] rounded px-2 py-1 text-[#f3f4f6]"
                        />
                    </div>
                </div>

                <div>
                    <div className="font-semibold mb-2 text-sm text-[#9ca3af]">Action Log</div>
                    <div
                        className="max-h-44 overflow-y-auto border border-[#1f2937] rounded-lg p-3 text-sm space-y-2 bg-[#0f172a] debug-console-scroll"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #0b1120' }}
                    >
                        {latestLogs.length === 0 && <div className="text-[#4b5563]">No log entries yet.</div>}
                        {latestLogs.map(entry => (
                            <div key={entry.id} className="border-b border-[#1f2937] pb-2 last:border-b-0 last:pb-0">
                                <div className="flex justify-between text-xs text-[#9ca3af]">
                                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                    <span>{entry.tag ?? 'store:update'}</span>
                                </div>
                                <div className="text-[#f9fafb]">{entry.description}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="font-semibold mb-2 text-sm text-[#9ca3af]">History Buffer</div>
                    <textarea
                        className="w-full h-40 bg-[#0f172a] border border-[#1f2937] rounded-lg p-3 text-sm font-mono resize-none text-[#f3f4f6] debug-console-scroll"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #0b1120' }}
                        value={historyText}
                        onChange={event => setHistoryText(event.target.value)}
                        placeholder="Click Save History to dump frames..."
                    />
                </div>

                {status && <div className="text-sm text-[#fbbf24]">{status}</div>}
                <div className="text-xs text-[#6b7280]">Hotkey: {HOTKEY_LABEL}</div>
            </div>
        </div>
    );
};
