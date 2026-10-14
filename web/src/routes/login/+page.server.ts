import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { accessForPassword, createSession, mergeAccess, rateLimiter, readSession, safeNext, SESSION_COOKIE, SESSION_DAYS } from '$lib/server/auth';
import { currentAuth } from '$lib/server/auth-env';
import type { Actions, PageServerLoad } from './$types';

const limiter = rateLimiter();

export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.authEnabled) redirect(303, safeNext(url.searchParams.get('next')));
  return { signedIn: !!locals.access, uploadBrands: locals.access?.uploadBrands ?? [] };
};

export const actions: Actions = {
  default: async ({ request, cookies, url, getClientAddress }) => {
    const config = currentAuth();
    if (config.state !== 'enabled') redirect(303, '/');
    const who = getClientAddress();
    if (limiter.blocked(who)) return fail(429, { message: 'Too many wrong passwords. Wait ten minutes and try again.' });

    const password = String((await request.formData()).get('password') ?? '');
    const granted = password ? await accessForPassword(config.settings, password) : null;
    if (!granted) {
      limiter.fail(who);
      return fail(401, { message: 'That password is not right.' });
    }
    limiter.clear(who);
    // Signing in with another brand's upload password adds that brand to what you already have.
    const current = await readSession(config.settings, cookies.get(SESSION_COOKIE));
    const access = mergeAccess(current, granted);
    cookies.set(SESSION_COOKIE, await createSession(config.settings, access), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !dev,
      maxAge: SESSION_DAYS * 86_400
    });
    redirect(303, safeNext(url.searchParams.get('next')));
  }
};
