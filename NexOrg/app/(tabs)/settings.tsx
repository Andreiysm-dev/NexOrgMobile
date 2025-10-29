import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/contexts/ThemeContext'; // Added theme context
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Switch, 
  Alert,
  Linking,
  Share,
  Modal
} from 'react-native';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [profilePublic, setProfilePublic] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showThemeModal, setShowThemeModal] = useState(false); // Added theme modal state

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { theme, toggleTheme, isSystemTheme } = useTheme(); // Added theme context

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  // Added theme toggle handler
  const handleThemeSelection = async (selectedTheme: 'light' | 'dark' | 'system') => {
    try {
      console.log('Changing theme to:', selectedTheme); // Debug log
      await toggleTheme(selectedTheme === 'system' ? 'system' : selectedTheme);
      setShowThemeModal(false);
    } catch (error) {
      console.error('Error changing theme:', error);
    }
  };

  // Added theme display text helper
  const getThemeDisplayText = () => {
    if (isSystemTheme) return 'System Default';
    return theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out');
            } else {
              router.replace('/auth');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out NexOrg - the ultimate university organization management app!',
        title: 'NexOrg App'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRateApp = () => {
    Alert.alert(
      'Rate NexOrg',
      'We\'d love to hear your feedback! Would you like to rate us on the App Store?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Rate App', onPress: () => {
          Linking.openURL('https://apps.apple.com/app/nexorg');
        }}
      ]
    );
  };

  const handleSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact our support team?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@nexorg.app') },
        { text: 'Website', onPress: () => Linking.openURL('https://nexorg.app/support') }
      ]
    );
  };

  const SettingItem = ({ 
    title, 
    subtitle, 
    icon, 
    onPress, 
    rightElement, 
    showArrow = false,
    destructive = false 
  }: any) => (
    <TouchableOpacity 
      style={[styles.settingItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
          <IconSymbol 
            name={icon} 
            size={20} 
            color={destructive ? '#DC2626' : colors.tint} 
          />
        </View>
        <View style={styles.settingItemText}>
          <ThemedText style={[
            styles.settingItemTitle,
            destructive && { color: '#DC2626' }
          ]}>
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText style={[styles.settingItemSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      </View>
      <View style={styles.settingItemRight}>
        {rightElement}
        {showArrow && (
          <IconSymbol 
            name="chevron.right" 
            size={16} 
            color={colors.textSecondary} 
            style={styles.arrowIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <ThemedText style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
        {title.toUpperCase()}
      </ThemedText>
    </View>
  );

  // Added Theme Modal Component
  const ThemeModal = () => (
    <Modal
      visible={showThemeModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowThemeModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowThemeModal(false)}
      >
        <View style={[styles.themeModal, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.modalTitle}>Choose Theme</ThemedText>
          
          <TouchableOpacity
            style={[styles.themeOption, isSystemTheme && styles.selectedThemeOption]}
            onPress={() => handleThemeSelection('system')}
          >
            <IconSymbol name="gear" size={20} color={colors.text} />
            <ThemedText style={styles.themeOptionText}>System Default</ThemedText>
            {isSystemTheme && <IconSymbol name="checkmark" size={16} color={colors.tint} />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.themeOption, !isSystemTheme && theme === 'light' && styles.selectedThemeOption]}
            onPress={() => handleThemeSelection('light')}
          >
            <IconSymbol name="sun.max" size={20} color={colors.text} />
            <ThemedText style={styles.themeOptionText}>Light Mode</ThemedText>
            {!isSystemTheme && theme === 'light' && <IconSymbol name="checkmark" size={16} color={colors.tint} />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.themeOption, !isSystemTheme && theme === 'dark' && styles.selectedThemeOption]}
            onPress={() => handleThemeSelection('dark')}
          >
            <IconSymbol name="moon" size={20} color={colors.text} />
            <ThemedText style={styles.themeOptionText}>Dark Mode</ThemedText>
            {!isSystemTheme && theme === 'dark' && <IconSymbol name="checkmark" size={16} color={colors.tint} />}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <ThemedText type="title" style={styles.headerTitle}>Settings</ThemedText>
      </View>

      {/* User Section */}
      {user && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity 
            style={styles.userSection}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={[styles.userAvatar, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.userAvatarText}>
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </ThemedText>
            </View>
            <View style={styles.userInfo}>
              <ThemedText style={styles.userName}>
                {user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
              </ThemedText>
              <ThemedText style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user.email}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Account Settings */}
      <SectionHeader title="Account" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="person.circle"
          title="Edit Profile"
          subtitle="Update your personal information"
          onPress={() => router.push('/(tabs)/profile')}
          showArrow
        />
        <SettingItem
          icon="lock"
          title="Privacy & Security"
          subtitle="Manage your privacy settings"
          onPress={() => Alert.alert('Privacy Settings', 'Privacy settings will be available in the next update!')}
          showArrow
        />
        <SettingItem
          icon="key"
          title="Change Password"
          subtitle="Update your account password"
          onPress={() => Alert.alert('Change Password', 'Password change will be available in the next update!')}
          showArrow
        />
      </View>

      {/* App Preferences - UPDATED THEME SECTION */}
      <SectionHeader title="App Preferences" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="moon"
          title="Theme"
          subtitle={getThemeDisplayText()}
          onPress={() => setShowThemeModal(true)}
          showArrow
        />
        <SettingItem
          icon="textformat"
          title="Font Size"
          subtitle="Adjust text size for better readability"
          onPress={() => Alert.alert('Font Size', 'Font size adjustment will be available in the next update!')}
          showArrow
        />
        <SettingItem
          icon="globe"
          title="Language"
          subtitle="English"
          onPress={() => Alert.alert('Language', 'Language selection will be available in the next update!')}
          showArrow
        />
      </View>

      {/* Notifications */}
      <SectionHeader title="Notifications" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="bell"
          title="Push Notifications"
          subtitle="Receive notifications on your device"
          rightElement={
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor={'#ffffff'}
            />
          }
        />
        <SettingItem
          icon="envelope"
          title="Email Notifications"
          subtitle="Receive updates via email"
          rightElement={
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor={'#ffffff'}
            />
          }
        />
        <SettingItem
          icon="speaker.wave.2"
          title="Sound & Vibration"
          subtitle="Customize notification alerts"
          onPress={() => Alert.alert('Sound Settings', 'Sound settings will be available in the next update!')}
          showArrow
        />
      </View>

      {/* Organizations */}
      <SectionHeader title="Organizations" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="building.2"
          title="My Organizations"
          subtitle="Manage your organization memberships"
          onPress={() => router.push('/(tabs)/explore')}
          showArrow
        />
        <SettingItem
          icon="plus.circle"
          title="Join Organization"
          subtitle="Discover and join new organizations"
          onPress={() => router.push('/(tabs)/explore')}
          showArrow
        />
      </View>

      {/* Help & Support */}
      <SectionHeader title="Help & Support" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="questionmark.circle"
          title="Help Center"
          subtitle="Get answers to common questions"
          onPress={handleSupport}
          showArrow
        />
        <SettingItem
          icon="envelope.badge"
          title="Contact Support"
          subtitle="Get help from our support team"
          onPress={handleSupport}
          showArrow
        />
        <SettingItem
          icon="star"
          title="Rate NexOrg"
          subtitle="Share your feedback with us"
          onPress={handleRateApp}
          showArrow
        />
        <SettingItem
          icon="square.and.arrow.up"
          title="Share App"
          subtitle="Recommend NexOrg to friends"
          onPress={handleShare}
          showArrow
        />
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="info.circle"
          title="App Version"
          subtitle="1.0.0 (Build 1)"
          rightElement={
            <ThemedText style={[styles.versionText, { color: colors.textSecondary }]}>
              Latest
            </ThemedText>
          }
        />
        <SettingItem
          icon="doc.text"
          title="Terms of Service"
          subtitle="Read our terms and conditions"
          onPress={() => Linking.openURL('https://nexorg.app/terms')}
          showArrow
        />
        <SettingItem
          icon="hand.raised"
          title="Privacy Policy"
          subtitle="Learn how we protect your data"
          onPress={() => Linking.openURL('https://nexorg.app/privacy')}
          showArrow
        />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <SettingItem
          icon="arrow.right.square"
          title="Sign Out"
          subtitle="Sign out of your account"
          onPress={handleSignOut}
          destructive
        />
      </View>

      {/* Theme Modal */}
      <ThemeModal />

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#800020',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingItemText: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingItemSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
  // Added Theme Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  themeModal: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#800020',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedThemeOption: {
    backgroundColor: '#800020' + '15',
  },
  themeOptionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
});
