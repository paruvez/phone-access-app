import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { PermissionProvider } from './src/context/PermissionContext';
import { SyncProvider } from './src/context/SyncContext';
import { usePermissions } from './src/hooks/usePermissions';
import { PermissionManager } from './src/components/PermissionManager';
import { SupabaseProvider } from './src/context/SupabaseContext';

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const { hasAllPermissions, checkAllPermissions } = usePermissions();

  React.useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SupabaseProvider>
          <AuthProvider>
            <PermissionProvider>
              <SyncProvider>
                <NavigationContainer>
                  <View style={styles.container}>
                    <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
                    <AppNavigator />
                    {!hasAllPermissions && (
                      <PermissionManager
                        onAllGranted={() => {
                          // Permissions granted, app will re-render
                        }}
                      />
                    )}
                  </View>
                </NavigationContainer>
              </SyncProvider>
            </PermissionProvider>
          </AuthProvider>
        </SupabaseProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});