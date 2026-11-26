// Login + Signup on one screen with a toggle.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, ErrorText, Field } from '../components/ui';
import { colors, space } from '../theme';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  async function submit() {
    setError('');
    if (isSignup && password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    try {
      if (isSignup) await signup(email, password, name);
      else await login(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <View style={styles.inner}>
        <Text style={styles.logo}>ProfMatch</Text>
        <Text style={styles.sub}>Find the right professor before you register.</Text>
        {isSignup && <Field label="Display name" value={name} onChangeText={setName} placeholder="e.g. Spartan123" />}
        <Field label="School email" value={email} onChangeText={setEmail} placeholder="you@sjsu.edu"
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••"
          secureTextEntry autoComplete={isSignup ? 'new-password' : 'current-password'} />
        <ErrorText>{error}</ErrorText>
        <Button title={isSignup ? 'Create account' : 'Log in'} onPress={submit} loading={busy}
          disabled={!email || !password || (isSignup && !name)} testID="auth-submit" />
        <Pressable onPress={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }} style={{ marginTop: space(5) }}>
          <Text style={styles.switch}>
            {isSignup ? 'Already have an account? Log in' : "New here? Create an account"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  inner: { padding: space(6), width: '100%', maxWidth: 440, alignSelf: 'center' },
  logo: { fontSize: 36, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  sub: { color: colors.muted, textAlign: 'center', marginBottom: space(8), marginTop: space(2) },
  switch: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
