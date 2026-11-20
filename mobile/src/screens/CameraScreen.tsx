import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraType, CameraProps } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useSync } from '../context/SyncContext';
import { usePermissions } from '../context/PermissionContext';

export function CameraScreen({ navigation }: any) {
  const { hasAllPermissions, requestPermission } = usePermissions();
  const { uploadFile } = useSync();

  const [type, setType] = useState<CameraType>(CameraType.back);
  const [recording, setRecording] = useState(false);
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('auto');
  const [permission, setPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [processing, setProcessing] = useState(false);
  const [lastCaptured, setLastCaptured] = useState<string | null>(null);

  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    if (hasAllPermissions) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setPermission(status);
      })();
    }
  }, [hasAllPermissions]);

  const handleRecord = async () => {
    if (!cameraRef.current) return;

    if (recording) {
      // Stop recording
      const video = await cameraRef.current.stopRecording();
      setRecording(false);
      await handleMediaCapture(video.uri, 'video');
    } else {
      // Start recording
      try {
        await cameraRef.current.recordAsync({
          quality: '1080p',
          maxDuration: 60,
          maxFileSize: 100 * 1024 * 1024, // 100MB
        });
        setRecording(true);
      } catch (error) {
        console.error('Recording error:', error);
        Alert.alert('Error', 'Failed to start recording');
      }
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || processing) return;

    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
        exif: true,
        onPictureSaved: () => {},
      });

      await handleMediaCapture(photo.uri, 'image');
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setProcessing(false);
    }
  };

  const handleMediaCapture = async (uri: string, mediaType: 'image' | 'video') => {
    try {
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(uri);
      const album = await MediaLibrary.getAlbumAsync('Phone Access');
      if (album === null) {
        await MediaLibrary.createAlbumAsync('Phone Access', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      // Upload to Supabase
      const filename = `${mediaType}_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
      const result = await uploadFile({
        uri,
        filename,
        type: 'camera',
        metadata: { mediaType, width: 1920, height: 1080 },
      });

      if (result) {
        setLastCaptured(uri);
        // Show success feedback
      }
    } catch (error) {
      console.error('Media capture error:', error);
      Alert.alert('Error', 'Failed to save media');
    }
  };

  const flipCamera = () => {
    setType(current => current === CameraType.back ? CameraType.front : CameraType.back);
  };

  const toggleFlash = () => {
    setFlashMode(current => {
      if (current === 'auto') return 'on';
      if (current === 'on') return 'off';
      return 'auto';
    });
  };

  if (permission === 'denied') {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off" size={80} color="#888" />
        <Text style={styles.permissionText}>Camera permission denied</Text>
        <Text style={styles.permissionSubtitle}>
          Enable camera access in Settings to use this feature
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => requestPermission('camera')}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <View style={styles.previewContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={type}
          flashMode={flashMode}
          ratio="16:9"
          useCamera2Api={Platform.OS === 'android'}
        >
          {/* Recording Indicator */}
          {recording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
              <Text style={styles.recordingTime}>00:00</Text>
            </View>
          )}

          {/* Processing Indicator */}
          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}

          {/* Last Captured Preview */}
          {lastCaptured && (
            <TouchableOpacity
              style={styles.lastCapturedPreview}
              onPress={() => navigation.navigate('MediaPreview', { uri: lastCaptured })}
            >
              <Ionicons name="image" size={32} color="#fff" />
            </TouchableOpacity>
          )}
        </Camera>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
            <Ionicons name="swap-horizontal" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <Ionicons
              name={
                flashMode === 'on' ? 'flash' : flashMode === 'off' ? 'flash-off' : 'flash-auto'
              }
              size={28}
              color={flashMode === 'off' ? '#888' : '#fff'}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Gallery Button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => navigation.navigate('MediaGallery', { type: 'camera' })}
          >
            <Ionicons name="images" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Capture/Record Button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              recording && styles.captureButtonRecording,
              processing && styles.captureButtonDisabled,
            ]}
            onPress={recording ? handleRecord : handleCapture}
            disabled={processing}
          >
            <View
              style={[
                styles.captureInner,
                recording && styles.captureInnerRecording,
              ]}
            />
          </TouchableOpacity>

          {/* Switch Mode Button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => {}}
          >
            <Ionicons name="settings" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              !recording && styles.modeButtonActive,
            ]}
            onPress={() => setRecording(false)}
            disabled={recording}
          >
            <Text style={[
              styles.modeButtonText,
              !recording && styles.modeButtonTextActive,
            ]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              recording && styles.modeButtonActive,
            ]}
            onPress={() => setRecording(true)}
            disabled={processing}
          >
            <Text style={[
              styles.modeButtonText,
              recording && styles.modeButtonTextActive,
            ]}>
              Video
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tips}>
        <Text style={styles.tipText}>
          Tap to focus • Hold for video • Photos saved to gallery & Discord
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#000',
  },
  permissionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
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
  previewContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc3545',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc3545',
    marginRight: 8,
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'monospace',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  processingText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 12,
  },
  lastCapturedPreview: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sideButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonRecording: {
    backgroundColor: 'rgba(220,53,69,0.9)',
    borderColor: '#dc3545',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  captureInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#dc3545',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  modeButton: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modeButtonActive: {
    backgroundColor: '#1a1a2e',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  tips: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});