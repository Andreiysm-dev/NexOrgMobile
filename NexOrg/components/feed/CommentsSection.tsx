import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PostComment, fetchPostComments, addPostComment, deletePostComment } from '@/lib/api';
import { CommentThread } from './CommentThread';
import { supabase } from '@/lib/supabase';

interface CommentsSectionProps {
  postId: string;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
    getCurrentUser();
  }, [postId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedComments = await fetchPostComments(postId);
      setComments(fetchedComments);
    } catch (err) {
      console.error('Error loading comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    if (!currentUserId) {
      Alert.alert('Error', 'You must be logged in to comment');
      return;
    }

    try {
      setIsSubmitting(true);
      await addPostComment(postId, newComment.trim());
      setNewComment('');
      await loadComments(); // Reload comments
    } catch (error) {
      console.error('Failed to submit comment:', error);
      Alert.alert('Error', 'Failed to submit comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (content: string, replyToCommentId: string) => {
    if (!currentUserId) {
      Alert.alert('Error', 'You must be logged in to reply');
      return;
    }

    try {
      await addPostComment(postId, content, replyToCommentId);
      await loadComments(); // Reload comments
    } catch (error) {
      console.error('Failed to submit reply:', error);
      throw error;
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deletePostComment(commentId);
      await loadComments(); // Reload comments
    } catch (error) {
      console.error('Failed to delete comment:', error);
      throw error;
    }
  };

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
        <ThemedText style={styles.errorText}>Failed to load comments: {error}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Comment Input */}
      {currentUserId && (
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Write a comment..."
            placeholderTextColor={colors.tabIconDefault}
            value={newComment}
            onChangeText={setNewComment}
            maxLength={500}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || isSubmitting}
            style={[
              styles.submitButton,
              (!newComment.trim() || isSubmitting) && styles.submitButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol name="paperplane.fill" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Comments List */}
      <View style={styles.commentsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#800020" />
            <ThemedText style={styles.loadingText}>Loading comments...</ThemedText>
          </View>
        ) : comments.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f9fafb' }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e5e7eb' }]}>
              <IconSymbol name="message" size={32} color={colors.tabIconDefault} />
            </View>
            <ThemedText style={[styles.emptyText, { color: colors.tabIconDefault }]}>
              No comments yet. Be the first to comment!
            </ThemedText>
          </View>
        ) : (
          <View style={styles.commentsList}>
            {comments.map((comment) => (
              <CommentThread
                key={comment.comment_id}
                comment={comment}
                currentUserId={currentUserId || ''}
                onReply={handleReply}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#800020',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  commentsContainer: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  commentsList: {
    gap: 8,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
});
