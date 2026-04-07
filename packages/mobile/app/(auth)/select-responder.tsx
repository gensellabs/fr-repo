import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { login } from '../../store/auth';

export default function SelectResponder() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const pinRef = useRef<TextInput>(null);

  async function handleSignIn() {
    if (!username.trim()) { setError('Please enter your username'); return; }
    if (pin.length !== 4)  { setError('PIN must be exactly 4 digits'); return; }

    setLoading(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), pin);
      router.replace('/(tabs)/new-incident');
    } catch {
      setError('Invalid username or PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>FirstResponders</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Username */}
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. elszaf774"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              value={username}
              onChangeText={(t) => { setUsername(t); setError(''); }}
              onSubmitEditing={() => pinRef.current?.focus()}
              editable={!loading}
            />

            {/* PIN */}
            <Text style={[styles.label, { marginTop: 20 }]}>PIN  <Text style={styles.hint}>(last 4 digits of your mobile)</Text></Text>
            <TextInput
              ref={pinRef}
              style={[styles.input, styles.pinInput]}
              placeholder="••••"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              returnKeyType="go"
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/\D/g, '')); setError(''); }}
              onSubmitEditing={handleSignIn}
              editable={!loading}
            />

            {/* Error */}
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.btn, (loading || !username.trim() || pin.length !== 4) && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading || !username.trim() || pin.length !== 4}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Help */}
          <Text style={styles.helpText}>
            Your username and PIN were provided by your group administrator.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#dc2626' },
  scroll:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header:     { alignItems: 'center', marginBottom: 36 },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle:   { fontSize: 16, color: '#fca5a5', marginTop: 8 },
  card:       {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 28, shadowColor: '#000',
    shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  label:      { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  hint:       { fontSize: 12, fontWeight: '400', color: '#9ca3af' },
  input:      {
    borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#111827', backgroundColor: '#f9fafb',
  },
  pinInput:   { letterSpacing: 8, fontSize: 20, textAlign: 'center' },
  errorText:  { color: '#dc2626', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn:        {
    marginTop: 28, backgroundColor: '#dc2626', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  helpText:   { color: '#fecaca', fontSize: 13, textAlign: 'center', marginTop: 24, paddingHorizontal: 8 },
});
