import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Notification } from '@/lib/api';

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
}

export function NotificationItem({ notification, onPress, onMarkAsRead }: NotificationItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_liked':
        return { name: 'heart.fill' as const, color: '#EF4444' };
      case 'post_commented':
      case 'post_comment_reply':
        return { name: 'message.fill' as const, color: '#3B82F6' };
      case 'post_created':
        return { name: 'doc.fill' as const, color: '#10B981' };
      case 'redbook_approved':
      case 'redbook_submitted':
      case 'redbook_rejected':
        return { name: 'book.fill' as const, color: '#8B5CF6' };
      case 'organization_approved':
      case 'organization_rejected':
        return { name: 'person.3.fill' as const, color: '#F59E0B' };
      case 'event_approved':
      case 'event_submitted':
      case 'event_rejected':
        return { name: 'calendar' as const, color: '#6366F1' };
      case 'announcement_created':
        return { name: 'megaphone.fill' as const, color: '#EC4899' };
      case 'member_joined':
        return { name: 'person.badge.plus' as const, color: '#10B981' };
      default:
        return { name: 'bell.fill' as const, color: '#6B7280' };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: '#EF4444', label: 'Urgent' };
      case 'high':
        return { color: '#F59E0B', label: 'High' };
      case 'normal':
        return { color: '#3B82F6', label: 'Normal' };
      case 'low':
        return { color: '#6B7280', label: 'Low' };
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const icon = getNotificationIcon(notification.notification_type);
  const priorityBadge = getPriorityBadge(notification.priority);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: notification.is_read
            ? colors.card
            : colorScheme === 'dark'
            ? 'rgba(128, 0, 32, 0.1)'
            : 'rgba(128, 0, 32, 0.05)',
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
        <IconSymbol name={icon.name} size={20} color={icon.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {notification.title}
          </ThemedText>
          {!notification.is_read && (
            <View style={styles.unreadDot} />
          )}
        </View>

        <ThemedText style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {notification.message}
        </ThemedText>

        <View style={styles.footer}>
          <ThemedText style={[styles.time, { color: colors.tabIconDefault }]}>
            {formatTimeAgo(notification.created_at)}
          </ThemedText>
          {priorityBadge && priorityBadge.label !== 'Normal' && (
            <View style={[styles.priorityBadge, { backgroundColor: `${priorityBadge.color}20` }]}>
              <Text style={[styles.priorityText, { color: priorityBadge.color }]}>
                {priorityBadge.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Mark as read button */}
      {!notification.is_read && onMarkAsRead && (
        <TouchableOpacity
          style={styles.markReadButton}
          onPress={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.notification_id);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="checkmark.circle.fill" size={20} color="#800020" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#800020',
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    opacity: 0.8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 11,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  markReadButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
