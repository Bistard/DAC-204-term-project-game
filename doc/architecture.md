# 游戏架构说明

> 适用阅读者：需要快速理解 “Last Hand” 的工程结构、核心循环与扩展点的程序员 / 设计师。建议先浏览 `types.ts`、`constants.ts` 了解术语，再结合本文定位模块。

## 1. 系统分层概览

| 层级 | 主要文件 | 职责 |
| --- | --- | --- |
| 数据定义层 | `types.ts`, `constants.ts` | 共用类型、平衡参数、默认值 |
| 内容配置层 | `content/*.ts` | 数据驱动的敌人、物品、环境、事件 |
| 引擎层 | `engine/gameEngine.ts`, `engine/services/*` | `CombatService` 驱动战斗循环；`RewardService` 负责奖励/进度；`GameEngine` 作为统一门面 |
| 状态存储层 | `engine/state/*.ts` | `GameState` 初始化、快照、发布订阅 |
| React 集成层 | `context/GameContext.tsx` | 将引擎封装为 Hook，管理本地存档 |
| 表现层 | `components/*.tsx`, `App.tsx` | 各阶段 UI、动画、交互 |
| 文档/设计层 | `doc/*.md` | 玩法规则、路线规划（例如 `level-system.md`） |

### 运行时数据流

```
UI 交互 (components)
    ↓ 调用
GameContext (actions, metaState)
    ↓ 委派
GameEngine (engine/gameEngine.ts)
    ↓ 写入
GameStore → GameSnapshot
    ↑ 订阅
GameContext 状态 → 触发渲染 → 订阅 EventBus 处理动画
```

## 2. 核心数据与配置

- `types.ts`：集中声明 `GameState`, `GamePhase`, `Enemy`, `ItemDefinition`, `EnvironmentCard`, `LogicEffectConfig` 等，让不同系统避免魔法字符串。
- `constants.ts`：保存所有可调参数（HP、目标分、奖励上限、AI 阈值、动画延迟、升级费用……），方便统一调平。
- Meta 进度 (`MetaState`)：包含 `gold` 与 `upgrades`，由 `GameContext` 存入 `localStorage`，保证浏览器端持久化。

## 3. 状态管理与快照

### GameState

`engine/state/gameState.ts` 提供：

- `createInitialGameState(metaState)`：根据玩家升级设置初始 HP、背包容量等，默认阶段为 `MENU`。
- `cloneGameState` / `applyEnemyUpdate`：提供不可变操作的辅助方法。
- `defaultRuntimeFlags`：`isDealing`, `isProcessingAI`, `isResolvingRound`，与 UI 的禁用/动画状态绑定。

### GameStore

`engine/state/gameStore.ts` 是一个极简发布/订阅存储：

- `state` 保存 `GameState`，`flags` 保存运行标记。
- `snapshot` 使用 `createSnapshot` 合并 state + flags，保证监听者拿到一致的数据。
- `subscribe` 会立即推送一次快照，并在更新后广播，供 `GameContext` 同步到 React。
- `engine/state/storeEnhancers.ts` 提供 `TimelineTracker` / `ActionLogger` / `RecordingBuffer`，`GameStore` 内建的日志、撤销、回放都基于它们。
- `GameStore` 暴露 `getActionLog`, `getHistory`, `undo/redo`, `startRecording/stopRecording`, `replay` 等调试 API，可直接用于制作教程或回放演示。

## 4. Run / Round 生命周期

`GameEngine` 仅充当门面：构造时注入 `EventBus` 以及 meta 读写方法，然后实例化

- `CombatService`（`engine/services/combatService.ts`）：处理 Run 启动、发牌、AI、道具效果、环境动画、伤害结算。
- `RewardService`（`engine/services/rewardService.ts`）：处理胜利阶段、奖励掉落、关卡推进、升级/金币经济。

两者共用 `GameStore` 快照，也会调用 `EventBus` 推送动画事件。

主要流程：

1. **`startRun`**  
   - 基于当前升级重置 `GameStore`，生成初始敌人与环境卡。  
   - 进入 `GamePhase.BATTLE` 并调用 `startRound`。

2. **`startRound`**  
   - 使用 `createDeck`（11 张单花色卡牌 + Fisher-Yates 洗牌）。  
   - 若首轮存在环境卡，播放 `playEnvironmentSequence` 动画。  
   - 发牌、翻开强制明牌（环境效果可能影响），首轮按升级额外发道具。  
   - 将 `turnOwner` 设为 `PLAYER`，等待操作。

3. **玩家/敌人行动**  
   - `hit` / `stand` / `useItem` 对应 UI 按钮。  
   - `hit`：抽牌 → 延迟 → 翻牌 → 重新计分。  
   - `useItem`：通过 `EventBus` 播放 `item.animation`，随后 `CombatService.applyItemEffects` 处理 `HEAL`/`SHIELD`/`DRAW` 等效果。  
   - 敌人通过 `queueAiTurn` 调度，在 `processAiTurn` 中依据 AI 配置评估是否继续抽牌。

4. **回合结束与结算**  
   - 当 `playerStood && enemyStood` 时触发 `resolveRound`：翻开所有牌、计算 Clash 结果、广播 `clash.state`。  
   - `resolveDamage`：结合结果、爆牌与环境倍率计算伤害/护盾，并触发数值提示。  
   - 若达成完美得分、击败敌人等事件，调用 `RewardService.applyEventTrigger` 发放奖励。

5. **阶段切换**  
   - 敌人死亡 → `GamePhase.VICTORY` → `proceedToRewards` → `GamePhase.REWARD`。  
   - 奖励阶段 `pickReward` 受 `REWARD_PICK_LIMIT` 与背包容量约束。  
   - 完成奖励或手动继续 → `nextLevel`：重置敌人、环境、分数，回到步骤 1。  
   - 玩家 HP ≤ 0 → `GamePhase.GAME_OVER`，可回菜单。

