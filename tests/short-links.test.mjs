import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createShortLink, resolveShortLink } from '../lib/short-links.mjs';

const migration = readFileSync(new URL('../migrations/0001_short_links.sql', import.meta.url), 'utf8');
const origin = 'https://subconv.620895.xyz';
const destination = 'https://conv.620895.xyz/sub?url=https%3A%2F%2Fexample.com%2Fsub%3Ftoken%3Ddemo&target=clash&new_name=true';

function database(t, before = '') {
    const sqlite = new DatabaseSync(':memory:');
    if (before) sqlite.exec(before);
    sqlite.exec(migration);
    t.after(() => sqlite.close());
    return {
        sqlite,
        prepare(sql) {
            let params = [];
            return {
                bind(...values) { params = values; return this; },
                async first() { return sqlite.prepare(sql).get(...params) || null; },
                async run() {
                    const result = sqlite.prepare(sql).run(...params);
                    return { success: true, meta: { changes: Number(result.changes) } };
                }
            };
        }
    };
}
function create(db, body = { url: destination }, options = {}) {
    const requestOrigin = options.origin || origin;
    return createShortLink({
        env: { DB: db, ...options.env },
        request: new Request(requestOrigin + '/api/create', {
            method: options.method || 'POST',
            headers: { 'Content-Type': 'application/json', Origin: requestOrigin, 'CF-Connecting-IP': '192.0.2.1', ...options.headers },
            ...(!['GET', 'HEAD', 'OPTIONS'].includes(options.method)
                ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
        })
    });
}
function resolve(db, slug, method = 'GET') {
    return resolveShortLink({ env: { DB: db }, params: { id: slug }, request: new Request(origin + '/s/' + slug, { method }) });
}

test('creates a persistent 16-character short link and resolves GET and HEAD without caching', async t => {
    const db = database(t);
    const response = await create(db);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.slug, /^[A-Za-z0-9_-]{16}$/);
    assert.equal(body.link, origin + '/s/' + body.slug);
    assert.equal(body.expiresAt, null);
    for (const method of ['GET', 'HEAD']) {
        const redirect = await resolve(db, body.slug, method);
        assert.equal(redirect.status, 302);
        assert.equal(redirect.headers.get('location'), destination);
        assert.equal(redirect.headers.get('cache-control'), 'no-store');
        assert.equal(redirect.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(await redirect.text(), '');
    }
    const row = db.sqlite.prepare('SELECT * FROM links').get();
    assert.equal(row.ip, null);
    assert.equal(row.ua, null);
});

test('publishes production links on aot.im while preview links remain isolated', async t => {
    const db = database(t);
    const env = { SHORTLINK_PUBLIC_ORIGIN: 'https://aot.im' };
    const live = await (await create(db, { url: destination }, { env })).json();
    assert.equal(live.link, 'https://aot.im/s/' + live.slug);
    assert.equal((await resolve(db, live.slug)).headers.get('location'), destination);
    for (const site of ['https://subconv.aot.im', 'https://subweb-3lq.pages.dev']) {
        const alias = await (await create(db, { url: destination }, { env, origin: site })).json();
        assert.equal(alias.link, 'https://aot.im/s/' + alias.slug);
    }
    const previewOrigin = 'https://preview.subweb-3lq.pages.dev';
    const preview = await (await create(db, { url: destination }, { env, origin: previewOrigin })).json();
    assert.equal(preview.link, previewOrigin + '/s/' + preview.slug);
});

test('migration preserves prototype records and old short codes', async t => {
    const db = database(t,
        'CREATE TABLE links (id INTEGER PRIMARY KEY, url TEXT NOT NULL, slug TEXT NOT NULL, ip TEXT, status INTEGER DEFAULT 1, ua TEXT, create_time TEXT);' +
        "INSERT INTO links (url,slug,status) VALUES ('https://example.com/old','Ab12',1);"
    );
    assert.equal((await resolve(db, 'Ab12')).headers.get('location'), 'https://example.com/old');
});

test('quotes in links remain data and cannot execute SQL', async t => {
    const db = database(t);
    const url = destination + "&include=';DROP TABLE links;--";
    const body = await (await create(db, { url })).json();
    assert.equal((await resolve(db, body.slug)).headers.get('location'), new URL(url).href);
    assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM links').get().n, 1);
    assert.equal((await resolve(db, "' OR 1=1 --")).status, 404);
});

test('rejects arbitrary redirects, credentials and incomplete conversion URLs', async t => {
    const db = database(t);
    for (const url of [
        'javascript:alert(1)', 'https://evil.example/sub?url=x&target=clash',
        'https://conv.620895.xyz.evil.example/sub?url=x&target=clash',
        'https://user:pass@conv.620895.xyz/sub?url=x&target=clash',
        'https://conv.620895.xyz/sub', 'not a url', 123
    ]) {
        assert.equal((await create(db, { url })).status, 400);
    }
    assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM links').get().n, 0);
});

test('an explicitly configured backend is supported', async t => {
    const db = database(t);
    const response = await create(db, { url: 'https://other.example/sub?url=x&target=clash' },
        { env: { SHORTLINK_ALLOWED_ORIGINS: 'https://other.example' } });
    assert.equal(response.status, 201);
});

test('rejects invalid JSON, oversized bodies, wrong methods and cross-origin writes', async t => {
    const db = database(t);
    assert.equal((await create(db, '{')).status, 400);
    assert.equal((await create(db, null)).status, 400);
    assert.equal((await create(db, [], {})).status, 400);
    assert.equal((await create(db, 'x'.repeat(65537))).status, 413);
    assert.equal((await create(db, { url: destination }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await create(db, undefined, { method: 'GET' })).status, 405);
    assert.equal((await create(db, undefined, { method: 'OPTIONS' })).status, 204);
    assert.equal((await create(db, undefined, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await create(db, { url: destination, slug: "a'bc" })).status, 400);
});

test('missing configuration and database failures do not leak URLs or SQL', async () => {
    assert.equal((await create(undefined)).status, 503);
    const broken = { prepare() { throw new Error('private-token-in-query'); } };
    const response = await create(broken);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-token/);
    assert.equal((await resolve(undefined, 'abcdefgh')).status, 503);
});

test('expiry, revocation and unknown links return the correct statuses', async t => {
    const db = database(t);
    const body = await (await create(db, { url: destination, expiresInDays: 7 })).json();
    assert.ok(body.expiresAt > Date.now() / 1000 + 6 * 86400);
    db.sqlite.prepare('UPDATE links SET expires_at = 1 WHERE slug = ?').run(body.slug);
    assert.equal((await resolve(db, body.slug)).status, 410);
    db.sqlite.prepare('UPDATE links SET expires_at = NULL, status = 0 WHERE slug = ?').run(body.slug);
    assert.equal((await resolve(db, body.slug)).status, 410);
    assert.equal((await resolve(db, 'not-found')).status, 404);
    assert.equal((await resolve(db, 'not-found', 'POST')).status, 405);
    for (const expiresInDays of [0, -1, 366, '7', 1.5, null]) {
        assert.equal((await create(db, { url: destination, expiresInDays })).status, 400);
    }
});

test('a random-code collision is retried without overwriting the original link', async t => {
    const db = database(t);
    db.sqlite.prepare('INSERT INTO links (url,slug,status) VALUES (?,?,1)').run(destination, 'AAAAAAAAAAAAAAAA');
    let calls = 0;
    t.mock.method(crypto, 'getRandomValues', array => array.fill(calls++ === 0 ? 0 : 1));
    const body = await (await create(db)).json();
    assert.equal(body.slug, 'BBBBBBBBBBBBBBBB');
    assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM links').get().n, 2);
});

test('concurrent writes enforce ten creates per minute without blocking reads', async t => {
    const db = database(t);
    t.mock.method(Date, 'now', () => 1800000000000);
    const responses = await Promise.all(Array.from({ length: 12 }, () => create(db)));
    assert.equal(responses.filter(response => response.status === 201).length, 10);
    const denied = responses.filter(response => response.status === 429);
    assert.equal(denied.length, 2);
    assert.ok(Number(denied[0].headers.get('retry-after')) > 0);
    const slug = db.sqlite.prepare('SELECT slug FROM links LIMIT 1').get().slug;
    assert.equal((await resolve(db, slug)).status, 302);
    assert.equal((await create(db, undefined, { headers: { 'CF-Connecting-IP': '192.0.2.2' } })).status, 201);
});

test('hourly quota holds across minute buckets', async t => {
    const db = database(t);
    let now = 1800000000000;
    t.mock.method(Date, 'now', () => now);
    for (let minute = 0; minute < 10; minute++) {
        for (let n = 0; n < 10; n++) assert.equal((await create(db)).status, 201);
        now += 60000;
    }
    assert.equal((await create(db)).status, 429);
});
