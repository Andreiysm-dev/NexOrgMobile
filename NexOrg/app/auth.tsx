import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Microsoft OAuth
  const { signInWithMicrosoft, loading: msLoading, error: msError } = useMicrosoftAuth();

  // Handle Microsoft sign-in
  const handleMicrosoftSignIn = async () => {
    const result = await signInWithMicrosoft();
    
    if (result?.success) {
      // Check if user is authenticated via Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        Alert.alert('Success', `Welcome ${session.user.email}!`, [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      }
    } else if (result?.error) {
      Alert.alert('Microsoft Sign-In Error', result.error);
    }
  };

  // Handle Microsoft auth errors
  useEffect(() => {
    if (msError) {
      Alert.alert('Microsoft Sign-In Error', msError);
    }
  }, [msError]);

  const handleSubmit = async () => {
    setIsLoading(true);
    
    if (isLogin) {
      // Login logic
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        if (data.user) {
          Alert.alert('Success', 'Login successful!', [
            { text: 'OK', onPress: () => router.replace('/(tabs)') }
          ]);
        }
      } catch (error) {
        Alert.alert('Error', 'An unexpected error occurred');
        console.error('Login error:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Signup logic
      if (!email || !password || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all fields');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        if (data.user) {
          Alert.alert('Success', 'Account created successfully! Please complete your profile setup.', [
            { text: 'OK', onPress: () => router.push('/profile-setup') }
          ]);
        }
      } catch (error) {
        Alert.alert('Error', 'An unexpected error occurred');
        console.error('Signup error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.logo}>NEXORG</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </ThemedText>
        </View>

        {/* Form */}
        <ThemedView style={styles.form}>

          <View style={styles.inputContainer}>
            <IconSymbol name="magnifyingglass" size={20} color={colors.icon} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <IconSymbol name="eye" size={20} color={colors.icon} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <IconSymbol 
                name={showPassword ? "eye.slash" : "eye"} 
                size={20} 
                color={colors.icon} 
              />
            </TouchableOpacity>
          </View>

          {!isLogin && (
            <View style={styles.inputContainer}>
              <IconSymbol name="eye" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                              <IconSymbol 
                name={showConfirmPassword ? "eye.slash" : "eye"} 
                size={20} 
                color={colors.icon} 
              />
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton, 
              { 
                backgroundColor: isLoading ? colors.textSecondary : colors.tint,
                opacity: isLoading ? 0.7 : 1
              }
            ]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <ThemedText style={styles.submitButtonText}>
              {isLoading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
            </ThemedText>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ThemedText style={[styles.dividerText, { color: colors.textSecondary }]}>OR</ThemedText>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          {/* Microsoft Sign-In Button */}
          <TouchableOpacity
            style={[styles.microsoftButton, { borderColor: colors.border }]}
            onPress={handleMicrosoftSignIn}
            activeOpacity={0.8}
            disabled={msLoading || isLoading}
          >
            <View style={styles.microsoftButtonContent}>
              <IconSymbol name="person.circle" size={24} color="#00A4EF" />
              <ThemedText style={[styles.microsoftButtonText, { color: colors.text }]}>
                {msLoading ? 'Connecting...' : 'Continue with Microsoft'}
              </ThemedText>
            </View>
          </TouchableOpacity>

          {/* Toggle Mode */}
          <TouchableOpacity style={styles.toggleButton} onPress={toggleAuthMode}>
            <ThemedText style={[styles.toggleText, { color: colors.tint }]}>
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 44,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  submitButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    alignItems: 'center',
    padding: 16,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  microsoftButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  microsoftButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  microsoftButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
