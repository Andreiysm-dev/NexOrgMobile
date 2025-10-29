import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';

// UPDATED INTERFACE - Use institutional_email to match database
interface UserProfile {
  user_id: string;
  full_name: string;
  course: string;
  role: string;
  institutional_email?: string; // ✅ Updated to match database column
  created_at: string;
  department?: string | null;
  year?: number | null; // ✅ Updated to match database (number not string)
  interests?: string[] | null;
  id_number?: string; // ✅ Added id_number field
}

const { width: screenWidth } = Dimensions.get('window');

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Edit Profile Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    course: '',
    department: '',
    year: '',
    interests: '',
  });
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting user:', error);
        return;
      }

      if (user) {
        setUser(user);
        await fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // UPDATED FETCH FUNCTION - Get institutional_email from database
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        // Create a basic profile structure from auth user data
        if (user) {
          setUserProfile({
            user_id: userId,
            full_name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User',
            institutional_email: user?.email || '', // ✅ Use institutional_email
            course: 'Not set',
            role: 'student',
            created_at: user?.created_at || new Date().toISOString()
          });
        }
        return;
      }

      if (data) {
        // Profile exists in database - use data from database
        setUserProfile({
          ...data,
          // ✅ institutional_email comes directly from database now
        });
      } else {
        // No profile found in database - create basic profile from auth data
        console.log('No profile found, creating basic profile from auth data');
        setUserProfile({
          user_id: userId,
          full_name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User',
          institutional_email: user?.email || '', // ✅ Use institutional_email
          course: 'Not set',
          role: 'student',
          created_at: user?.created_at || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
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

  const handleEditProfile = () => {
    if (userProfile) {
      // Pre-fill the form with current profile data
      setEditForm({
        full_name: userProfile.full_name || '',
        course: userProfile.course || '',
        department: userProfile.department || '',
        year: userProfile.year?.toString() || '',
        interests: userProfile.interests?.join(', ') || '',
      });
      setShowEditModal(true);
    }
  };

  const handleUpdateProfile = async () => {
    if (!userProfile || !user) return;

    setIsUpdating(true);
    try {
      // Prepare the update data
      const updateData = {
        full_name: editForm.full_name.trim(),
        course: editForm.course.trim(),
        department: editForm.department.trim() || null,
        year: editForm.year ? parseInt(editForm.year) : null,
        interests: editForm.interests 
          ? editForm.interests.split(',').map(i => i.trim()).filter(i => i.length > 0)
          : null,
      };

      // Update the profile in the database
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userProfile.user_id);

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
        return;
      }

      // Update local state
      setUserProfile({
        ...userProfile,
        ...updateData,
      });

      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to format year level
  const formatYearLevel = (year?: number | null) => {
    if (!year) return 'Not specified';
    switch (year) {
      case 1: return '1st Year';
      case 2: return '2nd Year';
      case 3: return '3rd Year';
      case 4: return '4th Year';
      case 5: return 'Graduate';
      default: return `Year ${year}`;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <IconSymbol name="exclamationmark.triangle" size={48} color={colors.textSecondary} />
        <ThemedText style={styles.errorText}>Failed to load profile</ThemedText>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
          onPress={getCurrentUser}
        >
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }}>
      {/* Facebook-style Cover Photo */}
      <View style={styles.coverPhotoContainer}>
        <View style={[styles.coverPhoto, { backgroundColor: colors.tint }]}>
          {/* Gradient overlay for better text visibility */}
          <View style={styles.coverOverlay} />
          
          {/* Cover photo edit button */}
          <TouchableOpacity style={[styles.coverEditButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <IconSymbol name="camera.fill" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Profile Picture overlapping cover photo */}
        <View style={styles.profilePictureContainer}>
          <View style={[styles.profilePicture, { backgroundColor: colors.tint, borderColor: colors.background }]}>
            <ThemedText style={styles.initials}>
              {getInitials(userProfile.full_name)}
            </ThemedText>
          </View>
          <TouchableOpacity style={[styles.profileEditButton, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <IconSymbol name="camera.fill" size={14} color={colors.tint} />
          </TouchableOpacity>
        </View>
      </View>

      {/* User Info Section */}
      <View style={[styles.userInfoSection, { backgroundColor: colors.card }]}>
        <View style={styles.userNameContainer}>
          <ThemedText style={styles.userName}>{userProfile.full_name}</ThemedText>
          <ThemedText style={[styles.userBio, { color: colors.textSecondary }]}>
            {userProfile.course || 'Student'} • {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
          </ThemedText>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.primaryActionButton, { backgroundColor: colors.tint }]}
            onPress={handleEditProfile}
          >
            <IconSymbol name="pencil" size={16} color="white" />
            <ThemedText style={styles.primaryActionText}>Edit Profile</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.secondaryActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => Alert.alert('Settings', 'Settings coming soon!')}
          >
            <IconSymbol name="gear" size={16} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.secondaryActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => Alert.alert('More', 'More options coming soon!')}
          >
            <IconSymbol name="ellipsis" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Information Sections */}
      <View style={styles.sectionsContainer}>
        {/* Personal Information */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="person.fill" size={20} color={colors.tint} />
            <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>
          </View>
          
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Full Name</ThemedText>
            <ThemedText style={styles.infoValue}>{userProfile.full_name}</ThemedText>
          </View>
          
          {/* UPDATED EMAIL DISPLAY - Use institutional_email */}
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</ThemedText>
            <ThemedText style={styles.infoValue}>
              {userProfile.institutional_email || 'Not provided'}
            </ThemedText>
          </View>

          {/* ADDED STUDENT ID DISPLAY */}
          {userProfile.id_number && (
            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Student ID</ThemedText>
              <ThemedText style={styles.infoValue}>{userProfile.id_number}</ThemedText>
            </View>
          )}
          
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Role</ThemedText>
            <ThemedText style={styles.infoValue}>
              {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
            </ThemedText>
          </View>
        </View>

        {/* Academic Information */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="graduationcap.fill" size={20} color={colors.tint} />
            <ThemedText style={styles.sectionTitle}>Academic Information</ThemedText>
          </View>
          
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Course</ThemedText>
            <ThemedText style={styles.infoValue}>{userProfile.course || 'Not specified'}</ThemedText>
          </View>
          
          {userProfile.department && (
            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Department</ThemedText>
              <ThemedText style={styles.infoValue}>{userProfile.department}</ThemedText>
            </View>
          )}
          
          {/* UPDATED YEAR LEVEL DISPLAY - Format number correctly */}
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Year Level</ThemedText>
            <ThemedText style={styles.infoValue}>{formatYearLevel(userProfile.year)}</ThemedText>
          </View>
        </View>

        {/* ADDED INTERESTS SECTION */}
        {userProfile.interests && userProfile.interests.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="heart.fill" size={20} color={colors.tint} />
              <ThemedText style={styles.sectionTitle}>Interests</ThemedText>
            </View>
            
            <View style={styles.interestsContainer}>
              {userProfile.interests.map((interest, index) => (
                <View key={index} style={[styles.interestChip, { backgroundColor: colors.tint + '20' }]}>
                  <ThemedText style={[styles.interestText, { color: colors.tint }]}>
                    {interest}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Organizations */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="building.2.fill" size={20} color={colors.tint} />
            <ThemedText style={styles.sectionTitle}>My Organizations</ThemedText>
          </View>
          
          <TouchableOpacity style={styles.organizationItem}>
            <View style={[styles.orgIcon, { backgroundColor: colors.tint + '20' }]}>
              <IconSymbol name="building.2" size={24} color={colors.tint} />
            </View>
            <View style={styles.orgInfo}>
              <ThemedText style={styles.orgName}>MASTECH</ThemedText>
              <ThemedText style={[styles.orgRole, { color: colors.textSecondary }]}>Active Member</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Join more organizations to see them here
            </ThemedText>
          </View>
        </View>

        {/* Account Information */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.tint} />
            <ThemedText style={styles.sectionTitle}>Account Information</ThemedText>
          </View>
          
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Member Since</ThemedText>
            <ThemedText style={styles.infoValue}>{formatDate(userProfile.created_at)}</ThemedText>
          </View>
        </View>
      </View>

      {/* Sign Out Section */}
      <View style={styles.sectionsContainer}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.signOutRow}
            onPress={handleSignOut}
          >
            <View style={styles.signOutContent}>
              <IconSymbol name="arrow.right.square" size={20} color="#DC2626" />
              <ThemedText style={[styles.signOutText, { color: '#DC2626' }]}>Sign Out</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>

    {/* Edit Profile Modal */}
    <Modal
      visible={showEditModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.modalTitle}>Edit Profile</ThemedText>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowEditModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Full Name</ThemedText>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                value={editForm.full_name}
                onChangeText={(text) => setEditForm({...editForm, full_name: text})}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Course */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Course</ThemedText>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                value={editForm.course}
                onChangeText={(text) => setEditForm({...editForm, course: text})}
                placeholder="e.g., Computer Science"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Department */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Department</ThemedText>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                value={editForm.department}
                onChangeText={(text) => setEditForm({...editForm, department: text})}
                placeholder="e.g., College of Engineering"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Year Level */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Year Level</ThemedText>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                value={editForm.year}
                onChangeText={(text) => setEditForm({...editForm, year: text})}
                placeholder="e.g., 1, 2, 3, 4"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>

            {/* Interests */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Interests</ThemedText>
              <TextInput
                style={[styles.textAreaInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                value={editForm.interests}
                onChangeText={(text) => setEditForm({...editForm, interests: text})}
                placeholder="e.g., Programming, Music, Sports (separate with commas)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Modal Actions */}
          <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowEditModal(false)}
              disabled={isUpdating}
            >
              <ThemedText style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.tint }]}
              onPress={handleUpdateProfile}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  // Facebook-style Cover Photo Section
  coverPhotoContainer: {
    position: 'relative',
  },
  coverPhoto: {
    width: screenWidth,
    height: 200,
    position: 'relative',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  coverEditButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureContainer: {
    position: 'absolute',
    bottom: -60,
    left: 20,
    alignItems: 'center',
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  initials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  profileEditButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  // User Info Section
  userInfoSection: {
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 8,
  },
  userNameContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 16,
    lineHeight: 20,
  },
  // Action Buttons Row
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryActionButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sectionsContainer: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    color: '#800020',
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
  },
  // ADDED INTERESTS STYLES
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  organizationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  orgIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  orgRole: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  editProfileButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
  // Sign Out Section
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  signOutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Edit Profile Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#800020',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