## 5. 引擎子系统

- **牌堆 / 随机工具（`engine/utils.ts`）**  
  - `calculateScore` 处理 Ace 11/1 的动态调整。  
  - `sleep` 协调异步动画。  
  - `getRandomItems`/`getRandomEnemy`/`getRandomEnvironment` 统一 RNG 出口，方便未来替换为种子随机数。

- **环境规则（`runStateUtils.ts`, `getDamageMultiplier`, `getForcedRevealCount`）**  
  - 集中处理 `SET_TARGET_SCORE`, `FORCE_REVEAL`, `DAMAGE_MULTIPLIER` 等影响，Combat/Reward 两个服务共享逻辑。

- **物品系统（`CombatService.applyItemEffects`）**  
  - 与 `LogicEffectConfig` 一一对应，只需在 `switch` 中扩展新的 `effect.type` 即可新增玩法。

- **事件 / 经济系统（`content/events.ts`, `RewardService.applyEventTrigger`）**  
  - 事件描述纯数据，RewardService 负责执行金币发放、计入 `goldEarnedThisLevel`，并通过 `RewardService.resolveGoldEffect` 支持等级系数。

- **AI 调度**  
  - `queueAiTurn`/`processAiTurn` 结合 `setTimeout` 形成可视化节奏，并在玩家提前结束时通过 `clearAiTimer` 取消。

## 6. React 集成与表现层

### GameProvider (`context/GameContext.tsx`)

- 创建 `EventBus` 与 `GameEngine` 单例（`useRef` 防止重复实例化）。  
- 订阅 `GameStore` 快照，暴露 `gameState`, `metaState`, `startRun`, `hit`, `stand`, `useItem`, `nextLevel`, `pickReward`, `proceedToRewards`, `buyUpgrade` 等操作。  
- 监听 `EventBus`，同步 `handAction`, `damageNumbers`, 环境动画、Clash 状态等 UI 状态。  
- 负责 Meta 存档的读写（`localStorage`）。

### 组件层

- `App.tsx` → `GameProvider` → `GameLayout`，形成单一渲染入口。  
- `components/GameLayout.tsx` 根据 `GamePhase` 切换不同界面；`PlayerHand`, `ItemCard`, `EnvironmentCardDisplay`, `HealthBar`, `Button` 等负责渲染细节。  
- `damageNumbers`、`visualEffect` 等视觉反馈都通过 `EventBus` 触发，保持逻辑与 UI 解耦。

## 7. 内容与数据驱动

| 文件 | 描述 | 扩展方式 |
| --- | --- | --- |
| `content/items.ts` | `ItemDefinition[]`（名称、说明、效果） | 直接追加；若新增 `effect.type`，需在 `CombatService.applyItemEffects` 实现逻辑 |
| `content/enemies.ts` | `EnemyTemplate[]` + AI 配置 | 设置 `difficulty`, `aiProfile`, `baseHp`；`getRandomEnemy` 会按关卡过滤 |
| `content/environments.ts` | 环境卡/Rule Set | 组合多种 `LogicEffectType` 即可 |
| `content/events.ts` | 击败奖励、完美得分奖励 | 配置 `trigger` / `effects`，无需改动引擎 |

数据→逻辑的解耦，使策划可直接编辑内容文件，工程侧只需在新增类型时扩展对应服务。

## 8. Level System 规划

`doc/level-system.md` 描述了一套“仅展示一段路径 + 逐层生成”的地图系统。当前 Run 仍是线性推进，但：

- `GameEngine.nextLevel` 已具备根据 `runLevel` 生成敌人/环境的能力，可作为地图节点的执行层。  
- 未来可在 `GameStore` 中增加 `mapState`，由新组件渲染路线，再调用现有 `startRun` / `nextLevel` 驱动战斗。  
- Shop/Treasure 节点可以沿用现有 Reward & Event 体系，只需新增触发入口。

## 9. 扩展指引与注意事项

1. **新增道具/效果**：在 `content/items.ts` 添加定义；若效果类型为新值，在 `CombatService.applyItemEffects` 中实现逻辑，必要时复用 `resolveTargets`。  
2. **新增敌人/AI 策略**：扩展 `EnemyTemplate`；若需要新 AI 行为，可在 `CombatService.processAiTurn` 中添加分支或抽象策略表。  
3. **新增环境/事件**：使用现有 `LogicEffectType`；若需要全新类型，可在 `runStateUtils` 或 RewardService 中扩展对应 hook。  
4. **界面/交互**：`GameLayout.tsx` 体量较大，逐步拆分为按阶段的子组件有助维护；动画优先通过 `EventBus` 广播。  
5. **测试/调试**：大量逻辑依赖 `sleep` 与 `setTimeout`，单元测试可通过注入 mock scheduler 或同步模式；运行调试可以直接查看 `GameProvider` 中的快照。

## 10. 后续演进建议

- 目前已完成 Combat/Reward 分离，下一步可继续抽象 `MapService` / `EventChainService` 以支撑地图与剧情。  
- 可在 `engine/state/storeEnhancers.ts` 中扩展日志/录像中间件（基础的日志、撤销、回放已内建）。
- 将 `content` 层迁移到 JSON/YAML 并配合 lint/校验脚本，便于多人协作。  
- 引入 `MapState` 后，可将节点数据写入 `MetaState`，为长流程 Run 提供断点续玩能力。

---

如需了解更具体的系统设计，请参阅 `doc/level-system.md`（关卡路线）与 `README.md`（项目背景）。若对架构有重大调整，记得同步更新此文件。