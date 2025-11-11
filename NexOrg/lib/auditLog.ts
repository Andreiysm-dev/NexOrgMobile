/**
 * Audit Log utility for mobile app
 * Creates audit log entries for organization actions
 */

import { supabase } from './supabase';

export type AuditActionType = 
  | 'member_join'
  | 'member_leave'
  | 'member_kick'
  | 'member_ban'
  | 'role_update'
  | 'settings_change'
  | 'post_create'
  | 'post_delete'
  | 'announcement_create'
  | 'announcement_delete'
  | 'invite_create'
  | 'channel_create'
  | 'channel_delete';

interface CreateAuditLogParams {
  orgId: string;
  userId: string;
  actionType: AuditActionType;
  actionDescription: string;
  targetType?: 'user' | 'role' | 'channel' | 'post' | 'announcement' | 'invite';
  targetId?: string;
  targetName?: string;
  details?: {
    before?: any;
    after?: any;
    reason?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (params: CreateAuditLogParams): Promise<boolean> => {
  try {
    console.log('Creating audit log with params:', params);
    
    const auditLogData = {
      org_id: params.orgId,
      user_id: params.userId,
      action_type: params.actionType,
      action_description: params.actionDescription,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      target_name: params.targetName || null,
      details: params.details || {},
      created_at: new Date().toISOString()
    };
    
    console.log('Inserting audit log data:', auditLogData);
    
    const { error, data } = await supabase
      .from('audit_logs')
      .insert(auditLogData)
      .select();

    if (error) {
      console.error('Supabase error creating audit log:', error);
      return false;
    }

    console.log('Audit log created successfully:', data);
    return true;
  } catch (error) {
    console.error('Exception creating audit log:', error);
    return false;
  }
};

/**
 * Helper functions for common audit log scenarios
 */

export const logMemberJoin = async (
  orgId: string,
  userId: string,
  actorName: string,
  targetUserId: string,
  targetUserName: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'member_join',
    actionDescription: `${actorName} approved ${targetUserName}'s join request`,
    targetType: 'user',
    targetId: targetUserId,
    targetName: targetUserName
  });
};

export const logMemberKick = async (
  orgId: string,
  userId: string,
  actorName: string,
  targetUserId: string,
  targetUserName: string,
  reason?: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'member_kick',
    actionDescription: `${actorName} removed ${targetUserName} from the organization`,
    targetType: 'user',
    targetId: targetUserId,
    targetName: targetUserName,
    details: reason ? { reason } : undefined
  });
};

export const logPostCreate = async (
  orgId: string,
  userId: string,
  actorName: string,
  postId: string,
  postTitle: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'post_create',
    actionDescription: `${actorName} created a post: "${postTitle}"`,
    targetType: 'post',
    targetId: postId,
    targetName: postTitle
  });
};

export const logPostDelete = async (
  orgId: string,
  userId: string,
  actorName: string,
  postId: string,
  postTitle: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'post_delete',
    actionDescription: `${actorName} deleted a post: "${postTitle}"`,
    targetType: 'post',
    targetId: postId,
    targetName: postTitle
  });
};

export const logAnnouncementCreate = async (
  orgId: string,
  userId: string,
  actorName: string,
  announcementId: string,
  announcementTitle: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'announcement_create',
    actionDescription: `${actorName} created an announcement: "${announcementTitle}"`,
    targetType: 'announcement',
    targetId: announcementId,
    targetName: announcementTitle
  });
};

export const logAnnouncementDelete = async (
  orgId: string,
  userId: string,
  actorName: string,
  announcementId: string,
  announcementTitle: string
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'announcement_delete',
    actionDescription: `${actorName} deleted an announcement: "${announcementTitle}"`,
    targetType: 'announcement',
    targetId: announcementId,
    targetName: announcementTitle
  });
};

export const logSettingsChange = async (
  orgId: string,
  userId: string,
  actorName: string,
  changes: Record<string, any>
) => {
  return createAuditLog({
    orgId,
    userId,
    actionType: 'settings_change',
    actionDescription: `${actorName} updated organization settings`,
    details: {
      after: changes
    }
  });
};
