/**
 * Web API functions for mobile app - uses the same endpoints as web version
 */

import { supabase } from './supabase';

/**
 * Delete a post using web API approach
 */
export const deletePostViaWebAPI = async (orgId: string, postId: string): Promise<void> => {
  try {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');

    // Use the web API endpoint directly
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/organizations/${orgId}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete post');
    }

    const result = await response.json();
    console.log('Post deleted via web API:', result);
  } catch (error) {
    console.error('Error deleting post via web API:', error);
    throw error;
  }
};

/**
 * Create audit log using web API endpoint
 */
export const createAuditLogViaWebAPI = async (
  orgId: string,
  actionType: string,
  actionDescription: string,
  targetType?: string,
  targetId?: string,
  targetName?: string,
  details?: Record<string, any>
): Promise<void> => {
  try {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');

    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/organizations/${orgId}/audit-logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actionType,
        actionDescription,
        targetType,
        targetId,
        targetName,
        details: details || {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create audit log');
    }

    const result = await response.json();
    console.log('Audit log created via web API:', result);
  } catch (error) {
    console.error('Error creating audit log via web API:', error);
    throw error;
  }
};
