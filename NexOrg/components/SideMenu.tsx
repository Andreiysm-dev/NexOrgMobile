import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Organization {
  id: string;
  name: string;
  shortName?: string;
  org_pic?: string;
  orgPic?: string; // Keep for backward compatibility
  memberCount?: number;
  role?: string;
  status?: string;
  color?: string;
}

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  organizations: Organization[];
  onOrganizationPress: (orgId: string, orgName: string) => void;
  onProfilePress?: () => void;
  onSettingsPress?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const MENU_WIDTH = screenWidth * 0.8; // 80% of screen width

export function SideMenu({
  visible,
  onClose,
  organizations,
  onOrganizationPress,
  onProfilePress,
  onSettingsPress,
}: SideMenuProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Debug organizations data
  React.useEffect(() => {
    console.log('SideMenu received organizations:', organizations);
    console.log('Organizations length:', organizations?.length || 0);
    if (organizations?.length > 0) {
      console.log('First organization:', organizations[0]);
    }
  }, [organizations]);

  const slideAnim = React.useRef(new Animated.Value(-MENU_WIDTH)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -MENU_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Side Menu with smooth animation */}
        <Animated.View
          style={[
            styles.menuContainer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.headerContent}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  NexOrg
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <IconSymbol name="chevron.left" size={24} color={colors.tabIconDefault} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.menuContent}>
              {/* Profile Section */}
              <TouchableOpacity
                style={styles.orgItem}
                onPress={onProfilePress}
              >
                <View style={styles.orgItemContent}>
                  <View style={styles.orgIconContainer}>
                    <View style={[styles.orgIconPlaceholder, { backgroundColor: colors.tint }]}>
                      <IconSymbol name="person.fill" size={20} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>My Profile</Text>
                    <Text style={styles.orgMembers}>Account Settings</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.tabIconDefault} />
              </TouchableOpacity>

              {/* Organizations Section */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.tabIconDefault }]}>
                  MY ORGANIZATIONS
                </Text>
              </View>

              {organizations && organizations.length > 0 ? (
                organizations.map((org, index) => {
                  console.log(`Rendering org ${index}:`, org);
                  
                  // Ensure we have required fields
                  if (!org || !org.id || !org.name) {
                    console.warn('Invalid org data:', org);
                    return null;
                  }
                  
                  return (
                    <TouchableOpacity
                      key={org.id || `org-${index}`}
                      style={styles.orgItem}
                      onPress={() => {
                        console.log('Org pressed:', org.name);
                        onOrganizationPress(org.id, org.name);
                        onClose();
                      }}
                    >
                      <View style={styles.orgItemContent}>
                        <View style={styles.orgIconContainer}>
                          {(org.org_pic || org.orgPic) ? (
                            <Image
                              source={{ uri: org.org_pic || org.orgPic }}
                              style={styles.orgIcon}
                              onError={() => console.log('Image load error for:', org.name)}
                            />
                          ) : (
                            <View style={[styles.orgIconPlaceholder, { backgroundColor: org.color || colors.tint }]}>
                              <Text style={styles.orgIconText}>
                                {org.shortName?.charAt(0) || org.name?.charAt(0) || '?'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.orgInfo}>
                          <Text style={styles.orgName} numberOfLines={1}>
                            {org.name || 'Unknown Org'}
                          </Text>
                          <Text style={styles.orgMembers}>
                            {org.role || 'Member'} • {org.status || 'Active'}
                          </Text>
                        </View>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={colors.tabIconDefault} />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="building.2" size={48} color={colors.tabIconDefault} />
                  <Text style={[styles.emptyStateText, { color: colors.tabIconDefault }]}>
                    No organizations yet
                  </Text>
                  <Text style={[styles.emptyStateSubtext, { color: colors.tabIconDefault }]}>
                    Join or create an organization to get started
                  </Text>
                </View>
              )}

              {/* Other Menu Items */}
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              
              {/* Quick Actions */}
              <TouchableOpacity
                style={styles.orgItem}
                onPress={() => {
                  onClose();
                  // Add notifications handler later
                }}
              >
                <View style={styles.orgItemContent}>
                  <View style={styles.orgIconContainer}>
                    <View style={[styles.orgIconPlaceholder, { backgroundColor: '#FF6B6B' }]}>
                      <IconSymbol name="bell.fill" size={20} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>Notifications</Text>
                    <Text style={styles.orgMembers}>View all alerts</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.tabIconDefault} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.orgItem}
                onPress={onSettingsPress}
              >
                <View style={styles.orgItemContent}>
                  <View style={styles.orgIconContainer}>
                    <View style={[styles.orgIconPlaceholder, { backgroundColor: '#4ECDC4' }]}>
                      <IconSymbol name="gearshape.fill" size={20} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>Settings</Text>
                    <Text style={styles.orgMembers}>App preferences</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.tabIconDefault} />
              </TouchableOpacity>

              {/* Help & Support */}
              <TouchableOpacity
                style={styles.orgItem}
                onPress={() => {
                  onClose();
                  // Add help handler later
                }}
              >
                <View style={styles.orgItemContent}>
                  <View style={styles.orgIconContainer}>
                    <View style={[styles.orgIconPlaceholder, { backgroundColor: '#A8E6CF' }]}>
                      <IconSymbol name="questionmark.circle.fill" size={20} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>Help & Support</Text>
                    <Text style={styles.orgMembers}>Get assistance</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.tabIconDefault} />
              </TouchableOpacity>

              {/* Add some bottom padding */}
              <View style={{ height: 50 }} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    zIndex: 1000,
  },
  menuContainer: {
    width: MENU_WIDTH,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
  },
  menuContent: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#000000',
    flex: 1,
  },
  orgItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 60,
    backgroundColor: 'transparent',
  },
  orgItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orgIconContainer: {
    marginRight: 16,
  },
  orgIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  orgIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
    color: '#000000',
  },
  orgMembers: {
    fontSize: 12,
    color: '#666666',
  },
  separator: {
    height: 8,
    marginVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  debugInfo: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  debugText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
