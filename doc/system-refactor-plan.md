# Last Hand 系统重构路线（集中化视角）

> 版本：2025‑11 · 面向：架构 / 主程  
> 目标：在现有玩法稳定的前提下，把「分散、重复、跨层耦合」的逻辑集中为少数几个清晰的系统，降低 RoundService / BattleScreen / GameContext 等大块代码的复杂度。

---

## 1. 架构现状与问题概览

### 1.1 适合集中、统一管理的领域

- **Run / Round 生命周期（关卡推进）**
  - 主要入口分散在：`GameEngine` → `CombatService` → `RoundService.startRun/startRound/resolveRound` 与 `RewardService.prepareNextLevel/handleVictory`。
  - 新开局与下一关的逻辑存在大量重复：敌人选择、环境卡抽取、惩罚卡抽取、`GameState` 初始化、`applyEnvironmentRules` 调用等。
  - 目前每个服务都「顺手」改一点 GameState，很难从一个地方看清一整局从 MENU → BATTLE → VICTORY/REWARD → NEXT LEVEL → GAME_OVER 的完整流程。

- **效果 / 规则系统（Effect & Rule System）**
  - **道具**：`ItemEffectService` 通过 `LogicEffectConfig` + 大型 `effectHandlers` 表来执行。
  - **事件奖励**：`RewardService.applyEventTrigger/applyEventEffect` 使用同一套 `LogicEffectConfig`，但逻辑独立实现。
  - **环境卡**：`environmentRuleEngine` 使用 `EnvironmentRuleType` + `EnvironmentRuntimeState`，是另一套规则系统。
  - **惩罚卡**：`PenaltyCard.damageFunction` 再是一套规则（基于 `PenaltyDamageContext`），与上述三者没有统一管线。
  - 实质上，这四类系统都在：修改 HP / 伤害 / 金币 / 目标分数 / 临时状态，却没有统一的 **Effect Pipeline** 或 **注册表**。

- **伤害与生命值结算（Damage Pipeline）**
  - Round 结算入口集中在 `RoundService.resolveRound/resolveDamage/applyDamage/applyHealing/enforceSuddenDeath`。
  - 道具与惩罚通过不同路径修改伤害：
    - 道具：`ItemEffectService` 里有多种结算前后调整（例如 `RESOLUTION_DAMAGE_BUFFER/BOOST/IMMUNITY`、`PENDING_LOSER_DAMAGE`）。
    - 惩罚卡：`PenaltyCard.damageFunction` + `RoundService.evaluatePenaltyDamage/computeLegacyDamage/patchPenaltyRuntime`。
    - 环境卡：通过 `EnvironmentRuntimeState.damageModifiers` 影响最终数值。
  - 各方都在「顺带」修改伤害，但没有一个统一的 Damage Service 做收口。

- **Meta / 经济系统（金币与升级）**
  - `MetaState` 定义在 `common/types.ts`，由 `GameContext` 直接通过 `localStorage` 持久化。
  - 引擎侧通过 `GameEngine` 构造时注入 `getMetaState` / `updateMetaState`，`RewardService` 内聚部分金币与升级逻辑。
  - 目前 **持久化策略（localStorage）** 与 **业务逻辑（奖励、升级、扣费）** 混在 React 层和 RewardService 中，缺乏独立的 `MetaService` / `EconomyService`。

- **动画与时间调度（Animation / Timeline）**
  - 引擎层使用 `engine/utils.sleep`（基于 `setTimeout`）在 `RoundService`、`ItemEffectService`、`AiService` 内串联动画节奏。
  - React 层在 `GameContext` 和多个组件（例如 `BattleScreen`）直接调用 `window.setTimeout` 管控：
    - 手部动作复位（`hand.action` 事件后的 IDLE 回退）
    - 伤害数字淡出
    - Clash Overlay 的自动关闭
    - 环境卡 / 惩罚卡入场退场后的状态翻转
  - 缺少一个可以在引擎与 UI 共用的 **调度器 / Scheduler** 或统一时间轴，导致测试和竞态问题难排查。

### 1.2 明显设计不佳 / 过于混乱的模块

