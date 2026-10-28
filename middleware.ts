import { NextResponse, type NextRequest } from 'next/server';

const username = 'tester';

export function middleware(request: NextRequest) {
  const password = process.env.TEST_SITE_PASSWORD;
  if (!password) {
    return new Response('Test site access is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    try {
      const encodedCredentials = authorization.slice('Basic '.length);
      const binaryCredentials = atob(encodedCredentials);
      const credentials = new TextDecoder().decode(
        Uint8Array.from(binaryCredentials, (character) => character.charCodeAt(0)),
      );
      if (credentials === `${username}:${password}`) {
        const { pathname } = request.nextUrl;
        if (pathname !== '/castdocs' && !pathname.startsWith('/_next/') && pathname !== '/favicon.ico') {
          return NextResponse.redirect(new URL('/castdocs', request.url));
        }
        return NextResponse.next();
      }
    } catch {
      // Invalid Basic authentication is handled as an authentication failure.
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Basic realm="Cross-dock test", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: '/:path*',
};
