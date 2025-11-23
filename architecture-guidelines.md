# Last Hand - 架构设计文档 (Architecture Design)

## 1. 项目现状分析 (Current State Analysis)

### 1.1 产品形态
"Last Hand" 是一个单页应用 (SPA) 的 Roguelike 卡牌游戏。核心玩法是基于 21 点的数值博弈，包含 RPG 元素（道具、生命值、护盾）。视觉风格强烈，依赖 CSS 动画和 DOM 操作来表现打击感。

### 1.2 现有代码结构问题 (Pain Points)
目前项目是典型的 **"God Component" (上帝组件)** 模式：
*   **高耦合 (High Coupling)**: `App.tsx` 管理了所有事务——游戏循环、状态更新、AI 决策、动画触发、UI 渲染。
*   **逻辑与视图混杂**: 游戏规则（如“爆牌扣血”）直接写在 React 组件的 `useEffect` 或事件处理函数中。如果不运行 React，无法测试游戏逻辑。
*   **拓展性差**: 新增一种“回合结束自动回血”的敌人或“抽牌时触发特效”的道具，需要修改 `App.tsx` 的核心流程，风险极高。
*   **动画状态地狱**: 使用 `setTimeout` (`sleep`) 硬编码动画时间，导致逻辑执行必须等待动画结束，容易产生 Race Condition（竞态条件）。

---

## 2. 架构设计目标 (Design Goals)

1.  **逻辑视图分离 (Separation of Logic & View)**: 核心游戏规则应纯粹（Pure Typescript），不依赖 React。
2.  **事件驱动 (Event-Driven)**: 逻辑层只负责改变数据，并抛出“事件”；UI 层监听事件并播放动画。
3.  **数据驱动内容 (Data-Driven Content)**: 道具、敌人、环境卡应通过配置定义行为，而非硬编码在 Switch 语句中。
4.  **轻量级 (Lightweight)**: 不引入 Redux/MobX 等重型库，使用 React `useReducer` + Context 配合自定义 Engine 类即可。

---

## 3. 核心架构图 (Core Architecture)

我们将应用拆分为三层：**Domain (核心域)**, **State (状态层)**, **View (视图层)**。

```mermaid
graph TD
    User[玩家交互] --> ViewLayer
    
    subgraph View Layer [视图层 (React)]
        Components[UI Components]
        AnimSystem[动画编排系统]
    end

    subgraph State Layer [状态层 (React Context/Hooks)]
        GameContext[Game Context]
        Dispatcher[Action Dispatcher]
    end

    subgraph Domain Layer [核心域 (Pure TS)]
        GameEngine[Game Engine / Reducer]
        Rules[规则计算 (Score, Damage)]
        AI[AI 决策模块]
        Registry[内容注册表 (Items/Enemies)]
    end

    ViewLayer --> Dispatcher
    Dispatcher --> GameEngine
    GameEngine --> NewState
    GameEngine --> GameEvents[事件队列 (Events)]
    
    NewState --> GameContext --> Components
    GameEvents --> AnimSystem --> Components
```

---

## 4. 详细模块设计 (Detailed Design)

### 4.1 Domain Layer (核心域 - `src/engine/`)
这是游戏的“大脑”。它不包含任何 JSX 代码。

*   **`types.ts`**: 保持现有的类型定义，但增加 `GameEvent` 类型。
*   **`GameState`**: 纯数据结构。
*   **`Reducer`**: 处理 `Action` (HIT, STAND, USE_ITEM) 并返回新的 `State`。
    *   *优势*: 状态变化是原子性的，易于调试和测试。
*   **`Systems`**: 独立的逻辑单元。
    *   `ScoreSystem`: 计算手牌分数。
    *   `CombatSystem`: 结算回合伤害。
    *   `AISystem`: 决定敌人行动。
*   **`ContentRegistry`**:
    *   道具和敌人不再是简单的对象，而是拥有 `Behavior` 钩子的实体。
    *   例如道具定义包含：`onUse`, `onTurnStart`, `onDamageTaken` 等钩子。

### 4.2 State Layer (状态层 - `src/hooks/`)
连接 React 和 Engine 的桥梁。

*   **`useGameEngine`**: 封装 `useReducer`。
*   **`EventQueue`**: 一个关键设计。当 Engine 处理完逻辑（例如玩家扣血），除了更新 State，还会 Push 一个事件 `{ type: 'DAMAGE_TAKEN', target: 'PLAYER', amount: 5 }` 到队列。
*   **`GameProvider`**: 将 State 和 Dispatch 方法通过 Context 暴露给组件。

