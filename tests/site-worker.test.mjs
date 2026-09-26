import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/site.mjs';

test('the apex and unrelated paths stay blank 404', async () => {
    for (const path of ['/', '/index.html', '/api/create', '/s/missing']) {
        const response = worker.fetch(new Request(`https://aot.im${path}`));
        assert.equal(response.status, 404);
        assert.equal(await response.text(), '');
    }
});

test('Zoho file can be served without changing short-link routing', async () => {
    const path = 'https://aot.im/zoho-domain-verification.html';
    const get = worker.fetch(new Request(path));
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(await get.text(), '30563962');

    const head = worker.fetch(new Request(path, { method: 'HEAD' }));
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(worker.fetch(new Request(path, { method: 'POST' })).status, 404);
    assert.equal(worker.fetch(new Request('https://other.example/zoho-domain-verification.html')).status, 404);
});
