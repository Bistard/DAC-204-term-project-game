# 重构计划：Run / Battle / Round 分层服务架构（更新版）

本文件用于指导本项目战斗系统的整体架构重构，内容基于目前为止的所有讨论和共识，覆盖：

- Run / Battle / Round 三层的职责边界  
- Penalty / Environment / Item / AI / 奖励 等系统的归属  
- RunState / BattleState / RoundState 状态拆分思路  
- BattleRuleService / itemService 等核心模块的定位  
- 分阶段实施计划（每个阶段都必须编写 / 更新单元测试）

工程师可以直接据此实施重构。

---

## 1. 重构目标

- 将一次 Run、单场 Battle、单个 Round 的逻辑严格分层，降低耦合、提高可维护性。
- 严格贯彻设计硬规则：
  - Penalty / Environment 卡只影响当前 Battle 的整体规则与结算；
  - Item 卡只影响当前 Round 内的即时行为与结算。
- 使用 RunState / BattleState / RoundState 拆分状态结构，让每一层都能单独做单元测试。
- 简化服务与目录结构（例如合并 PenaltyEngine、合并 Item 相关服务），以后再视需要细分。

---

## 2. 设计原则

1. **严格分层调用**
   - `RunService`：负责一次 Run 的完整生命周期（开始、关卡推进、结束）。
   - `BattleService`：负责单场 Battle 的生命周期。
   - `RoundService`：负责单个 Round 内的出牌、行为与回合结果判定。
   - 调用方向：Run → Battle → Round（自上而下）；结果与事件由下向上传递。

2. **Battle 级规则与结算的唯一归属**
   - 所有 Penalty / Environment 的规则解释与数值影响在 Battle 层完成（由 RuleService 维护）。
   - 所有 HP / 护盾相关结算由 `BattleService` 负责：基于当前规则和 Round 结果做一次数学计算并写回 BattleState。
   - Round 只返回「本回合结果」（谁赢 / 谁输、爆牌与否等），不直接调用任何伤害或 Penalty / Environment 代码。

3. **Round 级战术行为唯一归属**
   - Item 效果、单回合 buff / debuff、Hit / Stand 流程由 Round 层完成。
   - Round 只读 / 写 RoundState；不直接修改 BattleState 或 RunState。

4. **AI 行为由 Battle 调度**
   - 是否轮到 AI、何时行动由 Battle 决定。
   - Battle 调用 `aiService` 获取决策，再通过 Round 的公开接口执行 HIT / STAND 等。
   - Round 永远不直接依赖 AI。

5. **按层级归类文件，尽量少用“公共大杂烩”目录**
   - Battle 专属逻辑（规则、伤害、Penalty、Environment、Battle 奖励等）放在 `battle/`。
   - Round 专属逻辑（Item 效果、回合修正等）放在 `round/`。
   - Run 专属逻辑（Run 奖励、地图推进、Run 总结等）放在 `run/`。
   - 实在暂时分不清的少量纯工具，先放在 `engine/` 根目录（例如 `factories.ts`），以后再重构拆分。

6. **状态显式拆分**
   - 顶层存在一个 `GameState`，内部由 `RunState` / `BattleState` / `RoundState` 组成。
   - 业务代码通过专门的读写函数操作对应层的状态，而不是在各处随意改 `GameState`。

7. **接口命名约定**
   - 对外暴露的接口（服务接口、跨层 DTO / 上下文）统一使用 `I` 前缀：
     - `IRunService`、`IBattleService`、`IRoundService`
     - `IBattleResult`、`IRoundResult`、`IRoundContext`
     - `IBattleRuleService`、`IItemService` 等
   - 状态结构可以继续使用 `RunState` / `BattleState` / `RoundState` 命名（更接近“数据结构”而非“服务接口”）。

---

## 3. 目标架构概览

### 3.1 各层职责

