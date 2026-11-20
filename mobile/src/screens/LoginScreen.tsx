import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSupabase } from '../context/SupabaseContext';

export function LoginScreen({ navigation }: any) {
  const { login, register, loading: authLoading } = useAuth();
  const { supabase } = useSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = isRegister
        ? await register(email, password)
        : await login(email, password);

      if (result.error) {
        setError(result.error.message);
      } else {
        // Success - navigation handled by AuthContext
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAuth = async () => {
    // Allow anonymous access for testing
    try {
      // Sign in anonymously if Supabase supports it
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        // If anonymous auth not enabled, just proceed
        console.log('Anonymous auth not available, proceeding anyway');
      }
    } catch (e) {
      // Ignore
    }
    // Navigation will update via AuthContext
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Ionicons name="phone-portrait" size={60} color="#fff" />
          </View>
          <Text style={styles.appName}>Phone Access</Text>
          <Text style={styles.appTagline}>Full phone access with Discord sync</Text>
        </View>

        {/* Auth Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isRegister
              ? 'Sign up to sync your data across devices'
              : 'Sign in to access your notes and files'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#dc3545" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType={isRegister ? 'username' : 'email'}
              autoFocus={!isRegister}
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
              secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              textContentType={isRegister ? 'new-password' : 'password'}
            />
          </View>

          {isRegister && (
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholderTextColor="#999"
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || authLoading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegister ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <Text style={styles.dividerText}>or</Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSkipAuth}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            disabled={loading}
          >
            <Text style={styles.switchButtonText}>
              {isRegister ? 'Already have an account? ' : 'Don\'t have an account? '}
              <Text style={styles.switchButtonLink}>
                {isRegister ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Preview */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features</Text>
          <View style={styles.featuresGrid}>
            <FeatureItem icon="document-text" color="#3498DB" title="Notes" />
            <FeatureItem icon="camera" color="#1a1a2e" title="Camera" />
            <FeatureItem icon="mic" color="#E67E22" title="Microphone" />
            <FeatureItem icon="folder" color="#9B59B6" title="Files" />
            <FeatureItem icon="chatbubbles" color="#2ECC71" title="SMS" />
            <FeatureItem icon="logo-discord" color="#5865F2" title="Discord Sync" />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FeatureItem({ icon, color, title }: { icon: string; color: string; title: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 16,
  },
  appTagline: {
    fontSize: 15,
    color: '#888',
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    marginLeft: 8,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    fontSize: 17,
    color: '#1a1a2e',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerText: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  switchButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchButtonText: {
    fontSize: 14,
    color: '#888',
  },
  switchButtonLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  featureItem: {
    alignItems: 'center',
    width: '30%',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 8,
  },
});