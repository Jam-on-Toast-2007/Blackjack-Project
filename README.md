# Blackjack Terminus

Blackjack Terminus is a browser-based casino training lounge for learning and practicing blackjack. It's a single-page app built with plain HTML, CSS, and JavaScript (no build tools, no dependencies) that pairs a fully playable blackjack table with dedicated trainers for basic strategy and card counting.

## What it can help you with

- **Learning to play blackjack** the right way, with a real table flow: betting, dealing, hitting, standing, doubling, splitting, surrendering, and insurance.
- **Mastering basic strategy** — the mathematically optimal play for every hand vs. dealer up-card — through three focused practice modes instead of just memorizing a chart.
- **Learning to count cards** using the Hi-Lo system, with a plain-language walkthrough and a drill that trains you to track the running count under realistic conditions.
- **Practicing at your own pace**, with adjustable deck size, dealing speed, and hand counts so you can start slow and work up to speed.

## Getting started

Open `index.html` directly in a browser, or serve the folder with any local static server (recommended, so audio/assets load correctly):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser and click **Enter Blackjack Terminus**.

## Getting the most out of it

### Play Blackjack
The main table. Place bets with the chip tray, then play out each hand with the standard actions. Turn on **mistake correction** (Settings/table toggles) while you're learning so the game highlights when you deviate from basic strategy — turn it off once you're ready to play "for real" against yourself. Use the HUD toggles to show/hide the running count, true count, and decks remaining as you get more comfortable counting on your own.

### Basic Strategy hub
Three ways to drill the same skill, so you can pick whatever keeps you sharp:
- **Hand Training** — practice individual hands (hard totals, soft totals, and pairs) and build a "mistakes bank" of the hands you get wrong so you can revisit them.
- **Questionnaire** — mixed true/false and multiple-choice questions about strategy concepts, not just raw hand lookups.
- **Charts** — fill in a full basic strategy chart from memory and get graded cell-by-cell against the correct plays.

Start with Hand Training until the basics click, use the Questionnaire to test your understanding of *why*, then use Charts to prove you've internalized the whole table.

### Card Counting hub
Read the Hi-Lo walkthrough in the Rules/Strategies tab first if you're new to counting — it explains the running count, true count, and works through a full example. Then use the **Running Count Drill**: it deals a full round for you (dealer plus 1–6 player hands, auto-played with basic strategy — no decisions required from you), briefly reveals every card, hides them, and asks you for the running count. It grades your answer and shows the correct count if you're off. Configure deck count (2–8), dealing speed, and number of simultaneous hands to control the pace and difficulty; use **Reset Shoe** to reshuffle and start your count over from zero.

### Rules/Strategies
A reference tab with the rules of the game, basic strategy explanations, and the Hi-Lo card counting walkthrough — good to revisit any time a trainer result doesn't make sense.

### Settings
- **Music/sound effect volume** sliders.
- **Color scheme** — choose between *Mystical Casino* (burgundy & violet) and *Classic Casino* (emerald & jade green); purely cosmetic, applies everywhere instantly.
- **3D mode** — toggle between a tactile, "pop out" 3D look for buttons, chips, cards, and icons, or a clean, flat, minimal-shadow premium look. Also purely cosmetic — use whichever feels best.
- **Dealing speed** for the live blackjack table lives on the Blackjack tab itself (it only affects that table), separate from the Running Count Drill's own dealing speed slider.

## Notes

This is a browser-oriented port of an original Java Swing blackjack app. It keeps the original game structure and strategy data but reimagines the experience as a cross-platform web UI with expanded training tools.

