
## Level System
帮我设计并开发一个 **关卡选择地图系统（Level System）**，用于在每个 Level 开始前展示玩家的路线选择。本系统中的地图在每次 Run 时都会随机生成，同时包含分支路线，允许玩家在不同路径之间进行策略性选择。

玩家可以查看**下一关**的相关信息（例如：即将对战的敌人、该 Level 的 3 张环境卡堆叠），但**无法查看完整地图**。也就是说，地图会在玩家完成当前 Level 后，才随机生成下一段可供选择的节点，而不是一次性展示完整路径。

为了保持界面简洁与信息清晰，地图最多只储存最近 **两次历史 level 信息**（包括刚刚通关的 Level）。更早的地图节点不会保留。

地图节点的布局需要 **整齐、居中、等距排列**，避免随机摆放造成的杂乱感，确保视觉一致性与可读性。

除了常规的敌人节点外，地图上还可能出现以下特殊节点，用于触发不同类型的随机事件：

1. **商城节点（Shop Event）**：商店会随机刷新，可使用金币购买 item cards。
2. **宝藏节点（Treasure Event）**：进入后有几种可能结果：获得 2 张随机 item cards、获得 5 金币、或遇到敌人埋伏触发即时战斗。

整体风格偏向 **探索与冒险**：玩家在“西部世界”风格的环境中穿梭于不同小镇，寻找机会并参与赌博挑战。地图呈现类似 **超级马里奥世界的关卡选择**那种节点跳跃感，轻松、直觉，同时保有明确的冒险风味。


# Map Generation Algorithm



下面为你提供 **游戏结构（单关卡=Level，逐关生成，下一个 Level 才揭示）的“地图随机生成算法 Map Generation Algorithm 1.0”**。
包含 **Depth（深度）、Branching（分支）、Node Type Weight（节点权重）** 三大核心逻辑，写法偏向 GDD + 程序可实现性。

# 1. **定义（Definitions）**

### **Level Depth**

单次 Run 中，Level 序号：
`Level 1 → Level 2 → … → Level X`

### **Branching**

每当玩家完成当前 Level 时，系统生成 **1〜3 个新节点**（路线分支）。

### **Node Types**

节点类型包括：

* **Enemy（普敌）**
* **Shop（商店）**
* **Treasure（宝藏）**

---

# 2. **整体流程（高层逻辑）**

每当玩家打完当前 Level：

```
Function generateNextNodes(currentLevel):
    if currentLevel == Boss:
        end run
    else:
        nodeCount = random(1 or 3)  // 分支数量
        nodes = []
        For i in nodeCount:
            nodes.append(generateSingleNode(currentLevel + 1))
        return nodes
```

玩家只能看到：
* 当前 Level
* 下一个 Level 的节点（1 或 3 个）
* 最近两次历史记录

---

# 3. **Node Type 权重机制（Node Type Weight System）**

不同 Level 的节点类型出现概率不同。

## 3.1 概念

使用权重分布（Weights）来决定分支中出现哪种节点：

```
NodeTypeWeights = {
    "Enemy":   weightA,
    "Shop":    weightB,
    "Treasure":weightC,
}
```

每次生成新 Level 时，根据权重随机抽取。
⚠ 第 1 关固定为 Enemy

---

# 4. **Level Depth 与 Node Type 动态调整（Dynamic Weight Adjustment）**

随着 Run 进度增加，节点权重应动态变化。

## **4.1 早期（Level 1〜3）**

> 以提供资源为主

* Shop 权重 ↑
* Treasure 权重 ↓

## **4.2 中期（Level 4〜6）**

> 路线开始分化，资源变关键

* Shop 权重中等
* Treasure 权重↑

## **4.3 后期（Level 7〜Boss 前）**

> 高难、高价值节点出现频率上升

* Treasure 权重中等
* Shop 权重降低（避免给太多 item）

# 5. **生成单个节点内容（generateSingleNode）**

生成节点时，不只是生成类型，还要生成：

1. **该 Level 的 3 张环境卡（Environment Cards）**
2. **敌人信息**
3. **奖励池或事件（若为 Event / Treasure / Shop）**

---

# 6. **Branching（1 或 3 分支的生成规则）**

### **6.1 简单规则（推荐）**

* 50% 概率：生成 3 个节点
* 30% 概率：生成 2 个节点
* 20% 概率：生成 1 个节点

确保路线变化丰富。

### **6.2 减少混乱感**

即便是 2 分支，它们也必须：

* 居中
* 等距
* 垂直对齐
* 不能出现过多横向偏移
* 与 UI 风格一致

---

# 7. **地图呈现（Map Rendering）**

### 显示内容：

* 当前节点
* 下两个节点（分支）
* 最近两次历史节点（半透明显示）

### 节点布局逻辑：

```
rootY = fixed
rootX = center
branchSpacing = constant value
```

常态为：

```
      [历史 Level]
           │
      [当前 Level]
        /       \
 [下个 Level A]  [下个 Level B]
```

---

# 8. **历史节点规则**

你要求：

* 只显示 **最近两个历史节点**（包含刚刚通关的）
* 再之前的自动丢弃


# ⭐ 最终效果总结（一句话）

**玩家每通关 1 个 Level，系统基于动态权重生成 1～3 个新节点（含敌人、商店、宝藏、事件），每个节点拥有自己的 3 张环境卡，形成不断分支、不断更新的轻量级“西部探索地图”。**
