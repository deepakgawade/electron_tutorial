# Integrating Playwright into a TDD workflow

## Context
The Electron E2E scaffolding from the earlier testing plan is already in place: `playwright.config.ts`, `e2e/app.spec.ts`, the `test:e2e`/`test:e2e:update-snapshots` scripts, `.gitignore` entries, and one committed screenshot baseline (`e2e/app.spec.ts-snapshots/default-window-darwin.png`). That setup answers "how do I run tests" — this plan is about the separate question: how to actually use Playwright *during* development in a red-green-refactor loop (write the test first, watch it fail, build the feature, watch it pass), rather than only running the suite at the end.

Two concrete gaps stand between what exists today and a real TDD loop:
1. Every test run currently rebuilds the whole app (`npm run build && playwright test`) and launches it fresh — there's no fast "just rerun the test I'm working on" loop yet.
2. `getAllBooks`/`getRandomBook` hit the real Potter API over the network — as covered a few turns ago, that makes tests slower, occasionally flaky, and dependent on the live API's exact current content (`toHaveCount(8)` isn't actually guaranteed unless the data is pinned).

This plan adds the interactive dev-loop tooling (Playwright's UI mode, debug mode) and a reusable network-mocking helper, plus documents the loop itself as a convention to follow.

## Changes

### 1. `package.json` — add dev-loop scripts
```json
"test:e2e:ui": "npm run build && playwright test --ui",
"test:e2e:debug": "npm run build && playwright test --debug"
```
- `test:e2e:ui` opens Playwright's interactive UI mode — a live test list with a per-test "watch and rerun on save" toggle and a time-travel DOM viewer per step. This is the main tool for the loop: keep it open while iterating.
- `test:e2e:debug` opens the Inspector, pausing before each action — useful when a locator isn't resolving and you want to click around the live app to find the right one (`page.pause()` inline in a spec does the same thing ad hoc, without the flag).

**Known limitation, stated plainly**: both scripts still `npm run build` first, and Playwright launches the app via `args: ['.']`, which reads `package.json`'s `"main": "./out/main/index.js"` — the *compiled* output. UI mode's "rerun on save" watches the **spec file**, not your `src/` app code, so a source change still needs a manual rebuild before the rerun picks it up. Wiring Playwright directly to `electron-vite dev`'s live dev server is possible in principle but genuinely awkward (dev mode's `ELECTRON_RENDERER_URL` handshake is owned by `electron-vite dev`'s own process, not something `electron.launch()` composes with cleanly) — not worth the fragility for this app's size. The practical loop is: edit source → `npm run build` (or leave `npm run dev` open in a separate terminal for manual poking around) → let UI mode rerun the test.

### 2. `e2e/mocks.ts` (new) — reusable Potter API fixture + mock helper
```ts
import type { ElectronApplication } from '@playwright/test'
import type { Book } from '../src/renderer/potterApi'

export const mockBooks: Book[] = [
    { index: 0, title: 'Mock Book 1', cover: 'https://raw.githubusercontent.com/fedeperin/potterapi/main/public/images/covers/1.png', pages: 100, releaseDate: 'Jan 1, 2000', description: 'Fixture description.' },
    // ...7 more fixture entries, matching the Book interface, up to whatever count your assertions rely on
]

export async function mockPotterApi(app: ElectronApplication) {
    const context = app.context()
    await context.route('**/en/books', (route) => route.fulfill({ json: mockBooks }))
    await context.route('**/en/books/random', (route) => route.fulfill({ json: mockBooks[0] }))
}
```
Registering routes on `app.context()` (not `window.route()`) avoids the race where the real request fires before the mock is registered — routes on the context apply to the window before it's even created. Call `mockPotterApi(app)` right after `electron.launch()`, before `app.firstWindow()`.

### 3. `e2e/app.spec.ts` — use the mock in `beforeEach`
```ts
import { mockPotterApi } from './mocks'

test.beforeEach(async () => {
    app = await electron.launch({ args: ['.'] })
    await mockPotterApi(app)
    window = await app.firstWindow()
})
```
This makes `toHaveCount(8)` (or whatever the fixture length is) and `toHaveScreenshot()` fully deterministic — no dependency on the live API's current content or uptime.

### 4. The actual TDD convention to follow (documentation, not code)
For each new feature or behavior change:
1. Write the assertion first, describing behavior that doesn't exist yet — either add to `app.spec.ts` or start a new spec file per feature area.
2. Run `npm run test:e2e:ui`, confirm the test fails for the *expected* reason (element not found / wrong text / wrong count) — not a crash or typo. This step is what makes it TDD rather than "write tests after"; it proves the test can actually detect the missing behavior.
3. Implement the feature in `src/renderer` (or `src/main`/`src/preload`) until the test passes. Use `page.pause()` inline (or `npm run test:e2e:debug`) if you're unsure what locator to assert on.
4. Rerun via UI mode's rerun button (rebuild first if source changed, per the limitation above) to confirm green.
5. Only regenerate the screenshot baseline (`npm run test:e2e:update-snapshots`) when the visual change was intentional — an unexpected screenshot diff during step 4 is a signal something broke, not something to blindly re-baseline.

### 5. `e2e/layout-helpers.ts` (new) — screen-size and overlap checks
Playwright has no built-in "responsive" or "no overlap" matcher — both are built from primitives it exposes.

**Resizing the real Electron window** (not a browser viewport — `page.setViewportSize()` doesn't apply to Electron `BrowserWindow`s). `ElectronApplication.evaluate()` runs code inside the actual main process, so it can call the real Electron API:
```ts
import type { ElectronApplication, Locator } from '@playwright/test'

export async function resizeWindow(app: ElectronApplication, width: number, height: number) {
    await app.evaluate(async ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0].setSize(size.width, size.height)
    }, { width, height })
}
```
Use it per breakpoint, each with its own screenshot baseline filename (the rendered content legitimately differs by size, so baselines can't be shared):
```ts
test('layout holds at a narrow width', async () => {
    await resizeWindow(app, 400, 600)
    await window.waitForTimeout(200) // let CSS reflow settle
    await expect(window).toHaveScreenshot('narrow-layout.png')
})
```
Note: the app's current CSS has no width-based media queries (only `prefers-color-scheme` for dark mode), so this tests "does the layout hold up without clipping/overflowing" at a given size, not "does it switch to a different adaptive layout" — there's nothing to switch to yet.

**Overlap detection** — standard axis-aligned-rectangle intersection math over `boundingBox()`:
```ts
export async function boxesOverlap(a: Locator, b: Locator) {
    const boxA = await a.boundingBox()
    const boxB = await b.boundingBox()
    if (!boxA || !boxB) throw new Error('one of the elements is not visible')
    return !(
        boxA.x + boxA.width <= boxB.x ||
        boxB.x + boxB.width <= boxA.x ||
        boxA.y + boxA.height <= boxB.y ||
        boxB.y + boxB.height <= boxA.y
    )
}
```
```ts
test('the random-book card does not overlap the book list', async () => {
    await window.locator('button:has-text("Random Book")').click()
    expect(await boxesOverlap(window.locator('.card'), window.locator('.book-list'))).toBe(false)
})
```
This gives an explicit, readable failure ("card overlaps book-list") rather than relying on a human noticing it in a screenshot diff, and it's cheap to rerun after each `resizeWindow()` call within the same test.

### 6. `@axe-core/playwright` — accessibility checks (cheap addition, not a layout tool per se)
Add as a devDependency alongside `@playwright/test`. Overlapping/clipped elements are frequently *also* accessibility bugs (unreachable click targets, elements outside tab order bounds), so this is a natural companion to the overlap check above:
```ts
import AxeBuilder from '@axe-core/playwright'

test('no accessibility violations on the main window', async () => {
    const results = await new AxeBuilder({ page: window }).analyze()
    expect(results.violations).toEqual([])
})
```

### Other tools considered, and why they're not part of this plan
For reference, in case the project outgrows this setup later:
- **Percy / Applitools Eyes** — cloud visual regression with a proper diff-review UI; Applitools' "Ultrafast Grid" can render at many viewport sizes in parallel automatically. Both are paid/commercial and overkill at this project's current size — Playwright's own `toHaveScreenshot()` already covers the core need locally and for free.
- **Chromatic** — visual regression built around Storybook specifically; not a fit unless Storybook is adopted too (see below).
- **Storybook** — would let you render `BookList`/`BookFeature` in isolation with a viewport-switcher for manually reviewing breakpoints, and pairs naturally with the existing `tokens.css` design tokens. Worth adopting if this UI grows, but it's a separate tool/config, not something that plugs into the existing `e2e/` suite.
- **WebdriverIO + `wdio-electron-service`** — an actively maintained alternative to Playwright for driving Electron apps (different test-runner ecosystem: Mocha/Jasmine/Cucumber). Functionally overlaps with what Playwright already does here, so switching wouldn't add anything new.
- **Spectron** — the original official Electron testing tool, now deprecated/archived by the Electron team in favor of Playwright or WebdriverIO. Noted only so it isn't mistakenly reached for.

### Not in scope for this pass (flagged for later, if wanted)
`@playwright/experimental-ct-react` — Playwright's component-testing mode, which mounts a single React component in real Chromium (so it still validates real CSS, unlike jsdom) without booting the whole Electron app. Faster inner loop for iterating on one component in isolation. It needs its own separate config/runner setup distinct from the Electron E2E config here. It's not part of *this* pass's code changes, but the "Scaling to many screens" section below specifies the full CT + colocated-spec + `--only-changed` setup as the next step once per-component visual coverage is wanted.

## Scaling to many screens with visual regression

The app today is a single window (`BookFeature` + `BookList` stacked in `main.tsx`). As it grows to many screens, the visual-regression story can't be "one more `toHaveScreenshot` call per screen, hand-written" — that doesn't scale and the baselines drift out of anyone's mental model. The structure below keeps the per-screen cost to *one registry entry plus one Screen Object*, and the actual screenshot assertions are generated from that registry.

### Layer the tests by cost, not by tool

| Layer | What it covers | Tool | Count |
|---|---|---|---|
| **Component visual** | one component in one state (empty / loading / error / loaded / long-title overflow) | `@playwright/experimental-ct-react` (see "Not in scope" above) | many, fast |
| **Screen visual** | a full screen's integrated layout at each breakpoint × theme | Playwright + Electron | one per screen × viewport × theme |
| **Flow / functional** | navigation, Redux state, IPC, "does the button work" | Playwright + Electron | few |

The key separation: **"does it look right" specs are distinct files from "does it work" specs.** A screenshot diff then never blocks the functional signal, and the visual suite gets its own deliberate review-and-rebaseline ritual (`--update-snapshots` + eyeball the diff in a PR — never automatic).

### Directory structure

```
e2e/
  fixtures/
    electron.ts          # custom test fixture: launch app, mock API, expose setTheme/resizeWindow helpers, inject animation-kill CSS
    mock-data.ts         # pinned API fixtures (mockBooks etc. — see section 2)
  screens/               # one Screen Object per screen (Page Object Model)
    BaseScreen.ts        # abstract: name, goto(), waitReady(), dynamicRegions
    BookListScreen.ts
    RandomBookScreen.ts
  screen-registry.ts     # SINGLE source of truth — every screen + the viewport/theme matrix
  specs/
    book-list.spec.ts    # functional, uses BookListScreen for locators
    random-book.spec.ts  # functional
  visual.spec.ts         # data-driven: iterates the registry, one screenshot per screen × viewport × theme
  visual.spec.ts-snapshots/
    book-list-narrow-light-darwin.png
    book-list-wide-dark-darwin.png
    ...
```

### The screen registry — the thing that makes it scale

```ts
// e2e/screen-registry.ts
import { BookListScreen } from './screens/BookListScreen'
import { RandomBookScreen } from './screens/RandomBookScreen'

export const VIEWPORTS = [
    { name: 'narrow', width: 420, height: 780 },
    { name: 'wide', width: 1200, height: 900 },
]
export const THEMES = ['light', 'dark'] as const

export const SCREENS = [new BookListScreen(), new RandomBookScreen()]
```

```ts
// e2e/screens/BaseScreen.ts
import type { Page } from '@playwright/test'

export abstract class BaseScreen {
    abstract name: string
    /** CSS selectors for regions with non-deterministic content, masked out of screenshots */
    dynamicRegions: string[] = []
    /** navigate to this screen (click nav / router push / nothing if it's the only screen) */
    abstract goto(w: Page): Promise<void>
    /** resolve only once the screen is visually settled — wait on a real content locator, never waitForTimeout */
    abstract waitReady(w: Page): Promise<void>
}
```

```ts
// e2e/visual.spec.ts
import { test, expect, setTheme, resizeWindow } from './fixtures/electron'
import { SCREENS, VIEWPORTS, THEMES } from './screen-registry'

for (const screen of SCREENS) {
    for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
            test(`${screen.name} — ${vp.name} / ${theme}`, async ({ app, window }) => {
                await setTheme(app, theme)
                await resizeWindow(app, vp.width, vp.height)
                await screen.goto(window)
                await screen.waitReady(window)
                await expect(window).toHaveScreenshot(`${screen.name}-${vp.name}-${theme}.png`, {
                    mask: screen.dynamicRegions.map((s) => window.locator(s)),
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.01,
                })
            })
        }
    }
}
```

Two screens × two viewports × two themes = 8 baselines today, produced by ~12 lines that don't change as screens are added. `setTheme` / `resizeWindow` are the `app.evaluate()` helpers from section 5 (resize) plus an equivalent that sets `prefers-color-scheme` via `window.emulateMedia({ colorScheme })` — note `emulateMedia` *does* work on the Electron renderer even though `setViewportSize` doesn't.

### Determinism checklist (visual regression lives or dies on this)

1. **Mock every network call** — promote `mockPotterApi` (section 2) into `fixtures/electron.ts` so it's on by default for the whole suite. `toHaveScreenshot` against live API content is meaningless.
2. **Kill animations & transitions** — the fixture injects `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }` (belt-and-braces with Playwright's own `animations: 'disabled'`).
3. **Pin fonts** — `await window.evaluate(() => document.fonts.ready)` in `waitReady`, or bundle the font locally so CI doesn't render a fallback face.
4. **Freeze time** — if any screen renders dates / relative times, mock `Date` or inject a fixed clock.
5. **Mask the genuinely dynamic** (random-book cover, timestamps) via `dynamicRegions` rather than trying to pin the data.
6. **`waitReady` must wait on a specific content locator**, not `waitForTimeout` — flaky waits produce flaky pixels.

### CI / baseline platform

Screenshots are OS-specific (`-darwin` vs `-linux` font rendering differs — the one committed baseline today is `default-window-darwin.png`). Pick one policy and write it down:

- **Recommended:** generate and commit the authoritative baselines from the Linux container CI uses (`mcr.microsoft.com/playwright`). Add a `test:e2e:snapshots:docker` script so macOS devs can regenerate the CI-authoritative `-linux` files; gitignore local `-darwin` snapshots.
- **Simpler, weaker:** only run the visual suite in CI, never assert visuals locally.

### Component-level visual regression with source mapping (the Chromatic-style layer)

Chromatic's value is two separable things: (1) a per-component visual catalog where every diff links back to the component's source, and (2) a hosted review UI with per-branch baselines and PR approval. Playwright covers (1) natively; (2) needs a bolt-on service (Argos / Lost Pixel / Percy — all consume plain Playwright screenshots, no Storybook required) and is only worth adding once a human reviewer actually needs to approve visual changes per PR. This project starts with (1) only.

**Setup** — `@playwright/experimental-ct-react` with its own config, separate from the Electron E2E config:
```
playwright-ct.config.ts        # testDir scoped to src/renderer, use: { ...devices['Desktop Chrome'] }
src/renderer/
  BookList.tsx
  BookList.ct.spec.tsx         # colocated — imports ./BookList directly
  BookFeature.tsx
  BookFeature.ct.spec.tsx
```
```json
// package.json
"test:ct": "playwright test -c playwright-ct.config.ts",
"test:ct:changed": "playwright test -c playwright-ct.config.ts --only-changed=main",
"test:ct:update": "playwright test -c playwright-ct.config.ts --update-snapshots"
```

**One spec per component, one snapshot per visual state:**
```tsx
// src/renderer/BookList.ct.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react'
import BookList from './BookList'

const fixtures = {
    loading: { books: [], isLoading: true, isError: false },
    error: { books: [], isLoading: false, isError: true },
    loaded: { books: mockBooks, isLoading: false, isError: false },
    'long-title': { books: [{ ...mockBooks[0], title: 'A '.repeat(60) }], isLoading: false, isError: false },
} as const

for (const [state, props] of Object.entries(fixtures)) {
    test(`BookList — ${state}`, async ({ mount }) => {
        test.info().annotations.push({ type: 'source', description: 'src/renderer/BookList.tsx' })
        const component = await mount(<BookList {...props} />)
        await expect(component).toHaveScreenshot(`BookList-${state}.png`, { animations: 'disabled' })
    })
}
```
Note this requires `BookList` to accept its data as props for the isolated states — today it reads `useGetAllBooksQuery()` / `useAppSelector` internally. Either (a) wrap the mount in a `<Provider>` with a preloaded store + `mockPotterApi`-style route stubs, or (b) split a presentational `BookListView` that takes props and have the connected `BookList` delegate to it. (b) is the cleaner long-term shape and makes every state trivially mountable.

**Source mapping — how the diff links back to code:**
- The spec is colocated and imports the component directly, so a failing `BookList-loaded.png` shows `BookList.ct.spec.tsx:14` in `npx playwright show-report` — one click from the diff to the spec, which imports `./BookList`.
- The `source` annotation puts `src/renderer/BookList.tsx` directly on the report entry.
- Snapshot filenames are prefixed with the component name, so `src/renderer/BookList.ct.spec.tsx-snapshots/BookList-loaded-chromium-darwin.png` is self-describing in a git diff.

**TurboSnap equivalent — `--only-changed`:**
`--only-changed=main` runs only tests whose import graph reaches a file changed versus `main`. Because each CT spec imports exactly one component, editing `BookList.tsx` re-runs precisely `BookList.ct.spec.tsx` and nothing else. Use `test:ct:changed` in the pre-push / PR CI job; run the full `test:ct` on the main branch and nightly to catch snapshots missed by graph analysis (dynamic imports, CSS-only changes in shared stylesheets).

**Re-baselining is scoped, not global:** `npm run test:ct:update -- -g "BookList"` regenerates just that component's snapshots. Review the changed PNGs by eye in the PR diff before committing — same rule as the screen-level baselines.

**What you don't get without a service:** no "accept this one change" button (you re-run `--update-snapshots`), no hosted per-branch baseline history, no automatic PR comment with the diffs. Add Argos (`@argos-ci/playwright`, free OSS tier, swap `argosScreenshot(page, name)` for `toHaveScreenshot`) if/when a reviewer needs that workflow — it's an additive change, not a rewrite.

### How this fits the TDD loop (section 4)

For a new screen: write its functional spec + a placeholder `BookListScreen`-style object first, watch it fail, build the screen, go green — then add the registry entry and run `npm run test:e2e:update-snapshots` *once* to mint the initial baselines, reviewing that first screenshot by eye before committing it. Subsequent diffs on that screen are then real regressions.

## Verification
Same sandbox limitation as the original testing plan: a real Electron GUI can't launch inside this coding sandbox (`ELECTRON_RUN_AS_NODE=1`), so the actual loop needs to run in your own terminal:
1. `npm run test:e2e:ui` — confirm the interactive runner opens and shows the existing tests.
2. Add one new, intentionally-failing assertion (e.g. for a feature that doesn't exist yet) and confirm it fails with a clear, specific reason in the UI mode view.
3. Implement the feature, rerun, confirm it goes green.
4. Confirm `toHaveCount`/`toHaveScreenshot` no longer depend on real network calls — e.g. temporarily disconnect network and rerun `npm run test:e2e`, confirming it still passes using the mocked fixture.
5. Run `npm run test:e2e:update-snapshots` once to mint the screen × viewport × theme baselines from the registry, then rerun `npm run test:e2e` twice back-to-back and confirm the visual suite is stable (zero pixel diff) across identical runs — any nonzero diff means a determinism gap from the checklist above.
