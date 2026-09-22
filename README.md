# Blackjack Terminus

Blackjack Terminus is a browser-based casino training lounge for learning and practicing blackjack. It's a single-page app built with plain HTML, CSS, and JavaScript (no build tools, no dependencies) that pairs a fully playable blackjack table with dedicated trainers for basic strategy and card counting.

## What it can help you with

- **Learning to play blackjack** the right way, with a real table flow: betting, dealing, hitting, standing, doubling, splitting, surrendering, and insurance.
- **Mastering basic strategy** — the mathematically optimal play for every hand vs. dealer up-card — through three focused practice modes instead of just memorizing a chart.
- **Learning to count cards** using the Hi-Lo system, with a plain-language walkthrough, a drill that trains you to track the running count under realistic conditions, and a second drill that trains the true-count-based plays that override basic strategy.
- **Practicing at your own pace**, with adjustable deck size, dealing speed, and hand counts so you can start slow and work up to speed.
- **Tracking your progress over time** with independent player profiles, each with its own bankroll and lifetime stats.

## Getting started

Open `index.html` directly in a browser, or serve the folder with any local static server (recommended, so audio/assets load correctly):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser and click **Enter Blackjack Terminus**.

## Getting the most out of it

### Profiles
Clicking **Play Blackjack** from the main menu takes you to a profile-gated entry screen instead of straight to the table, since every bankroll and every set of stats now lives on its own profile:

- **Create New Profile** — give it a unique name and pick a preset (Training, True Game, or Custom — see below). Every new profile starts with a $1,000 bankroll, and its balance and stats are completely independent from any other profile.
- **Use Existing Profile** — opens the profile picker, listing every profile you've created. Click a profile's name to jump into it, click the **ⓘ** icon to see its current balance and what its preset means without switching to it, or click the **✕** icon to permanently delete it (you'll be asked to confirm first).
- Once inside a profile, the **Profile Menu** offers **Play** (go to the table), **Profile Statistics** (hands played, hands won, win percentage, money won, money lost, net money, money gain percentage, and basic strategy correct rate — all tracked just for this profile), **Switch Profiles** (back to the picker), and **Back Out** (return to the main menu).
- If a profile's balance drops below what's needed to place the smallest bet, you'll get a pop-up letting you either delete the profile or keep it as an **inactive** profile — inactive profiles can still be opened to review their statistics, but can't be used to play any more hands until you delete them and start fresh (or fund a different profile). This also means you're never stuck staring at a table you can't bet on anymore.

### Play Blackjack
The main table, opened from a profile's **Play** button. Place bets with the chip tray, then play out each hand with the standard actions. Turn on **mistake correction** (Settings/table toggles) while you're learning so the game highlights when you deviate from basic strategy — turn it off once you're ready to play "for real" against yourself. Use the HUD toggles to show/hide the running count, true count, and decks remaining as you get more comfortable counting on your own.

The table also has a **True count modifies basic strategy** toggle (off by default). Turn it on and the hint system stops always recommending the neutral-shoe basic strategy play — instead, once the true count crosses one of the Illustrious 18 index thresholds (see the Rules/Strategies tab), it recommends the count-based deviation instead (for example, standing on 16 vs. a dealer 10 once the true count reaches 0 or higher, instead of the book's surrender/hit).

### Basic Strategy hub
Three ways to drill the same skill, so you can pick whatever keeps you sharp:
- **Hand Training** — practice individual hands (hard totals, soft totals, and pairs) and build a "mistakes bank" of the hands you get wrong so you can revisit them.
- **Questionnaire** — mixed true/false and multiple-choice questions about strategy concepts, not just raw hand lookups.
- **Charts** — fill in a full basic strategy chart from memory and get graded cell-by-cell against the correct plays.

Start with Hand Training until the basics click, use the Questionnaire to test your understanding of *why*, then use Charts to prove you've internalized the whole table.

### Card Counting hub
Read the Hi-Lo walkthrough in the Rules/Strategies tab first if you're new to counting — it explains the running count, true count, and works through a full example. Then use either drill:
- **Running Count Drill** — deals a full round for you (dealer plus 1–6 player hands, auto-played with basic strategy — no decisions required from you), briefly reveals every card, hides them, and asks you for the running count. It grades your answer and shows the correct count if you're off. Configure deck count (2–8), dealing speed, and number of simultaneous hands to control the pace and difficulty; use **Reset Shoe** to reshuffle and start your count over from zero.
- **Deviation Drill** — practices the Illustrious 18: you're shown a hand, a dealer upcard, and a true count, then asked to pick the best move. Feedback tells you whether the count crossed a deviation index or whether book basic strategy still applied at that count.

### Rules/Strategies
A reference tab with the rules of the game (including whether the dealer hits or stands on a soft 17, which depends on your current preset), basic strategy explanations, the Hi-Lo card counting walkthrough, and a full Illustrious 18 deviation table sourced from Don Schlesinger's *Blackjack Attack*/BlackjackInfo.com — good to revisit any time a trainer result doesn't make sense.

### Settings
- **Music/sound effect volume** sliders.
- **Color scheme** — choose between *Mystical Casino* (burgundy & violet) and *Classic Casino* (emerald & jade green); purely cosmetic, applies everywhere instantly.
- **3D mode** — toggle between a tactile, "pop out" 3D look for buttons, chips, cards, and icons, or a clean, flat, minimal-shadow premium look. Also purely cosmetic — use whichever feels best.
- **Dealing speed** for the live blackjack table lives on the Blackjack tab itself (it only affects that table), separate from the Running Count Drill's own dealing speed slider.

### Presets
Each profile picks one preset when it's created (and can switch at any time from the table's **Preset** button):
- **Training** — mistake correction and all HUD counting info on, dealer hits soft 17.
- **True Game** — a realistic, no-hints experience with dealer hits soft 17 on and mistake correction off.
- **Custom** — pick every option individually, including whether **the dealer hits on soft 17** (on by default) and how many decks are in the shoe.

## Notes

This is a browser-oriented port of an original Java Swing blackjack app. It keeps the original game structure and strategy data but reimagines the experience as a cross-platform web UI with expanded training tools.

