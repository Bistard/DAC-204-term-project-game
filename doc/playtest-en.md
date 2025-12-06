# "Last Hand" Playtest Report (Individual)

**Course:** DAC 204  
**Name:** Sihan Li (Chris)  
**Team:** Last Hand Team  
**Role:** Programming

## 1. Game Overview: Formal Elements

"Last Hand" is essentially a single-player, deck-based rogue-lite. The player acts as a half‑baked gambler in a border town, bringing a "last hand" of cards to gamble against a cast of stylistically distinct AI opponents.

I don't want these opponents to be just piles of pure numbers; I want them to feel like they have a bit of "human flavor" as procedural personalities: some greedy, some conservative, some chaotic. They share one underlying rule set, but different weights and thresholds grow them into vivid table personas like a "recklessly greedy bruiser" or a "calculating‑to‑death cheater." Ideally, what players remember are "the sheriff who loves to overdraw" and "the old con man who's always playing dead," not a piece of algorithm pseudocode.

At the single‑hand level, the game inherits Blackjack's intuitive objective: get as close as possible to the target total (default 21, but it can be modified by rules) without busting, and beat the opponent in a point comparison. As long as the opponent busts and you don't, it's still a win even if your score isn't perfect.

At the run level, the player is trying, across a sequence of stages, to stay alive longer, earn more money, hoard more items, and push further under increasingly punishing environments and penalties. At the meta level, multiple runs accumulate resources to unlock long‑term growth such as max health and backpack slots, letting the player explore the strategy space under different rule combinations.

The normal mode uses a finite number of stages and a sense of staged "small victories" to give clear closure. The endless mode deliberately softens the notion of an end point, shifting the focus toward resource management and psychological stamina itself.

Each run is structured as a loop of four phases:

- **Stage generation:** Use the save data to set initial health and backpack capacity, draw the environment and penalty cards for this run, generate the current opponent, and set up the rule framework for this round.  
- **Drawing and actions:** The player and opponent alternate between hit / stand. Opponent behavior is driven by predefined AI personalities. Beyond the basic actions, the player can consume one‑shot items to inject temporary rules at key turns, such as "rewrite the draw," "change the target," or "force the opponent to draw."  
- **Resolution:** First compare points to determine win/loss, then apply penalty cards to resolve damage and healing, and finally layer on the extra effects from environment cards. The result is reported both numerically and via short text.  
- **Rewards and progression:** After winning a round, the player picks loot items and gains coins. When the run ends, its gains are converted into meta‑currency used to purchase persistent upgrades.

These four phases repeat within a run, stitching together Blackjack's moment‑to‑moment counting pressure with rogue‑lite style long‑term planning into a clear, rhythmically varied loop.

The core resources are health, hand/deck, and consumable items. Penalty cards concretize the cost of "losing a round" into HP loss, tying every act of greed or caution directly to the character's survival.

Environment and items shift the criteria for what counts as a "good card" or "bad card" and redirect resource flows, pulling out an ever‑rising risk curve: players are constantly weighing the short‑term gain of "drawing one more" against safety in future stages. Coins and meta upgrades form the long‑term axis: the needs of the current run and growth in the next few runs are always fighting over the same budget.

In some stages I deliberately stack high‑risk, high‑reward environment effects, so that "going for it" can either generate explosive positive feedback or genuinely throw away the entire run. That way, when players say "one more hand," it's not just for the numeric rewards; they really are making deals with risk.

## 2. Dramatic Elements and Experience Goals

"Gambling your fate with your last hand in a border town" is the core premise of this game. The humble town, the closed gambling table, and the cold "penalty notices" on the wall together create a slightly oppressive sense of danger. Each penalty card is both a rule and a subtextual line from this shady establishment: you know you're sitting at an unfair table, but you still want to see if you can somehow beat it.

So every time players sit down at the table, they naturally project a bit of "this might be my last chance to turn things around." Meanwhile, light‑touch copy and UI details hint at the town's backstory, turning the table into a small crack in the larger world rather than a pure system in a void.

Within a single game, tension comes from three moments: the hesitation as you creep toward the bust threshold, the pop when items intervene, and the emotional swing at the moment of resolution. At the run level, challenge comes from the stepwise stacking of penalties and environments: the deeper you go, the more "ridiculous" things get, but the more chances you have to create a legendary run.

Loot choices between stages and upgrades in the main menu are intentionally designed as "breathing spaces." Here players can briefly step out of counting mode and turn that string of greedy bets and lucky escapes into a concrete plan for "how to play the next one."

The emotional curve I hope to deliver starts from curiosity and cautious probing, passes through rounds of "just one more card" greed and anxiety, and finally settles into a self‑driven impulse: "next time I'm definitely going to play better." That way, the game doesn't devolve into a pure random score grinder, but feels more like a long‑form gamble with rises, falls, and a sense of story.

