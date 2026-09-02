# Add Random Book feature via React + Redux Toolkit (RTK Query)

## Context
The app currently has no bundler — `renderer.js` is a plain `<script>` with vanilla DOM code (`versions`, `ping`, `counter`), and `main.js`/`preload.js` handle Electron-specific/system APIs (Node/Chrome/Electron versions, IPC ping, menu-driven counter). We're adding a "Random Book" feature that calls the public Potter API (`https://potterapi-fedeperin.vercel.app/en/books/random`).

Per your direction: this feature is built with **React + Redux Toolkit (RTK Query)**, scoped only to the book feature — the existing counter/ping/versions code stays as plain DOM JS, untouched. RTK Query calls the external API **directly from the renderer** (not proxied through the main process), since the rule going forward is "main process = system/Electron APIs only" (versions, ping, IPC, menu), while ordinary client-side data-fetching and UI state (forms, checkboxes, animation, and now this API call) live in the renderer using Redux Toolkit. This requires relaxing the CSP's `connect-src`/`img-src` to allow the Potter API host and its cover-image host, since the renderer will now make real network calls directly.

**Build tooling**: introducing JSX + RTK Query requires bundling — Vite is added as a dev-only build step (`vite build`) that compiles `src/renderer/` into a static bundle in `dist/`, which `index.html` loads via a `<script type="module">` tag. No Vite dev-server/HMR integration with Electron for now (keeps scope tight to "just the book feature"); rebuild with `vite build` after changes, matching how the project already has no live-reload for `main.js`/`preload.js` either.

## What is RTK Query?
RTK Query is the data-fetching/caching layer built into Redux Toolkit (`@reduxjs/toolkit/query`). Instead of writing manual `useState`/`useEffect`/loading-flag boilerplate around `fetch`, you describe an API once and it generates React hooks that handle the fetch, cache, loading state, and error state for you.

How it maps to this feature:
1. **Define the API** — `createApi()` with a `baseQuery` (`fetchBaseQuery({ baseUrl: 'https://potterapi-fedeperin.vercel.app/en/' })`, a thin wrapper around `fetch`) and `endpoints` (one: `getRandomBook`, hitting `books/random`).
2. **Auto-generated hooks** from the endpoint names — `useGetRandomBookQuery` (fetches automatically on mount) or `useLazyGetRandomBookQuery` (fetches only when its trigger function is called — used here, since the fetch should happen on button click, not page load).
3. **Built-in status flags** — the hook returns `data` (parsed JSON), `isLoading`, `isFetching`, `isError`, `error`, so `BookFeature.jsx` just reads these and renders, with no separate loading/error state variables to manage by hand.
4. **Automatic caching** — the same query with the same args reuses the cached result instead of re-fetching, and dedupes simultaneous calls.
5. **Lives in the Redux store as a slice** — `potterApi.reducer` and `potterApi.middleware` are added in `store.js`, so the fetched data sits in the normal Redux state tree (inspectable in Redux DevTools) without hand-writing a reducer or action creator.

Net effect: a ~10-line API definition replaces a hand-rolled `fetch` + `useState` + `try/catch` + loading-flag component, with caching/dedup included.

## Changes

### 1. `package.json`
- Add dependencies: `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`
- Add devDependencies: `vite`, `@vitejs/plugin-react`
- Add scripts:
  - `"build:renderer": "vite build"`
  - `"start": "vite build && electron ."` (single command still launches the app; rebuilds the renderer bundle first)

### 2. `vite.config.mjs` (new)
ESM config (project `"type": "commonjs"` means `main.js`/`preload.js` stay CJS, but Vite's own config and the React source use ESM — hence `.mjs`):
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: { input: 'src/renderer/main.jsx' },
  },
})
```

### 3. `src/renderer/potterApi.js` (new) — RTK Query API slice
```js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const potterApi = createApi({
  reducerPath: 'potterApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'https://potterapi-fedeperin.vercel.app/en/' }),
  endpoints: (builder) => ({
    getRandomBook: builder.query({ query: () => 'books/random' }),
  }),
})

export const { useLazyGetRandomBookQuery } = potterApi
```
Uses `useLazyGetRandomBookQuery` (not the eager `useGetRandomBookQuery`) since the fetch should only happen on button click, not on mount.

### 4. `src/renderer/store.js` (new)
```js
import { configureStore } from '@reduxjs/toolkit'
import { potterApi } from './potterApi'

