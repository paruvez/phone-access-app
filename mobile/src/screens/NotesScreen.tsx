import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../context/PermissionContext';

export function NotesScreen({ navigation }: any) {
  const { notes, createNote, updateNote, deleteNote, fetchNotes, syncing } = useSync();
  const { hasAllPermissions } = usePermissions();
  const [searchText, setSearchText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchText.toLowerCase()) ||
      note.content.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    setCreating(true);
    await createNote(newNoteTitle, newNoteContent);
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowCreateModal(false);
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notes</Text>
          <Text style={styles.headerSubtitle}>{notes.length} notes</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (hasAllPermissions) {
              navigation.navigate('NoteEditor', { mode: 'create' });
            } else {
              setShowCreateModal(true);
            }
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#999"
        />
        <Ionicons name="search" size={22} color="#999" style={styles.searchIcon} />
      </View>

      {/* Notes List */}
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.noteCard}
            onPress={() => navigation.navigate('NoteEditor', { mode: 'edit', note: item })}
            onLongPress={() => handleDelete(item.id)}
          >
            <View style={styles.noteContent}>
              <Text style={styles.noteTitle}>{item.title}</Text>
              <Text style={styles.notePreview} numberOfLines={3}>
                {item.content}
              </Text>
              <Text style={styles.noteDate}>
                {new Date(item.updated_at || item.created_at).toLocaleString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to create your first note
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Create Note Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Note</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Title"
                value={newNoteTitle}
                onChangeText={setNewNoteTitle}
                placeholderTextColor="#999"
                autoFocus
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Content"
                value={newNoteContent}
                onChangeText={setNewNoteContent}
                placeholderTextColor="#999"
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, creating && styles.modalButtonDisabled]}
                onPress={handleCreate}
                disabled={creating || !newNoteTitle.trim() || !newNoteContent.trim()}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a2e',
    paddingVertical: 12,
    paddingRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  noteCard: {
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
  noteContent: {
    flex: 1,
    marginRight: 12,
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  notePreview: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    lineHeight: 20,
  },
  noteDate: {
    fontSize: 12,
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
    maxHeight: '85%',
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
});