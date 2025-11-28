#### [2025-11-27]
##### **Feature**
- 首页新增「无尽模式」按钮，可直接开启 3 张环境卡的高压战斗，并同步推进新的模式参数到 GameState/引擎初始化逻辑。
##### **Fix**
- 只有level 1才会发放初始item cards，之后的战斗不会发放。只会给敌人在每次战斗开始发放初始item cards。
#### [2025-11-26]
##### **Feature**
- 教程页面（2页）
##### **Refactor**
- 重构一：
  - 新增 `engine/services/runLifecycleService.ts`，统一 `startNewRun` / `prepareNextLevel` 的 GameState 构造（敌人、环境、惩罚卡、套牌、环境规则一次完成）。
  - `RoundService.startRun` 与 `RewardService.prepareNextLevel` 改为调用生命周期门面，删除重复初始化逻辑并确保首关/后续关流程一致。
  - Reward 阶段只剩金币计数与奖励选项重置，`GameEngine` 继续通过 Combat/Reward API 推进流程，状态构造细节完全收口到 lifecycle 服务。
- 重构二：
  - 建立 `DamageService`，统一 Clash 判定、环境加成、护盾结算、回血与 Sudden Death，所有伤害事件统一走 `damage.number` 管线。
  - 新增 `PenaltyEngine`，集中管理 `PenaltyRuntimeState` 与惩罚卡 fallback 逻辑，`RoundService` 只需下发上下文即可获得伤害/治疗结果。
  - `RoundService`、`ItemEffectService`、Combat 管线全面改用 Damage/Penalty Engine，删除散落的 HP/护盾写操作并共享统一日志/事件播报。
  - 抽离 `CreateMetaFn` 到 `engine/services/serviceTypes.ts`，便于多个服务共用统一的日志工厂。
- 重构三：
  - Integrate `EffectRegistry` into Combat, ItemEffect, and Reward Services
  - Added `EffectRegistry` to `CombatService` to manage item effects more efficiently.
  - Refactored `ItemEffectService` to utilize `EffectRegistry` for executing item effects.
  - Updated `RewardService` to bind `EffectRegistry` and apply event effects through it.
  - Modified `roundService` to await event trigger application for perfect scores.
#### [2025-11-25]
##### **Feature**
- 重新设计主页美术
  - 日夜切换
  - 加入低频、低干扰、轻量级的动态或静态像素元素（随机鸟、云、星星）
  - 添加首页的酒馆和随机小人
  - 开始游戏首页zoom-in
- sktech 模式
- 可拖拽式卡片
- 添加 9 张环境卡
  - 动态目标点数（点数改变）当前对战中，目标点数自动变为 *18 / 24 / 27*（卡牌抽取时随机确定）。 
  - 伤害加成（Damage +1）当前对战中，所有伤害结算额外 +1。 
  - 低血惩罚（Sudden Death ≤3 HP）当前对战中，回合结算后若任一玩家生命值 ≤3，则立即死亡。 
  - 缩小牌库（Small Deck）每回合开始时，从牌库中随机移除 2 张牌。 
  - Perfect 奖励当前对战中，任意玩家在结算时打出 perfect（等于当前 target），抽一张道具卡。 
  - 强制自动抽牌（Auto Hit）每回合开始时，双方自动抽 1 张牌。   
    - 与「回归传统（禁用道具卡）」存在潜在冲突。 
  - A 始终为 11（High-Risk Ace）所有 A 在该局中固定计为 11。 
  - 禁用道具卡（回归传统）本局中玩家无法使用 Item Cards（但仍会正常抽取、获得）。   
    - 与 Auto Hit 存在潜在冲突。 
  - 爆牌（Specific Bust at 17/18）当前对战中，点数达到 17 或 18 也会被视为爆牌。  
    - 与「点数改变（18/24/27）」存在直接冲突。
#### [2025-11-24]
##### **Feature**
- 新增 Penalty Cards 惩罚卡系统：每场 Battle 固定抽取 1 张惩罚卡，由数据驱动的 damageFunction 统一处理胜负双方的 HP 结算
- 惩罚卡池 v1.0（固定伤害、递增伤害、分差伤害、胜者回血、连胜压制）
- 重新设计道具卡、惩罚卡、环境卡的美术风格
- 新增入场、退场动画
- 超帅的 clash 比分动画
##### **Refactor**
- 重构UI相关文件
#### [2025-11-24]
##### **Feature**
- 新道具卡
  - 恢复 3 点 HP。
  - 在本回合结算阶段，抵消 3 点所受伤害。
  - 在本回合结算阶段，使敌人额外承受 2 点伤害。
  - 从牌库中抽取一张“最优卡牌”，即最能使当前点数接近目标点数（例如 21 点）的卡牌。
  - 尝试从牌库中抽取点数为 x 的卡牌；若该牌已不在牌库中，则不发生任何效果。
  - 将玩家与敌人上一张抽到的手牌互换。
  - 撤回敌人的上一张抽牌。
  - 撤回玩家自身的上一张抽牌。
  - 替换玩家的上一张手牌并重新抽取一张手牌（若牌库为空，则无效果）。
  - 强制对方抽取一张手牌。
  - 随机抽取两张道具卡，但玩家承受 2 点伤害作为代价。
  - 修改本回合的胜利判定，使目标点数变为 18 / 24 / 27。
  - 本回合中免疫所有结算伤害。
  - 随机复制任意道具效果并补抽 1 张道具卡
  - 抽 1 张手牌且在安全情况下令本回合败者额外承受 2 点伤害
  - 吸取敌方 1 点生命值并同步回复自身
  - 按当前持有道具数等量回复生命值
##### **Refactor**
- 拆分 `combatSerivce` 成 `aiService`、`itemEffectService` 和 `roundService`
#### [2025-11-23]
##### **Feature**
* 日志、回放、撤销、加载历史、保存历史功能
* debug 窗口
#### [2025-11-22]
##### **Refactor**
* 系统大重构
