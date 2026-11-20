import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../context/PermissionContext';
import { FileRecord } from '@phone-access/shared';
import { formatBytes } from '@phone-access/shared';

export function FilesScreen({ navigation }: any) {
  const { files, fetchFiles, uploadFile, syncing } = useSync();
  const { hasAllPermissions, requestPermission } = usePermissions();

  const [selectedType, setSelectedType] = useState<FileRecord['type'] | 'all'>('all');
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const types: Array<{ value: FileRecord['type'] | 'all'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: 'folder' },
    { value: 'camera', label: 'Camera', icon: 'camera' },
    { value: 'microphone', label: 'Microphone', icon: 'mic' },
    { value: 'sms', label: 'SMS', icon: 'chatbubbles' },
    { value: 'file', label: 'Files', icon: 'document' },
    { value: 'note', label: 'Notes', icon: 'document-text' },
  ];

  const filteredFiles = selectedType === 'all'
    ? files
    : files.filter(f => f.type === selectedType);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handlePickDocument = async () => {
    if (!hasAllPermissions) {
      requestPermission('files');
      requestPermission('storage');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      setUploading(true);
      for (const asset of result.assets) {
        await uploadFile({
          uri: asset.uri,
          filename: asset.name || `file_${Date.now()}`,
          type: 'file',
          metadata: { mimeType: asset.mimeType, size: asset.size },
        });
      }
      setUploading(false);
    } catch (error) {
      console.error('Document picker error:', error);
      setUploading(false);
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const handleFilePress = (file: FileRecord) => {
    // Open file or show details
    Alert.alert(
      file.filename,
      `Type: ${file.type}\nSize: ${formatBytes(file.size)}\nDate: ${new Date(file.created_at).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => {} },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  const handleLongPress = (file: FileRecord) => {
    Alert.alert('Delete File', `Delete ${file.filename}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {} },
    ]);
  };

  const getFileIcon = (type: FileRecord['type']) => {
    switch (type) {
      case 'camera': return '📷';
      case 'microphone': return '🎙️';
      case 'sms': return '📱';
      case 'note': return '📝';
      default: return '📄';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Files</Text>
          <Text style={styles.headerSubtitle}>{files.length} files • {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handlePickDocument}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="add" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Type Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="funnel" size={20} color="#1a1a2e" />
          <Text style={styles.filterButtonText}>
            {types.find(t => t.value === selectedType)?.label || 'All'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Files List */}
      <FlatList
        data={filteredFiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.fileCard}
            onPress={() => handleFilePress(item)}
            onLongPress={() => handleLongPress(item)}
          >
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>{getFileIcon(item.type)}</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{item.filename}</Text>
              <View style={styles.fileMeta}>
                <Text style={styles.fileType}>
                  <Ionicons name={types.find(t => t.value === item.type)?.icon || 'document'} size={12} color="#888" />
                  {' '}{item.type}
                </Text>
                <Text style={styles.fileSize}>{formatBytes(item.size)}</Text>
                <Text style={styles.fileDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No files yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to upload files from your device
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handlePickDocument}
              disabled={uploading}
            >
              <Text style={styles.emptyButtonText}>
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={syncing}
        onRefresh={fetchFiles}
      />

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Type</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              {types.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.filterOption,
                    selectedType === type.value && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedType(type.value);
                    setFilterModalVisible(false);
                  }}
                >
                  <View style={[
                    styles.filterOptionIcon,
                    selectedType === type.value && styles.filterOptionIconActive,
                  ]}>
                    <Ionicons name={type.icon} size={22} color={selectedType === type.value ? '#fff' : '#1a1a2e'} />
                  </View>
                  <Text style={[
                    styles.filterOptionLabel,
                    selectedType === type.value && styles.filterOptionLabelActive,
                  ]}>
                    {type.label}
                  </Text>
                  <Text style={[
                    styles.filterOptionCount,
                    selectedType === type.value && styles.filterOptionCountActive,
                  ]}>
                    {selectedType === 'all' ? files.length : files.filter(f => f.type === type.value).length}
                  </Text>
                </TouchableOpacity>
              ))}
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
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    marginHorizontal: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  fileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fileIconText: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 12,
  },
  fileType: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 12,
    color: '#888',
  },
  fileSize: {
    fontSize: 12,
    color: '#888',
  },
  fileDate: {
    fontSize: 12,
    color: '#999',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  modalContent: {
    padding: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  filterOptionActive: {
    backgroundColor: '#1a1a2e',
    borderColor: '#1a1a2e',
  },
  filterOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  filterOptionIconActive: {
    backgroundColor: '#fff',
  },
  filterOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  filterOptionLabelActive: {
    color: '#fff',
  },
  filterOptionCount: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  filterOptionCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
});