- **RoundService（`engine/services/roundService.ts`）**
  - 文件体积最大、职责过多：Run 启动、Round 初始化、环境与惩罚动画、抽牌与翻牌、结算、伤害、Sudden Death、Penalty Runtime 等都堆在一起。
  - 与 `RewardService.prepareNextLevel` 在「关卡开始时如何构造 GameState」上存在大块重复代码。
  - 既做「流程编排」（何时开始新回合 / 何时 Victory）又做「细粒度规则」（伤害计算、惩罚细节），不利于日后加入地图、剧情或多 Boss。

- **RewardService 与 RoundService 的职责边界**
  - `RewardService.prepareNextLevel` 内部重新实现了一遍：
    - 新敌人生成（`getRandomEnemy`）
    - 环境卡抽取（`getRandomEnvironment`）
    - 惩罚卡抽取（`getRandomPenaltyCard`）
    - 套牌构建（`createDeck`）
    - 重置 `GameState` 相关字段
  - 这些逻辑与 `RoundService.startRun` 高度相似，未来任一方改动（例如新增地图节点、初始手牌规则）都容易出现两处不一致。

- **GameContext（`context/GameContext.tsx`）**
  - 同时承担：
    - `GameEngine` / `EventBus` 的创建与订阅
    - MetaState 的加载与持久化（`localStorage`）
    - 绝大多数 UI 动画绑定（damageNumbers、clashState、env/penalty 动画、手部动作定时器等）
    - Debug 信息（Action Log / Undo / Redo / Recording）的聚合
  - 这导致 Provider 越来越像「迷你引擎」，边界模糊，不利于未来将引擎迁移到 Node / 后端或做无 UI 的自动化测试。

- **BattleScreen / MenuScreen（`components/screens/*.tsx`）**
  - `BattleScreen.tsx` 与 `MenuScreen.tsx` 均为上万行级别的巨型组件：
    - 同时负责布局、输入事件、调试面板、说明文本、动画细节等。
    - 内部包含若干可复用 UI 片段（例如卡牌画廊、提示面板、Modal）却未抽离。
  - 这种大组件会加重：
    - 状态管理混乱（局部 `useState` 与全局 `GameContext` 难以追踪谁驱动谁）
    - 视觉修改成本高（任何改动都要在 1000+ 行文件里定位）

- **Effect / Rule 实现分散**
  - `ItemEffectService` 已经有一张较完整的 `effectHandlers` 表，但：
    - Reward 事件与 GOLD 效果在 `RewardService` 内单独编码。
    - 环境卡规则在 `environmentRuleEngine` 中单独处理。
    - 惩罚卡通过闭包的 `damageFunction` 执行。
  - 同一类「效果」跨四个子系统被不同方式实现，使新加入的玩法（例如「回合开始前触发某效果」）难以统一实现和测试。

---

## 2. 分批重构要求

> 原则：**每一批次可独立合并与回归，不强依赖后续批次**。优先整理「引擎生命周期」与「效果系统」，再收紧 UI 和 Meta 持久化。

### 批次 1：Run / Level 生命周期统一（RunLifecycleService）

**目标**
- 把开局 / 下一关 / 回合循环的主流程集中到一个生命周期门面（例如 `RunLifecycleService`），让「一局游戏怎么从头走到尾」在一处可读。
- 消除 `RoundService.startRun` 与 `RewardService.prepareNextLevel` 中关于敌人、环境、惩罚卡与牌组初始化的重复逻辑。

**改动要求**
- 新增 `engine/services/runLifecycleService.ts`（命名可调整），内部职责：
  - 提供 `startNewRun(meta: MetaState)` 与 `prepareNextLevel(currentState, meta)` 两个纯函数或方法，统一构造新局 / 新关卡的初始 `GameState`。
  - 负责调用 `createInitialGameState`、`getRandomEnemy`、`getRandomEnvironment`、`getRandomPenaltyCard`、`createDeck` 与 `applyEnvironmentRules`。
  - 仅做「状态构造」，不处理动画和 AI。
- 调整：
  - `RoundService.startRun` 改为调用 `RunLifecycleService.startNewRun`，不再直接拼装完整 `GameState`。
  - `RewardService.prepareNextLevel` 改为调用 `RunLifecycleService.prepareNextLevel`，只保留与 Reward 阶段本身强相关的逻辑（例如 `goldEarnedThisLevel` 重置）。
  - `GameEngine.startRun/nextLevel` 只面向 `CombatService` / `RewardService` 的公开 API，不再直接参与 GameState 构造。

**验收标准**
- 查看 `RunLifecycleService` 即可完整理解：
  - 新局启动时 GameState 的主要字段如何初始化；
  - 下一关如何基于当前 `runLevel` 和 Meta 升级构建。
