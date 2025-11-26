# Run → Level → Round Refactor Plan
> Version: 2025-11-26 · Author: Codex  
> Scope: Engine 架构重构（`runService` / `levelService` / `roundService`）与 React UI 解耦

---

## 1. 背景与痛点
- `engine/services/roundService.ts` 同时负责 **Run 初始化、Level/round 状态管理、动画节奏、Damage/Penalty 调用**，体积超 23k 行，极难维护与复用。
- `CombatService`、`RewardService`、`RunLifecycleService` 之间对 `GameState` 直接读写，缺少清晰的层级边界，导致 UI (`components/screens/BattleScreen.tsx`) 与引擎代码高度耦合当前状态结构。
- 事件流在多处生成（`RoundService.emitHandAction`、`GameContext`、多个 hooks），缺乏统一的“回合事件”语义，新增玩法需要同时改动 UI 与引擎。
- 缺少 Run/Level/Round 独立状态，`GameState` 担任所有职责，难以做战斗回放、持久化或 A/B 实验。

---

## 2. 目标与非目标
### 必须达成
1. 建立 **run → level → round** 分层服务：`runService` 统管旅程、`levelService` 统管单关战斗、`roundService` 聚焦单回合决策。
2. 引入 `RunState` / `LevelState` / `RoundState` 明确结构，并保证上层只通过公共 API 驱动下层。
3. Combat 流程改为“Run 推进 → Level 驱动回合 → RoundCore 返回纯事件”，UI 只消费事件与映射好的投影（ViewState）。
4. 保持现有功能与动画体验，对玩家零感知。

### 非目标
- 不重写 UI 视觉；仅适度调整 `GameContext`/hooks 的数据来源。
- 不改动 Reward/Meta 系统业务逻辑，只更换入口（Run 结束/Level 结束触发点）。
- 不一次性完成所有 AI/Item 规则重写，先保证现有服务可被 Level/Round 调用。

---

## 3. 新架构概览
```
RunService (macro flow) ── manages RunState, meta, map progression
   │
   ├─ LevelService (per battle) ── consumes RunContext, owns LevelState
   │      │
   │      └─ RoundService (pure core) ── consumes Level snapshot + commands, outputs RoundResult + events
   │
   └─ RewardService / MetaUpdater ── invoked by RunService after LevelOutcome
```

- `RunService` 暴露 `start(meta)`, `advanceLevel(outcome)`, `abort(reason)`。
- `LevelService` 暴露 `init(runContext)`, `startRound()`, `handlePlayerAction()`, `tickAI()`, `resolveRound()`, `getViewModel()`。
- `RoundService` 提供纯函数式接口：`begin(roundState, modifiers) -> { nextState, events }`, `applyAction(roundState, action)`, `resolve(roundState)`.

---

## 4. 职责划分（接口示例）
| 层级 | 输入 | 输出 | 主要职责 |
| --- | --- | --- | --- |
| `runService` | MetaState、Run config、Level 结果 | `RunState`, `LevelConfig`, Reward hooks | 旅程推进、地图/难度曲线、Run 结束收尾、调用 `levelService` |
| `levelService` | `RunContext`（包含 deck/环境/惩罚/Enemy seed） | `LevelState`, Round events, LevelOutcome | 初始化战斗、循环调用 RoundCore、胜负判定、通知 runService |
| `roundService` | `RoundState`, 行动、规则（环境/惩罚/道具） | `{ state, events, outcome }` | 抽牌、Hit/Stand 决策、Bust/Clash 计算、Damage/Penalty IO |

附加规范：
- RoundCore 返回 **事件列表**（`GameEvent`：log、animation、damage、draw 等），UI 只做订阅映射。
- LevelService 维护定时器/动画节奏，不让 RoundCore 关心 `sleep`/UI 延迟。

---

## 5. 状态模型调整
1. **RunState**  
   - 字段：`seed`, `currentLevel`, `maxLevel`, `mapNodes`, `relics`, `globalModifiers`, `metaSnapshot`.  
   - 持久化：`GameStore` 保存 `runState` + `levelState` 分支，支持回滚。
2. **LevelState**  
   - 字段：`levelId`, `enemySet`, `environmentRuntime`, `penaltyRuntime`, `deckState`, `levelFlags`（如 `hasIntroPlayed`）。  
   - 包含当前 `RoundState`，但仅通过 LevelService 接口暴露给外部。
3. **RoundState**（纯数据）  
   - `playerHand`, `enemyHand`, `deck`, `discardPile`, `scores`, `inventory`, `roundFlags`（`playerStood`, `enemyStood`, `pendingItemEffects`）。  
   - 无副作用字段（不包含动画 flag）。

数据流：`GameState` 将拆为 `{ runState, levelState?, viewState }`。`GameContext` 读取 `viewState`（含 UI 需要的派生数据与事件 buffer）。

---

## 6. 协作与依赖
- **EventBus**：继续作为跨层事件总线，但事件 schema 改为 `game/run/*`, `game/level/*`, `game/round/*`，便于订阅。
- **DamageService / PenaltyEngine / ItemEffectService**：迁移为 RoundService 依赖，由 LevelService 注入上下文（避免直接访问 GameStore）。
- **GameEngine**：  
  - 负责创建 `runService`, `levelServiceFactory`, `roundServiceCore`。  
  - `CombatService` 将被简化为 “玩家输入转发 + UI 辅助”，或逐步并入 LevelService。
