// Where uploads are kept. The site only needs three operations, so moving from the local
// folder used now to Vercel Blob later (step 6) means writing one more implementation of this.

export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  /** Every key that starts with `prefix`. */
  list(prefix: string): Promise<string[]>;
}

/** Keeps everything in memory. Used by the tests. */
export function memoryStore(): Store {
  const data = new Map<string, string>();
  return {
    get: async (key) => data.get(key) ?? null,
    put: async (key, value) => void data.set(key, value),
    list: async (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix))
  };
}
