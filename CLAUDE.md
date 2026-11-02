# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Steam Review Explorer is a client-only Next.js 12 / React 17 app (TypeScript, react-bootstrap, recharts). It fetches every review for a Steam game in the browser, stores them in IndexedDB, and lets the user filter, sort, chart and export them. There is no backend; the site is exported as static files and deployed to GitHub Pages.

## Commands

- `yarn install`: install dependencies. CI uses yarn and `yarn.lock`, but a `package-lock.json` also exists.
- `yarn dev`: dev server. Because of `basePath`, the app is served at `http://localhost:3000/steam-review-explorer`.
- `yarn build` then `yarn export`: production build plus static export to `./out`. This is exactly what CI runs.

There is no lint script or test suite for the app. Use `yarn build` to type-check; `tsconfig` has `strict: false` and `noImplicitAny: false`. The proxy has its own tests: `node proxy/test.mjs`.

Steam calls go through a CORS proxy. Its URL, with a trailing slash, comes from `NEXT_PUBLIC_CORS_URL` at build time and falls back to the original author's `https://joshhills.dev/cors/`, which isn't expected to serve this fork. `proxy/` holds this fork's own proxy, a Cloudflare Worker: it forwards only `GET` requests to the two Steam hosts, and only for origins in `ALLOWED_ORIGINS` in `proxy/wrangler.toml`. If the app starts calling another host, add it to `ALLOWED_HOSTS` in `proxy/worker.js`. Deploy steps are in `proxy/README.md`.

Deployment: `.github/workflows/nodejs.yml` runs on every push to `main`. It builds with `NEXT_PUBLIC_CORS_URL` set from the repository variable `CORS_URL`, then publishes `./out` to the `gh-pages` branch with `peaceiris/actions-gh-pages`, authenticating with `GITHUB_TOKEN`.

This repo is a fork of `joshhills/steam-review-explorer`, which is set up as the `upstream` remote in this checkout.

## Architecture

### Data flow

1. **Fetching** (`lib/utils/SteamWebApiClient.ts`): every Steam call goes through the CORS proxy (`CORS_URL`), followed by the Steam URL without its scheme.
   - `getGame` merges store `appdetails` with the review summary.
   - Reviews and the summary both come from the Steamworks `IUserReviewsService/GetAppReviews/v1` endpoint. Its parameters are sent as an `input_json` query param, with numeric enums such as `filter: 1` for recent.
   - `getReviews` follows pages by cursor, newest first, and retries with `p-retry`. It passes the date range and the optional `HardwareFilters` to the API, and it also stops locally once a review is older than `startDate`.
2. **Normalisation** happens inside `getReviews`, before each review is stored. The nested `author.*` fields are flattened into `author_*`, with defaults for missing values. Derived fields are added: `censored`, `contains_url`, `author_continued_playing`, `author_playtime_after_review_time`, `length` and `recommendationurl`. `weighted_vote_score`, `refunded` and `primarily_steam_deck` are converted to proper number and boolean types. Bad vote counts from Steam are cleaned up. Code further down the pipeline expects this flattened shape; the sample object at the top of `ReviewListUtils.ts` still shows the raw shape.
3. **Storage** (`lib/utils/DBUtils.ts`, Dexie):
   - Each game gets its own IndexedDB database, named by its appid, with a single `reviews` table. Its indexed columns are listed in `getReviewStoreForGame`.
   - A reserved database named `operation` records the last search for each appid: `start`, `end`, `params` (the search signature), `hardware` and `when`.
   - Adding a column you want to sort or filter on means adding it to the index string and bumping `REVIEW_STORE_VERSION`.
   - Any database not in `RESERVED_DATABASE_NAMES` is treated as a game store; `/storage` relies on this.
4. **Statistics** (`lib/utils/ReviewListUtils.ts`): `processReviewsForGame` makes one pass over the Dexie store. It returns a large `reviewStatistics` object of min/max reviews per field, medians, word frequency lists, language totals and volume over time. Components read this object instead of computing their own stats.
5. **Presentation** (`components/Breakdown.tsx`) holds the main state for the game page: filters, sorting, pagination and view options. `getDBPageAtIndex` turns the current sort into a Dexie `orderBy` on an indexed column, then applies the filters. The tabs (table, highlights, prompts, visualisations, export) all get their data from here.

### Game page (`pages/game/[appId].tsx`)

- These query params set the scrape scope:
  - `start` and `end`: ms timestamps.
  - `languages`: comma-separated Steam locale keys from `lib/utils/SteamLocales.ts`.
  - `deck`, `os`, `cpu` and `gpu`: optional hardware filters, sent to the API as `HardwareFilters`.
- These are combined into a `searchSignature` string. If the game's DB already holds reviews and the signature matches the logged search, scraping is skipped and the stored reviews are used directly. Older search records without `params` fall back to comparing the date range. An "Explore" button lets the user re-scrape.
- `GameSearch` builds these URLs from the search form.
- `components/Loader.tsx` shows scrape progress. Its proceed option aborts the scrape through the `AbortController` passed into `getReviews`.

### State persistence

- **URL query params**: filters are written as `f<filterKey>=<JSON>` with a shallow `router.push`. On load they are read back and checked against `reviewStatistics` ranges in `Breakdown`.
- **Cookies** (`react-cookie`): `viewOptions`, `filters`, `sorting` and `darkMode`.
- **Dark mode** is the `dark` class on `<html>`, set by `DarkModeToggle`; the `html.dark` overrides live in `pages/app.scss`.

### GitHub Pages SPA routing

- `next.config.js` sets `basePath: '/steam-review-explorer'`, so internal links and asset paths must respect it.
- Dynamic `/game/<appId>` URLs only work on the static host through a redirect workaround. `pages/404.tsx` rewrites the path into a `/?/...` query, using `~and~` in place of `&`. `pages/_app.tsx` then decodes it and calls `router.push`.
- Keep the two in sync if routes or the base path change.