| 层级 | 模块            | 职责范围                                                                 | 输入                                          | 输出                                               |
| ---- | --------------- | ------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| Run  | `RunService`    | 一次 Run 的完整生命周期：Run 开始、关卡推进、Run 级奖励、Run 结束与总结 | Meta、Run 配置、各 Battle 结果                | `run.state`、`run.completed`、`battle.request`    |
| Battle | `BattleService` | 单场 Battle：环境 / 惩罚抽取与应用、敌人生成、牌堆初始化、规则应用、伤害结算、胜负判定、生出 Battle 级奖励 | Run 下发的关卡指令、工厂函数、Round 回调     | `battle.state`、`battle.result`、`round.request`  |
| Round | `RoundService` | 单个 Round：抽牌、Hit/Stand、Item 使用、本回合 buff/debuff、生效与回合胜负判定 | Battle 下发的「本轮规则上下文」与限制参数    | `round.state`、`round.resolved`、`hand.action`    |

---

## 4. 模块归属与服务设计

### 4.1 Battle 层模块（engine/services/battle/）

- `battleService.ts`  
  - 实现 `IBattleService` 接口。  
  - 负责 Battle 的整体状态机：
    - 调用 RuleService 初始化 / 更新 Battle 规则（`IBattleRuleState`）；  
    - 调用 RoundService 执行回合并获取 `IRoundResult`；  
    - 基于当前规则和 `IRoundResult` 在内部计算 HP 变化，并写回 BattleState 中的 player / enemy；  
    - 调用 AI 与 battleReward 模块；  
    - 在 Battle 结束时向 Run 汇报 `IBattleResult` 和奖励候选。

- `battleRuleService.ts`（RuleService）  
  - 实现 `IBattleRuleService` 接口，是 Battle 层的「规则中枢」：
    - 定义并维护 `IBattleRuleState`，包含：
      - 计分 / bust 规则；  
      - 牌堆相关规则（deck shrink、自动抽牌等）；  
      - 伤害相关系数（基础伤害、倍率等）；  
      - Item 锁定；  
      - 特殊胜利规则（如 sudden death 阈值）等。  
    - `createBaseRules(level)`：根据关卡 / 难度生成基础规则；  
    - `applyEnvironmentCards(rules, envCards)`：根据环境卡修改规则（由现有 `environmentRuleEngine` 逻辑演进）；  
    - `applyPenaltyCard(rules, penalty)`：根据惩罚卡修改规则 / runtime（合并原 PenaltyEngine 中「规则层」部分）；  
    - `getRoundRuleContext(rules): IRoundContextRules`：为 Round 提供本回合需要的规则参数（目标点数、自动抽牌数等）。  
  - 不直接做伤害计算，只提供「伤害相关的系数 / 规则」给 BattleService 使用。  
  - `BattleService` 不需要理解单张环境 / 惩罚卡的细节，只需要与 `IBattleRuleService` 打交道。

- `battleReward.ts`  
  - 可实现 `IBattleRewardService`，也可以是若干纯函数。  
  - 在 Battle 胜利后，根据 BattleState / RunState / IBattleResult 生成 Battle 级奖励 DTO 列表，交给 RunService 处理。

- `aiService.ts`  
  - 实现 `IAiService` 接口。  
  - 根据当前 Battle / Round 视图决定敌人行为（HIT / STAND / USE_ITEM 等），由 BattleService 决定何时调用并转发给 RoundService。

> 惩罚卡、环境卡本质都是对规则（IBattleRuleState）的修改：  
> - 惩罚卡子系统负责「抽哪张惩罚卡」，再由 RuleService 解释其规则；  
> - 环境卡子系统负责「抽哪些环境卡」，再由 RuleService 解释其规则；  
> - BattleService 只感知「规则状态」和「数值结果」，不关心具体卡牌如何实现规则。

### 4.2 Round 层模块（engine/services/round/）

