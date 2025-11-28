# SfxService Design & Integration (v0.2 – WAV clips)

This document captures the second iteration of the sound-effect stack in **Last Hand**. The previous procedural synthesizer has been replaced by a file-driven pipeline that plays short WAV clips. The goals remain the same:

- keep gameplay logic free from audio concerns by routing everything through `EventBus`
- map semantic actions (draw, clash, hurt, etc.) to reusable sound presets
- allow the runtime to toggle audio on/off or swap playback implementations without touching the rules layer
- ship with a self-contained default library (`assets/sfx/*.wav`) so the game sounds consistent out of the box

---

## 1. Runtime Building Blocks

| Layer | Responsibility |
| --- | --- |
| `EventBus` | Emits `GameEvent` instances from the engine |
| `SfxService` | Subscribes to the bus, translates events → `SfxActionId[]`, and dispatches playback |
| `AudioClipPlayer` (`common/audio/audioClipPlayer.ts`) | Loads WAV files (once), resumes the shared `AudioContext`, and plays clips with per-call options |

`SfxService` depends only on two callbacks:

```ts
interface SfxServiceDeps {
    bus: EventBus;
    playAudio: (src: string, options?: AudioPlaybackOptions) => void | Promise<void>;
    preloadAudio?: (src: string) => void | Promise<void>;
    isEnabled?: () => boolean;  // hook for a mute toggle
    log?: (msg: string, extra?: unknown) => void; // optional logger
}
```

`AudioClipPlayer` exposes exactly what `SfxService` needs:

```ts
const player = createAudioClipPlayer();
player.preload('/assets/sfx/card-draw-player.wav');
player.play('/assets/sfx/card-draw-player.wav', { volume: 0.8, playbackRate: 1.05 });
```

The player caches decoded buffers and resumes the browser `AudioContext` lazily after the first user gesture, preventing repeated fetch/decode overhead.

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
}

export type SfxConfig = AudioFileConfig | SfxPlayFn; // custom handler hook
```

Helper:

```ts
const createAudioFileConfig = (src: string, options?: Omit<AudioFileConfig, 'type' | 'src'>) => ({
    type: 'audio-file',
    src,
    ...options,
});
```

When an `audio-file` config is registered, the service optionally preloads every referenced clip via `deps.preloadAudio`.

---

## 3. Default Presets & Assets

All built-in clips live under `assets/sfx/` and were generated specifically for this build. See `DEFAULT_SFX_PRESETS` in `engine/services/sfxService.ts` to view the mapping. Highlights:

- player vs. enemy draw/impact/hurt cues stay distinct for readability
- round win/lose/draw share a melodic palette but different cadence
- gold gain/spend, penalty, and environment events reuse a focused set of tonal clips
- UI click/error samples are included for manual triggers (`service.play('ui.click')`)

Adding or tweaking sounds requires only:

1. Drop a new WAV file into `assets/sfx/` (or import from any static location Vite can bundle).
2. Import it in `sfxService.ts` (or a dedicated preset file) and update `DEFAULT_SFX_PRESETS`.
3. Optionally extend `mapEventToActions` if a new gameplay event should trigger it.

---

## 4. Event → Action Mapping

The same routing rules from the earlier version still apply. Key routes inside `SfxService`:

- `hand.action` → `hand.hit.*`, `hand.stand.*`, `hand.useItem.*`, `hand.hurt.*`
- `damage.number` → `damage.*`, `heal.*`, `gold.gain/spend`
- `item.animation` (phase `START`) → `hand.useItem.*`
- `environment.animation` → `env.card.enter/exit`
- `penalty.card` → `penalty.card.drawn/applied`
- `clash.state` → `round.clash/win/lose/draw`
- `visual.effect` (fallback) → `ui.error`

You can always call `sfxService.play('action.id')` manually to sync bespoke UI interactions.

---

## 5. React Integration (GameContext)

Within `GameProvider`:

```ts
const audioPlayerRef = useRef(createAudioClipPlayer());
const busRef = useRef(new EventBus());

useEffect(() => {
    if (!busRef.current || !audioPlayerRef.current) return;
    const sfx = new SfxService({
        bus: busRef.current,
        playAudio: (src, options) => audioPlayerRef.current!.play(src, options),
        preloadAudio: src => audioPlayerRef.current!.preload(src),
        isEnabled: () => true,
    });
    registerDefaultSfxPresets(sfx);
    sfxRef.current = sfx;
    return () => sfx.dispose();
}, []);
```

Because both `EventBus` and `SfxService` live in refs, they persist across rerenders and only tear down when the provider unmounts.

---

## 6. Extending the System

- **Custom playback logic**: register an `SfxPlayFn` for procedural or multi-step sounds.
- **Alternate players**: swap `createAudioClipPlayer` with another implementation (e.g., WebAudio sampler, Howler, Web MIDI) as long as it exposes the same two callbacks.
- **Per-action overrides**: the `SfxService` registry is mutable at runtime—replace presets after loading user config or applying accessibility settings.
- **Lazy bundles**: because clips are imported via Vite, they participate in code-splitting. Keep rarely used sounds in optional chunks if needed.

---

## 7. Testing Checklist

1. Verify that draw/impact/heal/win/loss cues play in the browser after the first user interaction (to unlock audio).
2. Toggle `isEnabled` return value to confirm the mute gate works without touching the registry.
3. Ensure new WAV files are referenced through imports so Vite copies them to the build output.
4. Run `rg -n "audio-file"` or inspect `DEFAULT_SFX_PRESETS` when debugging mismatched mappings.

With this setup, the entire audio surface area lives in a single service + preset list, making it easy to evolve the soundtrack without touching combat logic.
