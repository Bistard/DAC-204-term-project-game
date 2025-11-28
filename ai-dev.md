# 敌人 AI 新版设计说明（aiService 集中实现版）

> 本文档描述在 **不改动整体引擎分层结构**、且**暂时将所有 AI 相关代码集中在 `engine/services/aiService.ts`** 的前提下，如何设计一套更智能、低耦合、高可扩展的敌人 AI。

目标是让敌人能够：

- 感知当前回合的完整局势：手牌、分数、HP / 护盾、回合阶段、先后手等；
- 感知并利用：**环境卡（Environment）**、**惩罚卡（Penalty）**、**道具卡（Item）**；
- 合理地决策：继续摸牌（Hit）、停牌（Stand）、使用道具（Use Item），并能随着难度、敌人类型成长。

---

## 1. 现有架构概览与约束

### 1.1 相关核心模块

- `GameEngine`（`engine/gameEngine.ts`）
  - 持有 `GameStore`，组合 `CombatService`、`RewardService` 等。
  - 对外暴露 `hit / stand / useItem / startRun / startRound` 等操作。

- `CombatService`（`engine/services/combatService.ts`）
  - 负责战斗流转、回合开始/结束、抽牌、结算伤害、调用道具效果等。
  - 构造并持有 `AiService` 实例：
    - 通过回调 `onHit`, `onStand`（将来会扩展 `onUseItem`）把 AI 决策转化为具体动作。

- `AiService`（`engine/services/aiService.ts`）
  - 目前的实现逻辑较简单：
    - 从 `GameStore.snapshot` 中拿到 `enemy`；
    - 用 `calculateScore` 得到敌人真实得分；
    - 根据 `enemy.aiType`（`GREEDY` / `DEFENSIVE` / `RANDOM`）和阈值决定继续摸牌还是停牌。
  - 拥有 AI 的排队/延迟控制（`queueTurn`，`aiTimer` 等）。

### 1.2 本轮设计约束

本轮重构/扩展在以下约束下进行：

- **物理上集中**：所有 AI 相关代码仍然放在 **一个文件**：`aiService.ts`；
- **逻辑上分层**：在文件内部通过**纯函数 + 内部类型**实现“模块化”，而不引入新 service 类；
- **低耦合**：
  - AI **不直接修改 `GameStore`**，仅：
    - 读取 `deps.store.snapshot`；
    - 通过 `onHit / onStand / onUseItem` 回调请求动作；
  - 不直接依赖 `CombatService` / `RoundService` 的内部实现细节；
- **可演进**：
  - 未来如果需要扩展，可以将当前在 `aiService.ts` 中的“逻辑模块”无痛抽取为独立文件（如 `aiPolicies.ts`、`aiContext.ts` 等），对外接口保持不变。

---

## 2. 新版 AI 的总体设计思路

### 2.1 四层逻辑，但集中在一个文件内

在 `aiService.ts` 内部，我们按照“虚拟分层”的方式组织代码：

1. **感知层（Perception）**  
   - 从 `GameStore.snapshot` 中收集所有 AI 可能关心的信息，构造成内部类型 `EnemyAiContext`。
   - 尽量 **不在其他层重复读取 snapshot**，把所有需要的信息在这里一次性提取出来。

2. **评估层（Evaluation）**  
   - 提供一组纯函数，用于对当前局势进行评估，例如：
     - 爆牌风险估计；
     - 当前回合赢面 / 输面估计；
     - 环境卡和惩罚卡对本回合胜负的影响；
     - 使用某个道具前后收益的粗略评分。
   - 输出的形式通常是一些“评分”或“风险值”，例如 `0.0 ~ 1.0` 的概率估计或加权分。

3. **决策层（Policy / Decision）**  
   - 根据 **感知上下文 + 各种评估函数**，给出一个抽象决策：
     - `HIT`（继续摸牌）
     - `STAND`（停牌）
     - `USE_ITEM`（并指定道具的索引）
   - 支持根据 `enemy.aiType` 或难度系数，选择不同的决策策略（保守/激进/随机等）。

4. **执行层（Execution / Bridge）**  
   - 保留现有的 `queueTurn` 和延时机制；
   - 调用决策层得到的结果；
   - 将其映射到 `deps.onHit()` / `deps.onStand()` / `deps.onUseItem(index)` 回调上；
   - 不直接关心具体的战斗规则和动画，它只负责“点按按钮”。

