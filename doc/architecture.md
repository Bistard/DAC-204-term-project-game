# 游戏架构说明

> 适用阅读者：需要快速理解 “Last Hand” 的工程结构、核心循环与扩展点的程序员 / 设计师。建议先浏览 `types.ts` 与 `constants.ts` 了解术语，再对照本说明定位模块。

## 1. 系统分层概览

| 层 | 主要文件 | 职责 |
| --- | --- | --- |
| 数据定义层 | `types.ts`, `constants.ts` | 统一枚举/接口、平衡参数、默认值 |
| 内容配置层 | `content/*.ts` | 数据驱动的物品、敌人、环境、事件定义 |
| 引擎层 | `engine/*.ts` | 回合逻辑、AI、伤害结算、事件广播、元进度 |
| 状态存储层 | `engine/state/*.ts` | `GameState` 初始化、快照、订阅/发布 |
| React 集成层 | `context/GameContext.tsx` | 将引擎封装成 React hook + 本地存档 |
| 表现层 | `components/*.tsx`, `App.tsx` | 各游戏阶段界面、动画、交互 |
| 文档/设计层 | `doc/*.md` | 例如 `level-system.md` 与本文，描述玩法与后续规划 |

### 运行时数据流

```
UI 交互 (components) 
    ↓ 调用
GameContext (actions, metaState)
    ↓ 委派
GameEngine (engine/gameEngine.ts)
    ↓ 写
GameStore → GameSnapshot
    ↑ 订阅
GameContext 状态 → 触发渲染 → 订阅 EventBus 处理动画
```

## 2. 核心数据与配置

- `types.ts`：集中声明 `GameState`, `GamePhase`, `Enemy`, `ItemDefinition`, `EnvironmentCard`, `LogicEffectConfig` 等。所有模块共享这些类型，减少魔法字符串。  
- `constants.ts`：平衡参数（初始 HP、目标分、奖励上限、AI 阈值、动画延迟、升级费用等）均在这里维护，方便调优与 A/B Testing。  
- Meta 进度 (`MetaState`)：包含 `gold` 及 `upgrades`（HP 与物品栏各自的等级/成本），由 `GameContext` 写入 `localStorage`，保证浏览器内持久化。

## 3. 状态管理与快照

### GameState

`engine/state/gameState.ts` 提供：

- `createInitialGameState(metaState)`：根据玩家元进度设置 HP、背包等，默认阶段为 `MENU`。
- `cloneGameState` / `applyEnemyUpdate`：提供不可变操作的辅助方法，便于在引擎中安全地修改嵌套结构。
- `defaultRuntimeFlags`：`isDealing`, `isProcessingAI`, `isResolvingRound`。这些短期标记会和视图联动（禁用按钮、展示动画）。

### GameStore

`engine/state/gameStore.ts` 是一个极简的发布/订阅存储：

- `state` 保存 `GameState`，`flags` 保存运行标记。
- `snapshot` 由 `createSnapshot` 组合 state + flags，确保监听者拿到一致的数据切片。
- `subscribe` 立即推送一次快照，并在状态更新时重放，供 `GameContext` 绑定到 React。

## 4. Run / Round 生命周期

`engine/gameEngine.ts` 是核心调度者，构造时注入：

- `EventBus`（动画/提示）
- `getMetaState` / `updateMetaState`（访问本地存档）

主要流程：

1. **`startRun`**  
   - 根据当前升级重启 `GameStore`，生成敌人/环境卡 (`getRandomEnemy`, `getRandomEnvironment`)。  
   - 进入 `GamePhase.BATTLE` 并调用 `startRound`。

2. **`startRound`**  
   - 使用 `createDeck`（11 张单花色牌 + Fisher-Yates 洗牌）。  
   - 执行环境卡动画（`playEnvironmentSequence`，通过 `EventBus` 驱动 UI）。  
   - 依次发牌、强制翻牌（受环境效果 `FORCE_REVEAL` 影响）、首回合发道具。  
   - 设置 `turnOwner='PLAYER'`，等待玩家操作。

