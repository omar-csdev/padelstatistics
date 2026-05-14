import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
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
