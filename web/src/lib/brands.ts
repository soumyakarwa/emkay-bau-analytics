// The three Emkay brands. A workbook belongs to a brand through the Brand cell on its
// Start here sheet (written by the template), never through its file name.

import { normalise } from './workbook/contract';

export const BRANDS = [
  { id: 'global', name: 'Emkay Global', short: 'Global' },
  { id: 'im', name: 'Emkay Investment Managers', short: 'IM' },
  { id: 'wealth', name: 'Emkay Wealth Management', short: 'Wealth' }
] as const;

export type Brand = (typeof BRANDS)[number];
export type BrandId = Brand['id'];

export function brandByName(name: string): Brand | undefined {
  return BRANDS.find((b) => normalise(b.name) === normalise(name));
}

export function brandById(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}
