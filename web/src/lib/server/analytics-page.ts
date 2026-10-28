// What every analytics page's loader starts with: the brand in the address, if any.

import { brandById, type BrandId } from '../brands';

export function brandParam(url: URL): BrandId | null {
  return (brandById(url.searchParams.get('brand') ?? '')?.id ?? null) as BrandId | null;
}
