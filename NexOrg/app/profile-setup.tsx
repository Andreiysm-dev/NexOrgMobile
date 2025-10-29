import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { 
  YEAR_LEVELS, 
  FALLBACK_DEPARTMENTS, 
  FALLBACK_COURSES_BY_DEPARTMENT, 
  USER_TYPES,
  INTERESTS,
  type YearLevel, 
  type Course, 
  type UserType,
  type DropdownOption,
} from '@/constants/ProfileData';
import { 
  fetchDepartments, 
  departmentsToDropdownOptions, 
  getCoursesForDepartment, 
  coursesToDropdownOptions,
  fetchInterests,
  createUserProfile,
  type Department 
} from '@/lib/api';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Image,
} from 'react-native';
// Image picker imports - temporarily disabled for Expo Go compatibility
// import * as ImagePicker from 'expo-image-picker';
// import * as ImageManipulator from 'expo-image-manipulator';

// Multi-select Interests Component
interface InterestsSelectProps {
  label: string;
  selectedInterests: string[];
  onInterestsChange: (interests: string[]) => void;
  availableInterests: any[];
}

const InterestsSelect: React.FC<InterestsSelectProps> = ({ 
  label, 
  selectedInterests, 
  onInterestsChange,
  availableInterests 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const toggleInterest = (interestValue: string) => {
    if (selectedInterests.includes(interestValue)) {
      onInterestsChange(selectedInterests.filter(i => i !== interestValue));
    } else {
      onInterestsChange([...selectedInterests, interestValue]);
    }
  };

  const getDisplayText = () => {
    if (selectedInterests.length === 0) return "Select your interests";
    if (selectedInterests.length === 1) {
      const interest = availableInterests.find(i => i.value === selectedInterests[0]);
      return interest?.label || "";
    }
    return `${selectedInterests.length} interests selected`;
  };

  return (
    <View style={styles.dropdownContainer}>
      <ThemedText style={styles.dropdownLabel}>{label}</ThemedText>
      
      <TouchableOpacity
        style={[styles.dropdownButton, { borderColor: colors.border }]}
        onPress={() => setIsOpen(true)}
      >
        <ThemedText style={[
          styles.dropdownButtonText,
          selectedInterests.length === 0 && { color: colors.textSecondary }
        ]}>
          {getDisplayText()}
        </ThemedText>
        <View style={styles.interestsBadgeContainer}>
          {selectedInterests.length > 0 && (
            <View style={[styles.interestsBadge, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.interestsBadgeText}>
                {selectedInterests.length}
              </ThemedText>
            </View>
          )}
          <IconSymbol name="chevron.down" size={16} color={colors.icon} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.interestsModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Your Interests</ThemedText>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <IconSymbol name="xmark" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Choose activities and topics you're interested in. We'll use this to recommend organizations for you!
            </ThemedText>
            
            <ScrollView style={styles.interestsList}>
              <View style={styles.interestsGrid}>
                {availableInterests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.value);
                  return (
                    <TouchableOpacity
                      key={interest.value}
                      style={[
                        styles.interestChip,
                        isSelected && { 
                          backgroundColor: colors.tint,
                          borderColor: colors.tint 
                        },
                        { borderColor: colors.border }
                      ]}
                      onPress={() => toggleInterest(interest.value)}
                    >
                      <ThemedText style={[
                        styles.interestChipText,
                        isSelected && { color: 'white', fontWeight: '600' }
                      ]}>
                        {interest.label}
                      </ThemedText>
                      {isSelected && (
                        <IconSymbol name="checkmark.circle.fill" size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.clearButton, { borderColor: colors.border }]}
                onPress={() => onInterestsChange([])}
              >
                <ThemedText style={[styles.clearButtonText, { color: colors.text }]}>
                  Clear All
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.doneButton, { backgroundColor: colors.tint }]}
                onPress={() => setIsOpen(false)}
              >
                <ThemedText style={styles.doneButtonText}>
                  Done ({selectedInterests.length})
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Dropdown component
interface DropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ 
  label, 
  value, 
  options, 
  onSelect, 
  placeholder = "Select...",
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const selectedOption = options.find(option => option.value === value);

  return (
    <View style={styles.dropdownContainer}>
      <ThemedText style={styles.dropdownLabel}>{label}</ThemedText>
      
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          { 
            borderColor: colors.border,
            backgroundColor: disabled ? colors.background : 'white',
            opacity: disabled ? 0.5 : 1
          }
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <ThemedText style={[
          styles.dropdownButtonText,
          !selectedOption && { color: colors.textSecondary }
        ]}>
          {selectedOption ? selectedOption.label : placeholder}
        </ThemedText>
        <IconSymbol 
          name="chevron.down" 
          size={16} 
          color={colors.icon} 
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{label}</ThemedText>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <IconSymbol name="xmark" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.optionsList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    value === option.value && { backgroundColor: colors.tint + '20' },
                    { borderBottomColor: colors.border }
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                  }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    value === option.value && { color: colors.tint, fontWeight: '600' }
                  ]}>
                    {option.label}
                  </ThemedText>
                  {value === option.value && (
                    <IconSymbol name="checkmark" size={16} color={colors.tint} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

function ProfileSetupScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userType, setUserType] = useState<UserType>('student');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  // REMOVED: institutionalEmail state
  const [department, setDepartment] = useState<string>('');
  const [yearLevel, setYearLevel] = useState<YearLevel>('1st Year');
  const [course, setCourse] = useState<Course>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [registrationForm, setRegistrationForm] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<{uri: string; name: string; type: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic data from API
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DropdownOption[]>(FALLBACK_DEPARTMENTS);
  const [availableCourses, setAvailableCourses] = useState<DropdownOption[]>([]);
  const [availableInterests, setAvailableInterests] = useState<any[]>(INTERESTS); // Start with fallback
  const [isLoadingData, setIsLoadingData] = useState(true);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Load data from API on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Update available courses when department changes
  useEffect(() => {
    if (department && departments.length > 0) {
      const courses = getCoursesForDepartment(departments, department);
      const courseOptions = coursesToDropdownOptions(courses);
      setAvailableCourses(courseOptions);
    } else {
      setAvailableCourses([]);
    }
  }, [department, departments]);

  const loadData = async () => {
    try {
      setIsLoadingData(true);
      console.log('Loading departments and interests from Supabase...');
      
      // Load departments and interests in parallel
      const [departmentsData, interestsData] = await Promise.all([
        fetchDepartments().catch(error => {
          console.error('Failed to load departments:', error);
          return [];
        }),
        fetchInterests().catch(error => {
          console.error('Failed to load interests:', error);
          return INTERESTS; // Use fallback interests
        })
      ]);
      
      // Process departments
      if (departmentsData && departmentsData.length > 0) {
        setDepartments(departmentsData);
        const options = departmentsToDropdownOptions(departmentsData);
        setDepartmentOptions(options);
        console.log('Successfully loaded', departmentsData.length, 'departments from Supabase');
      } else {
        console.log('No departments returned, using fallback');
        setDepartmentOptions(FALLBACK_DEPARTMENTS);
      }
      
      // Process interests
      if (interestsData && interestsData.length > 0) {
        setAvailableInterests(interestsData);
        console.log('Successfully loaded', interestsData.length, 'interests from Supabase');
      } else {
        console.log('No interests returned, using fallback');
        setAvailableInterests(INTERESTS);
      }
      
    } catch (error) {
      console.error('Failed to load data from Supabase:', error);
      
      Alert.alert(
        'Connection Issue',
        'Unable to load latest data from server. Using cached data.',
        [{ text: 'OK' }]
      );
      
      // Use fallback data
      setDepartmentOptions(FALLBACK_DEPARTMENTS);
      setAvailableInterests(INTERESTS);
      
      // Try to populate courses from fallback data if department is already selected
      if (department && FALLBACK_COURSES_BY_DEPARTMENT[department]) {
        setAvailableCourses(FALLBACK_COURSES_BY_DEPARTMENT[department]);
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reset course when department changes
  const handleDepartmentChange = (newDepartment: string) => {
    setDepartment(newDepartment);
    setCourse('');
  };

  const handleImagePick = async () => {
    // Demo mode for Expo Go compatibility
    Alert.alert(
      'Select Profile Image',
      'For full camera/photo library functionality, create a development build with:\n\nnpx expo run:android',
      [
        { 
          text: 'Use Demo Image', 
          onPress: () => {
            const demoImage = {
              uri: 'https://via.placeholder.com/400x400/4CAF50/FFFFFF?text=Profile',
              name: 'demo-profile.jpg',
              type: 'image/jpeg'
            };
            setProfileImage(demoImage);
            console.log('Demo profile image set');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleDocumentPick = async (type: 'registration' | 'profile') => {
    if (type === 'profile') {
      await handleImagePick();
    } else {
      Alert.alert('Info', 'Document upload will be available in the next update. You can continue with profile setup.');
      const mockFile = { name: 'registration-form.pdf', size: 12345 };
      setRegistrationForm(mockFile);
    }
  };

  // Helper function to convert year level to number
  const getYearNumber = (yearLevel: YearLevel): number => {
    switch (yearLevel) {
      case '1st Year': return 1;
      case '2nd Year': return 2;
      case '3rd Year': return 3;
      case '4th Year': return 4;
      case 'Graduate': return 5;
      default: return 1;
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!fullName || !studentId || !department || !course) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (interests.length === 0) {
        Alert.alert('Required Field', 'Please select at least one interest. This helps us recommend relevant organizations for you.', [
          { text: 'OK', style: 'default' }
        ]);
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    } else if (currentStep === 5) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };


  // UPDATED SUBMIT FUNCTION - Uses web API with fallback to direct Supabase
const handleSubmit = async () => {
  setIsLoading(true);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      setIsLoading(false);
      return;
    }

    // Prepare the profile data (matching web app fields)
    const profileData = {
      user_id: user.id,
      institutional_email: user.email, 
      full_name: fullName,
      course: course,
      role: userType,
      id_number: studentId,
      department: department,
      year: getYearNumber(yearLevel),
      phone_number: phoneNumber,
      address: address,
      profile_image: profileImage, // Include profile image
      interests: interests.length > 0 ? interests : null,
    };

    console.log('Saving profile data:', profileData);

    // Create profile directly via Supabase (same as web app)
    console.log('Creating profile via direct Supabase...');
    await createUserProfile(profileData);
    console.log('Profile created successfully');
    
    Alert.alert('Success', 'Profile created successfully!', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') }
    ]);

  } catch (error) {
    console.error('Profile setup error:', error);
    Alert.alert('Error', 'An unexpected error occurred. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>Are you a student or faculty member?</ThemedText>
      
      {USER_TYPES.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[
            styles.optionButton,
            userType === type.value && styles.selectedOption,
            { borderColor: colors.border }
          ]}
          onPress={() => setUserType(type.value as UserType)}
        >
          <IconSymbol 
            name={type.value === 'student' ? 'graduationcap' : 'person.badge.plus'} 
            size={24} 
            color={userType === type.value ? 'white' : colors.icon} 
          />
          <ThemedText style={[
            styles.optionText,
            userType === type.value && styles.selectedOptionText
          ]}>
            {type.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  // UPDATED STEP 2 - Added phone number and address fields to match web app
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>Personal Information</ThemedText>
      
      <View style={styles.inputContainer}>
        <IconSymbol name="person.fill" size={20} color={colors.icon} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Full Name *"
          placeholderTextColor={colors.textSecondary}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <IconSymbol name="number" size={20} color={colors.icon} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Student/Employee ID *"
          placeholderTextColor={colors.textSecondary}
          value={studentId}
          onChangeText={setStudentId}
        />
      </View>

      <View style={styles.inputContainer}>
        <IconSymbol name="phone" size={20} color={colors.icon} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Phone Number"
          placeholderTextColor={colors.textSecondary}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <IconSymbol name="house" size={20} color={colors.icon} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Address"
          placeholderTextColor={colors.textSecondary}
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={2}
        />
      </View>

      {/* REMOVED: Institutional Email Field - it will be derived from registration email */}

      <Dropdown
        label="Department *"
        value={department}
        options={departmentOptions}
        onSelect={handleDepartmentChange}
        placeholder={isLoadingData ? "Loading departments..." : "Select your department"}
        disabled={isLoadingData}
      />

      <Dropdown
        label="Course *"
        value={course}
        options={availableCourses}
        onSelect={setCourse}
        placeholder={department ? "Select your course" : "Select department first"}
        disabled={!department}
      />

      <Dropdown
        label="Year Level"
        value={yearLevel}
        options={YEAR_LEVELS}
        onSelect={(value) => setYearLevel(value as YearLevel)}
        placeholder="Select your year level"
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>What are your interests? *</ThemedText>
      <ThemedText style={styles.stepSubtitle}>
        Select at least one interest to help us recommend organizations that match your preferences
      </ThemedText>
      
      <InterestsSelect
        label="Select Your Interests"
        selectedInterests={interests}
        onInterestsChange={setInterests}
        availableInterests={availableInterests}
      />
      
      {interests.length > 0 && (
        <View style={styles.selectedInterestsPreview}>
          <ThemedText style={[styles.previewTitle, { color: colors.text }]}>
            Selected Interests ({interests.length}):
          </ThemedText>
          <View style={styles.previewChips}>
            {interests.slice(0, 6).map((interestValue) => {
              const interest = availableInterests.find(i => i.value === interestValue);
              return (
                <View key={interestValue} style={[styles.previewChip, { backgroundColor: colors.tint + '20' }]}>
                  <ThemedText style={[styles.previewChipText, { color: colors.tint }]}>
                    {interest?.label}
                  </ThemedText>
                </View>
              );
            })}
            {interests.length > 6 && (
              <View style={[styles.previewChip, { backgroundColor: colors.textSecondary + '20' }]}>
                <ThemedText style={[styles.previewChipText, { color: colors.textSecondary }]}>
                  +{interests.length - 6} more
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>Profile Image & Documents</ThemedText>
      <ThemedText style={styles.stepSubtitle}>
        Upload your profile image and documents (optional)
      </ThemedText>
      
      <TouchableOpacity
        style={[styles.uploadButton, { borderColor: colors.border }]}
        onPress={() => handleDocumentPick('profile')}
      >
        {profileImage ? (
          <Image 
            source={{ uri: profileImage.uri }} 
            style={styles.profileImagePreview}
          />
        ) : (
          <IconSymbol name="person.crop.circle" size={24} color={colors.icon} />
        )}
        <View style={styles.uploadTextContainer}>
          <ThemedText style={styles.uploadTitle}>Profile Image (Optional)</ThemedText>
          <ThemedText style={styles.uploadSubtext}>
            {profileImage ? 'Tap to change image' : 'Tap to upload image'}
          </ThemedText>
        </View>
        <IconSymbol 
          name={profileImage ? "checkmark.circle.fill" : "plus.circle"} 
          size={20} 
          color={profileImage ? '#4CAF50' : colors.icon} 
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.uploadButton, { borderColor: colors.border }]}
        onPress={() => handleDocumentPick('registration')}
      >
        <IconSymbol name="doc.fill" size={24} color={colors.icon} />
        <View style={styles.uploadTextContainer}>
          <ThemedText style={styles.uploadTitle}>Registration Form (Optional)</ThemedText>
          <ThemedText style={styles.uploadSubtext}>
            {registrationForm ? registrationForm.name : 'Tap to upload PDF'}
          </ThemedText>
        </View>
        <IconSymbol 
          name={registrationForm ? "checkmark.circle.fill" : "plus.circle"} 
          size={20} 
          color={registrationForm ? '#4CAF50' : colors.icon} 
        />
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <IconSymbol name="info.circle" size={20} color={colors.tint} />
        <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
          You can skip these uploads and add them later from your profile settings.
        </ThemedText>
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.stepTitle}>Review & Complete</ThemedText>
      <ThemedText style={styles.stepSubtitle}>
        Review your information and complete your profile setup
      </ThemedText>
      
      <View style={styles.reviewContainer}>
        <ThemedText style={[styles.reviewTitle, { color: colors.text }]}>Profile Summary:</ThemedText>
        
        <View style={styles.reviewItem}>
          <ThemedText style={[styles.reviewLabel, { color: colors.textSecondary }]}>Name:</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: colors.text }]}>{fullName}</ThemedText>
        </View>
        
        <View style={styles.reviewItem}>
          <ThemedText style={[styles.reviewLabel, { color: colors.textSecondary }]}>ID:</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: colors.text }]}>{studentId}</ThemedText>
        </View>
        
        <View style={styles.reviewItem}>
          <ThemedText style={[styles.reviewLabel, { color: colors.textSecondary }]}>Department:</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: colors.text }]}>{department}</ThemedText>
        </View>
        
        <View style={styles.reviewItem}>
          <ThemedText style={[styles.reviewLabel, { color: colors.textSecondary }]}>Course:</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: colors.text }]}>{course}</ThemedText>
        </View>
        
        <View style={styles.reviewItem}>
          <ThemedText style={[styles.reviewLabel, { color: colors.textSecondary }]}>Interests:</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: colors.text }]}>{interests.length} selected</ThemedText>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <IconSymbol name="checkmark.circle" size={20} color={colors.tint} />
        <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
          Ready to complete your profile setup and start exploring organizations!
        </ThemedText>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.logo}>Profile Setup</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Step {currentStep} of 5
          </ThemedText>
          {isLoadingData && (
            <ThemedText style={[styles.loadingText, { color: colors.tint }]}>
              Loading departments, courses, and interests...
            </ThemedText>
          )}
        </View>

        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5].map((step) => (
            <View
              key={step}
              style={[
                styles.progressStep,
                {
                  backgroundColor: step <= currentStep ? colors.tint : colors.border
                }
              ]}
            />
          ))}
        </View>

        <ThemedView style={styles.form}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </ThemedView>

        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: colors.border }]}
              onPress={handleBack}
            >
              <ThemedText style={[styles.backButtonText, { color: colors.text }]}>
                Back
              </ThemedText>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor: isLoading ? colors.textSecondary : colors.tint,
                opacity: isLoading ? 0.7 : 1,
                flex: currentStep === 1 ? 1 : 0.6
              }
            ]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <ThemedText style={styles.nextButtonText}>
              {isLoading ? 'Creating...' : (currentStep === 5 ? 'Complete Setup' : 'Next')}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 40,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  progressStep: {
    width: 50,
    height: 4,
    borderRadius: 2,
  },
  form: {
    flex: 1,
    marginBottom: 16,
  },
  stepContainer: {
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 12,
  },
  selectedOption: {
    backgroundColor: '#800020',
    borderColor: '#800020',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  selectedOptionText: {
    color: 'white',
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 44,
    fontSize: 16,
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    padding: 16,
    paddingTop: 8,
    lineHeight: 20,
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  interestsBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  interestsBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  interestsBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  interestsModal: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  interestsList: {
    maxHeight: 400,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  interestChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  clearButton: {
    flex: 0.3,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  doneButton: {
    flex: 0.7,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedInterestsPreview: {
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  previewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 16,
    borderStyle: 'dashed',
  },
  uploadTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    flex: 0.4,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  reviewValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  profileImagePreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
});

export default ProfileSetupScreen;
