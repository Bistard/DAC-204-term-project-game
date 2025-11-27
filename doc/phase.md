# Run / Battle / Round 分阶段推进方案（Phase Plan）
面向具备全自动开发能力的 AI Agent，以下阶段性计划覆盖 `refactor-plan#2.md` 中全部重构目标、状态拆分与模块迁移内容。每个阶段聚焦“需要完成的任务”与“任务目标”，Agent 可在执行时自行决定具体代码结构及算法实现。
---

## 阶段 0：全局基线与依赖梳理
- **目标**：梳理现有 `RoundService` / `CombatService` / `itemEffectService` 与文档中定义的 Run / Battle / Round 职责差异，为后续分层改造建立可追踪的基线。
- **需要完成的任务**
  - 盘点所有触达 GameState 的入口，记录 Run/Battle/Round 状态混用的场景，为拆分提供约束清单。
  - 收集 Penalty、Environment 与 Item 的运行期行为，明确它们当前写入的状态或直接操作的服务。
  - 输出迁移依赖图（重构期间必须同步调整的模块），并作为阶段交付物沉淀。
- **单元测试要求**
  - 基于当前 `RoundService` / `CombatService` / `itemEffectService` 的关键入口编写 smoke test，记录 GameState 读写路径与层级混用行为，形成防回归基线。
  - 为代表性的 Penalty / Environment / Item 组合建立快照断言，验证现有副作用与服务依赖映射，方便后续重构对照。

## 阶段 1：状态模型拆分与 Store 辅助函数
- **目标**：将顶层 GameState 拆为 `RunState` / `BattleState` / `RoundState`，并提供统一 helper，避免服务绕开层级直接改写。
- **需要完成的任务**
  - 在 `engine/state/` 下新增 `gameState.ts` 与 `gameStore.ts`，定义 `GameState` 与 `withRunState` / `withBattleState` / `withRoundState` 等只允许局部读写的 helper。
  - 为每个子状态提炼典型字段（Run：关键资源；Battle：敌人、RuleState、牌堆；Round：手牌、分数、当前出牌方），并保证 GameStore 仅暴露对应层级的访问接口。
  - 提供初始 DTO（`IBattleResult` / `IRoundResult`）与序列化骨架，供后续服务使用，但暂不接入旧实现。
- **单元测试要求**
  - 针对 `withRunState` / `withBattleState` / `withRoundState` helper 编写访问控制测试，确认 helper 只能读写所属子状态，越级访问会被拒绝。
  - 为 `IBattleResult` / `IRoundResult` 等 DTO 提供序列化与默认值测试，保证字段结构与初始数据在拆分过程中保持稳定。

## 阶段 2：目录与接口骨架搭建
- **目标**：完善 `engine/` 内的新层级目录与服务接口定义，使未来实现可以按模块增量迁移。
- **需要完成的任务**
  - 按目标结构创建 `run/`、`battle/`、`battle/rules/`、`battle/ai/`、`battle/rewards/`、`round/`、`round/items/` 等目录，搭建对应 `I*.ts` 与空实现文件。
  - 在每个接口文件中声明职责范围（Run 管生命周期与 `RunState`；Battle 负责回合循环、`BattleRuleState`、奖励生成；Round 管战术操作与 `IRoundResult`；Item 仅写 `RoundState` 与回合修正；RuleService 解释 Environment/Penalty；AI 仅输出决策），确保与 refactor plan 完全一致。
  - 更新 `engine/core/gameEngine.ts`（或占位文件）以引用新接口，保持旧实现仍可运行，例如通过 Adapter 继续指向旧服务。
- **单元测试要求**
  - 在 `engine/core/gameEngine.ts` 添加适配器层测试，验证旧服务可以通过新接口 wiring 正常工作。
  - 利用类型断言或 tsd 等工具为新增 `I*` 接口编写契约测试，确保输入/输出签名与职责说明一致。

## 阶段 3：Round 层与 Item Service 重构
- **目标**：将 Round 内逻辑和 Item 效果完全限制在 `RoundState` 范围内，产出可被 Battle 层复用的 `IRoundService`。
- **需要完成的任务**
  - 从旧 `roundService` 拆分并迁移基础逻辑至 `round/RoundService.ts`，确保仅依赖 `RoundState` 与 `IItemService`，并在回合结束时生成 `IRoundResult`（分数、爆牌、winner、回合修正等）。
  - 让 `itemEffectService` 演进为 `round/items/ItemService.ts`，注册 Item 与效果，限制调用者只能通过 Round 暴露的安全 context（如抽牌请求、round modifier setter）；禁止 Item 直接改写 `BattleState` 或更高层状态。
  - 在 Round 层实现 Hit / Stand / UseItem 流程控制，确保 Round 只暴露“回合修正输出”，例如 `damageAdjustments`、`damageImmunity`、`loserDamageBonus`。
