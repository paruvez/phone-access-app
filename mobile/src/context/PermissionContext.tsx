import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import * as Permissions from 'react-native-permissions';
import { PermissionKey, REQUIRED_PERMISSIONS } from '@phone-access/shared';

interface PermissionState {
  [key: string]: boolean;
}

interface PermissionContextType {
  permissions: PermissionState;
  hasAllPermissions: boolean;
  missingPermissions: PermissionKey[];
  checkAllPermissions: () => Promise<void>;
  requestAllPermissions: () => Promise<void>;
  requestPermission: (key: PermissionKey) => Promise<void>;
  openSettings: () => Promise<void>;
  isRequesting: boolean;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

// Map our permission keys to react-native-permissions types
const permissionMap: Record<PermissionKey, Permissions.Permission> = {
  camera: 'camera',
  microphone: 'microphone',
  storage: Platform.OS === 'ios' ? 'photos' : 'storage',
  files: Platform.OS === 'ios' ? 'photos' : 'storage',
  sms: 'sms',
  connectivity: 'bluetooth', // Not a real permission, handled separately
  photos: 'photos',
  sensors: 'motion',
  location: 'location',
};

// iOS-specific permission names for display
const iosPermissionNames: Record<PermissionKey, string> = {
  camera: '相机',
  microphone: '麦克风',
  storage: '文件存储',
  files: '文件访问',
  sms: '信息',
  connectivity: '蓝牙/网络',
  photos: '相册',
  sensors: '运动与健身',
  location: '位置',
};

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [isRequesting, setIsRequesting] = useState(false);

  // Check all permissions on mount
  const checkAllPermissions = useCallback(async () => {
    const results: PermissionState = {};

    for (const perm of REQUIRED_PERMISSIONS) {
      try {
        const rnPermission = permissionMap[perm.key];
        if (rnPermission) {
          const status = await Permissions.check(rnPermission);
          results[perm.key] = status === 'granted' || status === 'limited';
        } else {
          // connectivity is handled differently
          results[perm.key] = true; // Assume granted for connectivity
        }
      } catch (error) {
        console.warn(`Permission check failed for ${perm.key}:`, error);
        results[perm.key] = false;
      }
    }

    setPermissions(results);
  }, []);

  // Request a single permission
  const requestPermission = useCallback(async (key: PermissionKey) => {
    const rnPermission = permissionMap[key];
    if (!rnPermission) return;

    try {
      const status = await Permissions.request(rnPermission);
      const granted = status === 'granted' || status === 'limited';
      setPermissions(prev => ({ ...prev, [key]: granted }));
    } catch (error) {
      console.error(`Permission request failed for ${key}:`, error);
      setPermissions(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  // Request ALL permissions at once
  const requestAllPermissions = useCallback(async () => {
    setIsRequesting(true);

    const pending = REQUIRED_PERMISSIONS.filter(p => !permissions[p.key]);

    for (const perm of pending) {
      await requestPermission(perm.key);
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsRequesting(false);
  }, [permissions, requestPermission]);

  // Open app settings
  const openSettings = useCallback(async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Permissions.openSettings();
    }
  }, []);

  // Computed values
  const hasAllPermissions = REQUIRED_PERMISSIONS.every(p => permissions[p.key]);
  const missingPermissions = REQUIRED_PERMISSIONS.filter(p => !permissions[p.key]).map(p => p.key);

  // Initial check
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        hasAllPermissions,
        missingPermissions,
        checkAllPermissions,
        requestAllPermissions,
        requestPermission,
        openSettings,
        isRequesting,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Helper to get display name for permission
export function getPermissionDisplayName(key: PermissionKey): string {
  const perm = REQUIRED_PERMISSIONS.find(p => p.key === key);
  if (!perm) return key;

  if (Platform.OS === 'ios') {
    return iosPermissionNames[key] || perm.label;
  }
  return perm.label;
}

// Helper to get icon for permission
export function getPermissionIcon(key: PermissionKey): string {
  const icons: Record<PermissionKey, string> = {
    camera: '📷',
    microphone: '🎙️',
    storage: '💾',
    files: '📁',
    sms: '📱',
    connectivity: '🌐',
    photos: '🖼️',
    sensors: '📡',
    location: '📍',
  };
  return icons[key] || '🔐';
}