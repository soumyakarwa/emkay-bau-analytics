// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Access } from '$lib/server/auth';

declare global {
  namespace App {
    interface Locals {
      /** False only while developing without passwords: then everyone may do everything. */
      authEnabled: boolean;
      /** Who is signed in, or null. */
      access: Access | null;
    }
  }
}

export {};