- 修改环境卡 / 惩罚卡 / 敌人生成逻辑时，只需改一处生命周期服务，不会出现「首关与后续关逻辑不一致」的情形。

---

### 批次 2：伤害与惩罚管线收口（Damage & Penalty Engine）

**目标**
- 将所有「造成伤害 / 治疗 / 免疫 / 突然死亡」相关逻辑从 `RoundService` 与各处 Effect 中收束到统一的 Damage Pipeline。
- 保持惩罚卡的数据驱动优势，同时剥离出通用的 **惩罚运行时管理**（Runtime 管理与日志）。

**改动要求**
- 新增 `engine/services/damageService.ts`（名称可调整），提供：
  - `computeClashResult(...)`：给定双方得分和 Bust 状态，返回胜负与文案（目前由 `RoundService.evaluateClashResult` 负责）。
  - `applyDamageWithShieldAndEnv(...)`：负责整合环境加成（`EnvironmentRuntimeState.damageModifiers`）、护盾、HP 扣减以及 `damage.number` 事件广播。
  - `applyHealing(...)`：单一入口处理回血，避免在各处手动计算上限。
- 在 `RoundService.resolveDamage` 中，改为：
  - 只负责组装上下文（胜者/败者/分数/是否爆牌/当前 roundModifiers），调用 DamageService 完成具体伤害计算与应用。
  - 惩罚逻辑通过下述 Penalty Engine 收口。
- 将惩罚相关逻辑拆分：
  - 新建 `PenaltyEngine`（可在 DamageService 内或单独文件）：
    - 统一管理 `PenaltyRuntimeState` 的读写（包括 `patchPenaltyRuntime`）。
    - 统一封装 `evaluatePenaltyDamage` 与 `computeLegacyDamage` 的分支逻辑，`RoundService` 只调用一个接口。
  - 保留 `PenaltyCard.damageFunction` 的数据驱动风格，但要求：
    - 所有 runtime 更新统一通过 `PenaltyEngine` 暴露的 helper 完成；
    - 若 damageFunction 抛错时，回退逻辑仅在一处定义。

**验收标准**
- `RoundService` 不再直接操作 HP / 护盾，只通过 DamageService / PenaltyEngine 这两个统一入口处理。
- 惩罚卡只关心「根据上下文返回伤害/治疗与 runtimePatch」，不关心 GameStore 和事件总线细节。
- 新增惩罚卡时，只需改动 `content/penalties.ts`，无需在 `RoundService` 中额外插入分支。

---

### 批次 3：效果系统统一（Effect Registry & Pipeline）

**目标**
- 建立一套统一的 Effect Pipeline，让：
  - 道具（`ItemEffectService`）
  - 事件奖励（`EVENT_EFFECTS` in `content/events.ts`）
  - 环境规则（`EnvironmentRule` / `EnvironmentRuntimeState`）
  - 惩罚卡（部分逻辑）
  在「编排层」上可以共享同一套 effect handler，而不再各写一份。

**改动要求**
- 新建 `engine/effects/effectRegistry.ts`：
  - 定义 `EffectContext`（包含 `GameSnapshot`、执行来源 Source：Item / Event / Environment / Penalty，以及粒度更细的参数）。
  - 抽象每个 `LogicEffectType` / 环境 Rule Type 为一个可注册的 handler（例如 `registerEffect('HEAL', healHandler)`）。
  - 支持组合效果（例如 GOLD 效果后再触发额外日志 / 动画中间件）。
- 重写 / 包装 `ItemEffectService`：
  - 改为薄封装：负责从 Item 上读出 `LogicEffectConfig[]`，将其逐条传入 Effect Registry，而非自己持有一大坨 `effectHandlers`。
  - 保留「按顺序执行」与「支持 async」的特性。
- 调整 Reward 事件：
  - `RewardService.applyEventEffect` 不再自己解析 GOLD，而是将事件效果交给 Effect Registry 执行；RewardService 只负责选择何时触发哪些事件。
- 评估环境规则与惩罚卡：
  - 短期可保留 `environmentRuleEngine` 为「构建 EnvironmentRuntimeState」的专用实现；
  - 但新的规则类型若更偏向「一次性效果」而非「长期 RuntimeFlag」，建议直接接入 Effect Pipeline。

