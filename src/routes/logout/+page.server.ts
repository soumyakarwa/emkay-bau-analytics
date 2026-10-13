import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/auth';

export function load() {
  redirect(303, '/');
}

export const actions = {
  default: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    redirect(303, '/login');
  }
};
