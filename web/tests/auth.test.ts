// Shared-password sign-in.

import { describe, expect, it } from 'vitest';
import { accessForPassword, authConfig, createSession, mergeAccess, rateLimiter, readSession, safeNext, settingsFromEnv } from '../src/lib/server/auth';

const ENV = {
  SITE_PASSWORD: 'river ledger monsoon',
  UPLOAD_PASSWORD_GLOBAL: 'global orange tower',
  UPLOAD_PASSWORD_IM: 'pine research desk',
  UPLOAD_PASSWORD_WEALTH: 'indigo wealth partner',
  AUTH_SECRET: 'x'.repeat(48)
};
const enabled = (env: Record<string, string> = ENV) => {
  const c = authConfig(settingsFromEnv(env), false);
  if (c.state !== 'enabled') throw new Error(`expected enabled, got ${JSON.stringify(c)}`);
  return c.settings;
};

describe('settings', () => {
  it('turns sign-in off only while developing with no passwords at all', () => {
    expect(authConfig(settingsFromEnv({}), true).state).toBe('disabled');
    expect(authConfig(settingsFromEnv({}), false)).toMatchObject({ state: 'misconfigured' });
  });

  it('locks the site when anything is missing, short or repeated', () => {
    const { UPLOAD_PASSWORD_IM: _, ...noIm } = ENV;
    expect(authConfig(settingsFromEnv(noIm), true)).toMatchObject({ state: 'misconfigured', message: expect.stringContaining('UPLOAD_PASSWORD_IM') });
    expect(authConfig(settingsFromEnv({ ...ENV, SITE_PASSWORD: 'short' }), false)).toMatchObject({ message: expect.stringContaining('12 characters') });
    expect(authConfig(settingsFromEnv({ ...ENV, UPLOAD_PASSWORD_IM: ENV.SITE_PASSWORD }), false)).toMatchObject({ message: expect.stringContaining('different') });
    expect(authConfig(settingsFromEnv({ ...ENV, AUTH_SECRET: 'too short' }), false)).toMatchObject({ message: expect.stringContaining('AUTH_SECRET') });
    expect(authConfig(settingsFromEnv(ENV), false).state).toBe('enabled');
  });
});

describe('passwords', () => {
  it('the team password views; a brand password also uploads for that brand only', async () => {
    const s = enabled();
    expect(await accessForPassword(s, ENV.SITE_PASSWORD)).toEqual({ uploadBrands: [] });
    expect(await accessForPassword(s, ENV.UPLOAD_PASSWORD_IM)).toEqual({ uploadBrands: ['im'] });
    expect(await accessForPassword(s, 'wrong password!')).toBeNull();
  });

  it('signing in with a second brand password adds that brand', () => {
    expect(mergeAccess({ uploadBrands: ['im'] }, { uploadBrands: ['wealth'] })).toEqual({ uploadBrands: ['im', 'wealth'] });
    expect(mergeAccess(null, { uploadBrands: [] })).toEqual({ uploadBrands: [] });
  });
});

describe('sessions', () => {
  it('round-trips, and expires', async () => {
    const s = enabled();
    const now = Date.parse('2026-10-14T09:00:00Z');
    const cookie = await createSession(s, { uploadBrands: ['wealth'] }, now);
    expect(await readSession(s, cookie, now)).toEqual({ uploadBrands: ['wealth'] });
    expect(await readSession(s, cookie, now + 31 * 86_400_000)).toBeNull();
  });

  it('cannot be edited to add a brand', async () => {
    const s = enabled();
    const cookie = await createSession(s, { uploadBrands: [] });
    const [, sig] = cookie.split('.');
    const forged = btoa(JSON.stringify({ u: ['im'], e: Date.now() + 86_400_000 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await readSession(s, `${forged}.${sig}`)).toBeNull();
    expect(await readSession(s, 'garbage')).toBeNull();
    expect(await readSession(s, 'a.b.c')).toBeNull();
  });

  it('changing a password signs out whoever used it, and only them', async () => {
    const before = enabled();
    const imCookie = await createSession(before, { uploadBrands: ['im'] });
    const wealthCookie = await createSession(before, { uploadBrands: ['wealth'] });
    const after = enabled({ ...ENV, UPLOAD_PASSWORD_IM: 'a brand new im phrase' });
    expect(await readSession(after, imCookie)).toBeNull();
    expect(await readSession(after, wealthCookie)).toEqual({ uploadBrands: ['wealth'] });
    expect(await readSession(enabled({ ...ENV, AUTH_SECRET: 'y'.repeat(48) }), wealthCookie)).toBeNull();
  });
});

describe('safety', () => {
  it('only redirects within the site', () => {
    expect(safeNext('/upload?brand=im')).toBe('/upload?brand=im');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });

  it('pauses after repeated wrong passwords', () => {
    const limit = rateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) limit.fail('1.2.3.4', 1000 + i);
    expect(limit.blocked('1.2.3.4', 2000)).toBe(true);
    expect(limit.blocked('5.6.7.8', 2000)).toBe(false);
    expect(limit.blocked('1.2.3.4', 70_000)).toBe(false);
  });
});