- `roundService.ts`  
  - 实现 `IRoundService` 接口。  
  - 负责单个 Round 的：
    - 初始化（`beginRound(IRoundContext)`）；  
    - 行为执行（`hit(actor)` / `stand(actor)` / `useItem(index, actor)`）；  
    - 回合结果判定（`resolveRound()` 返回 `IRoundResult`，但不改 HP）。

- `itemService.ts`  
  - 实现 `IItemService` 接口。  
  - 将原 `itemEffectService` 与 `effectRegistry` 合并：
    - 维护 Item → 效果函数注册表；  
    - 提供 `applyItem(item, context)` 等方法；  
    - 只读 / 写 RoundState 或通过回调更新 RoundState，不直接触碰 BattleState / RunState。  
  - `RoundService` 通过注入的 `IItemService` 来执行 Item 效果。

### 4.3 Run 层模块（engine/services/run/）

- `runService.ts`  
  - 实现 `IRunService` 接口。  
  - 负责：
    - `startRun(meta)`：创建新的 RunState；  
    - `startNextBattle()`：基于当前 RunState 组装 Battle 初始化信息并调用 BattleService；  
    - `handleBattleResult(IBattleResult, rewards)`：更新 RunState（经验、货币、升级点等），并决定是否继续下一关或结束 Run；  
    - `abortRun()`：中断当前 Run 并回到主菜单。

---

## 5. 状态与目录规划

### 5.1 状态结构（RunState / BattleState / RoundState）

本小节只约束各 State 的**职责与信息范围**，不锁定具体的 TypeScript interface；实际字段与命名可在实现阶段由 agent 结合现有 `GameState` 自由设计。

- RunState（engine/state/runState.ts）
  - 作用：承载一次 Run 的全局信息。
  - 至少应包含：当前关卡 / 进度、玩家 meta 与升级信息、全局货币 / 资源、本次 Run 的整体结果（进行中 / 胜利 / 失败）等。

- BattleState（engine/state/battleState.ts）
  - 作用：承载当前 Battle 的局部信息。
  - 至少应包含：当前敌人数据、当前生效的环境卡 / 惩罚卡及其运行时状态、Battle 内部的牌堆 / 弃牌堆、Battle 统计信息、Battle 规则状态（如 IBattleRuleState）等。

- RoundState（engine/state/roundState.ts）
  - 作用：承载当前 Round 的回合级信息。
  - 至少应包含：玩家 / 敌人手牌与分数、回合修正（buff / debuff）、当前出牌方、玩家 / 敌人是否已 Stand、回合计数等。

- 顶层 GameState（engine/state/gameState.ts）
  - 作用：组合 RunState / BattleState / RoundState。
  - 约束：应有清晰的 run / battle / round 子结构，便于各层通过统一的辅助函数安全访问。

- 读写辅助函数（converter）
  - 建议在各个 `xxxState.ts` 中提供类似下面的读写模式（仅示意，不强制字段细节）：
    ```ts
    export function getRunState(game: GameState): RunState { return game.run; }
    export function withRunState(
      game: GameState,
      updater: (s: RunState) => RunState,
    ): GameState {
      return { ...game, run: updater(game.run) };
    }
    ```
  - Battle / Round 可参照实现 `getBattleState` / `withBattleState`、`getRoundState` / `withRoundState`。

### 5.2 目标目录结构（重构完成后）

```text
engine/
  state/
    runState.ts
    battleState.ts
    roundState.ts
    gameState.ts

  services/
    run/
      runService.ts
      runService.contracts.ts   # 定义 IRunService、IRunContext 等接口
    battle/
      battleService.ts
      battleRuleService.ts      # IBattleRuleService：维护 IBattleRuleState 并应用环境 / 惩罚卡规则
      battleReward.ts
      aiService.ts
    round/
      roundService.ts
      itemService.ts            # IItemService：Item 注册 + 效果执行统一管理

  factories.ts                  # 通用工厂 / 少量共享规则（暂时放根目录）
  utils.ts                      # 现有通用工具

tests/
  unit/
    run/
      runService.test.ts
    battle/
      battleService.test.ts
      battleRuleService.test.ts
    round/
      roundService.test.ts
      itemService.test.ts
  integration/
    runBattleRound.integration.test.ts
```

