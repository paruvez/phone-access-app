import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { formatBytes } from '@phone-access/shared';

export function HomeScreen({ navigation }: any) {
  const { notes, files, smsMessages, isOnline, lastSync, syncing, triggerSync, fetchNotes, fetchFiles, fetchSms } = useSync();
  const { user } = useAuth();
  const { hasAllPermissions, missingPermissions } = usePermissions();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync();
    setRefreshing(false);
  };

  useEffect(() => {
    // Initial data fetch
    fetchNotes();
    fetchFiles();
    fetchSms();
  }, [fetchNotes, fetchFiles, fetchSms]);

  const recentNotes = notes.slice(0, 3);
  const recentFiles = files.slice(0, 3);
  const recentSms = smsMessages.slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a1a2e']} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.email?.split('@')[0] || 'User'}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[
            styles.statusBadge,
            isOnline ? styles.statusOnline : styles.statusOffline,
          ]}>
            <Text style={styles.statusText}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Permissions Banner */}
      {!hasAllPermissions && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={() => navigation.navigate('Permissions')}
        >
          <Ionicons name="alert-circle" size={20} color="#ffc107" />
          <View style={styles.permissionBannerText}>
            <Text style={styles.permissionBannerTitle}>Permissions Needed</Text>
            <Text style={styles.permissionBannerSubtitle}>
              {missingPermissions.length} permissions required for full access
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
      )}

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="document-text"
          iconColor="#3498DB"
          title="Notes"
          value={notes.length}
          subtitle="Total notes"
          onPress={() => navigation.navigate('Notes')}
        />
        <StatCard
          icon="folder"
          iconColor="#9B59B6"
          title="Files"
          value={files.length}
          subtitle={`${files.reduce((sum, f) => sum + f.size, 0)} bytes`}
          onPress={() => navigation.navigate('Files')}
        />
        <StatCard
          icon="chatbubbles"
          iconColor="#E67E22"
          title="SMS"
          value={smsMessages.length}
          subtitle="Messages"
          onPress={() => navigation.navigate('SMS')}
        />
        <StatCard
          icon="sync"
          iconColor="#2ECC71"
          title="Sync"
          value={lastSync ? 'Just now' : 'Never'}
          subtitle={lastSync ? lastSync.toLocaleTimeString() : 'Not synced'}
          onPress={onRefresh}
        />
      </View>

      {/* Quick Actions */}
      <SectionHeader title="Quick Actions" onPressAll={() => {}} />
      <View style={styles.actionsGrid}>
        <ActionCard
          icon="camera"
          iconColor="#1a1a2e"
          title="Camera"
          subtitle="Capture photo/video"
          onPress={() => navigation.navigate('Camera')}
        />
        <ActionCard
          icon="mic"
          iconColor="#E67E22"
          title="Microphone"
          subtitle="Record audio"
          onPress={() => navigation.navigate('Microphone')}
        />
        <ActionCard
          icon="document-text"
          iconColor="#3498DB"
          title="New Note"
          subtitle="Create a note"
          onPress={() => navigation.navigate('NoteEditor', { mode: 'create' })}
        />
        <ActionCard
          icon="folder"
          iconColor="#9B59B6"
          title="Files"
          subtitle="Browse uploads"
          onPress={() => navigation.navigate('Files')}
        />
      </View>

      {/* Recent Notes */}
      {notes.length > 0 && (
        <>
          <SectionHeader
            title="Recent Notes"
            onPressAll={() => navigation.navigate('Notes')}
          />
          <View style={styles.recentList}>
            {recentNotes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={styles.recentNoteCard}
                onPress={() => navigation.navigate('NoteEditor', { mode: 'edit', note })}
              >
                <View style={styles.recentNoteContent}>
                  <Text style={styles.recentNoteTitle}>{note.title}</Text>
                  <Text style={styles.recentNotePreview} numberOfLines={2}>
                    {note.content}
                  </Text>
                  <Text style={styles.recentNoteDate}>
                    {new Date(note.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Recent Files */}
      {files.length > 0 && (
        <>
          <SectionHeader
            title="Recent Files"
            onPressAll={() => navigation.navigate('Files')}
          />
          <View style={styles.recentList}>
            {recentFiles.map((file) => (
              <TouchableOpacity
                key={file.id}
                style={styles.recentFileCard}
                onPress={() => {}}
              >
                <View style={styles.recentFileIcon}>
                  <Text style={styles.recentFileIconText}>
                    {file.type === 'camera' ? '📷' : file.type === 'microphone' ? '🎙️' : '📄'}
                  </Text>
                </View>
                <View style={styles.recentFileContent}>
                  <Text style={styles.recentFileName}>{file.filename}</Text>
                  <Text style={styles.recentFileMeta}>
                    {file.type} • {formatBytes(file.size)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function StatCard({
  icon,
  iconColor,
  title,
  value,
  subtitle,
  onPress,
}: {
  icon: string;
  iconColor: string;
  title: string;
  value: number | string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.statIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionCard({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onPressAll }: { title: string; onPressAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#888',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOnline: {
    backgroundColor: '#d4edda',
  },
  statusOffline: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  permissionBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  permissionBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#856404',
  },
  permissionBannerSubtitle: {
    fontSize: 12,
    color: '#856404',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  statSubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionCard: {
    width: '48%',
    aspectRatio: 1,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  recentList: {
    marginBottom: 24,
  },
  recentNoteCard: {
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
  recentNoteContent: {
    flex: 1,
    marginRight: 12,
  },
  recentNoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  recentNotePreview: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  recentNoteDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  recentFileCard: {
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
  recentFileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentFileIconText: {
    fontSize: 18,
  },
  recentFileContent: {
    flex: 1,
  },
  recentFileName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a2e',
  },
  recentFileMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  bottomSpacer: {
    height: 100,
  },
});