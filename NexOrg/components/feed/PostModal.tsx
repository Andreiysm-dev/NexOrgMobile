import React, { useState } from 'react';
import {
  Modal,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  Pressable,
  Animated,
  StatusBar,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { CommentsSection } from './CommentsSection';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PostModalProps {
  visible: boolean;
  post: {
    id: string;
    title?: string;
    content: string;
    organization: string;
    organizationId: string;
    organizationLogo?: string;
    timestamp: string;
    likes: number;
    comments: number;
    media_url?: string;
    media_urls?: string[];
    user_has_liked?: boolean;
    type: 'post' | 'announcement' | 'event';
    venue?: string;
    scheduledAt?: string;
  } | null;
  onClose: () => void;
  onLike?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  isBookmarked?: boolean;
}

export function PostModal({
  visible,
  post,
  onClose,
  onLike,
  onShare,
  onBookmark,
  isBookmarked: bookmarkedPosts,
}: PostModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [liked, setLiked] = useState(post?.user_has_liked || false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);

  if (!post) return null;

  const postId = post.id || (post as any).post_id;
  const isBookmarked = bookmarkedPosts || false;

  // Safely get organization name from various possible fields
  const orgName = post.organization || 
                  (post as any).organizations?.org_name || 
                  'Organization';
  const orgLogo = post.organizationLogo || 
                  (post as any).organizations?.org_pic;
  const orgId = post.organizationId || 
                (post as any).org_id || 
                (post as any).organizationId;

  // Get all images
  const images = post.media_urls && post.media_urls.length > 0 
    ? post.media_urls 
    : post.media_url 
    ? [post.media_url] 
    : [];

  const hasMultipleImages = images.length > 1;

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const navigateToOrg = () => {
    onClose();
    if (orgId) {
      router.push(`/organization/${orgId}/dashboard`);
    }
  };

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newLiked = !liked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;

      // Optimistic update
      setLiked(newLiked);
      setLikeCount(newCount);

      if (newLiked) {
        // Add like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });

        if (error) {
          console.error('Error adding like:', error);
          // Revert on error
          setLiked(!newLiked);
          setLikeCount(likeCount);
        }
      } else {
        // Remove like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error removing like:', error);
          // Revert on error
          setLiked(!newLiked);
          setLikeCount(likeCount);
        }
      }

      // Call parent handler if provided
      onLike?.(postId);
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const getPostTypeBadge = () => {
    if (post.type === 'announcement') return 'Announcement';
    if (post.type === 'event') return 'Event';
    return 'Post';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={navigateToOrg} style={styles.orgInfo} activeOpacity={0.7}>
            {orgLogo ? (
              <Image
                source={{ uri: orgLogo }}
                style={[styles.orgLogo, styles.orgLogoShadow]}
              />
            ) : (
              <View style={[styles.orgLogoPlaceholder, styles.orgLogoShadow, { backgroundColor: '#800020' }]}>
                <ThemedText style={styles.orgLogoText}>
                  {orgName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.orgDetails}>
              <View style={styles.orgNameRow}>
                <ThemedText style={styles.orgName} numberOfLines={1}>{orgName}</ThemedText>
                <View style={[styles.typeBadge, { 
                  backgroundColor: post.type === 'announcement' ? '#3B82F6' : post.type === 'event' ? '#10B981' : '#800020' 
                }]}>
                  <Text style={styles.typeBadgeText}>{getPostTypeBadge()}</Text>
                </View>
              </View>
              <ThemedText style={styles.timestamp}>{post.timestamp}</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <IconSymbol name="xmark.circle.fill" size={32} color={colorScheme === 'dark' ? '#666' : '#999'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Images Section */}
          {images.length > 0 && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: images[currentImageIndex] }}
                style={styles.image}
                resizeMode="cover"
              />
              
              {/* Image Navigation */}
              {hasMultipleImages && (
                <>
                  <TouchableOpacity
                    style={[styles.imageNavButton, styles.imageNavLeft]}
                    onPress={handlePreviousImage}
                    activeOpacity={0.8}
                  >
                    <IconSymbol name="chevron.left.circle.fill" size={40} color="rgba(255, 255, 255, 0.9)" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.imageNavButton, styles.imageNavRight]}
                    onPress={handleNextImage}
                    activeOpacity={0.8}
                  >
                    <IconSymbol name="chevron.right.circle.fill" size={40} color="rgba(255, 255, 255, 0.9)" />
                  </TouchableOpacity>

                  {/* Dots Indicator */}
                  <View style={styles.dotsContainer}>
                    {images.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setCurrentImageIndex(index)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.dot,
                            index === currentImageIndex && styles.dotActive,
                          ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Image Counter */}
                  <View style={styles.imageCounter}>
                    <IconSymbol name="camera.fill" size={12} color="#fff" />
                    <Text style={styles.imageCounterText}>
                      {currentImageIndex + 1} / {images.length}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Post Content */}
          <View style={[styles.postContent, { backgroundColor: colors.card }]}>
            {post.title && (
              <ThemedText style={styles.postTitle} numberOfLines={3}>{post.title}</ThemedText>
            )}
            
            {post.type === 'event' && post.venue && (
              <View style={styles.eventDetail}>
                <IconSymbol name="mappin" size={16} color={colors.tabIconDefault} />
                <ThemedText style={styles.eventDetailText}>{post.venue}</ThemedText>
              </View>
            )}
            
            {post.type === 'event' && post.scheduledAt && (
              <View style={styles.eventDetail}>
                <IconSymbol name="clock" size={16} color={colors.tabIconDefault} />
                <ThemedText style={styles.eventDetailText}>
                  {new Date(post.scheduledAt).toLocaleString()}
                </ThemedText>
              </View>
            )}

            {post.content && (
              <View style={styles.contentWrapper}>
                <ThemedText
                  style={[styles.postText, { color: colors.text }]}
                  numberOfLines={isContentExpanded ? undefined : 10}
                >
                  {post.content}
                </ThemedText>
                {post.content.length > 300 && (
                  <TouchableOpacity 
                    onPress={() => setIsContentExpanded(!isContentExpanded)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showMoreButton}>
                      {isContentExpanded ? 'Show less' : 'Show more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Comments Section */}
          {post.type === 'post' && postId && (
            <View style={[styles.commentsSection, { backgroundColor: colors.card }]}>
              <View style={styles.commentsSectionHeader}>
                <ThemedText style={styles.commentsSectionTitle}>Comments</ThemedText>
              </View>
              <CommentsSection postId={postId} />
            </View>
          )}

          {post.type !== 'post' && (
            <View style={[styles.commentsSection, { backgroundColor: colors.card }]}>
              <View style={[styles.commentsPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f9fafb' }]}>
                <View style={[styles.placeholderIconCircle, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e5e7eb' }]}>
                  <IconSymbol 
                    name={post.type === 'announcement' ? 'megaphone' : 'calendar'} 
                    size={24} 
                    color={colors.tabIconDefault} 
                  />
                </View>
                <ThemedText style={[styles.commentsPlaceholderText, { color: colors.tabIconDefault }]}>
                  {post.type === 'announcement' 
                    ? 'Announcements do not have comments' 
                    : 'Events do not have comments'}
                </ThemedText>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Actions Footer */}
        {post.type === 'post' && (
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <View style={styles.statIconCircle}>
                  <IconSymbol name="heart.fill" size={14} color="#EF4444" />
                </View>
                <ThemedText style={[styles.statText, { color: colors.text }]}>{likeCount}</ThemedText>
              </View>
              <View style={styles.stat}>
                <View style={styles.statIconCircle}>
                  <IconSymbol name="message" size={14} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.statText, { color: colors.text }]}>{post.comments}</ThemedText>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, liked && styles.actionButtonActive]}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name={liked ? 'heart.fill' : 'heart'}
                  size={20}
                  color={liked ? '#EF4444' : colors.text}
                />
                <ThemedText style={[styles.actionButtonText, liked && { color: '#EF4444' }]}>Like</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  // Scroll to comments section - for now just a placeholder
                }}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name="message"
                  size={20}
                  color={colors.text}
                />
                <ThemedText style={styles.actionButtonText}>Comment</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onShare?.(post.id)}
                activeOpacity={0.7}
              >
                <IconSymbol name="square.and.arrow.up" size={20} color={colors.text} />
                <ThemedText style={styles.actionButtonText}>Share</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orgLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  orgLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgLogoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orgDetails: {
    marginLeft: 12,
    flex: 1,
  },
  orgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.4,
    backgroundColor: '#000',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -18 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNavLeft: {
    left: 16,
  },
  imageNavRight: {
    right: 16,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  postContent: {
    padding: 16,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 14,
    opacity: 0.7,
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
  },
  showMoreButton: {
    color: '#800020',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  commentsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    minHeight: 200,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  commentsPlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  commentsPlaceholderText: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orgLogoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    marginTop: 8,
  },
  showMoreButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  commentsCount: {
    backgroundColor: '#800020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  commentsCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  placeholderIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 0, 32, 0.1)',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(128, 0, 32, 0.15)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});
