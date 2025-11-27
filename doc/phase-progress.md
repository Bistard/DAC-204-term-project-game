# Phase Progress Log

Running notes for the Run/Battle/Round refactor phases. Dates in ISO format.

---

## Stage 0 Deliverables (2025-11-26)
### 0.1 GameState Read/Write Snapshot
- **RoundService** (`engine/services/roundService.ts`) drives `startRun`, `startRound`, and `clearRoundModifiers`, so it currently touches run-, battle-, and round-level data at once (initializing `GameState`, resetting decks/hands, managing `roundModifiers` + `penaltyRuntime`).
- **CombatService** (`engine/services/combatService.ts`) coordinates `hit` / `stand` / `useItem` and mutates round-level flags directly while delegating draw/reveal logic to RoundService and item logic to ItemEffectService.
- **ItemEffectService** (`engine/services/itemEffectService.ts`) is the sole entry point for items; it updates `roundModifiers` and combatant HP/shield/inventory moments before RoundService resolves damage.
- This audit gives us the authoritative field-to-layer map that Stage 1 helpers enforce.

### 0.2 Penalty / Environment / Item Pipelines
- **Penalty** data (`content/penalties.ts`) plugs into `RoundService.resolveDamage`, which executes `activePenalty.damageFunction` and persists streak state via `penaltyRuntime.lastWinner` / `.consecutiveWins`.
- **Environment** cards (`content/environments.ts`) feed `engine/utils.applyEnvironmentRules` so both RoundService and RewardService agree on target overrides, deck shrink, auto-draw, item lock, and sudden-death thresholds.
- **Item** definitions (`content/items.ts`) map into the handler registry inside ItemEffectService, keeping RoundService as the only consumer that can mutate `RoundState` through item usage.

### 0.3 Run / Battle / Round Field Baseline
- **Run**: `phase`, `runLevel`, `message`, `rewardOptions`, `pickedRewardIndices`, `goldEarnedThisLevel`.
- **Battle**: `roundCount`, `activeEnvironment`, `environmentRuntime`, `activePenalty`, `penaltyRuntime`, `player`, `enemy`, `deck`, `discardPile`, `environmentDisabledCards`.
- **Round**: `turnOwner`, `playerStood`, `enemyStood`, `targetScore`, `baseTargetScore`, `roundModifiers`.
- These slices match the new helper lenses so a layer can only write its own subset.

### 0.4 Smoke Tests
- New Vitest smoke suites under `engine/services/__tests__/` (`roundService.smoke.test.ts`, `combatService.smoke.test.ts`, `itemEffectService.smoke.test.ts`) capture the current damage-adjustment, stand, and round-resolution behaviors before deeper refactors.

---

## Stage 1 Deliverables (State Model & Store)
- `engine/state/gameState.ts` introduces `RunState` / `BattleState` / `RoundState` lenses plus `extract*`/`with*` helpers that deep-clone data to preserve layer isolation.
- `engine/state/gameStore.ts` now exposes `updateRunState`, `updateBattleState`, and `updateRoundState`, delegating to the helpers so callers no longer mutate `GameState` directly.
- `engine/state/results.ts` defines `IRoundResult` / `IBattleResult` DTOs and default factories (`createDefaultRoundResult`, `createDefaultBattleResult`) for serialization and later adapters.
- Tooling: Vitest config (`package.json`, `tsconfig.json`, `vitest.config.ts`) plus unit suites under `engine/state/__tests__/` validate the helper contracts while the Stage 0 smoke tests freeze existing service behavior.
