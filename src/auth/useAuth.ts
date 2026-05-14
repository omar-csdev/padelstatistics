// TEMPORARY STUB. Owner: Agent B.
// useSync only reads `session?.user?.id`, so the surface here is intentionally
// minimal. Agent B will overwrite this file with the real auth hook.
import type { Session } from '@supabase/supabase-js';

export interface AuthValue {
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthValue {
  return {
    session: null,
    signInWithEmail: async (_email: string) => {},
    signInWithApple: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
}
