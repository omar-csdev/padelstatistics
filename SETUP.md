# Supabase setup (one-time)

1. Create a project at https://supabase.com/dashboard.
2. Copy URL + anon key. Add to `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. `npx supabase link --project-ref <ref>`
4. `npx supabase db push`  (applies migrations)
5. Set Edge Function secrets in dashboard → Functions → Secrets:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`                (auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY`   (auto-set)
6. `npx supabase functions deploy generate-ai-summary`
7. (Auth) Dashboard → Authentication → Providers: enable Email, Apple, Google as desired.
   Add the Expo redirect URL (printed by `npx expo start`) to allowed redirect URLs.

## Local dev

- `npx supabase start` — boot local Postgres + Studio.
- `npx supabase db push` — apply migrations to the local DB.
- `npx supabase functions serve generate-ai-summary --env-file .env.local` — run the Edge Function locally. `.env.local` must contain `ANTHROPIC_API_KEY` (and the auto-set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected by the CLI).

## Smoke test

With a real `ANTHROPIC_API_KEY` in `.env.local`:

1. Insert a row in `matches` with your `auth.uid()` as `user_id`, plus a few `events` rows.
2. Call the function:
   ```
   curl -X POST http://127.0.0.1:54321/functions/v1/generate-ai-summary \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{"matchId":"<uuid>"}'
   ```
3. Expect `{ ok: true, cached: false, payload: { summary, tactics, players, patterns } }`.
4. Second call → `{ cached: true }`.
5. Burn 3 calls → 4th returns 429 `rate_limit`.