## 3. Design and Development Iteration

The original idea was simple: stretch that "one card can turn everything upside down" thrill of Blackjack into the long arc of a rogue‑lite. Following that line, I built a four‑layer structure of "environment + penalty + items + meta upgrades": the first two reframe the context and risk of each round, items create in‑run spikes, and meta ensures that failure still paves the way for the next attempt.

On paper, we deliberately used a few typical combinations to stress‑test these four layers, such as "high‑damage penalties + high‑reward environments" or "low‑damage penalties + strong healing," to see if they could produce clearly distinct feels. The goal back then was modest: if just tweaking a few card parameters could make an entire run feel completely different, then the framework was worth building out.

When implementing it, I broke the whole thing into several relatively independent modules:

- A base drawing and scoring system that can be overridden by rules  
- A penalty system that supports multiple damage curves  
- An environment system that changes evaluation criteria  
- One‑shot items that can interrupt the flow  
- A meta‑economy that carries long‑term numbers

On the API side, I tried to keep things modular: modules only talk through a small, clear set of interfaces. This keeps maintenance from blowing up as combinations grow, and also leaves room for adding "more cards, more enemies, more environments" later.

When coding, I prioritized writing the "hard to patch later" underlying rules as generically as possible, while pushing fragile elements like damage resolution and environment effects into data‑driven layers. That way, post‑playtest adjustments often only require editing a line of config instead of touching core logic.

After we had the first playable internal build, we went through several intensive iteration cycles based on playtest feedback.

**Readability and clarity.** In early versions, many players couldn't tell "environment rules" and "penalty rules" apart, and often had no idea why they suddenly lost a chunk of HP. To address this, we strengthened textual prompts and iconography, and completely separated the three main systems in the UI layout, so that within one or two runs players could intuitively map "this row is environments, that row is penalties."

**Difficulty and pacing.** Initially, the numbers were too punishing and healing options too scarce, so many runs ended within two or three rounds. Through repeated tuning we lowered the damage ceiling of early penalty cards, increased the appearance rate of healing and defensive items in the first few rounds, and added extra rewards for perfect scores. Only then did the overall feel land in the "tense but not hopeless" range.

**Strategy space and 'magic' feeling.** Many testers thought the items were interesting but in some situations "it barely matters whether you use them," with too little strategic differentiation. In response, we added a batch of more extreme items and environment effects, such as forcing the enemy to draw, directly rewriting win conditions, and restricting the use of certain item types, so players can make genuinely risky, dramatic "big moves" in key turns. Overall, these playtest‑driven iterations did push the system from "looks rich on paper" toward "these tricks actually matter in real decision‑making."

## 5. Representative Playtest Observations

On their first try, new players are often overwhelmed by the three‑layer rule set: they don't know which rules they "have to understand right now," and tend to ignore item and penalty details, simply hitting or standing on instinct.

To address this, our improvement direction is: only expose the most core rules in the first few rounds, gradually unlock environment and penalty combinations, and provide strong positive feedback the first time players use key items, helping them realize "this thing is important." In several on‑site sessions, I could literally see where players' gazes moved across the UI; those "invisible / unnoticed" areas directly drove subsequent UI restructuring.

Players with card game experience usually form a stable strategy template quickly: when penalties deal fixed damage, they lean toward cautious, low‑volatility play; when penalties scale with point difference, they are more willing to "push to the limit" and bet on a single big burst of damage to punch through defenses.

The problem is that under a few extreme environment combinations (for example, auto‑draw plus high‑bust A cards), some players feel "this run was doomed from the start." The optimal strategy becomes too one‑dimensional, and decision‑making gets dull. At the same time, several supposedly strong items (like "draw the best card" or "draw to an exact total") end up sitting unused in inventories; many runs end with backpacks stuffed full of powerful cards that were never played.

From a design point of view, the current version does provide a decently wide decision space, but also exposes several issues: some environment combinations flatten the optimal strategy into a straight line; strong items lack intuitive signaling of "opportunity cost," so it's hard for players to feel what they actually lost by not using them. Future directions include: adding symmetric compensation to extreme environments (for example, raising the appearance rate of healing or shields in auto‑draw scenarios) so players still have viable counterplay under high risk; making resolution and logs more explicit about "how the outcome would have differed if a certain item type had been used here," nudging players to reflect on their decisions afterwards; and modestly reducing both the number and frequency of strong items so they feel more like rare, decisive gambles instead of permanent museum pieces sitting in a safe.

First‑time testers generally find the first two stages on the hard side, often getting knocked out by chains of heavy penalties before fully understanding the system. Some explicitly mention that when they repeatedly auto‑draw bad cards or run into extreme environment setups, they get a subjective sense that "the system is out to get me."

