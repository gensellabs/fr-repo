import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Admin() {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.center}>
        <Text style={styles.icon}>⚙️</Text>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.subtitle}>Group administration features coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#f9fafb' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon:     { fontSize: 48, marginBottom: 16 },
  title:    { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
});
