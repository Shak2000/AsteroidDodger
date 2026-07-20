---
name: playtest
description: Launches the Asteroid Dodger game (index.html) headlessly with Playwright, drives it with a simulated reactive-dodge bot, and reports whether it starts cleanly, runs without console errors, and survives as expected — with screenshots for visual sanity. Use this whenever code in index.html changes ship movement (updateShip), asteroid spawning or motion (spawnAsteroid, updateAsteroids), collision detection (checkCollisions), or the difficulty ramp (currentSpawnInterval, currentSpeedMultiplier), and you want to verify the change works before calling it done — this repo has no test suite or dev server, so this skill is the only automated verification available.
---

# Playtest Asteroid Dodger

This project (`index.html`, a single-file HTML5 canvas game) has no build step, linter, or test
suite — per `CLAUDE.md`, changes are normally verified by opening the file in a browser and playing
by hand. This skill automates that: it drives the game with a scripted bot instead of a human, so
gameplay changes can be regression-checked quickly and repeatably.

## When to use this

Run it after touching any of these functions in `index.html`:
- `updateShip` — ship movement/wrap
- `spawnAsteroid` / `updateAsteroids` — asteroid spawn position, drift, homing, waves
- `checkCollisions` / `distanceFromShipToAsteroidPath` — hit detection
- `currentSpawnInterval` / `currentSpeedMultiplier` / `currentWaveChance` — difficulty ramp

Also useful any time you want a quick "does the game still boot and run" smoke test.

## How it works

The game's internal state (`ship`, `asteroids`, `elapsed`, `state`) lives inside the page's script
closure. `index.html` exposes a small read-only hook, `window.__asteroidDodgerDebug.getState()`,
purely for this kind of external tooling — it has no effect on gameplay. The bundled script uses it
to find the nearest threatening asteroid each tick and steer away from it, exercising the same
"reactive dodge" pattern a real player (or the lazy exploit the `strategy-balancer` agent looks for)
would use.

## Running it

```bash
node .claude/skills/playtest/scripts/playtest.mjs [--duration 20000] [--out <dir>]
```

- `--duration`: how long to let the bot play, in ms, if it doesn't die first (default `20000`).
- `--out`: directory to write screenshots into (default: a fresh temp directory; the script prints
  its path).

**First-time setup**: the script needs its own `node_modules` (Playwright is a local dependency of
this skill, not a project-wide one — the game itself has no dependencies). If `node
.claude/skills/playtest/scripts/playtest.mjs` fails with a "Cannot find package 'playwright'" error,
run `npm install` inside `.claude/skills/playtest/` once. If it instead fails with a message about
Chromium not being installed, run `npx playwright install chromium` once (downloads a cached browser
binary — a few hundred MB). Both are one-time, per-machine setup steps.

## Reading the output

The script prints one JSON object to stdout and exits non-zero if something looks broken:

```json
{
  "reachedPlaying": true,
  "gameOver": false,
  "survivedMs": 20014,
  "consoleErrors": [],
  "finalHud": "Time: 20.0s   Best: 20.0s",
  "screenshots": ["/tmp/.../t0.png", "/tmp/.../t5000.png", "..."]
}
```

What "good" looks like:
- `reachedPlaying: true` — the start-on-keypress flow worked.
- `consoleErrors: []` — no JS exceptions during the run.
- `survivedMs` roughly matches the requested `--duration` (or shows a plausible death time if
  `gameOver` is `true`) — a bot that dies almost instantly, or one from a lazy strategy that survives
  indefinitely well past the intended difficulty ramp, both indicate a balance or logic regression.
- Open a couple of the screenshots — confirm the ship and asteroids render and the HUD text looks
  sane. This catches visual issues the numeric summary can't (e.g. asteroids rendering off-canvas,
  drift/homing making motion look broken).

If you're specifically checking that a "camp in one lane" exploit is closed (rather than general
regressions), also consider asking the `strategy-balancer` agent for a code-level review — this
skill's bot moves reactively but isn't a substitute for that static analysis.