- **React hooks** (`useHandAction`, `useDamageNumbers`, `useEnvAndPenaltyAnimations`)：改为监听统一事件而非直接读取 GameState 的临时字段。

---

## 7. 迁移策略（5 个里程碑）
### M1 · RoundCore 抽取
1. 在 `engine/services` 新建 `roundCore` 目录，提炼无副作用逻辑（抽牌、算分、clash/damage 调用）。  
2. 为 RoundCore 建立单元测试（牌库、爆牌、环境规则、Penalty/Damage 交互）。  
3. `RoundService` 继续保留节奏控制，但内部调用 RoundCore，验证输出事件。

### M2 · LevelService 雏形
1. 新建 `levelService.ts`，封装 `startLevel`, `startRound`, `handlePlayerAction`, `handleEnemyTurn`, `resolve`.  
2. LevelService 内部持有 `LevelState` + RoundCore 实例，AI/Item 服务通过依赖注入。  
3. `CombatService` 重写为简单代理：把 UI Action 转交 LevelService，并把 LevelService 的 `ViewModel` 写回 `GameStore`.

### M3 · RunService 拆分
1. 在现有 `RunLifecycleService` 基础上扩展为 `runService.ts`，新增 `RunState`、地图/节点数据结构。  
2. 提供 `start(meta)`, `completeLevel(result)`, `handleGameOver(reason)`，并管理奖励/升级入口（调用 `RewardService`）。  
3. `GameEngine` 中流程改为：`runService.start()` → `levelService.init(runContext)` → `levelService.loop()`。

### M4 · UI & Context 对齐
1. 更新 `context/GameContext.tsx`：监听新的事件通道，维护 `viewState`（HP、手牌、动画队列、message）。  
2. `components/screens/BattleScreen.tsx` 与各 hooks 改为消费 `viewState` + 事件，而非直接读/写 GameState 的细节字段。  
3. 为 UI 添加“层级切换”状态（Run map → Level intro → Battle），确保未来能扩展非战斗界面。

### M5 · 清理与文档
1. 删除旧的 RoundService 中已迁移的逻辑，保留少量桥接层直至完全替换。  
2. 更新 `doc/turn-by-turn-rule.md`, `doc/environment-card.md`, `doc/change-log.md` 以反映新架构。  
3. 编写开发者手册：如何通过 RunService/LevelService 编写新关卡或调试 RoundCore。

---

## 8. 测试与验证
- **RoundCore 单元测试**：Hit/Stand、Bust、多环境组合、Penalty 叠加、回合结束事件顺序。
- **LevelService 集成测试**：使用模拟 RunContext & AI stub，验证回合循环、胜负判定、奖励触发。
- **RunService 冒烟测试**：启动新 Run、连续完成多关、失败与放弃流程。
- **UI 回归**：Playwright/手动脚本覆盖关键交互（抽牌、使用道具、惩罚/环境动画）。
- **回放/Undo**：确认 `GameStore` 仍可以记录历史帧；必要时为 Run/Level/Round 状态序列化添加快照工具。

---

## 9. 风险与缓解
| 风险 | 描述 | 缓解 |
| --- | --- | --- |
| 状态拆分导致 Undo/Replay 失效 | GameStore 目前只序列化 `GameState` | 先建立 `GameSnapshotV2`（含 run/level/round 子树），提供向下兼容转换器 |
| RoundCore 纯函数化破坏动画节奏 | 之前逻辑隐含 `sleep` | LevelService 接管所有延迟/动画触发；RoundCore 只发事件类型，UI 决定动画 |
| 依赖链复杂（Damage/Penalty/Item） | 多服务互相引用 | 通过依赖注入（接口）+ service container，禁止 RoundCore 直接 import 其他服务 |
| 当前 hooks 未准备事件流 | 依赖旧字段 | 先提供“兼容 viewState”阶段（老字段由 LevelService 映射），逐步切换 hooks |

---

## 10. 交付物清单
1. `engine/services/runService.ts`（替换 `runLifecycleService.ts`）。  
2. `engine/services/levelService.ts`（新文件）。  
3. `engine/services/roundCore/*`（纯函数模块 + 测试）。  
4. `common/types.ts` 中新增 Run/Level/Round 状态与事件类型。  
5. `context/GameContext.tsx` 与相关 hooks 更新，`BattleScreen` 适配。  
6. 更新文档：本计划、流程规范、Change Log。  
7. 测试报告/脚本：RoundCore 单测、LevelService 集测、冒烟步骤说明。

---

## 11. 粗略时间评估（以 2 人周为单位，可并行）
| 阶段 | 预估工期 | 备注 |
| --- | --- | --- |
| M1 RoundCore | 2~3 天 | 需要补充测试框架 |
| M2 LevelService | 3~4 天 | 包含 CombatService 重写 |
| M3 RunService | 2 天 | 依赖 LevelService 输出 |
| M4 UI/Context | 3~4 天 | 与设计联调动画 |
| M5 收尾 | 1~2 天 | 文档 + 清理 |

整体约 2.5 周，可根据资源调整并行顺序（RoundCore 与 RunService 可部分同步进行）。

---

> 后续若需要更细的任务拆解（例如具体到文件/PR），可在 M1 完成后基于 RoundCore 的实际接口再迭代一次计划。
