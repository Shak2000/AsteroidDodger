# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains a single self-contained game: [index.html](index.html) — "Asteroid Dodger," a browser-based game built with vanilla HTML5 Canvas and JavaScript. There is no build step, no package manager, and no external dependencies.

## Running the game

Open `index.html` directly in a browser:

```
open index.html
```

There is no dev server, bundler, linter, or test suite in this repo — changes are verified by reloading the file in a browser and playing.

## Architecture

Everything lives in one file: `index.html` contains inline `<style>` and `<script>` blocks with no separation into additional files.

The script is a single IIFE structured around:
- **Game state machine**: `state` is one of `'idle' | 'playing' | 'gameover'`, checked each frame in the `requestAnimationFrame` loop (`loop()`).
- **Ship**: position/angle updated in `updateShip()` from held-key state (arrow keys/WASD tracked via `keydown`/`keyup` listeners into the `keys` map). Moving off any screen edge wraps the ship to the opposite edge (the "warp").
- **Asteroids**: spawned in `spawnAsteroid()` at random top-of-screen positions with randomized radius/speed (smaller asteroids fall faster). The spawn interval shrinks over elapsed game time (`currentSpawnInterval()`, ramping from `SPAWN_INTERVAL_START` down to `SPAWN_INTERVAL_MIN` over `SPAWN_RAMP_DURATION`), which is how difficulty increases as a run progresses.
- **Collision detection**: simple circle-vs-circle distance check in `checkCollisions()` between the ship and each asteroid.
- **Rendering**: `drawShip()` and `drawAsteroid()` draw directly to the 2D canvas context each frame; asteroids are drawn as jittered polygons (`asteroidPoints()`) rather than perfect circles for visual texture.
- **HUD/overlay**: `#hud` shows elapsed survival time and best time; `#overlay` is the idle/game-over screen, toggled via the `hidden` class and re-triggered to start/restart on any keypress or click.

When making changes, keep the single-file structure unless the project's scope grows enough to justify splitting into separate JS/CSS files.
