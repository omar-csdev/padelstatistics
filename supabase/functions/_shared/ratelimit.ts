import { admin } from './supabase.ts';

const FREE_TIER_LIMIT = 3;

export async function checkAndRecord(userId: string, kind: 'ai_summary') {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from('usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('ts', monthStart.toISOString());
  if (error) throw error;
  const used = count ?? 0;
  if (used >= FREE_TIER_LIMIT) {
    const next = new Date(monthStart);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { allowed: false as const, used, limit: FREE_TIER_LIMIT, resets_at: next.toISOString() };
  }
  return { allowed: true as const, used, limit: FREE_TIER_LIMIT };
}

export async function recordUsage(userId: string, kind: 'ai_summary') {
  const { error } = await admin.from('usage_log').insert({ user_id: userId, kind });
  if (error) throw error;
}
