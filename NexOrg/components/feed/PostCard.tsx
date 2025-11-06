import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Image, Alert, StyleSheet, PanResponder, Animated, Modal, Pressable } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface PostCardProps {
  post: {
    post_id?: string;
    id?: string;
    title?: string;
    content: string;
    created_at?: string;
    timestamp?: string;
    media_url?: string;
    media_urls?: string[];
    org_id?: string;
    organizationId?: string;
    organizations?: {
      org_name?: string;
      org_pic?: string;
    };
    organization?: string;
    organizationLogo?: string;
    user_has_liked?: boolean;
    like_count?: number;
    comment_count?: number;
    comments?: number;
    type?: string;
    is_pinned?: boolean;
  };
  onPress?: () => void;
  onLikeUpdate?: (postId: string, liked, newCount: number) => void;
  showActions?: boolean;
  onPin?: (postId: string, isPinned: boolean) => void;
  onEdit?: (post: any) => void;
  onDelete?: (postId: string) => void;
  onViewReactions?: (postId: string) => void;
}

export function PostCard({ post, onPress, onLikeUpdate, showActions, onPin, onEdit, onDelete, onViewReactions }: PostCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  
  // Normalize data - handle both FeedPost and raw post structures
  const postId = post.post_id || post.id || '';
  const orgId = post.org_id || post.organizationId || '';
  const orgName = post.organizations?.org_name || post.organization || 'Organization';
  const orgPic = post.organizations?.org_pic || post.organizationLogo;
  const createdAt = post.created_at || post.timestamp || '';
  const commentCount = post.comment_count || post.comments || 0;
  
  const [isLiked, setIsLiked] = useState(post.user_has_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Update state when post prop changes
  useEffect(() => {
    setIsLiked(post.user_has_liked || false);
    setLikeCount(post.like_count || 0);
  }, [post.user_has_liked, post.like_count]);
  
  // Image carousel state
  const validImages = (post.media_urls && Array.isArray(post.media_urls)) 
    ? post.media_urls.filter((url: string) => url && url.trim() !== '') 
    : (post.media_url && post.media_url.trim() !== '') ? [post.media_url] : [];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasMultipleImages = validImages.length > 1;

  // Swipe gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => hasMultipleImages,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return hasMultipleImages && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (hasMultipleImages) {
          // Swipe left (next image)
          if (gestureState.dx < -50) {
            setCurrentImageIndex(prev => prev === validImages.length - 1 ? 0 : prev + 1);
          }
          // Swipe right (previous image)
          else if (gestureState.dx > 50) {
            setCurrentImageIndex(prev => prev === 0 ? validImages.length - 1 : prev - 1);
          }
        }
      },
    })
  ).current;

  const cardBackground = colors.card;
  const borderColor = colors.border;
  const textColor = colors.text;
  const metaColor = colors.tabIconDefault;

  const handleOrganizationPress = () => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: orgId, 
        orgName: orgName
      }
    });
  };

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to like posts');
        setIsLiking(false);
        return;
      }

      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        const { count } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);

        const newCount = count || 0;
        setIsLiked(false);
        setLikeCount(newCount);
        
        if (onLikeUpdate) {
          onLikeUpdate(postId, false, newCount);
        }
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) {
          // If duplicate key error (already liked), just update the UI state
          if (error.code === '23505') {
            setIsLiked(true);
            // Fetch current count
            const { count } = await supabase
              .from('post_likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', postId);
            const newCount = count || 0;
            setLikeCount(newCount);
            if (onLikeUpdate) {
              onLikeUpdate(postId, true, newCount);
            }
            return;
          }
          throw error;
        }

        const { count } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);

        const newCount = count || 0;
        setIsLiked(true);
        setLikeCount(newCount);
        
        if (onLikeUpdate) {
          onLikeUpdate(postId, true, newCount);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    } finally {
      setIsLiking(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  return (
    <TouchableOpacity 
      style={[styles.postCard, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={!onPress}
    >
      {/* Pinned badge */}
      {post.is_pinned && (
        <View style={styles.pinnedBadge}>
          <IconSymbol name="pin.fill" size={12} color="white" />
          <ThemedText style={styles.pinnedText}>Pinned</ThemedText>
        </View>
      )}

      {/* Post header */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.orgInfo}
          onPress={handleOrganizationPress}
          activeOpacity={0.7}
        >
          <View style={[styles.orgAvatar, { backgroundColor: '#800020' }]}>
            {orgPic ? (
              <Image 
                source={{ uri: orgPic }} 
                style={styles.orgAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <ThemedText style={styles.orgAvatarText}>
                {orgName.charAt(0) || 'O'}
              </ThemedText>
            )}
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.inlineHeader}>
              <ThemedText style={[styles.orgName, { color: textColor }]}>
                {orgName}
              </ThemedText>
              <ThemedText style={[styles.postTime, { color: metaColor }]}>
                • {getTimeAgo(createdAt)}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions menu button */}
        {showActions && (
          <TouchableOpacity 
            style={styles.actionsButton}
            onPress={() => setShowActionsMenu(true)}
          >
            <IconSymbol name="ellipsis" size={20} color={metaColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* Actions Modal */}
      <Modal
        visible={showActionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowActionsMenu(false)}
        >
          <View style={[styles.actionsModal, { backgroundColor: cardBackground }]}>
            <View style={styles.actionsModalHeader}>
              <ThemedText style={[styles.actionsModalTitle, { color: textColor }]}>
                Post Actions
              </ThemedText>
              <TouchableOpacity onPress={() => setShowActionsMenu(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={metaColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionsContainer}>
              {onViewReactions && (
                <TouchableOpacity
                  style={[styles.actionItem, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    setShowActionsMenu(false);
                    onViewReactions(postId);
                  }}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: '#3B82F6' }]}>
                    <IconSymbol name="heart.fill" size={20} color="white" />
                  </View>
                  <ThemedText style={[styles.actionItemText, { color: textColor }]}>
                    View Reactions
                  </ThemedText>
                  <IconSymbol name="chevron.right" size={16} color={metaColor} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionItem, { borderBottomColor: borderColor }]}
                onPress={() => {
                  setShowActionsMenu(false);
                  onPin?.(postId, post.is_pinned || false);
                }}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: post.is_pinned ? '#EF4444' : '#10B981' }]}>
                  <IconSymbol name={post.is_pinned ? "pin.slash.fill" : "pin.fill"} size={20} color="white" />
                </View>
                <ThemedText style={[styles.actionItemText, { color: textColor }]}>
                  {post.is_pinned ? 'Unpin Post' : 'Pin Post'}
                </ThemedText>
                <IconSymbol name="chevron.right" size={16} color={metaColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, { borderBottomColor: borderColor }]}
                onPress={() => {
                  setShowActionsMenu(false);
                  onEdit?.(post);
                }}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#F59E0B' }]}>
                  <IconSymbol name="pencil" size={20} color="white" />
                </View>
                <ThemedText style={[styles.actionItemText, { color: textColor }]}>
                  Edit Post
                </ThemedText>
                <IconSymbol name="chevron.right" size={16} color={metaColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setShowActionsMenu(false);
                  onDelete?.(postId);
                }}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#EF4444' }]}>
                  <IconSymbol name="trash.fill" size={20} color="white" />
                </View>
                <ThemedText style={[styles.actionItemText, { color: '#EF4444' }]}>
                  Delete Post
                </ThemedText>
                <IconSymbol name="chevron.right" size={16} color={metaColor} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: borderColor }]}
              onPress={() => setShowActionsMenu(false)}
            >
              <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Post title */}
      {post.title && (
        <ThemedText style={[styles.postTitle, { color: textColor }]}>
          {post.title}
        </ThemedText>
      )}

      {/* Post content */}
      <ThemedText style={[styles.postContent, { color: metaColor }]} numberOfLines={2}>
        {post.content}
      </ThemedText>

      {/* Media carousel */}
      {validImages.length > 0 && (
        <View style={styles.imageWrapper} {...panResponder.panHandlers}>
          <Image 
            source={{ uri: validImages[currentImageIndex] }} 
            style={styles.postImage}
            resizeMode="cover"
          />
          
          {hasMultipleImages && (
            <>
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() => setCurrentImageIndex(prev => prev === 0 ? validImages.length - 1 : prev - 1)}
              >
                <IconSymbol name="chevron.left" size={20} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() => setCurrentImageIndex(prev => prev === validImages.length - 1 ? 0 : prev + 1)}
              >
                <IconSymbol name="chevron.right" size={20} color="white" />
              </TouchableOpacity>
              
              <View style={styles.dotsContainer}>
                {validImages.map((_: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setCurrentImageIndex(idx)}
                    style={[
                      styles.dot,
                      idx === currentImageIndex ? styles.dotActive : styles.dotInactive
                    ]}
                  />
                ))}
              </View>
              
              <View style={styles.imageCounter}>
                <IconSymbol name="photo" size={12} color="white" />
                <ThemedText style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {validImages.length}
                </ThemedText>
              </View>
            </>
          )}
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <View style={styles.leftActions}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { 
                backgroundColor: isLiked ? 'rgba(128, 0, 32, 0.1)' : 'transparent', 
                borderColor: isLiked ? '#800020' : borderColor 
              }
            ]}
            onPress={handleLike}
            disabled={isLiking}
          >
            <IconSymbol 
              name={isLiked ? "heart.fill" : "heart"} 
              size={16} 
              color={isLiked ? '#800020' : metaColor} 
            />
            <ThemedText style={[styles.actionText, { color: isLiked ? '#800020' : metaColor }]}>
              {likeCount}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: 'transparent', borderColor }]}>
            <IconSymbol name="message" size={16} color={metaColor} />
            <ThemedText style={[styles.actionText, { color: metaColor }]}>
              {commentCount}
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: 'transparent', borderColor }]}>
          <IconSymbol name="square.and.arrow.up" size={16} color={metaColor} />
          <ThemedText style={[styles.actionText, { color: metaColor }]}>
            Share
          </ThemedText>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  postCard: {
    padding: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orgAvatarImage: {
    width: '100%',
    height: '100%',
  },
  orgAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
  },
  postTime: {
    fontSize: 12,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  imageWrapper: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: 200,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    left: 8,
  },
  navButtonRight: {
    right: 8,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: 'white',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 50,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pinnedBadge: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pinnedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionsButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionsContainer: {
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