3. **玩家/敌人行动**  
   - `hit` / `stand` / `useItem` 对应 UI 按钮。  
   - `hit`：抽牌 → `sleep` 延迟 → 翻牌 → 计算分数。  
   - `useItem`：通过 `EventBus` 发射 `item.animation`，消耗背包并调用 `applyItemEffects`（当前支持 `HEAL`/`SHIELD`/`DRAW`，扩展见下文）。  
   - 敌人由 `queueAiTurn` 调度，按照模板 AI (`GREEDY`/`DEFENSIVE`/`RANDOM`) 在 `processAiTurn` 中决定是否继续抽牌。

4. **回合结束 & 结算**  
   - 当双方 `playerStood && enemyStood` 时，`resolveRound`：翻开所有牌 → 计算 Clash 结果 → `EventBus` 推送 `clash.state`。  
   - `resolveDamage`：根据胜负、爆牌与环境倍率处理伤害/护盾，播放数值提示，判断死亡。  
   - 事件触发：胜利时调用 `applyEventTrigger('ENEMY_DEFEATED')`，若刚好达成目标分则触发 `PERFECT_SCORE`（用于金币奖励）。

5. **阶段切换**  
   - 敌人死亡 → `GamePhase.VICTORY` → 玩家领取奖励（`proceedToRewards` → `GamePhase.REWARD`）。  
   - 奖励阶段 `pickReward` 使用 `REWARD_PICK_LIMIT` 控制选择次数并检查背包容量。  
   - 领取完毕 → `nextLevel`：重置敌人、环境、目标分，回到步骤 1。  
   - 玩家 HP ≤ 0 → `GamePhase.GAME_OVER` → 可返回菜单。

## 5. 引擎子系统

- **牌堆与随机工具 (`engine/utils.ts`)**  
  - `calculateScore` 负责 Ace 的 11/1 动态调整。  
  - `sleep` 用于在同步逻辑中串联视觉节奏。  
  - `getRandomItems` / `getRandomEnemy` / `getRandomEnvironment` 统一 RNG 出口，便于以后替换为种子随机数。

- **环境卡 (`applyEnvironmentRules`, `getDamageMultiplier`, `getForcedRevealCount`)**  
  - 每张环境卡都是持续的逻辑效果，`SET_TARGET_SCORE` 与 `FORCE_REVEAL` 会在回合开始时立即改变目标分或明牌数量。

- **物品系统 (`applyItemEffects`)**  
  - 效果与 `LogicEffectConfig` 对应，未来只需在 `switch` 中扩展新的 `effect.type` 即可支持更多玩法。

- **事件系统 (`content/events.ts`)**  
  - 每个事件定义 `trigger` + 一组 `effects`。打败敌人或达成完美得分时调用 `applyEventTrigger`，事件本身只描述数据，逻辑完全由引擎负责，使得新增经济/剧情事件变得简单。

- **元进度 / 经济 (`buyUpgrade`, `applyEventEffect`)**  
  - 升级消耗 `gold`，成本表 `COST_UPGRADE_HP/INVENTORY` 定义在常量里。  
  - 奖励金币通过事件与 `resolveGoldEffect` 计算（可携带 `metadata.perLevelOffset`，按照关卡级别动态 scaling）。

- **AI Scheduler**  
  - 借助 `setTimeout` 形成伪异步 AI，让敌人行动与动画可视化同步。  
  - `aiTimer` 与 `clearAiTimer` 确保在玩家提前结束回合时不会触发过期动作。

## 6. React 集成与表现层

### GameProvider (`context/GameContext.tsx`)

- 创建 `EventBus` 与 `GameEngine` 单例，使用 `useRef` 避免重复实例化。  
- 订阅 `GameStore` 的快照并写入 React state，向组件暴露 `gameState`, `metaState`, `startRun`, `hit`, `stand`, `useItem`, `nextLevel`, `pickReward`, `proceedToRewards`, `buyUpgrade` 等操作。  
- 监听 `EventBus`，将引擎发射的 `GameEvent` 转成 UI 状态（例如 `handAction`、`damageNumbers`、环境卡动画、Clash 状态等）。  
- 负责本地存档（`localStorage`），保证金币与升级在刷新后保留。

### 组件层

