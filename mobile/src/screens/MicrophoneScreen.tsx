import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../context/PermissionContext';

export function MicrophoneScreen({ navigation }: any) {
  const { hasAllPermissions, requestPermission } = usePermissions();
  const { uploadFile } = useSync();

  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [permission, setPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [recordings, setRecordings] = useState<Array<{ uri: string; duration: number; date: Date }>>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const meteringInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (hasAllPermissions) {
      (async () => {
        const { status } = await Audio.requestPermissionsAsync();
        setPermission(status === 'granted' ? 'granted' : 'denied');
      })();

      // Configure audio mode
      Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    }

    // Load existing recordings
    loadRecordings();

    return () => {
      stopRecording();
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (meteringInterval.current) clearInterval(meteringInterval.current);
    };
  }, [hasAllPermissions]);

  const loadRecordings = async () => {
    try {
      const dir = `${FileSystem.documentDirectory}recordings/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        const files = await FileSystem.readDirectoryAsync(dir);
        const recordingFiles = files
          .filter(f => f.endsWith('.m4a') || f.endsWith('.wav'))
          .map(f => ({
            uri: `${dir}${f}`,
            duration: 0,
            date: new Date(),
          }));
        setRecordings(recordingFiles);
      }
    } catch (error) {
      console.error('Load recordings error:', error);
    }
  };

  const startRecording = async () => {
    if (!hasAllPermissions) {
      requestPermission('microphone');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const recording = new Audio.Recording();
      recordingRef.current = recording;

      await recording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );

      await recording.startAsync();
      setRecording(true);
      setRecordingDuration(0);
      setProcessing(false);

      // Start duration timer
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio metering
      meteringInterval.current = setInterval(async () => {
        if (recordingRef.current) {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // Convert -160 to 0 dB to 0-1 range
            const level = Math.max(0, Math.min(1, (status.metering + 160) / 160));
            setAudioLevel(level);
          }
        }
      }, 100);
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
      setRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      const recording = recordingRef.current;
      await recording.stopAsync();
      setRecording(false);

      if (durationInterval.current) clearInterval(durationInterval.current);
      if (meteringInterval.current) clearInterval(meteringInterval.current);

      const uri = recording.getURI();
      const duration = recordingDuration;

      recordingRef.current = null;
      setAudioLevel(0);

      if (uri) {
        await handleRecordingComplete(uri, duration);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const handleRecordingComplete = async (uri: string, duration: number) => {
    setProcessing(true);

    try {
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(uri);
      const album = await MediaLibrary.getAlbumAsync('Phone Access Recordings');
      if (album === null) {
        await MediaLibrary.createAlbumAsync('Phone Access Recordings', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      // Copy to app directory for persistence
      const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(recordingsDir, { intermediates: true });
      }

      const filename = `recording_${Date.now()}.m4a`;
      const newUri = `${recordingsDir}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: newUri });

      // Upload to Supabase
      const result = await uploadFile({
        uri: newUri,
        filename,
        type: 'microphone',
        metadata: { duration, format: 'm4a' },
      });

      if (result) {
        setRecordings(prev => [{ uri: newUri, duration, date: new Date() }, ...prev]);
      }
    } catch (error) {
      console.error('Recording complete error:', error);
      Alert.alert('Error', 'Failed to save recording');
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const playRecording = async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Play recording error:', error);
    }
  };

  const deleteRecording = async (uri: string) => {
    Alert.alert('Delete Recording', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(uri);
            setRecordings(prev => prev.filter(r => r.uri !== uri));
          } catch (error) {
            console.error('Delete recording error:', error);
          }
        },
      },
    ]);
  };

  if (permission === 'denied') {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="mic-off" size={80} color="#888" />
        <Text style={styles.permissionText}>Microphone permission denied</Text>
        <Text style={styles.permissionSubtitle}>
          Enable microphone access in Settings to record audio
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => requestPermission('microphone')}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Microphone</Text>
        <Text style={styles.headerSubtitle}>
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Recording UI */}
      <View style={styles.recordingSection}>
        {/* Audio Visualizer */}
        <View style={styles.visualizerContainer}>
          <View style={styles.waveform}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((_, i) => (
              <AnimatedBar key={i} level={audioLevel} index={i} recording={recording} />
            ))}
          </View>

          {/* Recording Timer */}
          <View style={styles.timerContainer}>
            <Text style={[
              styles.timerText,
              recording && styles.timerRecording,
            ]}>
              {formatTime(recordingDuration)}
            </Text>
            {recording && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingPulse} />
                <Text style={styles.recordingLabel}>RECORDING</Text>
              </View>
            )}
          </View>

          {/* Main Record Button */}
          <TouchableOpacity
            style={[
              styles.recordButton,
              recording && styles.recordButtonRecording,
              processing && styles.recordButtonProcessing,
            ]}
            onPress={recording ? stopRecording : startRecording}
            disabled={processing}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.recordButtonInner,
                recording && styles.recordButtonInnerRecording,
              ]}
            />
            {processing && (
              <ActivityIndicator color="#fff" size="small" style={styles.buttonSpinner} />
            )}
          </TouchableOpacity>

          {/* Status Text */}
          <Text style={[
            styles.statusText,
            recording && styles.statusRecording,
            processing && styles.statusProcessing,
          ]}>
            {recording ? 'Recording... Tap to stop' : processing ? 'Processing...' : 'Tap to start recording'}
          </Text>
        </View>
      </View>

      {/* Recordings List */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Recordings</Text>
          <TouchableOpacity
            style={styles.listAction}
            onPress={() => navigation.navigate('RecordingsGallery')}
          >
            <Text style={styles.listActionText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recordings.length === 0 ? (
          <View style={styles.emptyRecordings}>
            <Ionicons name="mic" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No recordings yet</Text>
            <Text style={styles.emptySubtitle}>Tap the button above to record</Text>
          </View>
        ) : (
          <View style={styles.recordingsList}>
            {recordings.slice(0, 5).map((rec, index) => (
              <TouchableOpacity
                key={rec.uri}
                style={styles.recordingItem}
                onPress={() => playRecording(rec.uri)}
                onLongPress={() => deleteRecording(rec.uri)}
              >
                <View style={styles.recordingItemLeft}>
                  <View style={[
                    styles.recordingPlayButton,
                    { backgroundColor: index === 0 ? '#1a1a2e' : '#f0f0f0' },
                  ]}>
                    <Ionicons
                      name="play"
                      size={20}
                      color={index === 0 ? '#fff' : '#1a1a2e'}
                    />
                  </View>
                  <View style={styles.recordingInfo}>
                    <Text style={styles.recordingName}>
                      Recording {recordings.length - index}
                    </Text>
                    <Text style={styles.recordingMeta}>
                      {formatTime(rec.duration)} • {rec.date.toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.recordingItemRight}>
                  <Ionicons name="trash" size={20} color="#dc3545" style={{ opacity: 0.5 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Tips */}
      <View style={styles.tips}>
        <Text style={styles.tipText}>
          Recordings saved to gallery & synced to Discord automatically
        </Text>
      </View>
    </View>
  );
}

// Animated bar component for waveform
const AnimatedBar = ({ level, index, recording }: { level: number; index: number; recording: boolean }) => {
  const height = React.useRef(new Animated.Value(4)).current;

  React.useEffect(() => {
    if (!recording) {
      Animated.timing(height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
      return;
    }

    const animate = () => {
      const randomHeight = 4 + Math.random() * level * 60;
      Animated.timing(height, {
        toValue: randomHeight,
        duration: 50 + Math.random() * 100,
        useNativeDriver: false,
      }).start(animate);
    };
    animate();
  }, [height, level, recording]);

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { height },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a2e',
    marginTop: 16,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  recordingSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  visualizerContainer: {
    alignItems: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 80,
    width: '100%',
    paddingHorizontal: 20,
  },
  waveformBar: {
    flex: 1,
    width: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 2,
    marginHorizontal: 1,
    minHeight: 4,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '300',
    color: '#1a1a2e',
    fontFamily: 'monospace',
  },
  timerRecording: {
    color: '#dc3545',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(220,53,69,0.1)',
    borderRadius: 20,
  },
  recordingPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc3545',
    marginRight: 6,
  },
  recordingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  recordButtonRecording: {
    backgroundColor: '#dc3545',
    shadowColor: '#dc3545',
  },
  recordButtonProcessing: {
    opacity: 0.7,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  recordButtonInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  buttonSpinner: {
    position: 'absolute',
  },
  statusText: {
    fontSize: 15,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
  statusRecording: {
    color: '#dc3545',
    fontWeight: '600',
  },
  statusProcessing: {
    color: '#ffc107',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  listAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  emptyRecordings: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  recordingsList: {
    gap: 8,
  },
  recordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  recordingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordingPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  recordingMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  recordingItemRight: {
    padding: 8,
  },
  tips: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tipText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});