import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { signUp } from '../services/firebase';
import { setUser } from '../redux/authSlice';
import DatePickerModal from '../components/DatePickerModal';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#F8F9FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#DDDDDD',
  borderFocused: '#FF6B4A',
  error: '#FF3B30',
  success: '#34C759',
};

// ============================================================
// SIGNUP SCREEN COMPONENT
// ============================================================
const SignUpScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState({});

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
    };

    try {
      const result = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        setProfilePicture(result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
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
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  // ============================================================
  // UPLOAD PROFILE PICTURE
  // ============================================================
  const uploadProfilePicture = async (userId) => {
    if (!profilePicture?.uri) return '';

    try {
      const path = `users/${userId}/profile.jpg`;
      const reference = storage().ref(path);
      await reference.putFile(profilePicture.uri);
      return await reference.getDownloadURL();
    } catch (error) {
      console.error('Upload error:', error);
      return '';
    }
  };

  // ============================================================
  // DATE HANDLING
  // ============================================================
  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      // Clear DOB error
      setErrors((prev) => {
        const { dateOfBirth: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // ============================================================
  // VALIDATION
  // ============================================================
  const validateForm = () => {
    const newErrors = {};

    // First name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    // Last name validation
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    // Date of Birth validation (must be 13+)
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const today = new Date();
      const age = today.getFullYear() - dateOfBirth.getFullYear();
      const monthDiff = today.getMonth() - dateOfBirth.getMonth();
      const isUnder13 =
        age < 13 || 
        (age === 13 && monthDiff < 0) || 
        (age === 13 && monthDiff === 0 && today.getDate() < dateOfBirth.getDate());

      if (isUnder13) {
        newErrors.dateOfBirth = 'You must be at least 13 years old';
      }
    }

    // Phone number validation
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.trim().length < 10) {
      newErrors.phoneNumber = 'Enter a valid phone number';
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Enter a valid email address';
      }
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // SIGN UP HANDLER
  // ============================================================
  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create Firebase Auth user
      const user = await signUp(email.trim(), password);

      // Upload profile picture if provided
      const profilePictureUrl = await uploadProfilePicture(user.uid);

      // Create user document in Firestore
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const userData = {
        userId: user.uid,
        email: user.email,
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: firestore.Timestamp.fromDate(dateOfBirth),
        phoneNumber: phoneNumber.trim(),
        profilePictureUrl,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        communities: [],
        adminCommunities: [],
      };

      await firestore()
        .collection('users')
        .doc(user.uid)
        .set(userData);

      // Update Redux store with user data
      dispatch(setUser({
        uid: user.uid,
        email: user.email,
        ...userData,
        dateOfBirth: dateOfBirth.getTime(),
      }));

      Alert.alert('Success', 'Account created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Communities' }],
            });
          },
        },
      ]);
    } catch (error) {
      console.error('SignUp error:', error);
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CLEAR ERROR ON INPUT
  // ============================================================
  const clearError = (field) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  // ============================================================
  // GET INITIALS
  // ============================================================
  const getInitials = () => {
    const first = firstName.trim().charAt(0).toUpperCase();
    const last = lastName.trim().charAt(0).toUpperCase();
    return first + last || '?';
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Saveours and start sharing food with your community
          </Text>
        </View>

        {/* Profile Picture */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleSelectImage}
            activeOpacity={0.7}
          >
            {profilePicture?.uri ? (
              <Image
                source={{ uri: profilePicture.uri }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {firstName || lastName ? getInitials() : '👤'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to add profile photo (optional)</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {/* First Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={[styles.input, errors.firstName && styles.inputError]}
              placeholder="Enter your first name"
              placeholderTextColor={COLORS.textMuted}
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                clearError('firstName');
              }}
              autoCapitalize="words"
            />
            {errors.firstName && (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            )}
          </View>

          {/* Last Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={[styles.input, errors.lastName && styles.inputError]}
              placeholder="Enter your last name"
              placeholderTextColor={COLORS.textMuted}
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                clearError('lastName');
              }}
              autoCapitalize="words"
            />
            {errors.lastName && (
              <Text style={styles.errorText}>{errors.lastName}</Text>
            )}
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Date of Birth *</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateInput, errors.dateOfBirth && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dateText,
                  !dateOfBirth && styles.placeholderText,
                ]}
              >
                {dateOfBirth ? formatDate(dateOfBirth) : 'Select your date of birth'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
            {errors.dateOfBirth && (
              <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
            )}
          </View>

          {/* Phone Number */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={COLORS.textMuted}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                clearError('phoneNumber');
              }}
              keyboardType="phone-pad"
            />
            {errors.phoneNumber && (
              <Text style={styles.errorText}>{errors.phoneNumber}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError('email');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="Create a password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError('password');
              }}
              secureTextEntry
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder="Confirm your password"
              placeholderTextColor={COLORS.textMuted}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearError('confirmPassword');
              }}
              secureTextEntry
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>
        </View>

        {/* Sign Up Button */}
        <TouchableOpacity
          style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.signUpButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Required Fields Note */}
        <Text style={styles.requiredNote}>* Required fields</Text>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onDateSelect={handleDateSelect}
        initialDate={dateOfBirth || new Date(2000, 0, 1)}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    lineHeight: 22,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraIcon: {
    fontSize: 16,
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Form
  form: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  calendarIcon: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },

  // Sign Up Button
  signUpButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Login Link
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  loginLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Required Note
  requiredNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default SignUpScreen;
