// Shared-password sign-in.
//
//   SITE_PASSWORD             view the site (give to the whole team)
//   UPLOAD_PASSWORD_GLOBAL    also upload Emkay Global's workbook
//   UPLOAD_PASSWORD_IM        also upload Emkay Investment Managers' workbook
//   UPLOAD_PASSWORD_WEALTH    also upload Emkay Wealth Management's workbook
//   AUTH_SECRET               long random string that signs sign-in cookies
//
// A signed cookie remembers what someone may do. The passwords that granted it are part of the
// signing key, so changing a password signs out everyone who used it; changing AUTH_SECRET signs
// out everyone. Uses Web Crypto only, so it runs on any host (Vercel, Cloudflare, Azure, Node).
//
// With no passwords at all, sign-in is off, but only while developing on a computer; a built site
// with missing or weak settings refuses to run ("Site locked"), so it can never go live unprotected.

import { BRANDS, type BrandId } from '../brands';

export const SESSION_COOKIE = 'emkay_bau_session';
export const SESSION_DAYS = 30;
const MIN_PASSWORD = 12;
const MIN_SECRET = 32;

export interface AuthSettings {
  sitePassword?: string;
  uploadPasswords: Partial<Record<BrandId, string>>;
  secret?: string;
}

export type AuthConfig =
  | { state: 'enabled'; settings: Required<Pick<AuthSettings, 'sitePassword' | 'secret'>> & { uploadPasswords: Record<BrandId, string> } }
  | { state: 'disabled' }
  | { state: 'misconfigured'; message: string };

/** What a signed-in person may do. */
export interface Access {
  /** Brands they may upload for. Everyone signed in may view. */
  uploadBrands: BrandId[];
}

export function settingsFromEnv(env: Record<string, string | undefined>): AuthSettings {
  return {
    sitePassword: env.SITE_PASSWORD || undefined,
    secret: env.AUTH_SECRET || undefined,
    uploadPasswords: Object.fromEntries(
      BRANDS.map((b) => [b.id, env[`UPLOAD_PASSWORD_${b.id.toUpperCase()}`] || undefined]).filter(([, v]) => v)
    )
  };
}

export function authConfig(s: AuthSettings, developing: boolean): AuthConfig {
  const names = { site: 'SITE_PASSWORD', secret: 'AUTH_SECRET', upload: (id: string) => `UPLOAD_PASSWORD_${id.toUpperCase()}` };
  const anySet = Boolean(s.sitePassword || s.secret || Object.keys(s.uploadPasswords).length);
  if (!anySet && developing) return { state: 'disabled' };
  const missing = [
    !s.sitePassword && names.site,
    ...BRANDS.filter((b) => !s.uploadPasswords[b.id]).map((b) => names.upload(b.id)),
    !s.secret && names.secret
  ].filter(Boolean);
  if (missing.length) return { state: 'misconfigured', message: `Set ${missing.join(', ')} (see web/README.md › Passwords).` };
  const all = [s.sitePassword!, ...BRANDS.map((b) => s.uploadPasswords[b.id]!)];
  if (all.some((p) => p.length < MIN_PASSWORD)) return { state: 'misconfigured', message: `Every password must be at least ${MIN_PASSWORD} characters.` };
  if (new Set(all).size !== all.length) return { state: 'misconfigured', message: 'The view password and the three upload passwords must all be different.' };
  if (s.secret!.length < MIN_SECRET) return { state: 'misconfigured', message: `AUTH_SECRET must be at least ${MIN_SECRET} characters.` };
  return {
    state: 'enabled',
    settings: { sitePassword: s.sitePassword!, secret: s.secret!, uploadPasswords: s.uploadPasswords as Record<BrandId, string> }
  };
}

type Enabled = Extract<AuthConfig, { state: 'enabled' }>['settings'];
const enc = new TextEncoder();

async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? enc.encode(key) : key;
  const k = await crypto.subtle.importKey('raw', new Uint8Array(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** The signing key for a pass: the secret plus every password that granted it. */
async function keyFor(s: Enabled, access: Access): Promise<Uint8Array> {
  const passwords = [s.sitePassword, ...[...access.uploadBrands].sort().map((b) => s.uploadPasswords[b])];
  return hmac(s.secret, passwords.join('\u0000'));
}

export async function createSession(s: Enabled, access: Access, now = Date.now()): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: [...access.uploadBrands].sort(), e: now + SESSION_DAYS * 86_400_000 })));
  return `${payload}.${b64url(await hmac(await keyFor(s, access), payload))}`;
}

export async function readSession(s: Enabled, value: string | undefined, now = Date.now()): Promise<Access | null> {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  let data: { u?: unknown; e?: unknown };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    return null;
  }
  const brands = Array.isArray(data.u) ? data.u.filter((b): b is BrandId => BRANDS.some((x) => x.id === b)) : null;
  if (!brands || brands.length !== (data.u as unknown[]).length || typeof data.e !== 'number' || data.e < now) return null;
  const access = { uploadBrands: brands };
  let given: Uint8Array;
  try {
    given = fromB64url(sig);
  } catch {
    return null;
  }
  return equalBytes(given, await hmac(await keyFor(s, access), payload)) ? access : null;
}

/** What a typed password unlocks: viewing, or viewing plus uploading for one brand. */
export async function accessForPassword(s: Enabled, input: string): Promise<Access | null> {
  // Compare keyed hashes so the comparison takes the same time whatever was typed.
  const typed = await hmac(s.secret, input);
  for (const b of BRANDS) {
    if (equalBytes(typed, await hmac(s.secret, s.uploadPasswords[b.id]))) return { uploadBrands: [b.id] };
  }
  if (equalBytes(typed, await hmac(s.secret, s.sitePassword))) return { uploadBrands: [] };
  return null;
}

/** Signing in again with another brand's password adds that brand. */
export function mergeAccess(a: Access | null, b: Access): Access {
  return { uploadBrands: [...new Set([...(a?.uploadBrands ?? []), ...b.uploadBrands])].sort() as BrandId[] };
}

/** Only allow redirects back into this site. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

/** Slows down password guessing: a few wrong tries, then a pause. Per server instance. */
export function rateLimiter(maxFailures = 8, windowMs = 10 * 60_000) {
  const failures = new Map<string, number[]>();
  const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((t) => now - t < windowMs);
  return {
    blocked: (key: string, now = Date.now()) => recent(key, now).length >= maxFailures,
    fail: (key: string, now = Date.now()) => void failures.set(key, [...recent(key, now), now]),
    clear: (key: string) => void failures.delete(key)
  };
}
