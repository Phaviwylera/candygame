# Astra Grove

Astra Grove is an original, dependency-free match-three browser puzzle. Match three or more pieces, build cascades, and reach 900 stardust within 24 moves. Four-piece matches create a row or column clearer; five-piece matches create a wild piece that clears its color.

Serve the repository from a local HTTP server (for example, `python -m http.server 8000`) and visit `http://localhost:8000/`; the browser module imports require HTTP rather than a `file://` URL. Select two adjacent pieces or swipe between them. Arrow keys move keyboard focus between cells; activate two adjacent cells to swap. Use the speaker button to mute or restore the generated sound, and **New game** to restart.

Run the focused game-logic tests with:

```sh
npm test
```
