// The store the site reads from. For now a local folder: BAU_DATA_DIR, or web/.data
// (where `npm run publish-workbook` writes). Step 6 switches this to Vercel Blob.

import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import type { Store } from '../dataset/store';
import { folderStore } from './folder-store';

export function getStore(): Store {
  return folderStore(resolve(env.BAU_DATA_DIR || '.data'));
}
