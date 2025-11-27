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

## 4. 模块归属与服务设计

### 4.1 Round 层模块

- Round 服务  
  - 实现 IRoundService 相关职责。  
  - 负责单个 Round 的：  
    - 初始化；  
    - 行为执行（Hit / Stand / 使用 Item 等）；  
    - 回合结果判定（返回 IRoundResult，但不改 HP，伤害计算等各种决定，全部返回交给BattleService处理）。  

- Item 子系统  
  - 实现 IItemService 相关职责。  
  - 将原有 Item 效果实现与效果注册表统一归口：  
    - 维护 Item 与效果函数的注册表；  
    - 提供应用 Item 效果的统一入口；  
    - 只读 / 写 RoundState 或通过回调更新 RoundState，不直接触碰 BattleState / RunState。  
  - Round 服务通过注入 IItemService 执行 Item 效果。

### 4.2 Battle 层模块

- Battle 服务  
  - 实现 IBattleService 相关职责。  
  - 负责 Battle 的整体状态机：  
    - 调用 Battle 规则服务初始化 / 更新 Battle 规则状态；  
    - 调用 Round 服务执行回合并获得 IRoundResult；  
    - 基于当前规则 + IRoundResult，更新 BattleState 中的 player / enemy。决定是否开启下一个round或者结束battle（失败了还是胜利了）；
    - 敌人 AI 与 Battle 奖励应该都放在battle层；
    - Battle 结束时向 Run 层汇报 IBattleResult。

- Battle 规则服务  
  - 实现 IBattleRuleService。
  - 这个本质上是定义了一系列的规则。
    - 环境卡、惩罚卡，这些都只影响当前 Battle 的整体规则与结算，也就是修改IBattleRuleService内部的数据。
    - BattleService不需要知道IBattleRuleService内部的细节，只需要知道现在的规则即可。
    - 定义并维护 IBattleRuleState，包含：  
      - 计分 / bust 规则；  
      - 牌堆相关规则（牌堆缩减、自动抽牌等）；  
      - 伤害相关系数（基础伤害、倍率等）；  
      - Item 锁定规则；  
      - 特殊胜利规则（如突然死亡阈值等）。  
      - 等等（结合了目前所有环境卡、惩罚卡）...
    - 将环境卡、惩罚卡的效果解释到规则状态中（不直接做数值结算）。  
    - 为 Round 层提供「回合规则上下文」，只包含 Round 需要了解的目标点数、自动抽牌数量等参数。
    - 各种计算直接交给BattleService。也就是说：
      - battleService + batleRuleState -> 经过数学计算 -> 返回结果 -> 决定是否开启下一个round、失败、成功。

- Battle 奖励模块  
  - 可实现为服务接口或一组纯函数。  
  - 在 Battle 胜利后，根据 BattleState / RunState / IBattleResult 生成 Battle 级奖励候选 DTO，交给 Run 层处理。

- AI 服务  
  - 提供战斗中敌人的行为决策（HIT / STAND / 使用 Item 等）。  
  - Battle 层决定何时调用，并负责将决策转化为 Round 调用。

> 惩罚卡、环境卡本质都是对规则（IBattleRuleState）的修改：  
> - 惩罚卡子系统负责「抽到哪张惩罚卡」，再由 BattleRuleService 解释其规则；  
> - 环境卡子系统负责「抽到哪些环境卡」，再由 BattleRuleService 解释其规则；  
> - BattleService 只感知「规则状态」和「数值结果」，不关心具体卡牌如何实现规则。


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
