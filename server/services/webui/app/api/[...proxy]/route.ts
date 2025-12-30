import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Force Node.js runtime to support environment variables

const GATEWAY_URL = 'https://localhost:3000';

async function proxy(req: NextRequest) {
    // Allow self-signed certs for internal proxying
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const url = `${GATEWAY_URL}${req.nextUrl.pathname}${req.nextUrl.search}`;
    console.log(`[API Proxy] Forwarding ${req.method} ${req.nextUrl.pathname} -> ${url}`);

    try {
        const headers = new Headers(req.headers);
        headers.set('host', 'localhost:3000'); // Ensure Host header matches target

        // Remove headers causing issues
        headers.delete('connection');
        headers.delete('transfer-encoding');

        const body = (req.method !== 'GET' && req.method !== 'HEAD')
            ? await req.blob()
            : null;

        const options: RequestInit = {
            method: req.method,
            headers,
            body,
            cache: 'no-store',
            // @ts-ignore - Required for body forwarding in Node.js fetch
            duplex: 'half',
        };

        const res = await fetch(url, options);

        // Copy headers
        const resHeaders = new Headers(res.headers);
        resHeaders.delete('content-encoding');

        return new NextResponse(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: resHeaders
        });
    } catch (e: any) {
        console.error('[API Proxy] Error:', e.message);
        return NextResponse.json({ error: `Proxy Error: ${e.message}` }, { status: 502 });
    }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
