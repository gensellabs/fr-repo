import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { COLOUR_CODE_STYLES } from '@firstresponders/shared';

interface IncidentSummary {
  id: number;
  incidentDate: string;
  callType: { value: string } | null;
  location: { value: string; area?: { value: string } } | null;
  patientCount: number;
  patients: Array<{ colourCode: string | null }>;
  responders: Array<{ responder: { value: string } }>;
}

export default function History() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.getIncidents({ limit: '50', offset: '0' }) as { total: number; items: IncidentSummary[] };
      setTotal(data.total);
      setIncidents(data.items);
    } catch {
      // offline — show empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.count}>{total} incidents total</Text>
      <FlatList
        data={incidents}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#dc2626" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const worstCode = item.patients.reduce<string | null>((worst, p) => {
            const order = ['Green', 'Yellow', 'Orange', 'Red', 'Blue'];
            const idx = p.colourCode ? order.indexOf(p.colourCode) : -1;
            const wIdx = worst ? order.indexOf(worst) : -1;
            return idx > wIdx ? p.colourCode : worst;
          }, null);
          const codeStyle = worstCode ? COLOUR_CODE_STYLES[worstCode as keyof typeof COLOUR_CODE_STYLES] : null;

          return (
            <View style={styles.card}>
              {codeStyle && <View style={[styles.codeBar, { backgroundColor: codeStyle.bg }]} />}
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.callType}>{item.callType?.value ?? 'Unknown Call'}</Text>
                  <Text style={styles.date}>{new Date(item.incidentDate).toLocaleDateString('en-ZA')}</Text>
                </View>
                <Text style={styles.location}>
                  {[item.location?.area?.value, item.location?.value].filter(Boolean).join(' › ') || 'Location unknown'}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.meta}>👤 {item.patientCount} patient{item.patientCount > 1 ? 's' : ''}</Text>
                  <Text style={styles.meta}>🕐 {new Date(item.incidentDate).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                  <Text style={styles.meta}>👥 {item.responders.map((r) => r.responder.value).join(', ')}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No incidents recorded yet.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  count: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  codeBar: { width: 6 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  callType: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  date: { fontSize: 13, color: '#6b7280' },
  location: { fontSize: 14, color: '#374151', marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#6b7280' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, fontSize: 16 },
});
