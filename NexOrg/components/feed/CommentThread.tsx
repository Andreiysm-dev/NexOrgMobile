import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PostComment } from '@/lib/api';

interface CommentThreadProps {
  comment: PostComment;
  currentUserId: string;
  onReply: (content: string, replyToCommentId: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  depth?: number;
  maxDepth?: number;
}

export function CommentThread({
  comment,
  currentUserId,
  onReply,
  onDelete,
  depth = 0,
  maxDepth = 3,
}: CommentThreadProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwnComment = comment.user_id === currentUserId;
  const canReply = depth < maxDepth;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return;

    try {
      setIsSubmitting(true);
      await onReply(replyContent.trim(), comment.comment_id);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Failed to submit reply:', error);
      Alert.alert('Error', 'Failed to submit reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(comment.comment_id);
            } catch (error) {
              console.error('Failed to delete comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  return (
    <View style={[styles.container, depth > 0 && styles.nestedContainer]}>
      <View style={[styles.commentCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f9fafb' }]}>
        {/* Comment Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            {comment.profile?.profile_image ? (
              <Image
                source={{ uri: comment.profile.profile_image }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.avatarText}>
                  {(comment.profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <ThemedText style={styles.userName}>
                {comment.profile?.full_name || 'Unknown User'}
              </ThemedText>
              <ThemedText style={styles.timestamp}>
                {formatTimeAgo(comment.created_at)}
              </ThemedText>
            </View>
          </View>

          {isOwnComment && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <IconSymbol name="trash" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Comment Content */}
        <ThemedText style={[styles.content, { color: colors.text }]}>
          {comment.content}
        </ThemedText>

        {/* Reply Button */}
        {canReply && (
          <TouchableOpacity
            onPress={() => setShowReplyForm(!showReplyForm)}
            style={styles.replyButton}
          >
            <ThemedText style={styles.replyButtonText}>Reply</ThemedText>
          </TouchableOpacity>
        )}

        {/* Reply Form */}
        {showReplyForm && (
          <View style={styles.replyForm}>
            <TextInput
              style={[
                styles.replyInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Write a reply..."
              placeholderTextColor={colors.tabIconDefault}
              value={replyContent}
              onChangeText={setReplyContent}
              maxLength={200}
              multiline
            />
            <View style={styles.replyActions}>
              <TouchableOpacity
                onPress={handleReplySubmit}
                disabled={!replyContent.trim() || isSubmitting}
                style={[
                  styles.replySubmitButton,
                  (!replyContent.trim() || isSubmitting) && styles.replySubmitButtonDisabled,
                ]}
              >
                <Text style={styles.replySubmitButtonText}>
                  {isSubmitting ? '...' : 'Reply'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowReplyForm(false);
                  setReplyContent('');
                }}
                style={styles.replyCancelButton}
              >
                <Text style={styles.replyCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Nested Replies */}
      {hasReplies && (
        <View style={styles.repliesContainer}>
          {comment.replies!.map((reply) => (
            <CommentThread
              key={reply.comment_id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  nestedContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  commentCard: {
    borderRadius: 8,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userDetails: {
    marginLeft: 8,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  replyButton: {
    alignSelf: 'flex-start',
  },
  replyButtonText: {
    fontSize: 12,
    color: '#800020',
    fontWeight: '500',
  },
  replyForm: {
    marginTop: 8,
    gap: 8,
  },
  replyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  replySubmitButton: {
    backgroundColor: '#800020',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  replySubmitButtonDisabled: {
    opacity: 0.5,
  },
  replySubmitButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  replyCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyCancelButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 8,
  },
});
