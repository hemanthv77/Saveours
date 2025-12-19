import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { setUser } from '../redux/authSlice';
import DatePickerModal from '../components/DatePickerModal';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  background: '#FFFFFF',
  cardBg: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#DDDDDD',
  borderFocused: '#FF6B4A',
  error: '#FF3B30',
  disabled: '#F5F5F5',
  success: '#34C759',
};

// ============================================================
// MY ACCOUNT SCREEN COMPONENT
// ============================================================
const MyAccountScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const currentUser = auth().currentUser;

  // Form state
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Validation errors
  const [errors, setErrors] = useState({});

  // Original data for comparison
  const [originalData, setOriginalData] = useState({});

  // ============================================================
  // FETCH USER DATA
  // ============================================================
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .get();

        if (userDoc.exists) {
          const data = userDoc.data();
          setName(data.name || '');
          setPhoneNumber(data.phoneNumber || '');
          setProfilePictureUrl(data.profilePictureUrl || '');

          if (data.dateOfBirth) {
            setDateOfBirth(data.dateOfBirth.toDate());
          }

          // Store original data
          setOriginalData({
            name: data.name || '',
            phoneNumber: data.phoneNumber || '',
            profilePictureUrl: data.profilePictureUrl || '',
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : new Date(),
          });
        } else {
          // First time setup - create user document
          const initialDate = new Date();
          const initialData = {
            userId: currentUser.uid,
            email: currentUser.email,
            name: '',
            dateOfBirth: firestore.Timestamp.fromDate(initialDate),
            phoneNumber: '',
            profilePictureUrl: '',
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };
          await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .set(initialData);
          
          setOriginalData({
            name: '',
            phoneNumber: '',
            profilePictureUrl: '',
            dateOfBirth: initialDate,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to load your profile. Please try again.');
      }
      setLoading(false);
    };

    fetchUserData();
  }, [currentUser]);

  // ============================================================
  // HEADER BUTTONS
  // ============================================================
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isDirty ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, isDirty, saving]);

  // ============================================================
  // CHECK IF DIRTY
  // ============================================================
  useEffect(() => {
    if (!originalData || !originalData.dateOfBirth) {
      setIsDirty(false);
      return;
    }

    const hasChanges =
      name !== originalData.name ||
      phoneNumber !== originalData.phoneNumber ||
      dateOfBirth.getTime() !== originalData.dateOfBirth.getTime() ||
      profilePictureUrl !== originalData.profilePictureUrl ||
      profilePicture !== null;

    setIsDirty(hasChanges);
  }, [name, phoneNumber, dateOfBirth, profilePictureUrl, profilePicture, originalData]);

  // ============================================================
  // IMAGE PICKER
  // ============================================================
  const handleSelectImage = () => {
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => takePhoto(),
        },
        {
          text: 'Choose from Library',
          onPress: () => chooseFromLibrary(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const takePhoto = async () => {
    const options = {
      mediaType: 'photo',
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
      saveToPhotos: true,
    };

    try {
      const result = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0]);
        setProfilePictureUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const chooseFromLibrary = async () => {
    const options = {
      mediaType: 'photo',
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0]);
        setProfilePictureUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  // ============================================================
  // UPLOAD PROFILE PICTURE
  // ============================================================
  const uploadProfilePicture = async () => {
    if (!profilePicture) return profilePictureUrl;

    setUploading(true);
    setUploadProgress(0);

    try {
      const imageRef = storage().ref(`users/${currentUser.uid}/profile.jpg`);
      const task = imageRef.putFile(profilePicture.uri);

      task.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      });

      await task;
      const url = await imageRef.getDownloadURL();
      setUploading(false);
      return url;
    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      throw error;
    }
  };

  // ============================================================
  // VALIDATION
  // ============================================================
  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Date of Birth validation (must be 13+)
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const isUnder13 =
      age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today.getDate() < dateOfBirth.getDate());

    if (isUnder13) {
      newErrors.dateOfBirth = 'You must be at least 13 years old';
    }

    // Phone number validation (basic)
    if (phoneNumber && phoneNumber.length < 10) {
      newErrors.phoneNumber = 'Enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // SAVE PROFILE
  // ============================================================
  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    setSaving(true);

    try {
      let imageUrl = profilePictureUrl;

      // Upload profile picture if changed
      if (profilePicture) {
        imageUrl = await uploadProfilePicture();
      }

      // Update Firestore
      const userData = {
        name: name.trim(),
        dateOfBirth: firestore.Timestamp.fromDate(dateOfBirth),
        phoneNumber: phoneNumber.trim(),
        profilePictureUrl: imageUrl,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update(userData);

      // Update Redux store
      dispatch(setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        ...userData,
      }));

      // Update original data
      setOriginalData({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        profilePictureUrl: imageUrl,
        dateOfBirth,
      });

      setProfilePicture(null);
      setIsDirty(false);

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }

    setSaving(false);
  };

  // ============================================================
  // DATE PICKER
  // ============================================================
  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Picture Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profilePlaceholderText}>
                  {currentUser?.email?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}

            {/* Camera Button */}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleSelectImage}
              accessibilityLabel="Change profile picture"
            >
              <Text style={styles.cameraIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          {uploading && (
            <View style={styles.uploadProgress}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.uploadText}>
                Uploading... {uploadProgress.toFixed(0)}%
              </Text>
            </View>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.fieldCard}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={50}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Date of Birth Field */}
          <View style={styles.fieldCard}>
            <Text style={styles.label}>Date of Birth</Text>
            <Pressable
              style={[styles.input, styles.dateInput, errors.dateOfBirth && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{formatDate(dateOfBirth)}</Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </Pressable>
            {errors.dateOfBirth && (
              <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
            )}
          </View>

          {/* Phone Number Field */}
          <View style={styles.fieldCard}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={COLORS.textMuted}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={20}
            />
            {errors.phoneNumber && (
              <Text style={styles.errorText}>{errors.phoneNumber}</Text>
            )}
          </View>

          {/* Email Field (Read-only) */}
          <View style={styles.fieldCard}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={currentUser?.email || ''}
              editable={false}
            />
            <Text style={styles.helpText}>
              Email cannot be changed as it's your login credential
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Custom Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onDateSelect={handleDateSelect}
        initialDate={dateOfBirth}
      />
    </KeyboardAvoidingView>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },
  // Header Button
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  profilePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.cardBg,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cameraIcon: {
    fontSize: 18,
  },
  uploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  uploadText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  // Form Section
  formSection: {
    paddingHorizontal: 16,
  },
  fieldCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.disabled,
    color: COLORS.textMuted,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
  },
  calendarIcon: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});

export default MyAccountScreen;
