import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PermissionManager } from '../components/PermissionManager';
import { useNavigation } from '@react-navigation/native';

export function PermissionScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <PermissionManager
        onAllGranted={() => {
          navigation.replace('Main');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});