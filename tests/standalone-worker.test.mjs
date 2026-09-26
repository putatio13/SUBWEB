import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/shortlinks.mjs';

function envFor(link) {
    return {
        DB: {
            prepare(query) {
                assert.match(query, /WHERE slug = \?1/);
                return {
                    bind(slug) {
                        assert.equal(slug, 'known-slug');
                        return { first: async () => link };
                    }
                };
            }
        }
    };
}

test('only short-link GET and HEAD requests can reach D1', async () => {
    const env = { DB: { prepare: () => { throw new Error('unexpected D1 access'); } } };
    for (const [url, method] of [
        ['https://aot.im/', 'GET'],
        ['https://aot.im/api/create', 'GET'],
        ['https://aot.im/s/known-slug/extra', 'GET'],
        ['https://aot.im/s/known-slug', 'POST'],
        ['https://other.example/s/known-slug', 'GET']
    ]) {
        const response = await worker.fetch(new Request(url, { method }), env);
        assert.equal(response.status, 404, `${method} ${url}`);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('location'), null);
    }
});

test('existing D1 short links redirect without returning the UI', async () => {
    const destination = 'https://conv.620895.xyz/sub?url=https%3A%2F%2Fexample.com&target=clash';
    const env = envFor({ url: destination, status: 1, expires_at: null });
    for (const method of ['GET', 'HEAD']) {
        const response = await worker.fetch(new Request('https://aot.im/s/known-slug', { method }), env);
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), destination);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(await response.text(), '');
    }
});

test('unknown, expired, and broken links fail without exposing their contents', async () => {
    for (const [link, status] of [
        [null, 404],
        [{ url: 'https://example.com', status: 0, expires_at: null }, 410],
        [{ url: 'https://example.com', status: 1, expires_at: 1 }, 410],
        [{ url: 'javascript:alert(1)', status: 1, expires_at: null }, 410]
    ]) {
        const response = await worker.fetch(new Request('https://aot.im/s/known-slug'), envFor(link));
        assert.equal(response.status, status);
        assert.equal(await response.text(), '');
    }
});
