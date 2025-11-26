# 重构计划：Run / Battle / Round 分层服务架构（更新版）

本文件用于指导本项目战斗系统的整体架构重构，内容基于目前为止的所有讨论和共识，覆盖：

- Run / Battle / Round 三层的职责边界  
- Penalty / Environment / Item / AI / 奖励等系统的归属  
- RunState / BattleState / RoundState 状态拆分思路  
- BattleRuleService / ItemService 等核心模块的定位  
- 分阶段实施计划（每个阶段都需同步维护测试）

工程师或 AI Agent 可以直接据此实施重构。

---

## 1. 重构目标

- 将一次 Run、单场 Battle、单个 Round 的逻辑严格分层，降低耦合、提高可维护性与可测试性。  
- 严格贯彻设计硬规则：  
  - Penalty / Environment 卡只影响当前 Battle 的整体规则与结算；  
  - Item 卡只影响当前 Round 内的即时行为与结算。  
- 使用 RunState / BattleState / RoundState 拆分状态结构，让每一层都可以独立做单元测试。  
- 简化服务与目录结构（例如收敛 Penalty 引擎、收敛 Item 相关服务），在需要时再细分。  

---

## 2. 设计原则

1. **严格分层调用**
   - Run 层：负责一次 Run 的完整生命周期（开始、关卡推进、结束与总结）。  
   - Battle 层：负责单场 Battle 的生命周期（初始化、回合循环、伤害结算、胜负判定、奖励生成）。  
   - Round 层：负责单个 Round 内的出牌、行为与本回合结果判定。  
   - 调用方向：Run → Battle → Round（自上而下）；结果与事件由下向上传递。

2. **Battle 级规则与结算的唯一归属**
   - 所有 Penalty / Environment 的规则解释与数值影响在 Battle 层完成（由 Battle 规则服务维护）。  
   - 所有 HP / 护盾相关结算由 Battle 层负责：基于当前规则和 Round 结果做一次数学计算并写回 BattleState。  
   - Round 层只返回「本回合结果」（谁赢 / 谁输、是否爆牌、完美得分等），不直接调用任何伤害或 Penalty / Environment 代码。

3. **Round 级战术行为唯一归属**
   - Item 效果、单回合 buff / debuff、Hit / Stand 流程由 Round 层完成。  
   - Round 层只读 / 写 RoundState；不直接修改 BattleState / RunState。

4. **AI 行为由 Battle 层调度**
   - 是否轮到 AI、何时行动由 Battle 层决定。  
   - Battle 层调用 AI 服务获取决策，再通过 Round 层公开接口执行 Hit / Stand / 使用 Item 等。  
   - Round 层永远不直接依赖具体 AI 实现。

5. **按层级归类文件，避免「公共大杂烩」模块**
   - Battle 专属逻辑（规则、伤害、Penalty、Environment、Battle 奖励等）集中到 Battle 相关模块。  
   - Round 专属逻辑（Item 效果、回合修正等）集中到 Round 相关模块。  
   - Run 专属逻辑（Run 奖励、地图推进、Run 总结等）集中到 Run 相关模块。  
   - 实在暂时分不清的少量纯工具，可以先放到基础工具模块，后续再重构拆分。

6. **状态显式拆分**
   - 顶层存在一个 GameState，内部由 RunState / BattleState / RoundState 组成。  
   - 业务代码通过专门的读写函数操作对应层的状态，而不是在各处随意拼接或修改 GameState。

7. **接口命名约定**
   - 对外暴露的接口（服务接口、跨层 DTO / 上下文）统一使用 `I` 前缀，例如：  
     - IRunService / IBattleService / IRoundService  
     - IBattleResult / IRoundResult / IRoundContext  
     - IBattleRuleService / IItemService  
   - 状态结构可以继续使用 RunState / BattleState / RoundState 等命名（更接近“数据结构”而非“服务接口”）。

---

## 3. 目标架构概览

### 3.1 各层职责