---

## 6. 分阶段实施计划（概要）

> 每个阶段都必须补充 / 更新对应的单元测试和必要的集成测试，且所有测试文件统一放在 `tests/**/*` 目录下，不能把测试全部堆到最后一阶段。

### Phase 0 – 状态拆分与基础准备

- 实施内容：
  - 新增 RunState / BattleState / RoundState，并在 `gameState.ts` 中重构 GameState 为三者的组合。
  - 在 `doc/change-log.md` 中记录字段归属表和从旧 GameState 映射过来的规则。
- 测试要求：
  - 运行现有测试，确保在只改结构、不改行为的前提下全部通过。
  - 如有必要，新增最小状态初始化单测，验证新 GameState 的默认值与旧行为一致。

### Phase 1 – 服务骨架与接口命名

- 实施内容：
  - 定义 `IRunService`、`IBattleService`、`IRoundService`、`IBattleRuleService`、`IItemService` 等接口。
  - 在 run / battle / round 目录中创建对应类的骨架，实现这些接口的构造函数与空方法体（暂时直接调用旧逻辑或抛出 TODO）。
- 测试要求：
  - 在 `tests/unit/**` 下添加基础构造单测，确保各服务可以在注入依赖后成功创建。
  - 保证当前主流程仍然通过旧入口（例如 CombatService 或现有 Engine）工作，新骨架暂时不改变行为。

### Phase 2 – RoundService 收缩 + itemService 合并

- 实施内容：
  - 从 RoundService 中移除 Run / Battle 级逻辑，只保留单回合职责：
    - Round 初始化（beginRound）；  
    - Hit / Stand / useItem；  
    - resolveRound（返回 IRoundResult，不改 HP）。  
  - 将原 `itemEffectService` 与 `effectRegistry` 合并为 `itemService.ts`（实现 `IItemService`），并通过依赖注入提供给 RoundService。
- 测试要求：
  - 在 `tests/unit/round/roundService.test.ts` 中编写 / 扩充单元测试，覆盖：
    - 正常回合流程（玩家 / 敌人 Hit / Stand）；  
    - 回合结束时的胜负 / 爆牌判断；  
    - Item 使用的关键分支（成功 / 无效使用等）。  
  - 在 `tests/unit/round/itemService.test.ts` 中为 itemService 编写单元测试，验证几类代表性 Item 效果的行为。

### Phase 3 – BattleService + RuleService

- 实施内容：
  - 将原 `PenaltyEngine` 与 `environmentRuleEngine.ts` 中「规则层」逻辑合并到 `battleRuleService.ts`，实现 `IBattleRuleService`：
    - `createBaseRules(level)`：创建关卡基础规则；  
    - `applyEnvironmentCards`：应用环境卡对规则的修改；  
    - `applyPenaltyCard`：应用惩罚卡对规则 / runtime 的修改；  
    - `getRoundRuleContext`：为 Round 提供规则视图。  
  - 在 BattleService 中：
    - 使用 RuleService 初始化 / 更新 Battle 规则；  
    - 调用 RoundService 得到 `IRoundResult`；  
    - 依据当前规则与 `IRoundResult` 在 BattleService 内部计算 HP 变化，并写回 BattleState / RunState；  
    - 驱动 AI 与 Battle 循环，保持现有体验。