> 虽然物理上都在一个文件中，但通过清晰的函数拆分和类型分组，可以让这四个层次逻辑彼此独立、读起来也非常清晰。

### 2.2 内部核心类型（示意）

以下类型可以定义在 `aiService.ts` 内部（不从 `common/types.ts` 导出），作为实现细节：

```ts
// AI 决策
type EnemyDecision =
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'USE_ITEM'; index: number };

// AI 感知到的关键信息
interface EnemyAiContext {
  // 原始状态（只读引用）
  state: GameState;

  // 抽取的常用派生字段
  enemyScore: number;
  playerScore: number;
  enemyHp: number;
  playerHp: number;
  enemyShield: number;
  playerShield: number;
  targetScore: number;
  bustValues: number[];
  enemyBust: boolean;
  playerBust: boolean;

  // 环境相关
  environment: EnvironmentRuntimeState;

  // 惩罚相关
  activePenalty: PenaltyCard | null;

  // 道具相关
  enemyItems: Item[];
}
```

通过这种内部类型：

- **感知层**负责把 `GameSnapshot` → `EnemyAiContext`；
- **评估层/决策层**只依赖 `EnemyAiContext`，而不直接依赖 `GameStore`；
- 将来这些类型可以被拆分到独立文件，而不影响 `AiService` 向 `CombatService` 提供的接口。

---

## 3. 低耦合、高内聚的设计要点

### 3.1 AI 与引擎之间的边界

**AI 层只做三件事：**

1. 通过 `deps.store.snapshot` 读取只读状态（无副作用）；
2. 根据状态和内部策略，返回一个 `EnemyDecision`；
3. 将决策映射到回调接口：
   - `onHit()`：敌人选择摸牌；
   - `onStand()`：敌人选择停牌；
   - `onUseItem(index)`：敌人选择使用某个道具。

**不做的事情：**

- 不直接调用 `GameStore.updateState`；
- 不直接操作 `RoundService`、`DamageService` 等；
- 不直接操作 `EventBus` 或动画系统；
- 不感知 UI/动画延迟以外的任何前端细节。

这样：

- **`AiService` 只依赖 `GameStore` 的只读快照 + 若干回调**；
- `CombatService` 负责把这些回调接进去，并根据结果调用真实的 `hit / stand / useItem`；
- 将来如果需要在服务器端做 AI，只需实现同样的“快照输入 + 决策输出 + 回调桥接”模式即可复用大量逻辑。

### 3.2 在单文件中保持“模块化”

在 `aiService.ts` 内部推荐的组织顺序：

1. 顶部：`interface AiServiceDeps`、`AiService` 类定义（对外暴露）；
2. 紧随其后：**感知层函数**（`buildEnemyAiContext(snapshot)`）；
3. 然后：**评估层函数**，例如：
   - `estimateBustRisk(ctx: EnemyAiContext): number`
   - `estimateWinChanceIfStand(ctx: EnemyAiContext): number`
   - `estimateItemValue(ctx: EnemyAiContext, item: Item): number`
4. 再之后：**决策层**：
   - `decideForGreedy(ctx)`, `decideForDefensive(ctx)`, `decideForRandom(ctx)` 等；
   - 一个统一的 `decideAction(ctx, enemyProfile): EnemyDecision`。
5. 最后：**辅助的小工具函数**，例如排序、概率判断等。

通过这种分段：

- 每一块内部函数之间高度相关（高内聚）；
- 块与块之间通过明确的类型/参数进行交互（低耦合）；
- 即使都在一个 `.ts` 文件里，阅读和维护体验仍然接近“多模块”的设计。

---

## 4. 如何利用环境卡、惩罚卡和道具

本节描述的是 **策略层面的设计**，不限定具体数值，只给出决策框架和启发式。

### 4.1 环境卡（Environment）的影响

环境运行时状态位于 `GameState.environmentRuntime`，其中包括：

- `scoreOptions`：得分规则与爆牌特殊值；
- `deckMutators` / `drawHooks` / `rewardHooks` 等：对抽牌、奖励的影响；
- `damageModifiers`：伤害数值/倍率；
- `itemLocks`：是否禁用道具使用；
- `victoryHooks.suddenDeathThreshold`：突死阈值等。

**AI 使用环境信息的策略建议：**

