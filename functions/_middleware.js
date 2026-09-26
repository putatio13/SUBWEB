const SHORT_LINK_PATH = /^\/s\/[A-Za-z0-9_-]{2,64}$/;

export function onRequest(context) {
    const { hostname, pathname } = new URL(context.request.url);

    // The short-link domain must never serve the converter UI, its assets, or APIs.
    if (hostname === 'aot.im' && !SHORT_LINK_PATH.test(pathname)) {
        return new Response(null, {
            status: 404,
            headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        });
    }

    // Retired UI hostname: do not redirect it to the new UI hostname.
    if (hostname === 'subconv.aot.im') {
        return new Response(null, {
            status: 404,
            headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
        });
    }

    return context.next();
}