- **单元测试要求**
  - 使用表驱动用例覆盖 `IRoundService` 的 Hit / Stand / UseItem 主流程，断言 `IRoundResult` 中分数、爆牌、winner 以及回合修正确认无误。
  - 为 `round/items/ItemService.ts` 编写隔离测试，确保 Item 只能通过 Round context 修改 `RoundState` 并正确产出 `damageAdjustments` 等修正，且不会写入 Battle/Run 层。

## 阶段 4：Battle 层与规则系统整合
- **目标**：让 Battle 层成为 Round、规则、AI 的唯一协调者，确保环境/惩罚只影响 Battle 级别逻辑。
- **需要完成的任务**
  - 将 `combatService` 重命名或迁移至 `battle/BattleService.ts`，缩减职责为回合循环、HP/护盾结算、胜负判定、Battle 奖励生成，不再内嵌 Round 细节。
  - 实现 `battle/rules/BattleRuleService.ts`，读取 Environment/Penalty 配置生成 `BattleRuleState`，并提供给 Battle 层结算；Round 层仅获得只读 `IRoundRuleContext`（目标分数、自动抽牌数、突然死亡阈值等）。
  - 接入 `IAiService`：Battle 在敌方回合获取决策，再通过 Round API 执行；AI 只能读取 `BattleState` 与 `RoundState` 的只读镜像，不得直接改写状态。
  - Battle 层组合 `IRoundResult` 与 `BattleRuleState` 计算 `playerHpDelta` / `enemyHpDelta` 等输出，最终返回 `IBattleResult`。
  - 在 `battle/rewards/` 中封装奖励逻辑，确保 Battle 结束后统一产出奖励 DTO，供 Run 层消费。
- **单元测试要求**
  - 为 `battle/BattleService.ts` 构建回合循环测试，验证 HP/护盾结算、规则应用与奖励生成在玩家胜利、敌人胜利、平局等场景下的正确性。
  - 编写 BattleRuleService 与 AI 的组合测试，确认 Environment/Penalty 仅影响 Battle 级别数据，AI 决策只能基于只读状态镜像。

## 阶段 5：Run 层与全局生命周期
- **目标**：让 Run 层聚焦一次完整 Run 的节奏控制，并通过新的 Battle 接口驱动战斗。
- **需要完成的任务**
  - 实现 `run/RunService.ts`：负责 Run 开始/结束、关卡推进、全局资源更新、Run 结果记录及奖励分发。
  - 在 Run 层构建 Battle 前的 `BattleContext`（敌人配置、环境/惩罚卡、奖励随机种子等），并调用 `IBattleService.startBattle`。
  - Run 层消费 `IBattleResult` 更新 `RunState`，根据返回结果决定下一步（继续下一关、进入结算、结束 Run）。
  - 接入 `IRewardService`（或 Battle 内奖励模块）以及任何全局天赋/永久加成逻辑，确保 Penalty/Environment 不在 Run 层被直接操控。
- **单元测试要求**
  - 通过 fake `IBattleService` 覆盖 RunService 的关卡推进、Run 终止与结算路径，验证 `RunState` 更新与奖励分发行为。
  - 为 `BattleContext` 构建器编写参数化测试，确保敌人配置、环境/惩罚卡与奖励随机种子被完整传递给 Battle 层，Run 层不越权修改。

## 阶段 6：集成、验证与遗留清理
- **目标**：完成新旧服务的切换，确保所有调用路径遵循分层规则并移除遗留重复概念。
- **需要完成的任务**
  - 在 `engine/core/gameEngine.ts` 中，用新服务组合替换 `RoundService` / `CombatService` 入口，并确保对外 API 不变或提供兼容层。
  - 编写针对 Run/Battle/Round 的分层单元测试与集成冒烟测试，覆盖典型场景：环境/惩罚修改、Item 回合修正、AI 决策、奖励派发等。
  - 移除或封存旧文件（例如旧目录下的 `combatService.ts`、`roundService.ts`、`itemEffectService.ts`），确认所有引用均指向新结构。
  - 更新文档（`refactor-plan.md`、`change-log.md`、`turn-by-turn-rule.md` 等）描述新的职责边界与目录结构。
- **单元测试要求**
  - 组建 Run/Battle/Round 的端到端分层测试套件（如使用 Vitest/Jest），覆盖环境/惩罚修改、Item 回合修正、AI 决策、奖励派发等关键流程。
  - 为兼容层与对外 API 编写回归测试，在移除旧文件前验证新服务组合保持外部契约不变。
---
以上阶段可按顺序推进，也可在保证依赖的前提下并行执行。完成判定取决于目标是否达成、约束是否严格遵守，而非具体实现细节。Agent 可根据实际代码状态调整粒度或拆分子任务，但不得跳过任何职责改造点。完成所有阶段后，Run / Battle / Round 将实现完全分层，环境/惩罚与 Item 的责任边界清晰，服务接口数量收敛，整体战斗引擎可测试性显著提升。
