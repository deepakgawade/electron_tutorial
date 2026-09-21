# Add automated layout/UI tests with Playwright (Electron)

## Context
There's no test coverage at all yet. You want tests that actually catch *visual/layout* regressions (broken CSS, overlapping elements, a design-token change breaking spacing) — not just component logic. Per your choice, that means launching the real built Electron app and driving it like a user, with screenshot-based visual regression, rather than jsdom-based component tests (which don't run a real layout engine and can't validate CSS/visual correctness).

**Playwright has first-class Electron support** (`_electron` module) — it launches your actual packaged app, gives you a real `Page` for the renderer window, and its `toHaveScreenshot()` assertion does automatic baseline image diffing. This is the standard tool for this exact use case.

**Known limitation to flag now**: this coding sandbox has `ELECTRON_RUN_AS_NODE=1` set in its shell environment, which — as we hit earlier this session — prevents the real Electron GUI from launching here (`require('electron')` returns a path string instead of the app API). That means these tests can be written and wired up, but **you'll need to run them yourself in your own terminal** the first time, both to generate the initial screenshot baselines and to confirm they pass. They can't be executed/verified from inside this sandbox.

## Changes

### 1. `package.json`
- Add devDependency: `@playwright/test`
- Add scripts:
  - `"test:e2e": "npm run build && playwright test"` — builds first (tests run against the real `out/` build, same as `npm start`), then runs Playwright
  - `"test:e2e:update-snapshots": "npm run build && playwright test --update-snapshots"` — regenerates screenshot baselines after an intentional UI change

### 2. `playwright.config.ts` (new, project root)
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: 0,
    reporter: 'list',
})
```
No `webServer`/browser config needed — these tests launch Electron directly, not a browser against a URL.

### 3. `e2e/app.spec.ts` (new)
Launches the built app via Playwright's Electron API, exercises the existing features (Ping, counter via menu, favorite toggle, book list), and takes a layout screenshot of the default (pre-interaction) state — deliberately *not* screenshotting after clicking "Random Book," since that result is nondeterministic (random title/cover each time) and would make the visual diff flaky:
```ts
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

let app: ElectronApplication
let window: Page

test.beforeEach(async () => {
    app = await electron.launch({ args: ['.'] })
    window = await app.firstWindow()
})

test.afterEach(async () => {
    await app.close()
})

test('renders the default layout correctly', async () => {
    await expect(window.locator('#ping')).toBeVisible()
    await expect(window.locator('.book-list li')).toHaveCount(8)
    await expect(window).toHaveScreenshot('default-layout.png')
})

test('ping button shows a pong response', async () => {
    await window.locator('#ping').click()
    await expect(window.locator('#info')).toContainText('Ping response: pong')
})

test('favorite star toggles and updates the count', async () => {
    const firstStar = window.locator('.favorite-btn').first()
    await firstStar.click()
    await expect(window.locator('text=Favorites: 1')).toBeVisible()
    await firstStar.click()
    await expect(window.locator('text=Favorites: 0')).toBeVisible()
})
```

### 4. `.gitignore`
Add Playwright's generated (non-committed) output, while keeping screenshot baselines tracked:
```
/test-results/
/playwright-report/
```
(`e2e/app.spec.ts-snapshots/` — the baseline images — should be committed, since that's what future runs diff against.)

### No changes needed to `tsconfig.node.json` / `tsconfig.web.json`
Both already `include` only specific `src/` subfolders, so the new `e2e/` directory at project root won't be picked up by either — no conflict with the app's existing strict TypeScript configs. Playwright Test compiles its own spec files independently.

## Verification
This cannot be run/verified from inside the coding sandbox (see limitation above) — run these yourself:
1. `npm install` to pull in `@playwright/test`, then `npx playwright install` (downloads the browser/Electron test runner binaries Playwright needs, one-time).
2. `npm run test:e2e:update-snapshots` — first run, generates the initial `default-layout.png` baseline (there's nothing to diff against yet, so this run just creates it).
3. `npm run test:e2e` — subsequent runs; should pass and show a real diff/failure if you change layout/CSS afterward without intentionally updating the baseline.
4. Make a deliberate visual change (e.g. tweak a token in `tokens.css`) and rerun `npm run test:e2e` — confirm it fails with a visible screenshot diff, proving the layout check actually works.
