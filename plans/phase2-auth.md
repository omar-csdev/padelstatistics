# Agent B · Auth (supabase-js client + AuthProvider + sign-in + _layout)

You own everything that gets a user signed in and held in a session. You also own the root layout `app/_layout.tsx` because that's where the auth gate and the sync wrapper compose. **You do not touch backend, sync, or AI-UI files.**

## Slice of the architecture you own

```
┌──────────────────────────────────────────┐
│  app/_layout.tsx  (you own)              │
│    <AuthProvider>                        │
│      session === null  → /(auth)/sign-in │
│      session !== null  →                 │
│        <SyncBoundary>                    │
│          <Stack />                       │
│        </SyncBoundary>                   │
│    </AuthProvider>                       │
└──────────┬───────────────────────────────┘
           │ uses
           ▼
  src/api/supabase.ts    (you own — supabase-js client)
  src/auth/AuthProvider  (you own — Context + state)
  src/auth/useAuth       (you own — hook for consumers)
  app/(auth)/sign-in     (you own — 3 buttons + email magic link)
```

## File ownership

| Type | Path | Action |
|------|------|--------|
| Owns | `src/api/supabase.ts` | Create |
| Owns | `src/auth/AuthProvider.tsx` | Create |
| Owns | `src/auth/useAuth.ts` | Create |
| Owns | `src/auth/index.ts` | Create (barrel re-export) |
| Owns | `app/(auth)/_layout.tsx` | Create |
| Owns | `app/(auth)/sign-in.tsx` | Create |
| Owns | `app/_layout.tsx` | **Rewrite** (currently does font load + Stack) |
| Owns | `.env.example` | Create |
| Owns | `package.json` | Add deps only (do not modify existing ones) |
| Reads | `src/theme/tokens.ts`, `src/components/Button.tsx`, `src/components/ScreenHeader.tsx` | Reuse for sign-in UI |
| Do not touch | `supabase/**`, `src/sync/**`, `src/store/**`, `src/hooks/**`, `src/components/AISummaryView.tsx`, `app/setup.tsx`, `app/index.tsx`, `app/match/**` | Agents A / C / D own these |

## Branch

Create `phase2-auth` from `padel-mvp`. PR back into `padel-mvp` when done.

## Dependencies to install

```
npm i @supabase/supabase-js@^2 expo-secure-store@~14 expo-auth-session@~7 expo-apple-authentication@~8 expo-web-browser
```

(`expo-web-browser` is already in `package.json`; add only missing ones. Use `npx expo install` for the `expo-*` deps so versions align with SDK 54.)

## Contracts you expose

Other agents (C and D) import these. Do not rename or change signatures.

```ts
// src/api/supabase.ts
import type { SupabaseClient } from '@supabase/supabase-js';
export const supabase: SupabaseClient;
```

```ts
// src/auth/useAuth.ts
import type { Session } from '@supabase/supabase-js';
export function useAuth(): {
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

## Contracts you consume

**`src/sync/SyncBoundary.tsx`** (owner: Agent C). You mount it in `_layout.tsx` between the auth gate and the `<Stack>`.

```tsx
import type { ReactNode } from 'react';
export function SyncBoundary({ children }: { children: ReactNode }): JSX.Element;
```

**Stub-if-missing.** If `src/sync/SyncBoundary.tsx` does not exist on your branch, create the file with this exact content so your build typechecks. Agent C will overwrite it on merge:

```tsx
// src/sync/SyncBoundary.tsx — TEMPORARY STUB. Owner: Agent C.
// Will be overwritten by phase2-sync. Do not add logic here.
import type { ReactNode } from 'react';
export function SyncBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

