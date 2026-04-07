import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getStoredSession } from '../../store/auth';
import { useSync } from '../../hooks/useSync';

export default function TabsLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { isOnline } = useSync();

  useEffect(() => {
    getStoredSession().then((s) => setIsAdmin(s?.isAdmin ?? false));
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#dc2626',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { borderTopWidth: 1, borderTopColor: '#e5e7eb' },
        headerStyle: { backgroundColor: '#dc2626' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <View style={{ marginRight: 16, width: 10, height: 10, borderRadius: 5,
            backgroundColor: isOnline ? '#22c55e' : '#ef4444' }} />
        ),
      }}
    >
      <Tabs.Screen
        name="new-incident"
        options={{
          title: 'New Incident',
          tabBarLabel: 'New Incident',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🚨</Text>,
          headerTitle: 'New Incident',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>📋</Text>,
          headerTitle: 'Incident History',
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            tabBarLabel: 'Admin',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⚙️</Text>,
            headerTitle: 'Admin',
          }}
        />
      )}
    </Tabs>
  );
}