- `App.tsx` → `GameProvider` → `GameLayout`，只有一条渲染路径，便于调试。  
- `components/GameLayout.tsx` 根据 `GamePhase` 渲染不同屏幕（菜单、战斗、胜利、奖励、失败）。  
- 其他组件（`PlayerHand`, `ItemCard`, `EnvironmentCardDisplay`, `HealthBar`, `Button` 等）负责视觉呈现与交互。  
- Lucide Icons + Tailwind 风格类用于营造西部/蒸汽朋克主题；`damageNumbers`、`visualEffect` 等由 `EventBus` 驱动，保证动画和逻辑解耦。

## 7. 内容与数据驱动

| 文件 | 描述 | 扩展方式 |
| --- | --- | --- |
| `content/items.ts` | `ItemDefinition[]`，描述名称、类型、效果 | 追加/修改数组即可；若效果类型为新值，需在 `GameEngine.applyItemEffects` 添加处理 |
| `content/enemies.ts` | `EnemyTemplate[]` + AI 配置 | 设定 `difficulty`, `aiProfile`, `baseHp`；`getRandomEnemy` 会根据关卡过滤 |
| `content/environments.ts` | 影响整场 RUN 的环境卡 | 通过 `effects` 组合多种 `LogicEffectType` |
| `content/events.ts` | 战利品与特殊奖励 | 新增触发器或扩展 Trigger 枚举 |

这种“数据驱动 + 纯函数处理”的模式，既便利于策划调整，也利于日后迁移到后端服务或加上存档验证。

## 8. Level System 规划

`doc/level-system.md` 描述了即将实现的关卡地图（分支节点、历史保留、事件节点权重等）。当前引擎仍以线性 `Level` 推进，但：

- `GameEngine.nextLevel` 已经具备参数化能力（根据 `runLevel` 生成敌人与环境卡）。  
- 未来的地图系统可在 `GameStore` 增加 `mapState` 并在 `GameLayout` 或新组件中渲染，调度逻辑仍可复用 `startRun` / `nextLevel`。  
- 节点事件（Shop/Treasure）可以沿用现有的事件/奖励基础，只需增加触发入口。

## 9. 扩展指引与注意事项

1. **新增道具/效果**  
   - 在 `content/items.ts` 中添加定义。  
   - 若 `effects.type` 为新值，在 `GameEngine.applyItemEffects` 中实现逻辑（可复用 `resolveTargets`）。  
   - 记得在 UI（`ItemCard`）中描述其效果文本。

2. **新增敌人或 AI 策略**  
   - 扩展 `EnemyTemplate`。  
   - 若需要新 AI 行为，在 `GameEngine.processAiTurn` 中增加分支或抽象策略表。

3. **新增环境/事件**  
   - 使用现有的 `LogicEffectType` 即可；若需要新类型（例如实时改动牌堆），需在引擎中加入对应 hook。  
   - 注意 `duration`（目前主要是 `RUN`），后续可考虑 `ROUND` 或即时效果。

4. **界面/交互**  
   - 所有布局逻辑集中在 `GameLayout.tsx`，体量较大，后续可拆成按阶段的子组件，减轻维护成本。  
   - 任何动画需求优先考虑通过 `EventBus` 广播，保持引擎与 UI 解耦。

5. **测试与调试**  
   - 由于大量逻辑依赖 `sleep`/`setTimeout`，在编写单元测试时可以抽象出时间依赖或提供同步模式。  
   - 运行态调试：借助 React DevTools 查看 `GameProvider` 状态，或在 `GameEngine` 方法内使用断点。

## 10. 后续演进建议

- 将 `GameEngine` 切分为更细的服务（如 `CombatService`, `RewardService`），以便引入地图/事件系统。  
- 让 `GameStore` 支持中间件（日志、回放、撤销），便于重放或制作教程。  
- `content` 层可迁移到 JSON/YAML，配合验证脚本让非工程角色也能编辑。  
- 引入 `MapState`（见 `doc/level-system.md`）后，可以把节点数据持久化到 `MetaState`，支持一次 run 的进度保存。

---

如需更深入的设计背景，请继续参考 `doc/level-system.md`（关卡路线）与 `README.md`（项目背景）。本文件会随着系统扩展持续更新。请在修改架构相关模块时同步修订。
