import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';

// Firebase imports
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

// Components
import CommunityCard from '../components/CommunityCard';

// Redux actions
import {
  setCommunities,
  addCommunity,
  setLoading,
  setError,
} from '../redux/communitiesSlice';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
  primary: '#FF6B4A',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  error: '#FF3B30',
  border: '#E0E0E0',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// ============================================================
// COMMUNITIES SCREEN COMPONENT
// ============================================================
const CommunitiesScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  // Redux state
  const { communities, loading } = useSelector((state) => state.communities);
  const user = useSelector((state) => state.auth.user);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    maxCapacity: '',
    description: '',
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // ============================================================
  // FIRESTORE LISTENER - Real-time updates
  // ============================================================
  useEffect(() => {
    dispatch(setLoading(true));

    const unsubscribe = firestore()
      .collection('communities')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const communitiesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          dispatch(setCommunities(communitiesData));
          dispatch(setLoading(false));
        },
        (error) => {
          console.error('Firestore error:', error);
          dispatch(setError(error.message));
          dispatch(setLoading(false));
          Alert.alert('Error', 'Failed to load communities. Please try again.');
        }
      );

    return () => unsubscribe();
  }, [dispatch]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const snapshot = await firestore()
        .collection('communities')
        .orderBy('createdAt', 'desc')
        .get();
      const communitiesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      dispatch(setCommunities(communitiesData));
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh communities.');
    }
    setRefreshing(false);
  }, [dispatch]);

  // Navigate to community details
  const handleCommunityPress = useCallback(
    (communityId) => {
      navigation.navigate('CommunityDetail', { communityId });
    },
    [navigation]
  );

  // Open create community modal
  const handleOpenModal = () => {
    resetForm();
    setModalVisible(true);
  };

  // Close create community modal
  const handleCloseModal = () => {
    setModalVisible(false);
    resetForm();
  };

  // Toggle profile menu
  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  // Close menu
  const closeMenu = () => {
    setMenuVisible(false);
  };

  // Sign out handler
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            closeMenu();
            try {
              await auth().signOut();
              // Clear user from Redux
              dispatch({ type: 'auth/clearUser' });
              // Reset navigation to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
            setSigningOut(false);
          },
        },
      ]
    );
  };

  // Reset form data
  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      maxCapacity: '',
      description: '',
    });
    setSelectedImage(null);
    setFormErrors({});
  };

  // Update form field
  const updateFormField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Image picker handler
  const handleSelectImage = async () => {
    const options = {
      mediaType: 'photo',
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.8,
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  const validateForm = () => {
    const errors = {};

    // Community Name validation
    if (!formData.name.trim()) {
      errors.name = 'Community name is required';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Name must be at least 3 characters';
    } else if (formData.name.trim().length > 50) {
      errors.name = 'Name cannot exceed 50 characters';
    }

    // Location validation
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    } else if (formData.location.trim().length < 3) {
      errors.location = 'Location must be at least 3 characters';
    }

    // Max Capacity validation
    const capacity = parseInt(formData.maxCapacity, 10);
    if (!formData.maxCapacity.trim()) {
      errors.maxCapacity = 'Maximum capacity is required';
    } else if (isNaN(capacity) || capacity < 10 || capacity > 1000) {
      errors.maxCapacity = 'Capacity must be between 10 and 1000';
    }

    // Description validation
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.trim().length < 20) {
      errors.description = 'Description must be at least 20 characters';
    } else if (formData.description.trim().length > 500) {
      errors.description = 'Description cannot exceed 500 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if form is valid (for button state)
  const isFormValid = () => {
    return (
      formData.name.trim().length >= 3 &&
      formData.location.trim().length >= 3 &&
      parseInt(formData.maxCapacity, 10) >= 10 &&
      parseInt(formData.maxCapacity, 10) <= 1000 &&
      formData.description.trim().length >= 20
    );
  };

  // ============================================================
  // CREATE COMMUNITY
  // ============================================================
  const handleCreateCommunity = async () => {
    if (!validateForm()) return;

    setCreating(true);

    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to create a community.');
        setCreating(false);
        return;
      }

      let imageUrl = '';

      // Upload image if selected
      if (selectedImage) {
        const imageRef = storage().ref(
          `communities/${Date.now()}_${selectedImage.fileName || 'image.jpg'}`
        );
        await imageRef.putFile(selectedImage.uri);
        imageUrl = await imageRef.getDownloadURL();
      }

      // Create community document
      const communityData = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        maxCapacity: parseInt(formData.maxCapacity, 10),
        currentMembers: 1,
        description: formData.description.trim(),
        imageUrl,
        adminIds: [currentUser.uid],
        memberIds: [currentUser.uid],
        createdAt: firestore.FieldValue.serverTimestamp(),
        isPrivate: false,
      };

      const docRef = await firestore()
        .collection('communities')
        .add(communityData);

      // Add to Redux store
      dispatch(
        addCommunity({
          id: docRef.id,
          ...communityData,
          createdAt: new Date().toISOString(),
        })
      );

      Alert.alert('Success', 'Community created successfully!');
      handleCloseModal();

      // Navigate to the new community
      navigation.navigate('CommunityDetail', { communityId: docRef.id });
    } catch (error) {
      console.error('Create community error:', error);
      Alert.alert('Error', 'Failed to create community. Please try again.');
    }

    setCreating(false);
  };

  // ============================================================
  // FILTER COMMUNITIES BY SEARCH
  // ============================================================
  const filteredCommunities = communities.filter((community) =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  // Render community card
  const renderCommunityCard = ({ item }) => (
    <CommunityCard
      community={item}
      onPress={() => handleCommunityPress(item.id)}
    />
  );

  // Empty list component
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🍽️</Text>
      <Text style={styles.emptyText}>No communities yet.</Text>
      <Text style={styles.emptySubtext}>Create the first one!</Text>
    </View>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saveours</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={toggleMenu}
          accessibilityLabel="Profile menu"
          accessibilityHint="Open profile menu"
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() || '👤'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Profile Dropdown Menu */}
      {menuVisible && (
        <>
          {/* Backdrop */}
          <Pressable
            style={styles.menuBackdrop}
            onPress={closeMenu}
          />
          
          {/* Menu */}
          <View style={styles.dropdownMenu}>
            {/* My Communities */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                navigation.navigate('MyCommunities');
              }}
              accessibilityLabel="My Communities"
            >
              <Text style={styles.menuIcon}>🏠</Text>
              <Text style={styles.menuText}>My Communities</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* My Account */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                navigation.navigate('MyAccount');
              }}
              accessibilityLabel="My Account"
            >
              <Text style={styles.menuIcon}>👤</Text>
              <Text style={styles.menuText}>My Account</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity
              style={[styles.menuItem, styles.lastMenuItem]}
              onPress={handleSignOut}
              accessibilityLabel="Sign Out"
              disabled={signingOut}
            >
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuText, styles.signOutText]}>
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search communities"
        />
      </View>

      {/* Communities List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading communities...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCommunities}
          renderItem={renderCommunityCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenModal}
        activeOpacity={0.8}
        accessibilityLabel="Create community"
        accessibilityHint="Opens form to create a new community"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create Community Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={handleCloseModal} />
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Community</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCloseModal}
                  accessibilityLabel="Close"
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View style={styles.formContainer}>
                {/* Community Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Community Name *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      formErrors.name && styles.inputError,
                    ]}
                    placeholder="e.g., Downtown Foodies"
                    placeholderTextColor={COLORS.textMuted}
                    value={formData.name}
                    onChangeText={(text) => updateFormField('name', text)}
                    maxLength={50}
                  />
                  {formErrors.name && (
                    <Text style={styles.errorText}>{formErrors.name}</Text>
                  )}
                </View>

                {/* Location */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Location *</Text>
                  <View style={styles.inputWithIcon}>
                    <Text style={styles.inputIcon}>📍</Text>
                    <TextInput
                      style={[
                        styles.inputIconField,
                        formErrors.location && styles.inputError,
                      ]}
                      placeholder="e.g., Brooklyn, NY"
                      placeholderTextColor={COLORS.textMuted}
                      value={formData.location}
                      onChangeText={(text) => updateFormField('location', text)}
                    />
                  </View>
                  {formErrors.location && (
                    <Text style={styles.errorText}>{formErrors.location}</Text>
                  )}
                </View>

                {/* Maximum Capacity */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Maximum Capacity *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      formErrors.maxCapacity && styles.inputError,
                    ]}
                    placeholder="e.g., 100"
                    placeholderTextColor={COLORS.textMuted}
                    value={formData.maxCapacity}
                    onChangeText={(text) =>
                      updateFormField('maxCapacity', text.replace(/[^0-9]/g, ''))
                    }
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  {formErrors.maxCapacity && (
                    <Text style={styles.errorText}>{formErrors.maxCapacity}</Text>
                  )}
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      formErrors.description && styles.inputError,
                    ]}
                    placeholder="Tell people about your community..."
                    placeholderTextColor={COLORS.textMuted}
                    value={formData.description}
                    onChangeText={(text) => updateFormField('description', text)}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>
                    {formData.description.length}/500
                  </Text>
                  {formErrors.description && (
                    <Text style={styles.errorText}>{formErrors.description}</Text>
                  )}
                </View>

                {/* Upload Image */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Community Image</Text>
                  <TouchableOpacity
                    style={styles.imagePickerButton}
                    onPress={handleSelectImage}
                    accessibilityLabel="Upload image"
                    accessibilityHint="Select an image for your community"
                  >
                    {selectedImage ? (
                      <Image
                        source={{ uri: selectedImage.uri }}
                        style={styles.previewImage}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.cameraIcon}>📷</Text>
                        <Text style={styles.uploadText}>Upload Image</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Modal Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCloseModal}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    (!isFormValid() || creating) && styles.buttonDisabled,
                  ]}
                  onPress={handleCreateCommunity}
                  disabled={!isFormValid() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.createButtonText}>Create Community</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  profileButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  // Dropdown Menu
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    width: 200,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  signOutText: {
    color: COLORS.error,
  },
  chevron: {
    fontSize: 24,
    color: COLORS.textLight,
    fontWeight: '300',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  // List
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  // Form
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  inputIconField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  // Image Picker
  imagePickerButton: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    height: 150,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  createButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default CommunitiesScreen;