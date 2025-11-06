import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

// Enable browser session to be dismissed properly
WebBrowser.maybeCompleteAuthSession();

export function useMicrosoftAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign in with Microsoft using Supabase OAuth
  const signInWithMicrosoft = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mobile app redirect URL - where Supabase will redirect after OAuth
      const redirectUrl = 'nexorgmobileapplication://auth/callback';

      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: redirectUrl,
        },
      });

      if (authError) {
        throw authError;
      }

      if (data?.url) {
        // Open the OAuth URL in the browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Extract tokens from URL fragment (after #)
          const hashParams = new URLSearchParams(result.url.split('#')[1] || '');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('🔵 Setting session with tokens...');
            // Set the session with the tokens
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('🔴 Session error:', sessionError);
              throw sessionError;
            }

            console.log('✅ Session set successfully:', sessionData?.session?.user?.email);
            
            // Verify session was set
            const { data: { session } } = await supabase.auth.getSession();
            console.log('🔵 Verified session:', session?.user?.email);

            return { success: true };
          } else {
            console.error('🔴 No tokens in URL');
            setError('No authentication tokens received');
            return { success: false, error: 'No tokens received' };
          }
        } else if (result.type === 'cancel') {
          setError('Sign-in was cancelled');
          return { success: false };
        } else {
          setError('Authentication failed');
          return { success: false };
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with Microsoft';
      setError(errorMessage);
      console.error('Microsoft sign-in error:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    setError(null);
    await supabase.auth.signOut();
  };

  return {
    loading,
    error,
    signInWithMicrosoft,
    signOut,
  };
}
