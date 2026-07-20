#!/usr/bin/env node
// Headless playtest bot for Asteroid Dodger. See ../SKILL.md for usage.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

function parseArgs(argv) {
  const args = { duration: 20000, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--duration') args.duration = Number(argv[++i]);
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

const DANGER_Y_AHEAD = 260; // px above the ship worth reacting to
const DANGER_X_MARGIN = 40; // px extra clearance beyond radius sum
const SCREENSHOT_INTERVAL_MS = 5000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '../../../../');
  const indexPath = path.join(repoRoot, 'index.html');
  const outDir = args.out || (await fs.mkdtemp(path.join(os.tmpdir(), 'asteroid-playtest-')));
  await fs.mkdir(outDir, { recursive: true });

  const consoleErrors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`file://${indexPath}`);
  await page.waitForSelector('#overlay:not(.hidden)');

  await page.click('#overlay');

  let reachedPlaying = false;
  try {
    await page.waitForFunction(
      () => window.__asteroidDodgerDebug?.getState().state === 'playing',
      { timeout: 3000 }
    );
    reachedPlaying = true;
  } catch {
    reachedPlaying = false;
  }

  const screenshots = [];
  const start = Date.now();
  let gameOver = false;
  let heldKeys = new Set();

  const setKey = async (key, down) => {
    if (down && !heldKeys.has(key)) {
      heldKeys.add(key);
      await page.keyboard.down(key);
    } else if (!down && heldKeys.has(key)) {
      heldKeys.delete(key);
      await page.keyboard.up(key);
    }
  };

  const takeShot = async (label) => {
    const file = path.join(outDir, `${label}.png`);
    await page.screenshot({ path: file });
    screenshots.push(file);
  };

  if (reachedPlaying) {
    await takeShot('t0');
    let nextShotAt = SCREENSHOT_INTERVAL_MS;

    while (Date.now() - start < args.duration) {
      const gs = await page.evaluate(() => window.__asteroidDodgerDebug.getState());
      if (gs.state !== 'playing') {
        gameOver = true;
        break;
      }

      const threat = gs.asteroids
        .filter((a) => a.y < gs.ship.y && gs.ship.y - a.y < DANGER_Y_AHEAD)
        .sort((a, b) => gs.ship.y - a.y - (gs.ship.y - b.y))[0];

      let wantLeft = false;
      let wantRight = false;
      let wantUp = false;
      let wantDown = false;

      if (threat) {
        const clearance = threat.radius + DANGER_X_MARGIN;
        const dx = gs.ship.x - threat.x;
        if (Math.abs(dx) < clearance) {
          if (dx >= 0) wantRight = true;
          else wantLeft = true;
        }
        wantDown = true; // drift toward the bottom, away from falling asteroids
      }

      await Promise.all([
        setKey('ArrowLeft', wantLeft),
        setKey('ArrowRight', wantRight),
        setKey('ArrowUp', wantUp),
        setKey('ArrowDown', wantDown),
      ]);

      const elapsedMs = Date.now() - start;
      if (elapsedMs >= nextShotAt) {
        await takeShot(`t${nextShotAt}`);
        nextShotAt += SCREENSHOT_INTERVAL_MS;
      }

      await page.waitForTimeout(50);
    }

    for (const key of [...heldKeys]) await setKey(key, false);
    await takeShot('tend');
  }

  const finalHud = await page.textContent('#hud').catch(() => null);
  const survivedMs = Date.now() - start;

  await browser.close();

  const summary = {
    reachedPlaying,
    gameOver,
    survivedMs,
    consoleErrors,
    finalHud,
    screenshots,
  };

  console.log(JSON.stringify(summary, null, 2));

  const ok = reachedPlaying && consoleErrors.length === 0;
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
