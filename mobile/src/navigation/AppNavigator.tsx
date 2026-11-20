import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { MicrophoneScreen } from '../screens/MicrophoneScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { SMSScreen } from '../screens/SMSScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PermissionScreen } from '../screens/PermissionScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Auth Stack (Login)
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Permissions" component={PermissionScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Notes':
              iconName = focused ? 'document-text' : 'document-text-outline';
              break;
            case 'Camera':
              iconName = focused ? 'camera' : 'camera-outline';
              break;
            case 'Microphone':
              iconName = focused ? 'mic' : 'mic-outline';
              break;
            case 'Files':
              iconName = focused ? 'folder' : 'folder-outline';
              break;
            case 'SMS':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            default:
              iconName = 'help';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e8e8e8',
          height: 60,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Notes" component={NotesScreen} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="Microphone" component={MicrophoneScreen} />
      <Tab.Screen name="Files" component={FilesScreen} />
      <Tab.Screen name="SMS" component={SMSScreen} />
    </Tab.Navigator>
  );
}

// Main Stack with Drawer
function MainStack() {
  const { logout } = useAuth();

  return (
    <Drawer.Navigator
      initialRouteName="Main"
      screenOptions={{
        drawerActiveTintColor: '#1a1a2e',
        drawerInactiveTintColor: '#888',
        drawerStyle: { backgroundColor: '#fff' },
        drawerContentStyle: { flex: 1 },
      }}
      drawerContent={(props) => (
        <DrawerContent {...props} onLogout={logout} />
      )}
    >
      <Drawer.Screen name="Main" component={MainTabs} options={{ title: 'Phone Access' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  );
}

function DrawerContent({ navigation, onLogout }: any) {
  const { user, isAuthenticated } = useAuth();
  const { hasAllPermissions, missingPermissions } = usePermissions();

  return (
    <View style={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person-circle" size={60} color="#1a1a2e" />
        </View>
        <Text style={styles.drawerTitle}>Phone Access App</Text>
        <Text style={styles.drawerSubtitle}>{user?.email || 'Anonymous'}</Text>
      </View>

      <View style={styles.drawerSection}>
        <DrawerItem
          label="Home"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Main')}
        />
        <DrawerItem
          label="Notes"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Notes')}
        />
        <DrawerItem
          label="Camera"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'camera' : 'camera-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Camera')}
        />
        <DrawerItem
          label="Microphone"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'mic' : 'mic-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Microphone')}
        />
        <DrawerItem
          label="Files"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'folder' : 'folder-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Files')}
        />
        <DrawerItem
          label="SMS"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('SMS')}
        />
      </View>

      <View style={styles.drawerSection}>
        <DrawerItem
          label="Settings"
          icon={({ focused, color, size }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />}
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      {!hasAllPermissions && (
        <View style={styles.permissionBanner}>
          <Ionicons name="alert-circle" size={20} color="#ffc107" />
          <Text style={styles.permissionBannerText}>
            {missingPermissions.length} permissions needed
          </Text>
        </View>
      )}

      <View style={styles.drawerFooter}>
        <DrawerItem
          label="Logout"
          icon={({ color, size }) => <Ionicons name="log-out" size={size} color={color} />}
          onPress={onLogout}
          labelStyle={{ color: '#dc3545' }}
        />
      </View>
    </View>
  );
}

// Main App Navigator
export function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainStack} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Ionicons name="phone-portrait" size={80} color="#1a1a2e" />
      <Text style={styles.loadingText}>Phone Access App</Text>
    </View>
  );
}

import { View, Text, StyleSheet, DrawerItem } from 'react-native';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawerHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  drawerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  drawerSection: {
    paddingVertical: 8,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  permissionBannerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
  },
  drawerFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
});