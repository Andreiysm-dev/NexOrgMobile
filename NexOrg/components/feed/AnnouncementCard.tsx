import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';

interface AnnouncementCardProps {
  announcement: {
    announcement_id: string;
    title: string;
    content: string;
    created_at: string;
    image?: string;
    org_id: string;
    organizations?: {
      org_name: string;
      org_pic?: string;
    };
  };
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const cardBackground = colors.card;
  const borderColor = colors.border;
  const textColor = colors.text;
  const metaColor = colors.tabIconDefault;

  const handleOrganizationPress = () => {
    router.push({
      pathname: '/organization/[id]',
      params: { 
        id: announcement.org_id, 
        orgName: announcement.organizations?.org_name || 'Organization'
      }
    });
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
    <View style={[styles.card, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.orgInfo}
          onPress={handleOrganizationPress}
        >
          <View style={[styles.orgAvatar, { backgroundColor: '#800020' }]}>
            {announcement.organizations?.org_pic ? (
              <Image 
                source={{ uri: announcement.organizations.org_pic }} 
                style={styles.orgAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <ThemedText style={styles.orgAvatarText}>
                {announcement.organizations?.org_name?.charAt(0) || 'O'}
              </ThemedText>
            )}
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.inlineHeader}>
              <ThemedText style={[styles.orgName, { color: textColor }]}>
                {announcement.organizations?.org_name || 'Organization'}
              </ThemedText>
              <IconSymbol name="megaphone" size={14} color="#800020" />
              <ThemedText style={[styles.time, { color: metaColor }]}>
                • {getTimeAgo(announcement.created_at)}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <ThemedText style={[styles.title, { color: textColor }]}>
        {announcement.title}
      </ThemedText>

      {/* Content */}
      <ThemedText style={[styles.content, { color: metaColor }]} numberOfLines={2}>
        {announcement.content}
      </ThemedText>

      {/* Image */}
      {announcement.image && (
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: announcement.image }} 
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  header: {
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
  time: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  imageWrapper: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
});