1. **爆牌相关 (`scoreOptions`)**
   - 使用 `specialBustValues` 将某些分数视为“额外危险”；
   - 当当前分数接近这些值时，适当降低继续摸牌的阈值；
   - 如果 `aceMode` 变为 `ALWAYS_HIGH`，说明 A 牌不再给灵活空间，AI 应更加保守。

2. **伤害相关 (`damageModifiers`)**
   - 若 `baseDamage` 或伤害倍率较高：每一局输赢的代价更大 → AI 应更追求稳健（更倾向保守）。

3. **胜负规则相关 (`victoryHooks.suddenDeathThreshold`)**
   - 当任一方 HP 接近突死阈值时：
     - 如果 AI 处于劣势 → 可以采取更激进策略，尝试通过高风险摸牌或进攻型道具扭转局势；
     - 如果 AI 处于优势 → 更保守，通过防御/治疗/早停牌锁定胜局。

4. **道具锁定 (`itemLocks.disableUsage`)**
   - 若禁用使用道具，则决策层不要考虑 `USE_ITEM` 选项；
   - 这条规则最好在感知层就做过滤，保证后续逻辑简单。

### 4.2 惩罚卡（Penalty）的影响

惩罚卡相关数据包括：

- `activePenalty: PenaltyCard | null`；
- `penaltyRuntime: PenaltyRuntimeState`。

核心是 `PenaltyCard.damageFunction(context)`：

- 可在评估层中做一个“简易模拟”：
  - 构造一个假设 `PenaltyDamageContext`，例如假设“现在立即结算本回合”，看看如果：
    - 我现在选择 `STAND`，双方分数/爆牌情况如何；
    - 如果我再摸一张牌（期望分数变化），再结算会怎样。
  - 通过 `damageFunction` 估计敌我双方将受到的额外伤害，从而得到 **风险/收益评分**。

**典型启发式：**

- 如果现在选择 **Stand** 会触发一个对自己非常不利的惩罚效果（高额 HP 损失）：
  - 即使当前分数尚可，也可以考虑“再拼一把”（继续摸），尝试改变胜负结果来规避惩罚；
- 如果现在 Stand 可以触发对玩家不利的惩罚，则更倾向立即 Stand。

### 4.3 道具卡（Item）的使用策略

道具相关结构：

- `Item` → `effects: LogicEffectConfig[]`；
- `LogicEffectConfig.type` 有多种枚举，如 `HEAL`, `SHIELD`, `DRAW`, `FORCE_DRAW`, `DAMAGE_MULTIPLIER`, `LIFE_DRAIN` 等。

AI 可以对道具进行粗粒度分类，并基于场景给出启发式优先级：

1. **生存类（防御/治疗）**
   - 类型：`HEAL`, `LIFE_DRAIN`, `HEAL_PER_INVENTORY`, `SHIELD`, `RESOLUTION_DAMAGE_IMMUNITY` 等；
   - 使用时机：
     - 当前 HP 低于某阈值（例如最大生命的 30%）；
     - 或者下一个回合存在较大伤害风险（通过惩罚卡/环境推断）；

2. **牌面优化类**
   - 类型：`DRAW`, `DRAW_OPTIMAL`, `DRAW_VALUE`, `SWAP_LAST_CARD`, `UNDO_LAST_DRAW`, `REPLACE_LAST_CARD`, `FORCE_DRAW` 等；
   - 使用时机：
     - 当前分数离目标分数差距较大；
     - 但重新摸牌的爆牌风险又偏高，这时先用道具调整牌面再做决策更安全。

3. **进攻类**
   - 类型：`DAMAGE_MULTIPLIER`, `PENDING_LOSER_DAMAGE`, `GOLD`, `RANDOM_ITEM_EFFECT` 中的部分效果等；
   - 使用时机：
     - 预计本回合我方大概率会赢（分数优势明显、爆牌风险低）；
     - 为了放大优势，可以在 Stand 之前使用此类道具增加伤害或收益。

4. **使用顺序和数量限制**
   - 避免连续使用多个效果相近的道具（浪费）；
   - 一般将“生存类”优先级高于“牌面优化”，而进攻类优先级依赖当前的胜负态势。

在实现上，可以在评估层提供一个函数：

```ts
function chooseBestItemIndex(ctx: EnemyAiContext): number | null;
```

