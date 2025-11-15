# LAST HAND 架构指引

本文档提供《LAST HAND》（Blackjack 风格 Roguelike）的整体软件架构设计指导，确保后续实现保持模块化、可测试、可扩展。主要内容涵盖「一、整体架构设计（概念框架，方便后面实现）」。

---

## 一、整体架构设计（概念框架，方便后面实现）

### 1.1 层次划分

| 层 | 作用 | 关键注意点 |
| --- | --- | --- |
| Presentation 层（UI/Rendering） | 处理界面、动画、输入映射 | 不包含规则逻辑；通过事件或指令与上层交互 |
| Game/Application 层 | 控制场景/状态切换（主菜单、战斗、结算、升级）与游戏循环 | 不直接操作 UI DOM，而是与 Presentation 层协作 |
| Domain/Rules 层 | Blackjack 规则、卡牌系统、敌人 AI、结算逻辑、Roguelike 进程等纯逻辑 | 必须与 UI 解耦，保持可单独测试 |
| Infrastructure 层 | 存档、配置加载、日志、音频等跨领域服务 | 通过接口暴露服务，避免直接耦合实现 |

> 目标：UI ↔ 游戏流程 ↔ 领域逻辑 完全分层，任何层次都可被替换或独立测试。

### 1.2 核心模块与职责

- **BlackjackCore**：处理 21 点发牌/点数/胜负判定。
- **CardSystem**：卡牌、牌堆、手牌、效果执行（技能卡/道具卡/规则修改卡），以数据驱动方式扩展。
- **CombatSystem**：玩家/敌人 HP、伤害计算、回合流程（玩家 → 敌人 → 结算），从 BlackjackCore 接收结果并转化为战斗效果。
- **EnemyAI**：不同敌人行为（贪心、防守、干扰、腐化等）和技能触发。
- **Progression/Roguelike**：Run 生命周期、奖励计算、永久升级、解锁内容。
- **GameMode/Survival**：控制无尽模式的波次生成、难度曲线。
- **UI & Input**：战斗 UI、牌桌布局、按钮、手牌交互、信息提示。
- **Persistence**：存档/读档、数据版本管理、设置存储。

每个模块都应该通过显式接口暴露行为，例如 `IBlackjackRules`, `ICardEffect`, `IAIBehavior` 等，保证测试与替换的灵活性。

### 1.3 SOLID 原则的应用

- **S（Single Responsibility）**  
  - `BlackjackCore` 只管 21 点规则，不处理 HP；  
  - `Progression` 只负责 Roguelike 资源与升级；  
  - `EnemyAI` 只决策行为，不处理 UI。

- **O（Open/Closed）**  
  - 新卡牌、新敌人通过配置或实现接口扩展，而非修改核心规则；  
  - `CardEffect` 和 `EnemyAI` 使用多态注册，减少核心代码变动。

- **L（Liskov Substitution）**  
  - 所有敌人实现统一 `Enemy` 抽象，可在场景中自由替换；  
  - 所有 `CardEffect` 都必须在相同上下文接口下运作，确保替换安全。

- **I（Interface Segregation）**  
  - 切分能力接口：`IDamageable`, `ICardPlayable`, `IAIController` 等，避免臃肿的“万能接口”；  
  - UI 模块只需订阅它们关心的事件接口。

- **D（Dependency Inversion）**  
  - 高层模块（如 `CombatSystem`）依赖抽象接口，而非具体实现；  
  - 通过依赖注入/工厂实现具体绑定，方便测试与替换。

---

上述架构确保：  
1. **可扩展**：新卡牌/敌人/模式可最小改动接入。  
2. **可测试**：核心玩法无需 UI 即可进行单元或集成测试。  
3. **可维护**：职责清晰，便于多人协作与后续迭代。  

后续所有功能需求都应在此框架下落位，避免跨层耦合。***
