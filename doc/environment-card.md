# Environment Cards & Rule Engine

> Version: 2025-11 · Maintainer: Codex  
> This note explains how the latest Environment Cards are defined, how the rule engine turns them into runtime hooks, and how card compatibility is enforced.

## 1. Runtime Flow

| Module | Responsibility |
| --- | --- |
| `content/environments.ts` | Declarative data for every Environment Card (`rules`, optional `incompatibleWith`). |
| `engine/utils.getRandomEnvironment` | Draws a compatible set of cards (re-rolls locally until no incompatible IDs appear together). |
| `engine/rules/environmentRuleEngine.ts` | Turns the selected cards into an `EnvironmentRuntimeState` (target overrides, bust rules, hooks, etc.). |
| `engine/utils.applyEnvironmentRules` | Applies the runtime to `GameState` at run/level start so all systems use a single source of truth. |
| `RoundService` | Reads `environmentRuntime` during draw, score, damage, and resolution phases (deck burn, auto hits, sudden death). |
| `RewardService` | Handles environment-driven rewards (e.g., extra items on perfect score). |
| `CombatService` | Blocks item usage when the runtime sets `itemLocks.disableUsage`. |
| `BattleScreen` | Displays scores using `environmentRuntime.scoreOptions` so the UI matches engine math. |

## 2. Compatibility Model

- Each card can declare `incompatibleWith?: string[]` pointing to other card IDs.
- `getRandomEnvironment(count)` shuffles the pool and greedily picks cards that remain pairwise compatible.  
  If a sampled set conflicts, it retries (up to 50 attempts) and returns the best compatible subset.  
  Because we filter at draw time, the runtime no longer needs `HARD/SOFT` tags, priorities, or disabled rules.
- If designers add a new mutual exclusion, simply list both IDs in `incompatibleWith`; the draw logic will honor it automatically.

## 3. Rule Attachment Points

| Feature | Runtime Hook |
| --- | --- |
| Target overrides | `runtime.targetRule` → `GameState.targetScore/baseTargetScore`. |
| Ace behavior & bust windows | `runtime.scoreOptions` → every `calculateScore(...)` call and `RoundService.isBust`. |
| Deck thinning | `runtime.deckMutators.randomRemovalsPerRound` at round start. |
| Auto draws | `runtime.drawHooks.autoDrawPerActor` immediately after opening hands. |
| Damage modifiers | `runtime.damageModifiers` → `RoundService.applyDamage`. |
| Sudden death | `runtime.victoryHooks.suddenDeathThreshold` → post-resolution HP check. |
| Item locks | `runtime.itemLocks.disableUsage` → `CombatService.useItem`. |
| Perfect rewards | `runtime.rewardHooks.perfectItemDraw` → `RewardService.applyEnvironmentPerfectReward`. |

`environmentRuntime.appliedCardIds` stays available for HUD/debug displays if you want to show which cards shaped the battle.

## 4. Current Card Lineup

| ID | Name | Summary |
| --- | --- | --- |
| `dynamic_target` | Dynamic Target | Re-rolls the target to 18/24/27 (incompatible with `specific_bust_17_18`). |
| `global_damage_plus_one` | Damage Surge | All damage gains +1 final value. |
| `sudden_death_low_hp` | Sudden Death (≤3 HP) | After resolution, anyone at or below 3 HP dies immediately. |
| `small_deck` | Small Deck | Burns 2 random cards from the deck at each round start. |
| `perfect_reward` | Perfect Bounty | Any perfect score grants +1 item draw. |
| `auto_hit` | Auto Hit | Round start auto-draw for both sides (incompatible with `no_items`). |
| `high_risk_ace` | High-Risk Ace | Aces always stay at 11 points. |
| `no_items` | Return to Classic | Item cards can’t be used this battle (incompatible with `auto_hit`). |
| `specific_bust_17_18` | Fragile Thresholds | Scores of 17 or 18 are treated as busts (incompatible with `dynamic_target`). |

## 5. Extension Tips

1. **Add a new card**  
   - Append to `content/environments.ts` with `rules` describing its effects.  
   - If it shouldn’t coexist with existing cards, list their IDs in `incompatibleWith`.
2. **Create a new rule type**  
   - Update `EnvironmentRuleType`, handle the new case inside `environmentRuleEngine.applyRule`, and extend `EnvironmentRuntimeState` if needed.
3. **Debugging**  
   - Inspect `GameState.environmentRuntime` to verify deck burn, auto draws, target overrides, etc.  
   - Log `environmentRuntime.appliedCardIds` to confirm the draw pipeline picked the expected cards.  
   - Runtime events (`combat:round.autoDraw`, `env.suddenDeath`, `reward.envPerfect`) remain useful breadcrumbs for QA.

With compatibility resolved at draw time, the runtime stays lean: every active card is guaranteed to cooperate, and designers only maintain simple ID-level exclusions instead of juggling priority systems.