By contrast, more experienced players, after a few adaptation runs, can reliably clear the early levels and feel that mid‑to‑late difficulty is more interesting and in line with expectations. This both echoes the common rogue‑lite pattern of "first‑run sudden deaths" and highlights how extreme our early damage curves and healing scarcity were.

Based on this feedback, I numerically lowered the early penalty cards' damage ceiling and increased the share of healing and defensive items. I also added mid‑run feedback like "how many high‑value cards have already appeared this game" to the log, helping players build an intuition for deck state. On the meta side, I plan to let the first few failures more quickly unlock extra health or item slots, conveying a clearer baseline promise that "the next run will be a bit easier."

Most testers have very strong emotional reactions to moments like "busting," "perfect scores," and "sudden death," and generally see them as the most memorable parts of the game. Some people clearly start to "float" after a winning streak, making more aggressive choices, while the corresponding streak‑based damage‑boost penalty cards effectively channel that excitement back into new tension.

But others note that if several rounds in a row pass without any "dramatic event," the mid‑run experience can feel somewhat flat. Overall, this feedback matches what Fullerton calls the "dramatic arc": over the course of a long run, we need enough small peaks interspersed so players always have emotional beats to latch onto.

Going forward, I'm considering adding extra presentation and rewards for comebacks or narrow escapes under certain conditions—for example, special audio and visual effects for "edge‑of‑death comebacks" or "escaping by a sliver"—and slightly adjusting the trigger probabilities of a few events, to ensure that within a certain number of games, at least one or two deeply memorable dramatic rounds are likely to occur.

When complex items, environments, and penalties stack together, some players find it very hard to predict the final outcome of resolution. For instance, if you first change the target total, then use a shield, then trigger a streak‑based damage bonus, the order in which these layers combine is not at all obvious. With both "damage based on point difference" and "sudden death thresholds" in play, many people also can't tell which rule should apply first.

Internally the system already has a well‑defined computation order, but from the outside, this knowledge often takes a dozen games of trial and error to fully grasp. To improve predictability, I plan to provide more detailed, bullet‑point breakdowns at key resolution moments, briefly explaining in natural language where each instance of damage came from and in what order it was applied. In the tutorial or help screens, I also want to add a "resolution flow diagram" that visually lays out "first compare points, then apply penalties, then apply environment effects." Ideally, what currently takes ten‑plus games of probing to learn will shrink into a few minutes of intentional study.

## 6. Difficulties, Successes, and Personal Reflection

For me, the biggest difficulty lay in the combinatorial explosion created by freely mixing the three layers of systems, and in how to keep both logical safety and newcomer experience under control within limited time. Any small change could blow up in some rare combination, and these "hidden landmines" were present throughout development.

What keeps me energized is that once players truly understand the rules, many spontaneously ask to "play a few more runs" and start describing their own behavior using words like "being greedy" or "taking a gamble." That tells me the theme really is being conveyed through mechanics rather than just copy, and that the core loop already has some stickiness and room to grow.

In terms of time management, I also went through a mindset shift: at first I wanted to do almost everything—maps, events, narrative, more enemies... In the end I had to turn around and ask myself, "If I only have these few weeks left, what do I most want to preserve?" The most important takeaway from this course for me is learning to nail down the core loop first, then stack fancy features on top, instead of getting dragged around by the "fancy stuff" from day one.

## 7. Shelved Ideas and Trade‑Offs

From the initial proposal to the current playable version, we had to leave quite a few fun ideas on the "meeting room floor" for now. These trade‑offs both remind the team to keep scope in check and naturally sketch out a roadmap for future versions.

The most obvious one is the stage map system. Early on we designed a map similar to Slay the Spire: after each stage you choose the next node (normal combat, shop, treasure chest, etc.) along branching paths, and only the next step is shown rather than the entire map, to add route‑planning interest at the run level. Due to implementation cost, we ultimately kept only linear stage progression plus random environment/penalty combinations.

Another shelved idea was a more fully realized set of shop and treasure events. The design draft once included things like visiting a shop after battles to buy specific items, and treasure nodes where you weigh high rewards against possible traps. Under time constraints, these now only appear as simple rewards or meta upgrades, lacking an independent map‑layer structure.

We had also planned to give each enemy its own unique environment and penalty combinations to make their playstyles more distinguishable—for example, "a judge who only favors defensive items" or "a ghost who steals and uses your items." In reality, in the current version enemy personality mostly shows up in drawing tendencies and base stats; in the truest sense, the "personality differences" are still far from fully mined.

Lastly, on the narrative side, we had discussed adding town NPCs, branching dialogue, and long‑term causal chains (like triggering a special boss if you win too much at a certain tavern), but ended up only hinting at these stories through UI and fragmentary text, without turning them into a full narrative system.

These temporarily shelved ideas are on one hand the boundary of this course's scope, and on the other a clear roadmap: if I ever get the chance to continue this project, I already have a pretty good sense of where to start adding content.

