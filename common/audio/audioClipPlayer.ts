export interface AudioPlaybackOptions {
    volume?: number;
    playbackRate?: number;
    loop?: boolean;
}

export interface AudioClipPlayer {
    preload(src: string): Promise<void>;
    play(src: string, options?: AudioPlaybackOptions): Promise<void>;
    setMasterVolume(volume: number): void;
}

interface AudioClipPlayerOptions {
    masterVolume?: number;
    log?: (msg: string, extra?: unknown) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createAudioClipPlayer = (
    options: AudioClipPlayerOptions = {}
): AudioClipPlayer => {
    let masterVolume = clamp(options.masterVolume ?? 1, 0, 1);
    const log = options.log ?? ((msg: string, extra?: unknown) => console.warn(msg, extra));
    const bufferCache = new Map<string, Promise<AudioBuffer | null>>();
    let resumePromise: Promise<void> | null = null;
    let audioContext: AudioContext | null = null;

    const ensureAudioContext = (): AudioContext | null => {
        if (typeof window === 'undefined') return null;
        if (!audioContext) {
            const ctor =
                window.AudioContext ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!ctor) {
                log('[AudioClipPlayer] Web Audio API is unavailable');
                return null;
            }
            audioContext = new ctor();
        }
        if (audioContext.state === 'suspended' && !resumePromise) {
            resumePromise = audioContext
                .resume()
                .catch(error => {
                    log('[AudioClipPlayer] Failed to resume AudioContext', error);
                })
                .finally(() => {
                    resumePromise = null;
                });
        }
        return audioContext;
    };

    const decodeBuffer = (ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> => {
        if (typeof ctx.decodeAudioData === 'function') {
            return new Promise(resolve => {
                ctx.decodeAudioData(
                    arrayBuffer,
                    buffer => resolve(buffer),
                    error => {
                        log('[AudioClipPlayer] Failed to decode audio buffer', error);
                        resolve(null);
                    }
                );
            });
        }
        return Promise.resolve(null);
    };

    const fetchBuffer = (src: string): Promise<AudioBuffer | null> => {
        let pending = bufferCache.get(src);
        if (pending) return pending;
        const ctx = ensureAudioContext();
        if (!ctx) {
            pending = Promise.resolve(null);
            bufferCache.set(src, pending);
            return pending;
        }
        pending = fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch audio clip: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => decodeBuffer(ctx, arrayBuffer))
            .catch(error => {
                bufferCache.delete(src);
                log('[AudioClipPlayer] Failed to load audio source', { src, error });
                return null;
            });
        bufferCache.set(src, pending);
        return pending;
    };

    return {
        async preload(src: string) {
            await fetchBuffer(src);
        },
        async play(src: string, options?: AudioPlaybackOptions) {
            const ctx = ensureAudioContext();
            if (!ctx) return;
            const buffer = await fetchBuffer(src);
            if (!buffer) return;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            if (typeof options?.playbackRate === 'number' && Number.isFinite(options.playbackRate)) {
                source.playbackRate.value = clamp(options.playbackRate, 0.25, 4);
            }
            if (options?.loop) {
                source.loop = true;
            }
            const gain = ctx.createGain();
            const volume = typeof options?.volume === 'number' ? options.volume : 1;
            gain.gain.value = clamp(volume * masterVolume, 0, 1);
            source.connect(gain).connect(ctx.destination);
            source.start();
        },
        setMasterVolume(volume: number) {
            masterVolume = clamp(volume, 0, 1);
        },
    };
};