### 4.3 View Layer (视图层 - `src/components/` & `src/features/`)
只负责“怎么显示”，不负责“怎么计算”。

*   **纯展示组件**: `Card`, `HealthBar` 保持不变，只接收 Props。
*   **功能组件**: `PlayerArea`, `EnemyArea` 从 Context 获取数据。
*   **动画控制器 (`GameScene.tsx`)**:
    *   监听 `EventQueue`。
    *   当收到 `DAMAGE_TAKEN` 事件时，触发 CSS 动画或 Screen Shake。
    *   *解耦关键*: 逻辑状态瞬间完成更新，动画只是对过去发生的事件的“回放”。

---

## 5. 目录结构规划 (Directory Structure)

```text
src/
├── assets/             # 静态资源
├── components/         # 通用 UI 组件 (Button, Card, HealthBar)
│   ├── ui/             # 纯视觉组件
│   └── animation/      # 动画相关组件 (Effects, FloatingText)
├── config/             # 游戏配置常量 (Starting HP, Deck Config)
├── content/            # 游戏内容定义 (数据驱动)
│   ├── enemies.ts      # 敌人数据
│   ├── items.ts        # 道具逻辑实现
│   └── environments.ts # 环境卡逻辑
├── engine/             # 核心逻辑 (无 React)
│   ├── actions.ts      # Reducer Actions 定义
│   ├── reducer.ts      # 核心状态机
│   ├── systems/        # 子系统 (AI, Scoring, Combat)
│   └── utils.ts        # 纯函数工具 (createDeck, shuffle)
├── hooks/              # React 胶水层
│   ├── useGame.ts      # 访问 Context
│   └── useGameLoop.ts  # 处理回合流转
├── layouts/            # 页面级布局
└── types/              # 全局类型定义
```

---

## 6. 关键技术难点解决方案

### 6.1 解决 "Wait for Animation" (等待动画)
目前的 `await sleep(1000)` 方式阻塞了主线程逻辑，且难以维护。

**新方案**: **UI 锁 (UI Locking)**
1.  用户点击 "HIT"。
2.  Engine 立即更新状态（手牌增加），并发出 `CARD_DRAWN` 事件。
3.  Engine 设置 `inputLocked = true`。
4.  UI 收到 `CARD_DRAWN` 事件，播放发牌动画（约 0.5s）。
5.  动画组件播放完毕后，调用 `dispatch({ type: 'ANIMATION_COMPLETE' })`。
6.  Engine 收到完成信号，若无其他挂起事件，设置 `inputLocked = false`。

### 6.2 解决扩展性 (Extensibility)
目前道具效果是硬编码的。

**新方案**: **Effect System (效果系统)**
道具不再直接修改 State，而是返回一系列 **Effects**。
```typescript
// 旧方式
if (item.id === 'heal') state.player.hp += 3;

// 新方式
item.effect = (context) => [
  { type: 'HEAL', target: 'PLAYER', amount: 3 },
  { type: 'SPAWN_TEXT', text: 'REPAIRED', color: 'green' }
];
```
Engine 遍历处理这些 Effect。这样新增一种“吸血”效果，只需在 Engine 的 Effect 处理器中增加一种 Case，所有道具都可以复用。

---

## 7. 迁移路线图 (Migration Roadmap)

1.  **第一步 (Refactor Types)**: 将 `types.ts` 移动并完善，拆分 `GamePhase` 和 `Entity` 定义。
2.  **第二步 (Extract Logic)**: 将 `calculateScore`, `createDeck` 等纯函数移入 `engine/utils.ts`。
3.  **第三步 (Build Reducer)**: 创建 `engine/reducer.ts`，将 `App.tsx` 中的 `hit`, `stand`, `useItem` 逻辑转化为 reducer switch cases。
4.  **第四步 (Context Setup)**: 建立 `GameProvider`，替换 `App.tsx` 的 `useState`。
5.  **第五步 (Event System)**: 实现简单的事件队列，将动画逻辑从核心逻辑中剥离。
6.  **第六步 (Cleanup)**: `App.tsx` 最终应该只包含 `<GameProvider><GameScene /></GameProvider>`，非常干净。

