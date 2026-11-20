import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useSync } from '../context/SyncContext';
import { useSupabase } from '../context/SupabaseContext';
import { formatBytes } from '@phone-access/shared';
import { API_BASE_URL, SUPABASE_URL } from '@env';

export function SettingsScreen({ navigation }: any) {
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const { permissions, hasAllPermissions, missingPermissions, checkAllPermissions, requestAllPermissions, openSettings } = usePermissions();
  const { isOnline, lastSync, triggerSync, syncing } = useSync();
  const { supabase } = useSupabase();

  const [appVersion, setAppVersion] = useState('1.0.0');
  const [cacheSize, setCacheSize] = useState('0 MB');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(true);
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
    checkAllPermissions();
  }, [checkAllPermissions]);

  const loadSettings = async () => {
    try {
      // Load from AsyncStorage
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const [notifications, backgroundSync, autoUpload, version] = await Promise.all([
        AsyncStorage.getItem('notifications_enabled'),
        AsyncStorage.getItem('background_sync_enabled'),
        AsyncStorage.getItem('auto_upload_enabled'),
        AsyncStorage.getItem('app_version'),
      ]);

      setNotificationsEnabled(notifications !== 'false');
      setBackgroundSyncEnabled(backgroundSync !== 'false');
      setAutoUploadEnabled(autoUpload !== 'false');
      if (version) setAppVersion(version);
    } catch (error) {
      console.error('Load settings error:', error);
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(key, value.toString());
    } catch (error) {
      console.error('Save setting error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will remove temporary files. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try {
          const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
          await AsyncStorage.clear();
          setCacheSize('0 MB');
          Alert.alert('Success', 'Cache cleared');
        } catch (error) {
          Alert.alert('Error', 'Failed to clear cache');
        }
      }},
    ]);
  };

  const handleSyncNow = async () => {
    await triggerSync();
  };

  const openDiscordSettings = () => {
    Linking.openURL('https://discord.com/developers/applications');
  };

  const openSupabaseDashboard = () => {
    Linking.openURL(SUPABASE_URL.replace('.supabase.co', '.supabase.co/dashboard'));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Account Section */}
      {isAuthenticated && (
        <Section title="Account">
          <SettingItem
            icon="person-circle"
            title="Profile"
            subtitle={user?.email || 'Anonymous'}
            onPress={() => {}}
          />
          <SettingItem
            icon="log-out"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            destructive
          />
        </Section>
      )}

      {/* Sync Section */}
      <Section title="Sync & Connection">
        <SettingItem
          icon={isOnline ? 'wifi' : 'wifi-off'}
          title="Connection Status"
          subtitle={isOnline ? 'Connected' : 'Offline'}
          rightElement={
            <View style={[
              styles.statusIndicator,
              isOnline ? styles.statusOnline : styles.statusOffline,
            ]} />
          }
        />
        <SettingItem
          icon="sync"
          title="Last Sync"
          subtitle={lastSync ? lastSync.toLocaleString() : 'Never'}
          onPress={handleSyncNow}
          rightElement={
            syncing ? (
              <ActivityIndicator size="small" color="#1a1a2e" />
            ) : (
              <TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}>
                <Text style={styles.syncButtonText}>Sync Now</Text>
              </TouchableOpacity>
            )
          }
        />
        <SettingToggle
          icon="cloud-sync"
          title="Background Sync"
          subtitle="Automatically sync data in background"
          value={backgroundSyncEnabled}
          onValueChange={(value) => {
            setBackgroundSyncEnabled(value);
            saveSetting('background_sync_enabled', value);
          }}
        />
        <SettingToggle
          icon="cloud-upload"
          title="Auto Upload"
          subtitle="Automatically upload camera/mic recordings"
          value={autoUploadEnabled}
          onValueChange={(value) => {
            setAutoUploadEnabled(value);
            saveSetting('auto_upload_enabled', value);
          }}
        />
      </Section>

      {/* Notifications Section */}
      <Section title="Notifications">
        <SettingToggle
          icon="notifications"
          title="Push Notifications"
          subtitle="Receive notifications from Discord bot"
          value={notificationsEnabled}
          onValueChange={(value) => {
            setNotificationsEnabled(value);
            saveSetting('notifications_enabled', value);
          }}
        />
      </Section>

      {/* Permissions Section */}
      <Section title="Permissions">
        <SettingItem
          icon={hasAllPermissions ? 'shield-checkmark' : 'shield-half'}
          title="App Permissions"
          subtitle={hasAllPermissions
            ? 'All permissions granted'
            : `${missingPermissions.length} permissions needed`}
          onPress={() => navigation.navigate('Permissions')}
          rightElement={
            hasAllPermissions ? (
              <View style={styles.permissionGranted}>
                <Ionicons name="checkmark" size={18} color="#28a745" />
              </View>
            ) : (
              <TouchableOpacity style={styles.permissionButton} onPress={requestAllPermissions}>
                <Text style={styles.permissionButtonText}>Grant All</Text>
              </TouchableOpacity>
            )
          }
        />
        {missingPermissions.map((perm) => (
          <SettingItem
            key={perm}
            icon="shield"
            title={perm.charAt(0).toUpperCase() + perm.slice(1)}
            subtitle={permissions[perm] ? 'Granted' : 'Not granted'}
            rightElement={
              permissions[perm] ? (
                <View style={styles.permissionGranted}>
                  <Ionicons name="checkmark" size={18} color="#28a745" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={() => {}}
                >
                  <Text style={styles.permissionButtonText}>Grant</Text>
                </TouchableOpacity>
              )
            }
          />
        ))}
      </Section>

      {/* Storage Section */}
      <Section title="Storage">
        <SettingItem
          icon="folder"
          title="Cache Size"
          subtitle={cacheSize}
          onPress={handleClearCache}
          rightElement={
            <TouchableOpacity style={styles.clearButton} onPress={handleClearCache}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          }
        />
        <SettingItem
          icon="trash"
          title="Clear All Data"
          subtitle="Remove all local data (notes, files, settings)"
          onPress={() => Alert.alert('Clear Data', 'This will delete all local data. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete Everything', style: 'destructive', onPress: async () => {
              try {
                const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
                await AsyncStorage.clear();
                Alert.alert('Success', 'All data cleared. App will restart.');
              } catch (error) {
                Alert.alert('Error', 'Failed to clear data');
              }
            }},
          ])}
          destructive
        />
      </Section>

      {/* Developer Section */}
      <Section title="Developer">
        <SettingItem
          icon="logo-discord"
          title="Discord Developer Portal"
          subtitle="Manage your Discord bot"
          onPress={openDiscordSettings}
        />
        <SettingItem
          icon="server"
          title="Supabase Dashboard"
          subtitle="Manage database and storage"
          onPress={openSupabaseDashboard}
        />
        <SettingItem
          icon="code"
          title="API Base URL"
          subtitle={API_BASE_URL || 'Not configured'}
        />
        <SettingItem
          icon="database"
          title="Supabase URL"
          subtitle={SUPABASE_URL || 'Not configured'}
        />
        <SettingItem
          icon="information-circle"
          title="App Version"
          subtitle={appVersion}
        />
        <SettingItem
          icon="bug"
          title="Report Bug"
          subtitle="Open GitHub Issues"
          onPress={() => Linking.openURL('https://github.com/your-repo/issues')}
        />
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <SettingItem
          icon="trash"
          title="Reset App"
          subtitle="Clear all data and logout"
          onPress={() => Alert.alert('Reset App', 'This will clear all data and log you out. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: async () => {
              try {
                const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
                await AsyncStorage.clear();
                await logout();
                Alert.alert('Success', 'App reset complete');
              } catch (error) {
                Alert.alert('Error', 'Failed to reset app');
              }
            }},
          ])}
          destructive
        />
      </Section>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  destructive,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconContainer, destructive && styles.iconDestructive]}>
        <Ionicons name={icon} size={24} color={destructive ? '#dc3545' : '#1a1a2e'} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, destructive && styles.titleDestructive]}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      {rightElement}
    </TouchableOpacity>
  );
}

function SettingToggle({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color="#1a1a2e" />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? '#fff' : '#f0f0f0'}
        trackColor={{ false: '#e0e0e0', true: '#1a1a2e' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 10,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    padding: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    paddingHorizontal: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconDestructive: {
    backgroundColor: '#fff0f0',
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  titleDestructive: {
    color: '#dc3545',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOnline: {
    backgroundColor: '#28a745',
  },
  statusOffline: {
    backgroundColor: '#dc3545',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  permissionGranted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d4edda',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
  },
  bottomSpacer: {
    height: 40,
  },
});