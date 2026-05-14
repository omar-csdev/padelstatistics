// TEMPORARY STUB. Owner: Agent B (auth). Replace on merge of B's PR.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
);
