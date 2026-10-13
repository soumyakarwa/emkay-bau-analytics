// Two shared passwords: SITE_PASSWORD lets people view the site, UPLOAD_PASSWORD
// also lets them publish a new calendar. A signed cookie remembers who signed in.
//
// Changing a password signs out everyone who used it, because the password is
// part of the signing key. Changing AUTH_SECRET signs out everyone.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export type Role = 'viewer' | 'editor';

export const SESSION_COOKIE = 'smbau_session';
export const SESSION_DAYS = 30;

export type AuthConfig =
  | { state: 'enabled' }
  | { state: 'disabled' } // local development without passwords
  | { state: 'misconfigured'; message: string };

export function authConfig(): AuthConfig {
  const { SITE_PASSWORD, UPLOAD_PASSWORD, AUTH_SECRET } = env;
  const anySet = Boolean(SITE_PASSWORD || UPLOAD_PASSWORD || AUTH_SECRET);
  if (!anySet && !env.VERCEL) return { state: 'disabled' };
  // Fail closed: on Vercel, or with a partial setup, never serve the site unprotected.
  if (!SITE_PASSWORD || !UPLOAD_PASSWORD || !AUTH_SECRET) {
    return { state: 'misconfigured', message: 'Set SITE_PASSWORD, UPLOAD_PASSWORD and AUTH_SECRET (see README › Passwords).' };
  }
  if (SITE_PASSWORD === UPLOAD_PASSWORD) {
    return { state: 'misconfigured', message: 'SITE_PASSWORD and UPLOAD_PASSWORD must be different.' };
  }
  if (AUTH_SECRET.length < 32) {
    return { state: 'misconfigured', message: 'AUTH_SECRET must be at least 32 characters (see README › Passwords).' };
  }
  return { state: 'enabled' };
}

function passwordFor(role: Role) {
  return role === 'editor' ? env.UPLOAD_PASSWORD! : env.SITE_PASSWORD!;
}

function signature(role: Role, expires: number) {
  const key = createHmac('sha256', env.AUTH_SECRET!).update(`${role}:${passwordFor(role)}`).digest();
  return createHmac('sha256', key).update(`${role}.${expires}`).digest('base64url');
}

function sameText(a: string, b: string) {
  // Hash first so the comparison is constant-time regardless of length.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createSession(role: Role, now = Date.now()) {
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${role}.${expires}.${signature(role, expires)}`;
}

export function readSession(value: string | undefined, now = Date.now()): Role | null {
  if (!value) return null;
  const [role, expiresText, sig] = value.split('.');
  if (role !== 'viewer' && role !== 'editor') return null;
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < now || !sig) return null;
  return sameText(sig, signature(role, expires)) ? role : null;
}

/** Which role a typed password unlocks, if any. */
export function roleForPassword(input: string): Role | null {
  if (sameText(input, env.UPLOAD_PASSWORD!)) return 'editor';
  if (sameText(input, env.SITE_PASSWORD!)) return 'viewer';
  return null;
}

/** Only allow redirects back into this site. */
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
