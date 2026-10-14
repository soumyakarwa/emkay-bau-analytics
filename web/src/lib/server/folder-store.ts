// Keeps uploads as files in a local folder (web/.data by default, which Git ignores).

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { Store } from '../dataset/store';

export function folderStore(root: string): Store {
  const path = (key: string) => join(root, ...key.split('/'));
  async function walk(dir: string): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walk(full)));
      else out.push(relative(root, full).split(sep).join('/'));
    }
    return out;
  }
  return {
    async get(key) {
      try {
        return await readFile(path(key), 'utf8');
      } catch {
        return null;
      }
    },
    async put(key, value) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), value, 'utf8');
    },
    async list(prefix) {
      return (await walk(root)).filter((k) => k.startsWith(prefix));
    }
  };
}
