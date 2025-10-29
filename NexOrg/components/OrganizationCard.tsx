import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface OrganizationCardProps {
  name: string;
  description?: string;
  logoUrl?: string;
  onPress?: () => void;
  onMenuPress?: () => void;
}

export function OrganizationCard({ 
  name, 
  description, 
  logoUrl, 
  onPress, 
  onMenuPress 
}: OrganizationCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Logo placeholder */}
        <View style={[styles.logoContainer, { backgroundColor: colors.sidebar }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} />
          ) : (
            <IconSymbol name="building.2" size={32} color={colors.icon} />
          )}
        </View>
        
        {/* Organization info */}
        <View style={styles.infoContainer}>
          <ThemedText type="defaultSemiBold" style={styles.organizationName}>
            {name}
          </ThemedText>
          {description && (
            <ThemedText 
              style={[styles.description, { color: colors.textSecondary }]} 
              numberOfLines={3}
            >
              {description}
            </ThemedText>
          )}
        </View>
        
        {/* Menu button */}
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="ellipsis" size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
  },
  organizationName: {
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  description: {
    marginTop: 4,
    fontSize: 14,
  },
  menuButton: {
    padding: 4,
  },
});
