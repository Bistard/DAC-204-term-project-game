# 重构计划 v2：Run / Battle / Round 分层战斗引擎

本计划在现有 `RoundService` / `CombatService` 的基础上，收敛重复概念，明确 Run / Battle / Round 的分工，并给出目标目录结构与具体架构设计，供后续迭代逐步落实。

---

## 1. 重构目标（精炼版）

- 将「一局 Run / 单场 Battle / 单个 Round」严格分层，减少跨层写状态的耦合。
- 明确硬规则：
  - Penalty / Environment 只影响 Battle 级规则与结算。
  - Item 只影响 Round 内行为与本回合结算结果。
- 拆分状态结构：RunState / BattleState + BattleRuleState / RoundState，便于按层做单元测试。
- 收敛服务职责：用少量清晰的服务接口（IRunService / IBattleService / IRoundService / IBattleRuleService / IItemService / IAiService 等）覆盖全部战斗流程。

---

## 2. 分层职责与调用方向

### 2.1 Run 层（IRunService / RunService）

- 职责
  - 管理一次完整 Run 的生命周期：开始、关卡推进、结束与结算。
  - 维护 `RunState`：地图/楼层进度、玩家升级/天赋、全局资源、本次 Run 结果。
  - 为每一场战斗组装初始 `BattleContext`（敌人类型、初始环境/惩罚卡、奖励种子等），调用 `IBattleService.startBattle`。
  - 接收 `IBattleResult`，更新 `RunState` 并决定：继续下一关 / 进入结算 / 结束 Run。

- 调用关系
  - 依赖：`IBattleService`、`IRewardService`。
  - 无法感知 `RoundState`、`RoundService`。

### 2.2 Battle 层（IBattleService / BattleService）

- 职责
  - 管理单场 Battle 的生命周期：初始化 → 回合循环 → 伤害结算 → 胜负判定 → Battle 级奖励生成。
  - 维护 `BattleState`：敌人信息、当前 HP/护盾、牌堆/弃牌堆、当前 Environment/Penalty 运行时状态等。
  - 持有并驱动 `IBattleRuleService`：把环境卡/惩罚卡解释成 `BattleRuleState`，并基于规则进行数值结算。
  - 驱动 `IRoundService`：开始新回合、接收 `IRoundResult`，再结合 `BattleRuleState` 完成一次「从 Round 结果到 HP 变化」的数学计算。
  - 驱动 `IAiService`：当轮到敌方行动时向 AI 请求决策，再用 Round 层暴露的 API 执行动作。

- 调用关系
  - 依赖：`IBattleRuleService`、`IRoundService`、`IAiService`、`IRewardService`。
  - 被谁调用：`IRunService`。
  - Round 层只返回 `IRoundResult`，不直接改 HP，不直接看 Environment / Penalty 细节。

### 2.3 Round 层（IRoundService / RoundService）

- 职责
  - 管理单个 Round 内的战术行为与回合内状态。
  - 维护 `RoundState`：双方法术/手牌/分数、当前出牌方、是否 Stand、回合级 buff/debuff 等。
  - 实现 Hit / Stand / 使用 Item 等操作的流程控制。
  - 通过 `IItemService` 解释 Item 效果，只允许：
    - 读写 `RoundState`。
    - 写入「回合结算修正」(如 damageAdjustments / damageImmunity / loserDamageBonus 等) 这种 **Round → Battle 的只读输出**。
  - 在回合结束时计算本回合结果，产出 `IRoundResult`：
    - 玩家/敌人是否爆牌、分数、谁赢/平局、是否完美分等。
    - Round 级修正（如「本回合输家额外受伤 +X」）。

- 调用关系
  - 被 `IBattleService` 调用。
  - 依赖：`IItemService`，只能通过接口访问 Item 效果。

### 2.4 规则与 AI 层

- `IBattleRuleService / BattleRuleService`
  - 输入：Environment / Penalty 卡列表 + 运行时事件（连胜数、回合号等）。
  - 输出：`BattleRuleState`（计分规则、牌堆规则、伤害系数、突然死亡阈值、Item 使用锁定等）。
  - 向 Round 层暴露只读的 `IRoundRuleContext`（目标分数、自动抽牌数量等）。