**验收标准**
- 任何新增的 `LogicEffectType` 都只需：
  - 更新类型定义；
  - 在 Effect Registry 中实现一次 handler；
  - 可同时被 Item / Event / 未来的 Trigger 共用。
- GOLD 等基础效果的实现只存在一份逻辑来源。

---

### 批次 4：GameContext / UI 架构瘦身

**目标**
- 让 `GameContext` 回归「引擎桥接层」角色：负责订阅 GameStore 与 EventBus，把快照和命令暴露给 React，而不是承担所有 UI 动画与 Meta 持久化细节。
- 拆解 Battle / Menu 等巨型 Screen 组件，形成可复用、职责单一的子组件与自定义 Hooks。

**改动要求**
- 从 `GameContext` 中抽离动画与可视状态：
  - 基于现有事件（`hand.action` / `visual.effect` / `damage.number` / `item.animation` / `environment.animation` / `penalty.animation` / `clash.state` / `penalty.card`）拆出：
    - `useDamageNumbers(bus)`
    - `useHandAction(bus)`
    - `useEnvAndPenaltyAnimations(bus)`
    - `useClashState(bus)`
  - 每个 Hook 内部自行管理 `window.setTimeout` 与本地状态，`GameContext` 只负责组合与传递。
- 拆分 Screen：
  - 为 `BattleScreen` 新建子目录 `components/screens/battle/`，拆出：
    - `BattleLayout`
    - `EnemyPanel`
    - `PlayerPanel`
    - `BattleOverlays`（Clash / Environment / Penalty 动画层）
    - 各类 Modal（道具说明、牌库一览、Debug 面板等）
  - `MenuScreen` 同理，拆出：
    - `MainMenu`
    - `UpgradePanel`
    - `LorePanel` / `HowToPlay` 等。
- 确保 UI 拆分只改视图，不改变：
  - `GameContext` 暴露的 API；
  - 引擎层 GameState / MetaState 的含义。

**验收标准**
- `GameContext.tsx` 文件长度明显缩短，主要职责清晰为「引擎 → React 的桥接」。
- `BattleScreen.tsx` 不再是万行级别文件；绝大多数 UI 变更只需要在某个子组件中完成。

---

### 批次 5：Meta 持久化与调度治理（MetaService + Scheduler）

**目标**
- 让引擎可以在「无浏览器环境」下运行，并通过注入的存储与时间源运行（方便做 CLI 模拟或服务器端验证）。
- 收拢 `localStorage` 与 `window.setTimeout` 的直接使用，便于统一测试和未来平台迁移。

**改动要求**
- 新建 `MetaService`：
  - 提供 `load()` / `save()` / `update()` API；
  - 默认实现使用浏览器 `localStorage`，但在构造时可以替换为其它存储后端（内存、文件、远端服务）。
  - `GameEngine` 仅依赖 `getMetaState` / `updateMetaState` 接口，具体持久化逻辑由 `MetaService` 决定。
- 新建简单的 `AnimationScheduler` 或注入式 `Clock`：
  - 将 `sleep` 的实现与 `setTimeout` 封装到单独模块，允许在测试中替换为同步或可控时间源。
  - 在 GameContext Hooks 与引擎内统一使用该 Scheduler / Clock，而不是到处直接调用 `window.setTimeout`。

**验收标准**
- 在 Node 环境中可以直接构造 `GameEngine` + 假实现的 `MetaService` / `Scheduler`，运行一整局游戏逻辑而不依赖 DOM。
- 浏览器端只在顶层挂一层适配（localStorage + 真正的 setTimeout），其它代码均通过注入的接口访问这些资源。

---

## 3. 建议的实施顺序与里程碑

1. **优先完成批次 1 + 2**  
   - 收口 Run 生命周期与 Damage/Penalty Pipeline，避免后续玩法扩展时反复修改 RoundService 与 RewardService。
2. **随后推进批次 3**  
   - 先抽 Hook 再拆 Screen，保证每一步视觉行为可手动对比验证。
3. **最后落地批次 4 + 5**  
   - 在无需大规模改动 UI / 引擎逻辑的前提下，把 Meta 与 Scheduler 做成可替换的基础设施，为未来服务器化与自动化测试打基础。

每一批次完成后，应在 `doc/change-log.md` 补充记录，并在 `doc/architecture.md` 中同步更新对应章节（例如「引擎子系统」「Meta 持久化」「效果系统」），保持文档与实现一致。

