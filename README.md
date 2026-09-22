# Blackjack Terminus

This project has been migrated from the original Java Swing app into a cross-platform browser app built with plain HTML, CSS, and JavaScript.

## Run it

Open `index.html` in a browser, or serve the folder with any local static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Features in this first migration pass

- Main menu screen
- Blackjack table flow with betting and HUD
- Basic strategy trainer
- Card counting trainer
- Preset and custom preset dialogs
- Dark casino styling

## Notes

This is the first browser-oriented port of the project. It keeps the original game structure but shifts the app from a desktop Swing UI to a cross-platform web UI.
