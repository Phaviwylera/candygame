# Astra Grove design system

## Visual idea

A quiet night-sky conservatory: star-chart geometry and botanical jewel pieces create a little field of color against an observatory-dark canvas. The board, not a level map or character scene, is the centerpiece.

## Palette and materials

- Night: `#10131d`
- Panel: `#1b2030`
- Board: `#141927`
- Main text: `#f1f0ed`
- Mint starlight: `#92e2cc`
- Warm score accent: `#f6cc76`
- Soft coral feedback: `#ff9b88`
- Pieces use six distinct shape-and-color combinations for quick recognition.
- Quiet orbital lines, restrained inset edges, and offset shadows establish depth without obscuring play.

## Type and composition

`Bricolage Grotesque` gives the title a playful, slightly irregular silhouette; `Onest` keeps controls and game information clean at small sizes. Both fall back to installed system sans-serif faces. The experience uses a single centered play surface with score, goal progress, and moves immediately above the board; mute and restart remain adjacent to play.

## Interaction and motion

The 8×8 board supports click-to-select, adjacent click-to-swap, pointer swipes, and arrow-key focus movement. Swaps have a quick pop, invalid moves shake and revert, refills rise into their cells, and the progress bar eases with transforms. Four-matches create line clearers; five-matches create a color-clearing wild piece. Generated Web Audio notes begin only after player input and can be muted.

## Responsive and accessibility rules

Keep all 64 cells square and finger-sized within the available width, retain the compact score / goal / moves row, and allow vertical scrolling on short screens. Every piece has an accessible name, keyboard focus is visible, status changes are announced, and reduced-motion preferences shorten authored motion.
