// CORS proxy for Steam Review Explorer.
//
// The app calls `${CORS_URL}<host>/<path>?<query>`, e.g.
//   https://<worker>.workers.dev/store.steampowered.com/api/appdetails?appids=440
// This Worker forwards GET requests to an allowed Steam host and adds CORS
// headers. Only origins listed in ALLOWED_ORIGINS may use it.

const ALLOWED_HOSTS = ['store.steampowered.com', 'api.steampowered.com']

function parseList(value) {
    return (value || '').split(',').map(s => s.trim()).filter(Boolean)
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Content-Length',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    }
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin')
        const allowedOrigins = parseList(env.ALLOWED_ORIGINS)

        if (!origin || allowedOrigins.indexOf(origin) === -1) {
            return new Response('Origin not allowed', { status: 403 })
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) })
        }
        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) })
        }

        const url = new URL(request.url)
        // Accept both `/host/path` and `/https://host/path`
        const target = url.pathname.slice(1).replace(/^https?:\/+/, '')
        const slash = target.indexOf('/')
        const host = slash === -1 ? target : target.slice(0, slash)
        const path = slash === -1 ? '/' : target.slice(slash)

        if (ALLOWED_HOSTS.indexOf(host) === -1) {
            return new Response('Host not allowed', { status: 403, headers: corsHeaders(origin) })
        }

        const upstream = await fetch(`https://${host}${path}${url.search}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'steam-review-explorer-proxy' }
        })

        const headers = new Headers(upstream.headers)
        headers.delete('Set-Cookie')
        for (const [k, v] of Object.entries(corsHeaders(origin))) {
            headers.set(k, v)
        }

        return new Response(upstream.body, { status: upstream.status, headers })
    }
}
