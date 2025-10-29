import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { getMockUser, UserRole, type MockUser } from '@/lib/mockRoles';

interface AuthUser extends MockUser {
  supabaseUser: User | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const mockUser = getMockUser(session.user.email || '');
        setUser({
          ...mockUser,
          supabaseUser: session.user
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const mockUser = getMockUser(session.user.email || '');
          setUser({
            ...mockUser,
            supabaseUser: session.user
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    role: user?.role || 'member' as UserRole,
    email: user?.email || '',
    name: user?.name || ''
  };
}
