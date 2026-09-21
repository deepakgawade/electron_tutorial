# Add Storybook + Chromatic for component-level visual testing

## Context

This doc records the plan for adding Chromatic-based visual testing to the project.

Key facts from research:
- **Chromatic's Playwright integration does not support Electron** — its docs state Chrome is the only supported snapshot browser. This project's `e2e/app.spec.ts` drives the app through Playwright's `_electron` launcher, not a Chrome page, so Chromatic cannot bolt onto the existing e2e suite.
- Chromatic's actual fit here is the **Storybook workflow**: build an isolated catalog of React components, snapshot them in Chromatic's cloud Chrome browsers, and get a hosted UI for reviewing/approving visual diffs per PR/branch — something local `toHaveScreenshot()` doesn't provide.
- `chromatic` (^18.7.2) is already an unused devDependency. No Storybook, no CI, and no `.storybook` config exist yet.
- `docs/playwright-tdd-workflow-plan.md` previously rejected Chromatic for this exact Electron-support reason, planning `@playwright/experimental-ct-react` + optional Argos instead. That decision was revisited and reversed — Storybook + Chromatic is added here as a separate, additional component-visual layer; the existing Playwright e2e/CT plans are untouched.
- `BookList.tsx` / `BookFeature.tsx` call RTK Query hooks (`useGetAllBooksQuery`, `useLazyGetRandomBookQuery`) directly against the live Potter API — they aren't prop-driven, so Storybook stories need the Redux `Provider` plus network mocking (MSW), mirroring the mocking approach already used in `e2e/mocks.ts` (`context.route` fixtures) rather than requiring a component refactor.

## Changes

### 1. Install Storybook
Run `npx storybook@latest init` — auto-detects Vite + React and scaffolds `@storybook/react-vite`, `.storybook/main.ts`, `.storybook/preview.ts`, and adds `storybook`/`build-storybook` scripts. Point the `stories` glob in `.storybook/main.ts` at `../src/renderer/**/*.stories.@(ts|tsx)` (repo root for stories is `src/renderer`, matching `electron.vite.config.ts`'s `renderer.root`).

### 2. Add MSW for network mocking in Storybook
Install `msw` + `msw-storybook-addon`. Extract the fixture book data currently inline in `docs/playwright-tdd-workflow-plan.md`'s `mockPotterApi` example into a shared file, e.g. `src/renderer/mocks/fixtures.ts` (exporting `mockBooks: Book[]`), so both `e2e/mocks.ts` (Playwright) and the new Storybook MSW handlers use one source of truth instead of duplicated fixture data.

Add `src/renderer/mocks/handlers.ts` with MSW handlers for `GET https://potterapi-fedeperin.vercel.app/en/books` and `.../en/books/random`, returning `mockBooks` / `mockBooks[0]`.

In `.storybook/preview.tsx`:
- Call `initialize()` from `msw-storybook-addon` and add `mswDecorator` to `decorators`.
- Add a decorator wrapping every story in `<Provider store={store}>` using the existing `src/renderer/store.ts` (a real store is fine here since MSW intercepts the network layer — no separate mock store needed).
- Set `parameters.msw.handlers` to the default handlers from step above.

### 3. Story files
- `src/renderer/BookList.stories.tsx` — three stories via per-story MSW handler overrides: `Loaded` (default handlers), `Loading` (handler with an unresolved/delayed response), `Error` (handler returning a 500).
- `src/renderer/BookFeature.stories.tsx` — `Default` (button unclicked), `WithBook` (use a `play` function with `@storybook/test`'s `userEvent.click` on the "Random Book" button so the fetched-card state is captured for Chromatic), `Error` (random-book endpoint returns 500).

### 4. package.json
Storybook's own `init` adds `storybook`/`build-storybook`. Add one more script:
```json
"chromatic": "chromatic --exit-zero-on-changes"
```

### 5. Chromatic config
Add `chromatic.config.json` at the repo root:
```json
{
  "projectId": "<fill in after creating the project at chromatic.com>",
  "onlyChanged": true
}
```
**Manual step for the user**: sign up / connect this GitHub repo at chromatic.com to get a project token, and add it as the `CHROMATIC_PROJECT_TOKEN` secret in the GitHub repo's Settings → Secrets.

### 6. CI workflow (new — no CI exists today)
Add `.github/workflows/chromatic.yml`:

```yaml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:

# A PR push fires both `push` (if the branch is main) and `pull_request`; a
# non-main branch only fires `pull_request`. Cancel superseded runs on the same ref.
concurrency:
  group: chromatic-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write   # lets chromaui/action leave the PR status/summary

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # Chromatic needs full git history for baseline
                                  # selection and TurboSnap (onlyChanged) diffing

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build-storybook
          exitZeroOnChanges: true  # visual changes don't fail CI — they're
                                   # reviewed/approved in Chromatic's UI instead
                                   # (mirrors the `chromatic` npm script in step 4)
```

Notes for whoever writes this:
- `chromaui/action@v1` runs `npm run build-storybook` itself (via `buildScriptName`), uploads `storybook-static`, and posts the build result back to the PR. No separate build step needed.
- `onlyChanged: true` lives in `chromatic.config.json` (step 5), so TurboSnap is picked up automatically — no extra input here. It relies on `fetch-depth: 0`.
- `exitZeroOnChanges: true` keeps the Actions job green when only visual diffs are found; genuine errors (build failure, story crash) still fail. Drop it later if you want visual changes to hard-block the PR check.
- **Forked-PR caveat:** `secrets.CHROMATIC_PROJECT_TOKEN` is not available to `pull_request` runs from forks, so the Chromatic step will fail there. Fine for a solo/private repo; if external contributors are expected, switch to `pull_request_target` with an explicit checkout of the PR head, or gate the step on `github.event.pull_request.head.repo.full_name == github.repository`.
- Requires the `CHROMATIC_PROJECT_TOKEN` repo secret from step 5 to exist before the first run.

### 7. .gitignore
Add `storybook-static` (the `build-storybook` output directory).

### 8. Leave existing Playwright suites untouched
`e2e/app.spec.ts` and the plans in `docs/playwright-tdd-workflow-plan.md` (Playwright CT, screen registry, etc.) stay as-is — they cover the full Electron shell and screen-level regressions, which Chromatic can't reach. A short note is appended to `docs/playwright-tdd-workflow-plan.md`'s Chromatic mention recording that the decision was revisited.

## Verification
1. `npm run typecheck` — confirm new files don't break the existing `tsconfig.web.json` project (may need to add `.storybook/**` / `src/renderer/mocks/**` / `*.stories.tsx` to its `include`).
2. `npm run build-storybook` — validates Storybook config and all stories compile and render without needing a GUI.
3. `npm run storybook` — starts the dev server on localhost:6006 (a normal browser dev server, not Electron, so it can run in this sandbox); open it and confirm `BookList` and `BookFeature` stories render in all their states with mocked data (no real network calls).
4. Once the user has created the Chromatic project and token: run `npx chromatic --project-token <token> --dry-run` locally to confirm a build uploads without publishing.
5. Push the branch / open a PR to confirm the new GitHub Actions workflow runs, Chromatic publishes a build, and the first-run baselines can be accepted in Chromatic's UI.
