import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Phone Access App',
  slug: 'phone-access-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a1a2e',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.phoneaccess.app',
    infoPlist: {
      NSCameraUsageDescription: '相机使用说明 - 用于拍照和录像功能',
      NSMicrophoneUsageDescription: '麦克风使用说明 - 用于语音录制功能',
      NSPhotoLibraryUsageDescription: '相册使用说明 - 用于保存和选择照片',
      NSPhotoLibraryAddUsageDescription: '相册写入说明 - 用于保存拍摄的照片和录音',
      NSContactsUsageDescription: '通讯录使用说明 - 用于短信功能',
      NSSpeechRecognitionUsageDescription: '语音识别使用说明 - 用于语音转文字',
      NSLocationWhenInUseUsageDescription: '位置信息使用说明 - 用于位置相关功能',
      NSMotionUsageDescription: '运动传感器使用说明 - 用于传感器功能',
      UIBackgroundModes: ['audio', 'background-processing', 'background-fetch'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a1a2e',
    },
    package: 'com.phoneaccess.app',
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_AUDIO',
      'SEND_SMS',
      'RECEIVE_SMS',
      'READ_SMS',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'BODY_SENSORS',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'FOREGROUND_SERVICE_CAMERA',
      'FOREGROUND_SERVICE_MICROPHONE',
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'WAKE_LOCK',
      'RECEIVE_BOOT_COMPLETED',
    ],
  },
    plugins: [
    'expo-camera',
    'expo-media-library',
    'expo-av',
    'expo-notifications',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          minSdkVersion: 24,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
});