| 层级  | 模块          | 职责范围                                                                                  | 输入                           | 输出                                      |
| ----- | ------------- | ----------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| Run   | Run 服务      | 一次 Run 的完整生命周期：Run 开始、关卡推进、Run 级奖励、Run 结束与总结                 | Meta、Run 配置、各 Battle 结果 | Run 状态、Run 是否完成、下一场 Battle 请求 |
| Battle| Battle 服务   | 单场 Battle：回合 / 惩罚抽取与应用、敌人生成、牌堆初始化、规则应用、伤害结算、胜负判定、Battle 级奖励 | Run 下发的关卡指令、工厂函数、Round 回调 | Battle 状态、Battle 结果、Round 请求     |
| Round | Round 服务    | 单个 Round：抽牌、Hit / Stand、Item 使用、本回合 buff / debuff、生效与回合胜负判定     | Battle 下发的本轮规则上下文与限制参数 | Round 状态、本回合解析结果、具体出牌动作 |

---

## 4. 模块归属与服务设计

### 4.1 Battle 层模块

- Battle 服务  
  - 实现 IBattleService 相关职责。  
  - 负责 Battle 的整体状态机：  
    - 调用 Battle 规则服务初始化 / 更新 Battle 规则状态；  
    - 调用 Round 服务执行回合并获得 IRoundResult；  
    - 基于当前规则 + IRoundResult 计算 HP / 护盾变化，并写回 BattleState 中的 player / enemy；  
    - 调用 AI 服务与 Battle 奖励模块；  
    - Battle 结束时向 Run 层汇报 IBattleResult 和奖励候选。

- Battle 规则服务  
  - 实现 IBattleRuleService。  
  - Battle 层的「规则中枢」，负责任何由 Environment / Penalty / 关卡配置共同决定的规则：  
    - 定义并维护 IBattleRuleState，包含：  
      - 计分 / bust 规则；  
      - 牌堆相关规则（牌堆缩减、自动抽牌等）；  
      - 伤害相关系数（基础伤害、倍率等）；  
      - Item 锁定规则；  
      - 特殊胜利规则（如突然死亡阈值等）。  
    - 提供从关卡 / 难度配置生成基础规则状态的能力。  
    - 将环境卡、惩罚卡的效果解释到规则状态中（不直接做数值结算）。  
    - 为 Round 层提供「回合规则上下文」，只包含 Round 需要了解的目标点数、自动抽牌数量等参数。

- Battle 奖励模块  
  - 可实现为服务接口或一组纯函数。  
  - 在 Battle 胜利后，根据 BattleState / RunState / IBattleResult 生成 Battle 级奖励候选 DTO，交给 Run 层处理。

- AI 服务  
  - 提供战斗中敌人的行为决策（HIT / STAND / 使用 Item 等）。  
  - Battle 层决定何时调用，并负责将决策转化为 Round 调用。

> 惩罚卡、环境卡本质都是对规则（IBattleRuleState）的修改：  
> - 惩罚卡子系统负责「抽到哪张惩罚卡」，再由 Battle 规则服务解释其规则；  
> - 环境卡子系统负责「抽到哪些环境卡」，再由 Battle 规则服务解释其规则；  
> - Battle 服务只感知「规则状态」和「数值结果」，不关心具体卡牌如何实现规则。

### 4.2 Round 层模块

- Round 服务  
  - 实现 IRoundService 相关职责。  
  - 负责单个 Round 的：  
    - 初始化（基于 IRoundContext）；  
    - 行为执行（Hit / Stand / 使用 Item 等）；  
    - 回合结果判定（返回 IRoundResult，但不改 HP）。  

- Item 子系统  
  - 实现 IItemService 相关职责。  
  - 将原有 Item 效果实现与效果注册表统一归口：  
    - 维护 Item 与效果函数的注册表；  
    - 提供应用 Item 效果的统一入口；  
    - 只读 / 写 RoundState 或通过回调更新 RoundState，不直接触碰 BattleState / RunState。  
  - Round 服务通过注入 IItemService 执行 Item 效果。

### 4.3 Run 层模块

- Run 服务  
  - 实现 IRunService 相关职责。  
  - 负责：  
    - Run 开始：创建新的 RunState；  
    - 启动下一场 Battle：基于当前 RunState 组装 Battle 初始化信息并调用 Battle 服务；  
    - 处理 Battle 结果：根据 IBattleResult 和奖励选择更新 RunState（经验、货币、升级点等），并决定是否继续下一关或结束 Run；  
    - 中断 Run：在玩家或系统要求时中断当前 Run 并返回主界面。  

---

## 5. 状态与目录规划

