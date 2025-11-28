# SfxService Design & Integration (v0.4 - WAV clips)

This document captures the current sound-effect stack in **Last Hand**. The earlier procedural synthesizer has been replaced by a file-driven pipeline that plays short WAV clips. The goals remain the same:

- keep gameplay logic free from audio concerns by routing everything through `EventBus`
- map semantic actions (draw, clash, hurt, etc.) to reusable sound presets
- allow the runtime to toggle audio on/off or swap playback implementations without touching the rules layer
- ship with a self-contained default library (`assets/sfx/*.wav`) so the game sounds consistent out of the box

---

## 1. Runtime Building Blocks

| Layer | Responsibility |
| --- | --- |
| `EventBus` | Emits `GameEvent` instances from the engine |
| `SfxService` | Subscribes to the bus, translates events -> `SfxActionId[]`, owns the Web Audio player, and dispatches playback |

`SfxService` exposes an optional escape hatch for custom audio adapters but now ships with an embedded Web Audio backend. The dependency surface is:

```ts
interface AudioPlaybackHandle {
    stop(): void;
    finished: Promise<void>;
}

interface SfxServiceDeps {
    bus: EventBus;
    audio?: {
        preload(src: string): Promise<void> | void;
        play(src: string, options?: AudioPlaybackOptions): Promise<AudioPlaybackHandle | void> | AudioPlaybackHandle | void;
        stopAll(): void;
        dispose?: () => void | Promise<void>;
    };
    isEnabled?: () => boolean;  // hook for a mute toggle
    log?: (msg: string, extra?: unknown) => void; // optional logger
}
```

When `audio` is omitted, `SfxService` lazily instantiates a shared `AudioContext`, caches decoded buffers, resumes the context on demand, and tracks every playing source so disposal (or page reload) stops all sound immediately.

---

## 2. Actions & Configs

`SfxActionId` enumerates every semantic cue we care about (draw, hit, round outcome, penalty, UI, ...). Runtime mapping lives inside `SfxService.mapEventToActions`.

Each action gets a `SfxConfig`. The default implementation supports two shapes:

```ts
export interface AudioFileConfig {
    type: 'audio-file';
    src: string | readonly string[];     // WAV clip(s), e.g. imported via Vite
    volume?: number;                     // 0..1 scaling (default 1)
    playbackRate?: number | { min?: number; max?: number };
    loop?: boolean;
    preload?: boolean;                   // defaults to true
    stopActions?: readonly SfxActionId[]; // stop these actions before playing
}

export type SfxConfig = AudioFileConfig | SfxPlayFn; // custom handler hook
```

Helper:

```ts
const createAudioFileConfig = (src: string | readonly string[], options?: Omit<AudioFileConfig, 'type' | 'src'>) => ({
    type: 'audio-file',
    src,
    ...options,
});
```

Whenever an `audio-file` config is registered, the service preloads each referenced clip (unless `preload === false`) so the first playback is instant. During playback, `SfxService` keeps track of every active handle so it can stop by action (`stopActions`) or globally on dispose.

---

## 3. Default Presets & Assets

All built-in clips live under `assets/sfx/` and were generated specifically for this build. See `DEFAULT_SFX_PRESETS` in `engine/services/sfxService.ts` to view the mapping. Highlights:

- player vs. enemy draw/impact/hurt cues stay distinct for readability
- round win/lose/draw share a melodic palette but different cadence
- gold gain/spend, penalty, and environment events reuse a focused set of tonal clips
- UI click/error samples are included for manual triggers (`service.play('ui.click')`)
- `battle.victory` silences the looping saloon ambience (`round.start`) via `stopActions`, ensuring the win stinger plays over silence

Adding or tweaking sounds requires only:

1. Drop a new WAV file into `assets/sfx/` (or import from any static location Vite can bundle).
2. Import it in `sfxService.ts` (or a dedicated preset file) and update `DEFAULT_SFX_PRESETS`.
3. Optionally extend `mapEventToActions` if a new gameplay event should trigger it.

---

## 4. Event -> Action Mapping

The same routing rules from the earlier version still apply. Key routes inside `SfxService`:

- `hand.action` -> `hand.hit.*`, `hand.stand.*`, `hand.useItem.*`, `hand.hurt.*`
- `damage.number` -> `damage.*`, `heal.*`, `gold.gain/spend`
- `item.animation` (phase `START`) -> `hand.useItem.*`
- `environment.animation` -> `env.card.enter/exit`
- `penalty.card` -> `penalty.card.drawn/applied`
- `clash.state` -> `round.clash/win/lose/draw`
- `visual.effect` (fallback) -> `ui.error`

You can always call `sfxService.play('action.id')` manually to sync bespoke UI interactions.

---

## 5. React Integration (GameContext)

Within `GameProvider`:

```ts
const busRef = useRef(new EventBus());
const sfxRef = useRef<SfxService | null>(null);

useEffect(() => {
    if (!busRef.current || sfxRef.current) return;
    const sfx = new SfxService({
        bus: busRef.current,
        isEnabled: () => true,
    });
    registerDefaultSfxPresets(sfx);
    sfxRef.current = sfx;
    return () => sfx.dispose();
}, []);
```

Because both `EventBus` and `SfxService` live in refs, they persist across rerenders and only tear down when the provider unmounts. Calling `dispose()` now stops every playing `AudioBufferSourceNode`, so no clips leak across reloads.

---

## 6. Extending the System

- **Custom playback logic**: register an `SfxPlayFn` for procedural or multi-step sounds.
- **Alternate players**: pass a custom `audio` adapter into `SfxService` (e.g., Howler, Web MIDI) as long as it implements `preload`, `play`, and `stopAll`.
- **Per-action overrides**: the `SfxService` registry is mutable at runtime, so presets can be swapped after loading user config or applying accessibility settings.
- **Lazy bundles**: because clips are imported via Vite, they participate in code-splitting. Keep rarely used sounds in optional chunks if needed.

---

## 7. Testing Checklist

1. Verify that draw/impact/heal/win/loss cues play in the browser after the first user interaction (to unlock audio).
2. Toggle `isEnabled` return value to confirm the mute gate works without touching the registry.
3. Ensure new WAV files are referenced through imports so Vite copies them to the build output.
4. Run `rg -n "audio-file"` or inspect `DEFAULT_SFX_PRESETS` when debugging mismatched mappings.
5. Call `sfxService.dispose()` during hot reload or navigation and confirm all loops/ambience stops immediately.
6. Trigger `battle.victory` after a looping `round.start` and verify the ambience shuts off before the win cue plays.

With this setup, the entire audio surface area lives in a single service + preset list, making it easy to evolve the soundtrack without touching combat logic.
