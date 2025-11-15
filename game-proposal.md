# Game Proposal: **LAST HAND**
*A Blackjack-Inspired Survival Roguelike Card Game*

### 1. Overview
**Last Hand (temp name)** is a 2D card-based survival roguelike inspired by **Blackjack (21)** mechanics. 
Players battle an endless stream of enemies by engaging in high-risk blackjack duels, using item cards, skill cards, and tactical choices.

Each death gains resources that allow players to upgrade their character, unlock new cards, and enhance their starting loadout, creating a long-term progression loop with high replayability.

The visual style should be lightweight (e.g: pixel art), making development fast and suitable for a school demo.

### 2. Core Gameplay

#### 2.1 Blackjack Core

- Both player and enemy accumulate card values.
- Goal: reach as close to **21** as possible without exceeding it.
- Going over 21 (bust) results in penalty: Taking heavy damage
- Player actions each turn:
  - Hit (draw a card)
  - Stand (stop drawing)
  - Use item/skill cards

#### 2.2 Turn Structure

Each round includes:
1. Player Phase
   * Hit / Stand  
   * Play item or skill cards (modify numbers, manipulate draws, disrupt enemy logic)
2. Enemy Phase
   * Enemy automatically draws according to its AI Algorithm:
     * Greedy Algorithm
     * Defensive Algorithm
     * Disruptive Algorithm
     * Higher-tier enemies may corrupt cards or alter your draws.
3. Resolution Phase (Each round)
   * Compare total values: the larger values close to 21 wins
   * Determine busts: whoever exceeds 21 loses health
   * Apply damage and special effects

#### 2.3 System: Item Card
A fully original system built on top of blackjack. Here are some examples(**We still can introduce tons of CREATIVE cards into the system to make the game fun, those are only for brainstorming and easy to come up with.**)
- **Number Manipulation Cards**
  - +1 / -1 to total
  - Convert a card into an Ace
  - Set your total to a fixed value (e.g., 10)
  - ...
- **Draw Manipulation Cards**
  - Peek at the next card
  - Force enemy to draw
  - Swap first visible card with the enemy
  - ...
- **Attack/Defense Cards**
  - Deal direct damage
  - Block future damage
  - Prevent enemy from drawing this round
  - ...
- **Corruption/Chaos Cards (Rare)**
  - Wipe enemy’s hand
  - Remove a negative card from your deck
  - ...
- **Change Game Rule Cards (Rare)**
    - Change the number limit from 21 to a fixed value (e.g., 20, 24, 30, 16)
    - Players cannot use certain cards during this round 
    - ...


#### 2.4 Survival Mode
An **endless mode** where enemies continuously appear and grow stronger.
- Defeat enemies → earn rewards  
- Difficulty increases gradually  
- When the player dies, the run ends  
- Earned rewards become resources for permanent upgrades

### 3. Roguelike Progression
After death, the player earns **Rewards (e.g. data points)** based on how far they survived. These resources can be spent on:
1. Improving the starting deck
2. Increasing character stats (max HP, hand size, special abilities)
3. Expanding item slots
4. Boosting drop rates for better cards
5. Unlocking new enemies, events, difficulties
Basically, this creates a strong “try → die → upgrade → try again” loop, which is Roguelike.

### 4. Enemy Design
Enemies differ in both draw logic and special abilities, providing fresh challenges each run. Here are some examples:
1. Greedy Ghost
   - Draws until reaching 18–21.
   - High bust chance, but deals huge damage when the player busts.
2. Corruptor
   - Corrupts one random player card each round (becomes a negative effect).
3. Judge of Void
   - Swaps its first face-up card with the player’s.

If needed, we may introduce more enemies are unlocked gradually to enrich progression.

### 5. Visual Style
- I recommand Pixel art or similar forms
- UI Layout:
  - First player perspective. player area is close to the screen, enemy area on the other side
      - more immersive
  - Blackjack table in the center

### 6. Game Loops
1. Short Loop (One Round): Draw → Play cards → Compare → Deal damage
2. Mid Loop (One Enemy Battle): Strategy → Defeat enemy → Earn rewards
3. Long Loop (One Survival Run): Survive longer → Gather resources → Die → Upgrade → Repeat

### 7. Story Setting (Optional)
* I have no pariticular thoughts on this, this may cause extra work.