### 5.1 状态结构（RunState / BattleState / RoundState）

本小节只约束状态的职责与信息范围，不锁定具体 TypeScript interface；实际字段与命名可在实现阶段由 Agent 结合现有 GameState 自由设计。

- RunState  
  - 作用：承载一次 Run 的全局信息。  
  - 至少应包含：当前关卡 / 进度、玩家 meta 与升级信息、全局货币 / 资源、本次 Run 的整体结果（进行中 / 胜利 / 失败）等。

- BattleState  
  - 作用：承载当前 Battle 的局部信息。  
  - 至少应包含：当前敌人数据、当前生效的环境 / 惩罚卡及其运行时状态、Battle 内部的牌库 / 弃牌堆、Battle 统计信息、Battle 规则状态（IBattleRuleState）等。

- RoundState  
  - 作用：承载当前 Round 的回合级信息。  
  - 至少应包含：玩家 / 敌人手牌与分数、回合修正（buff / debuff）、当前出牌方、玩家 / 敌人是否 Stand、回合计数等。

- 顶层 GameState  
  - 作用：组合 RunState / BattleState / RoundState。  
  - 约束：应有清晰的 run / battle / round 子结构，便于各层通过统一的辅助函数安全访问。

- 读写辅助函数  
  - 建议在各个状态模块中提供统一的读写模式，例如：  
    - `getRunState` / `withRunState`  
    - `getBattleState` / `withBattleState`  
    - `getRoundState` / `withRoundState`  
  - 保证所有业务代码都通过这些辅助函数访问相应的状态切片。

### 5.2 目标目录结构（重构完成后）

目标结构示意（仅为约束分层与归属，不强制具体文件名）：

```text
engine/
  state/
    runState.ts
    battleState.ts
    roundState.ts
    gameState.ts
  services/
    run/
      runService.*
      runContracts.*        # 定义 IRunService、IRunContext 等接口
    battle/
      battleService.*
      battleRuleService.*   # 维护 IBattleRuleState 并应用环境 / 惩罚卡规则
      battleReward.*
      aiService.*
    round/
      roundService.*
      itemService.*         # IItemService：Item 注册 + 效果执行统一管理
  utils/                    # 通用工具
tests/
  unit/
    run/
      runService.test.*
    battle/
      battleService.test.*
      battleRuleService.test.*
    round/
      roundService.test.*
      itemService.test.*
  integration/
    runBattleRound.integration.test.*
```

---

## 7. 命名与接口迁移说明

- 原文档中曾提到 RunServiceContract、BattleServiceContract 等名称，实际落地时统一采用 I 前缀接口命名：  
  - RunServiceContract → IRunService  
  - BattleServiceContract → IBattleService  
  - RoundServiceContract → IRoundService  
- 同理，跨层上下文与结果类型也采用 I 前缀命名：  
  - BattleResult → IBattleResult  
  - RoundResult → IRoundResult  
  - RoundContext → IRoundContext  
- 状态数据结构（RunState / BattleState / RoundState）可以维持无 I 前缀的命名方式。

---

## Phase Execution Plan

本章节面向可全自动执行的 AI Agent，用于按照本重构计划分阶段实施重构。  
每个阶段只描述「任务目标」与「执行检查清单」，不约束具体代码结构、函数签名、文件路径或测试写法，实现方式由 Agent 自行决策。

---

### Phase 1：状态模型与职责边界奠基

**重构目标**

- 建立清晰的 RunState / BattleState / RoundState / 顶层 GameState 结构，并保证所有状态读写都有明确归属。  
- 为后续 Run / Battle / Round 服务拆分提供稳定的数据基础，避免多处直接拼装或篡改全局状态。

**待完成任务（Todo List）**

- 盘点当前所有状态数据的使用点，对字段按 Run / Battle / Round 责任域分类并记录。  
- 设计并实现新的状态结构，使 Run / Battle / Round 的信息分布与本计划中的职责约束一致。  
- 为每一层状态提供统一的读取 / 更新辅助函数或方法，禁止在业务代码中直接修改底层存储结构。  
- 调整现有状态存储（例如集中式状态仓库）以持有新的顶层 GameState，同时对外保留必要的兼容访问接口。  
- 更新与状态强相关的测试（包括存在的和新增的），覆盖 Run / Battle / Round 三层的核心状态流转。  

