<<<<<<< phase2-sync
// TEMPORARY STUB. Owner: Agent B.
// This file exists so phase2-sync's typecheck passes in isolation.
// Agent B will overwrite it on merge with the real client wiring (storage,
// auth persistence, etc.).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
=======
// TEMPORARY STUB. Owner: Agent B (auth). Replace on merge of B's PR.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder');
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing. Set them in .env.',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anon ?? 'placeholder',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
>>>>>>> padel-mvp
);
