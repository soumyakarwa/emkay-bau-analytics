// Tiny JSON key-value store. Vercel Blob (private) in production, a local
// folder in development. Nothing else in the app knows which one is in use.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '$env/dynamic/private';

export interface JsonStore {
  read<T>(key: string): Promise<T | null>;
  write(key: string, value: unknown): Promise<void>;
  readonly kind: 'blob' | 'local';
}

class LocalStore implements JsonStore {
  readonly kind = 'local';
  constructor(private root: string) {}
  async read<T>(key: string) {
    try {
      return JSON.parse(await readFile(join(this.root, key), 'utf8')) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async write(key: string, value: unknown) {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value, null, 2));
  }
}

class BlobStore implements JsonStore {
  readonly kind = 'blob';
  constructor(private token: string) {}
  async read<T>(key: string) {
    const { get } = await import('@vercel/blob');
    const result = await get(key, { access: 'private', useCache: false, token: this.token });
    if (!result) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  }
  async write(key: string, value: unknown) {
    const { put } = await import('@vercel/blob');
    await put(key, JSON.stringify(value), {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
      token: this.token
    });
  }
}

let store: JsonStore | null = null;

export function getStore(): JsonStore {
  if (store) return store;
  if (env.BLOB_READ_WRITE_TOKEN) {
    store = new BlobStore(env.BLOB_READ_WRITE_TOKEN);
  } else if (env.VERCEL) {
    // On Vercel the filesystem is read-only and temporary; refuse to pretend it works.
    throw new Error('No storage configured. Connect a Vercel Blob store to this project (Storage tab) and redeploy.');
  } else {
    store = new LocalStore(join(process.cwd(), '.data'));
  }
  return store;
}