**线上迁移顺序**

- 先引入新的状态结构与访问辅助方法，但不立即删除旧字段或旧访问方式。  
- 优先迁移纯计算类与工具类模块（例如计分、牌堆操作）到新的状态访问方式，保持外部行为不变。  
- 在核心流程（回合处理、战斗结算、Run 推进）迁移完成并通过测试后，再切换状态仓库的真实存储结构为新的 GameState。  
- 最后清理仅用于兼容的旧字段和访问方式。  

**依赖关系与风险提示**

- 本阶段会影响几乎所有读取状态的逻辑，风险在于读写不一致或遗漏更新；应通过集中访问接口与测试来降低风险。  
- 需要特别关注持久化 / 读档逻辑（如果存在），确保新旧状态结构之间的映射清晰可控。  

**与下一阶段的衔接**

- 完成后，Round / Battle / Run 各层服务可以只依赖对应的状态结构工作，避免在实现时再回到旧的「大一统 GameState」。  

---

### Phase 2：Round 层服务与 Item 子系统重构

**重构目标**

- 将抽牌、Hit / Stand、回合判定、临时 buff / debuff、Item 使用等逻辑统一收敛到 Round 层服务。  
- 建立独立的 Item 子系统，使所有 Item 效果都以数据驱动方式作用于 Round 级状态，而不直接触碰 Battle / Run 级状态。

**待完成任务（Todo List）**

- 检索并梳理现有所有与单回合流程相关的代码，包括：起手抽牌、玩家 / 敌人行为、回合结束判定、回合内临时修正等。  
- 设计 Round 层服务的责任边界：负责「回合过程与结果」，不承担 HP 修改与跨回合统计。  
- 抽取与集中管理 Item 效果定义与执行逻辑，统一由 Item 子系统完成效果解析与执行。  
- 确保 Round 层只读写 Round 级状态，并通过明确的回合结果对象将胜负 / 爆牌等信息向上汇报给 Battle 层。  
- 统一入口：AI、玩家输入、UI 操作均通过 Round 层服务触发回合内动作，而不是直接操作底层工具函数或状态。  
- 为典型回合场景（正常胜负、双方爆牌、Item 被环境锁定、特殊 bust 规则等）建立并维护测试用例。  

**线上迁移顺序**

- 先引入 Round 层服务的接口和基础实现，让现有回合相关逻辑通过该服务间接调用原有实现（适配层）。  
- 按功能切片（抽牌、Hit / Stand、Item 使用、回合结束判定等）逐步将逻辑从旧调用点迁移到 Round 服务内部。  
- 完成 Item 子系统后，将所有 Item 行为迁移到新的数据驱动执行路径，并移除对旧效果注册表或散落逻辑的直接依赖。  
- 确认 Round 结果只包含「本回合信息」，所有 HP / Battle 级统计保持由上层接管。  

**依赖关系与风险提示**

- 依赖 Phase 1 的 RoundState 已稳定可用；若 RoundState 设计不合理，会限制 Round 服务设计空间。  
- 迁移过程中需要避免重复结算或遗漏结算，可通过对比迁移前后的典型对局结果验证行为一致性。  

**与下一阶段的衔接**

- 完成后，Battle 层可以将「多回合战斗」视为对 Round 服务的一系列调用，专注于 HP 变化和战斗规则，而无需了解回合内部细节。  

---

### Phase 3：Battle 层服务与规则引擎合流（含 Penalty / Environment）

**重构目标**

- 建立 Battle 层服务，统一负责一场战斗的完整生命周期，包括规则初始化、回合调度、伤害与胜负结算、Battle 级奖励生成。  
- 将 Environment / Penalty 等规则统一归入 Battle 级规则引擎中，使用单一的 Battle 规则状态作为全部计算的依据。

**待完成任务（Todo List）**

