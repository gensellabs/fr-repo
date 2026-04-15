import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index"  options={{ headerShown: false }} />
        <Stack.Screen
          name="incident/[id]"
          options={{
            headerShown: true,
            title: 'Incident Detail',
            headerStyle: { backgroundColor: '#dc2626' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
