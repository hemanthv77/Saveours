import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

const COLORS = {
  primary: '#FF6B4A',
  primaryLight: '#FFF0ED',
  background: '#FFFFFF',
  backgroundLight: '#F8F8F8',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E0E0E0',
  error: '#FF3B30',
  success: '#34C759',
};

const MAX_DISHES = 10;
const MAX_PHOTOS_PER_DISH = 5;
const MAX_NAME_LENGTH = 50;
const MAX_PRICE = 10000;
const MAX_PORTIONS = 100;

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Get user initials for avatar fallback
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Create empty dish object
const createEmptyDish = () => ({
  id: generateId(),
  photos: [],
  name: '',
  price: '',
  portions: '',
});

const TodaysMenuScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { communityId, communityName } = route.params || {};

  const currentUser = auth().currentUser;
  const currentUserId = currentUser?.uid || null;

  const [userProfile, setUserProfile] = useState(null);
  const [dishes, setDishes] = useState([createEmptyDish()]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Fetch user profile
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUserId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            setUserProfile({ id: doc.id, ...doc.data() });
          }
        },
        (error) => {
          console.error('Error fetching user profile:', error);
        }
      );

    return unsubscribe;
  }, [currentUserId]);

  // Validate all dishes
  const formValidation = useMemo(() => {
    const errors = [];
    let isValid = true;

    if (dishes.length === 0) {
      errors.push('Add at least one dish');
      isValid = false;
    }

    dishes.forEach((dish, index) => {
      const dishNum = index + 1;
      
      if (dish.photos.length === 0) {
        errors.push(`Dish ${dishNum}: Add at least one photo`);
        isValid = false;
      }
      
      if (!dish.name || dish.name.trim().length < 3) {
        errors.push(`Dish ${dishNum}: Name must be at least 3 characters`);
        isValid = false;
      }
      
      const price = parseFloat(dish.price);
      if (isNaN(price) || price < 1 || price > MAX_PRICE) {
        errors.push(`Dish ${dishNum}: Price must be between ₹1 and ₹${MAX_PRICE}`);
        isValid = false;
      }
      
      const portions = parseInt(dish.portions, 10);
      if (isNaN(portions) || portions < 1 || portions > MAX_PORTIONS) {
        errors.push(`Dish ${dishNum}: Portions must be between 1 and ${MAX_PORTIONS}`);
        isValid = false;
      }
    });

    return { isValid, errors };
  }, [dishes]);

  // Header with Post button
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Today's Menu",
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
      },
      headerRight: () => (
        <TouchableOpacity
          onPress={handlePost}
          disabled={!formValidation.isValid || posting}
          style={styles.headerPostButton}
          accessibilityLabel="Post menu"
        >
          <Text
            style={[
              styles.headerPostButtonText,
              (!formValidation.isValid || posting) && styles.headerPostButtonDisabled,
            ]}
          >
            {posting ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, formValidation.isValid, posting]);

  // Add photo to a dish
  const handleAddPhoto = useCallback((dishId) => {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish) return;

    if (dish.photos.length >= MAX_PHOTOS_PER_DISH) {
      Alert.alert('Limit Reached', `Maximum ${MAX_PHOTOS_PER_DISH} photos per dish.`);
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: MAX_PHOTOS_PER_DISH - dish.photos.length,
        quality: 0.7,
        maxWidth: 1200,
        maxHeight: 1200,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Failed to pick image.');
          return;
        }

        const newPhotos = (response.assets || []).map((asset) => ({
          id: generateId(),
          uri: asset.uri,
          fileName: asset.fileName,
          type: asset.type,
        }));

        setDishes((prev) =>
          prev.map((d) =>
            d.id === dishId
              ? { ...d, photos: [...d.photos, ...newPhotos].slice(0, MAX_PHOTOS_PER_DISH) }
              : d
          )
        );
      }
    );
  }, [dishes]);

  // Remove photo from a dish
  const handleRemovePhoto = useCallback((dishId, photoId) => {
    setDishes((prev) =>
      prev.map((d) =>
        d.id === dishId
          ? { ...d, photos: d.photos.filter((p) => p.id !== photoId) }
          : d
      )
    );
  }, []);

  // Update dish field
  const updateDishField = useCallback((dishId, field, value) => {
    setDishes((prev) =>
      prev.map((d) => (d.id === dishId ? { ...d, [field]: value } : d))
    );
  }, []);

  // Add new dish
  const handleAddDish = useCallback(() => {
    if (dishes.length >= MAX_DISHES) {
      Alert.alert('Limit Reached', `Maximum ${MAX_DISHES} dishes allowed.`);
      return;
    }
    setDishes((prev) => [...prev, createEmptyDish()]);
  }, [dishes.length]);

  // Remove dish
  const handleRemoveDish = useCallback((dishId) => {
    if (dishes.length <= 1) return;

    Alert.alert('Remove Dish', 'Are you sure you want to remove this dish?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setDishes((prev) => prev.filter((d) => d.id !== dishId));
        },
      },
    ]);
  }, [dishes.length]);

  // Upload image to Firebase Storage
  const uploadImage = async (uri, path) => {
    const reference = storage().ref(path);
    await reference.putFile(uri);
    return await reference.getDownloadURL();
  };

  // Post menu
  const handlePost = useCallback(async () => {
    if (!formValidation.isValid || posting) return;
    if (!communityId || !currentUserId) {
      Alert.alert('Error', 'Missing community or user information.');
      return;
    }

    setPosting(true);
    setUploadProgress('Preparing...');

    try {
      const postId = generateId();
      const dishesData = [];
      let totalPhotos = dishes.reduce((sum, d) => sum + d.photos.length, 0);
      let uploadedPhotos = 0;

      // Process each dish
      for (const dish of dishes) {
        const dishId = generateId();
        const photoUrls = [];

        // Upload each photo
        for (let i = 0; i < dish.photos.length; i++) {
          const photo = dish.photos[i];
          const path = `posts/${communityId}/${postId}/${dishId}/image_${i}.jpg`;
          
          setUploadProgress(`Uploading photos... ${uploadedPhotos + 1}/${totalPhotos}`);
          
          const url = await uploadImage(photo.uri, path);
          photoUrls.push(url);
          uploadedPhotos++;
        }

        dishesData.push({
          dishId,
          name: dish.name.trim(),
          photos: photoUrls,
          pricePerPortion: parseFloat(dish.price),
          portionsAvailable: parseInt(dish.portions, 10),
          portionsReserved: 0,
          portionsSold: 0,
        });
      }

      setUploadProgress('Creating post...');

      // Calculate end of day for expiry
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Create post document matching Firestore structure
      await firestore().collection('posts').doc(postId).set({
        postId,
        userId: currentUserId,
        userName: userProfile?.name || currentUser?.displayName || 'Anonymous',
        userAvatar: userProfile?.profilePictureUrl || null,
        communityId,
        communityName: communityName || '',
        dishes: dishesData,
        totalDishes: dishesData.length,
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: firestore.Timestamp.fromDate(endOfDay),
        status: 'active',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      Alert.alert('Success', 'Your menu is now live!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Post creation error:', error);
      Alert.alert('Error', 'Failed to post your menu. Please try again.');
    }

    setPosting(false);
    setUploadProgress('');
  }, [formValidation.isValid, posting, communityId, currentUserId, dishes, userProfile, currentUser, navigation]);

  // Render single dish form
  const renderDishForm = (dish, index) => (
    <View key={dish.id} style={styles.dishCard}>
      <View style={styles.dishHeader}>
        <Text style={styles.dishNumber}>Dish {index + 1}</Text>
        {dishes.length > 1 && (
          <TouchableOpacity onPress={() => handleRemoveDish(dish.id)}>
            <Text style={styles.removeDishText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photos Field */}
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>📷 Photos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photosScroll}
          contentContainerStyle={styles.photosContent}
        >
          {dish.photos.map((photo) => (
            <View key={photo.id} style={styles.photoContainer}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
              <TouchableOpacity
                style={styles.photoRemoveButton}
                onPress={() => handleRemovePhoto(dish.id, photo.id)}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {dish.photos.length < MAX_PHOTOS_PER_DISH && (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => handleAddPhoto(dish.id)}
            >
              <Text style={styles.addPhotoIcon}>+</Text>
              <Text style={styles.addPhotoText}>Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        {dish.photos.length === 0 && (
          <Text style={styles.fieldHint}>Add at least 1 photo</Text>
        )}
      </View>

      {/* Dish Name Field */}
      <View style={styles.fieldContainer}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>Dish Name</Text>
          <Text style={styles.charCount}>
            {dish.name.length}/{MAX_NAME_LENGTH}
          </Text>
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Chicken Biryani"
          placeholderTextColor={COLORS.textMuted}
          value={dish.name}
          onChangeText={(text) => updateDishField(dish.id, 'name', text.slice(0, MAX_NAME_LENGTH))}
          maxLength={MAX_NAME_LENGTH}
        />
      </View>

      {/* Price Field */}
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Price per Portion</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="80"
            placeholderTextColor={COLORS.textMuted}
            value={dish.price}
            onChangeText={(text) => updateDishField(dish.id, 'price', text.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Portions Field */}
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Portions Available</Text>
        <View style={styles.portionsContainer}>
          <TouchableOpacity
            style={styles.portionButton}
            onPress={() => {
              const current = parseInt(dish.portions, 10) || 0;
              if (current > 1) {
                updateDishField(dish.id, 'portions', String(current - 1));
              }
            }}
          >
            <Text style={styles.portionButtonText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.portionInput}
            placeholder="10"
            placeholderTextColor={COLORS.textMuted}
            value={dish.portions}
            onChangeText={(text) => updateDishField(dish.id, 'portions', text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={styles.portionButton}
            onPress={() => {
              const current = parseInt(dish.portions, 10) || 0;
              if (current < MAX_PORTIONS) {
                updateDishField(dish.id, 'portions', String(current + 1));
              }
            }}
          >
            <Text style={styles.portionButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!communityId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Community not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.userRow}>
            {userProfile?.profilePictureUrl ? (
              <Image
                source={{ uri: userProfile.profilePictureUrl }}
                style={styles.userAvatar}
              />
            ) : (
              <View style={styles.userAvatarFallback}>
                <Text style={styles.userAvatarText}>
                  {getInitials(userProfile?.name || currentUser?.displayName)}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userProfile?.name || currentUser?.displayName || 'You'}
              </Text>
              <View style={styles.communityBadge}>
                <Text style={styles.communityBadgeText}>{communityName || 'Community'}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.headerTitle}>What are you cooking today?</Text>
        </View>

        {/* Dishes Forms */}
        {dishes.map((dish, index) => renderDishForm(dish, index))}

        {/* Add Another Dish Button */}
        {dishes.length < MAX_DISHES && (
          <TouchableOpacity style={styles.addDishButton} onPress={handleAddDish}>
            <Text style={styles.addDishIcon}>+</Text>
            <Text style={styles.addDishText}>Add Another Dish</Text>
          </TouchableOpacity>
        )}

        {/* Validation Errors */}
        {!formValidation.isValid && formValidation.errors.length > 0 && (
          <View style={styles.errorsContainer}>
            <Text style={styles.errorsTitle}>Please fix the following:</Text>
            {formValidation.errors.map((error, index) => (
              <Text key={index} style={styles.errorItem}>• {error}</Text>
            ))}
          </View>
        )}

        {/* Upload Progress */}
        {posting && uploadProgress ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.progressText}>{uploadProgress}</Text>
          </View>
        ) : null}

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },

  // Header styles
  headerPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerPostButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerPostButtonDisabled: {
    color: COLORS.textMuted,
  },

  // User header section
  headerSection: {
    marginBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.border,
  },
  userAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  communityBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  communityBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },

  // Dish card
  dishCard: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dishNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  removeDishText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Field styles
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },

  // Photos
  photosScroll: {
    marginHorizontal: -4,
  },
  photosContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  photoContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  addPhotoIcon: {
    fontSize: 24,
    color: COLORS.textMuted,
  },
  addPhotoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Text input
  textInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  // Price input
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  // Portions input
  portionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portionButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  portionInput: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
  },

  // Add dish button
  addDishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    marginBottom: 16,
  },
  addDishIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 8,
  },
  addDishText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Errors
  errorsContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 8,
  },
  errorItem: {
    fontSize: 13,
    color: COLORS.error,
    marginBottom: 4,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});

export default TodaysMenuScreen;
