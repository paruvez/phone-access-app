import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../context/PermissionContext';

export function SMSScreen({ navigation }: any) {
  const { smsMessages, sendSms, fetchSms } = useSync();
  const { hasAllPermissions, requestPermission } = usePermissions();

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composePhone, setComposePhone] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<typeof smsMessages[0] | null>(null);
  const [showMessageDetail, setShowMessageDetail] = useState(false);

  useEffect(() => {
    fetchSms();
  }, [fetchSms]);

  const handleSendSms = async () => {
    if (!composePhone.trim() || !composeMessage.trim()) {
      Alert.alert('Error', 'Phone number and message are required');
      return;
    }

    if (!hasAllPermissions) {
      requestPermission('sms');
      return;
    }

    setSending(true);
    try {
      await sendSms(composePhone, composeMessage);
      setComposePhone('');
      setComposeMessage('');
      setShowComposeModal(false);
    } catch (error) {
      console.error('Send SMS error:', error);
      Alert.alert('Error', 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleMessagePress = (message: typeof smsMessages[0]) => {
    setSelectedMessage(message);
    setShowMessageDetail(true);
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'incoming' ? '📥' : '📤';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#28a745';
      case 'delivered': return '#17a2b8';
      case 'failed': return '#dc3545';
      default: return '#888';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>SMS</Text>
          <Text style={styles.headerSubtitle}>{smsMessages.length} messages</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowComposeModal(true)}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="add" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Permissions notice */}
      {!hasAllPermissions && (
        <View style={styles.permissionNotice}>
          <Ionicons name="alert-circle" size={16} color="#ffc107" />
          <Text style={styles.permissionNoticeText}>
            SMS permission required to send messages
          </Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        data={smsMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.messageCard,
              item.direction === 'incoming' && styles.messageIncoming,
            ]}
            onPress={() => handleMessagePress(item)}
            onLongPress={() => Alert.alert('Delete', `Delete this message?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive' },
            ])}
          >
            <View style={styles.messageBubble}>
              <View style={styles.messageHeader}>
                <View style={styles.messageDirection}>
                  <Text style={styles.directionIcon}>{getDirectionIcon(item.direction)}</Text>
                  <Text style={styles.messagePhone}>{item.phone_number}</Text>
                </View>
                <View style={styles.messageStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(item.status) },
                    ]}
                  />
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.messageText} numberOfLines={3}>
                {item.message}
              </Text>
              <Text style={styles.messageTime}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to send a new SMS
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowComposeModal(true)}
              disabled={!hasAllPermissions}
            >
              <Text style={styles.emptyButtonText}>
                {hasAllPermissions ? 'Send SMS' : 'Grant Permissions First'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={false}
      />

      {/* Compose Modal */}
      <Modal
        visible={showComposeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComposeModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New SMS</Text>
              <TouchableOpacity onPress={() => setShowComposeModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Phone Number"
                value={composePhone}
                onChangeText={setComposePhone}
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                autoFocus
                autoComplete="tel"
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Message"
                value={composeMessage}
                onChangeText={setComposeMessage}
                placeholderTextColor="#999"
                multiline
                maxLength={1600}
              />
              <View style={styles.charCount}>
                <Text style={styles.charCountText}>
                  {composeMessage.length}/1600 characters
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowComposeModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, sending && styles.modalButtonDisabled]}
                onPress={handleSendSms}
                disabled={sending || !composePhone.trim() || !composeMessage.trim()}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Message Detail Modal */}
      <Modal
        visible={showMessageDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMessageDetail(false)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Message Details</Text>
              <TouchableOpacity onPress={() => setShowMessageDetail(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {selectedMessage && (
              <View style={styles.detailBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Direction</Text>
                  <Text style={styles.detailValue}>
                    {getDirectionIcon(selectedMessage.direction)} {selectedMessage.direction}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{selectedMessage.phone_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={styles.detailStatus}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(selectedMessage.status) },
                      ]}
                    />
                    <Text style={[
                      styles.detailValue,
                      { color: getStatusColor(selectedMessage.status) },
                    ]}>
                      {selectedMessage.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Message</Text>
                  <Text style={styles.detailMessage}>{selectedMessage.message}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailActions}>
              <TouchableOpacity
                style={styles.detailCloseButton}
                onPress={() => setShowMessageDetail(false)}
              >
                <Text style={styles.detailCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff3cd',
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  permissionNoticeText: {
    fontSize: 13,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  messageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  messageIncoming: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  messageBubble: {
    flex: 1,
    marginRight: 12,
    maxWidth: '85%',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageDirection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  messagePhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  separator: {
    height: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInput: {
    fontSize: 17,
    color: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  charCountText: {
    fontSize: 12,
    color: '#888',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  detailContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  detailBody: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#1a1a2e',
  },
  detailStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailMessage: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  detailActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailCloseButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  detailCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});