## Step 1 — Env vars

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Add `.env` to `.gitignore` if not already (Phase 1 didn't touch this; check).

## Step 2 — Supabase client

`src/api/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  // Surface a clear error in dev rather than a cryptic network failure later.
  console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing. Set them in .env.');
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
);
```

You may need to install `react-native-url-polyfill` — `npm i react-native-url-polyfill`.

## Step 3 — AuthProvider

`src/auth/AuthProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/api/supabase';

interface Ctx {
  session: Session | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: Ctx = useMemo(() => ({
    session,
    signInWithEmail: async (email) => {
      const redirectTo = makeRedirectUri({ scheme: 'padelstatistics' });
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
    },
    signInWithApple: async () => {
      if (Platform.OS !== 'ios') throw new Error('Apple sign-in is iOS only');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No Apple identity token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      // Magic-link fallback works on all platforms during dev. Replace with
      // expo-auth-session's Google flow once you have OAuth client IDs.
      throw new Error('Google sign-in not configured yet; use email magic link.');
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthCtx() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth() called outside <AuthProvider>');
  return v;
}
```

## Step 4 — useAuth hook

`src/auth/useAuth.ts`:

```ts
import { useAuthCtx } from './AuthProvider';
export const useAuth = useAuthCtx;
```

`src/auth/index.ts`:

```ts
export { AuthProvider } from './AuthProvider';
export { useAuth } from './useAuth';
```

## Step 5 — Sign-in screen

`app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`app/(auth)/sign-in.tsx` — magic-link primary, Apple/Google secondary. Use the navy theme tokens from `src/theme/tokens.ts` and the Button primitive from `src/components/Button.tsx`. Sketch:

```tsx
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/Button';
import { useAuth } from '@/src/auth';
import { colors, fonts } from '@/src/theme/tokens';

export default function SignIn() {
  const { signInWithEmail, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.body}>
          <Text style={styles.title}>PADEL STATISTICS</Text>
          <Text style={styles.sub}>Sign in to sync matches across your devices.</Text>

          {sent ? (
            <Text style={styles.notice}>Check your inbox for the magic link.</Text>
          ) : (
            <>
              <TextInput
                placeholder="email@example.com"
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
              <Button
                variant="primary"
                label={busy ? 'SENDING…' : 'EMAIL MAGIC LINK'}
                disabled={busy || !email.includes('@')}
                onPress={async () => {
                  try { setBusy(true); await signInWithEmail(email.trim()); setSent(true); }
                  catch (e: any) { Alert.alert('Sign-in failed', e?.message ?? 'Unknown error'); }
                  finally { setBusy(false); }
                }}
              />
            </>
          )}

          {Platform.OS === 'ios' ? (
            <Button
              variant="ghost"
              label="CONTINUE WITH APPLE"
              onPress={async () => {
                try { await signInWithApple(); }
                catch (e: any) { Alert.alert('Apple sign-in failed', e?.message ?? 'Unknown error'); }
              }}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { color: colors.ink, fontFamily: fonts.black, fontSize: 22, letterSpacing: 1.4, marginBottom: 4 },
  sub:   { color: colors.ink3, fontFamily: fonts.regular, fontSize: 13, marginBottom: 24 },
  input: {
    color: colors.ink, fontFamily: fonts.bold, fontSize: 16,
    backgroundColor: colors.surface, borderColor: colors.borderSoft, borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10,
  },
  notice: { color: colors.accent, fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.6 },
});
```

## Step 6 — `_layout.tsx` rewrite

`app/_layout.tsx` — wrap routes in `<AuthProvider>`, gate on session, mount `<SyncBoundary>`. The current file already loads fonts (Archivo + IBM Plex Mono) and sets up a `GestureHandlerRootView` + `Stack`. Preserve all of that. Final shape:

```tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import {
  Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold,
  Archivo_700Bold, Archivo_800ExtraBold, Archivo_900Black, useFonts,
} from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { AuthProvider, useAuth } from '@/src/auth';
import { SyncBoundary } from '@/src/sync/SyncBoundary';
import { colors } from '@/src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold,
    Archivo_700Bold, Archivo_800ExtraBold, Archivo_900Black,
    IBMPlexMono_500Medium, IBMPlexMono_700Bold,
  });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { session } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (session === null && !inAuthGroup) {
      router.replace('/(auth)/sign-in' as never);
    } else if (session && inAuthGroup) {
      router.replace('/' as never);
    }
  }, [session, inAuthGroup, router]);

  return (
    <SyncBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </SyncBoundary>
  );
}
```

## Step 7 — `app.json` scheme

The current `app.json` already sets `"scheme": "padelstatistics"` — verify it's there. The magic-link redirect uses this scheme.

## Out of scope

- Local SQLite changes — Agent C.
- The sync hook's internals — Agent C.
- AI report UI — Agent D.
- Backend / Edge Function — Agent A.

## Verification (solo)

1. `tsc --noEmit` clean. `npm run lint` clean.
2. With `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in `.env`:
   - `npx expo start` — cold open shows `/(auth)/sign-in`.
   - Enter email → tap magic link → app foregrounds back into `/` (History).
   - Reload app → still signed in (session persisted in SecureStore).
   - Add a temporary "Sign out" button somewhere accessible (or call `supabase.auth.signOut()` from the dev tools) → app returns to `/(auth)/sign-in`.
3. Apple sign-in only verifiable on a real iOS device with a paid Apple Developer account; if not available, skip without removing the button.

## Hand-off note

After this PR is merged:
- Agent C's `<SyncBoundary>` import path resolves to a real component (overwriting your stub). The gate still works.
- Agent D can `import { supabase } from '@/src/api/supabase'` to call the Edge Function.
- Anywhere in the app, `useAuth()` returns the live session.
