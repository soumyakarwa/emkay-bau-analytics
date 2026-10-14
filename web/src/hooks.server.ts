import { redirect, type Handle } from '@sveltejs/kit';
import { BRANDS } from '$lib/brands';
import { readSession, SESSION_COOKIE } from '$lib/server/auth';
import { currentAuth } from '$lib/server/auth-env';

const PUBLIC_PATHS = new Set(['/login']);

export const handle: Handle = async ({ event, resolve }) => {
  const config = currentAuth();

  if (config.state === 'misconfigured') {
    return new Response(`Site locked. ${config.message}`, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  if (config.state === 'disabled') {
    // Developing on a computer without passwords: everyone may do everything.
    event.locals.authEnabled = false;
    event.locals.access = { uploadBrands: BRANDS.map((b) => b.id) };
  } else {
    event.locals.authEnabled = true;
    event.locals.access = await readSession(config.settings, event.cookies.get(SESSION_COOKIE));
    if (!event.locals.access && !PUBLIC_PATHS.has(event.url.pathname)) {
      if (event.request.method !== 'GET') return new Response('Sign in first.', { status: 401 });
      redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
    }
  }

  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
};
