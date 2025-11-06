import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Switch,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganizationById, updateOrganization } from '@/lib/api';
import { canPostAnnouncements, canManageMembers } from '@/lib/mockRoles';

const { width } = Dimensions.get('window');

interface FormData {
  department: string;
  dean: string;
  allowOutsideDepartment: boolean;
  tags: string[];
  advisers: string[];
  socials: {
    facebook_url: string;
    website_url: string;
    contact_email: string;
  };
}

interface Department {
  department_id: string;
  name: string;
}

interface Tag {
  tag_id: string;
  name: string;
}

export default function OrganizationSettings() {
  const { id } = useLocalSearchParams();
  const { user, email } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    department: '',
    dean: '',
    allowOutsideDepartment: false,
    tags: [],
    advisers: ['', ''],
    socials: {
      facebook_url: '',
      website_url: '',
      contact_email: ''
    }
  });

  // Modal states
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');

  // Check if user can access settings
  const canAccessSettings = () => {
    if (!organization) return false;
    
    const isOfficerInOrg = organization?.officers?.some((officer: any) => officer.email === email);
    const isAdviserInOrg = organization?.advisers?.some((adviser: any) => adviser.email === email);
    const hasMockPermissions = canPostAnnouncements(email) || canManageMembers(email);
    
    return isOfficerInOrg || isAdviserInOrg || hasMockPermissions;
  };

  // Load organization data
  const loadOrganizationData = async () => {
    if (!id) return;
    
    try {
      const org = await fetchOrganizationById(id as string);
      setOrganization(org);
      
      // Populate form with existing data
      setFormData({
        department: org.department || '',
        dean: org.dean || '',
        allowOutsideDepartment: org.allowOutsideDepartment || false,
        tags: org.tags?.map((tag: any) => tag.name) || [],
        advisers: org.advisers?.map((a: any) => a.email) || ['', ''],
        socials: {
          facebook_url: org.facebook_url || '',
          website_url: org.website_url || '',
          contact_email: org.contact_email || ''
        }
      });
    } catch (error) {
      console.error('Failed to load organization:', error);
      Alert.alert('Error', 'Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  // Load departments and tags
  const loadSelectOptions = async () => {
    try {
      // Mock departments for now
      setDepartments([
        { department_id: '1', name: 'College of Computer and Mathematical Sciences' },
        { department_id: '2', name: 'College of Engineering' },
        { department_id: '3', name: 'College of Business Administration' },
        { department_id: '4', name: 'College of Arts and Sciences' },
      ]);

      // Mock tags for now
      setAvailableTags([
        { tag_id: '1', name: 'Technology' },
        { tag_id: '2', name: 'Academic' },
        { tag_id: '3', name: 'Sports' },
        { tag_id: '4', name: 'Arts' },
        { tag_id: '5', name: 'Community Service' },
        { tag_id: '6', name: 'Leadership' },
      ]);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  useEffect(() => {
    loadOrganizationData();
    loadSelectOptions();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrganizationData();
    setRefreshing(false);
  };

  // Save changes
  const handleSave = async () => {
    if (!organization) return;
    
    try {
      setSaving(true);
      console.log('Saving organization settings...', formData);
      
      // Update the organization using the API
      await updateOrganization(organization.id, formData);
      
      Alert.alert(
        'Success', 
        'Organization settings updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to organization page
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to update organization:', error);
      Alert.alert('Error', 'Failed to update organization settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Tag management
  const addTag = (tagName: string) => {
    if (tagName && !formData.tags.includes(tagName)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagName]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Adviser management
  const updateAdviser = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      advisers: prev.advisers.map((adviser, i) => i === index ? email : adviser)
    }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading settings...</ThemedText>
        </View>
      </View>
    );
  }

  if (!canAccessSettings()) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <IconSymbol name="lock" size={48} color="#6B7280" />
          <ThemedText style={styles.accessDeniedTitle}>Access Restricted</ThemedText>
          <ThemedText style={styles.accessDeniedText}>
            You don't have permission to access these settings.
          </ThemedText>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.headerTitle}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <View style={styles.container}>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Department & Dean Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Department & Dean Settings</ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Department</ThemedText>
            <TouchableOpacity 
              style={styles.selectButton}
              onPress={() => setShowDepartmentModal(true)}
            >
              <ThemedText style={[styles.selectButtonText, !formData.department && styles.selectButtonPlaceholder]}>
                {formData.department || 'Select department'}
              </ThemedText>
              <IconSymbol name="chevron.down" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Dean Email (Optional)</ThemedText>
            <TextInput
              style={styles.textInput}
              value={formData.dean}
              onChangeText={(text) => setFormData(prev => ({ ...prev, dean: text }))}
              placeholder="dean@university.edu"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Join Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Join Settings</ThemedText>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchContent}>
              <ThemedText style={styles.switchLabel}>Allow members from outside department</ThemedText>
              <ThemedText style={styles.switchDescription}>
                When enabled, students from other departments can join
              </ThemedText>
            </View>
            <Switch
              value={formData.allowOutsideDepartment}
              onValueChange={(value) => setFormData(prev => ({ ...prev, allowOutsideDepartment: value }))}
              trackColor={{ false: '#E5E7EB', true: '#800020' }}
              thumbColor={formData.allowOutsideDepartment ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Tags & Categories</ThemedText>
          
          <View style={styles.tagsContainer}>
            {formData.tags.length > 0 ? (
              <View style={styles.tagsGrid}>
                {formData.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <ThemedText style={styles.tagText}>{tag}</ThemedText>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <IconSymbol name="xmark" size={14} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText style={styles.noTagsText}>No tags added yet</ThemedText>
            )}
            
            <TouchableOpacity 
              style={styles.addTagButton}
              onPress={() => setShowTagModal(true)}
            >
              <IconSymbol name="plus" size={16} color="#800020" />
              <ThemedText style={styles.addTagButtonText}>Add Tag</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Advisers */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Organization Advisers</ThemedText>
          
          {formData.advisers.map((adviser, index) => (
            <View key={index} style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>
                Adviser {index + 1} {index === 0 && <ThemedText style={styles.required}>*</ThemedText>}
              </ThemedText>
              <TextInput
                style={styles.textInput}
                value={adviser}
                onChangeText={(text) => updateAdviser(index, text)}
                placeholder="adviser@university.edu"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          ))}
          
          <ThemedText style={styles.helperText}>
            Maximum 2 advisers. First adviser is required, second is optional.
          </ThemedText>
        </View>

        {/* Social Media & Contact */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Social Media & Contact</ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Facebook Page URL</ThemedText>
            <TextInput
              style={styles.textInput}
              value={formData.socials.facebook_url}
              onChangeText={(text) => setFormData(prev => ({ 
                ...prev, 
                socials: { ...prev.socials, facebook_url: text }
              }))}
              placeholder="https://facebook.com/yourorg"
              placeholderTextColor="#9CA3AF"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Website URL</ThemedText>
            <TextInput
              style={styles.textInput}
              value={formData.socials.website_url}
              onChangeText={(text) => setFormData(prev => ({ 
                ...prev, 
                socials: { ...prev.socials, website_url: text }
              }))}
              placeholder="https://yourorg.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Contact Email</ThemedText>
            <TextInput
              style={styles.textInput}
              value={formData.socials.contact_email}
              onChangeText={(text) => setFormData(prev => ({ 
                ...prev, 
                socials: { ...prev.socials, contact_email: text }
              }))}
              placeholder="contact@yourorg.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <ThemedText style={styles.helperText}>
            Add social media links and contact information for your organization
          </ThemedText>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.saveButtonContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <IconSymbol name="checkmark" size={20} color="white" />
          <ThemedText style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Department Selection Modal */}
      <Modal
        visible={showDepartmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Department</ThemedText>
              <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept.department_id}
                  style={styles.modalOption}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, department: dept.name }));
                    setShowDepartmentModal(false);
                  }}
                >
                  <ThemedText style={styles.modalOptionText}>{dept.name}</ThemedText>
                  {formData.department === dept.name && (
                    <IconSymbol name="checkmark" size={16} color="#800020" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tag Selection Modal */}
      <Modal
        visible={showTagModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTagModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add Tags</ThemedText>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <IconSymbol name="xmark" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {availableTags
                .filter(tag => !formData.tags.includes(tag.name))
                .map((tag) => (
                  <TouchableOpacity
                    key={tag.tag_id}
                    style={styles.modalOption}
                    onPress={() => {
                      addTag(tag.name);
                      setShowTagModal(false);
                    }}
                  >
                    <ThemedText style={styles.modalOptionText}>{tag.name}</ThemedText>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  saveButtonContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#800020',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  selectButtonPlaceholder: {
    color: '#9CA3AF',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchContent: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  tagsContainer: {
    marginTop: 8,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#374151',
  },
  noTagsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#800020',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  addTagButtonText: {
    fontSize: 14,
    color: '#800020',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  bottomPadding: {
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    paddingVertical: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
});
