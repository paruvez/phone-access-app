import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePermissions, getPermissionDisplayName, getPermissionIcon, REQUIRED_PERMISSIONS } from '../context/PermissionContext';

interface PermissionManagerProps {
  onAllGranted?: () => void;
  visible?: boolean;
}

export const PermissionManager: React.FC<PermissionManagerProps> = ({
  onAllGranted,
  visible = true,
}) => {
  const {
    permissions,
    hasAllPermissions,
    missingPermissions,
    requestAllPermissions,
    requestPermission,
    openSettings,
    isRequesting,
    checkAllPermissions,
  } = usePermissions();

  const [modalVisible, setModalVisible] = useState(visible);
  const [animation] = useState(() => new Animated.Value(0));
  const [grantAnimation, setGrantAnimation] = useState<string | null>(null);

  useEffect(() => {
    if (modalVisible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible, animation]);

  useEffect(() => {
    if (hasAllPermissions && modalVisible) {
      // Trigger success animation
      setGrantAnimation('success');
      setTimeout(() => {
        setModalVisible(false);
        onAllGranted?.();
        setGrantAnimation(null);
      }, 1500);
    }
  }, [hasAllPermissions, modalVisible, onAllGranted]);

  const handleRequestAll = async () => {
    await requestAllPermissions();
    await checkAllPermissions();
  };

  const handleRequestSingle = async (key: string) => {
    setGrantAnimation(key);
    await requestPermission(key as any);
    await checkAllPermissions();
    setTimeout(() => setGrantAnimation(null), 500);
  };

  if (!visible || hasAllPermissions) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [
              {
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
              {
                scale: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="shield-checkmark" size={40} color="#1a1a2e" />
            {grantAnimation === 'success' && (
              <Animated.View
                style={[
                  styles.successOverlay,
                  {
                    opacity: grantAnimation === 'success' ? 1 : 0,
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={40} color="#28a745" />
              </Animated.View>
            )}
          </View>
          <Text style={styles.headerTitle}>Permissions Required</Text>
          <Text style={styles.headerSubtitle}>
            Grant access to enable full phone features
          </Text>
          <View style={styles.progressSummary}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${(REQUIRED_PERMISSIONS.filter(p => permissions[p.key]).length / REQUIRED_PERMISSIONS.length) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {REQUIRED_PERMISSIONS.filter(p => permissions[p.key]).length} / {REQUIRED_PERMISSIONS.length} granted
            </Text>
          </View>
        </View>

        {/* Permission List */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {REQUIRED_PERMISSIONS.map((perm) => {
            const isGranted = permissions[perm.key];
            const isAnimating = grantAnimation === perm.key;

            return (
              <Animated.View
                key={perm.key}
                style={[
                  styles.permissionCard,
                  isGranted && styles.cardGranted,
                  isAnimating && styles.cardAnimating,
                ]}
              >
                {/* Status Indicator */}
                <Animated.View
                  style={[
                    styles.statusIndicator,
                    isGranted && styles.indicatorGranted,
                    isAnimating && styles.indicatorAnimating,
                  ]}
                >
                  {isGranted ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : isAnimating ? (
                    <Animated.View style={styles.spinner} />
                  ) : (
                    <Ionicons name="close" size={18} color="#fff" />
                  )}
                </Animated.View>

                {/* Icon & Info */}
                <View style={styles.permissionInfo}>
                  <View style={styles.iconContainer}>
                    <Text style={styles.iconText}>{getPermissionIcon(perm.key)}</Text>
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[
                      styles.permissionLabel,
                      isGranted && styles.labelGranted,
                    ]}>
                      {getPermissionDisplayName(perm.key)}
                    </Text>
                    <Text style={styles.permissionDescription}>
                      {getPermissionDescription(perm.key)}
                    </Text>
                  </View>
                </View>

                {/* Action Button */}
                {!isGranted && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      isAnimating && styles.buttonAnimating,
                    ]}
                    onPress={() => handleRequestSingle(perm.key)}
                    disabled={isRequesting || isAnimating}
                  >
                    <Text style={styles.actionButtonText}>
                      {isAnimating ? 'Allowing...' : 'Allow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {/* Request All Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              missingPermissions.length === 0 && styles.buttonDisabled,
              isRequesting && styles.buttonLoading,
            ]}
            onPress={handleRequestAll}
            disabled={missingPermissions.length === 0 || isRequesting}
          >
            {isRequesting ? (
              <>
                <Animated.View style={styles.buttonSpinner} />
                <Text style={styles.buttonText}>Requesting All...</Text>
              </>
            ) : missingPermissions.length === 0 ? (
              <Text style={styles.buttonText}>✓ All Permissions Granted</Text>
            ) : (
              <Text style={styles.buttonText}>
                <Ionicons name="flash" size={20} style={{ marginRight: 8 }} />
                Allow All ({missingPermissions.length})
              </Text>
            )}
          </TouchableOpacity>

          {/* Open Settings Button */}
          {missingPermissions.length > 0 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openSettings}
              disabled={isRequesting}
            >
              <Text style={styles.secondaryButtonText}>
                <Ionicons name="settings" size={18} style={{ marginRight: 6 }} />
                Open Settings Manually
              </Text>
            </TouchableOpacity>
          )}

          {/* Skip Button (for development) */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                setModalVisible(false);
                onAllGranted?.();
              }}
            >
              <Text style={styles.skipButtonText}>Skip (Dev Only)</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

// Helper function for permission descriptions
function getPermissionDescription(key: string): string {
  const descriptions: Record<string, string> = {
    camera: 'Take photos and record videos for notes',
    microphone: 'Record voice memos and audio notes',
    storage: 'Save files and media to your device',
    files: 'Access and manage uploaded files',
    sms: 'Send and receive SMS messages',
    connectivity: 'Maintain background connection to Discord',
    photos: 'Access photo library for attachments',
    sensors: 'Use motion sensors for enhanced features',
    location: 'Add location data to notes',
  };
  return descriptions[key] || 'Required for app functionality';
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerIconContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  progressSummary: {
    marginTop: 16,
    width: '100%',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 0,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardGranted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#dcfce7',
  },
  cardAnimating: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  statusIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#f0f0f0',
  },
  indicatorGranted: {
    backgroundColor: '#28a745',
  },
  indicatorAnimating: {
    backgroundColor: '#ffc107',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderTopColor: 'transparent',
  },
  permissionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  labelGranted: {
    color: '#166534',
  },
  permissionDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonAnimating: {
    backgroundColor: '#ffc107',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  bottomActions: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonDisabled: {
    opacity: 1,
    backgroundColor: '#28a745',
  },
  buttonLoading: {
    backgroundColor: '#ffc107',
  },
  buttonSpinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderTopColor: 'transparent',
    marginRight: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a2e',
  },
  skipButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: '#888',
  },
});