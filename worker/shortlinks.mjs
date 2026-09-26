const SHORT_LINK_PATH = /^\/s\/([A-Za-z0-9_-]{2,64})$/;
const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
};

function empty(status, headers = {}) {
    return new Response(null, {
        status,
        headers: { ...RESPONSE_HEADERS, ...headers }
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // This Worker is the only origin for aot.im. Never serve the Pages UI or API.
        if (url.hostname !== 'aot.im' || !['GET', 'HEAD'].includes(request.method)) {
            return empty(404);
        }
        const match = SHORT_LINK_PATH.exec(url.pathname);
        if (!match) return empty(404);
        if (!env.DB) return empty(503);

        try {
            const link = await env.DB.prepare(
                'SELECT url, status, expires_at FROM links WHERE slug = ?1'
            ).bind(match[1]).first();
            if (!link) return empty(404);
            if (link.status !== 1 ||
                (link.expires_at !== null && link.expires_at <= Math.floor(Date.now() / 1000))) {
                return empty(410);
            }

            const destination = new URL(link.url);
            if (!['https:', 'http:'].includes(destination.protocol) ||
                destination.username || destination.password) {
                return empty(410);
            }
            return empty(302, { Location: destination.href });
        } catch {
            // Database errors may contain subscription tokens; do not expose them.
            return empty(503);
        }
    }
};
