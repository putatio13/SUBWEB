const RESPONSE_HEADERS = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
};

export default {
    fetch() {
        // No homepage is published until one is explicitly added here.
        return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
    }
};