export const store = configureStore({
  reducer: { [potterApi.reducerPath]: potterApi.reducer },
  middleware: (getDefault) => getDefault().concat(potterApi.middleware),
})
```

### 5. `src/renderer/BookFeature.jsx` (new)
Function component: a "Random Book" button wired to `useLazyGetRandomBookQuery`'s trigger function, rendering title/cover/pages/releaseDate/description from the query result, plus RTK Query's built-in `isLoading`/`isError` flags for basic loading/error UI (no extra state management needed — this is exactly what RTK Query is for).
```jsx
import { useLazyGetRandomBookQuery } from './potterApi'

const BookFeature = () => {
    const [fetchRandomBook, { data: book, isLoading, isError }] = useLazyGetRandomBookQuery()

    return (
        <div>
            <button onClick={() => fetchRandomBook()}>Random Book</button>

            {isLoading && <p>Loading...</p>}
            {isError && <p>Failed to fetch a book. Try again.</p>}

            {book && (
                <div>
                    <h2>{book.title}</h2>
                    <img src={book.cover} alt={book.title} width="150" />
                    <p>Pages: {book.pages} | Released: {book.releaseDate}</p>
                    <p>{book.description}</p>
                </div>
            )}
        </div>
    )
}

export default BookFeature
```

### 6. `src/renderer/main.jsx` (new)
```jsx
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import BookFeature from './BookFeature'

createRoot(document.getElementById('book-root')).render(
  <Provider store={store}><BookFeature /></Provider>
)
```

### 7. `index.html`
- Update both CSP meta tags to add the two new external hosts the renderer will now legitimately talk to:
  `default-src 'self'; script-src 'self'; connect-src 'self' https://potterapi-fedeperin.vercel.app; img-src 'self' https://raw.githubusercontent.com`
- Add a mount point and the built bundle script, after the existing counter markup:
```html
<div id="book-root"></div>
</body>
<script src="./renderer.js"></script>
<script type="module" src="./dist/main.js"></script>
```
(exact built filename depends on Vite's output naming — verify against the actual `dist/` contents after first build and adjust the `<script>` src to match.)

### No changes to `main.js` or `preload.js`
The book feature doesn't touch IPC at all — it's a pure renderer-side React/RTK Query concern. `main.js`/`preload.js` continue to own only genuine system/Electron APIs (versions, ping, menu-driven counter), consistent with the "main = system APIs only" rule.

## Future: authenticated backends & `safeStorage`
Not part of the Potter API feature (it's public, keyless, unauthenticated) — this is a note for when a real backend (e.g. a .NET API that connects to a database) gets integrated later.

**What's fine to expose vs. what isn't:**
- The backend's base URL is not a secret — any request the app makes is visible in DevTools' Network tab regardless of whether the URL is hardcoded or pulled from an env var. Use an env var (e.g. `VITE_API_BASE_URL`) for *configurability* across dev/staging/prod, not for hiding it.
- Database credentials (connection string, DB user/password, DB host) must never exist anywhere in the Electron app, main or renderer. Standard 3-tier separation: `Electron app → backend API (owns DB credentials) → Database`. The app only ever calls the backend over HTTPS; only the backend touches the DB.
- The real secret is the **auth token** used to call the backend (JWT/OAuth token, API key tied to a user session). If the backend has no auth and trusts any caller, the discoverable URL becomes a real risk — the fix is requiring and validating auth server-side, not hiding the URL.

**Where to keep the auth token in Electron:** the renderer is fully inspectable (same reasoning as the CSP/meta-tag discussion — nothing loaded into the renderer is hidden from the user). So avoid storing a long-lived token in `localStorage` or plain renderer state. Preferred pattern:
- Main process handles login/token exchange and stores the token via Electron's `safeStorage` API — OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux) rather than a plaintext file.
- The renderer never sees the raw token directly — it asks main (via IPC, same `ipcMain.handle`/`ipcRenderer.invoke` pattern as the existing `ping` handler) to make authenticated requests on its behalf, or main hands the renderer only a short-lived token for the current session.

## Verification
- Run `npm install` to pull in the new dependencies.
- Run `npm start` (now runs `vite build` then `electron .`); confirm the build produces `dist/` output with no errors.
- Click "Random Book" repeatedly in the running app; confirm title, cover image, pages, release date, and description update via RTK Query, with loading state visible briefly and no console/CSP errors in DevTools (already auto-opened).
- Confirm existing Ping button and counter (menu Increment/Decrement) still work unmodified, proving the plain-DOM code paths are untouched.
