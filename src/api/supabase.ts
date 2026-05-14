// TEMPORARY STUB. Owner: Agent B.
// This file exists so phase2-sync's typecheck passes in isolation.
// Agent B will overwrite it on merge with the real client wiring (storage,
// auth persistence, etc.).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
);
