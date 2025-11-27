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

## Stage 2 Deliverables (Directory & Interface Scaffolding) - 2025-11-26
- Target tree established under `engine/run`, `engine/battle`, and `engine/round` (including `battle/ai`, `battle/rewards`, `battle/rules`, `round/items`), with interface stubs such as `engine/run/IRunService.ts`, `engine/battle/IBattleService.ts`, `engine/round/IRoundService.ts`, and DTO helpers (`BattleState`, `BattleRuleState`, etc.) that describe each layer’s responsibilities.
- Legacy services are re-exported through their new homes (`engine/battle/BattleService.ts`, `engine/battle/rewards/RewardService.ts`, `engine/round/RoundService.ts`, `engine/round/items/ItemService.ts`) so current behavior remains untouched while callers can begin depending on the new paths.
- Shared rule utilities have been relocated to `engine/battle/rules/environmentRuleEngine.ts`, with placeholder files for `IBattleRuleService`, `BattleRuleService`, and `penaltyRuleEngine.ts` to host future logic.
- A thin adapter `engine/run/RunService.ts` now composes the legacy `CombatService` + `RewardService` through the `IRunService` facade; `engine/gameEngine.ts` depends on this interface instead of the raw services, preserving existing external APIs while isolating run-level commands.
- Added `engine/run/__tests__/runService.test.ts` (Vitest) to prove the adapter delegates to the correct underlying services, keeping regression coverage in place as the wiring shifts.

## Stage 3 Deliverables (Round & Item Service Migration) - 2025-11-26
- Moved the full `RoundService` implementation into `engine/round/RoundService.ts`, updated all consumers (`CombatService`, `AiService`, test fixtures, etc.) to import from the new location, and ensured the dependency on `RewardService` resolves through `engine/battle/rewards/RewardService`.
- Relocated `ItemEffectService` into `engine/round/items/ItemService.ts`, fixed import roots (`../../eventBus`, `../../../common/types`, etc.), and rewired `CombatService` plus the smoke tests to depend on the new module path.
- Vacuumed up the old stub re-exports so `engine/services/` no longer shadows round/item logic; Vitest smoke suites (`engine/services/__tests__/roundService.smoke.test.ts`, `itemEffectService.smoke.test.ts`) were refreshed to cover the new import graph and continue locking current behavior.
- RoundService now emits `IRoundResult` snapshots via an `onRoundComplete` callback, ItemService operates exclusively through RoundService’s round-context API (heal/shield/inventory/target-score adjustments) without mutating `GameState` directly, and BattleService records each `IRoundResult` (`getRoundResults()`) to feed later aggregation.

## Stage 4 Deliverables (Battle Service & Wiring) - 2025-11-26
- Promoted the legacy `CombatService` into `engine/battle/BattleService.ts` and retyped it to implement `IBattleService`, with dependencies now referencing `engine/battle/ai/*` and `engine/battle/rewards/IRewardService` instead of the old services folder.
- Updated all call sites/tests (`engine/run/RunService.ts` already targeted the battle module; smoke tests now instantiate `BattleService` directly) so `engine/services/combatService.ts` could be removed.
- Ensured imports across `AiService`, round/item modules, and Vitest suites point at the new battle structure; reran `npm run test` to confirm the battle lifecycle still behaves identically after the move.
- BattleService now records each `IRoundResult`, builds an `IBattleResult` when a battle concludes, and exposes a result handler (`setBattleResultHandler`) which RunService registers to keep RunState in sync.
- `engine/battle/rules/BattleRuleService.ts` interprets environment rule metadata (damage modifiers, target overrides, item locks, auto-draw, sudden death), and `AiService` only receives a sanitized battle view plus flag callbacks rather than the entire `GameStore`.

## Stage 5 Deliverables (Run Layer Ownership) - 2025-11-26
- `engine/run/RunService.ts` now performs full run bootstrap: it resets the store, builds a `BattleContext` (enemy, deck, environment, penalty, player HP), and calls `IBattleService.startBattle` instead of mutating round/battle state directly.
- `engine/battle/BattleService.ts` implements `startBattle(context)` by applying the context to `GameState`, emitting penalty events, and kicking off the first round; `IBattleService`/`IRoundService` interfaces were updated accordingly, and `BattleContext` lives under `engine/battle/BattleContext.ts`.
- `RunService.handleBattleResult` persists `IBattleResult` data back into `RunState`, while its tests (`engine/run/__tests__/runService.test.ts`) now mock the battle interface to assert context hand-off and result handling.