它综合以上启发式，返回一个推荐使用的道具索引；决策层可以根据返回值决定是否选择 `USE_ITEM`。

---

## 5. 决策流程示例（从简单到复杂）

以下是一个在决策层中可采用的典型流程（伪代码，本质会写在 `AiService.takeTurn` 内调用的策略函数里）：

1. 构建 `EnemyAiContext`；
2. 如果环境禁用道具 → 跳过道具相关逻辑；
3. 评估当前若立刻 Stand 的赢面；
4. 评估若继续摸牌的爆牌风险；
5. 求出推荐道具索引（如有）；
6. 按照敌人 AI 配置（保守/激进）选择：
   - 生存优先：低 HP → 考虑使用治疗/防御道具；
   - 优势扩大：优势明显 → 考虑使用进攻/增益道具；
   - 若道具收益显著 → `USE_ITEM`；
   - 否则根据赢面和爆牌风险，在 `HIT` 和 `STAND` 之间选择。

这样整个流程相对线性且易读，同时又能充分利用环境/惩罚/道具信息。

---

## 6. 与现有代码的集成方式（步骤级别）

在具体编码时，可以按以下顺序调整 `aiService.ts`（但所有逻辑仍保留在该文件内）：

1. **保留现有 `AiService` 类的公共接口**（`queueTurn`, `cancelProcessing` 不变）。
2. 在文件中添加：
   - `EnemyDecision` 联合类型；
   - `EnemyAiContext` 接口；
   - `buildEnemyAiContext(snapshot): EnemyAiContext` 函数。
3. 在 `takeTurn()` 内：
   - 替换原先基于 `calculateScore` 的简单逻辑；
   - 改为：
     1. 从 `store.snapshot` 构造 `ctx`；
     2. 调用 `decideAction(ctx, enemy.aiType)` 得到 `decision`；
     3. 根据 `decision.type` 调用 `onHit / onStand / onUseItem`。
4. 新增一个或多个策略函数：
   - `decideForGreedy(ctx)`、`decideForDefensive(ctx)`、`decideForRandom(ctx)`；
   - `decideAction` 内部按 `enemy.aiType` 分发到具体策略。
5. 后续迭代时，只需要：
   - 往评估层增加新的评估函数；
   - 更新策略函数中使用这些评估结果的规则；
   - 不需要改动 `queueTurn`、计时器、回调绑定等外围逻辑。

---

## 7. 可测试性与演进方向

### 7.1 测试策略

为了保证 AI 行为可预测且可维护，可以：

- 对纯函数进行单元测试：
  - `buildEnemyAiContext`：输入构造好的 `GameState` 片段，验证输出的派生字段正确；
  - 评估函数（如 `estimateBustRisk`）：给定特定手牌和目标分数，检查风险估计是否在合理区间；
  - `decideAction`：在特定场景下，期望 AI 做出特定决策。
- 对 `AiService.takeTurn` 做集成测试：
  - 使用假的 `GameStore` / 假回调，检查在某个 snapshot 下是否调用了 `onHit / onStand / onUseItem`。

### 7.2 长期演进方向

当项目需要进一步抽象时：

- 将 `EnemyAiContext`、评估函数、策略函数从 `aiService.ts` 抽离到 `engine/ai` 目录；
- `AiService` 只保留：
  - AI 调度（排队/延迟/取消）；
  - `takeTurn()` 作为桥接：从 `GameStore` 获取 snapshot → 调用外部 AI 模块 → 调用回调。

这样既能保持当前阶段“所有 AI 逻辑集中一个文件便于修改”的要求，又为未来的复杂 AI（如多阶段决策、搜索树、学习型策略等）预留了架构空间。

---

## 8. 小结

在保持“所有 AI 逻辑暂时集中在 `aiService.ts`”这一约束下，新版 AI 的设计核心是：

- **在单文件中通过类型与函数分层实现虚拟模块化**；
- **AI 层与引擎层之间通过只读快照 + 回调保持低耦合**；
- 充分利用环境卡、惩罚卡、道具卡信息，通过可插拔的启发式策略逐步增强 AI 智能；
- 为后续“从单文件走向多模块”的演进预留清晰的抽象边界。

后续在实际编码时，可以直接对照本说明中的各个层次和函数名逐步实现，边实现边用测试锁定行为，确保 AI 变得更强的同时，代码结构依然清晰可控。

