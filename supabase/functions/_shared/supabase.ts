import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}
