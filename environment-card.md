# Proposal: Introducing **"Environment Cards"**

I’d like to propose a new gameplay system called **Environment Cards**.  
The idea is simple: **at the beginning of each fight (each enemy), the game randomly draws three Environment Cards that modify the global rules of that fight**.

This creates dramatic round-to-round variation and adds a new layer of strategy on top of our existing “21-point + item card” system.

## Why Environment Cards?

1. **Increased Replayability**: Each fight feels different because the rules changes.
2. **Stronger Roguelike Identity**: This system introduces “run-defining modifiers,” similar to what Hades, Balatro, Slay the Spire, and Risk of Rain.
3. **Easy to Implement, High Design Value**: Environment Cards are lightweight from a technical perspective, but good to extend the depth of the game.

# Appendix A — Current Environment Cards I Came Up

1. During this fight, the loser of Round 1 takes 1 damage, Round 2 takes 2 damage, Round 3 takes 3 damage, and so on.  
2. During this fight, damage to the loser equals the score difference between winner and loser.  
3. During this fight, the loser takes 1–4 random damage.  
4. At the start of each round, each player either takes 1 damage or heals 1 HP (50/50).

5. During this fight, if the player Busts, they take 2–4 fixed damage.  
6. During this fight, if both players Bust, both take 5 fixed damage.

7. Each round, both players may pick 1 of 2 item cards from a shared pool (blind pick).  
8. During this fight, each time the player draws a card, there is a 50% chance to gain a random item card.

9. During this fight, the winner is whoever is closest to 27 or 24 or 19 (those are 3 separate cards).  
10. During this fight, all item card effects are randomized (can be removed, bold design).  
11. Each round, 2 random cards are removed from the deck (smaller deck).  
12. At the start of each round, both players automatically draw 1 card.  
13. When drawing, players draw 2 cards and must choose 1 to keep.  
14. Each player has only 30 seconds per turn (auto-stand when time expires).
15. All damage in this battle is increased by +1.
16. If a player's HP falls to 3 or below, they immediately die.

# Appendix B - Current Item Cards I Came Up
1. Restore 2–4 HP.  
2. During this round’s resolution, negate 2–4 incoming damage.  
3. During this round’s resolution, the enemy takes +2 extra damage.

4. Reveal all of the opponent's item cards this round.  
5. Draw the “best possible” card (closest to optimal target like 21).  
6. Attempt to draw card **X** from the deck (those are 11 separate cards); if not present in the deck, nothing happens.  
7. Swap the last drawn card between you and the opponent.  
8. Remove the opponent’s last drawn card.  
9. Remove your last drawn card.  
10. Force the opponent to draw 1 card (if the deck is empty, nothing happens).  
11. The item’s effect is completely random; also draw 1 additional item card.  
12. Draw 2 item cards but take 2 damage.  
13. For this round only, change win condition to closest to 19 or 24 or 27 (those are 3 separate cards).  
14. Gain immunity to this round’s resolution damage.  
15. Replace one Environment Card with another chosen from 3 options.  
16. Passive card: When your HP reaches 0, consume this card and revive at 1 HP.
17. For this round, your opponent only has 7 seconds to act.  
18. Shuffle your entire hand.  
19. Shuffle all your item cards.  
20. Steal 1 random enemy item card; if they have none, gain 1 random item card.  
21. Peek the next card in the deck.  
22. Peek the opponent’s hidden card.  
23. Draw 1 card; if you don’t Bust, the loser takes +2 additional damage this round.  
24. The next time you take damage, it becomes exactly 1.
25. Discard one of your card with highest face value.
26. Choose one of your card and replicate.
27. During this round’s resolution, any damage you take is also deducted from the enemy’s HP for the same amount.