import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const slice = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const functions = slice('let subUrl', '// Theme management') +
    slice('function buildSubscriptionUrl', '// Initialize form elements') +
    slice('function handleImportToClash', '// Check backend version');
const short = 'https://aot.im/s/AbCdEfGhIjKlMnOp';

function setup(fetch) {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
            style: {}, classList: { add() {}, remove() {}, contains() { return false; } }
        });
        return elements.get(id);
    };
    const copied = [], qr = [], opened = [], errors = [];
    function QRCode(canvas, options) { qr.push(options.text); }
    QRCode.CorrectLevel = { M: 1 };
    const data = { backend: 'https://conv.620895.xyz/sub?', url: 'https://example.com/sub?token=demo', target: 'clash&new_name=true' };
    const context = vm.createContext({
        document: { getElementById: element, documentElement: element('html') },
        window: { location: { origin: 'https://subconv.620895.xyz' }, open: url => opened.push(url) },
        copyText: text => copied.push(text), showToast: (text, type) => errors.push({ text, type }),
        readSubscriptionForm: () => data,
        fetch, URL, AbortController, setTimeout, clearTimeout, QRCode, data
    });
    vm.runInContext(functions, context);
    return { run: code => vm.runInContext(code, context), element, copied, qr, opened, errors, data };
}

test('selected short URL is shared by copy, both QR codes and Clash import; original can be restored', async () => {
    const app = setup(async () => Response.json({ link: short }, { status: 201 }));
    app.run('generateSubUrl(data)');
    const original = app.element('result').value;
    await app.run('handleShortLink()');
    assert.equal(app.element('result').value, short);
    app.run('handleCopy(); handleQrCode(); handleClashQrCode(); handleImportToClash()');
    assert.equal(app.copied.at(-1), short);
    assert.deepEqual(app.qr, [short, 'clash://install-config?url=' + encodeURIComponent(short)]);
    assert.equal(app.opened[0], app.qr[1]);
    app.element('useShortLink').checked = false;
    app.run('updateSelectedLink(); handleClashQrCode(); handleImportToClash()');
    assert.equal(app.element('result').value, original);
    assert.equal(app.opened.at(-1), 'clash://install-config?url=' + encodeURIComponent(original));
});

test('production aliases accept the aot.im link from the same service', async () => {
    for (const site of ['https://subweb-3lq.pages.dev']) {
        const app = setup(async () => Response.json({ link: short }, { status: 201 }));
        app.run(`window.location.origin = ${JSON.stringify(site)}`);
        app.run('generateSubUrl(data)');
        await app.run('handleShortLink()');
        assert.equal(app.element('result').value, short);
    }
});

test('an old response cannot overwrite a regenerated link', async () => {
    let finish;
    const app = setup(() => new Promise(resolve => { finish = resolve; }));
    app.run('generateSubUrl(data)');
    const pending = app.run('handleShortLink()');
    app.data.url = 'https://example.com/other';
    app.run('generateSubUrl(data)');
    const original = app.element('result').value;
    finish(Response.json({ link: short }, { status: 201 }));
    await pending;
    assert.equal(app.element('result').value, original);
    assert.equal(app.element('useShortLink').checked, false);
    assert.equal(app.element('shortLinkBtn').disabled, false);
});

test('editing a form invalidates the result even if a canceled request still resolves', async () => {
    let finish;
    const app = setup(() => new Promise(resolve => { finish = resolve; }));
    app.run('generateSubUrl(data)');
    const pending = app.run('handleShortLink()');
    app.run('invalidateGeneratedLink()');
    finish(Response.json({ link: short }, { status: 201 }));
    await pending;
    assert.equal(app.element('result').value, '');
    assert.equal(app.element('resultSection').style.display, 'none');
    assert.equal(app.element('shortLinkBtn').disabled, false);
});

test('failed API calls preserve a usable long link', async () => {
    for (const response of [
        new Response('<html>not deployed</html>'),
        Response.json({ message: 'rate limited' }, { status: 429 }),
        Response.json({ link: 'https://evil.example/s/AbCdEfGhIjKlMnOp' }, { status: 201 })
    ]) {
        const app = setup(async () => response);
        app.run('generateSubUrl(data)');
        const original = app.element('result').value;
        await app.run('handleShortLink()');
        assert.equal(app.element('result').value, original);
        assert.equal(app.element('shortLinkBtn').disabled, false);
        assert.equal(app.errors.at(-1).type, 'error');
    }
});