- `IAiService / AiService`
  - 输入：战斗快照（BattleState + RoundState 的只读视图）。
  - 输出：敌方行动决策（Hit / Stand / UseItem(index)）。
  - 不直接改任何状态，只把决策交给 Battle 层，由 Battle 层通过 Round API 落实。

- `IItemService / ItemService`
  - 维护 Item → 效果配置的注册表。
  - 提供 `applyItemEffects(item, actor, context)`：
    - context 仅允许访问 Round 层暴露的、安全的变更函数（如 `updateRoundModifiers`、`requestDrawCard` 等）。
    - 不直接操作 `BattleState` / `RunState`。

---

## 3. 状态模型设计（GameState 拆分）

### 3.1 顶层 GameState

```ts
interface GameState {
  run: RunState | null;
  battle: BattleState | null;
  round: RoundState | null;
}
```

- 通过统一的 `GameStore` 管理，但业务只通过各层服务访问对应子状态。
- 禁止在服务内部直接拼/改整个 `GameState`，改为使用专门的读写 helper（例如 `withRunState` / `withBattleState` / `withRoundState`）。

### 3.2 RunState

- 典型字段
  - 当前关卡/楼层号、分支路线信息。
  - 玩家元数据：升级等级、解锁内容、永久加成等。
  - 全局资源：金币、碎片、钥匙等。
  - Run 结果：进行中 / 通关 / 失败（含失败原因）。

### 3.3 BattleState

- 典型字段
  - 敌人数据、玩家数据
  - 当前环境卡/惩罚卡及其运行时状态。
  - 牌堆状态
  - `BattleRuleState`：由 `IBattleRuleService` 维护的规则快照。
  - Battle 内统计：已进行回合数、连胜次数、是否触发突然死亡等。

### 3.4 RoundState

- 典型字段
  - 玩家/敌人手牌与分数。
  - 当前出牌方、是否 Stand。
  - 回合计数（在 Battle 内的第几回合）。

### 3.5 结果与 DTO

- `IBattleResult`
  - 举例：
    - winner（PLAYER / ENEMY / DRAW）
    - roundsPlayed、playerHpDelta、enemyHpDelta、是否完美胜利等。
    - battleRewards（候选奖励 DTO）。

- `IRoundResult`
  - 举例：
    - playerScore / enemyScore、是否爆牌、winner。
    - isPerfect、是否触发特殊规则（如突然死亡）。

---

## 4. 目标目录结构（重构后）

> 以现有 `engine/` 为基础，逐步迁移；旧文件可在过渡期保留（例如 `combatService.ts` → `battle/BattleService.ts`）再删除。

```text
engine/
  core/
    eventBus.ts
    gameEngine.ts          # 组装各层服务，对外提供统一入口
    utils.ts

  state/
    gameStore.ts
    gameState.ts           # 仅定义 GameState/RunState/BattleState/RoundState 及 helper

  run/
    IRunService.ts
    RunService.ts
    runState.ts            # 可选：Run 专属类型拆出

  battle/
    IBattleService.ts
    BattleService.ts       # 原 combatService 的重命名 + 职责收缩
    BattleState.ts         # Battle 专属辅助类型

    rules/
      IBattleRuleService.ts
      BattleRuleService.ts
      BattleRuleState.ts
      environmentRuleEngine.ts   # 现有环境规则引擎迁移整合
      penaltyRuleEngine.ts       # 惩罚卡 → BattleRuleState 的适配层

    ai/
      IAiService.ts
      AiService.ts

    rewards/
      IRewardService.ts
      RewardService.ts      # 现有 rewardService 迁移至此

  round/
    IRoundService.ts
    RoundService.ts         # 现有 roundService 拆分、缩小为 Round-only
    RoundState.ts

    items/
      IItemService.ts
      ItemService.ts        # 由 itemEffectService 演化而来
```
