import { beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env }));

const auth = await import('../src/lib/server/auth');

function setEnv(values: Record<string, string | undefined>) {
  for (const k of Object.keys(env)) delete env[k];
  Object.assign(env, values);
}

const GOOD = { SITE_PASSWORD: 'view-pass', UPLOAD_PASSWORD: 'upload-pass', AUTH_SECRET: 'x'.repeat(40) };

describe('auth config', () => {
  it('is off locally with no passwords', () => {
    setEnv({});
    expect(auth.authConfig()).toEqual({ state: 'disabled' });
  });
  it('fails closed on Vercel without passwords', () => {
    setEnv({ VERCEL: '1' });
    expect(auth.authConfig().state).toBe('misconfigured');
  });
  it('fails closed with a partial or weak setup', () => {
    setEnv({ SITE_PASSWORD: 'a' });
    expect(auth.authConfig().state).toBe('misconfigured');
    setEnv({ ...GOOD, UPLOAD_PASSWORD: 'view-pass' });
    expect(auth.authConfig().state).toBe('misconfigured');
    setEnv({ ...GOOD, AUTH_SECRET: 'short' });
    expect(auth.authConfig().state).toBe('misconfigured');
  });
});

describe('sessions', () => {
  beforeEach(() => setEnv(GOOD));

  it('maps passwords to roles', () => {
    expect(auth.roleForPassword('view-pass')).toBe('viewer');
    expect(auth.roleForPassword('upload-pass')).toBe('editor');
    expect(auth.roleForPassword('nope')).toBeNull();
  });

  it('round-trips a signed session and rejects tampering', () => {
    const viewer = auth.createSession('viewer');
    expect(auth.readSession(viewer)).toBe('viewer');
    expect(auth.readSession(viewer.replace(/^viewer/, 'editor'))).toBeNull();
    expect(auth.readSession(viewer.slice(0, -2) + 'AA')).toBeNull();
    expect(auth.readSession('garbage')).toBeNull();
    expect(auth.readSession(undefined)).toBeNull();
  });

  it('expires sessions', () => {
    const s = auth.createSession('editor', Date.now() - 31 * 24 * 3600 * 1000);
    expect(auth.readSession(s)).toBeNull();
  });

  it('signs everyone out when a password changes', () => {
    const s = auth.createSession('editor');
    setEnv({ ...GOOD, UPLOAD_PASSWORD: 'new-upload-pass' });
    expect(auth.readSession(s)).toBeNull();
  });

  it('only redirects within the site', () => {
    expect(auth.safeNext('/data')).toBe('/data');
    expect(auth.safeNext('//evil.com')).toBe('/');
    expect(auth.safeNext('https://evil.com')).toBe('/');
    expect(auth.safeNext('/\\evil.com')).toBe('/');
    expect(auth.safeNext(null)).toBe('/');
  });
});
