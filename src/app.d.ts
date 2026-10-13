// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Role } from '$lib/server/auth';

declare global {
  namespace App {
    interface Locals {
      role: Role | null;
      authEnabled: boolean;
    }
  }
}
export {};
