import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function CreateAnnouncementScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const categories = [
    'General',
    'Event',
    'Academic',
    'Social',
    'Meeting',
    'Urgent',
    'Reminder'
  ];

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setImageUrl(''); // Clear URL input when image is selected
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const handlePost = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please fill in the title and content fields.');
      return;
    }

    // TODO: Implement actual posting logic with image upload
    Alert.alert('Success', 'Announcement posted successfully!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color="#374151" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Create a Post</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.subtitle}>
          Share updates or announcements with your organization members.
        </ThemedText>

        {/* Title Field */}
        <View style={styles.fieldContainer}>
          <ThemedText style={styles.fieldLabel}>Title</ThemedText>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter announcement title"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Category Field */}
        <View style={styles.fieldContainer}>
          <ThemedText style={styles.fieldLabel}>Category</ThemedText>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <ThemedText style={[
              styles.dropdownText,
              !category && styles.placeholderText
            ]}>
              {category || 'Select a category'}
            </ThemedText>
            <IconSymbol 
              name={showCategoryDropdown ? "chevron.up" : "chevron.down"} 
              size={16} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {showCategoryDropdown && (
            <View style={styles.dropdownMenu}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <ThemedText style={styles.dropdownItemText}>{cat}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content Field */}
        <View style={styles.fieldContainer}>
          <ThemedText style={styles.fieldLabel}>Content</ThemedText>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={content}
            onChangeText={setContent}
            placeholder="Write your announcement content here..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Image Upload Section */}
        <View style={styles.fieldContainer}>
          <ThemedText style={styles.fieldLabel}>Image (optional)</ThemedText>
          
          {selectedImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                <IconSymbol name="xmark.circle.fill" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <IconSymbol name="photo" size={24} color="#6B7280" />
              <ThemedText style={styles.uploadButtonText}>Choose from gallery</ThemedText>
            </TouchableOpacity>
          )}
          
          {!selectedImage && (
            <>
              <ThemedText style={styles.orText}>OR</ThemedText>
              <TextInput
                style={styles.textInput}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="Paste image URL"
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
              />
            </>
          )}
        </View>

        {/* Post Button */}
        <TouchableOpacity style={styles.postButton} onPress={handlePost}>
          <ThemedText style={styles.postButtonText}>Post</ThemedText>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 50, // Account for status bar
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 32, // Same width as close button for centering
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginVertical: 16,
    lineHeight: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#374151',
    backgroundColor: 'white',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  dropdownText: {
    fontSize: 16,
    color: '#374151',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
  },
  postButton: {
    backgroundColor: '#1F2937',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 32,
    backgroundColor: '#F9FAFB',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  orText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginVertical: 12,
  },
});
