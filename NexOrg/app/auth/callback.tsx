import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('🔵 Auth callback started');
      // Wait a moment for Supabase to process the OAuth callback
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('🔵 Session check:', session?.user?.email);
      console.log('🔵 Session error:', sessionError);

      if (sessionError) {
        console.error('🔴 Session error:', sessionError);
        setError(sessionError.message);
        setTimeout(() => router.replace('/auth'), 2000);
        return;
      }

      if (session?.user) {
        console.log('✅ User authenticated:', session.user.email);
        // Successfully authenticated, redirect to main app
        router.replace('/(tabs)');
      } else {
        console.error('🔴 No session found');
        setError('Authentication failed');
        setTimeout(() => router.replace('/auth'), 2000);
      }
    } catch (err) {
      console.error('🔴 Callback error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTimeout(() => router.replace('/auth'), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0066CC" />
      <ThemedText style={styles.text}>
        {error ? `Error: ${error}` : 'Completing sign in...'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
  },
});