- 设计 Battle 层服务的职责与输出：负责战斗开始、连续多回合运行、HP 与护盾更新、战斗胜负与统计结果、Battle 级奖励候选等。  
- 梳理现有 Environment 规则引擎与 Penalty 伤害引擎的职责边界，区分「规则层」与「数值结算层」。  
- 将 Environment / Penalty 卡片对规则的影响统一沉淀到 Battle 规则状态中，例如：目标点数、bust 判断、自动抽牌、牌堆缩减、伤害系数、突然死亡阈值、Item 锁定等。  
- 让 Battle 层服务基于 Battle 规则状态和 Round 回合结果来计算最终 HP / 护盾变化，并维护必要的运行时统计（如连胜计数、惩罚 runtime 等）。  
- 为 Round 层构造精简的「回合规则上下文」，只暴露本回合需要的参数，而不泄露全部 Battle 内部细节。  
- 为战斗起始、每回合开始 / 结束、战斗结束与奖励生成等关键节点补齐测试用例。  

**线上迁移顺序**

- 首先实现独立的 Battle 规则状态与规则服务，使其能够在不影响现有流程的前提下，从 Environment / Penalty 定义中推导完整规则集。  
- 逐步让现有伤害与胜负结算逻辑改为依赖 Battle 规则状态中的系数与阈值，而非各处硬编码。  
- 引入 Battle 层服务接管多回合战斗流程：负责回合循环、调用 Round 服务、应用伤害与更新 Battle 状态。  
- 在行为与结果稳定后，替换掉旧的环境规则引擎与惩罚伤害引擎对外暴露的入口，最终移除多余的实现。  

**依赖关系与风险提示**

- 强依赖 Phase 2 的 Round 服务提供稳定的回合结果；若 Round 结果语义不清晰，Battle 逻辑会复杂化。  
- 在迁移过程中容易出现规则叠加顺序错误、环境卡与惩罚卡冲突未正确处理等问题，需要通过多环境、多惩罚组合的测试验证。  
- 必须确保「规则状态」成为唯一事实来源，否则 UI / 引擎会出现不一致。  

**与下一阶段的衔接**

- 完成后，Run 层可以将 Battle 视为黑盒：输入关卡 / 配置，输出 Battle 结果与奖励候选，从而专注于 Run 级进程与经济系统。  

---

### Phase 4：Run 层服务与 Run 级系统整理

**重构目标**

- 建立 Run 层服务，统一管理一整次 Run 的生命周期、关卡推进、Run 级奖励与总结。  
- 将当前分散在多处的 Run 级逻辑（如经验 / 货币结算、关卡解锁、Run 结束判断等）统一收口到 Run 层。

**待完成任务（Todo List）**

- 设计 Run 层服务的职责：Run 开始、关卡选择与难度曲线、触发 Battle、处理 Battle 结果并更新 Run 级状态、决定是否继续或结束 Run。  
- 定义 Run 级状态的必要信息（进度、玩家 meta、通货与资源、Run 级奖励和结局标签等），并确保其独立于 Battle / Round 级状态。  
- 整理当前触发战斗与推进关卡的入口，将相关逻辑迁移到 Run 服务中，由其统一调用 Battle 服务。  
- 统一 Run 级奖励与经济系统：由 Battle 返回可选奖励，由 Run 根据玩家选择更新 RunState。  
- 如存在存档 / 读档、重新进入 Run 的能力，更新其实现以适配新的状态结构与服务边界。  
- 为典型 Run 流程（新 Run、连续多场 Battle、Run 提前结束、Run 完成）增加测试覆盖。  

**线上迁移顺序**

- 先以包装形式引入 Run 服务，让现有入口通过 Run 服务间接调用旧实现，确保外部调用点集中。  
- 按功能逐步将 Run 级逻辑挪入 Run 服务内部（Run 启动、关卡推进、结算与总结等），每次迁移后保持行为一致。  
- 在 Run 服务完全掌控 Run 生命周期后，移除散落在其他模块中的 Run 相关逻辑，仅保留必要的工具或配置。  

**依赖关系与风险提示**

- 依赖 Battle 层已提供稳定的「启动战斗」与「返回战斗结果」能力。  
- 若 Run 级状态与 Battle / Round 状态耦合过深，需要额外的适配层来避免一次性大改。  

**与下一阶段的衔接**

- 完成后，事件体系和 UI 可以直接围绕 Run / Battle / Round 三层服务与状态组织，提升可观测性与扩展性。  

---

### Phase 5：事件体系与数据驱动规则统一

**重构目标**

- 建立与 Run / Battle / Round 分层一致的事件体系，使调试、动画、日志与遥测都有清晰的事件来源。  
- 强化 Environment / Penalty / Item 等系统的数据驱动结构，使规则扩展主要通过配置而非代码分支完成。

