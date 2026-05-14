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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
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
                  try {
                    setBusy(true);
                    await signInWithEmail(email.trim());
                    setSent(true);
                  } catch (e: any) {
                    Alert.alert('Sign-in failed', e?.message ?? 'Unknown error');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}

          {Platform.OS === 'ios' ? (
            <Button
              variant="ghost"
              label="CONTINUE WITH APPLE"
              onPress={async () => {
                try {
                  await signInWithApple();
                } catch (e: any) {
                  Alert.alert('Apple sign-in failed', e?.message ?? 'Unknown error');
                }
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
  sub: { color: colors.ink3, fontFamily: fonts.regular, fontSize: 13, marginBottom: 24 },
  input: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 16,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  notice: { color: colors.accent, fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.6 },
});
