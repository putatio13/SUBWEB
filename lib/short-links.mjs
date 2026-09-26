const MAX_BODY_BYTES = 65536;
const MAX_URL_LENGTH = 32768;
const DEFAULT_ALLOWED_ORIGINS = 'https://conv.620895.xyz';
const PRIMARY_SITE_ORIGINS = new Set([
    'https://subconv.620895.xyz',
    'https://subweb-3lq.pages.dev'
]);
const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
};

function json(data, status = 200, headers = {}) {
    return Response.json(data, {
        status,
        headers: { ...RESPONSE_HEADERS, ...headers }
    });
}

class InputError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

async function readBody(request) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new InputError('请使用 JSON 提交订阅链接。', 415);
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
        throw new InputError('提交内容过长，请减少订阅链接数量。', 413);
    }
    if (!request.body) throw new InputError('缺少订阅链接。');
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BODY_BYTES) {
                await reader.cancel();
                throw new InputError('提交内容过长，请减少订阅链接数量。', 413);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        const body = JSON.parse(new TextDecoder().decode(bytes));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        return body;
    } catch {
        throw new InputError('请求格式不正确，请重新生成链接。');
    }
}

function validateDestination(value, env) {
    if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) {
        throw new InputError('订阅链接为空或过长。');
    }
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new InputError('订阅链接格式不正确。');
    }
    const allowed = (env.SHORTLINK_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
        .split(',').map(origin => origin.trim()).filter(Boolean);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        !allowed.includes(url.origin)) {
        throw new InputError('此转换后端尚未启用短链，请使用完整链接或联系站点管理员。');
    }
    if (!url.searchParams.get('url') || !url.searchParams.get('target')) {
        throw new InputError('请先生成完整的订阅转换链接。');
    }
    return url.href;
}

function publishedOrigin(requestOrigin, env) {
    // Preview deployments keep their own URL because they use a separate D1 database.
    if (!PRIMARY_SITE_ORIGINS.has(requestOrigin) || !env.SHORTLINK_PUBLIC_ORIGIN) return requestOrigin;
    const publicUrl = new URL(env.SHORTLINK_PUBLIC_ORIGIN);
    if (publicUrl.protocol !== 'https:' || publicUrl.href !== publicUrl.origin + '/') {
        throw new Error('Invalid public short-link origin');
    }
    return publicUrl.origin;
}

function randomSlug() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    // 16 base64url characters = 96 bits; 64 divides 256 without modulo bias.
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => alphabet[byte & 63]).join('');
}

async function enforceRateLimit(request, db, now) {
    // Cloudflare supplies this header. Never trust a caller's X-Forwarded-For.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const client = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    for (const [seconds, limit] of [[60, 10], [3600, 100]]) {
        const bucket = Math.floor(now / seconds) * seconds;
        const result = await db.prepare(
            'INSERT INTO short_link_rate_limits (client, bucket, requests, expires_at) ' +
            'VALUES (?1, ?2, 1, ?3) ON CONFLICT(client, bucket) DO UPDATE SET ' +
            'requests = requests + 1 WHERE requests < ?4 RETURNING requests'
        ).bind(seconds + ':' + client, bucket, bucket + seconds, limit).first();
        if (!result) {
            return json({ message: '生成短链过于频繁，请稍后再试。' }, 429, {
                'Retry-After': String(bucket + seconds - now)
            });
        }
    }
    return null;
}

export async function createShortLink(context) {
    const { request, env } = context;
    const origin = new URL(request.url).origin;
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin && requestOrigin !== origin) {
        return json({ message: '请在本站页面生成短链。' }, 403);
    }
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: { ...RESPONSE_HEADERS, Allow: 'POST, OPTIONS' }
        });
    }
    if (request.method !== 'POST') {
        return json({ message: '仅支持 POST 请求。' }, 405, { Allow: 'POST, OPTIONS' });
    }
    if (!env.DB) return json({ message: '短链服务尚未配置，请暂时使用完整链接。' }, 503);
    try {
        const body = await readBody(request);
        const url = validateDestination(body.url, env);
        const linkOrigin = publishedOrigin(origin, env);
        if (body.slug !== undefined) throw new InputError('暂不支持自定义短码。');
        const days = body.expiresInDays;
        if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 365)) {
            throw new InputError('有效期必须为 1 至 365 天的整数。');
        }
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = days === undefined ? null : now + days * 86400;
        const limited = await enforceRateLimit(request, env.DB, now);
        if (limited) return limited;
        // Do not log subscription URLs or raw client IPs.
        const cleanup = env.DB.prepare('DELETE FROM short_link_rate_limits WHERE expires_at < ?1')
            .bind(now).run().catch(() => {});
        if (context.waitUntil) context.waitUntil(cleanup);
        else await cleanup;
        for (let attempt = 0; attempt < 5; attempt++) {
            const slug = randomSlug();
            const result = await env.DB.prepare(
                'INSERT INTO links (url, slug, status, create_time, expires_at) ' +
                'VALUES (?1, ?2, 1, ?3, ?4) ON CONFLICT(slug) DO NOTHING'
            ).bind(url, slug, new Date().toISOString(), expiresAt).run();
            if (result.meta.changes === 1) {
                return json({ slug, link: linkOrigin + '/s/' + slug, expiresAt }, 201);
            }
        }
        return json({ message: '短链生成失败，请稍后重试。' }, 503);
    } catch (error) {
        if (error instanceof InputError) return json({ message: error.message }, error.status);
        // Database errors may contain a subscription token: never echo them.
        return json({ message: '短链服务暂时不可用，请使用完整链接或稍后重试。' }, 503);
    }
}

export async function resolveShortLink({ request, env, params }) {
    if (!['GET', 'HEAD'].includes(request.method)) {
        return json({ message: '仅支持 GET 或 HEAD 请求。' }, 405, { Allow: 'GET, HEAD' });
    }
    const slug = params.id;
    // Old prototype slugs remain valid; new links always use 16 random characters.
    if (typeof slug !== 'string' || !/^[A-Za-z0-9_-]{2,64}$/.test(slug)) {
        return json({ message: '短链不存在。' }, 404);
    }
    if (!env.DB) return json({ message: '短链服务暂时不可用。' }, 503);
    try {
        const link = await env.DB.prepare('SELECT url, status, expires_at FROM links WHERE slug = ?1')
            .bind(slug).first();
        if (!link) return json({ message: '短链不存在。' }, 404);
        if (link.status !== 1 ||
            (link.expires_at !== null && link.expires_at <= Math.floor(Date.now() / 1000))) {
            return json({ message: '短链已过期或停用。' }, 410);
        }
        const destination = new URL(link.url);
        if (!['https:', 'http:'].includes(destination.protocol) ||
            destination.username || destination.password) {
            return json({ message: '短链已停用。' }, 410);
        }
        return new Response(null, {
            status: 302,
            headers: { ...RESPONSE_HEADERS, Location: destination.href }
        });
    } catch {
        return json({ message: '短链服务暂时不可用。' }, 503);
    }
}