- 测试要求：
  - 在 `tests/unit/battle/battleRuleService.test.ts` 中为 battleRuleService 编写单元测试，至少覆盖：
    - 不同 Environment / Penalty 组合下规则的变化（计分、自动抽牌、deck shrink、伤害倍数等）；  
    - 多张卡叠加、无卡时的默认规则等边界情况。  
  - 在 `tests/unit/battle/battleService.test.ts` 中为 BattleService 编写单元测试，验证：
    - 给定 RuleState + RoundResult 时 HP / 状态更新是否正确；  
    - 环境 / 惩罚对 Battle 行为的关键影响是否生效。

### Phase 4 – RunService 接管顶层入口

- 实施内容：
  - 在 `runService.ts` 中完整实现 `IRunService`：
    - `startRun(meta)`：根据 Meta / 升级信息创建新的 RunState；  
    - `startNextBattle()`：基于当前 RunState 调用 BattleService；  
    - `handleBattleResult`：根据 BattleResult 决定是否进入下一关或结束 Run；  
    - `abortRun()`：中断当前 Run 并返回主菜单。  
  - UI 层改为只通过 `IRunService` 入口与引擎交互。
- 测试要求：
  - 在 `tests/unit/run/runService.test.ts` 中为 RunService 编写单元测试，覆盖：
    - 新 Run 初始化是否正确；  
    - 胜利 / 失败 / 连胜等不同 BattleResult 下的 Run 推进逻辑；  
    - 中断 Run 时的重置行为。  
  - 在 `tests/integration/runBattleRound.integration.test.ts` 中新增一个轻量级集成测试：从 `startRun` 到打完一场伪 Battle，再回到 Run 层，确认关键状态与事件顺序正确。

### Phase 5 – 清理与文档更新

- 实施内容：
  - 删除 / 合并不再需要的旧文件或逻辑：
    - `penaltyEngine.ts`；  
    - 顶层 `engine/effects/*` / `engine/rules/*` 中已被迁移的文件；  
    - 任何已被 run/battle/round 服务替代的旧入口或 helper。  
  - 更新文档：
    - 在 `doc/change-log.md` 中记录最终实现与设计之间的差异。
- 测试要求：
  - 运行 `tests/**/*` 下的全量单元测试和集成测试，作为合并前的最后检查。  
  - 保留并维护端到端集成测试用例（`tests/integration/runBattleRound.integration.test.ts`），从 Run 启动到 Run 结束，验证 Environment / Penalty / Item 的行为符合设计。

---

## 7. 命名与接口迁移说明

- 原文档中提到的 `RunServiceContract`、`BattleServiceContract` 等名称，实际落地时统一采用 I 前缀接口命名：  
  - `RunServiceContract` → `IRunService`  
  - `BattleServiceContract` → `IBattleService`  
  - `RoundServiceContract` → `IRoundService`
- 同理，跨层上下文与结果类型也采用 I 前缀命名：  
  - `BattleResult` → `IBattleResult`  
  - `RoundResult` → `IRoundResult`  
  - `RoundContext` → `IRoundContext`
- 状态数据结构（RunState / BattleState / RoundState）可以维持无 I 前缀的命名方式。

---

## 8. 执行检查清单

- [ ] RunState / BattleState / RoundState 已定义并接入 GameState。  
- [ ] 已实现 `getXxxState` / `withXxxState` 读写辅助函数。  
- [ ] 建立 I 前缀命名的接口：IRunService / IBattleService / IRoundService / IBattleRuleService / IItemService。  
- [ ] RoundService 收缩到 Round 职责，Item 相关逻辑集中到 itemService。  
- [ ] BattleService 负责环境 / 惩罚 / 伤害结算：  
      - battleRuleService 合并原 penalty / environment 规则逻辑；  
      - BattleService 内部根据规则和回合结果计算并应用 HP 变化。  
- [ ] RunService 取代旧 Run 生命周期与战斗入口。  
- [ ] 顶层 engine/effects/* 与 engine/rules/* 已清理或迁移。  
- [ ] 各阶段引入的单元测试和集成测试均已补齐并通过。  
- [ ] 文档（本文件和 `doc/change-log.md`）与最终实现保持同步。
