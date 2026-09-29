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

test('the former Zoho verification path now stays blank 404', async () => {
    const path = 'https://aot.im/zoho-domain-verification.html';
    for (const method of ['GET', 'HEAD', 'POST']) {
        const response = worker.fetch(new Request(path, { method }));
        assert.equal(response.status, 404);
        assert.equal(await response.text(), '');
    }
});
