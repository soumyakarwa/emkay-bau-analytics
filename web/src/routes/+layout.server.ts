import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
  authEnabled: locals.authEnabled,
  signedIn: !!locals.access,
  uploadBrands: locals.access?.uploadBrands ?? []
});
