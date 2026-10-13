import { redirect, type Handle } from '@sveltejs/kit';
import { authConfig, readSession, SESSION_COOKIE } from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login', '/favicon.svg', '/robots.txt']);

export const handle: Handle = async ({ event, resolve }) => {
  const config = authConfig();

  if (config.state === 'misconfigured') {
    return new Response(`Site locked: ${config.message}`, { status: 503, headers: { 'content-type': 'text/plain' } });
  }

  if (config.state === 'disabled') {
    // Local development without passwords: everyone can do everything.
    event.locals.role = 'editor';
    event.locals.authEnabled = false;
  } else {
    event.locals.authEnabled = true;
    event.locals.role = readSession(event.cookies.get(SESSION_COOKIE));
    if (!event.locals.role && !PUBLIC_PATHS.has(event.url.pathname)) {
      const next = event.url.pathname + event.url.search;
      redirect(303, `/login?next=${encodeURIComponent(next)}`);
    }
  }

  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
};