**待完成任务（Todo List）**

- 枚举现有所有战斗相关事件（包括日志、调试埋点、动画触发、环境与惩罚效果触发、奖励事件等），并按层级重新分类。  
- 设计统一的事件命名与负载结构，对应 Run / Battle / Round 生命周期中的关键节点（开始、进度更新、结束）以及规则触发点（自动抽牌、突然死亡、完美得分奖励、Item 锁定等）。  
- 将事件的发出责任集中到 Run / Battle / Round 服务与规则 / Item 子系统中，禁止在零散工具函数中直接发事件。  
- 梳理所有 Environment / Penalty / Item 定义，确保其以声明式数据形式存在，并由规则引擎 / Item 子系统统一解释。  
- 为配置加载、兼容性检查（例如环境卡互斥关系）、数值合法性等添加验证步骤，减少运行时错误。  
- 为关键事件与配置路径增加测试与简单的快照验证，确保后续新增卡牌与规则不会破坏既有行为。  

**线上迁移顺序**

- 优先引入统一的事件分发抽象层，使现有代码可以在不更改事件消费者的前提下，逐步切换事件的发出位置。  
- 先为新的 Run / Battle / Round 服务补充完整事件，再将旧实现中的事件发出逻辑迁移或删除。  
- 在数据驱动部分，先迁移 Environment / Penalty，再迁移 Item；每一步都保持旧配置与新配置并存，直到验证通过后再完全切换。  

**依赖关系与风险提示**

- 依赖前三个阶段的服务与状态边界已经稳定，否则事件的归属会频繁变动。  
- 在迁移过程中容易遗漏某些 UI 或调试订阅的事件，需要对所有订阅点进行静态检查与回归验证。  

**与下一阶段的衔接**

- 完成后，系统的观测性与可配置性显著提升，为最后的清理与后续功能扩展打下基础。  

---

### Phase 6：清理、优化与未来扩展预留

**重构目标**

- 移除所有不再使用的旧实现与临时适配层，稳定新的架构边界。  
- 在 Run / Battle / Round 三层之上，为未来扩展（新卡牌、新规则、新模式、新 UI）预留清晰的扩展点。

**待完成任务（Todo List）**

- 全量搜查旧的战斗 / 回合 / Run 逻辑实现与引擎（包括旧的规则引擎、惩罚引擎、散落的 Item 处理逻辑等），确认其是否仍被调用。  
- 对已完全替换的旧模块执行有序下线：先移除导出与引用，再删除实现，必要时在变更日志中记录。  
- 统一整理目录结构，使状态、服务、规则引擎、Item 子系统与通用工具的划分与本计划中的目标结构保持一致，同时允许内部实现按需要拆分子模块。  
- 审视 Run / Battle / Round 服务接口与事件分类，确保命名清晰、一致，并标注哪些接口是稳定扩展点、哪些仅供内部使用。  
- 为未来功能扩展撰写简短的开发指南或注释，说明如何新增卡牌、扩展规则类型、扩展 AI 策略或接入新的 UI 视图。  
- 在所有阶段完成后执行完整测试与关键场景回归，确认新旧版本在核心玩法上的行为一致，或差异均为预期。  

**线上迁移顺序**

- 按功能簇逐步下线旧代码：先 Round 层旧逻辑，再 Battle 层旧规则与惩罚逻辑，最后是 Run 层旧流程与杂项工具。  
- 每次删除一簇旧逻辑后立即执行构建与测试，确保没有遗留引用或隐藏依赖。  
- 在结构与命名稳定后，可以视需要进行一次轻量的性能与内存占用评估，寻找明显的优化机会。  

**依赖关系与风险提示**

- 依赖前五个阶段已经完成且测试通过，否则过早清理旧代码会放大风险。  
- 需要防止误删仍然被 UI 或外部入口使用的旧接口，可通过静态分析与全局搜索辅助确认。  

**与后续工作的衔接**

- 本阶段完成后，Run / Battle / Round 三层服务 + 数据驱动规则 + 统一事件体系构成稳定内核，后续增加新卡牌、环境、惩罚机制或替换 UI 均可在不大规模重构的前提下迭代完成。  

