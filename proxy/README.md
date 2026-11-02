# Steam CORS proxy (Cloudflare Worker)

The app runs entirely in the browser, and Steam's APIs don't send CORS headers, so every Steam request goes through a proxy. This Worker is that proxy. It only forwards `GET` requests to `store.steampowered.com` and `api.steampowered.com`, and only for the origins in `ALLOWED_ORIGINS` (set in `wrangler.toml`).

## Deploy

```
cd proxy
npx wrangler login
npx wrangler deploy
```

Wrangler prints the Worker's URL, e.g. `https://steam-review-explorer-proxy.<subdomain>.workers.dev`.

## Point the app at it

Set the proxy URL **with a trailing slash** as `NEXT_PUBLIC_CORS_URL` at build time:

- **GitHub Pages:** add a repository variable `CORS_URL` (Settings → Secrets and variables → Actions → Variables). The deploy workflow passes it to the build.
- **Locally:** `NEXT_PUBLIC_CORS_URL=https://steam-review-explorer-proxy.<subdomain>.workers.dev/ yarn dev`

If it isn't set, the app falls back to `https://joshhills.dev/cors/`.

## Test

```
node proxy/test.mjs
```
