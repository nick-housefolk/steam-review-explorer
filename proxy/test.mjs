// Run with: node proxy/test.mjs
import assert from 'node:assert/strict'
import worker from './worker.js'

const env = { ALLOWED_ORIGINS: 'https://nick-housefolk.github.io,http://localhost:3000' }
const calls = []
globalThis.fetch = async (url) => {
    calls.push(url)
    return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'a=b' } })
}
const req = (path, origin, method = 'GET') =>
    new Request(`https://proxy.example${path}`, { method, headers: origin ? { Origin: origin } : {} })

let res = await worker.fetch(req('/store.steampowered.com/api/appdetails?appids=440', 'https://nick-housefolk.github.io'), env)
assert.equal(res.status, 200)
assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://nick-housefolk.github.io')
assert.equal(res.headers.get('Set-Cookie'), null)
assert.equal(calls.at(-1), 'https://store.steampowered.com/api/appdetails?appids=440')

const input = encodeURIComponent(JSON.stringify({ appid: 440, languages: ['all'] }))
res = await worker.fetch(req(`/api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${input}&cacheBust=0.5`, 'http://localhost:3000'), env)
assert.equal(res.status, 200)
assert.equal(calls.at(-1), `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${input}&cacheBust=0.5`)

res = await worker.fetch(req('/https://store.steampowered.com/api/featured', 'http://localhost:3000'), env)
assert.equal(calls.at(-1), 'https://store.steampowered.com/api/featured')

const before = calls.length
assert.equal((await worker.fetch(req('/store.steampowered.com/api/featured', 'https://evil.example'), env)).status, 403)
assert.equal((await worker.fetch(req('/store.steampowered.com/api/featured', null), env)).status, 403)
assert.equal((await worker.fetch(req('/example.com/', 'http://localhost:3000'), env)).status, 403)
assert.equal((await worker.fetch(req('/store.steampowered.com.evil.com/x', 'http://localhost:3000'), env)).status, 403)
assert.equal((await worker.fetch(req('/store.steampowered.com/x', 'http://localhost:3000', 'POST'), env)).status, 405)
assert.equal(calls.length, before, 'rejected requests must not reach upstream')

res = await worker.fetch(req('/store.steampowered.com/x', 'http://localhost:3000', 'OPTIONS'), env)
assert.equal(res.status, 204)
assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000')

console.log('proxy tests passed')
