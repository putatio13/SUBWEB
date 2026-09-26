import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/_middleware.js';

const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));

async function route(url) {
    let passed = false;
    const response = await onRequest({
        request: new Request(url),
        next() {
            passed = true;
            return new Response('site', { status: 200 });
        }
    });
    return { response, passed };
}

test('every path is covered by host filtering', () => {
    assert.deepEqual(routes.include, ['/*']);
    assert.deepEqual(routes.exclude, []);
});

test('aot.im only lets valid short-link paths reach the resolver', async () => {
    for (const path of ['/', '/index.html', '/js/main.js', '/api/create', '/api/Ab12',
        '/s/', '/s/a', '/s/Ab12/', '/other/s/Ab12']) {
        const { response, passed } = await route('https://aot.im' + path);
        assert.equal(response.status, 404, path);
        assert.equal(response.headers.get('location'), null);
        assert.equal(await response.text(), '');
        assert.equal(passed, false);
    }
    for (const path of ['/s/Ab12', '/s/AbCdEfGhIjKlMnOp?foo=bar']) {
        assert.equal((await route('https://aot.im' + path)).passed, true, path);
    }
});

test('old UI hostname is dark and main UI hostname remains available', async () => {
    for (const path of ['/', '/api/create', '/s/Ab12', '/js/main.js']) {
        const old = await route('https://subconv.aot.im' + path);
        assert.equal(old.response.status, 404, path);
        assert.equal(old.passed, false);
    }
    for (const path of ['/', '/api/create', '/js/main.js']) {
        assert.equal((await route('https://subconv.620895.xyz' + path)).passed, true, path);
    }
});
