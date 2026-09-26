const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
};
const ZOHO_VERIFICATION_BODY = '30563962';

export default {
    fetch(request) {
        const url = new URL(request.url);
        if (url.hostname === 'aot.im' &&
            url.pathname === '/zoho-domain-verification.html' &&
            ['GET', 'HEAD'].includes(request.method)) {
            return new Response(request.method === 'HEAD' ? null : ZOHO_VERIFICATION_BODY, {
                status: 200,
                headers: { ...RESPONSE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' }
            });
        }
        // No homepage is published until one is explicitly added here.
        return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
    }
};
