import { fail, redirect } from '@sveltejs/kit';
import { createSession, roleForPassword, safeNext, SESSION_COOKIE, SESSION_DAYS } from '$lib/server/auth';

export async function load({ locals, url }) {
  return { role: locals.role, authEnabled: locals.authEnabled, next: safeNext(url.searchParams.get('next')) };
}

export const actions = {
  default: async ({ request, cookies, url, locals }) => {
    if (!locals.authEnabled) redirect(303, '/');
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    const role = password ? roleForPassword(password) : null;
    if (!role) {
      // Slow down guessing. Use long passwords: this is the main protection.
      await new Promise((r) => setTimeout(r, 800));
      return fail(400, { message: 'That password is not right.' });
    }
    cookies.set(SESSION_COOKIE, createSession(role), {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: SESSION_DAYS * 24 * 60 * 60
    });
    redirect(303, safeNext(url.searchParams.get('next')));
  }
};
